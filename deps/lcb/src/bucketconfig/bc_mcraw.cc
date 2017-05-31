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
#include <lcbio/timer-cxx.h>
#include <libcouchbase/vbucket.h>
#include "clconfig.h"

#define LOGARGS(mcr, lvlbase) mcr->parent->settings, "mcraw", LCB_LOG_##lvlbase, __FILE__, __LINE__
#define LOGFMT "(MCRAW=%p)> "
#define LOGID(mcr) (void *)mcr

using namespace lcb::clconfig;

/* Raw memcached provider */

struct McRawProvider : Provider {
    McRawProvider(Confmon*);
    ~McRawProvider();

    /* Overrides */
    ConfigInfo* get_cached();
    lcb_error_t refresh();
    void configure_nodes(const lcb::Hostlist& l);
    void async_update();

    /* Current (user defined) configuration */
    ConfigInfo *config;
    lcb::io::Timer<McRawProvider, &McRawProvider::async_update> async;
};


void McRawProvider::async_update() {
    if (!config) {
        lcb_log(LOGARGS(this, WARN), "No current config set. Not setting configuration");
        return;
    }
    parent->provider_got_config(this, config);
}

ConfigInfo* McRawProvider::get_cached() {
    return config;
}

lcb_error_t McRawProvider::refresh() {
    async.signal();
    return LCB_SUCCESS;
}

void McRawProvider::configure_nodes(const lcb::Hostlist& hl)
{
    lcbvb_CONFIG *newconfig;

    if (hl.empty()) {
        lcb_log(LOGARGS(this, FATAL), "No nodes provided");
        return;
    }

    std::vector<lcbvb_SERVER> servers;
    servers.reserve(hl.size());

    for (size_t ii = 0; ii < hl.size(); ii++) {
        const lcb_host_t& curhost = hl[ii];
        servers.resize(servers.size() + 1);
        lcbvb_SERVER& srv = servers.back();

        /* just set the memcached port and hostname */
        srv.hostname = (char *)curhost.host;
        srv.svc.data = std::atoi(curhost.port);
        if (parent->settings->sslopts) {
            srv.svc_ssl.data = srv.svc.data;
        }
    }

    newconfig = lcbvb_create();
    lcbvb_genconfig_ex(newconfig, "NOBUCKET", "deadbeef", &servers[0], servers.size(), 0, 2);
    lcbvb_make_ketama(newconfig);
    newconfig->revid = -1;

    if (config) {
        config->decref();
        config = NULL;
    }
    config = ConfigInfo::create(newconfig, CLCONFIG_MCRAW);
}

McRawProvider::~McRawProvider() {
    if (config) {
        config->decref();
    }
    async.release();
}

Provider* lcb::clconfig::new_mcraw_provider(Confmon* parent) {
    return new McRawProvider(parent);
}

McRawProvider::McRawProvider(Confmon *parent_)
    : Provider(parent_, CLCONFIG_MCRAW),
      config(NULL), async(parent->iot, this) {
}
