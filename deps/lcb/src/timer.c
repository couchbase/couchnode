/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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

static void timer_callback(lcb_socket_t sock, short which, void *arg)
{
    lcb_timer_t timer = arg;
    lcb_t instance = timer->instance;
    timer->callback(timer, instance, timer->cookie);
    if (hashset_is_member(instance->timers, timer) && !timer->periodic) {
        instance->io->v.v0.delete_timer(instance->io, timer->event);
        lcb_timer_destroy(instance, timer);
    }
    lcb_maybe_breakout(instance);

    (void)sock;
    (void)which;
}

LIBCOUCHBASE_API
lcb_timer_t lcb_timer_create(lcb_t instance,
                             const void *command_cookie,
                             lcb_uint32_t usec,
                             int periodic,
                             lcb_timer_callback callback,
                             lcb_error_t *error)

{
    lcb_timer_t tmr = calloc(1, sizeof(struct lcb_timer_st));
    if (!tmr) {
        *error = lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        return NULL;
    }
    if (!callback) {
        *error = lcb_synchandler_return(instance, LCB_EINVAL);
        return NULL;
    }

    tmr->instance = instance;
    tmr->callback = callback;
    tmr->cookie = command_cookie;
    tmr->usec = usec;
    tmr->periodic = periodic;
    tmr->event = instance->io->v.v0.create_timer(instance->io);
    if (tmr->event == NULL) {
        free(tmr);
        *error = lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        return NULL;
    }
    instance->io->v.v0.update_timer(instance->io, tmr->event, tmr->usec,
                                    tmr, timer_callback);


    hashset_add(instance->timers, tmr);
    *error = lcb_synchandler_return(instance, LCB_SUCCESS);
    return tmr;
}

LIBCOUCHBASE_API
lcb_error_t lcb_timer_destroy(lcb_t instance, lcb_timer_t timer)
{
    if (hashset_is_member(instance->timers, timer)) {
        hashset_remove(instance->timers, timer);
        instance->io->v.v0.delete_timer(instance->io, timer->event);
        instance->io->v.v0.destroy_timer(instance->io, timer->event);
        free(timer);
    }
    return lcb_synchandler_return(instance, LCB_SUCCESS);
}
