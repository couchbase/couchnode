/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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
#include "bucketconfig/clconfig.h"
#include <lcbio/iotable.h>
#include <mcserver/negotiate.h>
#include <lcbio/ssl.h>

#define CNTL__MODE_SETSTRING 0x1000

/**
 * ioctl/fcntl-like interface for libcouchbase configuration properties
 */

typedef lcb_error_t (*ctl_handler)(int, lcb_t, int, void *);

static int
boolean_from_string(const char *s)
{
    if (!strcmp(s, "true")) {
        return 1;
    } else if (!strcmp(s, "false")) {
        return 0;
    } else {
        return atoi(s);
    }
}

static lcb_uint32_t *get_timeout_field(lcb_t instance, int cmd)
{
    lcb_settings *settings = instance->settings;
    switch (cmd) {

    case LCB_CNTL_OP_TIMEOUT:
        return &settings->operation_timeout;

    case LCB_CNTL_VIEW_TIMEOUT:
        return &settings->views_timeout;

    case LCB_CNTL_DURABILITY_INTERVAL:
        return &settings->durability_interval;

    case LCB_CNTL_DURABILITY_TIMEOUT:
        return &settings->durability_timeout;

    case LCB_CNTL_HTTP_TIMEOUT:
        return &settings->http_timeout;

    case LCB_CNTL_CONFIGURATION_TIMEOUT:
        return &settings->config_timeout;

    case LCB_CNTL_CONFDELAY_THRESH:
        return &settings->weird_things_delay;

    case LCB_CNTL_CONFIG_NODE_TIMEOUT:
        return &settings->config_node_timeout;

    case LCB_CNTL_HTCONFIG_IDLE_TIMEOUT:
        return &settings->bc_http_stream_time;

    default:
        return NULL;
    }
}

static lcb_error_t timeout_common(int mode,
                                  lcb_t instance, int cmd, void *arg)
{
    lcb_uint32_t *ptr;
    lcb_uint32_t *user = arg;

    ptr = get_timeout_field(instance, cmd);
    if (!ptr) {
        return LCB_ECTL_BADARG;
    }
    if (mode == LCB_CNTL_GET) {
        *user = *ptr;
    } else if (mode == CNTL__MODE_SETSTRING) {
        int rv;
        unsigned long tmp;
        rv = sscanf(arg, "%lu", &tmp);
        if (rv != 1) {
            return LCB_ECTL_BADARG;
        }
        *ptr = tmp;
    } else {
        *ptr = *user;
    }
    return LCB_SUCCESS;
}

static lcb_error_t
noop_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    (void)mode;(void)instance;(void)cmd;(void)arg;
    return LCB_SUCCESS;
}

