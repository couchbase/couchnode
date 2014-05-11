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

/**
 * This file contains the CCCP (Cluster Carrier Configuration Protocol)
 * implementation of the confmon provider. It utilizes a memcached connection
 * to retrieve configuration information.
 */

#include "internal.h"
#include "clconfig.h"
#include "packetutils.h"
#include "simplestring.h"
#include "mcserver.h"
#include "connmgr.h"

#define LOGARGS(cccp, lvl) \
    cccp->base.parent->settings, "cccp", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOG(cccp, lvl, msg) lcb_log(LOGARGS(cccp, lvl), msg)

struct cccp_cookie_st;

typedef struct {
    clconfig_provider base;
    struct lcb_connection_st connection;
    hostlist_t nodes;
    clconfig_info *config;
    int server_active;
    int disabled;
    lcb_timer_t timer;
    lcb_t instance;
    connmgr_request *cur_connreq;
    struct cccp_cookie_st *cmdcookie;
} cccp_provider;

typedef struct cccp_cookie_st {
    /** Parent object */
    cccp_provider *parent;

    /** Whether to ignore errors on this cookie object */
    int ignore_errors;
} cccp_cookie;

static void io_error_handler(lcb_connection_t);
static void io_read_handler(lcb_connection_t);
static void request_config(cccp_provider *);
static void socket_connected(connmgr_request *req);

static void release_socket(cccp_provider *cccp, int can_reuse)
{
    if (cccp->cmdcookie) {
        cccp->cmdcookie->ignore_errors = 1;
        cccp->cmdcookie =  NULL;
        return;
    }

    if (cccp->cur_connreq) {
        connmgr_cancel(cccp->instance->memd_sockpool, cccp->cur_connreq);
        free(cccp->cur_connreq);
        cccp->cur_connreq = NULL;
    } else if (cccp->connection.state != LCB_CONNSTATE_UNINIT) {
        if (can_reuse) {
            connmgr_put(cccp->instance->memd_sockpool, &cccp->connection);
        } else {
            connmgr_discard(cccp->instance->memd_sockpool, &cccp->connection);
        }
    }
}

static lcb_error_t schedule_next_request(cccp_provider *cccp,
                                         lcb_error_t err,
                                         int can_rollover)
{
    lcb_server_t *server = NULL;
    lcb_size_t ii;

    lcb_host_t *next_host = hostlist_shift_next(cccp->nodes, can_rollover);

    if (!next_host) {
        lcb_timer_disarm(cccp->timer);
        lcb_confmon_provider_failed(&cccp->base, err);
        cccp->server_active = 0;
        return err;
    }

    /** See if we can find a server */
    for (ii = 0; ii < cccp->instance->nservers; ii++) {
        lcb_server_t *cur = cccp->instance->servers + ii;
        if (lcb_host_equals(&cur->curhost, next_host)) {
            server = cur;
            break;
        }
    }

    if (server) {
        protocol_binary_request_get_cluster_config req;
        cccp_cookie *cookie = calloc(1, sizeof(*cookie));

        lcb_log(LOGARGS(cccp, INFO),
                "Re-Issuing CCCP Command on server struct %p", server);

        cookie->parent = cccp;
        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.opcode = CMD_GET_CLUSTER_CONFIG;
        req.message.header.request.opaque = ++cccp->instance->seqno;
        lcb_server_start_packet(server, cookie, &req, sizeof(req.bytes));
        lcb_server_end_packet(server);
        lcb_server_send_packets(server);
        lcb_timer_rearm(cccp->timer, PROVIDER_SETTING(&cccp->base,
                    config_node_timeout));
    } else {
        cccp->cur_connreq = calloc(1, sizeof(*cccp->cur_connreq));
        connmgr_req_init(cccp->cur_connreq, next_host->host, next_host->port,
                         socket_connected);
        cccp->cur_connreq->data = cccp;
        connmgr_get(cccp->instance->memd_sockpool, cccp->cur_connreq,
                    PROVIDER_SETTING(&cccp->base, config_node_timeout));
    }

    cccp->server_active = 1;
    return LCB_SUCCESS;
}

static lcb_error_t mcio_error(cccp_provider *cccp, lcb_error_t err)
{
    lcb_log(LOGARGS(cccp, ERR), "Got I/O Error=0x%x", err);
    if (err == LCB_AUTH_ERROR && cccp->base.parent->config == NULL) {
        lcb_confmon_provider_failed(&cccp->base, err);
        return err;
    }

    release_socket(cccp, err == LCB_NOT_SUPPORTED);
    return schedule_next_request(cccp, err, 0);
}

