/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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
#ifndef EP_ENGINE_COMMAND_IDS_H
#define EP_ENGINE_COMMAND_IDS_H 1

#include <memcached/protocol_binary.h>

#define CMD_STOP_PERSISTENCE  0x80
#define CMD_START_PERSISTENCE 0x81
#define CMD_SET_PARAM         0x82

/**
 * Retrieve data corresponding to a set of keys from a replica vbucket
 */
#define CMD_GET_REPLICA 0x83


/* The following commands are used by bucket engine:

#define CREATE_BUCKET 0x85
#define DELETE_BUCKET 0x86
#define LIST_BUCKETS  0x87
#define EXPAND_BUCKET 0x88
#define SELECT_BUCKET 0x89

*/

#define OBS_STATE_NOT_PERSISTED 0x00
#define OBS_STATE_PERSISTED     0x01
#define OBS_STATE_NOT_FOUND     0x80
#define OBS_STATE_LOGICAL_DEL   0x81


#define CMD_OBSERVE           0x92
#define CMD_EVICT_KEY         0x93
#define CMD_GET_LOCKED        0x94
#define CMD_UNLOCK_KEY        0x95

/**
 * Return the last closed checkpoint Id for a given VBucket.
 */
#define CMD_LAST_CLOSED_CHECKPOINT 0x97

/**
 * Close the TAP connection for the registered TAP client and remove the
 * checkpoint cursors from its registered vbuckets.
 */
#define CMD_DEREGISTER_TAP_CLIENT 0x9e

/**
 * Reset the replication chain from the node that receives this command. For example, given
 * the replication chain, A->B->C, if A receives this command, it will reset all the replica
 * vbuckets on B and C, which are replicated from A.
 */
#define CMD_RESET_REPLICATION_CHAIN 0x9f

// Command identifiers used by Cross Data Center Replication (cdcr)

/**
 * CMD_GET_META is used to retrieve the meta section for an item.
 */
#define CMD_GET_META 0xa0
#define CMD_GETQ_META 0xa1

/**
 * This flag is used with the get meta response packet. If set it
 * specifies that the item recieved has been deleted, but that the
 * items meta data is still contained in ep-engine. Eg. the item
 * has been soft deleted.
 */
#define GET_META_ITEM_DELETED_FLAG 0x01

/**
 * This flag is used by the setWithMeta/addWithMeta/deleteWithMeta packets
 * to specify that the conflict resolution mechanism should be skipped for
 * this operation.
 */
#define SKIP_CONFLICT_RESOLUTION_FLAG 0x01

/**
 * CMD_SET_WITH_META is used to set a kv-pair with additional meta
 * information.
 */
#define CMD_SET_WITH_META 0xa2
#define CMD_SETQ_WITH_META 0xa3
#define CMD_ADD_WITH_META 0xa4
#define CMD_ADDQ_WITH_META 0xa5

/**
 * Command to snapshot VB states
 */
#define CMD_SNAPSHOT_VB_STATES 0xa6

/**
 * Command to send vbucket batch counter to the underlying storage engine
 */
#define CMD_VBUCKET_BATCH_COUNT 0xa7

/**
 * CMD_DEL_WITH_META is used to delete a kv-pair with additional meta
 * information.
 */
#define CMD_DEL_WITH_META 0xa8
#define CMD_DELQ_WITH_META 0xa9

/**
 * Command to create a new checkpoint on a given vbucket by force
 */
#define CMD_CREATE_CHECKPOINT 0xaa

/**
 * Command if the current open checkpoint on a given vbucket should be
 * extended or not.
 */
#define CMD_EXTEND_CHECKPOINT 0xab

#define CMD_NOTIFY_VBUCKET_UPDATE 0xac

/**
 * Command to enable data traffic after completion of warm
 */
#define CMD_ENABLE_TRAFFIC 0xad

/**
 * Command to disable data traffic temporarily
 */
#define CMD_DISABLE_TRAFFIC 0xae

/**
 * Command to change the vbucket filter for a given TAP producer.
 */
#define CMD_CHANGE_VB_FILTER 0xb0

