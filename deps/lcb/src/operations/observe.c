/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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
#include "durability_internal.h"
#include "trace.h"

struct observe_st {
    int allocated;
    ringbuffer_t body;
};

typedef struct {
    mc_REQDATAEX base;
    lcb_MULTICMD_CTX mctx;
    lcb_t instance;
    lcb_SIZE nrequests;
    lcb_SIZE remaining;
    unsigned otype;
    struct observe_st requests[1];
} OBSERVECTX;

typedef enum {
    F_DURABILITY = 0x01,
    F_BCAST = 0x02,
    F_DESTROY = 0x04
} obs_flags;

static void
handle_observe_callback(
        mc_PIPELINE *pl, mc_PACKET *pkt, lcb_error_t err, const void *arg)
{
    OBSERVECTX *oc = (void *)pkt->u_rdata.exdata;
    lcb_RESPOBSERVE *resp = (void *)arg;
    mc_SERVER *server = (mc_SERVER *)pl;
    lcb_t instance = server->instance;;

    if (resp == NULL) {
        int nfailed = 0;
        /** We need to fail the request manually.. */
        const char *ptr = SPAN_BUFFER(&pkt->u_value.single);
        const char *end = ptr + pkt->u_value.single.size;
        while (ptr < end) {
            lcb_uint16_t nkey;
            lcb_RESPOBSERVE cur = { 0 };
            cur.rflags = LCB_RESP_F_CLIENTGEN;

            ptr += 2;
            memcpy(&nkey, ptr, sizeof(nkey));
            nkey = ntohs(nkey);
            ptr += 2;

            memset(&cur, 0, sizeof(cur));
            cur.key = ptr;
            cur.nkey = nkey;
            cur.cookie = (void *)oc->base.cookie;
            cur.rc = err;
            handle_observe_callback(pl, pkt, err, &cur);
            ptr += nkey;
            nfailed++;
        }
        lcb_assert(nfailed);
        return;
    }

    resp->cookie = (void *)oc->base.cookie;
    resp->rc = err;
    if (oc->otype & F_DURABILITY) {
        lcb_durability_dset_update(
                instance,
                (lcb_DURSET *)MCREQ_PKT_COOKIE(pkt), err, resp);
    } else {
        lcb_RESPCALLBACK callback = lcb_find_callback(instance, LCB_CALLBACK_OBSERVE);
        callback(instance, LCB_CALLBACK_OBSERVE, (lcb_RESPBASE *)resp);
    }

    if (oc->otype & F_DESTROY) {
        return;
    }

    if (--oc->remaining) {
        return;
    } else {
        lcb_RESPOBSERVE resp2 = { 0 };
        resp2.rc = err;
        resp2.rflags = LCB_RESP_F_CLIENTGEN|LCB_RESP_F_FINAL;
        oc->otype |= F_DESTROY;
        handle_observe_callback(pl, pkt, err, &resp2);
        free(oc);
    }
}

static int init_request(struct observe_st *reqinfo)
{
    if (!ringbuffer_initialize(&reqinfo->body, 512)) {
        return 0;
    }
    reqinfo->allocated = 1;
    return 1;
}

static void destroy_requests(OBSERVECTX *reqs)
{
    lcb_size_t ii;
    for (ii = 0; ii < reqs->nrequests; ii++) {
        struct observe_st *rr = reqs->requests + ii;

        if (!rr->allocated) {
            continue;
        }

        ringbuffer_destruct(&rr->body);
        rr->allocated = 0;
    }
}

#define CTX_FROM_MULTI(mcmd) (void *) ((((char *) (mcmd))) - offsetof(OBSERVECTX, mctx))

static lcb_error_t
obs_ctxadd(lcb_MULTICMD_CTX *mctx, const lcb_CMDOBSERVE *cmd)
{
    const void *hk;
    lcb_SIZE nhk;
    int vbid;
    unsigned maxix;
    int ii;
    OBSERVECTX *ctx = CTX_FROM_MULTI(mctx);
    lcb_t instance = ctx->instance;
    mc_CMDQUEUE *cq = &instance->cmdq;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    if (cq->config == NULL) {
        return LCB_CLIENT_ETMPFAIL;
    }

    if (instance->dist_type != LCBVB_DIST_VBUCKET) {
        return LCB_NOT_SUPPORTED;
    }

    mcreq_extract_hashkey(&cmd->key, &cmd->hashkey, 24, &hk, &nhk);
    vbid = lcbvb_k2vb(cq->config, hk, nhk);
    maxix = LCBVB_NREPLICAS(cq->config);

    for (ii = -1; ii < (int)maxix; ++ii) {
        struct observe_st *rr;
        lcb_U16 vb16, klen16;
        int ix;

        ix = lcbvb_vbreplica(cq->config, vbid, ii);
        if (ix < 0 || ix > (int)cq->npipelines) {
            if (ii == -1) {
                return LCB_NO_MATCHING_SERVER;
            } else {
                continue;
            }
        }
        lcb_assert(ix < (int)ctx->nrequests);
        rr = ctx->requests + ix;
        if (!rr->allocated) {
            if (!init_request(rr)) {
                return LCB_CLIENT_ENOMEM;
            }
        }

        vb16 = htons((lcb_U16)vbid);
        klen16 = htons((lcb_U16)cmd->key.contig.nbytes);
        ringbuffer_ensure_capacity(&rr->body, sizeof(vb16) + sizeof(klen16));
        ringbuffer_write(&rr->body, &vb16, sizeof vb16);
        ringbuffer_write(&rr->body, &klen16, sizeof klen16);
        ringbuffer_write(&rr->body, cmd->key.contig.bytes, cmd->key.contig.nbytes);
        ctx->remaining++;
        if (cmd->cmdflags & LCB_CMDOBSERVE_F_MASTER_ONLY) {
            break;
        }
    }
    return LCB_SUCCESS;
}