static void socket_timeout(lcb_timer_t tm, lcb_t instance, const void *cookie)
{
    cccp_provider *cccp = (cccp_provider *)cookie;
    mcio_error(cccp, LCB_ETIMEDOUT);

    (void)instance;
    (void)tm;
}

static void negotiation_done(struct negotiation_context *ctx, lcb_error_t err)
{
    cccp_provider *cccp = ctx->data;
    struct lcb_io_use_st use;

    if (err != LCB_SUCCESS) {
        LOG(cccp, ERR, "CCCP SASL negotiation failed");
        mcio_error(cccp, err);

    } else {
        LOG(cccp, DEBUG, "CCCP SASL negotiation done");
        lcb_connuse_easy(&use, cccp, io_read_handler, io_error_handler);
        lcb_connection_use(&cccp->connection, &use);
        request_config(cccp);
    }
}

void lcb_clconfig_cccp_enable(clconfig_provider *pb, lcb_t instance)
{
    cccp_provider *cccp = (cccp_provider *)pb;
    lcb_assert(pb->type == LCB_CLCONFIG_CCCP);
    cccp->instance = instance;
    pb->enabled = 1;
}

void lcb_clconfig_cccp_set_nodes(clconfig_provider *pb, const hostlist_t nodes)
{
    unsigned ii;
    cccp_provider *cccp = (cccp_provider *)pb;
    hostlist_clear(cccp->nodes);

    for (ii = 0; ii < nodes->nentries; ii++) {
        hostlist_add_host(cccp->nodes, nodes->entries + ii);
    }
    if (PROVIDER_SETTING(pb, randomize_bootstrap_nodes)) {
        hostlist_randomize(cccp->nodes);
    }
}

#define HOST_TOKEN "$HOST"
static void sanitize_config(
        const lcb_string *src, const char *host, lcb_string *dst)
{
    char *cur = src->base, *last = src->base;

    while ((cur = strstr(cur, HOST_TOKEN))) {
        lcb_string_append(dst, last, cur-last);
        lcb_string_appendz(dst, host);
        cur += sizeof(HOST_TOKEN)-1;
        last = cur;
    }

    lcb_string_append(dst, last, src->base + src->nalloc - last);
}

/** Update the configuration from a server. */
lcb_error_t lcb_cccp_update(clconfig_provider *provider,
                            const char *host,
                            lcb_string *data)
{
    VBUCKET_CONFIG_HANDLE vbc;
    lcb_string sanitized;
    int rv;
    clconfig_info *new_config;
    cccp_provider *cccp = (cccp_provider *)provider;
    vbc = vbucket_config_create();

    if (!vbc) {
        return LCB_CLIENT_ENOMEM;
    }

    lcb_string_init(&sanitized);
    sanitize_config(data, host, &sanitized);
    rv = vbucket_config_parse(vbc, LIBVBUCKET_SOURCE_MEMORY, sanitized.base);

    if (rv) {
        lcb_string_release(&sanitized);
        vbucket_config_destroy(vbc);
        lcb_string_release(&sanitized);
        return LCB_PROTOCOL_ERROR;
    }

    new_config = lcb_clconfig_create(vbc, &sanitized, LCB_CLCONFIG_CCCP);
    lcb_string_release(&sanitized);

    if (!new_config) {
        vbucket_config_destroy(vbc);
        return LCB_CLIENT_ENOMEM;
    }

    if (cccp->config) {
        lcb_clconfig_decref(cccp->config);
    }

    /** TODO: Figure out the comparison vector */
    new_config->cmpclock = gethrtime();
    cccp->config = new_config;
    lcb_confmon_provider_success(provider, new_config);
    return LCB_SUCCESS;
}

void lcb_cccp_update2(const void *cookie, lcb_error_t err,
                      const void *bytes, lcb_size_t nbytes,
                      const lcb_host_t *origin)
{
    cccp_cookie *ck = (cccp_cookie *)cookie;
    cccp_provider *cccp = ck->parent;

    if (err == LCB_SUCCESS) {
        lcb_string ss;

        lcb_string_init(&ss);
        lcb_string_append(&ss, bytes, nbytes);
        err = lcb_cccp_update(&cccp->base, origin->host, &ss);
        lcb_string_release(&ss);

        if (err != LCB_SUCCESS && ck->ignore_errors == 0) {
            mcio_error(cccp, err);
        }


    } else if (!ck->ignore_errors) {
        mcio_error(cccp, err);
    }

    if (ck == cccp->cmdcookie) {
        cccp->cmdcookie = NULL;
    }

    free(ck);
}

