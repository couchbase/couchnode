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


/**
 * @file
 * @brief Command codes for libcouchbase.
 *
 * @details
 * These codes may be passed to 'lcb_cntl'.
 *
 * Note that the constant values are also public API; thus allowing forwards
 * and backwards compatibility.
 */

#ifndef LCB_CNTL_H
#define LCB_CNTL_H

#ifdef __cplusplus
extern "C" {
#endif


/**
 * @ingroup lcb-public-api
 * @defgroup lcb-cntl-settings Client Configuration
 * @brief Adjust tunables for the client
 * @details
 *
 * The constants in this file are used to control the behavior of the library.
 * All of the operations above may be passed as the `cmd` parameter to the
 * lcb_cntl() function, thus:
 *
 * @code{.c}
 * char something;
 * lcb_error_t rv;
 * rv = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_FOO, &something);
 * @endcode
 *
 * will retrieve the setting of `LCB_CNTL_FOO` into `something`.
 *
 * You may also use the lcb_cntl_string() function, which operates on
 * strings and can set various configuration properties fairly simply. Note
 * however that string names are subject to change, and not all configuration
 * directives have a string alias:
 *
 * @code{.c}
 * rv = lcb_cntl_string("operation_timeout", "5.0");
 * @endcode
 *
 * Of the commands listed below, some will be read-only (i.e. you may only
 * _read_ the setting using the @ref LCB_CNTL_GET `mode`), some will be write-only
 * (i.e. you may only _modify_ the setting, and use @ref LCB_CNTL_SET for the `mode`)
 * and some will be both readable and writable.
 *
 * Along the documentation of each specific command, there is a table displaying
 * the modes supported and the expected pointer type to be passed as the `arg`
 * value into lcb_cntl(). Note that some read-write commands require different
 * pointer types depending on whether the `mode` is retrieval or storage.
 *
 *
 * @section lcb-timeout-info Timeout Settings
 *
 * Timeout settings control how long the library will wait for a certain event
 * before proceeding to the next course of action (which may either be to try
 * a different operation or fail the current one, depending on the specific
 * timeout).
 *
 * Timeouts are specified in _microseconds_ stored within an `lcb_U32`.
 *
 * Note that timeouts in libcouchbase are implemented via an event loop
 * scheduler. As such their accuracy and promptness is limited by how
 * often the event loop is invoked and how much wall time is spent in
 * each of their handlers. Specifically if you issue long running blocking
 * calls within any of the handlers (and this means any of the library's
 * callbacks) then the timeout accuracy will be impacted.
 *
 * Further behavior is dependent on the event loop plugin itself and how
 * it schedules timeouts.
 *
 *
 * @par Configuration Stability Attributes
 * Configuration parameters are still subject to the API classification used
 * in @ref lcb_attributes. For _deprecated_ control commands, lcb_cntl() will
 * either perform the operation, _or_ consider it a no-op, _or_ return an error
 * code.
 */

/**
 * @addtogroup lcb-cntl-settings
 * @{
 */

/**
 * @name Modes
 * Modes for the lcb_cntl() `mode` argument
 * @{
 */
#define LCB_CNTL_SET 0x01 /**< @brief Modify a setting */
#define LCB_CNTL_GET 0x00 /**< @brief Retrieve a setting */
/**@}*/

/**
 * @brief Operation Timeout
 *
 * The operation timeout is the maximum amount of time the library will wait
 * for an operation to receive a response before invoking its callback with
 * a failure status.
 *
 * An operation may timeout if:
 *
 * * A server is taking too long to respond
 * * An updated cluster configuration has not been promptly received
 *
 * @code{.c}
 * lcb_U32 tmo = 3500000;
 * lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmo);
 * @endcode
 *
 * @cntl_arg_both{lcbU32*}
 * @committed
 * @see lcb-timeout-info
 */
#define LCB_CNTL_OP_TIMEOUT             0x00

/**
 * @brief Views Timeout
 * This is the I/O timeout for HTTP requests issues with LCB_HTTP_TYPE_VIEWS
 *
 * @cntl_arg_both{lcb_U32*}
 * @committed
 */
#define LCB_CNTL_VIEW_TIMEOUT           0x01

/**
 * @brief Get the name of the bucket
 * This returns the name of the bucket this instance is connected to, or `NULL`
 * if not yet connected to a bucket
 *
 * @cntl_arg_getonly{`const char*`}
 * @committed
 */
#define LCB_CNTL_BUCKETNAME             0x30

/**
 * @brief Get the handle type.
 * This returns the handle type - which is either LCB_TYPE_CLUSTER or
 * LCB_TYPE_BUCKET
 *
 * @cntl_arg_getonly{lcb_type_t*}
 * @uncommitted
 */
#define LCB_CNTL_HANDLETYPE             0x04

/**@brief Get the vBucket handle.
 * Obtains the current cluster configuration from the client.
 *
 * @cntl_arg_getonly{lcbvb_CONFIG**}
 * @uncommitted
 */
#define LCB_CNTL_VBCONFIG               0x05

/**@brief Get the iops implementation instance
 *
 * @cntl_arg_getonly{lcb_io_opt_t*}
 * @uncommitted
 */
#define LCB_CNTL_IOPS                   0x06


/** @brief Structure containing mapping information for a key */
typedef struct lcb_cntl_vbinfo_st {
    int version;

    union {
        /** v0 */
        struct {
            const void *key; /**< **Input** Key */
            lcb_SIZE nkey; /**< **Input** Length of key */
            int vbucket; /**< **Output** Mapped vBucket */
            int server_index; /**< **Output** Server index for vBucket */
        } v0;
    } v;
} lcb_cntl_vbinfo_t;

/**
 * @brief Get the vBucket ID for a given key, based on the current configuration
 *
 * @cntl_arg_getonly{lcb_cntl_vbinfo_t*}
 * @committed
 */
#define LCB_CNTL_VBMAP                  0x07

/**
 * @brief Configuration error threshold.
 *
 * This number indicates how many
 * network/mapping/not-my-vbucket errors are received before a configuration
 * update is requested again.
 *
 * @cntl_arg_both{lcb_SIZE*}
 * @uncommitted
 */
#define LCB_CNTL_CONFERRTHRESH          0x0c

/**
 * @brief Default timeout for lcb_durability_poll()
 * @ingroup lcb-timeout-info
 *
 * This is the time the client will
 * spend sending repeated probes to a given key's vBucket masters and replicas
 * before they are deemed not to have satisfied the durability requirements
 *
 * @cntl_arg_both{lcb_U32*}
 * @committed
 */
#define LCB_CNTL_DURABILITY_TIMEOUT     0x0d

/**@brief Polling grace interval for lcb_durability_poll()
 *
 * This is the time the client will wait between repeated probes to
 * a given server.
 *
 * @cntl_arg_both{lcb_U32*}
 * @committed*/
#define LCB_CNTL_DURABILITY_INTERVAL    0x0e

/**@brief Timeout for non-views HTTP requests
 * @cntl_arg_both{lcb_U32*}
 * @committed*/
#define LCB_CNTL_HTTP_TIMEOUT           0x0f

/**
 * @brief Print verbose plugin load information to console
 *
 * This modifies a static, global setting regarding whether to
 * print verbose information when trying to dynamically load an IO plugin.
 * The information printed can be useful in determining why a plugin failed
 * to load. This setting can also be controlled via the
 * "LIBCOUCHBASE_DLOPEN_DEBUG" environment variable (and if enabled from the
 * environment, will override the setting mentioned here).
 *
 * @cntl_arg_both{int*}
 *
 * @note Pass NULL to lcb_cntl for the 'instance' parameter.
 * @volatile
 */
#define LCB_CNTL_IOPS_DLOPEN_DEBUG       0x11

/**@brief Initial bootstrap timeout.
 * This is how long the client will wait to obtain the initial configuration.
 *
 * @cntl_arg_both{lcb_U32*}
 * @committed*/
#define LCB_CNTL_CONFIGURATION_TIMEOUT   0x12

/**
 * @brief Randomize order of bootstrap nodes.
 *
 * This controls whether the connection attempts for configuration retrievals
 * should be done in the supplied order or whether they should be randomized.
 *
 * For the initial connection the supplied order is the list of hosts provided
 * in the lcb_create_st structure. For subsequent connections this is the
 * order of nodes as received by the server.
 *
 * @cntl_arg_both{int*}
 * @committed
 */
#define LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS 0x14

/**
 * @brief Determine if file-based configuration has been loaded
 *
 * If the configuration cache is in use, the argument pointer
 * will be set to a true value. If the configuration cache was not used,
 * the argument pointer will be set to false.
 *
 * A false value may indicates that the client will need to load the
 * configuration from the network. This may be caused by the following:
 * - The configuration cache did not exist or was empty
 * - The configuration cache contained stale information
 *
 * @cntl_arg_getonly{int*}
 * @uncommitted
 */
#define LCB_CNTL_CONFIG_CACHE_LOADED 0x15

/**
 * @brief Force a specific SASL mechanism
 *
 * Force a specific SASL mechanism to use for authentication. This
 * can allow a user to ensure a certain level of security and have the
 * connection fail if the desired mechanism is not available.
 *
 * When setting this value, the arg parameter shall be a
 * `NUL`-terminated string or a `NULL` pointer (to unset). When retrieving
 * this value, the parameter shall be set to a `char **`. Note that this
 * value (in LCB_CNTL_GET) is valid only until the next call to a
 * libcouchbase API, after which it may have been freed.
 *
 * @cntl_arg_get_and_set{char**, char*}
 * @uncommitted
 */
#define LCB_CNTL_FORCE_SASL_MECH 0x16

/**
 * @brief Maximum number of HTTP redirects to follow
 * Set how many redirects the library should follow for the single request.
 * Set to -1 to remove limit at all.
 *
 * @cntl_arg_both{int*}
 * @uncommitted
 */
#define LCB_CNTL_MAX_REDIRECTS 0x17

/**
 * @name Logging
 *
 * Verbose logging may be enabled by default using the environment variable
 * `LCB_LOGLEVEL` and setting it to a number > 1; higher values produce more
 * verbose output. The maximum level is `5`.
 *
 * You may also install your own logger using lcb_cntl() and the
 * @ref LCB_CNTL_LOGGER constant. Note that
 * the logger functions will not be called rapidly from within hot paths.
 * @{
 */

/** @brief Logging Levels */
typedef enum { LCB_LOG_TRACE = 0, LCB_LOG_DEBUG, LCB_LOG_INFO, LCB_LOG_WARN,
    LCB_LOG_ERROR, LCB_LOG_FATAL, LCB_LOG_MAX
} lcb_log_severity_t;

struct lcb_logprocs_st;

/**
 * @brief Logger callback
 *
 * @uncommitted
 *
 * This callback is invoked for each logging message emitted
 * @param procs the logging structure provided
 * @param iid instance id
 * @param subsys a string describing the module which emitted the message
 * @param severity one of the LCB_LOG_* severity constants.
 * @param srcfile the source file which emitted this message
 * @param srcline the line of the file for the message
 * @param fmt a printf format string
 * @param ap a va_list for vprintf
 */
typedef void (*lcb_logging_callback)(struct lcb_logprocs_st *procs,
        unsigned int iid, const char *subsys, int severity, const char *srcfile,
        int srcline, const char *fmt, va_list ap);

/**
 * @brief Logging context
 * @uncommitted
 *
 * This structure defines the logging handlers. Currently there is only
 * a single field defined which is the default callback for the loggers.
 * This API may change.
 */
typedef struct lcb_logprocs_st {
    int version;
    union { struct { lcb_logging_callback callback; } v0; } v;
} lcb_logprocs;

/**
 * @brief Access the lcb_logprocs structure
 * @uncommitted
 *
 * The lcb_logoprocs structure passed must not be freed until the instance
 * is completely destroyed. This will only happen once the destruction
 * callback is called (see lcb_set_destroy_callback()).
 *
 * @cntl_arg_get_and_set{lcb_logprocs**,lcb_logprocs*}*/
#define LCB_CNTL_LOGGER 0x18
/**@}*/


/**
 * @brief Refresh Throttling
 *
 * Modify the amount of time (in microseconds) before the
 * @ref LCB_CNTL_CONFERRTHRESH will forcefully be set to its maximum
 * number forcing a configuration refresh.
 *
 * Note that if you expect a high number of timeouts in your operations, you
 * should set this to a high number (along with `CONFERRTHRESH`). If you
 * are using the default timeout setting, then this value is likely optimal.
 *
 * @cntl_arg_both{lcb_U32*}
 * @see LCB_CNTL_CONFERRTHRESH
 * @uncommitted
 */
#define LCB_CNTL_CONFDELAY_THRESH 0x19

/**@brief Get the transport used to fetch cluster configuration.
 * @cntl_arg_getonly{lcb_config_transport_t*}
 * @uncommitted*/
#define LCB_CNTL_CONFIG_TRANSPORT 0x1A

/**
 * @brief Per-node configuration timeout.
 *
 * The per-node configuration timeout sets the amount of time to wait
 * for each node within the bootstrap/configuration process. This interval
 * is a subset of the @ref LCB_CNTL_CONFIGURATION_TIMEOUT
 * option mentioned above and is intended
 * to ensure that the bootstrap process does not wait too long for a given
 * node. Nodes that are physically offline may never respond and it may take
 * a long time until they are detected as being offline.
 * See CCBC-261 and CCBC-313 for more reasons.
 *
 * @note the `CONFIGURATION_TIMEOUT` should be higher than this number.
 * No check is made to ensure that this is the case, however.
 *
 * @cntl_arg_both{lcb_U32*}
 * @see LCB_CNTL_CONFIGURATION_TIMEOUT
 * @committed
 */
#define LCB_CNTL_CONFIG_NODE_TIMEOUT 0x1B

/**
 * @brief Idling/Persistence for HTTP bootstrap
 *
 * By default the behavior of the library for HTTP bootstrap is to keep the
 * stream open at all times (opening a new stream on a different host if the
 * existing one is broken) in order to proactively receive configuration
 * updates.
 *
 * The default value for this setting is -1. Changing this to another number
 * invokes the following semantics:
 *
 * - The configuration stream is not kept alive indefinitely. It is kept open
 *   for the number of seconds specified in this setting. The socket is closed
 *   after a period of inactivity (indicated by this setting).
 *
 * - If the stream is broken (and no current refresh was requested by the
 *   client) then a new stream is not opened.
 *
 * @cntl_arg_both{lcb_U32*}
 * @volatile
 */
#define LCB_CNTL_HTCONFIG_IDLE_TIMEOUT 0x1C

/**@brief Get the current SCM changeset for the library binary
 * @cntl_arg_getonly{char**}
 * @committed*/
#define LCB_CNTL_CHANGESET 0x1F

/**
 * @brief file used for the configuration cache.
 *
 * The configuration
 * cache allows to bootstrap from a cluster without using the initial
 * bootstrap connection, considerably reducing latency. If the file passed
 * does not exist, the normal bootstrap process is performed and the file
 * is written to with the current information.
 *
 * @note The leading directories for the file must exist, otherwise the file
 * will never be created.
 *
 * @note Configuration cache is not supported for memcached buckets
 * @cntl_arg_get_and_set{char**, char*}
 * @uncommitted
 * @see LCB_CNTL_CONFIG_CACHE_LOADED
 */
#define LCB_CNTL_CONFIGCACHE 0x21

/**
 * @brief File used for read-only configuration cache
 *
 * This is identical to the @ref LCB_CNTL_CONFIGCACHE directive, except that
 * it guarantees that the library will never overwrite or otherwise modify
 * the path specified.
 *
 * @see LCB_CNTL_CONFIGCACHE
 */
#define LCB_CNTL_CONFIGCACHE_RO 0x36

typedef enum {
    LCB_SSL_ENABLED = 1 << 0, /**< Use SSL */
    LCB_SSL_NOVERIFY = 1 << 1 /**< Don't verify certificates */
} lcb_SSLOPTS;

/**
 * @brief Get SSL Mode
 *
 * Retrieve the SSL mode currently in use by the library. This is a read-only
 * setting. To set the SSL mode at the library, specify the appropriate values
 * within the connection string. See @ref lcb_create_st3 for details.
 *
 * @cntl_arg_getonly{`int*` (value is one of @ref lcb_SSLOPTS)}
 */
#define LCB_CNTL_SSL_MODE 0x22

/**
 * @brief Get SSL Certificate path
 *
 * Retrieve the path to the CA certificate (if any) being used.
 *
 * @cntl_arg_getonly{`char**`}
 * @see LCB_CNTL_SSL_MODE
 */
#define LCB_CNTL_SSL_CERT 0x23
/* For back compat */
#define LCB_CNTL_SSL_CACERT LCB_CNTL_SSL_CERT

/**
 * @brief
 * Select retry mode to manipulate
 */
typedef enum {
    LCB_RETRY_ON_TOPOCHANGE = 0, /**< Select retry for topology */
    LCB_RETRY_ON_SOCKERR, /**< Select retry for network errors */
    LCB_RETRY_ON_VBMAPERR, /**< Select retry for NOT_MY_VBUCKET responses */

    /** Retry when there is no node for the item. This case is special as the
     * `cmd` setting is treated as a boolean rather than a bitmask*/
    LCB_RETRY_ON_MISSINGNODE,
    LCB_RETRY_ON_MAX /**<< maximum index */
} lcb_RETRYMODEOPTS;

typedef enum {
    /**Don't retry any commands. A command which has been forwarded to
     * a server and a not-my-vbucket has been received in response for it
     * will result in a failure.*/
    LCB_RETRY_CMDS_NONE = 0,

    /**Only retry simple retrieval operations (excludes touch,
     * get-and-touch, and get-locked) which may be retried many numbers of times
     * without risking unintended data manipulation. */
    LCB_RETRY_CMDS_GET = 0x01,

    /**Retry operations which may potentially fail because they have been
     * accepted by a previous server, but will not silently corrupt data.
     * Such commands include mutation operations containing a CAS.*/
    LCB_RETRY_CMDS_SAFE = 0x03, /* Includes 'GET', plus a new flag (e.g. 0x02|0x01) */

    /**Retry all commands, disregarding any potential unintended receipt of
     * errors or data mutation.*/
    LCB_RETRY_CMDS_ALL = 0x07 /* e.g. 0x01|0x03| NEW FLAG: 0x04 */
} lcb_RETRYCMDOPTS;

/**@brief Create a retry setting value
 * @param mode the mode to set (@see lcb_RETRYMODEOPTS)
 * @param policy the policy determining which commands should be retried
 * (@see lcb_RETRYCMDOPTS)
 * @return a value which can be assigned to an `lcb_U32` and passed to
 * the @ref LCB_CNTL_RETRYMODE setting
 */
#define LCB_RETRYOPT_CREATE(mode, policy) (((mode) << 16) | policy)

#define LCB_RETRYOPT_GETMODE(u) (u) >> 16
#define LCB_RETRYOPT_GETPOLICY(u) (u) & 0xffff

/**
 * @volatile
 *
 * @brief Set retry policies
 *
 * This function sets the retry behavior. The retry behavior is the action the
 * library should take when a command has failed because of a failure which
 * may be a result of environmental and/or topology issues. In such cases it
 * may be possible to retry the command internally and have it succeed a second
 * time without propagating an error back to the application.
 *
 * The behavior consists of a _mode_ and _command_ selectors. The _command_
 * selector indicates which commands should be retried (and which should be
 * propagated up to the user) whereas the _mode_ indicates under which
 * circumstances should the _command_ policy be used.
 *
 * Disable retries anywhere:
 * @code{.c}
 * for (int ii = 0; ii < LCB_RETRY_ON_MAX; ++ii) {
 *   lcb_U32 val = LCB_RETRYOPT_CREATE(ii, LCB_RETRY_CMDS_NONE);
 *   lcb_error_t err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_RETRYMODE, &val);
 * }
 * @endcode
 *
 * Only retry simple GET operations when retry is needed because of topology
 * changes:
 * @code{.c}
 * lcb_U32 val = LCB_RETRYOPT_CREATE(LCB_RETRY_ON_TOPOCHANGE, LCB_RETRY_CMDS_GET);
 * lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_RETRYMODE, &val);
 * @endcode
 *
 * Determine the behavior of the library when a `NOT_MY_VBUCKET` is received:
 * @code{.c}
 * lcb_U32 val = LCB_RETRYOPT_CREATE(LCB_RETRY_ON_VBMAPERR, 0);
 * lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_RETRYMODE, &val);
 * lcb_U32 policy = LCB_RETRYOPT_GETPOLICY(val);
 * @endcode
 *
 * @cntl_arg_both{`lcb_U32 *`}
 */
#define LCB_CNTL_RETRYMODE 0x24

/**
 * @brief Enumeration representing various URL forms to use for the configuration
 * stream */
typedef enum {
    /** `/pools/default/b[s]/$bucket`: Introduced in Couchbase Server 2.5 */
    LCB_HTCONFIG_URLTYPE_25PLUS = 0x01,

    /** `/pools/default/buckets[Streaming]/$bucket`. */
    LCB_HTCONFIG_URLTYPE_COMPAT = 0x02,

    /** Try `25PLUS` first and fallback to `COMPAT` */
    LCB_HTCONFIG_URLTYPE_TRYALL = 0x03
} lcb_HTCONFIG_URLTYPE;

/**
 * @volatile - Primarily here to support tests and buggy HTTP servers/proxies
 * which do not like to maintain a connection upon receipt of a 404.
 *
 * @brief Set the URL selection mode.
 *
 * The URL type can be a mask of the lcb_HTCONFIG_URLTYPE constants which
 * indicate which URLs the HTTP provider should use.
 *
 * The default is to use the `25PLUS` URI first, and fallback on the compat uri
 * if the terse one fails with an HTTP 404 (Not Found). The new-style URI is
 * considered more efficient on cluster resources and can help the cluster
 * maintain many more streaming connections than the compat version, however
 * it is only available in Couchbase Server 2.5 and greater.
 *
 * This setting is only used when CCCP is disabled. This will typically be for
 * older clusters or for memcached buckets.
 * @cntl_arg_both{`int*` (value is one of @ref lcb_HTCONFIG_URLTYPE)}
 */
#define LCB_CNTL_HTCONFIG_URLTYPE 0x25

/**
 * @volatile
 * Determines whether to run the event loop internally within lcb_destroy()
 * until no more I/O resources remain for the library. This is usually only
 * necessary if you are creating a lot of instances and/or are using memory
 * leak analysis tools.
 *
 * @cntl_arg_both{`int*` (as a boolean)}
 * @see lcb_destroy_async() and lcb_set_destroy_callback()
 */
#define LCB_CNTL_SYNCDESTROY 0x28

/**
 * @committed
 *
 * Sets the logging level for the console logger. If a logger is already
 * initialized (either from the environment, or via lcb_cntl_logger() then
 * this operation does nothing.
 *
 * This is mainly useful for applications which want to proxy the built in
 * logging options via command line options and the like, rather than setting
 * it from the environment.
 *
 * The argument passed to lcb_cntl() is an integer of 0 until
 * `LCB_LOGLEVEL_MAX`, though the actual type is of `lcb_U32` rather than
 * an enum type.
 *
 * @cntl_arg_setonly{const lcb_U32 *}
 * @see LCB_CNTL_LOGGER
 */
#define LCB_CNTL_CONLOGGER_LEVEL 0x29

/**
 * @committed
 *
 * Sets the behavior for reporting network errors. By default network errors
 * are returned as `LCB_NETWORK_ERROR` return codes for compatibility reasons.
 * More detailed error codes may be available by enabling this option which will
 * return appropriate error codes which have a category of
 * @ref LCB_ERRTYPE_NETWORK
 *
 * Using this option means your programming model is centered around the various
 * LCB_EIF* macros (see <libcouchbase/error.h>) rather than individual codes.
 *
 * @cntl_arg_both{int * (As a boolean)}
 */
#define LCB_CNTL_DETAILED_ERRCODES 0x2A

/**
 * @uncommitted
 *
 * Sets the interval at which the retry queue will attempt to resend a failed
 * operation. When an operation fails and the retry policy (see
 * @ref LCB_CNTL_RETRYMODE) allows the operation to be retried, it shall be
 * placed into a queue, and then be retried within a given interval.
 *
 * Setting a high value will be friendlier on the network but also potentially
 * increase latency, while setting this to a low value may cause unnecessary
 * network traffic for operations which are not yet ready to be retried.
 *
 * @cntl_arg_both{lcb_U32* (microseconds)}
 *
 * @see LCB_CNTL_RETRY_BACKOFF
 */
#define LCB_CNTL_RETRY_INTERVAL 0x2C

/**
 * @uncommitted
 *
 * When an operation has been retried more than once and it has still not
 * succeeded, the library will attempt to back off for the operation by
 * scheduling it to be retried in `LCB_CNTL_RETRY_INTEVAL * ${n}` microseconds,
 * where `${n}` is the factor controlled by this setting.
 *
 * @cntl_arg_both{float*}
 */
#define LCB_CNTL_RETRY_BACKOFF 0x2D

/**
 * @volatile
 * Whether commands are retried immediately upon receipt of not-my-vbucket
 * replies.
 *
 * Since version 2.4.8, packets by default are retried immediately on a
 * different node if it had previously failed with a not-my-vbucket
 * response, and is thus not subject to the @ref LCB_CNTL_RETRY_INTERVAL
 * and @ref LCB_CNTL_RETRY_BACKOFF settings. Disabling this setting will
 * restore the older behavior. This may be used in case there are problems
 * with the default heuristic/retry algorithm.
 */
#define LCB_CNTL_RETRY_NMV_IMM 0x37

/**
 * @volatile
 *
 * Set the maximum pool size for pooled http (view request) sockets. This should
 * be set to 1 (the default) unless you plan to execute concurrent view requests.
 * You may set this to 0 to disable pooling
 *
 * @cntl_arg_both{lcb_SIZE}
 */
#define LCB_CNTL_HTTP_POOLSIZE 0x2E

/**
 * @uncomitted
 * Determine whether or not a new configuration should be received when an error
 * is received over the HTTP API (i.e. via lcb_make_http_request().
 *
 * The default value is true, however you may wish to disable this if you are
 * expectedly issuing a lot of requests which may result in an error.
 *
 * @cntl_arg_both{int (as boolean)}
 */
#define LCB_CNTL_HTTP_REFRESH_CONFIG_ON_ERROR 0x2F

/**
 * @volatile
 * Set the behavior of the lcb_sched_leave() API call. By default the
 * lcb_sched_leave() will also set up the necessary requirements for flushing
 * to the network. If this option is off then an explicit call to
 * lcb_sched_flush() must be performed instead.
 *
 * @cntl_arg_both{int (as boolean)}
 */
#define LCB_CNTL_SCHED_IMPLICIT_FLUSH 0x31

/**
 * @volatile
 *
 * Allow the server to return an additional 16 bytes of data for each
 * mutation operation. This extra information may help with more reliable
 * durability polling, but will also increase the size of the response packet.
 *
 * This should be set on the instance before issuing lcb_connect(). While this
 * may also be set after lcb_connect() is called, it will currently only take
 * effect when a server reconnects (which itself may be undefined).
 *
 * @cntl_arg_both{int (as boolean)}
 */
#define LCB_CNTL_FETCH_SYNCTOKENS 0x34

/**
 * @volatile
 *
 * This setting determines whether the lcb_durability_poll() function will
 * transparently attempt to use synctoken functionality (rather than checking
 * the CAS). This option is most useful for older code which does
 * explicitly use synctokens but would like to use its benefits when
 * ensuring durability constraints are satisfied.
 *
 * This option is enabled by default. Users may wish to disable this if they
 * are performing durability operations against items stored from different
 * client instances, as this will make use of a client-global state which is
 * derived on a per-vBucket basis. This means that the last mutation performed
 * on a given vBucket for the client will be used, which in some cases may be
 * older or newer than the mutations passed to the lcb_durability_poll()
 * function.
 *
 * @cntl_arg_both{int (as boolean)}
 */
#define LCB_CNTL_DURABILITY_SYNCTOKENS 0x35

/** This is not a command, but rather an indicator of the last item */
#define LCB_CNTL__MAX                    0x38
/**@}*/

#ifdef __cplusplus
}
#endif

#include "cntl-private.h"

#endif /* LCB_CNTL_H */
