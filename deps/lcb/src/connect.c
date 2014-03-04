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
 * This file contains common connection routines for anything that requires
 * an outgoing TCP socket.
 *
 * @author Mark Nunberg
 */

#include "internal.h"
#include "logging.h"

static lcb_connection_result_t v0_connect(lcb_connection_t conn, int nocb, short events);
static lcb_connection_result_t v1_connect(lcb_connection_t conn, int nocb);
#define LOGARGS(conn, lvl) \
    conn->settings, "connection", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOG(conn, lvl, msg) lcb_log(LOGARGS(conn, lvl), msg)

struct lcb_ioconnect_st {
    /** Timer to use for connection */
    lcb_timer_t timer;
    lcb_connection_handler callback;
    struct addrinfo *ai;
    struct addrinfo *root_ai;
    lcb_error_t pending_err;
};

/**
 * This just wraps the connect routine again
 */
static void v0_reconnect_handler(lcb_socket_t sockfd, short which, void *data)
{
    v0_connect((struct lcb_connection_st *)data, 0, which);
    (void)which;
    (void)sockfd;
}

/**
 * Replaces the entry with the next addrinfo in the list of addrinfos.
 * Returns 0 on success, -1 on failure (i.e. no more AIs left)
 */
static int conn_next_ai(struct lcb_connection_st *conn)
{
    lcb_ioconnect_t ioconn = conn->ioconn;
    if (ioconn->ai == NULL || ioconn->ai->ai_next == NULL) {
        return -1;
    }

    ioconn->ai = ioconn->ai->ai_next;
    return 0;
}

/**
 * Do some basic connection failure handling. Cycles through the addrinfo
 * structures, and closes the socket. Returns 0 if there are more addrinfo
 * structures to try, -1 on error
 */
static int handle_conn_failure(struct lcb_connection_st *conn)
{
    lcb_ioconnect_t ioconn = conn->ioconn;
    conn->ioconn = NULL;

    /** This actually closes ioconn as well, so maintain it here */
    lcb_connection_close(conn);
    conn->ioconn = ioconn;

    if (conn_next_ai(conn) == 0) {
        conn->state = LCB_CONNSTATE_INPROGRESS;
        return 0;
    }

    return -1;
}

static void destroy_connstart(lcb_connection_t conn)
{
    if (!conn->ioconn) {
        return;
    }


    if (conn->ioconn->timer) {
        lcb_timer_destroy(NULL, conn->ioconn->timer);
    }

    if (conn->ioconn->root_ai) {
        freeaddrinfo(conn->ioconn->root_ai);
    }
    free(conn->ioconn);
    conn->ioconn = NULL;
}

/**
 * Helper function to invoke the completion callback with an error of some
 * sort
 */
static void conn_do_callback(struct lcb_connection_st *conn,
                             int nocb,
                             lcb_error_t err)
{
    lcb_connection_handler handler;
    if (nocb) {
        LOG(conn, DEBUG, "Not invoking event because nocb specified");
        return;
    }

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(conn, ERROR),
                "Connection=%p failedLCBERR=0x%x, OS Err=%d",
                conn, err, conn->last_error);
    }
    handler = conn->ioconn->callback;
    lcb_assert(handler != NULL);
    destroy_connstart(conn);
    lcb_sockrw_set_want(conn, 0, 1);
    lcb_sockrw_apply_want(conn);
    handler(conn, err);
}

static void connection_success(lcb_connection_t conn)
{
    lcb_log(LOGARGS(conn, INFO),
            "Connection=%p,%s:%s completed succesfully",
            conn, conn->cur_host_->host, conn->cur_host_->port);

    conn->state = LCB_CONNSTATE_CONNECTED;
    conn_do_callback(conn, 0, LCB_SUCCESS);
}

static void timeout_handler(lcb_timer_t tm, lcb_t instance, const void *cookie)
{
    lcb_connection_t conn = (lcb_connection_t)cookie;

    lcb_log(LOGARGS(conn, ERR),
            "%p: Connection to %s:%s timed out. Last OS Error=%d",
            conn, conn->cur_host_->host, conn->cur_host_->port,
            (int)conn->last_error);

    conn_do_callback(conn, 0, LCB_ETIMEDOUT);
    (void)tm;
    (void)instance;
}

