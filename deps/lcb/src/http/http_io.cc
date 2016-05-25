/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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
#include "sllist.h"
#include <lcbio/ssl.h>

using namespace lcb::http;

#define LOGFMT "<%s:%s>"
#define LOGID(req) get_ctx_host((req)->ioctx), get_ctx_port((req)->ioctx)
#define LOGARGS(req, lvl) req->instance->settings, "http-io", LCB_LOG_##lvl, __FILE__, __LINE__

void
Request::assign_response_headers(const lcbht_RESPONSE *resp)
{
    response_headers.clear();
    response_headers_clist.clear();

    sllist_node *curnode;
    SLLIST_ITERBASIC(&resp->headers, curnode) {
        lcbht_MIMEHDR *hdr = SLLIST_ITEM(curnode, lcbht_MIMEHDR, slnode);
        response_headers.push_back(Header(hdr->key, hdr->value));
    }

    std::vector<Header>::const_iterator ii = response_headers.begin();
    for (; ii != response_headers.end(); ++ii) {
        response_headers_clist.push_back(ii->key.c_str());
        response_headers_clist.push_back(ii->value.c_str());
    }
    response_headers_clist.push_back(NULL);
}

int
Request::handle_parse_chunked(const char *buf, unsigned nbuf)
{
    int parse_state, oldstate, diff;
    lcbht_RESPONSE *res = lcbht_get_response(parser);

    do {
        const char *rbody;
        unsigned nused = -1, nbody = -1;
        oldstate = res->state;

        parse_state = lcbht_parse_ex(parser, buf, nbuf, &nused, &nbody, &rbody);
        diff = oldstate ^ parse_state;

        /* Got headers now for the first time */
        if (diff & LCBHT_S_HEADER) {
            assign_response_headers(res);
            if (res->status >=  300 && res->status <= 400) {
                const char *redir = lcbht_get_resphdr(res, "Location");
                if (redir != NULL) {
                    pending_redirect.assign(redir);
                    return LCBHT_S_DONE;
                }
            }
        }

        if (parse_state & LCBHT_S_ERROR) {
            /* nothing to do here */
            return parse_state;
        }

        if (nbody) {
            if (chunked) {
                lcb_RESPHTTP htresp = { 0 };
                init_resp(&htresp);
                htresp.body = rbody;
                htresp.nbody = nbody;
                htresp.rc = LCB_SUCCESS;
                passed_data = true;
                callback(instance, LCB_CALLBACK_HTTP, (const lcb_RESPBASE *)&htresp);

            } else {
                lcb_string_append(&res->body, rbody, nbody);
            }
        }

        buf += nused;
        nbuf -= nused;
    } while ((parse_state & LCBHT_S_DONE) == 0 && is_ongoing() && nbuf);

    if ( (parse_state & LCBHT_S_DONE) && is_ongoing()) {
        lcb_RESPHTTP resp = { 0 };
        if (chunked) {
            buf = NULL;
            nbuf = 0;
        } else {
            buf = res->body.base;
            nbuf = res->body.nused;
        }

        init_resp(&resp);
        resp.rflags = LCB_RESP_F_FINAL;
        resp.rc = LCB_SUCCESS;
        resp.body = buf;
        resp.nbody = nbuf;
        passed_data = true;
        callback(instance, LCB_CALLBACK_HTTP, (const lcb_RESPBASE*)&resp);
        status |= Request::CBINVOKED;
    }
    return parse_state;
}

