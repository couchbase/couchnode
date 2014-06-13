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
* New-Style v1 plugin for Windows, Using IOCP
* @author Mark Nunberg
*/

#include "iocp_iops.h"
#include <stdio.h>
#include <stdlib.h>
static int start_write(lcb_io_opt_t iobase,
                       lcb_sockdata_t *sockbase,
                       struct lcb_iovec_st *iov,
                       lcb_size_t niov,
                       void *uarg,
                       lcb_ioC_write2_callback callback)
{
    iocp_t *io = (iocp_t *)iobase;
    iocp_write_t *w;
    iocp_sockdata_t *sd = (iocp_sockdata_t *)sockbase;
    int rv;
    DWORD dwNbytes;

    /** Figure out which w we should use */
    if (sd->w_info.state == IOCP_WRITEBUF_AVAILABLE) {
        w = &sd->w_info;
        w->state = IOCP_WRITEBUF_INUSE;
        memset(&w->ol_write.base, 0, sizeof(w->ol_write.base));
    } else {
        w = calloc(1, sizeof(*w));
        w->state = IOCP_WRITEBUF_ALLOCATED;
        w->ol_write.action = LCBIOCP_ACTION_WRITE;
        w->ol_write.sd = sd;
    }

    w->cb = callback;
    w->uarg = uarg;

    rv = WSASend(
             sd->sSocket,
             (WSABUF *)iov,
             niov, /* nbuf */
             &dwNbytes, /* nbytes */
             0,
             (OVERLAPPED *)&w->ol_write,
             NULL);

    rv = iocp_just_scheduled(io, &w->ol_write, rv);

    if (0 && rv != 0 && w->state == IOCP_WRITEBUF_ALLOCATED) {
        free(w);
    }
    return rv;
}

static int start_read(lcb_io_opt_t iobase,
                      lcb_sockdata_t *sockbase,
                      lcb_IOV *iov,
                      lcb_size_t niov,
                      void *uarg,
                      lcb_ioC_read2_callback callback)
{
    int rv;
    DWORD flags = 0, dwNbytes;
    iocp_t *io = (iocp_t *)iobase;
    iocp_sockdata_t *sd = (iocp_sockdata_t *)sockbase;
    struct lcb_buf_info *bi = &sockbase->read_buffer;

    IOCP_LOG(IOCP_DEBUG, "Read Requested..");
    sd->ol_read.action = LCBIOCP_ACTION_READ;
    sd->rdcb = callback;
    sd->rdarg = uarg;

    /** Remove the leftover bits */
    ZeroMemory(&sd->ol_read.base, sizeof(OVERLAPPED));

    rv = WSARecv(
             sd->sSocket,
             (WSABUF *)iov,
             niov,
             &dwNbytes,
             &flags,
             (OVERLAPPED *)&sd->ol_read,
             NULL);

    return iocp_just_scheduled(io, &sd->ol_read, rv);
}


static int start_connect(lcb_io_opt_t iobase,
                         lcb_sockdata_t *sdbase,
                         const struct sockaddr *name,
                         unsigned int namelen,
                         lcb_io_connect_cb callback)
{

    /** Dummy socket address to bind to */
    union {
        struct sockaddr_in in4;
        struct sockaddr_in6 in6;
    } u_addr;

    BOOL result;
    LPFN_CONNECTEX pConnectEx;
    iocp_t *io = (iocp_t *)iobase;
    iocp_sockdata_t *sd = (iocp_sockdata_t *)sdbase;

    iocp_connect_t *conn = (iocp_connect_t *)calloc(1, sizeof(*conn));

    conn->cb = callback;
    conn->ol_conn.sd = sd;
    conn->ol_conn.action = LCBIOCP_ACTION_CONNECT;

    IOCP_LOG(IOCP_INFO, "Connnection OL=%p", &conn->ol_conn);


    /**
    * ConnectEx requires the socket be bound
    */
    memset(&u_addr, 0, sizeof(u_addr));

    if (namelen == sizeof(u_addr.in4)) {
        u_addr.in4.sin_port = 0;
        memset(&u_addr.in4.sin_addr, 0, sizeof(u_addr.in4.sin_addr));
        u_addr.in4.sin_family = AF_INET;

    } else {
        u_addr.in6.sin6_family = AF_INET6;
        u_addr.in6.sin6_port = 0;
        memset(&u_addr.in6.sin6_addr, 0, sizeof(u_addr.in6.sin6_addr));
    }

    if (bind(sd->sSocket, (const struct sockaddr *)&u_addr, namelen) != 0) {
        iocp_set_last_error(iobase, sd->sSocket);
        free(conn);
        return -1;
    }

    pConnectEx = iocp_initialize_connectex(sd->sSocket);
    if (!pConnectEx) {
        iocp_set_last_error(iobase, INVALID_SOCKET);
        return -1;
    }

    result = pConnectEx(
                 sd->sSocket,
                 name,
                 namelen,
                 NULL,
                 0,
                 NULL,
                 (OVERLAPPED *)conn);

    /**
    * Other functions return 0 to indicate success. Here it's the opposite
    */
    return iocp_just_scheduled(io, &conn->ol_conn, result == TRUE ? 0 : -1);
}