/**
 * IOPS v0 connection routines. This is the standard select()/poll() model.
 * Returns a status indicating whether the connection has been scheduled
 * successfuly or not.
 */
static lcb_connection_result_t v0_connect(struct lcb_connection_st *conn,
                                          int nocb, short events)
{
    int retry;
    int retry_once = 0;
    int save_errno;
    lcb_connect_status_t connstatus;
    lcb_ioconnect_t ioconn = conn->ioconn;

    struct lcb_io_opt_st *io = conn->io;

    do {
        if (conn->sockfd == INVALID_SOCKET) {
            conn->sockfd = lcb_gai2sock(io, &ioconn->ai, &save_errno);
        }

        if (ioconn->ai == NULL) {
            conn->last_error = io->v.v0.error;

            lcb_log(LOGARGS(conn, WARN),
                    "%p, %s:%s No more addrinfo structures remaining",
                    (void *)conn,
                    conn->cur_host_->host,
                    conn->cur_host_->port);
            /* this means we're not going to retry!! add an error here! */
            return LCB_CONN_ERROR;
        }

        retry = 0;
        if (events & LCB_ERROR_EVENT) {
            socklen_t errlen = sizeof(int);
            int sockerr = 0;
            getsockopt(conn->sockfd,
                       SOL_SOCKET, SO_ERROR, (char *)&sockerr, &errlen);
            conn->last_error = sockerr;

        } else {
            if (io->v.v0.connect(io,
                                 conn->sockfd,
                                 ioconn->ai->ai_addr,
                                 (unsigned int)ioconn->ai->ai_addrlen) == 0) {
                /**
                 * Connected.
                 * XXX: In the odd event that this does connect immediately, we
                 * still enqueue it! - this is because we likely want to invoke some
                 * other callbacks after this, and we can't be sure that it's safe to
                 * do so until the event loop has control. Therefore we actually rely
                 * on EISCONN!.
                 * This isn't a whole lot of overhead as we shouldn't be connecting
                 * too much in the first place
                 */
                if (nocb) {
                    return LCB_CONN_INPROGRESS;

                } else {
                    connection_success(conn);
                    return LCB_CONN_CONNECTED;
                }
            } else {
                conn->last_error = io->v.v0.error;
            }
        }

        connstatus = lcb_connect_status(conn->last_error);
        switch (connstatus) {

        case LCB_CONNECT_EINTR:
            retry = 1;
            break;

        case LCB_CONNECT_EISCONN:
            connection_success(conn);
            return LCB_CONN_CONNECTED;

        case LCB_CONNECT_EINPROGRESS: /*first call to connect*/
            io->v.v0.update_event(io,
                                  conn->sockfd,
                                  conn->evinfo.ptr,
                                  LCB_WRITE_EVENT,
                                  conn, v0_reconnect_handler);
            conn->evinfo.active = 1;

            return LCB_CONN_INPROGRESS;

        case LCB_CONNECT_EALREADY: /* Subsequent calls to connect */
            return LCB_CONN_INPROGRESS;

        case LCB_CONNECT_EINVAL:
            if (!retry_once) {     /* First time get WSAEINVAL error - do retry */
                retry = 1;
                retry_once = 1;
                break;
            } else {               /* Second time get WSAEINVAL error - it is permanent error */
                retry_once = 0;    /* go to LCB_CONNECT_EFAIL brench (no break or return) */
            }

        case LCB_CONNECT_EFAIL:
        default:
            if (handle_conn_failure(conn) == -1) {
                conn_do_callback(conn, nocb, LCB_CONNECT_ERROR);
                return LCB_CONN_ERROR;
            }

            /* Try next AI */
            retry = 1;
            break;
        }
    } while (retry);

    lcb_assert("this statement shouldn't be reached" && 0);
    return LCB_CONN_ERROR;
}

static void v1_connect_handler(lcb_sockdata_t *sockptr, int status)
{
    lcb_connection_t conn = (lcb_connection_t)sockptr->lcbconn;
    if (!conn) {
        /* closed? */
        return;
    }
    if (status) {
        v1_connect(conn, 0);
    } else {
        connection_success(conn);
    }
}

