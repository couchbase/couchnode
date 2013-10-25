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
 *
 * This file contains the core routines which actually make up the
 * various "loops" of the event loop.
 *
 * @author Mark Nunberg
 */

#include "iocp_iops.h"
#include <stdio.h>

static sGetQueuedCompletionStatusEx pGetQueuedCompletionStatusEx = NULL;
static int Have_GQCS_Ex = 1;

void iocp_initialize_loop_globals(void)
{
    HMODULE hKernel32;
    static IOCP_SYNCTYPE initialized = 0;

    if (!IOCP_INITONCE(initialized)) {
        return;
    }

    initialized = 1;

    hKernel32 = GetModuleHandleA("kernel32.dll");
    if (!hKernel32) {
        fprintf(stderr, "Couldn't load Kernel32.dll: [%d]\n", GetLastError());
        return;
    }

    pGetQueuedCompletionStatusEx = (sGetQueuedCompletionStatusEx)GetProcAddress(hKernel32, "GetQueuedCompletionStatusEx");
    if (pGetQueuedCompletionStatusEx == NULL) {
        Have_GQCS_Ex = 0;
        fprintf(stderr, "Couldn't load GetQueuedCompletionStatusEx. Using fallback [%d]\n",
                GetLastError());
    }
}

/**
 * Make these macros prominent.
 * It's important that they get called after each of our own calls to
 * lcb.
 */
#define LOOP_CAN_CONTINUE(io) ((io)->breakout == FALSE)
#define DO_IF_BREAKOUT(io, e) if (!LOOP_CAN_CONTINUE(io)) { e; }
#define HAS_QUEUED_IO(io) (io)->n_iopending

/**
 * Handles a single OVERLAPPED entry, and invokes
 * the appropriate event
 */
static void handle_single_overlapped(iocp_t *io,
                                     OVERLAPPED *lpOverlapped,
                                     ULONG_PTR lpCompletionKey,
                                     DWORD dwNumberOfBytesTransferred)
{
    union {
        iocp_write_t *w;
        iocp_connect_t *conn;
        iocp_async_error_t *errev;
    } u_ol;

    iocp_overlapped_t *ol = (iocp_overlapped_t *)lpOverlapped;
    iocp_sockdata_t *sd = (iocp_sockdata_t *)lpCompletionKey;

    void *pointer_to_free = NULL;
    int opstatus = 0;
    int ws_status;
    int action;

    IOCP_LOG(IOCP_TRACE, "OL=%p, NB=%lu", ol, dwNumberOfBytesTransferred);

    ws_status = iocp_overlapped_status(lpOverlapped);

    if (ws_status) {
        IOCP_LOG(IOCP_WARN, "Got negative status for %p: %d", ol, ws_status);
        io->base.v.v1.error = iocp_w32err_2errno(ws_status);
        opstatus = -1;
    }

    action = ol->action;

    switch (action) {

    case LCBIOCP_ACTION_READ:
        /**
         * Nothing special in the OVERLAPPED.
         */
        if (sd->rdcb) {
            sd->rdcb(&sd->sd_base, dwNumberOfBytesTransferred);
        }
        break;

    case LCBIOCP_ACTION_WRITE:
        u_ol.w = IOCP_WRITEOBJ_FROM_OVERLAPPED(lpOverlapped);
        /** Invoke the callback */
        u_ol.w->cb(&sd->sd_base, &u_ol.w->wbase, opstatus);
        break;

    case LCBIOCP_ACTION_CONNECT:
        u_ol.conn = (iocp_connect_t *)ol;

        if (opstatus == 0) {
            int rv = setsockopt(ol->sd->sSocket,
                                SOL_SOCKET,
                                SO_UPDATE_CONNECT_CONTEXT,
                                NULL,
                                0);

            if (rv == SOCKET_ERROR) {
                iocp_set_last_error(&io->base, ol->sd->sSocket);
                opstatus = -1;
            }
        }
        u_ol.conn->cb(&sd->sd_base, opstatus);
        pointer_to_free = u_ol.conn;
        break;

    case LCBIOCP_ACTION_ERROR:
        u_ol.errev = (iocp_async_error_t *)lpOverlapped;
        u_ol.errev->cb(&sd->sd_base);
        pointer_to_free = u_ol.errev;
        break;

    default:
        IOCP_LOG(IOCP_FATAL, "Unrecognized action %d. Abort", action);
        abort();
    }

    iocp_on_dequeued(io, sd, action);
    free(pointer_to_free);
}

