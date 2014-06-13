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
 * @ingroup LCB_PUBAPI
 * @defgroup LCB_CNTL Client Configuration
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
 * ### Configuration Stability Attributes
 *
 * Configuration parameters are still subject to the API classification used
 * in @ref lcb_attributes. For _deprecated_ control commands, lcb_cntl() will
 * either perform the operation, _or_ consider it a no-op, _or_ return an error
 * code.
 */

/**
 * @section LCB_TIMEOUTS Timeout Settings
 * Timeout settings control how long the library will wait for a certain event
 * before proceeding to the next course of action (which may either be to try
 * a different operation or fail the current one, depending on the specific
 * timeout).
 *
 * Timeouts are specified in _microseconds_ stored within an `lcb_uint32_t`.
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
 */

/**
 * @addtogroup LCB_CNTL
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
 * lcb_uint32_t tmo = 3500000;
 * lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmo);
 * @endcode
 * @see LCB_TIMEOUTS
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 *
 * @committed
 */
#define LCB_CNTL_OP_TIMEOUT             0x00

/**
 * @brief Views Timeout
 * This is the I/O timeout for HTTP requests issues with LCB_HTTP_TYPE_VIEWS
 *
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 *
 * @committed
 */
#define LCB_CNTL_VIEW_TIMEOUT           0x01

/**@deprecated It is currently not possible to adjust buffer sizes */
#define LCB_CNTL_RBUFSIZE               0x02

/**@deprecated It is currently not possible to adjust buffer sizes */
#define LCB_CNTL_WBUFSIZE               0x03

/**
 * @brief Get the handle type.
 *
 * This returns the handle type - which is either LCB_TYPE_CLUSTER or
 * LCB_TYPE_BUCKET
 *
 * Mode | Arg
 * ---- |---
 * Get| lcb_type_t *
 * @uncommitted
 */
#define LCB_CNTL_HANDLETYPE             0x04

/**
 * @brief Get the vBucket handle
 *
 * Obtains the current cluster configuration from the client.
 *
 * Mode | Arg
 * -----|----
 * Get  | VBUCKET_CONFIG_HANDLE *
 * @uncommitted
 */
#define LCB_CNTL_VBCONFIG               0x05

/**
 * @brief Get the iops implementation instance
 *
 * Mode | Arg
 * -----|----
 * Get|lcb_io_opt_t *
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
            lcb_size_t nkey; /**< **Input** Length of key */
            int vbucket; /**< **Output** Mapped vBucket */
            int server_index; /**< **Output** Server index for vBucket */
        } v0;
    } v;
} lcb_cntl_vbinfo_t;

/**
 * @brief get vBucket information for a key
 *
 * Get the vBucket ID for a given key, based on the current configuration
 *
 * Mode | Arg
 * -----|----
 * Get  | lcb_cntl_vbinfo_t *
 * @committed
 */
#define LCB_CNTL_VBMAP                  0x07


#define LCB_CNTL_SERVER_COMMON_FIELDS \
    /** Server index to query */ \
    int index; \
    \
    /** NUL-terminated string containing the address */ \
    const char *host; \
    /** NUL-terminated string containing the port */ \
    const char *port; \
    /** Whether the node is connected */ \
    int connected; \
    \
    /**
     * Socket information. If a v0 IO plugin is being used, the sockfd
     * is set to the socket descriptor. If a v1 plugin is being used, the
     * sockptr is set to point to the appropriate structure.
     *
     * Note that you *MAY* perform various 'setsockopt' calls on the
     * sockfd (though it is your responsibility to ensure those options
     * are valid); however the actual socket descriptor may change
     * in the case of a cluster configuration update.
     */ \
    union { \
        lcb_socket_t sockfd; \
        lcb_sockdata_t *sockptr; \
    } sock; \

/** @brief Information describing the server */
typedef struct lcb_cntl_server_st {
    /** Structure version */
    int version;

    union {
        struct {
            LCB_CNTL_SERVER_COMMON_FIELDS
        } v0;

        /** Current information here */
        struct {
            LCB_CNTL_SERVER_COMMON_FIELDS
            /** Chosen SASL mechanism */
            const char *sasl_mech;
        } v1;
    } v;
} lcb_cntl_server_t;
#undef LCB_CNTL_SERVER_COMMON_FIELDS

