/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#include "packetutils.h"
#include "retryq.h"
#include "config.h"
#include "logging.h"
#include "internal.h"
#include "bucketconfig/clconfig.h"

#define LOGARGS(rq, lvl) (rq)->settings, "retryq", LCB_LOG_##lvl, __FILE__, __LINE__
#define RETRY_PKT_KEY "retry_queue"

typedef struct {
    mc_EPKTDATUM epd;
    lcb_list_t ll_sched;
    lcb_list_t ll_tmo;
    hrtime_t trytime; /**< Next retry time */
    mc_PACKET *pkt;
    lcb_error_t origerr;
} lcb_RETRYOP;

#define RETRY_INTERVAL_NS(q) LCB_US2NS((q)->settings->retry_interval)

/**
 * Fuzz offset. When callback is received to schedule an operation, we may
 * retry commands whose expiry is up to this many seconds in the future. This
 * is to avoid excessive callbacks into the timer function
 */
#define TIMEFUZZ_NS LCB_US2NS(LCB_MS2US(5))

static void
update_trytime(lcb_RETRYQ *rq, lcb_RETRYOP *op, hrtime_t now)
{
    /**
     * Estimate the next retry timestamp. This is:
     * Base interval + (Number of retries x Backoff factor)
     */
    if (!now) {
        now = gethrtime();
    }
    op->trytime = now + (hrtime_t) (
            (float)RETRY_INTERVAL_NS(rq) *
            (float)op->pkt->retries *
            (float)rq->settings->retry_backoff);
}

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
assign_error(lcb_RETRYOP *op, lcb_error_t err)
{
    if (err == LCB_NOT_MY_VBUCKET) {
        err = LCB_ETIMEDOUT; /* :( */
    }

    if (op->origerr == LCB_SUCCESS) {
        op->origerr = err;
    }

    if (err == LCB_ETIMEDOUT) {
        return; /* Ignore timeout errors */
    }

    if (LCB_EIFNET(op->origerr) && op->origerr != LCB_ETIMEDOUT &&
            (err == LCB_NETWORK_ERROR || err == LCB_CONNECT_ERROR)) {
        return;
    }

    op->origerr = err;
}

