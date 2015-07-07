/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2013 Couchbase, Inc.
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
#include <lcbio/timer-ng.h>

static int
has_pending(lcb_t instance)
{
    unsigned ii;

    if (!lcb_retryq_empty(instance->retryq)) {
        return 1;
    }

    if (lcb_aspend_pending(&instance->pendops)) {
        return 1;
    }

    for (ii = 0; ii < LCBT_NSERVERS(instance); ii++) {
        mc_SERVER *ss = LCBT_GET_SERVER(instance, ii);
        if (mcserver_has_pending(ss)) {
            return 1;
        }
    }
    return 0;
}

static void
maybe_reset_timeouts(lcb_t instance)
{
    size_t ii;
    lcb_U64 now;

    if (!LCBT_SETTING(instance, readj_ts_wait)) {
        return;
    }

    now = lcb_nstime();
    for (ii = 0; ii < LCBT_NSERVERS(instance); ++ii) {
        mc_SERVER *ss = LCBT_GET_SERVER(instance, ii);
        mcreq_reset_timeouts(&ss->pipeline, now);
    }
    lcb_retryq_reset_timeouts(instance->retryq, now);
}

void
lcb_maybe_breakout(lcb_t instance)
{
    if (!instance->wait) {
        return;
    }
    if (has_pending(instance)) {
        return;
    }

    instance->wait = 0;
    instance->iotable->loop.stop(IOT_ARG(instance->iotable));
}

/**
 * Returns non zero if the event loop is running now
 *
 * @param instance the instance to run the event loop for.
 */
LIBCOUCHBASE_API
int lcb_is_waiting(lcb_t instance)
{
    return instance->wait != 0;
}

/**
 * Run the event loop until we've got a response for all of our spooled
 * commands. You should not call this function from within your callbacks.
 *
 * @param instance the instance to run the event loop for.
 *
 * @author Trond Norbye
 */
LIBCOUCHBASE_API
lcb_error_t lcb_wait(lcb_t instance)
{
    if (instance->wait != 0) {
        return instance->last_error;
    }

    if (!has_pending(instance)) {
        return LCB_SUCCESS;
    }

    maybe_reset_timeouts(instance);
    instance->last_error = LCB_SUCCESS;
    instance->wait = 1;
    IOT_START(instance->iotable);
    instance->wait = 0;

    if (LCBT_VBCONFIG(instance)) {
        return LCB_SUCCESS;
    }

    return instance->last_error;
}

LIBCOUCHBASE_API
lcb_error_t lcb_tick_nowait(lcb_t instance)
{
    lcb_io_tick_fn tick = instance->iotable->loop.tick;
    if (!tick) {
        return LCB_CLIENT_FEATURE_UNAVAILABLE;
    } else {
        maybe_reset_timeouts(instance);
        tick(IOT_ARG(instance->iotable));
        return LCB_SUCCESS;
    }
}

LIBCOUCHBASE_API
void lcb_wait3(lcb_t instance, lcb_WAITFLAGS flags)
{
    if (flags == LCB_WAIT_DEFAULT) {
        if (instance->wait) {
            return;
        }
        if (has_pending(instance)) {
            return;
        }
    }

    maybe_reset_timeouts(instance);
    instance->wait = 1;
    IOT_START(instance->iotable);
    instance->wait = 0;
}

/**
 * Stop event loop
 *
 * @param instance the instance to run the event loop for.
 */
LIBCOUCHBASE_API
void lcb_breakout(lcb_t instance)
{
    if (instance->wait) {
        IOT_STOP(instance->iotable);
        instance->wait = 0;
    }
}
