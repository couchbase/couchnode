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

static void request_v0_handler(lcb_socket_t, short, void *);

static void request_v1_write_handler(lcb_sockdata_t *sock,
                                     lcb_io_writebuf_t *wbuf,
                                     int status);

static void request_v1_read_handler(lcb_sockdata_t *sock, lcb_ssize_t nr);
static void request_v1_error_handler(lcb_sockdata_t *sock);
static int request_do_parse(lcb_http_request_t req);

static void request_v0_handler(lcb_socket_t sock, short which, void *arg)
{
    lcb_http_request_t req = arg;
    lcb_t instance = req->instance;
    lcb_ssize_t rv;
    int should_continue = 1;
    lcb_error_t err = LCB_SUCCESS;

    req->refcount++;

    if (which & LCB_READ_EVENT) {
        lcb_sockrw_status_t status;

        status = lcb_sockrw_v0_slurp(&req->connection, req->connection.input);
        if (status != LCB_SOCKRW_READ &&
                status != LCB_SOCKRW_WOULDBLOCK &&
                status != LCB_SOCKRW_SHUTDOWN) {
            should_continue = 0;
            err = LCB_NETWORK_ERROR;

        } else {
            rv = request_do_parse(req);
            if (rv == 0) {
                /* Request completed */
                should_continue = 0;

            } else if (rv < 0) {
                /* Request format error */
                should_continue = 0;
                if (req->redirect_to) {
                    if (instance->max_redir != -1 && instance->max_redir ==  req->redircount) {
                        err = LCB_TOO_MANY_REDIRECTS;
                        req->redirect_to = NULL;
                    }
                } else {
                    err = LCB_PROTOCOL_ERROR;
                }
            } else {
                /* Still want more data: */
                lcb_sockrw_set_want(&req->connection, LCB_READ_EVENT, 1);
            }

            if (status == LCB_SOCKRW_SHUTDOWN && should_continue != 0) {
                /** Premature termination of connection */
                err = LCB_NETWORK_ERROR;
                should_continue = 0;
            }
        }
    }

    if (should_continue && (which & LCB_WRITE_EVENT)) {
        lcb_sockrw_status_t status;

        status = lcb_sockrw_v0_write(&req->connection, req->connection.output);

        if (status != LCB_SOCKRW_WROTE && status != LCB_SOCKRW_WOULDBLOCK) {
            err = LCB_NETWORK_ERROR;
            should_continue = 0;

        } else if (lcb_sockrw_flushed(&req->connection)) {
            lcb_sockrw_set_want(&req->connection, LCB_READ_EVENT, 1);

        } else {
            lcb_sockrw_set_want(&req->connection, LCB_RW_EVENT, 1);
        }
    }

    if (!should_continue) {
        if (req->redirect_to) {
            req->url = req->redirect_to;
            req->nurl = strlen(req->url);
            req->redirect_to = NULL;
            err = lcb_http_verify_url(req, NULL, 0);
            if (err == LCB_SUCCESS) {
                err = lcb_http_request_exec(req);
            }
            if (err != LCB_SUCCESS) {
                lcb_http_request_finish(instance, req, err);
            }
        } else {
            lcb_http_request_finish(instance, req, err);
        }
    } else {
        lcb_sockrw_apply_want(&req->connection);
    }

    lcb_http_request_decref(req);
    (void)sock;
}


static void request_v1_error_handler(lcb_sockdata_t *sock)
{
    lcb_http_request_t req;
    if (!lcb_sockrw_v1_cb_common(sock, NULL, (void **)&req)) {
        return;
    }
    lcb_http_request_finish(req->instance, req, LCB_NETWORK_ERROR);
}

static void request_v1_read_handler(lcb_sockdata_t *sock, lcb_ssize_t nr)
{
    int rv;
    lcb_http_request_t req;
    if (!lcb_sockrw_v1_cb_common(sock, NULL, (void **)&req)) {
        return;
    }

    lcb_sockrw_v1_onread_common(sock, &req->connection.input, nr);

    if (nr < 1) {
        lcb_http_request_finish(req->instance, req, LCB_NETWORK_ERROR);
        return;
    }

    req->refcount++;
    rv = request_do_parse(req);

    if (rv < 1) {
        lcb_http_request_finish(req->instance,
                                req, rv ? LCB_PROTOCOL_ERROR : LCB_SUCCESS);

    } else {
        lcb_sockrw_set_want(&req->connection, LCB_READ_EVENT, 1);
        lcb_sockrw_apply_want(&req->connection);
    }

    lcb_http_request_decref(req);
}

static void request_v1_write_handler(lcb_sockdata_t *sock,
                                     lcb_io_writebuf_t *wbuf,
                                     int status)
{
    lcb_http_request_t req;

    if (!lcb_sockrw_v1_cb_common(sock, wbuf, (void **)&req)) {
        return;
    }

    lcb_sockrw_v1_onwrite_common(sock, wbuf, &req->connection.input);

    if (status) {
        lcb_http_request_finish(req->instance, req, LCB_NETWORK_ERROR);

    } else {
        lcb_sockrw_set_want(&req->connection, LCB_READ_EVENT, 1);
        lcb_sockrw_apply_want(&req->connection);
    }
}


static void request_timed_out(lcb_connection_t conn, lcb_error_t err)
{
    lcb_http_request_t req = (lcb_http_request_t)conn->data;
    lcb_http_request_finish(req->instance, req, err);
}

static int request_do_parse(lcb_http_request_t req)
{
    int rv = lcb_http_request_do_parse(req);

    if (rv == 0 && req->instance != NULL) {
        lcb_connection_activate_timer(&req->connection);
    }
    return rv;
}


static void request_connected(lcb_connection_t conn, lcb_error_t err)
{
    lcb_http_request_t req = (lcb_http_request_t)conn->data;
    if (err != LCB_SUCCESS) {
        lcb_http_request_finish(req->instance, req, err);
        return;
    }

    req->connection.evinfo.handler = request_v0_handler;
    req->connection.completion.read = request_v1_read_handler;
    req->connection.completion.write = request_v1_write_handler;
    req->connection.completion.error = request_v1_error_handler;
    lcb_sockrw_set_want(&req->connection, LCB_WRITE_EVENT, 1);
    lcb_sockrw_apply_want(&req->connection);
}

lcb_error_t lcb_http_request_connect(lcb_http_request_t req)
{
    lcb_connection_result_t result;
    lcb_connection_t conn = &req->connection;
    conn->on_connect_complete = request_connected;
    conn->on_timeout = request_timed_out;

    if (req->reqtype == LCB_HTTP_TYPE_VIEW) {
        conn->timeout.usec = req->instance->views_timeout;

    } else {
        conn->timeout.usec = req->instance->http_timeout;
    }

    conn->instance = req->instance;
    conn->data = req;
    lcb_connection_getaddrinfo(conn, 0);
    result = lcb_connection_start(conn, 1);

    if (result != LCB_CONN_INPROGRESS) {
        return LCB_CONNECT_ERROR;
    }

    return LCB_SUCCESS;
}
