/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2020 Couchbase, Inc.
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

/**
 * @file
 * Main header file for Couchbase
 */

struct lcb_st;

/**
 * @ingroup lcb-init
 * Library handle representing a connection to a cluster and its data buckets. The contents
 * of this structure are opaque.
 * @see lcb_create
 * @see lcb_destroy
 */
typedef struct lcb_st lcb_INSTANCE;
typedef struct lcb_HTTP_HANDLE_ lcb_HTTP_HANDLE;

#include <stddef.h>
#include <time.h>
#include <stdarg.h>
#include <stdio.h>
#include <libcouchbase/sysdefs.h>
#include <libcouchbase/assert.h>
#include <libcouchbase/visibility.h>
#include <libcouchbase/error.h>
#include <libcouchbase/iops.h>
#include <libcouchbase/configuration.h>
#include <libcouchbase/kvbuf.h>
#include <libcouchbase/auth.h>
#include <libcouchbase/tracing.h>
#include <libcouchbase/logger.h>
#include <libcouchbase/cntl.h>

#ifdef __cplusplus
extern "C" {
#endif

/******************************************************************************
 ******************************************************************************
 ******************************************************************************
 ** INITIALIZATION                                                           **
 ******************************************************************************
 ******************************************************************************
 ******************************************************************************/

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-init Initialization
 *
 * @details
 *
 * To communicate with a Couchbase cluster, a new library handle instance is
 * created in the form of an lcb_INSTANCE. To create such an object, the lcb_create()
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
 * @par Hosts
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
 * @warning The key-value options here are considered to be an uncommitted interface
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
 * * `truststorepath` - Specify the path (on the local filesystem) to the server's
 *   SSL certificate truststore. Only applicable if SSL is being used (i.e. the
 *   scheme is `couchbases`). The trust store is optional, and when missing,
 *   the library will use `certpath` as location for verification, and expect
 *   any extra certificates to be concatenated in there.
 *
 * * `certpath` - Specify the path (on the local filesystem) to the server's
 *   SSL certificate. Only applicable if SSL is being used (i.e. the scheme is
 *   `couchbases`)
 *
 * * `keypath` - Specify the path (on the local filesystem) to the client
 *   SSL private key. Only applicable if SSL client certificate authentication
 *   is being used (i.e. the scheme is `couchbases` and `certpath` contains
 *   client certificate). Read more in the server documentation:
 *   https://developer.couchbase.com/documentation/server/5.0/security/security-certs-auth.html
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

/**
 * @brief Type of the bucket
 *
 * @see https://developer.couchbase.com/documentation/server/current/architecture/core-data-access-buckets.html
 */
typedef enum {
    LCB_BTYPE_UNSPEC = 0x00,    /**< Unknown or unspecified */
    LCB_BTYPE_COUCHBASE = 0x01, /**< Data persisted and replicated */
    LCB_BTYPE_EPHEMERAL = 0x02, /**< Data not persisted, but replicated */
    LCB_BTYPE_MEMCACHED = 0x03  /**< Data not persisted and not replicated */
} lcb_BTYPE;

typedef enum {
    LCB_CONFIG_TRANSPORT_LIST_END = 0,
    LCB_CONFIG_TRANSPORT_HTTP = 1,
    LCB_CONFIG_TRANSPORT_CCCP,
    LCB_CONFIG_TRANSPORT_MAX
} lcb_BOOTSTRAP_TRANSPORT;

/** @brief Handle types @see lcb_create_st3::type */
typedef enum {
    LCB_TYPE_BUCKET = 0x00, /**< Handle for data access (default) */
    LCB_TYPE_CLUSTER = 0x01 /**< Handle for administrative access */
} lcb_INSTANCE_TYPE;

typedef struct lcb_CREATEOPTS_ lcb_CREATEOPTS;

LIBCOUCHBASE_API lcb_STATUS lcb_createopts_create(lcb_CREATEOPTS **options, lcb_INSTANCE_TYPE type);
LIBCOUCHBASE_API lcb_STATUS lcb_createopts_destroy(lcb_CREATEOPTS *options);
LIBCOUCHBASE_API lcb_STATUS lcb_createopts_connstr(lcb_CREATEOPTS *options, const char *connstr, size_t connstr_len);
LIBCOUCHBASE_API lcb_STATUS lcb_createopts_bucket(lcb_CREATEOPTS *options, const char *bucket, size_t bucket_len);
LIBCOUCHBASE_API lcb_STATUS lcb_createopts_logger(lcb_CREATEOPTS *options, const lcb_LOGGER *logger);
LIBCOUCHBASE_API lcb_STATUS lcb_createopts_credentials(lcb_CREATEOPTS *options, const char *username,
                                                       size_t username_len, const char *password, size_t password_len);
LIBCOUCHBASE_API lcb_STATUS lcb_createopts_authenticator(lcb_CREATEOPTS *options, lcb_AUTHENTICATOR *auth);
LIBCOUCHBASE_API lcb_STATUS lcb_createopts_io(lcb_CREATEOPTS *options, struct lcb_io_opt_st *io);

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
 * lcb_INSTANCE *instance;
 * lcb_STATUS err = lcb_create(&instance, NULL);
 * if (err != LCB_SUCCESS) {
 *    fprintf(stderr, "Failed to create instance: %s\n", lcb_strerror_short(err));
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
lcb_STATUS lcb_create(lcb_INSTANCE **instance, const lcb_CREATEOPTS *options);

/**
 * @brief Schedule the initial connection
 * This function will schedule the initial connection for the handle. This
 * function _must_ be called before any operations can be performed.
 *
 * lcb_set_bootstrap_callback() or lcb_get_bootstrap_status() can be used to
 * determine if the scheduled connection completed successfully.
 *
 * @par Synchronous Usage
 * @code{.c}
 * lcb_STATUS rc = lcb_connect(instance);
 * if (rc != LCB_SUCCESS) {
 *    your_error_handling(rc);
 * }
 * lcb_wait(instance, LCB_WAIT_DEFAULT);
 * rc = lcb_get_bootstrap_status(instance);
 * if (rc != LCB_SUCCESS) {
 *    your_error_handler(rc);
 * }
 * @endcode
 * @committed
 */
LIBCOUCHBASE_API
lcb_STATUS lcb_connect(lcb_INSTANCE *instance);

/**
 * Bootstrap callback. Invoked once the instance is ready to perform operations
 * @param instance The instance which was bootstrapped
 * @param err The error code received. If this is not LCB_SUCCESS then the
 * instance is not bootstrapped and must be recreated
 *
 * @attention This callback only receives information during instantiation.
 * @committed
 */
typedef void (*lcb_bootstrap_callback)(lcb_INSTANCE *instance, lcb_STATUS err);

/**
 * @brief Set the callback for notification of success or failure of
 * initial connection.
 *
 * @param instance the instance
 * @param callback the callback to set. If `NULL`, return the existing callback
 * @return The existing (and previous) callback.
 * @see lcb_connect()
 * @see lcb_get_bootstrap_status()
 */
LIBCOUCHBASE_API
lcb_bootstrap_callback lcb_set_bootstrap_callback(lcb_INSTANCE *instance, lcb_bootstrap_callback callback);

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
lcb_STATUS lcb_get_bootstrap_status(lcb_INSTANCE *instance);

/**
 * Sets the authenticator object for the instance. This may be done anytime, but
 * should probably be done before calling `lcb_connect()` for best effect.
 *
 * @param instance the handle
 * @param auth the authenticator object used. The library will increase the
 * refcount on the authenticator object.
 */
LIBCOUCHBASE_API
void lcb_set_auth(lcb_INSTANCE *instance, lcb_AUTHENTICATOR *auth);
/**@}*/

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-kv-api Key/Value
 *
 * @brief Preview APIs for performing commands
 *
 * @details
 * Basic command and structure definitions for public API. This represents the
 * "V3" API of libcouchbase. This API replaces the legacy API (which now wraps
 * this one). It contains common definitions for scheduling, response structures
 * and callback signatures.
 *
 * @addtogroup lcb-kv-api
 * @{
 */

/** @ingroup lcb-mutation-tokens */
typedef struct {
    uint64_t uuid_;  /**< @private */
    uint64_t seqno_; /**< @private */
    uint16_t vbid_;  /**< @private */
} lcb_MUTATION_TOKEN;

LIBCOUCHBASE_API int lcb_mutation_token_is_valid(const lcb_MUTATION_TOKEN *token);

/**
 * @brief Response flags.
 * These provide additional 'meta' information about the response
 * They can be read from the response object with a call like
 * `lcb_respXXX_flags`, where the `XXX` is the operation -- like
 * get, exists, store, etc...  There is also a `lcb_respXXX_is_final`
 * method which reads the LCB_RESP_F_FINAL flag for those operations
 * that execute the callback multiple times.
 */
typedef enum {
    /** No more responses are to be received for this request */
    LCB_RESP_F_FINAL = 0x01,

    /**The response was artificially generated inside the client.
     * This does not contain reply data from the server for the command, but
     * rather contains the basic fields to indicate success or failure and is
     * otherwise empty.
     */
    LCB_RESP_F_CLIENTGEN = 0x02,

    /**The response was a result of a not-my-vbucket error */
    LCB_RESP_F_NMVGEN = 0x04,

    /**The response has additional internal data.
     * Used by lcb_resp_get_mutation_token() */
    LCB_RESP_F_EXTDATA = 0x08,

    /**Flag, only valid for subdoc responses, indicates that the response was
     * processed using the single-operation protocol. */
    LCB_RESP_F_SDSINGLE = 0x10,

    /**The response has extra error information as value (see SDK-RFC-28). */
    LCB_RESP_F_ERRINFO = 0x20
} lcb_RESPFLAGS;

/**
 * The type of response passed to the callback. This is used to install callbacks
 * for the library and to distinguish between responses if a single callback
 * is used for multiple response types.
 *
 * @note These callbacks may conflict with the older version 2 callbacks. The
 * rules are as follows:
 * * If a callback has been installed using lcb_install_callback3(), then
 * the older version 2 callback will not be invoked for that operation. The order
 * of installation does not matter.
 * * If the LCB_CALLBACK_DEFAULT callback is installed, _none_ of the version 2
 * callbacks are invoked.
 */
typedef enum {
    LCB_CALLBACK_DEFAULT = 0, /**< Default callback invoked as a fallback */
    LCB_CALLBACK_GET,         /**< lcb_get() */
    LCB_CALLBACK_STORE,       /**< lcb_store() */
    LCB_CALLBACK_COUNTER,     /**< lcb_counter() */
    LCB_CALLBACK_TOUCH,       /**< lcb_touch() */
    LCB_CALLBACK_REMOVE,      /**< lcb_remove() */
    LCB_CALLBACK_UNLOCK,      /**< lcb_unlock() */
    LCB_CALLBACK_STATS,       /**< lcb_stats3() */
    LCB_CALLBACK_VERSIONS,    /**< lcb_server_versions() */
    LCB_CALLBACK_VERBOSITY,   /**< lcb_server_verbosity() */
    LCB_CALLBACK_OBSERVE,     /**< lcb_observe3_ctxnew() */
    LCB_CALLBACK_GETREPLICA,  /**< lcb_getreplica() */
    LCB_CALLBACK_ENDURE,      /**< lcb_endure3_ctxnew() */
    LCB_CALLBACK_HTTP,        /**< lcb_http() */
    LCB_CALLBACK_CBFLUSH,     /**< lcb_cbflush3() */
    LCB_CALLBACK_OBSEQNO,     /**< For lcb_observe_seqno3() */
    LCB_CALLBACK_STOREDUR,    /** <for lcb_storedur3() */
    LCB_CALLBACK_SDLOOKUP,
    LCB_CALLBACK_SDMUTATE,
    LCB_CALLBACK_NOOP,                     /**< lcb_noop3() */
    LCB_CALLBACK_PING,                     /**< lcb_ping3() */
    LCB_CALLBACK_DIAG,                     /**< lcb_diag() */
    LCB_CALLBACK_COLLECTIONS_GET_MANIFEST, /**< lcb_getmanifest() */
    LCB_CALLBACK_GETCID,                   /**< lcb_getcid() */
    LCB_CALLBACK_EXISTS,                   /**< lcb_exists() */
    LCB_CALLBACK__MAX                      /* Number of callbacks */
} lcb_CALLBACK_TYPE;

/* The following callback types cannot be set using lcb_install_callback(),
 * however, their value is passed along as the second argument of their
 * respective callbacks. This allows you to still use the same callback,
 * differentiating their meaning by the type. */

/** Callback type for views (cannot be used for lcb_install_callback3()) */
#define LCB_CALLBACK_VIEWQUERY -1

/** Callback type for N1QL (cannot be used for lcb_install_callback3()) */
#define LCB_CALLBACK_QUERY -2

/** Callback type for N1QL index management (cannot be used for lcb_install_callback3()) */
#define LCB_CALLBACK_IXMGMT -3

/** Callback type for Analytics (cannot be used for lcb_install_callback3()) */
#define LCB_CALLBACK_ANALYTICS -4

/** Callback type for Search (cannot be used for lcb_install_callback3()) */
#define LCB_CALLBACK_SEARCH -5

#define LCB_CALLBACK_OPEN -6

/**
 * @uncommitted
 * Durability levels
 */
typedef enum {
    LCB_DURABILITYLEVEL_NONE = 0x00,
    /**
     * Mutation must be replicated to (i.e. held in memory of that node) a
     * majority ((configured_nodes / 2) + 1) of the configured nodes of the
     * bucket.
     */
    LCB_DURABILITYLEVEL_MAJORITY = 0x01,
    /**
     * As majority, but additionally persisted to the active node.
     */
    LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE = 0x02,
    /**
     * Mutation must be persisted to (i.e. written and fsync'd to disk) a
     * majority of the configured nodes of the bucket.
     */
    LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY = 0x03
} lcb_DURABILITY_LEVEL;

typedef struct lcb_CMDBASE_ lcb_CMDBASE;
typedef struct lcb_RESPBASE_ lcb_RESPBASE;

/**
 * Callback invoked for responses.
 * @param instance The handle
 * @param cbtype The type of callback - or in other words, the type of operation
 * this callback has been invoked for.
 * @param resp The response for the operation. Depending on the operation this
 * response structure should be casted into a more specialized type.
 */
typedef void (*lcb_RESPCALLBACK)(lcb_INSTANCE *instance, int cbtype, const lcb_RESPBASE *resp);

/**
 * @committed
 *
 * Install a new-style callback for an operation. The callback will be invoked
 * with the relevant response structure.
 *
 * @param instance the handle
 * @param cbtype the type of operation for which this callback should be installed.
 *        The value should be one of the lcb_CALLBACK_TYPE constants
 * @param cb the callback to install
 * @return the old callback
 *
 * @note LCB_CALLBACK_DEFAULT is initialized to the default handler which proxies
 * back to the older 2.x callbacks. If you set `cbtype` to LCB_CALLBACK_DEFAULT
 * then your `2.x` callbacks _will not work_.
 *
 * @note The old callback may be `NULL`. It is usually not an error to have a
 * `NULL` callback installed. If the callback is `NULL`, then the default callback
 * invocation pattern will take place (as desribed above). However it is an error
 * to set the default callback to `NULL`.
 */
LIBCOUCHBASE_API
lcb_RESPCALLBACK lcb_install_callback(lcb_INSTANCE *instance, int cbtype, lcb_RESPCALLBACK cb);

/**
 * @committed
 *
 * Get the current callback installed as `cbtype`. Note that this does not
 * perform any kind of resolution (as described in lcb_install_callback3) and
 * will only return a non-`NULL` value if a callback had specifically been
 * installed via lcb_install_callback3() with the given `cbtype`.
 *
 * @param instance the handle
 * @param cbtype the type of callback to retrieve
 * @return the installed callback for the type.
 */
LIBCOUCHBASE_API
lcb_RESPCALLBACK lcb_get_callback(lcb_INSTANCE *instance, int cbtype);

/**
 * Returns the type of the callback as a string.
 * This function is helpful for debugging and demonstrative processes.
 * @param cbtype the type of the callback (the second argument to the callback)
 * @return a string describing the callback type
 */
LIBCOUCHBASE_API
const char *lcb_strcbtype(int cbtype);

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-get Read
 * @brief Retrieve a document from the cluster
 * @addtogroup lcb-get
 * @{
 */

/**@brief Command for retrieving a single item
 *
 * @see lcb_get()
 * @see lcb_RESPGET
 *
 * ### Use of the `exptime` field
 *
 * <ul>
 * <li>Get And Touch:
 *
 * It is possible to retrieve an item and concurrently modify its expiration
 * time (thus keeping it "alive"). The item's expiry time can be set by
 * calling #lcb_cmdget_expiry.
 * </li>
 *
 * <li>Lock
 * Calling #lcb_cmdget_locktime will set the time the lock should be held for
 * </li>
 * </ul>
 */

/**
 * @committed
 *
 * @brief Spool a single get operation
 * @param instance the handle
 * @param cookie a pointer to be associated with the command
 * @param cmd the command structure
 * @return LCB_SUCCESS if successful, an error code otherwise
 *
 * @par Request
 * @code{.c}
 * lcb_CMDGET* cmd;
 * lcb_cmdget_create(&cmd);
 * lcb_cmdget_key(cmd, "Hello", 5);
 * lcb_get(instance, cookie, cmd);
 * @endcode
 *
 * @par Response
 * @code{.c}
 * lcb_install_callback(instance, LCB_CALLBACK_GET, get_callback);
 * static void get_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPBASE *rb) {
 *     const lcb_RESPGET *resp = (const lcb_RESPGET*)rb;
 *     char* key;
 *     char* value;
 *     size_t key_len;
 *     size_t value_len;
 *     uint64_t cas;
 *     uint32_t flags;
 *     lcb_respget_key(resp, &key, &key_len);
 *     printf("Got response for key: %.*s\n", key_len, key);
 *
 *
 *     lcb_STATUS rc = lcb_respget_status(resp);
 *     if (rc != LCB_SUCCESS) {
 *         printf("Couldn't get item: %s\n", lcb_strerror_short(rc));
 *     } else {
 *         lcb_respget_cas(resp, &cas);
 *         lcb_respget_value(resp, &value, &value_len);
 *         lcb_respget_flags(resp, &flags);
 *         printf("Got value: %.*s\n", value_len, value);
 *         printf("Got CAS: 0x%llx\n", cas);
 *         printf("Got item/formatting flags: 0x%x\n", flags);
 *     }
 * }
 *
 * @endcode
 *
 * @par Errors
 * @cb_err ::LCB_ERR_DOCUMENT_NOT_FOUND if the item does not exist in the cluster
 * @cb_err ::LCB_ERR_TEMPORARY_FAILURE if the lcb_cmdget_locktime was set but the item
 * was already locked. Note that this error may also be returned (as a generic
 * error) if there is a resource constraint within the server itself.
 */

typedef struct lcb_RESPGET_ lcb_RESPGET;

LIBCOUCHBASE_API lcb_STATUS lcb_respget_status(const lcb_RESPGET *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respget_error_context(const lcb_RESPGET *resp, const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respget_cookie(const lcb_RESPGET *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respget_cas(const lcb_RESPGET *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respget_datatype(const lcb_RESPGET *resp, uint8_t *datatype);
LIBCOUCHBASE_API lcb_STATUS lcb_respget_flags(const lcb_RESPGET *resp, uint32_t *flags);
LIBCOUCHBASE_API lcb_STATUS lcb_respget_key(const lcb_RESPGET *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respget_value(const lcb_RESPGET *resp, const char **value, size_t *value_len);

typedef struct lcb_CMDGET_ lcb_CMDGET;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_create(lcb_CMDGET **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_destroy(lcb_CMDGET *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_parent_span(lcb_CMDGET *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_collection(lcb_CMDGET *cmd, const char *scope, size_t scope_len,
                                                  const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_key(lcb_CMDGET *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_expiry(lcb_CMDGET *cmd, uint32_t expiration);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_locktime(lcb_CMDGET *cmd, uint32_t duration);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_timeout(lcb_CMDGET *cmd, uint32_t timeout);

LIBCOUCHBASE_API lcb_STATUS lcb_get(lcb_INSTANCE *instance, void *cookie, const lcb_CMDGET *cmd);
/**@}*/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-get-replica Read (Replica)
 * @brief Retrieve a document from a replica if it cannot be fetched from the
 * primary
 * @addtogroup lcb-get-replica
 * @{
 */

/**@committed
 *
 * @brief Spool a single get-with-replica request
 * @param instance
 * @param cookie
 * @param cmd
 * @return LCB_SUCCESS on success, error code otherwise.
 *
 * When a response is received, the callback installed for ::LCB_CALLBACK_GETREPLICA
 * will be invoked. The response will be an @ref lcb_RESPGET pointer.
 *
 * ### Request
 * @code{.c}
 * lcb_CMDGETREPLICA* cmd;
 * lcb_cmdgetreplica_create(&cmd);
 * lcb_cmdgetreplica_key(cmd, "key", 3);
 * lcb_cmdgetreplica(instance, cookie, &cmd);
 * @endcode
 *
 * ### Response
 * @code{.c}
 * lcb_install_callback(instance, LCB_CALLBACK_GETREPLICA, rget_callback);
 * static void rget_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPBASE *rb)
 * {
 *     const lcb_RESPGET *resp = (const lcb_RESPGET *)rb;
 *     char* key;
 *     char* value;
 *     size_t key_len;
 *     size_t value_len;
 *     lcb_STATUS rc = lcb_respgetreplica_status(resp);
 *     lcb_respgetreplica_key(resp, &key, &key_len);
 *     printf("Got Get-From-Replica response for %.*s\n", key_len, key);
 *     if (rc == LCB_SUCCESS) {
 *         lcb_respgetreplica_value(resp, &value, &value_len);
 *         printf("Got response: %.*s\n", value_len, value);
 *     else {
 *         printf("Couldn't retrieve: %s\n", lcb_strerror_short(rc));
 *     }
 * }
 * @endcode
 *
 * @warning As this function queries a replica node for data it is possible
 * that the returned document may not reflect the latest document in the server.
 *
 * @warning This function should only be used in cases where a normal lcb_get3()
 * has failed, or where there is reason to believe it will fail. Because this
 * function may query more than a single replica it may cause additional network
 * and server-side CPU load. Use sparingly and only when necessary.
 *
 * @cb_err ::LCB_ERR_DOCUMENT_NOT_FOUND if the key is not found on the replica(s),
 * ::LCB_ERR_NO_MATCHING_SERVER if there are no replicas (either configured or online),
 * or if the given replica
 * (if lcb_CMDGETREPLICA::strategy is ::LCB_REPLICA_SELECT) is not available or
 * is offline.
 */

typedef enum {
    LCB_REPLICA_MODE_ANY = 0x00,
    LCB_REPLICA_MODE_ALL = 0x01,
    LCB_REPLICA_MODE_IDX0 = 0x02,
    LCB_REPLICA_MODE_IDX1 = 0x03,
    LCB_REPLICA_MODE_IDX2 = 0x04,
    LCB_REPLICA_MODE__MAX
} lcb_REPLICA_MODE;

typedef struct lcb_RESPGETREPLICA_ lcb_RESPGETREPLICA;

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_status(const lcb_RESPGETREPLICA *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_error_context(const lcb_RESPGETREPLICA *resp,
                                                             const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_cookie(const lcb_RESPGETREPLICA *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_cas(const lcb_RESPGETREPLICA *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_datatype(const lcb_RESPGETREPLICA *resp, uint8_t *datatype);
LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_flags(const lcb_RESPGETREPLICA *resp, uint32_t *flags);
LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_key(const lcb_RESPGETREPLICA *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_value(const lcb_RESPGETREPLICA *resp, const char **value,
                                                     size_t *value_len);
LIBCOUCHBASE_API int lcb_respgetreplica_is_final(const lcb_RESPGETREPLICA *resp);

typedef struct lcb_CMDGETREPLICA_ lcb_CMDGETREPLICA;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_create(lcb_CMDGETREPLICA **cmd, lcb_REPLICA_MODE mode);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_destroy(lcb_CMDGETREPLICA *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_parent_span(lcb_CMDGETREPLICA *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_collection(lcb_CMDGETREPLICA *cmd, const char *scope, size_t scope_len,
                                                         const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_key(lcb_CMDGETREPLICA *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_timeout(lcb_CMDGETREPLICA *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_getreplica(lcb_INSTANCE *instance, void *cookie, const lcb_CMDGETREPLICA *cmd);

/**@}*/

typedef struct lcb_RESPEXISTS_ lcb_RESPEXISTS;

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_status(const lcb_RESPEXISTS *resp);
LIBCOUCHBASE_API int lcb_respexists_is_found(const lcb_RESPEXISTS *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respexists_error_context(const lcb_RESPEXISTS *resp,
                                                         const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respexists_cookie(const lcb_RESPEXISTS *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respexists_cas(const lcb_RESPEXISTS *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respexists_key(const lcb_RESPEXISTS *resp, const char **key, size_t *key_len);

typedef struct lcb_CMDEXISTS_ lcb_CMDEXISTS;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_create(lcb_CMDEXISTS **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_destroy(lcb_CMDEXISTS *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_parent_span(lcb_CMDEXISTS *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_collection(lcb_CMDEXISTS *cmd, const char *scope, size_t scope_len,
                                                     const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_key(lcb_CMDEXISTS *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_timeout(lcb_CMDEXISTS *cmd, uint32_t timeout);

LIBCOUCHBASE_API lcb_STATUS lcb_exists(lcb_INSTANCE *instance, void *cookie, const lcb_CMDEXISTS *cmd);

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-store Create/Update
 * @brief Set the value of a document
 * @addtogroup lcb-store
 * @{
 */

/**
 * @brief Values for lcb_CMDSTORE::operation
 *
 * Storing an item in couchbase is only one operation with a different
 * set of attributes / constraints.
 */
typedef enum {
    /**
     * The default storage mode. This constant was added in version 2.6.2 for
     * the sake of maintaining a default storage mode, eliminating the need
     * for simple storage operations to explicitly define
     * lcb_CMDSTORE::operation. Behaviorally it is identical to @ref LCB_STORE_UPSERT
     * in that it will make the server unconditionally store the item, whether
     * it exists or not.
     */
    LCB_STORE_UPSERT = 0x00,

    /**
     * Will cause the operation to fail if the key already exists in the
     * cluster.
     */
    LCB_STORE_INSERT = 0x01,

    /**
     * Will cause the operation to fail _unless_ the key already exists in the
     * cluster.
     */
    LCB_STORE_REPLACE = 0x02,

    /**
     * Rather than setting the contents of the entire document, take the value
     * specified in lcb_CMDSTORE::value and _append_ it to the existing bytes in
     * the value.
     */
    LCB_STORE_APPEND = 0x04,

    /**
     * Like ::LCB_STORE_APPEND, but prepends the new value to the existing value.
     */
    LCB_STORE_PREPEND = 0x05
} lcb_STORE_OPERATION;

/**
 * @committed
 * @brief Schedule a single storage request
 * @param instance the handle
 * @param cookie pointer to associate with the command
 * @param cmd the command structure
 * @return LCB_SUCCESS on success, error code on failure
 *
 * ### Request
 *
 * @code{.c}
 * lcb_CMDSTORE* cmd;
 * // insert only if key doesn't already exist
 * lcb_cmdstore_create(&cmd, LCB_STORE_INSERT);
 * lcb_cmdstore_key(cmd, "Key", 3);
 * lcb_cmdstore_value(cmd, "value", 5);
 * lcb_cmdstore_expiry(cmd, 60); // expire in a minute
 * lcb_store(instance, cookie, &cmd);
 * lcb_wait(instance, LCB_WAIT_NOCHECK);
 * @endcode
 *
 * ### Response
 * @code{.c}
 * lcb_install_callback(instance, LCB_CALLBACK_STORE, store_callback);
 * void store_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPBASE *rb)
 * {
 *     uint64_t cas;
 *     const lcb_RESPSTORE resp = (const lcb_RESPSTORE*)rb;
 *     lcb_STATUS rc = lcb_respstore_status(resp);
 *     if (rc == LCB_SUCCESS) {
 *         lcb_respstore_cas(resp, &cas)
 *         printf("Store success: CAS=%llx\n", cas);
 *     } else {
 *         printf("Store failed: %s\n", lcb_strerror_short(rc);
 *     }
 * }
 * @endcode
 *
 * Operation-specific error codes include:
 * @cb_err ::LCB_ERR_DOCUMENT_NOT_FOUND if ::LCB_REPLACE was used and the key does not exist
 * @cb_err ::LCB_ERR_DOCUMENT_EXISTS if ::LCB_INSERT was used and the key already exists
 * @cb_err ::LCB_ERR_DOCUMENT_EXISTS if the CAS was specified (for an operation other
 *          than ::LCB_INSERT) and the item exists on the server with a different
 *          CAS
 * @cb_err ::LCB_ERR_DOCUMENT_EXISTS if the item was locked and the CAS supplied did
 * not match the locked item's CAS (or if no CAS was supplied)
 * @cb_err ::LCB_ERR_NOT_STORED if an ::LCB_APPEND or ::LCB_PREPEND operation was
 * performed and the item did not exist on the server.
 * @cb_err ::LCB_ERR_VALUE_TOO_LARGE if the size of the value exceeds the cluster per-item
 *         value limit (currently 20MB).
 *
 *
 * For a 6.5 or later cluster, you should use the lcb_cmdstore_durability to make the lcb_store
 * not return until the requested durabilty is met.  If the cluster is an older version, you can
 * use lcb_cmdstore_durability_observe.
 */

typedef struct lcb_RESPSTORE_ lcb_RESPSTORE;

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_status(const lcb_RESPSTORE *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_error_context(const lcb_RESPSTORE *resp,
                                                        const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_cookie(const lcb_RESPSTORE *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_cas(const lcb_RESPSTORE *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_key(const lcb_RESPSTORE *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_operation(const lcb_RESPSTORE *resp, lcb_STORE_OPERATION *operation);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_mutation_token(const lcb_RESPSTORE *resp, lcb_MUTATION_TOKEN *token);

LIBCOUCHBASE_API int lcb_respstore_observe_attached(const lcb_RESPSTORE *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_stored(const lcb_RESPSTORE *resp, int *store_ok);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_master_exists(const lcb_RESPSTORE *resp, int *master_exists);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_master_persisted(const lcb_RESPSTORE *resp, int *master_persisted);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_num_responses(const lcb_RESPSTORE *resp, uint16_t *num_responses);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_num_persisted(const lcb_RESPSTORE *resp, uint16_t *num_persisted);
LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_num_replicated(const lcb_RESPSTORE *resp, uint16_t *num_replicated);

typedef struct lcb_CMDSTORE_ lcb_CMDSTORE;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_create(lcb_CMDSTORE **cmd, lcb_STORE_OPERATION operation);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_destroy(lcb_CMDSTORE *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_parent_span(lcb_CMDSTORE *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_collection(lcb_CMDSTORE *cmd, const char *scope, size_t scope_len,
                                                    const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_key(lcb_CMDSTORE *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_value(lcb_CMDSTORE *cmd, const char *value, size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_value_iov(lcb_CMDSTORE *cmd, const lcb_IOV *value, size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_expiry(lcb_CMDSTORE *cmd, uint32_t expiration);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_cas(lcb_CMDSTORE *cmd, uint64_t cas);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_flags(lcb_CMDSTORE *cmd, uint32_t flags);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_datatype(lcb_CMDSTORE *cmd, uint8_t datatype);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_durability(lcb_CMDSTORE *cmd, lcb_DURABILITY_LEVEL level);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_durability_observe(lcb_CMDSTORE *cmd, int persist_to, int replicate_to);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_timeout(lcb_CMDSTORE *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_store(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSTORE *cmd);
/**@}*/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-open Open Bucket
 * @brief Open bucket in cluster
 * @addtogroup lcb-open
 * @{
 */

typedef void (*lcb_open_callback)(lcb_INSTANCE *instance, lcb_STATUS err);
/** @brief Callback to be called when bucket is opened
 *
 * @param instance
 * @param callback pointer to callback
 * @return LCB_SUCCESS on success, other code on failure.
 */
LIBCOUCHBASE_API lcb_open_callback lcb_set_open_callback(lcb_INSTANCE *instance, lcb_open_callback callback);

/**
 * Opens bucket.
 *
 * @param instance
 * @param bucket name of bucket to open
 * @param bucket_len length of bucket string
 * @return LCB_SUCCESS on success, other code on failure
 */

LIBCOUCHBASE_API lcb_STATUS lcb_open(lcb_INSTANCE *instance, const char *bucket, size_t bucket_len);
/**@}*/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-remove Remove
 * @brief Remove documents
 *
 * @addtogroup lcb-remove
 * @{
 */

/**@committed
 * @brief Spool a removal of an item
 * @param instance the handle
 * @param cookie pointer to associate with the request
 * @param cmd the command
 * @return LCB_SUCCESS on success, other code on failure
 *
 * ### Request
 * @code{.c}
 * lcb_CMDREMOVE* cmd;
 * lcb_cmdremove_create(&cmd);
 * lcb_cmdremove_key(cmd, "deleteme", strlen("deleteme"));
 * lcb_remove(instance, cookie, &cmd);
 * @endcode
 *
 * ### Response
 * @code{.c}
 * lcb_install_callback(instance, LCB_CALLBACK_REMOVE, rm_callback);
 * void rm_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPBASE *rb)
 * {
 *     const lcb_RESPREMOVE* resp = (const lcb_RESPREMOVE*)rb;
 *     char* key;
 *     size_t key_len;
 *     lcb_STATUS rc = lcb_respremove_status(resp);
 *     lcb_respremove_key(resp, &key, &key_len);
 *     printf("Key: %.*s...", key_len, key);
 *     if (rc != LCB_SUCCESS) {
 *         printf("Failed to remove item!: %s\n", lcb_strerror_short(rc));
 *     } else {
 *         printf("Removed item!\n");
 *     }
 * }
 * @endcode
 *
 * The following operation-specific error codes are returned in the callback
 * @cb_err ::LCB_ERR_DOCUMENT_NOT_FOUND if the key does not exist
 * @cb_err ::LCB_ERR_DOCUMENT_EXISTS if the CAS was specified and it does not match the
 *         CAS on the server
 * @cb_err ::LCB_ERR_DOCUMENT_EXISTS if the item was locked and no CAS (or an incorrect
 *         CAS) was specified.
 *
 */

typedef struct lcb_RESPREMOVE_ lcb_RESPREMOVE;

LIBCOUCHBASE_API lcb_STATUS lcb_respremove_status(const lcb_RESPREMOVE *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respremove_error_context(const lcb_RESPREMOVE *resp,
                                                         const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respremove_cookie(const lcb_RESPREMOVE *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respremove_cas(const lcb_RESPREMOVE *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respremove_key(const lcb_RESPREMOVE *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respremove_mutation_token(const lcb_RESPREMOVE *resp, lcb_MUTATION_TOKEN *token);

typedef struct lcb_CMDREMOVE_ lcb_CMDREMOVE;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_create(lcb_CMDREMOVE **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_destroy(lcb_CMDREMOVE *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_parent_span(lcb_CMDREMOVE *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_collection(lcb_CMDREMOVE *cmd, const char *scope, size_t scope_len,
                                                     const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_key(lcb_CMDREMOVE *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_cas(lcb_CMDREMOVE *cmd, uint64_t cas);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_durability(lcb_CMDREMOVE *cmd, lcb_DURABILITY_LEVEL level);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdremove_timeout(lcb_CMDREMOVE *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_remove(lcb_INSTANCE *instance, void *cookie, const lcb_CMDREMOVE *cmd);

/**@}*/

/**
 * @ingroup lcb-kv-api
 * @defgroup lcb-counter Counters
 * @brief Manipulate the numeric content of a document
 * @details Counter operations treat the document being accessed as a numeric
 * value (the document should contain a parseable integer as its content). This
 * value may then be incremented or decremented.
 *
 * @addtogroup lcb-counter
 * @{
 */

/**@committed
 * @brief Schedule single counter operation
 * @param instance the instance
 * @param cookie the pointer to associate with the request
 * @param cmd the command to use
 * @return LCB_SUCCESS on success, other error on failure
 *
 * @par Request
 * @code{.c}
 * lcb_CMDCOUNTER* cmd;
 * lcb_cmdcounter_create(&cmd);
 * lcb_cmdcounter_key(cmd, "counter", strlen("counter"));
 * lcb_cmdcounter_delta(cmd, 1); // Increment by one
 * lcb_cmdcounter_value(cmd, 42); // Default value is 42 if it does not exist
 * lcb_cmdcounter_expiry(cmd, 300); // Expire in 5 minutes
 * lcb_counter(instance, NULL, cmd);
 * lcb_wait(instance, LCB_WAIT_NOCHECK);
 * @endcode
 *
 * @par Response
 * @code{.c}
 * lcb_install_callback(instance, LCB_CALLBACKTYPE_COUNTER, counter_cb);
 * void counter_cb(lcb_INSTANCE *instance, int cbtype, const lcb_RESPBASE *rb)
 * {
 *     const lcb_RESPCOUNTER *resp = (const lcb_RESPCOUNTER *)rb;
 *     lcb_STATUS = lcb_respcounter_status(resp);
 *     if (rc == LCB_SUCCESS) {
 *         char* key;
 *         size_t key_len;
 *         uint64_t value;
 *         lcb_respcounter_value(resp, &value);
 *         lcb_respcounter_key(resp, &key, &key_len);
 *         printf("Incremented counter for %.*s. Current value %llu\n",
 *                key_len, key, value);
 *     }
 * }
 * @endcode
 *
 * @par Callback Errors
 * In addition to generic errors, the following errors may be returned in the
 * callback (via lcb_respcounter_status):
 *
 * @cb_err ::LCB_ERR_DOCUMENT_NOT_FOUND if the counter doesn't exist
 * @cb_err ::LCB_ERR_INVALID_DELTA if the existing document's content could not
 * be parsed as a number by the server.
 */

typedef struct lcb_RESPCOUNTER_ lcb_RESPCOUNTER;

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_status(const lcb_RESPCOUNTER *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_error_context(const lcb_RESPCOUNTER *resp,
                                                          const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_cookie(const lcb_RESPCOUNTER *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_cas(const lcb_RESPCOUNTER *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_key(const lcb_RESPCOUNTER *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_mutation_token(const lcb_RESPCOUNTER *resp, lcb_MUTATION_TOKEN *token);
LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_value(const lcb_RESPCOUNTER *resp, uint64_t *value);

typedef struct lcb_CMDCOUNTER_ lcb_CMDCOUNTER;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_create(lcb_CMDCOUNTER **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_destroy(lcb_CMDCOUNTER *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_parent_span(lcb_CMDCOUNTER *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_collection(lcb_CMDCOUNTER *cmd, const char *scope, size_t scope_len,
                                                      const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_key(lcb_CMDCOUNTER *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_expiry(lcb_CMDCOUNTER *cmd, uint32_t expiration);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_delta(lcb_CMDCOUNTER *cmd, int64_t number);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_initial(lcb_CMDCOUNTER *cmd, uint64_t number);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_durability(lcb_CMDCOUNTER *cmd, lcb_DURABILITY_LEVEL level);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_cas(lcb_CMDCOUNTER *cmd, uint64_t cas);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_timeout(lcb_CMDCOUNTER *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_counter(lcb_INSTANCE *instance, void *cookie, const lcb_CMDCOUNTER *cmd);

/**@} (Group: Counter) */

/* @ingroup lcb-kv-api
 * @defgroup lcb-lock Lock/Unlock
 * @details Documents may be locked and unlocked on the server. While a document
 * is locked, any attempt to modify it (or lock it again) will fail.
 *
 * @note Locks are not persistent across nodes (if a node fails over, the lock
 * is not transferred to a replica).
 * @note The recommended way to manage access and concurrency control for
 * documents in Couchbase is through the CAS, which can also be considered
 * a form of opportunistic locking.
 *
 * @par Locking an item
 * There is no exclusive function to lock an item. Locking an item is done
 * using @ref lcb_get(), by setting the lcb_cmdget_locktime.
 *
 * @addtogroup lcb-lock
 * @{
 */

/**
 * @committed
 * @brief
 * Unlock a previously locked item using lcb_cmdunlock
 *
 * @param instance the instance
 * @param cookie the context pointer to associate with the command
 * @param cmd the command containing the information about the locked key
 * @return LCB_SUCCESS if successful, an error code otherwise
 * Note that you must specify the cas of the item to unlock it, and the only
 * way to get that cas is in the callback of the lock call.  Outside that, the
 * server will respond with a dummy cas if, for instance, you do a lcb_get.
 *
 * @see lcb_get()
 *
 * @par
 *
 * @code{.c}
 * void locked_callback(lcb_INSTANCE, lcb_CALLBACK_TYPE, const lcb_RESPBASE *rb) {
 *   const lcb_RESPGET* resp = (const lcb_RESPLOCK*)rb;
 *   lcb_CMDUNLOCK* cmd;
 *   char* key;
 *   size_t key_len;
 *   unit64_t cas;
 *   lcb_respget_cas(resp, &cas);
 *   lcb_respget_key(resp, &key, &key_len);
 *   lcb_cmdunlock_create(&cmd);
 *   lcb_cmdunlock_key(cmd, key, key_len);
 *   lcb_cmdunlock_cas(cmd, cas);
 *   lcb_unlock(instance, cookie, cmd);
 * }
 *
 * @endcode
 */

typedef struct lcb_RESPUNLOCK_ lcb_RESPUNLOCK;

LIBCOUCHBASE_API lcb_STATUS lcb_respunlock_status(const lcb_RESPUNLOCK *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respunlock_error_context(const lcb_RESPUNLOCK *resp,
                                                         const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respunlock_cookie(const lcb_RESPUNLOCK *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respunlock_cas(const lcb_RESPUNLOCK *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respunlock_key(const lcb_RESPUNLOCK *resp, const char **key, size_t *key_len);

typedef struct lcb_CMDUNLOCK_ lcb_CMDUNLOCK;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdunlock_create(lcb_CMDUNLOCK **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdunlock_destroy(lcb_CMDUNLOCK *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdunlock_parent_span(lcb_CMDUNLOCK *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdunlock_collection(lcb_CMDUNLOCK *cmd, const char *scope, size_t scope_len,
                                                     const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdunlock_key(lcb_CMDUNLOCK *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdunlock_cas(lcb_CMDUNLOCK *cmd, uint64_t cas);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdunlock_timeout(lcb_CMDUNLOCK *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_unlock(lcb_INSTANCE *instance, void *cookie, const lcb_CMDUNLOCK *cmd);

/**@} (Group: Unlock) */

/* @ingroup lcb-kv-api
 * @defgroup lcb-touch Touch/Expiry
 * @brief Modify or clear a document's expiration time
 * @details Couchbase allows documents to contain expiration times
 * (see lcb_CMDBASE::exptime). Most operations allow the expiry time to be
 * updated, however lcb_touch3() allows the exclusive update of the expiration
 * time without additional network overhead.
 *
 * @addtogroup lcb-touch
 * @{
 */

/**@committed
 * @brief Spool a touch request
 * @param instance the handle
 * @param cookie the pointer to associate with the request
 * @param cmd the command
 * @return LCB_SUCCESS on success, other error code on failure
 *
 * @par Request
 * @code{.c}
 * lcb_CMDTOUCH* cmd;
 * lcb_cmdtouch_create(&cmd);
 * lcb_cmdtouch_key(cmd, "keep_me", strlen("keep_me"));
 * lcb_cmdtouch_expiry(cmd, 0); // Clear the expiration
 * lcb_touch(instance, cookie, cmd);
 * @endcode
 *
 * @par Response
 * @code{.c}
 * lcb_install_callback(instance, LCB_CALLBACK_TOUCH, touch_callback);
 * void touch_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPBASE *rb)
 * {
 *     const lcb_RESPTOUCH* resp = (const lcb_RESPTOUCH*)rb;
 *     lcb_STATUS = lcb_resptouch_status(resp);
 *     if (rc == LCB_SUCCESS) {
 *         printf("Touch succeeded\n");
 *     }
 * }
 * @endcode
 */

typedef struct lcb_RESPTOUCH_ lcb_RESPTOUCH;

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_status(const lcb_RESPTOUCH *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_error_context(const lcb_RESPTOUCH *resp,
                                                        const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_cookie(const lcb_RESPTOUCH *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_cas(const lcb_RESPTOUCH *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_key(const lcb_RESPTOUCH *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_mutation_token(const lcb_RESPTOUCH *resp, lcb_MUTATION_TOKEN *token);

typedef struct lcb_CMDTOUCH_ lcb_CMDTOUCH;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_create(lcb_CMDTOUCH **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_destroy(lcb_CMDTOUCH *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_parent_span(lcb_CMDTOUCH *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_collection(lcb_CMDTOUCH *cmd, const char *scope, size_t scope_len,
                                                    const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_key(lcb_CMDTOUCH *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_expiry(lcb_CMDTOUCH *cmd, uint32_t expiration);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_durability(lcb_CMDTOUCH *cmd, lcb_DURABILITY_LEVEL level);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_timeout(lcb_CMDTOUCH *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_touch(lcb_INSTANCE *instance, void *cookie, const lcb_CMDTOUCH *cmd);

/**@} (Group: Touch) */
/**@} (Group: KV API) */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-ping PING
 * @brief Broadcast NOOP-like commands to each service in the cluster
 *
 * @addtogroup lcb-ping
 * @{
 */

/**
 * Status of the service
 *
 * @committed
 */
typedef enum {
    LCB_PING_STATUS_OK = 0,
    LCB_PING_STATUS_TIMEOUT,
    LCB_PING_STATUS_ERROR,
    LCB_PING_STATUS_INVALID, /* bad index or argument */
    LCB_PING_STATUS__MAX
} lcb_PING_STATUS;

/**
 * Type of the service. This enumeration is used in PING responses.
 *
 * @committed
 */
typedef enum {
    LCB_PING_SERVICE_KV = 0,
    LCB_PING_SERVICE_VIEWS,
    LCB_PING_SERVICE_QUERY,
    LCB_PING_SERVICE_SEARCH,
    LCB_PING_SERVICE_ANALYTICS,
    LCB_PING_SERVICE__MAX
} lcb_PING_SERVICE;

typedef struct lcb_RESPPING_ lcb_RESPPING;

LIBCOUCHBASE_API lcb_STATUS lcb_respping_status(const lcb_RESPPING *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_cookie(const lcb_RESPPING *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_value(const lcb_RESPPING *resp, const char **json, size_t *json_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_report_id(const lcb_RESPPING *resp, const char **report_id,
                                                   size_t *report_id_len);
LIBCOUCHBASE_API size_t lcb_respping_result_size(const lcb_RESPPING *resp);
LIBCOUCHBASE_API lcb_PING_STATUS lcb_respping_result_status(const lcb_RESPPING *resp, size_t index);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_id(const lcb_RESPPING *resp, size_t index, const char **endpoint_id,
                                                   size_t *endpoint_id_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_service(const lcb_RESPPING *resp, size_t index, lcb_PING_SERVICE *type);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_remote(const lcb_RESPPING *resp, size_t index, const char **address,
                                                       size_t *address_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_local(const lcb_RESPPING *resp, size_t index, const char **address,
                                                      size_t *address_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_latency(const lcb_RESPPING *resp, size_t index, uint64_t *latency);

LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_namespace(const lcb_RESPPING *resp, size_t index, const char **name,
                                                          size_t *name_len);

LCB_DEPRECATED2(LIBCOUCHBASE_API lcb_STATUS lcb_respping_result_scope(const lcb_RESPPING *resp, size_t index,
                                                                      const char **name, size_t *name_len),
                "Use lcb_respping_result_namespace");

typedef struct lcb_CMDPING_ lcb_CMDPING;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_create(lcb_CMDPING **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_destroy(lcb_CMDPING *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_parent_span(lcb_CMDPING *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_report_id(lcb_CMDPING *cmd, const char *report_id, size_t report_id_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_all(lcb_CMDPING *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_kv(lcb_CMDPING *cmd, int enable);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_query(lcb_CMDPING *cmd, int enable);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_views(lcb_CMDPING *cmd, int enable);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_search(lcb_CMDPING *cmd, int enable);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_analytics(lcb_CMDPING *cmd, int enable);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_no_metrics(lcb_CMDPING *cmd, int enable);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_encode_json(lcb_CMDPING *cmd, int enable, int pretty, int with_details);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdping_timeout(lcb_CMDPING *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_ping(lcb_INSTANCE *instance, void *cookie, const lcb_CMDPING *cmd);

typedef struct lcb_RESPDIAG_ lcb_RESPDIAG;

LIBCOUCHBASE_API lcb_STATUS lcb_respdiag_status(const lcb_RESPDIAG *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respdiag_cookie(const lcb_RESPDIAG *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respdiag_value(const lcb_RESPDIAG *resp, const char **json, size_t *json_len);

typedef struct lcb_CMDDIAG_ lcb_CMDDIAG;

LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_create(lcb_CMDDIAG **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_destroy(lcb_CMDDIAG *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_report_id(lcb_CMDDIAG *cmd, const char *report_id, size_t report_id_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmddiag_prettify(lcb_CMDDIAG *cmd, int enable);
/**
 * @brief Returns diagnostics report about network connections.
 *
 * @committed
 *
 * @par Request
 * @code{.c}
 * lcb_CMDDIAG cmd = { 0 };
 * lcb_diag(instance, fp, &cmd);
 * lcb_wait(instance, LCB_WAIT_DEFAULT);
 * @endcode
 *
 * @par Response
 * @code{.c}
 * lcb_install_callback(instance, LCB_CALLBACK_DIAG, diag_callback);
 * void diag_callback(lcb_INSTANCE, int, const lcb_RESPBASE *rb)
 * {
 *     const lcb_RESPDIAG *resp = (const lcb_RESPDIAG *)rb;
 *     char* json;
 *     size_t json_len;
 *     lcb_STATUS rc = lcb_respdiag_status(resp);
 *     if (rc != LCB_SUCCESS) {
 *         fprintf(stderr, "failed: %s\n", lcb_strerror_short(rc));
 *     } else {
           lcb_respdiag_value(resp, &json, &json_len);
 *         if (json) {
 *             fprintf(stderr, "\n%.*s", json_len, json);
 *         }
 *     }
 * }
 * @endcode
 *
 * @param instance the library handle
 * @param cookie the cookie passed in the callback
 * @param cmd command structure.
 * @return status code for scheduling.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_diag(lcb_INSTANCE *instance, void *cookie, const lcb_CMDDIAG *cmd);

/**@} (Group: PING) */

/* @ingroup lcb-public-api
 * @defgroup lcb-http HTTP Client
 * @brief Access Couchbase HTTP APIs
 * @details The low-level HTTP client may be used to access various HTTP-based
 * Couchbase APIs.
 *
 * Note that existing higher level APIs can be used for N1QL queries (see
 * @ref lcb-n1ql-api) and MapReduce view queries (see @ref lcb-view-api)
 *
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
    LCB_HTTP_TYPE_QUERY = 3,

    /** Search a fulltext index */
    LCB_HTTP_TYPE_SEARCH = 4,

    /** Execute an Analytics Query */
    LCB_HTTP_TYPE_ANALYTICS = 5,

    /**
     * Special pseudo-type, for ping endpoints in various services.
     * Behaves like RAW (the lcb_ping3() function will setup custom path),
     * but supports Keep-Alive
     */
    LCB_HTTP_TYPE_PING = 6,

    LCB_HTTP_TYPE_EVENTING = 7,

    LCB_HTTP_TYPE_MAX
} lcb_HTTP_TYPE;

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
} lcb_HTTP_METHOD;

/**
 * @committed
 * Issue an HTTP API request.
 * @param instance the library handle
 * @param cookie cookie to be associated with the request
 * @param cmd the command
 * @return LCB_SUCCESS if the request was scheduled successfully.
 *
 *
 * @par Simple Response
 * @code{.c}
 * void http_callback(lcb_INSTANCE, int, const lcb_RESPBASE *rb)
 * {
 *     const lcb_RESPHTTP *resp = (const lcb_RESPHTTP *)rb;
 *     lcb_STATUS rc = lcb_resphttp_status(resp);
 *     uint16_t http_status;
 *     char* body;
 *     size_t body_len;
 *     const char* const* headers;
 *     lcb_resphttp_http_status(resp, &http_status);
 *     lcb_resphttp_body(resp, &body, &body_len);
 *     if (rc != LCB_SUCCESS) {
 *         printf("I/O Error for HTTP: %s\n", lcb_strerror_short(rc));
 *         return;
 *     }
 *     printf("Got HTTP Status: %d\n", http_status);
 *     printf("Got paylod: %.*s\n", body_len, body);
 *     lcb_resphttp_headers(resp, &headers);
 *     if (headers) {
 *         for(const char* const* cur = headers; *cur; cur+=2) {
 *             printf("%s: %s\n", cur[0], cur[1]);
 *         }
 *     }
 * }
 * @endcode
 *
 * @par Streaming Response
 * If the @ref LCB_CMDHTTP_F_STREAM flag is set in lcb_CMDHTTP::cmdflags then the
 * response callback is invoked multiple times as data arrives off the socket.
 * @code{.c}
 * void http_strm_callback(lcb_INSTANCE, int, const lcb_RESPBASE *rb)
 * {
 *     const lcb_RESPHTTP *resp = (const lcb_RESPHTTP *)resp;
 *     char* body;
 *     size_t body_len;
 *     const char* const* headers;
 *     if (lcb_resphttp_is_final(resp)) {
 *         if (lcb_resphttp_status(resp) != LCB_SUCCESS) {
 *             // ....
 *         }
 *         lcb_resphttp_headers(resp, &headers);
 *         if (headers) {
 *         // ...
 *         }
 *     } else {
           lcb_resphttp_body(resp, &body, &body_len);
 *         handle_body(body, body_len);
 *     }
 * }
 * @endcode
 *
 * @par Connection Reuse
 * The library will attempt to reuse connections for frequently contacted hosts.
 * By default the library will keep one idle connection to each host for a maximum
 * of 10 seconds. The number of open idle HTTP connections can be controlled with
 * @ref LCB_CNTL_HTTP_POOLSIZE.
 *
 */

typedef struct lcb_RESPHTTP_ lcb_RESPHTTP;

LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_status(const lcb_RESPHTTP *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_cookie(const lcb_RESPHTTP *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_http_status(const lcb_RESPHTTP *resp, uint16_t *status);
LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_path(const lcb_RESPHTTP *resp, const char **path, size_t *path_len);
LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_body(const lcb_RESPHTTP *resp, const char **body, size_t *body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_handle(const lcb_RESPHTTP *resp, lcb_HTTP_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_error_context(const lcb_RESPHTTP *resp, const lcb_HTTP_ERROR_CONTEXT **ctx);

LIBCOUCHBASE_API int lcb_resphttp_is_final(const lcb_RESPHTTP *resp);
/**
 * List of key-value headers. This field itself may be `NULL`. The list
 * is terminated by a `NULL` pointer to indicate no more headers.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_resphttp_headers(const lcb_RESPHTTP *resp, const char *const **headers);

typedef struct lcb_CMDHTTP_ lcb_CMDHTTP;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_create(lcb_CMDHTTP **cmd, lcb_HTTP_TYPE type);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_destroy(lcb_CMDHTTP *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_parent_span(lcb_CMDHTTP *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_method(lcb_CMDHTTP *cmd, lcb_HTTP_METHOD method);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_path(lcb_CMDHTTP *cmd, const char *path, size_t path_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_content_type(lcb_CMDHTTP *cmd, const char *content_type,
                                                     size_t content_type_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_body(lcb_CMDHTTP *cmd, const char *body, size_t body_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_handle(lcb_CMDHTTP *cmd, lcb_HTTP_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_username(lcb_CMDHTTP *cmd, const char *username, size_t username_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_password(lcb_CMDHTTP *cmd, const char *password, size_t password_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_host(lcb_CMDHTTP *cmd, const char *host, size_t host_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_streaming(lcb_CMDHTTP *cmd, int streaming);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_skip_auth_header(lcb_CMDHTTP *cmd, int skip_auth);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdhttp_timeout(lcb_CMDHTTP *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_http(lcb_INSTANCE *instance, void *cookie, const lcb_CMDHTTP *cmd);

/**
 * @brief Cancel ongoing HTTP request
 *
 * This API will stop the current request. Any pending callbacks will not be
 * invoked any any pending data will not be delivered. Useful for a long running
 * request which is no longer needed
 *
 * @param instance The handle to lcb
 * @param handle The request handle
 *
 * @committed
 *
 * @par Example
 * @code{.c}
 * lcb_CMDHTTP* cmd;
 * lcb_HTTP_HANDLE* handle;
 * lcb_cmdhttp_create(&cmd);
 * // flesh out the actual request...
 *
 * lcb_http(instance, cookie, cmd);
 * lcb_cmdhttp_handle(cmd, &handle);
 * do_stuff();
 * lcb_cancel_http_request(instance, handle);
 * @endcode
 */
LIBCOUCHBASE_API lcb_STATUS lcb_http_cancel(lcb_INSTANCE *instance, lcb_HTTP_HANDLE *handle);

/**@} (Group: HTTP) */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-cookie User Cookies
 * @brief Associate user-defined data with operations
 * @details
 *
 * User-defined pointers may be passed to all operations in the form of a
 * `cookie` parameter. This cookie parameter allows any kind of application
 * context to be accessible via the callback (in lcb_RESPBASE::cookie).
 *
 * The library will not inspect or manage the address or contents of the
 * cookie; it may live on the stack (especially if using the library
 * synchronously), on the heap, or may be NULL altogether.
 *
 * In addition to per-operation cookies, the library allows the instance itself
 * (i.e. the `lcb_INSTANCE` object) to contain its own cookie. This is helpful when
 * there is a wrapper object which needs to be accessed from within the callback
 *
 * @addtogroup lcb-cookie
 * @{
 */

/**
 * Associate a cookie with an instance of lcb. The _cookie_ is a user defined
 * pointer which will remain attached to the specified `lcb_INSTANCE` for its duration.
 * This is the way to associate user data with the `lcb_INSTANCE`.
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
 * static void bootstrap_callback(lcb_INSTANCE *instance, lcb_STATUS err) {
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
 *   lcb_wait(instance, LCB_WAIT_DEFAULT);
 *   printf("Status of instance is %s\n", info->status);
 * }
 * @endcode
 */
LIBCOUCHBASE_API
void lcb_set_cookie(lcb_INSTANCE *instance, const void *cookie);

/**
 * Retrieve the cookie associated with this instance
 * @param instance the instance of lcb
 * @return The cookie associated with this instance or NULL
 * @see lcb_set_cookie()
 * @committed
 */
LIBCOUCHBASE_API
const void *lcb_get_cookie(lcb_INSTANCE *instance);
/**@} (Group: Cookies) */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-wait Waiting
 * @brief Functions for synchronous I/O execution
 * @details The lcb_wait() family of functions allow to control when the
 * library sends the operations to the cluster and waits for their execution.
 *
 * It is also possible to use non-blocking I/O with the library
 *
 * @addtogroup lcb-wait
 * @{
 */

/**
 * @volatile
 * This function will cause a single "tick" in the underlying event loop,
 * causing operations whose I/O can be executed immediately to be sent to
 * the server.
 *
 * Like lcb_wait(), callbacks for operations may be delivered here, however
 * some operations may be left incomplete if their I/O could not be processed
 * immediately. This function is intended as an optimization for large batches
 * of operations - so that some I/O can be completed during the batching process
 * itself, and only the remainder of those operations (which would have blocked)
 * will be completed with lcb_wait() (which should be invoked after the batch).
 *
 * This function is mainly useful if there is a significant delay in time
 * between each scheduling function, in which I/O may be completed during these
 * gaps (thereby emptying the socket's kernel write buffer, and allowing for
 * new operations to be added after the interval). Calling this function for
 * batches where all data is available up-front may actually make things slower.
 *
 * @warning
 * You must call lcb_wait() at least one after any batch of operations to ensure
 * they have been completed. This function is provided as an optimization only.
 *
 * @return LCB_ERR_SDK_FEATURE_UNAVAILABLE if the event loop does not support
 * the "tick" mode.
 */
LIBCOUCHBASE_API
lcb_STATUS lcb_tick_nowait(lcb_INSTANCE *instance);

/**@brief Flags for lcb_wait()*/
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
lcb_STATUS lcb_wait(lcb_INSTANCE *instance, lcb_WAITFLAGS flags);

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
void lcb_breakout(lcb_INSTANCE *instance);

/**
 * @brief Check if instance is blocked in the event loop
 * @param instance the instance to run the event loop for.
 * @return non-zero if nobody is waiting for IO interaction
 * @uncommitted
 */
LIBCOUCHBASE_API
int lcb_is_waiting(lcb_INSTANCE *instance);
/**@} (Group: Wait) */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-sched Advanced Scheduling
 * @brief Additional functions for scheduling operations
 *
 * @details
 *
 * An application may spool multiple operations into the library with the
 * option of unspooling previously-spooled operations in case one of
 * the operations cannot be spooled. These semantics exist primarily to
 * support "all-or-nothing" scheduling found in the V2 API as well as in
 * some other wrapping SDKs.
 *
 * From version 2.4.0 to version 2.5.5, use of the explicit scheduling
 * API was mandatory to schedule operations. This API is optional since 2.5.6.
 *
 * The following operation APIs are low level entry points which create a
 * single operation. To use these operation APIs you should call the
 * lcb_sched_enter() which creates a virtual scope in which to create operations.
 *
 * For each of these operation APIs, the actual API call will insert the
 * created packet into a "Scheduling Queue" (this is done through
 * mcreq_sched_add() which is in mcreq.h). You may add as many items to this
 * scheduling queue as you would like.
 *
 * Note that an operation is only added to the queue if it was able to be
 * scheduled properly. If a scheduling failure occurred (for example, if a
 * configuration is missing, the command had invalid input, or memory allocation
 * failed) then the command will not be placed into the queue.
 *
 * Once all operations have been scheduled you can call
 * lcb_sched_leave() which will place all commands scheduled into the I/O
 * queue.
 *
 * If you wish to _discard_ all scheduled operations (for example, if one of
 * them errored, and your application cannot handle partial scheduling failures)
 * then you may call lcb_sched_fail() which will release all the resources
 * of the packets placed into the temporary queue.
 *
 * @par Behavior from version 2.5.6
 *
 * Starting from version 2.5.6, use of this API is optional. Scheduling functions
 * will now check if an empty call to lcb_sched_enter() is present. If no call
 * to lcb_sched_enter() is found then the library will implicitly call
 * lcb_sched_leave().
 *
 * @addtogroup lcb-sched
 * @{
 */

/**
 * @brief Enter a scheduling context.
 *
 * @uncommitted
 *
 * A scheduling context is an ephemeral list of
 * commands issued to various servers. Operations (like lcb_get3(), lcb_store3())
 * place packets into the current context.
 *
 * The context mechanism allows you to efficiently pipeline and schedule multiple
 * operations of different types and quantities. The network is not touched
 * and nothing is scheduled until the context is exited.
 *
 * @param instance the instance
 *
 * @code{.c}
 * lcb_sched_enter(instance);
 * lcb_get(...);
 * lcb_store(...);
 * lcb_counter(...);
 * lcb_sched_leave(instance);
 * lcb_wait(instance, LCB_WAIT_NOCHECK);
 * @endcode
 */
LIBCOUCHBASE_API
void lcb_sched_enter(lcb_INSTANCE *instance);

/**
 * @uncommitted
 *
 * @brief Leave the current scheduling context, scheduling the commands within the
 * context to be flushed to the network.
 *
 * @details This will initiate a network-level flush (depending on the I/O system)
 * to the network. For completion-based I/O systems this typically means
 * allocating a temporary write context to contain the buffer. If using a
 * completion-based I/O module (for example, Windows or libuv) then it is
 * recommended to limit the number of calls to one per loop iteration. If
 * limiting the number of calls to this function is not possible (for example,
 * if the legacy API is being used, or you wish to use implicit scheduling) then
 * the flushing may be decoupled from this function - see the documentation for
 * lcb_sched_flush().
 *
 * @param instance the instance
 */
LIBCOUCHBASE_API
void lcb_sched_leave(lcb_INSTANCE *instance);

/**
 * @uncommitted
 * @brief Fail all commands in the current scheduling context.
 *
 * The commands placed within the current
 * scheduling context are released and are never flushed to the network.
 * @param instance
 *
 * @warning
 * This function only affects commands which have a direct correspondence
 * to memcached packets. Currently these are commands scheduled by:
 *
 * * lcb_get()
 * * lcb_getreplica()
 * * lcb_unlock()
 * * lcb_touch()
 * * lcb_store()
 * * lcb_counter()
 * * lcb_remove()
 *
 * Other commands are _compound_ commands and thus should be in their own
 * scheduling context.
 */
LIBCOUCHBASE_API
void lcb_sched_fail(lcb_INSTANCE *instance);

/**
 * @committed
 * @brief Request commands to be flushed to the network
 *
 * By default, the library will implicitly request a flush to the network upon
 * every call to lcb_sched_leave().
 *
 * [ Note, this does not mean the items are flushed
 * and I/O is performed, but it means the relevant event loop watchers are
 * activated to perform the operations on the next iteration ]. If
 * @ref LCB_CNTL_SCHED_IMPLICIT_FLUSH
 * is disabled then this behavior is disabled and the
 * application must explicitly call lcb_sched_flush(). This may be considered
 * more performant in the cases where multiple discreet operations are scheduled
 * in an lcb_sched_enter()/lcb_sched_leave() pair. With implicit flush enabled,
 * each call to lcb_sched_leave() will possibly invoke system repeatedly.
 */
LIBCOUCHBASE_API
void lcb_sched_flush(lcb_INSTANCE *instance);

/**@} (Group: Adanced Scheduling) */

/* @ingroup lcb-public-api
 * @defgroup lcb-destroy Destroying
 * @brief Library destruction routines
 * @addtogroup lcb-destroy
 * @{
 */
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
void lcb_destroy(lcb_INSTANCE *instance);

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
lcb_destroy_callback lcb_set_destroy_callback(lcb_INSTANCE *instance, lcb_destroy_callback);
/**
 * @brief Asynchronously schedule the destruction of an instance.
 *
 * This function provides a safe way for asynchronous environments to destroy
 * the lcb_INSTANCE *handle without worrying about reentrancy issues.
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
void lcb_destroy_async(lcb_INSTANCE *instance, const void *arg);
/**@} (Group: Destroy) */

/** @internal */
#define LCB_DATATYPE_JSON 0x01

/** @internal */
typedef enum { LCB_VALUE_RAW = 0x00, LCB_VALUE_F_JSON = 0x01, LCB_VALUE_F_SNAPPYCOMP = 0x02 } lcb_VALUEFLAGS;

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-cntl Settings
 * @brief Get/Set Library Options
 *
 * @details
 *
 * The lcb_cntl() function and its various helpers are the means by which to
 * modify settings within the library
 *
 * @addtogroup lcb-cntl
 * @see <cntl.h>
 * @{
 */

/**
 * This function exposes an ioctl/fcntl-like interface to read and write
 * various configuration properties to and from an lcb_INSTANCE *handle.
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
 * @return ::LCB_ERR_UNSUPPORTED_OPERATION if the code is unrecognized
 * @return ::LCB_ERR_INVALID_ARGUMENT if there was a problem with the argument
 *         (typically for LCB_CNTL_SET) other error codes depending on the command.
 *
 * The following error codes are returned if the ::LCB_CNTL_DETAILED_ERRCODES
 * are enabled.
 *
 * @return ::LCB_ECTL_UNKNOWN if the code is unrecognized
 * @return ::LCB_ECTL_UNSUPPMODE An invalid _mode_ was passed
 * @return ::LCB_ERR_CONTROL_INVALID_ARGUMENT if the value was invalid
 *
 * @committed
 *
 * @see lcb_cntl_setu32()
 * @see lcb_cntl_string()
 */
LIBCOUCHBASE_API
lcb_STATUS lcb_cntl(lcb_INSTANCE *instance, int mode, int cmd, void *arg);

/**
 * Alternatively one may change configuration settings by passing a string key
 * and value. This may be used to provide a simple interface from a command
 * line or higher level language to allow the setting of specific key-value
 * pairs.
 *
 * The format for the value is dependent on the option passed, the following
 * value types exist:
 *
 * - **Timeval**. A _timeval_ value can either be specified as fractional
 *   seconds (`"1.5"` for 1.5 seconds), or in microseconds (`"1500000"`). In
 *   releases prior to libcouchbase 2.8, this was called _timeout_.
 * - **Number**. This is any valid numerical value. This may be signed or
 *   unsigned depending on the setting.
 * - **Boolean**. This specifies a boolean. A true value is either a positive
 *   numeric value (i.e. `"1"`) or the string `"true"`. A false value
 *   is a zero (i.e. `"0"`) or the string `"false"`.
 * - **Float**. This is like a _Number_, but also allows fractional specification,
 *   e.g. `"2.4"`.
 * - **String**. Arbitrary string as `char *`, e.g. for client identification
 *   string.
 * - **Path**. File path.
 * - **FILE*, Path**. Set file stream pointer (lcb_cntl() style) or file path
 *   (lcb_cntl_string() style).
 *
 * | Code                                    | Name                      | Type              |
 * |-----------------------------------------|---------------------------|-------------------|
 * |@ref LCB_CNTL_OP_TIMEOUT                 | `"operation_timeout"`     | Timeval           |
 * |@ref LCB_CNTL_VIEW_TIMEOUT               | `"view_timeout"`          | Timeval           |
 * |@ref LCB_CNTL_QUERY_TIMEOUT              | `"n1ql_timeout"`          | Timeval           |
 * |@ref LCB_CNTL_HTTP_TIMEOUT               | `"http_timeout"`          | Timeval           |
 * |@ref LCB_CNTL_CONFIG_POLL_INTERVAL       | `"config_poll_interval"`  | Timeval           |
 * |@ref LCB_CNTL_CONFERRTHRESH              | `"error_thresh_count"`    | Number (Positive) |
 * |@ref LCB_CNTL_CONFIGURATION_TIMEOUT      | `"config_total_timeout"`  | Timeval           |
 * |@ref LCB_CNTL_CONFIG_NODE_TIMEOUT        | `"config_node_timeout"`   | Timeval           |
 * |@ref LCB_CNTL_CONFDELAY_THRESH           | `"error_thresh_delay"`    | Timeval           |
 * |@ref LCB_CNTL_DURABILITY_TIMEOUT         | `"durability_timeout"`    | Timeval           |
 * |@ref LCB_CNTL_DURABILITY_INTERVAL        | `"durability_interval"`   | Timeval           |
 * |@ref LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS  | `"randomize_nodes"`       | Boolean           |
 * |@ref LCB_CNTL_CONFIGCACHE                | `"config_cache"`          | Path              |
 * |@ref LCB_CNTL_DETAILED_ERRCODES          | `"detailed_errcodes"`     | Boolean           |
 * |@ref LCB_CNTL_HTCONFIG_URLTYPE           | `"http_urlmode"`          | Number (enum #lcb_HTCONFIG_URLTYPE) |
 * |@ref LCB_CNTL_RETRY_INTERVAL             | `"retry_interval"`        | Timeval           |
 * |@ref LCB_CNTL_HTTP_POOLSIZE              | `"http_poolsize"`         | Number            |
 * |@ref LCB_CNTL_VBGUESS_PERSIST            | `"vbguess_persist"`       | Boolean           |
 * |@ref LCB_CNTL_CONLOGGER_LEVEL            | `"console_log_level"`     | Number (enum #lcb_log_severity_t) |
 * |@ref LCB_CNTL_ENABLE_MUTATION_TOKENS     | `"enable_mutation_tokens"`| Boolean           |
 * |@ref LCB_CNTL_TCP_NODELAY                | `"tcp_nodelay"`           | Boolean           |
 * |@ref LCB_CNTL_CONLOGGER_FP               | `"console_log_file"`      | FILE*, Path       |
 * |@ref LCB_CNTL_CLIENT_STRING              | `"client_string"`         | String            |
 * |@ref LCB_CNTL_TCP_KEEPALIVE              | `"tcp_keepalive"`         | Boolean           |
 * |@ref LCB_CNTL_CONFIG_POLL_INTERVAL       | `"config_poll_interval"`  | Timeval           |
 * |@ref LCB_CNTL_IP6POLICY                  | `"ipv6"`                  | String ("disabled", "only", "allow") |
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
lcb_STATUS lcb_cntl_string(lcb_INSTANCE *instance, const char *key, const char *value);

/**
 * @brief Convenience function to set a value as an lcb_U32
 * @param instance
 * @param cmd setting to modify
 * @param arg the new value
 * @return see lcb_cntl() for details
 * @committed
 */
LIBCOUCHBASE_API
lcb_STATUS lcb_cntl_setu32(lcb_INSTANCE *instance, int cmd, lcb_U32 arg);

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
lcb_U32 lcb_cntl_getu32(lcb_INSTANCE *instance, int cmd);

/**
 * Determine if a specific control code exists
 * @param ctl the code to check for
 * @return 0 if it does not exist, nonzero if it exists.
 */
LIBCOUCHBASE_API
int lcb_cntl_exists(int ctl);

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
 *   `LCB_ERR_NO_MATCHING_SERVER` for the given item and will not request a new
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
 * received, you _must_ call lcb_wait() with the LCB_WAIT_NO_CHECK flag as
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
 * lcb_STATUS err;
 * do {
 *   retries--;
 *   err = lcb_get(instance, cookie, ncmds, cmds);
 *   if (err == LCB_ERR_NO_MATCHING_SERVER) {
 *     lcb_refresh_config(instance);
 *     usleep(100000);
 *     lcb_wait(instance, LCB_WAIT_NO_CHECK);
 *   } else {
 *     break;
 *   }
 * } while (retries);
 * if (err == LCB_SUCCESS) {
 *   lcb_wait(instance, 0); // equivalent to lcb_wait(instance, LCB_WAIT_DEFAULT);
 * } else {
 *   printf("Tried multiple times to fetch the key, but its node is down\n");
 * }
 * @endcode
 */

LIBCOUCHBASE_API
void lcb_refresh_config(lcb_INSTANCE *instance);

/**@}*/

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-build-info Build Information
 * @brief Get library version and supported features
 * @details
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

/** Global/extern variable containing the version of the library */
LIBCOUCHBASE_API LCB_EXTERN_VAR const lcb_U32 lcb_version_g;

/**@brief Whether the library has SSL support*/
#define LCB_SUPPORTS_SSL 1
/**@brief Whether the library has experimental compression support */
#define LCB_SUPPORTS_SNAPPY 2
/**@brief Whether the library has experimental tracing support */
#define LCB_SUPPORTS_TRACING 3

/**
 * @committed
 * Determine if this version has support for a particularl feature
 * @param n the feature ID to check for
 * @return 0 if not supported, nonzero if supported.
 */
LIBCOUCHBASE_API
int lcb_supports_feature(int n);

/**@} (Group: Build Info) */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-logging-api Logging
 * @brief Various logging functions
 * @addtogroup lcb-logging-api
 * @{
 */
/**
 * Returns whether the library redacting logs for this connection instance.
 * @param instance the instance
 * @return non-zero if the logs are being redacted for this instance.
 */
LIBCOUCHBASE_API
int lcb_is_redacting_logs(lcb_INSTANCE *instance);

/** @} */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-analytics-api Analytics Queries
 * @brief Execute Analytics N1QL Queries
 * @addtogroup lcb-analytics-api
 * @{
 */

typedef struct lcb_ANALYTICS_HANDLE_ lcb_ANALYTICS_HANDLE;
typedef struct lcb_DEFERRED_HANDLE_ lcb_DEFERRED_HANDLE;

/**
 * Response for a Analytics query. This is delivered in the @ref lcb_ANALYTICSCALLBACK
 * callback function for each result row received. The callback is also called
 * one last time when all
 */
typedef struct lcb_RESPANALYTICS_ lcb_RESPANALYTICS;

/**
 * Callback to be invoked for each row
 * @param The instance
 * @param Callback type. This is set to @ref LCB_CALLBACK_ANALYTICS
 * @param The response.
 */
typedef void (*lcb_ANALYTICS_CALLBACK)(lcb_INSTANCE *, int, const lcb_RESPANALYTICS *);

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_status(const lcb_RESPANALYTICS *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_cookie(const lcb_RESPANALYTICS *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_row(const lcb_RESPANALYTICS *resp, const char **row, size_t *row_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_http_response(const lcb_RESPANALYTICS *resp, const lcb_RESPHTTP **http);
/**
 * Get handle to analytics query.  Used when canceling analytics request.  See @ref lcb_cmdanalytics_handle also
 *
 * @param resp the analytics response
 * @param handle pointer to handle pointer
 * @return LCB_SUCCESS if successful, otherwise an error code
 */
LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_handle(const lcb_RESPANALYTICS *resp, lcb_ANALYTICS_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_error_context(const lcb_RESPANALYTICS *resp,
                                                            const lcb_ANALYTICS_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API int lcb_respanalytics_is_final(const lcb_RESPANALYTICS *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_deferred_handle_extract(const lcb_RESPANALYTICS *resp,
                                                                      lcb_DEFERRED_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_destroy(lcb_DEFERRED_HANDLE *handle);
LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_status(lcb_DEFERRED_HANDLE *handle, const char **status,
                                                       size_t *status_len);
LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_callback(lcb_DEFERRED_HANDLE *handle, lcb_ANALYTICS_CALLBACK callback);
LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_poll(lcb_INSTANCE *instance, void *cookie, lcb_DEFERRED_HANDLE *handle);

typedef struct lcb_CMDANALYTICS_ lcb_CMDANALYTICS;

typedef struct lcb_INGEST_OPTIONS_ lcb_INGEST_OPTIONS;
typedef enum {
    LCB_INGEST_METHOD_NONE = 0,
    LCB_INGEST_METHOD_UPSERT,
    LCB_INGEST_METHOD_INSERT,
    LCB_INGEST_METHOD_REPLACE,
    LCB_INGEST_METHOD__MAX
} lcb_INGEST_METHOD;

typedef enum {

    /** @brief No consistency constraints
     *  @details
     *  The default.  When you are not concerned about the consistency of this query with regards to other queries.
     */
    LCB_ANALYTICS_CONSISTENCY_NOT_BOUNDED = 0,
    /**  @brief Strong consistency
     *   @details
     *   Ensures that the query won't execute until any pending indexing at the time of the request has completed.
     */
    LCB_ANALYTICS_CONSISTENCY_REQUEST_PLUS = 1
} lcb_ANALYTICS_CONSISTENCY;

typedef enum { LCB_INGEST_STATUS_OK = 0, LCB_INGEST_STATUS_IGNORE, LCB_INGEST_STATUS__MAX } lcb_INGEST_STATUS;

typedef struct lcb_INGEST_PARAM_ lcb_INGEST_PARAM;

typedef lcb_INGEST_STATUS (*lcb_INGEST_DATACONVERTER_CALLBACK)(lcb_INSTANCE *instance, lcb_INGEST_PARAM *param);

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_create(lcb_INGEST_OPTIONS **options);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_destroy(lcb_INGEST_OPTIONS *options);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_method(lcb_INGEST_OPTIONS *options, lcb_INGEST_METHOD method);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_expiry(lcb_INGEST_OPTIONS *options, uint32_t expiration);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_ignore_error(lcb_INGEST_OPTIONS *options, int flag);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_data_converter(lcb_INGEST_OPTIONS *options,
                                                              lcb_INGEST_DATACONVERTER_CALLBACK callback);

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_cookie(lcb_INGEST_PARAM *param, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_row(lcb_INGEST_PARAM *param, const char **row,
                                                               size_t *row_len);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_method(lcb_INGEST_PARAM *param, lcb_INGEST_METHOD *method);
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_set_id(lcb_INGEST_PARAM *param, const char *id,
                                                                  size_t id_len, void (*id_dtor)(const char *));
LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_set_out(lcb_INGEST_PARAM *param, const char *out,
                                                                   size_t out_len, void (*out_dtor)(const char *));

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_create(lcb_CMDANALYTICS **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_destroy(lcb_CMDANALYTICS *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_reset(lcb_CMDANALYTICS *cmd);
/**@}*/
/**
 * @ingroup lcb-public-api
 * @addtogroup lcb-tracing-api
 * @{
 */
/**
 * Associate parent tracing span with the Analytics request.
 *
 * @param cmd the command
 * @param span parent span
 *
 * @par Attach parent tracing span to request object.
 * @code{.c}
 * lcb_CMDANALYTICS* cmd;
 * lcb_cmdanalytics_create(&cmd);
 *
 * lcb_analytics_parentspan(instance, span);
 *
 * lcb_error_t err = lcb_analytics_query(instance, cookie, cmd);
 * @endcode
 *
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_parent_span(lcb_CMDANALYTICS *cmd, lcbtrace_SPAN *span);
/**@}*/
/**
 * @ingroup lcb-public-api
 * @addtogroup lcb-analytics-api
 * @{
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_callback(lcb_CMDANALYTICS *cmd, lcb_ANALYTICS_CALLBACK callback);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_encoded_payload(lcb_CMDANALYTICS *cmd, const char **query,
                                                             size_t *query_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_payload(lcb_CMDANALYTICS *cmd, const char *query, size_t query_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_statement(lcb_CMDANALYTICS *cmd, const char *statement,
                                                       size_t statement_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_named_param(lcb_CMDANALYTICS *cmd, const char *name, size_t name_len,
                                                         const char *value, size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_positional_param(lcb_CMDANALYTICS *cmd, const char *value,
                                                              size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_ingest_options(lcb_CMDANALYTICS *cmd, lcb_INGEST_OPTIONS *options);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_deferred(lcb_CMDANALYTICS *cmd, int deferred);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_client_context_id(lcb_CMDANALYTICS *cmd, const char *value,
                                                               size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_readonly(lcb_CMDANALYTICS *cmd, int readonly);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_priority(lcb_CMDANALYTICS *cmd, int priority);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_consistency(lcb_CMDANALYTICS *cmd, lcb_ANALYTICS_CONSISTENCY level);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_option(lcb_CMDANALYTICS *cmd, const char *name, size_t name_len,
                                                    const char *value, size_t value_len);
/**
 * Associate scope name with the query
 * @param cmd the command
 * @param scope the name of the scope
 * @param scope_len length of the scope name string.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_scope_name(lcb_CMDANALYTICS *cmd, const char *scope, size_t scope_len);
/**
 * @uncommitted
 *
 * Associate scope_qualifier (also known as `query_context`) with the query.
 *
 * The qualifier must be in form `${bucket_name}.${scope_name}` or `default:${bucket_name}.${scope_name}`.
 *
 * @param cmd the command
 * @param qualifier the string containing qualifier
 * @param qualifier_len length of the qualifier
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_scope_qualifier(lcb_CMDANALYTICS *cmd, const char *qualifier,
                                                             size_t qualifier_len);
/**
 * Get handle to analytics query.  Used when canceling a request.  See @ref lcb_respanalytics_handle as well
 *
 * @param cmd the command
 * @param handle pointer to handle pointer
 * @return LCB_SUCCESS if successful, otherwise an error code
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_handle(lcb_CMDANALYTICS *cmd, lcb_ANALYTICS_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_timeout(lcb_CMDANALYTICS *cmd, uint32_t timeout);
/**
 * Execute a Analytics query.
 *
 * This function will send the query to a query server in the cluster
 * and will invoke the callback (lcb_CMDANALYTICS::callback) for each result returned.
 *
 * @param instance The instance
 * @param cookie Pointer to application data
 * @param cmd the command
 * @return LCB_SUCCESS if successfully scheduled otherwise a failure.
 */

LIBCOUCHBASE_API lcb_STATUS lcb_analytics(lcb_INSTANCE *instance, void *cookie, const lcb_CMDANALYTICS *cmd);
/**
 * Cancels an in-progress request. This will ensure that further callbacks
 * for the given request are not delivered.
 *
 * @param instance the instance
 * @param handle the handle for the request. This can be obtained from the command (see @ref lcb_cmdanalytics_handle),
 *      or from the response (see @ref lcb_respanalytics_handle)
 *
 * To obtain the `handle` parameter, do something like this:
 *
 * @code{.c}
 * lcb_CMDANALYTICS *cmd;
 * // (Initialize command...)
 * lcb_analytics(instance, cookie, &cmd);
 * lcb_ANALYTICS_HANDLE* handle;
 * lcb_cmdanalytics_gethandle(cmd, &handle);
 * @endcode
 *
 * If you happen to only have the lcb_RESPANALYTICS handy, say you are in the
 * callback:
 * @code{.c}
 * lcb_ANALYTICS_HANDLE* handle;
 * lcb_respanalytics_handle(resp, &handle);
 * @endcode
 *
 * If the lcb_analytics_query() function returns `LCB_SUCCESS` then the `handle`
 * above is populated with the opaque handle. You can then use this handle
 * to cancel the query at a later point, such as within the callback.
 *
 * @code{.c}
 * lcb_analytics_cancel(instance, handle);
 * @endcode
 */
LIBCOUCHBASE_API lcb_STATUS lcb_analytics_cancel(lcb_INSTANCE *instance, lcb_ANALYTICS_HANDLE *handle);

/** @} */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-cbft-api Full Text Search
 * @brief Search for strings in documents and more
 */

/**
 * @addtogroup lcb-cbft-api
 * @{
 */
typedef struct lcb_SEARCH_HANDLE_ lcb_SEARCH_HANDLE;
typedef struct lcb_RESPSEARCH_ lcb_RESPSEARCH;

LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_status(const lcb_RESPSEARCH *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_cookie(const lcb_RESPSEARCH *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_row(const lcb_RESPSEARCH *resp, const char **row, size_t *row_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_http_response(const lcb_RESPSEARCH *resp, const lcb_RESPHTTP **http);
/**
 * Get search handle from search response.  Used to cancel a request.  See @ref lcb_cmdsearch_handle as well
 *
 * @param resp the search response
 * @param handle pointer to handle pointer
 * @return LCB_SUCCESS if successful, otherwise an error code
 */
LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_handle(const lcb_RESPSEARCH *resp, lcb_SEARCH_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_error_context(const lcb_RESPSEARCH *resp,
                                                         const lcb_SEARCH_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API int lcb_respsearch_is_final(const lcb_RESPSEARCH *resp);

typedef struct lcb_CMDSEARCH_ lcb_CMDSEARCH;
typedef void (*lcb_SEARCH_CALLBACK)(lcb_INSTANCE *, int, const lcb_RESPSEARCH *);

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_create(lcb_CMDSEARCH **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_destroy(lcb_CMDSEARCH *cmd);
/**@}*/

/**
 * @ingroup lcb-public-api
 * @addtogroup lcb-tracing-api
 * @{
 */
/**
 * Associate parent tracing span with the FTS request.
 *
 * @param cmd the command
 * @param span parent span
 *
 * @par Attach parent tracing span to request object.
 * @code{.c}
 * lcb_CMDSEARCH cmd;
 * lcb_cmdsearch_create(&cmd);
 * // create a search query...

 * lcb_error_t err = lcb_search(instance, cookie, cmd);
 * if (err == LCB_SUCCESS) {
 *     lcb_cmdsearch_parent_span(instance, span);
 * }
 * @endcode
 *
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_parent_span(lcb_CMDSEARCH *cmd, lcbtrace_SPAN *span);
/**@}*/
/**
 * @ingroup lcb-public-api
 * @addtogroup lcb-cbft-api
 * @{
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_callback(lcb_CMDSEARCH *cmd, lcb_SEARCH_CALLBACK callback);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_payload(lcb_CMDSEARCH *cmd, const char *payload, size_t payload_len);
/**
 * Obtain handle to search.  Used to cancel a query.  See @ref lcb_respsearch_handle as well
 * @param cmd the command
 * @param handle pointer to handle pointer
 * @return LCB_SUCCESS upon success, otherwise an error code
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_handle(lcb_CMDSEARCH *cmd, lcb_SEARCH_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_timeout(lcb_CMDSEARCH *cmd, uint32_t timeout);

/**
 * Issue a full-text query. The callback (lcb_SEARCH_CALLBACK) will be invoked
 * for each hit. It will then be invoked one last time with the result
 * metadata (including any facets) and the lcb_resp_is_final will return
 * true.
 *
 * @param instance the instance
 * @param cookie opaque user cookie to be set in the response object
 * @param cmd command containing the query and callback
 * @return LCB_SUCCESS if successfully scheduled, otherwise an error.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_search(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSEARCH *cmd);
/**
 * Cancel a full-text query in progress. The handle is usually obtained via the
 * lcb_cmdsearch_handle call
 * @param instance the instance
 * @param handle the handle to the search.  See @ref lcb_cmdsearch_handle.
 * @return LCB_SUCCESS if successful, otherwise an error.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_search_cancel(lcb_INSTANCE *instance, lcb_SEARCH_HANDLE *handle);
/** @} */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-n1ql-api N1QL Queries
 * @brief Execute N1QL queries.
 *
 * Query language based on SQL, but designed for structured and flexible JSON
 * documents. Querying can solve typical programming tasks such as finding a
 * user profile by email address, performing aggregations etc.
 *
 * @code{.c}
 * const char *query = "{\"statement\":\"SELECT * FROM breweries LIMIT 10\"}";
 * lcb_CMDQUERY* cmd = NULL;
 * int cookie = 0;
 * lcb_cmdquery_create(&cmd);
 * lcb_cmdquery_callback(cmd, row_callback)
 * lcb_n1ql_query(instance, &cookie, cmd);
 * lcb_wait(instance, LCB_WAIT_DEFAULT);
 * @endcode
 *
 * Where row_callback might be implemented like this:
 *
 * @code{.c}
 * static void row_callback(lcb_INSTANCE *instance, int type, const lcb_RESPQUERY *resp)
 * {
 *     int* idx = NULL;
 *     int row_len = 0;
 *     char* row = NULL;
 *
 *     int rc = lcb_respquery_status(resp);
 *     if (rc != LCB_SUCCESS) {
 *         printf("failed to execute query: %s\n", lcb_strerror_short(rc));
 *         exit(EXIT_FAILURE);
 *     }
 *     lcb_respquery_cookie(resp, (void**)(&idx))
 *     if (lcb_respquery_is_final(resp)) {
 *         printf("META: ");
 *     } else {
 *         printf("ROW #%d: ", (*idx)++);
 *     }
 *     lcb_respquery_row(resp, &row_len, &row);
 *     printf("%.*s\n", row_len, row);
 * }
 * @endcode
 *
 * @see more details on @ref lcb_query and @ref lcb_CMDQUERY.
 *
 */

/**
 * @addtogroup lcb-n1ql-api
 * @{
 */

/**
 * Opaque query response structure
 */
typedef struct lcb_RESPQUERY_ lcb_RESPQUERY;

/**
 * Opaque query command structure
 */
typedef struct lcb_CMDQUERY_ lcb_CMDQUERY;
/**
 * Pointer for request instance
 */
typedef struct lcb_QUERY_HANDLE_ lcb_QUERY_HANDLE;

/**
 * Callback to be invoked for each row
 * @param The instance
 * @param Callback type. This is set to @ref LCB_CALLBACK_QUERY
 * @param The response.
 */
typedef void (*lcb_QUERY_CALLBACK)(lcb_INSTANCE *, int, const lcb_RESPQUERY *);

typedef enum {
    /** No consistency constraints */
    LCB_QUERY_CONSISTENCY_NONE = 0,

    /**
     * This is implicitly set by @ref lcb_cmdquery_consistency_token_for_keyspace. This
     * will ensure that mutations up to the vector indicated by the mutation token
     * passed to @ref lcb_cmdquery_consistency_token_for_keyspace are used.
     */
    LCB_QUERY_CONSISTENCY_RYOW = 1,

    /** Refresh the snapshot for each request */
    LCB_QUERY_CONSISTENCY_REQUEST = 2,

    /** Refresh the snapshot for each statement */
    LCB_QUERY_CONSISTENCY_STATEMENT = 3
} lcb_QUERY_CONSISTENCY;

typedef enum {
    LCB_QUERY_PROFILE_OFF = 0,
    LCB_QUERY_PROFILE_PHASES = 1,
    LCB_QUERY_PROFILE_TIMINGS = 2
} lcb_QUERY_PROFILE;

LIBCOUCHBASE_API lcb_STATUS lcb_respquery_status(const lcb_RESPQUERY *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respquery_cookie(const lcb_RESPQUERY *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respquery_row(const lcb_RESPQUERY *resp, const char **row, size_t *row_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respquery_http_response(const lcb_RESPQUERY *resp, const lcb_RESPHTTP **http);
LIBCOUCHBASE_API lcb_STATUS lcb_respquery_handle(const lcb_RESPQUERY *resp, lcb_QUERY_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_respquery_error_context(const lcb_RESPQUERY *resp, const lcb_QUERY_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API int lcb_respquery_is_final(const lcb_RESPQUERY *resp);
/**
 * Create a new lcb_CMDQUERY object. The returned object is an opaque
 * pointer which may be used to set various properties on a N1QL query.
 *
 * @param cmd pointer to an @ref lcb_CMDQUERY* which will be allocated
 * @return LCB_SUCCESS when successful, otherwise an error code
 */

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_create(lcb_CMDQUERY **cmd);
/**
 * Free the command structure. This should be done when it is no longer
 * needed
 * @param cmd the command to destroy
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_destroy(lcb_CMDQUERY *cmd);
/**
 * Reset the @ref lcb_CMDQUERY structure so that it may be reused for a subsequent
 * query.  Results in less memory allocator overhead that creating a cmd each time
 * you need one.
 *
 * @param cmd the command
 * @return LCB_SUCCESS when successful, otherwise an error code.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_reset(lcb_CMDQUERY *cmd);
/**
 * Get the JSON-encoded query payload.
 *
 * Helpful for re-issuing a query using @ref lcb_cmdquery_payload.
 * @param cmd the command
 * @param payload pointer to a string which will contain the payload
 * @param payload_len length of the payload string.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_encoded_payload(lcb_CMDQUERY *cmd, const char **payload, size_t *payload_len);
/**@}*/

/**
 * @ingroup lcb-public-api
 * @addtogroup lcb-tracing-api
 * @{
 */
/**
 * Associate parent tracing span with the N1QL request.
 *
 * @param cmd the command
 * @param span parent span
 *
 * @par Attach parent tracing span to request object.
 * @code{.c}
 * lcb_CMDQUERY* cmd;
 * lcb_cmdquery_create(&cmd);
 *
 * lcb_error_t err = lcb_query(instance, cookie, cmd);
 * if (err == LCB_SUCCESS) {
 *     lcb_cmdquery_parent_span(cmd, span);
 * }
 * @endcode
 *
 *
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_parent_span(lcb_CMDQUERY *cmd, lcbtrace_SPAN *span);
/**@}*/

/**
 * @ingroup lcb-public-api
 * @addtogroup lcb-n1ql-api
 * @{
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_callback(lcb_CMDQUERY *cmd, lcb_QUERY_CALLBACK callback);
/**
 * Sets the JSON-encodes query payload to be executed
 * @param cmd the command
 * @param query the query payload, as a JSON-encoded string.
 * @param query_len length of the query payload string.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_payload(lcb_CMDQUERY *cmd, const char *query, size_t query_len);
/**
 * Sets the actual statement to be executed
 * @param cmd the command
 * @param statement the query string.  Note it can contain placeholders for positional or named parameters.
 * @param statement_len length of the statement string.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_statement(lcb_CMDQUERY *cmd, const char *statement, size_t statement_len);
/**
 * Associate scope name with the query
 * @param cmd the command
 * @param scope the name of the scope
 * @param scope_len length of the scope name string.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scope_name(lcb_CMDQUERY *cmd, const char *scope, size_t scope_len);
/**
 * @uncommitted
 *
 * Associate scope_qualifier (also known as `query_context`) with the query.
 *
 * The qualifier must be in form `${bucket_name}.${scope_name}` or `default:${bucket_name}.${scope_name}`.
 *
 * @param cmd the command
 * @param qualifier the string containing qualifier
 * @param qualifier_len length of the qualifier
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scope_qualifier(lcb_CMDQUERY *cmd, const char *qualifier,
                                                         size_t qualifier_len);
/**
 * Sets a named argument for the query
 * @param cmd the command
 * @param name The argument name (e.g. `$age`)
 * @param name_len length of the name
 * @param value The argument value (e.g. `42`)
 * @param value_len length of the value
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_named_param(lcb_CMDQUERY *cmd, const char *name, size_t name_len,
                                                     const char *value, size_t value_len);
/**
 * Adds a _positional_ argument for the query
 *
 * The position is assumed to be the order they are set.
 * @param cmd the command
 * @param value the argument
 * @param value_len the length of the argument.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_positional_param(lcb_CMDQUERY *cmd, const char *value, size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_adhoc(lcb_CMDQUERY *cmd, int adhoc);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_client_context_id(lcb_CMDQUERY *cmd, const char *value, size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pretty(lcb_CMDQUERY *cmd, int pretty);
/**
 * Marks query as read-only.
 *
 * If the user knows the request is only ever a select, for security
 * reasons it can make sense to tell the server this thing is readonly
 * and it will prevent mutations from happening.
 *
 * If readonly is set, then the following statements are not allowed:
 *   * CREATE INDEX
 *   * DROP INDEX
 *   * INSERT
 *   * MERGE
 *   * UPDATE
 *   * UPSERT
 *   * DELETE
 *
 * @param cmd the command
 * @param readonly if non-zero, the query will be read-only
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_readonly(lcb_CMDQUERY *cmd, int readonly);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_metrics(lcb_CMDQUERY *cmd, int metrics);
/**
 * Sets maximum buffered channel size between the indexer client
 * and the query service for index scans.
 *
 * This parameter controls when to use scan backfill. Use 0 or
 * a negative number to disable.
 *
 * @param cmd the command
 * @param value channel size
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scan_cap(lcb_CMDQUERY *cmd, int value);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scan_wait(lcb_CMDQUERY *cmd, uint32_t us);
/**
 * @uncommitted
 *
 * Tells the query engine to use a flex index (utilizing the search service).
 *
 * @param cmd the command
 * @param value non-zero if a flex index should be used, zero is the default
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_flex_index(lcb_CMDQUERY *cmd, int value);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_profile(lcb_CMDQUERY *cmd, lcb_QUERY_PROFILE mode);
/**
 * Sets maximum number of items each execution operator can buffer
 * between various operators.
 *
 * @param cmd the command
 * @param value number of items
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pipeline_cap(lcb_CMDQUERY *cmd, int value);
/**
 * Sets the number of items execution operators can batch for
 * fetch from the KV.
 *
 * @param cmd the command
 * @param value number of items
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pipeline_batch(lcb_CMDQUERY *cmd, int value);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_max_parallelism(lcb_CMDQUERY *cmd, int value);
/**
 * Sets the consistency mode for the request.
 * By default results are read from a potentially stale snapshot of the data.
 * This may be good for most cases; however at times you want the absolutely
 * most recent data.
 * @param cmd the command
 * @param mode one of the @ref lcb_QUERY_CONSISTENCY values
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency(lcb_CMDQUERY *cmd, lcb_QUERY_CONSISTENCY mode);
/**
 * Indicate that the query should synchronize its internal snapshot to reflect
 * the changes indicated by the given mutation token (`ss`).
 * @param cmd the command
 * @param keyspace the keyspace (or bucket name) which this mutation token
 *        pertains to
 * @param keyspace_len length of the keyspace string
 * @param token the mutation token
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency_token_for_keyspace(lcb_CMDQUERY *cmd, const char *keyspace,
                                                                        size_t keyspace_len,
                                                                        const lcb_MUTATION_TOKEN *token);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency_tokens(lcb_CMDQUERY *cmd, lcb_INSTANCE *instance);
/**
 * Set a query option
 * @param cmd the command
 * @param name the name of the option
 * @param name_len length of the name
 * @param value the value of the option
 * @param value_len length of the value
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_option(lcb_CMDQUERY *cmd, const char *name, size_t name_len, const char *value,
                                                size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_handle(lcb_CMDQUERY *cmd, lcb_QUERY_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_timeout(lcb_CMDQUERY *cmd, uint32_t timeout);
/**
 * Execute a N1QL query.
 *
 * This function will send the query to a query server in the cluster
 * and will invoke the callback (lcb_QUERY_CALLBACK*) for each result returned.
 *
 * @param instance The instance
 * @param cookie Pointer to application data
 * @param cmd the command
 * @return LCB_SUCCESS if successfully scheduled, or a failure code.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_query(lcb_INSTANCE *instance, void *cookie, const lcb_CMDQUERY *cmd);
/**
 * Cancels an in-progress request. This will ensure that further callbacks
 * for the given request are not delivered.
 *
 * @param instance the instance
 * @param handle the handle for the request. This is obtained during the
 *  request as an 'out' parameter (see lcb_CMDN1QL::handle)
 *
 * To obtain the `handle` parameter, do something like this:
 *
 * @code{.c}
 * lcb_QUERYHANDLE* handle;
 * lcb_CMDQUERY* cmd;
 * lcb_cmdquery_create(&cmd);
 * // (Initialize command...)
 * lcb_cmdquery_handle(cmd, &handle);
 * lcb_query(instance, cookie, &cmd);
 * @endcode.
 *
 * If the lcb_query() function returns `LCB_SUCCESS` then the `handle`
 * above is populated with the opaque handle. You can then use this handle
 * to cancel the query at a later point, such as within the callback. You
 * can also get the handle from the response object using `lcb_respquery_handle`
 *
 * @code{.c}
 * lcb_query_cancel(instance, handle);
 * @endcode
 */
LIBCOUCHBASE_API lcb_STATUS lcb_query_cancel(lcb_INSTANCE *instance, lcb_QUERY_HANDLE *handle);
/** @} */

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-view-api Views (Map-Reduce)
 * @brief Higher level API which splits view results into rows
 */

/**
 * @addtogroup lcb-view-api
 * @{
 */

typedef struct lcb_RESPVIEW_ lcb_RESPVIEW;
typedef struct lcb_CMDVIEW_ lcb_CMDVIEW;

/**
 * Pointer for request instance
 */
typedef struct lcb_VIEW_HANDLE_ lcb_VIEW_HANDLE;

/**
 * Callback function invoked for each row returned from the view
 * @param instance the library handle
 * @param cbtype the callback type. This is set to @ref LCB_CALLBACK_VIEWQUERY
 * @param row Information about the current row
 *
 * Note that this callback's `row->rflags` will contain the @ref LCB_RESP_F_FINAL
 * flag set after all rows have been returned. Applications should check for
 * the presence of this flag. If this flag is present, the row itself will
 * contain the raw response metadata in its lcb_RESPVIEWQUERY::value field.
 */
typedef void (*lcb_VIEW_CALLBACK)(lcb_INSTANCE *instance, int cbtype, const lcb_RESPVIEW *row);

LIBCOUCHBASE_API lcb_STATUS lcb_respview_status(const lcb_RESPVIEW *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_cookie(const lcb_RESPVIEW *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_key(const lcb_RESPVIEW *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_doc_id(const lcb_RESPVIEW *resp, const char **doc_id, size_t *doc_id_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_row(const lcb_RESPVIEW *resp, const char **row, size_t *row_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_document(const lcb_RESPVIEW *resp, const lcb_RESPGET **doc);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_http_response(const lcb_RESPVIEW *resp, const lcb_RESPHTTP **http);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_handle(const lcb_RESPVIEW *resp, lcb_VIEW_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_respview_error_context(const lcb_RESPVIEW *resp, const lcb_VIEW_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API int lcb_respview_is_final(const lcb_RESPVIEW *resp);

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_create(lcb_CMDVIEW **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_destroy(lcb_CMDVIEW *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_parent_span(lcb_CMDVIEW *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_callback(lcb_CMDVIEW *cmd, lcb_VIEW_CALLBACK callback);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_design_document(lcb_CMDVIEW *cmd, const char *ddoc, size_t ddoc_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_view_name(lcb_CMDVIEW *cmd, const char *view, size_t view_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_option_string(lcb_CMDVIEW *cmd, const char *optstr, size_t optstr_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_post_data(lcb_CMDVIEW *cmd, const char *data, size_t data_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_include_docs(lcb_CMDVIEW *cmd, int include_docs);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_max_concurrent_docs(lcb_CMDVIEW *cmd, uint32_t num);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_no_row_parse(lcb_CMDVIEW *cmd, int flag);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_handle(lcb_CMDVIEW *cmd, lcb_VIEW_HANDLE **handle);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_timeout(lcb_CMDVIEW *cmd, uint32_t timeout);
LIBCOUCHBASE_API lcb_STATUS lcb_view(lcb_INSTANCE *instance, void *cookie, const lcb_CMDVIEW *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_view_cancel(lcb_INSTANCE *instance, lcb_VIEW_HANDLE *handle);
/** @} */

/* @ingroup lcb-public-api
 * @defgroup lcb-subdoc Sub-Document API
 * @brief Experimental in-document API access
 * @details The sub-document API uses features from the upcoming Couchbase
 * 4.5 release which allows access to parts of the document. These parts are
 * called _sub-documents_ and can be accessed using the sub-document API
 *
 * @addtogroup lcb-subdoc
 * @{
 */

typedef struct lcb_RESPSUBDOC_ lcb_RESPSUBDOC;

LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_status(const lcb_RESPSUBDOC *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_error_context(const lcb_RESPSUBDOC *resp,
                                                         const lcb_KEY_VALUE_ERROR_CONTEXT **ctx);
LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_cookie(const lcb_RESPSUBDOC *resp, void **cookie);
LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_cas(const lcb_RESPSUBDOC *resp, uint64_t *cas);
LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_key(const lcb_RESPSUBDOC *resp, const char **key, size_t *key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_mutation_token(const lcb_RESPSUBDOC *resp, lcb_MUTATION_TOKEN *token);

LIBCOUCHBASE_API size_t lcb_respsubdoc_result_size(const lcb_RESPSUBDOC *resp);
LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_result_status(const lcb_RESPSUBDOC *resp, size_t index);
LIBCOUCHBASE_API lcb_STATUS lcb_respsubdoc_result_value(const lcb_RESPSUBDOC *resp, size_t index, const char **value,
                                                        size_t *value_len);

/**
 * @private
 * @return non-zero if if the fetched document is a tombstone.
 */
LIBCOUCHBASE_API int lcb_respsubdoc_is_deleted(const lcb_RESPSUBDOC *resp);

typedef struct lcb_SUBDOCSPECS_ lcb_SUBDOCSPECS;

/** Create intermediate paths */
#define LCB_SUBDOCSPECS_F_MKINTERMEDIATES (1u << 16u)

/** Access document XATTR path */
#define LCB_SUBDOCSPECS_F_XATTRPATH (1u << 18u)

/** Access document virtual/materialized path. Implies F_XATTRPATH */
#define LCB_SUBDOCSPECS_F_XATTR_MACROVALUES (1u << 19u)

/** Access Xattrs of deleted documents */
#define LCB_SUBDOCSPECS_F_XATTR_DELETED_OK (1u << 20u)

LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_create(lcb_SUBDOCSPECS **operations, size_t capacity);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_destroy(lcb_SUBDOCSPECS *operations);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_get(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                const char *path, size_t path_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_exists(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                   const char *path, size_t path_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_replace(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                    const char *path, size_t path_len, const char *value,
                                                    size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_dict_add(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                     const char *path, size_t path_len, const char *value,
                                                     size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_dict_upsert(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                        const char *path, size_t path_len, const char *value,
                                                        size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_add_first(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                            const char *path, size_t path_len, const char *value,
                                                            size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_add_last(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                           const char *path, size_t path_len, const char *value,
                                                           size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_add_unique(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                             const char *path, size_t path_len, const char *value,
                                                             size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_array_insert(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                         const char *path, size_t path_len, const char *value,
                                                         size_t value_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_counter(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                    const char *path, size_t path_len, int64_t delta);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_remove(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                   const char *path, size_t path_len);
LIBCOUCHBASE_API lcb_STATUS lcb_subdocspecs_get_count(lcb_SUBDOCSPECS *operations, size_t index, uint32_t flags,
                                                      const char *path, size_t path_len);

typedef struct lcb_CMDSUBDOC_ lcb_CMDSUBDOC;

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_create(lcb_CMDSUBDOC **cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_destroy(lcb_CMDSUBDOC *cmd);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_parent_span(lcb_CMDSUBDOC *cmd, lcbtrace_SPAN *span);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_collection(lcb_CMDSUBDOC *cmd, const char *scope, size_t scope_len,
                                                     const char *collection, size_t collection_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_key(lcb_CMDSUBDOC *cmd, const char *key, size_t key_len);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_cas(lcb_CMDSUBDOC *cmd, uint64_t cas);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_specs(lcb_CMDSUBDOC *cmd, const lcb_SUBDOCSPECS *operations);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_expiry(lcb_CMDSUBDOC *cmd, uint32_t expiration);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_durability(lcb_CMDSUBDOC *cmd, lcb_DURABILITY_LEVEL level);
typedef enum {
    LCB_SUBDOC_STORE_REPLACE = 0,
    LCB_SUBDOC_STORE_UPSERT,
    LCB_SUBDOC_STORE_INSERT
} lcb_SUBDOC_STORE_SEMANTICS;
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_store_semantics(lcb_CMDSUBDOC *cmd, lcb_SUBDOC_STORE_SEMANTICS mode);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_access_deleted(lcb_CMDSUBDOC *cmd, int flag);

/**
 * If new document created, the server will create it as a tombstone.
 * Any system or user XATTRs will be stored, but a document body will not be.
 */
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_create_as_deleted(lcb_CMDSUBDOC *cmd, int flag);
LIBCOUCHBASE_API lcb_STATUS lcb_cmdsubdoc_timeout(lcb_CMDSUBDOC *cmd, uint32_t timeout);

LIBCOUCHBASE_API lcb_STATUS lcb_subdoc(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSUBDOC *cmd);
/** @} */

/* Post-include some other headers */
#ifdef __cplusplus
}
#endif /* __cplusplus */
#endif /* LIBCOUCHBASE_COUCHBASE_H */
