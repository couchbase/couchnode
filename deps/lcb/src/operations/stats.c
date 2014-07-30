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

typedef struct {
    mc_REQDATAEX base;
    lcb_CALLBACKTYPE type;
    int remaining;
} bcast_cookie;

static void
stats_handler(mc_PIPELINE *pl, mc_PACKET *req, lcb_error_t err, const void *arg)
{
    bcast_cookie *ck = (bcast_cookie *)req->u_rdata.exdata;
    mc_SERVER *server = (mc_SERVER *)pl;
    lcb_RESPSTATS *resp = (void *)arg;
    char epbuf[NI_MAXHOST + NI_MAXSERV + 4];
    lcb_RESPCALLBACK callback;
    lcb_t instance = server->instance;

    sprintf(epbuf, "%s:%s", mcserver_get_host(server), mcserver_get_port(server));
    callback = lcb_find_callback(instance, LCB_CALLBACK_STATS);

    if (!arg) {
        lcb_RESPSTATS s_resp = { 0 };
        if (--ck->remaining) {
            /* still have other servers which must reply. */
            return;
        }

        s_resp.rc = err;
        s_resp.cookie = (void *)ck->base.cookie;
        s_resp.rflags = LCB_RESP_F_CLIENTGEN|LCB_RESP_F_FINAL;
        callback(instance, LCB_CALLBACK_STATS, (lcb_RESPBASE *)&s_resp);
        free(ck);

    } else {
        resp->server = epbuf;
        resp->cookie = (void *)ck->base.cookie;
        callback(instance, LCB_CALLBACK_STATS, (lcb_RESPBASE *)resp);
        return;
    }
}

LIBCOUCHBASE_API
lcb_error_t
lcb_stats3(lcb_t instance, const void *cookie, const lcb_CMDSTATS * cmd)
{
    unsigned ii;
    mc_CMDQUEUE *cq = &instance->cmdq;
    bcast_cookie *ckwrap = calloc(1, sizeof(*ckwrap));

    ckwrap->base.cookie = cookie;
    ckwrap->base.start = gethrtime();
    ckwrap->base.callback = stats_handler;

    for (ii = 0; ii < cq->npipelines; ii++) {
        mc_PACKET *pkt;
        mc_PIPELINE *pl = cq->pipelines[ii];
        protocol_binary_request_header hdr;
        memset(&hdr, 0, sizeof(hdr));

        pkt = mcreq_allocate_packet(pl);
        if (!pkt) {
            return LCB_CLIENT_ENOMEM;
        }

        hdr.request.opcode = PROTOCOL_BINARY_CMD_STAT;
        hdr.request.magic = PROTOCOL_BINARY_REQ;

        if (cmd->key.contig.nbytes) {
            mcreq_reserve_key(pl, pkt, MCREQ_PKT_BASESIZE, &cmd->key);
            hdr.request.keylen = ntohs((lcb_uint16_t)cmd->key.contig.nbytes);
            hdr.request.bodylen = ntohl((lcb_uint32_t)cmd->key.contig.nbytes);
        } else {
            mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);
        }

        pkt->u_rdata.exdata = &ckwrap->base;
        pkt->flags |= MCREQ_F_REQEXT;

        ckwrap->remaining++;
        hdr.request.opaque = pkt->opaque;
        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
        mcreq_sched_add(pl, pkt);
    }

    if (!ii) {
        free(ckwrap);
        return LCB_NO_MATCHING_SERVER;
    }

    return LCB_SUCCESS;
}

