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

/**
 * Public types and datatypes exported through the libcouchbase API.
 * Please note that libcouchbase should be binary compatible across versions
 * so remember to update the library version numbers if you change any
 * of the values.
 *
 * @author Trond Norbye
 */
#ifndef LIBCOUCHBASE_TYPES_H
#define LIBCOUCHBASE_TYPES_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

#ifdef __cplusplus
extern "C" {
#endif
    /**
     * Clients of the library should not know the size or the internal
     * layout of the per instance handle. Sharing knowledge about the
     * internal layout makes it a lot harder to keep binary compatibility
     * (if people tries to use it's size etc).
     */
    struct lcb_st;
    typedef struct lcb_st *lcb_t;

    struct lcb_http_request_st;
    typedef struct lcb_http_request_st *lcb_http_request_t;

    struct lcb_timer_st;
    typedef struct lcb_timer_st *lcb_timer_t;


    typedef lcb_uint8_t lcb_datatype_t;

    typedef enum {
        LCB_CONFIGURATION_NEW = 0x00,
        LCB_CONFIGURATION_CHANGED = 0x01,
        LCB_CONFIGURATION_UNCHANGED = 0x02
    } lcb_configuration_t;

    /**
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
     * Possible statuses for keys in OBSERVE response
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

    typedef enum {
        /** Use bucket name and setup config listener */
        LCB_TYPE_BUCKET = 0x00,
        /** Ignore bucket name. All data calls will return LCB_NOT_SUPPORTED */
        LCB_TYPE_CLUSTER = 0x01
    } lcb_type_t;

#if defined(_WIN32) && defined(SOCKET)
    typedef SOCKET lcb_socket_t;
#else
    typedef int lcb_socket_t;
#endif

    typedef enum {
        LCB_IO_OPS_INVALID = 0x00,
        LCB_IO_OPS_DEFAULT = 0x01,
        LCB_IO_OPS_LIBEVENT = 0x02,
        LCB_IO_OPS_WINSOCK = 0x03,
        LCB_IO_OPS_LIBEV = 0x04,
        LCB_IO_OPS_SELECT = 0x05,
        LCB_IO_OPS_WINIOCP = 0x06,
        LCB_IO_OPS_LIBUV = 0x07
    } lcb_io_ops_type_t;

    /** Data is available for reading */
#define LCB_READ_EVENT 0x02
    /** Data can be written */
#define LCB_WRITE_EVENT 0x04
    /** Exceptional condition ocurred on socket */
