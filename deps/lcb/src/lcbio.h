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
 * Common header for IO routines
 */

#ifndef LIBCOUCHBASE_INTERNAL_H
#error "Please include internal.h first"
#endif

#ifndef LCBIO_H
#define LCBIO_H

#ifdef __cplusplus
extern "C" {
#endif


    typedef enum {
        LCB_CONN_CONNECTED = 1,
        LCB_CONN_INPROGRESS = 2,
        LCB_CONN_ERROR = 3
    } lcb_connection_result_t;


    typedef enum {
        LCB_SOCKRW_READ = 1,
        LCB_SOCKRW_WROTE = 2,
        LCB_SOCKRW_IO_ERROR = 3,
        LCB_SOCKRW_GENERIC_ERROR = 4,
        LCB_SOCKRW_WOULDBLOCK = 5,
        LCB_SOCKRW_PENDING,
        LCB_SOCKRW_SHUTDOWN
    } lcb_sockrw_status_t;

    typedef enum {
        LCB_CONNSTATE_UNINIT = 0,
        LCB_CONNSTATE_CONNECTED,
        LCB_CONNSTATE_INPROGRESS
    } lcb_connstate_t;

    /**
     * Options for initiating a new connection.
     */
    typedef enum {
        /** Don't invoke callback on immediate event */
        LCB_CONNSTART_NOCB = 0x1,

        /** If initial scheduling attempt fails, schedule a callback */
        LCB_CONNSTART_ASYNCERR = 0x2
    } lcb_connstart_opts_t;

    struct lcb_connection_st;
    typedef void (*lcb_connection_handler)(struct lcb_connection_st *, lcb_error_t);

    struct lcb_timeout_info_st {
        /** The timer to use */

        void *timer;

        /** Set when update_timer is called, unset when delete_timer is called */
        short active;

        /** Delay for the timeout */
        lcb_uint32_t usec;
    };

    struct lcb_connection_st {
        struct addrinfo *ai;
        struct addrinfo *curr_ai;

        ringbuffer_t *input;
        ringbuffer_t *output;

        /** instance */
        lcb_t instance;

        /**
         * Data associated with the connection. This is also passed as the
         * third argument for the v0 event handler
         */
        void *data;

        /** callback to be invoked when the connection is complete */
        lcb_connection_handler on_connect_complete;

        /** for generic timeout events */
        lcb_connection_handler on_timeout;

        /** Timeout information */
        struct lcb_timeout_info_st timeout;

        /**
         * v0 event based I/O fields
         */
        struct {
            /** The handler callback */
            void (*handler)(lcb_socket_t, short, void *);
            /** The event from create_event */
            void *ptr;
            /** This is 0 if delete_event has been called */
            int active;
        } evinfo;

        /**
         * v1 completion based I/O fields
         */
        struct {
            lcb_io_read_cb read;
            lcb_io_write_cb write;
            lcb_io_error_cb error;
        } completion;

        /** Host/Port */
        char host[NI_MAXHOST + 1];
        char port[NI_MAXSERV + 1];

        /** this is populated with the socket when the connection is done */
        lcb_socket_t sockfd;

        /** This is the v1 socket */
        lcb_sockdata_t *sockptr;

        lcb_connstate_t state;

        short want;

        /** We should really typedef this... */
        /**
         * This contains the last "real" socket error received by this
         * connection. This can be something like ECONNREFUSED or similar.
         * Very helpful for debugging, and may also be exposed to the user
         * one day..
         */
#ifdef _WIN32
        DWORD last_error;
#else
        int last_error;
#endif

    };

    typedef struct lcb_connection_st *lcb_connection_t;

    /**
     * Initialize the connection object's buffers, usually allocating them
     */
    lcb_error_t lcb_connection_init(lcb_connection_t conn, lcb_t instance);


    /**
     * Resets the buffers in the connection. This allocates new writes or
     * read buffers if needed, or resets the mark of the existing ones, depending
     * on their ownership
     */
    lcb_error_t lcb_connection_reset_buffers(lcb_connection_t conn);


    /**
     * Request a connection. The connection object should be filled with the
     * appropriate callbacks
     * @param conn a connection object with properly initialized fields
     * @params options a set of options controlling the connection intialization
     *  behavior.
     */
    lcb_connection_result_t lcb_connection_start(lcb_connection_t conn,
                                                 lcb_connstart_opts_t options);

    /**
     * Close the socket and clean up any socket-related resources
     */
    void lcb_connection_close(lcb_connection_t conn);

    /**
     * Wrapper around lcb_getaddrinfo
     */
    int lcb_connection_getaddrinfo(lcb_connection_t conn, int refresh);

    /**
     * Free any resources allocated by the connection subsystem
     */
    void lcb_connection_cleanup(lcb_connection_t conn);

    /**
     * Activates the timer. If the timer is already active, this function
     * does nothing. Otherwise, it schedules a timer to be invoked in
     * conn->timeout.usec microseconds.
     *
     * @param conn a connection object
     * You may call delete_timer() to cancel the pending timeout
     */
    void lcb_connection_activate_timer(lcb_connection_t conn);

    /**
     * Unconditionally schedule a timer to be invoked in the interval specified
     * in the connection's timeout.usecs structure. If a timeout is already
     * active, it is cleared first; otherwise a new timeout is initialized
     * @param conn the connection
     */
    void lcb_connection_delay_timer(lcb_connection_t conn);

    /**
     * Cancel any timeout event set by update_timer on the connection
     */
    void lcb_connection_cancel_timer(lcb_connection_t conn);


    /* Read a bit of data */
    lcb_sockrw_status_t lcb_sockrw_v0_read(lcb_connection_t conn, ringbuffer_t *buf);

    /* Exhaust the data until there is nothing to read */
    lcb_sockrw_status_t lcb_sockrw_v0_slurp(lcb_connection_t conn, ringbuffer_t *buf);

    /* Write as much data from the write buffer until blocked */
    lcb_sockrw_status_t lcb_sockrw_v0_write(lcb_connection_t conn, ringbuffer_t *buf);

    int lcb_sockrw_flushed(lcb_connection_t conn);
    /**
     * Indicates that buffers should be read into or written from
     * @param conn the connection
     * @param events a set of event bits to request
     * @param clear_existing whether to clear any existing 'want' events. By
     * default, the existing events are AND'ed with the new ones.
     */
    void lcb_sockrw_set_want(lcb_connection_t conn, short events, int clear_existing);

    /**
     * Apply the 'want' events. This means to start (waiting for) reading and
     * writing.
     */
    void lcb_sockrw_apply_want(lcb_connection_t conn);

    int lcb_flushing_buffers(lcb_t instance);

    lcb_sockrw_status_t lcb_sockrw_v1_start_read(lcb_connection_t conn,
                                                 ringbuffer_t **buf,
                                                 lcb_io_read_cb callback,
                                                 lcb_io_error_cb error_callback);

    lcb_sockrw_status_t lcb_sockrw_v1_start_write(lcb_connection_t conn,
                                                  ringbuffer_t **buf,
                                                  lcb_io_write_cb callback,
                                                  lcb_io_error_cb error_callback);

    void lcb_sockrw_v1_onread_common(lcb_sockdata_t *sock,
                                     ringbuffer_t **dst,
                                     lcb_ssize_t nr);

    void lcb_sockrw_v1_onwrite_common(lcb_sockdata_t *sock,
                                      lcb_io_writebuf_t *wbuf,
                                      ringbuffer_t **dst);

    unsigned int lcb_sockrw_v1_cb_common(lcb_sockdata_t *sock,
                                         lcb_io_writebuf_t *wbuf,
                                         void **datap);

#ifdef __cplusplus
}
#endif

#endif /* LCBIO_H */
