/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

#include "config.h"
#include "connect.h"
#include "ioutils.h"
#include "iotable.h"
#include "settings.h"
#include "timer-ng.h"
#include <errno.h>

/* win32 lacks EAI_SYSTEM */
#ifndef EAI_SYSTEM
#define EAI_SYSTEM 0
#endif
#define LOGARGS(conn, lvl) conn->settings, "connection", LCB_LOG_##lvl, __FILE__, __LINE__
static const lcb_host_t *get_loghost(lcbio_SOCKET *s) {
    static lcb_host_t host = { "NOHOST", "NOPORT" };
    if (!s) { return &host; }
    if (!s->info) { return &host; }
    return &s->info->ep;
}

/** Format string arguments for %p%s:%s */
#define CSLOGID(sock) get_loghost(sock)->host, get_loghost(sock)->port, (void*)s
#define CSLOGFMT "<%s:%s> (SOCK=%p) "

typedef enum {
    CS_PENDING = 0,
    CS_CANCELLED,
    CS_TIMEDOUT,
    CS_CONNECTED,
    CS_ERROR
} connect_state;

typedef struct lcbio_CONNSTART {
    lcbio_CONNDONE_cb handler;
    lcbio_SOCKET *sock;
    lcbio_OSERR syserr;
    void *arg;
    void *event;
    short ev_active; /* whether the event pointer is active (Event only) */
    short in_uhandler; /* Whether we're inside the user-defined handler */
    struct addrinfo *ai_root;
    struct addrinfo *ai;
    connect_state state;
    lcb_error_t pending;
    lcbio_ASYNC *async;
    char *hoststr;
} lcbio_CONNSTART;

static void
cs_unwatch(lcbio_CONNSTART *cs)
{
    lcbio_SOCKET *s = cs->sock;
    if (s && cs->ev_active) {
        lcb_assert(s->u.fd != INVALID_SOCKET);
        IOT_V0EV(s->io).cancel(IOT_ARG(s->io), s->u.fd, cs->event);
        cs->ev_active = 0;
    }
}

/**
 * Handler invoked to deliver final status for a connection. This will invoke
 * the user supplied callback with the relevant status (if it has not been
 * cancelled) and then free the CONNSTART object.
 */
static void
cs_handler(void *cookie)
{
    lcbio_CONNSTART *cs = cookie;
    lcb_error_t err;
    lcbio_SOCKET *s = cs->sock;

    if (s && cs->event) {
        cs_unwatch(cs);
        IOT_V0EV(s->io).destroy(IOT_ARG(s->io), cs->event);
    }

    if (cs->state == CS_PENDING) {
        /* state was not changed since initial scheduling */
        err = LCB_ETIMEDOUT;
    } else if (cs->state == CS_CONNECTED) {
        /* clear pending error */
        err = LCB_SUCCESS;
    } else {
        if (s != NULL && cs->pending == LCB_CONNECT_ERROR) {
            err = lcbio_mklcberr(cs->syserr, s->settings);
        } else {
            err = cs->pending;
        }
    }

    if (cs->state == CS_CANCELLED) {
        /* ignore everything. Clean up resources */
        goto GT_DTOR;
    }

    if (s) {
        lcbio__load_socknames(s);
        if (err == LCB_SUCCESS) {
            lcb_log(LOGARGS(s, INFO), CSLOGFMT "Connected ", CSLOGID(s));

            if (s->settings->tcp_nodelay) {
                lcb_error_t ndrc = lcbio_disable_nagle(s);
                if (ndrc != LCB_SUCCESS) {
                    lcb_log(LOGARGS(s, INFO), CSLOGFMT "Couldn't set TCP_NODELAY", CSLOGID(s));
                } else {
                    lcb_log(LOGARGS(s, DEBUG), CSLOGFMT "Successfuly set TCP_NODELAY", CSLOGID(s));
                }
            }
        } else {
            lcb_log(LOGARGS(s, ERR), CSLOGFMT "Failed: lcb_err=0x%x, os_errno=%u", CSLOGID(s), err, cs->syserr);
        }
    }

    /** Handler section */
    cs->in_uhandler = 1;
    cs->handler(err == LCB_SUCCESS ? s : NULL, cs->arg, err, cs->syserr);

    GT_DTOR:
    if (cs->async) {
        lcbio_timer_destroy(cs->async);
    }
    if (cs->sock) {
        lcbio_unref(cs->sock);
    }
    if (cs->ai_root) {
        freeaddrinfo(cs->ai_root);
    }
    free(cs);
}