static lcb_error_t
obs_ctxdone(lcb_MULTICMD_CTX *mctx, const void *cookie)
{
    unsigned ii;
    OBSERVECTX *ctx = CTX_FROM_MULTI(mctx);
    mc_CMDQUEUE *cq = &ctx->instance->cmdq;

    for (ii = 0; ii < ctx->nrequests; ii++) {
        protocol_binary_request_header hdr;
        mc_PACKET *pkt;
        mc_PIPELINE *pipeline;
        struct observe_st *rr = ctx->requests + ii;
        pipeline = cq->pipelines[ii];

        if (!rr->allocated) {
            continue;
        }

        pkt = mcreq_allocate_packet(pipeline);
        lcb_assert(pkt);

        mcreq_reserve_header(pipeline, pkt, MCREQ_PKT_BASESIZE);
        mcreq_reserve_value2(pipeline, pkt, rr->body.nbytes);

        hdr.request.magic = PROTOCOL_BINARY_REQ;
        hdr.request.opcode = PROTOCOL_BINARY_CMD_OBSERVE;
        hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        hdr.request.keylen = 0;
        hdr.request.cas = 0;
        hdr.request.vbucket = 0;
        hdr.request.extlen = 0;
        hdr.request.opaque = pkt->opaque;
        hdr.request.bodylen = htonl((lcb_uint32_t)rr->body.nbytes);

        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
        ringbuffer_read(&rr->body, SPAN_BUFFER(&pkt->u_value.single), rr->body.nbytes);

        pkt->flags |= MCREQ_F_REQEXT;
        pkt->u_rdata.exdata = (mc_REQDATAEX *)ctx;
        mcreq_sched_add(pipeline, pkt);
        TRACE_OBSERVE_BEGIN(&hdr, SPAN_BUFFER(&pkt->u_value.single));
    }
    destroy_requests(ctx);
    ctx->base.start = gethrtime();
    ctx->base.cookie = cookie;
    ctx->base.callback = handle_observe_callback;
    return LCB_SUCCESS;
}

static void
obs_ctxfail(lcb_MULTICMD_CTX *mctx)
{
    OBSERVECTX *ctx = CTX_FROM_MULTI(mctx);
    destroy_requests(ctx);
    free(ctx);
}

LIBCOUCHBASE_API
lcb_MULTICMD_CTX *
lcb_observe3_ctxnew(lcb_t instance)
{
    OBSERVECTX *ctx;
    lcb_SIZE n_extra = LCBT_NSERVERS(instance)-1;
    ctx = calloc(1, sizeof(*ctx) + sizeof(ctx->requests) * n_extra);
    ctx->instance = instance;
    ctx->nrequests = n_extra + 1;
    ctx->mctx.addcmd = obs_ctxadd;
    ctx->mctx.done = obs_ctxdone;
    ctx->mctx.fail = obs_ctxfail;
    ctx->otype = F_BCAST;
    return &ctx->mctx;
}

lcb_MULTICMD_CTX *
lcb_observe_ctx_dur_new(lcb_t instance)
{
    lcb_MULTICMD_CTX *mctx = lcb_observe3_ctxnew(instance);
    if (mctx) {
        OBSERVECTX *ctx = CTX_FROM_MULTI(mctx);
        ctx->otype |= F_DURABILITY;
    }
    return mctx;
}

LIBCOUCHBASE_API
lcb_error_t lcb_observe(lcb_t instance,
    const void *command_cookie, lcb_size_t num,
    const lcb_observe_cmd_t *const *items)
{
    unsigned ii;
    lcb_error_t err;
    lcb_MULTICMD_CTX *mctx;

    lcb_sched_enter(instance);

    mctx = lcb_observe3_ctxnew(instance);
    if (mctx == NULL) {
        return LCB_CLIENT_ENOMEM;
    }

    for (ii = 0; ii < num; ii++) {
        lcb_CMDOBSERVE cmd = { 0 };
        const lcb_observe_cmd_t *src = items[ii];
        if (src->version == 1 && (src->v.v1.options & LCB_OBSERVE_MASTER_ONLY)) {
            cmd.cmdflags |= LCB_CMDOBSERVE_F_MASTER_ONLY;
        }
        LCB_KREQ_SIMPLE(&cmd.key, src->v.v0.key, src->v.v0.nkey);
        LCB_KREQ_SIMPLE(&cmd.hashkey, src->v.v0.hashkey, src->v.v0.nhashkey);

        err = mctx->addcmd(mctx, (lcb_CMDBASE *)&cmd);
        if (err != LCB_SUCCESS) {
            mctx->fail(mctx);
            return err;
        }
    }
    lcb_sched_enter(instance);
    mctx->done(mctx, command_cookie);
    lcb_sched_leave(instance);
    SYNCMODE_INTERCEPT(instance)
}
