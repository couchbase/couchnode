/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2013 Couchbase, Inc.
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

/**
 * This file contains abstracted IO routines for a memcached server
 *
 * @author Mark Nunberg
 */

#include "internal.h"

#define LOGARGS(c, lvl) \
    &(c)->instance->settings, "server", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOG(c, lvl, msg) lcb_log(LOGARGS(c, lvl), msg)

static int do_read_data(lcb_server_t *c, int allow_read)
{
    lcb_sockrw_status_t status;
    lcb_size_t processed = 0;
    int rv = 0;

    /*
    ** The timers isn't supposed to be _that_ accurate.. it's better
    ** to shave off system calls :)
    */
    hrtime_t stop = gethrtime();

    if (allow_read) {
        status = lcb_sockrw_v0_slurp(&c->connection, c->connection.input);

    } else {
        status = LCB_SOCKRW_WOULDBLOCK;
    }

    while ((rv = lcb_proto_parse_single(c, stop)) > 0) {
        processed++;
    }

    if (rv == -1) {
        return -1;
    }

    if (status == LCB_SOCKRW_WOULDBLOCK || status == LCB_SOCKRW_READ) {
        return 0;
    }

    return -1;
}

static void event_complete_common(lcb_server_t *c, lcb_error_t rc)
{
    lcb_t instance = c->instance;

    if (rc != LCB_SUCCESS) {
        LOG(c, ERR, "Server failed");
        lcb_failout_server(c, rc);
        lcb_bootstrap_errcount_incr(instance);

    } else {
        if (!lcb_timer_armed(c->io_timer)) {
            lcb_timer_rearm(c->io_timer, MCSERVER_TIMEOUT(c));
        }

        lcb_sockrw_apply_want(&c->connection);
        c->inside_handler = 0;
    }

    lcb_maybe_breakout(instance);
    lcb_error_handler(instance, rc, NULL);
}

static void v0_handler(lcb_socket_t sock, short which, void *arg)
{
    lcb_connection_t conn = arg;
    lcb_server_t *c = conn->data;
    (void)sock;

    if (which & LCB_WRITE_EVENT) {
        lcb_sockrw_status_t status;

        status = lcb_sockrw_v0_write(conn, conn->output);
        if (status != LCB_SOCKRW_WROTE && status != LCB_SOCKRW_WOULDBLOCK) {
            event_complete_common(c, LCB_NETWORK_ERROR);
            return;
        }
    }

    if (which & LCB_READ_EVENT || conn->input->nbytes) {
        if (do_read_data(c, which & LCB_READ_EVENT) != 0) {
            /* TODO stash error message somewhere
             * "Failed to read from connection to \"%s:%s\"", c->hostname, c->port */
            event_complete_common(c, LCB_NETWORK_ERROR);
            return;
        }
    }

    /**
     * Because of the operations-per-call limit, we might still need to read
     * a bit more once the event loop calls us again. We can't assume a
     * non-blocking read if we don't expect any data, but we can usually rely
     * on a non-blocking write.
     */
    if (conn->output->nbytes || conn->input->nbytes) {
        which = LCB_RW_EVENT;
    } else {
        if (c->cmd_log.nbytes) {
            which = LCB_READ_EVENT;
        } else {
            which = 0;
        }
    }

    lcb_sockrw_set_want(conn, which, 1);
    event_complete_common(c, LCB_SUCCESS);
}

static void v1_error(lcb_sockdata_t *sockptr)
{
    lcb_server_t *c;

    if (!lcb_sockrw_v1_cb_common(sockptr, NULL, (void **)&c)) {
        return;
    }
    event_complete_common(c, LCB_NETWORK_ERROR);
}


