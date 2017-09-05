/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2014 Couchbase, Inc.
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
#include <lcbio/iotable.h>

#if defined(__clang__) || __GNUC__ > 4 || (__GNUC__ == 4 && __GNUC_MINOR__ >= 2)
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif

typedef enum {
    LCB_TIMER_STANDALONE = 1 << 0,
    LCB_TIMER_PERIODIC = 1 << 1,
    LCB_TIMER_EX = 1 << 2
} lcb_timer_options;

typedef enum {
    LCB_TIMER_S_ENTERED = 0x01,
    LCB_TIMER_S_DESTROYED = 0x02,
    LCB_TIMER_S_ARMED = 0x04
} lcb_timer_state;

struct lcb_timer_st {
    lcb_uint32_t usec_;
    lcb_timer_state state;
    lcb_timer_options options;
    void *event;
    const void *cookie;
    lcb_timer_callback callback;
    lcb_t instance;
    struct lcbio_TABLE *io;
};

static void timer_rearm(lcb_timer_t timer, lcb_uint32_t usec);
static void timer_disarm(lcb_timer_t timer);
#define lcb_timer_armed(timer) ((timer)->state & LCB_TIMER_S_ARMED)
#define lcb_async_signal(async) lcb_timer_rearm(async, 0)
#define lcb_async_cancel(async) lcb_timer_disarm(async)
#define TMR_IS_PERIODIC(timer) ((timer)->options & LCB_TIMER_PERIODIC)
#define TMR_IS_DESTROYED(timer) ((timer)->state & LCB_TIMER_S_DESTROYED)
#define TMR_IS_STANDALONE(timer) ((timer)->options & LCB_TIMER_STANDALONE)
#define TMR_IS_ARMED(timer) ((timer)->state & LCB_TIMER_S_ARMED)

static void destroy_timer(lcb_timer_t timer) {
    if (timer->event) {
        timer->io->timer.destroy(timer->io->p, timer->event);
    }
    lcbio_table_unref(timer->io);
    memset(timer, 0xff, sizeof(*timer));
    free(timer);
}

static void timer_callback(lcb_socket_t sock, short which, void *arg) {
    lcb_timer_t timer = arg;
    lcb_t instance = timer->instance;

    lcb_assert(TMR_IS_ARMED(timer));
    lcb_assert(!TMR_IS_DESTROYED(timer));

    timer->state |= LCB_TIMER_S_ENTERED;
    timer_disarm(timer);
    timer->callback(timer, instance, timer->cookie);

    if (TMR_IS_DESTROYED(timer) == 0 && TMR_IS_PERIODIC(timer) != 0) {
        timer_rearm(timer, timer->usec_);
        return;
    }
    if (! TMR_IS_STANDALONE(timer)) {
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_TIMER, timer);
        lcb_maybe_breakout(instance);
    }
    if (TMR_IS_DESTROYED(timer)) {
        destroy_timer(timer);
    } else {
        timer->state &= ~LCB_TIMER_S_ENTERED;
    }
    (void)sock;(void)which;
}

LIBCOUCHBASE_API
lcb_timer_t lcb_timer_create(lcb_t instance, const void *command_cookie, lcb_uint32_t usec, int periodic, lcb_timer_callback callback, lcb_error_t *error) {
    lcb_timer_options options = 0;
    lcb_timer_t tmr = calloc(1, sizeof(struct lcb_timer_st));
    tmr->io = instance->iotable;

    if (periodic) {
        options |= LCB_TIMER_PERIODIC;
    }
    if (!tmr) {
        *error = LCB_CLIENT_ENOMEM;
        return NULL;
    }
    if (!callback) {
        free(tmr);
        *error = LCB_EINVAL;
        return NULL;
    }
    if (! (options & LCB_TIMER_STANDALONE)) {
        lcb_assert(instance);
    }

    lcbio_table_ref(tmr->io);
    tmr->instance = instance;
    tmr->callback = callback;
    tmr->cookie = command_cookie;
    tmr->options = options;
    tmr->event = tmr->io->timer.create(tmr->io->p);

    if (tmr->event == NULL) {
        free(tmr);
        *error = LCB_CLIENT_ENOMEM;
        return NULL;
    }

    if ( (options & LCB_TIMER_STANDALONE) == 0) {
        lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_TIMER, tmr);
    }

    timer_rearm(tmr, usec);

    *error = LCB_SUCCESS;
    return tmr;
}

LIBCOUCHBASE_API
lcb_error_t lcb_timer_destroy(lcb_t instance, lcb_timer_t timer) {
    int standalone = timer->options & LCB_TIMER_STANDALONE;
    if (!standalone) {
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_TIMER, timer);
    }
    timer_disarm(timer);
    if (timer->state & LCB_TIMER_S_ENTERED) {
        timer->state |= LCB_TIMER_S_DESTROYED;
        lcb_assert(TMR_IS_DESTROYED(timer));
    } else {
        destroy_timer(timer);
    }
    return LCB_SUCCESS;
}
static void timer_disarm(lcb_timer_t timer) {
    if (!TMR_IS_ARMED(timer)) {
        return;
    }
    timer->state &= ~LCB_TIMER_S_ARMED;
    timer->io->timer.cancel(timer->io->p, timer->event);
}
static void timer_rearm(lcb_timer_t timer, lcb_uint32_t usec) {
    if (TMR_IS_ARMED(timer)) {
        timer_disarm(timer);
    }
    timer->usec_ = usec;
    timer->io->timer.schedule(timer->io->p, timer->event, usec, timer, timer_callback);
    timer->state |= LCB_TIMER_S_ARMED;
}

