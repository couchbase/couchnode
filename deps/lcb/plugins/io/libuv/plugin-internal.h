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

#ifndef LCBUV_PLUGIN_INTERNAL_H
#define LCBUV_PLUGIN_INTERNAL_H

#include <libcouchbase/couchbase.h>
#include <uv.h>

#include <errno.h>
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>

#include "libuv_compat.h"

#ifdef LCBUV_EMBEDDED_SOURCE
#include <libcouchbase/libuv_io_opts.h>
#else
/** Load definitions from inside */
#include "libuv_io_opts.h"
#endif

typedef void (*v0_callback_t)(lcb_socket_t, short, void *);
typedef void (*generic_callback_t)(void);


/**
 * These structures come about the limitation that with -Werror -Wextra
 * compilation fails because strictly speaking, a function pointer isn't
 * convertible to a normal pointer.
 */

/**
 * Macro - sometimes we might want to use the ->data field?
 */
#define CbREQ(mr) (mr)->callback
typedef struct {
    uv_tcp_t t;
    lcb_io_read_cb callback;
} my_tcp_t;

typedef struct {
    uv_write_t w;
    lcb_io_write_cb callback;
} my_write_t;


/**
 * Wrapper for lcb_sockdata_t
 */
typedef struct {
    lcb_sockdata_t base;

    /**
     * UV tcp handle. This is also a uv_stream_t.
     * ->data field contains the read callback
     */
    my_tcp_t tcp;

    /** Reference count */
    unsigned int refcount;

    /** Current iov index in the read buffer */
    unsigned char cur_iov;

    /** Flag indicating whether uv_read_stop should be called on the next call */
    unsigned char read_done;

    /** Flag indicating whether uv_close has already been called  on the handle */
    unsigned char uv_close_called;

    unsigned char lcb_close_called;

    struct {
        int read;
        int write;
    } pending;

} my_sockdata_t;

typedef struct {
    lcb_io_writebuf_t base;

    /** Write handle.
     * ->data field contains the callback
     */
    my_write_t write;

    /** Buffer structures corresponding to buf_info */
    uv_buf_t uvbuf[2];

    /** Parent socket structure */
    my_sockdata_t *sock;

} my_writebuf_t;


typedef struct {
    struct lcb_io_opt_st base;
    uv_loop_t *loop;

    /** Refcount. When this hits zero we free this */
    unsigned int iops_refcount;

    /** Whether using a user-initiated loop */
    int external_loop;

    /** whether start/stop are noops */
    int startstop_noop;

    /** for 0.8 only, whether to stop */
    int do_stop;
} my_iops_t;

typedef struct {
    uv_timer_t uvt;
    v0_callback_t callback;
    void *cb_arg;
    my_iops_t *parent;
} my_timer_t;

typedef struct {
    union {
        uv_connect_t conn;
        uv_idle_t idle;
    } uvreq;

    union {
        lcb_io_connect_cb conn;
        lcb_io_error_cb err;
        generic_callback_t cb_;
    } cb;

    my_sockdata_t *socket;
} my_uvreq_t;

/******************************************************************************
 ******************************************************************************
 ** Common Macros                                                            **
 ******************************************************************************
 ******************************************************************************/
#define PTR_FROM_FIELD(t, p, fld) ((t*)((char*)p-(offsetof(t, fld))))

#define incref_iops(io) (io)->iops_refcount++

#ifdef _WIN32
  typedef ULONG lcb_uvbuf_len_t;
#else
  typedef size_t lcb_uvbuf_len_t;
#endif

#endif
