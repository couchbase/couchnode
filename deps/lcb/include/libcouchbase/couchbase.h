/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_COUCHBASE_H
#define LIBCOUCHBASE_COUCHBASE_H 1

#define LCB_CONFIG_MCD_PORT 11210
#define LCB_CONFIG_MCD_SSL_PORT 11207
#define LCB_CONFIG_HTTP_PORT 8091
#define LCB_CONFIG_HTTP_SSL_PORT 18091
#define LCB_CONFIG_MCCOMPAT_PORT 11211

struct lcb_st;
typedef struct lcb_st *lcb_t;
struct lcb_http_request_st;
typedef struct lcb_http_request_st *lcb_http_request_t;

#include <stddef.h>
#include <time.h>
#include <stdarg.h>
#include <stdio.h>
#include <libcouchbase/sysdefs.h>
#include <libcouchbase/assert.h>
#include <libcouchbase/visibility.h>
#include <libcouchbase/error.h>
#include <libcouchbase/iops.h>
#include <libcouchbase/http.h>
#include <libcouchbase/configuration.h>
#include <libcouchbase/_cxxwrap.h>

#ifdef __cplusplus
extern "C"{
#endif

typedef lcb_U8 lcb_datatype_t;
typedef lcb_U32 lcb_USECS;

/**
 * @file
 * Main header file for Couchbase
 */

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** INITIALIZATION                                                           **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-init Basic Library Routines
 *
 * @details
 *
 * To communicate with a Couchbase cluster, a new library handle instance is
 * created in the form of an lcb_t. To create such an object, the lcb_create()
 * function is called, passing it a structure of type lcb_create_st. The structure
 * acts as a container for a union of other structures which are extended
 * as more features are added. This container is forwards and backwards
 * compatible, meaning that if the structure is extended, you code and application
 * will still function if using an older version of the structure. The current
 * sub-field of the lcb_create_st structure is the `v3` field.
 *
 * Connecting to the cluster involes the client knowing the necessary
 * information needed to actually locate its services and connect to it.
 *
 * A connection specification consists of:
 *
 * 1. One or more hosts which comprise the cluster
 * 2. The name of the bucket to access and perform operations on
 * 3. The credentials of the bucket
 *
 * All these options are specified within the form of a URI in the form of
 *
 * `couchbase://$HOSTS/$BUCKET?$OPTIONS`
 *
 * @note
 * If any of the fields (hosts, bucket, options) contain the `/` character then
 * it _must_ be url-encoded; thus a bucket named `foo/bar` would be specified
 * as `couchbase:///foo%2Fbar`
 *
 * ### Hosts
 *
 * In the most typical use case, you would specify a list of several hostnames
 * delimited by a comma (`,`); each host specified should be a member of the
 * cluster. The library will use this list to initially connect to the cluster.
 *
 * Note that it is not necessary to specify _all_ the nodes of the cluster as in
 * a normal situation the library will only initially connect to one of the nodes.
 * Passing multiple nodes increases the chance of a connection succeeding even
 * if some of the nodes are currently down. Once connected to the cluster, the
 * client will update itself with the other nodes actually found within the
 * cluster and discard the list passed to it
 *
 * You can specify multiple hosts like so:
 *
 * `couchbase://foo.com,bar.com,baz.com`
 *
 * Or a single host:
 *
 * `couchbase://localhost`
 *
 * #### Specifying Ports and Protocol Options
 *
 * The default `couchbase://` scheme will assume all hosts and/or ports
 * specify the _memcached_ port. If no port is specified, it is assumed
 * that the port is _11210). For more extended options there are additional
 * schemes available:
 *
 * * `couchbases://` - Will assume all ports refer to the SSL-enabled memcached
 *   ports. This setting implicitly enables SSL on the instance as well. If no
 *   ports are provided for the hosts, the implicit port for each host will be
 *   _11207_.
 *
 * * `http://` - Will assume all ports refer to the HTTP REST API ports used
 *   by Couchbase 2.2 and lower. These are also used when connecting to a
 *   memcached bucket. If no port is specified it will be assumed the port is
 *   _8091_.
 *
 * ### Bucket
 *
 * A bucket may be specified by using the optional _path_ component of the URI
 * For protected buckets a password will still need to be supplied out of band.
 *
 * * `couchbase://1.1.1.1,2.2.2.2,3.3.3.3/users` - Connect to the `users`
 *   bucket.
 *
 * ### Options
 *
 * @warning The key-value options here are considered to be a volatile interface
 * as their names may change.
 *
 * Options can be specified as the _query_ part of the connection string,
 * for example:
 *
 * `couchbase://cbnode.net/beer?operation_timeout=10000000`.
 *
 * Options may either be appropriate _key_ parameters for lcb_cntl_string()
 * or one of the following:
 *
 * * `boostrap_on` - specify bootstrap protocols. Values can be `http` to force
 *   old-style bootstrap mode for legacy clusters, `cccp` to force bootstrap
 *   over the memcached port (For clusters 2.5 and above), or `all` to try with
 *   _cccp_ and revert to _http_
 *
 * * `certpath` - Specify the path (on the local filesystem) to the server's
 *   SSL certificate. Only applicable if SSL is being used (i.e. the scheme is
 *   `couchbases`)
 *
 * ### Bucket Identification and Credentials
 *
 * The most common settings you will wish to modify are the bucket name
 *  and the credentials field (`user` and `passwd`). If a
 * `bucket` is not specified it will revert to the `default` bucket (i.e. the
 * bucket which is created when Couchbase Server is installed).
 *
 * The `user` and `passwd` fields authenticate for the bucket. This is only
 * needed if you have configured your bucket to employ SASL auth. You can tell
 * if the bucket has been configured with SASL auth by
 *
 * 1. Logging into the Couchbase Administration Console
 * 2. Going to the _Data Buckets_ tab
 * 3. Locate the row for your bucket
 * 4. Expand the row into the detailed view (by clicking on the arrow at the
 *    left of the row)
 * 5. Click on _Edit_
 * 6. Inspect the _Access Control_ section in the pop-up
 *
 * The bucket name is specified as the _path_ portion of the URI.
 *
 * For security purposes, the _user_ and _passwd_ cannot be specified within
 * the URI
 *
 *
 * @note
 * You may not change the bucket or credentials after initializing the handle.
 *
 * #### Bootstrap Options
 *
 * The default configuration process will attempt to bootstrap first from
 * the new memcached configuration protocol (CCCP) and if that fails, use
 * the "HTTP" protocol via the REST API.
 *
 * The CCCP configuration will by default attempt to connect to one of
 * the nodes specified on the port 11201. While normally the memcached port
 * is determined by the configuration itself, this is not possible when
 * the configuration has not been attained. You may specify a list of
 * alternate memcached servers by using the 'mchosts' field.
 *
 * If you wish to modify the default bootstrap protocol selection, you
 * can use the `bootstrap_on` option to specify the desired bootstrap
 * specification
 * to use for configuration (note that the ordering of this array is
 * ignored). Using this mechanism, you can disable CCCP or HTTP.
 *
 * To force only "new-style" bootstrap, you may use `bootstrap_on=cccp`.
 * To force only "old-style" bootstrap, use `bootstrap_on=http`. To force the
 * default behavior, use `bootstrap_on=all`
 *
 *
 * @addtogroup lcb-init
 * @{
 */


/**@name Creating A Library Handle
 *
 * These structures contain the various options passed to the lcb_create()
 * function.
 * @{
 */

/** @brief Handle types @see lcb_create_st3::type */
typedef enum {
    LCB_TYPE_BUCKET = 0x00, /**< Handle for data access (default) */
    LCB_TYPE_CLUSTER = 0x01 /**< Handle for administrative access */
} lcb_type_t;

#ifndef __LCB_DOXYGEN__
/* These are definitions for some of the older fields of the `lcb_create_st`
 * structure. They are here for backwards compatibility and should not be
 * used by new code */
typedef enum { LCB_CONFIG_TRANSPORT_LIST_END = 0, LCB_CONFIG_TRANSPORT_HTTP = 1, LCB_CONFIG_TRANSPORT_CCCP, LCB_CONFIG_TRANSPORT_MAX } lcb_config_transport_t;
#define LCB_CREATE_V0_FIELDS const char *host; const char *user; const char *passwd; const char *bucket; struct lcb_io_opt_st *io;
#define LCB_CREATE_V1_FIELDS LCB_CREATE_V0_FIELDS lcb_type_t type;
#define LCB_CREATE_V2_FIELDS LCB_CREATE_V1_FIELDS const char *mchosts; const lcb_config_transport_t* transports;
struct lcb_create_st0 { LCB_CREATE_V0_FIELDS };
struct lcb_create_st1 { LCB_CREATE_V1_FIELDS };
struct lcb_create_st2 { LCB_CREATE_V2_FIELDS };
#endif

/**
 * @brief Structure for lcb_create().
 * @see lcb-init
 */
struct lcb_create_st3 {
    const char *connstr; /**< Connection string */
    const char *username; /**< Username for bucket. Unused as of Server 2.5 */
    const char *passwd; /**< Password for bucket */
    void *_pad_bucket; /* Padding. Unused */
    struct lcb_io_opt_st *io; /**< IO Options */
    lcb_type_t type;
};

/**@brief Wrapper structure for lcb_create()
 * @see lcb_create_st3 */
struct lcb_create_st {
    /** Indicates which field in the @ref lcb_CRST_u union should be used. Set this to `3` */
    int version;

    /**This union contains the set of current and historical options. The
     * The #v3 field should be used. */
    union lcb_CRST_u {
        struct lcb_create_st0 v0;
        struct lcb_create_st1 v1;
        struct lcb_create_st2 v2;
        struct lcb_create_st3 v3; /**< Use this field */
    } v;
    LCB_DEPR_CTORS_CRST
};

/**
 * @brief Create an instance of lcb.
 * @param instance Where the instance should be returned
 * @param options How to create the libcouchbase instance
 * @return LCB_SUCCESS on success
 *
 *
 * ### Examples
 * Create an instance using the default values:
 *
 * @code{.c}
 * lcb_t instance;
 * lcb_error_t err = lcb_create(&instance, NULL);
 * if (err != LCB_SUCCESS) {
 *    fprintf(stderr, "Failed to create instance: %s\n", lcb_strerror(NULL, err));
 *    exit(EXIT_FAILURE);
 * }
 * @endcode
 *
 * Specify server list
 *
 * @code{.c}
 * struct lcb_create_st options;
 * memset(&options, 0, sizeof(options));
 * options.version = 3;
 * options.v.v3.connstr = "couchbase://host1,host2,host3";
 * err = lcb_create(&instance, &options);
 * @endcode
 *
 *
 * Create a handle for data requests to protected bucket
 *
 * @code{.c}
 * struct lcb_create_st options;
 * memset(&options, 0, sizeof(options));
 * options.version = 3;
 * options.v.v3.host = "couchbase://example.com,example.org/protected"
 * options.v.v3.passwd = "secret";
 * err = lcb_create(&instance, &options);
 * @endcode
 * @committed
 * @see lcb_create_st3
 */
LIBCOUCHBASE_API
lcb_error_t lcb_create(lcb_t *instance, const struct lcb_create_st *options);

/**
 * @brief Schedule the initial connection
 * This function will schedule the initial connection for the handle. This
 * function _must_ be called before any operations can be performed.
 *
 * lcb_set_bootstrap_callback() or lcb_get_bootstrap_status() can be used to
 * determine if the scheduled connection completed successfully.
 *
 * lcb_wait() should be called after this function.
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_connect(lcb_t instance);

/**@}*/

/**
 * Associate a cookie with an instance of lcb. The _cookie_ is a user defined
 * pointer which will remain attached to the specified `lcb_t` for its duration.
 * This is the way to associate user data with the `lcb_t`.
 *
 * @param instance the instance to associate the cookie to
 * @param cookie the cookie to associate with this instance.
 *
 * @attention
 * There is no destructor for the specified `cookie` stored with the instance;
 * thus you must ensure to manually free resources to the pointer (if it was
 * dynamically allocated) when it is no longer required.
 * @committed
 *
 * @code{.c}
 * typedef struct {
 *   const char *status;
 *   // ....
 * } instance_info;
 *
 * static void bootstrap_callback(lcb_t instance, lcb_error_t err) {
 *   instance_info *info = (instance_info *)lcb_get_cookie(instance);
 *   if (err == LCB_SUCCESS) {
 *     info->status = "Connected";
 *   } else {
 *     info->status = "Error";
 *   }
 * }
 *
 * static void do_create(void) {
 *   instance_info *info = calloc(1, sizeof(*info));
 *   // info->status is currently NULL
 *   // .. create the instance here
 *   lcb_set_cookie(instance, info);
 *   lcb_set_bootstrap_callback(instance, bootstrap_callback);
 *   lcb_connect(instance);
 *   lcb_wait(instance);
 *   printf("Status of instance is %s\n", info->status);
 * }
 * @endcode
 */
LIBCOUCHBASE_API
void lcb_set_cookie(lcb_t instance, const void *cookie);

/**
 * Retrieve the cookie associated with this instance
 * @param instance the instance of lcb
 * @return The cookie associated with this instance or NULL
 * @see lcb_set_cookie()
 * @committed
 */
LIBCOUCHBASE_API
const void *lcb_get_cookie(lcb_t instance);

/**
 * @brief Wait for the execution of all batched requests
 *
 * A batched request is any request which requires network I/O.
 * This includes most of the APIs. You should _not_ use this API if you are
 * integrating with an asynchronous event loop (i.e. one where your application
 * code is invoked asynchronously via event loops).
 *
 * This function will block the calling thread until either
 *
 * * All operations have been completed
 * * lcb_breakout() is explicitly called
 *
 * @param instance the instance containing the requests
 * @return whether the wait operation failed, or LCB_SUCCESS
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_wait(lcb_t instance);

/**@brief Flags for lcb_wait3()*/
typedef enum {
    /**Behave like the old lcb_wait()*/
    LCB_WAIT_DEFAULT = 0x00,

    /**Do not check pending operations before running the event loop. By default
     * lcb_wait() will traverse the server list to check if any operations are
     * pending, and if nothing is pending the function will return without
     * running the event loop. This is usually not necessary for applications
     * which already _only_ call lcb_wait() when they know they have scheduled
     * at least one command.
     */
    LCB_WAIT_NOCHECK = 0x01
} lcb_WAITFLAGS;

/**
 * @committed
 * @brief Wait for completion of scheduled operations.
 * @param instance the instance
 * @param flags flags to modify the behavior of lcb_wait(). Pass 0 to obtain
 * behavior identical to lcb_wait().
 */
LIBCOUCHBASE_API
void lcb_wait3(lcb_t instance, lcb_WAITFLAGS flags);

/**
 * @brief Forcefully break from the event loop.
 *
 * You may call this function from within any callback to signal to the library
 * that it return control to the function calling lcb_wait() as soon as possible.
 * Note that if there are pending functions which have not been processed, you
 * are responsible for calling lcb_wait() a second time.
 *
 * @param instance the instance to run the event loop for.
 * @committed
 */
LIBCOUCHBASE_API
void lcb_breakout(lcb_t instance);


/**
 * Bootstrap callback. Invoked once the instance is ready to perform operations
 * @param instance The instance which was bootstrapped
 * @param err The error code received. If this is not LCB_SUCCESS then the
 * instance is not bootstrapped and must be recreated
 *
 * @attention This callback only receives information during instantiation.
 * @committed
 */
typedef void (*lcb_bootstrap_callback)(lcb_t instance, lcb_error_t err);

/**
 * @brief Set the callback for notification of success or failure of
 * initial connection
 * @param instance the instance
 * @param callback the callback to set. If `NULL`, return the existing callback
 * @return The existing (and previous) callback.
 * @see lcb_connect()
 * @see lcb_get_bootstrap_status()
 */
LIBCOUCHBASE_API
lcb_bootstrap_callback
lcb_set_bootstrap_callback(lcb_t instance, lcb_bootstrap_callback callback);

/**
 * @brief Gets the initial bootstrap status
 *
 * This is an alternative to using the lcb_bootstrap_callback() and may be used
 * after the initial lcb_connect() and lcb_wait() sequence.
 * @param instance
 * @return LCB_SUCCESS if properly bootstrapped or an error code otherwise.
 *
 * @attention
 * Calling this function only makes sense during instantiation.
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_get_bootstrap_status(lcb_t instance);

/**
 * @uncommitted
 *
 * @brief Force the library to refetch the cluster configuration
 *
 * The library by default employs various heuristics to determine if a new
 * configuration is needed from the cluster. However there are some situations
 * in which an application may wish to force a refresh of the configuration:
 *
 * * If a specific node has been failed
 *   over and the library has received a configuration in which there is no
 *   master node for a given key, the library will immediately return the error
 *   `LCB_NO_MATCHING_SERVER` for the given item and will not request a new
 *   configuration. In this state, the client will not perform any network I/O
 *   until a request has been made to it using a key that is mapped to a known
 *   active node.
 *
 * * The library's heuristics may have failed to detect an error warranting
 *   a configuration change, but the application either through its own
 *   heuristics, or through an out-of-band channel knows that the configuration
 *   has changed.
 *
 *
 * This function is provided as an aid to assist in such situations
 *
 * If you wish for your application to block until a new configuration is
 * received, you _must_ call lcb_wait3() with the LCB_WAIT_NO_CHECK flag as
 * this function call is not bound to a specific operation. Additionally there
 * is no status notification as to whether this operation succeeded or failed
 * (the configuration callback via lcb_set_configuration_callback() may
 * provide hints as to whether a configuration was received or not, but by no
 * means should be considered to be part of this function's control flow).
 *
 * In general the use pattern of this function is like so:
 *
 * @code{.c}
 * unsigned retries = 5;
 * lcb_error_t err;
 * do {
 *   retries--;
 *   err = lcb_get(instance, cookie, ncmds, cmds);
 *   if (err == LCB_NO_MATCHING_SERVER) {
 *     lcb_refresh_config(instance);
 *     usleep(100000);
 *     lcb_wait3(instance, LCB_WAIT_NO_CHECK);
 *   } else {
 *     break;
 *   }
 * } while (retries);
 * if (err == LCB_SUCCESS) {
 *   lcb_wait3(instance, 0); // equivalent to lcb_wait(instance);
 * } else {
 *   printf("Tried multiple times to fetch the key, but its node is down\n");
 * }
 * @endcode
 */
LIBCOUCHBASE_API
void
lcb_refresh_config(lcb_t instance);

/**
 * Destroy (and release all allocated resources) an instance of lcb.
 * Using instance after calling destroy will most likely cause your
 * application to crash.
 *
 * Note that any pending operations will not have their callbacks invoked.
 *
 * @param instance the instance to destroy.
 * @committed
 */
LIBCOUCHBASE_API
void lcb_destroy(lcb_t instance);

/**
 * @brief Callback received when instance is about to be destroyed
 * @param cookie cookie passed to lcb_destroy_async()
 */
typedef void (*lcb_destroy_callback)(const void *cookie);

/**
 * @brief Set the callback to be invoked when the instance is destroyed
 * asynchronously.
 * @return the previous callback.
 */
LIBCOUCHBASE_API
lcb_destroy_callback
lcb_set_destroy_callback(lcb_t, lcb_destroy_callback);
/**
 * @brief Asynchronously schedule the destruction of an instance.
 *
 * This function provides a safe way for asynchronous environments to destroy
 * the lcb_t handle without worrying about reentrancy issues.
 *
 * @param instance
 * @param arg a pointer passed to the callback.
 *
 * While the callback and cookie are optional, they are very much recommended
 * for testing scenarios where you wish to ensure that all resources allocated
 * by the instance have been closed. Specifically when the callback is invoked,
 * all timers (save for the one actually triggering the destruction) and sockets
 * will have been closed.
 *
 * As with lcb_destroy() you may call this function only once. You may not
 * call this function together with lcb_destroy as the two are mutually
 * exclusive.
 *
 * If for whatever reason this function is being called in a synchronous
 * flow, lcb_wait() must be invoked in order for the destruction to take effect
 *
 * @see lcb_set_destroy_callback
 *
 * @committed
 */
LIBCOUCHBASE_API
void lcb_destroy_async(lcb_t instance, const void *arg);

/******************************************************************************
 ******************************************************************************
 ** IO CREATION                                                              **
 ******************************************************************************
 ******************************************************************************/

/**
 * @brief Built-in I/O plugins
 * @committed
 */
typedef enum {
    LCB_IO_OPS_INVALID = 0x00, /**< @private */
    LCB_IO_OPS_DEFAULT = 0x01, /**< @private */

    /** Integrate with the libevent loop. See lcb_create_libevent_io_opts() */
    LCB_IO_OPS_LIBEVENT = 0x02,
    LCB_IO_OPS_WINSOCK = 0x03, /**< @private */
    LCB_IO_OPS_LIBEV = 0x04,
    LCB_IO_OPS_SELECT = 0x05,
    LCB_IO_OPS_WINIOCP = 0x06,
    LCB_IO_OPS_LIBUV = 0x07
} lcb_io_ops_type_t;

/** @brief IO Creation for builtin plugins */
typedef struct {
    lcb_io_ops_type_t type; /**< The predefined type you want to create */
    void *cookie; /**< Plugin-specific argument */
} lcb_IOCREATEOPTS_BUILTIN;

#ifndef __LCB_DOXYGEN__
/* These are mostly internal structures which may be in use by older applications.*/
typedef struct { const char *sofile; const char *symbol; void *cookie; } lcb_IOCREATEOPTS_DSO;
typedef struct { lcb_io_create_fn create; void *cookie; } lcb_IOCREATEOPS_FUNCTIONPOINTER;
#endif

/** @uncommited */
struct lcb_create_io_ops_st {
    int version;
    union {
        lcb_IOCREATEOPTS_BUILTIN v0;
        lcb_IOCREATEOPTS_DSO v1;
        lcb_IOCREATEOPS_FUNCTIONPOINTER v2;
    } v;
};

/**
 * Create a new instance of one of the library-supplied io ops types.
 *
 * This function should only be used if you wish to override/customize the
 * default I/O plugin behavior; for example to select a specific implementation
 * (e.g. always for the _select_ plugin) and/or to integrate
 * a builtin plugin with your own application (e.g. pass an existing `event_base`
 * structure to the _libevent_ plugin).
 *
 * If you _do_ use this function, then you must call lcb_destroy_io_ops() on
 * the plugin handle once it is no longer required (and no instance is using
 * it).
 *
 * Whether a single `lcb_io_opt_t` may be used by multiple instances at once
 * is dependent on the specific implementation, but as a general rule it should
 * be assumed to be unsafe.
 *
 * @param[out] op The newly created io ops structure
 * @param options How to create the io ops structure
 * @return @ref LCB_SUCCESS on success
 * @uncommitted
 */
LIBCOUCHBASE_API
lcb_error_t lcb_create_io_ops(lcb_io_opt_t *op, const struct lcb_create_io_ops_st *options);

/**
 * Destroy the plugin handle created by lcb_create_io_ops()
 * @param op ops structure
 * @return LCB_SUCCESS on success
 * @uncommitted
 */
LIBCOUCHBASE_API
lcb_error_t lcb_destroy_io_ops(lcb_io_opt_t op);
/**@}*/



/**@private
 * Note that hashkey/groupid is not a supported feature of Couchbase Server
 * and this client.  It should be considered volatile and experimental.
 * Using this could lead to an unbalanced cluster, inability to interoperate
 * with the data from other languages, not being able to use the
 * Couchbase Server UI to look up documents and other possible future
 * upgrade/migration concerns.
 */
#define LCB__HKFIELDS \
    /**
     @private
     @volatile
     Do not use. This field exists to support older code. Using a dedicated
     hashkey will cause problems with your data in various systems. */ \
     const void *hashkey; \
     \
     lcb_SIZE nhashkey; /**<@private*/

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-kv-api Key-Value API
 * @brief Operate on one or more key values
 * @details
 *
 * The key-value APIs are high performance APIs utilizing the memcached protocol.
 * Use these APIs to access data by its unique key.
 *
 * These APIs are designed so that each function is passed in one or more
 * "Command Structures". A command structure is a small structure detailing a
 * specific key and contains options and modifiers for the operation as it
 * relates to that key.
 *
 * All the command structures are currently layed out like so:
 *
 * @code{.c}
 * {
 *   int version;
 *   union {
 *     struct CMDv0 v0;
 *     struct CMDv1 v1;
 *   } v;
 * }
 * @endcode
 *
 * These top level structures are _wrapper_ structures and are present to ensure
 * portability between different versions of the library. To employ these
 * structures within the command, you may do:
 *
 * @code{.c}
 * lcb_get_cmd_t gcmd_wrap = { 0 }, *cmdp_wrap = &gcmd_wrap;
 * lcb_GETCMDv0 *gcmd = &gcmd_wrap->v.v0;
 * gcmd->key = key;
 * gcmd->nkey = strlen(key);
 * lcb_get(instance, cookie, 1, &gcmd_wrap);
 * @endcode
 */

/**
 * Structure representing a synchronization token. This token may be used
 * for durability operations.
 *
 * This structure is considered opaque and thus has no alignment requirements.
 * Its size is fixed at 16 bytes; though.
 */
typedef struct {
    lcb_U64 uuid_;
    lcb_U64 seqno_;
    lcb_U16 vbid_;
} lcb_SYNCTOKEN;
#define LCB_SYNCTOKEN_ID(p) (p)->uuid_
#define LCB_SYNCTOKEN_SEQ(p) (p)->seqno_
#define LCB_SYNCTOKEN_VB(p) (p)->vbid_
#define LCB_SYNCTOKEN_ISVALID(p) \
    (p && !((p)->uuid_ == 0 && (p)->seqno_ == 0 && (p)->vbid_ == 0))

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** GET                                                                      **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-get Get items from the cluster
 * @brief
 * Get one or more keys from the cluster. Included in these functions are
 * means by which to temporarily lock access to an item, modify its expiration,
 * and retrieve an item from a replica.
 *
 * @addtogroup lcb-get
 * @{
 */

/**
 * @brief Get Command Structure
 */
typedef struct {
    const void *key; /**< Key to retrieve */
    lcb_SIZE nkey; /**< Key length */

    /**
     * If this parameter is specified and `lock` is _not_ set then the server
     * will also update the object's expiration time while retrieving the key.
     * If `lock` _is_ set then this is the maximum amount of time the lock
     * may be held (before an unlock) before the server will forecfully unlock
     * the key.
     */
    lcb_time_t exptime;

    /**
     * If this parameter is set then the server will in addition to retrieving
     * the item also lock the item, making it so that subsequent attempts to
     * lock and/or modify the same item will fail with an error
     * (either @ref LCB_KEY_EEXISTS or @ref LCB_ETMPFAIL).
     *
     * The lock will be released when one of the following happens:
     *
     * 1. The item is explicitly unlocked (see lcb_unlock())
     * 2. The lock expires (See the #exptime parameter)
     * 3. The item is modified using lcb_store(), and being provided with the
     *    correct _CAS_.
     *
     */
    int lock;
    LCB__HKFIELDS
} lcb_GETCMDv0;

/**
 * @brief lcb_get() Command Wrapper Structure
 * @see lcb_GETCMDv0
 */
typedef struct lcb_get_cmd_st {
    int version;
    union { lcb_GETCMDv0 v0; } v;
    LCB_DEPR_CTORS_GET
} lcb_get_cmd_t;

/** Value is JSON */
#define LCB_DATATYPE_JSON 0x01

/**
 * @brief Flags which can be returned int the the lcb_GETRESPv0::datatype
 * field
 */
typedef enum {
    LCB_VALUE_RAW = 0x00, /**< Value is raw bytes */
    LCB_VALUE_F_JSON = 0x01, /**< Value is JSON */
    LCB_VALUE_F_SNAPPYCOMP = 0x02 /**< Value is compressed as Snappy */
} lcb_VALUEFLAGS;
/**
 * @brief Inner response structure for a get operation
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    const void *bytes;
    lcb_SIZE nbytes;
    lcb_U32 flags; /**< Server side flags stored with the item */
    lcb_cas_t cas; /**< CAS representing current mutation state of the item */
    lcb_U8 datatype; /**< Currently unused */
} lcb_GETRESPv0;

/**
 * @brief lcb_get() response wrapper structure
 * @see lcb_GETRESPv0
 */
typedef struct {
    int version;
    union {
        lcb_GETRESPv0 v0;
    } v;
} lcb_get_resp_t;

/**
 * The callback function for a "get-style" request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the actual item (only key
 * and nkey is valid if `error != LCB_SUCCESS`)
 * @committed
 */
typedef void (*lcb_get_callback)(lcb_t instance,
                                 const void *cookie,
                                 lcb_error_t error,
                                 const lcb_get_resp_t *resp);

/**
 * @brief Set the callback to be invoked when an item is received as a result
 * of an lcb_get() operation.
 * @param callback the new callback to install. Pass NULL to only query the
 * current callback
 * @return the previous callback
 * @see lcb_get()
 * @committed
 */
LIBCOUCHBASE_API
lcb_get_callback lcb_set_get_callback(lcb_t, lcb_get_callback callback);

/**
 * Get a number of values from the cache.
 *
 * If you specify a non-zero value for expiration, the server will
 * update the expiration value on the item (refer to the
 * documentation on lcb_store to see the meaning of the
 * expiration). All other members should be set to zero.
 *
 * @code{.c}
 *   lcb_get_cmd_t *get = calloc(1, sizeof(*get));
 *   get->version = 0;
 *   get->v.v0.key = "my-key";
 *   get->v.v0.nkey = strlen(get->v.v0.key);
 *   // Set an expiration of 60 (optional)
 *   get->v.v0.exptime = 60;
 *   lcb_get_cmd_t* commands[] = { get };
 *   lcb_get(instance, NULL, 1, commands);
 * @endcode
 *
 * It is possible to get an item with a lock that has a timeout. It can
 * then be unlocked with either a CAS operation or with an explicit
 * unlock command.
 *
 * You may specify the expiration value for the lock in the
 * expiration (setting it to 0 cause the server to use the default
 * value).
 *
 * Get and lock the key:
 *
 * @code{.c}
 *   lcb_get_cmd_t *get = calloc(1, sizeof(*get));
 *   get->version = 0;
 *   get->v.v0.key = "my-key";
 *   get->v.v0.nkey = strlen(get->v.v0.key);
 *   // Set a lock expiration of 5 (optional)
 *   get->v.v0.lock = 1;
 *   get->v.v0.exptime = 5;
 *   lcb_get_cmd_t* commands[] = { get };
 *   lcb_get(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to get
 * @return_rc
 *
 * Operation-specific errors received in callbacks include:
 * @cb_err ::LCB_KEY_ENOENT if the key does not exist
 * @cb_err ::LCB_ETMPFAIL if the `lock` option was set in the command and the item
 * was already locked.
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_get(lcb_t instance,
                    const void *command_cookie,
                    lcb_SIZE num,
                    const lcb_get_cmd_t *const *commands);
/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** GET ITEM FROM REPLICA                                                    **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-get-replica Get items from replica
 * @brief Get items from replica. This is like lcb_get() but is useful when
 * an item from the master cannot be retrieved.
 *
 * From command version 1, it is possible to select strategy of how to
 * select the replica node. Currently three strategies are available:
 * 1. LCB_REPLICA_FIRST: Previously accessible and default as of 2.0.8,
 *    the caller will get a reply from the first replica to successfully
 *    reply within the timeout for the operation or will receive an
 *    error.
 *
 * 2. LCB_REPLICA_ALL: Ask all replicas to send documents/item back.
 *
 * 3. LCB_REPLICA_SELECT: Select one replica by the index in the
 *    configuration starting from zero. This approach can more quickly
 *    receive all possible replies for a given topology, but it can
 *    also generate false negatives.
 *
 * @note
 * applications should not assume the order of the
 * replicas indicates more recent data is at a lower index number.
 * It is up to the application to determine which version of a
 * document/item it may wish to use in the case of retrieving data from a replica.
 *
 * ### Examples
 *
 * #### Get document from the second replica
 *
 * @code{.c}
 * lcb_get_replica_cmd_t *get = calloc(1, sizeof(*get));
 * get->version = 1;
 * get->v.v1.key = "my-key";
 * get->v.v1.nkey = strlen(get->v.v1.key);
 * get->v.v1.strategy = LCB_REPLICA_SELECT;
 * get->v.v1.index = 2;
 * lcb_get_replica_cmd_st* commands[] = { get };
 * lcb_get_replica(instance, NULL, 1, commands);
 * @endcode
 *
 * #### Get document from the first available replica
 * @code{.c}
 * get->v.v1.strategy = LCB_REPLICA_FIRST;
 * lcb_get_replica_cmd_st* commands[] = { get };
 * lcb_get_replica(instance, NULL, 1, commands);
 * @endcode
 *
 * #### Get document from all replicas
 * This will will generate lcb_get_num_replicas() responses
 *
 * @code{.c}
 * get->v.v1.strategy = LCB_REPLICA_ALL;
 * lcb_get_replica_cmd_st* commands[] = { get };
 * lcb_get_replica(instance, NULL, 1, commands);
 * @endcode
 *
 * @addtogroup lcb-get-replica
 * @{
 */


typedef struct { const void *key; lcb_SIZE nkey; LCB__HKFIELDS } lcb_GETREPLICACMDv0;

/**@brief Select get-replica mode
 * @see lcb_rget3_cmd_t */
typedef enum {
    /**Query all the replicas sequentially, retrieving the first successful
     * response */
    LCB_REPLICA_FIRST = 0x00,

    /**Query all the replicas concurrently, retrieving all the responses*/
    LCB_REPLICA_ALL = 0x01,

    /**Query the specific replica specified by the
     * lcb_rget3_cmd_t#index field */
    LCB_REPLICA_SELECT = 0x02
} lcb_replica_t;

/**
 * @brief Command for lcb_get_replica()
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    LCB__HKFIELDS
    lcb_replica_t strategy; /**< Strategy to use */
    /**If #strategy is LCB_REPLICA_SELECT, specific the replica index to use */
    int index;
} lcb_GETREPLICACMDv1;

