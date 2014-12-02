/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2013 Couchbase, Inc.
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
#include "connspec.h"
#include "logging.h"
#include "hostlist.h"
#include "http/http.h"
#include "bucketconfig/clconfig.h"
#include <lcbio/iotable.h>
#include <lcbio/ssl.h>
#define LOGARGS(obj,lvl) (obj)->settings, "instance", LCB_LOG_##lvl, __FILE__, __LINE__

static volatile unsigned int lcb_instance_index = 0;

LIBCOUCHBASE_API
const char *lcb_get_version(lcb_uint32_t *version)
{
    if (version != NULL) {
        *version = (lcb_uint32_t)LCB_VERSION;
    }

    return LCB_VERSION_STRING;
}

LIBCOUCHBASE_API
void lcb_set_cookie(lcb_t instance, const void *cookie)
{
    instance->cookie = cookie;
}

LIBCOUCHBASE_API
const void *lcb_get_cookie(lcb_t instance)
{
    return instance->cookie;
}

static void
add_and_log_host(lcb_t obj, const lcb_host_t *host, lcb_config_transport_t type)
{
    const char *typename = NULL;
    hostlist_t target;
    if (type == LCB_CONFIG_TRANSPORT_CCCP) {
        typename = "CCCP";
        target = obj->mc_nodes;
    } else {
        typename = "HTTP";
        target = obj->ht_nodes;
    }
    lcb_log(LOGARGS(obj, DEBUG), "Adding host %s:%s to initial %s bootstrap list", host->host, host->port, typename);
    hostlist_add_host(target, host);
}

static void
populate_nodes(lcb_t obj, const lcb_CONNSPEC *spec)
{
    lcb_list_t *llcur;
    int has_ssl = obj->settings->sslopts & LCB_SSL_ENABLED;
    int defl_http, defl_cccp;

    if (spec->implicit_port == LCB_CONFIG_MCCOMPAT_PORT) {
        defl_http = -1;
        defl_cccp = LCB_CONFIG_MCCOMPAT_PORT;

    } else if (has_ssl) {
        defl_http = LCB_CONFIG_HTTP_SSL_PORT;
        defl_cccp = LCB_CONFIG_MCD_SSL_PORT;
    } else {
        defl_http = LCB_CONFIG_HTTP_PORT;
        defl_cccp = LCB_CONFIG_MCD_PORT;
    }

    LCB_LIST_FOR(llcur, &spec->hosts) {
        lcb_host_t host;
        const lcb_HOSTSPEC *dh = LCB_LIST_ITEM(llcur, lcb_HOSTSPEC, llnode);
        strcpy(host.host, dh->hostname);

        #define ADD_CCCP() add_and_log_host(obj, &host, LCB_CONFIG_TRANSPORT_CCCP)
        #define ADD_HTTP() add_and_log_host(obj, &host, LCB_CONFIG_TRANSPORT_HTTP)

        /* if we didn't specify any port in the spec, just use the simple
         * default port (based on the SSL settings) */
        if (dh->type == 0) {
            sprintf(host.port, "%d", defl_http);
            ADD_HTTP();
            sprintf(host.port, "%d", defl_cccp);
            ADD_CCCP();
            continue;
        } else {
            sprintf(host.port, "%d", dh->port);
            switch (dh->type) {
            case LCB_CONFIG_MCD_PORT:
            case LCB_CONFIG_MCD_SSL_PORT:
            case LCB_CONFIG_MCCOMPAT_PORT:
                ADD_CCCP();
                break;
            case LCB_CONFIG_HTTP_PORT:
            case LCB_CONFIG_HTTP_SSL_PORT:
                ADD_HTTP();
                break;
            default:
                break;
            }
        }
    }
#undef ADD_HTTP
#undef ADD_CCCP
}