static lcb_sockdata_t *create_socket(lcb_io_opt_t iobase,
                                     int domain,
                                     int type,
                                     int protocol)
{
    iocp_t *io = (iocp_t *)iobase;
    HANDLE hResult;
    SOCKET s;

    iocp_sockdata_t *sd = (iocp_sockdata_t *)calloc(1, sizeof(*sd));

    if (sd == NULL) {
        return NULL;
    }

    /**
    * We need to use WSASocket to set the WSA_FLAG_OVERLAPPED option
    */
    s = WSASocket(domain, type, protocol,
                  NULL,
                  0,
                  WSA_FLAG_OVERLAPPED);

    if (s == INVALID_SOCKET) {
        iocp_set_last_error(iobase, s);
        free(sd);
        return NULL;
    }

    /**
    * Disable the send buffer. This ensures a callback is invoked.
    * If this is not set, the send operation may complete immediately
    * and our operations may never be queued.
    *
    * TODO: maybe we can do what UV does and create a fake event to the
    *  loop instead?
    *
    * See http://support.microsoft.com/kb/181611 for details
    */
    {
        int ii;
        int rv;
        int optval = 0;
        int opts[] = { SO_SNDBUF, SO_RCVBUF };

        for (ii = 0; ii < 0; ii++) {
            rv = setsockopt(s, SOL_SOCKET, opts[ii], (char *)&optval, sizeof(int));

            if (rv == 0) {
                continue;;
            }

            iocp_set_last_error(iobase, s);
            closesocket(s);
            free(sd);
            return NULL;
        }
    }

    hResult = CreateIoCompletionPort((HANDLE)s,
                                     io->hCompletionPort,
                                     (ULONG_PTR)sd,
                                     0);

    if (hResult == NULL) {
        iocp_set_last_error(iobase, s);
        closesocket(s);
        free(sd);
        return NULL;
    }

    sd->ol_read.sd = sd;
    sd->refcount = 1;
    sd->sSocket = s;

    /** Initialize the write structure */
    sd->w_info.ol_write.sd = sd;
    sd->w_info.state = IOCP_WRITEBUF_AVAILABLE;
    sd->w_info.ol_write.action = LCBIOCP_ACTION_WRITE;

    lcb_list_append(&io->sockets.list, &sd->list);

    return &sd->sd_base;
}

void iocp_asq_schedule(iocp_t *io, iocp_sockdata_t *sd, iocp_overlapped_t *ol)
{
    BOOL result = PostQueuedCompletionStatus(
                      io->hCompletionPort,
                      0,
                      (ULONG_PTR)sd,
                      &ol->base);

    iocp_just_scheduled(io, ol, result == TRUE ? 0 : -1);
}

static unsigned int close_socket(lcb_io_opt_t iobase, lcb_sockdata_t *sockbase)
{
    iocp_sockdata_t *sd = (iocp_sockdata_t *)sockbase;
    if (sd->sSocket != INVALID_SOCKET) {
        closesocket(sd->sSocket);
        sd->sSocket = INVALID_SOCKET;
    }
    iocp_socket_decref((iocp_t *)iobase, sd);

    return 0;
}

static int sock_nameinfo(lcb_io_opt_t iobase,
                         lcb_sockdata_t *sockbase,
                         struct lcb_nameinfo_st *ni)
{
    iocp_sockdata_t *sd = (iocp_sockdata_t *)sockbase;
    getsockname(sd->sSocket, ni->local.name, ni->local.len);
    getpeername(sd->sSocket, ni->remote.name, ni->remote.len);
    return 0;
}

static void *create_timer(lcb_io_opt_t iobase)
{
    iocp_timer_t *tmr = (iocp_timer_t *)calloc(1, sizeof(*tmr));

    (void)iobase;
    return tmr;
}

static void delete_timer(lcb_io_opt_t iobase, void *opaque)
{
    iocp_timer_t *tmr = (iocp_timer_t *)opaque;
    iocp_t *io = (iocp_t *)iobase;
    if (tmr->is_active) {
        tmr->is_active = 0;
        iocp_tmq_del(&io->timer_queue.list, tmr);
    }
}

static int update_timer(lcb_io_opt_t iobase,
                        void *opaque,
                        lcb_uint32_t usec,
                        void *arg,
                        v0_callback cb)
{
    iocp_t *io = (iocp_t *)iobase;
    iocp_timer_t *tmr = (iocp_timer_t *)opaque;
    lcb_uint64_t now;

    if (tmr->is_active) {
        iocp_tmq_del(&io->timer_queue.list, tmr);
    }

    tmr->cb = cb;
    tmr->arg = arg;
    tmr->is_active = 1;

    now = iocp_millis();
#if 0
    usec = 1000 * (1000000);
    IOCP_LOG(IOCP_WARN, "Forcing timeout to 1000 seconds");
#endif
    tmr->ms = now + (usec / 1000);

    iocp_tmq_add(&io->timer_queue.list, tmr);
    return 0;
}