/**
 * @brief wrapper structure for lcb_get_replica()
 * @see lcb_GETREPLICACMDv1
 */
typedef struct lcb_get_replica_cmd_st {
    int version;
    union {
        lcb_GETREPLICACMDv0 v0;
        lcb_GETREPLICACMDv1 v1;
    } v;
    LCB_DEPR_CTORS_RGET
} lcb_get_replica_cmd_t;

/**
 * Get a number of replca values from the cache.
 *
 * Example:
 * @code{.c}
 *   lcb_get_replica_cmd_t *get = calloc(1, sizeof(*get));
 *   get->version = 0;
 *   get->v.v0.key = "my-key";
 *   get->v.v0.nkey = strlen(get->v.v0.key);
 *   lcb_get_replica-cmd_t* commands[] = { get };
 *   lcb_get_replica(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to get
 * @return_rc
 *
 * For operation-specific error codes received in the callback, see lcb_get()
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_get_replica(lcb_t instance,
                            const void *command_cookie,
                            lcb_SIZE num,
                            const lcb_get_replica_cmd_t *const *commands);

/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** UNLOCK                                                                   **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-unlock Unlocking items.
 * @brief See @ref lcb-get
 * @addtogroup lcb-unlock
 * @{
 */

/**
 * @brief lcb_unlock() Command structure
 * @see lcb_GETRESPv0
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas; /**< You _must_ populate this with the CAS */
    LCB__HKFIELDS
} lcb_UNLOCKCMDv0;

