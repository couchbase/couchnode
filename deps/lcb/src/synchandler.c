/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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

/* @todo add static prototypes */

struct user_cookie {
    void *cookie;
    struct lcb_callback_st callbacks;
    lcb_error_t retcode;
};

static void restore_user_env(lcb_t instance);
static void restore_wrapping_env(lcb_t instance,
                                 struct user_cookie *user,
                                 lcb_error_t error);

static void error_callback(lcb_t instance,
                           lcb_error_t error,
                           const char *errinfo)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.error(instance, error, errinfo);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void stat_callback(lcb_t instance,
                          const void *command_cookie,
                          lcb_error_t error,
                          const lcb_server_stat_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.stat(instance, command_cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void version_callback(lcb_t instance,
                             const void *command_cookie,
                             lcb_error_t error,
                             const lcb_server_version_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.version(instance, command_cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void verbosity_callback(lcb_t instance,
                               const void *command_cookie,
                               lcb_error_t error,
                               const lcb_verbosity_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.verbosity(instance, command_cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void get_callback(lcb_t instance,
                         const void *cookie,
                         lcb_error_t error,
                         const lcb_get_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.get(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}


static void store_callback(lcb_t instance,
                           const void *cookie,
                           lcb_storage_t operation,
                           lcb_error_t error,
                           const lcb_store_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.store(instance, cookie, operation, error, resp);
    restore_wrapping_env(instance, c, error);

    lcb_maybe_breakout(instance);
}

static void arithmetic_callback(lcb_t instance,
                                const void *cookie,
                                lcb_error_t error,
                                const lcb_arithmetic_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.arithmetic(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void remove_callback(lcb_t instance,
                            const void *cookie,
                            lcb_error_t error,
                            const lcb_remove_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.remove(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void touch_callback(lcb_t instance,
                           const void *cookie,
                           lcb_error_t error,
                           const lcb_touch_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.touch(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void http_complete_callback(lcb_http_request_t request,
                                   lcb_t instance,
                                   const void *cookie,
                                   lcb_error_t error,
                                   const lcb_http_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.http_complete(request, instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void http_data_callback(lcb_http_request_t request,
                               lcb_t instance,
                               const void *cookie,
                               lcb_error_t error,
                               const lcb_http_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.http_data(request, instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void flush_callback(lcb_t instance,
                           const void *cookie,
                           lcb_error_t error,
                           const lcb_flush_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.flush(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void observe_callback(lcb_t instance,
                             const void *cookie,
                             lcb_error_t error,
                             const lcb_observe_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.observe(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void durability_callback(lcb_t instance,
                                const void *cookie,
                                lcb_error_t error,
                                const lcb_durability_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;
    restore_user_env(instance);
    c->callbacks.durability(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void unlock_callback(lcb_t instance,
                            const void *cookie,
                            lcb_error_t error,
                            const lcb_unlock_resp_t *resp)
{
    struct user_cookie *c = (void *)instance->cookie;

    restore_user_env(instance);
    c->callbacks.unlock(instance, cookie, error, resp);
    restore_wrapping_env(instance, c, error);
    lcb_maybe_breakout(instance);
}

static void restore_user_env(lcb_t instance)
{
    struct user_cookie *cookie = (void *)instance->cookie;
    /* Restore the users environment */
    instance->cookie = cookie->cookie;
    instance->callbacks = cookie->callbacks;
}

static void restore_wrapping_env(lcb_t instance,
                                 struct user_cookie *user,
                                 lcb_error_t error)
{
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
    instance->callbacks.error = error_callback;
    instance->callbacks.http_complete = http_complete_callback;
    instance->callbacks.http_data = http_data_callback;
    instance->callbacks.observe = observe_callback;
    instance->callbacks.unlock = unlock_callback;
    instance->callbacks.durability = durability_callback;

    user->cookie = (void *)instance->cookie;
    user->retcode = error;
    instance->cookie = user;
}


lcb_error_t lcb_synchandler_return(lcb_t instance, lcb_error_t retcode)
{
    struct user_cookie cookie;

    if (instance->syncmode == LCB_ASYNCHRONOUS ||
            retcode != LCB_SUCCESS) {
        return retcode;
    }

    restore_wrapping_env(instance, &cookie, LCB_SUCCESS);
    lcb_wait(instance);
    restore_user_env(instance);
    return cookie.retcode;
}