static lcb_error_t
init_providers(lcb_t obj, const lcb_CONNSPEC *spec)
{
    int http_enabled = 1, cccp_enabled = 1, cccp_found = 0, http_found = 0;
    const lcb_config_transport_t *cur;
    clconfig_provider *http, *cccp, *mcraw;

    http = lcb_confmon_get_provider(obj->confmon, LCB_CLCONFIG_HTTP);
    cccp = lcb_confmon_get_provider(obj->confmon, LCB_CLCONFIG_CCCP);
    mcraw = lcb_confmon_get_provider(obj->confmon, LCB_CLCONFIG_MCRAW);

    if (spec->implicit_port == LCB_CONFIG_MCCOMPAT_PORT) {
        lcb_confmon_set_provider_active(obj->confmon, LCB_CLCONFIG_MCRAW, 1);
        mcraw->configure_nodes(mcraw, obj->mc_nodes);
        return LCB_SUCCESS;
    }

    for (cur = spec->transports; *cur != LCB_CONFIG_TRANSPORT_LIST_END; cur++) {
        if (*cur == LCB_CONFIG_TRANSPORT_CCCP) {
            cccp_found = 1;
        } else if (*cur == LCB_CONFIG_TRANSPORT_HTTP) {
            http_found = 1;
        } else {
            return LCB_EINVAL;
        }
    }
    if (http_found || cccp_found) {
        cccp_enabled = cccp_found;
        http_enabled = http_found;
    }

    if (lcb_getenv_boolean("LCB_NO_CCCP")) {
        cccp_enabled = 0;
    }

    if (lcb_getenv_boolean("LCB_NO_HTTP")) {
        http_enabled = 0;
    }

    /* The only way we can get to here is if one of the vars are set */
    if (cccp_enabled == 0 && http_enabled == 0) {
        return LCB_BAD_ENVIRONMENT;
    }

    if (http_enabled) {
        lcb_clconfig_http_enable(http);
        lcb_clconfig_http_set_nodes(http, obj->ht_nodes);
    } else {
        lcb_confmon_set_provider_active(obj->confmon, LCB_CLCONFIG_HTTP, 0);
    }

    if (cccp_enabled && obj->type != LCB_TYPE_CLUSTER) {
        lcb_clconfig_cccp_enable(cccp, obj);
        lcb_clconfig_cccp_set_nodes(cccp, obj->mc_nodes);
    } else {
        lcb_confmon_set_provider_active(obj->confmon, LCB_CLCONFIG_CCCP, 0);
    }
    return LCB_SUCCESS;
}

static lcb_error_t
setup_ssl(lcb_t obj, lcb_CONNSPEC *params)
{
    char optbuf[4096];
    int env_policy = -1;
    lcb_settings *settings = obj->settings;
    lcb_error_t err = LCB_SUCCESS;

    if (lcb_getenv_nonempty("LCB_SSL_CACERT", optbuf, sizeof optbuf)) {
        lcb_log(LOGARGS(obj, INFO), "SSL CA certificate %s specified on environment", optbuf);
        settings->certpath = strdup(optbuf);
    }

    if (lcb_getenv_nonempty("LCB_SSL_MODE", optbuf, sizeof optbuf)) {
        if (sscanf(optbuf, "%d", &env_policy) != 1) {
            lcb_log(LOGARGS(obj, ERR), "Invalid value for environment LCB_SSL. (%s)", optbuf);
            return LCB_BAD_ENVIRONMENT;
        } else {
            lcb_log(LOGARGS(obj, INFO), "SSL modified from environment. Policy is 0x%x", env_policy);
            settings->sslopts = env_policy;
        }
    }

    if (settings->certpath == NULL && params->certpath && *params->certpath) {
        settings->certpath = params->certpath; params->certpath = NULL;
    }

    if (env_policy == -1) {
        settings->sslopts = params->sslopts;
    }

    if (settings->sslopts & LCB_SSL_ENABLED) {
        lcbio_ssl_global_init();
        settings->ssl_ctx = lcbio_ssl_new(settings->certpath,
            settings->sslopts & LCB_SSL_NOVERIFY, &err, settings);
        if (!settings->ssl_ctx) {
            return err;
        }
    }
    return LCB_SUCCESS;
}

static lcb_error_t
apply_spec_options(lcb_t obj, lcb_CONNSPEC *params)
{
    const char *key, *value;
    int itmp = 0;
    lcb_error_t err;
    while ((lcb_connspec_next_option(params, &key, &value, &itmp))) {
        lcb_log(LOGARGS(obj, DEBUG), "Applying initial cntl %s=%s", key, value);
        err = lcb_cntl_string(obj, key, value);
        if (err != LCB_SUCCESS) {
            return err;
        }
    }
    return LCB_SUCCESS;
}