static lcb_connection_result_t v1_connect(lcb_connection_t conn, int nocb)
{
    int save_errno;
    int rv;
    int retry = 1;
    int retry_once = 0;
    lcb_connect_status_t status;
    lcb_io_opt_t io = conn->io;
    lcb_ioconnect_t ioconn = conn->ioconn;

    do {

        if (!conn->sockptr) {
            conn->sockptr = lcb_gai2sock_v1(io, &ioconn->ai, &save_errno);
        }

        if (conn->sockptr) {
            conn->sockptr->lcbconn = conn;
            conn->sockptr->parent = io;
        } else {
            conn->last_error = io->v.v1.error;
            if (handle_conn_failure(conn) == -1) {
                conn_do_callback(conn, nocb, LCB_CONNECT_ERROR);
                return LCB_CONN_ERROR;
            }
        }

        rv = io->v.v1.start_connect(io,
                                    conn->sockptr,
                                    ioconn->ai->ai_addr,
                                    (unsigned int)ioconn->ai->ai_addrlen,
                                    v1_connect_handler);

        if (rv == 0) {
            return LCB_CONN_INPROGRESS;
        }

        status = lcb_connect_status(io->v.v1.error);
        switch (status) {

        case LCB_CONNECT_EINTR:
            retry = 1;
            break;

        case LCB_CONNECT_EISCONN:
            connection_success(conn);
            return LCB_CONN_CONNECTED;

        case LCB_CONNECT_EALREADY:
        case LCB_CONNECT_EINPROGRESS:
            return LCB_CONN_INPROGRESS;

        case LCB_CONNECT_EINVAL:
            /** TODO: do we still need this for v1? */
            conn->last_error = io->v.v1.error;
            if (!retry_once) {
                retry = 1;
                retry_once = 1;
                break;
            } else {
                retry_once = 0;
            }

        case LCB_CONNECT_EFAIL:
            conn->last_error = io->v.v1.error;
            if (handle_conn_failure(conn) == -1) {
                conn_do_callback(conn, nocb, LCB_CONNECT_ERROR);
                return LCB_CONN_ERROR;
            }
            break;

        default:
            conn->last_error = io->v.v1.error;
            return LCB_CONN_ERROR;

        }
    } while (retry);

    return LCB_CONN_ERROR;
}

static void async_error_callback(lcb_timer_t tm, lcb_t i, const void *cookie)
{
    lcb_connection_t conn = (lcb_connection_t)cookie;
    conn_do_callback(conn, 0, conn->ioconn->pending_err);
    (void)tm;
    (void)i;
}

static void setup_async_error(lcb_connection_t conn, lcb_error_t err)
{
    lcb_ioconnect_t ioconn = conn->ioconn;
    lcb_error_t dummy;

    if (ioconn->timer) {
        lcb_timer_destroy(NULL, ioconn->timer);
    }
    ioconn->pending_err = err;
    ioconn->timer = lcb_async_create(conn->io, conn, async_error_callback, &dummy);
}

lcb_connection_result_t lcb_connection_start(lcb_connection_t conn,
                                             const lcb_conn_params *params,
                                             lcb_connstart_opts_t options)
{
    lcb_connection_result_t result;
    lcb_io_opt_t io = conn->io;

    /** Basic sanity checking */
    lcb_assert(conn->state == LCB_CONNSTATE_UNINIT);
    lcb_assert(conn->ioconn == NULL);
    lcb_assert(params->destination);
    lcb_assert(params->handler);

    conn->state = LCB_CONNSTATE_INPROGRESS;

    lcb_log(LOGARGS(conn, INFO),
            "Starting connection (%p) to %s:%s", conn,
            params->destination->host,
            params->destination->port);

    conn->ioconn = calloc(1, sizeof(*conn->ioconn));
    conn->ioconn->callback = params->handler;

    if (!conn->cur_host_) {
        conn->cur_host_ = malloc(sizeof(*conn->cur_host_));
    }

    *conn->cur_host_ = *params->destination;

    if (params->timeout) {
        conn->ioconn->timer = lcb_timer_create_simple(io, conn,
                                                      params->timeout,
                                                      timeout_handler);
    }

    lcb_getaddrinfo(conn->settings,
                    params->destination->host,
                    params->destination->port,
                    &conn->ioconn->root_ai);

    if (!conn->ioconn->root_ai) {
        setup_async_error(conn, LCB_UNKNOWN_HOST);
    }

    conn->ioconn->ai = conn->ioconn->root_ai;

    if (io->version == 0) {
        if (!conn->evinfo.ptr) {
            conn->evinfo.ptr = io->v.v0.create_event(io);
        }
        result = v0_connect(conn, options & LCB_CONNSTART_NOCB, 0);

    } else {
        result = v1_connect(conn, options & LCB_CONNSTART_NOCB);
    }

    if (result != LCB_CONN_INPROGRESS) {
        lcb_log(LOGARGS(conn, INFO),
                "Scheduling connection for %p failed with code 0x%x",
                conn, result);

        if (options & LCB_CONNSTART_ASYNCERR) {
            setup_async_error(conn, LCB_CONNECT_ERROR);
            return LCB_CONN_INPROGRESS;
        }
    }

    return result;
}

