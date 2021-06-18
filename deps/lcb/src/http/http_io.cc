/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013-2020 Couchbase, Inc.
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
#include "logging.h"
#include "settings.h"
#include "http-priv.h"
#include "http.h"
#include "ctx-log-inl.h"
#include <lcbio/ssl.h>

#include "capi/cmd_http.hh"

#define LOGFMT CTX_LOGFMT
#define LOGID(req) CTX_LOGID(req->ioctx)
using namespace lcb::http;

#define LOGARGS(req, lvl) req->instance->settings, "http-io", LCB_LOG_##lvl, __FILE__, __LINE__
#define HOST_FMT "<%s%s%s:%s>"
#define HOST_VAL(req) ((req)->ipv6 ? "[" : ""), (req)->host.c_str(), ((req)->ipv6 ? "]" : ""), (req)->port.c_str()

void Request::assign_response_headers(const lcb::htparse::Response &resp)
{
    response_headers.assign(resp.headers.begin(), resp.headers.end());
    response_headers_clist.clear();

    std::vector<lcb::htparse::MimeHeader>::const_iterator ii;
    for (ii = response_headers.begin(); ii != response_headers.end(); ++ii) {
        response_headers_clist.push_back(ii->key.c_str());
        response_headers_clist.push_back(ii->value.c_str());
    }
    response_headers_clist.push_back(nullptr);
}

unsigned Request::handle_parse_chunked(const char *buf, unsigned nbuf)
{
    unsigned parse_state, diff;
    using lcb::htparse::Parser;
    lcb::htparse::Response &res = parser->get_cur_response();

    do {
        const char *rbody;
        unsigned nused = -1, nbody = -1;
        unsigned oldstate = res.state;

        parse_state = parser->parse_ex(buf, nbuf, &nused, &nbody, &rbody);
        diff = oldstate ^ parse_state;

        /* Got headers now for the first time */
        if (diff & Parser::S_HEADER) {
            assign_response_headers(res);
            if (res.status >= 300 && res.status <= 400) {
                const char *redir = res.get_header_value("Location");
                if (redir != nullptr) {
                    pending_redirect.assign(redir);
                    return Parser::S_DONE;
                }
            }
        }

        if (parse_state & Parser::S_ERROR) {
            /* nothing to do here */
            return parse_state;
        }

        if (nbody) {
            if (chunked) {
                lcb_RESPHTTP htresp{};
                init_resp(&htresp);
                htresp.ctx.body = rbody;
                htresp.ctx.body_len = nbody;
                htresp.ctx.rc = LCB_SUCCESS;
                passed_data = true;
                callback(instance, LCB_CALLBACK_HTTP, (const lcb_RESPBASE *)&htresp);

            } else {
                res.body.append(rbody, nbody);
            }
        }

        buf += nused;
        nbuf -= nused;
    } while ((parse_state & Parser::S_DONE) == 0 && is_ongoing() && nbuf);

    if ((parse_state & Parser::S_DONE) && is_ongoing()) {
        lcb_RESPHTTP resp{};
        if (chunked) {
            buf = nullptr;
            nbuf = 0;
        } else {
            buf = res.body.c_str();
            nbuf = res.body.size();
        }

        init_resp(&resp);
        resp.rflags = LCB_RESP_F_FINAL;
        resp.ctx.rc = LCB_SUCCESS;
        resp.ctx.body = buf;
        resp.ctx.body_len = nbuf;
        passed_data = true;
        if (nullptr != span && nullptr != ioctx) {
            lcbtrace_span_add_host_and_port(span, ioctx->sock->info);
        }
        callback(instance, LCB_CALLBACK_HTTP, (const lcb_RESPBASE *)&resp);
        status |= Request::CBINVOKED;
    }
    return parse_state;
}

static void io_read(lcbio_CTX *ctx, unsigned nr)
{
    auto *req = reinterpret_cast<Request *>(lcbio_ctx_data(ctx));
    lcb_INSTANCE *instance = req->instance;
    /** this variable set to 0 (in progress), -1 (error), 1 (done) */
    int rv = 0;
    lcbio_CTXRDITER iter;
    req->incref();

    /** Delay the timer */
    lcbio_timer_rearm(req->timer, req->timeout());

    LCBIO_CTX_ITERFOR(ctx, &iter, nr)
    {
        char *buf;
        unsigned nbuf;
        unsigned parse_state;

        buf = reinterpret_cast<char *>(lcbio_ctx_ribuf(&iter));
        nbuf = lcbio_ctx_risize(&iter);
        parse_state = req->handle_parse_chunked(buf, nbuf);

        if ((parse_state & lcb::htparse::Parser::S_ERROR) || req->has_pending_redirect()) {
            rv = -1;
            break;
        } else if (!req->is_ongoing()) {
            rv = 1;
            break;
        }
    }

    if (rv == -1) {
        // parse error or redirect
        lcb_STATUS err;
        if (req->has_pending_redirect()) {
            instance->bootstrap(lcb::BS_REFRESH_THROTTLE);
            // Transfer control to redirect function()
            lcb_log(LOGARGS(req, DEBUG), LOGFMT "Attempting redirect to %s", LOGID(req), req->pending_redirect.c_str());
            req->redirect();
        } else {
            err = LCB_ERR_PROTOCOL_ERROR;
            lcb_log(LOGARGS(req, ERR), LOGFMT "Got parser error while parsing HTTP stream", LOGID(req));
            req->finish_or_retry(err);
        }
    } else if (rv == 1) {
        // Complete
        req->finish(LCB_SUCCESS);
    } else {
        // Pending
        lcbio_ctx_rwant(ctx, req->paused ? 0 : 1);
        lcbio_ctx_schedule(ctx);
    }

    req->decref();
}

