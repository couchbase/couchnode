#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "include libcouchbase/couchbase.h first"
#endif

#ifndef LCB_IOPS_H
#define LCB_IOPS_H

/**
 * @file
 * @brief Public I/O integration interface
 * @details
 *
 * This file provides the public I/O interface for integrating with external
 * event loops.
 */

/**
 * @ingroup LCBIO LCB_PUBAPI
 * @defgroup LCBIO_IOPS I/O Operations API
 * @details
 *
 * I/O Integration comes in two flavors:
 *
 * ## Event/Poll Based Integration
 *
 * **Mnemonic**: **E**
 *
 * This system is based upon the interfaces exposed by the `poll(2)` and
 * `select(2)` calls found in POSIX-based systems and are wrapped by systems
 * such as _libevent_ and _libev_. At their core is the notion that a socket
 * may be polled for readiness (either readiness for reading or readiness
 * for writing). When a socket is deemed ready, a callback is invoked indicating
 * which events took place.
 *
 *
 * ## Completion/Operation/Buffer Based Integration
 *
 * **Mnemonic**: **C**
 *
 * This system is based upon the interfaces exposed in the Win32 API where
 * I/O is done in terms of operations which are awaiting _completion_. As such
 * buffers are passed into the core, and the application is notified when the
 * operation on those buffers (either read into a buffer, or write from a buffer)
 * has been completed.
 *
 *
 * @addtogroup LCBIO_IOPS
 * @{
 */