void lcb_connection_close(lcb_connection_t conn)
{
    lcb_io_opt_t io;

    conn->state = LCB_CONNSTATE_UNINIT;
    destroy_connstart(conn);
    if (conn->io == NULL) {
        lcb_assert(conn->sockfd < 0 && conn->sockptr == NULL);
        return;
    }

    io = conn->io;
    if (io->version == 0) {
        if (conn->sockfd != INVALID_SOCKET) {
            if (conn->evinfo.ptr) {
                io->v.v0.delete_event(io, conn->sockfd, conn->evinfo.ptr);
            }
            io->v.v0.close(io, conn->sockfd);
            conn->sockfd = INVALID_SOCKET;
        }

    } else {

        if (conn->sockptr) {
            conn->sockptr->closed = 1;
            conn->sockptr->lcbconn = NULL;
            io->v.v1.close_socket(io, conn->sockptr);
            conn->sockptr = NULL;
        }
    }

    if (conn->input) {
        ringbuffer_reset(conn->input);
    }

    if (conn->output) {
        ringbuffer_reset(conn->output);
    }
}

int lcb_getaddrinfo(lcb_settings *settings, const char *hostname,
                    const char *servname, struct addrinfo **res)
{
    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_flags = AI_PASSIVE;
    hints.ai_socktype = SOCK_STREAM;
    switch (settings->ipv6) {
    case LCB_IPV6_DISABLED:
        hints.ai_family = AF_INET;
        break;
    case LCB_IPV6_ONLY:
        hints.ai_family = AF_INET6;
        break;
    default:
        hints.ai_family = AF_UNSPEC;
    }

    return getaddrinfo(hostname, servname, &hints, res);
}

void lcb_connection_cleanup(lcb_connection_t conn)
{

    destroy_connstart(conn);

    if (conn->protoctx) {
        conn->protoctx_dtor(conn->protoctx);
    }

    if (conn->input) {
        ringbuffer_destruct(conn->input);
        free(conn->input);
        conn->input = NULL;
    }

    if (conn->output) {
        ringbuffer_destruct(conn->output);
        free(conn->output);
        conn->output = NULL;
    }

    free(conn->cur_host_);
    conn->cur_host_ = NULL;

    lcb_connection_close(conn);

    if (conn->evinfo.ptr) {
        conn->io->v.v0.destroy_event(conn->io, conn->evinfo.ptr);
        conn->evinfo.ptr = NULL;
    }

    memset(conn, 0, sizeof(*conn));
    conn->sockfd = INVALID_SOCKET;
}

static lcb_error_t reset_buffer(ringbuffer_t **rb, lcb_size_t defsz)
{
    if (*rb) {
        ringbuffer_reset(*rb);
        return LCB_SUCCESS;
    }

    *rb = calloc(1, sizeof(**rb));

    if (*rb == NULL) {
        return LCB_CLIENT_ENOMEM;
    }

    if (!ringbuffer_initialize(*rb, defsz)) {
        return LCB_CLIENT_ENOMEM;
    }

    return LCB_SUCCESS;
}

lcb_error_t lcb_connection_reset_buffers(lcb_connection_t conn)
{
    if (reset_buffer(&conn->input, conn->settings->rbufsize) != LCB_SUCCESS) {
        return LCB_CLIENT_ENOMEM;
    }
    if (reset_buffer(&conn->output, conn->settings->wbufsize) != LCB_SUCCESS) {
        return LCB_CLIENT_ENOMEM;
    }
    return LCB_SUCCESS;
}


