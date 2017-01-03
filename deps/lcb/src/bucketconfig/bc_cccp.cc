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
#define LOGARGS(cccp, lvl) cccp->parent->settings, "cccp", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGFMT "<%s:%s> "
#define LOGID(cccp) get_ctx_host(cccp->ioctx), get_ctx_port(cccp->ioctx)

#define PROVIDER_SETTING_T(fld) PROVIDER_SETTING(this, fld)

struct CccpCookie;

struct CccpProvider : public clconfig_provider {
    CccpProvider(lcb_confmon *);
    ~CccpProvider();

    void release_socket(bool can_reuse);
    lcb_error_t schedule_next_request(lcb_error_t why, bool can_rollover);
    lcb_error_t mcio_error(lcb_error_t why);
    lcb_error_t update(const char *host, const char* data);
    void request_config();
    void on_config_updated(lcbvb_CONFIG *vbc);
    void on_io_read();

    lcb::Hostlist *nodes;
    clconfig_info *config;
    bool server_active;
    lcbio_pTIMER timer;
    lcb_t instance;
    lcbio_CONNREQ creq;
    lcbio_CTX *ioctx;
    CccpCookie *cmdcookie;
};

struct CccpCookie {
    CccpProvider *parent;
    bool ignore_errors;
    CccpCookie(CccpProvider *parent_) : parent(parent_), ignore_errors(false) {
    }
};

static void io_error_handler(lcbio_CTX *, lcb_error_t);
static void io_read_handler(lcbio_CTX *, unsigned nr);
static void on_connected(lcbio_SOCKET *, void*, lcb_error_t, lcbio_OSERR);

static void
pooled_close_cb(lcbio_SOCKET *sock, int reusable, void *arg)
{
    bool *ru_ex = reinterpret_cast<bool*>(arg);
    lcbio_ref(sock);
    if (reusable && *ru_ex) {
        lcbio_mgr_put(sock);
    } else {
        lcbio_mgr_discard(sock);
    }
}

void
CccpProvider::release_socket(bool can_reuse)
{
    if (cmdcookie) {
        cmdcookie->ignore_errors = 1;
        cmdcookie =  NULL;
        return;
    }

    lcbio_connreq_cancel(&creq);

    if (ioctx) {
        lcbio_ctx_close(ioctx, pooled_close_cb, &can_reuse);
        ioctx = NULL;
    }
}

lcb_error_t
CccpProvider::schedule_next_request(lcb_error_t err, bool can_rollover)
{
    lcb::Server *server;
    lcb_host_t *next_host = nodes->next(can_rollover);
    if (!next_host) {
        lcbio_timer_disarm(timer);
        lcb_confmon_provider_failed(this, err);
        server_active = false;
        return err;
    }

    server = lcb_find_server_by_host(instance, next_host);
    if (server) {
        CccpCookie *cookie = new CccpCookie(this);
        cmdcookie = cookie;
        lcb_log(LOGARGS(this, INFO), "Re-Issuing CCCP Command on server struct %p (%s:%s)", (void*)server, next_host->host, next_host->port);
        lcbio_timer_rearm(timer, PROVIDER_SETTING_T(config_node_timeout));
        return lcb_getconfig(instance, cookie, server);

    } else {
        lcbio_pMGRREQ preq;

        lcb_log(LOGARGS(this, INFO), "Requesting connection to node %s:%s for CCCP configuration", next_host->host, next_host->port);
        preq = lcbio_mgr_get(
                instance->memd_sockpool, next_host,
                PROVIDER_SETTING_T(config_node_timeout),
                on_connected, this);
        LCBIO_CONNREQ_MKPOOLED(&creq, preq);
    }

    server_active = true;
    return LCB_SUCCESS;
}

lcb_error_t
CccpProvider::mcio_error(lcb_error_t err)
{
    if (err != LCB_NOT_SUPPORTED && err != LCB_UNKNOWN_COMMAND) {
        lcb_log(LOGARGS(this, ERR), LOGFMT "Got I/O Error=0x%x", LOGID(this), err);
    }

    release_socket(err == LCB_NOT_SUPPORTED);
    return schedule_next_request(err, false);
}

static void socket_timeout(void *arg) {
    reinterpret_cast<CccpProvider*>(arg)->mcio_error(LCB_ETIMEDOUT);
}

void lcb_clconfig_cccp_enable(clconfig_provider *pb, lcb_t instance)
{
    CccpProvider *cccp = static_cast<CccpProvider*>(pb);
    lcb_assert(pb->type == LCB_CLCONFIG_CCCP);
    cccp->instance = instance;
    pb->enabled = true;
}

static hostlist_t get_nodes(const clconfig_provider *pb) {
    return static_cast<const CccpProvider*>(pb)->nodes;
}

/** Update the configuration from a server. */
lcb_error_t
lcb_cccp_update(clconfig_provider *provider, const char *host, const char *data) {
    return static_cast<CccpProvider*>(provider)->update(host, data);
}