/**
 * Command to wait for the checkpoint persistence
 */
#define CMD_CHECKPOINT_PERSISTENCE 0xb1

/**
 * Command that returns meta data for typical memcached ops
 */
#define CMD_RETURN_META 0xb2

#define SET_RET_META 1
#define ADD_RET_META 2
#define DEL_RET_META 3

/**
 * TAP OPAQUE command list
 */
#define TAP_OPAQUE_ENABLE_AUTO_NACK 0
#define TAP_OPAQUE_INITIAL_VBUCKET_STREAM 1
#define TAP_OPAQUE_ENABLE_CHECKPOINT_SYNC 2
#define TAP_OPAQUE_OPEN_CHECKPOINT 3
#define TAP_OPAQUE_COMPLETE_VB_FILTER_CHANGE 4
#define TAP_OPAQUE_CLOSE_TAP_STREAM 7
#define TAP_OPAQUE_CLOSE_BACKFILL 8


/*
 * Parameter types of CMD_SET_PARAM command.
 */
typedef enum {
    engine_param_flush = 1,  // flusher-related param type
    engine_param_tap,        // tap-related param type
    engine_param_checkpoint  // checkpoint-related param type
} engine_param_t;

/**
 * CMD_SET_PARAM command message to set engine parameters.
 * flush, tap, and checkpoint parameter types are currently supported.
 */
typedef union {
    struct {
        protocol_binary_request_header header;
        struct {
            engine_param_t param_type;
        } body;
    } message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + sizeof(engine_param_t)];
} protocol_binary_request_set_param;

typedef union {
    struct {
        protocol_binary_request_header header;
        struct {
            uint32_t size;
        } body;
    } message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
} protocol_binary_request_set_batch_count;

/**
 * The physical layout for the CMD_SET_WITH_META looks like the the normal
 * set request with the addition of a bulk of extra meta data stored
 * at the <b>end</b> of the package.
 */
typedef union {
    struct {
        protocol_binary_request_header header;
        struct {
            uint32_t flags;
            uint32_t expiration;
            uint64_t seqno;
            uint64_t cas;
        } body;
    } message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + 24];
} protocol_binary_request_set_with_meta;

/**
 * The message format for delete with meta
 */
typedef protocol_binary_request_set_with_meta protocol_binary_request_delete_with_meta;

/**
 * The message format for getLocked engine API
 */
typedef protocol_binary_request_gat protocol_binary_request_getl;

/**
 * The physical layout for a CMD_GET_META command returns the meta-data
 * section for an item:
 */
typedef protocol_binary_request_no_extras protocol_binary_request_get_meta;

/**
 * The response for CMD_SET_WITH_META does not carry any user-data and the
 * status of the operation is signalled in the status bits.
 */
typedef protocol_binary_response_no_extras protocol_binary_response_set_with_meta;

typedef union {
    struct {
        protocol_binary_request_header header;
        struct {
            uint64_t file_version;
            uint64_t header_offset;
            uint32_t vbucket_state_updated;
            uint32_t state;
            uint64_t checkpoint;
        } body;
    } message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + 32];
} protocol_binary_request_notify_vbucket_update;
typedef protocol_binary_response_no_extras protocol_binary_response_notify_vbucket_update;

/**
 * The physical layout for the CMD_RETURN_META
 */
typedef union {
    struct {
        protocol_binary_request_header header;
        struct {
            uint32_t mutation_type;
            uint32_t flags;
            uint32_t expiration;
        } body;
    } message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + 12];
} protocol_binary_request_return_meta;

/**
 * Command to set cluster configuration
 */
#define CMD_SET_CLUSTER_CONFIG 0xb4

/**
 * Command that returns cluster configuration
 */
#define CMD_GET_CLUSTER_CONFIG 0xb5

/**
 * Message format for CMD_SET_CONFIG
 */
typedef protocol_binary_request_no_extras protocol_binary_request_set_cluster_config;

/**
 * Message format for CMD_GET_CONFIG
 */
typedef protocol_binary_request_no_extras protocol_binary_request_get_cluster_config;

#endif /* EP_ENGINE_COMMAND_IDS_H */