static lcb_error_t
apply_env_options(lcb_t obj)
{
    lcb_string tmpstr;
    lcb_CONNSPEC tmpspec;
    lcb_error_t err;
    const char *errmsg = NULL;
    const char *options = getenv("LCB_OPTIONS");

    if (!options) {
        return LCB_SUCCESS;
    }

    memset(&tmpspec, 0, sizeof tmpspec);
    lcb_string_init(&tmpstr);
    lcb_string_appendz(&tmpstr, "couchbase://?");
    lcb_string_appendz(&tmpstr, options);
    err = lcb_connspec_parse(tmpstr.base, &tmpspec, &errmsg);
    if (err != LCB_SUCCESS) {
        err = LCB_BAD_ENVIRONMENT;
        goto GT_DONE;
    }
    err = apply_spec_options(obj, &tmpspec);
    if (err != LCB_SUCCESS) {
        err = LCB_BAD_ENVIRONMENT;
    }

    GT_DONE:
    lcb_string_release(&tmpstr);
    lcb_connspec_clean(&tmpspec);
    return err;

}

lcb_error_t
lcb_init_providers2(lcb_t obj, const struct lcb_create_st2 *options)
{
    lcb_CONNSPEC params;
    lcb_error_t err;
    struct lcb_create_st cropts;
    cropts.version = 2;
    cropts.v.v2 = *options;
    err = lcb_connspec_convert(&params, &cropts);
    if (err == LCB_SUCCESS) {
        err = init_providers(obj, &params);
    }
    lcb_connspec_clean(&params);
    return err;
}

lcb_error_t
lcb_reinit3(lcb_t obj, const char *connstr)
{
    lcb_CONNSPEC params;
    lcb_error_t err;
    const char *errmsg = NULL;
    memset(&params, 0, sizeof params);
    err = lcb_connspec_parse(connstr, &params, &errmsg);

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(obj, ERROR), "Couldn't reinit: %s", errmsg);
    }

    if (params.sslopts != LCBT_SETTING(obj, sslopts) || params.certpath) {
        lcb_log(LOGARGS(obj, WARN), "Ignoring SSL reinit options");
    }

    /* apply the options */
    err = apply_spec_options(obj, &params);
    if (err != LCB_SUCCESS) {
        goto GT_DONE;
    }

    populate_nodes(obj, &params);
    err = init_providers(obj, &params);
    if (err != LCB_SUCCESS) {
        goto GT_DONE;
    }

    GT_DONE:
    lcb_connspec_clean(&params);
    return err;
}

LIBCOUCHBASE_API
lcb_error_t lcb_create(lcb_t *instance,
                       const struct lcb_create_st *options)
{
    lcb_CONNSPEC spec = { NULL };
    struct lcb_io_opt_st *io_priv = NULL;
    lcb_type_t type = LCB_TYPE_BUCKET;
    lcb_t obj = NULL;
    lcb_error_t err;
    lcb_settings *settings;

    if (options) {
        io_priv = options->v.v0.io;
        if (options->version > 0) {
            type = options->v.v1.type;
        }
        err = lcb_connspec_convert(&spec, options);
    } else {
        const char *errmsg;
        err = lcb_connspec_parse("couchbase://", &spec, &errmsg);
    }
    if (err != LCB_SUCCESS) {
        goto GT_DONE;
    }

    if ((obj = calloc(1, sizeof(*obj))) == NULL) {
        err = LCB_CLIENT_ENOMEM;
        goto GT_DONE;
    }
    if (!(settings = lcb_settings_new())) {
        err = LCB_CLIENT_ENOMEM;
        goto GT_DONE;
    }

    /* initialize the settings */
    obj->type = type;
    obj->settings = settings;
    settings->bucket = spec.bucket; spec.bucket = NULL;
    settings->username = spec.username; spec.username = NULL;
    settings->password = spec.password; spec.password = NULL;
    settings->logger = lcb_init_console_logger();
    settings->iid = lcb_instance_index++;
    if (spec.loglevel) {
        lcb_U32 val = spec.loglevel;
        lcb_cntl(obj, LCB_CNTL_SET, LCB_CNTL_CONLOGGER_LEVEL, &val);
    }

    lcb_log(LOGARGS(obj, INFO), "Version=%s, Changeset=%s", lcb_get_version(NULL), LCB_VERSION_CHANGESET);
    lcb_log(LOGARGS(obj, INFO), "Effective connection string: %s. Bucket=%s", options && options->version >= 3 ? options->v.v3.connstr : spec.connstr, settings->bucket);

    /* Do not allow people use Administrator account for data access */
    if (type == LCB_TYPE_BUCKET && settings->username) {
        if (strcmp(settings->username, settings->bucket) != 0) {
            err = LCB_INVALID_USERNAME;
            goto GT_DONE;
        }
    }

    if (io_priv == NULL) {
        lcb_io_opt_t ops;
        if ((err = lcb_create_io_ops(&ops, NULL)) != LCB_SUCCESS) {
            goto GT_DONE;
        }
        io_priv = ops;
        io_priv->v.v0.need_cleanup = 1;
    }

    obj->cmdq.cqdata = obj;
    obj->iotable = lcbio_table_new(io_priv);
    obj->memd_sockpool = lcbio_mgr_create(settings, obj->iotable);
    obj->http_sockpool = lcbio_mgr_create(settings, obj->iotable);
    obj->memd_sockpool->maxidle = 1;
    obj->memd_sockpool->tmoidle = 10000000;
    obj->http_sockpool->maxidle = 1;
    obj->http_sockpool->tmoidle = 10000000;
    obj->confmon = lcb_confmon_create(settings, obj->iotable);
    obj->ht_nodes = hostlist_create();
    obj->mc_nodes = hostlist_create();
    obj->retryq = lcb_retryq_new(&obj->cmdq, obj->iotable, obj->settings);
    lcb_initialize_packet_handlers(obj);
    lcb_aspend_init(&obj->pendops);

    if ((err = setup_ssl(obj, &spec)) != LCB_SUCCESS) {
        goto GT_DONE;
    }

    if ((err = apply_spec_options(obj, &spec)) != LCB_SUCCESS) {
        goto GT_DONE;
    }
    if ((err = apply_env_options(obj)) != LCB_SUCCESS) {
        goto GT_DONE;
    }

    populate_nodes(obj, &spec);
    err = init_providers(obj, &spec);
    if (err != LCB_SUCCESS) {
        lcb_destroy(obj);
        return err;
    }

    obj->last_error = err;
    GT_DONE:
    lcb_connspec_clean(&spec);
    if (err != LCB_SUCCESS && obj) {
        lcb_destroy(obj);
        *instance = NULL;
    } else {
        *instance = obj;
    }
    return err;
}

