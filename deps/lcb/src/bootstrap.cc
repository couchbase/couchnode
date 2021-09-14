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

#define LCB_BOOTSTRAP_DEFINE_STRUCT 1
#include "internal.h"
#include "defer.h"

#define LOGARGS(instance, lvl) instance->settings, "bootstrap", LCB_LOG_##lvl, __FILE__, __LINE__

using lcb::clconfig::ConfigInfo;
using lcb::clconfig::EventType;
using namespace lcb;

/**
 * This function is where the configuration actually takes place. We ensure
 * in other functions that this is only ever called directly from an event
 * loop stack frame (or one of the small mini functions here) so that we
 * don't accidentally end up destroying resources underneath us.
 */
void Bootstrap::config_callback(EventType event, ConfigInfo *info)
{
    using namespace lcb::clconfig;
    lcb_INSTANCE *instance = parent;

    if (event != CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        if (event == CLCONFIG_EVENT_PROVIDERS_CYCLED && !LCBT_VBCONFIG(instance)) {
            if (parent->confmon->get_last_error() == LCB_ERR_CONNECTION_REFUSED) {
                initial_error(LCB_ERR_NO_MATCHING_SERVER,
                              "Unable to bootstrap, check ports and cluster encryption setting");
            } else {
                initial_error(LCB_ERR_NO_MATCHING_SERVER, "No more bootstrap providers remain");
            }
        }
        return;
    }

    instance->last_error = LCB_SUCCESS;

    /** Ensure we're not called directly twice again */
    if (state < S_INITIAL_TRIGGERED) {
        state = S_INITIAL_TRIGGERED;
    }

    tm.cancel();

    if (info->get_origin() != CLCONFIG_FILE) {
        /* Set the timestamp for the current config to control throttling,
         * but only if it's not an initial file-based config. See CCBC-482 */
        last_refresh = gethrtime();
        errcounter = 0;
    }

    if (info->get_origin() == CLCONFIG_CCCP) {
        /* Disable HTTP provider if we've received something via CCCP */

        if (instance->cur_configinfo == nullptr || instance->cur_configinfo->get_origin() != CLCONFIG_HTTP) {
            /* Never disable HTTP if it's still being used */
            instance->confmon->set_active(CLCONFIG_HTTP, false);
        }
    }

    if (instance->settings->conntype == LCB_TYPE_CLUSTER && info->get_origin() == CLCONFIG_CLADMIN) {
        /* Disable HTTP provider for management operations, and fallback to static */
        if (instance->cur_configinfo == nullptr || instance->cur_configinfo->get_origin() != CLCONFIG_HTTP) {
            instance->confmon->set_active(CLCONFIG_HTTP, false);
        }
    }

    if (instance->cur_configinfo) {
        if (!(LCBVB_CCAPS(LCBT_VBCONFIG(instance)) & LCBVB_CCAP_N1QL_ENHANCED_PREPARED_STATEMENTS) &&
            (LCBVB_CCAPS(info->vbc) & LCBVB_CCAP_N1QL_ENHANCED_PREPARED_STATEMENTS)) {
            lcb_n1qlcache_clear(instance->n1ql_cache);
        }
    }
    lcb_update_vbconfig(instance, info);

    if (state < S_BOOTSTRAPPED) {
        state = S_BOOTSTRAPPED;
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, nullptr);

        lcb_log(LOGARGS(instance, INFO), "Selected network configuration: \"%s\"", LCBT_SETTING(instance, network));
        if (instance->settings->conntype == LCB_TYPE_BUCKET) {
            if (LCBVB_DISTTYPE(LCBT_VBCONFIG(instance)) == LCBVB_DIST_KETAMA &&
                instance->cur_configinfo->get_origin() != CLCONFIG_MCRAW) {
                lcb_log(LOGARGS(instance, INFO), "Reverting to HTTP Config for memcached buckets");
                instance->settings->bc_http_stream_time = -1;
                instance->confmon->set_active(CLCONFIG_HTTP, true);
                instance->confmon->set_active(CLCONFIG_CCCP, false);
            }

            if ((LCBVB_CAPS(LCBT_VBCONFIG(instance)) & LCBVB_CAP_COLLECTIONS) == 0) {
                LCBT_SETTING(parent, use_collections) = 0;
            }

            if (LCBVB_CAPS(LCBT_VBCONFIG(instance)) & LCBVB_CAP_DURABLE_WRITE) {
                LCBT_SETTING(parent, enable_durable_write) = 1;
            } else {
                LCBT_SETTING(parent, enable_durable_write) = 0;
            }

            /* infer bucket type using distribution and capabilities set */
            switch (LCBVB_DISTTYPE(LCBT_VBCONFIG(instance))) {
                case LCBVB_DIST_VBUCKET:
                    if (LCBVB_CAPS(LCBT_VBCONFIG(instance)) & LCBVB_CAP_COUCHAPI) {
                        instance->btype = LCB_BTYPE_COUCHBASE;
                    } else {
                        instance->btype = LCB_BTYPE_EPHEMERAL;
                    }
                    break;
                case LCBVB_DIST_KETAMA:
                    instance->btype = LCB_BTYPE_MEMCACHED;
                    break;
                case LCBVB_DIST_UNKNOWN:
                    instance->btype = LCB_BTYPE_UNSPEC;
                    break;
            }
        }
        if (instance->callbacks.bootstrap) {
            instance->callbacks.bootstrap(instance, LCB_SUCCESS);
            instance->callbacks.bootstrap = nullptr;
        }
        if (instance->callbacks.open && LCBT_VBCONFIG(instance)->bname) {
            instance->callbacks.open(instance, LCB_SUCCESS);
            instance->callbacks.open = nullptr;
        }
        lcb::execute_deferred_operations(instance);

        // See if we can enable background polling.
        check_bgpoll();
    }

    lcb_maybe_breakout(instance);
}

