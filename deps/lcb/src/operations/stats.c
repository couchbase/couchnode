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
enum {
    C_VERSION,
    C_STATS,
    C_VERBOSITY,
    C_FLUSH
};

typedef struct {
    mc_REQDATAEX base;
    int remaining;
    int type;
} bcast_cookie;

static void
stats_handler(mc_PIPELINE *pl, mc_PACKET *req, lcb_error_t err, const void *arg)
{
    bcast_cookie *ck = (bcast_cookie *)req->u_rdata.exdata;
    lcb_server_t *server = (lcb_server_t *)pl;
    lcb_server_stat_resp_t *resp = (void *)arg;
    char epbuf[NI_MAXHOST + NI_MAXSERV + 4];

    sprintf(epbuf, "%s:%s", mcserver_get_host(server), mcserver_get_port(server));

    if (!arg) {
        lcb_server_stat_resp_t s_resp;

        if (--ck->remaining) {
            /* still have other servers which must reply. */
            return;
        }

        memset(&s_resp, 0, sizeof(s_resp));
        server->instance->callbacks.stat(
                server->instance, ck->base.cookie, err, &s_resp);
        free(ck);

    } else {
        resp->v.v0.server_endpoint = epbuf;
        server->instance->callbacks.stat(
                server->instance, ck->base.cookie, err, resp);
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

typedef void (*bcast_callback)
        (lcb_t, const void *, lcb_error_t, const void *);

static void
handle_bcast(mc_PIPELINE *pipeline, mc_PACKET *req, lcb_error_t err,
             const void *arg)
{
    lcb_server_t *server = (lcb_server_t *)pipeline;
    char epbuf[NI_MAXHOST + NI_MAXSERV + 4];
    bcast_cookie *ck = (bcast_cookie *)req->u_rdata.exdata;
    bcast_callback callback;

    union {
        lcb_verbosity_resp_t *verbosity;
        lcb_server_version_resp_t *version;
        lcb_flush_resp_t *flush;
    } u_resp;

    union {
        lcb_verbosity_resp_t verbosity;
        lcb_server_version_resp_t version;
        lcb_flush_resp_t flush;
    } u_empty;

    memset(&u_empty, 0, sizeof(u_empty));

    if (arg) {
        u_resp.verbosity = (void *)arg;
    } else {
        u_resp.verbosity = &u_empty.verbosity;
    }

    sprintf(epbuf, "%s:%s", mcserver_get_host(server), mcserver_get_port(server));

    if (ck->type == C_VERBOSITY) {
        u_resp.verbosity->version = 0;
        u_resp.verbosity->v.v0.server_endpoint = epbuf;
        callback = (bcast_callback)server->instance->callbacks.verbosity;

    } else if (ck->type == C_FLUSH) {
        u_resp.flush->version = 0;
        u_resp.flush->v.v0.server_endpoint = epbuf;
        callback = (bcast_callback)server->instance->callbacks.flush;

    } else {
        u_resp.version->version = 0;
        u_resp.version->v.v0.server_endpoint = epbuf;
        callback = (bcast_callback)server->instance->callbacks.version;
    }

    callback(server->instance, ck->base.cookie, err, u_resp.verbosity);

    if (--ck->remaining) {
        return;
    }

    memset(&u_empty, 0, sizeof(u_empty));
    callback(server->instance, ck->base.cookie, err, &u_empty.verbosity);
    free(ck);
}

static lcb_error_t
pkt_bcast_simple(lcb_t instance, const void *cookie, int type)
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
        if (type == C_FLUSH) {
            hdr.request.opcode = PROTOCOL_BINARY_CMD_FLUSH;
        } else if (type == C_VERSION) {
            hdr.request.opcode = PROTOCOL_BINARY_CMD_VERSION;
        } else {
            abort();
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
    return pkt_bcast_simple(instance, cookie, C_VERSION);
}


LIBCOUCHBASE_API
lcb_error_t
lcb_flush3(lcb_t instance, const void *cookie, const lcb_CMDFLUSH *cmd)
{
    (void)cmd;
    return pkt_bcast_simple(instance, cookie, C_FLUSH);
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
    ckwrap->type = C_VERBOSITY;

    for (ii = 0; ii < cq->npipelines; ii++) {
        mc_PACKET *pkt;
        mc_PIPELINE *pl = cq->pipelines[ii];
        lcb_server_t *server = (lcb_server_t *)pl;
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
