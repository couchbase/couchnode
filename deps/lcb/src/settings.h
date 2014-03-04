#ifndef LCB_SETTINGS_H
#define LCB_SETTINGS_H

/**
 * Handy macros for converting between different time resolutions
 */

/** Convert seconds to millis */
#define LCB_S2MS(s) ((lcb_uint32_t)s) / 1000

/** Convert seconds to microseconds */
#define LCB_S2US(s) ((lcb_uint32_t)s) / 1000000

/** Convert seconds to nanoseconds */
#define LCB_S2NS(s) ((hrtime_t)s) / 1000000000

/** Convert nanoseconds to microseconds */
#define LCB_NS2US(s) (s) / 1000

#define LCB_MS2US(s) (s) * 1000

/** Convert microseconds to nanoseconds */
#define LCB_US2NS(s) ((hrtime_t)s) * 1000


#define LCB_DEFAULT_TIMEOUT LCB_MS2US(2500)

/** 5 seconds for total bootstrap */
#define LCB_DEFAULT_CONFIGURATION_TIMEOUT LCB_MS2US(5000)

/** 2 seconds per node */
#define LCB_DEFAULT_NODECONFIG_TIMEOUT LCB_MS2US(2000)

#define LCB_DEFAULT_VIEW_TIMEOUT LCB_MS2US(75000)
#define LCB_DEFAULT_RBUFSIZE 32768
#define LCB_DEFAULT_WBUFSIZE 32768
#define LCB_DEFAULT_DURABILITY_TIMEOUT LCB_MS2US(5000)
#define LCB_DEFAULT_DURABILITY_INTERVAL LCB_MS2US(100)
#define LCB_DEFAULT_HTTP_TIMEOUT LCB_MS2US(75000)
#define LCB_DEFAULT_CONFIG_MAXIMUM_REDIRECTS 3
#define LCB_DEFAULT_CONFIG_ERRORS_THRESHOLD 100

/* 10 seconds */
#define LCB_DEFAULT_CONFIG_ERRORS_DELAY LCB_MS2US(10000)

/* 1 second */
#define LCB_DEFAULT_CLCONFIG_GRACE_CYCLE LCB_MS2US(1000)

/* 100 ms */
#define LCB_DEFAULT_CLCONFIG_GRACE_NEXT LCB_MS2US(100)

/* Infinite (i.e. compat mode) */
#define LCB_DEFAULT_BC_HTTP_DISCONNTMO -1


#include "config.h"
#include <libcouchbase/couchbase.h>

struct lcb_io_opt_st;
struct lcb_logprocs_st;
/**
 * Stateless setting structure.
 * Specifically this contains the 'environment' of the instance for things
 * which are intended to be passed around to other objects.
 */
typedef struct lcb_settings_st {
    struct lcb_io_opt_st *io;
    unsigned int iid;
    lcb_uint32_t views_timeout;
    lcb_uint32_t http_timeout;
    lcb_uint32_t durability_timeout;
    lcb_uint32_t durability_interval;
    lcb_uint32_t operation_timeout;
    lcb_uint32_t config_timeout;
    lcb_uint32_t config_node_timeout;
    lcb_size_t rbufsize;
    lcb_size_t wbufsize;
    lcb_size_t weird_things_threshold;
    lcb_uint32_t weird_things_delay;
    lcb_type_t conntype;

    /** Grace period to wait between querying providers */
    lcb_uint32_t grace_next_provider;

    /** Grace period to wait between retrying from the beginning */
    lcb_uint32_t grace_next_cycle;

    /**
     * For bc_http, the amount of type to keep the stream open, for future
     * updates.
     */
    lcb_uint32_t bc_http_stream_time;

    /** maximum redirect hops. -1 means infinite redirects */
    int max_redir;

    /** If we should randomize bootstrap nodes or not */
    int randomize_bootstrap_nodes;

    /* if non-zero, skip nodes in list that seems like not
     * configured or doesn't have the bucket needed */
    int bummer;

    /** Don't guess next vbucket server. Mainly for testing */
    int vb_noguess;

    /** Is IPv6 enabled */
    lcb_ipv6_t ipv6;

    char *username;
    char *password;
    char *bucket;
    char *sasl_mech_force;
    struct lcb_logprocs_st *logger;
} lcb_settings;

#endif
