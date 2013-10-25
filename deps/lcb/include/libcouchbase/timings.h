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

/**
 * This file contains the "timing" api used to create histograms of
 * the latency in libcouchbase.
 *
 * @todo this should probably be a "per command type"?
 *
 * @author Trond Norbye
 */
#ifndef LIBCOUCHBASE_TIMINGS_H
#define LIBCOUCHBASE_TIMINGS_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

struct event_base;

#ifdef __cplusplus
extern "C" {
#endif

    /**
     * The stats API may report time in different units
     */
    enum lcb_timeunit_t {
        LCB_TIMEUNIT_NSEC = 0,
        LCB_TIMEUNIT_USEC = 1,
        LCB_TIMEUNIT_MSEC = 2,
        LCB_TIMEUNIT_SEC = 3
    };
    typedef enum lcb_timeunit_t lcb_timeunit_t;

    /**
     * Start recording timing metrics for the different operations.
     * The timer is started when the command is called (and the data
     * spooled to the server), and the execution time is the time until
     * we parse the response packets. This means that you can affect
     * the timers by doing a lot of other stuff before checking if
     * there is any results available..
     *
     * @param instance the handle to lcb
     * @return Status of the operation.
     */
    LIBCOUCHBASE_API
    lcb_error_t lcb_enable_timings(lcb_t instance);


    /**
     * Stop recording (and release all resources from previous measurements)
     * timing metrics.
     *
     * @param instance the handle to lcb
     * @return Status of the operation.
     */
    LIBCOUCHBASE_API
    lcb_error_t lcb_disable_timings(lcb_t instance);

    /**
     * The following function is called for each bucket in the timings
     * histogram when you call lcb_get_timings.
     * You are guaranteed that the callback will be called with the
     * lowest [min,max] range first.
     *
     * @param instance the handle to lcb
     * @param cookie the cookie you provided that allows you to pass
     *               arbitrary user data to the callback
     * @param timeunit the "scale" for the values
     * @param min The lower bound for this histogram bucket
     * @param max The upper bound for this histogram bucket
     * @param total The number of hits in this histogram bucket
     * @param maxtotal The highest value in all of the buckets
     */
    typedef void (*lcb_timings_callback)(lcb_t instance,
                                         const void *cookie,
                                         lcb_timeunit_t timeunit,
                                         lcb_uint32_t min,
                                         lcb_uint32_t max,
                                         lcb_uint32_t total,
                                         lcb_uint32_t maxtotal);

    /**
     * Get the timings histogram
     *
     * @param instance the handle to lcb
     * @param cookie a cookie that will be present in all of the callbacks
     * @return Status of the operation.
     */
    LIBCOUCHBASE_API
    lcb_error_t lcb_get_timings(lcb_t instance,
                                const void *cookie,
                                lcb_timings_callback callback);

#ifdef __cplusplus
}
#endif

#endif
