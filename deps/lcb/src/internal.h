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
#include <ep-engine/command_ids.h>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/vbucket.h>
#include <libcouchbase/pktfwd.h>

/* Internal dependencies */
#include <lcbio/lcbio.h>
#include <strcodecs/strcodecs.h>
#include "mcserver/mcserver.h"
#include "mc/mcreq.h"
#include "settings.h"
#include "genhash.h"

/* lcb_t-specific includes */
#include "retryq.h"
#include "aspend.h"

#ifdef __cplusplus
extern "C" {
#endif
    struct lcb_histogram_st;

    typedef void (*vbucket_state_listener_t)(lcb_server_t *server);

    struct lcb_callback_st {
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
    struct lcb_bootstrap_st;

    struct lcb_st {
        /**
         * the type of the connection:
         * * LCB_TYPE_BUCKET
         *      NULL for bucket means "default" bucket
         * * LCB_TYPE_CLUSTER
         *      the bucket argument ignored and all data commands will
         *      return LCB_EBADHANDLE
         */
        lcb_type_t type;
        VBUCKET_DISTRIBUTION_TYPE dist_type;
        mc_CMDQUEUE cmdq;

        /** The number of replicas */
        lcb_uint16_t nreplicas;

        struct lcb_confmon_st *confmon;
        struct hostlist_st *mc_nodes;
        struct hostlist_st *ht_nodes;
        struct clconfig_info_st *cur_configinfo;
        struct lcb_bootstrap_st *bootstrap;

        unsigned int weird_things;

        vbucket_state_listener_t vbucket_state_listener;
        struct lcb_callback_st callbacks;
        struct lcb_histogram_st *histogram;
        lcb_ASPEND pendops;
        int wait;
        const void *cookie;

        /** Socket pool for memcached connections */
        lcbio_MGR *memd_sockpool;

        lcb_error_t last_error;

        lcb_settings *settings;
        lcbio_pTABLE iotable;
        lcb_RETRYQ *retryq;
        char *scratch; /* storage for random strings, lcb_get_host, etc */
        lcbio_pTIMER dtor_timer;

#ifdef __cplusplus
        lcb_settings* getSettings() { return settings; }
        lcbio_pTABLE getIOT() { return iotable; }
#endif
    };

    #define LCBT_VBCONFIG(instance) (instance)->cmdq.config
    #define LCBT_NSERVERS(instance) (instance)->cmdq.npipelines
    #define LCBT_NREPLICAS(instance) (instance)->nreplicas
    #define LCBT_GET_SERVER(instance, ix) (lcb_server_t *)(instance)->cmdq.pipelines[ix]
    #define LCBT_SETTING(instance, name) (instance)->settings->name


    lcb_error_t lcb_error_handler(lcb_t instance,
                                  lcb_error_t error,
                                  const char *errinfo);
    /**
     * Returns true if this server has pending I/O on it
     */
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

    struct lcb_durability_set_st;
    void lcb_durability_dset_destroy(struct lcb_durability_set_st *dset);

    lcb_error_t lcb_iops_cntl_handler(int mode,
                                      lcb_t instance, int cmd, void *arg);

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

    /**
     * Initialize the socket subsystem. For windows, this initializes Winsock.
     * On Unix, this does nothing
     */
    LCB_INTERNAL_API
    lcb_error_t lcb_initialize_socket_subsystem(void);

    /**
     * These three functions are all reentrant safe. They control asynchronous
     * scheduling of cluster configuration retrievals.
     */

    /** Call this for initial bootstrap */
    lcb_error_t lcb_bootstrap_initial(lcb_t instance);

    /** Call this on not-my-vbucket, or when a toplogy change is evident */
    lcb_error_t lcb_bootstrap_refresh(lcb_t instance);

    /** Call this when a non-specicic error has taken place, such as a timeout */
    void lcb_bootstrap_errcount_incr(lcb_t instance);

    void lcb_bootstrap_destroy(lcb_t instance);

    lcb_error_t lcb_init_providers2(lcb_t obj,
                                   const struct lcb_create_st2 *e_options);
    lcb_error_t lcb_reinit3(lcb_t obj, const char *dsn);


    LCB_INTERNAL_API
    lcb_server_t *
    lcb_find_server_by_host(lcb_t instance, const lcb_host_t *host);


    LCB_INTERNAL_API
    lcb_server_t *
    lcb_find_server_by_index(lcb_t instance, int ix);

    LCB_INTERNAL_API
    lcb_error_t
    lcb_getconfig(lcb_t instance, const void *cookie, lcb_server_t *server);

    int
    lcb_should_retry(lcb_settings *settings, mc_PACKET *pkt, lcb_error_t err);

    lcb_error_t
    lcb__synchandler_return(lcb_t instance);

#define SYNCMODE_INTERCEPT(o) \
    if (LCBT_SETTING(o, syncmode) == LCB_ASYNCHRONOUS) { \
        return LCB_SUCCESS; \
    } else { \
        return lcb__synchandler_return(o); \
    }

#ifdef __cplusplus
}
#endif

#endif
