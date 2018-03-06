/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2014 Couchbase, Inc.
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

#include "internal.h"
#include "trace.h"

LIBCOUCHBASE_API
lcb_error_t
lcb_get3(lcb_t instance, const void *cookie, const lcb_CMDGET *cmd)
{
    mc_PIPELINE *pl;
    mc_PACKET *pkt;
    mc_REQDATA *rdata;
    mc_CMDQUEUE *q = &instance->cmdq;
    lcb_error_t err;
    lcb_uint8_t extlen = 0;
    lcb_uint8_t opcode = PROTOCOL_BINARY_CMD_GET;
    protocol_binary_request_gat gcmd;
    protocol_binary_request_header *hdr = &gcmd.message.header;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }
    if (cmd->cas) {
        return LCB_OPTIONS_CONFLICT;
    }

    if (cmd->lock) {
        extlen = 4;
        opcode = PROTOCOL_BINARY_CMD_GET_LOCKED;
    } else if (cmd->exptime || (cmd->cmdflags & LCB_CMDGET_F_CLEAREXP)) {
        extlen = 4;
        opcode = PROTOCOL_BINARY_CMD_GAT;
    }

    err = mcreq_basic_packet(q, (const lcb_CMDBASE *)cmd, hdr, extlen, &pkt, &pl,
        MCREQ_BASICPACKET_F_FALLBACKOK);
    if (err != LCB_SUCCESS) {
        return err;
    }

    rdata = &pkt->u_rdata.reqdata;
    rdata->cookie = cookie;
    rdata->start = gethrtime();

    hdr->request.magic = PROTOCOL_BINARY_REQ;
    hdr->request.opcode = opcode;
    hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr->request.bodylen = htonl(extlen + ntohs(hdr->request.keylen));
    hdr->request.opaque = pkt->opaque;
    hdr->request.cas = 0;

    if (extlen) {
        gcmd.message.body.expiration = htonl(cmd->exptime);
    }

    if (cmd->cmdflags & LCB_CMD_F_INTERNAL_CALLBACK) {
        pkt->flags |= MCREQ_F_PRIVCALLBACK;
    }

    memcpy(SPAN_BUFFER(&pkt->kh_span), gcmd.bytes, MCREQ_PKT_BASESIZE + extlen);
    LCB_SCHED_ADD(instance, pl, pkt);
    LCBTRACE_KV_START(instance->settings, cmd, pkt->opaque, rdata->span);
    TRACE_GET_BEGIN(instance, hdr, cmd);

    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t lcb_get(lcb_t instance,
                    const void *command_cookie,
                    lcb_size_t num,
                    const lcb_get_cmd_t *const *items)
{
    unsigned ii;
    lcb_sched_enter(instance);

    for (ii = 0; ii < num; ii++) {
        const lcb_get_cmd_t *src = items[ii];
        lcb_CMDGET dst;
        lcb_error_t err;

        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v0.key;
        dst.key.contig.nbytes = src->v.v0.nkey;
        dst._hashkey.contig.bytes = src->v.v0.hashkey;
        dst._hashkey.contig.nbytes = src->v.v0.nhashkey;
        dst.lock = src->v.v0.lock;
        dst.exptime = src->v.v0.exptime;

        err = lcb_get3(instance, command_cookie, &dst);
        if (err != LCB_SUCCESS) {
            lcb_sched_fail(instance);
            return err;
        }
    }
    lcb_sched_leave(instance);
    SYNCMODE_INTERCEPT(instance)
}

