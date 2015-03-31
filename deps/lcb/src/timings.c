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

    /**We're collecting measurements for <10ms per 100usec */
    lcb_uint32_t lt10msec[100];

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
    struct lcb_histogram_st *hg = instance->histogram;

    if (hg == NULL) {
        return LCB_KEY_ENOENT;
    }

    max = hg->max;
    /*
    ** @todo I should merge "empty" sets.. currently I'm only going to
    ** report the nonzero ones...
    */
    if (hg->nsec) {
        callback(instance, cookie, LCB_TIMEUNIT_NSEC, 0, 999, hg->nsec, max);
    }

    start = 1;
    for (ii = 0; ii < 100; ++ii) {
        end = (ii + 1) * 10 - 1;
        if (hg->usec[ii]) {
            callback(instance, cookie, LCB_TIMEUNIT_USEC, start, end, hg->usec[ii], max);
        }
        start = end + 1;
    }

    start = 1000;
    for (ii = 0; ii < 100; ++ii) {
        end = (ii + 1) * 100 - 1;
        if (hg->lt10msec[ii]) {
            callback(instance, cookie, LCB_TIMEUNIT_USEC, start, end, hg->lt10msec[ii], max);
        }
        start = end + 1;
    }

    start = 1;
    for (ii = 0; ii < 100; ++ii) {
        end = (ii + 1) * 10 - 1;
        if (hg->msec[ii]) {
            callback(instance, cookie, LCB_TIMEUNIT_MSEC, start, end, hg->msec[ii], max);
        }
        start = end + 1;
    }

    start = 1000;
    for (ii = 1; ii < 9; ++ii) {
        start = ii * 1000;
        end = ((ii + 1) * 1000) - 1;
        if (hg->sec[ii]) {
            callback(instance, cookie, LCB_TIMEUNIT_MSEC, start, end, hg->sec[ii], max);
        }
    }

    if (hg->sec[9]) {
        callback(instance, cookie,
            LCB_TIMEUNIT_SEC, 9, 9999, hg->sec[9], max);
    }
    return LCB_SUCCESS;
}

void lcb_record_metrics(lcb_t instance,
                        hrtime_t delta,
                        uint8_t opcode)
{
    lcb_U32 num;
    struct lcb_histogram_st *hg = instance->histogram;
    if (hg == NULL) {
        return;
    }

    if (delta < 1000) {
        /* nsec */
        if (++hg->nsec > hg->max) {
            hg->max = hg->nsec;
        }
    } else if (delta < LCB_US2NS(1000)) {
        /* micros */
        delta /= LCB_US2NS(1);
        if ((num = ++hg->usec[delta/10]) > hg->max) {
            hg->max = num;
        }
    } else if (delta < LCB_US2NS(10000)) {
        /* 1-10ms */
        delta /= LCB_US2NS(1);
        assert(delta <= 10000);
        if ((num = ++hg->lt10msec[delta/100]) > hg->max) {
            hg->max = num;
        }
    } else if (delta < LCB_S2NS(1)) {
        delta /= LCB_US2NS(1000);
        if ((num = ++hg->msec[delta/10]) > hg->max) {
            hg->max = num;
        }
    } else {
        delta /= LCB_S2NS(1);
        if (delta > 9) {
            delta = 9;
        }

        if ((num = ++hg->sec[delta]) > hg->max) {
            hg->max = num;
        }
    }
    (void)opcode;
}
