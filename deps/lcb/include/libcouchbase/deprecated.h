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

#ifndef LCB_DEPRECATED_H
#define LCB_DEPRECATED_H
#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "include <libcouchbase/couchbase.h> first"
#endif

#ifdef __cplusplus
extern "C" {
#endif

/**@file
 * Deprecated APIs
 */

#define LCB_DEPR_API(X) LIBCOUCHBASE_API LCB_DEPRECATED(X)
#define LCB_DEPR_API2(X, reason) LIBCOUCHBASE_API LCB_DEPRECATED2(X, reason)

/** @deprecated Use @ref LCB_CNTL_IP6POLICY via lcb_cntl() */
LCB_DEPR_API2(void lcb_behavior_set_ipv6(lcb_t instance, lcb_ipv6_t mode), "Use LCB_CNTL_IP6POLICY");
/** @deprecated Use @ref LCB_CNTL_IP6POLICY via lcb_cntl() */
LCB_DEPR_API2(lcb_ipv6_t lcb_behavior_get_ipv6(lcb_t instance), "Use LCB_CNTL_IP6POLICY");
/** @deprecated Use @ref LCB_CNTL_CONFERRTHRESH via lcb_cntl() */
LCB_DEPR_API2(void lcb_behavior_set_config_errors_threshold(lcb_t instance, lcb_size_t num_events),
    "Use LCB_CNTL_CONFERRTHRESH");
/** @deprecated Use @ref LCB_CNTL_CONFERRTHRESH via lcb_cntl() */
LCB_DEPR_API2(lcb_size_t lcb_behavior_get_config_errors_threshold(lcb_t instance),
    "Use LCB_CNTL_CONFERRTHRESH");
/** @deprecated Use @ref LCB_CNTL_OP_TIMEOUT via lcb_cntl() */
LCB_DEPR_API2(void lcb_set_timeout(lcb_t instance, lcb_uint32_t usec),
    "Use LCB_CNTL_OP_TIMEOUT");
/** @deprecated Use @ref LCB_CNTL_OP_TIMEOUT via lcb_cntl() */
LCB_DEPR_API2(lcb_uint32_t lcb_get_timeout(lcb_t instance),
    "Use LCB_CNTL_OP_TIMEOUT");
/** @deprecated Use @ref LCB_CNTL_VIEW_TIMEOUT via lcb_cntl() */
LCB_DEPR_API2(void lcb_set_view_timeout(lcb_t instance, lcb_uint32_t usec),
    "Use LCB_CNTL_VIEW_TIMEOUT");
/** @deprecated Use @ref LCB_CNTL_VIEW_TIMEOUT via lcb_cntl() */
LCB_DEPR_API2(lcb_uint32_t lcb_get_view_timeout(lcb_t instance),
    "Use LCB_CNTL_VIEW_TIMEOUT");

/**
 * @deprecated Do not use this function. Check the error code of the specific operation
 * to determine if something succeeded or not. Because the library has many
 * asynchronous "flows" of control, determining the "last error" is not very
 * fruitful. Since most API calls are themselves only schedule-related, they cannot
 * possibly derive a "Real" error either
 */
LCB_DEPR_API2(lcb_error_t lcb_get_last_error(lcb_t instance),
    "This function does not returning meaningful information. Use the operation callbacks "
    "and/or bootstrap callbacks");

/** @deprecated This function does nothing */
LCB_DEPR_API2(void lcb_flush_buffers(lcb_t instance, const void *cookie),
    "This function does nothing");

/** I'm not sure what uses this anymore */
typedef enum {
    LCB_VBUCKET_STATE_ACTIVE = 1,   /* Actively servicing a vbucket. */
    LCB_VBUCKET_STATE_REPLICA = 2,  /* Servicing a vbucket as a replica only. */
    LCB_VBUCKET_STATE_PENDING = 3,  /* Pending active. */
    LCB_VBUCKET_STATE_DEAD = 4      /* Not in use, pending deletion. */
} lcb_vbucket_state_t;

typedef void (*lcb_error_callback)(lcb_t instance, lcb_error_t error, const char *errinfo);

/**
 * @deprecated Use the logging API (@ref LCB_CNTL_LOGGER) instead to receive error
 * information. For programmatic errors, use the operations interface. For bootstrap
 * status, use lcb_get_bootstrap_status() and lcb_set_bootstrap_callback()
 */
LCB_DEPR_API2(lcb_error_callback lcb_set_error_callback(lcb_t, lcb_error_callback),
    "This function only reports bootstrap errors. Use lcb_set_bootstrap_callback instead");



/**
 * Timer stuff is deprecated. It should not be used externally, and internal
 * code should use the new lcbio_timer_ functions
 */
struct lcb_timer_st;
typedef struct lcb_timer_st *lcb_timer_t;
typedef void (*lcb_timer_callback)(lcb_timer_t timer, lcb_t instance, const void *cookie);
LCB_DEPR_API(lcb_timer_t lcb_timer_create(lcb_t instance, const void *command_cookie, lcb_uint32_t usec, int periodic, lcb_timer_callback callback, lcb_error_t *error));
LCB_DEPR_API(lcb_error_t lcb_timer_destroy(lcb_t instance, lcb_timer_t timer));

typedef enum lcb_compat_t { LCB_MEMCACHED_CLUSTER = 0x00, LCB_CACHED_CONFIG = 0x01 } lcb_compat_t;
typedef lcb_compat_t lcb_cluster_t;
struct lcb_memcached_st { const char *serverlist; const char *username; const char *password; };
struct lcb_cached_config_st {
    const char *cachefile;
    struct lcb_create_st createopt;
};

/**
 * @deprecated
 * Use @ref LCB_CNTL_CONFIGCACHE for configuration cache options
 */
#define lcb_create_compat lcb__create_compat_230
LCB_DEPR_API2(lcb_error_t lcb_create_compat(lcb_compat_t type, const void *specific, lcb_t *instance, struct lcb_io_opt_st *io),
    "Use memcached:// for legacy memcached. For config cache, use LCB_CNTL_CONFIGCACHE");

typedef enum {
    LCB_ASYNCHRONOUS = 0x00,
    LCB_SYNCHRONOUS = 0xff
} lcb_syncmode_t;
LCB_DEPR_API2(void lcb_behavior_set_syncmode(lcb_t, lcb_syncmode_t),
    "Syncmode will be removed in future versions. Use lcb_wait() instead");
LCB_DEPR_API2(lcb_syncmode_t lcb_behavior_get_syncmode(lcb_t),
    "Syncmode will be removed in future versions. Use lcb_wait() instead");

LCB_DEPR_API2(const char *lcb_get_host(lcb_t),
    "Use lcb_get_node(instance, LCB_NODE_HTCONFIG, 0)");
LCB_DEPR_API2(const char *lcb_get_port(lcb_t),
    "Use lcb_get_node(instance, LCB_NODE_HTCONFIG, 0)");

/*  STRUCTURE                           ABBREV      ID MAXVER */
#define LCB_XSSIZES(X) \
    X(struct lcb_create_st,             C_ST,       0, 3) \
    X(struct lcb_create_io_ops_st,      C_I_O_ST,   1, 1) \
    \
    X(struct lcb_get_cmd_st,            G_C_ST,     2, 0) \
    X(struct lcb_get_replica_cmd_st,    G_R_C_ST,   3, 1) \
    X(struct lcb_unlock_cmd_st,         U_C_ST,     4, 0) \
    X(lcb_touch_cmd_t,                  T_C_ST,     5, 0) \
    X(struct lcb_store_cmd_st,          S_C_ST,     6, 0) \
    X(struct lcb_arithmetic_cmd_st,     A_C_ST,     7, 0) \
    X(struct lcb_observe_cmd_st,        O_C_ST,     8, 0) \
    X(struct lcb_remove_cmd_st,         R_C_ST,     9, 0) \
    X(struct lcb_http_cmd_st,           H_C_ST,     10, 1) \
    X(struct lcb_server_stats_cmd_st,   S_S_C_ST,   11, 0) \
    X(struct lcb_server_version_cmd_st, S_V_C_ST,   12, 0) \
    X(struct lcb_verbosity_cmd_st,      V_C_ST,     13, 0) \
    X(struct lcb_flush_cmd_st,          F_C_ST,     14, 0) \
    \
    X(lcb_get_resp_t,                   G_R_ST,     15, 0) \
    X(lcb_store_resp_t,                 S_R_ST,     16, 0) \
    X(lcb_remove_resp_t,                R_R_ST,     17, 0) \
    X(lcb_touch_resp_t,                 T_R_ST,     18, 0) \
    X(lcb_unlock_resp_t,                U_R_ST,     19, 0) \
    X(lcb_arithmetic_resp_t,            A_R_ST,     20, 0) \
    X(lcb_observe_resp_t,               O_R_ST,     21, 0) \
    X(lcb_http_resp_t,                  H_R_ST,     22, 0) \
    X(lcb_server_stat_resp_t,           S_S_R_ST,   23, 0) \
    X(lcb_server_version_resp_t,        S_V_R_ST,   24, 0) \
    X(lcb_verbosity_resp_t,             V_R_ST,     25, 0) \
    X(lcb_flush_resp_t,                 F_R_ST,     26, 0)

typedef enum {
#define X(sname, sabbrev, idval, vernum) \
    LCB_##sabbrev##_ID = idval, LCB_##sabbrev##_V = vernum,
    LCB_XSSIZES(X)
    LCB_ST_M = 26
#undef X
} lcb__STRUCTSIZES;

#define lcb_verify_compiler_setup() ( \
    lcb_verify_struct_size(LCB_C_ST_ID, LCB_C_ST_V, sizeof(struct lcb_create_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_C_I_O_ST_ID, LCB_C_I_O_ST_V, sizeof(struct lcb_create_io_ops_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_G_C_ST_ID, LCB_G_C_ST_V, sizeof(struct lcb_get_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_G_R_C_ST_ID, LCB_G_R_C_ST_V, sizeof(struct lcb_get_replica_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_U_C_ST_ID, LCB_U_C_ST_V, sizeof(struct lcb_unlock_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_T_C_ST_ID, LCB_T_C_ST_V, sizeof(lcb_touch_cmd_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_S_C_ST_ID, LCB_S_C_ST_V, sizeof(struct lcb_store_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_A_C_ST_ID, LCB_A_C_ST_V, sizeof(struct lcb_arithmetic_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_O_C_ST_ID, LCB_O_C_ST_V, sizeof(struct lcb_observe_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_R_C_ST_ID, LCB_R_C_ST_V, sizeof(struct lcb_remove_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_H_C_ST_ID, LCB_H_C_ST_V, sizeof(struct lcb_http_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_S_S_C_ST_ID, LCB_S_S_C_ST_V, sizeof(struct lcb_server_stats_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_S_V_C_ST_ID, LCB_S_V_C_ST_V, sizeof(struct lcb_server_version_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_V_C_ST_ID, LCB_V_C_ST_V, sizeof(struct lcb_verbosity_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_F_C_ST_ID, LCB_F_C_ST_V, sizeof(struct lcb_flush_cmd_st)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_G_R_ST_ID, LCB_G_R_ST_V, sizeof(lcb_get_resp_t)) == LCB_SUCCESS &&\
    lcb_verify_struct_size(LCB_S_R_ST_ID, LCB_S_R_ST_V, sizeof(lcb_store_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_R_R_ST_ID, LCB_R_R_ST_V, sizeof(lcb_remove_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_T_R_ST_ID, LCB_T_R_ST_V, sizeof(lcb_touch_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_U_R_ST_ID, LCB_U_R_ST_V, sizeof(lcb_unlock_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_A_R_ST_ID, LCB_A_R_ST_V, sizeof(lcb_arithmetic_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_O_R_ST_ID, LCB_O_R_ST_V, sizeof(lcb_observe_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_H_R_ST_ID, LCB_H_R_ST_V, sizeof(lcb_http_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_S_S_R_ST_ID, LCB_S_S_R_ST_V, sizeof(lcb_server_stat_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_S_V_R_ST_ID, LCB_S_V_R_ST_V, sizeof(lcb_server_version_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_V_R_ST_ID, LCB_V_R_ST_V, sizeof(lcb_verbosity_resp_t)) == LCB_SUCCESS && \
    lcb_verify_struct_size(LCB_F_R_ST_ID, LCB_F_R_ST_V, sizeof(lcb_flush_resp_t)) == LCB_SUCCESS \
)

/**
 * Verify that libcouchbase and yourself have the same size for a
 * certain version of a struct. Using different alignment / struct
 * packing will give you strange results..
 *
 * @param id the id of the structure to check
 * @param version the version of the structure to check
 * @param size the expected size of the structure
 * @return LCB_SUCCESS on success
 */
LIBCOUCHBASE_API
lcb_error_t lcb_verify_struct_size(lcb_uint32_t id, lcb_uint32_t version,
                                   lcb_size_t size);

/** Deprecated cntls */

/**@deprecated It is currently not possible to adjust buffer sizes */
#define LCB_CNTL_RBUFSIZE               0x02
/**@deprecated It is currently not possible to adjust buffer sizes */
#define LCB_CNTL_WBUFSIZE               0x03
/** @deprecated */
#define LCB_CNTL_SYNCMODE               0x0a
/**@deprecated Initial connections are always attempted */
#define LCB_CNTL_SKIP_CONFIGURATION_ERRORS_ON_CONNECT 0x13

/**@deprecated - Use error classifiers */
#define lcb_is_error_enomem(a) ((a == LCB_CLIENT_ENOMEM) || (a == LCB_ENOMEM))
/**@deprecated - Use error classifiers */
#define lcb_is_error_etmpfail(a) ((a == LCB_CLIENT_ETMPFAIL) || (a == LCB_ETMPFAIL))

typedef enum {
    LCB_CONFIGURATION_NEW = 0x00,
    LCB_CONFIGURATION_CHANGED = 0x01,
    LCB_CONFIGURATION_UNCHANGED = 0x02
} lcb_configuration_t;

typedef void (*lcb_configuration_callback)(lcb_t instance, lcb_configuration_t config);

/**@deprecated - Use lcb_set_bootstrap_callback() */
LCB_DEPR_API2(
    lcb_configuration_callback lcb_set_configuration_callback(lcb_t, lcb_configuration_callback),
    "use lcb_set_bootstrap_callback() to determine when client is ready");

/* Deprecated HTTP "Status Aliases" */
typedef enum {
    LCB_HTTP_STATUS_CONTINUE = 100,
    LCB_HTTP_STATUS_SWITCHING_PROTOCOLS = 101,
    LCB_HTTP_STATUS_PROCESSING = 102,
    LCB_HTTP_STATUS_OK = 200,
    LCB_HTTP_STATUS_CREATED = 201,
    LCB_HTTP_STATUS_ACCEPTED = 202,
    LCB_HTTP_STATUS_NON_AUTHORITATIVE_INFORMATION = 203,
    LCB_HTTP_STATUS_NO_CONTENT = 204,
    LCB_HTTP_STATUS_RESET_CONTENT = 205,
    LCB_HTTP_STATUS_PARTIAL_CONTENT = 206,
    LCB_HTTP_STATUS_MULTI_STATUS = 207,
    LCB_HTTP_STATUS_MULTIPLE_CHOICES = 300,
    LCB_HTTP_STATUS_MOVED_PERMANENTLY = 301,
    LCB_HTTP_STATUS_FOUND = 302,
    LCB_HTTP_STATUS_SEE_OTHER = 303,
    LCB_HTTP_STATUS_NOT_MODIFIED = 304,
    LCB_HTTP_STATUS_USE_PROXY = 305,
    LCB_HTTP_STATUS_UNUSED = 306,
    LCB_HTTP_STATUS_TEMPORARY_REDIRECT = 307,
    LCB_HTTP_STATUS_BAD_REQUEST = 400,
    LCB_HTTP_STATUS_UNAUTHORIZED = 401,
    LCB_HTTP_STATUS_PAYMENT_REQUIRED = 402,
    LCB_HTTP_STATUS_FORBIDDEN = 403,
    LCB_HTTP_STATUS_NOT_FOUND = 404,
    LCB_HTTP_STATUS_METHOD_NOT_ALLOWED = 405,
    LCB_HTTP_STATUS_NOT_ACCEPTABLE = 406,
    LCB_HTTP_STATUS_PROXY_AUTHENTICATION_REQUIRED = 407,
    LCB_HTTP_STATUS_REQUEST_TIMEOUT = 408,
    LCB_HTTP_STATUS_CONFLICT = 409,
    LCB_HTTP_STATUS_GONE = 410,
    LCB_HTTP_STATUS_LENGTH_REQUIRED = 411,
    LCB_HTTP_STATUS_PRECONDITION_FAILED = 412,
    LCB_HTTP_STATUS_REQUEST_ENTITY_TOO_LARGE = 413,
    LCB_HTTP_STATUS_REQUEST_URI_TOO_LONG = 414,
    LCB_HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE = 415,
    LCB_HTTP_STATUS_REQUESTED_RANGE_NOT_SATISFIABLE = 416,
    LCB_HTTP_STATUS_EXPECTATION_FAILED = 417,
    LCB_HTTP_STATUS_UNPROCESSABLE_ENTITY = 422,
    LCB_HTTP_STATUS_LOCKED = 423,
    LCB_HTTP_STATUS_FAILED_DEPENDENCY = 424,
    LCB_HTTP_STATUS_INTERNAL_SERVER_ERROR = 500,
    LCB_HTTP_STATUS_NOT_IMPLEMENTED = 501,
    LCB_HTTP_STATUS_BAD_GATEWAY = 502,
    LCB_HTTP_STATUS_SERVICE_UNAVAILABLE = 503,
    LCB_HTTP_STATUS_GATEWAY_TIMEOUT = 504,
    LCB_HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED = 505,
    LCB_HTTP_STATUS_INSUFFICIENT_STORAGE = 507
} lcb_http_status_t;

#ifdef __cplusplus
}
#endif
#endif
