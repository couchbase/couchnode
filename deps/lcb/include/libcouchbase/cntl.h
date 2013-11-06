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
 * Command codes for libcouchbase.
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

#define LCB_CNTL_SET 0x01
#define LCB_CNTL_GET 0x00

    /**
     * Get/Set. Operation timeout.
     * Arg: lcb_uint32_t* (microseconds)
     *
     *      lcb_uint32_t tmo = 3500000;
     *      lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmo);
     */
#define LCB_CNTL_OP_TIMEOUT             0x00

    /**
     * Get/Set. View timeout.
     * Arg: lcb_uint32_t* (microseconds)
     */
#define LCB_CNTL_VIEW_TIMEOUT           0x01

    /**
     * Get/Set. Default read buffer size (this is not a socket option)
     * Arg: lcb_size_t*
     */
#define LCB_CNTL_RBUFSIZE               0x02

    /**
     * Get/Set. Default write buffer size (this is not a socket option)
     * Arg: lcb_size_t*
     */
#define LCB_CNTL_WBUFSIZE               0x03

    /**
     * Get the handle type.
     * Arg: lcb_type_t*
     */
#define LCB_CNTL_HANDLETYPE             0x04

    /**
     * Get the vBucket handle
     * Arg: VBUCKET_CONFIG_HANDLE*
     */
#define LCB_CNTL_VBCONFIG               0x05


    /**
     * Get the iops implementation instance
     * Arg: lcb_io_opt_t*
     */
#define LCB_CNTL_IOPS                   0x06

    typedef struct lcb_cntl_vbinfo_st lcb_cntl_vbinfo_t;
    struct lcb_cntl_vbinfo_st {
        int version;

        union {
            struct {
                /** Input parameters */
                const void *key;
                lcb_size_t nkey;
                /** Output */
                int vbucket;
                int server_index;
            } v0;
        } v;
    };
    /**
     * Get the vBucket ID for a given key, based on the current configuration
     * Arg: A lcb_cntl_vbinfo_t*. The 'vbucket' field in he structure will
     *      be modified
     */
#define LCB_CNTL_VBMAP                  0x07


    typedef struct lcb_cntl_server_st lcb_cntl_server_t;

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

    struct lcb_cntl_server_st {
        /** Structure version */
        int version;

        union {
            struct {
                LCB_CNTL_SERVER_COMMON_FIELDS
            } v0;
            struct {
                LCB_CNTL_SERVER_COMMON_FIELDS
                /** Chosen SASL mechanism */
                char *sasl_mech;
            } v1;
        } v;
    };
#undef LCB_CNTL_SERVER_COMMON_FIELDS

    /**
     * Get information about a memcached node.
     * Arg: A struct lcb_cntl_server_st*. Note that all fields in this structure
     *      are ready only and are only valid until one of the following happens:
     *          1) Another libcouchbase API function is called
     *          2) The IOPS loop regains control
     */
#define LCB_CNTL_MEMDNODE_INFO          0x08

    /**
     * Get information about the configuration node.
     * Arg: A struct lcb_cntl_server_st*. Semantics of MEMDNODE_INFO apply here
     *      as well.
     */
#define LCB_CNTL_CONFIGNODE_INFO        0x09

    /**
     * Get/Set the "syncmode" behavior
     * Arg: lcb_syncmode_t*
     */
#define LCB_CNTL_SYNCMODE               0x0a

    /**
     * Get/Set IPv4/IPv6 selection policy
     * Arg: lcb_ipv6_t*
     */
#define LCB_CNTL_IP6POLICY              0x0b

    /**
     * Get/Set the configuration error threshold. This number indicates how many
     * network/mapping/not-my-vbucket errors are received before a configuration
     * update is requested again.
     *
     * Arg: lcb_size_t*
     */
#define LCB_CNTL_CONFERRTHRESH          0x0c

    /**
     * Get/Set the default durability timeout. This is the time the client will
     * spend sending repeated probes to a given key's vBucket masters and replicas
     * before they are deemed not to have satisfied the durability requirements
     *
     * Arg: lcb_uint32_t*
     */
#define LCB_CNTL_DURABILITY_TIMEOUT     0x0d

    /**
     * Get/Set the default durability interval. This is the time the client will
     * wait between repeated probes to a given server. Note that this is usually
     * auto-estimated based on the servers' given 'ttp' and 'ttr' fields reported
     * with an OBSERVE response packet.
     *
     * Arg: lcb_uint32_t*
     */
