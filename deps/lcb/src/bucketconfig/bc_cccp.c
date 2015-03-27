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
#include <mcserver/negotiate.h>
#include <lcbio/lcbio.h>
#include <lcbio/timer-ng.h>
#include <lcbio/ssl.h>
#include "ctx-log-inl.h"
#define LOGARGS(cccp, lvl) cccp->base.parent->settings, "cccp", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGFMT "<%s:%s> "
#define LOGID(cccp) get_ctx_host(cccp->ioctx), get_ctx_port(cccp->ioctx)

struct cccp_cookie_st;

typedef struct {
    clconfig_provider base;
    hostlist_t nodes;
    clconfig_info *config;
    int server_active;
    int disabled;
    lcbio_pTIMER timer;
    lcb_t instance;
    lcbio_CONNREQ creq;
    lcbio_CTX *ioctx;
    struct cccp_cookie_st *cmdcookie;
} cccp_provider;

typedef struct cccp_cookie_st {
    /** Parent object */
    cccp_provider *parent;

    /** Whether to ignore errors on this cookie object */
    int ignore_errors;
} cccp_cookie;

static void io_error_handler(lcbio_CTX *, lcb_error_t);
static void io_read_handler(lcbio_CTX *, unsigned nr);
static void request_config(cccp_provider *);
static void on_connected(lcbio_SOCKET *, void*, lcb_error_t, lcbio_OSERR);

static void
pooled_close_cb(lcbio_SOCKET *sock, int reusable, void *arg)
{
    int *ru_ex = arg;
    lcbio_ref(sock);
    if (reusable && *ru_ex) {
        lcbio_mgr_put(sock);
    } else {
        lcbio_mgr_discard(sock);
    }
}

static void release_socket(cccp_provider *cccp, int can_reuse)
{
    if (cccp->cmdcookie) {
        cccp->cmdcookie->ignore_errors = 1;
        cccp->cmdcookie =  NULL;
        return;
    }

    lcbio_connreq_cancel(&cccp->creq);

    if (cccp->ioctx) {
        lcbio_ctx_close(cccp->ioctx, pooled_close_cb, &can_reuse);
        cccp->ioctx = NULL;
    }
}

static lcb_error_t
schedule_next_request(cccp_provider *cccp, lcb_error_t err, int can_rollover)
{
    mc_SERVER *server;
    lcb_host_t *next_host = hostlist_shift_next(cccp->nodes, can_rollover);
    if (!next_host) {
        lcbio_timer_disarm(cccp->timer);
        lcb_confmon_provider_failed(&cccp->base, err);
        cccp->server_active = 0;
        return err;
    }

    server = lcb_find_server_by_host(cccp->instance, next_host);
    if (server) {
        cccp_cookie *cookie = calloc(1, sizeof(*cookie));
        cccp->cmdcookie = cookie;
        cookie->parent = cccp;
        lcb_log(LOGARGS(cccp, INFO), "Re-Issuing CCCP Command on server struct %p (%s:%s)", (void*)server, next_host->host, next_host->port);
        lcbio_timer_rearm(
                cccp->timer, PROVIDER_SETTING(&cccp->base, config_node_timeout));
        return lcb_getconfig(cccp->instance, cookie, server);

    } else {
        lcbio_pMGRREQ preq;

        lcb_log(LOGARGS(cccp, INFO), "Requesting connection to node %s:%s for CCCP configuration", next_host->host, next_host->port);
        preq = lcbio_mgr_get(
                cccp->instance->memd_sockpool, next_host,
                PROVIDER_SETTING(&cccp->base, config_node_timeout),
                on_connected, cccp);
        LCBIO_CONNREQ_MKPOOLED(&cccp->creq, preq);
    }

    cccp->server_active = 1;
    return LCB_SUCCESS;
}

static lcb_error_t mcio_error(cccp_provider *cccp, lcb_error_t err)
{
    if (err != LCB_NOT_SUPPORTED && err != LCB_UNKNOWN_COMMAND) {
        lcb_log(LOGARGS(cccp, ERR), LOGFMT "Got I/O Error=0x%x", LOGID(cccp), err);
    }

    release_socket(cccp, err == LCB_NOT_SUPPORTED);
    return schedule_next_request(cccp, err, 0);
}

static void socket_timeout(void *arg)
{
    cccp_provider *cccp = arg;
    mcio_error(cccp, LCB_ETIMEDOUT);
}

void lcb_clconfig_cccp_enable(clconfig_provider *pb, lcb_t instance)
{
    cccp_provider *cccp = (cccp_provider *)pb;
    lcb_assert(pb->type == LCB_CLCONFIG_CCCP);
    cccp->instance = instance;
    pb->enabled = 1;
}

static hostlist_t get_nodes(const clconfig_provider *pb)
{
    return ((cccp_provider *)pb)->nodes;
}