static int dequeue_io_impl_ex(iocp_t *io, DWORD msTimeout)
{
    OVERLAPPED_ENTRY entries[64];
    BOOL status;
    ULONG ulRemoved;
    unsigned int ii;

    status = pGetQueuedCompletionStatusEx(
                 io->hCompletionPort,
                 entries,
                 sizeof(entries) / sizeof(OVERLAPPED_ENTRY),
                 &ulRemoved,
                 msTimeout,
                 FALSE);

    if (status == FALSE || ulRemoved == 0) {
        return 0;
    }

    for (ii = 0; ii < ulRemoved; ii++) {
        OVERLAPPED_ENTRY *ent = entries + ii;

        if (!LOOP_CAN_CONTINUE(io)) {

            PostQueuedCompletionStatus(
                io->hCompletionPort,
                ent->dwNumberOfBytesTransferred,
                ent->lpCompletionKey,
                ent->lpOverlapped);

            continue;
        }


        io->n_iopending--;

        handle_single_overlapped(
            io,
            ent->lpOverlapped,
            ent->lpCompletionKey,
            ent->dwNumberOfBytesTransferred);
    }

    return LOOP_CAN_CONTINUE(io);
}

static int dequeue_io_impl_compat(iocp_t *io, DWORD msTimeout)
{
    BOOL result;
    DWORD dwNbytes;
    ULONG_PTR ulPtr;
    OVERLAPPED *lpOverlapped;

    result = GetQueuedCompletionStatus(io->hCompletionPort,
                                       &dwNbytes,
                                       &ulPtr,
                                       &lpOverlapped,
                                       msTimeout);

    if (lpOverlapped == NULL) {
        IOCP_LOG(IOCP_TRACE, "No events left");
        /** Nothing to do here */
        return 0;
    }

    io->n_iopending--;

    handle_single_overlapped(io, lpOverlapped, ulPtr, dwNbytes);
    return LOOP_CAN_CONTINUE(io);
}

static void deque_expired_timers(iocp_t *io, lcb_uint64_t now)
{
    while (LOOP_CAN_CONTINUE(io)) {

        iocp_timer_t *timer = iocp_tmq_pop(&io->timer_queue.list, now);

        if (!timer) {
            return;
        }

        timer->is_active = 0;
        timer->cb(-1, 0, timer->arg);
    }
}


/**
 * I'd like to make several behavioral guidelines here:
 *
 * 1) LCB shall call breakout if it wishes to terminate the loop.
 * 2) We shall not handle the case where the user accidentally calls lcb_wait()
 *    while not having anything pending. That's just too bad.
 * 3) Timers shall be dispatched only once, at the end of the loop.
 */

void iocp_run(lcb_io_opt_t iobase)
{

    iocp_t *io = (iocp_t *)iobase;

    lcb_uint64_t now = 0;
    DWORD tmo;
    int remaining;

    if (!io->breakout) {
        return;
    }

    io->breakout = FALSE;

    IOCP_LOG(IOCP_INFO, "do-loop BEGIN");

    do {
        if (!now) {
            now = iocp_millis();
            tmo = (DWORD)iocp_tmq_next_timeout(&io->timer_queue.list, now);
        }

        IOCP_LOG(IOCP_TRACE, "Timeout=%lu msec", tmo);
        lcb_assert(tmo != INFINITE);
        do {
            if (Have_GQCS_Ex) {
                remaining = dequeue_io_impl_ex(io, tmo);

            } else {
                remaining = dequeue_io_impl_compat(io, tmo);
            }

            tmo = 0;
        } while (LOOP_CAN_CONTINUE(io) && remaining);

        IOCP_LOG(IOCP_TRACE, "Stopped IO loop");

        if (LOOP_CAN_CONTINUE(io)) {
            now = iocp_millis();
            deque_expired_timers(io, now);
            tmo = (DWORD)iocp_tmq_next_timeout(&io->timer_queue.list, now);
        }

    } while (LOOP_CAN_CONTINUE(io) && (HAS_QUEUED_IO(io) || tmo != INFINITE));

    IOCP_LOG(IOCP_INFO, "do-loop END");

    io->breakout = TRUE;
}

void iocp_stop(lcb_io_opt_t iobase)
{
    iocp_t *io = (iocp_t *)iobase;
    IOCP_LOG(IOCP_INFO, "Breakout requested");
    io->breakout = TRUE;
}
