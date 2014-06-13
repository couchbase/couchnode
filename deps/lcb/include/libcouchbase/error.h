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
 * @file
 * @brief
 *
 * Definition of all of the error codes used by libcouchbase
 */
#ifndef LIBCOUCHBASE_ERROR_H
#define LIBCOUCHBASE_ERROR_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif


/**
 * @ingroup LCB_PUBAPI
 * @defgroup LCB_ERRORS Error Codes
 * @brief Status codes returned by the library
 *
 * @addtogroup LCB_ERRORS
 * @{
 */
#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Error Categories
 *
 * These error categories are assigned as a series of OR'd bits to each
 * of the error codes in lcb_error_t.
 *
 * @see lcb_get_errtype
 */
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


/**
 * @brief XMacro for all error types
 * @param X macro to be invoked for each function. This will accept the following
 * arguments:
 *  - Raw unquoted literal error identifier (e.g. `LCB_EINVAL`)
 *  - Code for the error (e.g. `0x23`)
 *  - Set of categories for the specific error (e.g. `LCB_ERRTYPE_FOO|LCB_ERRTYPE_BAR`)
 *  - Quoted string literal describing the error (e.g. `"This is sad"`)
 */
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
      "LCB_CNTL_MAX_REDIRECTS option to modify this limit") \
    \
    X(LCB_MAP_CHANGED, 0x2A, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_TRANSIENT, \
      "The cluster map has changed and this operation could not be completed " \
      "or retried internally. Try this operation again") \
    \
    X(LCB_INCOMPLETE_PACKET, 0x2B, LCB_ERRTYPE_TRANSIENT|LCB_ERRTYPE_INPUT, \
      "Incomplete packet was passed to forward function") \
    \
    X(LCB_UNFORWADABLE, 0x2C, LCB_ERRTYPE_INPUT, \
      "Opcode provided in packet cannot be sent to the upstream server. The " \
      "packet contains no inherent server mapping information (i.e. has no key) " \
      "and/or depends on client-visible cluster topologies") \
    \
    X(LCB_ECONNREFUSED, 0x2D, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_TRANSIENT, \
      "The remote host refused the connection. Is the service up?") \
    \
    X(LCB_ESOCKSHUTDOWN, 0x2E, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_TRANSIENT, \
      "The remote host closed the connection") \
    \
    X(LCB_ECONNRESET, 0x2F, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_TRANSIENT, \
      "The connection was forcibly reset by the remote host") \
    \
    X(LCB_ECANTGETPORT, 0x30, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_FATAL, \
      "Could not assign a local port for this socket. For client sockets this means " \
      "there are too many TCP sockets open") \
    \
    X(LCB_EFDLIMITREACHED, 0x31, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_FATAL, \
      "The system or process has reached its maximum number of file descriptors") \
    \
    X(LCB_ENETUNREACH, 0x32, LCB_ERRTYPE_NETWORK|LCB_ERRTYPE_TRANSIENT, \
      "The remote host was unreachable - is your network OK?") \
    \
    X(LCB_ECTL_UNKNOWN, 0x33, LCB_ERRTYPE_INPUT, \
      "Control code passed was unrecognized") \
    \
    X(LCB_ECTL_UNSUPPMODE, 0x34, LCB_ERRTYPE_INPUT, \
      "Invalid modifier for cntl operation (e.g. tried to read a write-only value") \
    \
    X(LCB_ECTL_BADARG, 0x35, LCB_ERRTYPE_INPUT, \
      "Argument passed to cntl was badly formatted")


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

/** @brief If the error is a result of bad input */
#define LCB_EIFINPUT(e) (lcb_get_errtype(e) & LCB_ERRTYPE_INPUT)

/** @brief if the error is a result of a network condition */
#define LCB_EIFNET(e) (lcb_get_errtype(e) & LCB_ERRTYPE_NETWORK)

/** @brief if the error is fatal */
#define LCB_EIFFATAL(e) (lcb_get_errtype(e) & LCB_ERRTYPE_FATAL)

/** @brief if the error is transient */
#define LCB_EIFTMP(e) (lcb_get_errtype(e) & LCB_ERRTYPE_TRANSIENT)

/** @brief if the error is a routine negative server reply */
#define LCB_EIFDATA(e) (lcb_get_errtype(e) & LCB_ERRTYPE_DATAOP)

/** @brief if the error is a result of a plugin implementation */
#define LCB_EIFPLUGIN(e) (lcb_get_errtype(e) & LCB_ERRTYPE_PLUGIN)

/**
 * @brief Get error categories for a specific code
 * @param err the error received
 * @return a set of flags containing the categories for the given error
 * @committed
 */
LIBCOUCHBASE_API
int lcb_get_errtype(lcb_error_t err);

/**
 * Get a textual descrtiption for the given error code
 * @param instance the instance the error code belongs to (you might
 *                 want different localizations for the different instances)
 * @param error the error code
 * @return A textual description of the error message. The caller should
 *         <b>not</b> release the memory returned from this function.
 * @committed
 */
LIBCOUCHBASE_API
const char *lcb_strerror(lcb_t instance, lcb_error_t error);

#ifdef __cplusplus
}
#endif
/**@}*/
#endif