static void
io_read(lcbio_CTX *ctx, unsigned nr)
{
    Request *req = reinterpret_cast<Request*>(lcbio_ctx_data(ctx));
    lcb_t instance = req->instance;
    /** this variable set to 0 (in progress), -1 (error), 1 (done) */
    int rv = 0;
    lcbio_CTXRDITER iter;
    req->incref();

    /** Delay the timer */
    lcbio_timer_rearm(req->timer, req->timeout());

    LCBIO_CTX_ITERFOR(ctx, &iter, nr) {
        char *buf;
        unsigned nbuf;
        int parse_state;

        buf = reinterpret_cast<char*>(lcbio_ctx_ribuf(&iter));
        nbuf = lcbio_ctx_risize(&iter);
        parse_state = req->handle_parse_chunked(buf, nbuf);

        if ((parse_state & LCBHT_S_ERROR) || req->has_pending_redirect()) {
            rv = -1;
            break;
        } else if (!req->is_ongoing()) {
            rv = 1;
            break;
        }
    }

    if (rv == -1) {
        // parse error or redirect
        lcb_error_t err;
        if (req->has_pending_redirect()) {
            lcb_bootstrap_common(instance, LCB_BS_REFRESH_THROTTLE);
            // Transfer control to redirect function()
            lcb_log(LOGARGS(req, DEBUG), LOGFMT "Attempting redirect to %s", LOGID(req), req->pending_redirect.c_str());
            req->redirect();
        } else {
            err = LCB_PROTOCOL_ERROR;
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

void
Request::pause()
{
    if (!paused) {
        paused = true;
        if (ioctx) {
            lcbio_ctx_rwant(ioctx, 0);
            lcbio_ctx_schedule(ioctx);
        }
    }
}

void
Request::resume()
{
    if (!paused) {
        return;
    }

    if (ioctx == NULL) {
        return;
    }
    paused = false;
    lcbio_ctx_rwant(ioctx, 1);
    lcbio_ctx_schedule(ioctx);
}

static void
io_error(lcbio_CTX *ctx, lcb_error_t err)
{
    Request *req = reinterpret_cast<Request*>(lcbio_ctx_data(ctx));
    lcb_log(LOGARGS(req, ERR), LOGFMT "Got error while performing I/O on HTTP stream. Err=0x%x", LOGID(req), err);
    req->finish_or_retry(err);
}

static void
request_timed_out(void *arg)
{
    (reinterpret_cast<Request*>(arg))->finish(LCB_ETIMEDOUT);
}

static void
on_connected(lcbio_SOCKET *sock, void *arg, lcb_error_t err, lcbio_OSERR syserr)
{
    Request *req = reinterpret_cast<Request*>(arg);
    lcbio_CTXPROCS procs;
    lcb_settings *settings = req->instance->settings;

    LCBIO_CONNREQ_CLEAR(&req->creq);

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(req, ERR), "Connection to failed with Err=0x%x", err);
        req->finish_or_retry(err);
        return;
    }

    lcbio_sslify_if_needed(sock, settings);

    procs.cb_err = io_error;
    procs.cb_read = io_read;
    req->ioctx = lcbio_ctx_new(sock, arg, &procs);
    req->ioctx->subsys = "mgmt/capi";
    lcbio_ctx_put(req->ioctx, &req->preamble[0], req->preamble.size());
    if (!req->body.empty()) {
        lcbio_ctx_put(req->ioctx, &req->body[0], req->body.size());
    }
    lcbio_ctx_rwant(req->ioctx, 1);
    lcbio_ctx_schedule(req->ioctx);
    (void)syserr;
}

lcb_error_t
Request::start_io(lcb_host_t& dest)
{
    lcbio_MGR *pool = instance->http_sockpool;
    lcbio_pMGRREQ poolreq;

    poolreq = lcbio_mgr_get(pool, &dest, timeout(), on_connected, this);
    if (!poolreq) {
        return LCB_CONNECT_ERROR;
    }

    LCBIO_CONNREQ_MKPOOLED(&creq, poolreq);

    if (!timer) {
        timer = lcbio_timer_new(io, this, request_timed_out);
    }

    if (!lcbio_timer_armed(timer)) {
        lcbio_timer_rearm(timer, timeout());
    }

    return LCB_SUCCESS;
}

static void
pool_close_cb(lcbio_SOCKET *sock, int reusable, void *arg)
{
    int close_ok = *(int *)arg;

    lcbio_ref(sock);
    if (reusable && close_ok) {
        lcbio_mgr_put(sock);
    } else {
        lcbio_mgr_discard(sock);
    }
}

void
Request::close_io()
{
    lcbio_connreq_cancel(&creq);

    if (!ioctx) {
        return;
    }

    int can_ka;

    if (parser && is_data_request()) {
        can_ka = lcbht_can_keepalive(parser);
    } else {
        can_ka = 0;
    }

    lcbio_ctx_close(ioctx, pool_close_cb, &can_ka);
    ioctx = NULL;
}