/**
 * @brief Get information about a memcached node.
 *
 * This function will populate a structure containing various information
 * about the specific host
 *
 * Mode|Arg
 * ----|---
 * Get | lcb_cntl_server_t *
 *
 * Note that all fields in the structure are only valid until the following
 * happens (whichever is first)
 *
 * 1. Another libcouchbase API function is called
 * 2. The event loop regains control
 *
 * @volatile
 */
#define LCB_CNTL_MEMDNODE_INFO          0x08

/**
 * @brief Get information about the configuration node.
 *
 * Note that this may not be available if the configuration mode is
 * not HTTP
 *
 * Mode|Arg
 * ----|---
 * Get | lcb_cntl_server_t *
 * @volatile
 */
#define LCB_CNTL_CONFIGNODE_INFO        0x09

/** @deprecated */
#define LCB_CNTL_SYNCMODE               0x0a

typedef enum {
    LCB_IPV6_DISABLED = 0x00,
    LCB_IPV6_ONLY = 0x1,
    LCB_IPV6_ALLOW = 0x02
} lcb_ipv6_t;

/**
 * @brief IPv4/IPv6 selection policy
 *
 * Setting which controls whether hostname lookups should prefer IPv4 or
 * IPv6
 *
 * Mode     |Arg
 * ---------|---
 * Get, Set | lcb_ipv6_t *
 * @uncommitted
 */
#define LCB_CNTL_IP6POLICY              0x0b

/**
 * @brief Configuration error threshold.
 *
 * This number indicates how many
 * network/mapping/not-my-vbucket errors are received before a configuration
 * update is requested again.
 *
 * Mode     |Arg
 * ---------|---
 * Get, Set | lcb_size_t *
 * @uncommitted
 */
#define LCB_CNTL_CONFERRTHRESH          0x0c

/**
 * @brief Default timeout for lcb_durability_poll()
 * @ingroup LCB_TIMEOUTS
 *
 * This is the time the client will
 * spend sending repeated probes to a given key's vBucket masters and replicas
 * before they are deemed not to have satisfied the durability requirements
 *
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 * @committed
 */
#define LCB_CNTL_DURABILITY_TIMEOUT     0x0d

/**
 * @brief Polling grace interval for lcb_durability_poll()
 *
 * This is the time the client will wait between repeated probes to
 * a given server.
 *
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 * @committed
 */
#define LCB_CNTL_DURABILITY_INTERVAL    0x0e

/**
 * @brief Timeout for non-views HTTP requests
 * @committed
 *
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 */
#define LCB_CNTL_HTTP_TIMEOUT           0x0f

/** @brief Information about the I/O plugin */
struct lcb_cntl_iops_info_st {
    int version;
    union {
        /** .. */
        struct {
            /**
             * Pass here options, used to create IO structure with
             * lcb_create_io_ops(3), to find out whether the library
             * will override them in the current environment
             */
            const struct lcb_create_io_ops_st *options;

            /**
             * The default IO ops type. This is hard-coded into the library
             * and is used if nothing else was specified in creation options
             * or the environment
             */
            lcb_io_ops_type_t os_default;

            /**
             * The effective plugin type after reading environment variables.
             * If this is set to 0, then a manual (non-builtin) plugin has been
             * specified.
             */
            lcb_io_ops_type_t effective;
        } v0;
    } v;
};

/**
 * @brief Get the default IOPS types for this build.
 *
 * This provides a convenient
 * way to determine what libcouchbase will use for IO when not explicitly
 * specifying an iops structure to lcb_create()
 *
 * Mode | Arg
 * -----| ---
 * Get | lcb_cntl_io_ops_info_st *
 *
 * @note You may pass NULL to lcb_cntl for the 'instance' parameter,
 * as this does not read anything specific on the handle
 *
 * @uncommitted
 */
#define LCB_CNTL_IOPS_DEFAULT_TYPES      0x10

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
 * Mode     |Arg
 * ---------|---
 * Get, Set | int *
 *
 * @note Pass NULL to lcb_cntl for the 'instance' parameter.
 * @volatile
 */
#define LCB_CNTL_IOPS_DLOPEN_DEBUG       0x11

/**
 * @brief Initial bootstrap timeout
 *
 * This is
 * how long the client will wait to obtain the initial configuration.
 *
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 * @committed
 */
#define LCB_CNTL_CONFIGURATION_TIMEOUT   0x12

/**@deprecated Initial connections are always attempted */
#define LCB_CNTL_SKIP_CONFIGURATION_ERRORS_ON_CONNECT 0x13

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
 * Mode     | Arg
 * ---------|----
 * Get, Set | int * (as a boolean)
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
 * Mode|Arg
 * ----|---
 * Get | int *
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
 * Mode|Arg
 * ----|---
 * Get | char **
 * Set | char *
 * @uncommitted
 */
