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

#include "plugin-internal.h"

static my_uvreq_t *alloc_uvreq(my_sockdata_t *sock, generic_callback_t callback);
static void free_bufinfo_common(struct lcb_buf_info *bi);
static void generic_close_cb(uv_handle_t *handle);
static void set_last_error(my_iops_t *io, int error);
static void wire_rw_ops(lcb_io_opt_t iop);
static void wire_timer_ops(lcb_io_opt_t iop);
static void socket_closed_callback(uv_handle_t *handle);


static void decref_iops(lcb_io_opt_t iobase)
{
    my_iops_t *io = (my_iops_t *)iobase;
    lcb_assert(io->iops_refcount);
    if (--io->iops_refcount) {
        return;
    }

    memset(io, 0xff, sizeof(*io));
    free(io);
}

static void iops_lcb_dtor(lcb_io_opt_t iobase)
{
    my_iops_t *io = (my_iops_t *)iobase;
    if (io->startstop_noop) {
        decref_iops(iobase);
        return;
    }

    while (io->iops_refcount > 1) {
        UVC_RUN_ONCE(io->loop);
    }

    if (io->external_loop == 0) {
        uv_loop_delete(io->loop);
    }

    decref_iops(iobase);
}

/******************************************************************************
 ******************************************************************************
 ** Event Loop Functions                                                     **
 ******************************************************************************
 ******************************************************************************/

#if UV_VERSION < 0x000900
static void do_run_loop(my_iops_t *io)
{
    while (uv_run_once(io->loop) && io->do_stop == 0) {
        /* nothing */
    }
    io->do_stop = 0;
}
static void do_stop_loop(my_iops_t *io)
{
    io->do_stop = 1;
}
#else
static void do_run_loop(my_iops_t *io) {
    uv_run(io->loop, UV_RUN_DEFAULT);
}
static void do_stop_loop(my_iops_t *io)
{
    uv_stop(io->loop);
}
#endif


static void run_event_loop(lcb_io_opt_t iobase)
{
    my_iops_t *io = (my_iops_t *)iobase;

    if (!io->startstop_noop) {
        do_run_loop(io);
    }
}

static void stop_event_loop(lcb_io_opt_t iobase)
{
    my_iops_t *io = (my_iops_t *)iobase;
    if (!io->startstop_noop) {
        do_stop_loop(io);
    }
}

LCBUV_API
lcb_error_t lcb_create_libuv_io_opts(int version,
                                     lcb_io_opt_t *io,
                                     lcbuv_options_t *options)
{
    lcb_io_opt_t iop;
    uv_loop_t *loop = NULL;
    my_iops_t *ret;

    if (version != 0) {
        return LCB_PLUGIN_VERSION_MISMATCH;
    }

#ifdef _WIN32
    {
        /** UV unloading on Windows doesn't work well */
        HMODULE module;
        /* We need to provide a symbol */
        static int dummy;
        BOOL result;
        result = GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                                   GET_MODULE_HANDLE_EX_FLAG_PIN,
                                   (LPCSTR)&dummy,
                                   &module);
        if (!result) {
            return LCB_EINTERNAL;
        }
    }
#endif

    ret = calloc(1, sizeof(*ret));

    if (!ret) {
        return LCB_CLIENT_ENOMEM;
    }

    iop = &ret->base;
    iop->version = 1;

    wire_timer_ops(iop);
    wire_rw_ops(iop);

    iop->v.v1.run_event_loop = run_event_loop;
    iop->v.v1.stop_event_loop = stop_event_loop;

    /* dtor */
    iop->destructor = iops_lcb_dtor;

    ret->iops_refcount = 1;

    *io = iop;
    if (options) {
        if (options->v.v0.loop) {
            ret->external_loop = 1;
            loop = options->v.v0.loop;
        }
        ret->startstop_noop = options->v.v0.startsop_noop;
    }

    if (!loop) {
        loop = uv_loop_new();
    }

    ret->loop = loop;

    return LCB_SUCCESS;
}

