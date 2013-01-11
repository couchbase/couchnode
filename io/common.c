/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "lcb_luv_internal.h"
#include <stdio.h>
#include <stdlib.h>

static void maybe_callout(lcb_luv_socket_t sock)
{
    short which = 0;
    if (!sock->event) {
        /* !? */
        return;
    }

    /**
     * Any pending data is flushed here
     */

    lcb_luv_flush(sock);

#define check_if_ready(fld) \
    if (EVSTATE_IS(&(sock->evstate[LCB_LUV_EV_ ## fld]), PENDING) && \
            (sock->event->lcb_events & LCB_ ## fld ## _EVENT)) { \
        which |= LCB_ ## fld ## _EVENT; \
    }

    check_if_ready(READ);
    check_if_ready(WRITE);
#undef check_if_ready

    log_loop_rant("Will determine if we need to call any functions..");
    log_loop_rant("which=%x, wait for=%x", which, sock->event->lcb_events);
    if (which) {
        log_loop_debug(" ==== CB Invoking callback for %d =====", sock->idx);
        sock->event->lcb_cb(sock->idx, which, sock->event->lcb_arg);
        log_loop_debug("==== CB Done invoking callback for %d =====", sock->idx);
    }

    /* Flush again.. */
    lcb_luv_flush(sock);
}

static void async_cb(uv_async_t *handle, int status)
{
    lcb_luv_socket_t sock = (lcb_luv_socket_t)handle->data;
    log_loop_trace("prepcb start");

    if (!sock) {
        fprintf(stderr, "We were called with prepare_t %p, with a missing socket\n",
                (void *)handle);
        return;
    }

    sock->async_state |= LCB_LUV_ASYNCf_ENTERED;
    do {

        if (ASYNC_IS(sock, DEINIT)) {
            /**
             * We were requested to asynchronously be cancelled
             */
            sock->async_state = 0;
            lcb_luv_socket_deinit(sock);
            break;
        }

        lcb_luv_socket_ref(sock);

        sock->async_state &= (~LCB_LUV_ASYNCf_REDO);
        maybe_callout(sock);

        lcb_luv_socket_unref(sock);

    } while (ASYNC_IS(sock, REDO));

    sock->async_state &= ~(
                             LCB_LUV_ASYNCf_ENTERED |
                             LCB_LUV_ASYNCf_REDO |
                             LCB_LUV_ASYNCf_SCHEDULED
                         );

    /**
     * we don't have an actual 'async_stop', so decrement the refcount
     * once more
     */
    lcb_luv_socket_unref(sock);

    log_loop_trace("prepcb stop");
    (void)status;
}

/**
 * Deliver an asynchronous 'write-ready' notification to libcouchbase.
 * This will invoke the normal callback chains..
 *
 * So how this works is rather complicated. It is used primarily for
 * write-readiness (i.e. to let libcouchbase put data into our socket
 * buffer).
 *
 * If requested from within the callback (i.e. async_cb itself), then
 * we need to heuristically decide what exactly lcb will do.
 *
 * If it's a simple write event (i.e. actually copying the data
 * between buffers) then our buffer will eventually become full and
 * this function will fail to set the async_redo flag.
 *
 * The case is different in connect though: while a connect-readiness
 * notification is a write event, it doesn't actually fill the socket
 * with anything, so there is the possibility of recursion.
 *
 * Furthermore, connect-'readiness' is an actual event in uv, so there
 * is no need for this readiness emulation.
 */
void lcb_luv_send_async_write_ready(lcb_luv_socket_t sock)
{
    if (ASYNC_IS(sock, ENTERED)) {
        /**
         * Doing extra checks here to ensure we don't end up inside a busy
         * loop.
         */
        struct lcb_luv_evstate_st *wev = EVSTATE_FIND(sock, WRITE);
        struct lcb_luv_evstate_st *cev = EVSTATE_FIND(sock, CONNECT);

        if (!EVSTATE_IS(cev, CONNECTED)) {
            log_loop_debug("Not iterating again for phony write event");
            return;
        }

        if (EVSTATE_IS(wev, FLUSHING)) {
            log_loop_debug("Not requesting second iteration. "
                           "Already inside a flush");
            return;
        }

        if (sock->write.nb >= sizeof(sock->write.data)) {
            log_loop_debug("Not enough space to write..");
            return;
        }
        sock->async_state |= LCB_LUV_ASYNCf_REDO;
        return;
    }

    if (ASYNC_IS(sock, SCHEDULED)) {
        log_loop_trace("prep_active is true");
        return;
    }

    log_loop_debug("Will try and schedule prepare callback for %d", sock->idx);
    lcb_luv_socket_ref(sock);

    uv_async_send(&sock->async);
    sock->async_state |= LCB_LUV_ASYNCf_SCHEDULED;
}

void lcb_luv_schedule_disable(lcb_luv_socket_t sock)
{
    (void)sock;
    /* no-op */
}

static lcb_socket_t find_free_idx(struct lcb_luv_cookie_st *cookie)
{
    unsigned int nchecked = 0;
    while (nchecked < cookie->fd_max) {
        if (cookie->socktable[cookie->fd_next] == NULL) {
            return cookie->fd_next;
        }
        cookie->fd_next = ((cookie->fd_next + 1) % cookie->fd_max);
        nchecked++;
    }

    return -1;
}


lcb_luv_socket_t lcb_luv_socket_new(struct lcb_io_opt_st *iops)
{
    /* Find the next 'file descriptor' */

    lcb_socket_t idx;
    lcb_luv_socket_t newsock;
    idx = find_free_idx(IOPS_COOKIE(iops));
    if (idx == -1) {
        iops->v.v0.error = ENFILE;
        return NULL;
    }

    newsock = calloc(1, sizeof(struct lcb_luv_socket_st));
    newsock->idx = idx;
    newsock->parent = IOPS_COOKIE(iops);

    uv_async_init(newsock->parent->loop, &newsock->async, async_cb);
    newsock->async_state = 0;

    newsock->async.data = newsock;
    newsock->u_req.req.data = newsock;
    newsock->refcount = 1;

    uv_tcp_init(IOPS_COOKIE(iops)->loop, &newsock->tcp);
    IOPS_COOKIE(iops)->socktable[idx] = newsock;
    iops->v.v0.error = 0;
    log_socket_debug("%p: Created new socket %p(%d)", iops, newsock, idx);
    return newsock;
}

void lcb_luv_socket_free(lcb_luv_socket_t sock)
{
    assert(sock->event == NULL);
    assert(sock->idx == -1);
    assert(sock->refcount == 0);
    assert(sock->async_state == 0);
    assert(sock->read.readhead_active == 0);
    free(sock);
}

static void sock_free_pass(lcb_luv_socket_t sock)
{
    sock->handle_count--;
    if (!sock->handle_count) {
        free(sock);
    }
}

static void io_close_cb(uv_handle_t *handle)
{
    lcb_luv_socket_t sock = (lcb_luv_socket_t)handle;
    sock_free_pass(sock);
}

static void prep_close_cb(uv_handle_t *handle)
{
    lcb_luv_socket_t sock = (lcb_luv_socket_t)
                            (((char *)handle) - offsetof(struct lcb_luv_socket_st, async));
    sock_free_pass(sock);
}

unsigned long lcb_luv_socket_unref(lcb_luv_socket_t sock)
{
    unsigned long ret;
    assert(sock->refcount);
    sock->refcount--;
    ret = sock->refcount;

    if (ret == 0) {
        sock->handle_count = 2;
        uv_close((uv_handle_t *)&sock->tcp, io_close_cb);
        uv_close((uv_handle_t *)&sock->async, prep_close_cb);
    }
    return ret;
}

void lcb_luv_socket_deinit(lcb_luv_socket_t sock)
{
    if (sock->idx == -1) {
        return;
    }

    /**
     * If we're in the middle of an async loop
     */
    if (ASYNC_IS(sock, SCHEDULED) || ASYNC_IS(sock, ENTERED)) {
        sock->async_state |= (LCB_LUV_ASYNCf_DEINIT | LCB_LUV_ASYNCf_REDO);
        return;
    }

    log_socket_info("%p: Deinitializing socket %d", sock->parent, sock->idx);

    lcb_luv_schedule_disable(sock);

    if (sock->event && sock->event->handle == sock) {
        sock->event->handle = NULL;
        sock->event = NULL;
    }

    lcb_luv_read_stop(sock);

    assert(sock->async_state == 0);
    sock->parent->socktable[sock->idx] = 0;
    sock->idx = -1;

    if (sock->refcount > 1) {
        int ii;
        log_socket_warn("Socket %p still has a reference count of %d",
                        sock, sock->refcount);
        for (ii = 0; ii < LCB_LUV_EV_MAX; ii++) {
            struct lcb_luv_evstate_st *evstate = sock->evstate + ii;
            log_socket_warn("Flags for evstate@%d: 0x%X", ii, evstate->flags);
        }

        log_socket_warn("Write buffer has %d bytes", sock->write.nb);
        log_socket_warn("Write position is at %d", sock->write.pos);
        log_socket_warn("Read buffer has %d bytes", sock->read.nb);
    }
    lcb_luv_socket_unref(sock);
}


lcb_luv_socket_t lcb_luv_sock_from_idx(struct lcb_io_opt_st *iops,
                                       lcb_socket_t idx)
{
    if (idx < 0) {
        return NULL;
    }

    if (idx > IOPS_COOKIE(iops)->fd_max) {
        return NULL;
    }

    return IOPS_COOKIE(iops)->socktable[idx];
}

void *lcb_luv_create_event(struct lcb_io_opt_st *iops)
{
    struct lcb_luv_event_st *ev = calloc(1, sizeof(struct lcb_luv_event_st));
    (void)iops;
    return ev;
}

void lcb_luv_delete_event(struct lcb_io_opt_st *iops,
                          lcb_socket_t sock_i,
                          void *event_opaque)
{
    lcb_luv_socket_t sock = lcb_luv_sock_from_idx(iops, sock_i);
    struct lcb_luv_event_st *ev = (struct lcb_luv_event_st *)event_opaque;
    int ii;

    if (sock == NULL && ev == NULL) {
        return;
    }

    if (sock) {
        lcb_luv_schedule_disable(sock);
        lcb_luv_read_stop(sock);

        /* clear all the state flags */
        for (ii = 0; ii < LCB_LUV_EV_RDWR_MAX; ii++) {
            sock->evstate[ii].flags = 0;
        }
        sock->event = NULL;
    }

    if (ev && (ev->handle == sock || sock == NULL)) {
        ev->handle = NULL;
        ev->lcb_events = 0;
    }
}

void lcb_luv_destroy_event(struct lcb_io_opt_st *iops,
                           void *event_opaque)
{
    struct lcb_luv_event_st *ev = (struct lcb_luv_event_st *)event_opaque;
    if (ev->handle) {
        ev->handle->event = NULL;
    }
    free(ev);
    (void)iops;
}

int lcb_luv_update_event(struct lcb_io_opt_st *iops,
                         lcb_socket_t sock_i,
                         void *event_opaque,
                         short flags,
                         void *cb_data,
                         lcb_luv_callback_t cb)
{
    struct lcb_luv_event_st *event = (struct lcb_luv_event_st *)event_opaque;
    /* Check to see if our 'socket' is valid */
    lcb_luv_socket_t sock = lcb_luv_sock_from_idx(iops, sock_i);
    if (sock == NULL) {
        log_event_error("Requested update on invalid socket: fd=%d", sock_i);
        return 0;
    }

    log_event_debug("Requested events %x", flags);

    if (sock->event) {
        assert(sock->event == event);
        assert(event->handle == sock);
    } else {
        sock->event = event;
        event->handle = sock;
    }

    event->lcb_cb = cb;
    event->lcb_arg = cb_data;
    event->lcb_events = flags;

    /* trigger a read-ahead */
    if (flags & LCB_READ_EVENT) {
        lcb_luv_read_nudge(sock);
    }

    if (flags & LCB_WRITE_EVENT) {
        /* for writes, we either have data to be flushed, or we want to wait
         * until we're able to write data. In any event, we schedule for this
         */
        if ((sock->evstate[LCB_LUV_EV_WRITE].flags & LCB_LUV_EVf_FLUSHING) == 0 &&
                sock->write.nb == 0) {
            sock->evstate[LCB_LUV_EV_WRITE].flags |= LCB_LUV_EVf_PENDING;
        }

        lcb_luv_send_async_write_ready(sock);
    } else {
        sock->evstate[LCB_LUV_EV_WRITE].flags &= (~LCB_LUV_EVf_PENDING);
    }

    return 1;
}

int lcb_luv_errno_map(int uverr)
{

#ifndef UNKNOWN
#define UNKNOWN -1
#endif

#ifndef EAIFAMNOSUPPORT
#define EAIFAMNOSUPPORT EAI_FAMILY
#endif

#ifndef EAISERVICE
#define EAISERVICE EAI_SERVICE
#endif

#ifndef EAI_SYSTEM
#define EAI_SYSTEM -11
#endif
#ifndef EADDRINFO
#define EADDRINFO EAI_SYSTEM
#endif

#ifndef EAISOCKTYPE
#define EAISOCKTYPE EAI_SOCKTYPE
#endif

#ifndef ECHARSET
#define ECHARSET 0
#endif

#ifndef ENONET
#define ENONET ENETDOWN
#endif

#ifndef ESHUTDOWN
#define ESHUTDOWN WSAESHUTDOWN
#endif

#define OK 0

    int ret = 0;
#define X(errnum,errname,errdesc) \
    if (uverr == UV_##errname) { \
        return errname; \
    }
    UV_ERRNO_MAP(X);

    return ret;

#undef X
}