/**@brief lcb_unlock() Wrapper structure
 * @see lcb_UNLOCKCMDv0 */
typedef struct lcb_unlock_cmd_st {
    int version;
    union {
        lcb_UNLOCKCMDv0 v0;
    } v;
    LCB_DEPR_CTORS_UNL
} lcb_unlock_cmd_t;

/** @brief lcb_unlock() response structure */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
} lcb_UNLOCKRESPv0;

/**@brief lcb_unlock() wrapper response structure
 * @see lcb_UNLOCKRESPv0 */
typedef struct {
    int version;
    union {
        lcb_UNLOCKRESPv0 v0;
    } v;
} lcb_unlock_resp_t;

/**
 * The callback function for an unlock request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation
 * @committed
 */
typedef void (*lcb_unlock_callback)(lcb_t instance,
                                    const void *cookie,
                                    lcb_error_t error,
                                    const lcb_unlock_resp_t *resp);
/**@committed*/
LIBCOUCHBASE_API
lcb_unlock_callback lcb_set_unlock_callback(lcb_t, lcb_unlock_callback);

/**
 * Unlock the key locked with lcb_get() with the lcb_GETCMDv0::lock option
 *
 * You should initialize the `key`, `nkey` and `cas` member in the
 * lcb_item_st structure for the keys to get. All other
 * members should be set to zero.
 *
 * @code{.c}
 *   lcb_unlock_cmd_t *unlock = calloc(1, sizeof(*unlock));
 *   unlock->version = 0;
 *   unlock->v.v0.key = "my-key";
 *   unlock->v.v0.nkey = strlen(unlock->v.v0.key);
 *   unlock->v.v0.cas = 0x666;
 *   lcb_unlock_cmd_t* commands[] = { unlock };
 *   lcb_unlock(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the handle to lcb
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to unlock
 * @return The status of the operation
 * @return_rc
 *
 * Operation specific error codes:
 * @cb_err ::LCB_ETMPFAIL if the item is not locked, or if the wrong CAS was
 * specified
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_unlock(lcb_t instance,
                       const void *command_cookie,
                       lcb_SIZE num,
                       const lcb_unlock_cmd_t *const *commands);
/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** STORE                                                                    **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-store Storing items
 * @brief Mutate an item within the cluster. Here you can create a new item,
 * replace an existing item, and append or prepend to an existing value
 * @addtogroup lcb-store
 * @{
 */

/**
 * @brief `operation` parameter for lcb_store()
 *
 * Storing an item in couchbase is only one operation with a different
 * set of attributes / constraints.
 */
typedef enum {
    /** Add the item to the cache, but fail if the object exists alread */
    LCB_ADD = 0x01,
    /** Replace the existing object in the cache */
    LCB_REPLACE = 0x02,
    /** Unconditionally set the object in the cache */
    LCB_SET = 0x03,
    /** Append this object to the existing object */
    LCB_APPEND = 0x04,
    /** Prepend this  object to the existing object */
    LCB_PREPEND = 0x05
} lcb_storage_t;

/**
 * @brief lcb_store() Command structure
 *
 * This structure is used to define an item to be stored on the server.
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    const void *bytes; /**< Value to store */
    lcb_SIZE nbytes; /**< Length of value to store */
    lcb_U32 flags; /**< User-defined flags stored along with the item */
    /**If present, the server will check that the item's _current_ CAS matches
     * the value specified here. If this check fails the command will fail with
     * an @ref LCB_KEY_EEXISTS error.
     *
     * @warning For @ref LCB_APPEND and @ref LCB_PREPEND, this field should be
     * `0`. */
    lcb_cas_t cas;
    lcb_U8 datatype; /**< See lcb_VALUEFLAGS */
    /**Expiration for the item. `0` means never expire.
     * @warning for @ref LCB_APPEND and @ref LCB_PREPEND, this field should be
     * `0`. */
    lcb_time_t exptime;
    lcb_storage_t operation; /**< **Mandatory**. Mutation type */
    LCB__HKFIELDS
} lcb_STORECMDv0;