static void destroy_timer(lcb_io_opt_t iobase, void *opaque)
{
    free(opaque);
    (void)iobase;
}

static void iops_dtor(lcb_io_opt_t iobase)
{
    iocp_t *io = (iocp_t *)iobase;
    lcb_list_t *cur;

    /** Close all sockets first so we can get events for them */
    LCB_LIST_FOR(cur, &io->sockets.list) {
        iocp_sockdata_t *sd;
        sd = LCB_LIST_ITEM(cur, iocp_sockdata_t, list);
        if (sd->sSocket != INVALID_SOCKET) {
            closesocket(sd->sSocket);
            sd->sSocket = INVALID_SOCKET;
        }
    }

    /** Drain the queue. This should not block */
    while (1) {
        DWORD nbytes;
        ULONG_PTR completionKey;
        LPOVERLAPPED pOl;
        iocp_sockdata_t *sd;
        iocp_overlapped_t *ol;

        GetQueuedCompletionStatus(io->hCompletionPort,
                                  &nbytes,
                                  &completionKey,
                                  &pOl,
                                  0);

        sd = (iocp_sockdata_t *)completionKey;
        ol = (iocp_overlapped_t *)pOl;

        if (!ol) {
            break;
        }


        switch (ol->action) {
        case LCBIOCP_ACTION_CONNECT:
            free(ol);
            break;

        case LCBIOCP_ACTION_WRITE:
            iocp_write_done(io, IOCP_WRITEOBJ_FROM_OVERLAPPED(ol), -1);
            break;

        case LCBIOCP_ACTION_READ:
            io->base.v.v0.error = WSAECONNRESET;
            sd->rdcb(&sd->sd_base, -1, sd->rdarg);
            break;

        default:
            /* We don't care about read */
            break;
        }

        iocp_socket_decref(io, sd);
    }

    LCB_LIST_FOR(cur, &io->sockets.list) {
        iocp_sockdata_t *sd = LCB_LIST_ITEM(cur, iocp_sockdata_t, list);

        IOCP_LOG(IOCP_WARN,
                 "Leak detected in socket %p (%lu). Refcount=%d",
                 sd,
                 sd->sSocket,
                 sd->refcount);

        if (sd->sSocket != INVALID_SOCKET) {
            closesocket(sd->sSocket);
            sd->sSocket = INVALID_SOCKET;
        }
    }

    if (io->hCompletionPort) {
        if (!CloseHandle(io->hCompletionPort)) {
            IOCP_LOG(IOCP_ERR, "Couldn't CloseHandle: %d", GetLastError());
        }
    }

    free(io);
}

static void get_procs(int version,
                      lcb_loop_procs *loop,
                      lcb_timer_procs *timer,
                      lcb_bsd_procs *bsd,
                      lcb_ev_procs *ev,
                      lcb_completion_procs *iocp,
                      lcb_iomodel_t *model)
{
    *model = LCB_IOMODEL_COMPLETION;
    
    loop->start = iocp_run;
    loop->stop = iocp_stop;

    iocp->connect = start_connect;
    iocp->read2 = start_read;
    iocp->write2 = start_write;
    iocp->socket = create_socket;
    iocp->close = close_socket;
    iocp->nameinfo = sock_nameinfo;

    timer->create = create_timer;
    timer->cancel = delete_timer;
    timer->schedule = update_timer;
    timer->destroy = destroy_timer;
    (void)ev;
    (void)bsd;
}

LIBCOUCHBASE_API
lcb_error_t lcb_iocp_new_iops(int version, lcb_io_opt_t *ioret, void *arg)
{
    iocp_t *io;
    lcb_io_opt_t tbl;

    io = (iocp_t *)calloc(1, sizeof(*io));
    if (!io) {
        abort();
        return LCB_CLIENT_ENOMEM;
    }

    /** These functions check if they were called more than once using atomic ops */
    iocp_initialize_loop_globals();
    lcb_list_init(&io->timer_queue.list);
    lcb_list_init(&io->sockets.list);

    tbl = &io->base;
    *ioret = tbl;

    io->breakout = TRUE;

    /** Create IOCP */
    io->hCompletionPort = CreateIoCompletionPort(
                              INVALID_HANDLE_VALUE, NULL, 0, 0);

    if (!io->hCompletionPort) {
        abort();
    }


    tbl->destructor = iops_dtor;
    tbl->version = 2;
    tbl->v.v2.get_procs = get_procs;

    (void)version;
    (void)arg;

    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
struct lcb_io_opt_st *lcb_create_iocp_io_opts(void) {
    struct lcb_io_opt_st *ret;
    lcb_iocp_new_iops(0, &ret, NULL);
    return ret;
}