#define LCB_CNTL_DURABILITY_INTERVAL    0x0e

    /**
     * Get/Set the default timeout for *non-view* HTTP requests.
     * Arg: lcb_uint32_t*
     */
#define LCB_CNTL_HTTP_TIMEOUT           0x0f

    struct lcb_cntl_iops_info_st {
        int version;
        union {
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
     * Get the default IOPS types for this build. This provides a convenient
     * way to determine what libcouchbase will use for IO when not explicitly
     * specifying an iops structure to lcb_create()
     *
     * Arg: struct lcb_cntl_io_ops_info_st*
     * NOTE: Pass NULL to lcb_cntl for the 'instance' parameter, as this does not
     * read anything specific on the handle
     */
#define LCB_CNTL_IOPS_DEFAULT_TYPES      0x10

    /**
     * Get/Set the global setting (this is a static global) regarding whether to
     * print verbose information when trying to dynamically load an IO plugin.
     * The information printed can be useful in determining why a plugin failed
     * to load. This setting can also be controlled via the
     * "LIBCOUCHBASE_DLOPEN_DEBUG" environment variable (and if enabled from the
     * environment, will override the setting mentioned here).
     *
     * Arg: int*
     * NOTE: Pass NULL to lcb_cntl for the 'instance' parameter.
     */
#define LCB_CNTL_IOPS_DLOPEN_DEBUG       0x11

    /**
     * Get/Set the per-instance setting for the connection timeout. This is
     * how long the client will wait to obtain the initial configuration as
     * well as the time the client will wait to obtain new configurations
     * when needed
     *
     * Arg: lcb_uint32_t*
     */
#define LCB_CNTL_CONFIGURATION_TIMEOUT   0x12

    /**
     * Get/Set the per-instance setting to control connection
     * behaviour when config node doesn't seem to be member of the
     * cluster. By default the setting is false (0), which mean
     * propagate LCB_BUCKET_ENOENT or LCB_AUTH_ERROR immediately from
     * the first node and look at the next entry in list only on
     * network issues. But for cases when the node list is rather
     * constant, and the some nodes might be removed from the
     * deployment and still listen on configuration port, the caller
     * can set this setting to true (non zero), to force checking
     * bucket on all nodes in the list until it found working.
     *
     * Arg: int*
     */
#define LCB_CNTL_SKIP_CONFIGURATION_ERRORS_ON_CONNECT 0x13


    /**
     * Get/Set. if the order of the bootstrap hosts should be utilized
     *          in a random order or not. The argument is a boolean
     *          where 0 means the order of the bootstrap hosts should
     *          be preserved and a non-null value means it should be
     *          randomized.
     *
     * Arg: int*
     */
#define LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS 0x14

    /**
     * Get. Determines whether the configuration cache (if used) was used.
     * If the configuration cache is in use, the argument pointer
     * will be set to a true value. If the configuration cache was not used,
     * the argument pointer will be set to false.
     *
     * A false value may indicates that the client will need to load the
     * configuration from the network. This may be caused by the following:
     * - The configuration cache did not exist or was empty
     * - The configuration cache contained stale information
     *
     * Arg: int*
     */
#define LCB_CNTL_CONFIG_CACHE_LOADED 0x15

    /**
     * Get/Set. Force a specific SASL mechanism to use for authentication. This
     * can allow a user to ensure a certain level of security and have the
     * connection fail if the desired mechanism is not available.
     *
     * When setting this value, the arg parameter shall be a
     * NUL-terminated string or a NULL pointer (to unset). When retrieving
     * this value, the parameter shall be set to a 'char **'. Note that this
     * value (in LCB_CNTL_GET) is valid only until the next call to a
     * libcouchbase API, after which it may have been freed.
     *
     * Arg: char* (for LCB_CNTL_SET), char** (for LCB_CNTL_GET)
     */
#define LCB_CNTL_FORCE_SASL_MECH 0x16

    /**
     * Get/Set. Set how many redirects the library should follow for
     * the single request. Set to -1 to remove limit at all.
     *
     * Arg: int*
     */
#define LCB_CNTL_MAX_REDIRECTS 0x17

    /** This is not a command, but rather an indicator of the last item */
#define LCB_CNTL__MAX                    0x18


#ifdef __cplusplus
}
#endif
#endif /* LCB_CNTL_H */