#define LCB_CNTL_FORCE_SASL_MECH 0x16

/**
 * @brief Maximum number of HTTP redirects to follow
 *
 * Set how many redirects the library should follow for
 * the single request. Set to -1 to remove limit at all.
 *
 * Mode     |Arg
 * ---------|---
 * Get, Set | int *
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
typedef enum {
    LCB_LOG_TRACE = 0,
    LCB_LOG_DEBUG,
    LCB_LOG_INFO,
    LCB_LOG_WARN,
    LCB_LOG_ERROR,
    LCB_LOG_FATAL,
    LCB_LOG_MAX
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
                                      unsigned int iid,
                                      const char *subsys,
                                      int severity,
                                      const char *srcfile,
                                      int srcline,
                                      const char *fmt,
                                      va_list ap);

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
    union {
        struct {
            lcb_logging_callback callback;
        } v0;
    } v;
} lcb_logprocs;

/**
 * @brief Access the lcb_logprocs structure
 * @uncommitted
 *
 * The lcb_logoprocs structure passed must not be freed until the instance
 * is completely destroyed. This will only happen once the destruction
 * callback is called (see lcb_set_destroy_callback()).
 * Mode|Arg
 * ----|---
 * Get | lcb_logprocs **
 * Set | lcb_logprocs *
 */
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
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 *
 * @see LCB_CNTL_CONFERRTHRESH
 * @uncommitted
 */
#define LCB_CNTL_CONFDELAY_THRESH 0x19

/**
 * @brief Get the transport used to fetch cluster configuration.
 *
 * Mode|Arg
 * ----|---
 * Get | lcb_config_transport_t *
 * @uncommitted
 */
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
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 *
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
 * Modes    | Arg
 * ---------| ----------------
 * Get, Set | lcb_uint32_t*
 * @volatile
 */
#define LCB_CNTL_HTCONFIG_IDLE_TIMEOUT 0x1C

/**
 * @brief Set the nodes for the HTTP provider.
 *
 * @uncommitted
 *
 * This sets the initial list
 * for the nodes to be used for bootstrapping the cluster. This may also
 * be used subsequently in runtime to provide an updated list of nodes
 * if the current list malfunctions.
 *
 * The argument for this cntl accepts a NUL-terminated string containing
 * one or more nodes. The format for this string is the same as the
 * `host` parameter in lcb_create_st
 *
 * Ports should specify the REST API port.
 *
 * Mode|Arg
 * ----|---
 * Set | char ** (array of strings)
 *
 */
#define LCB_CNTL_CONFIG_HTTP_NODES 0x1D

/**
 * @brief Set the nodes for the CCCP provider.
 *
 * Similar to @ref LCB_CNTL_CONFIG_HTTP_NODES, but affects the CCCP provider
 * instead.
 *
 * Ports should specify the _memcached_ port
 *
 * Mode|Arg
 * ----|---
 * Set | char ** (array of strings)
 *
 * @uncomitted
 */
#define LCB_CNTL_CONFIG_CCCP_NODES 0x1E

/**
 * @brief Get the current SCM changeset for the library binary
 *
 * Mode|Arg
 * ----|---
 * Get | char **
 *
 * @committed
 */
#define LCB_CNTL_CHANGESET 0x1F

/**
 * @brief Set the config nodes for the relevant providers.
 *
 * This is passed an lcb_create_st2 structure which is used to initialize
 * the providers. Useful if you wish to reinitialize or modify the
 * provider settings _after_ the instance itself has already been
 * constructed.
 *
 * Note that the username, password, bucket, and io fields are
 * ignored.
 *
 * @uncommitted
 *
 * Mode|Arg
 * ----|---
 * Set | lcb_create_st2
 */
#define LCB_CNTL_CONFIG_ALL_NODES 0x20

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
 *
 *
 * Mode|Arg
 * ----|---
 * Set | `char *`
 * Get | `char **`
 *
 * @uncommitted
 * @see LCB_CNTL_CONFIG_CACHE_LOADED
 */
#define LCB_CNTL_CONFIGCACHE 0x21

typedef enum {
    LCB_SSL_ENABLED = 1 << 0, /**< Use SSL */
    LCB_SSL_NOVERIFY = 1 << 1 /**< Don't verify certificates */
} lcb_SSLOPTS;

