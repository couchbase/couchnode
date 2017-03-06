#include "docreq.h"
#include "internal.h"
#include "sllist-inl.h"

using namespace lcb::docreq;

static void docreq_handler(void *arg);
static void invoke_pending(Queue*);
static void doc_callback(lcb_t,int, const lcb_RESPBASE *);

#define MAX_PENDING_DOCREQ 10
#define MIN_SCHED_SIZE 5
#define DOCQ_DELAY_US 200000

Queue::Queue(lcb_t instance_)
    : instance(instance_),
      parent(NULL),
      timer(lcbio_timer_new(instance->iotable, this, docreq_handler)),
      cb_ready(NULL), cb_throttle(NULL),
      n_awaiting_schedule(0),
      n_awaiting_response(0),
      max_pending_response(MAX_PENDING_DOCREQ),
      min_batch_size(MIN_SCHED_SIZE),
      cancelled(false),
      refcount(1)
      {

    memset(&pending_gets, 0, sizeof pending_gets);
    memset(&cb_queue, 0, sizeof cb_queue);
}

Queue::~Queue() {
    cancel();
    lcbio_timer_destroy(timer);
}

void Queue::unref() {
    if (!--refcount) {
        delete this;
    }
}

void Queue::cancel() {
    cancelled = true;
}

/* Calling this function ensures that the request will be scheduled in due
 * time. This may be done at the next event loop iteration, or after a delay
 * depending on how many items are actually found within the queue. */
static void
docq_poke(Queue *q)
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

void Queue::add(DocRequest *req)
{
    sllist_append(&pending_gets, &req->slnode);
    n_awaiting_schedule++;
    req->parent = this;
    req->ready = 0;
    ref();
    docq_poke(this);
}

static void
docreq_handler(void *arg)
{
    Queue *q = reinterpret_cast<Queue*>(arg);
    sllist_iterator iter;
    lcb_t instance = q->instance;

    lcb_sched_enter(instance);
    SLLIST_ITERFOR(&q->pending_gets, &iter) {
        DocRequest *cont = SLLIST_ITEM(iter.cur, DocRequest, slnode);

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
invoke_pending(Queue *q)
{
    sllist_iterator iter = { NULL };
    q->ref();
    SLLIST_ITERFOR(&q->cb_queue, &iter) {
        DocRequest *dreq = SLLIST_ITEM(iter.cur, DocRequest, slnode);
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
            lcb_backbuf_unref(reinterpret_cast<lcb_BACKBUF>(bufh));
        }
        q->unref();
    }
    q->unref();
}

static void
doc_callback(lcb_t, int, const lcb_RESPBASE *rb)
{
    const lcb_RESPGET *rg = (const lcb_RESPGET *)rb;
    DocRequest *dreq = reinterpret_cast<DocRequest*>(rb->cookie);
    Queue *q = dreq->parent;

    q->ref();

    q->n_awaiting_response--;
    dreq->docresp = *rg;
    dreq->ready = 1;
    dreq->docresp.key = dreq->docid.iov_base;
    dreq->docresp.nkey = dreq->docid.iov_len;

    /* Reference the response data, since we might not be invoking this right
     * away */
    if (rg->rc == LCB_SUCCESS) {
        lcb_backbuf_ref(reinterpret_cast<lcb_BACKBUF>(dreq->docresp.bufh));
    }

    /* Ensure the invoke_pending doesn't destroy us */
    invoke_pending(q);
    docq_poke(q);

    q->unref();
}