LCB_INTERNAL_API void lcb__timer_destroy_nowarn(lcb_t instance, lcb_timer_t timer) {
    lcb_timer_destroy(instance, timer);
}

struct user_cookie {
    void *cookie;
    struct lcb_callback_st callbacks;
    lcb_error_t retcode;
};

static void restore_user_env(lcb_t instance);
static void restore_wrapping_env(lcb_t instance, struct user_cookie *user, lcb_error_t error);
static void bootstrap_callback(lcb_t instance, lcb_error_t err) {
    struct user_cookie *c = (void *)instance->cookie;
    c->retcode = err;
}
static void stat_callback(lcb_t instance, const void *command_cookie, lcb_error_t error, const lcb_server_stat_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.stat(instance, command_cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void version_callback(lcb_t instance, const void *command_cookie, lcb_error_t error, const lcb_server_version_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.version(instance, command_cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void verbosity_callback(lcb_t instance, const void *command_cookie, lcb_error_t error, const lcb_verbosity_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.verbosity(instance, command_cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void get_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_get_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.get(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void store_callback(lcb_t instance, const void *cookie, lcb_storage_t operation, lcb_error_t error, const lcb_store_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.store(instance, cookie, operation, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void arithmetic_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_arithmetic_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.arithmetic(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void remove_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_remove_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.remove(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void touch_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_touch_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.touch(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void http_complete_callback(lcb_http_request_t request, lcb_t instance, const void *cookie, lcb_error_t error, const lcb_http_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.http_complete(request, instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void http_data_callback(lcb_http_request_t request, lcb_t instance, const void *cookie, lcb_error_t error, const lcb_http_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.http_data(request, instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void flush_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_flush_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.flush(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void observe_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_observe_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.observe(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void durability_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_durability_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.durability(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void unlock_callback(lcb_t instance, const void *cookie, lcb_error_t error, const lcb_unlock_resp_t *resp) {
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.unlock(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
}
static void restore_user_env(lcb_t instance) {
    struct user_cookie *cookie = (void *)instance->cookie;
    /* Restore the users environment */
    instance->cookie = cookie->cookie;
    instance->callbacks = cookie->callbacks;
}

static void
restore_wrapping_env(lcb_t instance, struct user_cookie *user, lcb_error_t error) {
    user->callbacks = instance->callbacks;
    /* Install new callbacks */
    instance->callbacks.get = get_callback;
    instance->callbacks.store = store_callback;
    instance->callbacks.arithmetic = arithmetic_callback;
    instance->callbacks.remove = remove_callback;
    instance->callbacks.stat = stat_callback;
    instance->callbacks.version = version_callback;
    instance->callbacks.verbosity = verbosity_callback;
    instance->callbacks.touch = touch_callback;
    instance->callbacks.flush = flush_callback;
    instance->callbacks.bootstrap = bootstrap_callback;
    instance->callbacks.http_complete = http_complete_callback;
    instance->callbacks.http_data = http_data_callback;
    instance->callbacks.observe = observe_callback;
    instance->callbacks.unlock = unlock_callback;
    instance->callbacks.durability = durability_callback;

    user->cookie = (void *)instance->cookie;
    user->retcode = error;
    instance->cookie = user;
}

lcb_error_t
lcb__synchandler_return(lcb_t instance)
{
    struct user_cookie cookie;
    restore_wrapping_env(instance, &cookie, LCB_SUCCESS);
    lcb_wait(instance);
    restore_user_env(instance);
    return cookie.retcode;
}

LIBCOUCHBASE_API
void
lcb_behavior_set_syncmode(lcb_t instance, lcb_syncmode_t mode)
{
    LCBT_SETTING(instance, syncmode) = mode;
}
LIBCOUCHBASE_API
lcb_syncmode_t
lcb_behavior_get_syncmode(lcb_t instance)
{
    return LCBT_SETTING(instance, syncmode);
}

LIBCOUCHBASE_API
lcb_error_t lcb_get_last_error(lcb_t instance){return instance->last_error;}

LIBCOUCHBASE_API
lcb_error_t lcb__create_compat_230(lcb_cluster_t type, const void *specific, lcb_t *instance, struct lcb_io_opt_st *io)
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
lcb_error_t lcb_create_compat(lcb_cluster_t type, const void *specific, lcb_t *instance, struct lcb_io_opt_st *io);
LIBCOUCHBASE_API
lcb_error_t lcb_create_compat(lcb_cluster_t type, const void *specific, lcb_t *instance, struct lcb_io_opt_st *io)
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

LIBCOUCHBASE_API
lcb_error_t lcb_verify_struct_size(lcb_U32 id, lcb_U32 version, lcb_SIZE size)
{
    #define X(sname, sabbrev, idval, vernum) \
    if (idval == id && size == sizeof(sname) && version <= vernum) { return LCB_SUCCESS; }
    LCB_XSSIZES(X);
    #undef X
    return LCB_EINVAL;
}