#define SOCK_INCR_PENDING(s, fld) (s)->pending.fld++
#define SOCK_DECR_PENDING(s, fld) (s)->pending.fld--

static void free_bufinfo_common(struct lcb_buf_info *bi)
{
    if (bi->root || bi->ringbuffer) {
        lcb_assert((void *)bi->root != (void *)bi->ringbuffer);
    }
    lcb_assert((bi->ringbuffer == NULL && bi->root == NULL) ||
               (bi->root && bi->ringbuffer));

    lcb_mem_free(bi->root);
    lcb_mem_free(bi->ringbuffer);
    bi->root = NULL;
    bi->ringbuffer = NULL;
}

#ifdef DEBUG
static void sock_dump_pending(my_sockdata_t *sock)
{
    printf("Socket %p:\n", (void *)sock);
    printf("\tRead: %d\n",  sock->pending.read);
    printf("\tWrite: %d\n", sock->pending.write);
}
#endif

static void sock_do_uv_close(my_sockdata_t *sock)
{
    if (!sock->uv_close_called) {
        sock->uv_close_called = 1;
        uv_close((uv_handle_t *)&sock->tcp, socket_closed_callback);
    }
}

static void decref_sock(my_sockdata_t *sock)
{
    lcb_assert(sock->refcount);

    if (--sock->refcount) {
        return;
    }
    sock_do_uv_close(sock);
}

#define incref_sock(sd) (sd)->refcount++

/******************************************************************************
 ******************************************************************************
 ** Socket Functions                                                         **
 ******************************************************************************
 ******************************************************************************/
static lcb_sockdata_t *create_socket(lcb_io_opt_t iobase,
                                     int domain,
                                     int type,
                                     int protocol)
{
    my_sockdata_t *ret;
    my_iops_t *io = (my_iops_t *)iobase;

    ret = calloc(1, sizeof(*ret));
    if (!ret) {
        return NULL;
    }

    uv_tcp_init(io->loop, &ret->tcp.t);

    incref_iops(io);
    incref_sock(ret);

    set_last_error(io, 0);

    (void)domain;
    (void)type;
    (void)protocol;

    return (lcb_sockdata_t *)ret;
}

/**
 * This one is called from uv_close
 */
static void socket_closed_callback(uv_handle_t *handle)
{
    my_sockdata_t *sock = PTR_FROM_FIELD(my_sockdata_t, handle, tcp);
    my_iops_t *io = (my_iops_t *)sock->base.parent;

    lcb_assert(sock->refcount == 0);

    free_bufinfo_common(&sock->base.read_buffer);

    lcb_assert(sock->base.read_buffer.root == NULL);
    lcb_assert(sock->base.read_buffer.ringbuffer == NULL);

    memset(sock, 0xEE, sizeof(*sock));
    free(sock);

    decref_iops(&io->base);
}


/**
 * This one is asynchronously triggered, so as to ensure we don't have any
 * silly re-entrancy issues.
 */
static void socket_closing_cb(uv_idle_t *idle, int status)
{
    my_sockdata_t *sock = idle->data;

    uv_idle_stop(idle);
    uv_close((uv_handle_t *)idle, generic_close_cb);

    if (sock->pending.read) {
        /**
         * UV doesn't invoke read callbacks once the handle has been closed
         * so we must track this ourselves.
         */
        lcb_assert(sock->pending.read == 1);
        uv_read_stop((uv_stream_t *)&sock->tcp);
        sock->pending.read--;
        decref_sock(sock);
    }

#ifdef DEBUG
    if (sock->pending.read || sock->pending.write) {
        sock_dump_pending(sock);
    }
#endif

    decref_sock(sock);
    sock_do_uv_close(sock);

    (void)status;
}

static unsigned int close_socket(lcb_io_opt_t iobase, lcb_sockdata_t *sockbase)
{
    my_sockdata_t *sock = (my_sockdata_t *)sockbase;
    my_iops_t *io = (my_iops_t *)iobase;

    uv_idle_t *idle = calloc(1, sizeof(*idle));

    lcb_assert(sock->lcb_close_called == 0);

    sock->lcb_close_called = 1;
    idle->data = sock;
    uv_idle_init(io->loop, idle);
    uv_idle_start(idle, socket_closing_cb);

    return 0;
}