lcb_error_t lcb_connection_init(lcb_connection_t conn,
                                struct lcb_io_opt_st *io,
                                lcb_settings *settings)
{
    conn->io = io;
    conn->settings = settings;
    conn->sockfd = INVALID_SOCKET;
    conn->state = LCB_CONNSTATE_UNINIT;

    if (LCB_SUCCESS != lcb_connection_reset_buffers(conn)) {
        lcb_connection_cleanup(conn);
        return LCB_CLIENT_ENOMEM;
    }

    return LCB_SUCCESS;
}

void lcb_connection_use(lcb_connection_t conn, const struct lcb_io_use_st *use)
{
    struct lcb_io_use_st use_proxy;

    conn->data = use->udata;

    if (use->easy) {
        conn->easy.error = use->u.easy.err;
        conn->easy.read = use->u.easy.read;
        memset(&use_proxy, 0, sizeof(use_proxy));
        lcb__io_wire_easy(&use_proxy);
        use = &use_proxy;
    }

    conn->completion.error = use->u.ex.v1_error;
    conn->completion.read = use->u.ex.v1_read;
    conn->completion.write = use->u.ex.v1_write;
    conn->evinfo.handler = use->u.ex.v0_handler;

    lcb_assert(conn->completion.error);
    lcb_assert(conn->completion.read);
    lcb_assert(conn->completion.write);
    lcb_assert(conn->evinfo.handler);
}

void lcb_connuse_ex(struct lcb_io_use_st *use,
                    void *udata,
                    lcb_event_handler_cb v0_handler,
                    lcb_io_read_cb v1_read,
                    lcb_io_write_cb v1_write,
                    lcb_io_error_cb v1_error)
{
    lcb_assert(udata != NULL);
    lcb_assert(v0_handler != NULL);
    lcb_assert(v1_read != NULL);
    lcb_assert(v1_write != NULL);
    lcb_assert(v1_error != NULL);

    memset(use, 0, sizeof(*use));
    use->udata = udata;

    use->u.ex.v0_handler = v0_handler;
    use->u.ex.v1_read = v1_read;
    use->u.ex.v1_write = v1_write;
    use->u.ex.v1_error = v1_error;
}

void lcb_connuse_easy(struct lcb_io_use_st *use,
                      void *data,
                      lcb_io_generic_cb read_cb,
                      lcb_io_generic_cb err_cb)
{
    lcb_assert(data != NULL);
    lcb_assert(read_cb != NULL);
    lcb_assert(err_cb != NULL);

    use->easy = 1;
    use->u.easy.read = read_cb;
    use->u.easy.err = err_cb;
    use->udata = data;
}

LCB_INTERNAL_API
void lcb_connection_transfer_socket(lcb_connection_t from,
                                    lcb_connection_t to,
                                    const struct lcb_io_use_st *use)
{
    if (from == to) {
        return;
    }

    lcb_assert(to->state == LCB_CONNSTATE_UNINIT);
    lcb_assert(to->ioconn == NULL && from->ioconn == NULL);

    if (from->io->version == 0 && from->evinfo.active) {
        from->io->v.v0.delete_event(from->io, from->sockfd, from->evinfo.ptr);
        from->evinfo.active = 0;
    }

    to->io = from->io;
    to->settings = from->settings;

    to->evinfo.ptr = from->evinfo.ptr; from->evinfo.ptr = NULL;
    to->sockfd = from->sockfd; from->sockfd = INVALID_SOCKET;
    to->sockptr = from->sockptr; from->sockptr = NULL;
    to->protoctx = from->protoctx; from->protoctx = NULL;
    to->protoctx_dtor = from->protoctx_dtor; from->protoctx_dtor = NULL;
    to->last_error = from->last_error;
    to->state = from->state; from->state = LCB_CONNSTATE_UNINIT;
    to->cur_host_ = from->cur_host_; from->cur_host_ = NULL;
    to->poolinfo = from->poolinfo; from->poolinfo = NULL;

    if (to->sockptr) {
        to->sockptr->lcbconn = to;
    }

    lcb_connection_use(to, use);

}

const lcb_host_t * lcb_connection_get_host(const lcb_connection_t conn)
{
    static lcb_host_t dummy = { { '\0' }, { '\0' } };
    if (conn->cur_host_) {
        return conn->cur_host_;
    } else {
        return &dummy;
    }
}
