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

#include "settings.h"
#include <lcbio/ssl.h>
#include <rdb/rope.h>
#include "auth.h"

LCB_INTERNAL_API
void lcb_default_settings(lcb_settings *settings)
{
    settings->ipv6 = LCB_IPV6_DISABLED;
    settings->operation_timeout = LCB_DEFAULT_TIMEOUT;
    settings->config_timeout = LCB_DEFAULT_CONFIGURATION_TIMEOUT;
    settings->config_node_timeout = LCB_DEFAULT_NODECONFIG_TIMEOUT;
    settings->views_timeout = LCB_DEFAULT_VIEW_TIMEOUT;
    settings->n1ql_timeout = LCB_DEFAULT_N1QL_TIMEOUT;
    settings->durability_timeout = LCB_DEFAULT_DURABILITY_TIMEOUT;
    settings->durability_interval = LCB_DEFAULT_DURABILITY_INTERVAL;
    settings->http_timeout = LCB_DEFAULT_HTTP_TIMEOUT;
    settings->weird_things_threshold = LCB_DEFAULT_CONFIG_ERRORS_THRESHOLD;
    settings->weird_things_delay = LCB_DEFAULT_CONFIG_ERRORS_DELAY;
    settings->max_redir = LCB_DEFAULT_CONFIG_MAXIMUM_REDIRECTS;
    settings->grace_next_cycle = LCB_DEFAULT_CLCONFIG_GRACE_CYCLE;
    settings->grace_next_provider = LCB_DEFAULT_CLCONFIG_GRACE_NEXT;
    settings->bc_http_stream_time = LCB_DEFAULT_BC_HTTP_DISCONNTMO;
    settings->retry_interval = LCB_DEFAULT_RETRY_INTERVAL;
    settings->retry_backoff = LCB_DEFAULT_RETRY_BACKOFF;
    settings->sslopts = 0;
    settings->retry[LCB_RETRY_ON_SOCKERR] = LCB_DEFAULT_NETRETRY;
    settings->retry[LCB_RETRY_ON_TOPOCHANGE] = LCB_DEFAULT_TOPORETRY;
    settings->retry[LCB_RETRY_ON_VBMAPERR] = LCB_DEFAULT_NMVRETRY;
    settings->retry[LCB_RETRY_ON_MISSINGNODE] = 0;
    settings->bc_http_urltype = LCB_DEFAULT_HTCONFIG_URLTYPE;
    settings->compressopts = LCB_DEFAULT_COMPRESSOPTS;
    settings->allocator_factory = rdb_bigalloc_new;
    settings->syncmode = LCB_ASYNCHRONOUS;
    settings->detailed_neterr = 0;
    settings->refresh_on_hterr = 1;
    settings->sched_implicit_flush = 1;
    settings->fetch_mutation_tokens = 0;
    settings->dur_mutation_tokens = 1;
    settings->nmv_retry_imm = LCB_DEFAULT_NVM_RETRY_IMM;
    settings->tcp_nodelay = LCB_DEFAULT_TCP_NODELAY;
    settings->retry_nmv_interval = LCB_DEFAULT_RETRY_NMV_INTERVAL;
    settings->vb_noguess = LCB_DEFAULT_VB_NOGUESS;
}

LCB_INTERNAL_API
lcb_settings *
lcb_settings_new(void)
{
    lcb_settings *settings = calloc(1, sizeof(*settings));
    lcb_default_settings(settings);
    settings->refcount = 1;
    settings->auth = lcbauth_new();
    return settings;
}

LCB_INTERNAL_API
void
lcb_settings_unref(lcb_settings *settings)
{
    if (--settings->refcount) {
        return;
    }
    free(settings->bucket);
    free(settings->sasl_mech_force);
    free(settings->certpath);
    free(settings->client_string);

    lcbauth_free(settings->auth);

    if (settings->ssl_ctx) {
        lcbio_ssl_free(settings->ssl_ctx);
    }
    if (settings->dtorcb) {
        settings->dtorcb(settings->dtorarg);
    }
    free(settings);
}
