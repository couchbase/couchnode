/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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
#include <lcbio/timer-cxx.h>
#include <libcouchbase/vbucket.h>
#include "clconfig.h"
#include <cerrno>

#define LOGARGS(mcr, lvlbase) mcr->parent->settings, "bc_static", LCB_LOG_##lvlbase, __FILE__, __LINE__
#define LOGFMT "(STATIC=%p)> "
#define LOGID(mcr) (void *)mcr

using namespace lcb::clconfig;
using lcb::Hostlist;

// Base class for providers which only generate a config once, statically.
class StaticProvider : public Provider
{
  public:
    StaticProvider(Confmon *parent_, Method m) : Provider(parent_, m), async(parent_->iot, this), config(nullptr) {}

    ~StaticProvider() override
    {
        if (config) {
            config->decref();
        }
        async.release();
    }

    ConfigInfo *get_cached() override
    {
        return config;
    }

    lcb_STATUS refresh() override
    {
        async.signal();
        return LCB_SUCCESS;
    }

    void configure_nodes(const Hostlist &hl) override
    {
        if (hl.empty()) {
            lcb_log(LOGARGS(this, FATAL), "No nodes provided");
            return;
        }

        lcbvb_CONFIG *vbc = gen_config(hl);
        if (vbc != nullptr) {
            if (config != nullptr) {
                config->decref();
                config = nullptr;
            }
            config = ConfigInfo::create(vbc, type, "<static>");
        }
    }

    virtual lcbvb_CONFIG *gen_config(const Hostlist &hl) = 0;

  private:
    void async_update()
    {
        if (config != nullptr) {
            parent->provider_got_config(this, config);
        }
    }

    lcb::io::Timer<StaticProvider, &StaticProvider::async_update> async;
    ConfigInfo *config;
};

/* Raw memcached provider */

struct McRawProvider : public StaticProvider {
    explicit McRawProvider(Confmon *parent_) : StaticProvider(parent_, CLCONFIG_MCRAW) {}
    lcbvb_CONFIG *gen_config(const lcb::Hostlist &l) override;
};

lcbvb_CONFIG *McRawProvider::gen_config(const lcb::Hostlist &hl)
{
    std::vector<lcbvb_SERVER> servers;
    servers.reserve(hl.size());

    for (size_t ii = 0; ii < hl.size(); ii++) {
        const lcb_host_t &curhost = hl[ii];
        servers.resize(servers.size() + 1);

        lcbvb_SERVER &srv = servers.back();
        memset(&srv, 0, sizeof srv);

        /* just set the memcached port and hostname */
        srv.hostname = (char *)curhost.host;
        char *end = nullptr;
        long val = strtol(curhost.port, &end, 10);
        if (errno != ERANGE && end != curhost.port) {
            if (parent->settings->sslopts) {
                srv.svc_ssl.data = static_cast<std::uint16_t>(val);
            } else {
                srv.svc.data = static_cast<std::uint16_t>(val);
            }
        }
    }

    lcbvb_CONFIG *newconfig = lcbvb_create();
    lcbvb_genconfig_ex(newconfig, "NOBUCKET", "deadbeef", &servers[0], servers.size(), 0, 2);
    lcbvb_make_ketama(newconfig);
    newconfig->revepoch = -1;
    newconfig->revid = -1;
    return newconfig;
}

Provider *lcb::clconfig::new_mcraw_provider(Confmon *parent)
{
    return new McRawProvider(parent);
}

struct ClusterAdminProvider : public StaticProvider {
    explicit ClusterAdminProvider(Confmon *parent_) : StaticProvider(parent_, CLCONFIG_CLADMIN) {}

    lcbvb_CONFIG *gen_config(const lcb::Hostlist &hl) override
    {
        std::vector<lcbvb_SERVER> servers;
        servers.reserve(hl.size());
        for (size_t ii = 0; ii < hl.size(); ++ii) {
            servers.resize(servers.size() + 1);
            lcbvb_SERVER &srv = servers[ii];
            const lcb_host_t &curhost = hl[ii];
            srv.hostname = const_cast<char *>(curhost.host);
            char *end = nullptr;
            long val = strtol(curhost.port, &end, 10);
            if (errno != ERANGE && end != curhost.port) {
                if (parent->settings->sslopts) {
                    srv.svc_ssl.mgmt = static_cast<std::uint16_t>(val);
                } else {
                    srv.svc.mgmt = static_cast<std::uint16_t>(val);
                }
            }
        }
        lcbvb_CONFIG *vbc = lcbvb_create();
        lcbvb_genconfig_ex(vbc, "NOBUCKET", "deadbeef", &servers[0], servers.size(), 0, 0);
        return vbc;
    }
};

Provider *lcb::clconfig::new_cladmin_provider(Confmon *parent)
{
    return new ClusterAdminProvider(parent);
}
