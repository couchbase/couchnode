/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2020 Couchbase, Inc.
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

struct BcastCookie : mc_REQDATAEX {
    int remaining;

    BcastCookie(const mc_REQDATAPROCS *procs_, const void *cookie_)
        : mc_REQDATAEX(cookie_, *procs_, gethrtime()), remaining(0)
    {
    }
};

static void refcnt_dtor_common(mc_PACKET *pkt)
{
    auto *ck = static_cast<BcastCookie *>(pkt->u_rdata.exdata);
    if (!--ck->remaining) {
        delete ck;
    }
}

static const char *make_hp_string(const lcb::Server &server, std::string &out)
{
    lcb_assert(server.has_valid_host());
    out.assign(server.get_host().host);
    out.append(":");
    out.append(server.get_host().port);
    return out.c_str();
}

static void stats_handler(mc_PIPELINE *pl, mc_PACKET *req, lcb_STATUS err, const void *arg)
{
    auto *ck = static_cast<BcastCookie *>(req->u_rdata.exdata);
    auto *server = static_cast<lcb::Server *>(pl);
    auto *resp = reinterpret_cast<lcb_RESPSTATS *>(const_cast<void *>(arg));

    lcb_RESPCALLBACK callback;
    lcb_INSTANCE *instance = server->get_instance();

    callback = lcb_find_callback(instance, LCB_CALLBACK_STATS);

    if (!arg) {
        lcb_RESPSTATS s_resp{};
        if (--ck->remaining) {
            /* still have other servers which must reply. */
            return;
        }

        s_resp.ctx.rc = err;
        s_resp.cookie = const_cast<void *>(ck->cookie);
        s_resp.rflags = LCB_RESP_F_CLIENTGEN | LCB_RESP_F_FINAL;
        callback(instance, LCB_CALLBACK_STATS, (lcb_RESPBASE *)&s_resp);
        delete ck;

    } else {
        std::string epbuf;
        resp->server = make_hp_string(*server, epbuf);
        resp->cookie = const_cast<void *>(ck->cookie);
        callback(instance, LCB_CALLBACK_STATS, (lcb_RESPBASE *)resp);
        return;
    }
}

static mc_REQDATAPROCS stats_procs = {stats_handler, refcnt_dtor_common};

LIBCOUCHBASE_API
lcb_STATUS lcb_stats3(lcb_INSTANCE *instance, const void *cookie, const lcb_CMDSTATS *cmd)
{
    unsigned ii;
    int vbid = -1;
    char ksbuf[512] = {0};
    mc_CMDQUEUE *cq = &instance->cmdq;
    lcbvb_CONFIG *vbc = cq->config;
    const lcb_CONTIGBUF *kbuf_in = &cmd->key.contig;
    lcb_KEYBUF kbuf_out;

    kbuf_out.type = LCB_KV_COPY;

    if (cmd->cmdflags & LCB_CMDSTATS_F_KV) {
        if (kbuf_in->nbytes == 0 || kbuf_in->nbytes > sizeof(ksbuf) - 30) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        if (vbc == nullptr) {
            return LCB_ERR_NO_CONFIGURATION;
        }
        if (lcbvb_get_distmode(vbc) != LCBVB_DIST_VBUCKET) {
            return LCB_ERR_UNSUPPORTED_OPERATION;
        }
        vbid = lcbvb_k2vb(vbc, kbuf_in->bytes, kbuf_in->nbytes);
        if (vbid < 0) {
            return LCB_ERR_NO_CONFIGURATION;
        }
        for (ii = 0; ii < kbuf_in->nbytes; ii++) {
            if (isspace(((char *)kbuf_in->bytes)[ii])) {
                return LCB_ERR_INVALID_ARGUMENT;
            }
        }
        sprintf(ksbuf, "key %.*s %d", (int)kbuf_in->nbytes, (const char *)kbuf_in->bytes, vbid);
        kbuf_out.contig.nbytes = strlen(ksbuf);
        kbuf_out.contig.bytes = ksbuf;
    } else {
        kbuf_out.contig = *kbuf_in;
    }

    auto *ckwrap = new BcastCookie(&stats_procs, cookie);
    ckwrap->deadline =
        ckwrap->start + LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));

    for (ii = 0; ii < cq->npipelines; ii++) {
        mc_PACKET *pkt;
        mc_PIPELINE *pl = cq->pipelines[ii];
        protocol_binary_request_header hdr = {{0}};

        if (vbid > -1 && lcbvb_has_vbucket(vbc, vbid, ii) == 0) {
            continue;
        }

        pkt = mcreq_allocate_packet(pl);
        if (!pkt) {
            delete ckwrap;
            return LCB_ERR_NO_MEMORY;
        }

        hdr.request.opcode = PROTOCOL_BINARY_CMD_STAT;
        hdr.request.magic = PROTOCOL_BINARY_REQ;

        pkt->flags |= MCREQ_F_NOCID;
        if (cmd->key.contig.nbytes) {
            mcreq_reserve_key(pl, pkt, MCREQ_PKT_BASESIZE, &kbuf_out, 0);
            hdr.request.keylen = ntohs((lcb_U16)kbuf_out.contig.nbytes);
            hdr.request.bodylen = ntohl((lcb_U32)kbuf_out.contig.nbytes);
        } else {
            mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);
        }

        pkt->u_rdata.exdata = ckwrap;
        pkt->flags |= MCREQ_F_REQEXT;

        ckwrap->remaining++;
        hdr.request.opaque = pkt->opaque;
        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
        mcreq_sched_add(pl, pkt);
    }

    if (!ii || ckwrap->remaining == 0) {
        delete ckwrap;
        return LCB_ERR_NO_MATCHING_SERVER;
    }

    MAYBE_SCHEDLEAVE(instance)
    return LCB_SUCCESS;
}