#define LCB_ERROR_EVENT 0x08
#define LCB_RW_EVENT (LCB_READ_EVENT|LCB_WRITE_EVENT)

    typedef enum {
        LCB_VBUCKET_STATE_ACTIVE = 1,   /* Actively servicing a vbucket. */
        LCB_VBUCKET_STATE_REPLICA = 2,  /* Servicing a vbucket as a replica only. */
        LCB_VBUCKET_STATE_PENDING = 3,  /* Pending active. */
        LCB_VBUCKET_STATE_DEAD = 4      /* Not in use, pending deletion. */
    } lcb_vbucket_state_t;

    typedef enum {
        LCB_VERBOSITY_DETAIL = 0x00,
        LCB_VERBOSITY_DEBUG = 0x01,
        LCB_VERBOSITY_INFO = 0x02,
        LCB_VERBOSITY_WARNING = 0x03
    } lcb_verbosity_level_t;

    struct sockaddr;

    struct lcb_iovec_st {
        char *iov_base;
        lcb_size_t iov_len;
    };

    struct lcb_nameinfo_st {
        struct {
            struct sockaddr *name;
            int *len;
        } local;

        struct {
            struct sockaddr *name;
            int *len;
        } remote;
    };

    typedef struct lcb_io_opt_st *lcb_io_opt_t;

    struct lcb_iops_table_v0_st {
        void *cookie;
        int error;
        int need_cleanup;

        /**
         * Create a non-blocking socket.
         */
        lcb_socket_t (*socket)(struct lcb_io_opt_st *iops,
                               int domain,
                               int type,
                               int protocol);
        int (*connect)(struct lcb_io_opt_st *iops,
                       lcb_socket_t sock,
                       const struct sockaddr *name,
                       unsigned int namelen);
        lcb_ssize_t (*recv)(struct lcb_io_opt_st *iops,
                            lcb_socket_t sock,
                            void *buffer,
                            lcb_size_t len,
                            int flags);
        lcb_ssize_t (*send)(struct lcb_io_opt_st *iops,
                            lcb_socket_t sock,
                            const void *msg,
                            lcb_size_t len,
                            int flags);
        lcb_ssize_t (*recvv)(struct lcb_io_opt_st *iops,
                             lcb_socket_t sock,
                             struct lcb_iovec_st *iov,
                             lcb_size_t niov);
        lcb_ssize_t (*sendv)(struct lcb_io_opt_st *iops,
                             lcb_socket_t sock,
                             struct lcb_iovec_st *iov,
                             lcb_size_t niov);
        void (*close)(struct lcb_io_opt_st *iops,
                      lcb_socket_t sock);
        void *(*create_timer)(struct lcb_io_opt_st *iops);
        void (*destroy_timer)(struct lcb_io_opt_st *iops,
                              void *timer);
        void (*delete_timer)(struct lcb_io_opt_st *iops,
                             void *timer);
        int (*update_timer)(struct lcb_io_opt_st *iops,
                            void *timer,
                            lcb_uint32_t usec,
                            void *cb_data,
                            void (*handler)(lcb_socket_t sock,
                                            short which,
                                            void *cb_data));
        void *(*create_event)(struct lcb_io_opt_st *iops);
        void (*destroy_event)(struct lcb_io_opt_st *iops,
                              void *event);
        int (*update_event)(struct lcb_io_opt_st *iops,
                            lcb_socket_t sock,
                            void *event,
                            short flags,
                            void *cb_data,
                            void (*handler)(lcb_socket_t sock,
                                            short which,
                                            void *cb_data));
        void (*delete_event)(struct lcb_io_opt_st *iops,
                             lcb_socket_t sock,
                             void *event);
        void (*stop_event_loop)(struct lcb_io_opt_st *iops);
        void (*run_event_loop)(struct lcb_io_opt_st *iops);
    };

    struct ringbuffer_st;

    struct lcb_buf_info {
        /**
         * This is an allocated buffer. The IOPS plugin will free this
         * when the containing structure is destroyed. This must be freed
         * using lcb_mem_free
         */
        char *root;

        /** Size of the allocated buffer */
        lcb_size_t size;

        /**
         * Ringbuffer structure used by lcb internally. Its contents are not
         * public, but it will be freed by the IOPS plugin when the containing
         * structure is destroyed as well.
         *
         * Should be freed using lcb_mem_free
         */
        struct ringbuffer_st *ringbuffer;

        /**
         * A pair of iov structures. This is always mapped to the 'root'
         * and should never be freed directly.
         */
        struct lcb_iovec_st iov[2];
    };

    struct lcb_connection_st;

    /**
     * It is intended for IO plugins to 'subclass' this structure, and add
     * any additional fields here after the pre-defined fields.
     */
    typedef struct lcb_sockdata_st {
        /**
         * Underlying socket/handle
         */
        lcb_socket_t socket;

        /**
         * Pointer to the parent IOPS structure
         */
        lcb_io_opt_t parent;

        /**
         * The underlying connection object:
         */
        struct lcb_connection_st *lcbconn;

        /**
         * Whether libcouchbase has logically 'closed' this socket.
         * For use by libcouchbase only.
         * Handy if we get a callback from a pending-close socket.
         */
        int closed;
        int is_reading;

        /**
         * Pointer to underlying buffer and size of the iov_r field.
         * This is owned by the IO plugin until the read operation has
         * completed.
         */
        struct lcb_buf_info read_buffer;
    } lcb_sockdata_t;

    /**
     * IO plugins should subclass this if there is any additional
     * metadata associated with a 'write' structure. The 'iov' fields
     * contain memory pointed to by libcouchbase, and should not be modified
     * outside of libcouchbase, though the IO plugin should read its
     * contents.
     *
     * A valid structure should be returned via io->create_writebuf and should
     * be released with io->free_writebuf. These functions should only
     * allocate the *structure*, not the actual buffers
     */
    typedef struct lcb_io_writebuf_st {
        /**
         * Because the pointer to the cursock's "privadata" may no longer
         * be valid, use a direct pointer to the IO structure to free the
         * buffer
         */
        struct lcb_io_opt_st *parent;

        struct lcb_buf_info buffer;
    } lcb_io_writebuf_t;

    typedef void (*lcb_io_v0_callback)(lcb_socket_t, short, void *);


    /**
     * Callback which is invoked when a certain handle has been connected
     * (or failed to connect)
     */
    typedef void (*lcb_io_connect_cb)(lcb_sockdata_t *socket, int status);

    /**
     * Called when a read request has been completed.
     */
    typedef void (*lcb_io_read_cb)(lcb_sockdata_t *socket, lcb_ssize_t nr);

    typedef void (*lcb_io_error_cb)(lcb_sockdata_t *socket);

    /**
     * Called when a write has been completed
     */
    typedef void (*lcb_io_write_cb)(lcb_sockdata_t *socket,
                                    lcb_io_writebuf_t *buf,
                                    int status);


    struct lcb_iops_table_v1_st {
        /**
         * IOPS optimized for IOCP-style IO.
         * The non-IO routines are intended to be binary compatible
         * with the older v0 structure, so I don't have to change too
         * much code initially. Hence the 'pad'.
         * The intent is that the following functions remain
         * ABI-compatible with their v0 counterparts:
         *
         * - create_timer
         * - destroy_timer
         * - update_timer
         * - cookie
         * - error
         * - need_cleanup
         * - run_event_loop
         * - stop_event_loop
         *
         * - The send/recv functions have been replaced with completion-
         *    oriented counterparts of start_write and start_read;
         *
         * - connect has been replace by start_connect
         *
         * - update_event, delete_event, and destroy_event are not
         *   available in v1.
         *
         * - close is asynchronous, and is implied in destroy_socket.
         *   destroy_socket will only be called once all pending
         *   operations have been completed.
         *
         * Note that the 'destructor' itself *must* be asynchronous,
         * as 'destroy' may be called when there are still pending
         * operations. In this case, it means that libcouchbase is
         * done with the IOPS structure, but the implementation should
         * check that no operations are pending before freeing the
         * data.
         */
        void *cookie;
        int error;
        int need_cleanup;

        /**
         * The returned socket should be initialized with a reference
         * count of 1 on success.
         * v0: socket()
         */
        lcb_sockdata_t *(*create_socket)(struct lcb_io_opt_st *iops,
                                         int domain,
                                         int type,
                                         int protocol);

        /**
         * Request a connection to the socket.
         * v0: connect()
         */
        int (*start_connect)(struct lcb_io_opt_st *iops,
                             lcb_sockdata_t *socket,
                             const struct sockaddr *name,
                             unsigned int namelen,
                             lcb_io_connect_cb callback);

        /**
         * write buffer allocation and releasing
         * v0: recv()
         */
        lcb_io_writebuf_t *(*create_writebuf)(struct lcb_io_opt_st *iops,
                                              lcb_sockdata_t *sock);


        /**
         * Release (free) a writebuf created with create_writebuf
         * v0: send()
         */
        void (*release_writebuf)(struct lcb_io_opt_st *iops,
                                 lcb_sockdata_t *sock,
                                 lcb_io_writebuf_t *buf);

        /**
         * Start writing data
         * v0: recvv()
         */
        int (*start_write)(struct lcb_io_opt_st *iops,
                           lcb_sockdata_t *socket,
                           lcb_io_writebuf_t *buf,
                           lcb_io_write_cb callback);

        /**
         * v0: sendv()
         * Request to read a bunch of data from the socket
         */
        int (*start_read)(struct lcb_io_opt_st *iops,
                          lcb_sockdata_t *socket,
                          lcb_io_read_cb callback);

        /**
         * Destroy the socket.
         * XXX: If the socket still has a valid bufroot, this will be
         * owned (and typically freed) by the IO plugin.
         * v0: close()
         */
        unsigned int (*close_socket)(struct lcb_io_opt_st *iops,
                                     lcb_sockdata_t *socket);

        /**
         * Insert normal start/stop stuff here
         */

        void *(*create_timer)(struct lcb_io_opt_st *iops);
        void (*destroy_timer)(struct lcb_io_opt_st *iops,
                              void *timer);
        void (*delete_timer)(struct lcb_io_opt_st *iops,
                             void *timer);
        int (*update_timer)(struct lcb_io_opt_st *iops,
                            void *timer,
                            lcb_uint32_t usec,
                            void *cb_data,
                            void (*handler)(lcb_socket_t sock,
                                            short which,
                                            void *cb_data));

        /** v0: create_event */

        /**
         * Return the 'remote' and 'local' address of a connected socket.
         * Returns nonzero if the socket is invalid
         */
        int (*get_nameinfo)(struct lcb_io_opt_st *iops,
                            lcb_sockdata_t *sock,
                            struct lcb_nameinfo_st *ni);

        /**  v0: destroy_event */
        void (*pad_2)(void);
        /** v0: update_event */
        void (*pad_3)(void);

        /**
         * In the rare event that scheduling a read should fail, this should
         * deliver an async error message to the specified callback indicating
         * that the socket has failed.
         *
         * This is to avoid libcouchbase invoking callbacks while the
         * user has control of the event loop
         *
         * v0: delete_event
         */
        void (*send_error)(struct lcb_io_opt_st *iops,
                           lcb_sockdata_t *sock,
                           lcb_io_error_cb callback);

        void (*stop_event_loop)(struct lcb_io_opt_st *iops);
        void (*run_event_loop)(struct lcb_io_opt_st *iops);

    };

    struct lcb_io_opt_st {
        int version;
        void *dlhandle;
        void (*destructor)(struct lcb_io_opt_st *iops);
        union {
            struct lcb_iops_table_v0_st v0;
            struct lcb_iops_table_v1_st v1;
        } v;
    };

    typedef enum {
        LCB_ASYNCHRONOUS = 0x00,
        LCB_SYNCHRONOUS = 0xff
    } lcb_syncmode_t;

    typedef enum {
        LCB_IPV6_DISABLED = 0x00,
        LCB_IPV6_ONLY = 0x1,
        LCB_IPV6_ALLOW = 0x02
    } lcb_ipv6_t;

#ifdef __cplusplus
}
#endif

#endif