static void
handle_bcast(mc_PIPELINE *pipeline, mc_PACKET *req, lcb_error_t err,
             const void *arg)
{
    mc_SERVER *server = (mc_SERVER *)pipeline;
    char epbuf[NI_MAXHOST + NI_MAXSERV + 4];
    bcast_cookie *ck = (bcast_cookie *)req->u_rdata.exdata;
    lcb_RESPCALLBACK callback;

    union {
        lcb_RESPSERVERBASE *base;
        lcb_RESPVERBOSITY *verbosity;
        lcb_RESPMCVERSION *version;
        lcb_RESPFLUSH *flush;
    } u_resp;

    union {
        lcb_RESPSERVERBASE base;
        lcb_RESPVERBOSITY verbosity;
        lcb_RESPMCVERSION version;
        lcb_RESPFLUSH flush;
    } u_empty;

    memset(&u_empty, 0, sizeof(u_empty));

    if (arg) {
        u_resp.base = (void *)arg;
    } else {
        u_resp.base = &u_empty.base;
        u_resp.base->rflags = LCB_RESP_F_CLIENTGEN;
    }

    u_resp.base->rc = err;
    u_resp.base->cookie = (void *)ck->base.cookie;
    u_resp.base->server = epbuf;
    sprintf(epbuf, "%s:%s", mcserver_get_host(server), mcserver_get_port(server));

    callback = lcb_find_callback(server->instance, ck->type);
    callback(server->instance, ck->type, (lcb_RESPBASE *)u_resp.base);
    if (--ck->remaining) {
        return;
    }

    u_empty.base.server = NULL;
    u_empty.base.rc = err;
    u_empty.base.rflags = LCB_RESP_F_CLIENTGEN|LCB_RESP_F_FINAL;
    u_empty.base.cookie = (void *)ck->base.cookie;
    callback(server->instance, ck->type, (lcb_RESPBASE *)&u_empty.base);
    free(ck);
}

