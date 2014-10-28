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
    /** Interval */
    lcb_uint32_t usec_;

    /** Internal state of the timer */
    lcb_timer_state state;

    /** Options for the timer itself. Do not modify */
    lcb_timer_options options;

    /** Handle for the IO Plugin */
    void *event;

    /** User data */
    const void *cookie;

    /** Callback to invoke */
    lcb_timer_callback callback;

    /** Note that 'instance' may be NULL in this case */
    lcb_t instance;

    /** IO instance pointer */
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
lcb_error_t lcb_timer_destroy(lcb_t instance, lcb_timer_t timer)
{
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


static void timer_disarm(lcb_timer_t timer)
{
    if (!TMR_IS_ARMED(timer)) {
        return;
    }

    timer->state &= ~LCB_TIMER_S_ARMED;
    timer->io->timer.cancel(timer->io->p, timer->event);
}

static void timer_rearm(lcb_timer_t timer, lcb_uint32_t usec)
{
    if (TMR_IS_ARMED(timer)) {
        timer_disarm(timer);
    }

    timer->usec_ = usec;
    timer->io->timer.schedule(timer->io->p, timer->event,
                              usec, timer, timer_callback);
    timer->state |= LCB_TIMER_S_ARMED;
}

#if defined(__clang__) || __GNUC__ > 4 || (__GNUC__ == 4 && __GNUC_MINOR__ >= 6)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wdeprecated-declarations"
#endif
LCB_INTERNAL_API void lcb__timer_destroy_nowarn(lcb_t instance, lcb_timer_t timer) {
    lcb_timer_destroy(instance, timer);
}