const char *provider_string(clconfig::Method type);

void Bootstrap::clconfig_lsn(EventType e, ConfigInfo *i)
{
    if (state == S_INITIAL_PRE) {
        config_callback(e, i);
    } else if (e == clconfig::CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        lcb_log(
            LOGARGS(parent, INFO),
            "Got new config (source=%s, bucket=%.*s, epoch=%" PRId64 ", rev=%" PRId64 "). Will refresh asynchronously",
            provider_string(i->get_origin()), (int)i->vbc->bname_len, i->vbc->bname, i->vbc->revepoch, i->vbc->revid);
        tm.signal();
    }
}

void Bootstrap::check_bgpoll()
{
    if (parent->cur_configinfo == nullptr || parent->cur_configinfo->get_origin() != lcb::clconfig::CLCONFIG_CCCP ||
        LCBT_SETTING(parent, config_poll_interval) == 0) {
        tmpoll.cancel();
    } else {
        tmpoll.rearm(LCBT_SETTING(parent, config_poll_interval));
    }
}

void Bootstrap::bgpoll()
{
    lcb_log(LOGARGS(parent, TRACE), "Background-polling for new configuration");
    bootstrap(BS_REFRESH_ALWAYS);
    check_bgpoll();
}

/**
 * This it the initial bootstrap timeout handler. This timeout pins down the
 * instance. It is only scheduled during the initial bootstrap and is only
 * triggered if the initial bootstrap fails to configure in time.
 */
void Bootstrap::timer_dispatch()
{
    if (state > S_INITIAL_PRE) {
        auto *config = parent->confmon->get_config();
        if (config != nullptr) {
            config_callback(clconfig::CLCONFIG_EVENT_GOT_NEW_CONFIG, config);
        }
    } else {
        // Not yet bootstrapped!
        initial_error(LCB_ERR_TIMEOUT, "Failed to bootstrap in time");
    }
}