typedef struct {
    lcbio_pTABLE table;
    lcbio_pTIMER timer;
    int stopped;
} SYNCDTOR;

static void
sync_dtor_cb(void *arg)
{
    SYNCDTOR *sd = arg;
    if (sd->table->refcount == 2) {
        lcbio_timer_destroy(sd->timer);
        IOT_STOP(sd->table);
        sd->stopped = 1;
    }
}

LIBCOUCHBASE_API
void lcb_destroy(lcb_t instance)
{
    #define DESTROY(fn,fld) if(instance->fld){fn(instance->fld);instance->fld=NULL;}

    lcb_size_t ii;
    hashset_t hs;
    lcb_ASPEND *po = &instance->pendops;

    DESTROY(lcb_clconfig_decref, cur_configinfo);
    instance->cmdq.config = NULL;

    lcb_bootstrap_destroy(instance);
    DESTROY(hostlist_destroy, ht_nodes);
    DESTROY(hostlist_destroy, mc_nodes);
    if ((hs = lcb_aspend_get(po, LCB_PENDTYPE_TIMER))) {
        for (ii = 0; ii < hs->capacity; ++ii) {
            if (hs->items[ii] > 1) {
                lcb__timer_destroy_nowarn(instance, (lcb_timer_t)hs->items[ii]);
            }
        }
    }

    if ((hs = lcb_aspend_get(po, LCB_PENDTYPE_DURABILITY))) {
        struct lcb_DURSET_st **dset_list;
        lcb_size_t nitems = hashset_num_items(hs);
        dset_list = (struct lcb_DURSET_st **)hashset_get_items(hs, NULL);
        if (dset_list) {
            for (ii = 0; ii < nitems; ii++) {
                lcb_durability_dset_destroy(dset_list[ii]);
            }
            free(dset_list);
        }
    }

    for (ii = 0; ii < LCBT_NSERVERS(instance); ++ii) {
        mc_SERVER *server = LCBT_GET_SERVER(instance, ii);
        mcserver_close(server);
    }

    if ((hs = lcb_aspend_get(po, LCB_PENDTYPE_HTTP))) {
        for (ii = 0; ii < hs->capacity; ++ii) {
            if (hs->items[ii] > 1) {
                lcb_http_request_t htreq = (lcb_http_request_t)hs->items[ii];

                /* Prevents lcb's globals from being modified during destruction */
                htreq->status |= LCB_HTREQ_S_NOLCB;
                lcb_http_request_finish(instance, htreq, LCB_ERROR);
            }
        }
    }
    DESTROY(lcb_retryq_destroy, retryq);
    DESTROY(lcb_confmon_destroy, confmon);
    DESTROY(lcbio_mgr_destroy, memd_sockpool);
    DESTROY(lcbio_mgr_destroy, http_sockpool);
    DESTROY(lcb_vbguess_destroy, vbguess);

    mcreq_queue_cleanup(&instance->cmdq);
    lcb_aspend_cleanup(po);

    if (instance->iotable && instance->iotable->refcount > 1 &&
            instance->settings && instance->settings->syncdtor) {
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

    DESTROY(lcbio_table_unref, iotable);
    DESTROY(lcb_settings_unref, settings);
    if (instance->scratch) {
        lcb_string_release(instance->scratch);
        free(instance->scratch);
        instance->scratch = NULL;
    }

    free(instance->histogram);
    memset(instance, 0xff, sizeof(*instance));
    free(instance);
#undef DESTROY
}

static void
destroy_cb(void *arg)
{
    lcb_t instance = arg;
    lcbio_timer_destroy(instance->dtor_timer);
    lcb_destroy(instance);
}

LIBCOUCHBASE_API
void
lcb_destroy_async(lcb_t instance, const void *arg)
{
    instance->dtor_timer = lcbio_timer_new(instance->iotable, instance, destroy_cb);
    instance->settings->dtorarg = (void *)arg;
    lcbio_async_signal(instance->dtor_timer);
}

LIBCOUCHBASE_API
lcb_error_t lcb_connect(lcb_t instance)
{
    lcb_error_t err = lcb_bootstrap_common(instance, LCB_BS_REFRESH_INITIAL);
    if (err == LCB_SUCCESS) {
        SYNCMODE_INTERCEPT(instance);
    } else {
        return err;
    }
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
void lcb_run_loop(lcb_t instance)
{
    IOT_START(instance->iotable);
}

LCB_INTERNAL_API
void lcb_stop_loop(lcb_t instance)
{
    IOT_STOP(instance->iotable);
}

void
lcb_aspend_init(lcb_ASPEND *ops)
{
    unsigned ii;
    for (ii = 0; ii < LCB_PENDTYPE_MAX; ++ii) {
        ops->items[ii] = hashset_create();
    }
    ops->count = 0;
}

void
lcb_aspend_add(lcb_ASPEND *ops, lcb_ASPENDTYPE type, const void *item)
{
    ops->count++;
    if (type == LCB_PENDTYPE_COUNTER) {
        return;
    }
    hashset_add(ops->items[type], (void *)item);
}

void
lcb_aspend_del(lcb_ASPEND *ops, lcb_ASPENDTYPE type, const void *item)
{
    if (type == LCB_PENDTYPE_COUNTER) {
        ops->count--;
        return;
    }
    if (hashset_remove(ops->items[type], (void *)item)) {
        ops->count--;
    }
}

void
lcb_aspend_cleanup(lcb_ASPEND *ops)
{
    unsigned ii;
    for (ii = 0; ii < LCB_PENDTYPE_MAX; ii++) {
        hashset_destroy(ops->items[ii]);
    }
}

LIBCOUCHBASE_API
void
lcb_sched_enter(lcb_t instance)
{
    mcreq_sched_enter(&instance->cmdq);
}
LIBCOUCHBASE_API
void
lcb_sched_leave(lcb_t instance)
{
    mcreq_sched_leave(&instance->cmdq, LCBT_SETTING(instance, sched_implicit_flush));
}
LIBCOUCHBASE_API
void
lcb_sched_fail(lcb_t instance)
{
    mcreq_sched_fail(&instance->cmdq);
}

LIBCOUCHBASE_API
int
lcb_supports_feature(int n)
{
    if (n == LCB_SUPPORTS_SNAPPY) {
#ifdef LCB_NO_SNAPPY
        return 0;
#else
        return 1;
#endif
    }
    if (n == LCB_SUPPORTS_SSL) {
        return lcbio_ssl_supported();
    } else {
        return 0;
    }
}

LIBCOUCHBASE_API
lcb_error_t lcb__create_compat_230(
        lcb_cluster_t type, const void *specific, lcb_t *instance,
        struct lcb_io_opt_st *io)
{
    struct lcb_create_st cst = { 0 };
    const struct lcb_cached_config_st *cfg = specific;
    const struct lcb_create_st *crp = &cfg->createopt;
    lcb_error_t err;
    lcb_size_t to_copy = 0;

    if (type != LCB_CACHED_CONFIG) {
        return LCB_NOT_SUPPORTED;
    }

    if (crp->version == 0) {
        to_copy = sizeof(cst.v.v0);
    } else if (crp->version == 1) {
        to_copy = sizeof(cst.v.v1);
    } else if (crp->version >= 2) {
        to_copy = sizeof(cst.v.v2);
    } else {
        /* using version 3? */
        return LCB_NOT_SUPPORTED;
    }
    memcpy(&cst, crp, to_copy);

    if (io) {
        cst.v.v0.io = io;
    }
    err = lcb_create(instance, &cst);
    if (err != LCB_SUCCESS) {
        return err;
    }
    err = lcb_cntl(*instance, LCB_CNTL_SET, LCB_CNTL_CONFIGCACHE,
                   (void *)cfg->cachefile);
    if (err != LCB_SUCCESS) {
        lcb_destroy(*instance);
    }
    return err;
}
struct compat_220 {
    struct {
        int version;
        struct lcb_create_st1 v1;
    } createopt;
    const char *cachefile;
};

struct compat_230 {
    struct {
        int version;
        struct lcb_create_st2 v2;
    } createopt;
    const char *cachefile;
};

#undef lcb_create_compat
/**
 * This is _only_ called for versions <= 2.3.0.
 * >= 2.3.0 uses the _230() symbol.
 *
 * The big difference between this and the _230 function is the struct layout,
 * where the newer one contains the filename _before_ the creation options.
 *
 * Woe to he who relies on the compat_st as a 'subclass' of create_st..
 */

LIBCOUCHBASE_API
lcb_error_t lcb_create_compat(lcb_cluster_t type,
                               const void *specific,
                               lcb_t *instance,
                               struct lcb_io_opt_st *io);

/* Mute usage of deprecated functions further on .. */
#if defined(__clang__) || __GNUC__ > 4 || (__GNUC__ == 4 && __GNUC_MINOR__ >= 6)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif
LIBCOUCHBASE_API
lcb_error_t lcb_create_compat(lcb_cluster_t type,
                              const void *specific,
                              lcb_t *instance,
                              struct lcb_io_opt_st *io)
{
    struct lcb_cached_config_st dst;
    const struct compat_220* src220 = specific;

    if (type == LCB_MEMCACHED_CLUSTER) {
        return lcb__create_compat_230(type, specific, instance, io);
    } else if (type != LCB_CACHED_CONFIG) {
        return LCB_NOT_SUPPORTED;
    }

#define copy_compat(v) \
    memcpy(&dst.createopt, &v->createopt, sizeof(v->createopt)); \
    dst.cachefile = v->cachefile;

    if (src220->createopt.version >= 2 || src220->cachefile == NULL) {
        const struct compat_230* src230 = specific;
        copy_compat(src230);
    } else {
        copy_compat(src220);
    }
    return lcb__create_compat_230(type, &dst, instance, io);
}

LIBCOUCHBASE_API void lcb_flush_buffers(lcb_t instance, const void *cookie) {
    (void)instance;(void)cookie;
}

LCB_INTERNAL_API void lcb_loop_ref(lcb_t instance) {
    lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
}
LCB_INTERNAL_API void lcb_loop_unref(lcb_t instance) {
    lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
    lcb_maybe_breakout(instance);
}

LIBCOUCHBASE_API
lcb_error_t lcb_get_last_error(lcb_t instance){return instance->last_error;}

LIBCOUCHBASE_API
const char *lcb_strerror(lcb_t instance, lcb_error_t error)
{
    #define X(c, v, t, s) if (error == c) { return s; }
    LCB_XERR(X)
    #undef X

    (void)instance;
    return "Unknown error";
}

LIBCOUCHBASE_API
int lcb_get_errtype(lcb_error_t err)
{
    #define X(c, v, t, s) if (err == c) { return t; }
    LCB_XERR(X)
    #undef X
    return -1;
}

LIBCOUCHBASE_API
lcb_error_t lcb_verify_struct_size(lcb_U32 id, lcb_U32 version, lcb_SIZE size)
{
    #define X(sname, sabbrev, idval, vernum) \
    if (idval == id && size == sizeof(sname) && version <= vernum) { return LCB_SUCCESS; }
    LCB_XSSIZES(X);
    #undef X
    return LCB_EINVAL;
}