/** @brief Wrapper structure for lcb_STORECMDv0 */
typedef struct lcb_store_cmd_st {
    int version;
    union {
        lcb_STORECMDv0 v0;
    } v;
    LCB_DEPR_CTORS_STORE
} lcb_store_cmd_t;

typedef struct {
    const void *key; /**< Key that was stored */
    lcb_SIZE nkey; /**< Size of key that was stored */
    lcb_cas_t cas; /**< Cas representing current mutation */
} lcb_STORERESPv0;

/** @brief Wrapper structure for lcb_STORERESPv0 */
typedef struct {
    int version;
    union {
        lcb_STORERESPv0 v0;
    } v;
} lcb_store_resp_t;

/**
 * The callback function for a storage request.
 *
 * @param instance the instance performing the operation
 * @param operation the operation performed
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the item related to the store
 *             operation. (only key and nkey is valid if
 *             error != LCB_SUCCESS)
 * @committed
 */
typedef void (*lcb_store_callback)(lcb_t instance,
                                   const void *cookie,
                                   lcb_storage_t operation,
                                   lcb_error_t error,
                                   const lcb_store_resp_t *resp);

/**
 * @brief Set the callback to be received when an item has been stored
 * @param callback the new callback to install, or `NULL` to just query the
 * current callback
 * @return the previous callback
 * @see lcb_store()
 * @committed
 */
LIBCOUCHBASE_API
lcb_store_callback lcb_set_store_callback(lcb_t, lcb_store_callback callback);

/**
 * Store an item in the cluster.
 *
 * You may initialize all of the members in the the
 * lcb_item_st structure with the values you want.
 * Values larger than `30*24*60*60` seconds (30 days) are
 * interpreted as absolute times (from the epoch). Unused members
 * should be set to zero.
 *
 * @code{.c}
 *   lcb_store_cmd_st *store = calloc(1, sizeof(*store));
 *   store->version = 0;
 *   store->v.v0.key = "my-key";
 *   store->v.v0.nkey = strlen(store->v.v0.key);
 *   store->v.v0.bytes = "{ value:666 }"
 *   store->v.v0.nbytes = strlen(store->v.v0.bytes);
 *   store->v.v0.flags = 0xdeadcafe;
 *   store->v.v0.cas = 0x1234;
 *   store->v.v0.exptime = 0x666;
 *   store->v.v0.datatype = LCB_JSON;
 *   store->v.v0.operation = LCB_REPLACE;
 *   lcb_store_cmd_st* commands[] = { store };
 *   lcb_store(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to store
 * @return_rc
 *
 * Operation-specific error codes include:
 * @cb_err ::LCB_KEY_ENOENT if ::LCB_REPLACE was used and the key does not exist
 * @cb_err ::LCB_KEY_EEXISTS if ::LCB_ADD was used and the key already exists
 * @cb_err ::LCB_KEY_EEXISTS if the CAS was specified (for an operation other
 *          than ::LCB_ADD) and the item exists on the server with a different
 *          CAS
 * @cb_err ::LCB_KEY_EEXISTS if the item was locked and the CAS supplied did
 * not match the locked item's CAS (or if no CAS was supplied)
 * @cb_err ::LCB_NOT_STORED if an ::LCB_APPEND or ::LCB_PREPEND operation was
 * performed and the item did not exist on the server.
 * @cb_err ::LCB_E2BIG if the size of the value exceeds the cluster per-item
 *         value limit (currently 20MB).
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_store(lcb_t instance,
                      const void *command_cookie,
                      lcb_SIZE num,
                      const lcb_store_cmd_t *const *commands);
/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** INCR/DECR/ARITHMETIC                                                     **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-arithmetic Arithmetic/Counter operations
 * @brief Atomic counter operations. Increment or decrement a numerical item
 * within the cluster.
 * @addtogroup lcb-arithmetic
 * @{
 */

/**@brief Command structure for arithmetic operations
 * This is contained within the @ref lcb_arithmetic_cmd_t structure */
typedef struct {
    const void *key;
    lcb_SIZE nkey;

    /**Expiration time for the item. Note this is _only_ valid if #create is
     * set to true. */
    lcb_time_t exptime;

    /**
     * If the item does not exist on the server, set this to true to force
     * the creation of the item. Otherwise the operation will fail with
     * @ref LCB_KEY_ENOENT
     */
    int create;

    /**
     * This number will be added to the current value on the server; if this is
     * negative then the current value will be decremented; if positive then
     * the current value will be incremented.
     *
     * On the server, the counter value is a 64 bit unsigned integer, whose
     * maximum value is `UINT64_MAX` If an integer overflow occurs as a result
     * of adding the `delta` value to the existing value on the server, then the
     * value on the server will wrap around; thus for example, if the existing
     * value was `UINT64_MAX-1` and `delta` was supplied as `2`, the new value
     * would be `1`.
     */
    lcb_S64 delta;

    /**
     * If the `create` field is true, this is the initial value for the counter
     * iff the item does not yet exist.
     */
    lcb_U64 initial;
    LCB__HKFIELDS
} lcb_ARITHCMDv0;

/** @brief Wrapper structure for @ref lcb_ARITHCMDv0 */
typedef struct lcb_arithmetic_cmd_st {
    int version;
    /** @brief Wrapper union for @ref lcb_ARITHCMDv0 */
    union { /** @brief Fill this structure */ lcb_ARITHCMDv0 v0; } v;

    LCB_DEPR_CTORS_ARITH
} lcb_arithmetic_cmd_t;

typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_U64 value; /**< Current numerical value of the counter */
    lcb_cas_t cas;
} lcb_ARITHRESPv0;

typedef struct {
    int version;
    union {
        lcb_ARITHRESPv0 v0;
    } v;
} lcb_arithmetic_resp_t;

/**
 * The callback function for an arithmetic request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation (only key
 *             and nkey is valid if error != LCB_SUCCESS)
 *
 * @committed
 */
typedef void (*lcb_arithmetic_callback)(lcb_t instance,
                                        const void *cookie,
                                        lcb_error_t error,
                                        const lcb_arithmetic_resp_t *resp);

/**@committed*/
LIBCOUCHBASE_API
lcb_arithmetic_callback lcb_set_arithmetic_callback(lcb_t,
                                                    lcb_arithmetic_callback);

/**
 * Perform arithmetic operation on a keys value.
 *
 * You should initialize the key, nkey and expiration member in
 * the lcb_item_st structure for the keys to update.
 * Values larger than 30*24*60*60 seconds (30 days) are
 * interpreted as absolute times (from the epoch). All other
 * members should be set to zero.
 *
 * @code{.c}
 *   lcb_arithmetic_cmd_t *arithmetic = calloc(1, sizeof(*arithmetic));
 *   arithmetic->version = 0;
 *   arithmetic->v.v0.key = "counter";
 *   arithmetic->v.v0.nkey = strlen(arithmetic->v.v0.key);
 *   arithmetic->v.v0.initial = 0x666;
 *   arithmetic->v.v0.create = 1;
 *   arithmetic->v.v0.delta = 1;
 *   lcb_arithmetic_cmd_t* commands[] = { arithmetic };
 *   lcb_arithmetic(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the handle to lcb
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to operate on
 * @return_rc
 *
 * The following operation-specific error codes may be delivered in the callback:
 * @cb_err ::LCB_KEY_ENOENT if the key does not exist (and `create` was not
 *         specified in the command
 * @cb_err ::LCB_DELTA_BADVAL if the existing value could not be parsed into
 *         a number.
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_arithmetic(lcb_t instance,
                           const void *command_cookie,
                           lcb_SIZE num,
                           const lcb_arithmetic_cmd_t *const *commands);

/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** OBSERVE                                                                  **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-observe Inspect item's Replication and Persistence
 * @brief Determine if an item exists and if it has been replicated and persisted
 * to various nodes
 * @addtogroup lcb-observe
 * @{
 */
typedef enum {
    /**
     * Only sends a command to the master. In this case the callback will
     * be invoked only once for the master, and then another time with the
     * NULL callback
     */
    LCB_OBSERVE_MASTER_ONLY = 0x01
} lcb_observe_options_t;

#define LCB_OBSERVE_FIELDS_COMMON \
    const void *key; \
    lcb_SIZE nkey; \
    LCB__HKFIELDS /**<@private*/

typedef struct {
    LCB_OBSERVE_FIELDS_COMMON
} lcb_OBSERVECMDv0;

/**@brief lcb_observe() Command structure */
typedef struct {
    LCB_OBSERVE_FIELDS_COMMON
    lcb_observe_options_t options;
} lcb_OBSERVECMDv1;

/**@brief lcb_observe() Command wrapper structure
 * @see lcb_OBSERVECMDv1 */
typedef struct lcb_observe_cmd_st {
    int version;
    union {
        lcb_OBSERVECMDv0 v0;
        lcb_OBSERVECMDv1 v1;
    } v;

    LCB_DEPR_CTORS_OBS
} lcb_observe_cmd_t;

/**
 * @brief Possible statuses for keys in OBSERVE response
 */
typedef enum {
    /** The item found in the memory, but not yet on the disk */
    LCB_OBSERVE_FOUND = 0x00,
    /** The item hit the disk */
    LCB_OBSERVE_PERSISTED = 0x01,
    /** The item missing on the disk and the memory */
    LCB_OBSERVE_NOT_FOUND = 0x80,
    /** No knowledge of the key :) */
    LCB_OBSERVE_LOGICALLY_DELETED = 0x81,

    LCB_OBSERVE_MAX = 0x82
} lcb_observe_t;

/**
 * @brief Response Structure for lcb_observe()
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas; /**< CAS of the item on this server */
    lcb_observe_t status; /**< Status flags */
    int from_master; /**< zero if key came from replica */
    lcb_time_t ttp; /**< average time to persist on this server */
    lcb_time_t ttr; /**< average time to replicate on this server */
} lcb_OBSERVERESPv0;

typedef struct {
    int version;
    union {
        lcb_OBSERVERESPv0 v0;
    } v;
} lcb_observe_resp_t;

/**
 * The callback function for an observe request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation (only key
 *             and nkey is valid if error != LCB_SUCCESS)
 */
typedef void (*lcb_observe_callback)(lcb_t instance,
                                     const void *cookie,
                                     lcb_error_t error,
                                     const lcb_observe_resp_t *resp);

LIBCOUCHBASE_API
lcb_observe_callback lcb_set_observe_callback(lcb_t, lcb_observe_callback);

/**
 * Observe key
 *
 * @code{.c}
 *   lcb_observe_cmd_t *observe = calloc(1, sizeof(*observe));
 *   observe->version = 0;
 *   observe->v.v0.key = "my-key";
 *   observe->v.v0.nkey = strlen(observe->v.v0.key);
 *   lcb_observe_cmd_t* commands[] = { observe };
 *   lcb_observe(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to observe
 * @return_rc
 *
 * The following operation-specific error codes may be returned in the
 * callback:
 *
 * @cb_err ::LCB_UNKNOWN_COMMAND, ::LCB_NOT_SUPPORTED if the cluster does not
 *         support this operation (such as a Couchbase cluster older than
 *         version 2.0, or a memcached bucket).
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_observe(lcb_t instance,
                        const void *command_cookie,
                        lcb_SIZE num,
                        const lcb_observe_cmd_t *const *commands);
/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** REMOVE/DELETE                                                            **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-remove Remove items from the cluster
 * @brief Delete items from the cluster
 * @addtogroup lcb-remove
 * @{
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas;
    LCB__HKFIELDS /**<@private*/
} lcb_REMOVECMDv0;

typedef struct lcb_remove_cmd_st {
    int version;
    union {
        lcb_REMOVECMDv0 v0;
    } v;
    LCB_DEPR_CTORS_RM
} lcb_remove_cmd_t;


typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas;
} lcb_REMOVERESPv0;

typedef struct {
    int version;
    union {
        lcb_REMOVERESPv0 v0;
    } v;
} lcb_remove_resp_t;


/**
 * The callback function for a remove request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation
 */
typedef void (*lcb_remove_callback)(lcb_t instance,
                                    const void *cookie,
                                    lcb_error_t error,
                                    const lcb_remove_resp_t *resp);

LIBCOUCHBASE_API
lcb_remove_callback lcb_set_remove_callback(lcb_t, lcb_remove_callback);

/**
 * Remove a key from the cluster
 *
 * @code{.c}
 *   lcb_remove_cmd_t *remove = calloc(1, sizeof(*remove));
 *   remove->version = 0;
 *   remove->v.v0.key = "my-key";
 *   remove->v.v0.nkey = strlen(remove->v.v0.key);
 *   remove->v.v0.cas = 0x666;
 *   lcb_remove_cmd_t* commands[] = { remove };
 *   lcb_remove(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to remove
 * @return_rc
 *
 * The following operation-specific error codes are returned in the callback
 * @cb_err ::LCB_KEY_ENOENT if the key does not exist
 * @cb_err ::LCB_KEY_EEXISTS if the CAS was specified and it does not match the
 *         CAS on the server
 * @cb_err ::LCB_KEY_EEXISTS if the item was locked and no CAS (or an incorrect
 *         CAS) was specified.
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_remove(lcb_t instance,
                       const void *command_cookie,
                       lcb_SIZE num,
                       const lcb_remove_cmd_t *const *commands);

/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** TOUCH                                                                    **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-touch Modify an item's expiration time
 * @brief Modify an item's expiration time, keeping it alive without modifying
 * it
 * @addtogroup lcb-touch
 * @{
 */