static void v1_read(lcb_sockdata_t *sockptr, lcb_ssize_t nr)
{
    lcb_server_t *c;
    int rv;
    hrtime_t stop;

    if (!lcb_sockrw_v1_cb_common(sockptr, NULL, (void **)&c)) {
        return;
    }

    lcb_sockrw_v1_onread_common(sockptr, &c->connection.input, nr);

    c->inside_handler = 1;

    if (nr < 1) {
        event_complete_common(c, LCB_NETWORK_ERROR);
        return;
    }

    stop = gethrtime();

    while ((rv = lcb_proto_parse_single(c, stop)) > 0) {
        /* do nothing */
    }

    if (rv >= 0) {
        /* Schedule the read request again */
        if (c->cmd_log.nbytes) {
            lcb_sockrw_set_want(&c->connection, LCB_READ_EVENT, 0);
        } else {
            lcb_sockrw_set_want(&c->connection, 0, 1);
        }
    }
    event_complete_common(c, LCB_SUCCESS);
}

static void v1_write(lcb_sockdata_t *sockptr, lcb_io_writebuf_t *wbuf, int status)
{
    lcb_server_t *c;
    if (!lcb_sockrw_v1_cb_common(sockptr, wbuf, (void **)&c)) {
        return;
    }

    lcb_sockrw_v1_onwrite_common(sockptr, wbuf, &c->connection.output);

    c->inside_handler = 1;

    if (status) {
        event_complete_common(c, LCB_NETWORK_ERROR);
    } else {
        lcb_sockrw_set_want(&c->connection, LCB_READ_EVENT, 0);
        event_complete_common(c, LCB_SUCCESS);
    }
}

static void wire_io(lcb_server_t *server, lcb_connection_t src)
{
    struct lcb_io_use_st use;
    lcb_connuse_ex(&use, server, v0_handler, v1_read, v1_write, v1_error);

    if (src != NULL) {
        lcb_connection_transfer_socket(src, &server->connection, &use);
    } else {
        lcb_connection_use(&server->connection, &use);
    }

    lcb_connection_reset_buffers(&server->connection);
}

LIBCOUCHBASE_API
void lcb_flush_buffers(lcb_t instance, const void *cookie)
{
    lcb_size_t ii;
    for (ii = 0; ii < instance->nservers; ++ii) {
        lcb_server_t *c = instance->servers + ii;
        if (c->connection_ready) {
            v0_handler(c->connection.sockfd, LCB_READ_EVENT | LCB_WRITE_EVENT, c);
        }
    }
    (void)cookie;
}

int lcb_server_has_pending(lcb_server_t *server)
{
    lcb_connection_t conn = &server->connection;

    if ((conn->output && conn->output->nbytes) ||
            (conn->input && conn->input->nbytes)) {
        return 1;
    }

    if (server->cmd_log.nbytes || server->pending.nbytes) {
        return 1;
    }

    return 0;
}

int lcb_flushing_buffers(lcb_t instance)
{
    lcb_size_t ii;

    if (hashset_num_items(instance->http_requests)) {
        return 1;
    }
    for (ii = 0; ii < instance->nservers; ++ii) {
        if (lcb_server_has_pending(instance->servers + ii)) {
            return 1;
        }
    }
    return 0;
}


LCB_INTERNAL_API
void lcb_maybe_breakout(lcb_t instance)
{
    /**
     * So we're done with normal operations. See if we need a refresh
     */
    if (instance->wait) {
        if (!lcb_flushing_buffers(instance)
                && hashset_num_items(instance->timers) == 0
                && hashset_num_items(instance->durability_polls) == 0) {
            instance->wait = 0;
            instance->settings.io->v.v0.stop_event_loop(instance->settings.io);
        }
    }
}



static void connection_error(lcb_server_t *server, lcb_error_t err)
{
    lcb_failout_server(server, err);
    lcb_bootstrap_errcount_incr(server->instance);
}

static void negotiation_done(struct negotiation_context *ctx, lcb_error_t err)
{
    lcb_server_t *server = ctx->data;
    wire_io(server, NULL);

    if (err != LCB_SUCCESS) {
        lcb_negotiation_destroy(ctx);
        server->connection.protoctx = NULL;
        server->connection.protoctx_dtor = NULL;

        if (err == LCB_ETIMEDOUT) {
            lcb_timeout_server(server);
        } else {
            lcb_error_handler(server->instance, err, "SASL Negotiation failed");
            connection_error(server, err);
        }
    } else {

        lcb_connection_reset_buffers(&server->connection);
        lcb_server_connected(server);
    }
}