static void
cs_state_signal(lcbio_CONNSTART *cs, connect_state state, lcb_error_t err)
{
    if (cs->state != CS_PENDING) {
        /** State already set */
        return;
    }


    if (state == CS_CONNECTED) {
        /* clear last errors if we're successful */
        cs->pending = LCB_SUCCESS;
    } else if (cs->pending == LCB_SUCCESS) {
        /* set error code only if previous code was not a failure */
        cs->pending = err;
    }

    cs->state = state;
    lcbio_async_signal(cs->async);
}

/** Cancels and mutes any pending event */
void
lcbio_connect_cancel(lcbio_pCONNSTART cs)
{
    if (cs->in_uhandler) {
        /* already inside user-defined handler */
        return;
    }
    cs->state = CS_CANCELLED;
    cs_handler(cs);
}


static int
ensure_sock(lcbio_CONNSTART *cs)
{
    lcbio_SOCKET *s = cs->sock;
    lcbio_TABLE *io = s->io;
    int errtmp = 0;

    if (cs->ai == NULL) {
        return -1;
    }

    if (IOT_IS_EVENT(io)) {
        if (s->u.fd != INVALID_SOCKET) {
            /* already have one? */
            return 0;
        }

        while (s->u.fd == INVALID_SOCKET && cs->ai != NULL) {
            s->u.fd = lcbio_E_ai2sock(io, &cs->ai, &errtmp);
            if (s->u.fd != INVALID_SOCKET) {
                return 0;
            }
        }
    } else {
        if (s->u.sd) {
            return 0;
        }

        while (s->u.sd == NULL && cs->ai != NULL) {
            s->u.sd = lcbio_C_ai2sock(io, &cs->ai, &errtmp);
            if (s->u.sd) {
                s->u.sd->lcbconn = (void *) cs->sock;
                s->u.sd->parent = IOT_ARG(io);
                return 0;
            }
        }
    }

    if (cs->ai == NULL) {
        lcbio_mksyserr(IOT_ERRNO(io), &cs->syserr);
        return -1;
    }
    return 0;
}

static void
destroy_cursock(lcbio_CONNSTART *cs)
{
    lcbio_SOCKET *s = cs->sock;
    lcbio_TABLE *iot = s->io;
    if (cs->ai) {
        cs->ai = cs->ai->ai_next;
    }

    if (!cs->ai) {
        return;
    }

    if (IOT_IS_EVENT(iot)) {
        if (cs->ev_active) {
            lcb_assert(s->u.fd != INVALID_SOCKET);
            IOT_V0EV(iot).cancel(IOT_ARG(iot), s->u.fd, cs->event);
            cs->ev_active = 0;
        }
        IOT_V0IO(iot).close(IOT_ARG(iot), s->u.fd);
        s->u.fd = INVALID_SOCKET;
    } else {
        if (s->u.sd) {
            IOT_V1(iot).close(IOT_ARG(iot), s->u.sd);
            s->u.sd = NULL;
        }
    }
}

