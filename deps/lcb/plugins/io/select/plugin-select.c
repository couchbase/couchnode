/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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

#include "internal.h"
#include "select_io_opts.h"

typedef struct s_event_s s_event_t;
struct s_event_s {
    lcb_list_t list;
    lcb_socket_t sock;
    short flags;
    short eflags; /* effective flags */
    void *cb_data;
    void (*handler)(lcb_socket_t sock, short which, void *cb_data);
    s_event_t *next; /* for chaining active events */
};

typedef struct s_timer_s s_timer_t;
struct s_timer_s {
    lcb_list_t list;
    int active;
    hrtime_t exptime;
    void *cb_data;
    void (*handler)(lcb_socket_t sock, short which, void *cb_data);
    s_timer_t *next; /* for chaining active timers */
};

typedef struct {
    s_event_t events;
    s_timer_t timers;

    fd_set readfds[FD_SETSIZE];
    fd_set writefds[FD_SETSIZE];
    fd_set exceptfds[FD_SETSIZE];

    int event_loop;
} io_cookie_t;


#ifdef _WIN32
static int getError(lcb_socket_t sock)
{
    DWORD error = WSAGetLastError();
    int ext = 0;
    int len = sizeof(ext);

    /* Retrieves extended error status and clear */
    getsockopt(sock, SOL_SOCKET, SO_ERROR, (char *)&ext, &len);
    switch (error) {
    case WSAECONNRESET:
    case WSAECONNABORTED:
        return ECONNRESET;
    case WSAEWOULDBLOCK:
        return EWOULDBLOCK;
    case WSAEINVAL:
        return EINVAL;
    case WSAEINPROGRESS:
        return EINPROGRESS;
    case WSAEALREADY:
        return EALREADY;
    case WSAEISCONN:
        return EISCONN;
    case WSAENOTCONN:
        return ENOTCONN;
    case WSAECONNREFUSED:
        return ECONNREFUSED;

    default:
        abort();
        return EINVAL;
    }

    return EINVAL;
}
#endif

static lcb_ssize_t lcb_io_recv(lcb_io_opt_t iops,
                               lcb_socket_t sock,
                               void *buffer,
                               lcb_size_t len,
                               int flags)
{
#ifdef _WIN32
    DWORD fl = 0;
    DWORD nr;
    WSABUF wsabuf = { (ULONG)len, buffer };

    if (WSARecv(sock, &wsabuf, 1, &nr, &fl, NULL, NULL) == SOCKET_ERROR) {
        iops->v.v0.error = getError(sock);
        // recv on a closed socket should return 0
        if (iops->v.v0.error == ECONNRESET) {
            return 0;
        }
        return -1;
    }
    (void)flags;
    return (lcb_ssize_t)nr;
#else
    lcb_ssize_t ret = recv(sock, buffer, len, flags);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
    return ret;
#endif
}

static lcb_ssize_t lcb_io_recvv(lcb_io_opt_t iops,
                                lcb_socket_t sock,
                                struct lcb_iovec_st *iov,
                                lcb_size_t niov)
{
#ifdef _WIN32
    DWORD fl = 0;
    DWORD nr;
    WSABUF wsabuf[2];

    assert(niov == 2);
    wsabuf[0].buf = iov[0].iov_base;
    wsabuf[0].len = (ULONG)iov[0].iov_len;
    wsabuf[1].buf = iov[1].iov_base;
    wsabuf[1].len = (ULONG)iov[1].iov_len;

    if (WSARecv(sock, wsabuf, iov[1].iov_len ? 2 : 1,
                &nr, &fl, NULL, NULL) == SOCKET_ERROR) {
        iops->v.v0.error = getError(sock);

        // recv on a closed socket should return 0
        if (iops->v.v0.error == ECONNRESET) {
            return 0;
        }
        return -1;
    }

    return (lcb_ssize_t)nr;
#else
    struct msghdr msg;
    struct iovec vec[2];
    lcb_ssize_t ret;

    if (niov != 2) {
        return -1;
    }
    memset(&msg, 0, sizeof(msg));
    msg.msg_iov = vec;
    msg.msg_iovlen = iov[1].iov_len ? (lcb_size_t)2 : (lcb_size_t)1;
    msg.msg_iov[0].iov_base = iov[0].iov_base;
    msg.msg_iov[0].iov_len = iov[0].iov_len;
    msg.msg_iov[1].iov_base = iov[1].iov_base;
    msg.msg_iov[1].iov_len = iov[1].iov_len;
    ret = recvmsg(sock, &msg, 0);

    if (ret < 0) {
        iops->v.v0.error = errno;
    }

    return ret;
#endif
}