typedef lcb_get_cmd_t lcb_touch_cmd_t;
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas;
} lcb_TOUCHRESPv0;
typedef struct {
    int version;
    union {
        lcb_TOUCHRESPv0 v0;
    } v;
} lcb_touch_resp_t;

/**
 * The callback function for a touch request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation
 * @committed
 */
typedef void (*lcb_touch_callback)(lcb_t instance,
                                   const void *cookie,
                                   lcb_error_t error,
                                   const lcb_touch_resp_t *resp);
/**@committed*/
LIBCOUCHBASE_API
lcb_touch_callback lcb_set_touch_callback(lcb_t, lcb_touch_callback);

/**
 * Touch (set expiration time) on a number of values in the cache.
 *
 * Values larger than 30*24*60*60 seconds (30 days) are
 * interpreted as absolute times (from the epoch). All other
 * members should be set to zero.
 *
 * @par Example
 * @code{.c}
 * lcb_touch_cmd_t touch = { 0 };
 * lcb_touch_cmd_t *cmdlist = { &touch; }
 * touch->v.v0.key = "my-key";
 * touch->v.v0.nkey = strlen(item->v.v0.key);
 * touch->v.v0.exptime = 300; // 5 minutes
 * lcb_touch(instance, NULL, 1, cmdlist);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param cookie A cookie passed to all of the notifications from this command
 * @param num the total number of elements in the commnands array
 * @param commands the array containing the items to touch
 * @return_rc
 *
 * Errors received in callbacks:
 * @cb_err ::LCB_KEY_ENOENT if the item does not exist
 * @cb_err ::LCB_KEY_EEXISTS if the item is locked
 */
LIBCOUCHBASE_API
lcb_error_t lcb_touch(lcb_t instance,
                      const void *cookie,
                      lcb_SIZE num,
                      const lcb_touch_cmd_t *const *commands);
/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** DURABILITY                                                               **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-durability Ensure a key is replicated to a set of nodes
 *
 * The lcb_durability_poll() is used to wait asynchronously until the item
 * have been persisted and/or replicated to at least the number of nodes
 * specified in the durability options.
 *
 * The command is implemented by sending a series of `OBSERVE` broadcasts
 * (see lcb_observe()) to all the nodes in the cluster which are either master
 * or replica for a specific key. It polls repeatedly until either the timeout
 * interval has elapsed or all the items have been persisted and/or replicated
 * to the number of nodes specified in the criteria.
 *
 * Unlike most other API calls which accept only a per-key structure, the
 * lcb_durability_opts_st (lcb_DURABILITYOPTSv0) structure affects the way
 * the command will poll for all keys as a whole:
 *
 * The lcb_DURABILITYOPTSv0::timeout
 * field indicates the upper limit (in microseconds) of time the command will
 * wait until all the keys' durability requirements are satisfied.
 * If the durability requirements ae not satisfied when the timeout is reached,
 * the outstanding keys will be set to an error status in the callback (see
 * lcb_DURABILITYRESPv0::err). If set to 0, it will default to the value of
 * the @ref LCB_CNTL_DURABILITY_TIMEOUT setting.
 *
 * The lcb_DURABILITYOPTSv0::interval field specifies how long to wait between
 * each attempt at verifying the completion of the durability requirements.
 * If not specified, this will be @ref LCB_CNTL_DURABILITY_INTERVAL
 *
 * The lcb_DURABILITYOPTSv0::persist_to field specifies how many nodes must
 * contain the item on their disk in order for the command to succeed.
 * The maximum value should be the number of nodes in the cluster.
 *
 * The lcb_DURABILITYOPTSv0::replicate_to field specifies how many replicas
 * must contain the item in their memory for this command to succeed.
 * The maximum value should be the the number of replicas in the cluster.
 *
 * The lcb_DURABILITYOPTSv0::check_delete flag indicates that this operation
 * should check for the non-presence of an item. This is used to ensure a
 * successful removal of an item via lcb_remove().
 * In this case, the semantics of 'persist_to' and 'replicate_to' are inverted,
 * where 'persist_to' means the number of nodes where the item is deleted
 * from the disk, and 'replicate_to' means the number of nodes where the item not
 * present in the cache.
 *
 * In all cases, the value of 'replicate_to' will implicitly always be
 * at least the value of 'persist_to'-1.
 *
 * The lcb_DURABILITYOPTSv0::cap_max field indicates that the library should
 * set persist_to and replicate_to to their maximum available number if those
 * fields are set beyond current limits. This will be set based on the
 * number of nodes active in the cluster and the number of replicas the cluster
 * is configured with.
 *
 * @addtogroup lcb-durability
 * @{
 */

/** @brief Single-key command structure for lcb_durability_poll() */
typedef struct {
    const void *key;
    size_t nkey;
    LCB__HKFIELDS /**<@private*/

    /**
     * CAS to be checked against. If the key exists on the server
     * with a different CAS, the error (in the response) is set to
     * LCB_KEY_EEXISTS
     */
    lcb_cas_t cas;
} lcb_DURABILITYCMDv0;

/**
 * @brief lcb_durability_poll() Command wrapper
 * @see lcb_DURABILITYCMDv0
 */
typedef struct lcb_durability_cmd_st {
    int version;
    union {
        lcb_DURABILITYCMDv0 v0;
    } v;
} lcb_durability_cmd_t;

/** @brief Options for lcb_durability_poll() */
typedef struct {
    /**
     * Upper limit in microseconds from the scheduling of the command. When
     * this timeout occurs, all remaining non-verified keys will have their
     * callbacks invoked with @c LCB_ETIMEDOUT
     */
    lcb_U32 timeout;

    /**
     * The durability check may involve more than a single call to observe - or
     * more than a single packet sent to a server to check the key status. This
     * value determines the time to wait (in microseconds)
     * between multiple probes for the same server.
     * If left at 0, the @ref LCB_CNTL_DURABILITY_INTERVAL will be used
     * instead.
     */
    lcb_U32 interval;

    /** how many nodes the key should be persisted to (including master) */
    lcb_U16 persist_to;

    /** how many nodes the key should be replicated to (excluding master) */
    lcb_U16 replicate_to;

    /**
     * this flag inverts the sense of the durability check and ensures that
     * the key does *not* exist
     */
    lcb_U8 check_delete;

    /**
     * If replication/persistence requirements are excessive, cap to
     * the maximum available
     */
    lcb_U8 cap_max;
} lcb_DURABILITYOPTSv0;

/**@brief Options for lcb_durability_poll() (wrapper)
 * @see lcb_DURABILITYOPTSv0 */
typedef struct lcb_durability_opts_st {
    int version;
    union {
        lcb_DURABILITYOPTSv0 v0;
    } v;
} lcb_durability_opts_t;

/** @brief Response structure for lcb_durability_poll() */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    /**
     * if this entry failed, this contains the reason, e.g.
     *
     * - `LCB_KEY_EEXISTS`: The key exists with a different CAS than expected
     * - `LCB_KEY_ENOENT`: The key was not found in the master cache
     * - `LCB_ETIMEDOUT`: The key may exist, but the required servers needed
     *    took too long to respond
     */
    lcb_error_t err;

    /** if found with a different CAS, this is the CAS */
    lcb_cas_t cas;

    /**
     * Whether the key was persisted to the master.
     * For deletes, this means the key was removed from disk
     */
    unsigned char persisted_master;

    /**
     * Whether the key exists on the master. For deletes, this means
     * the key does not exist in cache
     */
    unsigned char exists_master;

    /** how many nodes (including master) this item was persisted to */
    unsigned char npersisted;

    /** how many nodes (excluding master) this item was replicated to */
    unsigned char nreplicated;

    /**
     * Total number of observe responses received for the node.
     * This can be used as a performance metric to determine how many
     * total OBSERVE probes were sent until this key was 'done'
     */
    unsigned short nresponses;
} lcb_DURABILITYRESPv0;

typedef struct lcb_durability_resp_st {
    int version;
    union {
        lcb_DURABILITYRESPv0 v0;
    } v;
} lcb_durability_resp_t;

/**
 * Schedule a durability check on a set of keys. This callback wraps (somewhat)
 * the lower-level OBSERVE (lcb_observe) operations so that users may check if
 * a key is endured, e.g. if a key is persisted accross "at least" n number of
 * servers
 *
 * When each key has its criteria satisfied, the durability callback (see above)
 * is invoked for it.
 *
 * The callback may also be invoked when a condition is encountered that will
 * prevent the key from ever satisfying the criteria.
 *
 * @param instance the lcb handle
 * @param cookie a pointer to be received with each callback
 * @param options a set of options and criteria for this durability check
 * @param cmds a list of key specifications to check for
 * @param ncmds how many key specifications reside in the list
 * @return ::LCB_SUCCESS if scheduled successfuly
 * @return ::LCB_DURABILITY_ETOOMANY if the criteria specified exceeds the
 *         current satisfiable limit (e.g. `persist_to` was set to 4, but
 *         there are only 2 servers online in the cluster) and `cap_max`
 *         was not specified.
 * @return ::LCB_DUPLICATE_COMMANDS if the same key was found more than once
 *         in the command list
 *
 * The following error codes may be returned in the callback
 * @cb_err ::LCB_ETIMEDOUT if the specified interval expired before the client
 *         could verify the durability requirements were satisfied. See
 *         @ref LCB_CNTL_DURABILITY_TIMEOUT and lcb_DURABILITYOPTSv0::timeout
 *         for more information on how to increase this interval.
 *
 * Example (after receiving a store callback)
 * @code{.c}
 *
 * lcb_durability_cmd_t cmd, cmds[1];
 * lcb_durability_opts_t opts;
 * lcb_error_t err;
 *
 * memset(&opts, 0, sizeof(opts);
 * memset(&cmd, 0, sizeof(cmd);
 * cmds[0] = &cmd;
 *
 *
 * opts.persist_to = 2;
 * opts.replicate_to = 1;
 *
 * cmd.v.v0.key = resp->v.v0.key;
 * cmd.v.v0.nkey = resp->v.v0.nkey;
 * cmd.v.v0.cas = resp->v.v0.cas;
 *
 * //schedule the command --
 * err = lcb_durability_poll(instance, cookie, &opts, &cmds, 1);
 * // error checking omitted --
 *
 * // later on, in the callback. resp is now a durability_resp_t* --
 * if (resp->v.v0.err == LCB_SUCCESS) {
 *      printf("Key was endured!\n");
 * } else {
 *      printf("Key did not endure in time\n");
 *      printf("Replicated to: %u replica nodes\n", resp->v.v0.nreplicated);
 *      printf("Persisted to: %u total nodes\n", resp->v.v0.npersisted);
 *      printf("Did we persist to master? %u\n",
 *          resp->v.v0.persisted_master);
 *      printf("Does the key exist in the master's cache? %u\n",
 *          resp->v.v0.exists_master);
 *
 *      switch (resp->v.v0.err) {
 *
 *      case LCB_KEY_EEXISTS:
 *          printf("Seems like someone modified the key already...\n");
 *          break;
 *
 *      case LCB_ETIMEDOUT:
 *          printf("Either key does not exist, or the servers are too slow\n");
 *          printf("If persisted_master or exists_master is true, then the"
 *              "server is simply slow.",
 *              "otherwise, the key does not exist\n");
 *
 *          break;
 *
 *      default:
 *          printf("Got other error. This is probably a network error\n");
 *          break;
 *      }
 *  }
 * @endcode
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_durability_poll(lcb_t instance,
                                const void *cookie,
                                const lcb_durability_opts_t *options,
                                lcb_SIZE ncmds,
                                const lcb_durability_cmd_t *const *cmds);

/**
 * Callback for durability status. The callback is invoked on completion
 * of each key (i.e. only one callback is invoked per-key).
 *
 * @param lcb_t the instance
 * @param cookie the user cookie
 * @param err an error
 * @param res a response containing information about the key.
 */
typedef void (*lcb_durability_callback)(lcb_t instance,
                                        const void *cookie,
                                        lcb_error_t err,
                                        const lcb_durability_resp_t *res);

LIBCOUCHBASE_API
lcb_durability_callback lcb_set_durability_callback(lcb_t,
                                                    lcb_durability_callback);
/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** STATS                                                                    **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/**
 * @ingroup lcb-public-api
 * @defgroup lcb-stats Retrieve statistics from the cluster
 * @addtogroup lcb-stats
 * @{
 */
typedef struct {
    const void *name; /**< The name of the stats group to get */
    lcb_SIZE nname; /**< The number of bytes in name */
} lcb_STATSCMDv0;

typedef struct lcb_server_stats_cmd_st {
    int version;
    union { lcb_STATSCMDv0 v0; } v;
    LCB_DEPR_CTORS_STATS
} lcb_server_stats_cmd_t;

/**
 * @brief Per-server, per-stat response structure for lcb_server_stats()
 *
 * This structure is returned for each statistic requested by lcb_server_stats().
 * As both the number of servers replying to this function as well as the number
 * of stats per server is variable, the application should pay attention to the
 * following semantics:
 *
 * 1. A new statistic item is delivered with the `server_endpoint` and `key`
 *    being non-`NULL`
 * 2. If a specific server encounters an error, the `key` and `bytes` fields
 *    will be NULL.
 * 3. Once no more replies remain from any of the servers, a final callback
 *    will be delivered with the `server_endpoint` field set to `NULL`.
 *
 * It is recommended to index statistics twice; first based on the
 * `server_endpoint` field and then on the `key` field. It is likely that the
 * same `key` will be received multiple times for different `server_endpoints`.
 */
