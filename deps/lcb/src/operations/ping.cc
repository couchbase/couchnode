/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017 Couchbase, Inc.
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
#include <libcouchbase/n1ql.h>
#include "http/http.h"
#include "auth-priv.h"

static void refcnt_dtor_ping(mc_PACKET *);
static void handle_ping(mc_PIPELINE *, mc_PACKET *, lcb_error_t, const void *);

static mc_REQDATAPROCS ping_procs = {
    handle_ping,
    refcnt_dtor_ping
};

struct PingCookie : mc_REQDATAEX {
    int remaining;
    int options;
    std::list<lcb_PINGSVC> responses;

    PingCookie(const void *cookie_, int _options)
        : mc_REQDATAEX(cookie_, ping_procs, gethrtime()),
        remaining(0), options(_options) {
    }

    ~PingCookie() {
        for (std::list<lcb_PINGSVC>::iterator it = responses.begin(); it != responses.end(); it++) {
            if (it->server) {
                free(it->server);
                it->server = NULL;
            }
        }
    }

    bool needMetrics() {
        return (options & LCB_PINGOPT_F_NOMETRICS) == 0;
    }

    bool needJSON() {
        return options & LCB_PINGOPT_F_JSON;
    }

    bool needDetails() {
        return options & LCB_PINGOPT_F_JSONDETAILS;
    }

    bool needPretty() {
        return options & LCB_PINGOPT_F_JSONPRETTY;
    }
};

static void
refcnt_dtor_ping(mc_PACKET *pkt)
{
    PingCookie *ck = static_cast<PingCookie *>(pkt->u_rdata.exdata);
    if (!--ck->remaining) {
        delete ck;
    }
}

static std::string latency_to_string(lcb_U64 latency)
{
    std::stringstream ss;
    ss.precision(3);
    ss.setf(std::ios::fixed);
    if (latency < 1000) {
        ss << latency << "ns";
    } else if (latency < LCB_US2NS(1000)) {
        ss << (latency / (double)LCB_US2NS(1)) << "us";
    } else if (latency < LCB_MS2NS(1000)) {
        ss << (latency / (double)LCB_MS2NS(1)) << "ms";
    } else {
        ss << (latency / (double)LCB_S2NS(1)) << "s";
    }
    return ss.str();
}

static const char* svc_to_string(lcb_PINGSVCTYPE type)
{
    switch (type) {
    case LCB_PINGSVC_KV:
        return "kv";
    case LCB_PINGSVC_VIEWS:
        return "views";
    case LCB_PINGSVC_N1QL:
        return "n1ql";
    case LCB_PINGSVC_FTS:
        return "fts";
    default:
        return "unknown";
    }
}

static void
build_ping_json(lcb_RESPPING &ping, Json::Value &root, bool details)
{
    Json::Value services;
    for (size_t ii = 0; ii < ping.nservices; ii++) {
        lcb_PINGSVC &svc = ping.services[ii];
        Json::Value service;
        service["server"] = svc.server;
        service["latency"] = latency_to_string(svc.latency);
        service["status"] = svc.status;
        if (details) {
            service["details"] = lcb_strerror(NULL, svc.status);
        }
        services[svc_to_string(svc.type)].append(service);
    }
    root["services"] = services;
}

static void
invoke_ping_callback(lcb_t instance, PingCookie *ck)
{
    lcb_RESPPING ping;
    std::string json;
    size_t idx = 0;
    memset(&ping, 0, sizeof(ping));
    if (ck->needMetrics()) {
        ping.nservices = ck->responses.size();
        ping.services = new lcb_PINGSVC[ping.nservices];
        for(std::list<lcb_PINGSVC>::const_iterator it = ck->responses.begin(); it != ck->responses.end(); ++it){
            ping.services[idx++] = *it;
        }
        if (ck->needJSON()) {
            Json::Value root;
            build_ping_json(ping, root, ck->needDetails());
            Json::Writer *w;
            if (ck->needPretty()) {
                w = new Json::StyledWriter();
            } else {
                w = new Json::FastWriter();
            }
            json = w->write(root);
            delete w;
            ping.njson = json.size();
            ping.json = json.c_str();
        }
    }
    lcb_RESPCALLBACK callback;
    callback = lcb_find_callback(instance, LCB_CALLBACK_PING);
    ping.cookie = const_cast<void*>(ck->cookie);
    callback(instance, LCB_CALLBACK_PING, (lcb_RESPBASE *)&ping);
    if (ping.services != NULL) {
        delete []ping.services;
    }
    delete ck;
}

static void
handle_ping(mc_PIPELINE *pipeline, mc_PACKET *req, lcb_error_t err,
             const void *arg)
{
    lcb::Server *server = static_cast<lcb::Server*>(pipeline);
    PingCookie *ck = (PingCookie *)req->u_rdata.exdata;

    if (ck->needMetrics()) {
        std::string hh(server->get_host().host);
        hh.append(":");
        hh.append(server->get_host().port);

        lcb_PINGSVC svc;
        svc.type = LCB_PINGSVC_KV;
        svc.server = strdup(hh.c_str());
        svc.latency = gethrtime() - MCREQ_PKT_RDATA(req)->start;
        svc.status = err;
        ck->responses.push_back(svc);
    }

    if (--ck->remaining) {
        return;
    }
    invoke_ping_callback(server->get_instance(), ck);
}

