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

#define LCB_BOOTSTRAP_DEFINE_STRUCT 1
#include "internal.h"


#define LOGARGS(instance, lvl) instance->settings, "bootstrap", LCB_LOG_##lvl, __FILE__, __LINE__

static void async_step_callback(clconfig_listener*,clconfig_event_t,clconfig_info*);
static void initial_bootstrap_error(lcb_t, lcb_error_t,const char*);

/**
 * This function is where the configuration actually takes place. We ensure
 * in other functions that this is only ever called directly from an event
 * loop stack frame (or one of the small mini functions here) so that we
 * don't accidentally end up destroying resources underneath us.
 */
static void
config_callback(clconfig_listener *listener, clconfig_event_t event,
    clconfig_info *info)
{
    struct lcb_BOOTSTRAP *bs = (struct lcb_BOOTSTRAP *)listener;
    lcb_t instance = bs->parent;

    if (event != CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        if (event == CLCONFIG_EVENT_PROVIDERS_CYCLED) {
            if (!LCBT_VBCONFIG(instance)) {
                initial_bootstrap_error(
                    instance, LCB_ERROR, "No more bootstrap providers remain");
            }
        }
        return;
    }

    instance->last_error = LCB_SUCCESS;
    /** Ensure we're not called directly twice again */
    listener->callback = async_step_callback;
    lcbio_timer_disarm(bs->tm);

    lcb_log(LOGARGS(instance, DEBUG), "Instance configured!");

    if (info->origin != LCB_CLCONFIG_FILE) {
        /* Set the timestamp for the current config to control throttling,
         * but only if it's not an initial file-based config. See CCBC-482 */
        bs->last_refresh = gethrtime();
        bs->errcounter = 0;
    }

    if (info->origin == LCB_CLCONFIG_CCCP) {
        /* Disable HTTP provider if we've received something via CCCP */

        if (instance->cur_configinfo == NULL ||
                instance->cur_configinfo->origin != LCB_CLCONFIG_HTTP) {
            /* Never disable HTTP if it's still being used */
            lcb_confmon_set_provider_active(
                instance->confmon, LCB_CLCONFIG_HTTP, 0);
        }
    }

    if (instance->type != LCB_TYPE_CLUSTER) {
        lcb_update_vbconfig(instance, info);
    }

    if (!bs->bootstrapped) {
        bs->bootstrapped = 1;
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);

        if (instance->type == LCB_TYPE_BUCKET &&
                LCBVB_DISTTYPE(LCBT_VBCONFIG(instance)) == LCBVB_DIST_KETAMA &&
                instance->cur_configinfo->origin != LCB_CLCONFIG_MCRAW) {

            lcb_log(LOGARGS(instance, INFO), "Reverting to HTTP Config for memcached buckets");
            instance->settings->bc_http_stream_time = -1;
            lcb_confmon_set_provider_active(
                instance->confmon, LCB_CLCONFIG_HTTP, 1);
            lcb_confmon_set_provider_active(
                instance->confmon, LCB_CLCONFIG_CCCP, 0);
        }
        instance->callbacks.bootstrap(instance, LCB_SUCCESS);
    }

    lcb_maybe_breakout(instance);
}


static void
initial_bootstrap_error(lcb_t instance, lcb_error_t err, const char *errinfo)
{
    struct lcb_BOOTSTRAP *bs = instance->bootstrap;

    instance->last_error = lcb_confmon_last_error(instance->confmon);
    if (instance->last_error == LCB_SUCCESS) {
        instance->last_error = err;
    }
    instance->callbacks.error(instance, instance->last_error, errinfo);
    lcb_log(LOGARGS(instance, ERR), "Failed to bootstrap client=%p. Code=0x%x, Message=%s", (void *)instance, err, errinfo);
    lcbio_timer_disarm(bs->tm);

    instance->callbacks.bootstrap(instance, instance->last_error);

    lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
    lcb_maybe_breakout(instance);
}

/**
 * This it the initial bootstrap timeout handler. This timeout pins down the
 * instance. It is only scheduled during the initial bootstrap and is only
 * triggered if the initial bootstrap fails to configure in time.
 */
static void initial_timeout(void *arg)
{
    struct lcb_BOOTSTRAP *bs = arg;
    initial_bootstrap_error(bs->parent, LCB_ETIMEDOUT, "Failed to bootstrap in time");
}

/**
 * Proxy async call to config_callback
 */