#ifdef __cplusplus
extern "C" {
#endif

/** @brief Type representing the native socket type of the operating system */
#ifdef _WIN32
typedef SOCKET lcb_socket_t;
#else
typedef int lcb_socket_t;
#endif

struct sockaddr;

#ifndef _WIN32
/** Defined if the lcb_IOV structure conforms to `struct iovec` */
#define LCB_IOV_LAYOUT_UIO
typedef struct lcb_iovec_st {
    void *iov_base;
    size_t iov_len;
} lcb_IOV;
#else
/** Defined if the lcb_IOV structure conforms to `WSABUF` */
#define LCB_IOV_LAYOUT_WSABUF
typedef struct lcb_iovec_st {
    ULONG iov_len;
    void *iov_base;
} lcb_IOV;
#endif

/** @brief structure describing a connected socket's endpoints */
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

/**
 * @struct lcb_IOV
 * @brief structure indicating a buffer and its size
 *
 * @details
 * This is compatible with a `struct iovec` on Unix and a `WSABUF` structure
 * on Windows. It has an `iov_base` field which is the base pointer and an
 * `iov_len` field which is the length of the buffer.
 */

typedef struct lcb_io_opt_st* lcb_io_opt_t;

/**
 * @brief Callback invoked for all poll-like events
 *
 * @param sock the socket associated with the event
 * @param events the events which activated this callback. This is set of bits
 *        comprising of LCB_READ_EVENT, LCB_WRITE_EVENT, and LCB_ERROR_EVENT
 * @param uarg a user-defined pointer passed to the
 *        lcb_ioE_event_watch_fn routine.
 */
typedef void (*lcb_ioE_callback)
        (lcb_socket_t sock, short events, void *uarg);

/**@name Timer Callbacks
 *@{*/

/**
 * @brief Create a new timer object.
 *
 * @param iops the io structure
 * @return an opaque timer handle. The timer shall remain inactive and shall
 *         be destroyed via the lcb_io_timer_destroy_fn routine.
 */
typedef void *(*lcb_io_timer_create_fn)
        (lcb_io_opt_t iops);

/**
 * @brief Destroy a timer handler
 *
 * Destroy a timer previously created with lcb_io_timer_create_fn
 * @param iops the io structure
 * @param timer the opaque handle
 * The timer must have already been cancelled via lcb_io_timer_cancel_fn
 */
typedef void (*lcb_io_timer_destroy_fn)
        (lcb_io_opt_t iops, void *timer);

/**
 * @brief Cancel a pending timer callback
 *
 * Cancel and unregister a pending timer. If the timer has already
 * fired, this does nothing. If the timer has not yet fired, the callback
 * shall not be delivered.
 *
 * @param iops the I/O structure
 * @param timer the timer to cancel.
 */
typedef void (*lcb_io_timer_cancel_fn)
        (lcb_io_opt_t iops, void *timer);

/**
 * @brief Schedule a callback to be invoked within a given interval.
 *
 * Schedule a timer to be fired within usec microseconds from now
 * @param iops the I/O structure
 * @param timer a timer previously created with timer_create
 * @param usecs the timer interval
 * @param uarg the user-defined pointer to be passed in the callback
 * @param callback the callback to invoke
 */
typedef int (*lcb_io_timer_schedule_fn)
        (lcb_io_opt_t iops, void *timer,
                lcb_uint32_t usecs,
                void *uarg,
                lcb_ioE_callback callback);

/**@}*/


/**@name Event Handle Callbacks
 * @{*/

/**
 * @brief Create a new event handle.
 *
 * An event object may be used to monitor a socket for given I/O readiness events
 * @param iops the I/O structure.
 * @return a new event handle.
 * The handle may then be associated with a
 * socket and watched (via lcb_ioE_event_watch_fn) for I/O readiness.
 */
typedef void *(*lcb_ioE_event_create_fn)
        (lcb_io_opt_t iops);

/**
 * @brief Destroy an event handle
 *
 * Destroy an event object. The object must not be active.
 * @param iops the I/O structure
 * @param event the event to free
 */
typedef void (*lcb_ioE_event_destroy_fn)
        (lcb_io_opt_t iops, void *event);

/**
 * @deprecated lcb_ioE_event_watch_fn() should be used with `0` for events
 * @brief Cancel pending callbacks and unwatch a handle.
 *
 * @param iops the I/O structure
 * @param sock the socket associated with the event
 * @param event the opaque event object
 *
 * This function may be called multiple times and shall not fail even if the
 * event is already inactive.
 */
typedef void (*lcb_ioE_event_cancel_fn)
        (lcb_io_opt_t iops, lcb_socket_t sock, void *event);


/** Data is available for reading */
#define LCB_READ_EVENT 0x02
/** Data can be written */
#define LCB_WRITE_EVENT 0x04
/** Exceptional condition ocurred on socket */
#define LCB_ERROR_EVENT 0x08
#define LCB_RW_EVENT (LCB_READ_EVENT|LCB_WRITE_EVENT)

/**
 * Associate an event with a socket, requesting notification when one of
 * the events specified in 'flags' becomes available on the socket.
 *
 * @param iops the IO context
 * @param socket the socket to watch
 * @param event the event to associate with the socket. If this parameter is
 * @param evflags a bitflag of events to watch. This is one of LCB_READ_EVENT,
 * LCB_WRITE_EVENT, or LCB_RW_EVENT.
 * If this value is `0` then existing events shall be cancelled on the
 * socket.
 *
 * Note that the callback may _also_ receive LCB_ERROR_EVENT but this cannot
 * be requested as an event to watch for.
 *
 * @param uarg a user defined pointer to be passed to the callback
 * @param callback the callback to invoke when one of the events becomes
 * ready.
 *
 * @attention
 * It shall be legal to call this routine multiple times without having to call
 * the lcb_ioE_event_cancel_fn(). The cancel function should in fact be implemented
 * via passing a `0` to the `evflags` parameter, effectively clearing the
 * event.
 */
typedef int (*lcb_ioE_event_watch_fn)
        (lcb_io_opt_t iops,
                lcb_socket_t socket,
                void *event,
                short evflags,
                void *uarg,
                lcb_ioE_callback callback);

/**@}*/

/**@name BSD-API I/O Routines
 * @{*/

/**
 * @brief Receive data into a single buffer
 * @see `recv(2)` socket API call.
 */
typedef lcb_ssize_t (*lcb_ioE_recv_fn)
        (lcb_io_opt_t iops, lcb_socket_t sock, void *target_buf,
                lcb_size_t buflen, int _unused_flags);

/** @brief Send data from a single buffer.
 * @see `send(2)` on POSIX
 */
typedef lcb_ssize_t (*lcb_ioE_send_fn)
        (lcb_io_opt_t iops, lcb_socket_t sock, const void *srcbuf,
                lcb_size_t buflen, int _ignored);

/**@brief Read data into a series of buffers.
 * @see the `recvmsg(2)` function on POSIX */
typedef lcb_ssize_t (*lcb_ioE_recvv_fn)
        (lcb_io_opt_t iops, lcb_socket_t sock, lcb_IOV *iov, lcb_size_t niov);

/**@brief Write data from multiple buffers.
 * @see the `sendmsg(2)` function on POSIX */
typedef lcb_ssize_t (*lcb_ioE_sendv_fn)
        (lcb_io_opt_t iops, lcb_socket_t sock, lcb_IOV *iov, lcb_size_t niov);

/**@brief Create a new socket.
 * @see `socket(2)` on POSIX */
typedef lcb_socket_t (*lcb_ioE_socket_fn)
        (lcb_io_opt_t iops, int domain, int type, int protocol);

/**@brief Connect a created socket
 * @see `connect(2)` on POSIX */
typedef int (*lcb_ioE_connect_fn)
        (lcb_io_opt_t iops,
                lcb_socket_t sock,
                const struct sockaddr *dst,
                unsigned int addrlen);

/** @private */
typedef int (*lcb_ioE_bind_fn)
        (lcb_io_opt_t iops,
                lcb_socket_t sock,
                const struct sockaddr *srcaddr,
                unsigned int addrlen);

/** @private */
typedef int (*lcb_ioE_listen_fn)
        (lcb_io_opt_t iops,
                lcb_socket_t bound_sock,
                unsigned int queuelen);

/** @private */
typedef lcb_socket_t (*lcb_ioE_accept_fn)
        (lcb_io_opt_t iops,
                lcb_socket_t lsnsock);

/** @brief Close a socket
 * @see `close(2)` and `shutdown(2)` */
typedef void (*lcb_ioE_close_fn)
        (lcb_io_opt_t iops, lcb_socket_t sock);

/**@}*/


struct ringbuffer_st;
struct lcb_connection_st;
struct lcbio_SOCKET;

/** @deprecated Ringbuffers are no longer used this way by the library for I/O */
struct lcb_buf_info {
    char *root;
    lcb_size_t size;
    struct ringbuffer_st *ringbuffer;
    struct lcb_iovec_st iov[2];
};

/**
 * @brief Socket handle for completion-based I/O
 *
 * The sockdata structure is analoguous to an `lcb_socket_t` returned by
 * the E-model I/O.
 */
typedef struct lcb_sockdata_st {
    lcb_socket_t socket; /**< System socket, for informational purposes */
    lcb_io_opt_t parent; /**< Parent I/O context */
    struct lcbio_SOCKET *lcbconn; /**< Internal socket equivalent */
    int closed; /**< @deprecated No longer used by the library */
    int is_reading; /**< Internally used by lcbio */
    struct lcb_buf_info read_buffer; /**< @deprecated No longer used by the library */
} lcb_sockdata_t;

/** @deprecated */
typedef struct lcb_io_writebuf_st {
    struct lcb_io_opt_st *parent;
    struct lcb_buf_info buffer;
} lcb_io_writebuf_t;

/**@name Completion Routines
 * @{*/

/**
 * @brief Create a completion socket handle
 *
 * Create an opaque socket handle
 * @param iops the IO context
 * @param domain socket address family, e.g. AF_INET
 * @param type the transport type, e.g. SOCK_STREAM
 * @param protocol the IP protocol, e.g. IPPROTO_TCP
 * @return a socket pointer or NULL on failure.
 */
typedef lcb_sockdata_t* (*lcb_ioC_socket_fn)
        (lcb_io_opt_t iops, int domain, int type, int protocol);

/**
 * @brief Callback to be invoked upon a connection result.
 * Callback invoked for a connection result.
 * @param socket the socket which is being connected
 * @param status the status. 0 for success, nonzero on failure
 */
typedef void (*lcb_io_connect_cb)(lcb_sockdata_t *socket, int status);

/**
 * @brief Request a connection for a socket
 * @param iops the IO context
 * @param sd the socket pointer
 * @param dst the address to connect to
 * @param naddr the size of the address len, e.g. sizeof(struct sockaddr_in)
 * @param callback the callback to invoke when the connection status is determined
 * @return 0 on success, nonzero if a connection could not be scheduled.
 */
typedef int (*lcb_ioC_connect_fn)
        (lcb_io_opt_t iops, lcb_sockdata_t *sd,
                const struct sockaddr *dst,
                unsigned int naddr,
                lcb_io_connect_cb callback);

/**
 * @brief Callback invoked when a new client connection has been established
 * @param sd_server the server listen socket
 * @param sd_client the new client socket
 * @param status if there was an error accepting (in this case, sd_client is NULL
 */
typedef void (lcb_ioC_serve_callback)
        (lcb_sockdata_t *sd_server,
                lcb_sockdata_t *sd_client,
                int status);

/**
 * Specify that the socket start accepting connections. This should be called
 * on a newly created non-connected socket
 * @param iops the I/O context
 * @param server_socket the socket used to listen with
 * @param sockaddr the local address for listening
 * @param callback the callback to invoke for each new connection
 */
typedef int (*lcb_ioC_serve_fn)
        (lcb_io_opt_t iops,
                lcb_sockdata_t *server_socket,
                const struct sockaddr *listen_addr,
                lcb_ioC_serve_callback callback);

/**
 * @brief Request address information on a connected socket
 * @param iops the I/O context
 * @param sock the socket from which to retrieve information
 * @param ni a nameinfo structure to populate with the relevant details
 */
typedef int (*lcb_ioC_nameinfo_fn)
        (lcb_io_opt_t iops,
                lcb_sockdata_t *sock,
                struct lcb_nameinfo_st *ni);

/**@deprecated*/
typedef void (*lcb_ioC_read_callback)(lcb_sockdata_t *sd, lcb_ssize_t nread);
#define lcb_io_read_cb lcb_ioC_read_callback
/**@deprecated See lcb_ioC_read2_fn(). Wrapped if not implemented*/
typedef int (*lcb_ioC_read_fn)(lcb_io_opt_t,lcb_sockdata_t*,lcb_ioC_read_callback);
/**@deprecated See lcb_ioC_write2_fn(). Wrapped if not implemented*/
typedef lcb_io_writebuf_t* (*lcb_ioC_wballoc_fn)(lcb_io_opt_t,lcb_sockdata_t *);
/**@deprecated See lcb_ioC_write2_fn(). Wrapped if not implemented */
typedef void (*lcb_ioC_wbfree_fn)(lcb_io_opt_t,lcb_sockdata_t*,lcb_io_writebuf_t*);
/**@deprecated See lcb_ioC_write2_fn(). This will be wrapped if not implemented */
typedef void (*lcb_ioC_write_callback)(lcb_sockdata_t*,lcb_io_writebuf_t*,int);
#define lcb_io_write_cb lcb_ioC_write_callback

/**@deprecated*/
typedef int (*lcb_ioC_write_fn)
        (lcb_io_opt_t,lcb_sockdata_t*,lcb_io_writebuf_t*,lcb_ioC_write_callback);


/**
 * @brief Callback received when a buffer has been flushed
 * @param sd the socket
 * @param status nonzero on error
 * @param arg the opaque handle passed in the write2 call
 */
typedef void (*lcb_ioC_write2_callback)
        (lcb_sockdata_t *sd,
                int status,
                void *arg);

/**
 * @brief Schedule a flush of a series of buffers to the network
 *
 * @param iops the I/O context
 * @param sd the socket on which to send
 * @param iov an array of IOV structures.
 *        The buffers pointed to by the IOVs themselves (i.e. `iov->iov_len`)
 *        **must** not be freed or modified until the callback has been invoked.
 *        The storage for the IOVs themselves (i.e. the array passed in `iov`)
 *        is copied internally to the implementation.
 *
 * @param niov the number of IOV structures within the array
 * @param uarg an opaque pointer to be passed in the callback
 * @param callback the callback to invoke. This will be called when the buffers
 *        passed have either been completely flushed (and are no longer required)
 *        or when an error has taken place.
 */
typedef int (*lcb_ioC_write2_fn)
        (lcb_io_opt_t iops,
                lcb_sockdata_t *sd,
                lcb_IOV *iov,
                lcb_size_t niov,
                void *uarg,
                lcb_ioC_write2_callback callback);


/**
 * @brief Callback invoked when a read has been completed
 * @param sd the socket
 * @param nread number of bytes read, or -1 on error
 * @param arg user provided argument for callback.
 */
typedef void (*lcb_ioC_read2_callback)
        (lcb_sockdata_t *sd, lcb_ssize_t nread, void *arg);
/**
 * @brief Schedule a read from the network
 * @param iops the I/O context
 * @param sd the socket on which to read
 * @param iov an array of IOV structures
 * @param niov the number of IOV structures within the array
 * @param uarg a pointer passed to the callback
 * @param callback the callback to invoke
 * @return 0 on success, nonzero on error
 *
 * The IOV array itself shall copied (if needed) into the I/O implementation
 * and thus does not need to be kept in memory after the function has been
 * called. Note that the underlying buffers _do_ need to remain valid until
 * the callback is received.
 */
typedef int (*lcb_ioC_read2_fn)
        (lcb_io_opt_t iops,
                lcb_sockdata_t *sd,
                lcb_IOV *iov,
                lcb_size_t niov,
                void *uarg,
                lcb_ioC_read2_callback callback);

/**
 * @brief Asynchronously shutdown the socket.
 *
 * Request an asynchronous close for the specified socket. This merely releases
 * control from the library over to the plugin for the specified socket and
 * does _not_ actually imply that the resources have been closed.
 *
 * Notable, callbacks for read and write operations will _still_ be invoked
 * in order to maintain proper resource deallocation. However the socket's
 * closed field will be set to true.
 *
 * @param iops the I/O context
 * @param sd the socket structure
 */
typedef unsigned int (*lcb_ioC_close_fn)
        (lcb_io_opt_t iops,
                lcb_sockdata_t *sd);

/**@}*/

/**
 * @brief Start the event loop
 * @param iops The I/O context
 *
 * This should start polling for socket events on all registered watchers
 * and scheduled events. This function should return either when there are
 * no more timers or events pending, or when lcb_io_stop_fn() has been invoked.
 */
typedef void (*lcb_io_start_fn)(lcb_io_opt_t iops);

/**
 * @brief Pause the event loop
 * @param iops The I/O Context
 *
 * This function shall suspend the event loop, causing a current invocation
 * to lcb_io_start_fn() to return as soon as possible
 */
typedef void (*lcb_io_stop_fn)(lcb_io_opt_t iops);

LCB_DEPRECATED(typedef void (*lcb_io_error_cb)(lcb_sockdata_t *socket));

#define LCB_IOPS_BASE_FIELDS \
    void *cookie; \
    int error; \
    int need_cleanup;

/** IOPS For poll-style notification */
struct lcb_iops_evented_st {
    LCB_IOPS_BASE_FIELDS
    lcb_ioE_socket_fn socket; /**< Create a socket */
    lcb_ioE_connect_fn connect; /**< Connect a socket */
    lcb_ioE_recv_fn recv; /**< Receive data into a single buffer */
    lcb_ioE_send_fn send; /**< Send data from a single buffer */
    lcb_ioE_recvv_fn recvv; /**< Receive data into multiple buffers */
    lcb_ioE_sendv_fn sendv; /**< Send data from multiple buffers */
    lcb_ioE_close_fn close; /**< Close a socket */

    lcb_io_timer_create_fn create_timer; /**< Create a new timer handle */
    lcb_io_timer_destroy_fn destroy_timer; /**< Destroy a timer handle */
    lcb_io_timer_cancel_fn delete_timer; /**< Cancel a pending timer */
    lcb_io_timer_schedule_fn update_timer; /**< Schedule a timer*/

    lcb_ioE_event_create_fn create_event; /**< Create a socket event handle */
    lcb_ioE_event_destroy_fn destroy_event; /**< Destroy a socket event handle */
    lcb_ioE_event_watch_fn update_event; /**< Watch a socket for events */
    lcb_ioE_event_cancel_fn delete_event;

    lcb_io_stop_fn stop_event_loop; /**< Start the event loop */
    lcb_io_start_fn run_event_loop; /**< Stop the event loop */
};

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
struct lcb_iops_completion_st {
    LCB_IOPS_BASE_FIELDS

    lcb_ioC_socket_fn create_socket;
    lcb_ioC_connect_fn start_connect;
    lcb_ioC_wballoc_fn create_writebuf;
    lcb_ioC_wbfree_fn release_writebuf;
    lcb_ioC_write_fn start_write;
    lcb_ioC_read_fn start_read;
    lcb_ioC_close_fn close_socket;

    lcb_io_timer_create_fn create_timer;
    lcb_io_timer_destroy_fn destroy_timer;
    lcb_io_timer_cancel_fn delete_timer;
    lcb_io_timer_schedule_fn update_timer;

    lcb_ioC_nameinfo_fn get_nameinfo;

    void (*pad1)(void);
    void (*pad2)(void);

    /** @deprecated No longer used */
    void (*send_error)(struct lcb_io_opt_st*, lcb_sockdata_t*,void(*)(lcb_sockdata_t*));

    lcb_io_stop_fn stop_event_loop;
    lcb_io_start_fn run_event_loop;
};

/** @brief Common functions for starting and stopping timers */
typedef struct lcb_timerprocs_st {
    lcb_io_timer_create_fn create;
    lcb_io_timer_destroy_fn destroy;
    lcb_io_timer_cancel_fn cancel;
    lcb_io_timer_schedule_fn schedule;
} lcb_timer_procs;

/** @brief Common functions for starting and stopping the event loop */
typedef struct lcb_loopprocs_st {
    lcb_io_start_fn start;
    lcb_io_stop_fn stop;
} lcb_loop_procs;

/** @brief Functions wrapping the Berkeley Socket API */
typedef struct lcb_bsdprocs_st {
    lcb_ioE_socket_fn socket0;
    lcb_ioE_connect_fn connect0;
    lcb_ioE_recv_fn recv;
    lcb_ioE_recvv_fn recvv;
    lcb_ioE_send_fn send;
    lcb_ioE_sendv_fn sendv;
    lcb_ioE_close_fn close;
    lcb_ioE_bind_fn bind;
    lcb_ioE_listen_fn listen;
    lcb_ioE_accept_fn accept;
} lcb_bsd_procs;

/** @brief Functions handling socket watcher events */
typedef struct lcb_evprocs_st {
    lcb_ioE_event_create_fn create;
    lcb_ioE_event_destroy_fn destroy;
    lcb_ioE_event_cancel_fn cancel;
    lcb_ioE_event_watch_fn watch;
} lcb_ev_procs;

/** @brief Functions for completion-based I/O */
typedef struct {
    lcb_ioC_socket_fn socket;
    lcb_ioC_close_fn close;
    lcb_ioC_read_fn read;
    lcb_ioC_connect_fn connect;
    lcb_ioC_wballoc_fn wballoc;
    lcb_ioC_wbfree_fn wbfree;
    lcb_ioC_write_fn write;
    lcb_ioC_write2_fn write2;
    lcb_ioC_read2_fn read2;
    lcb_ioC_serve_fn serve;
    lcb_ioC_nameinfo_fn nameinfo;
} lcb_completion_procs;

/**
 * Enumeration defining the I/O model
 */
typedef enum {
    LCB_IOMODEL_EVENT, /**< Event/Poll style */
    LCB_IOMODEL_COMPLETION /**< IOCP/Completion style */
} lcb_iomodel_t;

/**
 * @param version the ABI/API version for the proc structures. Note that
 *  ABI is forward compatible for all proc structures, meaning that newer
 *  versions will always extend new fields and never replace existing ones.
 *  However in order to avoid a situation where a newer version of a plugin
 *  is loaded against an older version of the library (in which case the plugin
 *  will assume the proc table size is actually bigger than it is) the version
 *  serves as an indicator for this. The version actually passed is defined
 *  in `LCB_IOPROCS_VERSION`
 *
 * @param loop_procs a table to be set to basic loop control routines
 * @param timer_procs a table to be set to the timer routines
 * @param bsd_procs a table to be set to BSD socket API routines
 * @param ev_procs a table to be set to event watcher routines
 * @param completion_procs a table to be set to completion routines
 * @param iomodel the I/O model to be used. If this is `LCB_IOMODEL_COMPLETION`
 * then the contents of `bsd_procs` will be ignored and `completion_procs` must
 * be populated. If the mode is `LCB_IOMODEL_EVENT` then the `bsd_procs` must be
 * populated and `completion_procs` is ignored.
 *
 * Important to note that internally the `ev`, `bsd`, and `completion` field are
 * defined as a union, thus
 * @code{.c}
 * union {
 *     struct {
 *         lcb_bsd_procs;
 *         lcb_ev_procs;
 *     } event;
 *     struct lcb_completion_procs completion;
 * }
 * @endcode
 * thus setting both fields will actually clobber.
 *
 * @attention
 * Note that the library takes ownership of the passed tables and it should
 * not be controlled or accessed by the plugin.
 *
 * @attention
 * This function may not have any side effects as it may be called
 * multiple times.
 *
 * As opposed to the v0 and v1 IOPS structures that require a table to be
 * populated and returned, the v2 IOPS works differently. Specifically, the
 * IOPS population happens at multiple stages:
 *
 * 1. The base structure is returned, i.e. `lcb_create_NAME_iops` where _NAME_
 *    is the name of the plugin
 *
 * 2. Once the structure is returned, LCB shall invoke the `v.v2.get_procs()`
 *    function. The callback is responsible for populating the relevant fields.
 *
 * Note that the old `v0` and `v1` fields are now proxied via this mechanism.
 * It _is_ possible to still monkey-patch the IO routines, but ensure the
 * monkey patching takes place _before_ the instance is created (as the
 * instance will initialize its own IO Table); thus, e.g.
 * @code{.c}
 * static void monkey_proc_fn(...) {
 *     //
 * }
 *
 * static void monkey_patch_io(lcb_io_opt_t io) {
 *     io->v.v0.get_procs = monkey_proc_fn;
 * }
 *
 * int main(void) {
 *     lcb_create_st options;
 *     lcb_t instance;
 *     lcb_io_opt_t io;
 *     lcb_create_iops(&io, NULL);
 *     monkey_patch_io(io);
 *     options.v.v0.io = io;
 *     lcb_create(&instance, &options);
 *     // ...
 * }
 * @endcode
 *
 * Typically the `get_procs` function will only be called once, and this will
 * happen from within lcb_create(). Thus in order to monkey patch you must
 * ensure that initially the `get_procs` function itself is first supplanted
 * and then return your customized I/O routines from your own `get_procs` (in
 * this example, `monkey_proc_fn()`)
 *
 */
typedef void (*lcb_io_procs_fn)
        (int version,
                lcb_loop_procs *loop_procs,
                lcb_timer_procs *timer_procs,
                lcb_bsd_procs *bsd_procs,
                lcb_ev_procs *ev_procs,
                lcb_completion_procs *completion_procs,
                lcb_iomodel_t *iomodel);

struct lcbio_TABLE;
struct lcb_iops2_st {
    LCB_IOPS_BASE_FIELDS
    lcb_io_procs_fn get_procs;
    struct lcbio_TABLE *iot;
};

/**
 * This number is bumped up each time a new field is added to any of the
 * function tables
 */
#define LCB_IOPROCS_VERSION 2

struct lcb_io_opt_st {
    int version;
    void *dlhandle;
    void (*destructor)(struct lcb_io_opt_st *iops);
    union {
        struct {
            LCB_IOPS_BASE_FIELDS
        } base;

        /** These two names are deprecated internally */
        struct lcb_iops_evented_st v0;
        struct lcb_iops_completion_st v1;
        struct lcb_iops2_st v2;
    } v;
};

/**
 * @brief Signature for a loadable plugin's IOPS initializer
 *
 * @param version the plugin init API version. This will be 0 for this function
 * @param io a pointer to be set to the I/O table
 * @param cookie a user-defined argument passed to the I/O initializer
 * @return LCB_SUCCESS on success, an error on failure
 */
typedef lcb_error_t (*lcb_io_create_fn)
        (int version, lcb_io_opt_t *io, void *cookie);


#ifdef __cplusplus
}
#endif

/**@}*/

#endif