LIBCOUCHBASE_API
lcb_error_t
lcb_unlock3(lcb_t instance, const void *cookie, const lcb_CMDUNLOCK *cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    mc_PIPELINE *pl;
    mc_PACKET *pkt;
    mc_REQDATA *rd;
    lcb_error_t err;
    protocol_binary_request_header hdr;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    err = mcreq_basic_packet(cq, cmd, &hdr, 0, &pkt, &pl,
        MCREQ_BASICPACKET_F_FALLBACKOK);
    if (err != LCB_SUCCESS) {
        return err;
    }

    rd = &pkt->u_rdata.reqdata;
    rd->cookie = cookie;
    rd->start = gethrtime();

    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.opcode = PROTOCOL_BINARY_CMD_UNLOCK_KEY;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.bodylen = htonl((lcb_uint32_t)ntohs(hdr.request.keylen));
    hdr.request.opaque = pkt->opaque;
    hdr.request.cas = lcb_htonll(cmd->cas);

    memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
    LCB_SCHED_ADD(instance, pl, pkt);
    LCBTRACE_KV_START(instance->settings, cmd, pkt->opaque, rd->span);
    TRACE_UNLOCK_BEGIN(instance, &hdr, cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_unlock(lcb_t instance, const void *cookie, lcb_size_t num,
           const lcb_unlock_cmd_t * const * items)
{
    unsigned ii;
    lcb_error_t err = LCB_SUCCESS;

    lcb_sched_enter(instance);
    for (ii = 0; ii < num; ii++) {
        const lcb_unlock_cmd_t *src = items[ii];
        lcb_CMDUNLOCK dst;
        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v0.key;
        dst.key.contig.nbytes = src->v.v0.nkey;
        dst._hashkey.contig.bytes = src->v.v0.hashkey;
        dst._hashkey.contig.nbytes = src->v.v0.nhashkey;
        dst.cas = src->v.v0.cas;
        err = lcb_unlock3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            break;
        }
    }
    if (err != LCB_SUCCESS) {
        lcb_sched_fail(instance);
        return err;
    } else {
        lcb_sched_leave(instance);
        SYNCMODE_INTERCEPT(instance)
    }
}

struct RGetCookie : mc_REQDATAEX {
    RGetCookie(const void *cookie, lcb_t instance, lcb_replica_t, int vb);
    void decref() {
        if (!--remaining) {
            delete this;
        }
    }

    unsigned r_cur;
    unsigned r_max;
    int remaining;
    int vbucket;
    lcb_replica_t strategy;
    lcb_t instance;
};

static void rget_dtor(mc_PACKET *pkt) {
    static_cast<RGetCookie*>(pkt->u_rdata.exdata)->decref();
}

static void
rget_callback(mc_PIPELINE *, mc_PACKET *pkt, lcb_error_t err, const void *arg)
{
    RGetCookie *rck = static_cast<RGetCookie*>(pkt->u_rdata.exdata);
    lcb_RESPGET *resp = reinterpret_cast<lcb_RESPGET*>(const_cast<void*>(arg));
    lcb_RESPCALLBACK callback;
    lcb_t instance = rck->instance;

    callback = lcb_find_callback(instance, LCB_CALLBACK_GETREPLICA);

    /** Figure out what the strategy is.. */
    if (rck->strategy == LCB_REPLICA_SELECT || rck->strategy == LCB_REPLICA_ALL) {
        /** Simplest */
        if (rck->strategy == LCB_REPLICA_SELECT || rck->remaining == 1) {
            resp->rflags |= LCB_RESP_F_FINAL;
        }
        callback(instance, LCB_CALLBACK_GETREPLICA, (const lcb_RESPBASE *)resp);
    } else {
        mc_CMDQUEUE *cq = &instance->cmdq;
        mc_PIPELINE *nextpl = NULL;

        /** FIRST */
        do {
            int nextix;
            rck->r_cur++;
            nextix = lcbvb_vbreplica(cq->config, rck->vbucket, rck->r_cur);
            if (nextix > -1 && nextix < (int)cq->npipelines) {
                /* have a valid next index? */
                nextpl = cq->pipelines[nextix];
                break;
            }
        } while (rck->r_cur < rck->r_max);

        if (err == LCB_SUCCESS || rck->r_cur == rck->r_max || nextpl == NULL) {
            resp->rflags |= LCB_RESP_F_FINAL;
            callback(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPBASE *)resp);
            /* refcount=1 . Free this now */
            rck->remaining = 1;
        } else if (err != LCB_SUCCESS) {
            mc_PACKET *newpkt = mcreq_renew_packet(pkt);
            newpkt->flags &= ~MCREQ_STATE_FLAGS;
            mcreq_sched_add(nextpl, newpkt);
            /* Use this, rather than lcb_sched_leave(), because this is being
             * invoked internally by the library. */
            mcreq_sched_leave(cq, 1);
            /* wait */
            rck->remaining = 2;
        }
    }
    rck->decref();
}

static mc_REQDATAPROCS rget_procs = {
        rget_callback,
        rget_dtor
};

RGetCookie::RGetCookie(const void *cookie_, lcb_t instance_,
    lcb_replica_t strategy_, int vbucket_)
    : mc_REQDATAEX(cookie_, rget_procs, gethrtime()),
      r_cur(0), r_max(LCBT_NREPLICAS(instance_)), remaining(0),
      vbucket(vbucket_), strategy(strategy_), instance(instance_) {
}

