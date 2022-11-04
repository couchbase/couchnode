/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2020 Couchbase, Inc.
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
 * Definition of all of the error codes used by libcouchbase
 */
#ifndef LIBCOUCHBASE_ERROR_H
#define LIBCOUCHBASE_ERROR_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-error-codes Error Codes
 * @brief Status codes returned by the library
 *
 * @addtogroup lcb-error-codes
 * @{
 */
#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    LCB_ERROR_TYPE_SUCCESS = 0,
    LCB_ERROR_TYPE_BASE = 1,
    LCB_ERROR_TYPE_SHARED = 2,
    LCB_ERROR_TYPE_KEYVALUE = 3,
    LCB_ERROR_TYPE_QUERY = 4,
    LCB_ERROR_TYPE_ANALYTICS = 5,
    LCB_ERROR_TYPE_SEARCH = 6,
    LCB_ERROR_TYPE_VIEW = 7,
    LCB_ERROR_TYPE_MANAGEMENT = 8,
    LCB_ERROR_TYPE_SDK = 10
} lcb_ERROR_TYPE;

typedef enum {
    LCB_ERROR_FLAG_NETWORK = 1u << 0u,
    LCB_ERROR_FLAG_SUBDOC = 1u << 1u,
    LCB_ERROR_FLAG_TRANSIENT = 1u << 2u,
    LCB_ERROR_FLAG_FATAL = 1u << 3u,
    LCB_ERROR_FLAG_INPUT = 1u << 4u,
} lcb_ERROR_FLAGS;

