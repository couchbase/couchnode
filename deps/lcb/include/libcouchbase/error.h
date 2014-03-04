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

    typedef enum {
        /** Error type indicating a likely issue in user input */
        LCB_ERRTYPE_INPUT = 1 << 0,

        /** Error type indicating a likely network failure */
        LCB_ERRTYPE_NETWORK = 1 << 1,

        /** Error type indicating a fatal condition within the server or library */
        LCB_ERRTYPE_FATAL = 1 << 2,

        /** Error type indicating a transient condition within the server */
        LCB_ERRTYPE_TRANSIENT = 1 << 3,

        /** Error type indicating a negative server reply for the data */
        LCB_ERRTYPE_DATAOP = 1 << 4,

        /** Error codes which should never be visible to the user */
        LCB_ERRTYPE_INTERNAL = 1 << 5,

        /** Error code indicating a plugin failure */
        LCB_ERRTYPE_PLUGIN = 1 << 6
    } lcb_errflags_t;

#define LCB_XERR(X) \
    /** Success */ \
    X(LCB_SUCCESS, 0x00, 0, "Success (Not an error)") \
    \
    X(LCB_AUTH_CONTINUE, 0x01, LCB_ERRTYPE_INTERNAL|LCB_ERRTYPE_FATAL, \
      "Error code used internally within libcouchbase for SASL auth. Should " \
      "not be visible from the API") \
    \
    X(LCB_AUTH_ERROR, 0x02, LCB_ERRTYPE_FATAL|LCB_ERRTYPE_INPUT, \
      "Authentication failed. You may have provided an invalid " \
      "username/password combination") \
    \
    X(LCB_DELTA_BADVAL, 0x03, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_DATAOP, \
      "The value requested to be incremented is not stored as a number") \
    \
    X(LCB_E2BIG, 0x04, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_DATAOP, \
      "The object requested is too big to store in the server") \
    \
    X(LCB_EBUSY, 0x05, LCB_ERRTYPE_TRANSIENT, \
      "The server is busy. Try again later") \
    \
    X(LCB_EINTERNAL, 0x06, LCB_ERRTYPE_INTERNAL, \
      "Internal libcouchbase error") \
    \
    X(LCB_EINVAL, 0x07, LCB_ERRTYPE_INPUT, \
      "Invalid input/arguments") \
    \
    X(LCB_ENOMEM, 0x08, LCB_ERRTYPE_TRANSIENT, \
      "The server is out of memory. Try again later") \
    \
    X(LCB_ERANGE, 0x09, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_DATAOP, \
      "Invalid range") \
    \
    X(LCB_ERROR, 0x0A, 0, \
      "Generic error") \
    \
    X(LCB_ETMPFAIL, 0x0B, LCB_ERRTYPE_TRANSIENT, \
      "Temporary failure received from server. Try again later") \
    \
    X(LCB_KEY_EEXISTS, 0x0C, LCB_ERRTYPE_DATAOP, \
      "The key already exists in the server. If you have supplied a CAS then " \
      "the key exists with a CAS value different than specified") \
    \
    X(LCB_KEY_ENOENT, 0x0D, LCB_ERRTYPE_DATAOP, \
      "The key does not exist on the server") \
    \
    X(LCB_DLOPEN_FAILED, 0x0E, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_FATAL|LCB_ERRTYPE_PLUGIN, \
      "Could not locate plugin library") \
    \
    X(LCB_DLSYM_FAILED, 0x0F, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_FATAL|LCB_ERRTYPE_PLUGIN, \
      "Required plugin initializer not found") \
    \
    X(LCB_NETWORK_ERROR, 0x10, LCB_ERRTYPE_NETWORK, \
      "Network failure") \
    \
    X(LCB_NOT_MY_VBUCKET, 0x11, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_TRANSIENT, \
      "The server which received this command claims it is not hosting this key") \
    \
    X(LCB_NOT_STORED, 0x12, LCB_ERRTYPE_DATAOP, \
      "Item not stored (did you try to append/prepend to a missing key?)") \
    \
    X(LCB_NOT_SUPPORTED, 0x13, 0, \
      "Operation not supported") \
    \
    X(LCB_UNKNOWN_COMMAND, 0x14, 0, \
      "Unknown command") \
    \
    X(LCB_UNKNOWN_HOST, 0x15, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_INPUT, \
      "DNS/Hostname lookup failed") \
    \
    X(LCB_PROTOCOL_ERROR, 0x16, LCB_ERRTYPE_NETWORK, \
      "Data received on socket was not in the expected format") \
    \
    X(LCB_ETIMEDOUT, 0x17, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_TRANSIENT, \
      "Client-Side timeout exceeded for operation. Inspect network conditions " \
      "or increase the timeout") \
    \
    X(LCB_CONNECT_ERROR, 0x18, LCB_ERRTYPE_NETWORK, \
      "Error while establishing TCP connection") \
    \
    X(LCB_BUCKET_ENOENT, 0x19, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_FATAL, \
      "The bucket requested does not exist") \
    \
    X(LCB_CLIENT_ENOMEM, 0x1A, LCB_ERRTYPE_FATAL, \
      "Memory allocation for libcouchbase failed. Severe problems ahead") \
    \
    X(LCB_CLIENT_ETMPFAIL, 0x1B, LCB_ERRTYPE_TRANSIENT, \
      "Temporary failure on the client side. Did you call lcb_connect?") \
    \
    X(LCB_EBADHANDLE, 0x1C, LCB_ERRTYPE_INPUT, \
      "Bad handle type for operation. " \
      "You cannot perform administrative operations on a data handle, or data "\
      "operations on a cluster handle") \
    \
    X(LCB_SERVER_BUG, 0x1D, 0, "Encountered a server bug") \
    \
    X(LCB_PLUGIN_VERSION_MISMATCH, 0x1E, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_FATAL|LCB_ERRTYPE_PLUGIN, \
      "This version of libcouchbase cannot load the specified plugin") \
    \
    X(LCB_INVALID_HOST_FORMAT, 0x1F, LCB_ERRTYPE_INPUT, \
      "Hostname specified for URI is in an invalid format") \
    \
    X(LCB_INVALID_CHAR, 0x20, LCB_ERRTYPE_INPUT, "Illegal characted") \
    \
    X(LCB_DURABILITY_ETOOMANY, 0x21, LCB_ERRTYPE_INPUT, \
      "Durability constraints requires more nodes/replicas than the cluster "\
      "configuration allows. Durability constraints will never be satisfied") \
    \
    X(LCB_DUPLICATE_COMMANDS, 0x22, LCB_ERRTYPE_INPUT, \
      "The same key was specified more than once in the command list") \
    \
    X(LCB_NO_MATCHING_SERVER, 0x23, LCB_ERRTYPE_TRANSIENT, \
      "No node was found for servicing this key. This may be a result of a " \
      "nonexistent/stale cluster configuration") \
    \
    X(LCB_BAD_ENVIRONMENT, 0x24, LCB_ERRTYPE_FATAL|LCB_ERRTYPE_INPUT, \
      "The value for an environment variable recognized by libcouchbase was " \
      "specified in an incorrect format. Check your environment for entries " \
      "starting with 'LCB_' or 'LIBCOUCHBASE_'") \
    \
    X(LCB_BUSY, 0x25, LCB_ERRTYPE_INTERNAL, "Busy. This is an internal error") \
    \
    X(LCB_INVALID_USERNAME, 0x26, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_FATAL, \
      "The administrative account can no longer be used for data access") \
    \
    X(LCB_CONFIG_CACHE_INVALID, 0x27, LCB_ERRTYPE_INPUT, \
      "The contents of the configuration cache file were invalid. Configuration " \
      "will be fetched from the network") \
    \
    X(LCB_SASLMECH_UNAVAILABLE, 0x28, LCB_ERRTYPE_INPUT|LCB_ERRTYPE_FATAL, \
      "The requested SASL mechanism was not supported by the server. Either " \
      "upgrade the server or change the mechanism requirements") \
    \
    X(LCB_TOO_MANY_REDIRECTS, 0x29, LCB_ERRTYPE_NETWORK, \
      "Maximum allowed number of redirects reached. See lcb_cntl and the "\
      "LCB_CNTL_MAX_REDIRECTS option to modify this limit")

    /**
     * Define the error codes in use by the library
     */
    typedef enum {
#define X(n, v, cls, s) n = v,
        LCB_XERR(X)
#undef X

#ifdef LIBCOUCHBASE_INTERNAL
        /**
         * This is a private value used by the tests in libcouchbase
         */
        LCB_MAX_ERROR_VAL,
#endif

        /* The errors below this value reserver for libcouchbase usage. */
        LCB_MAX_ERROR = 0x1000
    } lcb_error_t;


#define lcb_is_error_enomem(a) ((a == LCB_CLIENT_ENOMEM) || \
                                (a == LCB_ENOMEM))

#define lcb_is_error_etmpfail(a) ((a == LCB_CLIENT_ETMPFAIL) || \
                                  (a == LCB_ETMPFAIL))

#define LCB_EIFINPUT(e) (lcb_get_errtype(e) & LCB_ERRTYPE_INPUT)
#define LCB_EIFNET(e) (lcb_get_errtype(e) & LCB_ERRTYPE_NETWORK)
#define LCB_EIFFATAL(e) (lcb_get_errtype(e) & LCB_ERRTYPE_FATAL)
#define LCB_EIFTMP(e) (lcb_get_errtype(e) & LCB_ERRTYPE_TRANSIENT)
#define LCB_EIFDATA(e) (lcb_get_errtype(e) & LCB_ERRTYPE_DATAOP)
#define LCB_EIFPLUGIN(e) (lcb_get_errtype(e) & LCB_ERRTYPE_PLUGIN)

LIBCOUCHBASE_API
int lcb_get_errtype(lcb_error_t err);

#ifdef __cplusplus
}
#endif
#endif
