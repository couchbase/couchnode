/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#ifndef LCB_LUV_INTERNAL_H_
#define LCB_LUV_INTERNAL_H_

#ifndef COUCHNODE_DEBUG
#define LCB_LUV_YOLOG_DEBUG_LEVEL 100
#endif

#ifdef _MSC_VER
#pragma warning(disable : 4244)
#pragma warning(disable : 4267)
#pragma warning(disable : 4506)
#pragma warning(disable : 4530)
#endif


#include "libcouchbase-libuv.h"
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include <errno.h>
#include "util/lcb_luv_yolog.h"

#ifdef UNUSED
#elif defined(__GNUC__)
# define UNUSED(x) x __attribute__((unused))
#elif defined(__LCLINT__)
# define UNUSED(x) /*@unused@*/ x
#else
# define UNUSED(x) x
#endif

#define EVSTATE_IS(p, b) \
    ( ( (p)->flags ) & LCB_LUV_EVf_ ## b)

#define EVSTATE_FIND(sock, evtype) \
    (sock->evstate + LCB_LUV_EV_ ## evtype)

#define SOCK_EV_ENABLED(sock, evtype) \
    (sock->event && (sock->event->lcb_events & LCB_ ## evtype ## _EVENT))

#define IOPS_COOKIE(iops) \
    ((struct lcb_luv_cookie_st*)(iops->v.v0.cookie))

#define MINIMUM(a,b) \
    ((a < b) ? a : b)

#define ASYNC_IS(sock, f) \
    ( ((sock)->async_state) & LCB_LUV_ASYNCf_##f )

/**
 * Fields representing various events
 */
enum {
    LCB_LUV_EV_READ = 0,
    LCB_LUV_EV_WRITE = 1,

    LCB_LUV_EV_RDWR_MAX = 2,

    LCB_LUV_EV_CONNECT = 2,
    LCB_LUV_EV_MAX
};


/**
 * Structure representing an event
 */
struct lcb_luv_event_st {
    /* socket */
    lcb_luv_socket_t handle;

    /* libcouchbase function to be invoked */
    lcb_luv_callback_t lcb_cb;
    /* argument to pass to callback */
    void *lcb_arg;

    /* which events to monitor */
    short lcb_events;
};

typedef enum {
    LCB_LUV_EVf_CONNECTED = 1 << 0,
    LCB_LUV_EVf_ACTIVE = 1 << 1,

    LCB_LUV_EVf_PENDING = 1 << 2,
    LCB_LUV_EVf_FLUSHING = 1 << 3,
} lcb_luv_evstate_flags_t;


typedef enum {
    /** Set by the callback when entered, unset when it returns */
    LCB_LUV_ASYNCf_ENTERED = 1 << 0,

    /** Set when we have requested a callback (i.e. async_send was called) */
    LCB_LUV_ASYNCf_SCHEDULED = 1 << 1,

    /** Set if the callback should loop again */
    LCB_LUV_ASYNCf_REDO = 1 << 2,

    /** Set if it should call deinit() on the next iteration */
    LCB_LUV_ASYNCf_DEINIT = 1 << 3

} lcb_luv_async_flags_t ;

struct lcb_luv_evstate_st {
    lcb_luv_evstate_flags_t flags;
    /* Recorded errno */
    int err;
};

/**
 * Structure representing a TCP network connection.
 */
struct lcb_luv_socket_st {
    /* Should be first */
    uv_tcp_t tcp;

    /* Union for our requests */
    union uv_any_req u_req;

    /* async handle */
    uv_async_t async;

    lcb_luv_async_flags_t async_state;

    /* Index into the 'fd' table */
    long idx;

    int eof;

    unsigned long refcount;

    struct {
        /* Readahead buffer*/
        uv_buf_t buf;
        char data[LCB_LUV_READAHEAD];
        size_t pos;
        size_t nb;
        int readhead_active;
    } read;

    struct {
        uv_buf_t buf;
        /* how much data does our buffer have */
        char data[LCB_LUV_WRITEBUFSZ];
        size_t pos;
        size_t nb;
    } write;



    /* various information on different operations */
    struct lcb_luv_evstate_st evstate[LCB_LUV_EV_MAX];

    /* Pointer to libcouchbase opaque event, if any */
    struct lcb_luv_event_st *event;

    /* Pointer to our cookie */
    struct lcb_luv_cookie_st *parent;
    unsigned handle_count;
};



void *lcb_luv_create_event(struct lcb_io_opt_st *iops);

int lcb_luv_update_event(struct lcb_io_opt_st *iops,
                         lcb_socket_t sock_i,
                         void *event_opaque,
                         short flags,
                         void *cb_data,
                         lcb_luv_callback_t cb);

void lcb_luv_delete_event(struct lcb_io_opt_st *iops,
                          lcb_socket_t sock_i,
                          void *event_opaque);

void lcb_luv_destroy_event(struct lcb_io_opt_st *iops,
                           void *event_opaque);

lcb_socket_t lcb_luv_socket(struct lcb_io_opt_st *iops,
                            int domain, int type, int protocol);

int lcb_luv_connect(struct lcb_io_opt_st *iops,
                    lcb_socket_t sock_i,
                    const struct sockaddr *saddr,
                    unsigned int saddr_len);


void lcb_luv_close(struct lcb_io_opt_st *iops, lcb_socket_t sock_i);


/* READ */
lcb_ssize_t lcb_luv_recv(struct lcb_io_opt_st *iops,
                         lcb_socket_t sock_i,
                         void *buffer,
                         lcb_size_t len,
                         int flags);
lcb_ssize_t lcb_luv_recvv(struct lcb_io_opt_st *iops,
                          lcb_socket_t sock_i,
                          struct lcb_iovec_st *iov,
                          lcb_size_t niov);


/* WRITE */
lcb_ssize_t lcb_luv_send(struct lcb_io_opt_st *iops,
                         lcb_socket_t sock_i,
                         const void *msg,
                         lcb_size_t len,
                         int flags);

lcb_ssize_t lcb_luv_sendv(struct lcb_io_opt_st *iops,
                          lcb_socket_t sock_i,
                          struct lcb_iovec_st *iov,
                          lcb_size_t niov);


/* TIMER */
void *lcb_luv_create_timer(struct lcb_io_opt_st *iops);

int lcb_luv_update_timer(struct lcb_io_opt_st *iops,
                         void *timer_opaque,
                         lcb_uint32_t usecs,
                         void *cbdata,
                         lcb_luv_callback_t callback);

void lcb_luv_delete_timer(struct lcb_io_opt_st *iops,
                          void *timer_opaque);

void lcb_luv_destroy_timer(struct lcb_io_opt_st *iops,
                           void *timer_opaque);

/**
 * These are functions private to lcb-luv. They are not iops functions
 */

/**
 * This will allocate a new 'socket'. Returns the new socket, or NULL
 * on error
 */
lcb_luv_socket_t lcb_luv_socket_new(struct lcb_io_opt_st *iops);

/**
 * This deinitializes a socket.
 * The reference count of the new socket is 1
 */
void lcb_luv_socket_deinit(lcb_luv_socket_t sock);

/**
 * This will decrement the reference count and free the socket if the
 * reference count is 0.  The return value is the reference count. If
 * the return is 0, then it means the socket is freed and does not
 * point to valid data.
 */
unsigned long lcb_luv_socket_unref(lcb_luv_socket_t sock);

#define lcb_luv_socket_ref(sock) sock->refcount++

/**
 * Frees the socket
 */
void lcb_luv_socket_free(lcb_luv_socket_t sock);

/**
 * This will get a socket structure from an index
 */
lcb_luv_socket_t lcb_luv_sock_from_idx(struct lcb_io_opt_st *iops,
                                       lcb_socket_t idx);

/**
 * Will try and let us get read events on this socket
 */
void lcb_luv_read_nudge(lcb_luv_socket_t sock);

/**
 * Will stop whatever read_nudge started. It will stop trying to
 * readahead
 */
void lcb_luv_read_stop(lcb_luv_socket_t sock);

/**
 * Will enable our per-iteration callback, unless already enabled
 */
void lcb_luv_send_async_write_ready(lcb_luv_socket_t sock);

/**
 * Will flush data to libuv. This is called when the event loop has
 * control
 */
void lcb_luv_flush(lcb_luv_socket_t sock);

void lcb_luv_hexdump(void *data, int size);

int lcb_luv_errno_map(int uverr);

#endif /* LCB_LUV_INTERNAL_H_ */