static void async_refresh(void *arg)
{
    /** Get the best configuration and run stuff.. */
    struct lcb_BOOTSTRAP *bs = arg;
    clconfig_info *info;

    info = lcb_confmon_get_config(bs->parent->confmon);
    config_callback(&bs->listener, CLCONFIG_EVENT_GOT_NEW_CONFIG, info);
}

/**
 * set_next listener callback which schedules an async call to our config
 * callback.
 */
static void
async_step_callback(clconfig_listener *listener, clconfig_event_t event,
    clconfig_info *info)
{
    struct lcb_BOOTSTRAP *bs = (struct lcb_BOOTSTRAP *)listener;

    if (event != CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        return;
    }

    if (lcbio_timer_armed(bs->tm) && lcbio_timer_get_target(bs->tm) == async_refresh) {
        lcb_log(LOGARGS(bs->parent, DEBUG), "Timer already present..");
        return;
    }

    lcb_log(LOGARGS(bs->parent, INFO), "Got async step callback..");
    lcbio_timer_set_target(bs->tm, async_refresh);
    lcbio_async_signal(bs->tm);
    (void)info;
}

lcb_error_t
lcb_bootstrap_common(lcb_t instance, int options)
{
    struct lcb_BOOTSTRAP *bs = instance->bootstrap;
    hrtime_t now = gethrtime();

    if (!bs) {
        bs = calloc(1, sizeof(*instance->bootstrap));
        if (!bs) {
            return LCB_CLIENT_ENOMEM;
        }

        bs->tm = lcbio_timer_new(instance->iotable, bs, initial_timeout);
        instance->bootstrap = bs;
        bs->parent = instance;
        lcb_confmon_add_listener(instance->confmon, &bs->listener);
    }

    if (lcb_confmon_is_refreshing(instance->confmon)) {
        return LCB_SUCCESS;
    }

    if (options & LCB_BS_REFRESH_THROTTLE) {
        /* Refresh throttle requested. This is not true if options == ALWAYS */
        hrtime_t next_ts;
        unsigned errthresh = LCBT_SETTING(instance, weird_things_threshold);

        if (options & LCB_BS_REFRESH_INCRERR) {
            bs->errcounter++;
        }
        next_ts = bs->last_refresh;
        next_ts += LCB_US2NS(LCBT_SETTING(instance, weird_things_delay));
        if (now < next_ts && bs->errcounter < errthresh) {
            lcb_log(LOGARGS(instance, INFO),
                "Not requesting a config refresh because of throttling parameters. Next refresh possible in %ums or %u errors. "
                "See LCB_CNTL_CONFDELAY_THRESH and LCB_CNTL_CONFERRTHRESH to modify the throttling settings",
                LCB_NS2US(next_ts-now)/1000, (unsigned)errthresh-bs->errcounter);
            return LCB_SUCCESS;
        }
    }

    if (options == LCB_BS_REFRESH_INITIAL) {
        lcb_confmon_prepare(instance->confmon);

        bs->listener.callback = config_callback;
        lcbio_timer_set_target(bs->tm, initial_timeout);
        lcbio_timer_rearm(bs->tm, LCBT_SETTING(instance, config_timeout));
        lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
    } else {
        /** No initial timer */
        bs->listener.callback = async_step_callback;
    }

    /* Reset the counters */
    bs->errcounter = 0;
    if (options != LCB_BS_REFRESH_INITIAL) {
        bs->last_refresh = now;
    }
    return lcb_confmon_start(instance->confmon);
}

void lcb_bootstrap_destroy(lcb_t instance)
{
    struct lcb_BOOTSTRAP *bs = instance->bootstrap;
    if (!bs) {
        return;
    }
    if (bs->tm) {
        lcbio_timer_destroy(bs->tm);
    }

    lcb_confmon_remove_listener(instance->confmon, &bs->listener);
    free(bs);
    instance->bootstrap = NULL;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_get_bootstrap_status(lcb_t instance)
{
    if (instance->cur_configinfo) {
        return LCB_SUCCESS;
    }
    if (instance->last_error != LCB_SUCCESS) {
        return instance->last_error;
    }
    if (instance->type == LCB_TYPE_CLUSTER) {
        lcbio_SOCKET *restconn = lcb_confmon_get_rest_connection(instance->confmon);
        if (restconn) {
            return LCB_SUCCESS;
        }
    }
    return LCB_ERROR;
}

LIBCOUCHBASE_API
void
lcb_refresh_config(lcb_t instance)
{
    lcb_bootstrap_common(instance, LCB_BS_REFRESH_ALWAYS);
}
