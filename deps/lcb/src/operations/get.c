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

    if (cmd->lock) {
        extlen = 4;
        opcode = PROTOCOL_BINARY_CMD_GET_LOCKED;
    } else if (cmd->options.exptime) {
        extlen = 4;
        opcode = PROTOCOL_BINARY_CMD_GAT;
    }

    err = mcreq_basic_packet(q, (const lcb_CMDBASE *)cmd, hdr, extlen, &pkt, &pl);
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
        gcmd.message.body.expiration = htonl(cmd->options.exptime);
    }

    memcpy(SPAN_BUFFER(&pkt->kh_span), gcmd.bytes, MCREQ_PKT_BASESIZE + extlen);
    mcreq_sched_add(pl, pkt);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t lcb_get(lcb_t instance,
                    const void *command_cookie,
                    lcb_size_t num,
                    const lcb_get_cmd_t *const *items)
{
    unsigned ii;
    mcreq_sched_enter(&instance->cmdq);

    for (ii = 0; ii < num; ii++) {
        const lcb_get_cmd_t *src = items[ii];
        lcb_CMDGET dst;
        lcb_error_t err;

        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v0.key;
        dst.key.contig.nbytes = src->v.v0.nkey;
        dst.hashkey.contig.bytes = src->v.v0.hashkey;
        dst.hashkey.contig.nbytes = src->v.v0.nhashkey;
        dst.lock = src->v.v0.lock;
        dst.options.exptime = src->v.v0.exptime;

        err = lcb_get3(instance, command_cookie, &dst);
        if (err != LCB_SUCCESS) {
            mcreq_sched_fail(&instance->cmdq);
            return err;
        }
    }
    mcreq_sched_leave(&instance->cmdq, 1);
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
    err = mcreq_basic_packet(cq, cmd, &hdr, 0, &pkt, &pl);
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
    hdr.request.cas = cmd->options.cas;

    memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
    mcreq_sched_add(pl, pkt);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_unlock(lcb_t instance, const void *cookie, lcb_size_t num,
           const lcb_unlock_cmd_t * const * items)
{
    unsigned ii;
    lcb_error_t err = LCB_SUCCESS;

    mcreq_sched_enter(&instance->cmdq);
    for (ii = 0; ii < num; ii++) {
        const lcb_unlock_cmd_t *src = items[ii];
        lcb_CMDUNLOCK dst;
        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v0.key;
        dst.key.contig.nbytes = src->v.v0.nkey;
        dst.hashkey.contig.bytes = src->v.v0.hashkey;
        dst.hashkey.contig.nbytes = src->v.v0.nhashkey;
        dst.options.cas = src->v.v0.cas;
        err = lcb_unlock3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            break;
        }
    }
    if (err != LCB_SUCCESS) {
        mcreq_sched_fail(&instance->cmdq);
        return err;
    } else {
        mcreq_sched_leave(&instance->cmdq, 1);
        SYNCMODE_INTERCEPT(instance)
    }
}

typedef struct {
    mc_REQDATAEX base;
    unsigned r_cur;
    unsigned r_max;
    int remaining;
    int vbucket;
    lcb_replica_t strategy;
    lcb_t instance;
} rget_cookie;

