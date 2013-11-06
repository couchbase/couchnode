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

#include "config.h"
#include "trace.h"

#include <errno.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <ctype.h>
#include <memcached/protocol_binary.h>
#include <ep-engine/command_ids.h>
#include <libvbucket/vbucket.h>
#include <libcouchbase/couchbase.h>
#include "cbsasl/cbsasl.h"

#include "http_parser/http_parser.h"
#include "ringbuffer.h"
#include "list.h"
#include "url_encoding.h"
#include "hashset.h"
#include "genhash.h"
#include "debug.h"
#include "handler.h"
#include "lcbio.h"

#define LCB_DEFAULT_TIMEOUT 2500000
#define LCB_DEFAULT_CONFIGURATION_TIMEOUT 5000000
#define LCB_DEFAULT_VIEW_TIMEOUT 75000000
#define LCB_DEFAULT_RBUFSIZE 32768
#define LCB_DEFAULT_WBUFSIZE 32768
#define LCB_DEFAULT_DURABILITY_TIMEOUT 5000000
#define LCB_DEFAULT_DURABILITY_INTERVAL 100000
#define LCB_DEFAULT_HTTP_TIMEOUT 75000000

#define LCB_DEFAULT_CONFIG_MAXIMUM_REDIRECTS 3
#define LCB_DEFAULT_CONFIG_ERRORS_THRESHOLD 100
#define LCB_LAST_HTTP_HEADER "X-Libcouchbase: \r\n"
#define LCB_CONFIG_CACHE_MAGIC "{{{fb85b563d0a8f65fa8d3d58f1b3a0708}}}"

