/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "lcb_luv_internal.h"

uv_buf_t alloc_cb(uv_handle_t *handle, size_t suggested_size)
{
    lcb_luv_socket_t sock = (lcb_luv_socket_t)handle;
    (void)suggested_size;
    return sock->read.buf;
}

void read_cb(uv_stream_t *stream, ssize_t nread, uv_buf_t buf)
{
    /* This is the same buffer structure we had before */
    lcb_luv_socket_t sock = (lcb_luv_socket_t)stream;
    int is_stopped = 0;
    (void)buf;

    lcb_luv_socket_ref(sock);
    log_read_debug("%d: nr=%d, len=%d", sock->idx, nread, buf.len);

    if (nread == -1) {
        uv_err_t last_err = uv_last_error(sock->parent->loop);
        if (last_err.code == UV_EOF) {
            sock->eof = 1;
        } else {
            sock->evstate[LCB_LUV_EV_READ].err =
                lcb_luv_errno_map(last_err.code);
        }
        lcb_luv_read_stop(sock);
    } else if (nread) {
        sock->read.buf.len -= nread;
        sock->read.buf.base += (size_t)nread;
        sock->read.nb += nread;

        /* We don't have any more space */
        if (!sock->read.buf.len) {
            lcb_luv_read_stop(sock);
        }
    } else {
        /* nread == 0 */
        goto GT_RET;
    }

    sock->evstate[LCB_LUV_EV_READ].flags |= LCB_LUV_EVf_PENDING;
    if (sock->event && (sock->event->lcb_events & LCB_READ_EVENT)) {
        sock->event->lcb_cb(sock->idx, LCB_READ_EVENT,
                            sock->event->lcb_arg);
    }

GT_RET:
    if (is_stopped) {
        lcb_luv_socket_unref(sock);
    }
    lcb_luv_socket_unref(sock);
}

void lcb_luv_read_nudge(lcb_luv_socket_t sock)
{
    int status;
    if (sock->read.readhead_active) {
        log_read_trace("Read-ahead already active");
        return; /* nothing to do here */
    }

    status = uv_read_start((uv_stream_t *)&sock->tcp, alloc_cb, read_cb);

    if (status) {
        sock->evstate[LCB_LUV_EV_READ].err =
            lcb_luv_errno_map(
                (uv_last_error(sock->parent->loop)).code);
        log_read_error("Couldn't start read: %d",
                       sock->evstate[LCB_LUV_EV_READ].err);
    } else {
        log_read_debug("read-ahead initialized");
        sock->read.buf.len = LCB_LUV_READAHEAD;
        sock->read.buf.base = sock->read.data;
        lcb_luv_socket_ref(sock);
        sock->read.readhead_active = 1;
    }
}

void lcb_luv_read_stop(lcb_luv_socket_t sock)
{
    if (sock->read.readhead_active == 0) {
        return;
    }
    uv_read_stop((uv_stream_t *)&sock->tcp);
    sock->read.readhead_active = 0;
    lcb_luv_socket_unref(sock);
}


static lcb_ssize_t read_common(lcb_luv_socket_t sock,
                               void *buffer,
                               lcb_size_t len,
                               int *errno_out)
{
    struct lcb_luv_evstate_st *evstate = sock->evstate + LCB_LUV_EV_READ;
    lcb_ssize_t ret;
    size_t read_offset, toRead;

    log_read_debug("%d: Requested to read %d bytes. have %d",
                   sock->idx, len, sock->read.nb);


    /* basic error checking */
    if (evstate->err) {
        *errno_out = evstate->err;
        evstate->err = 0;
        return -1;
    }

    if (sock->eof) {
        return 0;
    }

    /* Check how much data we can send back, and where do we read from */
    toRead = MINIMUM(len, sock->read.nb);
    read_offset = sock->read.pos;

    /* copy the data */
    if (toRead) {
        memcpy(buffer, sock->read.data + read_offset, toRead);
        ret = toRead;
        *errno_out = 0;
    } else {
        *errno_out = EWOULDBLOCK;
        ret = -1;
    }

    /**
     * Buffer positioning is somewhat complicated. If we are in middle
     * of a partial read (readahead is active), then the next bytes
     * will still happen from within the position of our current
     * buffer, so we want to maintain our position.
     *
     * On the other hand, if readahead is not active, then the next
     * read will begin from the beginning of the buffer
     */
    sock->read.nb -= toRead;
    sock->read.pos += toRead;

    if (sock->read.nb == 0 && sock->read.readhead_active == 0) {
        sock->read.pos = 0;
    }


    if (toRead < len) {
        evstate->flags &= ~(LCB_LUV_EVf_PENDING);
        lcb_luv_read_nudge(sock);
    }

    return ret;
}

lcb_ssize_t lcb_luv_recv(struct lcb_io_opt_st *iops,
                         lcb_socket_t sock_i,
                         void *buffer,
                         lcb_size_t len,
                         int flags)
{
    lcb_luv_socket_t sock = lcb_luv_sock_from_idx(iops, sock_i);
    (void)flags;
    if (sock == NULL) {
        iops->v.v0.error = EBADF;
        return -1;
    }

    return read_common(sock, buffer, len, &iops->v.v0.error);
}

lcb_ssize_t lcb_luv_recvv(struct lcb_io_opt_st *iops,
                          lcb_socket_t sock_i,
                          struct lcb_iovec_st *iov,
                          lcb_size_t niov)
{
    lcb_ssize_t nr = 0, iret = -1;
    lcb_size_t ii;
    int my_errno;
    lcb_luv_socket_t sock = lcb_luv_sock_from_idx(iops, sock_i);

    if (sock == NULL) {
        iops->v.v0.error = EBADF;
        return -1;
    }

    for (ii = 0; ii < niov; ii++) {
        if (iov[ii].iov_len == 0) {
            break;
        }
        iret = read_common(sock, iov[ii].iov_base, iov[ii].iov_len, &my_errno);
        if (iret > 0) {
            nr += iret;
        } else {
            break;
        }
    }
    if (!nr) {
        iops->v.v0.error = my_errno;
        return -1;
    } else {
        return nr;
    }
}
