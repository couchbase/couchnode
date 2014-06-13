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

typedef void (*lcb_timer_callback)(lcb_timer_t timer, lcb_t instance, const void *cookie);
LIBCOUCHBASE_API
lcb_timer_t lcb_timer_create(lcb_t instance, const void *command_cookie, lcb_uint32_t usec, int periodic, lcb_timer_callback callback, lcb_error_t *error);
LIBCOUCHBASE_API
lcb_error_t lcb_timer_destroy(lcb_t instance, lcb_timer_t timer);

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
    "Legacy memcached functionality not supported. For config cache, use LCB_CNTL_CONFIGCACHE");

typedef enum {
    LCB_ASYNCHRONOUS = 0x00,
    LCB_SYNCHRONOUS = 0xff
} lcb_syncmode_t;
LCB_DEPR_API2(void lcb_behavior_set_syncmode(lcb_t, lcb_syncmode_t),
    "Syncmode will be removed in future versions. Use lcb_wait() instead");
LCB_DEPR_API2(lcb_syncmode_t lcb_behavior_get_syncmode(lcb_t),
    "Syncmode will be removed in future versions. Use lcb_wait() instead");

/** WTF constants for sanity check */
#define LCB_C_ST_ID 0
#define LCB_C_ST_V 2
#define LCB_C_I_O_ST_ID 1
#define LCB_C_I_O_ST_V 1
#define LCB_G_C_ST_ID 2
#define LCB_G_C_ST_V 0
#define LCB_G_R_C_ST_ID 3
#define LCB_G_R_C_ST_V 1
#define LCB_U_C_ST_ID 4
#define LCB_U_C_ST_V 0
#define LCB_T_C_ST_ID 5
#define LCB_T_C_ST_V 0
#define LCB_S_C_ST_ID 6
#define LCB_S_C_ST_V 0
#define LCB_A_C_ST_ID 7
#define LCB_A_C_ST_V 0
#define LCB_O_C_ST_ID 8
#define LCB_O_C_ST_V 1
#define LCB_R_C_ST_ID 9
#define LCB_R_C_ST_V 0
#define LCB_H_C_ST_ID 10
#define LCB_H_C_ST_V 1
#define LCB_S_S_C_ST_ID 11
#define LCB_S_S_C_ST_V 0
#define LCB_S_V_C_ST_ID 12
#define LCB_S_V_C_ST_V 0
#define LCB_V_C_ST_ID 13
#define LCB_V_C_ST_V 0
#define LCB_F_C_ST_ID 14
#define LCB_F_C_ST_V 0
#define LCB_G_R_ST_ID 15
#define LCB_G_R_ST_V 0
#define LCB_S_R_ST_ID 16
#define LCB_S_R_ST_V 0
#define LCB_R_R_ST_ID 17
#define LCB_R_R_ST_V 0
#define LCB_T_R_ST_ID 18
#define LCB_T_R_ST_V 0
#define LCB_U_R_ST_ID 19
#define LCB_U_R_ST_V 0
#define LCB_A_R_ST_ID 20
#define LCB_A_R_ST_V 0
#define LCB_O_R_ST_ID 21
#define LCB_O_R_ST_V 0
#define LCB_H_R_ST_ID 22
#define LCB_H_R_ST_V 0
#define LCB_S_S_R_ST_ID 23
#define LCB_S_S_R_ST_V 0
#define LCB_S_V_R_ST_ID 24
#define LCB_S_V_R_ST_V 0
#define LCB_V_R_ST_ID 25
#define LCB_V_R_ST_V 0
#define LCB_F_R_ST_ID 26
#define LCB_F_R_ST_V 0
#define LCB_ST_M 26

#define lcb_verify_compiler_setup() \
    ( \
      lcb_verify_struct_size(LCB_C_ST_ID, \
                             LCB_C_ST_V, \
                             sizeof(struct lcb_create_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_C_I_O_ST_ID, \
                             LCB_C_I_O_ST_V, \
                             sizeof(struct lcb_create_io_ops_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_G_C_ST_ID, \
                             LCB_G_C_ST_V, \
                             sizeof(struct lcb_get_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_G_R_C_ST_ID, \
                             LCB_G_R_C_ST_V, \
                             sizeof(struct lcb_get_replica_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_U_C_ST_ID, \
                             LCB_U_C_ST_V, \
                             sizeof(struct lcb_unlock_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_T_C_ST_ID, \
                             LCB_T_C_ST_V, \
                             sizeof(lcb_touch_cmd_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_S_C_ST_ID, \
                             LCB_S_C_ST_V, \
                             sizeof(struct lcb_store_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_A_C_ST_ID, \
                             LCB_A_C_ST_V, \
                             sizeof(struct lcb_arithmetic_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_O_C_ST_ID, \
                             LCB_O_C_ST_V, \
                             sizeof(struct lcb_observe_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_R_C_ST_ID, \
                             LCB_R_C_ST_V, \
                             sizeof(struct lcb_remove_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_H_C_ST_ID, \
                             LCB_H_C_ST_V, \
                             sizeof(struct lcb_http_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_S_S_C_ST_ID, \
                             LCB_S_S_C_ST_V, \
                             sizeof(struct lcb_server_stats_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_S_V_C_ST_ID, \
                             LCB_S_V_C_ST_V, \
                             sizeof(struct lcb_server_version_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_V_C_ST_ID, \
                             LCB_V_C_ST_V, \
                             sizeof(struct lcb_verbosity_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_F_C_ST_ID, \
                             LCB_F_C_ST_V, \
                             sizeof(struct lcb_flush_cmd_st)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_G_R_ST_ID, \
                             LCB_G_R_ST_V, \
                             sizeof(lcb_get_resp_t)) == LCB_SUCCESS &&\
      lcb_verify_struct_size(LCB_S_R_ST_ID, \
                             LCB_S_R_ST_V, \
                             sizeof(lcb_store_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_R_R_ST_ID, \
                             LCB_R_R_ST_V, \
                             sizeof(lcb_remove_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_T_R_ST_ID, \
                             LCB_T_R_ST_V, \
                             sizeof(lcb_touch_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_U_R_ST_ID, \
                             LCB_U_R_ST_V, \
                             sizeof(lcb_unlock_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_A_R_ST_ID, \
                             LCB_A_R_ST_V, \
                             sizeof(lcb_arithmetic_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_O_R_ST_ID, \
                             LCB_O_R_ST_V, \
                             sizeof(lcb_observe_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_H_R_ST_ID, \
                             LCB_H_R_ST_V, \
                             sizeof(lcb_http_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_S_S_R_ST_ID, \
                             LCB_S_S_R_ST_V, \
                             sizeof(lcb_server_stat_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_S_V_R_ST_ID, \
                             LCB_S_V_R_ST_V, \
                             sizeof(lcb_server_version_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_V_R_ST_ID, \
                             LCB_V_R_ST_V, \
                             sizeof(lcb_verbosity_resp_t)) == LCB_SUCCESS && \
      lcb_verify_struct_size(LCB_F_R_ST_ID, \
                             LCB_F_R_ST_V, \
                             sizeof(lcb_flush_resp_t)) == LCB_SUCCESS \
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

#ifdef __cplusplus
}
#endif
#endif
