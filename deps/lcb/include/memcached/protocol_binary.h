/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * Copyright (c) <2008>, Sun Microsystems, Inc.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of the  nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY SUN MICROSYSTEMS, INC. ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL SUN MICROSYSTEMS, INC. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
/*
 * Summary: Constants used by to implement the binary protocol.
 *
 * Copy: See Copyright for the status of this software.
 *
 * Author: Trond Norbye <trond.norbye@sun.com>
 */

#ifndef PROTOCOL_BINARY_H
#define PROTOCOL_BINARY_H

#if !defined HAVE_STDINT_H && defined _WIN32 && defined(_MSC_VER)
# include "win_stdint.h"
#else
# include <stdint.h>
#endif
#include <memcached/vbucket.h>

/**
 * \addtogroup Protocol
 * @{
 */

/**
 * This file contains definitions of the constants and packet formats
 * defined in the binary specification. Please note that you _MUST_ remember
 * to convert each multibyte field to / from network byte order to / from
 * host order.
 */
#ifdef __cplusplus
extern "C"
{
#endif

    /**
     * Definition of the legal "magic" values used in a packet.
     * See section 3.1 Magic byte
     */
    typedef enum {
        PROTOCOL_BINARY_REQ = 0x80,
        PROTOCOL_BINARY_RES = 0x81
    } protocol_binary_magic;

    /**
     * Definition of the valid response status numbers.
     *
     * A well written client should be "future proof" by handling new
     * error codes to be defined. Note that new error codes means that
     * the requested operation wasn't performed.
     */
    typedef enum {
        /** The operation completed successfully */
        PROTOCOL_BINARY_RESPONSE_SUCCESS = 0x00,
        /** The key does not exists */
        PROTOCOL_BINARY_RESPONSE_KEY_ENOENT = 0x01,
        /** The key exists in the cluster (with another CAS value) */
        PROTOCOL_BINARY_RESPONSE_KEY_EEXISTS = 0x02,
        /** The document exceeds the maximum size */
        PROTOCOL_BINARY_RESPONSE_E2BIG = 0x03,
        /** Invalid request */
        PROTOCOL_BINARY_RESPONSE_EINVAL = 0x04,
        /** The document was not stored for some reason. This is
         * currently a "catch all" for number or error situations, and
         * should be split into multiple error codes. */
        PROTOCOL_BINARY_RESPONSE_NOT_STORED = 0x05,
        /** Non-numeric server-side value for incr or decr */
        PROTOCOL_BINARY_RESPONSE_DELTA_BADVAL = 0x06,
        /** The server is not responsible for the requested vbucket */
        PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET = 0x07,
        /** Not connected to a bucket */
        PROTOCOL_BINARY_RESPONSE_NO_BUCKET = 0x08,
        /** The authentication context is stale. You should reauthenticate*/
        PROTOCOL_BINARY_RESPONSE_AUTH_STALE = 0x1f,
        /** Authentication failure (invalid user/password combination,
         * OR an internal error in the authentication library. Could
         * be a misconfigured SASL configuration. See server logs for
         * more information.) */
        PROTOCOL_BINARY_RESPONSE_AUTH_ERROR = 0x20,
        /** Authentication OK so far, please continue */
        PROTOCOL_BINARY_RESPONSE_AUTH_CONTINUE = 0x21,
        /** The requested value is outside the legal range
         * (similar to EINVAL, but more specific) */
        PROTOCOL_BINARY_RESPONSE_ERANGE = 0x22,
        /** Roll back to an earlier version of the vbucket UUID
         * (_currently_ only used by DCP for agreeing on selecting a
         * starting point) */
        PROTOCOL_BINARY_RESPONSE_ROLLBACK = 0x23,
        /** No access (could be opcode, value, bucket etc) */
        PROTOCOL_BINARY_RESPONSE_EACCESS = 0x24,
        /** The server have no idea what this command is for */
        PROTOCOL_BINARY_RESPONSE_UNKNOWN_COMMAND = 0x81,
        /** Not enough memory */
        PROTOCOL_BINARY_RESPONSE_ENOMEM = 0x82,
        /** The server does not support this command */
        PROTOCOL_BINARY_RESPONSE_NOT_SUPPORTED = 0x83,
        /** An internal error in the server */
        PROTOCOL_BINARY_RESPONSE_EINTERNAL = 0x84,
        /** The system is currently too busy to handle the request.
         * it is _currently_ only being used by the scrubber in
         * default_engine to run a task there may only be one of
         * (subsequent requests to start it would return ebusy until
         * it's done). */
        PROTOCOL_BINARY_RESPONSE_EBUSY = 0x85,
        /** A temporary error condition occurred. Retrying the
         * operation may resolve the problem. This could be that the
         * server is in a degraded situation (like running warmup on
         * the node), the vbucket could be in an "incorrect" state, a
         * temporary failure from the underlying persistence layer,
         * etc).
         */
        PROTOCOL_BINARY_RESPONSE_ETMPFAIL = 0x86
    } protocol_binary_response_status;

    /**
     * Defintion of the different command opcodes.
     * See section 3.3 Command Opcodes
     */
    typedef enum {
        PROTOCOL_BINARY_CMD_GET = 0x00,
        PROTOCOL_BINARY_CMD_SET = 0x01,
        PROTOCOL_BINARY_CMD_ADD = 0x02,
        PROTOCOL_BINARY_CMD_REPLACE = 0x03,
        PROTOCOL_BINARY_CMD_DELETE = 0x04,
        PROTOCOL_BINARY_CMD_INCREMENT = 0x05,
        PROTOCOL_BINARY_CMD_DECREMENT = 0x06,
        PROTOCOL_BINARY_CMD_QUIT = 0x07,
        PROTOCOL_BINARY_CMD_FLUSH = 0x08,
        PROTOCOL_BINARY_CMD_GETQ = 0x09,
        PROTOCOL_BINARY_CMD_NOOP = 0x0a,
        PROTOCOL_BINARY_CMD_VERSION = 0x0b,
        PROTOCOL_BINARY_CMD_GETK = 0x0c,
        PROTOCOL_BINARY_CMD_GETKQ = 0x0d,
        PROTOCOL_BINARY_CMD_APPEND = 0x0e,
        PROTOCOL_BINARY_CMD_PREPEND = 0x0f,
        PROTOCOL_BINARY_CMD_STAT = 0x10,
        PROTOCOL_BINARY_CMD_SETQ = 0x11,
        PROTOCOL_BINARY_CMD_ADDQ = 0x12,
        PROTOCOL_BINARY_CMD_REPLACEQ = 0x13,
        PROTOCOL_BINARY_CMD_DELETEQ = 0x14,
        PROTOCOL_BINARY_CMD_INCREMENTQ = 0x15,
        PROTOCOL_BINARY_CMD_DECREMENTQ = 0x16,
        PROTOCOL_BINARY_CMD_QUITQ = 0x17,
        PROTOCOL_BINARY_CMD_FLUSHQ = 0x18,
        PROTOCOL_BINARY_CMD_APPENDQ = 0x19,
        PROTOCOL_BINARY_CMD_PREPENDQ = 0x1a,
        PROTOCOL_BINARY_CMD_VERBOSITY = 0x1b,
        PROTOCOL_BINARY_CMD_TOUCH = 0x1c,
        PROTOCOL_BINARY_CMD_GAT = 0x1d,
        PROTOCOL_BINARY_CMD_GATQ = 0x1e,
        PROTOCOL_BINARY_CMD_HELLO = 0x1f,

        PROTOCOL_BINARY_CMD_SASL_LIST_MECHS = 0x20,
        PROTOCOL_BINARY_CMD_SASL_AUTH = 0x21,
        PROTOCOL_BINARY_CMD_SASL_STEP = 0x22,

        /* Control */
        PROTOCOL_BINARY_CMD_IOCTL_GET = 0x23,
        PROTOCOL_BINARY_CMD_IOCTL_SET = 0x24,

        /* Config */
        PROTOCOL_BINARY_CMD_CONFIG_VALIDATE = 0x25,
        PROTOCOL_BINARY_CMD_CONFIG_RELOAD = 0x26,

        /* Audit */
        PROTOCOL_BINARY_CMD_AUDIT_PUT = 0x27,
        PROTOCOL_BINARY_CMD_AUDIT_CONFIG_RELOAD = 0x28,

        /* These commands are used for range operations and exist within
         * this header for use in other projects.  Range operations are
         * not expected to be implemented in the memcached server itself.
         */
        PROTOCOL_BINARY_CMD_RGET      = 0x30,
        PROTOCOL_BINARY_CMD_RSET      = 0x31,
        PROTOCOL_BINARY_CMD_RSETQ     = 0x32,
        PROTOCOL_BINARY_CMD_RAPPEND   = 0x33,
        PROTOCOL_BINARY_CMD_RAPPENDQ  = 0x34,
        PROTOCOL_BINARY_CMD_RPREPEND  = 0x35,
        PROTOCOL_BINARY_CMD_RPREPENDQ = 0x36,
        PROTOCOL_BINARY_CMD_RDELETE   = 0x37,
        PROTOCOL_BINARY_CMD_RDELETEQ  = 0x38,
        PROTOCOL_BINARY_CMD_RINCR     = 0x39,
        PROTOCOL_BINARY_CMD_RINCRQ    = 0x3a,
        PROTOCOL_BINARY_CMD_RDECR     = 0x3b,
        PROTOCOL_BINARY_CMD_RDECRQ    = 0x3c,
        /* End Range operations */

        /* VBucket commands */
        PROTOCOL_BINARY_CMD_SET_VBUCKET = 0x3d,
        PROTOCOL_BINARY_CMD_GET_VBUCKET = 0x3e,
        PROTOCOL_BINARY_CMD_DEL_VBUCKET = 0x3f,
        /* End VBucket commands */

        /* TAP commands */
        PROTOCOL_BINARY_CMD_TAP_CONNECT = 0x40,
        PROTOCOL_BINARY_CMD_TAP_MUTATION = 0x41,
        PROTOCOL_BINARY_CMD_TAP_DELETE = 0x42,
        PROTOCOL_BINARY_CMD_TAP_FLUSH = 0x43,
        PROTOCOL_BINARY_CMD_TAP_OPAQUE = 0x44,
        PROTOCOL_BINARY_CMD_TAP_VBUCKET_SET = 0x45,
        PROTOCOL_BINARY_CMD_TAP_CHECKPOINT_START = 0x46,
        PROTOCOL_BINARY_CMD_TAP_CHECKPOINT_END = 0x47,
        /* End TAP */

        /* DCP */
        PROTOCOL_BINARY_CMD_DCP_OPEN = 0x50,
        PROTOCOL_BINARY_CMD_DCP_ADD_STREAM = 0x51,
        PROTOCOL_BINARY_CMD_DCP_CLOSE_STREAM = 0x52,
        PROTOCOL_BINARY_CMD_DCP_STREAM_REQ = 0x53,
        PROTOCOL_BINARY_CMD_DCP_GET_FAILOVER_LOG = 0x54,
        PROTOCOL_BINARY_CMD_DCP_STREAM_END = 0x55,
        PROTOCOL_BINARY_CMD_DCP_SNAPSHOT_MARKER = 0x56,
        PROTOCOL_BINARY_CMD_DCP_MUTATION = 0x57,
        PROTOCOL_BINARY_CMD_DCP_DELETION = 0x58,
        PROTOCOL_BINARY_CMD_DCP_EXPIRATION = 0x59,
        PROTOCOL_BINARY_CMD_DCP_FLUSH = 0x5a,
        PROTOCOL_BINARY_CMD_DCP_SET_VBUCKET_STATE = 0x5b,
        PROTOCOL_BINARY_CMD_DCP_NOOP = 0x5c,
        PROTOCOL_BINARY_CMD_DCP_BUFFER_ACKNOWLEDGEMENT = 0x5d,
        PROTOCOL_BINARY_CMD_DCP_CONTROL = 0x5e,
        PROTOCOL_BINARY_CMD_DCP_RESERVED4 = 0x5f,
        /* End DCP */

        PROTOCOL_BINARY_CMD_STOP_PERSISTENCE = 0x80,
        PROTOCOL_BINARY_CMD_START_PERSISTENCE = 0x81,
        PROTOCOL_BINARY_CMD_SET_PARAM = 0x82,
        PROTOCOL_BINARY_CMD_GET_REPLICA = 0x83,

        /* Bucket engine */
        PROTOCOL_BINARY_CMD_CREATE_BUCKET = 0x85,
        PROTOCOL_BINARY_CMD_DELETE_BUCKET = 0x86,
        PROTOCOL_BINARY_CMD_LIST_BUCKETS = 0x87,
        PROTOCOL_BINARY_CMD_SELECT_BUCKET= 0x89,

        PROTOCOL_BINARY_CMD_ASSUME_ROLE = 0x8a,

        PROTOCOL_BINARY_CMD_OBSERVE_SEQNO = 0x91,
        PROTOCOL_BINARY_CMD_OBSERVE = 0x92,

        PROTOCOL_BINARY_CMD_EVICT_KEY = 0x93,
        PROTOCOL_BINARY_CMD_GET_LOCKED = 0x94,
        PROTOCOL_BINARY_CMD_UNLOCK_KEY = 0x95,

        /**
         * Return the last closed checkpoint Id for a given VBucket.
         */
        PROTOCOL_BINARY_CMD_LAST_CLOSED_CHECKPOINT = 0x97,
        /**
         * Close the TAP connection for the registered TAP client and
         * remove the checkpoint cursors from its registered vbuckets.
         */
        PROTOCOL_BINARY_CMD_DEREGISTER_TAP_CLIENT = 0x9e,

        /**
         * Reset the replication chain from the node that receives
         * this command. For example, given the replication chain,
         * A->B->C, if A receives this command, it will reset all the
         * replica vbuckets on B and C, which are replicated from A.
         */
        PROTOCOL_BINARY_CMD_RESET_REPLICATION_CHAIN =  0x9f,

        /**
         * CMD_GET_META is used to retrieve the meta section for an item.
         */
        PROTOCOL_BINARY_CMD_GET_META = 0xa0,
        PROTOCOL_BINARY_CMD_GETQ_META = 0xa1,
        PROTOCOL_BINARY_CMD_SET_WITH_META = 0xa2,
        PROTOCOL_BINARY_CMD_SETQ_WITH_META = 0xa3,
        PROTOCOL_BINARY_CMD_ADD_WITH_META = 0xa4,
        PROTOCOL_BINARY_CMD_ADDQ_WITH_META = 0xa5,
        PROTOCOL_BINARY_CMD_SNAPSHOT_VB_STATES = 0xa6,
        PROTOCOL_BINARY_CMD_VBUCKET_BATCH_COUNT = 0xa7,
        PROTOCOL_BINARY_CMD_DEL_WITH_META = 0xa8,
        PROTOCOL_BINARY_CMD_DELQ_WITH_META = 0xa9,

        /**
         * Command to create a new checkpoint on a given vbucket by force
         */
        PROTOCOL_BINARY_CMD_CREATE_CHECKPOINT = 0xaa,
        PROTOCOL_BINARY_CMD_NOTIFY_VBUCKET_UPDATE = 0xac,
        /**
         * Command to enable data traffic after completion of warm
         */
        PROTOCOL_BINARY_CMD_ENABLE_TRAFFIC = 0xad,
        /**
         * Command to disable data traffic temporarily
         */
        PROTOCOL_BINARY_CMD_DISABLE_TRAFFIC = 0xae,
        /**
         * Command to change the vbucket filter for a given TAP producer.
         */
        PROTOCOL_BINARY_CMD_CHANGE_VB_FILTER = 0xb0,
        /**
         * Command to wait for the checkpoint persistence
         */
        PROTOCOL_BINARY_CMD_CHECKPOINT_PERSISTENCE = 0xb1,
        /**
         * Command that returns meta data for typical memcached ops
         */
        PROTOCOL_BINARY_CMD_RETURN_META = 0xb2,
        /**
         * Command to trigger compaction of a vbucket
         */
        PROTOCOL_BINARY_CMD_COMPACT_DB = 0xb3,
        /**
         * Command to set cluster configuration
         */
        PROTOCOL_BINARY_CMD_SET_CLUSTER_CONFIG = 0xb4,
        /**
         * Command that returns cluster configuration
         */
        PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG = 0xb5,
        PROTOCOL_BINARY_CMD_GET_RANDOM_KEY = 0xb6,
        /**
         * Command to wait for the dcp sequence number persistence
         */
        PROTOCOL_BINARY_CMD_SEQNO_PERSISTENCE = 0xb7,

        /**
         * Commands for GO-XDCR
         */
        PROTOCOL_BINARY_CMD_SET_DRIFT_COUNTER_STATE = 0xc1,
        PROTOCOL_BINARY_CMD_GET_ADJUSTED_TIME = 0xc2,

        /* Scrub the data */
        PROTOCOL_BINARY_CMD_SCRUB = 0xf0,
        /* Refresh the ISASL data */
        PROTOCOL_BINARY_CMD_ISASL_REFRESH = 0xf1,
        /* Refresh the SSL certificates */
        PROTOCOL_BINARY_CMD_SSL_CERTS_REFRESH = 0xf2,
        /* Internal timer ioctl */
        PROTOCOL_BINARY_CMD_GET_CMD_TIMER = 0xf3,
        /* ns_server - memcached session validation */
        PROTOCOL_BINARY_CMD_SET_CTRL_TOKEN = 0xf4,
        PROTOCOL_BINARY_CMD_GET_CTRL_TOKEN = 0xf5,

        /* Reserved for being able to signal invalid opcode */
        PROTOCOL_BINARY_CMD_INVALID = 0xff
    } protocol_binary_command;

    /**
     * Definition of the data types in the packet
     * See section 3.4 Data Types
     */
    typedef enum {
        PROTOCOL_BINARY_RAW_BYTES = 0x00,
        PROTOCOL_BINARY_DATATYPE_JSON = 0x01,
        /* Compressed == snappy compression */
        PROTOCOL_BINARY_DATATYPE_COMPRESSED = 0x02,
        /* Compressed == snappy compression */
        PROTOCOL_BINARY_DATATYPE_COMPRESSED_JSON = 0x03
    } protocol_binary_datatypes;

    /**
     * Definitions for extended (flexible) metadata
     *
     * @1: Flex Code to identify the number of extended metadata fields
     * @2: Size of the Flex Code, set to 1 byte
     * @3: Current size of extended metadata
     */
    typedef enum {
        FLEX_META_CODE = 0x01,
        FLEX_DATA_OFFSET = 1,
        EXT_META_LEN = 1
    } protocol_binary_flexmeta;

    /**
     * Definition of the header structure for a request packet.
     * See section 2
     */
    typedef union {
        struct {
            uint8_t magic;
            uint8_t opcode;
            uint16_t keylen;
            uint8_t extlen;
            uint8_t datatype;
            uint16_t vbucket;
            uint32_t bodylen;
            uint32_t opaque;
            uint64_t cas;
        } request;
        uint8_t bytes[24];
    } protocol_binary_request_header;

    /**
     * Definition of the header structure for a response packet.
     * See section 2
     */
    typedef union {
        struct {
            uint8_t magic;
            uint8_t opcode;
            uint16_t keylen;
            uint8_t extlen;
            uint8_t datatype;
            uint16_t status;
            uint32_t bodylen;
            uint32_t opaque;
            uint64_t cas;
        } response;
        uint8_t bytes[24];
    } protocol_binary_response_header;

    /**
     * Definition of a request-packet containing no extras
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header)];
    } protocol_binary_request_no_extras;

    /**
     * Definition of a response-packet containing no extras
     */
    typedef union {
        struct {
            protocol_binary_response_header header;
        } message;
        uint8_t bytes[sizeof(protocol_binary_response_header)];
    } protocol_binary_response_no_extras;

    /**
     * Definition of the packet used by the get, getq, getk and getkq command.
     * See section 4
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_get;
    typedef protocol_binary_request_no_extras protocol_binary_request_getq;
    typedef protocol_binary_request_no_extras protocol_binary_request_getk;
    typedef protocol_binary_request_no_extras protocol_binary_request_getkq;

    /**
     * Definition of the packet returned from a successful get, getq, getk and
     * getkq.
     * See section 4
     */
    typedef union {
        struct {
            protocol_binary_response_header header;
            struct {
                uint32_t flags;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_response_header) + 4];
    } protocol_binary_response_get;

    typedef protocol_binary_response_get protocol_binary_response_getq;
    typedef protocol_binary_response_get protocol_binary_response_getk;
    typedef protocol_binary_response_get protocol_binary_response_getkq;

    /**
     * Definition of the packet used by the delete command
     * See section 4
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_delete;

    /**
     * Definition of the packet returned by the delete command
     * See section 4
     *
     * extlen should be either zero, or 16 if the client has enabled the
     * MUTATION_SEQNO feature, with the following format:
     *
     *   Header:           (0-23): <protocol_binary_response_header>
     *   Extras:
     *     Vbucket UUID   (24-31): 0x0000000000003039
     *     Seqno          (32-39): 0x000000000000002D
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_delete;

    /**
     * Definition of the packet used by the flush command
     * See section 4
     * Please note that the expiration field is optional, so remember to see
     * check the header.bodysize to see if it is present.
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t expiration;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_flush;

    /**
     * Definition of the packet returned by the flush command
     * See section 4
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_flush;

    /**
     * Definition of the packet used by set, add and replace
     * See section 4
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t flags;
                uint32_t expiration;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 8];
    } protocol_binary_request_set;
    typedef protocol_binary_request_set protocol_binary_request_add;
    typedef protocol_binary_request_set protocol_binary_request_replace;

    /**
     * Definition of the packet returned by set, add and replace
     * See section 4
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_set;
    typedef protocol_binary_response_no_extras protocol_binary_response_add;
    typedef protocol_binary_response_no_extras protocol_binary_response_replace;

    /**
     * Definition of the noop packet
     * See section 4
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_noop;

    /**
     * Definition of the packet returned by the noop command
     * See section 4
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_noop;

    /**
     * Definition of the structure used by the increment and decrement
     * command.
     * See section 4
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint64_t delta;
                uint64_t initial;
                uint32_t expiration;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 20];
    } protocol_binary_request_incr;
    typedef protocol_binary_request_incr protocol_binary_request_decr;

    /**
     * Definition of the response from an incr or decr command
     * command.
     *
     * The result of the incr/decr is a uint64_t placed at header + extlen.
     *
     * extlen should be either zero, or 16 if the client has enabled the
     * MUTATION_SEQNO feature, with the following format:
     *
     *   Header:           (0-23): <protocol_binary_response_header>
     *   Extras:
     *     Vbucket UUID   (24-31): 0x0000000000003039
     *     Seqno          (32-39): 0x000000000000002D
     *   Value:           (40-47): ....
     *
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_incr;
    typedef protocol_binary_response_no_extras protocol_binary_response_decr;

    /**
     * Definition of the quit
     * See section 4
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_quit;

    /**
     * Definition of the packet returned by the quit command
     * See section 4
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_quit;

    /**
     * Definition of the packet used by append and prepend command
     * See section 4
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_append;
    typedef protocol_binary_request_no_extras protocol_binary_request_prepend;

    /**
     * Definition of the packet returned from a successful append or prepend
     * See section 4
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_append;
    typedef protocol_binary_response_no_extras protocol_binary_response_prepend;

    /**
     * Definition of the packet used by the version command
     * See section 4
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_version;

    /**
     * Definition of the packet returned from a successful version command
     * See section 4
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_version;


    /**
     * Definition of the packet used by the stats command.
     * See section 4
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_stats;

    /**
     * Definition of the packet returned from a successful stats command
     * See section 4
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_stats;

    /**
     * Definition of the packet used by the verbosity command
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t level;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_verbosity;

    /**
     * Definition of the packet returned from the verbosity command
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_verbosity;

    /**
     * Definition of the packet used by the touch command.
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t expiration;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_touch;

    /**
     * Definition of the packet returned from the touch command
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_touch;

    /**
     * Definition of the packet used by the GAT(Q) command.
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t expiration;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_gat;

    typedef protocol_binary_request_gat protocol_binary_request_gatq;

    /**
     * Definition of the packet returned from the GAT(Q)
     */
    typedef protocol_binary_response_get protocol_binary_response_gat;
    typedef protocol_binary_response_get protocol_binary_response_gatq;


    /**
     * Definition of a request for a range operation.
     * See http://code.google.com/p/memcached/wiki/RangeOps
     *
     * These types are used for range operations and exist within
     * this header for use in other projects.  Range operations are
     * not expected to be implemented in the memcached server itself.
     */
    typedef union {
        struct {
            protocol_binary_response_header header;
            struct {
                uint16_t size;
                uint8_t  reserved;
                uint8_t  flags;
                uint32_t max_results;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_rangeop;

    typedef protocol_binary_request_rangeop protocol_binary_request_rget;
    typedef protocol_binary_request_rangeop protocol_binary_request_rset;
    typedef protocol_binary_request_rangeop protocol_binary_request_rsetq;
    typedef protocol_binary_request_rangeop protocol_binary_request_rappend;
    typedef protocol_binary_request_rangeop protocol_binary_request_rappendq;
    typedef protocol_binary_request_rangeop protocol_binary_request_rprepend;
    typedef protocol_binary_request_rangeop protocol_binary_request_rprependq;
    typedef protocol_binary_request_rangeop protocol_binary_request_rdelete;
    typedef protocol_binary_request_rangeop protocol_binary_request_rdeleteq;
    typedef protocol_binary_request_rangeop protocol_binary_request_rincr;
    typedef protocol_binary_request_rangeop protocol_binary_request_rincrq;
    typedef protocol_binary_request_rangeop protocol_binary_request_rdecr;
    typedef protocol_binary_request_rangeop protocol_binary_request_rdecrq;


    /**
     * Definition of tap commands
     * See To be written
     *
     */

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                /**
                 * flags is a bitmask used to set properties for the
                 * the connection. Please In order to be forward compatible
                 * you should set all undefined bits to 0.
                 *
                 * If the bit require extra userdata, it will be stored
                 * in the user-data field of the body (passed to the engine
                 * as enginespeciffic). That means that when you parse the
                 * flags and the engine-specific data, you have to work your
                 * way from bit 0 and upwards to find the correct offset for
                 * the data.
                 *
                 */
                uint32_t flags;

                /**
                 * Backfill age
                 *
                 * By using this flag you can limit the amount of data being
                 * transmitted. If you don't specify a backfill age, the
                 * server will transmit everything it contains.
                 *
                 * The first 8 bytes in the engine specific data contains
                 * the oldest entry (from epoc) you're interested in.
                 * Specifying a time in the future (for the server you are
                 * connecting to), will cause it to start streaming current
                 * changes.
                 */
#define TAP_CONNECT_FLAG_BACKFILL 0x01
                /**
                 * Dump will cause the server to send the data stored on the
                 * server, but disconnect when the keys stored in the server
                 * are transmitted.
                 */
#define TAP_CONNECT_FLAG_DUMP 0x02
                /**
                 * The body contains a list of 16 bits words in network byte
                 * order specifying the vbucket ids to monitor. The first 16
                 * bit word contains the number of buckets. The number of 0
                 * means "all buckets"
                 */
#define TAP_CONNECT_FLAG_LIST_VBUCKETS 0x04
                /**
                 * The responsibility of the vbuckets is to be transferred
                 * over to the caller when all items are transferred.
                 */
#define TAP_CONNECT_FLAG_TAKEOVER_VBUCKETS 0x08
                /**
                 * The tap consumer supports ack'ing of tap messages
                 */
#define TAP_CONNECT_SUPPORT_ACK 0x10
                /**
                 * The tap consumer would prefer to just get the keys
                 * back. If the engine supports this it will set
                 * the TAP_FLAG_NO_VALUE flag in each of the
                 * tap packets returned.
                 */
#define TAP_CONNECT_REQUEST_KEYS_ONLY 0x20
                /**
                 * The body contains a list of (vbucket_id, last_checkpoint_id)
                 * pairs. This provides the checkpoint support in TAP streams.
                 * The last checkpoint id represents the last checkpoint that
                 * was successfully persisted.
                 */
#define TAP_CONNECT_CHECKPOINT 0x40
                /**
                 * The tap consumer is a registered tap client, which means that
                 * the tap server will maintain its checkpoint cursor permanently.
                 */
#define TAP_CONNECT_REGISTERED_CLIENT 0x80

                /**
                 * The initial TAP implementation convert flags to/from network
                 * byte order, but the values isn't stored in host local order
                 * causing them to change if you mix platforms..
                 */
#define TAP_CONNECT_TAP_FIX_FLAG_BYTEORDER 0x100

            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_tap_connect;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                struct {
                    uint16_t enginespecific_length;
                    /*
                     * The flag section support the following flags
                     */
                    /**
                     * Request that the consumer send a response packet
                     * for this packet. The opaque field must be preserved
                     * in the response.
                     */
#define TAP_FLAG_ACK 0x01
                    /**
                     * The value for the key is not included in the packet
                     */
#define TAP_FLAG_NO_VALUE 0x02
                    /**
                     * The flags are in network byte order
                     */
#define TAP_FLAG_NETWORK_BYTE_ORDER 0x04

                    uint16_t flags;
                    uint8_t  ttl;
                    uint8_t  res1;
                    uint8_t  res2;
                    uint8_t  res3;
                } tap;
                struct {
                    uint32_t flags;
                    uint32_t expiration;
                } item;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 16];
    } protocol_binary_request_tap_mutation;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                struct {
                    uint16_t enginespecific_length;
                    /**
                     * See the definition of the flags for
                     * protocol_binary_request_tap_mutation for a description
                     * of the available flags.
                     */
                    uint16_t flags;
                    uint8_t  ttl;
                    uint8_t  res1;
                    uint8_t  res2;
                    uint8_t  res3;
                } tap;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 8];
    } protocol_binary_request_tap_no_extras;

    typedef protocol_binary_request_tap_no_extras protocol_binary_request_tap_delete;
    typedef protocol_binary_request_tap_no_extras protocol_binary_request_tap_flush;

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

    typedef protocol_binary_request_tap_no_extras protocol_binary_request_tap_opaque;
    typedef protocol_binary_request_tap_no_extras protocol_binary_request_tap_vbucket_set;


    /**
     * Definition of the packet used by the scrub.
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_scrub;

    /**
     * Definition of the packet returned from scrub.
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_scrub;


    /**
     * Definition of the packet used by set vbucket
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                vbucket_state_t state;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + sizeof(vbucket_state_t)];
    } protocol_binary_request_set_vbucket;
    /**
     * Definition of the packet returned from set vbucket
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_set_vbucket;
    /**
     * Definition of the packet used by del vbucket
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_del_vbucket;
    /**
     * Definition of the packet returned from del vbucket
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_del_vbucket;

    /**
     * Definition of the packet used by get vbucket
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_get_vbucket;

    /**
     * Definition of the packet returned from get vbucket
     */
    typedef union {
        struct {
            protocol_binary_response_header header;
            struct {
                vbucket_state_t state;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_response_header) + sizeof(vbucket_state_t)];
    } protocol_binary_response_get_vbucket;

    /**
     * Definition of hello's features.
     */
    typedef enum {
        PROTOCOL_BINARY_FEATURE_DATATYPE = 0x01,
        PROTOCOL_BINARY_FEATURE_TLS = 0x2,
        PROTOCOL_BINARY_FEATURE_TCPNODELAY = 0x03,
        PROTOCOL_BINARY_FEATURE_MUTATION_SEQNO = 0x04
    } protocol_binary_hello_features;

    #define MEMCACHED_FIRST_HELLO_FEATURE 0x01
    #define MEMCACHED_TOTAL_HELLO_FEATURES 0x04