static void
clean_op(lcb_RETRYOP *op)
{
    lcb_list_delete(&op->ll_sched);
    lcb_list_delete(&op->ll_tmo);
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
    tmpsrv.instance = rq->cq->cqdata;
    tmpsrv.pipeline.parent = rq->cq;

    memset(&info, 0, sizeof(info));
    mcreq_read_hdr(op->pkt, &hdr);
    res->response.opcode = hdr.request.opcode;
    res->response.status = ntohs(PROTOCOL_BINARY_RESPONSE_EINVAL);
    res->response.opaque = hdr.request.opaque;

    assign_error(op, err);
    lcb_log(LOGARGS(rq, WARN), "Failing command (seq=%u) from retry queue with error code 0x%x", op->pkt->opaque, op->origerr);
    mcreq_dispatch_response(pltmp, op->pkt, &info, op->origerr);
    op->pkt->flags |= MCREQ_F_FLUSHED|MCREQ_F_INVOKED;
    clean_op(op);
    mcreq_packet_done(pltmp, op->pkt);
    lcb_maybe_breakout(rq->cq->cqdata);
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
    tmonext += LCB_US2NS(q->settings->operation_timeout);
    selected = schednext > tmonext ? tmonext : schednext;

    if (selected <= now) {
        diff = 0;
    } else {
        diff = selected - now;
    }

    us_interval = LCB_NS2US(diff);
    lcb_log(LOGARGS(q, TRACE), "Next tick in %u ms", (unsigned)us_interval/1000);
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
        srvix = lcbvb_vbmaster(rq->cq->config, vbid);

        if (srvix < 0 || (unsigned)srvix >= rq->cq->npipelines) {
            /* No server found to map to */
            lcb_t instance = rq->cq->cqdata;

            assign_error(op, LCB_NO_MATCHING_SERVER);

            /* Request a new configuration. If it's time to request a new
             * configuration (i.e. the attempt has not been throttled) then
             * keep the command in there until it has a chance to be scheduled.
             */
            lcb_bootstrap_common(instance, LCB_BS_REFRESH_THROTTLE);
            if (lcb_confmon_is_refreshing(instance->confmon) ||
                    rq->settings->retry[LCB_RETRY_ON_MISSINGNODE]) {

                lcb_list_delete(&op->ll_sched);
                lcb_list_delete(&op->ll_tmo);
                lcb_list_append(&resched_next, &op->ll_sched);
                op->pkt->retries++;
                update_trytime(rq, op, now);
            } else {
                bail_op(rq, op, LCB_NO_MATCHING_SERVER);
            }
        } else {
            mc_PIPELINE *newpl = rq->cq->pipelines[srvix];
            mcreq_enqueue_packet(newpl, op->pkt);
            newpl->flush_start(newpl);
            clean_op(op);
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

static void
op_dtorfn(mc_EPKTDATUM *d)
{
    free(d);
}


#define RETRY_SCHED_IMM 0x01

static void
add_op(lcb_RETRYQ *rq, mc_EXPACKET *pkt, lcb_error_t err, int options)
{
    lcb_RETRYOP *op;
    mc_EPKTDATUM *d;

    d = mcreq_epkt_find(pkt, RETRY_PKT_KEY);
    if (d) {
        op = (lcb_RETRYOP *)d;
    } else {
        op = calloc(1, sizeof *op);
        op->epd.dtorfn = op_dtorfn;
        op->epd.key = RETRY_PKT_KEY;
        mcreq_epkt_insert(pkt, &op->epd);
    }

    op->pkt = &pkt->base;
    pkt->base.retries++;
    assign_error(op, err);
    if (options & RETRY_SCHED_IMM) {
        op->trytime = gethrtime(); /* now */
    } else {
        update_trytime(rq, op, 0);
    }

    lcb_list_add_sorted(&rq->schedops, &op->ll_sched, cmpfn_retry);
    lcb_list_add_sorted(&rq->tmoops, &op->ll_tmo, cmpfn_tmo);

    lcb_log(LOGARGS(rq, DEBUG), "Adding PKT=%p to retry queue. Try count=%u", (void*)pkt, pkt->base.retries);
    do_schedule(rq, 0);
}

void
lcb_retryq_add(lcb_RETRYQ *rq, mc_EXPACKET *pkt, lcb_error_t err)
{
    add_op(rq, pkt, err, 0);
}

void
lcb_retryq_nmvadd(lcb_RETRYQ *rq, mc_EXPACKET *detchpkt)
{
    int flags = 0;
    if (rq->settings->nmv_retry_imm) {
        flags = RETRY_SCHED_IMM;
    }
    add_op(rq, detchpkt, LCB_NOT_MY_VBUCKET, flags);
}

static void
fallback_handler(mc_CMDQUEUE *cq, mc_PACKET *pkt)
{
    lcb_t instance = cq->cqdata;
    mc_PACKET *copy = mcreq_renew_packet(pkt);
    add_op(instance->retryq, (mc_EXPACKET*)copy,
        LCB_NO_MATCHING_SERVER, RETRY_SCHED_IMM);
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
    mcreq_set_fallback_handler(cq, fallback_handler);
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

lcb_error_t
lcb_retryq_origerr(const mc_PACKET *packet)
{
    mc_EPKTDATUM *d;
    lcb_RETRYOP *op;

    if (! (packet->flags & MCREQ_F_DETACHED)) {
        return LCB_SUCCESS; /* Not detached */
    }

    d = mcreq_epkt_find((mc_EXPACKET*)packet, RETRY_PKT_KEY);
    if (!d) {
        return LCB_SUCCESS;
    }

    op = (lcb_RETRYOP *)d;
    return op->origerr;
}

void
lcb_retryq_dump(lcb_RETRYQ *rq, FILE *fp, mcreq_payload_dump_fn dumpfn)
{
    lcb_list_t *cur;
    LCB_LIST_FOR(cur, &rq->schedops) {
        lcb_RETRYOP *op = LCB_LIST_ITEM(cur, lcb_RETRYOP, ll_sched);
        mcreq_dump_packet(op->pkt, fp, dumpfn);
    }
    (void)fp;
}
