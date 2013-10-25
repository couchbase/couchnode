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
 * This file contains routines for reading and writing data from and to a
 * socket
 * @author Mark Nunberg
 */

#include "internal.h"

lcb_sockrw_status_t lcb_sockrw_v0_read(lcb_connection_t conn, ringbuffer_t *buf)
{
    struct lcb_iovec_st iov[2];
    lcb_ssize_t nr;

    if (!ringbuffer_ensure_capacity(buf,
                                    conn->instance ? conn->instance->rbufsize :
                                    LCB_DEFAULT_RBUFSIZE)) {
        lcb_error_handler(conn->instance, LCB_CLIENT_ENOMEM, NULL);
        return LCB_SOCKRW_GENERIC_ERROR;
    }

    ringbuffer_get_iov(buf, RINGBUFFER_WRITE, iov);

    nr = conn->instance->io->v.v0.recvv(conn->instance->io, conn->sockfd, iov, 2);
    if (nr == -1) {
        switch (conn->instance->io->v.v0.error) {
        case EINTR:
            break;
        case EWOULDBLOCK:
#ifdef USE_EAGAIN
        case EAGAIN:
#endif
            return LCB_SOCKRW_WOULDBLOCK;
        default:
            return LCB_SOCKRW_IO_ERROR;
            return -1;
        }

    } else if (nr == 0) {
        lcb_assert((iov[0].iov_len + iov[1].iov_len) != 0);
        /* TODO stash error message somewhere
         * "Connection closed... we should resend to other nodes or reconnect!!" */
        return LCB_SOCKRW_SHUTDOWN;

    } else {
        ringbuffer_produced(buf, (lcb_size_t)nr);
    }

    return LCB_SOCKRW_READ;
}

lcb_sockrw_status_t lcb_sockrw_v0_slurp(lcb_connection_t conn, ringbuffer_t *buf)
{
    lcb_sockrw_status_t status;
    while ((status = lcb_sockrw_v0_read(conn, buf)) == LCB_SOCKRW_READ) {
        ;
    }
    return status;

}


lcb_sockrw_status_t lcb_sockrw_v0_write(lcb_connection_t conn,
                                        ringbuffer_t *buf)
{
    while (buf->nbytes > 0) {
        struct lcb_iovec_st iov[2];
        lcb_ssize_t nw;
        ringbuffer_get_iov(buf, RINGBUFFER_READ, iov);
        nw = conn->instance->io->v.v0.sendv(conn->instance->io, conn->sockfd, iov, 2);
        if (nw == -1) {
            switch (conn->instance->io->v.v0.error) {
            case EINTR:
                /* retry */
                break;
            case EWOULDBLOCK:
#ifdef USE_EAGAIN
            case EAGAIN:
#endif
                return LCB_SOCKRW_WOULDBLOCK;

            default:
                return LCB_SOCKRW_IO_ERROR;
            }
        } else if (nw > 0) {
            ringbuffer_consumed(buf, (lcb_size_t)nw);
        }
    }

    return LCB_SOCKRW_WROTE;
}

void lcb_sockrw_set_want(lcb_connection_t conn, short events, int clear_existing)
{

    if (clear_existing) {
        conn->want = events;
    } else {
        conn->want |= events;
    }
}

static void apply_want_v0(lcb_connection_t conn)
{
    lcb_io_opt_t io = conn->instance->io;

    if (!conn->want) {
        if (conn->evinfo.active) {
            conn->evinfo.active = 0;
            io->v.v0.delete_event(io, conn->sockfd, conn->evinfo.ptr);
        }
        return;
    }

    conn->evinfo.active = 1;
    io->v.v0.update_event(io,
                          conn->sockfd,
                          conn->evinfo.ptr,
                          conn->want,
                          conn->data,
                          conn->evinfo.handler);
}

static void apply_want_v1(lcb_connection_t conn)
{
    if (!conn->want) {
        return;
    }
    if (!conn->sockptr) {
        return;
    }
    if (conn->sockptr->closed) {
        return;
    }

    if (conn->want & LCB_READ_EVENT) {
        lcb_sockrw_v1_start_read(conn,
                                 &conn->input,
                                 conn->completion.read,
                                 conn->completion.error);
    }

    if (conn->want & LCB_WRITE_EVENT) {

        if (conn->output == NULL || conn->output->nbytes == 0) {
            return;
        }

        lcb_sockrw_v1_start_write(conn,
                                  &conn->output,
                                  conn->completion.write,
                                  conn->completion.error);
    }

}

void lcb_sockrw_apply_want(lcb_connection_t conn)
{
    if (conn->instance == NULL || conn->instance->io == NULL) {
        return;
    }
    if (conn->instance->io->version == 0) {
        apply_want_v0(conn);
    } else {
        apply_want_v1(conn);
    }

    if (conn->want) {
        lcb_connection_activate_timer(conn);
    }
}

int lcb_sockrw_flushed(lcb_connection_t conn)
{
    if (conn->instance->io->version == 1) {
        if (conn->output && conn->output->nbytes == 0) {
            return 1;
        } else {
            return 0;
        }
    } else {
        if (conn->output && conn->output->nbytes == 0) {
            return 1;
        }
    }
    return 0;
}

