/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

#ifndef LCB_BOOTSTRAP_H
#define LCB_BOOTSTRAP_H
#ifdef __cplusplus
extern "C" {
#endif

/**@file
 * Core bootstrap/cluster configuration routines */

/**@defgroup lcb_bootstrap Bootstrap Routines
 * @addtogroup lcb_bootstrap
 * @{
 */

#if defined(__LCB_DOXYGEN__) || defined(LCB_BOOTSTRAP_DEFINE_STRUCT)
#include "bucketconfig/clconfig.h"

/**
 * Structure containing the bootstrap state for the instance.
 */
struct lcb_BOOTSTRAP {
    /**Listener object used to react when a new configuration is received. This
     * is used for both requested configurations (i.e. an explicit call to
     * lcb_bootstrap_common()) as well as unsolicited updates such as
     * HTTP streaming configurations or Not-My-Vbucket "Carrier" updates.
     */
    clconfig_listener listener;

    lcb_t parent;

    /**Timer used for initial bootstrap as an interval timer, and for subsequent
     * updates as an asynchronous event (to allow safe updates and avoid
     * reentrancy issues)
     */
    lcbio_pTIMER tm;

    /**
     * Timestamp indicating the most recent configuration activity. This
     * timestamp is used to control throttling, such that the @ref
     * LCB_CNTL_CONFDELAY_THRESH setting is applied as an offset to this
     * timestamp (accounting for ns-to-us conversion). This flag is set whenever
     *
     * * A new configuration is received (solicited or unsolicited)
     * * A request for a new configuration is made, and the request has not
     *   been throttled
     */
    hrtime_t last_refresh;

    /**
     * Counter incremented each time a request is based to lcb_bootstrap_common()
     * with the @ref LCB_BS_REFRESH_INCRERR flag, and where the request itself
     * had been throttled. This increments the internal error counter and when
     * the counter reaches a threshold higher than @ref LCB_CNTL_CONFERRTHRESH
     * a new configuration is requested.
     * This counter is cleared whenever a new configuration arrives.
     */
    unsigned errcounter;

    /** Flag indicating whether the _initial_ configuration has been received */
    int bootstrapped;
};
#endif

/**
 * These flags control the bootstrap refreshing mode that will take place
 * when lcb_bootstrap_common() is invoked. These options may be OR'd with
 * each other (with the exception of ::LCB_BS_REFRESH_ALWAYS).
 */
typedef enum {
    /** Always fetch a new configuration. No throttling checks are performed */
    LCB_BS_REFRESH_ALWAYS = 0x00,
    /** Special mode used to fetch the first configuration */
    LCB_BS_REFRESH_INITIAL = 0x02,

    /** Make the request for a new configuration subject to throttling
     * limitations. Currently this will be subject to the interval specified
     * in the @ref LCB_CNTL_CONFDELAY_THRESH setting and the @ref
     * LCB_CNTL_CONFERRTHRESH setting. If the refresh has been throttled
     * the lcb_confmon_is_refreshing() function will return false */
    LCB_BS_REFRESH_THROTTLE = 0x04,

    /** To be used in conjunction with ::LCB_BS_REFRESH_THROTTLE, this will
     * increment the error counter in case the current refresh is throttled,
     * such that when the error counter reaches the threshold, the throttle
     * limitations will expire and a new refresh will take place */
    LCB_BS_REFRESH_INCRERR = 0x08
} lcb_BSFLAGS;

/**
 * @brief Request that the handle update its configuration.
 *
 * This function acts as a gateway to the more abstract confmon interface.
 *
 * @param instance The instance
 * @param options A set of options specified as flags, indicating under what
 * conditions a new configuration should be refetched.
 *
 * @return
 */
LCB_INTERNAL_API
lcb_error_t
lcb_bootstrap_common(lcb_t instance, int options);

void
lcb_bootstrap_destroy(lcb_t instance);

/**@}*/

#ifdef __cplusplus
}
#endif
#endif /* LCB_BOOTSTRAP_H */