static void
rget_callback(mc_PIPELINE *pl, mc_PACKET *pkt, lcb_error_t err, const void *arg)
{
    rget_cookie *rck = (rget_cookie *)pkt->u_rdata.exdata;
    const lcb_get_resp_t *resp = arg;
    lcb_t instance = rck->instance;

    /** Figure out what the strategy is.. */
    if (rck->strategy == LCB_REPLICA_SELECT || rck->strategy == LCB_REPLICA_ALL) {
        /** Simplest */
        instance->callbacks.get(instance, rck->base.cookie, err, resp);
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
            instance->callbacks.get(instance, rck->base.cookie, err, resp);
            /* refcount=1 . Free this now */
            rck->remaining = 1;
        } else if (err != LCB_SUCCESS) {
            mc_PACKET *newpkt = mcreq_dup_packet(pkt);
            mcreq_sched_add(nextpl, newpkt);
            mcreq_sched_leave(cq, 1);
            /* wait */
            rck->remaining = 2;
        }
    }
    if (!--rck->remaining) {
        free(rck);
    }
    (void)pl;
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
    const void *hk;
    lcb_size_t nhk;
    int vbid;
    protocol_binary_request_header req;
    unsigned r0, r1;
    rget_cookie *rck = NULL;

    mcreq_extract_hashkey(&cmd->key, &cmd->hashkey, MCREQ_PKT_BASESIZE, &hk, &nhk);
    vbid = lcbvb_k2vb(cq->config, hk, nhk);

    /** Get the vbucket by index */
    if (cmd->strategy == LCB_REPLICA_SELECT) {
        r0 = r1 = cmd->index;
    } else if (cmd->strategy == LCB_REPLICA_ALL) {
        r0 = 0;
        r1 = instance->nreplicas;
    } else {
        /* first */
        r0 = r1 = 0;
    }

    if (r1 < r0 || r1 >= cq->npipelines) {
        return LCB_NO_MATCHING_SERVER;
    }

    /* Initialize the cookie */
    rck = calloc(1, sizeof(*rck));
    rck->base.cookie = cookie;
    rck->base.start = gethrtime();
    rck->base.callback = rget_callback;
    rck->strategy = cmd->strategy;
    rck->r_cur = r0;
    rck->r_max = instance->nreplicas;
    rck->instance = instance;
    rck->vbucket = vbid;

    /* Initialize the packet */
    req.request.magic = PROTOCOL_BINARY_REQ;
    req.request.opcode = PROTOCOL_BINARY_CMD_GET_REPLICA;
    req.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    req.request.vbucket = htons((lcb_uint16_t)vbid);
    req.request.cas = 0;
    req.request.extlen = 0;
    req.request.keylen = htons((lcb_uint16_t)cmd->key.contig.nbytes);
    req.request.bodylen = htonl((lcb_uint32_t)cmd->key.contig.nbytes);

    do {
        int curix;
        mc_PIPELINE *pl;
        mc_PACKET *pkt;

        curix = lcbvb_vbreplica(cq->config, vbid, r0);
        if (curix == -1) {
            return LCB_NO_MATCHING_SERVER;
        }

        pl = cq->pipelines[curix];
        pkt = mcreq_allocate_packet(pl);
        if (!pkt) {
            return LCB_CLIENT_ENOMEM;
        }

        pkt->u_rdata.exdata = &rck->base;
        pkt->flags |= MCREQ_F_REQEXT;

        mcreq_reserve_key(pl, pkt, sizeof(req.bytes), &cmd->key);

        req.request.opaque = pkt->opaque;
        rck->remaining++;
        mcreq_write_hdr(pkt, &req);
        mcreq_sched_add(pl, pkt);
    } while (++r0 < r1);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_get_replica(lcb_t instance, const void *cookie, lcb_size_t num,
                const lcb_get_replica_cmd_t * const * items)
{
    unsigned ii;
    lcb_error_t err = LCB_SUCCESS;

    mcreq_sched_enter(&instance->cmdq);
    for (ii = 0; ii < num; ii++) {
        const lcb_get_replica_cmd_t *src = items[ii];
        lcb_CMDGETREPLICA dst;
        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v1.key;
        dst.key.contig.nbytes = src->v.v1.nkey;
        dst.hashkey.contig.bytes = src->v.v1.hashkey;
        dst.hashkey.contig.nbytes = src->v.v1.nhashkey;
        dst.strategy = src->v.v1.strategy;
        dst.index = src->v.v1.index;
        err = lcb_rget3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            break;
        }
    }

    if (err == LCB_SUCCESS) {
        mcreq_sched_leave(&instance->cmdq, 1);
        SYNCMODE_INTERCEPT(instance)
    } else {
        mcreq_sched_fail(&instance->cmdq);
        return err;
    }
}