lcb_error_t
CccpProvider::update(const char *host, const char *data)
{
    /** TODO: replace this with lcbvb_ names */
    lcbvb_CONFIG* vbc;
    int rv;
    clconfig_info *new_config;
    vbc = lcbvb_create();

    if (!vbc) {
        return LCB_CLIENT_ENOMEM;
    }
    rv = lcbvb_load_json(vbc, data);

    if (rv) {
        lcb_log(LOGARGS(this, ERROR), LOGFMT "Failed to parse config", LOGID(this));
        lcb_log_badconfig(LOGARGS(this, ERROR), vbc, data);
        lcbvb_destroy(vbc);
        return LCB_PROTOCOL_ERROR;
    }

    lcbvb_replace_host(vbc, host);
    new_config = lcb_clconfig_create(vbc, LCB_CLCONFIG_CCCP);

    if (!new_config) {
        lcbvb_destroy(vbc);
        return LCB_CLIENT_ENOMEM;
    }

    if (config) {
        lcb_clconfig_decref(config);
    }

    /** TODO: Figure out the comparison vector */
    new_config->cmpclock = gethrtime();
    config = new_config;
    lcb_confmon_provider_success(this, new_config);
    return LCB_SUCCESS;
}

void lcb_cccp_update2(const void *cookie, lcb_error_t err,
                      const void *bytes, lcb_size_t nbytes,
                      const lcb_host_t *origin)
{
    CccpCookie *ck = reinterpret_cast<CccpCookie*>(const_cast<void*>(cookie));
    CccpProvider *cccp = ck->parent;

    if (ck == cccp->cmdcookie) {
        lcbio_timer_disarm(cccp->timer);
        cccp->cmdcookie = NULL;
    }

    if (err == LCB_SUCCESS) {
        std::string ss(reinterpret_cast<const char *>(bytes), nbytes);
        err = cccp->update(origin->host, ss.c_str());
    }

    if (err != LCB_SUCCESS && ck->ignore_errors == 0) {
        cccp->mcio_error(err);
    }

    free(ck);
}

static void
on_connected(lcbio_SOCKET *sock, void *data, lcb_error_t err, lcbio_OSERR)
{
    lcbio_CTXPROCS ioprocs;
    CccpProvider *cccp = reinterpret_cast<CccpProvider*>(data);
    lcb_settings *settings = cccp->parent->settings;

    LCBIO_CONNREQ_CLEAR(&cccp->creq);
    if (err != LCB_SUCCESS) {
        if (sock) {
            lcbio_mgr_discard(sock);
        }
        cccp->mcio_error(err);
        return;
    }

    if (lcbio_protoctx_get(sock, LCBIO_PROTOCTX_SESSINFO) == NULL) {
        lcb::SessionRequest *sreq = lcb::SessionRequest::start(
                sock, settings, settings->config_node_timeout, on_connected,
                cccp);
        LCBIO_CONNREQ_MKGENERIC(&cccp->creq, sreq, lcb::sessreq_cancel);
        return;
    }

    ioprocs.cb_err = io_error_handler;
    ioprocs.cb_read = io_read_handler;
    cccp->ioctx = lcbio_ctx_new(sock, data, &ioprocs);
    cccp->ioctx->subsys = "bc_cccp";
    cccp->request_config();
}

static lcb_error_t cccp_get(clconfig_provider *pb)
{
    CccpProvider *cccp = static_cast<CccpProvider *>(pb);
    if (cccp->creq.u.p_generic || cccp->server_active || cccp->cmdcookie) {
        return LCB_BUSY;
    }

    return cccp->schedule_next_request(LCB_SUCCESS, true);
}

static clconfig_info *cccp_get_cached(clconfig_provider *pb) {
    return static_cast<CccpProvider *>(pb)->config;
}

static lcb_error_t cccp_pause(clconfig_provider *pb)
{
    CccpProvider *cccp = static_cast<CccpProvider *>(pb);
    if (!cccp->server_active) {
        return LCB_SUCCESS;
    }

    cccp->server_active = 0;
    cccp->release_socket(false);
    lcbio_timer_disarm(cccp->timer);
    return LCB_SUCCESS;
}

static void cccp_cleanup(clconfig_provider *pb) {
    delete static_cast<CccpProvider*>(pb);
}

CccpProvider::~CccpProvider() {
    release_socket(false);

    if (config) {
        lcb_clconfig_decref(config);
    }
    if (nodes) {
        delete nodes;
    }
    if (timer) {
        lcbio_timer_destroy(timer);
    }
    if (cmdcookie) {
        cmdcookie->ignore_errors = 1;
    }
}

static void
configure_nodes(clconfig_provider *pb, const hostlist_t nodes)
{
    CccpProvider *cccp = static_cast<CccpProvider *>(pb);
    cccp->nodes->assign(*nodes);
    if (PROVIDER_SETTING(pb, randomize_bootstrap_nodes)) {
        cccp->nodes->randomize();
    }
}

static void config_updated(clconfig_provider *provider, lcbvb_CONFIG* vbc) {
    static_cast<CccpProvider*>(provider)->on_config_updated(vbc);
}