#ifdef __cplusplus
extern "C" {
#endif
    struct lcb_server_st;
    typedef struct lcb_server_st lcb_server_t;

    /**
     * Data stored per command in the command-cookie buffer...
     */
    struct lcb_command_data_st {
        hrtime_t start;
        const void *cookie;
        hrtime_t real_start;
        lcb_uint16_t vbucket;
        /* if != -1, it means that we are sequentially iterating
         * through the all replicas until first successful response */
        char replica;
        /** Flags used for observe */
        unsigned char flags;
    };

    /**
     * Define constants for connection attemptts
     */
    typedef enum {
        LCB_CONNECT_OK = 0,
        LCB_CONNECT_EINPROGRESS,
        LCB_CONNECT_EALREADY,
        LCB_CONNECT_EISCONN,
        LCB_CONNECT_EINTR,
        LCB_CONNECT_EFAIL,
        LCB_CONNECT_EINVAL,
        LCB_CONNECT_EUNHANDLED
    } lcb_connect_status_t;


    typedef enum {
        /** We have no configuration */
        LCB_CONFSTATE_UNINIT = 0,

        /** Configured OK */
        LCB_CONFSTATE_CONFIGURED = 1,

        /** We are retrying a new configuration */
        LCB_CONFSTATE_RETRY = 2,

        LCB_CONFSTATE_ERROR = 3
    } lcb_config_status_t;

    typedef enum {
        /** Don't failout servers */
        LCB_CONNFERR_NO_FAILOUT = 1 << 0,

        /** Do not call lcb_maybe_breakout if reconnect fails */
        LCB_CONFERR_NO_BREAKOUT = 1 << 1
    } lcb_conferr_opt_t;

    typedef enum {
        /**
         * Request is part of a durability operation. Don't invoke the
         * user callback.
         */
        LCB_CMD_F_OBS_DURABILITY = 1 << 0,

        /**
         * Request is part of a 'broadcast' operation. A packet is sent for
         * each server; with the final 'NULL' packet being sent when all
         * servers have replied.
         */
        LCB_CMD_F_OBS_BCAST = 1 << 1,

        /**
         * Part of an 'lcb_check' command
         */
        LCB_CMD_F_OBS_CHECK = 1 << 2
    } lcb_cmd_flags_t;

    typedef enum {
        /** Durability requirement. Poll all servers */
        LCB_OBSERVE_TYPE_DURABILITY,
        /** Poll the master for simple existence */
        LCB_OBSERVE_TYPE_CHECK,
        /** Poll all servers only once */
        LCB_OBSERVE_TYPE_BCAST
    } lcb_observe_type_t;


    typedef struct {
        char *data;
        lcb_size_t size;
        lcb_size_t avail;
    } buffer_t;

    struct vbucket_stream_st {
        char *header;
        buffer_t input;
        lcb_size_t chunk_size;
        buffer_t chunk;
    };

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
        lcb_exists_callback exists;
        lcb_errmap_callback errmap;
    };

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

        /** The URL request to send to the server */
        char *http_uri;

        /** The current vbucket config handle */
        VBUCKET_CONFIG_HANDLE vbucket_config;

        struct vbucket_stream_st vbucket_stream;
        struct lcb_io_opt_st *io;

        /** The number of weird things happened with config node
         *  This counter reflects event on memcached port (default 11210),
         *  but used to make decisions about healthiness of the
         *  configuration port (default 8091).
         */
        lcb_size_t weird_things;
        lcb_size_t weird_things_threshold;

        /* The current synchronous mode */
        lcb_syncmode_t syncmode;

        struct lcb_connection_st connection;

        lcb_config_status_t confstatus;
        /* Incremented whenever we get a new config */
        int config_generation;

        /** The number of couchbase server in the configuration */
        lcb_size_t nservers;
        /** The array of the couchbase servers */
        lcb_server_t *servers;

        /** if non-zero, backup_nodes entries should be freed before
            freeing the pointer itself */
        int should_free_backup_nodes;
        /** If we should randomize bootstrap nodes or not */
        int randomize_bootstrap_nodes;
        /** The array of last known nodes as hostname:port */
        char **backup_nodes;
        /** The current connect index */
        int backup_idx;

        /** The type of the key distribution */
        VBUCKET_DISTRIBUTION_TYPE dist_type;
        /** The number of replicas */
        lcb_uint16_t nreplicas;
        /** The number of vbuckets */
        lcb_uint16_t nvbuckets;
        /** A map from the vbucket to the server hosting the vbucket */
        lcb_vbucket_t *vb_server_map;

        vbucket_state_listener_t vbucket_state_listener;

        /* credentials needed to operate cluster via REST API */
        char *username;
        char *password;

        struct {
            const char *name;
            union {
                cbsasl_secret_t secret;
                char buffer[256];
            } password;
            cbsasl_callback_t callbacks[4];
        } sasl;

        /** The set of the timers */
        hashset_t timers;
        /** The set of the pointers to HTTP requests to Cluster */
        hashset_t http_requests;
        /** Set of pending durability polls */
        hashset_t durability_polls;

        struct lcb_callback_st callbacks;
        struct lcb_histogram_st *histogram;

        lcb_uint32_t seqno;
        int wait;
        /** Is IPv6 enabled */
        lcb_ipv6_t ipv6;
        const void *cookie;

        lcb_error_t last_error;

        lcb_uint32_t views_timeout;
        lcb_uint32_t http_timeout;
        lcb_uint32_t durability_timeout;
        lcb_uint32_t durability_interval;
        lcb_uint32_t operation_timeout;
        lcb_uint32_t config_timeout;

        lcb_size_t rbufsize;
        lcb_size_t wbufsize;

        /** maximum redirect hops. -1 means infinite redirects */
        int max_redir;

        struct {
            lcb_compat_t type;
            union {
                struct {
                    time_t mtime;
                    char *cachefile;
                    int updating;
                    int needs_update;
                    int loaded;
                } cached;
            } value;
        } compat;

        /* if non-zero, skip nodes in list that seems like not
         * configured or doesn't have the bucket needed */
        int bummer;

        /**
         * Cached ringbuffer objects for 'purge_implicit_responses'
         */
        ringbuffer_t purged_buf;
        ringbuffer_t purged_cookies;

        char *sasl_mech_force;

#ifdef LCB_DEBUG
        lcb_debug_st debug;
