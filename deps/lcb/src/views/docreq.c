#include "docreq.h"
#include "internal.h"
#include "sllist-inl.h"

static void docreq_handler(void *arg);
static void invoke_pending(lcb_DOCQUEUE*);
static void doc_callback(lcb_t,int, const lcb_RESPBASE *);

#define MAX_PENDING_DOCREQ 10
#define MIN_SCHED_SIZE 5
#define DOCQ_DELAY_US 200000

#define DOCQ_REF(q) (q)->refcount++
#define DOCQ_UNREF(q) if (!--(q)->refcount) { docq_free(q); }

lcb_DOCQUEUE *
lcbdocq_create(lcb_t instance)
{
    lcb_DOCQUEUE *q = calloc(1, sizeof *q);
    q->timer = lcbio_timer_new(instance->iotable, q, docreq_handler);
    q->refcount = 1;
    q->instance = instance;
    q->max_pending_response = MAX_PENDING_DOCREQ;
    q->min_batch_size = MIN_SCHED_SIZE;
    return q;
}

static void
docq_free(lcb_DOCQUEUE *q)
{
    lcbdocq_cancel(q);
    lcbio_timer_destroy(q->timer);
    free(q);
}

void
lcbdocq_unref(lcb_DOCQUEUE *q)
{
    DOCQ_UNREF(q);
}

void
lcbdocq_cancel(lcb_DOCQUEUE *q)
{
    if (!q->cancelled) {
        q->cancelled = 1;
    }
}

/* Calling this function ensures that the request will be scheduled in due
 * time. This may be done at the next event loop iteration, or after a delay
 * depending on how many items are actually found within the queue. */
static void
docq_poke(lcb_DOCQUEUE *q)
{
    if (q->n_awaiting_response < q->max_pending_response) {
        if (q->n_awaiting_schedule > q->min_batch_size) {
            lcbio_async_signal(q->timer);
            q->cb_throttle(q, 0);
        }
    }

    if (!lcbio_timer_armed(q->timer)) {
        lcbio_timer_rearm(q->timer, DOCQ_DELAY_US);
    }
}

void
lcbdocq_add(lcb_DOCQUEUE *q, lcb_DOCQREQ *req)
{
    sllist_append(&q->pending_gets, &req->slnode);
    q->n_awaiting_schedule++;
    req->parent = q;
    req->ready = 0;
    DOCQ_REF(q);
    docq_poke(q);
}

static void
docreq_handler(void *arg)
{
    lcb_DOCQUEUE *q = arg;
    sllist_iterator iter;
    lcb_t instance = q->instance;

    lcb_sched_enter(instance);
    SLLIST_ITERFOR(&q->pending_gets, &iter) {
        lcb_DOCQREQ *cont = SLLIST_ITEM(iter.cur, lcb_DOCQREQ, slnode);

        if (q->n_awaiting_response > q->max_pending_response) {
            lcbio_timer_rearm(q->timer, DOCQ_DELAY_US);
            q->cb_throttle(q, 1);
            break;
        }

        q->n_awaiting_schedule--;

        if (q->cancelled) {
            cont->docresp.rc = LCB_EINTERNAL;
            cont->ready = 1;

        } else {
            lcb_error_t rc;
            lcb_CMDGET gcmd = { 0 };

            LCB_CMD_SET_KEY(&gcmd, cont->docid.iov_base, cont->docid.iov_len);
            cont->callback = doc_callback;
            gcmd.cmdflags |= LCB_CMD_F_INTERNAL_CALLBACK;
            rc = lcb_get3(instance, &cont->callback, &gcmd);

            if (rc != LCB_SUCCESS) {
                cont->docresp.rc = rc;
                cont->ready = 1;
            } else {
                q->n_awaiting_response++;
            }
        }
        sllist_iter_remove(&q->pending_gets, &iter);
        sllist_append(&q->cb_queue, &cont->slnode);
    }

    lcb_sched_leave(instance);
    lcb_sched_flush(instance);

    if (q->n_awaiting_schedule < q->min_batch_size) {
        q->cb_throttle(q, 0);
    }

    /* Ensure we're called again */
    docq_poke(q);

    /* Flush out any bad responses */
    invoke_pending(q);
}

/* Invokes the callback on all requests which are ready, until a request which
 * is not yet ready is reached. */
static void
invoke_pending(lcb_DOCQUEUE *q)
{
    sllist_iterator iter = { NULL };

    DOCQ_REF(q);
    SLLIST_ITERFOR(&q->cb_queue, &iter) {
        lcb_DOCQREQ *dreq = SLLIST_ITEM(iter.cur, lcb_DOCQREQ, slnode);
        void *bufh = NULL;

        if (dreq->ready == 0) {
            break;
        }

        if (dreq->docresp.rc == LCB_SUCCESS && dreq->docresp.bufh) {
            bufh = dreq->docresp.bufh;
        }

        sllist_iter_remove(&q->cb_queue, &iter);

        q->cb_ready(q, dreq);
        if (bufh) {
            lcb_backbuf_unref(bufh);
        }
        DOCQ_UNREF(q);
    }
    DOCQ_UNREF(q);
}

static void
doc_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    const lcb_RESPGET *rg = (const lcb_RESPGET *)rb;
    lcb_DOCQREQ *dreq = rb->cookie;
    lcb_DOCQUEUE *q = dreq->parent;

    DOCQ_REF(q);

    q->n_awaiting_response--;
    dreq->docresp = *rg;
    dreq->ready = 1;
    dreq->docresp.key = dreq->docid.iov_base;
    dreq->docresp.nkey = dreq->docid.iov_len;

    /* Reference the response data, since we might not be invoking this right
     * away */
    if (rg->rc == LCB_SUCCESS) {
        lcb_backbuf_ref(dreq->docresp.bufh);
    }

    /* Ensure the invoke_pending doesn't destroy us */
    invoke_pending(q);
    docq_poke(q);

    DOCQ_UNREF(q);
    (void)instance; (void)cbtype;
}