/**
 * @brief SSL Mode
 *
 * Sets the SSL policy used by the library. This should only be used before
 * the initial connection and _after_ the CA certificate (if any) has been
 * loaded (see @ref LCB_CNTL_SSL_CACERT)
 *
 * @attention
 * This option affects the `mchosts` parameter passed to lcb_create(). Any
 * host which has its port set to the value of LCB_CONFIG_MCD_PORT will be
 * replaced with the value of LCB_CONFIG_MCD_SSL_PORT. Otherwise it is assumed
 * that the ports passed are already of the SSL variant.
 *
 * @attention
 * SSL is only functional on servers versions 3.0 and higher. Setting this
 * parameter for a server of a lower version (or a mixed environment) is not
 * supported.
 *
 * Mode|Arg
 * ----|---
 * Set, Get | lcb_SSLOPTS*
 */
#define LCB_CNTL_SSL_MODE 0x22


/**
 * @brief SSL Certificate path
 *
 * Sets the path on the filesystem where the server's CA certificate is located.
 *
 * Mode|Arg
 * ----|---
 * Set | const char*
 * Get | const char**
 */
#define LCB_CNTL_SSL_CACERT 0x23

/**
 * @brief
 * Select retry mode to manipulate
 */
typedef enum {
    LCB_RETRY_ON_TOPOCHANGE = 0, /**< Select retry for topology */
    LCB_RETRY_ON_SOCKERR, /**< Select retry for network errors */
    LCB_RETRY_ON_VBMAPERR, /**< Select retry for NOT_MY_VBUCKET responses */
    LCB_RETRY_ON_MAX /**<< maximum index */
} lcb_RETRYMODEOPTS;

typedef enum {
    /**
     * Don't retry any commands. A command which has been forwarded to
     * a server and a not-my-vbucket has been received in response for it
     * will result in a failure.
     */
    LCB_RETRY_CMDS_NONE = 0,

    /**
     * Only retry simple retrieval operations (excludes touch,
     * get-and-touch, and get-locked) which may be retried many numbers of times
     * without risking unintended data manipulation.
     */
    LCB_RETRY_CMDS_GET = 1 << 0, /**< Only retry simple retrievals */

    /**
     * Retry operations which may potentially fail because they have been
     * accepted by a previous server, but will not silently corrupt data.
     * Such commands include mutation operations containing a CAS.
     */
    LCB_RETRY_CMDS_SAFE = (1 << 1)|LCB_RETRY_CMDS_GET,

    /**
     * Retry all commands, disregarding any potential unintended receipt of
     * errors or data mutation.
     */
    LCB_RETRY_CMDS_ALL = (LCB_RETRY_CMDS_SAFE|LCB_RETRY_CMDS_GET)
} lcb_RETRYCMDOPTS;

/** @brief argument for @ref LCB_CNTL_RETRYMODE */
typedef struct {
    lcb_RETRYMODEOPTS mode; /**< What was the trigger that induced the retry */
    lcb_RETRYCMDOPTS cmd; /**< Policy of which commands should be retried */
} lcb_RETRYOPT;

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
 *   lcb_RETRYOPT opts;
 *   opts.mode = ii;
 *   opts.cmd = LCB_RETRY_CMDS_NONE;
 *   lcb_error_t err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_RETRYMODE, &opts);
 * }
 * @endcode
 *
 * Only retry simple GET operations when retry is needed because of topology
 * changes:
 * @code{.c}
 * lcb_RETRYOPT opts;
 * opts.mode = LCB_RETRY_ON_TOPOCHANGE;
 * opts.cmds = LCB_RETRY_CMDS_GET;
 * lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_RETRYMODE, &opts);
 * @endcode
 *
 * Determine the behavior of the library when a `NOT_MY_VBUCKET` is received:
 * @code{.c}
 * lcb_RETRYOPT opts;
 * opts.mode = LCB_RETRY_ON_VBMAPERR;
 * lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_RETRYMODE, &opts);
 * @endcode
 *
 * Mode|Arg
 * ----|---
 * Set, Get | lcb_RETRYOPT
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
 * The URL type can be a mask of the lcb_HTCONF_URLTYPE constants which
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
 *
 * Mode|Arg
 * ----|---
 * Set, Get | lcb_HTCONFIG_URLTYPE
 */
#define LCB_CNTL_HTCONFIG_URLTYPE 0x25


/**
 * Options for how to handle compression
 */