/**
 * Request a read of data into the buffer
 * @param conn the connection object
 * @param buf a ringbuffer structure. If the read request is successful,
 * the ringbuffer is destroyed. Its allocated data is owned by the IO plugin
 * for the duration of the operation. It may be restored via
 * ringbuffer_take_buffer once the operation has finished.
 */
lcb_sockrw_status_t lcb_sockrw_v1_start_read(lcb_connection_t conn,
                                             ringbuffer_t **buf,
                                             lcb_io_read_cb callback,
                                             lcb_io_error_cb error_callback)
{
    int ret;
    lcb_io_opt_t io;
    struct lcb_buf_info *bi = &conn->sockptr->read_buffer;

    if (conn->sockptr->is_reading) {
        return LCB_SOCKRW_PENDING;
    }

    ringbuffer_ensure_capacity(*buf,
                               conn->instance ? conn->instance->rbufsize :
                               LCB_DEFAULT_RBUFSIZE);
    ringbuffer_get_iov(*buf, RINGBUFFER_WRITE, bi->iov);

    lcb_assert(bi->ringbuffer == NULL);
    lcb_assert(bi->root == NULL);

    bi->ringbuffer = *buf;
    bi->root = bi->ringbuffer->root;

    *buf = NULL;


    io = conn->instance->io;
    ret = io->v.v1.start_read(io, conn->sockptr, callback);

    if (ret == 0) {
        conn->sockptr->is_reading = 1;
        return LCB_SOCKRW_PENDING;

    } else {
        *buf = bi->ringbuffer;
        memset(bi, 0, sizeof(*bi));
        if (error_callback) {
            io->v.v1.send_error(io, conn->sockptr, error_callback);
        }
    }

    return LCB_SOCKRW_IO_ERROR;
}

/**
 * Request that a write begin.
 * @param conn the connection object
 * @param buf a pointer to a ringbuffer_t*. If the write request is successful,
 * the IO system takes exclusive ownership of the buffer, and the contents
 * of *buf are zeroed.
 */
lcb_sockrw_status_t lcb_sockrw_v1_start_write(lcb_connection_t conn,
                                              ringbuffer_t **buf,
                                              lcb_io_write_cb callback,
                                              lcb_io_error_cb error_callback)
{
    int ret;
    lcb_io_opt_t io;
    lcb_io_writebuf_t *wbuf;
    struct lcb_buf_info *bi;

    io = conn->instance->io;

    wbuf = io->v.v1.create_writebuf(io, conn->sockptr);
    if (wbuf == NULL) {
        return LCB_SOCKRW_GENERIC_ERROR;
    }

    bi = &wbuf->buffer;

    bi->ringbuffer = *buf;
    bi->root = bi->ringbuffer->root;

    *buf = NULL;
    ringbuffer_get_iov(bi->ringbuffer, RINGBUFFER_READ, bi->iov);

    ret = io->v.v1.start_write(io, conn->sockptr, wbuf, callback);
    if (ret == 0) {
        return LCB_SOCKRW_PENDING;

    } else {
        *buf = bi->ringbuffer;
        memset(bi, 0, sizeof(*bi));
        io->v.v1.release_writebuf(io, conn->sockptr, wbuf);

        lcb_assert(error_callback);
        io->v.v1.send_error(io, conn->sockptr, error_callback);

        return LCB_SOCKRW_IO_ERROR;

    }
}

void lcb_sockrw_v1_onread_common(lcb_sockdata_t *sock,
                                 ringbuffer_t **dst,
                                 lcb_ssize_t nr)
{
    struct lcb_buf_info *bi = &sock->read_buffer;

    lcb_assert(*dst == NULL);

    *dst = bi->ringbuffer;
    memset(bi, 0, sizeof(*bi));

    sock->is_reading = 0;

    if (nr > 0) {
        ringbuffer_produced(*dst, nr);
    }

}

void lcb_sockrw_v1_onwrite_common(lcb_sockdata_t *sock,
                                  lcb_io_writebuf_t *wbuf,
                                  ringbuffer_t **dst)
{
    struct lcb_buf_info *bi = &wbuf->buffer;
    lcb_io_opt_t io = sock->parent;

    if (*dst) {
        lcb_assert(*dst != bi->ringbuffer);
        /**
         * We can't override the existing buffer, so just return
         */
        io->v.v1.release_writebuf(io, sock, wbuf);
        return;
    }

    *dst = bi->ringbuffer;
    ringbuffer_reset(*dst);

    bi->ringbuffer = NULL;
    bi->root = NULL;

    io->v.v1.release_writebuf(io, sock, wbuf);
    (void)sock;
}


unsigned int lcb_sockrw_v1_cb_common(lcb_sockdata_t *sock,
                                     lcb_io_writebuf_t *wbuf,
                                     void **datap)
{
    int is_closed;

    lcb_connection_t conn = sock->lcbconn;
    lcb_io_opt_t io = sock->parent;
    is_closed = sock->closed;

    if (is_closed) {
        if (wbuf) {
            io->v.v1.release_writebuf(io, sock, wbuf);
        }
        return 0;
    }

    if (datap && conn) {
        *datap = conn->data;
    }

    return 1;
}
