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

/**
 * Definition of all of the error codes used by libcouchbase
 *
 * @author Trond Norbye
 */
#ifndef LIBCOUCHBASE_ERROR_H
#define LIBCOUCHBASE_ERROR_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

#ifdef __cplusplus
extern "C" {
#endif

    /**
     * Define the error codes in use by the library
     */
    typedef enum {
        /**
         * Indication of success
         */
        LCB_SUCCESS = 0x00,
        /**
         * This error code is only used internally within libcouchbase
         * to represent a state in the network protocol
         */
        LCB_AUTH_CONTINUE = 0x01,
        /**
         * Authentication failed.
         * You provided an invalid username/password combination.
         */
        LCB_AUTH_ERROR = 0x02,
        /**
         * The server detected that operation cannot be executed with
         * requested arguments. For example, when incrementing not a number.
         */
        LCB_DELTA_BADVAL = 0x03,
        /**
         * The server reported that this object is too big
         */
        LCB_E2BIG = 0x04,
        /**
         * The server is too busy to handle your request right now.
         * please back off and try again at a later time.
         */
        LCB_EBUSY = 0x05,
        /**
         * Internal error inside the library. You would have
         * to destroy the instance and create a new one to recover.
         */
        LCB_EINTERNAL = 0x06,
        /**
         * Invalid arguments specified.
         */
        LCB_EINVAL = 0x07,
        /**
         * The server is out of memory
         */
        LCB_ENOMEM = 0x08,
        /**
         * An invalid range specified
         */
        LCB_ERANGE = 0x09,
        /**
         * A generic error code.
         */
        LCB_ERROR = 0x0a,
        /**
         * The server tried to perform the requested operation, but failed
         * due to a temporary constraint. Retrying the operation may work.
         */
        LCB_ETMPFAIL = 0x0b,
        /**
         * The key already exists (with another CAS value)
         */
        LCB_KEY_EEXISTS = 0x0c,
        /**
         * The key does not exists
         */
        LCB_KEY_ENOENT = 0x0d,
        /**
         * Failed to open shared object
         */
        LCB_DLOPEN_FAILED = 0x0e,
        /**
         * Failed to locate the requested symbol in the shared object
         */
        LCB_DLSYM_FAILED = 0x0f,
        /**
         * A network related problem occured (name lookup, read/write/connect
         * etc)
         */
        LCB_NETWORK_ERROR = 0x10,
        /**
         * The server who received the request is not responsible for the
         * object anymore. (This happens during changes in the cluster
         * topology)
         */
        LCB_NOT_MY_VBUCKET = 0x11,
        /**
         * The object was not stored on the server
         */
        LCB_NOT_STORED = 0x12,
        /**
         * The server doesn't support the requested command. This
         * error code differs from LCB_UNKNOWN_COMMAND by that the server
         * knows about the command, but for some reason decided to not
         * support it.
         */
        LCB_NOT_SUPPORTED = 0x13,
        /**
         * The server doesn't know what that command is.
         */
        LCB_UNKNOWN_COMMAND = 0x14,
        /**
         * The server failed to resolve the requested hostname
         */
        LCB_UNKNOWN_HOST = 0x15,
        /**
         * There is something wrong with the datastream received from
         * the server
         */
        LCB_PROTOCOL_ERROR = 0x16,
        /**
         * The operation timed out
         */
        LCB_ETIMEDOUT = 0x17,
        /**
         * Failed to connect to the requested server
         */
        LCB_CONNECT_ERROR = 0x18,
        /**
         * The requested bucket does not exist
         */
        LCB_BUCKET_ENOENT = 0x19,
        /**
         * The client ran out of memory
         */
        LCB_CLIENT_ENOMEM = 0x1a,
        /**
         * The client encountered a temporary error (retry might resolve
         * the problem)
         */
        LCB_CLIENT_ETMPFAIL = 0x1b,
        /**
         * The instance of libcouchbase can't be used in this context
         */
        LCB_EBADHANDLE = 0x1c,
        /**
         * Unexpected usage of the server protocol, like unexpected
         * response. If you've received this error code, please record your
         * steps and file the issue at:
         *
         *   http://www.couchbase.com/issues/browse/MB
         */
        LCB_SERVER_BUG = 0x1d,
        /**
         * Libcouchbase cannot load the plugin because of version mismatch
         */
        LCB_PLUGIN_VERSION_MISMATCH = 0x1e,
        /**
         * The bootstrap hosts list use an invalid/unsupported format
         */
        LCB_INVALID_HOST_FORMAT = 0x1f,
        /**
         * Invalid character used in the path component of an URL
         */
        LCB_INVALID_CHAR = 0x20,

        /**
         * Too many nodes were requested for the observe criteria
         */
        LCB_DURABILITY_ETOOMANY = 0x21,

        /**
         * The same key was passed multiple times in a command list
         */
        LCB_DUPLICATE_COMMANDS = 0x22,

        /**
         * The config says that there is no server yet at that
         * position (-1 in the vbucket map)
         */
        LCB_NO_MATCHING_SERVER = 0x23,

        /**
         * An environment variable recognized by libcouchbase was detected,
         * but it contains an invalid value format
         */
        LCB_BAD_ENVIRONMENT = 0x24,

        /** An operation has not yet completed */
        LCB_BUSY = 0x25,

        /** Administrator account must not be used to access the data
         * in the bucket */
        LCB_INVALID_USERNAME = 0x26,

        /**
         * The contents of the configuration cache file are invalid.
         */
        LCB_CONFIG_CACHE_INVALID = 0x27,

        /**
         * The requested SASL mechanism (forced via lcb_cntl) was not
         * available for use
         */
        LCB_SASLMECH_UNAVAILABLE = 0x28,

        /**
         * Maximum allowed number redirects reached. See lcb_cntl(3)
         * manpage for LCB_MAX_REDIRECTS options to get/set this limit.
         */
        LCB_TOO_MANY_REDIRECTS = 0x29,

#ifdef LIBCOUCHBASE_INTERNAL
        /**
         * This is a private value used by the tests in libcouchbase
         */
        LCB_MAX_ERROR_VAL = 0x2a,
#endif

        /* The errors below this value reserver for libcouchbase usage. */
        LCB_MAX_ERROR = 0x1000
    } lcb_error_t;


#define lcb_is_error_enomem(a) ((a == LCB_CLIENT_ENOMEM) || \
                                (a == LCB_ENOMEM))

#define lcb_is_error_etmpfail(a) ((a == LCB_CLIENT_ETMPFAIL) || \
                                  (a == LCB_ETMPFAIL))

#ifdef __cplusplus
}
#endif

#endif