#define protocol_feature_2_text(a) \
    (a == PROTOCOL_BINARY_FEATURE_DATATYPE) ? "Datatype" : \
    (a == PROTOCOL_BINARY_FEATURE_TLS) ? "TLS" : \
    (a == PROTOCOL_BINARY_FEATURE_TCPNODELAY) ? "TCP NODELAY" : \
    (a == PROTOCOL_BINARY_FEATURE_MUTATION_SEQNO) ? "Mutation seqno" : "Unknown"

    /**
     * The HELLO command is used by the client and the server to agree
     * upon the set of features the other end supports. It is initiated
     * by the client by sending its agent string and the list of features
     * it would like to use. The server will then reply with the list
     * of the requested features it supports.
     *
     * ex:
     * Client ->  HELLO [myclient 2.0] datatype, tls
     * Server ->  HELLO SUCCESS datatype
     *
     * In this example the server responds that it allows the client to
     * use the datatype extension, but not the tls extension.
     */


    /**
     * Definition of the packet requested by hello cmd.
     * Key: This is a client-specific identifier (not really used by
     *      the server, except for logging the HELLO and may therefore
     *      be used to identify the client at a later time)
     * Body: Contains all features supported by client. Each feature is
     *       specified as an uint16_t in network byte order.
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_hello;


    /**
     * Definition of the packet returned by hello cmd.
     * Body: Contains all features requested by the client that the
     *       server agrees to ssupport. Each feature is
     *       specified as an uint16_t in network byte order.
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_hello;

    /**
     * The SET_CTRL_TOKEN command will be used by ns_server and ns_server alone
     * to set the session cas token in memcached which will be used to
     * recognize the particular instance on ns_server. The previous token will
     * be passed in the cas section of the request header for the CAS operation,
     * and the new token will be part of ext (8B).
     *
     * The response to this request will include the cas as it were set,
     * and a SUCCESS as status, or a KEY_EEXISTS with the existing token in
     * memcached if the CAS operation were to fail.
     */

    /**
     * Definition of the request packet for SET_CTRL_TOKEN.
     * Body: new session_cas_token of uint64_t type.
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint64_t new_cas;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 8];
    } protocol_binary_request_set_ctrl_token;

    /**
     * Definition of the response packet for SET_CTRL_TOKEN
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_set_ctrl_token;

    /**
     * The GET_CTRL_TOKEN command will be used by ns_server to fetch the current
     * session cas token held in memcached.
     *
     * The response to this request will include the token currently held in
     * memcached in the cas field of the header.
     */

    /**
     * Definition of the request packet for GET_CTRL_TOKEN.
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_get_ctrl_token;


    /**
     * Definition of the response packet for GET_CTRL_TOKEN
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_get_ctrl_token;

    /* DCP related stuff */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t seqno;
                /*
                 * The following flags are defined
                 */
