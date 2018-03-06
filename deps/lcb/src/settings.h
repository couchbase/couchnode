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

#ifndef LCB_SETTINGS_H
#define LCB_SETTINGS_H

/**
 * Handy macros for converting between different time resolutions
 */

/** Convert seconds to millis */
#define LCB_S2MS(s) (((lcb_uint32_t)s) * 1000)

/** Convert seconds to microseconds */
#define LCB_S2US(s) (((lcb_uint32_t)s) * 1000000)

/** Convert seconds to nanoseconds */
#define LCB_S2NS(s) (((hrtime_t)s) * 1000000000)

/** Convert nanoseconds to microseconds */
#define LCB_NS2US(s) ((s) / 1000)

#define LCB_MS2US(s) ((s) * 1000)

/** Convert microseconds to nanoseconds */
#define LCB_US2NS(s) (((hrtime_t)s) * 1000)
/** Convert milliseconds to nanoseconds */
#define LCB_MS2NS(s) (((hrtime_t)s) * 1000000)


#define LCB_DEFAULT_TIMEOUT LCB_MS2US(2500)

/** 5 seconds for total bootstrap */
#define LCB_DEFAULT_CONFIGURATION_TIMEOUT LCB_MS2US(5000)

/** 2 seconds per node */
#define LCB_DEFAULT_NODECONFIG_TIMEOUT LCB_MS2US(2000)

#define LCB_DEFAULT_VIEW_TIMEOUT LCB_MS2US(75000)
#define LCB_DEFAULT_N1QL_TIMEOUT LCB_MS2US(75000)
#define LCB_DEFAULT_DURABILITY_TIMEOUT LCB_MS2US(5000)
#define LCB_DEFAULT_DURABILITY_INTERVAL LCB_MS2US(100)
#define LCB_DEFAULT_HTTP_TIMEOUT LCB_MS2US(75000)
#define LCB_DEFAULT_CONFIG_MAXIMUM_REDIRECTS 3
#define LCB_DEFAULT_CONFIG_ERRORS_THRESHOLD 100

/* 10 milliseconds */
#define LCB_DEFAULT_CONFIG_ERRORS_DELAY LCB_MS2US(10)

/* 1 second */
#define LCB_DEFAULT_CLCONFIG_GRACE_CYCLE LCB_MS2US(1000)

/* 100 ms */
#define LCB_DEFAULT_CLCONFIG_GRACE_NEXT LCB_MS2US(100)

/* Infinite (i.e. compat mode) */
#define LCB_DEFAULT_BC_HTTP_DISCONNTMO -1

/* 10ms */
#define LCB_DEFAULT_RETRY_INTERVAL LCB_MS2US(10)

/* 1.5x */
#define LCB_DEFAULT_RETRY_BACKOFF 1.5

#define LCB_DEFAULT_TOPORETRY LCB_RETRY_CMDS_ALL
#define LCB_DEFAULT_NETRETRY LCB_RETRY_CMDS_ALL
#define LCB_DEFAULT_NMVRETRY LCB_RETRY_CMDS_ALL
#define LCB_DEFAULT_HTCONFIG_URLTYPE LCB_HTCONFIG_URLTYPE_TRYALL
#define LCB_DEFAULT_COMPRESSOPTS LCB_COMPRESS_INOUT

#define LCB_DEFAULT_NVM_RETRY_IMM 1
#define LCB_DEFAULT_RETRY_NMV_INTERVAL LCB_MS2US(100)
#define LCB_DEFAULT_VB_NOGUESS 1
#define LCB_DEFAULT_TCP_NODELAY 1
#define LCB_DEFAULT_SELECT_BUCKET 1
#define LCB_DEFAULT_TCP_KEEPALIVE 1
/* 2.5 s */
#define LCB_DEFAULT_CONFIG_POLL_INTERVAL LCB_MS2US(2500)
/* 50 ms */
#define LCB_CONFIG_POLL_INTERVAL_FLOOR LCB_MS2US(50)

#include "config.h"
#include <libcouchbase/couchbase.h>
#include <libcouchbase/metrics.h>
#include "errmap.h"

#ifdef LCB_TRACING
#include <libcouchbase/tracing.h>
#endif