#endif
    };

    /**
     * The structure representing each couchbase server
     */
    struct lcb_server_st {
        /** The server index in the list */
        int index;
        /** Non-zero for node is using for configuration */
        int is_config_node;
        /** The server endpoint as hostname:port */
        char *authority;
        /** The Couchbase Views API endpoint base */
        char *couch_api_base;
        /** The REST API server as hostname:port */
        char *rest_api_server;
        /** The sent buffer for this server so that we can resend the
         * command to another server if the bucket is moved... */
        ringbuffer_t cmd_log;
        ringbuffer_t output_cookies;
        /**
         * The pending buffer where we write data until we're in a
         * connected state;
         */
        ringbuffer_t pending;
        ringbuffer_t pending_cookies;

        /** The SASL object used for this server */
        cbsasl_conn_t *sasl_conn;
        /* name of the chosen SASL mechanism */
        char *sasl_mech;
        lcb_size_t sasl_nmech;
        /** Is this server in a connected state (done with sasl auth) */
        int connection_ready;

        /**
         * This flag is for use by server_send_packets. By default, this
         * function calls apply_want, but this is unsafe if we are already
         * inside the handler, because at this point the read buffer may not
         * have been owned by us, while a read event may still be requested.
         *
         * If this is the case, apply_want will not be called from send_packets
         * but it will be called when the event handler regains control.
         */
        int inside_handler;

        /* Pointer back to the instance */
        lcb_t instance;
        struct lcb_connection_st connection;
    };

    struct lcb_timer_st {
        lcb_uint32_t usec;
        int periodic;
        void *event;
        const void *cookie;
        lcb_timer_callback callback;
        lcb_t instance;
    };

    struct lcb_http_header_st {
        struct lcb_http_header_st *next;
        char *data;
    };

    typedef struct {
        lcb_list_t list;
        char *key;
        char *val;
    } lcb_http_header_t;

    typedef enum {
        /**
         * The request is still ongoing. Callbacks are still active
         */
        LCB_HTREQ_S_ONGOING = 0,

        /**
         * The on_complete callback has been invoked
         */
        LCB_HTREQ_S_CBINVOKED = 1 << 0,

        /**
         * The object has been purged from either its servers' or instances'
         * hashset.
         */
        LCB_HTREQ_S_HTREMOVED = 1 << 1

    } lcb_http_request_status_t;

    struct lcb_http_request_st {
        lcb_t instance;
        /** The URL buffer */
        char *url;
        lcb_size_t nurl;
        /** The URL info */
        struct http_parser_url url_info;
        /** The requested path (without couch api endpoint) */
        char *path;
        lcb_size_t npath;
        /** The body buffer */
        char *body;
        lcb_size_t nbody;
        /** The type of HTTP request */
        lcb_http_method_t method;
        /** The HTTP response parser */
        http_parser *parser;
        http_parser_settings parser_settings;
        char *host;
        lcb_size_t nhost;
        char *port;
        lcb_size_t nport;

        /** Non-zero if caller would like to receive response in chunks */
        int chunked;
        /** This callback will be executed when the whole response will be
         * transferred */
        lcb_http_complete_callback on_complete;
        /** This callback will be executed for each chunk of the response */
        lcb_http_data_callback on_data;
        /** The accumulator for result (when chunked mode disabled) */
        ringbuffer_t result;
        /** The cookie belonging to this request */
        const void *command_cookie;
        /** Reference count */
        unsigned int refcount;
        /** Redirect count */
        int redircount;
        char *redirect_to;

        /** Current state */
        lcb_http_request_status_t status;

        /** Request type; views or management */
        lcb_http_type_t reqtype;

        /** Request headers */
        lcb_http_header_t headers_out;

        /** Linked list of headers */
        struct lcb_http_header_st *headers_list;
        /** Headers array for passing to callbacks */
        const char **headers;
        /** Number of headers **/
        lcb_size_t nheaders;

        lcb_io_opt_t io;

        struct lcb_connection_st connection;

    };

    lcb_error_t lcb_synchandler_return(lcb_t instance, lcb_error_t retcode);

    lcb_error_t lcb_error_handler(lcb_t instance,
                                  lcb_error_t error,
                                  const char *errinfo);
    int lcb_server_purge_implicit_responses(lcb_server_t *c,
                                            lcb_uint32_t seqno,
                                            hrtime_t delta,
                                            int all);
    void lcb_server_destroy(lcb_server_t *server);
    void lcb_server_connected(lcb_server_t *server);

    lcb_error_t lcb_server_initialize(lcb_server_t *server,
                                      int servernum);

    int lcb_dispatch_response(lcb_server_t *c,
                              struct lcb_command_data_st *ct,
                              protocol_binary_response_header *header);


    void lcb_server_buffer_start_packet(lcb_server_t *c,
                                        const void *command_cookie,
                                        ringbuffer_t *buff,
                                        ringbuffer_t *buff_cookie,
                                        const void *data,
                                        lcb_size_t size);

    void lcb_server_buffer_retry_packet(lcb_server_t *c,
                                        struct lcb_command_data_st *ct,
                                        ringbuffer_t *buff,
                                        ringbuffer_t *buff_cookie,
                                        const void *data,
                                        lcb_size_t size);

    void lcb_server_buffer_write_packet(lcb_server_t *c,
                                        ringbuffer_t *buff,
                                        const void *data,
                                        lcb_size_t size);

    void lcb_server_buffer_end_packet(lcb_server_t *c,
                                      ringbuffer_t *buff);

    void lcb_server_buffer_complete_packet(lcb_server_t *c,
                                           const void *command_cookie,
                                           ringbuffer_t *buff,
                                           ringbuffer_t *buff_cookie,
                                           const void *data,
                                           lcb_size_t size);

    /* These two *_ex fuction allow to fill lcb_command_data_st struct
     * in caller */
    void lcb_server_buffer_start_packet_ex(lcb_server_t *c,
                                           struct lcb_command_data_st *ct,
                                           ringbuffer_t *buff,
                                           ringbuffer_t *buff_cookie,
                                           const void *data,
                                           lcb_size_t size);

    void lcb_server_start_packet_ex(lcb_server_t *c,
                                    struct lcb_command_data_st *ct,
                                    const void *data,
                                    lcb_size_t size);

    /**
     * Initiate a new packet to be sent
     * @param c the server connection to send it to
     * @param command_cookie the cookie belonging to this command
     * @param data pointer to data to include in the packet
     * @param size the size of the data to include
     */
    void lcb_server_start_packet(lcb_server_t *c,
                                 const void *command_cookie,
                                 const void *data,
                                 lcb_size_t size);

    /**
     * Like start_packet, except instead of a cookie, a command data structure
     * is passed
     *
     * @param c the server
     * @param command_data a cookie. This is copied to the cookie buffer. This is
     * copied without any modification, so set any boilerplate yourself :)
     * @param data pointer to data to include in the packet
     * @param size size of the data
     */
    void lcb_server_start_packet_ct(lcb_server_t *c,
                                    struct lcb_command_data_st *command_data,
                                    const void *data,
                                    lcb_size_t size);


    void lcb_server_retry_packet(lcb_server_t *c,
                                 struct lcb_command_data_st *ct,
                                 const void *data,
                                 lcb_size_t size);
    /**
     * Write data to the current packet
     * @param c the server connection to send it to
     * @param data pointer to data to include in the packet
     * @param size the size of the data to include
     */
    void lcb_server_write_packet(lcb_server_t *c,
                                 const void *data,
                                 lcb_size_t size);
    /**
     * Mark this packet complete
     */
    void lcb_server_end_packet(lcb_server_t *c);

    /**
     * Create a complete packet (to avoid calling start + end)
     * @param c the server connection to send it to
     * @param command_cookie the cookie belonging to this command
     * @param data pointer to data to include in the packet
     * @param size the size of the data to include
     */
    void lcb_server_complete_packet(lcb_server_t *c,
                                    const void *command_cookie,
                                    const void *data,
                                    lcb_size_t size);
    /**
     * Start sending packets
     * @param server the server to start send data to
     */
    void lcb_server_send_packets(lcb_server_t *server);

    /**
     * Returns true if this server has pending I/O on it
     */
    int lcb_server_has_pending(lcb_server_t *server);



    void lcb_server_v0_event_handler(lcb_socket_t sock, short which, void *arg);

    void lcb_initialize_packet_handlers(lcb_t instance);

    int lcb_base64_encode(const char *src, char *dst, lcb_size_t sz);

    void lcb_record_metrics(lcb_t instance,
                            hrtime_t delta,
                            lcb_uint8_t opcode);

    void lcb_purge_timedout(lcb_t instance);


    int lcb_lookup_server_with_command(lcb_t instance,
                                       lcb_uint8_t opcode,
                                       lcb_uint32_t opaque,
                                       lcb_server_t *exc);

    void lcb_purge_single_server(lcb_server_t *server,
                                 lcb_error_t error);
    void lcb_timeout_server(lcb_server_t *server);

    lcb_error_t lcb_failout_server(lcb_server_t *server,
                                   lcb_error_t error);

    void lcb_maybe_breakout(lcb_t instance);

    lcb_connect_status_t lcb_connect_status(int err);

    void lcb_sockconn_errinfo(int connerr,
                              const char *hostname,
                              const char *port,
                              const struct addrinfo *root_ai,
                              char *buf,
                              lcb_size_t nbuf,
                              lcb_error_t *uerr);

    lcb_socket_t lcb_gai2sock(lcb_t instance,
                              struct addrinfo **curr_ai,
                              int *connerr);

    lcb_sockdata_t *lcb_gai2sock_v1(lcb_t instance,
                                    struct addrinfo **ai,
                                    int *connerr);

    lcb_error_t lcb_apply_vbucket_config(lcb_t instance,
                                         VBUCKET_CONFIG_HANDLE config);



    int lcb_getaddrinfo(lcb_t instance, const char *hostname,
                        const char *servname, struct addrinfo **res);

    void lcb_failout_observe_request(lcb_server_t *server,
                                     struct lcb_command_data_st *command_data,
                                     const char *packet,
                                     lcb_size_t npacket,
                                     lcb_error_t err);

    int lcb_load_config_cache(lcb_t instance);
    void lcb_refresh_config_cache(lcb_t instance);
    void lcb_schedule_config_cache_refresh(lcb_t instance);
    void lcb_update_vbconfig(lcb_t instance,
                             VBUCKET_CONFIG_HANDLE next_config);

    /**
     * Hashtable wrappers
     */
    genhash_t *lcb_hashtable_nc_new(lcb_size_t est);

    /**
     * Configuration received was invalid. Try to get
     * the configuration again.
     */
    void lcb_instance_config_error(lcb_t instance,
                                   lcb_error_t err,
                                   const char *errinfo,
                                   lcb_conferr_opt_t options);

    lcb_error_t lcb_instance_start_connection(lcb_t instance);

    void lcb_vbucket_stream_v0_handler(lcb_socket_t sock, short which, void *arg);

    void lcb_server_connect(lcb_server_t *server);

    int lcb_proto_parse_single(lcb_server_t *c, hrtime_t stop);

    void lcb_http_request_finish(lcb_t instance,
                                 lcb_http_request_t req,
                                 lcb_error_t error);
    void lcb_http_request_decref(lcb_http_request_t req);
    lcb_error_t lcb_http_verify_url(lcb_http_request_t req, const char *base, lcb_size_t nbase);
    lcb_error_t lcb_http_request_exec(lcb_http_request_t req);
    lcb_error_t lcb_http_parse_setup(lcb_http_request_t req);
    lcb_error_t lcb_http_request_connect(lcb_http_request_t req);
    int lcb_http_request_do_parse(lcb_http_request_t req);
    void lcb_setup_lcb_http_resp_t(lcb_http_resp_t *resp,
                                   lcb_http_status_t status,
                                   const char *path,
                                   lcb_size_t npath,
                                   const char *const *headers,
                                   const void *bytes,
                                   lcb_size_t nbytes);


    void lcb_server_v1_read_handler(lcb_sockdata_t *sockptr, lcb_ssize_t nr);
    void lcb_server_v1_write_handler(lcb_sockdata_t *sockptr,
                                     lcb_io_writebuf_t *wbuf,
                                     int status);
    void lcb_server_v1_error_handler(lcb_sockdata_t *sockptr);

    lcb_error_t lcb_parse_vbucket_stream(lcb_t instance);

    void lcb_observe_invoke_callback(lcb_t instance,
                                     const struct lcb_command_data_st *ct,
                                     lcb_error_t error,
                                     const lcb_observe_resp_t *resp);

    lcb_error_t lcb_observe_ex(lcb_t instance,
                               const void *command_cookie,
                               lcb_size_t num,
                               const void *const *items,
                               lcb_observe_type_t type);

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
    int lcb_getenv_nonempty(const char *key, char *buf, lcb_size_t len);
    int lcb_getenv_boolean(const char *key);

    /**
     * Initialize the socket subsystem. For windows, this initializes Winsock.
     * On Unix, this does nothing
     */
    lcb_error_t lcb_initialize_socket_subsystem(void);

    void lcb_free_backup_nodes(lcb_t instance);

#ifdef __cplusplus
}
#endif

#endif
