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

#ifndef LCB_DURABILITY_H
#define LCB_DURABILITY_H

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "include <libcouchbase/couchbase.h> first"
#endif

#ifdef __cplusplus
extern "C" {
#endif


    typedef struct lcb_durability_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                size_t nkey;

                /**
                 * Hashkey and hashkey size to use for customized vbucket
                 * mapping
                 */
                const void *hashkey;
                size_t nhashkey;

                /**
                 * CAS to be checked against. If the key exists on the server
                 * with a different CAS, the error (in the response) is set to
                 * LCB_KEY_EEXISTS
                 */
                lcb_cas_t cas;
            } v0;
        } v;
    } lcb_durability_cmd_t;

    /**
     * Public API for durability response
     */
    typedef struct lcb_durability_resp_st {
        int version;
        union {
            struct {
                /** key */
                const void *key;

                /** key length */
                lcb_size_t nkey;

                /**
                 * if this entry failed, this contains the reason, e.g.
                 *
                 * LCB_KEY_EEXISTS: The key exists with a different CAS than expected
                 *
                 * LCB_KEY_ENOENT: The key was not found in the master cache
                 *
                 * LCB_ETIMEDOUT: The key may exist, but the required servers needed
                 *  took too long to respond
                 */
                lcb_error_t err;

                /** if found with a different CAS, this is the CAS */
                lcb_cas_t cas;

                /**
                 * Whether the key was persisted to the master.
                 * For deletes, this means the key was removed from disk
                 */
                unsigned char persisted_master;

                /**
                 * Whether the key exists on the master. For deletes, this means
                 * the key does not exist in cache
                 */
                unsigned char exists_master;

                /** how many nodes (including master) this item was persisted to */
                unsigned char npersisted;

                /** how many nodes (excluding master) this item was replicated to */
                unsigned char nreplicated;

                /**
                 * Total number of observe responses received for the node.
                 * This can be used as a performance metric to determine how many
                 * total OBSERVE probes were sent until this key was 'done'
                 */
                unsigned short nresponses;
            } v0;
        } v;
    } lcb_durability_resp_t;

    /**
     * Options and preferences for a durability check operation
     */
    typedef struct lcb_durability_opts_st {
        int version;
        union {
            struct {
                /**
                 * Upper limit in microseconds from the scheduling of the command. When
                 * this timeout occurs, all remaining non-verified keys will have their
                 * callbacks invoked with @c LCB_ETIMEDOUT
                 */
                lcb_uint32_t timeout;

                /**
                 * The durability check may involve more than a single call to observe - or
                 * more than a single packet sent to a server to check the key status. This
                 * value determines the time to wait between multiple probes for the same
                 * server. If left at 0, a sensible adaptive value will be used.
                 */
                lcb_uint32_t interval;

                /** how many nodes the key should be persisted to (including master) */
                lcb_uint16_t persist_to;

                /** how many nodes the key should be replicated to (excluding master) */
                lcb_uint16_t replicate_to;

                /**
                 * this flag inverts the sense of the durability check and ensures that
                 * the key does *not* exist
                 */
                lcb_uint8_t check_delete;

                /**
                 * If replication/persistence requirements are excessive, cap to
                 * the maximum available
                 */
                lcb_uint8_t cap_max;
            } v0;
        } v;
    } lcb_durability_opts_t;


#ifdef __cplusplus
}
#endif

#endif /* LCB_DURABILITY_H */