static lcb_ssize_t lcb_io_send(lcb_io_opt_t iops,
                               lcb_socket_t sock,
                               const void *msg,
                               lcb_size_t len,
                               int flags)
{
#ifdef _WIN32
    DWORD fl = 0;
    DWORD nw;
    WSABUF wsabuf = { (ULONG)len, (char *)msg };
    (void)flags;

    if (WSASend(sock, &wsabuf, 1, &nw, fl, NULL, NULL) == SOCKET_ERROR) {
        iops->v.v0.error = getError(sock);
        return -1;
    }

    return (lcb_ssize_t)nw;
#else
    lcb_ssize_t ret = send(sock, msg, len, flags);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
    return ret;
#endif
}

static lcb_ssize_t lcb_io_sendv(lcb_io_opt_t iops,
                                lcb_socket_t sock,
                                struct lcb_iovec_st *iov,
                                lcb_size_t niov)
{
#ifdef _WIN32
    DWORD fl = 0;
    DWORD nw;
    WSABUF wsabuf[2];

    assert(niov == 2);
    wsabuf[0].buf = iov[0].iov_base;
    wsabuf[0].len = (ULONG)iov[0].iov_len;
    wsabuf[1].buf = iov[1].iov_base;
    wsabuf[1].len = (ULONG)iov[1].iov_len;

    if (WSASend(sock, wsabuf, iov[1].iov_len ? 2 : 1,
                &nw, fl, NULL, NULL) == SOCKET_ERROR) {
        iops->v.v0.error = getError(sock);
        return -1;
    }

    return (lcb_ssize_t)nw;
#else
    struct msghdr msg;
    struct iovec vec[2];
    lcb_ssize_t ret;

    if (niov != 2) {
        return -1;
    }
    memset(&msg, 0, sizeof(msg));
    msg.msg_iov = vec;
    msg.msg_iovlen = iov[1].iov_len ? (lcb_size_t)2 : (lcb_size_t)1;
    msg.msg_iov[0].iov_base = iov[0].iov_base;
    msg.msg_iov[0].iov_len = iov[0].iov_len;
    msg.msg_iov[1].iov_base = iov[1].iov_base;
    msg.msg_iov[1].iov_len = iov[1].iov_len;
    ret = sendmsg(sock, &msg, 0);

    if (ret < 0) {
        iops->v.v0.error = errno;
    }
    return ret;
#endif
}

static int make_socket_nonblocking(lcb_socket_t sock)
{
#ifdef _WIN32
    u_long nonblocking = 1;
    if (ioctlsocket(sock, FIONBIO, &nonblocking) == SOCKET_ERROR) {
        return -1;
    }
#else
    int flags;
    if ((flags = fcntl(sock, F_GETFL, NULL)) < 0) {
        return -1;
    }
    if (fcntl(sock, F_SETFL, flags | O_NONBLOCK) == -1) {
        return -1;
    }
#endif
    return 0;
}

static lcb_socket_t lcb_io_socket(lcb_io_opt_t iops,
                                  int domain,
                                  int type,
                                  int protocol)
{
    lcb_socket_t sock;
#ifdef _WIN32
    sock = (lcb_socket_t)WSASocket(domain, type, protocol, NULL, 0, 0);
#else
    sock = socket(domain, type, protocol);
#endif
    if (sock == INVALID_SOCKET) {
        iops->v.v0.error = errno;
    } else {
        if (make_socket_nonblocking(sock) != 0) {
#ifdef _WIN32
            iops->v.v0.error = getError(sock);
#else
            iops->v.v0.error = errno;
#endif
            iops->v.v0.close(iops, sock);
            sock = INVALID_SOCKET;
        }
    }
    return sock;
}


static void lcb_io_close(lcb_io_opt_t iops,
                         lcb_socket_t sock)
{
    (void)iops;
#ifdef _WIN32
    closesocket(sock);
#else
    close(sock);
#endif
}

static int lcb_io_connect(lcb_io_opt_t iops,
                          lcb_socket_t sock,
                          const struct sockaddr *name,
                          unsigned int namelen)
{
    int ret;

#ifdef _WIN32
    ret = WSAConnect(sock, name, (int)namelen, NULL, NULL, NULL, NULL);
    if (ret == SOCKET_ERROR) {
        iops->v.v0.error = getError(sock);
    }
#else
    ret = connect(sock, name, (socklen_t)namelen);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
#endif
    return ret;
}

static void *lcb_io_create_event(lcb_io_opt_t iops)
{
    io_cookie_t *io = iops->v.v0.cookie;
    s_event_t *ret = calloc(1, sizeof(s_event_t));
    if (ret != NULL) {
        lcb_list_append(&io->events.list, &ret->list);
    }
    return ret;
}