static void
E_connect(lcb_socket_t sock, short events, void *arg)
{
    lcbio_CONNSTART *cs = arg;
    lcbio_SOCKET *s = cs->sock;
    lcbio_TABLE *io = s->io;
    int retry_once = 0;
    lcbio_CSERR connstatus;

    (void)sock;

    lcb_log(LOGARGS(s, TRACE), CSLOGFMT "Got event handler for new connection", CSLOGID(s));

    GT_NEXTSOCK:
    if (ensure_sock(cs) == -1) {
        cs_state_signal(cs, CS_ERROR, LCB_CONNECT_ERROR);
        return;
    }

    if (events & LCB_ERROR_EVENT) {
        socklen_t errlen = sizeof(int);
        int sockerr = 0;
        lcb_log(LOGARGS(s, TRACE), CSLOGFMT "Received ERROR_EVENT", CSLOGID(s));
        getsockopt(s->u.fd, SOL_SOCKET, SO_ERROR, (char *)&sockerr, &errlen);
        lcbio_mksyserr(sockerr, &cs->syserr);
        destroy_cursock(cs);
        goto GT_NEXTSOCK;

    } else {
        int rv = 0;
        struct addrinfo *ai = cs->ai;

        GT_CONNECT:
        rv = IOT_V0IO(io).connect0(
                IOT_ARG(io), s->u.fd, ai->ai_addr, (unsigned)ai->ai_addrlen);

        if (rv == 0) {
            cs_unwatch(cs);
            cs_state_signal(cs, CS_CONNECTED, LCB_SUCCESS);
            return;
        }
    }

    connstatus = lcbio_mkcserr(IOT_ERRNO(io));
    lcbio_mksyserr(IOT_ERRNO(io), &cs->syserr);


    switch (connstatus) {

    case LCBIO_CSERR_INTR:
        goto GT_CONNECT;

    case LCBIO_CSERR_CONNECTED:
        cs_unwatch(cs);
        cs_state_signal(cs, CS_CONNECTED, LCB_SUCCESS);
        return;

    case LCBIO_CSERR_BUSY:
        lcb_log(LOGARGS(s, TRACE), CSLOGFMT "Scheduling asynchronous watch for socket.", CSLOGID(s));
        IOT_V0EV(io).watch(
                IOT_ARG(io), s->u.fd, cs->event, LCB_WRITE_EVENT, cs, E_connect);
        cs->ev_active = 1;
        return;

    case LCBIO_CSERR_EINVAL:
        if (!retry_once) {
            retry_once = 1;
            goto GT_CONNECT;
        }
        /* fallthrough */

    case LCBIO_CSERR_EFAIL:
    default:
        /* close the current socket and try again */
        lcb_log(LOGARGS(s, TRACE), CSLOGFMT "connect() failed. os_error=%d [%s]", CSLOGID(s), IOT_ERRNO(io), strerror(IOT_ERRNO(io)));
        destroy_cursock(cs);
        goto GT_NEXTSOCK;
    }
}

static void C_connect(lcbio_CONNSTART *cs);

static void
C_conncb(lcb_sockdata_t *sock, int status)
{
    lcbio_SOCKET *s = (void *)sock->lcbconn;
    lcbio_CONNSTART *cs = (void *)s->ctx;

    lcb_log(LOGARGS(s, TRACE), CSLOGFMT "Received completion handler. Status=%d. errno=%d", CSLOGID(s), status, IOT_ERRNO(s->io));

    if (!--s->refcount) {
        lcbio__destroy(s);
        return;
    }

    if (!status) {
        if (cs->state == CS_PENDING) {
            cs->state = CS_CONNECTED;
        }
        cs_handler(cs);
    } else {
        lcbio_mksyserr(IOT_ERRNO(s->io), &cs->syserr);
        destroy_cursock(cs);
        C_connect(cs);
    }
}

static void
C_connect(lcbio_CONNSTART *cs)
{
    int rv;
    lcbio_SOCKET *s = cs->sock;
    int retry_once = 0;
    lcbio_CSERR status;
    lcbio_TABLE *io = s->io;

    GT_NEXTSOCK:
    if (ensure_sock(cs) != 0) {
        lcbio_mksyserr(IOT_ERRNO(io), &cs->syserr);
        cs_state_signal(cs, CS_ERROR, LCB_CONNECT_ERROR);
        return;
    }

    GT_CONNECT:
    rv = IOT_V1(io).connect(IOT_ARG(io), s->u.sd, cs->ai->ai_addr,
                            (unsigned)cs->ai->ai_addrlen, C_conncb);
    if (rv == 0) {
        lcbio_ref(s);
        return;
    }

    lcbio_mksyserr(IOT_ERRNO(io), &cs->syserr);
    status = lcbio_mkcserr(IOT_ERRNO(io));
    switch (status) {

    case LCBIO_CSERR_INTR:
        goto GT_CONNECT;

    case LCBIO_CSERR_CONNECTED:
        cs_state_signal(cs, CS_CONNECTED, LCB_SUCCESS);
        return;

    case LCBIO_CSERR_BUSY:
        return;

    case LCBIO_CSERR_EINVAL:
        if (!retry_once) {
            retry_once = 1;
            goto GT_CONNECT;
        }
        /* fallthrough */

    case LCBIO_CSERR_EFAIL:
    default:
        destroy_cursock(cs);
        goto GT_NEXTSOCK;
    }
}