static void socket_connected(connmgr_request *req)
{
    lcb_server_t *server = req->data;
    int sasl_needed;
    lcb_error_t err;
    lcb_connection_t src_conn = req->conn;

    if (!src_conn) {
        if (req->err == LCB_SUCCESS) {
            req->err = LCB_CONNECT_ERROR;
        }
        err = req->err;
    } else {
        err = LCB_SUCCESS;
    }

    free(server->connreq);
    server->connreq = NULL;

    if (err != LCB_SUCCESS) {
        connection_error(server, err);
        return;
    }

    wire_io(server, src_conn);

    server->inside_handler = 1;
    sasl_needed = (
            vbucket_config_get_user(server->instance->vbucket_config) != NULL &&
            server->connection.protoctx == NULL);

    if (sasl_needed) {
        lcb_connection_t conn = &server->connection;
        struct negotiation_context *saslctx;

        struct lcb_nibufs_st nistrs;
        if (!lcb_get_nameinfo(conn, &nistrs)) {
            /** This normally shouldn't happen! */
            connection_error(server, LCB_NETWORK_ERROR);
            return;
        }

        saslctx = lcb_negotiation_create(conn, &server->instance->settings,
                                         MCSERVER_TIMEOUT(server),
                                         nistrs.remote, nistrs.local, &err);

        if (err != LCB_SUCCESS) {
            connection_error(server, err);
        }

        saslctx->data = server;
        saslctx->complete = negotiation_done;
        conn->protoctx = saslctx;
        conn->protoctx_dtor = (protoctx_dtor_t)lcb_negotiation_destroy;

    } else {
        lcb_server_connected(server);
        lcb_sockrw_apply_want(&server->connection);
        if (server->output_cookies.nbytes && !lcb_timer_armed(server->io_timer)) {
            lcb_timer_rearm(server->io_timer, MCSERVER_TIMEOUT(server));
        }
    }

    server->inside_handler = 0;
}

/**
 * Schedule a connection to the server
 */
void lcb_server_connect(lcb_server_t *server)
{
    connmgr_request *connreq;

    if (server->connreq || server->connection.state != LCB_CONNSTATE_UNINIT) {
        return;
    }


    server->connreq = malloc(sizeof(*server->connreq));
    connreq = server->connreq;

    connmgr_req_init(connreq,
                     server->curhost.host, server->curhost.port,
                     socket_connected);

    connreq->data = server;
    connmgr_get(server->instance->memd_sockpool,
                connreq,
                MCSERVER_TIMEOUT(server));
}

void lcb_server_release_connection(lcb_server_t *server, lcb_error_t err)
{
    lcb_connection_t conn = &server->connection;
    int can_release = (err == LCB_SUCCESS);

    if (server->connreq) {
        connmgr_cancel(server->instance->memd_sockpool, server->connreq);
        free(server->connreq);
        server->connreq = NULL;
        return;
    }

    if (server->connection.state == LCB_CONNSTATE_UNINIT) {
        return;
    }

    if (server->cmd_log.nbytes || conn->want) {
        lcb_log(LOGARGS(server, INFO),
                "Cannot release socket: Want=%d, CMDLOG=%lu bytes",
                conn->want, server->cmd_log.nbytes);
        can_release = 0;
    }

    if (conn->state != LCB_CONNSTATE_CONNECTED) {
        can_release = 0;
    }

    if (MCCONN_IS_NEGOTIATING(conn)) {
        can_release = 0;
    }

    if (can_release) {
        connmgr_put(server->instance->memd_sockpool, conn);
    } else {
        connmgr_discard(server->instance->memd_sockpool, conn);
    }
}

struct negotiation_context * lcb_negotiation_get(lcb_connection_t conn)
{
    return (struct negotiation_context *)conn->protoctx;
}