void Bootstrap::initial_error(lcb_STATUS err, const char *errinfo)
{
    parent->last_error = parent->confmon->get_last_error();
    if (parent->last_error == LCB_SUCCESS) {
        parent->last_error = err;
    }
    lcb_log(LOGARGS(parent, ERR), "Failed to bootstrap client=%p. Error=%s (Last=%s), Message=\"%s\"", (void *)parent,
            lcb_strerror_short(err), lcb_strerror_short(parent->last_error), errinfo);
    tm.cancel();

    if (parent->callbacks.bootstrap) {
        parent->callbacks.bootstrap(parent, parent->last_error);
        parent->callbacks.bootstrap = nullptr;
    }
    if (parent->callbacks.open) {
        parent->callbacks.open(parent, parent->last_error);
        parent->callbacks.open = nullptr;
    }

    lcb_aspend_del(&parent->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    lcb_maybe_breakout(parent);
}

Bootstrap::Bootstrap(lcb_INSTANCE *instance)
    : parent(instance), tm(parent->iotable, this), tmpoll(parent->iotable, this), last_refresh(0), errcounter(0),
      state(S_INITIAL_PRE)
{
    parent->confmon->add_listener(this);
}

lcb_STATUS Bootstrap::bootstrap(unsigned options)
{
    hrtime_t now = gethrtime();

    if (options == BS_REFRESH_OPEN_BUCKET) {
        clconfig::Provider *http = parent->confmon->get_provider(clconfig::CLCONFIG_HTTP);
        if (http) {
            lcb_log(LOGARGS(parent, INFO), "Re-enable HTTP config provider to bootstrap \"%s\"",
                    parent->settings->bucket);
            http->enable();
        }
        if (parent->confmon->is_refreshing()) {
            parent->confmon->stop();
        }
        parent->confmon->active_provider_list_id = 0;
        parent->confmon->prepare();
        state = S_INITIAL_PRE;
        tm.rearm(LCBT_SETTING(parent, config_timeout));
        lcb_aspend_add(&parent->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    } else if (parent->confmon->is_refreshing()) {
        return LCB_SUCCESS;
    }

    if (options & BS_REFRESH_THROTTLE) {
        /* Refresh throttle requested. This is not true if options == ALWAYS */
        hrtime_t next_ts;
        unsigned errthresh = LCBT_SETTING(parent, weird_things_threshold);

        if (options & BS_REFRESH_INCRERR) {
            errcounter++;
        }
        next_ts = last_refresh;
        next_ts += LCB_US2NS(LCBT_SETTING(parent, weird_things_delay));
        if (now < next_ts && errcounter < errthresh) {
            lcb_log(
                LOGARGS(parent, INFO),
                "Not requesting a config refresh because of throttling parameters. Next refresh possible in %" PRIu64
                "ms or %u errors. "
                "See LCB_CNTL_CONFDELAY_THRESH and LCB_CNTL_CONFERRTHRESH to modify the throttling settings",
                LCB_NS2US(next_ts - now) / 1000, (unsigned)errthresh - errcounter);
            return LCB_SUCCESS;
        }
    }

    if (options == BS_REFRESH_INITIAL) {
        if (LCBT_SETTING(parent, network)) {
            lcb_log(LOGARGS(parent, INFO), "Requested network configuration: \"%s\"", LCBT_SETTING(parent, network));
        } else {
            lcb_log(LOGARGS(parent, INFO), "Requested network configuration: heuristic");
        }
        state = S_INITIAL_PRE;
        parent->confmon->prepare();
        tm.rearm(LCBT_SETTING(parent, config_timeout));
        lcb_aspend_add(&parent->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    }

    /* Reset the counters */
    errcounter = 0;
    if (options != BS_REFRESH_INITIAL) {
        last_refresh = now;
    }
    if (parent->settings->bucket) {
        options &= BS_REFRESH_OPEN_BUCKET;
    }
    parent->confmon->start(options);
    return LCB_SUCCESS;
}

Bootstrap::~Bootstrap()
{
    tm.release();
    tmpoll.release();
    parent->confmon->remove_listener(this);
}

LIBCOUCHBASE_API
lcb_STATUS lcb_get_bootstrap_status(lcb_INSTANCE *instance)
{
    if (instance->cur_configinfo) {
        switch (LCBT_SETTING(instance, conntype)) {
            case LCB_TYPE_CLUSTER:
                return LCB_SUCCESS;
            case LCB_TYPE_BUCKET:
                if (instance->cur_configinfo->vbc->bname != nullptr) {
                    return LCB_SUCCESS;
                }
                /* fall through */
            default:
                return LCB_ERR_SDK_INTERNAL;
        }
    }
    if (instance->last_error != LCB_SUCCESS) {
        return instance->last_error;
    }
    if (LCBT_SETTING(instance, conntype) == LCB_TYPE_CLUSTER) {
        if (lcb::clconfig::http_get_conn(instance->confmon) != nullptr || instance->confmon->get_config() != nullptr) {
            return LCB_SUCCESS;
        }
    }
    return LCB_ERR_GENERIC;
}

LIBCOUCHBASE_API
void lcb_refresh_config(lcb_INSTANCE *instance)
{
    instance->bootstrap(BS_REFRESH_ALWAYS);
}