void
CccpProvider::on_config_updated(lcbvb_CONFIG *vbc)
{
    lcbvb_SVCMODE mode;
    if (LCBVB_NSERVERS(vbc) < 1) {
        return;
    }

    nodes->clear();
    if (PROVIDER_SETTING_T(sslopts) & LCB_SSL_ENABLED) {
        mode = LCBVB_SVCMODE_SSL;
    } else {
        mode = LCBVB_SVCMODE_PLAIN;
    }
    for (size_t ii = 0; ii < LCBVB_NSERVERS(vbc); ii++) {
        const char *mcaddr = lcbvb_get_hostport(vbc,
            ii, LCBVB_SVCTYPE_DATA, mode);
        if (!mcaddr) {
            lcb_log(LOGARGS(this, DEBUG), "Node %lu has no data service", ii);
            continue;
        }
        nodes->add(mcaddr, LCB_CONFIG_MCD_PORT);
    }

    if (PROVIDER_SETTING_T(randomize_bootstrap_nodes)) {
        nodes->randomize();
    }
}

static void
io_error_handler(lcbio_CTX *ctx, lcb_error_t err)
{
    CccpProvider *cccp = reinterpret_cast<CccpProvider*>(lcbio_ctx_data(ctx));
    cccp->mcio_error(err);
}

static void io_read_handler(lcbio_CTX *ioctx, unsigned) {
    reinterpret_cast<CccpProvider*>(lcbio_ctx_data(ioctx))->on_io_read();
}

void
CccpProvider::on_io_read()
{
    unsigned required;

#define return_error(e) \
    resp.release(ioctx); \
    mcio_error(e); \
    return

    lcb::MemcachedResponse resp;
    if (!resp.load(ioctx, &required)) {
        lcbio_ctx_rwant(ioctx, required);
        lcbio_ctx_schedule(ioctx);
        return;
    }

    if (resp.status() != PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        lcb_log(LOGARGS(this, WARN), LOGFMT "CCCP Packet responded with 0x%x; nkey=%d, nbytes=%lu, cmd=0x%x, seq=0x%x", LOGID(this),
                resp.status(), resp.keylen(), (unsigned long)resp.bodylen(),
                resp.opcode(), resp.opaque());

        switch (resp.status()) {
        case PROTOCOL_BINARY_RESPONSE_NOT_SUPPORTED:
        case PROTOCOL_BINARY_RESPONSE_UNKNOWN_COMMAND:
            return_error(LCB_NOT_SUPPORTED);
        default:
            return_error(LCB_PROTOCOL_ERROR);
        }

        return;
    }

    if (!resp.bodylen()) {
        return_error(LCB_PROTOCOL_ERROR);
    }

    std::string jsonstr(resp.body<const char*>(), resp.bodylen());
    std::string hoststr(lcbio_get_host(lcbio_ctx_sock(ioctx))->host);

    resp.release(ioctx);
    release_socket(true);

    lcb_error_t err = update(hoststr.c_str(), jsonstr.c_str());

    if (err == LCB_SUCCESS) {
        lcbio_timer_disarm(timer);
        server_active = false;
    } else {
        schedule_next_request(LCB_PROTOCOL_ERROR, 0);
    }

#undef return_error
}

void CccpProvider::request_config()
{
    lcb::MemcachedRequest req(PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG);
    req.opaque(0xF00D);
    lcbio_ctx_put(ioctx, req.data(), req.size());
    lcbio_ctx_rwant(ioctx, 24);
    lcbio_ctx_schedule(ioctx);
    lcbio_timer_rearm(timer, PROVIDER_SETTING(this, config_node_timeout));
}

static void do_dump(clconfig_provider *pb, FILE *fp)
{
    CccpProvider *cccp = (CccpProvider *)pb;

    if (!cccp->enabled) {
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

    for (size_t ii = 0; ii < cccp->nodes->size(); ii++) {
        const lcb_host_t &curhost = (*cccp->nodes)[ii];
        fprintf(fp, "CCCP NODE: %s:%s\n", curhost.host, curhost.port);
    }
    fprintf(fp, "## END CCCP PROVIDER DUMP ##\n");
}

clconfig_provider * lcb_clconfig_create_cccp(lcb_confmon *mon)
{
    return new CccpProvider(mon);
}

CccpProvider::CccpProvider(lcb_confmon *mon)
    : nodes(new lcb::Hostlist()),
      config(NULL),
      server_active(false),
      timer(NULL),
      instance(NULL),
      ioctx(NULL),
      cmdcookie(NULL)
{
    clconfig_provider::type = LCB_CLCONFIG_CCCP;
    clconfig_provider::refresh = cccp_get;
    clconfig_provider::get_cached = cccp_get_cached;
    clconfig_provider::pause = cccp_pause;
    clconfig_provider::shutdown = cccp_cleanup;
    clconfig_provider::config_updated = ::config_updated;
    clconfig_provider::configure_nodes = ::configure_nodes;
    clconfig_provider::get_nodes = ::get_nodes;
    clconfig_provider::dump = do_dump;
    clconfig_provider::parent = mon;
    clconfig_provider::enabled = 0;

    timer = lcbio_timer_new(mon->iot, this, socket_timeout);
    std::memset(&creq, 0, sizeof creq);
}