typedef struct {
    const char *server_endpoint; /**< Server which the statistic is from */
    const void *key; /**< Statistic name */
    lcb_SIZE nkey;
    const void *bytes; /**< Statistic value */
    lcb_SIZE nbytes;
} lcb_STATSRESPv0;

/** @brief Wrapper structure for lcb_STATSRESPv0 */
typedef struct lcb_server_stat_resp_st {
    int version;
    union {
        lcb_STATSRESPv0 v0;
    } v;
} lcb_server_stat_resp_t;

/**
 * The callback function for a stat request
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp response data
 */
typedef void (*lcb_stat_callback)(lcb_t instance,
                                  const void *cookie,
                                  lcb_error_t error,
                                  const lcb_server_stat_resp_t *resp);
LIBCOUCHBASE_API
lcb_stat_callback lcb_set_stat_callback(lcb_t, lcb_stat_callback);

/**
 * Request server statistics. Without a key specified the server will
 * respond with a "default" set of statistics information. Each piece of
 * statistical information is returned in its own packet (key contains
 * the name of the statistical item and the body contains the value in
 * ASCII format). The sequence of return packets is terminated with a
 * packet that contains no key and no value.
 *
 * The command will signal about transfer completion by passing NULL as
 * the server endpoint and 0 for key length. Note that key length will
 * be zero when some server responds with error. In latter case server
 * endpoint argument will indicate the server address.
 *
 * @code{.c}
 *   lcb_server_stats_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   cmd->v.v0.name = "tap";
 *   cmd->v.v0.nname = strlen(cmd->v.v0.nname);
 *   lcb_server_stats_cmd_t* commands[] = { cmd };
 *   lcb_server_stats(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie a cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the statistic to get
 * @return_rc
 *
 * The following callbacks may be returned in the callback
 * @cb_err ::LCB_KEY_ENOENT if key passed is unrecognized
 *
 * @todo Enumerate some useful stats here
 */
LIBCOUCHBASE_API
lcb_error_t lcb_server_stats(lcb_t instance,
                             const void *command_cookie,
                             lcb_SIZE num,
                             const lcb_server_stats_cmd_t *const *commands);

