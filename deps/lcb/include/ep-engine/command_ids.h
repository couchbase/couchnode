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

#define CMD_OBSERVE           0x92
#define CMD_EVICT_KEY         0x93
#define CMD_GET_LOCKED        0x94
#define CMD_UNLOCK_KEY        0x95

/**
 * Return the last closed checkpoint Id for a given VBucket.
 */
#define CMD_LAST_CLOSED_CHECKPOINT 0x97

/**
 * Start restoring a <b>single</b> incremental backup file specified in the
 * key field of the packet.
 * The server will return the following error codes:
 * <ul>
 *  <li>PROTOCOL_BINARY_RESPONSE_SUCCESS if the restore process is started</li>
 *  <li>PROTOCOL_BINARY_RESPONSE_KEY_ENOENT if the backup file couldn't be found</li>
 *  <li>PROTOCOL_BINARY_RESPONSE_AUTH_ERROR if the user isn't admin (not implemented)</li>
 *  <li>PROTOCOL_BINARY_RESPONSE_NOT_SUPPORTED if the server isn't in restore mode</li>
 *  <li>PROTOCOL_BINARY_RESPONSE_EINTERNAL with a description what went wrong</li>
 * </ul>
 *
 */
#define CMD_RESTORE_FILE 0x98

/**
 * Try to abort the current restore as soon as possible. The server
 * <em>may</em> want to continue to process an unknown number of elements
 * before aborting (or even complete the full restore). The server will
 * <b>always</b> return with PROTOCOL_BINARY_RESPONSE_SUCCESS even if the
 * server isn't running in restore mode without any restore jobs running.
 */
#define CMD_RESTORE_ABORT 0x99

/**
 * Notify the server that we're done restoring data, so it may transition
 * from restore mode to fully operating mode.
 * The server always returns PROTOCOL_BINARY_RESPONSE_SUCCESS
 */
#define CMD_RESTORE_COMPLETE 0x9a

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

/*
 * IDs for the events of the observe command.
 */
#define OBS_PERSISTED_EVENT    1
#define OBS_MODIFIED_EVENT     2
#define OBS_DELETED_EVENT      3
#define OBS_REPLICATED_EVENT   4

/* Command identifiers used by Cross Data Center Replication (cdcr) */

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
 * Command to change the vbucket filter for a given TAP producer.
 */
#define CMD_CHANGE_VB_FILTER 0xb0


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
    engine_param_flush = 1,  /* flusher-related param type */
    engine_param_tap,        /* tap-related param type */
    engine_param_checkpoint  /* checkpoint-related param type */
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

/**
 * The return message for a CMD_GET_META returns just the meta data
 * section for an item. The body contains the meta information encoded
 * in network byte order as:
 *
 * uint8_t element type
 * uint8_t element length
 * n*uint8_t element value.
 *
 * The following types are currently defined:
 *   META_REVID - 0x01 With the following layout
 *       uint32_t seqno
 *       uint8_t  id[nnn] (where nnn == the length - size of seqno)
 */
typedef union {
    struct {
        protocol_binary_request_header header;
        struct {
            uint32_t flags;
        } body;
    }message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
} protocol_binary_response_get_meta;

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
            uint32_t nmeta_bytes; /* # of bytes in the body that is meta info */
            uint32_t flags;
            uint32_t expiration;
        } body;
    } message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + 12];
} protocol_binary_request_set_with_meta;

/**
 * The physical layout for the CMD_DEL_WITH_META looks like the the normal
 * delete request with the addition of a bulk of extra meta data stored
 * at the <b>end</b> of the package.
 */
typedef union {
    struct {
        protocol_binary_request_header header;
        struct {
            uint32_t nmeta_bytes; /* # of bytes in the body that is meta info */
        } body;
    } message;
    uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
} protocol_binary_request_delete_with_meta;

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

typedef protocol_binary_request_touch protocol_binary_request_observe;
typedef protocol_binary_request_header protocol_binary_request_unobserve;

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

#endif /* EP_ENGINE_COMMAND_IDS_H */
