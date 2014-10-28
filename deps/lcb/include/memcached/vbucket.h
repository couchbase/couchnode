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

#ifndef MEMCACHED_VBUCKET_H
#define MEMCACHED_VBUCKET_H 1

#ifdef __cplusplus
extern "C"
{
#endif

typedef enum {
    vbucket_state_active = 1, /**< Actively servicing a vbucket. */
    vbucket_state_replica, /**< Servicing a vbucket as a replica only. */
    vbucket_state_pending, /**< Pending active. */
    vbucket_state_dead /**< Not in use, pending deletion. */
} vbucket_state_t;

#define is_valid_vbucket_state_t(state) \
    (state == vbucket_state_active || \
     state == vbucket_state_replica || \
     state == vbucket_state_pending || \
     state == vbucket_state_dead)

#ifdef __cplusplus
}
#endif
#endif
