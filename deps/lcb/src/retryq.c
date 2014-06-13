#include "packetutils.h"
#include "retryq.h"
#include "config.h"
#include "logging.h"
#include "internal.h"

#define LOGARGS(rq, lvl) (rq)->settings, "retryq", LCB_LOG_##lvl, __FILE__, __LINE__

typedef struct {
    lcb_list_t ll_sched;
    lcb_list_t ll_tmo;
    hrtime_t trytime; /**< Next retry time */
    mc_PACKET *pkt;
} lcb_RETRYOP;

#define RETRY_INTERVAL_NS(q) LCB_US2NS((q)->settings->retry_interval)

/**
 * Fuzz offset. When callback is received to schedule an operation, we may
 * retry commands whose expiry is up to this many seconds in the future. This
 * is to avoid excessive callbacks into the timer function
 */
#define TIMEFUZZ_NS LCB_US2NS(LCB_MS2US(5))

/** Comparison routine for sorting by timeout */
static int
cmpfn_tmo(lcb_list_t *ll_a, lcb_list_t *ll_b)
{
    lcb_RETRYOP *a = LCB_LIST_ITEM(ll_a, lcb_RETRYOP, ll_tmo);
    lcb_RETRYOP *b = LCB_LIST_ITEM(ll_b, lcb_RETRYOP, ll_tmo);
    hrtime_t start_a = MCREQ_PKT_RDATA(a->pkt)->start;
    hrtime_t start_b = MCREQ_PKT_RDATA(b->pkt)->start;

    if (start_a == start_b) {
        return 0;
    } else if (start_a > start_b) {
        return 1;
    } else {
        return -1;
    }
}

static int
cmpfn_retry(lcb_list_t *ll_a, lcb_list_t *ll_b)
{
    lcb_RETRYOP *a = LCB_LIST_ITEM(ll_a, lcb_RETRYOP, ll_sched);
    lcb_RETRYOP *b = LCB_LIST_ITEM(ll_b, lcb_RETRYOP, ll_sched);
    if (a->trytime == b->trytime) {
        return 0;
    } else if (a->trytime > b->trytime) {
        return 1;
    } else {
        return -1;
    }
}

static void
free_op(lcb_RETRYOP *op)
{
    lcb_list_delete(&op->ll_sched);
    lcb_list_delete(&op->ll_tmo);
    free(op);
}

static void
bail_op(lcb_RETRYQ *rq, lcb_RETRYOP *op, lcb_error_t err)
{
    packet_info info;
    protocol_binary_request_header hdr;
    protocol_binary_response_header *res = &info.res;
    mc_SERVER tmpsrv; /** Temporary pipeline */
    mc_PIPELINE *pltmp = &tmpsrv.pipeline;

    memset(&tmpsrv, 0, sizeof tmpsrv);
    tmpsrv.instance = rq->cq->instance;
    tmpsrv.pipeline.parent = rq->cq;

    memset(&info, 0, sizeof(info));
    mcreq_read_hdr(op->pkt, &hdr);
    res->response.opcode = hdr.request.opcode;
    res->response.status = ntohs(PROTOCOL_BINARY_RESPONSE_EINVAL);
    res->response.opaque = hdr.request.opaque;
    mcreq_dispatch_response(pltmp, op->pkt, &info, err);
    op->pkt->flags |= MCREQ_F_FLUSHED|MCREQ_F_INVOKED;
    mcreq_packet_done(pltmp, op->pkt);
    free_op(op);
    lcb_maybe_breakout(rq->cq->instance);
}

static void
do_schedule(lcb_RETRYQ *q, hrtime_t now)
{
    hrtime_t tmonext, schednext, diff, selected;
    uint32_t us_interval;
    lcb_RETRYOP *first_tmo, *first_sched;

    if (!now) {
        now = gethrtime();
    }

    if (LCB_LIST_IS_EMPTY(&q->schedops)) {
        lcbio_timer_disarm(q->timer);
        return;
    }
    /** Figure out which is first */
    first_tmo = LCB_LIST_ITEM(LCB_LIST_HEAD(&q->tmoops), lcb_RETRYOP, ll_tmo);
    first_sched = LCB_LIST_ITEM(LCB_LIST_HEAD(&q->schedops), lcb_RETRYOP, ll_sched);

    schednext = first_sched->trytime;
    tmonext = MCREQ_PKT_RDATA(first_tmo->pkt)->start;
    selected = schednext > tmonext ? tmonext : schednext;
    if (selected <= now) {
        diff = 0;
    } else {
        diff = now - selected;
    }

    us_interval = LCB_NS2US(diff);
    lcbio_timer_rearm(q->timer, us_interval);
}