static lcb_error_t get_vbconfig(int mode, lcb_t instance, int cmd, void *arg)
{
    if (mode != LCB_CNTL_GET) {
        return LCB_ECTL_UNSUPPMODE;
    }
    *(VBUCKET_CONFIG_HANDLE *)arg = LCBT_VBCONFIG(instance);

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t get_htype(int mode, lcb_t instance, int cmd, void *arg)
{
    if (mode != LCB_CNTL_GET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    *(lcb_type_t *)arg = instance->type;

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t get_kvb(int mode, lcb_t instance, int cmd, void *arg)
{
    struct lcb_cntl_vbinfo_st *vbi = arg;

    if (mode != LCB_CNTL_GET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    if (!LCBT_VBCONFIG(instance)) {
        return LCB_CLIENT_ETMPFAIL;
    }

    if (vbi->version != 0) {
        return LCB_ECTL_BADARG;
    }

    vbucket_map(LCBT_VBCONFIG(instance),
                vbi->v.v0.key,
                vbi->v.v0.nkey,
                &vbi->v.v0.vbucket,
                &vbi->v.v0.server_index);

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t get_iops(int mode, lcb_t instance, int cmd, void *arg)
{
    if (mode != LCB_CNTL_GET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    *(lcb_io_opt_t *)arg = instance->iotable->p;
    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t conninfo(int mode, lcb_t instance, int cmd, void *arg)
{
    lcbio_SOCKET *sock;
    struct lcb_cntl_server_st *si = arg;
    const lcb_host_t *host;

    if (mode != LCB_CNTL_GET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    if (si->version < 0 || si->version > 1) {
        return LCB_ECTL_BADARG;

    }

    if (cmd == LCB_CNTL_MEMDNODE_INFO) {
        lcb_server_t *server;
        int ix = si->v.v0.index;
        if (ix < 0 || ix > (int)LCBT_NSERVERS(instance)) {
            return LCB_ECTL_BADARG;
        }

        server = LCBT_GET_SERVER(instance, ix);
        if (!server) {
            return LCB_NETWORK_ERROR;
        }

        sock = server->connctx->sock;

        if (si->version == 1 && sock) {
            mc_pSESSINFO sasl = mc_sess_get(server->connctx->sock);
            if (sasl) {
                si->v.v1.sasl_mech = mc_sess_get_saslmech(sasl);
            }
        }


    } else if (cmd == LCB_CNTL_CONFIGNODE_INFO) {
        sock = lcb_confmon_get_rest_connection(instance->confmon);

    } else {
        return LCB_ECTL_BADARG;
    }

    if (!sock) {
        return LCB_SUCCESS;
    }

    host = lcbio_get_host(sock);
    si->v.v0.connected = 1;
    si->v.v0.host = host->host;
    si->v.v0.port = host->port;

    switch (instance->iotable->model) {
    case LCB_IOMODEL_EVENT:
        si->v.v0.sock.sockfd = sock->u.fd;
        break;

    case LCB_IOMODEL_COMPLETION:
        si->v.v0.sock.sockptr = sock->u.sd;
        break;

    default:
        return LCB_ECTL_BADARG;
    }

    return LCB_SUCCESS;
}

static lcb_error_t syncmode(int mode, lcb_t instance, int cmd, void *arg)
{
    (void)mode; (void)instance; (void)cmd; (void)arg;
    return LCB_ECTL_UNKNOWN;
}

static lcb_error_t ippolicy(int mode, lcb_t instance, int cmd, void *arg)
{
    lcb_ipv6_t *user = arg;

    if (mode == LCB_CNTL_SET) {
        instance->settings->ipv6 = *user;
    } else {
        *user = instance->settings->ipv6;
    }

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t confthresh(int mode, lcb_t instance, int cmd, void *arg)
{
    lcb_size_t *user = arg;

    if (mode == LCB_CNTL_SET) {
        instance->settings->weird_things_threshold = *user;
    } else {
        *user = instance->settings->weird_things_threshold;
    }

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t randomize_bootstrap_hosts_handler(int mode,
                                                     lcb_t instance,
                                                     int cmd,
                                                     void *arg)
{
    int *randomize = arg;
    int argval;

    if (mode == CNTL__MODE_SETSTRING) {
        argval = boolean_from_string(arg);
        mode = LCB_CNTL_SET;
    } else {
        argval = *randomize;
    }

    if (cmd != LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS) {
        return LCB_EINTERNAL;
    }

    if (mode == LCB_CNTL_SET) {
        instance->settings->randomize_bootstrap_nodes = argval;
    } else {
        *randomize = instance->settings->randomize_bootstrap_nodes;
    }

    return LCB_SUCCESS;
}

static lcb_error_t config_cache_loaded_handler(int mode,
                                               lcb_t instance,
                                               int cmd,
                                               void *arg)
{
    if (mode != LCB_CNTL_GET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    if (cmd != LCB_CNTL_CONFIG_CACHE_LOADED) {
        return LCB_EINTERNAL;
    }

    *(int *)arg = instance->cur_configinfo &&
            instance->cur_configinfo->origin == LCB_CLCONFIG_FILE;

    return LCB_SUCCESS;
}

static lcb_error_t force_sasl_mech_handler(int mode,
                                           lcb_t instance,
                                           int cmd,
                                           void *arg)
{
    union {
        char *set;
        char **get;
    } u_arg;

    u_arg.set = arg;

    if (mode == LCB_CNTL_SET) {
        free(instance->settings->sasl_mech_force);
        if (u_arg.set) {
            instance->settings->sasl_mech_force = strdup(u_arg.set);
        }
    } else {
        *u_arg.get = instance->settings->sasl_mech_force;
    }

    (void)cmd;

    return LCB_SUCCESS;
}

static lcb_error_t max_redirects(int mode, lcb_t instance, int cmd, void *arg)
{
    int *val = arg;

    if (*val < -1) {
        return LCB_ECTL_BADARG;
    }
    if (mode == LCB_CNTL_SET) {
        instance->settings->max_redir = *val;
    } else {
        *val = instance->settings->max_redir;
    }

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t logprocs_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    if (mode == LCB_CNTL_SET) {
        instance->settings->logger = (lcb_logprocs *)arg;
    } else {
        *(lcb_logprocs**)arg = instance->settings->logger;
    }

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t config_transport(int mode, lcb_t instance, int cmd, void *arg)
{
    lcb_config_transport_t *val = arg;

    if (mode == LCB_CNTL_SET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    if (!instance->cur_configinfo) {
        return LCB_CLIENT_ETMPFAIL;
    }

    switch (instance->cur_configinfo->origin) {
        case LCB_CLCONFIG_HTTP:
            *val = LCB_CONFIG_TRANSPORT_HTTP;
            break;

        case LCB_CLCONFIG_CCCP:
            *val = LCB_CONFIG_TRANSPORT_CCCP;
            break;

        default:
            return LCB_CLIENT_ETMPFAIL;
    }

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t config_nodes(int mode, lcb_t instance, int cmd, void *arg)
{
    const char *node_strs = arg;
    clconfig_provider *target;
    hostlist_t nodes_obj;
    lcb_error_t err;

    if (mode != LCB_CNTL_SET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    nodes_obj = hostlist_create();
    if (!nodes_obj) {
        return LCB_CLIENT_ENOMEM;
    }

    err = hostlist_add_stringz(nodes_obj, node_strs,
                               cmd == LCB_CNTL_CONFIG_HTTP_NODES
                               ? LCB_CONFIG_HTTP_PORT : LCB_CONFIG_MCD_PORT);
    if (err != LCB_SUCCESS) {
        hostlist_destroy(nodes_obj);
        return err;
    }

    if (cmd == LCB_CNTL_CONFIG_HTTP_NODES) {
        target = lcb_confmon_get_provider(instance->confmon, LCB_CLCONFIG_HTTP);
        lcb_clconfig_http_set_nodes(target, nodes_obj);
    } else {
        target = lcb_confmon_get_provider(instance->confmon, LCB_CLCONFIG_CCCP);
        lcb_clconfig_cccp_set_nodes(target, nodes_obj);
    }

    hostlist_destroy(nodes_obj);
    return LCB_SUCCESS;
}

static lcb_error_t get_changeset(int mode, lcb_t instance, int cmd, void *arg)
{
    *(char **)arg = LCB_VERSION_CHANGESET;
    (void)instance;
    (void)mode;
    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t init_providers(int mode, lcb_t instance, int cmd, void *arg)
{
    struct lcb_create_st2 *opts = arg;
    if (mode != LCB_CNTL_SET) {
        return LCB_ECTL_UNSUPPMODE;
    }
    (void)cmd;
    return lcb_init_providers2(instance, opts);
}

static lcb_error_t config_cache_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    clconfig_provider *provider;
    (void)cmd;
    if (mode == CNTL__MODE_SETSTRING) {
        mode = LCB_CNTL_SET;
    }

    provider = lcb_confmon_get_provider(instance->confmon, LCB_CLCONFIG_FILE);
    if (mode == LCB_CNTL_SET) {
        if (lcb_clconfig_file_set_filename(provider, (char *)arg) == 0) {
            instance->settings->bc_http_stream_time = LCB_MS2US(10000);
            return LCB_SUCCESS;
        }
        return LCB_ERROR;
    } else {
        *(const char **)arg = lcb_clconfig_file_get_filename(provider);
        return LCB_SUCCESS;
    }
}

static lcb_error_t
ssl_mode_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    lcb_SSLOPTS *sopt = arg;
    if (mode == LCB_CNTL_GET) {
        *sopt = LCBT_SETTING(instance, sslopts);
    } else {
        return LCB_ECTL_UNSUPPMODE;
    }

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
ssl_capath_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    if (mode == LCB_CNTL_GET) {
        *(char ** const)arg = LCBT_SETTING(instance, capath);
    } else {
        return LCB_ECTL_UNSUPPMODE;
    }

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
retrymode_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    uint8_t *p;
    lcb_RETRYOPT *opt = arg;

    p = &(LCBT_SETTING(instance, retry)[opt->mode]);
    if (mode == LCB_CNTL_SET) {
        *p = opt->cmd;
    } else {
        opt->cmd = *p;
    }
    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
htconfig_urltype_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    lcb_HTCONFIG_URLTYPE *p = arg;
    if (mode == LCB_CNTL_SET) {
        LCBT_SETTING(instance, bc_http_urltype) = *p;
    } else {
        *p = LCBT_SETTING(instance, bc_http_urltype);
    }
    (void)cmd;
    return LCB_SUCCESS;
}

static
lcb_error_t
compmode_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    lcb_COMPRESSOPTS opts_s = 0, *opt_p;

    if (mode == CNTL__MODE_SETSTRING) {
        if (!strcmp(arg, "on")) {
            opts_s = LCB_COMPRESS_INOUT;
        } else if (!strcmp(arg, "off")) {
            opts_s = LCB_COMPRESS_NONE;
        } else if (!strcmp(arg, "inflate_only")) {
            opts_s = LCB_COMPRESS_IN;
        } else if (!strcmp(arg, "force")) {
            opts_s = LCB_COMPRESS_INOUT|LCB_COMPRESS_FORCE;
        } else {
            return LCB_ECTL_BADARG;
        }

        opt_p = &opts_s;
        mode = LCB_CNTL_SET;
    } else {
        opt_p = arg;
    }
    if (mode == LCB_CNTL_SET) {
        LCBT_SETTING(instance, compressopts) = *opt_p;
    } else {
        *opt_p = LCBT_SETTING(instance, compressopts);
    }
    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
allocfactory_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    struct lcb_cntl_rdballocfactory *cbw = arg;
    if (mode == LCB_CNTL_SET) {
        LCBT_SETTING(instance, allocator_factory) = cbw->factory;
    } else {
        cbw->factory = LCBT_SETTING(instance, allocator_factory);
    }
    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
syncdtor_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    int *param = arg;
    if (mode == LCB_CNTL_SET) {
        LCBT_SETTING(instance, syncdtor) = *param;
    } else {
        *param = LCBT_SETTING(instance, syncdtor);
    }
    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
console_log_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    lcb_U32 level;
    struct lcb_CONSOLELOGGER *logger;
    lcb_logprocs *procs;

    if (mode == CNTL__MODE_SETSTRING) {
        int iarg;
        if (sscanf(arg, "%d", &iarg) != 1) {
            return LCB_ECTL_BADARG;
        }
        level = iarg;
        mode = LCB_CNTL_SET;
    } else {
        level = *(lcb_U32*)arg;
    }

    if (mode != LCB_CNTL_SET) {
        return LCB_ECTL_UNSUPPMODE;
    }

    procs = LCBT_SETTING(instance, logger);
    if (procs) {
        /* don't override previous config */
        return LCB_SUCCESS;
    }

    if (procs == NULL && mode == LCB_CNTL_SET) {
        procs = lcb_init_console_logger();
        LCBT_SETTING(instance, logger) = procs;
    }

    logger = (struct lcb_CONSOLELOGGER* ) lcb_console_logprocs;
    level = LCB_LOG_ERROR - level;
    logger->minlevel = level;
    LCBT_SETTING(instance, logger) = &logger->base;

    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
detailed_errcode_handler(int mode, lcb_t instance, int cmd, void *arg)
{
    int newval = 0;
    if (mode == CNTL__MODE_SETSTRING) {
        newval = boolean_from_string(arg);
        mode = LCB_CNTL_SET;
    } else if (mode == LCB_CNTL_SET) {
        newval = *(int *)arg;
    } else {
        *(int *)arg = LCBT_SETTING(instance, detailed_neterr);
        return LCB_SUCCESS;
    }

    if (mode == LCB_CNTL_SET) {
        LCBT_SETTING(instance, detailed_neterr) = newval;
    }
    (void)cmd;
    return LCB_SUCCESS;
}

static lcb_error_t
reinit_dsn_handler(int mode, lcb_t instance, int cmd, void *arg) {
    if (mode == LCB_CNTL_GET) {
        return LCB_ECTL_UNSUPPMODE;
    }
    (void)cmd;
    return lcb_reinit3(instance, arg);
}

static ctl_handler handlers[] = {
    timeout_common, /* LCB_CNTL_OP_TIMEOUT */
    timeout_common, /* LCB_CNTL_VIEW_TIMEOUT */
    noop_handler, /* LCB_CNTL_RBUFSIZE */
    noop_handler, /* LCB_CNTL_WBUFSIZE */
    get_htype,      /* LCB_CNTL_HANDLETYPE */
    get_vbconfig,   /* LCB_CNTL_VBCONFIG */
    get_iops,       /* LCB_CNTL_IOPS */
    get_kvb,        /* LCB_CNTL_VBMAP */
    conninfo,       /* LCB_CNTL_MEMDNODE_INFO */
    conninfo,       /* LCB_CNTL_CONFIGNODE_INFO */
    syncmode,       /* LCB_CNTL_SYNCMODE */
    ippolicy,       /* LCB_CNTL_IP6POLICY */
    confthresh      /* LCB_CNTL_CONFERRTHRESH */,
    timeout_common, /* LCB_CNTL_DURABILITY_INTERVAL */
    timeout_common, /* LCB_CNTL_DURABILITY_TIMEOUT */
    timeout_common, /* LCB_CNTL_HTTP_TIMEOUT */
    lcb_iops_cntl_handler, /* LCB_CNTL_IOPS_DEFAULT_TYPES */
    lcb_iops_cntl_handler, /* LCB_CNTL_IOPS_DLOPEN_DEBUG */
    timeout_common,  /* LCB_CNTL_CONFIGURATION_TIMEOUT */
    noop_handler,   /* LCB_CNTL_SKIP_CONFIGURATION_ERRORS_ON_CONNECT */
    randomize_bootstrap_hosts_handler /* LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS */,
    config_cache_loaded_handler /* LCB_CNTL_CONFIG_CACHE_LOADED */,
    force_sasl_mech_handler, /* LCB_CNTL_FORCE_SASL_MECH */
    max_redirects, /* LCB_CNTL_MAX_REDIRECTS */
    logprocs_handler /* LCB_CNTL_LOGGER */,
    timeout_common, /* LCB_CNTL_CONFDELAY_THRESH */
    config_transport, /* LCB_CNTL_CONFIG_TRANSPORT */
    timeout_common, /* LCB_CNTL_CONFIG_NODE_TIMEOUT */
    timeout_common, /* LCB_CNTL_HTCONFIG_IDLE_TIMEOUT */
    config_nodes, /* LCB_CNTL_CONFIG_HTTP_NODES */
    config_nodes, /* LCB_CNTL_CONFIG_CCCP_NODES */
    get_changeset, /* LCB_CNTL_CHANGESET */
    init_providers, /* LCB_CNTL_CONFIG_ALL_NODES */
    config_cache_handler, /* LCB_CNTL_CONFIGCACHE */
    ssl_mode_handler, /* LCB_CNTL_SSL_MODE */
    ssl_capath_handler, /* LCB_CNTL_SSL_CAPATH */
    retrymode_handler, /* LCB_CNTL_RETRYMODE */
    htconfig_urltype_handler, /* LCB_CNTL_HTCONFIG_URLTYPE */
    compmode_handler, /* LCB_CNTL_COMPRESSION_OPTS */
    allocfactory_handler, /* LCB_CNTL_RDBALLOCFACTORY */
    syncdtor_handler, /* LCB_CNTL_SYNCDESTROY */
    console_log_handler, /* LCB_CNTL_CONLOGGER_LEVEL */
    detailed_errcode_handler, /* LCB_CNTL_DETAILED_ERRCODES */
    reinit_dsn_handler /* LCB_CNTL_REINIT_DSN */
};

typedef struct {
    const char *key;
    int opcode;
} cntl_OPCODESTRS;

static cntl_OPCODESTRS stropcode_map[] = {
        {"operation_timeout", LCB_CNTL_OP_TIMEOUT},
        {"views_timeout", LCB_CNTL_VIEW_TIMEOUT},
        {"durability_timeout", LCB_CNTL_DURABILITY_TIMEOUT},
        {"durability_interval", LCB_CNTL_DURABILITY_INTERVAL},
        {"http_timeout", LCB_CNTL_HTTP_TIMEOUT},
        {"randomize_nodes", LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS},
        {"sasl_mech_force", LCB_CNTL_FORCE_SASL_MECH},
        {"error_thresh_count", LCB_CNTL_CONFERRTHRESH},
        {"error_thresh_delay", LCB_CNTL_CONFDELAY_THRESH},
        {"config_total_timeout", LCB_CNTL_CONFIGURATION_TIMEOUT},
        {"config_node_timeout", LCB_CNTL_CONFIG_NODE_TIMEOUT},
        {"compression", LCB_CNTL_COMPRESSION_OPTS},
        {"console_log_level", LCB_CNTL_CONLOGGER_LEVEL},
        {"config_cache", LCB_CNTL_CONFIGCACHE },
        {"detailed_errcodes", LCB_CNTL_DETAILED_ERRCODES},
        {"_reinit_dsn", LCB_CNTL_REINIT_DSN }
};

#define CNTL_NUM_HANDLERS (sizeof(handlers) / sizeof(handlers[0]))

static lcb_error_t
wrap_return(lcb_t instance, lcb_error_t retval)
{
    if (retval == LCB_SUCCESS) {
        return retval;
    }
    if (instance && LCBT_SETTING(instance, detailed_neterr) == 0) {
        switch (retval) {
        case LCB_ECTL_UNKNOWN:
            return LCB_NOT_SUPPORTED;
        case LCB_ECTL_UNSUPPMODE:
            return LCB_NOT_SUPPORTED;
        case LCB_ECTL_BADARG:
            return LCB_EINVAL;
        default:
            return retval;
        }
    } else {
        return retval;
    }
}

LIBCOUCHBASE_API
lcb_error_t lcb_cntl(lcb_t instance, int mode, int cmd, void *arg)
{
    ctl_handler handler;
    if (cmd >= (int)CNTL_NUM_HANDLERS || cmd < 0) {
        return wrap_return(instance, LCB_ECTL_UNKNOWN);
    }

    handler = handlers[cmd];

    if (!handler) {
        return wrap_return(instance, LCB_ECTL_UNKNOWN);
    }

    return wrap_return(instance, handler(mode, instance, cmd, arg));
}

LIBCOUCHBASE_API
lcb_error_t
lcb_cntl_string(lcb_t instance, const char *key, const char *value)
{
    cntl_OPCODESTRS *cur;

    for (cur = stropcode_map; cur->key; cur++) {
        if (!strcmp(cur->key, key)) {
            return lcb_cntl(instance, CNTL__MODE_SETSTRING, cur->opcode,
                (void *)value);
        }
    }
    return wrap_return(instance, LCB_NOT_SUPPORTED);
}

LIBCOUCHBASE_API
int
lcb_cntl_exists(int ctl)
{
    if (ctl >= (int)CNTL_NUM_HANDLERS || ctl < 0) {
        return 0;
    }
    return handlers[ctl] != NULL;
}

LIBCOUCHBASE_API
lcb_error_t lcb_cntl_setu32(lcb_t instance, int cmd, lcb_uint32_t arg)
{
    return lcb_cntl(instance, LCB_CNTL_SET, cmd, &arg);
}

LIBCOUCHBASE_API
lcb_uint32_t lcb_cntl_getu32(lcb_t instance, int cmd)
{
    lcb_uint32_t ret = 0;
    lcb_cntl(instance, LCB_CNTL_GET, cmd, &ret);
    return ret;
}

LIBCOUCHBASE_API
void lcb_behavior_set_ipv6(lcb_t instance, lcb_ipv6_t mode)
{
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_IP6POLICY, &mode);
}

LIBCOUCHBASE_API
lcb_ipv6_t lcb_behavior_get_ipv6(lcb_t instance)
{
    lcb_ipv6_t ret;
    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_IP6POLICY, &ret);
    return ret;
}

LIBCOUCHBASE_API
void lcb_behavior_set_config_errors_threshold(lcb_t instance, lcb_size_t num_events)
{
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_CONFERRTHRESH, &num_events);
}

LIBCOUCHBASE_API
lcb_size_t lcb_behavior_get_config_errors_threshold(lcb_t instance)
{
    lcb_size_t ret;
    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_CONFERRTHRESH, &ret);
    return ret;
}

/**
 * The following is from timeout.c
 */
LIBCOUCHBASE_API
void lcb_set_timeout(lcb_t instance, lcb_uint32_t usec)
{
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &usec);
}

LIBCOUCHBASE_API
lcb_uint32_t lcb_get_timeout(lcb_t instance)
{
    lcb_uint32_t ret;
    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_OP_TIMEOUT, &ret);
    return ret;
}

LIBCOUCHBASE_API
void lcb_set_view_timeout(lcb_t instance, lcb_uint32_t usec)
{
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_VIEW_TIMEOUT, &usec);
}

LIBCOUCHBASE_API
lcb_uint32_t lcb_get_view_timeout(lcb_t instance)
{
    lcb_uint32_t ret;
    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VIEW_TIMEOUT, &ret);
    return ret;
}