#ifdef __cplusplus
extern "C" {
#endif

struct lcb_logprocs_st;
struct lcbio_SSLCTX;
struct rdb_ALLOCATOR;
struct lcb_METRICS_st;

/**
 * Stateless setting structure.
 * Specifically this contains the 'environment' of the instance for things
 * which are intended to be passed around to other objects.
 */
typedef struct lcb_settings_st {
    /* TODO: [SDK3] change to uint64_t as per RFC. logging API exposes it as unsigned int currently */
    lcb_U32 iid;
    lcb_U8 compressopts;
    lcb_U8 syncmode;
    lcb_U32 read_chunk_size;
    lcb_U32 operation_timeout;
    lcb_U32 views_timeout;
    lcb_U32 http_timeout;
    lcb_U32 n1ql_timeout;
    lcb_U32 durability_timeout;
    lcb_U32 durability_interval;
    lcb_U32 config_timeout;
    lcb_U32 config_node_timeout;
    lcb_U32 retry_interval;
    lcb_U32 weird_things_threshold;
    lcb_U32 weird_things_delay;

    /** Grace period to wait between querying providers */
    lcb_U32 grace_next_provider;

    /** Grace period to wait between retrying from the beginning */
    lcb_U32 grace_next_cycle;

    /**For bc_http, the amount of type to keep the stream open, for future
     * updates. */
    lcb_U32 bc_http_stream_time;

    /** Time to wait in between background config polls. 0 disables this */
    lcb_U32 config_poll_interval;

    unsigned bc_http_urltype : 4;

    /** Don't guess next vbucket server. Mainly for testing */
    unsigned vb_noguess : 1;
    /** Whether lcb_destroy is synchronous. This mode will run the I/O event
     * loop as much as possible until no outstanding events remain.*/
    unsigned syncdtor : 1;
    unsigned detailed_neterr : 1;
    unsigned randomize_bootstrap_nodes : 1;
    unsigned conntype : 1;
    unsigned refresh_on_hterr : 1;
    unsigned sched_implicit_flush : 1;
    unsigned nmv_retry_imm : 1;
    unsigned keep_guess_vbs : 1;
    unsigned fetch_mutation_tokens : 1;
    unsigned dur_mutation_tokens : 1;
    unsigned sslopts : 3;
    unsigned ipv6 : 2;
    unsigned tcp_nodelay : 1;
    unsigned readj_ts_wait : 1;
    unsigned use_errmap : 1;
    unsigned select_bucket : 1;
    unsigned tcp_keepalive : 1;
    unsigned send_hello : 1;
    unsigned use_collections : 1;
    unsigned log_redaction : 1;
    unsigned use_tracing : 1;

    short max_redir;
    unsigned refcount;

    uint8_t retry[LCB_RETRY_ON_MAX];
    float retry_backoff;

    char *bucket;
    char *sasl_mech_force;
    char *truststorepath;
    char *certpath;
    char *keypath;
    lcb_AUTHENTICATOR *auth;
    struct rdb_ALLOCATOR* (*allocator_factory)(void);
    struct lcbio_SSLCTX *ssl_ctx;
    struct lcb_logprocs_st *logger;
    void (*dtorcb)(const void *);
    void *dtorarg;
    char *client_string;
    lcb_pERRMAP errmap;
    lcb_U32 retry_nmv_interval;
    struct lcb_METRICS_st *metrics;
#ifdef LCB_TRACING
    lcbtrace_TRACER *tracer;
#endif
} lcb_settings;

LCB_INTERNAL_API
void lcb_default_settings(lcb_settings *settings);

LCB_INTERNAL_API
lcb_settings *
lcb_settings_new(void);

LCB_INTERNAL_API
void
lcb_settings_unref(lcb_settings *);

#define lcb_settings_ref(settings) ((void)(settings)->refcount++)
#define lcb_settings_ref2(settings) ((settings)->refcount++, settings)

/**
 * Metric functionality. Defined in metrics.h, but retains a global-like
 * setting similar to lcb_settings
 */
void
lcb_metrics_dumpio(const lcb_IOMETRICS *metrics, FILE *fp);

void
lcb_metrics_dumpserver(const lcb_SERVERMETRICS *metrics, FILE *fp);

lcb_METRICS *
lcb_metrics_new(void);

void
lcb_metrics_destroy(lcb_METRICS *metrics);

lcb_SERVERMETRICS *
lcb_metrics_getserver(lcb_METRICS *metrics,
    const char *host, const char *port, int create);

void
lcb_metrics_reset_pipeline_gauges(lcb_SERVERMETRICS *metrics);

#ifdef __cplusplus
}
#endif
#endif
