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
    lcb_string body;
};

typedef struct {
    mc_REQDATAEX base;
    lcb_MULTICMD_CTX mctx;
    lcb_t instance;
    lcb_SIZE nrequests;
    lcb_SIZE remaining;
    unsigned oflags;
    struct observe_st requests[1];
} OBSERVECTX;

typedef enum {
    F_DURABILITY = 0x01,
    F_DESTROY = 0x02,
    F_SCHEDFAILED = 0x04
} obs_flags;

static void
handle_observe_callback(mc_PIPELINE *pl,
    mc_PACKET *pkt, lcb_error_t err, const void *arg)
{
    OBSERVECTX *oc = (void *)pkt->u_rdata.exdata;
    lcb_RESPOBSERVE *resp = (void *)arg;
    lcb_t instance = oc->instance;

    (void)pl;

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
            handle_observe_callback(NULL, pkt, err, &cur);
            ptr += nkey;
            nfailed++;
        }
        lcb_assert(nfailed);
        return;
    }

    resp->cookie = (void *)oc->base.cookie;
    resp->rc = err;
    if (oc->oflags & F_DURABILITY) {
        resp->ttp = pl ? pl->index : -1;
        lcbdur_cas_update( instance,
            (lcb_DURSET *)MCREQ_PKT_COOKIE(pkt), err, resp);

    } else if ((oc->oflags & F_SCHEDFAILED) == 0) {
        lcb_RESPCALLBACK callback = lcb_find_callback(instance, LCB_CALLBACK_OBSERVE);
        callback(instance, LCB_CALLBACK_OBSERVE, (lcb_RESPBASE *)resp);
    }

    if (oc->oflags & F_DESTROY) {
        return;
    }

    if (--oc->remaining) {
        return;
    } else {
        lcb_RESPOBSERVE resp2 = { 0 };
        resp2.rc = err;
        resp2.rflags = LCB_RESP_F_CLIENTGEN|LCB_RESP_F_FINAL;
        oc->oflags |= F_DESTROY;
        handle_observe_callback(NULL, pkt, err, &resp2);
        free(oc);
    }
}

static void
handle_schedfail(mc_PACKET *pkt)
{
    OBSERVECTX *oc = (void *)pkt->u_rdata.exdata;
    oc->oflags |= F_SCHEDFAILED;
    handle_observe_callback(NULL, pkt, LCB_SCHEDFAIL_INTERNAL, NULL);
}

static int init_request(struct observe_st *reqinfo)
{
    if (lcb_string_init(&reqinfo->body) != 0) {
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
        lcb_string_release(&rr->body);
        rr->allocated = 0;
    }
}

#define CTX_FROM_MULTI(mcmd) (void *) ((((char *) (mcmd))) - offsetof(OBSERVECTX, mctx))

static lcb_error_t
obs_ctxadd(lcb_MULTICMD_CTX *mctx, const lcb_CMDBASE *cmdbase)
{
    int vbid, srvix_dummy;
    unsigned ii;
    const lcb_CMDOBSERVE *cmd = (const lcb_CMDOBSERVE *)cmdbase;
    OBSERVECTX *ctx = CTX_FROM_MULTI(mctx);
    lcb_t instance = ctx->instance;
    mc_CMDQUEUE *cq = &instance->cmdq;
    lcb_U16 servers_s[4];
    const lcb_U16 *servers;
    size_t nservers;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    if (cq->config == NULL) {
        return LCB_CLIENT_ETMPFAIL;
    }

    if (LCBVB_DISTTYPE(LCBT_VBCONFIG(instance)) != LCBVB_DIST_VBUCKET) {
        return LCB_NOT_SUPPORTED;
    }

    mcreq_map_key(cq, &cmd->key, &cmd->_hashkey, 24, &vbid, &srvix_dummy);

    if (cmd->servers_) {
        servers = cmd->servers_;
        nservers = cmd->nservers_;
    } else {
        nservers = 0;
        servers = servers_s;
        /* Replicas are always < 4 */
        for (ii = 0; ii < LCBVB_NREPLICAS(cq->config) + 1; ii++) {
            int ix = lcbvb_vbserver(cq->config, vbid, ii);
            if (ix < 0) {
                if (ii == 0) {
                    return LCB_NO_MATCHING_SERVER;
                } else {
                    continue;
                }
            }
            servers_s[nservers++] = ix;
            if (cmd->cmdflags & LCB_CMDOBSERVE_F_MASTER_ONLY) {
                break; /* Only a single server! */
            }
        }
    }

    if (nservers == 0) {
        return LCB_NO_MATCHING_SERVER;
    }

    for (ii = 0; ii < nservers; ii++) {
        struct observe_st *rr;
        lcb_U16 vb16, klen16;
        lcb_U16 ix = servers[ii];

        lcb_assert(ix < ctx->nrequests);
        rr = ctx->requests + ix;
        if (!rr->allocated) {
            if (!init_request(rr)) {
                return LCB_CLIENT_ENOMEM;
            }
        }

        vb16 = htons((lcb_U16)vbid);
        klen16 = htons((lcb_U16)cmd->key.contig.nbytes);
        lcb_string_append(&rr->body, &vb16, sizeof vb16);
        lcb_string_append(&rr->body, &klen16, sizeof klen16);
        lcb_string_append(&rr->body, cmd->key.contig.bytes, cmd->key.contig.nbytes);

        ctx->remaining++;
    }
    return LCB_SUCCESS;
}

static mc_REQDATAPROCS obs_procs = {
        handle_observe_callback,
        handle_schedfail
};

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
        mcreq_reserve_value2(pipeline, pkt, rr->body.nused);

        hdr.request.magic = PROTOCOL_BINARY_REQ;
        hdr.request.opcode = PROTOCOL_BINARY_CMD_OBSERVE;
        hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        hdr.request.keylen = 0;
        hdr.request.cas = 0;
        hdr.request.vbucket = 0;
        hdr.request.extlen = 0;
        hdr.request.opaque = pkt->opaque;
        hdr.request.bodylen = htonl((lcb_uint32_t)rr->body.nused);

        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
        memcpy(SPAN_BUFFER(&pkt->u_value.single), rr->body.base, rr->body.nused);

        pkt->flags |= MCREQ_F_REQEXT;
        pkt->u_rdata.exdata = (mc_REQDATAEX *)ctx;
        mcreq_sched_add(pipeline, pkt);
        TRACE_OBSERVE_BEGIN(&hdr, SPAN_BUFFER(&pkt->u_value.single));
    }

    destroy_requests(ctx);
    ctx->base.start = gethrtime();
    ctx->base.cookie = cookie;
    ctx->base.procs = &obs_procs;

    if (ctx->nrequests == 0) {
        free(ctx);
        return LCB_EINVAL;
    } else {
        return LCB_SUCCESS;
    }
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
    return &ctx->mctx;
}

lcb_MULTICMD_CTX *
lcb_observe_ctx_dur_new(lcb_t instance)
{
    lcb_MULTICMD_CTX *mctx = lcb_observe3_ctxnew(instance);
    if (mctx) {
        OBSERVECTX *ctx = CTX_FROM_MULTI(mctx);
        ctx->oflags |= F_DURABILITY;
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
        LCB_KREQ_SIMPLE(&cmd._hashkey, src->v.v0.hashkey, src->v.v0.nhashkey);

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
