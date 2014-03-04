#include "internal.h"
#include "bucketconfig/clconfig.h"

struct lcb_bootstrap_st {
    clconfig_listener listener;
    lcb_t parent;
    lcb_timer_t timer;
    hrtime_t last_refresh;

    /** Flag set if we've already bootstrapped */
    int bootstrapped;
};

#define LOGARGS(instance, lvl) \
    &instance->settings, "bootstrap", LCB_LOG_##lvl, __FILE__, __LINE__

static void async_step_callback(clconfig_listener *listener,
                                clconfig_event_t event,
                                clconfig_info *info);

static void initial_bootstrap_error(lcb_t instance,
                                    lcb_error_t err,
                                    const char *msg);

/**
 * This function is where the configuration actually takes place. We ensure
 * in other functions that this is only ever called directly from an event
 * loop stack frame (or one of the small mini functions here) so that we
 * don't accidentally end up destroying resources underneath us.
 */
static void config_callback(clconfig_listener *listener,
                            clconfig_event_t event,
                            clconfig_info *info)
{
    struct lcb_bootstrap_st *bs = (struct lcb_bootstrap_st *)listener;
    lcb_t instance = bs->parent;

    if (event != CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        if (event == CLCONFIG_EVENT_PROVIDERS_CYCLED) {
            if (!instance->vbucket_config) {
                initial_bootstrap_error(instance,
                                        LCB_ERROR,
                                        "No more bootstrap providers remain");
            }
        }
        return;
    }

    instance->last_error = LCB_SUCCESS;
    /** Ensure we're not called directly twice again */
    listener->callback = async_step_callback;

    if (bs->timer) {
        lcb_timer_destroy(instance, bs->timer);
        bs->timer = NULL;
    }

    lcb_log(LOGARGS(instance, DEBUG), "Instance configured!");

    if (instance->type != LCB_TYPE_CLUSTER) {
        lcb_update_vbconfig(instance, info);
    }

    if (!bs->bootstrapped) {
        bs->bootstrapped = 1;
        if (instance->type == LCB_TYPE_BUCKET &&
                instance->dist_type == VBUCKET_DISTRIBUTION_KETAMA) {
            lcb_log(LOGARGS(instance, INFO),
                    "Reverting to HTTP Config for memcached buckets");

            /** Memcached bucket */
            instance->settings.bc_http_stream_time = -1;
            lcb_confmon_set_provider_active(instance->confmon,
                                            LCB_CLCONFIG_HTTP, 1);

            lcb_confmon_set_provider_active(instance->confmon,
                                            LCB_CLCONFIG_CCCP, 0);
        }
    }

    lcb_maybe_breakout(instance);
}


static void initial_bootstrap_error(lcb_t instance,
                                    lcb_error_t err,
                                    const char *errinfo)
{
    instance->last_error = lcb_confmon_last_error(instance->confmon);
    if (instance->last_error == LCB_SUCCESS) {
        instance->last_error = err;
    }

    lcb_error_handler(instance, instance->last_error, errinfo);
    lcb_log(LOGARGS(instance, ERR),
            "Failed to bootstrap client=%p. Code=0x%x, Message=%s",
            (void *)instance, err, errinfo);
    if (instance->bootstrap->timer) {
        lcb_timer_destroy(instance, instance->bootstrap->timer);
        instance->bootstrap->timer = NULL;
    }

    lcb_maybe_breakout(instance);
}

/**
 * This it the initial bootstrap timeout handler. This timeout pins down the
 * instance. It is only scheduled during the initial bootstrap and is only
 * triggered if the initial bootstrap fails to configure in time.
 */
static void initial_timeout(lcb_timer_t timer, lcb_t instance,
                            const void *unused)
{
    initial_bootstrap_error(instance,
                            LCB_ETIMEDOUT,
                            "Failed to bootstrap in time");
    (void)timer;
    (void)unused;
}

/**
 * Proxy async call to config_callback
 */
static void async_refresh(lcb_timer_t timer, lcb_t unused, const void *cookie)
{
    /** Get the best configuration and run stuff.. */
    struct lcb_bootstrap_st *bs = (struct lcb_bootstrap_st *)cookie;
    clconfig_info *info;

    info = lcb_confmon_get_config(bs->parent->confmon);
    config_callback(&bs->listener, CLCONFIG_EVENT_GOT_NEW_CONFIG, info);

    (void)unused;
    (void)timer;
}

/**
 * set_next listener callback which schedules an async call to our config
 * callback.
 */
static void async_step_callback(clconfig_listener *listener,
                                clconfig_event_t event,
                                clconfig_info *info)
{
    lcb_error_t err;
    struct lcb_bootstrap_st *bs = (struct lcb_bootstrap_st *)listener;

    if (event != CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        return;
    }

    if (bs->timer) {
        lcb_log(LOGARGS(bs->parent, DEBUG), "Timer already present..");
        return;
    }

    lcb_log(LOGARGS(bs->parent, INFO), "Got async step callback..");

    bs->timer = lcb_async_create(bs->parent->settings.io,
                                 bs, async_refresh, &err);

    (void)info;
}

static lcb_error_t bootstrap_common(lcb_t instance, int initial)
{
    struct lcb_bootstrap_st *bs = instance->bootstrap;

    if (bs && lcb_confmon_is_refreshing(instance->confmon)) {
        return LCB_SUCCESS;
    }

    if (!bs) {
        bs = calloc(1, sizeof(*instance->bootstrap));
        if (!bs) {
            return LCB_CLIENT_ENOMEM;
        }

        instance->bootstrap = bs;
        bs->parent = instance;
        lcb_confmon_add_listener(instance->confmon, &bs->listener);
    }

    bs->last_refresh = gethrtime();

    if (initial) {
        lcb_error_t err;
        bs->listener.callback = config_callback;
        bs->timer = lcb_timer_create(instance, NULL,
                                     instance->settings.config_timeout, 0,
                                     initial_timeout, &err);
        if (err != LCB_SUCCESS) {
            return err;
        }

    } else {
        /** No initial timer */
        bs->listener.callback = async_step_callback;
    }

    return lcb_confmon_start(instance->confmon);
}

lcb_error_t lcb_bootstrap_initial(lcb_t instance)
{
    lcb_confmon_prepare(instance->confmon);
    return bootstrap_common(instance, 1);
}

lcb_error_t lcb_bootstrap_refresh(lcb_t instance)
{
    return bootstrap_common(instance, 0);
}

void lcb_bootstrap_errcount_incr(lcb_t instance)
{
    int should_refresh = 0;
    hrtime_t now = gethrtime();
    instance->weird_things++;

    if (now - instance->bootstrap->last_refresh >
            LCB_US2NS(instance->settings.weird_things_delay)) {

        lcb_log(LOGARGS(instance, INFO),
                "Max grace period for refresh exceeded");
        should_refresh = 1;
    }

    if (instance->weird_things == instance->settings.weird_things_threshold) {
        should_refresh = 1;
    }

    if (!should_refresh) {
        return;
    }

    instance->weird_things = 0;
    lcb_bootstrap_refresh(instance);
}

void lcb_bootstrap_destroy(lcb_t instance)
{
    struct lcb_bootstrap_st *bs = instance->bootstrap;
    if (!bs) {
        return;
    }

    if (bs->timer) {
        lcb_timer_destroy(instance, bs->timer);
    }

    lcb_confmon_remove_listener(instance->confmon, &bs->listener);
    free(bs);
    instance->bootstrap = NULL;
}
