/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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
#include "sllist-inl.h"
#include "mc/mcreq.h"

#define LOGARGS(rq, lvl) (rq)->settings, "retryq", LCB_LOG_##lvl, __FILE__, __LINE__
#define RETRY_PKT_KEY "retry_queue"

using namespace lcb;
struct SchedNode : lcb_list_t {
};
struct TmoNode : lcb_list_t {
};

struct lcb::RetryOp : mc_EPKTDATUM, SchedNode, TmoNode {
    /**Cache the actual start time of the command. Since the start time may
     * change if read_ts_wait is enabled, and we don't want to end up looping
     * on a command forever. */
    hrtime_t start;
    hrtime_t deadline;
    hrtime_t trytime; /**< Next retry time */
    mc_PACKET *pkt;
    lcb_STATUS origerr;
    protocol_binary_response_status origstatus;
    errmap::RetrySpec *spec;
    explicit RetryOp(errmap::RetrySpec *spec);
    ~RetryOp()
    {
        if (spec != nullptr) {
            spec->unref();
        }
    }
};

static RetryOp *from_schednode(lcb_list_t *ll)
{
    return static_cast<RetryOp *>(static_cast<SchedNode *>(ll));
}
static RetryOp *from_tmonode(lcb_list_t *ll)
{
    return static_cast<RetryOp *>(static_cast<TmoNode *>(ll));
}
template <typename T>
int list_cmp(const T &a, const T &b)
{
    if (a == b) {
        return 0;
    } else if (a > b) {
        return 1;
    } else {
        return -1;
    }
}

hrtime_t RetryQueue::get_retry_interval() const
{
    return LCB_US2NS(settings->retry_interval);
}

/**
 * Fuzz offset. When callback is received to schedule an operation, we may
 * retry commands whose expiry is up to this many seconds in the future. This
 * is to avoid excessive callbacks into the timer function
 */
#define TIMEFUZZ_NS LCB_US2NS(LCB_MS2US(5))

void RetryQueue::update_trytime(RetryOp *op, hrtime_t now)
{
    /**
     * Estimate the next retry timestamp. This is:
     * Base interval + (Number of retries x Backoff factor)
     */
    if (!now) {
        now = gethrtime();
    }

    if (op->spec) {
        uint32_t us_trytime = op->spec->get_next_interval(op->pkt->retries - 1);
        if (op->pkt->retries == 1) {
            us_trytime += op->spec->after;
        }
        if (!us_trytime) {
            goto GT_DEFAULT;
        }
        op->trytime = now + (LCB_US2NS(us_trytime));
    } else {
    GT_DEFAULT:
        op->trytime = now + (hrtime_t)((float)get_retry_interval() * (float)op->pkt->retries);
    }
}

/** Comparison routine for sorting by timeout */
static int cmpfn_tmo(lcb_list_t *ll_a, lcb_list_t *ll_b)
{
    return list_cmp(from_tmonode(ll_a)->deadline, from_tmonode(ll_b)->deadline);
}

static int cmpfn_retry(lcb_list_t *ll_a, lcb_list_t *ll_b)
{
    return list_cmp(from_schednode(ll_a)->trytime, from_schednode(ll_b)->trytime);
}

static void assign_error(RetryOp *op, lcb_STATUS err)
{
    if (err == LCB_ERR_NOT_MY_VBUCKET) {
        err = LCB_ERR_TIMEOUT; /* :( */
    }

    if (op->origerr == LCB_SUCCESS) {
        op->origerr = err;
    }

    if (err == LCB_ERR_TIMEOUT) {
        return; /* Ignore timeout errors */
    }

    if (LCB_ERROR_IS_NETWORK(op->origerr) && op->origerr != LCB_ERR_TIMEOUT &&
        (err == LCB_ERR_NETWORK || err == LCB_ERR_CONNECT_ERROR)) {
        return;
    }

    op->origerr = err;
}

void RetryQueue::erase(RetryOp *op)
{
    lcb_list_delete(static_cast<SchedNode *>(op));
    lcb_list_delete(static_cast<TmoNode *>(op));
}