#define DCP_OPEN_PRODUCER 1
#define DCP_OPEN_NOTIFIER 2
                uint32_t flags;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 8];
    } protocol_binary_request_dcp_open;

    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_open;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                /*
                 * The following flags are defined
                 */
#define DCP_ADD_STREAM_FLAG_TAKEOVER 1
#define DCP_ADD_STREAM_FLAG_DISKONLY 2
#define DCP_ADD_STREAM_FLAG_LATEST   4
                uint32_t flags;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_dcp_add_stream;

    typedef union {
        struct {
            protocol_binary_response_header header;
            struct {
                uint32_t opaque;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_response_header) + 4];
    } protocol_binary_response_dcp_add_stream;

    typedef protocol_binary_request_no_extras protocol_binary_request_dcp_close_stream;
    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_close_stream;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t flags;
                uint32_t reserved;
                uint64_t start_seqno;
                uint64_t end_seqno;
                uint64_t vbucket_uuid;
                uint64_t snap_start_seqno;
                uint64_t snap_end_seqno;
            } body;
            /* Group ID is specified in the key */
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 48];
    } protocol_binary_request_dcp_stream_req;

    typedef union {
        struct {
            protocol_binary_response_header header;
        } message;
        /*
        ** In case of PROTOCOL_BINARY_RESPONSE_ROLLBACK the body contains
        ** the rollback sequence number (uint64_t)
        */
        uint8_t bytes[sizeof(protocol_binary_request_header)];
    } protocol_binary_response_dcp_stream_req;

    typedef protocol_binary_request_no_extras protocol_binary_request_dcp_get_failover_log;

    /* The body of the message contains UUID/SEQNO pairs */
    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_get_failover_log;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                /**
                 * All flags set to 0 == OK,
                 * 1: state changed
                 */
                uint32_t flags;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_dcp_stream_end;
    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_stream_end;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint64_t start_seqno;
                uint64_t end_seqno;
                uint32_t flags;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 20];
    } protocol_binary_request_dcp_snapshot_marker;

    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_snapshot_marker;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint64_t by_seqno;
                uint64_t rev_seqno;
                uint32_t flags;
                uint32_t expiration;
                uint32_t lock_time;
                uint16_t nmeta;
                uint8_t nru;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 31];
    } protocol_binary_request_dcp_mutation;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint64_t by_seqno;
                uint64_t rev_seqno;
                uint16_t nmeta;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 18];
    } protocol_binary_request_dcp_deletion;

    typedef protocol_binary_request_dcp_deletion protocol_binary_request_dcp_expiration;
    typedef protocol_binary_request_no_extras protocol_binary_request_dcp_flush;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                /**
                 * 0x01 - Active
                 * 0x02 - Pending
                 * 0x03 - Replica
                 * 0x04 - Dead
                 */
                uint8_t state;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 1];
    } protocol_binary_request_dcp_set_vbucket_state;
    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_set_vbucket_state;

    typedef protocol_binary_request_no_extras protocol_binary_request_dcp_noop;
    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_noop;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t buffer_bytes;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_dcp_buffer_acknowledgement;
    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_buffer_acknowledgement;

    typedef protocol_binary_request_no_extras protocol_binary_request_dcp_control;
    typedef protocol_binary_response_no_extras protocol_binary_response_dcp_control;


    /**
     * IOCTL_GET command message to get/set control parameters.
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_ioctl_get;
    typedef protocol_binary_request_no_extras protocol_binary_request_ioctl_set;

    typedef protocol_binary_request_no_extras protocol_binary_request_config_validate;
    typedef protocol_binary_request_no_extras protocol_binary_request_config_reload;

    typedef protocol_binary_request_no_extras protocol_binary_request_ssl_refresh;
    typedef protocol_binary_response_no_extras protocol_binary_response_ssl_refresh;

    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint8_t opcode;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 1];
    } protocol_binary_request_get_cmd_timer;

    typedef protocol_binary_response_no_extras protocol_binary_response_get_cmd_timer;

    typedef protocol_binary_request_no_extras protocol_binary_request_create_bucket;
    typedef protocol_binary_request_no_extras protocol_binary_request_delete_bucket;
    typedef protocol_binary_request_no_extras protocol_binary_request_list_buckets;
    typedef protocol_binary_request_no_extras protocol_binary_request_select_bucket;
    typedef protocol_binary_request_no_extras protocol_binary_request_assume_role;

    /*
     * Parameter types of CMD_SET_PARAM command.
     */
    typedef enum {
        protocol_binary_engine_param_flush = 1,  /* flusher-related param type */
        protocol_binary_engine_param_tap,        /* tap-related param type */
        protocol_binary_engine_param_checkpoint  /* checkpoint-related param type */
    } protocol_binary_engine_param_t;

    /**
     * CMD_SET_PARAM command message to set engine parameters.
     * flush, tap, and checkpoint parameter types are currently supported.
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                protocol_binary_engine_param_t param_type;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + sizeof(protocol_binary_engine_param_t)];
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
     * This flag is used by the setWithMeta/addWithMeta/deleteWithMeta packets
     * to specify that the conflict resolution mechanism should be skipped for
     * this operation.
     */
