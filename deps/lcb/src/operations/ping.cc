/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017-2020 Couchbase, Inc.
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
#include "http/http.h"
#include "auth-priv.h"

#include "capi/cmd_diag.hh"
#include "capi/cmd_ping.hh"
#include "capi/cmd_http.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respping_status(const lcb_RESPPING *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_cookie(const lcb_RESPPING *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_value(const lcb_RESPPING *resp, const char **json, size_t *json_len)
{
    *json = resp->json;
    *json_len = resp->njson;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_report_id(const lcb_RESPPING *resp, const char **report_id,
                                                   size_t *report_id_len)
{
    *report_id = resp->id.data();
    *report_id_len = resp->id.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API size_t lcb_respping_result_size(const lcb_RESPPING *resp)
{
    return resp->nservices;
}

LIBCOUCHBASE_API lcb_PING_STATUS lcb_respping_result_status(const lcb_RESPPING *resp, size_t index)
{
    if (index >= resp->nservices) {
        return LCB_PING_STATUS_INVALID;
    }
    return resp->services[index].status;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_id(const lcb_RESPPING *resp, size_t index, const char **endpoint_id,
                                                   size_t *endpoint_id_len)
{
    if (index >= resp->nservices) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    *endpoint_id = resp->services[index].id;
    *endpoint_id_len = strlen(*endpoint_id);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_service(const lcb_RESPPING *resp, size_t index, lcb_PING_SERVICE *type)
{
    if (index >= resp->nservices) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    *type = resp->services[index].type;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_remote(const lcb_RESPPING *resp, size_t index, const char **address,
                                                       size_t *address_len)
{
    if (index >= resp->nservices) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    *address = resp->services[index].server;
    *address_len = *address ? strlen(*address) : 0;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_local(const lcb_RESPPING *resp, size_t index, const char **address,
                                                      size_t *address_len)
{
    if (index >= resp->nservices) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    *address = resp->services[index].local;
    *address_len = strlen(*address);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_latency(const lcb_RESPPING *resp, size_t index, uint64_t *latency)
{
    if (index >= resp->nservices) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    *latency = resp->services[index].latency;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_namespace(const lcb_RESPPING *resp, size_t index, const char **name,
                                                          size_t *name_len)
{
    if (index >= resp->nservices) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    *name = resp->services[index].scope;
    *name_len = (*name == nullptr) ? 0 : strlen(*name);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_scope(const lcb_RESPPING *resp, size_t index, const char **name,
                                                      size_t *name_len)
{
    return lcb_respping_result_namespace(resp, index, name, name_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_create(lcb_CMDPING **cmd)
{
    *cmd = (lcb_CMDPING *)calloc(1, sizeof(lcb_CMDPING));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_destroy(lcb_CMDPING *cmd)
{
    free(cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_parent_span(lcb_CMDPING *cmd, lcbtrace_SPAN *span)
{
    cmd->pspan = span;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_report_id(lcb_CMDPING *cmd, const char *report_id, size_t report_id_len)
{
    cmd->id = report_id;
    cmd->nid = report_id_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_timeout(lcb_CMDPING *cmd, uint32_t timeout)
{
    cmd->timeout = timeout;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_all(lcb_CMDPING *cmd)
{
    cmd->services =
        LCB_PINGSVC_F_KV | LCB_PINGSVC_F_N1QL | LCB_PINGSVC_F_VIEWS | LCB_PINGSVC_F_FTS | LCB_PINGSVC_F_ANALYTICS;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_kv(lcb_CMDPING *cmd, int enable)
{
    if (enable) {
        cmd->services |= LCB_PINGSVC_F_KV;
    } else {
        cmd->services &= ~LCB_PINGSVC_F_KV;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_query(lcb_CMDPING *cmd, int enable)
{
    if (enable) {
        cmd->services |= LCB_PINGSVC_F_N1QL;
    } else {
        cmd->services &= ~LCB_PINGSVC_F_N1QL;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_views(lcb_CMDPING *cmd, int enable)
{
    if (enable) {
        cmd->services |= LCB_PINGSVC_F_VIEWS;
    } else {
        cmd->services &= ~LCB_PINGSVC_F_VIEWS;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_search(lcb_CMDPING *cmd, int enable)
{
    if (enable) {
        cmd->services |= LCB_PINGSVC_F_FTS;
    } else {
        cmd->services &= ~LCB_PINGSVC_F_FTS;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_analytics(lcb_CMDPING *cmd, int enable)
{
    if (enable) {
        cmd->services |= LCB_PINGSVC_F_ANALYTICS;
    } else {
        cmd->services &= ~LCB_PINGSVC_F_ANALYTICS;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_no_metrics(lcb_CMDPING *cmd, int enable)
{
    if (enable) {
        cmd->options |= LCB_PINGOPT_F_NOMETRICS;
    } else {
        cmd->options &= ~LCB_PINGOPT_F_NOMETRICS;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_encode_json(lcb_CMDPING *cmd, int enable, int pretty, int with_details)
{
    if (enable) {
        uint32_t flags = LCB_PINGOPT_F_JSON;
        if (pretty) {
            flags |= LCB_PINGOPT_F_JSONPRETTY;
        }
        if (with_details) {
            flags |= LCB_PINGOPT_F_JSONDETAILS;
        }
        cmd->options |= flags;
    } else {
        cmd->options &= ~(LCB_PINGOPT_F_JSON | LCB_PINGOPT_F_JSONPRETTY | LCB_PINGOPT_F_JSONDETAILS);
    }
    return LCB_SUCCESS;
}

static void refcnt_dtor_ping(mc_PACKET *);
static void handle_ping(mc_PIPELINE *, mc_PACKET *, lcb_CALLBACK_TYPE /* cbtype */, lcb_STATUS, const void *);

static mc_REQDATAPROCS ping_procs = {handle_ping, refcnt_dtor_ping};

struct PingCookie : mc_REQDATAEX {
    int remaining;
    int options;
    std::list<lcb_PINGSVC> responses;
    std::string id;

    PingCookie(void *cookie_, int _options)
        : mc_REQDATAEX(cookie_, ping_procs, gethrtime()), remaining(0), options(_options)
    {
    }

    ~PingCookie()
    {
        for (auto &response : responses) {
            if (response.server) {
                free((void *)response.server);
                response.server = nullptr;
                free((void *)response.local);
                response.local = nullptr;
                free((void *)response.id);
                response.id = nullptr;
            }
        }
    }

    bool needMetrics() const
    {
        return (options & LCB_PINGOPT_F_NOMETRICS) == 0;
    }

    bool needJSON() const
    {
        return options & LCB_PINGOPT_F_JSON;
    }

    bool needDetails() const
    {
        return options & LCB_PINGOPT_F_JSONDETAILS;
    }

    bool needPretty() const
    {
        return options & LCB_PINGOPT_F_JSONPRETTY;
    }
};

static void refcnt_dtor_ping(mc_PACKET *pkt)
{
    auto *ck = static_cast<PingCookie *>(pkt->u_rdata.exdata);
    if (!--ck->remaining) {
        delete ck;
    }
}

static const char *svc_to_string(const lcb_PING_SERVICE type)
{
    switch (type) {
        case LCB_PING_SERVICE_KV:
            return "kv";
        case LCB_PING_SERVICE_VIEWS:
            return "views";
        case LCB_PING_SERVICE_QUERY:
            return "n1ql";
        case LCB_PING_SERVICE_SEARCH:
            return "fts";
        case LCB_PING_SERVICE_ANALYTICS:
            return "cbas";
        default:
            return "unknown";
    }
}

static void build_ping_json(lcb_INSTANCE *instance, lcb_RESPPING &ping, Json::Value &root, PingCookie *ck)
{
    Json::Value services;
    for (size_t ii = 0; ii < ping.nservices; ii++) {
        lcb_PINGSVC &svc = ping.services[ii];
        Json::Value service;
        if (svc.server) {
            service["remote"] = svc.server;
        }
        if (svc.local) {
            service["local"] = svc.local;
        }
        if (svc.id) {
            service["id"] = svc.id;
        }
        if (svc.scope) {
            service["namespace"] = svc.scope;
        }

        service["latency_us"] = (Json::Value::UInt64)LCB_NS2US(svc.latency);
        switch (svc.status) {
            case LCB_PING_STATUS_OK:
                service["status"] = "ok";
                break;
            case LCB_PING_STATUS_TIMEOUT:
                service["status"] = "timeout";
                break;
            default:
                service["status"] = "error";
                if (ck->needDetails()) {
                    service["details"] = lcb_strerror_long(svc.rc);
                }
        }
        services[svc_to_string(svc.type)].append(service);
    }
    root["services"] = services;
    root["version"] = 1;

    std::string sdk("libcouchbase/" LCB_VERSION_STRING);
    if (LCBT_SETTING(instance, client_string)) {
        sdk.append(" ").append(LCBT_SETTING(instance, client_string));
    }
    root["sdk"] = sdk.c_str();
    root["id"] = ck->id;

    int64_t config_rev = -1;
    if (instance->cur_configinfo) {
        lcb::clconfig::ConfigInfo *cfg = instance->cur_configinfo;
        config_rev = cfg->vbc->revid;
    }
    root["config_rev"] = (Json::Int64)config_rev;
}

static void invoke_ping_callback(lcb_INSTANCE *instance, PingCookie *ck)
{
    lcb_RESPPING ping{};
    std::string json;
    size_t idx = 0;
    if (ck->needMetrics()) {
        ping.id = ck->id;
        ping.nservices = ck->responses.size();
        ping.services = new lcb_PINGSVC[ping.nservices];
        for (std::list<lcb_PINGSVC>::const_iterator it = ck->responses.begin(); it != ck->responses.end(); ++it) {
            ping.services[idx++] = *it;
        }
        if (ck->needJSON()) {
            Json::Value root;
            build_ping_json(instance, ping, root, ck);
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
    ping.cookie = ck->cookie;
    callback(instance, LCB_CALLBACK_PING, (lcb_RESPBASE *)&ping);
    delete[] ping.services;
    delete ck;
}

static void handle_ping(mc_PIPELINE *pipeline, mc_PACKET *req, lcb_CALLBACK_TYPE /* cbtype */, lcb_STATUS err,
                        const void *)
{
    auto *server = static_cast<lcb::Server *>(pipeline);
    auto *ck = (PingCookie *)req->u_rdata.exdata;

    if (ck->needMetrics()) {
        lcb_PINGSVC svc = {};
        if (server->has_valid_host()) {
            const lcb_host_t &remote = server->get_host();
            std::string hh;
            if (remote.ipv6) {
                hh.append("[").append(remote.host).append("]:").append(remote.port);
            } else {
                hh.append(remote.host).append(":").append(remote.port);
            }
            svc.server = lcb_strdup(hh.c_str());
        }
        svc.type = LCB_PING_SERVICE_KV;
        svc.latency = gethrtime() - MCREQ_PKT_RDATA(req)->start;
        svc.rc = err;
        switch (err) {
            case LCB_ERR_TIMEOUT:
                svc.status = LCB_PING_STATUS_TIMEOUT;
                break;
            case LCB_SUCCESS:
                svc.status = LCB_PING_STATUS_OK;
                break;
            default:
                svc.status = LCB_PING_STATUS_ERROR;
                break;
        }
        lcbio_CTX *ctx = server->connctx;
        if (ctx) {
            char id[20] = {0};
            svc.local = lcb_strdup(ctx->sock->info->ep_local_host_and_port);
            snprintf(id, sizeof(id), "%p", (void *)ctx->sock);
            svc.id = lcb_strdup(id);
        }
        svc.scope = server->get_instance()->get_bucketname();

        ck->responses.push_back(svc);
    }

    if (--ck->remaining) {
        return;
    }
    invoke_ping_callback(server->get_instance(), ck);
}

static void handle_http(lcb_INSTANCE *instance, lcb_PING_SERVICE type, const lcb_RESPHTTP *resp)
{
    if ((resp->rflags & LCB_RESP_F_FINAL) == 0) {
        return;
    }
    auto *ck = (PingCookie *)resp->cookie;
    auto *htreq = reinterpret_cast<lcb::http::Request *>(resp->_htreq);

    if (ck->needMetrics()) {
        lcb_PINGSVC svc = {};
        svc.type = type;
        std::string hh;
        if (htreq->ipv6) {
            hh = "[" + std::string(htreq->host) + "]:" + std::string(htreq->port);
        } else {
            hh = std::string(htreq->host) + ":" + std::string(htreq->port);
        }
        svc.server = lcb_strdup(hh.c_str());
        svc.latency = gethrtime() - htreq->start;
        svc.rc = resp->ctx.rc;
        switch (resp->ctx.rc) {
            case LCB_ERR_TIMEOUT:
                svc.status = LCB_PING_STATUS_TIMEOUT;
                break;
            case LCB_SUCCESS:
                svc.status = LCB_PING_STATUS_OK;
                break;
            default:
                svc.status = LCB_PING_STATUS_ERROR;
                break;
        }
        lcbio_CTX *ctx = htreq->ioctx;
        if (ctx) {
            char id[20] = {0};
            snprintf(id, sizeof(id), "%p", (void *)ctx->sock);
            svc.id = lcb_strdup(id);
            svc.local = lcb_strdup(ctx->sock->info->ep_local_host_and_port);
        }
        ck->responses.push_back(svc);
    }
    if (--ck->remaining) {
        return;
    }
    invoke_ping_callback(instance, ck);
}

static void handle_n1ql(lcb_INSTANCE *instance, int, const lcb_RESPBASE *resp)
{
    handle_http(instance, LCB_PING_SERVICE_QUERY, (const lcb_RESPHTTP *)resp);
}

static void handle_views(lcb_INSTANCE *instance, int, const lcb_RESPBASE *resp)
{
    handle_http(instance, LCB_PING_SERVICE_VIEWS, (const lcb_RESPHTTP *)resp);
}

static void handle_fts(lcb_INSTANCE *instance, int, const lcb_RESPBASE *resp)
{
    handle_http(instance, LCB_PING_SERVICE_SEARCH, (const lcb_RESPHTTP *)resp);
}

static void handle_analytics(lcb_INSTANCE *instance, int, const lcb_RESPBASE *resp)
{
    handle_http(instance, LCB_PING_SERVICE_ANALYTICS, (const lcb_RESPHTTP *)resp);
}

static lcbauth_SERVICE ping_type_to_service(lcbvb_SVCTYPE type)
{
    switch (type) {
        case LCBVB_SVCTYPE_DATA:
            return LCBAUTH_SERVICE_KEY_VALUE;

        case LCBVB_SVCTYPE_VIEWS:
            return LCBAUTH_SERVICE_VIEWS;

        case LCBVB_SVCTYPE_MGMT:
            return LCBAUTH_SERVICE_MANAGEMENT;

        case LCBVB_SVCTYPE_IXQUERY:
        case LCBVB_SVCTYPE_IXADMIN:
        case LCBVB_SVCTYPE_QUERY:
            return LCBAUTH_SERVICE_QUERY;

        case LCBVB_SVCTYPE_SEARCH:
            return LCBAUTH_SERVICE_SEARCH;

        case LCBVB_SVCTYPE_ANALYTICS:
            return LCBAUTH_SERVICE_ANALYTICS;

        case LCBVB_SVCTYPE_EVENTING:
            return LCBAUTH_SERVICE_EVENTING;

        default:
            return LCBAUTH_SERVICE_UNSPECIFIED;
    }
}

LIBCOUCHBASE_API
lcb_STATUS lcb_ping(lcb_INSTANCE *instance, void *cookie, const lcb_CMDPING *cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;

    if (!cq->config) {
        return LCB_ERR_NO_CONFIGURATION;
    }

    auto *ckwrap = new PingCookie(cookie, cmd->options);
    {
        char id[20] = {0};
        snprintf(id, sizeof(id), "%p", (void *)instance);
        ckwrap->id = id;
        if (cmd->id) {
            ckwrap->id.append("/").append(cmd->id);
        } else {
            snprintf(id, sizeof(id), "%016" PRIx64, lcb_next_rand64());
            ckwrap->id.append("/").append(id);
        }
    }

    hrtime_t timeout = LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));
    lcbvb_CONFIG *cfg = LCBT_VBCONFIG(instance);
    const lcbvb_SVCMODE mode = LCBT_SETTING_SVCMODE(instance);
    if (cmd->services & LCB_PINGSVC_F_KV) {
        for (ii = 0; ii < cq->npipelines; ii++) {
            unsigned port = lcbvb_get_port(cfg, ii, LCBVB_SVCTYPE_DATA, mode);
            if (!port) {
                continue;
            }

            mc_PIPELINE *pl = cq->pipelines[ii];
            mc_PACKET *pkt = mcreq_allocate_packet(pl);
            protocol_binary_request_header hdr;
            memset(&hdr, 0, sizeof(hdr));

            if (!pkt) {
                return LCB_ERR_NO_MEMORY;
            }

            ckwrap->deadline = ckwrap->start + timeout;
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

    for (int idx = 0; idx < (int)LCBVB_NSERVERS(cfg); idx++) {
#define PING_HTTP(SVC, PATH, TMO, CB)                                                                                  \
    lcb_STATUS rc;                                                                                                     \
    lcb_HTTP_HANDLE *htreq;                                                                                            \
    lcb_CMDHTTP *htcmd;                                                                                                \
    char buf[1024] = {0};                                                                                              \
    unsigned port;                                                                                                     \
    port = lcbvb_get_port(cfg, idx, SVC, mode);                                                                        \
    if (port) {                                                                                                        \
        lcbvb_SERVER *srv = LCBVB_GET_SERVER(cfg, idx);                                                                \
        bool ipv6 = strchr(srv->hostname, ':');                                                                        \
        snprintf(buf, sizeof(buf), "%s://%s%s%s:%d%s", (mode == LCBVB_SVCMODE_PLAIN) ? "http" : "https",               \
                 ipv6 ? "[" : "", srv->hostname, ipv6 ? "]" : "", port, PATH);                                         \
        lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_PING);                                                                \
        lcb_cmdhttp_host(htcmd, buf, strlen(buf));                                                                     \
        lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_GET);                                                                \
        lcb_cmdhttp_handle(htcmd, &htreq);                                                                             \
        const lcb::Authenticator &auth = *instance->settings->auth;                                                    \
        auto creds = auth.credentials_for(ping_type_to_service(SVC), LCBAUTH_REASON_NEW_OPERATION, nullptr, nullptr,   \
                                          LCBT_SETTING(instance, bucket));                                             \
        lcb_cmdhttp_username(htcmd, creds.username().c_str(), creds.username().size());                                \
        lcb_cmdhttp_password(htcmd, creds.password().c_str(), creds.password().size());                                \
        lcb_cmdhttp_timeout(htcmd, LCB_NS2US(timeout));                                                                \
        rc = lcb_http(instance, ckwrap, htcmd);                                                                        \
        lcb_cmdhttp_destroy(htcmd);                                                                                    \
        if (rc == LCB_SUCCESS) {                                                                                       \
            htreq->set_callback(CB);                                                                                   \
            ckwrap->remaining++;                                                                                       \
        }                                                                                                              \
    }

        if (cmd->services & LCB_PINGSVC_F_N1QL) {
            PING_HTTP(LCBVB_SVCTYPE_QUERY, "/admin/ping", n1ql_timeout, handle_n1ql);
        }
        if (cmd->services & LCB_PINGSVC_F_VIEWS) {
            PING_HTTP(LCBVB_SVCTYPE_VIEWS, "/", views_timeout, handle_views);
        }
        if (cmd->services & LCB_PINGSVC_F_FTS) {
            PING_HTTP(LCBVB_SVCTYPE_SEARCH, "/api/ping", search_timeout, handle_fts);
        }
        if (cmd->services & LCB_PINGSVC_F_ANALYTICS) {
            PING_HTTP(LCBVB_SVCTYPE_ANALYTICS, "/admin/ping", analytics_timeout, handle_analytics);
        }
#undef PING_HTTP
    }

    if (ckwrap->remaining == 0) {
        delete ckwrap;
        return LCB_ERR_NO_MATCHING_SERVER;
    }
    MAYBE_SCHEDLEAVE(instance);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respdiag_status(const lcb_RESPDIAG *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respdiag_cookie(const lcb_RESPDIAG *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respdiag_value(const lcb_RESPDIAG *resp, const char **json, size_t *json_len)
{
    *json = resp->json;
    *json_len = resp->njson;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_create(lcb_CMDDIAG **cmd)
{
    *cmd = (lcb_CMDDIAG *)calloc(1, sizeof(lcb_CMDDIAG));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_destroy(lcb_CMDDIAG *cmd)
{
    free(cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_report_id(lcb_CMDDIAG *cmd, const char *report_id, size_t report_id_len)
{
    cmd->id = report_id;
    cmd->nid = report_id_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_prettify(lcb_CMDDIAG *cmd, int enable)
{
    if (enable) {
        cmd->options |= LCB_PINGOPT_F_JSONPRETTY;
    } else {
        cmd->options &= ~LCB_PINGOPT_F_JSONPRETTY;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_diag(lcb_INSTANCE *instance, void *cookie, const lcb_CMDDIAG *cmd)
{
    Json::Value root;
    hrtime_t now = LCB_NS2US(gethrtime());

    root["version"] = 1;

    std::string sdk("libcouchbase/" LCB_VERSION_STRING);
    if (LCBT_SETTING(instance, client_string)) {
        sdk.append(" ").append(LCBT_SETTING(instance, client_string));
    }
    root["sdk"] = sdk.c_str();
    {
        char id[20] = {0};
        snprintf(id, sizeof(id), "%p", (void *)instance);
        std::string idstr(id);
        if (cmd->id) {
            idstr.append("/").append(cmd->id);
        }
        root["id"] = idstr;
    }

    size_t ii;
    Json::Value kv;
    for (ii = 0; ii < instance->cmdq.npipelines; ii++) {
        auto *server = static_cast<lcb::Server *>(instance->cmdq.pipelines[ii]);
        lcbio_CTX *ctx = server->connctx;
        if (ctx) {
            Json::Value endpoint;
            char id[20] = {0};
            snprintf(id, sizeof(id), "%016" PRIx64, ctx->sock ? ctx->sock->id : (lcb_U64)0);
            endpoint["id"] = id;
            if (server->curhost->ipv6) {
                endpoint["remote"] =
                    "[" + std::string(server->curhost->host) + "]:" + std::string(server->curhost->port);
            } else {
                endpoint["remote"] = std::string(server->curhost->host) + ":" + std::string(server->curhost->port);
            }
            if (!server->bucket.empty()) {
                endpoint["namespace"] = server->bucket;
            }
            if (ctx->sock) {
                if (ctx->sock->info) {
                    endpoint["local"] = ctx->sock->info->ep_local_host_and_port;
                }
                endpoint["last_activity_us"] =
                    (Json::Value::UInt64)(now > ctx->sock->atime ? now - ctx->sock->atime : 0);
                endpoint["status"] = "connected";
                root[lcbio_svcstr(ctx->sock->service)].append(endpoint);
            }
        }
    }
    instance->memd_sockpool->toJSON(now, root);
    instance->http_sockpool->toJSON(now, root);
    {
        Json::Value cur;
        lcb_ASPEND_SETTYPE::iterator it;
        lcb_ASPEND_SETTYPE *pendq;
        if ((pendq = instance->pendops.items[LCB_PENDTYPE_HTTP])) {
            for (it = pendq->begin(); it != pendq->end(); ++it) {
                lcb::http::Request *htreq = reinterpret_cast<lcb::http::Request *>(*it);
                lcbio_CTX *ctx = htreq->ioctx;
                if (ctx) {
                    Json::Value endpoint;
                    char id[20] = {0};
                    snprintf(id, sizeof(id), "%016" PRIx64, ctx->sock ? ctx->sock->id : (lcb_U64)0);
                    endpoint["id"] = id;
                    if (htreq->ipv6) {
                        endpoint["remote"] = "[" + std::string(htreq->host) + "]:" + std::string(htreq->port);
                    } else {
                        endpoint["remote"] = std::string(htreq->host) + ":" + std::string(htreq->port);
                    }
                    if (ctx->sock) {
                        if (ctx->sock->info) {
                            endpoint["local"] = ctx->sock->info->ep_local_host_and_port;
                        }
                        endpoint["last_activity_us"] =
                            (Json::Value::UInt64)(now > ctx->sock->atime ? now - ctx->sock->atime : 0);
                        endpoint["status"] = "connected";
                        root[lcbio_svcstr(ctx->sock->service)].append(endpoint);
                    }
                }
            }
        }
    }

    Json::Writer *w;
    if (cmd->options & LCB_PINGOPT_F_JSONPRETTY) {
        w = new Json::StyledWriter();
    } else {
        w = new Json::FastWriter();
    }
    std::string json = w->write(root);
    delete w;

    lcb_RESPDIAG resp{};
    lcb_RESPCALLBACK callback;

    resp.njson = json.size();
    resp.json = json.c_str();

    callback = lcb_find_callback(instance, LCB_CALLBACK_DIAG);
    resp.cookie = const_cast<void *>(cookie);
    callback(instance, LCB_CALLBACK_DIAG, (lcb_RESPBASE *)&resp);

    return LCB_SUCCESS;
}