static void socket_connected(connmgr_request *req)
{
    cccp_provider *cccp = req->data;
    lcb_connection_t conn = req->conn;
    struct lcb_nibufs_st nistrs;
    struct lcb_io_use_st use;
    struct negotiation_context *ctx;
    lcb_error_t err;

    free(req);
    cccp->cur_connreq = NULL;

    LOG(cccp, DEBUG, "CCCP Socket connected");

    if (!conn) {
        mcio_error(cccp, LCB_CONNECT_ERROR);
        return;
    }

    lcb_connuse_easy(&use, cccp, io_read_handler, io_error_handler);
    lcb_connection_transfer_socket(conn, &cccp->connection, &use);
    conn = NULL;


    if (cccp->connection.protoctx) {
        /** Already have SASL */
        if ((err = lcb_connection_reset_buffers(&cccp->connection)) != LCB_SUCCESS) {
            mcio_error(cccp, err);
            return;
        }

        request_config(cccp);
        return;
    }

    if (!lcb_get_nameinfo(&cccp->connection, &nistrs)) {
        mcio_error(cccp, LCB_EINTERNAL);
        return;
    }

    ctx = lcb_negotiation_create(&cccp->connection,
                                 cccp->base.parent->settings,
                                 PROVIDER_SETTING(&cccp->base,
                                                  config_node_timeout),
                                 nistrs.remote,
                                 nistrs.local,
                                 &err);
    if (!ctx) {
        mcio_error(cccp, err);
    }

    ctx->complete = negotiation_done;
    ctx->data = cccp;
    cccp->connection.protoctx = ctx;
    cccp->connection.protoctx_dtor = (protoctx_dtor_t)lcb_negotiation_destroy;
}

static lcb_error_t cccp_get(clconfig_provider *pb)
{
    cccp_provider *cccp = (cccp_provider *)pb;

    if (cccp->cur_connreq || cccp->server_active || cccp->cmdcookie) {
        return LCB_BUSY;
    }

    return schedule_next_request(cccp, LCB_SUCCESS, 1);
}

static clconfig_info *cccp_get_cached(clconfig_provider *pb)
{
    cccp_provider *cccp = (cccp_provider *)pb;
    return cccp->config;
}

static lcb_error_t cccp_pause(clconfig_provider *pb)
{
    cccp_provider *cccp = (cccp_provider *)pb;
    if (!cccp->server_active) {
        return LCB_SUCCESS;
    }

    cccp->server_active = 0;
    release_socket(cccp, 0);
    lcb_timer_disarm(cccp->timer);
    return LCB_SUCCESS;
}

static void cccp_cleanup(clconfig_provider *pb)
{
    cccp_provider *cccp = (cccp_provider *)pb;

    release_socket(cccp, 0);
    lcb_connection_cleanup(&cccp->connection);

    if (cccp->config) {
        lcb_clconfig_decref(cccp->config);
    }
    if (cccp->nodes) {
        hostlist_destroy(cccp->nodes);
    }
    if (cccp->timer) {
        lcb_timer_destroy(NULL, cccp->timer);
    }
    if (cccp->cmdcookie) {
        cccp->cmdcookie->ignore_errors = 1;
    }
    free(cccp);
}

static void nodes_updated(clconfig_provider *provider, hostlist_t nodes,
                          VBUCKET_CONFIG_HANDLE vbc)
{
    int ii;
    cccp_provider *cccp = (cccp_provider *)provider;
    if (!vbc) {
        return;
    }
    if (vbucket_config_get_num_servers(vbc) < 1) {
        return;
    }

    hostlist_clear(cccp->nodes);
    for (ii = 0; ii < vbucket_config_get_num_servers(vbc); ii++) {
        const char *mcaddr = vbucket_config_get_server(vbc, ii);
        hostlist_add_stringz(cccp->nodes, mcaddr, LCB_CONFIG_MCD_PORT);
    }

    if (PROVIDER_SETTING(provider, randomize_bootstrap_nodes)) {
        hostlist_randomize(cccp->nodes);
    }

    (void)nodes;
}

static void io_error_handler(lcb_connection_t conn)
{
    mcio_error((cccp_provider *)conn->data, LCB_NETWORK_ERROR);
}