/** Update the configuration from a server. */
lcb_error_t lcb_cccp_update(clconfig_provider *provider,
                            const char *host,
                            lcb_string *data)
{
    /** TODO: replace this with lcbvb_ names */

    lcbvb_CONFIG* vbc;
    int rv;
    clconfig_info *new_config;
    cccp_provider *cccp = (cccp_provider *)provider;
    vbc = lcbvb_create();

    if (!vbc) {
        return LCB_CLIENT_ENOMEM;
    }
    rv = lcbvb_load_json(vbc, data->base);

    if (rv) {
        lcbvb_destroy(vbc);
        return LCB_PROTOCOL_ERROR;
    }

    lcbvb_replace_host(vbc, host);
    new_config = lcb_clconfig_create(vbc, LCB_CLCONFIG_CCCP);

    if (!new_config) {
        lcbvb_destroy(vbc);
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

    if (ck == cccp->cmdcookie) {
        lcbio_timer_disarm(cccp->timer);
        cccp->cmdcookie = NULL;
    }

    if (err == LCB_SUCCESS) {
        lcb_string ss;

        lcb_string_init(&ss);
        lcb_string_append(&ss, bytes, nbytes);
        err = lcb_cccp_update(&cccp->base, origin->host, &ss);
        lcb_string_release(&ss);
    }

    if (err != LCB_SUCCESS && ck->ignore_errors == 0) {
        mcio_error(cccp, err);
    }

    free(ck);
}

static void
on_connected(lcbio_SOCKET *sock, void *data, lcb_error_t err, lcbio_OSERR syserr)
{
    lcbio_CTXPROCS ioprocs;
    cccp_provider *cccp = data;
    lcb_settings *settings = cccp->base.parent->settings;

    LCBIO_CONNREQ_CLEAR(&cccp->creq);
    if (err != LCB_SUCCESS) {
        if (sock) {
            lcbio_mgr_discard(sock);
        }
        mcio_error(cccp, err);
        return;
    }

    if (lcbio_protoctx_get(sock, LCBIO_PROTOCTX_SESSINFO) == NULL) {
        mc_pSESSREQ sreq;
        sreq = mc_sessreq_start(
                sock, settings, settings->config_node_timeout, on_connected,
                cccp);
        LCBIO_CONNREQ_MKGENERIC(&cccp->creq, sreq, mc_sessreq_cancel);
        return;
    }

    ioprocs.cb_err = io_error_handler;
    ioprocs.cb_read = io_read_handler;
    cccp->ioctx = lcbio_ctx_new(sock, data, &ioprocs);
    cccp->ioctx->subsys = "bc_cccp";
    request_config(cccp);

    (void)syserr;
}

static lcb_error_t cccp_get(clconfig_provider *pb)
{
    cccp_provider *cccp = (cccp_provider *)pb;
    if (cccp->creq.u.p_generic || cccp->server_active || cccp->cmdcookie) {
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
    lcbio_timer_disarm(cccp->timer);
    return LCB_SUCCESS;
}

static void cccp_cleanup(clconfig_provider *pb)
{
    cccp_provider *cccp = (cccp_provider *)pb;

    release_socket(cccp, 0);
    if (cccp->config) {
        lcb_clconfig_decref(cccp->config);
    }
    if (cccp->nodes) {
        hostlist_destroy(cccp->nodes);
    }
    if (cccp->timer) {
        lcbio_timer_destroy(cccp->timer);
    }
    if (cccp->cmdcookie) {
        cccp->cmdcookie->ignore_errors = 1;
    }
    free(cccp);
}

static void
configure_nodes(clconfig_provider *pb, const hostlist_t nodes)
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

static void
config_updated(clconfig_provider *provider, lcbvb_CONFIG* vbc)
{
    unsigned ii;
    lcbvb_SVCMODE mode;
    cccp_provider *cccp = (cccp_provider *)provider;
    if (LCBVB_NSERVERS(vbc) < 1) {
        return;
    }

    hostlist_clear(cccp->nodes);
    if (PROVIDER_SETTING(provider, sslopts) & LCB_SSL_ENABLED) {
        mode = LCBVB_SVCMODE_SSL;
    } else {
        mode = LCBVB_SVCMODE_PLAIN;
    }
    for (ii = 0; ii < LCBVB_NSERVERS(vbc); ii++) {
        const char *mcaddr = lcbvb_get_hostport(vbc,
            ii, LCBVB_SVCTYPE_DATA, mode);
        if (!mcaddr) {
            lcb_log(LOGARGS(cccp, DEBUG), "Node %d has no data service", ii);
            continue;
        }
        hostlist_add_stringz(cccp->nodes, mcaddr, LCB_CONFIG_MCD_PORT);
    }

    if (PROVIDER_SETTING(provider, randomize_bootstrap_nodes)) {
        hostlist_randomize(cccp->nodes);
    }
}

static void
io_error_handler(lcbio_CTX *ctx, lcb_error_t err)
{
    cccp_provider *cccp = lcbio_ctx_data(ctx);
    mcio_error(cccp, err);
}

static void
io_read_handler(lcbio_CTX *ioctx, unsigned nr)
{
    packet_info pi;
    cccp_provider *cccp = lcbio_ctx_data(ioctx);
    lcb_string jsonstr;
    lcb_error_t err;
    int rv;
    unsigned required;
    lcb_host_t curhost;

    (void)nr;

#define return_error(e) \
    lcb_pktinfo_ectx_done(&pi, ioctx); \
    mcio_error(cccp, e); \
    return

    memset(&pi, 0, sizeof(pi));
    rv = lcb_pktinfo_ectx_get(&pi, ioctx, &required);
    if (!rv) {
        lcbio_ctx_rwant(ioctx, required);
        lcbio_ctx_schedule(ioctx);
        return;
    }

    if (PACKET_STATUS(&pi) != PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        lcb_log(LOGARGS(cccp, WARN), LOGFMT "CCCP Packet responded with 0x%x; nkey=%d, nbytes=%lu, cmd=0x%x, seq=0x%x", LOGID(cccp),
                PACKET_STATUS(&pi), PACKET_NKEY(&pi), (unsigned long)PACKET_NBODY(&pi),
                PACKET_OPCODE(&pi), PACKET_OPAQUE(&pi));

        switch (PACKET_STATUS(&pi)) {
        case PROTOCOL_BINARY_RESPONSE_NOT_SUPPORTED:
        case PROTOCOL_BINARY_RESPONSE_UNKNOWN_COMMAND:
            return_error(LCB_NOT_SUPPORTED);
        default:
            return_error(LCB_PROTOCOL_ERROR);
        }

        return;
    }

    if (!PACKET_NBODY(&pi)) {
        return_error(LCB_PROTOCOL_ERROR);
    }

    if (lcb_string_init(&jsonstr)) {
        return_error(LCB_CLIENT_ENOMEM);
    }

    if (lcb_string_append(&jsonstr, PACKET_BODY(&pi), PACKET_NBODY(&pi))) {
        return_error(LCB_CLIENT_ENOMEM);
    }

    curhost = *lcbio_get_host(lcbio_ctx_sock(ioctx));
    lcb_pktinfo_ectx_done(&pi, ioctx);
    release_socket(cccp, 1);

    err = lcb_cccp_update(&cccp->base, curhost.host, &jsonstr);
    lcb_string_release(&jsonstr);
    if (err == LCB_SUCCESS) {
        lcbio_timer_disarm(cccp->timer);
        cccp->server_active = 0;
    } else {
        schedule_next_request(cccp, LCB_PROTOCOL_ERROR, 0);
    }

#undef return_error
}

static void request_config(cccp_provider *cccp)
{
    protocol_binary_request_set_cluster_config req;
    memset(&req, 0, sizeof(req));
    req.message.header.request.magic = PROTOCOL_BINARY_REQ;
    req.message.header.request.opcode = PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG;
    req.message.header.request.opaque = 0xF00D;
    lcbio_ctx_put(cccp->ioctx, req.bytes, sizeof(req.bytes));
    lcbio_ctx_rwant(cccp->ioctx, 24);
    lcbio_ctx_schedule(cccp->ioctx);
    lcbio_timer_rearm(cccp->timer, PROVIDER_SETTING(&cccp->base, config_node_timeout));
}

static void do_dump(clconfig_provider *pb, FILE *fp)
{
    cccp_provider *cccp = (cccp_provider *)pb;
    unsigned ii;

    if (!cccp->base.enabled) {
        return;
    }

    fprintf(fp, "## BEGIN CCCP PROVIDER DUMP ##\n");
    fprintf(fp, "TIMER ACTIVE: %s\n", lcbio_timer_armed(cccp->timer) ? "YES" : "NO");
    fprintf(fp, "PIPELINE RESPONSE COOKIE: %p\n", (void*)cccp->cmdcookie);
    if (cccp->ioctx) {
        fprintf(fp, "CCCP Owns connection:\n");
        lcbio_ctx_dump(cccp->ioctx, fp);
    } else if (cccp->creq.u.p_generic) {
        fprintf(fp, "CCCP Is connecting\n");
    } else {
        fprintf(fp, "CCCP does not have a dedicated connection\n");
    }

    for (ii = 0; ii < cccp->nodes->nentries; ii++) {
        const lcb_host_t *curhost = &cccp->nodes->entries[ii];
        fprintf(fp, "CCCP NODE: %s:%s\n", curhost->host, curhost->port);
    }
    fprintf(fp, "## END CCCP PROVIDER DUMP ##\n");
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
    cccp->base.config_updated = config_updated;
    cccp->base.configure_nodes = configure_nodes;
    cccp->base.get_nodes = get_nodes;
    cccp->base.dump = do_dump;
    cccp->base.parent = mon;
    cccp->base.enabled = 0;
    cccp->timer = lcbio_timer_new(mon->iot, cccp, socket_timeout);

    if (!cccp->nodes) {
        free(cccp);
        return NULL;
    }
    return &cccp->base;
}