LIBCOUCHBASE_API
lcb_error_t
lcb_rget3(lcb_t instance, const void *cookie, const lcb_CMDGETREPLICA *cmd)
{
    /**
     * Because we need to direct these commands to specific servers, we can't
     * just use the 'basic_packet()' function.
     */
    mc_CMDQUEUE *cq = &instance->cmdq;
    int vbid, ixtmp;
    protocol_binary_request_header req;
    unsigned r0, r1 = 0;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }
    if (!cq->config) {
        return LCB_CLIENT_ETMPFAIL;
    }
    if (!LCBT_NREPLICAS(instance)) {
        return LCB_NO_MATCHING_SERVER;
    }

    mcreq_map_key(cq, &cmd->key, &cmd->_hashkey, MCREQ_PKT_BASESIZE,
        &vbid, &ixtmp);

    /* The following blocks will also validate that the entire index range is
     * valid. This is in order to ensure that we don't allocate the cookie
     * if there aren't enough replicas online to satisfy the requirements */

    if (cmd->strategy == LCB_REPLICA_SELECT) {
        r0 = r1 = cmd->index;
        if ((ixtmp = lcbvb_vbreplica(cq->config, vbid, r0)) < 0) {
            return LCB_NO_MATCHING_SERVER;
        }

    } else if (cmd->strategy == LCB_REPLICA_ALL) {
        unsigned ii;
        r0 = 0;
        r1 = LCBT_NREPLICAS(instance);
        /* Make sure they're all online */
        for (ii = 0; ii < LCBT_NREPLICAS(instance); ii++) {
            if ((ixtmp = lcbvb_vbreplica(cq->config, vbid, ii)) < 0) {
                return LCB_NO_MATCHING_SERVER;
            }
        }
    } else {
        for (r0 = 0; r0 < LCBT_NREPLICAS(instance); r0++) {
            if ((ixtmp = lcbvb_vbreplica(cq->config, vbid, r0)) > -1) {
                r1 = r0;
                break;
            }
        }
        if (r0 == LCBT_NREPLICAS(instance)) {
            return LCB_NO_MATCHING_SERVER;
        }
    }

    if (r1 < r0 || r1 >= cq->npipelines) {
        return LCB_NO_MATCHING_SERVER;
    }

    /* Initialize the cookie */
    RGetCookie *rck = new RGetCookie(cookie, instance, cmd->strategy, vbid);

    /* Initialize the packet */
    req.request.magic = PROTOCOL_BINARY_REQ;
    req.request.opcode = PROTOCOL_BINARY_CMD_GET_REPLICA;
    req.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    req.request.vbucket = htons((lcb_uint16_t)vbid);
    req.request.cas = 0;
    req.request.extlen = 0;
    req.request.keylen = htons((lcb_uint16_t)cmd->key.contig.nbytes);
    req.request.bodylen = htonl((lcb_uint32_t)cmd->key.contig.nbytes);

    rck->r_cur = r0;
    do {
        int curix;
        mc_PIPELINE *pl;
        mc_PACKET *pkt;

        curix = lcbvb_vbreplica(cq->config, vbid, r0);
        /* XXX: this is always expected to be in range. For the FIRST mode
         * it will seek to the first valid index (checked above), and for the
         * ALL mode, it will fail if not all replicas are already online
         * (also checked above) */
        pl = cq->pipelines[curix];
        pkt = mcreq_allocate_packet(pl);
        if (!pkt) {
            return LCB_CLIENT_ENOMEM;
        }

        pkt->u_rdata.exdata = rck;
        pkt->flags |= MCREQ_F_REQEXT;

        mcreq_reserve_key(pl, pkt, sizeof(req.bytes), &cmd->key);

        req.request.opaque = pkt->opaque;
        rck->remaining++;
        mcreq_write_hdr(pkt, &req);
        mcreq_sched_add(pl, pkt);
    } while (++r0 < r1);

    MAYBE_SCHEDLEAVE(instance);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_get_replica(lcb_t instance, const void *cookie, lcb_size_t num,
                const lcb_get_replica_cmd_t * const * items)
{
    unsigned ii;
    lcb_error_t err = LCB_SUCCESS;

    lcb_sched_enter(instance);
    for (ii = 0; ii < num; ii++) {
        const lcb_get_replica_cmd_t *src = items[ii];
        lcb_CMDGETREPLICA dst;
        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v1.key;
        dst.key.contig.nbytes = src->v.v1.nkey;
        dst._hashkey.contig.bytes = src->v.v1.hashkey;
        dst._hashkey.contig.nbytes = src->v.v1.nhashkey;
        dst.strategy = src->v.v1.strategy;
        dst.index = src->v.v1.index;
        err = lcb_rget3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            break;
        }
    }

    if (err == LCB_SUCCESS) {
        lcb_sched_leave(instance);
        SYNCMODE_INTERCEPT(instance)
    } else {
        lcb_sched_fail(instance);
        return err;
    }
}
