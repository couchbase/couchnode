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

#define LOGARGS(req, lvl) \
    &req->instance->settings, "http-io", LCB_LOG_##lvl, __FILE__, __LINE__

static void io_read(lcb_connection_t conn)
{
    lcb_http_request_t req = conn->data;
    lcb_t instance = req->instance;
    int rv, is_done = 0;
    lcb_error_t err = LCB_SUCCESS;


    req->refcount++;

    /** Delay the timer */
    lcb_timer_rearm(req->io_timer, req->timeout);

    rv = lcb_http_request_do_parse(req);
    if (rv == 0) {
        is_done = 1;

    } else if (rv < 0) {
        is_done = 1;

        if (req->redirect_to) {
            lcb_settings *settings = &instance->settings;
            if (settings->max_redir != -1 &&
                      settings->max_redir == req->redircount) {
                err = LCB_TOO_MANY_REDIRECTS;
                req->redirect_to = NULL;
            }
        } else {
            err = LCB_PROTOCOL_ERROR;
        }
    } else {
        lcb_sockrw_set_want(conn, LCB_READ_EVENT, 1);
    }

    if (is_done) {
        if (req->redirect_to) {
            req->url = req->redirect_to;
            req->nurl = strlen(req->url);
            req->redirect_to = NULL;
            err = lcb_http_verify_url(req, NULL, 0);
            if (err == LCB_SUCCESS) {
                err = lcb_http_request_exec(req);
            } else {
                lcb_http_request_finish(instance, req, err);
            }
        } else {
            lcb_http_request_finish(instance, req, err);
        }
    } else {
        lcb_sockrw_apply_want(conn);
    }

    lcb_http_request_decref(req);
}

static void io_error(lcb_connection_t conn)
{
    lcb_http_request_t req = conn->data;
    lcb_http_request_finish(req->instance, req, LCB_NETWORK_ERROR);
}

static void request_timed_out(lcb_timer_t tm, lcb_t u, const void *cookie)
{
    lcb_http_request_t req = (lcb_http_request_t)cookie;
    lcb_http_request_finish(req->instance, req, LCB_ETIMEDOUT);
    (void)u;
    (void)tm;
}



static void request_connected(lcb_connection_t conn, lcb_error_t err)
{
    lcb_http_request_t req = (lcb_http_request_t)conn->data;
    if (err != LCB_SUCCESS) {
        const lcb_host_t *tmphost = lcb_connection_get_host(conn);
        lcb_log(LOGARGS(req, ERR),
                "Connection to %s:%s failed with Err=0x%x",
                tmphost->host, tmphost->port, err);
        lcb_http_request_finish(req->instance, req, err);
        return;
    }


    lcb_sockrw_set_want(&req->connection, LCB_WRITE_EVENT, 1);
    lcb_sockrw_apply_want(&req->connection);
}

lcb_error_t lcb_http_request_connect(lcb_http_request_t req)
{
    struct lcb_io_use_st use;
    lcb_connection_result_t result;
    lcb_conn_params params;
    lcb_host_t dest;
    lcb_connection_t conn = &req->connection;

    memcpy(dest.host, req->host, req->nhost);
    dest.host[req->nhost] = '\0';

    memcpy(dest.port, req->port, req->nport);
    dest.port[req->nport] = '\0';

    params.destination = &dest;
    params.handler = request_connected;
    req->timeout = req->reqtype == LCB_HTTP_TYPE_VIEW ?
            req->instance->settings.views_timeout :
            req->instance->settings.http_timeout;
    params.timeout = req->timeout;

    result = lcb_connection_start(conn, &params,
                                  LCB_CONNSTART_NOCB|LCB_CONNSTART_ASYNCERR);

    if (result != LCB_CONN_INPROGRESS) {
        return LCB_CONNECT_ERROR;
    }
    if (!req->io_timer) {
        req->io_timer = lcb_timer_create_simple(req->io,
                                                req,
                                                params.timeout,
                                                request_timed_out);
    } else {
        lcb_timer_rearm(req->io_timer, req->timeout);
    }

    lcb_connuse_easy(&use, req, io_read, io_error);
    lcb_connection_use(conn, &use);
    return LCB_SUCCESS;
}