/******************************************************************************
 ******************************************************************************
 ** Connection Functions                                                     **
 ******************************************************************************
 ******************************************************************************/
static void connect_callback(uv_connect_t *req, int status)
{
    my_uvreq_t *uvr = (my_uvreq_t *)req;

    if (uvr->cb.conn) {
        uvr->cb.conn(&uvr->socket->base, status);
    }

    decref_sock(uvr->socket);
    free(uvr);
}

static int start_connect(lcb_io_opt_t iobase,
                         lcb_sockdata_t *sockbase,
                         const struct sockaddr *name,
                         unsigned int namelen,
                         lcb_io_connect_cb callback)
{
    my_sockdata_t *sock = (my_sockdata_t *)sockbase;
    my_iops_t *io = (my_iops_t *)iobase;
    my_uvreq_t *uvr;
    int ret;
    int err_is_set = 0;

    uvr = alloc_uvreq(sock, (generic_callback_t)callback);
    if (!uvr) {
        return -1;
    }

    if (namelen == sizeof(struct sockaddr_in)) {
        ret = UVC_TCP_CONNECT(&uvr->uvreq.conn,
                             &sock->tcp.t,
                             name,
                             connect_callback);

    } else if (namelen == sizeof(struct sockaddr_in6)) {
        ret = UVC_TCP_CONNECT6(&uvr->uvreq.conn,
                              &sock->tcp.t,
                              name,
                              connect_callback);

    } else {
        io->base.v.v1.error = EINVAL;
        ret = -1;
        err_is_set = 1;
    }

    if (ret) {
        if (!err_is_set) {
            set_last_error(io, ret);
        }

        free(uvr);

    } else {
        incref_sock(sock);
    }

    return ret;
}

/******************************************************************************
 ******************************************************************************
 ** my_writebuf_t functions                                                  **
 ******************************************************************************
 ******************************************************************************/
static lcb_io_writebuf_t *create_writebuf(lcb_io_opt_t iobase, lcb_sockdata_t *sd)
{
    my_writebuf_t *ret = calloc(1, sizeof(*ret));

    ret->base.parent = iobase;

    (void)sd;
    return (lcb_io_writebuf_t *)ret;
}

static void release_writebuf(lcb_io_opt_t iobase,
                             lcb_sockdata_t *sd,
                             lcb_io_writebuf_t *buf)
{
    free_bufinfo_common(&buf->buffer);
    memset(buf, 0xff, sizeof(my_writebuf_t));
    free(buf);

    (void)iobase;
    (void)sd;
}


/******************************************************************************
 ******************************************************************************
 ** Write Functions                                                          **
 ******************************************************************************
 ******************************************************************************/
static void write_callback(uv_write_t *req, int status)
{
    my_write_t *mw = (my_write_t *)req;
    my_writebuf_t *wbuf = PTR_FROM_FIELD(my_writebuf_t, mw, write);
    my_sockdata_t *sock = wbuf->sock;
    lcb_io_write_cb callback = CbREQ(mw);

    if (callback) {
        callback(&sock->base, &wbuf->base, status);
    }

    SOCK_DECR_PENDING(sock, write);
    decref_sock(sock);
}

static int start_write(lcb_io_opt_t iobase,
                       lcb_sockdata_t *sockbase,
                       lcb_io_writebuf_t *wbufbase,
                       lcb_io_write_cb callback)
{
    my_sockdata_t *sock = (my_sockdata_t *)sockbase;
    my_iops_t *io = (my_iops_t *)iobase;
    my_writebuf_t *wbuf = (my_writebuf_t *)wbufbase;
    int ii;
    int ret;

    wbuf->sock = sock;
    wbuf->write.callback = callback;

    for (ii = 0; ii < 2; ii++) {
        wbuf->uvbuf[ii].base = wbuf->base.buffer.iov[ii].iov_base;
        wbuf->uvbuf[ii].len = (lcb_uvbuf_len_t)wbuf->base.buffer.iov[ii].iov_len;
    }

    ret = uv_write(&wbuf->write.w,
                   (uv_stream_t *)&sock->tcp,
                   wbuf->uvbuf,
                   2,
                   write_callback);

    set_last_error(io, ret);

    if (ret == 0) {
        incref_sock(sock);
        SOCK_INCR_PENDING(sock, write);
    }

    return ret;
}


