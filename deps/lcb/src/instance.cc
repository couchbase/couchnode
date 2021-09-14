/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2020 Couchbase, Inc.
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
#include "collections.h"
#include "auth-priv.h"
#include "connspec.h"
#include "logging.h"
#include "hostlist.h"
#include "rnd.h"
#include "http/http.h"
#include "bucketconfig/clconfig.h"
#include "metrics/caching_meter.hh"
#ifdef LCB_USE_HDR_HISTOGRAM
#include "metrics/logging_meter.hh"
#endif
#include <lcbio/iotable.h>
#include <lcbio/ssl.h>
#include "defer.h"

#define LOGARGS(obj, lvl) (obj)->settings, "instance", LCB_LOG_##lvl, __FILE__, __LINE__

using namespace lcb;

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_create(lcb_CREATEOPTS **options, lcb_INSTANCE_TYPE type)
{
    *options = (lcb_CREATEOPTS *)calloc(1, sizeof(lcb_CREATEOPTS));
    (*options)->type = type;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_destroy(lcb_CREATEOPTS *options)
{
    free(options);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_connstr(lcb_CREATEOPTS *options, const char *connstr, size_t connstr_len)
{
    options->connstr = connstr;
    options->connstr_len = connstr_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_bucket(lcb_CREATEOPTS *options, const char *bucket, size_t bucket_len)
{
    options->bucket = bucket;
    options->bucket_len = bucket_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_logger(lcb_CREATEOPTS *options, const lcb_LOGGER *logger)
{
    options->logger = logger;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_credentials(lcb_CREATEOPTS *options, const char *username,
                                                       size_t username_len, const char *password, size_t password_len)
{
    options->username = username;
    options->username_len = username_len;
    options->password = password;
    options->password_len = password_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_authenticator(lcb_CREATEOPTS *options, lcb_AUTHENTICATOR *auth)
{
    options->auth = auth;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_io(lcb_CREATEOPTS *options, struct lcb_io_opt_st *io)
{
    options->io = io;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_tracer(lcb_CREATEOPTS *options, struct lcbtrace_TRACER *tracer)
{
    options->tracer = tracer;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_meter(lcb_CREATEOPTS *options, const lcbmetrics_METER *meter)
{
    options->meter = meter;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
const char *lcb_get_version(lcb_uint32_t *version)
{
    if (version != nullptr) {
        *version = (lcb_uint32_t)LCB_VERSION;
    }

    return LCB_VERSION_STRING;
}

const lcb_U32 lcb_version_g = LCB_VERSION;

LIBCOUCHBASE_API
void lcb_set_cookie(lcb_INSTANCE *instance, const void *cookie)
{
    instance->cookie = cookie;
}

LIBCOUCHBASE_API
const void *lcb_get_cookie(lcb_INSTANCE *instance)
{
    return instance->cookie;
}

LIBCOUCHBASE_API
void lcb_set_auth(lcb_INSTANCE *instance, lcb_AUTHENTICATOR *auth)
{
    if (LCBT_SETTING(instance, keypath)) {
        lcb_log(LOGARGS(instance, WARN),
                "Custom authenticator ignored when SSL client certificate authentication in use");
        return;
    }
    /* First increase refcount in case they are the same object(!) */
    lcbauth_ref(auth);
    lcbauth_unref(instance->settings->auth);
    instance->settings->auth = auth;
}

void lcb_st::add_bs_host(const char *host, int port, unsigned bstype)
{
    const char *tname = nullptr;
    lcb::Hostlist *target;
    if (bstype == LCB_CONFIG_TRANSPORT_CCCP) {
        tname = "CCCP";
        target = mc_nodes;
    } else {
        tname = "HTTP";
        target = ht_nodes;
    }
    bool ipv6 = strchr(host, ':') != nullptr;
    lcb_log(LOGARGS(this, DEBUG), "Adding host " LCB_LOG_SPEC("%s%s%s:%d") " to initial %s bootstrap list",
            this->settings->log_redaction ? LCB_LOG_SD_OTAG : "", ipv6 ? "[" : "", host, ipv6 ? "]" : "", port,
            this->settings->log_redaction ? LCB_LOG_SD_CTAG : "", tname);
    target->add(host, port);
}

void lcb_st::add_bs_host(const lcb::Spechost &host, int defl_http, int defl_cccp)
{
    if (host.isTypeless()) {
        add_bs_host(host.hostname.c_str(), defl_http, LCB_CONFIG_TRANSPORT_HTTP);
        add_bs_host(host.hostname.c_str(), defl_cccp, LCB_CONFIG_TRANSPORT_CCCP);
        return;
    } else {
        add_bs_host(host.hostname.c_str(), host.port,
                    host.isAnyHttp() ? LCB_CONFIG_TRANSPORT_HTTP : LCB_CONFIG_TRANSPORT_CCCP);
    }
}

void lcb_st::populate_nodes(const Connspec &spec)
{
    int has_ssl = settings->sslopts & LCB_SSL_ENABLED;
    int defl_http, defl_cccp;

    if (spec.default_port() == LCB_CONFIG_MCCOMPAT_PORT) {
        defl_http = -1;
        defl_cccp = LCB_CONFIG_MCCOMPAT_PORT;

    } else if (has_ssl) {
        defl_http = LCB_CONFIG_HTTP_SSL_PORT;
        defl_cccp = LCB_CONFIG_MCD_SSL_PORT;
    } else {
        defl_http = LCB_CONFIG_HTTP_PORT;
        defl_cccp = LCB_CONFIG_MCD_PORT;
    }

    for (const auto &dh : spec.hosts()) {
        add_bs_host(dh, defl_http, defl_cccp);
    }
    lcb_log(LOGARGS(this, TRACE), "Bootstrap hosts loaded (cccp:%d, http:%d)", (int)mc_nodes->size(),
            (int)ht_nodes->size());
}

lcb_STATUS lcb_st::process_dns_srv(Connspec &spec)
{
    if (!spec.can_dnssrv()) {
        return LCB_SUCCESS;
    }
    if (spec.hosts().empty()) {
        lcb_log(LOGARGS(this, ERR), "Cannot use DNS SRV without a hostname");
        return spec.is_explicit_dnssrv() ? LCB_ERR_INVALID_ARGUMENT : LCB_SUCCESS;
    }

    const Spechost &host = spec.hosts().front();
    lcb_STATUS rc = LCB_ERR_SDK_INTERNAL;
    Hostlist *hl = dnssrv_getbslist(host.hostname.c_str(), spec.sslopts() & LCB_SSL_ENABLED, rc);

    if (hl == nullptr) {
        lcb_log(LOGARGS(this, INFO), "DNS SRV lookup failed: %s. Ignore this if not relying on DNS SRV records",
                lcb_strerror_short(rc));
        if (spec.is_explicit_dnssrv()) {
            return rc;
        } else {
            return LCB_SUCCESS;
        }
    }

    spec.clear_hosts();
    for (size_t ii = 0; ii < hl->size(); ++ii) {
        const lcb_host_t &src = (*hl)[ii];
        Spechost sh;
        sh.hostname = src.host;
        char *end = nullptr;
        errno = 0;
        long val = std::strtol(src.port, &end, 10);
        if (errno == ERANGE || end == src.port) {
            sh.port = 0;
        } else {
            sh.port = static_cast<std::uint16_t>(val);
        }
        sh.type = spec.default_port();
        spec.add_host(sh);
        bool ipv6 = sh.hostname.find(':') != std::string::npos;
        lcb_log(LOGARGS(this, INFO), "Found host %s%s%s:%d via DNS SRV", ipv6 ? "[" : "", sh.hostname.c_str(),
                ipv6 ? "]" : "", (int)sh.port);
    }
    delete hl;

    return LCB_SUCCESS;
}

static lcb_STATUS init_providers(lcb_INSTANCE *obj, const Connspec &spec)
{
    using namespace lcb::clconfig;
    Provider *http, *cccp, *mcraw;
    http = obj->confmon->get_provider(CLCONFIG_HTTP);
    cccp = obj->confmon->get_provider(CLCONFIG_CCCP);
    mcraw = obj->confmon->get_provider(CLCONFIG_MCRAW);

    if (spec.default_port() == LCB_CONFIG_MCCOMPAT_PORT) {
        obj->confmon->set_active(CLCONFIG_MCRAW, true);
        mcraw->configure_nodes(*obj->mc_nodes);
        return LCB_SUCCESS;
    }

    bool cccp_found = spec.is_bs_cccp();
    bool http_found = spec.is_bs_http();
    bool cccp_enabled = true, http_enabled = true;

    if (spec.is_bs_file()) {
        cccp_found = false;
        http_found = false;
    }

    if (cccp_found || http_found || spec.is_bs_file()) {
        http_enabled = http_found;
        cccp_enabled = cccp_found;
    }

    if (lcb_getenv_boolean("LCB_NO_CCCP")) {
        cccp_enabled = false;
    }
    if (lcb_getenv_boolean("LCB_NO_HTTP")) {
        http_enabled = false;
    }

    if (cccp_enabled == 0 && http_enabled == 0) {
        if (spec.is_bs_file()) {
            /* If the 'file_only' provider is set, just assume something else
             * will provide us with the config, and forget about it. */
            Provider *prov = obj->confmon->get_provider(CLCONFIG_FILE);
            if (prov && prov->enabled) {
                return LCB_SUCCESS;
            }
        }
        if (obj->settings->conntype == LCB_TYPE_CLUSTER) {
            /* Cluster-level connection always falls back to static config */
            Provider *cladmin;
            cladmin = obj->confmon->get_provider(CLCONFIG_CLADMIN);
            cladmin->enable();
            cladmin->configure_nodes(*obj->ht_nodes);
        } else {
            return LCB_ERR_BAD_ENVIRONMENT;
        }
    }

    if (http_enabled) {
        http->enable();
        http->configure_nodes(*obj->ht_nodes);
    } else {
        obj->confmon->set_active(CLCONFIG_HTTP, false);
    }

    if (cccp_enabled) {
        cccp->enable(obj);
        cccp->configure_nodes(*obj->mc_nodes);
    } else {
        obj->confmon->set_active(CLCONFIG_CCCP, false);
    }
    return LCB_SUCCESS;
}

static lcb_STATUS setup_ssl(lcb_INSTANCE *obj, const Connspec &params)
{
    char optbuf[4096];
    long env_policy = -1;
    lcb_settings *settings = obj->settings;
    lcb_STATUS err = LCB_SUCCESS;

    if (lcb_getenv_nonempty("LCB_SSL_CACERT", optbuf, sizeof optbuf)) {
        lcb_log(LOGARGS(obj, INFO), "SSL CA certificate %s specified on environment", optbuf);
        settings->certpath = lcb_strdup(optbuf);
    }

    if (lcb_getenv_nonempty("LCB_SSL_KEY", optbuf, sizeof optbuf)) {
        lcb_log(LOGARGS(obj, INFO), "SSL key %s specified on environment", optbuf);
        settings->keypath = lcb_strdup(optbuf);
    }

    if (lcb_getenv_nonempty("LCB_SSL_MODE", optbuf, sizeof optbuf)) {
        char *end = nullptr;
        errno = 0;
        env_policy = std::strtol(optbuf, &end, 10);
        if (errno == ERANGE || optbuf == end) {
            lcb_log(LOGARGS(obj, ERR), "Invalid value for environment LCB_SSL. (%s)", optbuf);
            return LCB_ERR_BAD_ENVIRONMENT;
        }
        lcb_log(LOGARGS(obj, INFO), "SSL modified from environment. Policy is 0x%lx", env_policy);
        settings->sslopts = env_policy;
    }

    if (settings->truststorepath == nullptr && !params.truststorepath().empty()) {
        settings->truststorepath = lcb_strdup(params.truststorepath().c_str());
    }

    if (settings->certpath == nullptr && !params.certpath().empty()) {
        settings->certpath = lcb_strdup(params.certpath().c_str());
    }

    if (settings->keypath == nullptr && !params.keypath().empty()) {
        settings->keypath = lcb_strdup(params.keypath().c_str());
    }

    if (env_policy == -1) {
        settings->sslopts = params.sslopts();
    }

    if (settings->sslopts & LCB_SSL_ENABLED) {
        if (!(settings->sslopts & LCB_SSL_NOGLOBALINIT)) {
            lcbio_ssl_global_init();
        } else {
            lcb_log(LOGARGS(obj, INFO), "ssl=no_global_init. Not initializing openssl globals");
        }
        if (settings->keypath && !settings->certpath) {
            lcb_log(LOGARGS(obj, ERR), "SSL key have to be specified with certificate");
            return LCB_ERR_INVALID_ARGUMENT;
        }
        settings->ssl_ctx = lcbio_ssl_new(settings->truststorepath, settings->certpath, settings->keypath,
                                          settings->sslopts & LCB_SSL_NOVERIFY, &err, settings);
        if (!settings->ssl_ctx) {
            return err;
        }
    } else {
        // keypath might be used to flag, that library is using SSL authentication
        // To avoid skipping other authentication mechanisms, cleanup the keypath.
        free(settings->keypath);
        settings->keypath = nullptr;
    }
    return LCB_SUCCESS;
}

static lcb_STATUS apply_spec_options(lcb_INSTANCE *obj, const Connspec &params)
{
    lcb_STATUS err;
    for (const auto &ii : params.options()) {
        lcb_log(LOGARGS(obj, DEBUG), "Applying initial cntl %s=%s", ii.first.c_str(), ii.second.c_str());

        err = lcb_cntl_string(obj, ii.first.c_str(), ii.second.c_str());
        if (err != LCB_SUCCESS) {
            return err;
        }
    }
    return LCB_SUCCESS;
}

static lcb_STATUS apply_env_options(lcb_INSTANCE *obj)
{
    Connspec tmpspec;
    const char *options = getenv("LCB_OPTIONS");

    if (!options) {
        return LCB_SUCCESS;
    }

    std::string tmp("couchbase://?");
    tmp.append(options);
    if (tmpspec.parse(tmp.c_str(), tmp.size()) != LCB_SUCCESS) {
        return LCB_ERR_BAD_ENVIRONMENT;
    }
    return apply_spec_options(obj, tmpspec);
}

lcb_STATUS lcb_reinit(lcb_INSTANCE *obj, const char *connstr)
{
    Connspec params;
    lcb_STATUS err;
    const char *errmsg = nullptr;
    err = params.parse(connstr, strlen(connstr), &errmsg);

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(obj, ERROR), "Couldn't reinit: %s", errmsg);
    }

    if (params.sslopts() != LCBT_SETTING(obj, sslopts) || !params.certpath().empty()) {
        lcb_log(LOGARGS(obj, WARN), "Ignoring SSL reinit options");
    }

    /* apply the options */
    err = apply_spec_options(obj, params);
    if (err != LCB_SUCCESS) {
        goto GT_DONE;
    }
    obj->populate_nodes(params);
    err = init_providers(obj, params);
    if (err != LCB_SUCCESS) {
        goto GT_DONE;
    }

GT_DONE:
    return err;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_create(lcb_INSTANCE **instance, const lcb_CREATEOPTS *options)
{
    Connspec spec;
    struct lcb_io_opt_st *io_priv = nullptr;
    lcb_INSTANCE_TYPE type = LCB_TYPE_BUCKET;
    lcb_INSTANCE *obj = nullptr;
    lcb_STATUS err;
    lcb_settings *settings;

    if (options) {
        io_priv = options->io;
        type = options->type;
        err = spec.load(*options);
    } else {
        const char *errmsg;
        const char *default_connstr = "couchbase://";
        err = spec.parse(default_connstr, strlen(default_connstr), &errmsg);
    }
    if (err != LCB_SUCCESS) {
        goto GT_DONE;
    }

    if ((obj = (lcb_INSTANCE *)calloc(1, sizeof(*obj))) == nullptr) {
        err = LCB_ERR_NO_MEMORY;
        goto GT_DONE;
    }
    obj->crypto = new std::map<std::string, lcbcrypto_PROVIDER *>();
    obj->deferred_operations = new std::list<std::function<void(lcb_STATUS)>>();
    if (!(settings = lcb_settings_new())) {
        err = LCB_ERR_NO_MEMORY;
        goto GT_DONE;
    }

    /* initialize the settings */
    obj->settings = settings;
    obj->settings->conntype = type;
    obj->settings->ipv6 = spec.ipv6_policy();

    if (spec.bucket().empty()) {
        if (type == LCB_TYPE_BUCKET) {
            settings->bucket = lcb_strdup("default");
        }
    } else {
        settings->bucket = lcb_strdup(spec.bucket().c_str());
    }

    if (!spec.username().empty()) {
        settings->auth->set_mode(LCBAUTH_MODE_RBAC);
        err = settings->auth->add(spec.username(), spec.password(), LCBAUTH_F_CLUSTER);
    } else {
        if (type == LCB_TYPE_BUCKET) {
            settings->auth->set_mode(LCBAUTH_MODE_CLASSIC);
            err = settings->auth->add(settings->bucket, spec.password(), LCBAUTH_F_BUCKET);
        }
    }
    if (err != LCB_SUCCESS) {
        goto GT_DONE;
    }

    settings->logger = spec.logger();
    if (settings->logger == nullptr) {
        settings->logger = lcb_init_console_logger();
    }
    settings->iid = lcb_next_rand64();
    if (spec.loglevel()) {
        lcb_U32 val = spec.loglevel();
        lcb_cntl(obj, LCB_CNTL_SET, LCB_CNTL_CONLOGGER_LEVEL, &val);
    }
    settings->log_redaction = spec.logredact();
    if (settings->log_redaction) {
        lcb_log(LOGARGS(obj, INFO), "Logging redaction enabled. Logs have reduced identifying information. Diagnosis "
                                    "and support of issues may be challenging or not possible in this configuration");
    }

    lcb_log(LOGARGS(obj, INFO), "Version=%s, Changeset=%s", lcb_get_version(nullptr), LCB_VERSION_CHANGESET);
    lcb_log(LOGARGS(obj, INFO), "Effective connection string: " LCB_LOG_SPEC("%s") ". Bucket=" LCB_LOG_SPEC("%s"),
            settings->log_redaction ? LCB_LOG_SD_OTAG : "", spec.connstr().c_str(),
            settings->log_redaction ? LCB_LOG_SD_CTAG : "", settings->log_redaction ? LCB_LOG_MD_OTAG : "",
            settings->bucket, settings->log_redaction ? LCB_LOG_MD_CTAG : "");

    if (io_priv == nullptr) {
        lcb_io_opt_t ops;
        if ((err = lcb_create_io_ops(&ops, nullptr)) != LCB_SUCCESS) {
            goto GT_DONE;
        }
        io_priv = ops;
        LCB_IOPS_BASEFLD(io_priv, need_cleanup) = 1;
    }

    obj->cmdq.cqdata = obj;
    obj->iotable = lcbio_table_new(io_priv);
    obj->memd_sockpool = new io::Pool(settings, obj->iotable);
    obj->http_sockpool = new io::Pool(settings, obj->iotable);

    {
        // Needs its own scope because there are prior GOTOs
        io::Pool::Options pool_opts;
        pool_opts.maxidle = 1;
        pool_opts.tmoidle = LCB_MS2US(10000); // 10 seconds
        obj->memd_sockpool->set_options(pool_opts);
        obj->http_sockpool->set_options(pool_opts);
    }

    obj->confmon = new clconfig::Confmon(settings, obj->iotable, obj);
    obj->ht_nodes = new Hostlist();
    obj->mc_nodes = new Hostlist();
    obj->retryq = new RetryQueue(&obj->cmdq, obj->iotable, obj->settings);
    obj->n1ql_cache = lcb_n1qlcache_create();
    lcb_initialize_packet_handlers(obj);
    lcb_aspend_init(&obj->pendops);
    obj->collcache = new lcb::CollectionCache();

    if ((err = setup_ssl(obj, spec)) != LCB_SUCCESS) {
        goto GT_DONE;
    }

    if ((err = apply_spec_options(obj, spec)) != LCB_SUCCESS) {
        goto GT_DONE;
    }
    if ((err = apply_env_options(obj)) != LCB_SUCCESS) {
        goto GT_DONE;
    }

    if ((err = obj->process_dns_srv(spec)) != LCB_SUCCESS) {
        goto GT_DONE;
    }

    obj->populate_nodes(spec);
    if ((err = init_providers(obj, spec)) != LCB_SUCCESS) {
        goto GT_DONE;
    }
    if (settings->use_tracing) {
        if (options && options->tracer) {
            settings->tracer = options->tracer;
        } else {
            settings->tracer = lcbtrace_new(obj, LCBTRACE_F_THRESHOLD);
        }
    }
    if (options && options->meter) {
        settings->meter = (new lcb::metrics::CachingMeter(options->meter))->wrap();
#ifdef LCB_USE_HDR_HISTOGRAM
    } else {
        settings->meter = (new lcb::metrics::LoggingMeter(obj))->wrap();
#endif
    }

    obj->last_error = err;
GT_DONE:
    if (err != LCB_SUCCESS && obj) {
        lcb_destroy(obj);
        *instance = nullptr;
    } else {
        *instance = obj;
    }
    return err;
}

LIBCOUCHBASE_API
int lcb_is_redacting_logs(lcb_INSTANCE *instance)
{
    return instance && instance->settings && instance->settings->log_redaction;
}

typedef struct {
    lcbio_pTABLE table;
    lcbio_pTIMER timer;
    int stopped;
} SYNCDTOR;

static void sync_dtor_cb(void *arg)
{
    auto *sd = (SYNCDTOR *)arg;
    if (sd->table->refcount == 2) {
        lcbio_timer_destroy(sd->timer);
        IOT_STOP(sd->table);
        sd->stopped = 1;
    }
}

extern "C" {
void lcbdur_destroy(void *);
}

static void do_pool_shutdown(io::Pool *pool)
{
    pool->shutdown();
}

LIBCOUCHBASE_API
void lcb_destroy(lcb_INSTANCE *instance)
{
    instance->destroying = 1;
#define DESTROY(fn, fld)                                                                                               \
    if (instance->fld) {                                                                                               \
        fn(instance->fld);                                                                                             \
        instance->fld = nullptr;                                                                                       \
    }

    lcb_ASPEND *po = &instance->pendops;
    lcb_ASPEND_SETTYPE::iterator it;
    lcb_ASPEND_SETTYPE *pendq;

    DESTROY(delete, bs_state)
    DESTROY(delete, ht_nodes)
    DESTROY(delete, mc_nodes)

    lcb::cancel_deferred_operations(instance);
    delete instance->deferred_operations;

    if ((pendq = po->items[LCB_PENDTYPE_DURABILITY])) {
        std::vector<void *> dsets(pendq->begin(), pendq->end());
        for (auto &dset : dsets) {
            lcbdur_destroy(dset);
        }
        pendq->clear();
    }

    for (size_t ii = 0; ii < LCBT_NSERVERS(instance); ++ii) {
        instance->get_server(ii)->close();
    }

    if ((pendq = po->items[LCB_PENDTYPE_HTTP])) {
        std::vector<void *> requests(pendq->begin(), pendq->end());
        for (void *request : requests) {
            auto *htreq = reinterpret_cast<http::Request *>(request);
            htreq->finish(LCB_ERR_REQUEST_CANCELED);
        }
    }

    DESTROY(delete, retryq)
    DESTROY(delete, confmon)
    DESTROY(do_pool_shutdown, memd_sockpool)
    DESTROY(do_pool_shutdown, http_sockpool)
    DESTROY(lcb_vbguess_destroy, vbguess)
    DESTROY(lcb_n1qlcache_destroy, n1ql_cache)

    if (instance->cmdq.pipelines) {
        unsigned ii;
        for (ii = 0; ii < instance->cmdq.npipelines; ii++) {
            auto *server = static_cast<lcb::Server *>(instance->cmdq.pipelines[ii]);
            if (server) {
                server->instance = nullptr;
                server->parent = nullptr;
            }
        }
    }
    mcreq_queue_cleanup(&instance->cmdq);
    DESTROY(delete, collcache)
    if (instance->cur_configinfo) {
        instance->cur_configinfo->decref();
        instance->cur_configinfo = nullptr;
    }
    instance->cmdq.config = nullptr;
    instance->cmdq.cqdata = nullptr;
    lcb_aspend_cleanup(po);

    if (instance->settings && instance->settings->tracer) {
        lcbtrace_destroy(instance->settings->tracer);
        instance->settings->tracer = nullptr;
    }

    if (instance->iotable && instance->iotable->refcount > 1 && instance->settings && instance->settings->syncdtor) {
        /* create an async object */
        SYNCDTOR sd;
        sd.table = instance->iotable;
        sd.timer = lcbio_timer_new(instance->iotable, &sd, sync_dtor_cb);
        sd.stopped = 0;
        lcbio_async_signal(sd.timer);
        lcb_log(LOGARGS(instance, WARN), "Running event loop to drain any pending I/O events");
        do {
            IOT_START(instance->iotable);
        } while (!sd.stopped);
    }

    // Once we are done destroying the instance, we need to manually disconnect
    // the logger from the settings since further work may proceed in the background
    // with some forms of IO backend, but once lcb_destroy is invoked, the logger
    // may no longer be valid from the application side.
    if (instance->settings && instance->settings->logger) {
        instance->settings->logger = nullptr;
    }

    DESTROY(lcbio_table_unref, iotable)
    DESTROY(lcb_settings_unref, settings)
    DESTROY(lcb_histogram_destroy, kv_timings)
    if (instance->scratch) {
        delete instance->scratch;
        instance->scratch = nullptr;
    }

    for (auto &ii : *instance->crypto) {
        lcbcrypto_unref(ii.second);
    }
    delete instance->crypto;
    instance->crypto = nullptr;

    delete[] instance->dcpinfo;
    memset(instance, 0xff, sizeof(*instance));
    free(instance);
#undef DESTROY
}

static void destroy_cb(void *arg)
{
    auto *instance = static_cast<lcb_INSTANCE *>(arg);
    lcbio_timer_destroy(instance->dtor_timer);
    lcb_destroy(instance);
}

LIBCOUCHBASE_API
void lcb_destroy_async(lcb_INSTANCE *instance, const void *arg)
{
    instance->dtor_timer = lcbio_timer_new(instance->iotable, instance, destroy_cb);
    instance->settings->dtorarg = (void *)arg;
    lcbio_async_signal(instance->dtor_timer);
}

lcb::Server *lcb_st::find_server(const lcb_host_t &host) const
{
    unsigned ii;
    for (ii = 0; ii < cmdq.npipelines; ii++) {
        auto *server = static_cast<lcb::Server *>(cmdq.pipelines[ii]);
        if (server && server->has_valid_host() && lcb_host_equals(&server->get_host(), &host)) {
            return server;
        }
    }
    return nullptr;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_connect(lcb_INSTANCE *instance)
{
    return instance->bootstrap(BS_REFRESH_INITIAL);
}

LIBCOUCHBASE_API
lcb_STATUS lcb_open(lcb_INSTANCE *instance, const char *bucket, size_t bucket_len)
{
    if (bucket == nullptr) {
        lcb_log(LOGARGS(instance, ERR), "Bucket name cannot be a nullptr, sorry");
        return LCB_ERR_INVALID_ARGUMENT;
    }
    lcbvb_CONFIG *cfg = LCBT_VBCONFIG(instance);
    if (cfg == nullptr) {
        lcb_log(LOGARGS(instance, ERR),
                "The instance wasn't not bootstrapped, unable to associate it with bucket, sorry");
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (LCBVB_BUCKET_NAME(cfg)) {
        lcb_log(LOGARGS(instance, ERR), "The instance has been associated with the bucket already, sorry");
        return LCB_ERR_INVALID_ARGUMENT;
    }
    instance->settings->conntype = LCB_TYPE_BUCKET;
    instance->settings->bucket = (char *)calloc(bucket_len + 1, sizeof(char));
    memcpy(instance->settings->bucket, bucket, bucket_len);
    for (unsigned ii = 0; ii < instance->cmdq.npipelines; ii++) {
        auto *server = static_cast<lcb::Server *>(instance->cmdq.pipelines[ii]);
        if (!server->selected_bucket && server->connctx) {
            lcb::MemcachedRequest req(PROTOCOL_BINARY_CMD_SELECT_BUCKET);
            req.opaque(0xcafe);
            req.sizes(0, bucket_len, 0);
            lcbio_ctx_put(server->connctx, req.data(), req.size());
            server->bucket.assign(bucket, bucket_len);
            lcbio_ctx_put(server->connctx, bucket, bucket_len);
            server->flush();
        }
    }

    return instance->bootstrap(BS_REFRESH_OPEN_BUCKET);
}

LIBCOUCHBASE_API
void *lcb_mem_alloc(lcb_size_t size)
{
    return malloc(size);
}

LIBCOUCHBASE_API
void lcb_mem_free(void *ptr)
{
    free(ptr);
}

LCB_INTERNAL_API
void lcb_run_loop(lcb_INSTANCE *instance)
{
    IOT_START(instance->iotable);
}

LCB_INTERNAL_API
void lcb_stop_loop(lcb_INSTANCE *instance)
{
    IOT_STOP(instance->iotable);
}

void lcb_aspend_init(lcb_ASPEND *ops)
{
    unsigned ii;
    for (ii = 0; ii < LCB_PENDTYPE_MAX; ++ii) {
        ops->items[ii] = new lcb_ASPEND_SETTYPE();
    }
    ops->count = 0;
}

void lcb_aspend_add(lcb_ASPEND *ops, lcb_ASPENDTYPE type, const void *item)
{
    ops->count++;
    if (type == LCB_PENDTYPE_COUNTER) {
        return;
    }
    ops->items[type]->insert(const_cast<void *>(item));
}

void lcb_aspend_del(lcb_ASPEND *ops, lcb_ASPENDTYPE type, const void *item)
{
    if (type == LCB_PENDTYPE_COUNTER) {
        ops->count--;
        return;
    }
    if (ops->items[type]->erase(const_cast<void *>(item)) != 0) {
        ops->count--;
    }
}

void lcb_aspend_cleanup(lcb_ASPEND *ops)
{
    unsigned ii;
    for (ii = 0; ii < LCB_PENDTYPE_MAX; ii++) {
        delete ops->items[ii];
    }
}

LIBCOUCHBASE_API
void lcb_sched_enter(lcb_INSTANCE *instance)
{
    mcreq_sched_enter(&instance->cmdq);
}
LIBCOUCHBASE_API
void lcb_sched_leave(lcb_INSTANCE *instance)
{
    mcreq_sched_leave(&instance->cmdq, LCBT_SETTING(instance, sched_implicit_flush));
}
LIBCOUCHBASE_API
void lcb_sched_fail(lcb_INSTANCE *instance)
{
    mcreq_sched_fail(&instance->cmdq);
}

LIBCOUCHBASE_API
int lcb_supports_feature(int n)
{
    if (n == LCB_SUPPORTS_TRACING) {
        return 1;
    }
    if (n == LCB_SUPPORTS_SNAPPY) {
        return 1;
    }
    if (n == LCB_SUPPORTS_SSL) {
        return lcbio_ssl_supported();
    } else {
        return 0;
    }
}

LCB_INTERNAL_API void lcb_loop_ref(lcb_INSTANCE *instance)
{
    lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, nullptr);
}
LCB_INTERNAL_API void lcb_loop_unref(lcb_INSTANCE *instance)
{
    lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    lcb_maybe_breakout(instance);
}

LCB_INTERNAL_API uint32_t lcb_durability_timeout(lcb_INSTANCE *instance, uint32_t tmo_us)
{
    if (tmo_us == 0) {
        tmo_us = instance->settings->operation_timeout;
    }
    if (tmo_us < instance->settings->persistence_timeout_floor) {
        lcb_log(LOGARGS(instance, WARN), "Durability timeout is too low (%uus), using %uus instead", tmo_us,
                instance->settings->persistence_timeout_floor);
        tmo_us = instance->settings->persistence_timeout_floor;
    }
    return tmo_us / 1000 * 0.9;
}

static bool is_valid_collection_char(char ch)
{
    if (ch >= 'A' && ch <= 'Z') {
        return true;
    }
    if (ch >= 'a' && ch <= 'z') {
        return true;
    }
    if (ch >= '0' && ch <= '9') {
        return true;
    }
    switch (ch) {
        case '_':
        case '-':
        case '%':
            return true;
        default:
            return false;
    }
}

static bool is_valid_collection_element(const char *element, size_t element_len)
{
    if (element_len == 0 || element == nullptr) {
        /* nullptr/0 for collection is mapped to default collection */
        return true;
    }
    if (element_len < 1 || element_len > 30 || element == nullptr) {
        return false;
    }
    for (size_t i = 0; i < element_len; ++i) {
        if (!is_valid_collection_char(element[i])) {
            return false;
        }
    }
    return true;
}

static bool is_default_collection_element(const char *element, size_t element_len)
{
    static const std::string default_name("_default");
    if (element_len == 0 || element == nullptr || default_name.compare(0, element_len, element) == 0) {
        return true;
    }
    return false;
}

LCB_INTERNAL_API lcb_STATUS lcb_is_collection_valid(lcb_INSTANCE *instance, const char *scope, size_t scope_len,
                                                    const char *collection, size_t collection_len)
{
    if (!LCBT_SETTING(instance, use_collections) && !(is_default_collection_element(scope, scope_len) &&
                                                      is_default_collection_element(collection, collection_len))) {
        /* only allow default collection when collections disabled for the instance */
        return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }
    if (is_valid_collection_element(scope, scope_len) && is_valid_collection_element(collection, collection_len)) {
        return LCB_SUCCESS;
    }
    return LCB_ERR_INVALID_ARGUMENT;
}

LCB_INTERNAL_API lcb_STATUS lcb_is_collection_valid(lcb_INSTANCE *instance, const std::string &scope,
                                                    const std::string &collection)
{
    return lcb_is_collection_valid(instance, scope.c_str(), scope.size(), collection.c_str(), collection.size());
}

LIBCOUCHBASE_API
lcb_STATUS lcb_enable_timings(lcb_INSTANCE *instance)
{
    if (instance->kv_timings != nullptr) {
        return LCB_ERR_DOCUMENT_EXISTS;
    }
    instance->kv_timings = lcb_histogram_create();
    return instance->kv_timings == nullptr ? LCB_ERR_NO_MEMORY : LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_disable_timings(lcb_INSTANCE *instance)
{
    if (instance->kv_timings == nullptr) {
        return LCB_ERR_DOCUMENT_NOT_FOUND;
    }
    lcb_histogram_destroy(instance->kv_timings);
    instance->kv_timings = nullptr;
    return LCB_SUCCESS;
}

typedef struct {
    lcb_INSTANCE *instance;
    const void *real_cookie;
    lcb_timings_callback real_cb;
} timings_wrapper;

static void timings_wrapper_callback(const void *cookie, lcb_timeunit_t unit, lcb_U32 start, lcb_U32 end, lcb_U32 val,
                                     lcb_U32 max)
{
    const auto *wrap = (const timings_wrapper *)cookie;
    wrap->real_cb(wrap->instance, wrap->real_cookie, unit, start, end, val, max);
}

LIBCOUCHBASE_API
lcb_STATUS lcb_get_timings(lcb_INSTANCE *instance, const void *cookie, lcb_timings_callback cb)
{
    timings_wrapper wrap;
    wrap.instance = instance;
    wrap.real_cookie = cookie;
    wrap.real_cb = cb;

    if (!instance->kv_timings) {
        return LCB_ERR_DOCUMENT_NOT_FOUND;
    }
    lcb_histogram_read(instance->kv_timings, &wrap, timings_wrapper_callback);
    return LCB_SUCCESS;
}

LCB_INTERNAL_API
const char *lcb_strerror_short(lcb_STATUS error)
{
#define X(c, v, t, f, s)                                                                                               \
    if (error == c) {                                                                                                  \
        return #c " (" #v ")";                                                                                         \
    }
    LCB_XERROR(X)
#undef X
    return "<FIXME: Not an LCB error>";
}

LCB_INTERNAL_API
const char *lcb_strerror_long(lcb_STATUS error)
{
#define X(c, v, t, f, s)                                                                                               \
    if (error == c) {                                                                                                  \
        return #c " (" #v "): " s;                                                                                     \
    }
    LCB_XERROR(X)
#undef X
    return "<FIXME: Not an LCB error>";
}

LIBCOUCHBASE_API
uint32_t lcb_error_flags(lcb_STATUS err)
{
#define X(c, v, t, f, s)                                                                                               \
    if (err == c) {                                                                                                    \
        return (uint32_t)f;                                                                                            \
    }
    LCB_XERROR(X)
#undef X
    return 0;
}
