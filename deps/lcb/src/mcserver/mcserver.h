/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

#ifndef LCB_MCSERVER_H
#define LCB_MCSERVER_H
#include <libcouchbase/couchbase.h>
#include <lcbio/lcbio.h>
#include <lcbio/timer-ng.h>
#include <mc/mcreq.h>
#include <netbuf/netbuf.h>

#ifdef __cplusplus
extern "C" {
#endif

struct lcb_settings_st;
struct lcb_server_st;

/**
 * The structure representing each couchbase server
 */
typedef struct mc_SERVER_st {
    /** Pipeline object for command queues */
    mc_PIPELINE pipeline;

    /** The server endpoint as hostname:port */
    char *datahost;

    /** The Couchbase Views API endpoint base */
    char *viewshost;

    /** The REST API server as hostname:port */
    char *resthost;

    /** Pointer back to the instance */
    lcb_t instance;

    lcb_settings *settings;

    /* Defined in mcserver.c */
    int state;

    /** Whether compression is supported */
    short compsupport;

    /** Whether extended 'UUID' and 'seqno' are available for each mutation */
    short synctokens;

    /** IO/Operation timer */
    lcbio_pTIMER io_timer;

    lcbio_CTX *connctx;
    lcbio_CONNREQ connreq;

    /** Request for current connection */
    lcb_host_t *curhost;
} mc_SERVER;

#define MCSERVER_TIMEOUT(c) (c)->settings->operation_timeout

/**
 * Allocate and initialize a new server object. The object will not be
 * connected
 * @param instance the instance to which the server belongs
 * @param ix the server index in the configuration
 * @return the new object or NULL on allocation failure.
 */
mc_SERVER *
mcserver_alloc(lcb_t instance, int ix);

mc_SERVER *
mcserver_alloc2(lcb_t instance, lcbvb_CONFIG* vbc, int ix);

/**
 * Close the server. The resources of the server may still continue to persist
 * internally for a bit until all callbacks have been delivered and all buffers
 * flushed and/or failed.
 * @param server the server to release
 */
void
mcserver_close(mc_SERVER *server);

/**
 * Schedule a flush and potentially flush some immediate data on the server.
 * This is safe to call multiple times, however performance considerations
 * should be taken into account
 */
void
mcserver_flush(mc_SERVER *server);

/**
 * Wrapper around mcreq_pipeline_timeout() and/or mcreq_pipeline_fail(). This
 * function will purge all pending requests within the server and invoke
 * their callbacks with the given error code passed as `err`. Depending on
 * the error code, some operations may be retried.
 * @param server the server to fail
 * @param err the error code by which to fail the commands
 *
 * @note This function does not modify the server's socket or state in itself,
 * but rather simply wipes the commands from its queue
 */
void
mcserver_fail_chain(mc_SERVER *server, lcb_error_t err);

/**
 * Returns true or false depending on whether there are pending commands on
 * this server
 */
LCB_INTERNAL_API
int
mcserver_has_pending(mc_SERVER *server);

#define mcserver_get_host(server) (server)->curhost->host
#define mcserver_get_port(server) (server)->curhost->port

#ifdef __cplusplus
}
#endif /* __cplusplus */
#endif /* LCB_MCSERVER_H */