/******************************************************************************
 ******************************************************************************
 ** Read Functions                                                           **
 ******************************************************************************
 ******************************************************************************/
static UVC_ALLOC_CB(alloc_cb)
{
    UVC_ALLOC_CB_VARS()

    my_sockdata_t *sock = PTR_FROM_FIELD(my_sockdata_t, handle, tcp);
    struct lcb_buf_info *bi = &sock->base.read_buffer;

    lcb_assert(sock->cur_iov == 0);

    buf->base = bi->iov[0].iov_base;
    buf->len = (lcb_uvbuf_len_t)bi->iov[0].iov_len;

    sock->cur_iov++;
    sock->read_done = 1;
    (void)suggested_size;

    UVC_ALLOC_CB_RETURN();
}

static UVC_READ_CB(read_cb)
{
    UVC_READ_CB_VARS()

    my_tcp_t *mt = (my_tcp_t *)stream;
    my_sockdata_t *sock = PTR_FROM_FIELD(my_sockdata_t, mt, tcp);

    lcb_io_read_cb callback = CbREQ(mt);
    lcb_assert(sock->read_done < 2);

    /**
     * UV uses nread == 0 to signal EAGAIN. If the alloc callback hasn't
     * set read_done (because there's no more buffer space), and UV doesn't
     * say it's done with reading, we don't do anything here.
     */
    if (nread < 1) {
        sock->read_done = 1;
    }

    if (!sock->read_done) {
        return;
    }

    sock->read_done++;
    SOCK_DECR_PENDING(sock, read);

    uv_read_stop(stream);
    CbREQ(mt) = NULL;

    if (callback) {
        callback(&sock->base, nread);
#ifdef DEBUG
    }  else {
        printf("No callback specified!!\n");
#endif
    }

    decref_sock(sock);
    (void)buf;
}

static int start_read(lcb_io_opt_t iobase,
                      lcb_sockdata_t *sockbase,
                      lcb_io_read_cb callback)
{
    my_sockdata_t *sock = (my_sockdata_t *)sockbase;
    my_iops_t *io = (my_iops_t *)iobase;
    int ret;

    sock->read_done = 0;
    sock->cur_iov = 0;
    sock->tcp.callback = callback;

    ret = uv_read_start((uv_stream_t *)&sock->tcp.t, alloc_cb, read_cb);
    set_last_error(io, ret);

    if (ret == 0) {
        SOCK_INCR_PENDING(sock, read);
        incref_sock(sock);
    }
    return ret;
}

/******************************************************************************
 ******************************************************************************
 ** Async Errors                                                             **
 ******************************************************************************
 ******************************************************************************/
static void err_idle_cb(uv_idle_t *idle, int status)
{
    my_uvreq_t *uvr = (my_uvreq_t *)idle;
    lcb_io_error_cb callback = uvr->cb.err;

    uv_idle_stop(idle);
    uv_close((uv_handle_t *)idle, generic_close_cb);

    if (callback) {
        callback(&uvr->socket->base);
    }

    decref_sock(uvr->socket);
    (void)status;
}


static void send_error(lcb_io_opt_t iobase, lcb_sockdata_t *sockbase,
                       lcb_io_error_cb callback)
{
    my_sockdata_t *sock = (my_sockdata_t *)sockbase;
    my_iops_t *io = (my_iops_t *)iobase;
    my_uvreq_t *uvr;

    if (!sock) {
        return;
    }

    uvr = alloc_uvreq(sock, (generic_callback_t)callback);

    if (!uvr) {
        return;
    }

    uv_idle_init(io->loop, &uvr->uvreq.idle);
    uv_idle_start(&uvr->uvreq.idle, err_idle_cb);
    incref_sock(sock);
}

