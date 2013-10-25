/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_BEHAVIOR_H
#define LIBCOUCHBASE_BEHAVIOR_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

#ifdef __cplusplus
extern "C" {
#endif

    LIBCOUCHBASE_API
    void lcb_behavior_set_syncmode(lcb_t instance, lcb_syncmode_t syncmode);

    LIBCOUCHBASE_API
    lcb_syncmode_t lcb_behavior_get_syncmode(lcb_t instance);

    LIBCOUCHBASE_API
    void lcb_behavior_set_ipv6(lcb_t instance, lcb_ipv6_t mode);

    LIBCOUCHBASE_API
    lcb_ipv6_t lcb_behavior_get_ipv6(lcb_t instance);

    /**
     * Set the maximum number of error events allowed on the data socket
     * paired with config port, to consider node suspicious and to force
     * reconnection. This feature is solving issues when node is gone
     * without proper socket close.
     */
    LIBCOUCHBASE_API
    void lcb_behavior_set_config_errors_threshold(lcb_t instance, lcb_size_t num_events);

    LIBCOUCHBASE_API
    lcb_size_t lcb_behavior_get_config_errors_threshold(lcb_t instance);

#ifdef __cplusplus
}
#endif

#endif