static void handle_bcast(mc_PIPELINE *pipeline, mc_PACKET *req, lcb_STATUS err, const void *arg)
{
    auto *server = static_cast<lcb::Server *>(pipeline);
    auto *ck = (BcastCookie *)req->u_rdata.exdata;

    lcb_RESPNOOP noop{};
    if (arg != nullptr) {
        noop = *static_cast<const lcb_RESPNOOP *>(arg);
        noop.rflags = LCB_RESP_F_CLIENTGEN;
    }

    noop.ctx.rc = err;
    noop.cookie = const_cast<void *>(ck->cookie);

    std::string epbuf;
    noop.server = make_hp_string(*server, epbuf);

    lcb_RESPCALLBACK callback = lcb_find_callback(server->get_instance(), LCB_CALLBACK_NOOP);
    callback(server->get_instance(), LCB_CALLBACK_NOOP, (lcb_RESPBASE *)&noop);
    if (--ck->remaining) {
        return;
    }

    lcb_RESPNOOP empty{};
    empty.server = nullptr;
    empty.ctx.rc = err;
    empty.rflags = LCB_RESP_F_CLIENTGEN | LCB_RESP_F_FINAL;
    empty.cookie = const_cast<void *>(ck->cookie);
    callback(server->get_instance(), LCB_CALLBACK_NOOP, (lcb_RESPBASE *)&empty);
    delete ck;
}

static mc_REQDATAPROCS bcast_procs = {handle_bcast, refcnt_dtor_common};

LIBCOUCHBASE_API
lcb_STATUS lcb_noop3(lcb_INSTANCE *instance, const void *cookie, const lcb_CMDNOOP *cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;

    if (!cq->config) {
        return LCB_ERR_NO_CONFIGURATION;
    }

    auto *ckwrap = new BcastCookie(&bcast_procs, cookie);
    ckwrap->deadline =
        ckwrap->start + LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));

    for (ii = 0; ii < cq->npipelines; ii++) {
        mc_PIPELINE *pl = cq->pipelines[ii];
        mc_PACKET *pkt = mcreq_allocate_packet(pl);
        protocol_binary_request_header hdr;
        memset(&hdr, 0, sizeof(hdr));

        if (!pkt) {
            delete ckwrap;
            return LCB_ERR_NO_MEMORY;
        }

        pkt->u_rdata.exdata = ckwrap;
        pkt->flags |= MCREQ_F_REQEXT;

        hdr.request.magic = PROTOCOL_BINARY_REQ;
        hdr.request.opaque = pkt->opaque;
        hdr.request.opcode = PROTOCOL_BINARY_CMD_NOOP;

        mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);
        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
        mcreq_sched_add(pl, pkt);
        ckwrap->remaining++;
    }

    if (ii == 0) {
        delete ckwrap;
        return LCB_ERR_NO_MATCHING_SERVER;
    }
    MAYBE_SCHEDLEAVE(instance)
    return LCB_SUCCESS;
}