typedef enum {
    /** Do not perform compression in any direction. Data which is received
     * compressed via the server will be indicated as such by having the
     * `LCB_VALUE_F_SNAPPYCOMP` flag set in the lcb_GETRESPv0::datatype field */
    LCB_COMPRESS_NONE = 0x00,

    /**
     * Decompress incoming data, if the data has been compressed at the server.
     * If this is set, the `datatype` field in responses will always be stripped
     * of the `LCB_VALUE_F_SNAPPYCOMP` flag.
     */
    LCB_COMPRESS_IN = 1 << 0,

    /**
     * Compress outgoing data. Note that if the `datatype` field contains the
     * `LCB_VALUE_F_SNAPPYCOMP` flag, then the data will never be compressed
     * as it is assumed that it is already compressed.
     */
    LCB_COMPRESS_OUT = 1 << 1,


    LCB_COMPRESS_INOUT = (LCB_COMPRESS_IN|LCB_COMPRESS_OUT),

    /**
     * By default the library will send a HELLO command to the server to
     * determine whether compression is supported or not. Because commands may
     * be pipelined prior to the scheduing of the HELLO command it is possible
     * that the first few commands may not be compressed when schedule due to
     * the library not yet having negotiated settings with the server. Setting
     * this flag will force the client to assume that all servers support
     * compression despite a HELLO not having been intially negotiated.
     */
    LCB_COMPRESS_FORCE = 1 << 2
} lcb_COMPRESSOPTS;

/**
 * @committed
 *
 * @brief Control how the library handles compression and deflation to and from
 * the server.
 *
 * Starting in Couchbase Server 3.0, compression can optionally be applied to
 * incoming and outcoming data. For incoming (i.e. `GET` requests) the data
 * may be received in compressed format and then allow the client to inflate
 * the data upon receipt. For outgoing (i.e. `SET` requests) the data may be
 * compressed on the client side and then be stored and recognized on the
 * server itself.
 *
 * The default behavior is to transparently handle compression for both incoming
 * and outgoing data.
 *
 * Note that if the lcb_STORECMDv0::datatype field is set with compression
 * flags, the data will _never_ be compressed by the library as this is an
 * indication that it is _already_ compressed.
 *
 * Mode|Arg
 * ----|----
 * Set, Get | `lcb_COMPRESSOPTS *`
 */
#define LCB_CNTL_COMPRESSION_OPTS 0x26

struct rdb_ALLOCATOR;
typedef struct rdb_ALLOCATOR* (*lcb_RDBALLOCFACTORY)(void);

/**Structure being used because function pointers can't technically be cast
 * to void*
 */
struct lcb_cntl_rdballocfactory {
    lcb_RDBALLOCFACTORY factory;
};
/**
 * @volatile
 * Set the allocator factory used by libcouchbase. The allocator factory is
 * a function invoked with no arguments which yields a new rdb_ALLOCATOR
 * object. Currently the use and API of this object is considered internal
 * and its API and header files are in `src/rdb`.
 *
 * Mode|Arg
 * ----|---
 * Set, Get | `lcb_cntl_rdballocfactory*`
 */
#define LCB_CNTL_RDBALLOCFACTORY 0x27

/**
 * @volatile
 * Determines whether to run the event loop internally within lcb_destroy()
 * until no more I/O resources remain for the library. This is usually only
 * necessary if you are creating a lot of instances and/or are using memory
 * leak analysis tools.
 *
 * Mode|Arg
 * ----|----
 * Set, Get | `int*`
 *
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
 * Mode|Arg
 * ----|---
 * Set | `const lcb_U32*`
 *
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
 *
 * Mode|Arg
 * ----|---
 * Set, Get | `int*`
 */
#define LCB_CNTL_DETAILED_ERRCODES 0x2A

/**
 * @volatile
 * Reinitialize the instance using a connection string/DSN. Only options and
 * the hostlists are used from this string. The bucket in the string (if specified)
 * and any SSL options (i.e. `couchbases://` or `ssl=no_verify`) are ignored.
 *
 *
 * This is the newer variant of @ref LCB_CNTL_CONFIG_ALL_NODES
 * Mode|Arg
 * ----|---
 * Set | `const char *`
 */
#define LCB_CNTL_REINIT_DSN 0x2B

/** This is not a command, but rather an indicator of the last item */
#define LCB_CNTL__MAX                    0x2C
/**@}*/

#ifdef __cplusplus
}
#endif
#endif /* LCB_CNTL_H */