#define SKIP_CONFLICT_RESOLUTION_FLAG 0x01

#define SET_RET_META 1
#define ADD_RET_META 2
#define DEL_RET_META 3

/**
 * This flag is used with the get meta response packet. If set it
 * specifies that the item recieved has been deleted, but that the
 * items meta data is still contained in ep-engine. Eg. the item
 * has been soft deleted.
 */
#define GET_META_ITEM_DELETED_FLAG 0x01


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
     * Message format for CMD_SET_CONFIG
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_set_cluster_config;

    /**
     * Message format for CMD_GET_CONFIG
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_get_cluster_config;

    /**
     * Message format for CMD_GET_ADJUSTED_TIME
     *
     * The PROTOCOL_BINARY_CMD_GET_ADJUSTED_TIME command will be
     * used by XDCR to retrieve the vbucket's latest adjusted_time
     * which is calculated based on the driftCounter if timeSync
     * has been enabled.
     *
     * Request:-
     *
     * Header: Contains a vbucket id.
     *
     * Response:-
     *
     * The response will contain the adjusted_time (type: int64_t)
     * as part of the body if in case of a SUCCESS, or else a NOTSUP
     * in case of timeSync not being enabled.
     *
     * The request packet's header will contain the vbucket_id.
     */
    typedef protocol_binary_request_no_extras protocol_binary_request_get_adjusted_time;

    /**
     * Message format for CMD_SET_DRIFT_COUNTER_STATE
     *
     * The PROTOCOL_BINARY_CMD_SET_DRIFT_COUNTER_STATE command will be
     * used by GO-XDCR to set the initial drift counter and enable/disable
     * the time synchronization for the vbucket.
     *
     * Request:-
     *
     * Header: Contains a vbucket id.
     * Extras: Contains the initial drift value which is of type int64_t and
     * the time sync state (0x00 for disable, 0x01 for enable),
     *
     * Response:-
     *
     * The response will return a SUCCESS after saving the settings and
     * a NOT_MY_VBUCKET (along with cluster config) if the vbucket isn't
     * found.
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                int64_t initial_drift;
                uint8_t time_sync;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 9];
    } protocol_binary_request_set_drift_counter_state;

    /**
     * The physical layout for the CMD_COMPACT_DB
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint64_t purge_before_ts;
                uint64_t purge_before_seq;
                uint8_t  drop_deletes;
                uint8_t  align_pad1;
                uint16_t align_pad2;
                uint32_t align_pad3;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 24];
    } protocol_binary_request_compact_db;

    typedef protocol_binary_request_get protocol_binary_request_get_random;

#define OBS_STATE_NOT_PERSISTED 0x00
#define OBS_STATE_PERSISTED     0x01
#define OBS_STATE_NOT_FOUND     0x80
#define OBS_STATE_LOGICAL_DEL   0x81

    /**
     * The physical layout for the PROTOCOL_BINARY_CMD_AUDIT_PUT
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint32_t id;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 4];
    } protocol_binary_request_audit_put;

    typedef protocol_binary_response_no_extras protocol_binary_response_audit_put;

    /**
     * The PROTOCOL_BINARY_CMD_OBSERVE_SEQNO command is used by the
     * client to retrieve information about the vbucket in order to
     * find out if a particular mutation has been persisted or
     * replicated at the server side. In order to do so, the client
     * would pass the vbucket uuid of the vbucket that it wishes to
     * observe to the serve.  The response would contain the last
     * persisted sequence number and the latest sequence number in the
     * vbucket. For example, if a client sends a request to observe
     * the vbucket 0 with uuid 12345 and if the response contains the
     * values <58, 65> and then the client can infer that sequence
     * number 56 has been persisted, 60 has only been replicated and
     * not been persisted yet and 68 has not been replicated yet.
     */

    /**
     * Definition of the request packet for the observe_seqno command.
     *
     * Header: Contains the vbucket id of the vbucket that the client
     *         wants to observe.
     *
     * Body: Contains the vbucket uuid of the vbucket that the client
     *       wants to observe. The vbucket uuid is of type uint64_t.
     *
     */
    typedef union {
        struct {
            protocol_binary_request_header header;
            struct {
                uint64_t uuid;
            } body;
        } message;
        uint8_t bytes[sizeof(protocol_binary_request_header) + 8];
    } protocol_binary_request_observe_seqno;

    /**
     * Definition of the response packet for the observe_seqno command.
     * Body: Contains a tuple of the form
     *       <format_type, vbucket id, vbucket uuid, last_persisted_seqno, current_seqno>
     *
     *       - format_type is of type uint8_t and it describes whether
     *         the vbucket has failed over or not. 1 indicates a hard
     *         failover, 0 indicates otherwise.
     *       - vbucket id is of type uint16_t and it is the identifier for
     *         the vbucket.
     *       - vbucket uuid is of type uint64_t and it represents a UUID for
     *          the vbucket.
     *       - last_persisted_seqno is of type uint64_t and it is the
     *         last sequence number that was persisted for this
     *         vbucket.
     *       - current_seqno is of the type uint64_t and it is the
     *         sequence number of the latest mutation in the vbucket.
     *
     *       In the case of a hard failover, the tuple is of the form
     *       <format_type, vbucket id, vbucket uuid, last_persisted_seqno, current_seqno,
     *       old vbucket uuid, last_received_seqno>
     *
     *       - old vbucket uuid is of type uint64_t and it is the
     *         vbucket UUID of the vbucket prior to the hard failover.
     *
     *       - last_received_seqno is of type uint64_t and it is the
     *         last received sequence number in the old vbucket uuid.
     *
     *       The other fields are the same as that mentioned in the normal case.
     */
    typedef protocol_binary_response_no_extras protocol_binary_response_observe_seqno;

    /**
     * @}
     */
#ifdef __cplusplus
}
#endif
#endif /* PROTOCOL_BINARY_H */
