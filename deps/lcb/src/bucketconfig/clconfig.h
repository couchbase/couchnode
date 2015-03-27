/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#ifndef LCB_CLCONFIG_H
#define LCB_CLCONFIG_H

#include "hostlist.h"
#include "list.h"
#include "simplestring.h"
#include <lcbio/timer-ng.h>
#ifdef __cplusplus
extern "C" {
#endif

/** @file */

/**
 * @defgroup lcb-confmon Cluster Configuration Management
 *
 * @brief Monitors the retrieval and application of new cluster topology maps
 * (vBucket Configurations)
 *
 * @details
 * This module attempts to implement the 'Configuration Provider' interface
 * described at https://docs.google.com/document/d/1bSMt0Sj1uQtm0OYolQaJDJg4sASfoCEwU6_gjm1he8s/edit
 *
 * The model is fairly complex though significantly more maintainable and
 * testable than the previous model. The basic idea is as follows:
 *
 *
 * <ol>
 *
 * <li>
 * There is a _Configuration Monitor_ object (lcb_confmon) which acts
 * as the configuration supervisor. It is responsible for returning
 * configuration objects to those entities which request it.
 * </li>
 *
 * <li>
 * There are multiple _Configuration Provider_ (clconfig_provider) objects.
 * These providers aggregate configurations from multiple sources and
 * implement a common interface to:
 *
 *  <ol>
 *  <li>Return a _quick_ configuration without fetching from network or disk
 *  (see clconfig_provider::get_cached())</i>

 *  <li>Schedule a refresh to retrieve the latest configuration from the
 *  network (see clconfig_provider::refresh())</li>
 *
 *  <li>Notify the monitor that it has received a new configuration. The
 *  monitor itself will determine whether or not to accept the new
 *  configuration by examining the configuration and determining if it is more
 *  recent than the one currently in used. See lcb_confmon_set_next()</li>
 *  </ol></li>
 *
 * <li>
 * _Configuration Info_ objects. These objects are refcounted wrappers
 * around vbucket configuration handles. They have a refcount and also an
 * integer which can be used to compare with other objects for 'freshness'.
 * See clconfig_info
 * </li>
 *
 * <li>
 * _Configuration Listeners_. These are registered with the global supervisor
 * and are invoked whenever a new valid configuration is detected. This is
 * really only ever used during bootstrap or testing where we are explicitly
 * waiting for a configuration without having any actual commands to schedule.
 * See clconfig_listener
 * </li>
 * </ol>
 */

/**
 *@addtogroup lcb-confmon
 *@{
 */

/**
 * @brief Enumeration of the various config providers available.
 * The type of methods available. These are enumerated in order of preference
 */
typedef enum {
    /** Currently unused. The intent here is to allow a user to provide means
     * by which the application may give a configuration file to the library */
    LCB_CLCONFIG_USER,
    /** File-based "configcache" provider. Implemented in bc_file.c */
    LCB_CLCONFIG_FILE,
    /** New-style config-over-memcached provider. Implemented in bc_cccp.c */
    LCB_CLCONFIG_CCCP,
    /** Old-style streaming HTTP provider. Implemented in bc_http.c */
    LCB_CLCONFIG_HTTP,
    /** Raw memcached provided */
    LCB_CLCONFIG_MCRAW,

    LCB_CLCONFIG_MAX,

    /** Ephemeral source, used for tests */
    LCB_CLCONFIG_PHONY
} clconfig_method_t;


struct clconfig_info_st;
struct clconfig_provider_st;
struct clconfig_listener_st;
struct lcb_confmon_st;

/**
 * This object contains the information needed for libcouchbase to deal with
 * when retrieving new configs.
 */
typedef struct lcb_confmon_st {
    /** Linked list of active/enabled providers */
    lcb_clist_t active_providers;

    /**Current provider. This provider may either fail or succeed.
     * In either case unless the provider can provide us with a specific
     * config which is newer than the one we have, it will roll over to the
     * next provider. */
    struct clconfig_provider_st *cur_provider;

    /** All providers we know about. Currently this means the 'builtin' providers */
    struct clconfig_provider_st * all_providers[LCB_CLCONFIG_MAX];

    /** The current configuration pointer. This contains the most recent accepted
     * configuration */
    struct clconfig_info_st * config;

    /* CONFMON_S_* values. Used internally */
    int state;

    /** Last time the provider was stopped. As a microsecond timestamp */
    lcb_uint32_t last_stop_us;

    /** This is the async handle for a reentrant start */
    lcbio_pTIMER as_start;

    /** Async handle for a reentrant stop */
    lcbio_pTIMER as_stop;

    /**  List of listeners for events */
    lcb_list_t listeners;
    lcb_settings *settings;
    lcb_error_t last_error;
    lcbio_pTABLE iot;
} lcb_confmon;

/**
 * The base structure of a provider. This structure is intended to be
 * 'subclassed' by implementors.
 */
typedef struct clconfig_provider_st {
    lcb_list_t ll; /**< Node in linked list of active providers (if active) */

    /** The type of provider */
    clconfig_method_t type;

    /** Whether this provider has been disabled/enabled explicitly by a user */
    int enabled;

    /** The parent manager object */
    struct lcb_confmon_st *parent;

    /**
     * Get the current map known to this provider. This should not perform
     * any blocking operations. Providers which use a push model may use
     * this method as an asynchronous return value for a previously-received
     * configuration.
     *
     * @param pb
     */
    struct clconfig_info_st* (*get_cached)(struct clconfig_provider_st *pb);


    /**
     * Request a new configuration. This will be called by the manager when
     * the cached configuration (i.e. 'get_cached') is deemed invalid. Thus
     * this function should unconditionally try to schedule getting the
     * newest configuration it can. When the configuration has been received,
     * the provider may call provider_success or provider_failed.
     *
     * @note
     * The PROVIDER is responsible for terminating its own
     * process. In other words there is no safeguard within confmon itself
     * against a provider taking an excessively long time; therefore a provider
     * should implement a timeout mechanism of its choice to promptly deliver
     * a success or failure.
     *
     * @param pb
     */
    lcb_error_t (*refresh)(struct clconfig_provider_st *pb);

    /**
     * Callback invoked to the provider to indicate that it should cease
     * performing any "Active" configuration changes. Note that this is only
     * a hint and a provider may perform its own hooking based on this. In any
     * event receiving this callback is indicating that the provider will not
     * be needed again in quite some time. How long this "time" is can range
     * between 0 seconds and several minutes depending on how a user has
     * configured the client.
     * @param pb
     */
    lcb_error_t (*pause)(struct clconfig_provider_st *pb);

    /**
     * Called when a new configuration has been received.
     *
     * @param provider the provider instance
     * @param config the current configuration.
     * Note that this should only update the server list and do nothing
     * else.
     */
    void (*config_updated)(struct clconfig_provider_st *provider,
            lcbvb_CONFIG* config);

    /**
     * Retrieve the list of nodes from this provider, if applicable
     * @param p the provider
     * @return A list of nodes, or NULL if the provider does not have a list
     */
    hostlist_t (*get_nodes)(const struct clconfig_provider_st *p);

    /**
     * Call to change the configured nodes of this provider.
     * @param p The provider
     * @param l The list of nodes to apply
     */
    void (*configure_nodes)(struct clconfig_provider_st *p, const hostlist_t l);

    /** Destroy the resources created by this provider. */
    void (*shutdown)(struct clconfig_provider_st *);

    /**
     * Dump state information. This callback is optional
     * @param p the provider
     * @param f the file to write to
     */
    void (*dump)(struct clconfig_provider_st *p, FILE *f);
} clconfig_provider;


/** @brief refcounted object encapsulating a vbucket config */
typedef struct clconfig_info_st {
    /** Actual configuration */
    lcbvb_CONFIG* vbc;

    /** Comparative clock with which to compare */
    lcb_uint64_t cmpclock;

    /** Reference counter */
    unsigned int refcount;

    /** Origin provider type which produced this config */
    clconfig_method_t origin;
} clconfig_info;

/** Event types propagated to listeners */
typedef enum {
    /** Called when a new configuration is being set in confmon */
    CLCONFIG_EVENT_GOT_NEW_CONFIG,

    /** Called when _any_ configuration is received via set_enxt */
    CLCONFIG_EVENT_GOT_ANY_CONFIG,

    /** Called when all providers have been tried */
    CLCONFIG_EVENT_PROVIDERS_CYCLED,

    /** The monitor has stopped */
    CLCONFIG_EVENT_MONITOR_STOPPED
} clconfig_event_t;

/**
 * @brief Listener for events
 * One or more listeners may be installed into the confmon which will have
 * a callback invoked on significant vbucket events. See clconfig_event_t
 * for a variety of events the listener can know.
 */
typedef struct clconfig_listener_st {
    /** Linked list node */
    lcb_list_t ll;

    /** Monitor object */
    lcb_confmon *parent;

    /**
     * Callback invoked for significant events
     *
     * @param lsn the listener structure itself
     * @param event the event which took place
     * @param config the configuration associated with the event. Note that
     * `config` may also be NULL
     */
    void (*callback)(struct clconfig_listener_st *lsn, clconfig_event_t event,
            struct clconfig_info_st *config);

} clconfig_listener;

/* Method-specific setup methods.. */

clconfig_provider * lcb_clconfig_create_http(lcb_confmon *mon);
clconfig_provider * lcb_clconfig_create_cccp(lcb_confmon *mon);
clconfig_provider * lcb_clconfig_create_file(lcb_confmon *mon);
clconfig_provider * lcb_clconfig_create_user(lcb_confmon *mon);
clconfig_provider * lcb_clconfig_create_mcraw(lcb_confmon *mon);

/**@brief Get a provider by its type
 * @param mon the monitor
 * @param ix a clconfig_method_t indicating the type of provider to fetch
 * @return a pointer to the provider of the given type
 */
#define lcb_confmon_get_provider(mon, ix) (mon)->all_providers[ix]

/**
 * @brief Macro used to retrieve a setting from a provider
 * @param p the provider pointer
 * @param n the name of the setting field to retrieve as token
 */
#define PROVIDER_SETTING(p, n) ((p)->parent->settings->n)

/**
 * @brief Macro used by a provider to set the failure code in the parent
 * lcb_confmon object
 * @param p the provider pointer
 * @param e the error code
 */
#define PROVIDER_SET_ERROR(p, e) (p)->parent->last_error = e

/**
 * @brief Create a new configuration monitor.
 * This function creates a new `confmon` object which can be used to manage
 * configurations and their providers.
 *
 * @param settings
 * @param iot
 *
 * Once the confmon object has been created you may enable or disable various
 * providers (see lcb_confmon_set_provider_active()). Once no more providers
 * remain to be activated you should call lcb_confmon_prepare() once. Then
 * call the rest of the functions.
 */
LIBCOUCHBASE_API
lcb_confmon *
lcb_confmon_create(lcb_settings *settings, lcbio_pTABLE iot);

/**Destroy the confmon object.
 * @param mon */
LIBCOUCHBASE_API
void
lcb_confmon_destroy(lcb_confmon *mon);

/**
 * Prepares the configuration monitor object for operations. This will insert
 * all the enabled providers into a list. Call this function each time a
 * provider has been enabled.
 * @param mon
 */
LIBCOUCHBASE_API
void
lcb_confmon_prepare(lcb_confmon *mon);

LCB_INTERNAL_API
void
lcb_confmon_set_provider_active(lcb_confmon *mon,
    clconfig_method_t type, int enabled);


/**
 * @brief Request a configuration refresh
 *
 * Start traversing the list of current providers, requesting a new
 * configuration for each. This function will asynchronously loop through all
 * providers until one provides a new configuration.
 *
 * You may call lcb_confmon_stop() to asynchronously break out of the loop.
 * If the confmon is already in a refreshing state
 * (i.e. lcb_confmon_is_refreshing()) returns true then this function does
 * nothing.
 *
 * This function is reentrant safe and may be called at any time.
 *
 * @param mon
 * @see lcb_confmon_add_listener()
 * @see lcb_confmon_stop()
 * @see lcb_confmon_is_refreshing()
 */
LIBCOUCHBASE_API
lcb_error_t lcb_confmon_start(lcb_confmon *mon);

/**
 * @brief Cancel a pending configuration refresh.
 *
 * Stops the monitor. This will call clconfig_provider::pause() for each active
 * provider. Typically called before destruction or when a new configuration
 * has been found.
 *
 * This function is safe to call anywhere. If the monitor is already stopped
 * then this function does nothing.
 *
 * @param mon
 * @see lcb_confmon_start()
 * @see lcb_confmon_is_refreshing()
 */
LIBCOUCHBASE_API
lcb_error_t lcb_confmon_stop(lcb_confmon *mon);

/**
 * @brief Check if the monitor is waiting for a new config from a provider
 * @param mon
 * @return true if refreshing, false if idle
 */
LCB_INTERNAL_API
int lcb_confmon_is_refreshing(lcb_confmon *mon);


/**@brief Get the current configuration object
 * @return The current configuration */
#define lcb_confmon_get_config(mon) (mon)->config

/**@brief Get the last error code set by a provider
 * @return the last error code (if failure) */
#define lcb_confmon_last_error(mon) (mon)->last_error

/**
 * @brief Indicate that a provider has failed and advance the monitor
 *
 * Indicate that the current provider has failed to obtain a new configuration.
 * This is always called by a provider and should be invoked when the provider
 * has encountered an internal error which caused it to be unable to fetch
 * the configuration.
 *
 * Note that this function is safe to call from any provider at any time. If
 * the provider is not the current provider then it is treated as an async
 * push notification failure and ignored. This function is _not_ safe to call
 * from consumers of providers
 *
 * Once this is called, the confmon instance will either roll over to the next
 * provider or enter the inactive state depending on the configuration and
 * whether the current provider is the last provider in the list.
 *
 * @param provider
 * @param err
 */
LIBCOUCHBASE_API
void
lcb_confmon_provider_failed(clconfig_provider *provider, lcb_error_t err);


/**
 * @brief Indicate that a provider has successfuly retrieved a configuration.
 *
 * Indicates that the provider has fetched a new configuration from the network
 * and that confmon should attempt to propagate it. It has similar semantics
 * to lcb_confmon_provider_failed() except that the second argument is a config
 * object rather than an error code. The second argument must not be `NULL`
 *
 * The monitor will compare the new config against the current config.
 * If the new config does not feature any changes from the current config then
 * it is ignored and the confmon instance will proceed to the next provider.
 * This is done through a direct call to provider_failed(provider, LCB_SUCCESS).
 *
 * This function should _not_ be called outside of an asynchronous provider's
 * handler.
 *
 * @param provider the provider which yielded the new configuration
 * @param info the new configuration
 */
LIBCOUCHBASE_API
void
lcb_confmon_provider_success(clconfig_provider *provider, clconfig_info *info);

/**
 * @brief Register a listener to be invoked on state changes and events
 *
 * Adds a 'listener' object to be called at each configuration update. The
 * listener may co-exist with other listeners (though it should never be added
 * twice). When a new configuration is received and accept, the listener's
 * clconfig_listener::callback field will be invoked with it.
 *
 * The callback will continue to be invoked for each new configuration received
 * until remove_listener is called. Note that the listener is not allocated
 * by the confmon and its responsibility is the user's
 *
 * @param mon the monitor
 * @param listener the listener. The listener's contents are not copied into
 * confmon and should thus remain valid until it is removed
 */
LIBCOUCHBASE_API
void lcb_confmon_add_listener(lcb_confmon *mon, clconfig_listener *listener);

/**
 * @brief Unregister (and remove) a listener added via lcb_confmon_add_listener()
 * @param mon the monitor
 * @param listener the listener
 */
LIBCOUCHBASE_API
void lcb_confmon_remove_listener(lcb_confmon *mon, clconfig_listener *listener);

/** @brief Possible confmon states */
typedef enum {
    /** The monitor is idle and not requesting a new configuration */
    CONFMON_S_INACTIVE = 0,

    /** The monitor is actively requesting a configuration */
    CONFMON_S_ACTIVE = 1 << 0,

    /** The monitor is fetching a configuration, but is in a throttle state */
    CONFMON_S_ITERGRACE = 1 << 1
} confmon_state_t;

/**
 * @brief Get the current monitor state
 * @param mon the monitor
 * @return a set of flags consisting of confmon_state_t values.
 */
#define lcb_confmon_get_state(mon) (mon)->state

/**
 * Creates a new configuration wrapper object containing the vbucket config
 * pointed to by 'config'. Its initial refcount will be set to 1.
 *
 * @param config a newly parsed configuration
 * @param origin the type of provider from which the config originated.
 */
clconfig_info *
lcb_clconfig_create(lcbvb_CONFIG* config, clconfig_method_t origin);

/**
 * @brief Compares two info structures and determine which one is newer
 *
 * This function returns an integer less than
 * zero, zero or greater than zero if the first argument is considered older
 * than, equal to, or later than the second argument.
 * @param a
 * @param b
 * @see lcbvb_get_revision
 * @see clconfig_info::cmpclock
 */
LIBCOUCHBASE_API
int lcb_clconfig_compare(const clconfig_info *a, const clconfig_info *b);

/**
 * @brief Decrement the refcount on a config object.
 * Decrement the refcount. If the internal refcount reaches 0 then the internal
 * members (including the vbucket config handle itself) will be freed.
 * @param info the configuration
 */
void lcb_clconfig_decref(clconfig_info *info);

/**
 * @brief Increment the refcount on a config object
 * @param info the config object
 */
#define lcb_clconfig_incref(info) (info)->refcount++

/** Dump information about the monitor
 * @param mon the monitor object
 * @param fp the file to which information should be written
 */
void lcb_confmon_dump(lcb_confmon *mon, FILE *fp);

/**
 * @name File Provider-specific APIs
 * @{
 */

/**
 * Sets the input/output filename for the file provider. This also enables
 * the file provider.
 * @param p the provider
 * @param f the filename (if NULL, a temporary filename will be created)
 * @param ro whether the client will never modify the file
 * @return zero on success, nonzero on failure.
 */
int lcb_clconfig_file_set_filename(clconfig_provider *p, const char *f, int ro);

/**
 * Retrieve the filename for the provider
 * @param p The provider of type LCB_CLCONFIG_FILE
 * @return the current filename being used.
 */
const char * lcb_clconfig_file_get_filename(clconfig_provider *p);

void lcb_clconfig_file_set_readonly(clconfig_provider *p, int val);
/**@}*/

/**
 * @name HTTP Provider-specific APIs
 * @{
 */

/**
 * Get the socket representing the current REST connection to the cluster
 * (if applicable)
 * @param mon
 * @return
 */
lcbio_SOCKET* lcb_confmon_get_rest_connection(lcb_confmon *mon);

/**
 * Get the hostname for the current REST connection to the cluster
 * @param mon
 * @return
 */
lcb_host_t * lcb_confmon_get_rest_host(lcb_confmon *mon);

/**
 * Enables the HTTP provider
 * @param pb a provider of type LCB_CLCONFIG_HTTP
 */
LCB_INTERNAL_API
void lcb_clconfig_http_enable(clconfig_provider *pb);
#define lcb_clconfig_http_set_nodes lcb_clconfig_cccp_set_nodes
/**@}*/

/**
 * @name CCCP Provider-specific APIs
 * @{
 */
LCB_INTERNAL_API
void lcb_clconfig_cccp_enable(clconfig_provider *pb, lcb_t instance);

/**
 * @brief Notify the CCCP provider about a new configuration from a
 * `NOT_MY_VBUCKET` response
 *
 * This should be called by the packet handler when a configuration has been
 * received as a payload to a response with the error of `NOT_MY_VBUCKET`.
 *
 * @param provider The CCCP provider
 * @param host The hostname (without the port) on which the packet was received
 * @param data The configuration JSON blob
 * @return LCB_SUCCESS, or an error code if the configuration could not be
 * set
 */
lcb_error_t
lcb_cccp_update(clconfig_provider *provider, const char *host, lcb_string *data);

/**
 * @brief Notify the CCCP provider about a configuration received from a
 * `CMD_GET_CLUSTER_CONFIG` response.
 *
 * @param cookie The cookie object attached to the packet
 * @param err The error code for the reply
 * @param bytes The payload pointer
 * @param nbytes Size of payload
 * @param origin Host object from which the packet was received
 */
void
lcb_cccp_update2(const void *cookie, lcb_error_t err,
    const void *bytes, lcb_size_t nbytes, const lcb_host_t *origin);

#define lcb_clconfig_cccp_set_nodes(pb, nodes) (pb)->configure_nodes(pb, nodes)
/**@}*/

/**@name Raw Memcached (MCRAW) Provider-specific APIs
 * @{*/
LCB_INTERNAL_API
lcb_error_t
lcb_clconfig_mcraw_update(clconfig_provider *pb, const char *nodes);
/**@}*/

/**@}*/

#ifdef __cplusplus
}
#endif /* __cplusplus */
#endif /* LCB_CLCONFIG_H */