/* clang-format off */
#define LCB_XERROR(X)                                                                                                    \
/* Common Error Definitions */ \
X(LCB_SUCCESS,                   0,   LCB_ERROR_TYPE_SUCCESS, 0, "Success (Not an error)") \
X(LCB_ERR_GENERIC,               100, LCB_ERROR_TYPE_BASE,    0, "Generic error code") \
\
/* Shared Error Definitions */ \
X(LCB_ERR_TIMEOUT,                  201, LCB_ERROR_TYPE_SHARED, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_TRANSIENT, "The request was not completed by the user-defined timeout") \
X(LCB_ERR_REQUEST_CANCELED,         202, LCB_ERROR_TYPE_SHARED, 0, "A request is cancelled and cannot be resolved in a non-ambiguous way. Most likely the request is in-flight on the socket and the socket gets closed.") \
X(LCB_ERR_INVALID_ARGUMENT,         203, LCB_ERROR_TYPE_SHARED, LCB_ERROR_FLAG_INPUT, "It is unambiguously determined that the error was caused because of invalid arguments from the user") \
X(LCB_ERR_SERVICE_NOT_AVAILABLE,    204, LCB_ERROR_TYPE_SHARED, 0, "It was determined from the config unambiguously that the service is not available") \
X(LCB_ERR_INTERNAL_SERVER_FAILURE,  205, LCB_ERROR_TYPE_SHARED, 0, "Internal server error") \
X(LCB_ERR_AUTHENTICATION_FAILURE,   206, LCB_ERROR_TYPE_SHARED, LCB_ERROR_FLAG_INPUT, "Authentication error. Possible reasons: incorrect authentication configuration, bucket doesn't exist or bucket may be hibernated.") \
X(LCB_ERR_TEMPORARY_FAILURE,        207, LCB_ERROR_TYPE_SHARED, LCB_ERROR_FLAG_TRANSIENT, "Temporary failure") \
X(LCB_ERR_PARSING_FAILURE,          208, LCB_ERROR_TYPE_SHARED, 0, "Parsing failed") \
X(LCB_ERR_CAS_MISMATCH,             209, LCB_ERROR_TYPE_SHARED, LCB_ERROR_FLAG_INPUT, "CAS mismatch") \
X(LCB_ERR_BUCKET_NOT_FOUND,         210, LCB_ERROR_TYPE_SHARED, LCB_ERROR_FLAG_INPUT, "A request is made but the current bucket is not found") \
X(LCB_ERR_COLLECTION_NOT_FOUND,     211, LCB_ERROR_TYPE_SHARED, 0, "A request is made but the current collection (including scope) is not found") \
X(LCB_ERR_ENCODING_FAILURE,         212, LCB_ERROR_TYPE_SHARED, 0, "Encoding of user object failed while trying to write it to the cluster") \
X(LCB_ERR_DECODING_FAILURE,         213, LCB_ERROR_TYPE_SHARED, 0, "Decoding of the data into the user object failed") \
X(LCB_ERR_UNSUPPORTED_OPERATION,    214, LCB_ERROR_TYPE_SHARED, 0, "Unsupported operation") \
X(LCB_ERR_AMBIGUOUS_TIMEOUT,        215, LCB_ERROR_TYPE_SHARED, 0, "Ambiguous timeout") \
X(LCB_ERR_UNAMBIGUOUS_TIMEOUT,      216, LCB_ERROR_TYPE_SHARED, 0, "Unambiguous timeout") \
X(LCB_ERR_SCOPE_NOT_FOUND,          217, LCB_ERROR_TYPE_SHARED, 0, "Scope is not found") \
X(LCB_ERR_INDEX_NOT_FOUND,          218, LCB_ERROR_TYPE_SHARED, 0, "Index is not found") \
X(LCB_ERR_INDEX_EXISTS,             219, LCB_ERROR_TYPE_SHARED, 0, "Index is exist already") \
X(LCB_ERR_RATE_LIMITED,             220, LCB_ERROR_TYPE_SHARED, 0, "The service decided that the caller must be rate limited due to exceeding a rate threshold") \
X(LCB_ERR_QUOTA_LIMITED,            221, LCB_ERROR_TYPE_SHARED, 0, "The service decided that the caller must be limited due to exceeding a quota threshold") \
\
/* KeyValue Error Definitions */ \
X(LCB_ERR_DOCUMENT_NOT_FOUND,                           301, LCB_ERROR_TYPE_KEYVALUE, 0, "Document is not found") \
X(LCB_ERR_DOCUMENT_UNRETRIEVABLE,                       302, LCB_ERROR_TYPE_KEYVALUE, 0, "Document is unretrievable") \
X(LCB_ERR_DOCUMENT_LOCKED,                              303, LCB_ERROR_TYPE_KEYVALUE, 0, "Document locked") \
X(LCB_ERR_VALUE_TOO_LARGE,                              304, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_INPUT, "Value too large") \
X(LCB_ERR_DOCUMENT_EXISTS,                              305, LCB_ERROR_TYPE_KEYVALUE, 0, "Document already exists") \
X(LCB_ERR_VALUE_NOT_JSON,                               306, LCB_ERROR_TYPE_KEYVALUE, 0, "Value is not a JSON") \
X(LCB_ERR_DURABILITY_LEVEL_NOT_AVAILABLE,               307, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_INPUT, "Durability level is not available") \
X(LCB_ERR_DURABILITY_IMPOSSIBLE,                        308, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_INPUT, "Durability impossible") \
X(LCB_ERR_DURABILITY_AMBIGUOUS,                         309, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_INPUT, "Durability ambiguous") \
X(LCB_ERR_DURABLE_WRITE_IN_PROGRESS,                    310, LCB_ERROR_TYPE_KEYVALUE, 0, "Durable write in progress") \
X(LCB_ERR_DURABLE_WRITE_RE_COMMIT_IN_PROGRESS,          311, LCB_ERROR_TYPE_KEYVALUE, 0, "Durable write re-commit in progress") \
X(LCB_ERR_MUTATION_LOST,                                312, LCB_ERROR_TYPE_KEYVALUE, 0, "Mutation lost") \
X(LCB_ERR_SUBDOC_PATH_NOT_FOUND,                        313, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC, "Subdoc: path not found") \
X(LCB_ERR_SUBDOC_PATH_MISMATCH,                         314, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC, "Subdoc: path mismatch") \
X(LCB_ERR_SUBDOC_PATH_INVALID,                          315, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: path invalid") \
X(LCB_ERR_SUBDOC_PATH_TOO_BIG,                          316, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: path too big") \
X(LCB_ERR_SUBDOC_PATH_TOO_DEEP,                         317, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: document too deep") \
X(LCB_ERR_SUBDOC_VALUE_TOO_DEEP,                        318, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: value too deep") \
X(LCB_ERR_SUBDOC_VALUE_INVALID,                         319, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: cannot insert value") \
X(LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON,                     320, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC, "Subdoc: document is not a JSON") \
X(LCB_ERR_SUBDOC_NUMBER_TOO_BIG,                        321, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: number is too big") \
X(LCB_ERR_SUBDOC_DELTA_INVALID,                         322, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: invalid delta range") \
X(LCB_ERR_SUBDOC_PATH_EXISTS,                           323, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC, "Subdoc: path already exists") \
X(LCB_ERR_SUBDOC_XATTR_UNKNOWN_MACRO,                   324, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: XATTR unknown macro") \
X(LCB_ERR_SUBDOC_XATTR_INVALID_FLAG_COMBO,              325, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: XATTR invalid flag combination") \
X(LCB_ERR_SUBDOC_XATTR_INVALID_KEY_COMBO,               326, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: XATTR invalid key combination") \
X(LCB_ERR_SUBDOC_XATTR_UNKNOWN_VIRTUAL_ATTRIBUTE,       327, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: XATTR unknown virtual attribute") \
X(LCB_ERR_SUBDOC_XATTR_CANNOT_MODIFY_VIRTUAL_ATTRIBUTE, 328, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: XATTR cannot modify virtual attribute") \
X(LCB_ERR_SUBDOC_XATTR_INVALID_ORDER,                   329, LCB_ERROR_TYPE_KEYVALUE, LCB_ERROR_FLAG_SUBDOC | LCB_ERROR_FLAG_INPUT, "Subdoc: XATTR invalid order") \
\
/* Query Error Definitions */ \
X(LCB_ERR_PLANNING_FAILURE,             401, LCB_ERROR_TYPE_QUERY, 0, "Planning failed") \
X(LCB_ERR_INDEX_FAILURE,                402, LCB_ERROR_TYPE_QUERY, 0, "Query index failure") \
X(LCB_ERR_PREPARED_STATEMENT_FAILURE,   403, LCB_ERROR_TYPE_QUERY, 0, "Prepared statement failure") \
X(LCB_ERR_KEYSPACE_NOT_FOUND,           404, LCB_ERROR_TYPE_QUERY, 0, "Keyspace is not found (collection or bucket does not exist)") \
X(LCB_ERR_DML_FAILURE,                  405, LCB_ERROR_TYPE_QUERY, 0, "Data service returned an error during execution of DML statement") \
\
/* Analytics Error Definitions */ \
X(LCB_ERR_COMPILATION_FAILED,           501, LCB_ERROR_TYPE_ANALYTICS, 0, "Compilation failed") \
X(LCB_ERR_JOB_QUEUE_FULL,               502, LCB_ERROR_TYPE_ANALYTICS, 0, "Job queue is full") \
X(LCB_ERR_DATASET_NOT_FOUND,            503, LCB_ERROR_TYPE_ANALYTICS, 0, "Dataset is not found") \
X(LCB_ERR_DATAVERSE_NOT_FOUND,          504, LCB_ERROR_TYPE_ANALYTICS, 0, "Dataverse is not found") \
X(LCB_ERR_DATASET_EXISTS,               505, LCB_ERROR_TYPE_ANALYTICS, 0, "Dataset already exists") \
X(LCB_ERR_DATAVERSE_EXISTS,             506, LCB_ERROR_TYPE_ANALYTICS, 0, "Dataverse already exists") \
X(LCB_ERR_ANALYTICS_LINK_NOT_FOUND,     507, LCB_ERROR_TYPE_ANALYTICS, 0, "Analytics link is not found") \
\
/* Search Error Definitions (6xx) */ \
\
/* View Error Definitions */ \
X(LCB_ERR_VIEW_NOT_FOUND,               701, LCB_ERROR_TYPE_VIEW, 0, "View is not found") \
X(LCB_ERR_DESIGN_DOCUMENT_NOT_FOUND,    702, LCB_ERROR_TYPE_VIEW, 0, "Design document is not found") \
\
/* Management API Error Definitions */ \
X(LCB_ERR_COLLECTION_ALREADY_EXISTS,    801, LCB_ERROR_TYPE_MANAGEMENT, 0, "Collection already exists") \
X(LCB_ERR_SCOPE_EXISTS,                 802, LCB_ERROR_TYPE_MANAGEMENT, 0, "Scope already exists") \
X(LCB_ERR_USER_NOT_FOUND,               803, LCB_ERROR_TYPE_MANAGEMENT, 0, "User is not found") \
X(LCB_ERR_GROUP_NOT_FOUND,              804, LCB_ERROR_TYPE_MANAGEMENT, 0, "Group is not found") \
X(LCB_ERR_BUCKET_ALREADY_EXISTS,        805, LCB_ERROR_TYPE_MANAGEMENT, 0, "Bucket already exists") \
\
/* SDK-specific Error Definitions */ \
X(LCB_ERR_SSL_INVALID_CIPHERSUITES,         1000, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_FATAL, "OpenSSL encountered an error in the provided ciphersuites (TLS >= 1.3)") \
X(LCB_ERR_SSL_NO_CIPHERS,                   1001, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_FATAL, "OpenSSL does not support any of the ciphers provided (TLS < 1.3)") \
X(LCB_ERR_SSL_ERROR,                        1002, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_FATAL, "A generic error related to the SSL subsystem was encountered. Enable logging to see more details") \
X(LCB_ERR_SSL_CANTVERIFY,                   1003, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_FATAL, "Client could not verify server's certificate") \
X(LCB_ERR_FD_LIMIT_REACHED,                 1004, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_FATAL, "The system or process has reached its maximum number of file descriptors") \
X(LCB_ERR_NODE_UNREACHABLE,                 1005, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_TRANSIENT, "The remote host is not reachable")  \
X(LCB_ERR_CONTROL_UNKNOWN_CODE,             1006, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Control code passed was unrecognized") \
X(LCB_ERR_CONTROL_UNSUPPORTED_MODE,         1007, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Invalid modifier for cntl operation (e.g. tried to read a write-only value") \
X(LCB_ERR_CONTROL_INVALID_ARGUMENT,         1008, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Argument passed to cntl was badly formatted")                         \
X(LCB_ERR_DUPLICATE_COMMANDS,               1009, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "The same key was specified more than once in the command list") \
X(LCB_ERR_NO_MATCHING_SERVER,               1010, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_TRANSIENT, "The node the request was mapped to does not exist in the current cluster map. This may be the result of a failover") \
X(LCB_ERR_PLUGIN_VERSION_MISMATCH,          1011, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT | LCB_ERROR_FLAG_FATAL, "This version of libcouchbase cannot load the specified plugin") \
X(LCB_ERR_INVALID_HOST_FORMAT,              1012, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Hostname specified for URI is in an invalid format") \
X(LCB_ERR_INVALID_CHAR,                     1013, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Illegal character") \
X(LCB_ERR_BAD_ENVIRONMENT,                  1014, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT | LCB_ERROR_FLAG_FATAL, "The value for an environment variable recognized by libcouchbase was specified in an incorrect format. Check your environment for entries starting with 'LCB_' or 'LIBCOUCHBASE_'") \
X(LCB_ERR_NO_MEMORY,                        1015, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_TRANSIENT, "Memory allocation for libcouchbase failed. Severe problems ahead")  \
X(LCB_ERR_NO_CONFIGURATION,                 1016, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_TRANSIENT, "Client not bootstrapped. Ensure bootstrap/connect was attempted and was successful") \
X(LCB_ERR_DLOPEN_FAILED,                    1017, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT | LCB_ERROR_FLAG_FATAL, "Could not locate plugin library") \
X(LCB_ERR_DLSYM_FAILED,                     1018, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT | LCB_ERROR_FLAG_FATAL, "Required plugin initializer not found") \
X(LCB_ERR_CONFIG_CACHE_INVALID,             1019, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "The contents of the configuration cache file were invalid. Configuration will be fetched from the network") \
X(LCB_ERR_COLLECTION_MANIFEST_IS_AHEAD,     1020, LCB_ERROR_TYPE_SDK, 0, "Collections manifest of SDK is ahead of Server's") \
X(LCB_ERR_COLLECTION_NO_MANIFEST,           1021, LCB_ERROR_TYPE_SDK, 0, "No Collections Manifest") \
X(LCB_ERR_COLLECTION_CANNOT_APPLY_MANIFEST, 1022, LCB_ERROR_TYPE_SDK, 0, "Cannot apply collections manifest") \
X(LCB_ERR_AUTH_CONTINUE,                    1023, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_FATAL, "Error code used internally within libcouchbase for SASL auth. Should not be visible from the API") \
X(LCB_ERR_CONNECTION_REFUSED,               1024, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_TRANSIENT, "The remote host refused the connection") \
X(LCB_ERR_SOCKET_SHUTDOWN,                  1025, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_TRANSIENT, "The remote host closed the connection") \
X(LCB_ERR_CONNECTION_RESET,                 1026, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_TRANSIENT, "The connection was forcibly reset by the remote host") \
X(LCB_ERR_CANNOT_GET_PORT,                  1027, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_FATAL, "Could not assign a local port for this socket. For client sockets this means there are too many TCP sockets open") \
X(LCB_ERR_INCOMPLETE_PACKET,                1028, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT | LCB_ERROR_FLAG_TRANSIENT, "Incomplete packet was passed to forward function") \
X(LCB_ERR_SDK_FEATURE_UNAVAILABLE,          1029, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "The requested feature is not supported by the client, either because of settings in the configured instance, or because of options disabled at the time the library was compiled") \
X(LCB_ERR_OPTIONS_CONFLICT,                 1030, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "The operation structure contains conflicting options") \
X(LCB_ERR_KVENGINE_INVALID_PACKET,          1031, LCB_ERROR_TYPE_SDK, 0, "A badly formatted packet was sent to the server. Please report this in a bug") \
X(LCB_ERR_DURABILITY_TOO_MANY,              1032, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Durability constraints requires more nodes/replicas than the cluster configuration allows. Durability constraints will never be satisfied") \
X(LCB_ERR_SHEDULE_FAILURE,                  1033, LCB_ERROR_TYPE_SDK, 0, "Internal error used for destroying unscheduled command data") \
X(LCB_ERR_DURABILITY_NO_MUTATION_TOKENS,    1034, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "The given item does not have a mutation token associated with it. this is either because fetching mutation tokens was not enabled, or you are trying to check on something not stored by this instance") \
X(LCB_ERR_SASLMECH_UNAVAILABLE,             1035, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT | LCB_ERROR_FLAG_FATAL, "The requested SASL mechanism was not supported by the server. Either upgrade the server or change the mechanism requirements") \
X(LCB_ERR_TOO_MANY_REDIRECTS,               1036, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK, "Maximum allowed number of redirects reached. See lcb_cntl and the LCB_CNTL_MAX_REDIRECTS option to modify this limit") \
X(LCB_ERR_MAP_CHANGED,                      1037, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_TRANSIENT, "The cluster map has changed and this operation could not be completed or retried internally. Try this operation again") \
X(LCB_ERR_NOT_MY_VBUCKET,                   1038, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK | LCB_ERROR_FLAG_TRANSIENT, "The server which received this command claims it is not hosting this key") \
X(LCB_ERR_UNKNOWN_SUBDOC_COMMAND,           1039, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Unknown subdocument command") \
X(LCB_ERR_KVENGINE_UNKNOWN_ERROR,           1040, LCB_ERROR_TYPE_SDK, 0, "The server replied with an unrecognized status code. A newer version of this library may be able to decode it") \
X(LCB_ERR_NAMESERVER,                       1041, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK, "Invalid reply received from nameserver") \
X(LCB_ERR_INVALID_RANGE,                    1042, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "Invalid range") \
X(LCB_ERR_NOT_STORED,                       1043, LCB_ERROR_TYPE_SDK, 0, "Item not stored (did you try to append/prepend to a missing key?)") \
X(LCB_ERR_BUSY,                             1044, LCB_ERROR_TYPE_SDK, 0, "Busy. This is an internal error") \
X(LCB_ERR_SDK_INTERNAL,                     1045, LCB_ERROR_TYPE_SDK, 0, "Internal libcouchbase error") \
X(LCB_ERR_INVALID_DELTA,                    1046, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "The value requested to be incremented is not stored as a number") \
X(LCB_ERR_NO_COMMANDS,                      1047, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "No commands specified") \
X(LCB_ERR_NETWORK,                          1048, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK, "Generic network failure") \
X(LCB_ERR_UNKNOWN_HOST,                     1049, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT | LCB_ERROR_FLAG_NETWORK, "DNS/Hostname lookup failed") \
X(LCB_ERR_PROTOCOL_ERROR,                   1050, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK, "Data received on socket was not in the expected format") \
X(LCB_ERR_CONNECT_ERROR,                    1051, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_NETWORK, "Error while establishing TCP connection") \
X(LCB_ERR_EMPTY_KEY,                        1052, LCB_ERROR_TYPE_SDK, LCB_ERROR_FLAG_INPUT, "An empty key was passed to an operation") \
X(LCB_ERR_HTTP,                             1053, LCB_ERROR_TYPE_SDK, 0, "HTTP Operation failed. Inspect status code for details") \
X(LCB_ERR_QUERY,                            1054, LCB_ERROR_TYPE_SDK, 0, "Query execution failed. Inspect raw response object for information") \
X(LCB_ERR_TOPOLOGY_CHANGE,                  1055, LCB_ERROR_TYPE_SDK, 0, "Topology Change (internal)")
/* clang-format on */

/** Error codes returned by the library. */
typedef enum {
#define X(n, v, cls, f, s) n = v,
    LCB_XERROR(X)
#undef X

    /** The errors below this value reserved for libcouchbase usage. */
    LCB_MAX_ERROR = 2000
} lcb_STATUS;

/** @brief if the error is a result of a network condition */
#define LCB_ERROR_IS_NETWORK(e) ((lcb_error_flags(e) & LCB_ERROR_FLAG_NETWORK) == LCB_ERROR_FLAG_NETWORK)
#define LCB_ERROR_IS_SUBDOC(e) ((lcb_error_flags(e) & LCB_ERROR_FLAG_SUBDOC) == LCB_ERROR_FLAG_SUBDOC)
#define LCB_ERROR_IS_TRANSIENT(e) ((lcb_error_flags(e) & LCB_ERROR_FLAG_TRANSIENT) == LCB_ERROR_FLAG_TRANSIENT)
#define LCB_ERROR_IS_FATAL(e) ((lcb_error_flags(e) & LCB_ERROR_FLAG_FATAL) == LCB_ERROR_FLAG_FATAL)
#define LCB_ERROR_IS_INPUT(e) ((lcb_error_flags(e) & LCB_ERROR_FLAG_INPUT) == LCB_ERROR_FLAG_INPUT)

typedef struct lcb_KEY_VALUE_ERROR_CONTEXT_ lcb_KEY_VALUE_ERROR_CONTEXT;
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_rc(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_status_code(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, uint16_t *status_code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_opaque(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, uint32_t *opaque);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_cas(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_key(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **key,
                                              size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_bucket(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **bucket,
                                                 size_t *bucket_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_collection(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **collection,
                                                     size_t *collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_scope(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **scope,
                                                size_t *scope_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_context(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **context,
                                                  size_t *context_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_ref(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **ref,
                                              size_t *ref_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_endpoint(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **endpoint,
                                                   size_t *endpoint_len);

typedef struct lcb_QUERY_ERROR_CONTEXT_ lcb_QUERY_ERROR_CONTEXT;
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_rc(const lcb_QUERY_ERROR_CONTEXT *ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_first_error_code(const lcb_QUERY_ERROR_CONTEXT *ctx, uint32_t *code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_first_error_message(const lcb_QUERY_ERROR_CONTEXT *ctx,
                                                                 const char **message, size_t *message_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_error_response_body(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **body,
                                                                 size_t *body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_statement(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **statement,
                                                       size_t *statement_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_client_context_id(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **id,
                                                               size_t *id_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_query_params(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **params,
                                                          size_t *params_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_http_response_code(const lcb_QUERY_ERROR_CONTEXT *ctx, uint32_t *code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_http_response_body(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **body,
                                                                size_t *body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_endpoint(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **endpoint,
                                                      size_t *endpoint_len);

typedef struct lcb_ANALYTICS_ERROR_CONTEXT_ lcb_ANALYTICS_ERROR_CONTEXT;
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_rc(const lcb_ANALYTICS_ERROR_CONTEXT *ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_first_error_code(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                  uint32_t *code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_first_error_message(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                     const char **message, size_t *message_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_statement(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                           const char **statement, size_t *statement_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_query_params(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                              const char **query_params, size_t *query_params_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_client_context_id(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                   const char **id, size_t *id_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_http_response_code(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                    uint32_t *code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_http_response_body(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                    const char **body, size_t *body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_endpoint(const lcb_ANALYTICS_ERROR_CONTEXT *ctx, const char **endpoint,
                                                          size_t *endpoint_len);

typedef struct lcb_VIEW_ERROR_CONTEXT_ lcb_VIEW_ERROR_CONTEXT;
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_rc(const lcb_VIEW_ERROR_CONTEXT *ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_first_error_code(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **code,
                                                             size_t *code_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_first_error_message(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **message,
                                                                size_t *message_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_design_document(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **name,
                                                            size_t *name_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_view(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **name,
                                                 size_t *name_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_query_params(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **params,
                                                         size_t *params_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_http_response_code(const lcb_VIEW_ERROR_CONTEXT *ctx, uint32_t *code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_http_response_body(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **body,
                                                               size_t *body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_endpoint(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **endpoint,
                                                     size_t *endpoint_len);

typedef struct lcb_SEARCH_ERROR_CONTEXT_ lcb_SEARCH_ERROR_CONTEXT;
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_rc(const lcb_SEARCH_ERROR_CONTEXT *ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_error_message(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **message,
                                                            size_t *message_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_index_name(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **name,
                                                         size_t *name_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_query(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **query,
                                                    size_t *query_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_params(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **params,
                                                     size_t *params_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_http_response_code(const lcb_SEARCH_ERROR_CONTEXT *ctx, uint32_t *code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_http_response_body(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **body,
                                                                 size_t *body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_endpoint(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **endpoint,
                                                       size_t *endpoint_len);

typedef struct lcb_HTTP_ERROR_CONTEXT_ lcb_HTTP_ERROR_CONTEXT;
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_rc(const lcb_HTTP_ERROR_CONTEXT *ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_path(const lcb_HTTP_ERROR_CONTEXT *ctx, const char **path,
                                                 size_t *path_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_response_code(const lcb_HTTP_ERROR_CONTEXT *ctx, uint32_t *code);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_response_body(const lcb_HTTP_ERROR_CONTEXT *ctx, const char **body,
                                                          size_t *body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_endpoint(const lcb_HTTP_ERROR_CONTEXT *ctx, const char **endpoint,
                                                     size_t *endpoint_len);

/**
 * @brief Get error categories for a specific code
 * @param err the error received
 * @return a set of flags containing the categories for the given error
 * @committed
 */
LIBCOUCHBASE_API
uint32_t lcb_error_flags(lcb_STATUS err);

/**
 * Get a shorter textual description of an error message. This is the
 * constant name
 */
LCB_INTERNAL_API
const char *lcb_strerror_short(lcb_STATUS error);

/**
 * Get a longer textual description of an error message.
 */
LCB_INTERNAL_API
const char *lcb_strerror_long(lcb_STATUS error);

/**
 * This may be used in conjunction with the errmap callback if it wishes
 * to fallback for default behavior for the given code.
 * @uncommitted
 */
LIBCOUCHBASE_API
lcb_STATUS lcb_errmap_default(lcb_INSTANCE *instance, lcb_U16 code);

/**
 * Callback for error mappings. This will be invoked when requesting whether
 * the user has a possible mapping for this error code.
 *
 * This will be called for response codes which may be ambiguous in most
 * use cases, or in cases where detailed response codes may be mapped to
 * more generic ones.
 */
typedef lcb_STATUS (*lcb_errmap_callback)(lcb_INSTANCE *instance, lcb_U16 bincode);

/**@uncommitted*/
LIBCOUCHBASE_API
lcb_errmap_callback lcb_set_errmap_callback(lcb_INSTANCE *instance, lcb_errmap_callback);

/* clang-format off */
#define LCB_XRETRY_REASON(X)                                                                                 \
    /* name,                                                 code,   non_idempotent_retry,   always_retry */ \
    X(LCB_RETRY_REASON_UNKNOWN,                              0,      0,                      0)              \
    X(LCB_RETRY_REASON_SOCKET_NOT_AVAILABLE,                 1,      1,                      0)              \
    X(LCB_RETRY_REASON_SERVICE_NOT_AVAILABLE,                2,      1,                      0)              \
    X(LCB_RETRY_REASON_NODE_NOT_AVAILABLE,                   3,      1,                      0)              \
    X(LCB_RETRY_REASON_KV_NOT_MY_VBUCKET,                    4,      1,                      1)              \
    X(LCB_RETRY_REASON_KV_COLLECTION_OUTDATED,               5,      1,                      1)              \
    X(LCB_RETRY_REASON_KV_ERROR_MAP_RETRY_INDICATED,         6,      1,                      0)              \
    X(LCB_RETRY_REASON_KV_LOCKED,                            7,      1,                      0)              \
    X(LCB_RETRY_REASON_KV_TEMPORARY_FAILURE,                 8,      1,                      0)              \
    X(LCB_RETRY_REASON_KV_SYNC_WRITE_IN_PROGRESS,            9,      1,                      0)              \
    X(LCB_RETRY_REASON_KV_SYNC_WRITE_RE_COMMIT_IN_PROGRESS,  10,     1,                      0)              \
    X(LCB_RETRY_REASON_SERVICE_RESPONSE_CODE_INDICATED,      11,     1,                      0)              \
    X(LCB_RETRY_REASON_SOCKET_CLOSED_WHILE_IN_FLIGHT,        12,     0,                      0)              \
    X(LCB_RETRY_REASON_CIRCUIT_BREAKER_OPEN,                 13,     1,                      0)              \
    X(LCB_RETRY_REASON_QUERY_PREPARED_STATEMENT_FAILURE,     14,     1,                      0)              \
    X(LCB_RETRY_REASON_ANALYTICS_TEMPORARY_FAILURE,          15,     1,                      0)              \
    X(LCB_RETRY_REASON_SEARCH_TOO_MANY_REQUESTS,             16,     1,                      0)              \
    X(LCB_RETRY_REASON_QUERY_ERROR_RETRYABLE,                17,     1,                      0)
/* clang-format on */

typedef enum {
#define X(n, c, nir, ar) n = c,
    LCB_XRETRY_REASON(X)
#undef X
} lcb_RETRY_REASON;

typedef struct lcb_RETRY_REQUEST_ lcb_RETRY_REQUEST;

LIBCOUCHBASE_API int lcb_retry_reason_allows_non_idempotent_retry(lcb_RETRY_REASON code);
LIBCOUCHBASE_API int lcb_retry_reason_is_always_retry(lcb_RETRY_REASON code);

LIBCOUCHBASE_API int lcb_retry_request_is_idempotent(lcb_RETRY_REQUEST *req);
LIBCOUCHBASE_API int lcb_retry_request_retry_attempts(lcb_RETRY_REQUEST *req);
LIBCOUCHBASE_API void *lcb_retry_request_operation_cookie(lcb_RETRY_REQUEST *req);

typedef struct {
    uint32_t should_retry;
    uint32_t retry_after_ms;
} lcb_RETRY_ACTION;

typedef lcb_RETRY_ACTION (*lcb_RETRY_STRATEGY)(lcb_RETRY_REQUEST *req, lcb_RETRY_REASON reason);

/**
 * Set the global retry strategy.  A strategy is a function pointer (see typedef above) which
 * takes a lcb_RETRY_REQUEST and an lcb_RETRY_REASON, and returns a lcb_RETRY_ACTION.  There are
 * a number of lcb_retry_reason_*** and lcb_retry_request_*** functions one can use to formulate
 * a stragegy.  The simplest possible strategy:
 * @code{.c}
 * lcb_RETRY_ACTION lcb_retry_strategy_fail_fast(lcb_RETRY_REQUEST *req, lcb_RETRY_REASON reason) {
 *    lcb_RETRY_ACTION res{0, 0};
 *    return res;
 * }
 * @endcode
 * This sets should_retry to false for all requests.  Below, we use the functions mentioned above to
 * formulate a more nuanced strategy:
 * @code{.c}
 * lcb_RETRY_ACTION lcb_retry_strategy_best_effort(lcb_RETRY_REQUEST *req, lcb_RETRY_REASON reason) {
 *     lcb_RETRY_ACTION res{0, 0};
 *     if (lcb_retry_request_is_idempotent(req) || lcb_retry_reason_allows_non_idempotent_retry(reason)) {
 *          res.should_retry = 1;
 *          res.retry_after_ms = 0;
 *     }
 *     return res;
 * }
 * @endcode
 *
 * These 2 strategies are pre-defined for you to use, or you can formulate your own.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_retry_strategy(lcb_INSTANCE *instance, lcb_RETRY_STRATEGY strategy);

#ifdef __cplusplus
}
#endif
/**@}*/
#endif
