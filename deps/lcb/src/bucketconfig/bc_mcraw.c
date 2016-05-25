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

#include <lcbio/lcbio.h>
#include <lcbio/timer-ng.h>
#include <libcouchbase/vbucket.h>
#include "clconfig.h"

#define LOGARGS(mcr, lvlbase) mcr->base.parent->settings, "mcraw", LCB_LOG_##lvlbase, __FILE__, __LINE__
#define LOGFMT "(MCRAW=%p)> "
#define LOGID(mcr) (void *)mcr

/* Raw memcached provider */

typedef struct {
    /* Base provider */
    clconfig_provider base;
    /* Current (user defined) configuration */
    clconfig_info *config;
    lcbio_pTIMER async;
} bc_MCRAW;


static void
async_update(void *arg)
{
    bc_MCRAW *mcr = arg;
    if (!mcr->config) {
        lcb_log(LOGARGS(mcr, WARN), "No current config set. Not setting configuration");
        return;
    }
    lcb_confmon_provider_success(&mcr->base, mcr->config);
}

static clconfig_info* get_cached(clconfig_provider *pb) {
    return ((bc_MCRAW *)pb)->config;
}
static lcb_error_t get_refresh(clconfig_provider *pb) {
    lcbio_async_signal( ((bc_MCRAW*)pb)->async );
    return LCB_SUCCESS;
}
static lcb_error_t pause_mcr(clconfig_provider *pb) {
    (void)pb;
    return LCB_SUCCESS;
}

static void configure_nodes(clconfig_provider *pb, const hostlist_t hl)
{
    bc_MCRAW *mcr = (bc_MCRAW *)pb;
    lcbvb_SERVER *servers;
    lcbvb_CONFIG *newconfig;
    unsigned ii, nsrv;

    nsrv = hostlist_size(hl);

    if (!nsrv) {
        lcb_log(LOGARGS(mcr, FATAL), "No nodes provided");
        return;
    }

    servers = calloc(nsrv, sizeof(*servers));
    for (ii = 0; ii < nsrv; ii++) {
        int itmp;
        const lcb_host_t *curhost = hostlist_get(hl, ii);
        lcbvb_SERVER *srv = servers + ii;

        /* just set the memcached port and hostname */
        srv->hostname = (char *)curhost->host;
        sscanf(curhost->port, "%d", &itmp);
        srv->svc.data = itmp;
        if (pb->parent->settings->sslopts) {
            srv->svc_ssl.data = itmp;
        }
    }

    newconfig = lcbvb_create();
    lcbvb_genconfig_ex(newconfig, "NOBUCKET", "deadbeef", servers, nsrv, 0, 2);
    lcbvb_make_ketama(newconfig);
    newconfig->revid = -1;

    if (mcr->config) {
        lcb_clconfig_decref(mcr->config);
        mcr->config = NULL;
    }
    mcr->config = lcb_clconfig_create(newconfig, LCB_CLCONFIG_MCRAW);
    mcr->config->cmpclock = gethrtime();
}

lcb_error_t
lcb_clconfig_mcraw_update(clconfig_provider *pb, const char *nodes)
{
    lcb_error_t err;
    bc_MCRAW *mcr = (bc_MCRAW *)pb;
    hostlist_t hl = hostlist_create();
    err = hostlist_add_stringz(hl, nodes, LCB_CONFIG_MCCOMPAT_PORT);
    if (err != LCB_SUCCESS) {
        hostlist_destroy(hl);
        return err;
    }

    configure_nodes(pb, hl);
    hostlist_destroy(hl);
    lcbio_async_signal(mcr->async);
    return LCB_SUCCESS;
}

static void
mcraw_shutdown(clconfig_provider *pb)
{
    bc_MCRAW *mcr = (bc_MCRAW *)pb;
    if (mcr->config) {
        lcb_clconfig_decref(mcr->config);
    }
    if (mcr->async) {
        lcbio_timer_destroy(mcr->async);
    }
    free(mcr);
}

clconfig_provider *
lcb_clconfig_create_mcraw(lcb_confmon *parent)
{
    bc_MCRAW *mcr = calloc(1, sizeof(*mcr));
    if (!mcr) {
        return NULL;
    }
    mcr->async = lcbio_timer_new(parent->iot, mcr, async_update);
    mcr->base.parent = parent;
    mcr->base.type = LCB_CLCONFIG_MCRAW;
    mcr->base.get_cached = get_cached;
    mcr->base.refresh = get_refresh;
    mcr->base.pause = pause_mcr;
    mcr->base.configure_nodes = configure_nodes;
    mcr->base.shutdown = mcraw_shutdown;
    return &mcr->base;
}
