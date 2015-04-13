/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2013 Couchbase, Inc.
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
#ifndef LIBCOUCHBASE_INTERNAL_H
#define LIBCOUCHBASE_INTERNAL_H 1

/* System/Standard includes */
#include "config.h"
#include <errno.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <ctype.h>

/* Global Project Dependencies/Includes */
#include <memcached/protocol_binary.h>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/vbucket.h>
#include <libcouchbase/api3.h>
#include <libcouchbase/pktfwd.h>

/* Internal dependencies */
#include <lcbio/lcbio.h>
#include <strcodecs/strcodecs.h>
#include "mcserver/mcserver.h"
#include "mc/mcreq.h"
#include "settings.h"

/* lcb_t-specific includes */
#include "retryq.h"
#include "aspend.h"
#include "bootstrap.h"

#ifdef __cplusplus
extern "C" {
#endif

struct lcb_histogram_st;
struct lcb_string_st;

struct lcb_callback_st {
    lcb_RESPCALLBACK v3callbacks[LCB_CALLBACK__MAX];
    lcb_get_callback get;
    lcb_store_callback store;
    lcb_arithmetic_callback arithmetic;
    lcb_observe_callback observe;
    lcb_remove_callback remove;
    lcb_stat_callback stat;
    lcb_version_callback version;
    lcb_touch_callback touch;
    lcb_flush_callback flush;
    lcb_error_callback error;
    lcb_http_complete_callback http_complete;
    lcb_http_data_callback http_data;
    lcb_unlock_callback unlock;
    lcb_configuration_callback configuration;
    lcb_verbosity_callback verbosity;
    lcb_durability_callback durability;
    lcb_errmap_callback errmap;
    lcb_bootstrap_callback bootstrap;
    lcb_pktfwd_callback pktfwd;
    lcb_pktflushed_callback pktflushed;
};

struct lcb_confmon_st;
struct hostlist_st;
struct lcb_BOOTSTRAP;
struct lcb_GUESSVB_st;

struct lcb_st {
    mc_CMDQUEUE cmdq; /**< Base command queue object */
    const void *cookie; /**< User defined pointer */
    struct lcb_confmon_st *confmon; /**< Cluster config manager */
    struct hostlist_st *mc_nodes; /**< List of current memcached endpoints */
    struct hostlist_st *ht_nodes; /**< List of current management endpoints */
    struct clconfig_info_st *cur_configinfo; /**< Pointer to current config */
    struct lcb_BOOTSTRAP *bootstrap; /**< Bootstrapping state */
    struct lcb_callback_st callbacks; /**< Callback table */
    struct lcb_histogram_st *histogram; /**< Histogram object (for timing) */
    lcb_ASPEND pendops; /**< Pending asynchronous requests */
    int wait; /**< Are we in lcb_wait() ?*/
    lcbio_MGR *memd_sockpool; /**< Connection pool for memcached connections */
    lcbio_MGR *http_sockpool; /**< Connection pool for capi connections */
    lcb_error_t last_error; /**< Seldom used. Mainly for bootstrap */
    lcb_settings *settings; /**< User settings */
    lcbio_pTABLE iotable; /**< IO Routine table */
    lcb_RETRYQ *retryq; /**< Retry queue for failed operations */
    struct lcb_string_st *scratch; /**< Generic buffer space */
    struct lcb_GUESSVB_st *vbguess; /**< Heuristic masters for vbuckets */
    lcb_SYNCTOKEN *dcpinfo; /**< Mapping of known vbucket to {uuid,seqno} info */
    lcbio_pTIMER dtor_timer; /**< Asynchronous destruction timer */
    int type; /**< Type of connection */

    #ifdef __cplusplus
    lcb_settings* getSettings() { return settings; }
    lcbio_pTABLE getIOT() { return iotable; }
    #endif
};

#define LCBT_VBCONFIG(instance) (instance)->cmdq.config
#define LCBT_NSERVERS(instance) (instance)->cmdq.npipelines
#define LCBT_NREPLICAS(instance) LCBVB_NREPLICAS(LCBT_VBCONFIG(instance))
#define LCBT_GET_SERVER(instance, ix) (mc_SERVER *)(instance)->cmdq.pipelines[ix]
#define LCBT_SETTING(instance, name) (instance)->settings->name

void lcb_initialize_packet_handlers(lcb_t instance);
void lcb_record_metrics(lcb_t instance, hrtime_t delta,lcb_uint8_t opcode);

LCB_INTERNAL_API
void lcb_maybe_breakout(lcb_t instance);

struct clconfig_info_st;
void lcb_update_vbconfig(lcb_t instance, struct clconfig_info_st *config);
/**
 * Hashtable wrappers
 */
genhash_t *lcb_hashtable_nc_new(lcb_size_t est);
genhash_t *lcb_hashtable_szt_new(lcb_size_t est);

struct lcb_DURSET_st;
void lcbdur_destroy(struct lcb_DURSET_st *dset);
void lcbdur_maybe_schedfail(struct lcb_DURSET_st *dset);

lcb_error_t lcb_iops_cntl_handler(int mode, lcb_t instance, int cmd, void *arg);

/**
 * These two routines define portable ways to get environment variables
 * on various platforms.
 *
 * They are mainly useful for Windows compatibility.
 */
LCB_INTERNAL_API
int lcb_getenv_nonempty(const char *key, char *buf, lcb_size_t len);
LCB_INTERNAL_API
int lcb_getenv_boolean(const char *key);
LCB_INTERNAL_API
int lcb_getenv_nonempty_multi(char *buf, lcb_size_t nbuf, ...);
int lcb_getenv_boolean_multi(const char *key, ...);
LCB_INTERNAL_API
const char *lcb_get_tmpdir(void);

/**
 * Initialize the socket subsystem. For windows, this initializes Winsock.
 * On Unix, this does nothing
 */
LCB_INTERNAL_API
lcb_error_t lcb_initialize_socket_subsystem(void);

lcb_error_t lcb_init_providers2(lcb_t obj,
                               const struct lcb_create_st2 *e_options);
lcb_error_t lcb_reinit3(lcb_t obj, const char *connstr);


LCB_INTERNAL_API
mc_SERVER *
lcb_find_server_by_host(lcb_t instance, const lcb_host_t *host);


LCB_INTERNAL_API
mc_SERVER *
lcb_find_server_by_index(lcb_t instance, int ix);

LCB_INTERNAL_API
lcb_error_t
lcb_getconfig(lcb_t instance, const void *cookie, mc_SERVER *server);

int
lcb_should_retry(lcb_settings *settings, mc_PACKET *pkt, lcb_error_t err);

lcb_error_t
lcb__synchandler_return(lcb_t instance);

lcb_RESPCALLBACK
lcb_find_callback(lcb_t instance, lcb_CALLBACKTYPE cbtype);

/* These two functions exist to allow the tests to keep the loop alive while
 * scheduling other operations asynchronously */

LCB_INTERNAL_API void lcb_loop_ref(lcb_t instance);
LCB_INTERNAL_API void lcb_loop_unref(lcb_t instance);

/* To suppress compiler warnings */
LCB_INTERNAL_API void lcb__timer_destroy_nowarn(lcb_t instance, lcb_timer_t timer);

#define SYNCMODE_INTERCEPT(o) \
    if (LCBT_SETTING(o, syncmode) == LCB_ASYNCHRONOUS) { \
        return LCB_SUCCESS; \
    } else { \
        return lcb__synchandler_return(o); \
    }

void lcb_vbguess_newconfig(lcb_t instance, lcbvb_CONFIG *cfg, struct lcb_GUESSVB_st *guesses);
int lcb_vbguess_remap(lcb_t instance, int vbid, int bad);
#define lcb_vbguess_destroy(p) free(p)

#ifdef __cplusplus
}
#endif

#endif
