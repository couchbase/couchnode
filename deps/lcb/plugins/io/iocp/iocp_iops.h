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

#ifndef LCB_IOCP_H
#define LCB_IOCP_H

#include <libcouchbase/assert.h>

#define WIN32_NO_STATUS
#include <libcouchbase/couchbase.h>
#include "list.h"

#undef WIN32_NO_STATUS

#ifdef __MINGW32__
#include "mingwdefs.h"
#else
#include <ntstatus.h>
#endif

#include "iocpdefs.h"

/**
 * These macros provide atomic operations for one-time initialization
 * functions. They take as their parameter a 'LONG'.
 * The initial value of the variable should be 0. If the initialization
 * function has not run yet, it is set to 1. Subsequent functions will
 * return 1.
 */
#define IOCP_SYNCTYPE volatile LONG
#define IOCP_INITONCE(syncvar) InterlockedCompareExchange(&syncvar, 1, 0) ? 0 : 1

#ifdef __cplusplus
extern "C" {
#endif

#define LCB_IOCP_VISTA_API
#if _WIN32_WINNT < 0x0600
#undef LCB_IOCP_VISTA_API
#endif

    enum {
        LCBIOCP_ACTION_NONE = 100,
        LCBIOCP_ACTION_READ,
        LCBIOCP_ACTION_WRITE,
        LCBIOCP_ACTION_CONNECT,
        LCBIOCP_ACTION_ERROR
    };

    struct iocp_sockdata_st;

    /**
     * This structure is our 'overlapped' subclass. It in itself does not
     * contain any data, but rather determines how to read the associated
     * CompletionKey passed along with GetQueuedCompletionStatus.
     * This information is determined from the 'action' field
     */
    typedef struct {
        OVERLAPPED base;
        struct iocp_sockdata_st *sd;
        char action;
    } iocp_overlapped_t;

    typedef enum {
        IOCP_WRITEBUF_AVAILABLE = 0,
        IOCP_WRITEBUF_INUSE,
        IOCP_WRITEBUF_ALLOCATED
    } iocp_wbuf_state_t;

    typedef struct {
        lcb_io_writebuf_t wbase;
        iocp_overlapped_t ol_write;
        lcb_io_write_cb cb;
        iocp_wbuf_state_t state;
    } iocp_write_t;

    #define IOCP_WRITEOBJ_FROM_OVERLAPPED(ol) \
        (iocp_write_t *)(((char *)ol) - offsetof(iocp_write_t, ol_write))

    typedef struct iocp_sockdata_st {
        lcb_sockdata_t sd_base;
        iocp_overlapped_t ol_read;

        /** Write structure allocated as a single chunk */
        iocp_write_t w_info;
        /**
         * We use a refcount here to handle 'close' operations.
         * A new socket is initialized with a refcount of 0, and is incremented
         * for each posted operation. When GetQueuedCompletionStatus obtains this
         * socket, its reference count is decremented
         */
        unsigned int refcount;

        SOCKET sSocket;
        lcb_io_read_cb rdcb;
        lcb_list_t list;
    } iocp_sockdata_t;

    typedef struct {
        iocp_overlapped_t ol_conn;
        lcb_io_connect_cb cb;
    } iocp_connect_t;

    typedef void (*v0_callback)(lcb_socket_t, short, void *);

    struct iocp_timer_st;

    typedef struct iocp_timer_st {
        lcb_list_t list;
        char is_active;
        lcb_uint64_t ms;
        v0_callback cb;
        void *arg;
    } iocp_timer_t;

    typedef struct {
        iocp_overlapped_t ol_dummy;
        lcb_io_error_cb cb;
    } iocp_async_error_t;

    typedef struct iocp_st {
        /** Base table */
        struct lcb_io_opt_st base;

        /** The completion port */
        HANDLE hCompletionPort;

        /** Sorted list */
        iocp_timer_t timer_queue;

        /** List of registered sockets in the list */
        iocp_sockdata_t sockets;

        /** How many operations are pending for I/O */
        unsigned int n_iopending;

        /** Flag unset during lcb_wait() and set during lcb_breakout() */
        BOOL breakout;
    } iocp_t;

    /**
     * Does the "Right Thing" after an operation has been scheduled
     */
    int iocp_just_scheduled(iocp_t *io, iocp_overlapped_t *ol, int status);
    void iocp_on_dequeued(iocp_t *io, iocp_sockdata_t *sd, int action);
    void iocp_socket_decref(iocp_t *io, iocp_sockdata_t *sd);

    /**
     * Schedule generic events to the queue
     */
    void iocp_asq_schedule(iocp_t *io, iocp_sockdata_t *sd, iocp_overlapped_t *ol);


    int iocp_w32err_2errno(DWORD error);
    DWORD iocp_set_last_error(lcb_io_opt_t io, SOCKET sock);
    lcb_uint64_t iocp_millis(void);
    void iocp_initialize_loop_globals(void);
    LPFN_CONNECTEX iocp_initialize_connectex(SOCKET s);
    void iocp_free_bufinfo_common(struct lcb_buf_info *bi);

    int iocp_overlapped_status(OVERLAPPED *lpOverlapped);

    /**
     * Start/Stop
     */
    void iocp_run(lcb_io_opt_t iobase);
    void iocp_stop(lcb_io_opt_t iobase);

    /**
     * Timer Functions
     */
    void iocp_tmq_add(lcb_list_t *list, iocp_timer_t *timer);
    void iocp_tmq_del(lcb_list_t *list, iocp_timer_t *timer);
    lcb_uint64_t iocp_tmq_next_timeout(lcb_list_t *list, lcb_uint64_t now);
    iocp_timer_t *iocp_tmq_pop(lcb_list_t *list, lcb_uint64_t now);

    LIBCOUCHBASE_API
    lcb_error_t lcb_iocp_new_iops(int version, lcb_io_opt_t *ioret, void *arg);

    enum {
        IOCP_TRACE,
        IOCP_DEBUG,
        IOCP_INFO,
        IOCP_WARN,
        IOCP_ERR,
        IOCP_FATAL
    };

#ifdef IOCP_LOG_VERBOSE
#include <stdio.h>
#define IOCP_LOG(facil, ...) \
    fprintf(stderr, "[%s] <%s:%d>: ", #facil, __FILE__, __LINE__); \
    fprintf(stderr, __VA_ARGS__); \
    fprintf(stderr, "\n");
#else
#define IOCP_LOG(...)
#endif

#ifdef __cplusplus
}
#endif

#endif /* LCB_IOCP_H */