struct lcbio_CONNSTART *
lcbio_connect(lcbio_TABLE *iot, lcb_settings *settings, const lcb_host_t *dest,
              uint32_t timeout, lcbio_CONNDONE_cb handler, void *arg)
{
    lcbio_SOCKET *s;
    lcbio_CONNSTART *ret;
    struct addrinfo hints;
    int rv;

    s = calloc(1, sizeof(*s));
    ret = calloc(1, sizeof(*ret));

    /** Initialize the socket first */
    s->io = iot;
    s->settings = settings;
    s->ctx = ret;
    s->refcount = 1;
    s->info = calloc(1, sizeof(*s->info));
    s->info->ep = *dest;
    lcbio_table_ref(s->io);
    lcb_settings_ref(s->settings);
    lcb_list_init(&s->protos);

    if (IOT_IS_EVENT(iot)) {
        s->u.fd = INVALID_SOCKET;
        ret->event = IOT_V0EV(iot).create(IOT_ARG(iot));
    }

    /** Initialize the connstart structure */
    ret->handler = handler;
    ret->arg = arg;
    ret->sock = s;
    ret->async = lcbio_timer_new(iot, ret, cs_handler);

    lcbio_timer_rearm(ret->async, timeout);
    lcb_log(LOGARGS(s, INFO), CSLOGFMT "Starting. Timeout=%uus", CSLOGID(s), timeout);

    /** Hostname lookup: */
    memset(&hints, 0, sizeof(hints));
    hints.ai_flags = AI_PASSIVE;
    hints.ai_socktype = SOCK_STREAM;
    if (settings->ipv6 == LCB_IPV6_DISABLED) {
        hints.ai_family = AF_INET;
    } else if (settings->ipv6 == LCB_IPV6_ONLY) {
        hints.ai_family = AF_INET6;
    } else {
        hints.ai_family = AF_UNSPEC;
    }

    if ((rv = getaddrinfo(dest->host, dest->port, &hints, &ret->ai_root))) {
        const char *errstr = rv != EAI_SYSTEM ? gai_strerror(rv) : "";
        lcb_log(LOGARGS(s, ERR), CSLOGFMT "Couldn't look up %s (%s) [EAI=%d]", CSLOGID(s), dest->host, errstr, rv);
        cs_state_signal(ret, CS_ERROR, LCB_UNKNOWN_HOST);
    } else {
        ret->ai = ret->ai_root;

        /** Figure out how to connect */
        if (IOT_IS_EVENT(iot)) {
            E_connect(-1, LCB_WRITE_EVENT, ret);
        } else {
            C_connect(ret);
        }
    }
    return ret;
}

lcbio_CONNSTART *
lcbio_connect_hl(lcbio_TABLE *iot, lcb_settings *settings,
                 hostlist_t hl, int rollover, uint32_t timeout,
                 lcbio_CONNDONE_cb handler, void *arg)
{
    const lcb_host_t *cur;
    unsigned ii, hlmax;
    ii = 0;
    hlmax = hostlist_size(hl);

    while ( (cur = hostlist_shift_next(hl, rollover)) && ii++ < hlmax) {
        lcbio_CONNSTART *ret = lcbio_connect(
                iot, settings, cur, timeout, handler, arg);
        if (ret) {
            return ret;
        }
    }

    return NULL;
}

lcbio_SOCKET *
lcbio_wrap_fd(lcbio_pTABLE iot, lcb_settings *settings, lcb_socket_t fd)
{
    lcbio_SOCKET *ret = calloc(1, sizeof(*ret));
    lcbio_CONNDONE_cb *ci = calloc(1, sizeof(*ci));

    if (ret == NULL || ci == NULL) {
        free(ret);
        free(ci);
        return NULL;
    }

    assert(iot->model = LCB_IOMODEL_EVENT);

    lcb_list_init(&ret->protos);
    ret->settings = settings;
    ret->io = iot;
    ret->refcount = 1;
    ret->u.fd = fd;

    lcbio_table_ref(ret->io);
    lcb_settings_ref(ret->settings);
    lcbio__load_socknames(ret);
    return ret;
}

void
lcbio_shutdown(lcbio_SOCKET *s)
{
    lcbio_TABLE *io = s->io;

    lcbio__protoctx_delall(s);
    if (IOT_IS_EVENT(io)) {
        if (s->u.fd != INVALID_SOCKET) {
            IOT_V0IO(io).close(IOT_ARG(io), s->u.fd);
            s->u.fd = INVALID_SOCKET;
        }
    } else {
        if (s->u.sd) {
            IOT_V1(io).close(IOT_ARG(io), s->u.sd);
            s->u.sd = NULL;
        }
    }
}

void
lcbio__destroy(lcbio_SOCKET *s)
{
    lcbio_shutdown(s);
    if (s->info) {
        free(s->info);
    }
    lcbio_table_unref(s->io);
    lcb_settings_unref(s->settings);
    free(s);
}