void RetryQueue::fail(RetryOp *op, lcb_STATUS err, hrtime_t now)
{
    protocol_binary_request_header hdr;

    lcb::Server tmpsrv; /** Temporary pipeline */
    tmpsrv.instance = get_instance();
    tmpsrv.parent = cq;

    mcreq_read_hdr(op->pkt, &hdr);
    MemcachedResponse resp(protocol_binary_command(hdr.request.opcode), hdr.request.opaque, op->origstatus);

    assign_error(op, err);
    lcb_log(LOGARGS(this, WARN),
            "Failing command (pkt=%p, opaque=%u, retries=%d, now=%" PRIu64 "ms, spent=%" PRIu64
            "us, status=0x%02x) requested error: %s, from retry queue: %s",
            (void *)op->pkt, op->pkt->opaque, (int)op->pkt->retries, LCB_NS2MS(now), LCB_NS2US(now - op->start),
            (int)op->origstatus, lcb_strerror_short(err), lcb_strerror_short(op->origerr));
    lcb_STATUS immerr = op->origerr;
    if ((op->origstatus == PROTOCOL_BINARY_RESPONSE_UNSPECIFIED && LCB_ERROR_IS_NETWORK(op->origerr)) ||
        op->origerr == LCB_ERR_BUCKET_NOT_FOUND) {
        immerr = err;
    }
    mcreq_dispatch_response(&tmpsrv, op->pkt, &resp, immerr);
    op->pkt->flags |= MCREQ_F_FLUSHED | MCREQ_F_INVOKED;
    erase(op);
    mcreq_packet_done(&tmpsrv, op->pkt);
    lcb_maybe_breakout(get_instance());
}

void RetryQueue::schedule(hrtime_t now)
{
    if (empty()) {
        lcbio_timer_disarm(timer);
        return;
    }

    if (!now) {
        now = gethrtime();
    }

    /** Figure out which is first */
    RetryOp *first_tmo = from_tmonode(LCB_LIST_HEAD(&tmoops));
    RetryOp *first_sched = from_schednode(LCB_LIST_HEAD(&schedops));

    hrtime_t schednext = first_sched->trytime;
    hrtime_t tmonext = first_tmo->deadline;
    hrtime_t selected = schednext > tmonext ? tmonext : schednext;

    hrtime_t diff;
    if (selected <= now) {
        diff = 0;
    } else {
        diff = selected - now;
    }

    uint64_t us_interval = LCB_NS2US(diff);
    lcb_log(LOGARGS(this, TRACE), "Next tick in %" PRIu64 " ms", us_interval / 1000);
    lcbio_timer_rearm(timer, us_interval);
}

/**
 * Flush the queue
 * @param rq The queue to flush
 * @param throttle Whether to throttle operations to be retried. If this is
 * set to false then all operations will be attempted (assuming they have
 * not timed out)
 */
void RetryQueue::flush(bool throttle)
{
    hrtime_t now = gethrtime();
    lcb_list_t *ll, *ll_next;
    lcb_list_t resched_next;

    /** Check timeouts first */
    LCB_LIST_SAFE_FOR(ll, ll_next, &tmoops)
    {
        RetryOp *op = from_tmonode(ll);
        hrtime_t curtmo = op->deadline;

        if (curtmo <= now) {
            fail(op, LCB_ERR_TIMEOUT, now);
        } else {
            break;
        }
    }

    lcb_list_init(&resched_next);
    LCB_LIST_SAFE_FOR(ll, ll_next, &schedops)
    {
        protocol_binary_request_header hdr;
        int vbid, srvix;
        hrtime_t curnext;

        RetryOp *op = from_schednode(ll);
        curnext = op->trytime - TIMEFUZZ_NS;

        if (curnext > now && throttle) {
            break;
        }

        mcreq_read_hdr(op->pkt, &hdr);
        vbid = ntohs(hdr.request.vbucket);
        srvix = lcbvb_vbmaster(cq->config, vbid);

        if (srvix < 0 || (unsigned)srvix >= cq->npipelines) {
            /* No server found to map to */
            assign_error(op, LCB_ERR_NO_MATCHING_SERVER);

            /* Request a new configuration. If it's time to request a new
             * configuration (i.e. the attempt has not been throttled) then
             * keep the command in there until it has a chance to be scheduled.
             */
            get_instance()->bootstrap(lcb::BS_REFRESH_THROTTLE);
            if (get_instance()->confmon->is_refreshing() || settings->retry[LCB_RETRY_ON_MISSINGNODE]) {

                lcb_list_delete(static_cast<SchedNode *>(op));
                lcb_list_delete(static_cast<TmoNode *>(op));
                lcb_list_append(&resched_next, static_cast<SchedNode *>(op));
                op->pkt->retries++;
                update_trytime(op, now);
            } else {
                fail(op, LCB_ERR_NO_MATCHING_SERVER, now);
            }
        } else {
            uint32_t cid = mcreq_get_cid(get_instance(), op->pkt);
            lcb_log(LOGARGS(this, TRACE),
                    "Flush PKT=%p to network. retries=%u, cid=%u, opaque=%u, IX=%d, spent=%" PRIu64
                    "us, deadline_in=%" PRIu64 "us",
                    (void *)op->pkt, op->pkt->retries, cid, op->pkt->opaque, srvix, LCB_NS2US(now - op->start),
                    LCB_NS2US(op->deadline - now));
            mc_PIPELINE *newpl = cq->pipelines[srvix];
            mcreq_enqueue_packet(newpl, op->pkt);
            newpl->flush_start(newpl);
            erase(op);
        }
    }

    LCB_LIST_SAFE_FOR(ll, ll_next, &resched_next)
    {
        RetryOp *op = from_schednode(ll);
        lcb_list_add_sorted(&schedops, static_cast<SchedNode *>(op), cmpfn_retry);
        lcb_list_add_sorted(&tmoops, static_cast<TmoNode *>(op), cmpfn_tmo);
    }

    schedule(now);
}