static void handle_http(lcb_t instance, lcb_PINGSVCTYPE type, const lcb_RESPHTTP *resp)
{
    if ((resp->rflags & LCB_RESP_F_FINAL) == 0) {
        return;
    }
    PingCookie *ck = (PingCookie *)resp->cookie;
    lcb::http::Request *htreq = reinterpret_cast<lcb::http::Request*>(resp->_htreq);

    if (ck->needMetrics()) {
        lcb_PINGSVC svc;
        svc.type = type;
        svc.server = strdup((htreq->host + ":" + htreq->port).c_str());
        svc.latency = gethrtime() - htreq->start;
        svc.status = resp->rc;
        ck->responses.push_back(svc);
    }
    if (--ck->remaining) {
        return;
    }
    invoke_ping_callback(instance, ck);
}

static void handle_n1ql(lcb_t instance, int, const lcb_RESPBASE *resp)
{
    handle_http(instance, LCB_PINGSVC_N1QL, (const lcb_RESPHTTP *)resp);
}

static void handle_views(lcb_t instance, int, const lcb_RESPBASE *resp)
{
    handle_http(instance, LCB_PINGSVC_VIEWS, (const lcb_RESPHTTP *)resp);
}

static void handle_fts(lcb_t instance, int, const lcb_RESPBASE *resp)
{
    handle_http(instance, LCB_PINGSVC_FTS, (const lcb_RESPHTTP *)resp);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_ping3(lcb_t instance, const void *cookie, const lcb_CMDPING *cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;

    if (!cq->config) {
        return LCB_CLIENT_ETMPFAIL;
    }

    PingCookie *ckwrap = new PingCookie(cookie, cmd->options);

    if (cmd->services & LCB_PINGSVC_F_KV) {
        for (ii = 0; ii < cq->npipelines; ii++) {
            mc_PIPELINE *pl = cq->pipelines[ii];
            mc_PACKET *pkt = mcreq_allocate_packet(pl);
            protocol_binary_request_header hdr;
            memset(&hdr, 0, sizeof(hdr));

            if (!pkt) {
                return LCB_CLIENT_ENOMEM;
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
    }

    lcbvb_CONFIG *cfg = LCBT_VBCONFIG(instance);
    const lcbvb_SVCMODE mode = LCBT_SETTING(instance, sslopts) ?
            LCBVB_SVCMODE_SSL : LCBVB_SVCMODE_PLAIN;
    for (int idx = 0; idx < (int)LCBVB_NSERVERS(cfg); idx++) {
#define PING_HTTP(SVC, QUERY, TMO, CB)                                  \
        do {                                                            \
            lcb_error_t rc;                                             \
            struct lcb_http_request_st *htreq;                          \
            lcb_CMDHTTP htcmd = {0};                                    \
            htcmd.host = lcbvb_get_resturl(cfg, idx, SVC, mode);        \
            if (htcmd.host == NULL) {                                   \
                continue;                                               \
            }                                                           \
            htcmd.body = QUERY;                                         \
            htcmd.nbody = strlen(htcmd.body);                           \
            htcmd.content_type = "application/json";                    \
            htcmd.method = LCB_HTTP_METHOD_POST;                        \
            htcmd.type = LCB_HTTP_TYPE_RAW;                             \
            htcmd.reqhandle = &htreq;                                   \
            const lcb::Authenticator& auth = *instance->settings->auth; \
            htcmd.username = auth.username_for(LCBT_SETTING(instance, bucket)).c_str(); \
            htcmd.password = auth.password_for(LCBT_SETTING(instance, bucket)).c_str(); \
            htcmd.cmdflags = LCB_CMDHTTP_F_CASTMO;                      \
            htcmd.cas = LCBT_SETTING(instance, TMO);                    \
            rc = lcb_http3(instance, ckwrap, &htcmd);                   \
            if (rc == LCB_SUCCESS) {                                    \
                htreq->set_callback(CB);                                \
            }                                                           \
            ckwrap->remaining++;                                        \
        } while (0);

        if (cmd->services & LCB_PINGSVC_F_N1QL) {
            PING_HTTP(LCBVB_SVCTYPE_N1QL, "{\"statement\":\"select 1\"}",
                      n1ql_timeout, handle_n1ql);
        }
        if (cmd->services & LCB_PINGSVC_F_VIEWS) {
            PING_HTTP(LCBVB_SVCTYPE_VIEWS, "", views_timeout, handle_views);
        }
        if (cmd->services & LCB_PINGSVC_F_FTS) {
            PING_HTTP(LCBVB_SVCTYPE_FTS, "", n1ql_timeout, handle_fts);
        }
#undef PING_HTTP
    }

    if (ckwrap->remaining == 0) {
        delete ckwrap;
        return LCB_NO_MATCHING_SERVER;
    }
    MAYBE_SCHEDLEAVE(instance);
    return LCB_SUCCESS;
}