static int lcb_io_update_event(lcb_io_opt_t iops,
                               lcb_socket_t sock,
                               void *event,
                               short flags,
                               void *cb_data,
                               void (*handler)(lcb_socket_t sock,
                                               short which,
                                               void *cb_data))
{
    s_event_t *ev = event;
    ev->sock = sock;
    ev->handler = handler;
    ev->cb_data = cb_data;
    ev->flags = flags;
    (void)iops;
    return 0;
}

static void lcb_io_destroy_event(lcb_io_opt_t iops,
                                 void *event)
{
    s_event_t *ev = event;
    lcb_list_delete(&ev->list);
    free(ev);
    (void)iops;
}

static void lcb_io_delete_event(lcb_io_opt_t iops,
                                lcb_socket_t sock,
                                void *event)
{
    s_event_t *ev = event;
    ev->flags = 0;
    ev->cb_data = NULL;
    ev->handler = NULL;
    (void)iops;
    (void)sock;
}

static void *lcb_io_create_timer(lcb_io_opt_t iops)
{
    io_cookie_t *io = iops->v.v0.cookie;
    s_timer_t *ret = calloc(1, sizeof(s_timer_t));
    if (ret != NULL) {
        lcb_list_append(&io->timers.list, &ret->list);
    }
    return ret;
}

static void lcb_io_destroy_timer(lcb_io_opt_t iops,
                                 void *timer)
{
    s_timer_t *tm = timer;
    lcb_list_delete(&tm->list);
    free(tm);
    (void)iops;
}

static void lcb_io_delete_timer(lcb_io_opt_t iops,
                                void *timer)
{
    s_timer_t *tm = timer;
    tm->active = 0;
    (void)iops;
}

static int lcb_io_update_timer(lcb_io_opt_t iops,
                               void *timer,
                               lcb_uint32_t usec,
                               void *cb_data,
                               void (*handler)(lcb_socket_t sock,
                                               short which,
                                               void *cb_data))
{
    s_timer_t *tm = timer;
    tm->exptime = gethrtime() + (usec * (hrtime_t)1000);
    tm->cb_data = cb_data;
    tm->handler = handler;
    tm->active = 1;
    (void)iops;
    return 0;
}

static void lcb_io_stop_event_loop(struct lcb_io_opt_st *iops)
{
    io_cookie_t *io = iops->v.v0.cookie;
    io->event_loop = 0;
}

static void lcb_io_run_event_loop(struct lcb_io_opt_st *iops)
{
    io_cookie_t *io = iops->v.v0.cookie;

    s_event_t *ev;
    lcb_list_t *ii, *nn;

    io->event_loop = 1;
    do {
        s_timer_t *tm;
        struct timeval tmo, *t;
        int ret;
        int nevents = 0;
        int ntimers = 0;


        FD_ZERO(io->readfds);
        FD_ZERO(io->writefds);
        FD_ZERO(io->exceptfds);


        LCB_LIST_FOR(ii, &io->events.list) {
            ev = LCB_LIST_ITEM(ii, s_event_t, list);
            if (ev->flags != 0) {
                if (ev->flags & LCB_READ_EVENT) {
                    FD_SET(ev->sock, io->readfds);
                }

                if (ev->flags & LCB_WRITE_EVENT) {
                    FD_SET(ev->sock, io->writefds);
                }

                FD_SET(ev->sock, io->exceptfds);
                ++nevents;
            }
        }

        t = NULL;
        if (!LCB_LIST_IS_EMPTY(&io->timers.list)) {
            hrtime_t now = gethrtime();
            hrtime_t min = 0;
            int have_timeout = 0;

            tmo.tv_sec = 0;
            tmo.tv_usec = 0;

            LCB_LIST_FOR(ii, &io->timers.list) {
                tm = LCB_LIST_ITEM(ii, s_timer_t, list);
                if (!tm->active) {
                    continue;
                }

                if (min == 0 || min > tm->exptime) {
                    min = tm->exptime;
                    have_timeout = 1;
                    ++ntimers;
                }
            }


            if (min > now) {
                hrtime_t delta = min - now;
                delta /= 1000;
                tmo.tv_sec = (long)(delta / 1000000);
                tmo.tv_usec = delta % 1000000;
                t = &tmo;

            } else if (have_timeout) {
                tmo.tv_sec = 0;
                tmo.tv_usec = 0;
                t = &tmo;

            } else {
                /** This is probably bad! */
                ; /* TODO: we might want to do something here */
            }

        }

        if (nevents == 0 && ntimers == 0) {
            io->event_loop = 0;
            return;
        }


        ret = select(FD_SETSIZE, io->readfds, io->writefds, io->exceptfds, t);

        if (ret == SOCKET_ERROR) {
            return;
        }

        /* To be completely safe, we need to copy active events
         * before handing them. Iterating over the list of
         * registered events isn't safe, because one callback can
         * cancel all registered events before iteration will end
         */
        if (ret == 0) {
            s_timer_t *active = NULL;
            hrtime_t now = gethrtime();
            LCB_LIST_SAFE_FOR(ii, nn, &io->timers.list) {
                tm = LCB_LIST_ITEM(ii, s_timer_t, list);
                if (tm->active && now > tm->exptime) {
                    tm->next = active;
                    active = tm;
                }
            }
            tm = active;
            while (tm) {
                s_timer_t *p = tm->next;
                tm->handler(-1, 0, tm->cb_data);
                tm = p;
            }
        } else {
            s_event_t *active = NULL;
            LCB_LIST_FOR(ii, &io->events.list) {
                ev = LCB_LIST_ITEM(ii, s_event_t, list);
                if (ev->flags != 0) {
                    ev->eflags = 0;
                    if (FD_ISSET(ev->sock, io->readfds)) {
                        ev->eflags |= LCB_READ_EVENT;
                    }
                    if (FD_ISSET(ev->sock, io->writefds)) {
                        ev->eflags |= LCB_WRITE_EVENT;
                    }
                    if (FD_ISSET(ev->sock, io->exceptfds)) {
                        ev->eflags = LCB_ERROR_EVENT | LCB_RW_EVENT; /** It should error */
                    }
                    if (ev->eflags != 0) {
                        ev->next = active;
                        active = ev;
                    }
                }
            }
            ev = active;
            while (ev) {
                s_event_t *p = ev->next;
                ev->handler(ev->sock, ev->eflags, ev->cb_data);
                ev = p;
            }
        }
    } while (io->event_loop);
}