static void rq_tick(void *arg)
{
    reinterpret_cast<RetryQueue *>(arg)->tick();
}

void RetryQueue::tick()
{
    flush(true);
}

void RetryQueue::signal()
{
    flush(false);
}

static void op_dtorfn(mc_EPKTDATUM *d)
{
    delete static_cast<RetryOp *>(d);
}

RetryOp::RetryOp(errmap::RetrySpec *spec_)
    : mc_EPKTDATUM(), start(0), deadline(0), trytime(0), pkt(nullptr), origerr(LCB_SUCCESS),
      origstatus(PROTOCOL_BINARY_RESPONSE_SUCCESS), spec(spec_)
{
    mc_EPKTDATUM::dtorfn = op_dtorfn;
    mc_EPKTDATUM::key = RETRY_PKT_KEY;

    if (spec != nullptr) {
        spec->ref();
    }
}

void RetryQueue::add(mc_EXPACKET *pkt, const lcb_STATUS err, protocol_binary_response_status status,
                     errmap::RetrySpec *spec, int options)
{
    RetryOp *op;
    mc_EPKTDATUM *d = mcreq_epkt_find(pkt, RETRY_PKT_KEY);
    if (d) {
        op = static_cast<RetryOp *>(d);
    } else {
        op = new RetryOp(nullptr);
        op->start = MCREQ_PKT_RDATA(&pkt->base)->start;
        op->deadline = MCREQ_PKT_RDATA(&pkt->base)->deadline;
        if (spec) {
            op->spec = spec;
            spec->ref();
            hrtime_t operation_timeout = LCB_NS2US(op->deadline - op->start);

            if (spec->max_duration && spec->max_duration < operation_timeout) {
                // Offset the start by the difference between the duration and
                // the timeout. We really use this number only for calculating
                // the timeout, so it shouldn't hurt to fake it.
                uint32_t diff = operation_timeout - op->spec->max_duration;
                op->start -= LCB_US2NS(diff);
                op->deadline -= LCB_US2NS(diff);
            }
        }
        mcreq_epkt_insert(pkt, op);
    }

    if (op->pkt) {
        /* if there is an old packet associated, we make sure that none
         * of the pipelines use it in the pending/flush queues
         */
        for (size_t ii = 0; ii < cq->npipelines; ii++) {
            sllist_iterator iter;
            auto *server = static_cast<lcb::Server *>(cq->pipelines[ii]);
            if (server == nullptr) {
                continue;
            }

            /* check pending queue */
            {
                nb_SENDQ *sq = &server->nbmgr.sendq;

                /* in the case of completion IO, there is a chunk of the sendq which
                 * has already been written to the network and cannot be cancelled,
                 * we need to only scan to remove packets which have NOT been sent
                 * yet.
                 */
                sllist_node *ll;
                if (sq->last_requested) {
                    ll = sq->last_requested->slnode.next;
                } else {
                    ll = SLLIST_FIRST(&sq->pending);
                }
                if (ll) {
                    for (slist_iter_init_at(ll, &iter); !sllist_iter_end(&sq->pending, &iter);
                         slist_iter_incr(&sq->pending, &iter)) {
                        nb_SNDQELEM *el = SLLIST_ITEM(iter.cur, nb_SNDQELEM, slnode);
                        if (el->parent == op->pkt) {
                            sllist_iter_remove(&sq->pending, &iter);
                        }
                    }
                }
            }

            /* check flush queue */
            SLLIST_ITERFOR(&server->nbmgr.sendq.pdus, &iter)
            {
                mc_PACKET *el = SLLIST_ITEM(iter.cur, mc_PACKET, sl_flushq);
                if (el == op->pkt) {
                    sllist_iter_remove(&server->nbmgr.sendq.pdus, &iter);
                }
            }
        }
        /* by setting this flag we allow the caller to release the packet */
        op->pkt->flags |= MCREQ_F_FLUSHED;
    }

    op->origstatus = status;
    op->pkt = &pkt->base;
    pkt->base.retries++;
    assign_error(op, err);
    hrtime_t now = gethrtime();
    if (options & RETRY_SCHED_IMM) {
        op->trytime = now;
    } else if (err == LCB_ERR_NOT_MY_VBUCKET) {
        op->trytime = now + LCB_US2NS(settings->retry_nmv_interval);
    } else {
        update_trytime(op);
    }

    lcb_list_add_sorted(&schedops, static_cast<SchedNode *>(op), cmpfn_retry);
    lcb_list_add_sorted(&tmoops, static_cast<TmoNode *>(op), cmpfn_tmo);

    uint32_t cid = mcreq_get_cid(get_instance(), &pkt->base);
    lcb_log(LOGARGS(this, DEBUG),
            "Adding PKT=%p to retry queue. retries=%u, cid=%u, opaque=%u, now=%" PRIu64 "ms, spent=%" PRIu64
            "us, deadline_in=%" PRIu64 "us, status=0x%02x, rc=%s",
            (void *)pkt, pkt->base.retries, cid, pkt->base.opaque, LCB_NS2MS(now), LCB_NS2US(now - op->start),
            LCB_NS2US(op->deadline - now), status, lcb_strerror_short(err));
    schedule();

    if (settings->metrics) {
        settings->metrics->packets_retried++;
    }
}