/**
 * Flush the queue
 * @param rq The queue to flush
 * @param throttle Whether to throttle operations to be retried. If this is
 * set to false then all operations will be attempted (assuming they have
 * not timed out)
 */
static void
rq_flush(lcb_RETRYQ *rq, int throttle)
{
    hrtime_t now = gethrtime();
    lcb_list_t *ll, *ll_next;
    lcb_list_t resched_next;

    /** Check timeouts first */
    LCB_LIST_SAFE_FOR(ll, ll_next, &rq->tmoops) {
        lcb_RETRYOP *op = LCB_LIST_ITEM(ll, lcb_RETRYOP, ll_tmo);
        hrtime_t curtmo =
                MCREQ_PKT_RDATA(op->pkt)->start +
                LCB_US2NS(rq->settings->operation_timeout);

        if (curtmo <= now) {
            bail_op(rq, op, LCB_ETIMEDOUT);
        } else {
            break;
        }
    }

    lcb_list_init(&resched_next);
    LCB_LIST_SAFE_FOR(ll, ll_next, &rq->schedops) {
        protocol_binary_request_header hdr;
        int vbid, srvix;
        hrtime_t curnext;

        lcb_RETRYOP *op = LCB_LIST_ITEM(ll, lcb_RETRYOP, ll_sched);
        curnext = op->trytime - TIMEFUZZ_NS;

        if (curnext > now && throttle) {
            break;
        }

        mcreq_read_hdr(op->pkt, &hdr);
        vbid = ntohs(hdr.request.vbucket);
        srvix = vbucket_get_master(rq->cq->config, vbid);

        if (srvix < 0 || (unsigned)srvix >= rq->cq->npipelines) {
            /**If there's no server to send it out to, place it inside the
             * queue again */
            lcb_list_delete(&op->ll_sched);
            lcb_list_delete(&op->ll_tmo);
            lcb_list_append(&resched_next, &op->ll_sched);

        } else {
            mc_PIPELINE *newpl = rq->cq->pipelines[srvix];
            mcreq_enqueue_packet(newpl, op->pkt);
            newpl->flush_start(newpl);
            free_op(op);
        }
    }

    LCB_LIST_SAFE_FOR(ll, ll_next, &resched_next) {
        lcb_RETRYOP *op = LCB_LIST_ITEM(ll, lcb_RETRYOP, ll_sched);
        lcb_list_add_sorted(&rq->schedops, &op->ll_sched, cmpfn_retry);
        lcb_list_add_sorted(&rq->tmoops, &op->ll_tmo, cmpfn_tmo);
    }

    do_schedule(rq, now);

}

static void
rq_tick(void *arg)
{
    rq_flush(arg, 1);
}

void
lcb_retryq_signal(lcb_RETRYQ *rq)
{
    rq_flush(rq, 0);
}

void
lcb_retryq_add(lcb_RETRYQ *rq, mc_PACKET *pkt)
{
    hrtime_t now;
    lcb_RETRYOP *op = calloc(1, sizeof(*op));

    op->pkt = pkt;
    pkt->retries++;
    now = gethrtime();

    /**
     * Estimate the next retry timestamp. This is:
     * Base interval + (Number of retries x Backoff factor)
     */
    op->trytime = now + (hrtime_t) (
            (float)RETRY_INTERVAL_NS(rq) *
            (float)pkt->retries *
            (float)rq->settings->retry_backoff);

    lcb_list_add_sorted(&rq->schedops, &op->ll_sched, cmpfn_retry);
    lcb_list_add_sorted(&rq->tmoops, &op->ll_tmo, cmpfn_tmo);

    lcb_log(LOGARGS(rq, DEBUG), "Adding PKT=%p to retry queue. Try count=%u", (void*)pkt, pkt->retries);
    do_schedule(rq, 0);
}

lcb_RETRYQ *
lcb_retryq_new(mc_CMDQUEUE *cq, lcbio_pTABLE table, lcb_settings *settings)
{
    lcb_RETRYQ *rq = calloc(1, sizeof(*rq));

    rq->settings = settings;
    rq->cq = cq;
    rq->timer = lcbio_timer_new(table, rq, rq_tick);

    lcb_settings_ref(settings);
    lcb_list_init(&rq->tmoops);
    lcb_list_init(&rq->schedops);
    return rq;
}

void
lcb_retryq_destroy(lcb_RETRYQ *rq)
{
    lcb_list_t *llcur, *llnext;

    LCB_LIST_SAFE_FOR(llcur, llnext, &rq->schedops) {
        lcb_RETRYOP *op = LCB_LIST_ITEM(llcur, lcb_RETRYOP, ll_sched);
        bail_op(rq, op, LCB_ERROR);
    }

    lcbio_timer_destroy(rq->timer);
    lcb_settings_unref(rq->settings);
    free(rq);
}