/**@}*/

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-memcached-misc Miscellaneous memcached commands
 * @addtogroup lcb-memcached-misc
 * @{
 */

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** MEMCACHED VERSION (LEGACY)                                               **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
typedef struct lcb_server_version_cmd_st {
    int version;
    union { struct { const void *notused; } v0; } v;
    LCB_DEPR_CTORS_VERSIONS
} lcb_server_version_cmd_t;

/**
 * @brief Response structure for lcb_server_versions()
 */
typedef struct lcb_server_version_resp_st {
    int version;
    union {
        struct {
            const char *server_endpoint;
            const char *vstring;
            lcb_SIZE nvstring;
        } v0;
    } v;
} lcb_server_version_resp_t;

/**
 * Request server versions. The callback will be invoked with the
 * instance, server address, version string, and version string length.
 *
 * When all server versions have been received, the callback is invoked
 * with the server endpoint argument set to NULL
 *
 * @code{.c}
 *   lcb_server_version_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   lcb_server_version_cmd_t* commands[] = { cmd };
 *   lcb_server_versions(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie a cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the version commands
 * @return The status of the operation
 *
 * @attention
 * The name of this function may be slightly misleading. This does **not**
 * retrieve the Couchbase Server version, but only the version of its _memcached_
 * component. See lcb_server_stats() for a way to retrieve the server version
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_server_versions(lcb_t instance,
                                const void *command_cookie,
                                lcb_SIZE num,
                                const lcb_server_version_cmd_t *const *commands);

/**
 * The callback function for a version request
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp response data
 */
typedef void (*lcb_version_callback)(lcb_t instance,
                                     const void *cookie,
                                     lcb_error_t error,
                                     const lcb_server_version_resp_t *resp);

LIBCOUCHBASE_API
lcb_version_callback lcb_set_version_callback(lcb_t, lcb_version_callback);


/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** MEMCACHED VERBOSITY                                                      **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/** @brief `level` field for lcb_set_verbosity() */
typedef enum {
    /**This is the most verbose level and generates a lot of output on the
     * server. Using this level will impact the cluster's performance */
    LCB_VERBOSITY_DETAIL = 0x00,

    /**This level generates a lot of output. Using this level will impact the
     * cluster's performance */
    LCB_VERBOSITY_DEBUG = 0x01,

    /**This level traces all commands and generates a fair amount of output.
     * Depend on the workload it may slow down the system a little bit */
    LCB_VERBOSITY_INFO = 0x02,

    /**This is the default level and only errors and warnings will be logged*/
    LCB_VERBOSITY_WARNING = 0x03
} lcb_verbosity_level_t;

typedef struct {
    const char *server;
    lcb_verbosity_level_t level;
} lcb_VERBOSITYCMDv0;

typedef struct lcb_verbosity_cmd_st {
    int version;
    union {
        lcb_VERBOSITYCMDv0 v0;
    } v;
    LCB_DEPR_CTORS_VERBOSITY
} lcb_verbosity_cmd_t;

typedef struct lcb_verbosity_resp_st {
    int version;
    union {
        struct {
            const char *server_endpoint;
        } v0;
    } v;
} lcb_verbosity_resp_t;

/**
 * Set the loglevel on the servers
 *
 * @code{.c}
 *   lcb_verbosity_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   cmd->v.v0.level = LCB_VERBOSITY_WARNING;
 *   lcb_verbosity_cmd_t* commands[] = { cmd };
 *   lcb_set_verbosity(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the verbosity commands
 * @return The status of the operation.
 */
LIBCOUCHBASE_API
lcb_error_t lcb_set_verbosity(lcb_t instance,
                              const void *command_cookie,
                              lcb_SIZE num,
                              const lcb_verbosity_cmd_t *const *commands);

/**
 * The callback function for a verbosity command
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp response data
 */
typedef void (*lcb_verbosity_callback)(lcb_t instance,
                                       const void *cookie,
                                       lcb_error_t error,
                                       const lcb_verbosity_resp_t *resp);

LIBCOUCHBASE_API
lcb_verbosity_callback lcb_set_verbosity_callback(lcb_t,
                                                  lcb_verbosity_callback);

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** MEMCACHED FLUSH                                                          **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
typedef struct lcb_flush_cmd_st {
    int version;
    union { struct { int unused; } v0; } v;
    LCB_DEPR_CTORS_FLUSH
} lcb_flush_cmd_t;

typedef struct lcb_flush_resp_st {
    int version;
    union {
        struct {
            const char *server_endpoint;
        } v0;
    } v;
} lcb_flush_resp_t;

/**
 * Flush the entire couchbase cluster!
 *
 * @warning
 * From Couchbase Server 2.0 and higher, this command will only work on
 * _memcached_ buckets. To flush a Couchbase bucket, use the HTTP REST
 * API (See: http://docs.couchbase.com/admin/admin/REST/rest-bucket-flush.html)
 *
 * @code{.c}
 *   lcb_flush_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   lcb_flush_cmd_t* commands[] = { cmd };
 *   lcb_flush(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param cookie A cookie passed to all of the notifications from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the flush commands
 * @return_rc
 *
 * The following error codes may be returned in the callback
 * @cb_err ::LCB_NOT_SUPPORTED if trying to flush a Couchbase bucket.
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_flush(lcb_t instance, const void *cookie,
                      lcb_SIZE num,
                      const lcb_flush_cmd_t *const *commands);

/**
 * The callback function for a flush request
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp Response data
 */
typedef void (*lcb_flush_callback)(lcb_t instance,
                                   const void *cookie,
                                   lcb_error_t error,
                                   const lcb_flush_resp_t *resp);
LIBCOUCHBASE_API
lcb_flush_callback lcb_set_flush_callback(lcb_t, lcb_flush_callback);

/**@}*/

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** HTTP                                                                     **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/
/**
 * @ingroup lcb-public-api
 *
 * @defgroup lcb-http HTTP Operations
 * @brief Schedule HTTP requests to the server. This includes management
 * and view requests
 * @addtogroup lcb-http
 * @{
 */

/**
 * @brief The type of HTTP request to execute
 */
typedef enum {
    /**
     * Execute a request against the bucket. The handle must be of
     * @ref LCB_TYPE_BUCKET and must be connected.
     */
    LCB_HTTP_TYPE_VIEW = 0,

    /**
     * Execute a management API request. The credentials used will match
     * those passed during the instance creation time. Thus is the instance
     * type is @ref LCB_TYPE_BUCKET then only bucket-level credentials will
     * be used.
     */
    LCB_HTTP_TYPE_MANAGEMENT = 1,

    /**
     * Execute an arbitrary request against a host and port
     */
    LCB_HTTP_TYPE_RAW = 2,

    /** Execute an N1QL Query */
    LCB_HTTP_TYPE_N1QL = 3,

    LCB_HTTP_TYPE_MAX
} lcb_http_type_t;

/**
 * @brief HTTP Request method enumeration
 * These just enumerate the various types of HTTP request methods supported.
 * Refer to the specific cluster or view API to see which method is appropriate
 * for your request
 */
typedef enum {
    LCB_HTTP_METHOD_GET = 0,
    LCB_HTTP_METHOD_POST = 1,
    LCB_HTTP_METHOD_PUT = 2,
    LCB_HTTP_METHOD_DELETE = 3,
    LCB_HTTP_METHOD_MAX = 4
} lcb_http_method_t;

/**
 * @brief Structure for lcb_make_http_request()
 */
typedef struct {
    /** A view path string with optional query params (e.g. skip, limit etc.) */
    const char *path;
    lcb_SIZE npath; /**< Length of the path. Mandatory */
    const void *body; /**< The POST body for HTTP request */
    lcb_SIZE nbody; /**< Length of the body. Mandatory if `body != NULL`*/
    lcb_http_method_t method;
    /**If true the client will use lcb_http_data_callback to
     * notify about response and will call lcb_http_complete
     * with empty data eventually. */
    int chunked;
    /** The `Content-Type` header for request. For view requests
     * it is usually `application/json`, for management --
     * `application/x-www-form-urlencoded`. */
    const char *content_type;
} lcb_HTTPCMDv0;

/**
 * v1 is used by the raw http requests. It is exactly the
 * same layout as v0, but it contains an extra field;
 * the hostname & port to use....
 */
typedef struct {
    const char *path; /**< @see lcb_HTTPCMDv0::path */
    lcb_SIZE npath;
    const void *body; /**< @see lcb_HTTPCMDv0::body */
    lcb_SIZE nbody;
    lcb_http_method_t method;
    int chunked;
    const char *content_type;
    const char *host;
    const char *username;
    const char *password;
} lcb_HTTPCMDv1;

/**@brief Wrapper structure for lcb_make_http_request
 * @see lcb_HTTPCMDv0
 * @see lcb_HTTPCMDv1
 */
typedef struct lcb_http_cmd_st {
    int version;
    union {
        lcb_HTTPCMDv0 v0;
        lcb_HTTPCMDv1 v1;
    } v;
    LCB_DEPR_CTORS_HTTP
} lcb_http_cmd_t;

/**
 * @brief Response structure received for HTTP requests
 *
 * The `headers` field is a list of key-value headers for HTTP, so it may
 * be traversed like so:
 *
 * @code{.c}
 * const char ** cur = resp->headers;
 * for (; *cur; cur+=2) {
 *   printf("Header: %s:%s\n", cur[0], cur[1]);
 * }
 * @endcode
 */
typedef struct {
    lcb_http_status_t status; /**< HTTP status code */
    const char *path; /**< Path used for request */
    lcb_SIZE npath;
    const char *const *headers; /**< List of headers */
    const void *bytes; /**< Body (if any) */
    lcb_SIZE nbytes;
} lcb_HTTPRESPv0;

typedef struct {
    int version;
    union {
        lcb_HTTPRESPv0 v0;
    } v;
} lcb_http_resp_t;

/**
 * Callback invoked for HTTP requests
 * @param request Original request handle
 * @param instance The instance on which the request was issued
 * @param cookie Cookie associated with the request
 * @param error Error code for request. Note that more information may likely
 * be found within the response structure itself, specifically the
 * lcb_HTTPRESPv0::status and lcb_HTTPRESPv0::bytes field
 *
 * @param resp The response structure
 */
typedef void (*lcb_http_res_callback)(
        lcb_http_request_t request, lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_http_resp_t *resp);

typedef lcb_http_res_callback lcb_http_data_callback;
typedef lcb_http_res_callback lcb_http_complete_callback;

/**
 * @brief Set the HTTP completion callback for HTTP request completion
 *
 * This callback will be
 * invoked once when the response is complete. If the lcb_HTTPCMDv0::chunked
 * flag was set, the lcb_HTTRESPv0::bytes will be `NULL`, otherwise it will
 * contain the fully buffered response.
 */
LIBCOUCHBASE_API
lcb_http_complete_callback
lcb_set_http_complete_callback(lcb_t, lcb_http_complete_callback);

/**
 * @brief Set the HTTP data stream callback for streaming responses
 *
 * This callback is invoked only if the lcb_HTTPCMDv0::chunked flag is true.
 * The lcb_HTTRESPv0::bytes field will on each invocation contain a new
 * fragment of data which should be processed by the client. When the request
 * is complete, the the callback specified by lcb_set_http_complete_callback()
 * will be invoked with the lcb_HTTPRESPv0::bytes field set to `NULL`
 */
LIBCOUCHBASE_API
lcb_http_data_callback
lcb_set_http_data_callback(lcb_t, lcb_http_data_callback);

/**
 * Execute HTTP request matching given path and yield JSON result object.
 * Depending on type it could be:
 *
 * - LCB_HTTP_TYPE_VIEW
 *
 *   The client should setup view_complete callback in order to fetch
 *   the result. Also he can setup view_data callback to fetch response
 *   body in chunks as soon as possible, it will be called each time the
 *   library receive a data chunk from socket. The empty <tt>bytes</tt>
 *   argument (NULL pointer and zero size) is the sign of end of
 *   response. Chunked callback allows to save memory on large datasets.
 *
 * - LCB_HTTP_TYPE_MANAGEMENT
 *
 *   Management requests allow you to configure the cluster, add/remove
 *   buckets, rebalance etc. The result will be passed to management
 *   callbacks (data/complete).
 *
 * Fetch first 10 docs from `_design/test/_view/all` view
 * @code{.c}
 *   lcb_http_request_t req;
 *   lcb_http_cmd_t *cmd = calloc(1, sizeof(lcb_http_cmd_t));
 *   cmd->version = 0;
 *   cmd->v.v0.path = "_design/test/_view/all?limit=10";
 *   cmd->v.v0.npath = strlen(item->v.v0.path);
 *   cmd->v.v0.body = NULL;
 *   cmd->v.v0.nbody = 0;
 *   cmd->v.v0.method = LCB_HTTP_METHOD_GET;
 *   cmd->v.v0.chunked = 1;
 *   cmd->v.v0.content_type = "application/json";
 *   lcb_error_t err = lcb_make_http_request(instance, NULL,
 *                         LCB_HTTP_TYPE_VIEW, &cmd, &req);
 *   if (err != LCB_SUCCESS) {
 *     .. failed to schedule request ..
 * @endcode
 *
 * The same as above but with POST filter
 * @code{.c}
 *   lcb_http_request_t req;
 *   lcb_http_cmd_t *cmd = calloc(1, sizeof(lcb_http_cmd_t));
 *   cmd->version = 0;
 *   cmd->v.v0.path = "_design/test/_view/all?limit=10";
 *   cmd->v.v0.npath = strlen(item->v.v0.path);
 *   cmd->v.v0.body = "{\"keys\": [\"test_1000\", \"test_10002\"]}"
 *   cmd->v.v0.nbody = strlen(item->v.v0.body);
 *   cmd->v.v0.method = LCB_HTTP_METHOD_POST;
 *   cmd->v.v0.chunked = 1;
 *   cmd->v.v0.content_type = "application/json";
 *   lcb_error_t err = lcb_make_http_request(instance, NULL,
 *                         LCB_HTTP_TYPE_VIEW, &cmd, &req);
 *   if (err != LCB_SUCCESS) {
 *     .. failed to schedule request ..
 * @endcode
 *
 * @code{.c} Delete bucket via REST management API
 *   lcb_http_request_t req;
 *   lcb_http_cmd_t cmd;
 *   cmd->version = 0;
 *   cmd.v.v0.path = query.c_str();
 *   cmd.v.v0.npath = query.length();
 *   cmd.v.v0.body = NULL;
 *   cmd.v.v0.nbody = 0;
 *   cmd.v.v0.method = LCB_HTTP_METHOD_DELETE;
 *   cmd.v.v0.chunked = false;
 *   cmd.v.v0.content_type = "application/x-www-form-urlencoded";
 *   lcb_error_t err = lcb_make_http_request(instance, NULL,
 *                         LCB_HTTP_TYPE_MANAGEMENT, &cmd, &req);
 *   if (err != LCB_SUCCESS) {
 *     .. failed to schedule request ..
 * @endcode
 *
 * @param instance The handle to lcb
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param type The type of the request needed.
 * @param cmd The struct describing the command options
 * @param request Where to store request handle
 *
 * @return_rc
 *
 * The following errors may be received in the callback. Note that ::LCB_SUCCESS
 * will be delivered the callback so long as the operation received a full
 * HTTP response. You should inspect the individual HTTP status code to determine
 * if the actual HTTP request succeeded or not.
 *
 * @cb_err ::LCB_TOO_MANY_REDIRECTS if the request was redirected too many times.
 * @cb_err ::LCB_PROTOCOL_ERROR if the endpoint did not send back a well formed
 *         HTTP response
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_make_http_request(lcb_t instance,
                                  const void *command_cookie,
                                  lcb_http_type_t type,
                                  const lcb_http_cmd_t *cmd,
                                  lcb_http_request_t *request);

/**
 * @brief Cancel ongoing HTTP request
 *
 * This API will stop the current request. Any pending callbacks will not be
 * invoked any any pending data will not be delivered. Useful for a long running
 * request which is no longer needed
 *
 * @param instance The handle to lcb
 * @param request The request handle
 * @committed
 */
LIBCOUCHBASE_API
void lcb_cancel_http_request(lcb_t instance,
                             lcb_http_request_t request);
/**@}*/

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-instance-status Retrieve status information from an lcb_t
 * @brief These functions return status information about the handle, the current
 * connection, and the number of nodes found within the cluster.
 *
 * @see lcb_cntl() for more functions to retrieve status info
 *
 * @addtogroup lcb-instance-status
 * @{
 */

/**@name Information about Nodes
 * @{*/

/**@brief
 * Type of node to retrieve for the lcb_get_node() function
 */
typedef enum {
    /** Get an HTTP configuration (Rest API) node */
    LCB_NODE_HTCONFIG = 0x01,
    /** Get a data (memcached) node */
    LCB_NODE_DATA = 0x02,
    /** Get a view (CAPI) node */
    LCB_NODE_VIEWS = 0x04,
    /** Only return a node which is connected, or a node which is known to be up */
    LCB_NODE_CONNECTED = 0x08,

    /** Specifying this flag adds additional semantics which instruct the library
     * to search additional resources to return a host, and finally,
     * if no host can be found, return the string
     * constant @ref LCB_GETNODE_UNAVAILABLE. */
    LCB_NODE_NEVERNULL = 0x10,

    /** Equivalent to `LCB_NODE_HTCONFIG|LCB_NODE_CONNECTED` */
    LCB_NODE_HTCONFIG_CONNECTED = 0x09,

    /**Equivalent to `LCB_NODE_HTCONFIG|LCB_NODE_NEVERNULL`.
     * When this is passed, some additional attempts may be made by the library
     * to return any kind of host, including searching the initial list of hosts
     * passed to the lcb_create() function. */
    LCB_NODE_HTCONFIG_ANY = 0x11
} lcb_GETNODETYPE;

/** String constant returned by lcb_get_node() when the @ref LCB_NODE_NEVERNULL
 * flag is specified, and no node can be returned */
#define LCB_GETNODE_UNAVAILABLE "invalid_host:0"

/**
 * @brief Return a string of `host:port` for a node of the given type.
 *
 * @param instance the instance from which to retrieve the node
 * @param type the type of node to return
 * @param index the node number if index is out of bounds it will be wrapped
 * around, thus there is never an invalid value for this parameter
 *
 * @return a string in the form of `host:port`. If LCB_NODE_NEVERNULL was specified
 * as an option in `type` then the string constant LCB_GETNODE_UNAVAILABLE is
 * returned. Otherwise `NULL` is returned if the type is unrecognized or the
 * LCB_NODE_CONNECTED option was specified and no connected node could be found
 * or a memory allocation failed.
 *
 * @note The index parameter is _ignored_ if `type` is
 * LCB_NODE_HTCONFIG|LCB_NODE_CONNECTED as there will always be only a single
 * HTTP bootstrap node.
 *
 * @code{.c}
 * const char *viewnode = lcb_get_node(instance, LCB_NODE_VIEWS, 0);
 * // Get the connected REST endpoint:
 * const char *restnode = lcb_get_node(instance, LCB_NODE_HTCONFIG|LCB_NODE_CONNECTED, 0);
 * if (!restnode) {
 *   printf("Instance not connected via HTTP!\n");
 * }
 * @endcode
 *
 * Iterate over all the data nodes:
 * @code{.c}
 * unsigned ii;
 * for (ii = 0; ii < lcb_get_num_servers(instance); ii++) {
 *   const char *kvnode = lcb_get_node(instance, LCB_NODE_DATA, ii);
 *   if (kvnode) {
 *     printf("KV node %s exists at index %u\n", kvnode, ii);
 *   } else {
 *     printf("No node for index %u\n", ii);
 *   }
 * }
 * @endcode
 *
 * @committed
 */
LIBCOUCHBASE_API
const char *
lcb_get_node(lcb_t instance, lcb_GETNODETYPE type, unsigned index);

/**
 * @brief Get the number of the replicas in the cluster
 *
 * @param instance The handle to lcb
 * @return -1 if the cluster wasn't configured yet, and number of replicas
 * otherwise. This may be `0` if there are no replicas.
 * @committed
 */
LIBCOUCHBASE_API
lcb_S32 lcb_get_num_replicas(lcb_t instance);

/**
 * @brief Get the number of the nodes in the cluster
 * @param instance The handle to lcb
 * @return -1 if the cluster wasn't configured yet, and number of nodes otherwise.
 * @committed
 */
LIBCOUCHBASE_API
lcb_S32 lcb_get_num_nodes(lcb_t instance);


/**
 * @brief Get a list of nodes in the cluster
 *
 * @return a NULL-terminated list of 0-terminated strings consisting of
 * node hostnames:admin_ports for the entire cluster.
 * The storage duration of this list is only valid until the
 * next call to a libcouchbase function and/or when returning control to
 * libcouchbase' event loop.
 *
 * @code{.c}
 * const char * const * curp = lcb_get_server_list(instance);
 * for (; *curp; curp++) {
 *   printf("Have node %s\n", *curp);
 * }
 * @endcode
 * @committed
 */
LIBCOUCHBASE_API
const char *const *lcb_get_server_list(lcb_t instance);

/**@}*/

/**
 * @brief Check if instance is blocked in the event loop
 * @param instance the instance to run the event loop for.
 * @return non-zero if nobody is waiting for IO interaction
 * @uncomitted
 */
LIBCOUCHBASE_API
int lcb_is_waiting(lcb_t instance);


/**@name Modifying Settings
 * The lcb_cntl() function and its various helpers are the means by which to
 * modify settings within the library
 * @{
 */

/**
 * This function exposes an ioctl/fcntl-like interface to read and write
 * various configuration properties to and from an lcb_t handle.
 *
 * @param instance The instance to modify
 *
 * @param mode One of LCB_CNTL_GET (to retrieve a setting) or LCB_CNTL_SET
 *      (to modify a setting). Note that not all configuration properties
 *      support SET.
 *
 * @param cmd The specific command/property to modify. This is one of the
 *      LCB_CNTL_* constants defined in this file. Note that it is safe
 *      (and even recommanded) to use the raw numeric value (i.e.
 *      to be backwards and forwards compatible with libcouchbase
 *      versions), as they are not subject to change.
 *
 *      Using the actual value may be useful in ensuring your application
 *      will still compile with an older libcouchbase version (though
 *      you may get a runtime error (see return) if the command is not
 *      supported
 *
 * @param arg The argument passed to the configuration handler.
 *      The actual type of this pointer is dependent on the
 *      command in question.  Typically for GET operations, the
 *      value of 'arg' is set to the current configuration value;
 *      and for SET operations, the current configuration is
 *      updated with the contents of *arg.
 *
 * @return ::LCB_NOT_SUPPORTED if the code is unrecognized
 * @return ::LCB_EINVAL if there was a problem with the argument
 *         (typically for LCB_CNTL_SET) other error codes depending on the command.
 *
 * The following error codes are returned if the ::LCB_CNTL_DETAILED_ERRCODES
 * are enabled.
 *
 * @return ::LCB_ECTL_UNKNOWN if the code is unrecognized
 * @return ::LCB_ECTL_UNSUPPMODE An invalid _mode_ was passed
 * @return ::LCB_ECTL_BADARG if the value was invalid
 *
 * @committed
 *
 * @see lcb_cntl_setu32()
 * @see lcb_cntl_string()
 */
LIBCOUCHBASE_API
lcb_error_t lcb_cntl(lcb_t instance, int mode, int cmd, void *arg);

/**
 * Alternate way to set configuration settings by passing a string key
 * and value. This may be used to provide a simple interface from a command
 * line or higher level language to allow the setting of specific key-value
 * pairs.
 *
 * The format for the value is dependent on the option passed, the following
 * value types exist:
 *
 * - **Timeout**. A _timeout_ value can either be specified as fractional
 *   seconds (`"1.5"` for 1.5 seconds), or in microseconds (`"1500000"`).
 * - **Number**. This is any valid numerical value. This may be signed or
 *   unsigned depending on the setting.
 * - **Boolean**. This specifies a boolean. A true value is either a positive
 *   numeric value (i.e. `"1"`) or the string `"true"`. A false value
 *   is a zero (i.e. `"0"`) or the string `"false"`.
 * - **Float**. This is like a _Number_, but also allows fractional specification,
 *   e.g. `"2.4"`.
 *
 * | Code | Name | Type
 * |------|------|-----
 * |@ref LCB_CNTL_OP_TIMEOUT                | `"operation_timeout"` | Timeout |
 * |@ref LCB_CNTL_VIEW_TIMEOUT              | `"view_timeout"`      | Timeout |
 * |@ref LCB_CNTL_DURABILITY_TIMEOUT        | `"durability_timeout"` | Timeout |
 * |@ref LCB_CNTL_DURABILITY_INTERVAL       | `"durability_interval"`| Timeout |
 * |@ref LCB_CNTL_HTTP_TIMEOUT              | `"http_timeout"`      | Timeout |
 * |@ref LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS | `"randomize_nodes"`   | Boolean|
 * |@ref LCB_CNTL_CONFERRTHRESH             | `"error_thresh_count"`| Number (Positive)|
 * |@ref LCB_CNTL_CONFDELAY_THRESH          |`"error_thresh_delay"` | Timeout |
 * |@ref LCB_CNTL_CONFIGURATION_TIMEOUT     | `"config_total_timeout"`|Timeout|
 * |@ref LCB_CNTL_CONFIG_NODE_TIMEOUT       | `"config_node_timeout"` | Timeout |
 * |@ref LCB_CNTL_CONFIGCACHE               | `"config_cache"`      | Path |
 * |@ref LCB_CNTL_DETAILED_ERRCODES         | `"detailed_errcodes"` | Boolean |
 * |@ref LCB_CNTL_HTCONFIG_URLTYPE          | `"http_urlmode"`      | Number (values are the constant values) |
 * |@ref LCB_CNTL_RETRY_BACKOFF             | `"retry_backoff"`     | Float |
 * |@ref LCB_CNTL_HTTP_POOLSIZE             | `"http_poolsize"`     | Number |
 * |@ref LCB_CNTL_VBGUESS_PERSIST           | `"vbguess_persist"`   | Boolean |
 *
 *
 * @committed - Note, the actual API call is considered committed and will
 * not disappear, however the existence of the various string settings are
 * dependendent on the actual settings they map to. It is recommended that
 * applications use the numerical lcb_cntl() as the string names are
 * subject to change.
 *
 * @see lcb_cntl()
 * @see lcb-cntl-settings
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_cntl_string(lcb_t instance, const char *key, const char *value);

/**
* @brief Convenience function to set a value as an lcb_U32
* @param instance
* @param cmd setting to modify
* @param arg the new value
* @return see lcb_cntl() for details
* @committed
*/
LIBCOUCHBASE_API
lcb_error_t lcb_cntl_setu32(lcb_t instance, int cmd, lcb_U32 arg);

/**
* @brief Retrieve an lcb_U32 setting
* @param instance
* @param cmd setting to retrieve
* @return the value.
* @warning This function does not return an error code. Ensure that the cntl is
* correct for this version, or use lcb_cntl() directly.
* @committed
*/
LIBCOUCHBASE_API
lcb_U32 lcb_cntl_getu32(lcb_t instance, int cmd);

/**
 * Determine if a specific control code exists
 * @param ctl the code to check for
 * @return 0 if it does not exist, nonzero if it exists.
 */
LIBCOUCHBASE_API
int
lcb_cntl_exists(int ctl);
/**@}*/ /* settings */
/**@}*/ /* lcbt_info */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-timings Instrument and inspect times for operations
 * @brief Determine how long operations are taking to be completed
 *
 * libcouchbase provides a simple form of per-command timings you may use
 * to figure out the current lantency for the request-response cycle as
 * generated by your application. Please note that these numbers are not
 * necessarily accurate as you may affect the timing recorded by doing
 * work in the event loop.
 *
 * The time recorded with this library is the time elapsed from the
 * command being called, and the response packet being received from the
 * server.  Everything the application does before driving the event loop
 * will affect the timers.
 *
 * The function lcb_enable_timings() is used to enable the timings for
 * the given instance, and lcb_disable_timings is used to disable the
 * timings. The overhead of using the timers should be negligible.
 *
 * The function lcb_get_timings is used to retrieve the current timing.
 * values from the given instance. The cookie is passed transparently to
 * the callback function.
 *
 * Here is an example of the usage of this module:
 *
 * @code{.c}
 * #include <libcouchbase/couchbase.h>
 *
 * static void callback(
 *  lcb_t instance, const void *cookie, lcb_timeunit_t timeunit, lcb_U32 min,
 *  lcb_U32 max, lcb_U32 total, lcb_U32 maxtotal)
 * {
 *   FILE* out = (void*)cookie;
 *   int num = (float)10.0 * (float)total / ((float)maxtotal);
 *   fprintf(out, "[%3u - %3u]", min, max);
 *   switch (timeunit) {
 *   case LCB_TIMEUNIT_NSEC:
 *      fprintf(out, "ns");
 *      break;
 *   case LCB_TIMEUNIT_USEC:
 *      fprintf(out, "us");
 *      break;
 *   case LCB_TIMEUNIT_MSEC:
 *      fsprintf(out, "ms");
 *      break;
 *   case LCB_TIMEUNIT_SEC:
 *      fprintf(out, "s ");
 *      break;
 *   default:
 *      ;
 *   }
 *
 *   fprintf(out, " |");
 *   for (int ii = 0; ii < num; ++ii) {
 *      fprintf(out, "#");
 *   }
 *   fprintf(out, " - %u\n", total);
 * }
 *
 *
 * lcb_enable_timings(instance);
 * ... do a lot of operations ...
 * fprintf(stderr, "              +---------+\n"
 * lcb_get_timings(instance, stderr, callback);
 * fprintf(stderr, "              +---------+\n"
 * lcb_disable_timings(instance);
 * @endcode
 *
 * @addtogroup lcb-timings
 * @{
 */

/**
 * @brief Time units reported by lcb_get_timings()
 */
enum lcb_timeunit_t {
    LCB_TIMEUNIT_NSEC = 0, /**< @brief Time is in nanoseconds */
    LCB_TIMEUNIT_USEC = 1, /**< @brief Time is in microseconds */
    LCB_TIMEUNIT_MSEC = 2, /**< @brief Time is in milliseconds */
    LCB_TIMEUNIT_SEC = 3 /**< @brief Time is in seconds */
};
typedef enum lcb_timeunit_t lcb_timeunit_t;

/**
 * Start recording timing metrics for the different operations.
 * The timer is started when the command is called (and the data
 * spooled to the server), and the execution time is the time until
 * we parse the response packets. This means that you can affect
 * the timers by doing a lot of other stuff before checking if
 * there is any results available..
 *
 * @param instance the handle to lcb
 * @return Status of the operation.
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_enable_timings(lcb_t instance);


/**
 * Stop recording (and release all resources from previous measurements)
 * timing metrics.
 *
 * @param instance the handle to lcb
 * @return Status of the operation.
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_disable_timings(lcb_t instance);

/**
 * The following function is called for each bucket in the timings
 * histogram when you call lcb_get_timings.
 * You are guaranteed that the callback will be called with the
 * lowest [min,max] range first.
 *
 * @param instance the handle to lcb
 * @param cookie the cookie you provided that allows you to pass
 *               arbitrary user data to the callback
 * @param timeunit the "scale" for the values
 * @param min The lower bound for this histogram bucket
 * @param max The upper bound for this histogram bucket
 * @param total The number of hits in this histogram bucket
 * @param maxtotal The highest value in all of the buckets
 */
typedef void (*lcb_timings_callback)(lcb_t instance,
                                     const void *cookie,
                                     lcb_timeunit_t timeunit,
                                     lcb_U32 min,
                                     lcb_U32 max,
                                     lcb_U32 total,
                                     lcb_U32 maxtotal);

/**
 * Get the timings histogram
 *
 * @param instance the handle to lcb
 * @param cookie a cookie that will be present in all of the callbacks
 * @param callback Callback to invoke which will handle the timings
 * @return Status of the operation.
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_get_timings(lcb_t instance,
                            const void *cookie,
                            lcb_timings_callback callback);
/**@}*/

/**
* @ingroup lcb-public-api
* @defgroup lcb-build-info Build and version information for the library
* These functions and macros may be used to conditionally compile features
* depending on the version of the library being used. They may also be used
* to employ various features at runtime and to retrieve the version for
* informational purposes.
* @addtogroup lcb-build-info
* @{
*/

#if !defined(LCB_VERSION_STRING) || defined(__LCB_DOXYGEN__)
/** @brief libcouchbase version string */
#define LCB_VERSION_STRING "unknown"
#endif

#if !defined(LCB_VERSION) || defined(__LCB_DOXYGEN__)
/**@brief libcouchbase hex version
 *
 * This number contains the hexadecimal representation of the library version.
 * It is in a format of `0xXXYYZZ` where `XX` is the two digit major version
 * (e.g. `02`), `YY` is the minor version (e.g. `05`) and `ZZ` is the patch
 * version (e.g. `24`).
 *
 * For example:
 *
 * String   |Hex
 * ---------|---------
 * 2.0.0    | 0x020000
 * 2.1.3    | 0x020103
 * 3.0.15   | 0x030015
 */
#define LCB_VERSION 0x000000
#endif

#if !defined(LCB_VERSION_CHANGESET) || defined(__LCB_DOXYGEN__)
/**@brief The SCM revision ID. @see LCB_CNTL_CHANGESET */
#define LCB_VERSION_CHANGESET "0xdeadbeef"
#endif

/**
 * Get the version of the library.
 *
 * @param version where to store the numeric representation of the
 *         version (or NULL if you don't care)
 *
 * @return the textual description of the version ('\0'
 *          terminated). Do <b>not</b> try to release this string.
 *
 */
LIBCOUCHBASE_API
const char *lcb_get_version(lcb_U32 *version);

/**@brief Whether the library has SSL support*/
#define LCB_SUPPORTS_SSL 1
/**@brief Whether the library has experimental compression support */
#define LCB_SUPPORTS_SNAPPY 2

/**
 * @committed
 * Determine if this version has support for a particularl feature
 * @param n the feature ID to check for
 * @return 0 if not supported, nonzero if supported.
 */
LIBCOUCHBASE_API
int
lcb_supports_feature(int n);

/**@}*/

/**
 * This may be used in conjunction with the errmap callback if it wishes
 * to fallback for default behavior for the given code.
 * @uncomitted
 */
LIBCOUCHBASE_API
lcb_error_t lcb_errmap_default(lcb_t instance, lcb_U16 code);

/**
 * Callback for error mappings. This will be invoked when requesting whether
 * the user has a possible mapping for this error code.
 *
 * This will be called for response codes which may be ambiguous in most
 * use cases, or in cases where detailed response codes may be mapped to
 * more generic ones.
 */
typedef lcb_error_t (*lcb_errmap_callback)(lcb_t instance, lcb_U16 bincode);

/**@uncommitted*/
LIBCOUCHBASE_API
lcb_errmap_callback lcb_set_errmap_callback(lcb_t, lcb_errmap_callback);

/**
 * Functions to allocate and free memory related to libcouchbase. This is
 * mainly for use on Windows where it is possible that the DLL and EXE
 * are using two different CRTs
 */
LIBCOUCHBASE_API
void *lcb_mem_alloc(lcb_SIZE size);

/** Use this to free memory allocated with lcb_mem_alloc */
LIBCOUCHBASE_API
void lcb_mem_free(void *ptr);

/**
 * These two functions unconditionally start and stop the event loop. These
 * should be used _only_ when necessary. Use lcb_wait and lcb_breakout
 * for safer variants.
 *
 * Internally these proxy to the run_event_loop/stop_event_loop calls
 */
LCB_INTERNAL_API
void lcb_run_loop(lcb_t instance);

LCB_INTERNAL_API
void lcb_stop_loop(lcb_t instance);

/* This returns the library's idea of time */
LCB_INTERNAL_API
lcb_U64 lcb_nstime(void);

typedef enum {
    /** Dump the raw vbucket configuration */
    LCB_DUMP_VBCONFIG =  0x01,
    /** Dump information about each packet */
    LCB_DUMP_PKTINFO = 0x02,
    /** Dump memory usage/reservation information about buffers */
    LCB_DUMP_BUFINFO = 0x04,
    /** Dump everything */
    LCB_DUMP_ALL = 0xff
} lcb_DUMPFLAGS;

/**
 * @volatile
 * @brief Write a textual dump to a file.
 *
 * This function will inspect the various internal structures of the current
 * client handle (indicated by `instance`) and write the state information
 * to the file indicated by `fp`.
 * @param instance the handle to dump
 * @param fp the file to which the dump should be written
 * @param flags a set of modifiers (of @ref lcb_DUMPFLAGS) indicating what
 * information to dump. Note that a standard set of information is always
 * dumped, but by default more verbose information is hidden, and may be
 * enabled with these flags.
 */
LIBCOUCHBASE_API
void
lcb_dump(lcb_t instance, FILE *fp, lcb_U32 flags);

/* Post-include some other headers */
#ifdef __cplusplus
}
#endif /* __cplusplus */

#include <libcouchbase/cntl.h>
#include <libcouchbase/deprecated.h>
#endif /* LIBCOUCHBASE_COUCHBASE_H */