bool RetryQueue::empty(bool ignore_cfgreq) const
{
    bool is_empty = LCB_LIST_IS_EMPTY(&schedops);
    if (is_empty) {
        return true;
    }
    if (ignore_cfgreq) {
        lcb_list_t *ll, *llnext;
        LCB_LIST_SAFE_FOR(ll, llnext, &schedops)
        {
            protocol_binary_request_header hdr = {};
            RetryOp *op = from_schednode(ll);
            mcreq_read_hdr(op->pkt, &hdr);
            if (hdr.request.opcode != PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG &&
                hdr.request.opcode != PROTOCOL_BINARY_CMD_SELECT_BUCKET) {
                return false;
            }
        }
        return true;
    }
    return false;
}

void RetryQueue::nmvadd(mc_EXPACKET *detchpkt)
{
    int flags = 0;
    if (settings->nmv_retry_imm) {
        flags = RETRY_SCHED_IMM;
    }
    add(detchpkt, LCB_ERR_NOT_MY_VBUCKET, PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET, nullptr, flags);
}

void RetryQueue::ucadd(mc_EXPACKET *pkt, lcb_STATUS orig_err, protocol_binary_response_status status)
{
    add(pkt, orig_err, status, nullptr, 0);
}

static void fallback_handler(mc_CMDQUEUE *cq, mc_PACKET *pkt)
{
    auto *instance = reinterpret_cast<lcb_INSTANCE *>(cq->cqdata);
    instance->retryq->add_fallback(pkt);
}

void RetryQueue::add_fallback(mc_PACKET *pkt)
{
    mc_PACKET *copy = mcreq_renew_packet(pkt);
    add((mc_EXPACKET *)copy, LCB_ERR_NO_MATCHING_SERVER, PROTOCOL_BINARY_RESPONSE_UNSPECIFIED, nullptr,
        RETRY_SCHED_IMM);
}

void RetryQueue::reset_timeouts(lcb_U64 now)
{
    lcb_list_t *ll;
    LCB_LIST_FOR(ll, &schedops)
    {
        RetryOp *op = from_schednode(ll);
        op->deadline = now + (op->deadline - op->start);
        op->start = now;
    }
}

RetryQueue::RetryQueue(mc_CMDQUEUE *cq_, lcbio_pTABLE table, lcb_settings *settings_)
{
    settings = settings_;
    cq = cq_;
    timer = lcbio_timer_new(table, this, rq_tick);

    lcb_settings_ref(settings);
    lcb_list_init(&tmoops);
    lcb_list_init(&schedops);
    mcreq_set_fallback_handler(cq, fallback_handler);
}

RetryQueue::~RetryQueue()
{
    lcb_list_t *llcur, *llnext;
    hrtime_t now = gethrtime();

    LCB_LIST_SAFE_FOR(llcur, llnext, &schedops)
    {
        RetryOp *op = from_schednode(llcur);
        fail(op, LCB_ERR_GENERIC, now);
    }

    lcbio_timer_destroy(timer);
    lcb_settings_unref(settings);
}

lcb_STATUS RetryQueue::error_for(const mc_PACKET *packet)
{
    if (!(packet->flags & MCREQ_F_DETACHED)) {
        return LCB_SUCCESS; /* Not detached */
    }

    mc_EPKTDATUM *d = mcreq_epkt_find((mc_EXPACKET *)packet, RETRY_PKT_KEY);
    if (!d) {
        return LCB_SUCCESS;
    }
    return static_cast<RetryOp *>(d)->origerr;
}

void RetryQueue::dump(FILE *fp, mcreq_payload_dump_fn dumpfn)
{
    lcb_list_t *cur;
    LCB_LIST_FOR(cur, &schedops)
    {
        RetryOp *op = from_schednode(cur);
        mcreq_dump_packet(op->pkt, fp, dumpfn);
    }
}