static void lcb_destroy_io_opts(struct lcb_io_opt_st *iops)
{
    io_cookie_t *io = iops->v.v0.cookie;
    lcb_list_t *nn, *ii;
    s_event_t *ev;
    s_timer_t *tm;

    assert(io->event_loop == 0);
    LCB_LIST_SAFE_FOR(ii, nn, &io->events.list) {
        ev = LCB_LIST_ITEM(ii, s_event_t, list);
        iops->v.v0.destroy_event(iops, ev);
    }
    assert(LCB_LIST_IS_EMPTY(&io->events.list));
    LCB_LIST_SAFE_FOR(ii, nn, &io->timers.list) {
        tm = LCB_LIST_ITEM(ii, s_timer_t, list);
        iops->v.v0.destroy_timer(iops, tm);
    }
    assert(LCB_LIST_IS_EMPTY(&io->timers.list));
    free(io);
    free(iops);
}

LIBCOUCHBASE_API
lcb_error_t lcb_create_select_io_opts(int version, lcb_io_opt_t *io, void *arg)
{
    lcb_io_opt_t ret;
    io_cookie_t *cookie;

    if (version != 0) {
        return LCB_PLUGIN_VERSION_MISMATCH;
    }
    ret = calloc(1, sizeof(*ret));
    cookie = calloc(1, sizeof(*cookie));
    if (ret == NULL || cookie == NULL) {
        free(ret);
        free(cookie);
        return LCB_CLIENT_ENOMEM;
    }
    lcb_list_init(&cookie->events.list);
    lcb_list_init(&cookie->timers.list);

    /* setup io iops! */
    ret->version = 0;
    ret->dlhandle = NULL;
    ret->destructor = lcb_destroy_io_opts;
    /* consider that struct isn't allocated by the library,
     * `need_cleanup' flag might be set in lcb_create() */
    ret->v.v0.need_cleanup = 0;
    ret->v.v0.recv = lcb_io_recv;
    ret->v.v0.send = lcb_io_send;
    ret->v.v0.recvv = lcb_io_recvv;
    ret->v.v0.sendv = lcb_io_sendv;
    ret->v.v0.socket = lcb_io_socket;
    ret->v.v0.close = lcb_io_close;
    ret->v.v0.connect = lcb_io_connect;
    ret->v.v0.delete_event = lcb_io_delete_event;
    ret->v.v0.destroy_event = lcb_io_destroy_event;
    ret->v.v0.create_event = lcb_io_create_event;
    ret->v.v0.update_event = lcb_io_update_event;

    ret->v.v0.delete_timer = lcb_io_delete_timer;
    ret->v.v0.destroy_timer = lcb_io_destroy_timer;
    ret->v.v0.create_timer = lcb_io_create_timer;
    ret->v.v0.update_timer = lcb_io_update_timer;

    ret->v.v0.run_event_loop = lcb_io_run_event_loop;
    ret->v.v0.stop_event_loop = lcb_io_stop_event_loop;
    ret->v.v0.cookie = cookie;

    *io = ret;
    (void)arg;
    return LCB_SUCCESS;
}