static int get_nameinfo(lcb_io_opt_t iobase,
                        lcb_sockdata_t *sockbase,
                        struct lcb_nameinfo_st *ni)
{
    my_sockdata_t *sock = (my_sockdata_t *)sockbase;
    my_iops_t *io = (my_iops_t *)iobase;
    uv_tcp_getpeername(&sock->tcp.t, ni->remote.name, ni->remote.len);
    uv_tcp_getsockname(&sock->tcp.t, ni->local.name, ni->local.len);

    (void)io;
    return 0;
}


static void wire_rw_ops(lcb_io_opt_t iop)
{
    iop->v.v1.start_connect = start_connect;
    iop->v.v1.create_writebuf = create_writebuf;
    iop->v.v1.release_writebuf = release_writebuf;
    iop->v.v1.start_write = start_write;
    iop->v.v1.start_read = start_read;
    iop->v.v1.create_socket = create_socket;
    iop->v.v1.close_socket = close_socket;
    iop->v.v1.send_error = send_error;
    iop->v.v1.get_nameinfo = get_nameinfo;
}

/******************************************************************************
 ******************************************************************************
 ** Timer Functions                                                          **
 ** There are just copied from the old couchnode I/O code                    **
 ******************************************************************************
 ******************************************************************************/
static void timer_cb(uv_timer_t *uvt, int status)
{
    my_timer_t *timer = (my_timer_t *)uvt;
    if (timer->callback) {
        timer->callback(-1, 0, timer->cb_arg);
    }
    (void)status;
}

static void *create_timer(lcb_io_opt_t iobase)
{
    my_iops_t *io = (my_iops_t *)iobase;
    my_timer_t *timer = calloc(1, sizeof(*timer));
    if (!timer) {
        return NULL;
    }

    timer->parent = io;
    incref_iops(io);
    uv_timer_init(io->loop, &timer->uvt);

    return timer;
}

static int update_timer(lcb_io_opt_t iobase,
                        void *timer_opaque,
                        lcb_uint32_t usec,
                        void *cbdata,
                        v0_callback_t callback)
{
    my_timer_t *timer = (my_timer_t *)timer_opaque;

    timer->callback = callback;
    timer->cb_arg = cbdata;

    (void)iobase;

    return uv_timer_start(&timer->uvt, timer_cb, usec / 1000, 0);
}

static void delete_timer(lcb_io_opt_t iobase, void *timer_opaque)
{
    my_timer_t *timer = (my_timer_t *)timer_opaque;

    uv_timer_stop(&timer->uvt);
    timer->callback = NULL;

    (void)iobase;
}

static void timer_close_cb(uv_handle_t *handle)
{
    my_timer_t *timer = (my_timer_t *)handle;
    decref_iops(&timer->parent->base);
    memset(timer, 0xff, sizeof(*timer));
    free(timer);
}

static void destroy_timer(lcb_io_opt_t io, void *timer_opaque)
{
    delete_timer(io, timer_opaque);
    uv_close((uv_handle_t *)timer_opaque, timer_close_cb);
}

static void wire_timer_ops(lcb_io_opt_t iop)
{
    /**
     * v0 functions
     */
    iop->v.v1.create_timer = create_timer;
    iop->v.v1.update_timer = update_timer;
    iop->v.v1.delete_timer = delete_timer;
    iop->v.v1.destroy_timer = destroy_timer;
}

static my_uvreq_t *alloc_uvreq(my_sockdata_t *sock, generic_callback_t callback)
{
    my_uvreq_t *ret = calloc(1, sizeof(*ret));
    if (!ret) {
        sock->base.parent->v.v1.error = ENOMEM;
        return NULL;
    }
    ret->socket = sock;
    ret->cb.cb_ = callback;
    return ret;
}


static void set_last_error(my_iops_t *io, int error)
{
    io->base.v.v1.error = uvc_last_errno(io->loop, error);
}

static void generic_close_cb(uv_handle_t *handle)
{
    free(handle);
}
