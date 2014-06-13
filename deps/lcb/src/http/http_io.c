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
#include "http.h"
#include <lcbio/ssl.h>

#define LOGARGS(req, lvl) \
    req->instance->settings, "http-io", LCB_LOG_##lvl, __FILE__, __LINE__

#define IS_IN_PROGRESS(req) (req)->status == LCB_HTREQ_S_ONGOING

static void
handle_headers(lcb_http_request_t req)
{
    lcbht_RESPONSE *res = lcbht_get_response(req->parser);
    req->headers = lcbht_make_resphdrlist(res);

    if (res->status >= 300 && res->status <= 400) {
        const char *redirto = lcbht_get_resphdr(res, "Location");
        if (redirto) {
            req->redirect_to = strdup(redirto);
        }
    }
}

static lcbht_RESPSTATE
handle_parse_chunked(lcb_http_request_t req, const char *buf, unsigned nbuf)
{
    lcbht_RESPSTATE state, oldstate, diff;
    lcbht_RESPONSE *res = lcbht_get_response(req->parser);

    do {
        const char *body;
        unsigned nused = -1, nbody = -1;
        oldstate = res->state;

        state = lcbht_parse_ex(req->parser, buf, nbuf, &nused, &nbody, &body);
        diff = oldstate ^ state;

        /* Got headers now for the first time */
        if (diff & LCBHT_S_HEADER) {
            handle_headers(req);
        }

        if (req->redirect_to) {
            /* caller should reschedule */
            return LCBHT_S_DONE;
        }

        if (state & LCBHT_S_ERROR) {
            /* nothing to do here */
            return state;
        }

        if (nbody) {
            if (req->chunked) {
                lcb_http_resp_t htresp;
                lcb_setup_lcb_http_resp_t(&htresp,
                    res->status, req->path, req->npath,
                    (const char * const *)req->headers, body, nbody);
                req->on_data(req,
                    req->instance, req->command_cookie, LCB_SUCCESS, &htresp);
            } else {
                lcb_string_append(&res->body, body, nbody);
            }
        }

        buf += nused;
        nbuf -= nused;
    } while ((state & LCBHT_S_DONE) == 0 && IS_IN_PROGRESS(req) && nbuf);

    if ( (state & LCBHT_S_DONE) && IS_IN_PROGRESS(req)) {
        lcb_http_resp_t htresp;
        if (req->chunked) {
            buf = NULL;
            nbuf = 0;
        } else {
            buf = res->body.base;
            nbuf = res->body.nused;
        }

        lcb_setup_lcb_http_resp_t(&htresp,
            res->status, req->path, req->npath,
            (const char * const *)req->headers, buf, nbuf);

        if (req->on_complete) {
            req->on_complete(req,
                req->instance, req->command_cookie, LCB_SUCCESS, &htresp);
        }
        req->status |= LCB_HTREQ_S_CBINVOKED;
    }
    return state;
}

static void
io_read(lcbio_CTX *ctx, unsigned nr)
{
    lcb_http_request_t req = lcbio_ctx_data(ctx);
    lcb_t instance = req->instance;
    /** this variable set to 0 (in progress), -1 (error), 1 (done) */
    int rv = 0;
    lcbio_CTXRDITER iter;
    req->refcount++;

    /** Delay the timer */
    lcb_timer_rearm(req->io_timer, req->timeout);

    LCBIO_CTX_ITERFOR(ctx, &iter, nr) {
        char *buf;
        unsigned nbuf;
        lcbht_RESPSTATE state;

        buf = lcbio_ctx_ribuf(&iter);
        nbuf = lcbio_ctx_risize(&iter);
        state = handle_parse_chunked(req, buf, nbuf);

        if ((state & LCBHT_S_ERROR) || req->redirect_to) {
            rv = -1;
            break;
        } else if (!IS_IN_PROGRESS(req)) {
            rv = 1;
            break;
        }
    }

    if (rv == -1) {
        lcb_error_t err;
        if (req->redirect_to) {
            req->url = req->redirect_to;
            req->nurl = strlen(req->url);
            req->redirect_to = NULL;
            if ((err = lcb_http_verify_url(req, NULL, 0)) == LCB_SUCCESS) {
                if ((err = lcb_http_request_exec(req)) == LCB_SUCCESS) {
                    goto GT_DONE;
                }
            }
        } else {
            err = LCB_PROTOCOL_ERROR;
        }
        lcb_http_request_finish(instance, req, err);
    } else if (rv == 1) {
        lcb_http_request_finish(instance, req, LCB_SUCCESS);
    } else {
        lcbio_ctx_rwant(ctx, 1);
        lcbio_ctx_schedule(ctx);
    }

    GT_DONE:
    lcb_http_request_decref(req);
}

static void
io_error(lcbio_CTX *ctx, lcb_error_t err)
{
    lcb_http_request_t req = lcbio_ctx_data(ctx);
    lcb_http_request_finish(req->instance, req, err);
}

static void
request_timed_out(lcb_timer_t tm, lcb_t u, const void *cookie)
{
    lcb_http_request_t req = (lcb_http_request_t)cookie;
    lcb_http_request_finish(req->instance, req, LCB_ETIMEDOUT);
    (void)u;
    (void)tm;
}



static void
on_connected(lcbio_SOCKET *sock, void *arg, lcb_error_t err, lcbio_OSERR syserr)
{
    lcb_http_request_t req = arg;
    lcbio_EASYPROCS procs;
    lcb_settings *settings = req->instance->settings;

    LCBIO_CONNREQ_CLEAR(&req->creq);

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(req, ERR), "Connection to failed with Err=0x%x", err);
        lcb_http_request_finish(req->instance, req, err);
        return;
    }

    lcbio_sslify_if_needed(sock, settings);

    procs.cb_err = io_error;
    procs.cb_read = io_read;
    req->ioctx = lcbio_ctx_new(sock, arg, &procs);
    req->ioctx->subsys = "mgmt/capi";
    lcbio_ctx_put(req->ioctx, req->outbuf.base, req->outbuf.nused);
    lcbio_ctx_rwant(req->ioctx, 1);
    lcbio_ctx_schedule(req->ioctx);
    (void)syserr;
}

lcb_error_t
lcb_http_request_connect(lcb_http_request_t req)
{
    lcb_host_t dest;
    lcbio_pCONNSTART cs;
    lcb_settings *settings = req->instance->settings;

    memcpy(dest.host, req->host, req->nhost);
    dest.host[req->nhost] = '\0';
    memcpy(dest.port, req->port, req->nport);
    dest.port[req->nport] = '\0';

    req->timeout = req->reqtype == LCB_HTTP_TYPE_VIEW ?
            settings->views_timeout : settings->http_timeout;

    cs = lcbio_connect(req->io, settings, &dest, req->timeout, on_connected, req);
    if (!cs) {
        return LCB_CONNECT_ERROR;
    }
    req->creq.type = LCBIO_CONNREQ_RAW;
    req->creq.u.cs = cs;

    if (!req->io_timer) {
        req->io_timer = lcb_timer_create_simple(req->io,
                                                req,
                                                req->timeout,
                                                request_timed_out);
    } else {
        lcb_timer_rearm(req->io_timer, req->timeout);
    }

    return LCB_SUCCESS;
}