static lcb_error_t
pkt_bcast_simple(lcb_t instance, const void *cookie, lcb_CALLBACKTYPE type)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;
    bcast_cookie *ckwrap = calloc(1, sizeof(*ckwrap));
    ckwrap->base.cookie = cookie;
    ckwrap->base.start = gethrtime();
    ckwrap->base.callback = handle_bcast;
    ckwrap->type = type;

    for (ii = 0; ii < cq->npipelines; ii++) {
        mc_PIPELINE *pl = cq->pipelines[ii];
        mc_PACKET *pkt = mcreq_allocate_packet(pl);
        protocol_binary_request_header hdr;
        memset(&hdr, 0, sizeof(hdr));

        if (!pkt) {
            return LCB_CLIENT_ENOMEM;
        }

        pkt->u_rdata.exdata = &ckwrap->base;
        pkt->flags |= MCREQ_F_REQEXT;

        hdr.request.magic = PROTOCOL_BINARY_REQ;
        hdr.request.opaque = pkt->opaque;
        if (type == LCB_CALLBACK_FLUSH) {
            hdr.request.opcode = PROTOCOL_BINARY_CMD_FLUSH;
        } else if (type == LCB_CALLBACK_VERSIONS) {
            hdr.request.opcode = PROTOCOL_BINARY_CMD_VERSION;
        } else {
            fprintf(stderr, "pkt_bcast_simple passed unknown type %u\n", type);
            assert(0);
        }

        mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);
        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
        mcreq_sched_add(pl, pkt);
        ckwrap->remaining++;
    }

    if (ii == 0) {
        free(ckwrap);
        return LCB_NO_MATCHING_SERVER;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_server_versions3(lcb_t instance, const void *cookie, const lcb_CMDBASE * cmd)
{
    (void)cmd;
    return pkt_bcast_simple(instance, cookie, LCB_CALLBACK_VERSIONS);
}


LIBCOUCHBASE_API
lcb_error_t
lcb_flush3(lcb_t instance, const void *cookie, const lcb_CMDFLUSH *cmd)
{
    (void)cmd;
    return pkt_bcast_simple(instance, cookie, LCB_CALLBACK_FLUSH);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_server_verbosity3(lcb_t instance, const void *cookie,
                      const lcb_CMDVERBOSITY *cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;
    bcast_cookie *ckwrap = calloc(1, sizeof(*ckwrap));
    ckwrap->base.cookie = cookie;
    ckwrap->base.start = gethrtime();
    ckwrap->base.callback = handle_bcast;
    ckwrap->type = LCB_CALLBACK_VERBOSITY;

    for (ii = 0; ii < cq->npipelines; ii++) {
        mc_PACKET *pkt;
        mc_PIPELINE *pl = cq->pipelines[ii];
        mc_SERVER *server = (mc_SERVER *)pl;
        char cmpbuf[NI_MAXHOST + NI_MAXSERV + 4];
        protocol_binary_request_verbosity vcmd;
        protocol_binary_request_header *hdr = &vcmd.message.header;
        uint32_t level;

        sprintf(cmpbuf, "%s:%s",
            mcserver_get_host(server), mcserver_get_port(server));
        if (cmd->server && strncmp(cmpbuf, cmd->server, strlen(cmd->server))) {
            continue;
        }

        if (cmd->level == LCB_VERBOSITY_DETAIL) {
            level = 3;
        } else if (cmd->level == LCB_VERBOSITY_DEBUG) {
            level = 2;
        } else if (cmd->level == LCB_VERBOSITY_INFO) {
            level = 1;
        } else {
            level = 0;
        }

        pkt = mcreq_allocate_packet(pl);
        if (!pkt) {
            return LCB_CLIENT_ENOMEM;
        }

        pkt->u_rdata.exdata = &ckwrap->base;
        pkt->flags |= MCREQ_F_REQEXT;

        mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE + 4);
        hdr->request.magic = PROTOCOL_BINARY_REQ;
        hdr->request.opcode = PROTOCOL_BINARY_CMD_VERBOSITY;
        hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        hdr->request.cas = 0;
        hdr->request.vbucket = 0;
        hdr->request.opaque = pkt->opaque;
        hdr->request.extlen = 4;
        hdr->request.keylen = 0;
        hdr->request.bodylen = htonl((uint32_t)hdr->request.extlen);
        vcmd.message.body.level = htonl((uint32_t)level);

        memcpy(SPAN_BUFFER(&pkt->kh_span), vcmd.bytes, sizeof(vcmd.bytes));
        mcreq_sched_add(pl, pkt);
        ckwrap->remaining++;
    }

    if (!ckwrap->remaining) {
        free(ckwrap);
        return LCB_NO_MATCHING_SERVER;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_server_stats(lcb_t instance, const void *cookie, lcb_size_t num,
                 const lcb_server_stats_cmd_t * const * items)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;

    mcreq_sched_enter(cq);
    for (ii = 0; ii < num; ii++) {
        const lcb_server_stats_cmd_t *src = items[ii];
        lcb_CMDSTATS dst;
        lcb_error_t err;

        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v0.name;
        dst.key.contig.nbytes = src->v.v0.nname;
        err = lcb_stats3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            mcreq_sched_fail(cq);
            return err;
        }
    }
    mcreq_sched_leave(cq, 1);
    SYNCMODE_INTERCEPT(instance)
}

LIBCOUCHBASE_API
lcb_error_t
lcb_set_verbosity(lcb_t instance, const void *cookie, lcb_size_t num,
                  const lcb_verbosity_cmd_t * const * items)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;

    mcreq_sched_enter(cq);
    for (ii = 0; ii < num; ii++) {
        lcb_CMDVERBOSITY dst;
        lcb_error_t err;
        const lcb_verbosity_cmd_t *src = items[ii];

        memset(&dst, 0, sizeof(dst));
        dst.level = src->v.v0.level;
        dst.server = src->v.v0.server;
        err = lcb_server_verbosity3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            mcreq_sched_fail(cq);
            return err;
        }
    }
    mcreq_sched_leave(cq, 1);
    SYNCMODE_INTERCEPT(instance)
}

LIBCOUCHBASE_API
lcb_error_t
lcb_flush(lcb_t instance, const void *cookie, lcb_size_t num,
          const lcb_flush_cmd_t * const * items)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;

    mcreq_sched_enter(cq);
    for (ii = 0; ii < num; ii++) {
        lcb_error_t rc = lcb_flush3(instance, cookie, NULL);
        if (rc != LCB_SUCCESS) {
            mcreq_sched_fail(cq);
            return rc;
        }
    }
    mcreq_sched_leave(cq, 1);
    (void)items;
    SYNCMODE_INTERCEPT(instance)
}

LIBCOUCHBASE_API
lcb_error_t
lcb_server_versions(lcb_t instance, const void *cookie, lcb_size_t num,
                    const lcb_server_version_cmd_t * const * items)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;
    (void)items;
    mcreq_sched_enter(cq);

    for (ii = 0; ii < num; ii++) {
        lcb_error_t rc = lcb_server_versions3(instance, cookie, NULL);
        if (rc != LCB_SUCCESS) {
            mcreq_sched_fail(cq);
            return rc;
        }
    }


    mcreq_sched_leave(cq, 1);
    SYNCMODE_INTERCEPT(instance)
}