void Request::pause()
{
    if (!paused) {
        paused = true;
        if (ioctx) {
            lcbio_ctx_rwant(ioctx, 0);
            lcbio_ctx_schedule(ioctx);
        }
    }
}

void Request::resume()
{
    if (!paused) {
        return;
    }

    if (ioctx == nullptr) {
        return;
    }
    paused = false;
    lcbio_ctx_rwant(ioctx, 1);
    lcbio_ctx_schedule(ioctx);
}

static lcbio_SERVICE request_type_to_service(lcb_HTTP_TYPE reqtype)
{
    switch (reqtype) {
        case LCB_HTTP_TYPE_QUERY:
            return LCBIO_SERVICE_N1QL;
        case LCB_HTTP_TYPE_VIEW:
            return LCBIO_SERVICE_VIEW;
        case LCB_HTTP_TYPE_SEARCH:
            return LCBIO_SERVICE_FTS;
        case LCB_HTTP_TYPE_ANALYTICS:
            return LCBIO_SERVICE_ANALYTICS;
        case LCB_HTTP_TYPE_EVENTING:
            return LCBIO_SERVICE_EVENTING;
        default:
            return LCBIO_SERVICE_MGMT;
    }
}

static void io_error(lcbio_CTX *ctx, lcb_STATUS err)
{
    auto *req = reinterpret_cast<Request *>(lcbio_ctx_data(ctx));

    lcb_log(LOGARGS(req, ERR), LOGFMT "Got error while performing I/O on HTTP stream " HOST_FMT " (%s). Err=%s",
            LOGID(req), HOST_VAL(req), lcbio_svcstr(request_type_to_service(req->reqtype)), lcb_strerror_short(err));
    req->finish_or_retry(err);
}

static void request_timed_out(void *arg)
{
    (reinterpret_cast<Request *>(arg))->finish(LCB_ERR_TIMEOUT);
}

static void on_connected(lcbio_SOCKET *sock, void *arg, lcb_STATUS err, lcbio_OSERR syserr)
{
    auto *req = reinterpret_cast<Request *>(arg);
    lcbio_CTXPROCS procs{};
    lcb_settings *settings = req->instance->settings;
    req->creq = nullptr;

    lcbio_SERVICE service = request_type_to_service(req->reqtype);

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(req, ERR), "Connection to " HOST_FMT " (%s) failed with Err=%s", HOST_VAL(req),
                lcbio_svcstr(service), lcb_strerror_short(err));
        req->finish_or_retry(err);
        return;
    }

    lcbio_sslify_if_needed(sock, settings);

    procs.cb_err = io_error;
    procs.cb_read = io_read;
    req->ioctx = lcbio_ctx_new(sock, arg, &procs);
    sock->service = service;
    req->ioctx->subsys = "mgmt/capi";
    lcbio_ctx_put(req->ioctx, &req->preamble[0], req->preamble.size());
    if (!req->body.empty()) {
        lcbio_ctx_put(req->ioctx, &req->body[0], req->body.size());
    }
    lcbio_ctx_rwant(req->ioctx, 1);
    lcbio_ctx_schedule(req->ioctx);
    (void)syserr;
}

lcb_STATUS Request::start_io(lcb_host_t &dest)
{
    lcbio_MGR *pool = instance->http_sockpool;

    creq = pool->get(dest, timeout(), on_connected, this);
    if (!creq) {
        return LCB_ERR_CONNECT_ERROR;
    }

    if (!timer) {
        timer = lcbio_timer_new(io, this, request_timed_out);
    }

    if (!lcbio_timer_armed(timer)) {
        lcbio_timer_rearm(timer, timeout());
    }

    return LCB_SUCCESS;
}

static void pool_close_cb(lcbio_SOCKET *sock, int reusable, void *arg)
{
    int close_ok = *(int *)arg;

    lcbio_ref(sock);
    if (reusable && close_ok) {
        lcb::io::Pool::put(sock);
    } else {
        lcb::io::Pool::discard(sock);
    }
}

void Request::close_io()
{
    lcb::io::ConnectionRequest::cancel(&creq);

    if (!ioctx) {
        return;
    }

    int can_ka;

    if (parser && is_data_request()) {
        can_ka = parser->can_keepalive();
    } else {
        can_ka = 0;
    }

    lcbio_ctx_close(ioctx, pool_close_cb, &can_ka);
    ioctx = nullptr;
}
