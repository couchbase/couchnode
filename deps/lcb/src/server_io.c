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

    if (processed) {
        lcb_connection_delay_timer(&c->connection);
    }

    if (status == LCB_SOCKRW_WOULDBLOCK || status == LCB_SOCKRW_READ) {
        return 0;
    }

    if (c->instance->compat.type == LCB_CACHED_CONFIG) {
        lcb_schedule_config_cache_refresh(c->instance);
        return 0;
    }

    return -1;
}

static void event_complete_common(lcb_server_t *c, lcb_error_t rc)
{
    lcb_t instance = c->instance;

    if (rc != LCB_SUCCESS) {
        lcb_failout_server(c, rc);
    } else {
        if (c->is_config_node) {
            c->instance->weird_things = 0;
        }
        lcb_sockrw_apply_want(&c->connection);
        c->inside_handler = 0;
    }
    if (instance->compat.type == LCB_CACHED_CONFIG &&
            instance->compat.value.cached.needs_update) {
        lcb_refresh_config_cache(instance);
    }
    lcb_maybe_breakout(instance);
    lcb_error_handler(instance, rc, NULL);
}

void lcb_server_v0_event_handler(lcb_socket_t sock, short which, void *arg)
{
    lcb_server_t *c = arg;
    lcb_connection_t conn = &c->connection;
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
        which = LCB_READ_EVENT;
    }

    lcb_sockrw_set_want(conn, which, 1);
    event_complete_common(c, LCB_SUCCESS);
}

void lcb_server_v1_error_handler(lcb_sockdata_t *sockptr)
{
    lcb_server_t *c;

    if (!lcb_sockrw_v1_cb_common(sockptr, NULL, (void **)&c)) {
        return;
    }
    event_complete_common(c, LCB_NETWORK_ERROR);
}


void lcb_server_v1_read_handler(lcb_sockdata_t *sockptr, lcb_ssize_t nr)
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

    lcb_connection_delay_timer(&c->connection);

    stop = gethrtime();

    while ((rv = lcb_proto_parse_single(c, stop)) > 0) {
        /* do nothing */
    }

    if (rv >= 0) {
        /* Schedule the read request again */
        lcb_sockrw_set_want(&c->connection, LCB_READ_EVENT, 0);
    }
    event_complete_common(c, LCB_SUCCESS);
}

void lcb_server_v1_write_handler(lcb_sockdata_t *sockptr,
                                 lcb_io_writebuf_t *wbuf,
                                 int status)
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

LIBCOUCHBASE_API
void lcb_flush_buffers(lcb_t instance, const void *cookie)
{
    lcb_size_t ii;
    for (ii = 0; ii < instance->nservers; ++ii) {
        lcb_server_t *c = instance->servers + ii;
        if (c->connection_ready) {
            lcb_server_v0_event_handler(c->connection.sockfd,
                                        LCB_READ_EVENT | LCB_WRITE_EVENT,
                                        c);
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

    if (!lcb_sockrw_flushed(conn)) {
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
            instance->io->v.v0.stop_event_loop(instance->io);
        }
    }
}
