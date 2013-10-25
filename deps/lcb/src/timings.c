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

/**
 * Timing data in libcouchbase is stored in a structure to make
 * it easy to work with. It ill consume a fair amount of data,
 * but it's only allocated when you enable it ;-)
 * I decided I'd rather just make it easy to work with...
 */
struct lcb_histogram_st {
    /**
     * The highest value in all of the buckets
     */
    lcb_uint32_t max;
    /**
     * The first bucket is the nano-second batches.. it contains
     * all operations that was completed in < 1usec..
     */
    lcb_uint32_t nsec;
    /**
     * We're collecting measurements on a per 10 usec
     */
    lcb_uint32_t usec[100];
    /**
     * We're collecting measurements on a per 10 msec
     */
    lcb_uint32_t msec[100];
    /**
     * Seconds are collected per sec
     */
    lcb_uint32_t sec[10];
};

LIBCOUCHBASE_API
lcb_error_t lcb_enable_timings(lcb_t instance)
{
    if (instance->histogram != NULL) {
        return LCB_KEY_EEXISTS;
    }

    instance->histogram = calloc(1, sizeof(*instance->histogram));
    return instance->histogram == NULL ? LCB_CLIENT_ENOMEM : LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t lcb_disable_timings(lcb_t instance)
{
    if (instance->histogram == NULL) {
        return LCB_KEY_ENOENT;
    }

    free(instance->histogram);
    instance->histogram = NULL;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t lcb_get_timings(lcb_t instance,
                            const void *cookie,
                            lcb_timings_callback callback)
{
    lcb_uint32_t max;
    lcb_uint32_t start;
    lcb_uint32_t ii;
    lcb_uint32_t end;

    if (instance->histogram == NULL) {
        return LCB_KEY_ENOENT;
    }

    max = instance->histogram->max;
    /*
    ** @todo I should merge "empty" sets.. currently I'm only going to
    ** report the nonzero ones...
    */
    if (instance->histogram->nsec) {
        callback(instance, cookie, LCB_TIMEUNIT_NSEC, 0, 999,
                 instance->histogram->nsec, max);
    }

    start = 1;
    for (ii = 0; ii < 100; ++ii) {
        end = (ii + 1) * 10 - 1;
        if (instance->histogram->usec[ii]) {
            callback(instance, cookie, LCB_TIMEUNIT_USEC, start, end,
                     instance->histogram->usec[ii], max);
        }
        start = end + 1;
    }

    start = 1;
    for (ii = 0; ii < 100; ++ii) {
        end = (ii + 1) * 10 - 1;
        if (instance->histogram->msec[ii]) {
            callback(instance, cookie, LCB_TIMEUNIT_MSEC, start, end,
                     instance->histogram->msec[ii], max);
        }
        start = end + 1;
    }

    start = 1;
    for (ii = 0; ii < 9; ++ii) {
        end = ii + 1;
        if (instance->histogram->sec[ii]) {
            callback(instance, cookie, LCB_TIMEUNIT_SEC, start, end,
                     instance->histogram->sec[ii], max);
        }
        start = end + 1;
    }

    if (instance->histogram->sec[9]) {
        callback(instance, cookie, LCB_TIMEUNIT_SEC, 9, 99999,
                 instance->histogram->sec[9], max);
    }
    return LCB_SUCCESS;
}

void lcb_record_metrics(lcb_t instance,
                        hrtime_t delta,
                        uint8_t opcode)
{
    int ii;
    (void)opcode;
    if (instance->histogram == NULL) {
        return;
    }

    ii = 0;
    while (delta > 1000 && ii < 4) {
        ++ii;
        delta /= 1000;
    }

    switch (ii) {
    case 0:
        if (++instance->histogram->nsec > instance->histogram->max) {
            instance->histogram->max = instance->histogram->nsec;
        }
        break;
    case 1:
        if (++instance->histogram->usec[delta / 10] > instance->histogram->max) {
            instance->histogram->max = instance->histogram->usec[delta / 10];
        }
        break;
    case 2:
        if (++instance->histogram->msec[delta / 10] > instance->histogram->max) {
            instance->histogram->max = instance->histogram->msec[delta / 10];
        }
        break;
    default:
        if (delta < 9) {
            if (++instance->histogram->sec[delta] > instance->histogram->max) {
                instance->histogram->max = instance->histogram->sec[delta];
            }
        } else {
            if (++instance->histogram->sec[9] > instance->histogram->max) {
                instance->histogram->max = instance->histogram->sec[9];
            }
        }
    }
}
