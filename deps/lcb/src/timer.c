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
#include <lcbio/iotable.h>

#define TMR_IS_PERIODIC(timer) ((timer)->options & LCB_TIMER_PERIODIC)
#define TMR_IS_DESTROYED(timer) ((timer)->state & LCB_TIMER_S_DESTROYED)
#define TMR_IS_STANDALONE(timer) ((timer)->options & LCB_TIMER_STANDALONE)
#define TMR_IS_ARMED(timer) ((timer)->state & LCB_TIMER_S_ARMED)

static void destroy_timer(lcb_timer_t timer)
{
    if (timer->event) {
        timer->io->timer.destroy(timer->io->p, timer->event);
    }
    lcbio_table_unref(timer->io);
    memset(timer, 0xff, sizeof(*timer));
    free(timer);
}

static void timer_callback(lcb_socket_t sock, short which, void *arg)
{
    lcb_timer_t timer = arg;
    lcb_t instance = timer->instance;

    lcb_assert(TMR_IS_ARMED(timer));
    lcb_assert(!TMR_IS_DESTROYED(timer));

    timer->state |= LCB_TIMER_S_ENTERED;

    lcb_timer_disarm(timer);
    timer->callback(timer, instance, timer->cookie);

    if (TMR_IS_DESTROYED(timer) == 0 && TMR_IS_PERIODIC(timer) != 0) {
        lcb_timer_rearm(timer, timer->usec_);
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
    return lcb_timer_create2(instance->iotable,
                             command_cookie,
                             usec,
                             periodic ? LCB_TIMER_PERIODIC : 0,
                             callback,
                             instance,
                             error);
}

LCB_INTERNAL_API
lcb_async_t lcb_async_create(lcbio_TABLE *iotable,
                             const void *command_cookie,
                             lcb_timer_callback callback,
                             lcb_error_t *error)
{
    return lcb_timer_create2(iotable,
                             command_cookie, 0,
                             LCB_TIMER_STANDALONE,
                             callback,
                             NULL,
                             error);
}

LCB_INTERNAL_API
lcb_timer_t lcb_timer_create_simple(lcbio_TABLE *iotable,
                                    const void *cookie,
                                    lcb_uint32_t usec,
                                    lcb_timer_callback callback)
{
    lcb_error_t err;
    lcb_timer_t ret;
    ret = lcb_timer_create2(iotable,
                            cookie,
                            usec,
                            LCB_TIMER_STANDALONE, callback, NULL, &err);
    if (err != LCB_SUCCESS) {
        return NULL;
    }
    return ret;
}

LCB_INTERNAL_API
lcb_timer_t lcb_timer_create2(lcbio_TABLE *io,
                              const void *cookie,
                              lcb_uint32_t usec,
                              lcb_timer_options options,
                              lcb_timer_callback callback,
                              lcb_t instance,
                              lcb_error_t *error)
{
    lcb_timer_t tmr = calloc(1, sizeof(struct lcb_timer_st));
    tmr->io = io;

    if (!tmr) {
        *error = LCB_CLIENT_ENOMEM;
        return NULL;
    }
    if (!callback) {
        *error = LCB_EINVAL;
        return NULL;
    }

    if (! (options & LCB_TIMER_STANDALONE)) {
        lcb_assert(instance);
    }

    lcbio_table_ref(tmr->io);
    tmr->instance = instance;
    tmr->callback = callback;
    tmr->cookie = cookie;
    tmr->options = options;
    tmr->event = io->timer.create(io->p);

    if (tmr->event == NULL) {
        free(tmr);
        *error = LCB_CLIENT_ENOMEM;
        return NULL;
    }

    if ( (options & LCB_TIMER_STANDALONE) == 0) {
        lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_TIMER, tmr);
    }

    lcb_timer_rearm(tmr, usec);

    *error = LCB_SUCCESS;
    return tmr;
}

LIBCOUCHBASE_API
lcb_error_t lcb_timer_destroy(lcb_t instance, lcb_timer_t timer)
{
    int standalone = timer->options & LCB_TIMER_STANDALONE;

    if (!standalone) {
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_TIMER, timer);
    }

    lcb_timer_disarm(timer);

    if (timer->state & LCB_TIMER_S_ENTERED) {
        timer->state |= LCB_TIMER_S_DESTROYED;
        lcb_assert(TMR_IS_DESTROYED(timer));
    } else {
        destroy_timer(timer);
    }
    return LCB_SUCCESS;
}

LCB_INTERNAL_API
void lcb_timer_disarm(lcb_timer_t timer)
{
    if (!TMR_IS_ARMED(timer)) {
        return;
    }

    timer->state &= ~LCB_TIMER_S_ARMED;
    timer->io->timer.cancel(timer->io->p, timer->event);
}

LCB_INTERNAL_API
void lcb_timer_rearm(lcb_timer_t timer, lcb_uint32_t usec)
{
    if (TMR_IS_ARMED(timer)) {
        lcb_timer_disarm(timer);
    }

    timer->usec_ = usec;
    timer->io->timer.schedule(timer->io->p, timer->event,
                              usec, timer, timer_callback);
    timer->state |= LCB_TIMER_S_ARMED;
}