static void io_read_handler(lcb_connection_t conn)
{
    packet_info pi;
    cccp_provider *cccp = conn->data;
    lcb_string jsonstr;
    lcb_error_t err;
    int rv;
    lcb_host_t curhost;

    memset(&pi, 0, sizeof(pi));

    rv = lcb_packet_read_ringbuffer(&pi, conn->input);

    if (rv < 0) {
        LOG(cccp, ERR, "Couldn't parse packet!?");
        mcio_error(cccp, LCB_EINTERNAL);
        return;

    } else if (rv == 0) {
        lcb_sockrw_set_want(conn, LCB_READ_EVENT, 1);
        lcb_sockrw_apply_want(conn);
        return;
    }

    if (PACKET_STATUS(&pi) != PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        lcb_log(LOGARGS(cccp, ERR),
                "CCCP Packet responded with 0x%x; nkey=%d, nbytes=%lu, cmd=0x%x, seq=0x%x",
                PACKET_STATUS(&pi),
                PACKET_NKEY(&pi),
                (unsigned long)PACKET_NBODY(&pi),
                PACKET_OPCODE(&pi),
                PACKET_OPAQUE(&pi));

        switch (PACKET_STATUS(&pi)) {
        case PROTOCOL_BINARY_RESPONSE_NOT_SUPPORTED:
        case PROTOCOL_BINARY_RESPONSE_UNKNOWN_COMMAND:
            mcio_error(cccp, LCB_NOT_SUPPORTED);
            break;
        default:
            mcio_error(cccp, LCB_PROTOCOL_ERROR);
            break;
        }

        return;
    }

    if (!PACKET_NBODY(&pi)) {
        mcio_error(cccp, LCB_PROTOCOL_ERROR);
        return;
    }

    if (lcb_string_init(&jsonstr)) {
        mcio_error(cccp, LCB_CLIENT_ENOMEM);
        return;
    }

    if (lcb_string_append(&jsonstr, PACKET_BODY(&pi), PACKET_NBODY(&pi))) {
        mcio_error(cccp, LCB_CLIENT_ENOMEM);
        return;
    }

    curhost = *lcb_connection_get_host(&cccp->connection);
    lcb_packet_release_ringbuffer(&pi, conn->input);
    release_socket(cccp, 1);

    err = lcb_cccp_update(&cccp->base, curhost.host, &jsonstr);
    lcb_string_release(&jsonstr);
    if (err == LCB_SUCCESS) {
        lcb_timer_disarm(cccp->timer);
        cccp->server_active = 0;
    } else {
        schedule_next_request(cccp, LCB_PROTOCOL_ERROR, 0);
    }
}

static void request_config(cccp_provider *cccp)
{
    protocol_binary_request_set_cluster_config req;
    lcb_connection_t conn = &cccp->connection;
    ringbuffer_t *buf = conn->output;

    memset(&req, 0, sizeof(req));
    req.message.header.request.magic = PROTOCOL_BINARY_REQ;
    req.message.header.request.opcode = CMD_GET_CLUSTER_CONFIG;
    req.message.header.request.opaque = 0xF00D;

    if (!buf) {
        if ((buf = calloc(1, sizeof(*buf))) == NULL) {
            mcio_error(cccp, LCB_CLIENT_ENOMEM);
            return;
        }
        conn->output = buf;
    }

    if (!ringbuffer_ensure_capacity(buf, sizeof(req.bytes))) {
        mcio_error(cccp, LCB_CLIENT_ENOMEM);
    }

    ringbuffer_write(buf, req.bytes, sizeof(req.bytes));
    lcb_sockrw_set_want(conn, LCB_WRITE_EVENT, 1);
    lcb_sockrw_apply_want(conn);
    lcb_timer_rearm(cccp->timer, PROVIDER_SETTING(&cccp->base,
                                                  config_node_timeout));
}

clconfig_provider * lcb_clconfig_create_cccp(lcb_confmon *mon)
{
    cccp_provider *cccp = calloc(1, sizeof(*cccp));
    cccp->nodes = hostlist_create();
    cccp->base.type = LCB_CLCONFIG_CCCP;
    cccp->base.refresh = cccp_get;
    cccp->base.get_cached = cccp_get_cached;
    cccp->base.pause = cccp_pause;
    cccp->base.shutdown = cccp_cleanup;
    cccp->base.nodes_updated = nodes_updated;
    cccp->base.parent = mon;
    cccp->base.enabled = 0;
    cccp->timer = lcb_timer_create_simple(mon->settings->io,
                                          cccp,
                                          mon->settings->config_timeout,
                                          socket_timeout);
    lcb_timer_disarm(cccp->timer);

    if (!cccp->nodes) {
        free(cccp);
        return NULL;
    }

    if (lcb_connection_init(&cccp->connection,
                            cccp->base.parent->settings->io,
                            cccp->base.parent->settings) != LCB_SUCCESS) {
        free(cccp);
        return NULL;
    }

    return &cccp->base;
}
