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
static lcb_connection_result_t v0_connect(lcb_connection_t conn, int nocb, short events);
static lcb_connection_result_t v1_connect(lcb_connection_t conn, int nocb);

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
    if (conn->curr_ai == NULL || conn->curr_ai->ai_next == NULL) {
        return -1;
    }
    conn->curr_ai = conn->curr_ai->ai_next;
    return 0;
}

/**
 * Do some basic connection failure handling. Cycles through the addrinfo
 * structures, and closes the socket. Returns 0 if there are more addrinfo
 * structures to try, -1 on error
 */
static int handle_conn_failure(struct lcb_connection_st *conn)
{
    /** Reset the state */
    lcb_connection_close(conn);

    if (conn_next_ai(conn) == 0) {
        conn->state = LCB_CONNSTATE_INPROGRESS;
        return 0;
    }

    return -1;
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
        return;
    }

    handler = conn->on_connect_complete;
    if (!handler) {
        return;
    }
    conn->on_connect_complete = NULL;
    handler(conn, err);
}

static void connection_success(lcb_connection_t conn)
{
    lcb_connection_cancel_timer(conn);
    conn->state = LCB_CONNSTATE_CONNECTED;
    conn_do_callback(conn, 0, LCB_SUCCESS);
}

/**
 * This is called when we still 'own' the timer. This dispatches
 * to the generic timeout handler
 */
static void initial_connect_timeout_handler(lcb_socket_t sock,
                                            short which,
                                            void *arg)
{
    lcb_connection_t conn = (lcb_connection_t)arg;
    lcb_connection_close(conn);
    conn_do_callback(conn, 0, LCB_ETIMEDOUT);
    (void)which;
    (void)sock;
}

/**
 * This is called for the user-defined timeout handler
 */
static void timeout_handler_dispatch(lcb_socket_t sock,
                                     short which,
                                     void *arg)
{
    lcb_connection_t conn = (lcb_connection_t)arg;
    int was_active = conn->timeout.active;

    lcb_connection_cancel_timer(conn);

    if (was_active && conn->on_timeout) {
        lcb_connection_handler handler = conn->on_timeout;
        handler(conn, LCB_ETIMEDOUT);
    }

    (void)which;
    (void)sock;
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

    struct lcb_io_opt_st *io = conn->instance->io;

    do {
        if (conn->sockfd == INVALID_SOCKET) {
            conn->sockfd = lcb_gai2sock(conn->instance,
                                        &conn->curr_ai,
                                        &save_errno);
        }

        if (conn->curr_ai == NULL) {
            conn->last_error = io->v.v0.error;

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
                                 conn->curr_ai->ai_addr,
                                 (unsigned int)conn->curr_ai->ai_addrlen) == 0) {
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
    lcb_io_opt_t io = conn->instance->io;

    do {

        if (!conn->sockptr) {
            conn->sockptr = lcb_gai2sock_v1(conn->instance,
                                            &conn->curr_ai,
                                            &save_errno);
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
                                    conn->curr_ai->ai_addr,
                                    (unsigned int)conn->curr_ai->ai_addrlen,
                                    v1_connect_handler);

        if (rv == 0) {
            if (nocb) {
                return LCB_CONN_INPROGRESS;
            }
            connection_success(conn);
            return LCB_CONN_CONNECTED;
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

lcb_connection_result_t lcb_connection_start(lcb_connection_t conn,
                                             lcb_connstart_opts_t options)
{
    lcb_connection_result_t result;
    lcb_io_opt_t io = conn->instance->io;

    lcb_assert(conn->state == LCB_CONNSTATE_UNINIT);
    conn->state = LCB_CONNSTATE_INPROGRESS;

    if (conn->instance->io->version == 0) {
        if (!conn->evinfo.ptr) {
            conn->evinfo.ptr = io->v.v0.create_event(io);
        }
        result = v0_connect(conn, options & LCB_CONNSTART_NOCB, 0);

    } else {
        result = v1_connect(conn, options & LCB_CONNSTART_NOCB);
    }


    if (result == LCB_CONN_INPROGRESS) {
        if (conn->timeout.usec) {
            io->v.v0.update_timer(io,
                                  conn->timeout.timer, conn->timeout.usec,
                                  conn, initial_connect_timeout_handler);
            conn->timeout.active = 1;
        }

    } else if (result != LCB_CONN_CONNECTED) {
        if (options & LCB_CONNSTART_ASYNCERR) {
            if (io->version == 0) {
                if (conn->timeout.active) {
                    io->v.v0.delete_timer(io, conn->timeout.timer);
                }
                io->v.v0.update_timer(io, conn->timeout.timer, 0,
                                      conn, initial_connect_timeout_handler);
            } else {
                lcb_assert(io->version == 1);
                io->v.v1.send_error(io, conn->sockptr, conn->completion.error);
            }
        }
    }
    return result;
}

void lcb_connection_close(lcb_connection_t conn)
{
    lcb_io_opt_t io;

    conn->state = LCB_CONNSTATE_UNINIT;

    if (conn->instance == NULL || conn->instance->io == NULL) {
        lcb_assert(conn->sockfd < 0 && conn->sockptr == NULL);
        return;
    }

    io = conn->instance->io;
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

int lcb_getaddrinfo(lcb_t instance, const char *hostname,
                    const char *servname, struct addrinfo **res)
{
    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_flags = AI_PASSIVE;
    hints.ai_socktype = SOCK_STREAM;
    switch (instance->ipv6) {
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


int lcb_connection_getaddrinfo(lcb_connection_t conn, int refresh)
{
    int ret;
    if (conn->ai && refresh) {
        freeaddrinfo(conn->ai);
    }

    conn->ai = NULL;
    conn->curr_ai = NULL;

    ret = lcb_getaddrinfo(conn->instance,
                          conn->host,
                          conn->port,
                          &conn->ai);
    if (ret == 0) {
        conn->curr_ai = conn->ai;
    }
    return ret;
}

void lcb_connection_cleanup(lcb_connection_t conn)
{
    if (conn->ai) {
        freeaddrinfo(conn->ai);
        conn->ai = NULL;
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

    lcb_connection_close(conn);

    if (conn->evinfo.ptr) {
        conn->instance->io->v.v0.destroy_event(conn->instance->io,
                                               conn->evinfo.ptr);
        conn->evinfo.ptr = NULL;
    }

    lcb_connection_cancel_timer(conn);

    if (conn->timeout.timer) {
        conn->instance->io->v.v0.destroy_timer(conn->instance->io,
                                               conn->timeout.timer);
    }

    memset(conn, 0, sizeof(*conn));
}

void lcb_connection_cancel_timer(lcb_connection_t conn)
{
    if (!conn->timeout.active) {
        return;
    }
    conn->timeout.active = 0;
    conn->instance->io->v.v0.delete_timer(conn->instance->io,
                                          conn->timeout.timer);
}

void lcb_connection_activate_timer(lcb_connection_t conn)
{
    if (conn->timeout.active || conn->timeout.usec == 0) {
        return;
    }

    conn->timeout.active = 1;
    conn->instance->io->v.v0.update_timer(conn->instance->io,
                                          conn->timeout.timer,
                                          conn->timeout.usec,
                                          conn,
                                          timeout_handler_dispatch);
}

void lcb_connection_delay_timer(lcb_connection_t conn)
{
    lcb_connection_cancel_timer(conn);
    lcb_connection_activate_timer(conn);
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
    if (reset_buffer(&conn->input, conn->instance->rbufsize) != LCB_SUCCESS) {
        return LCB_CLIENT_ENOMEM;
    }
    if (reset_buffer(&conn->output, conn->instance->wbufsize) != LCB_SUCCESS) {
        return LCB_CLIENT_ENOMEM;
    }
    return LCB_SUCCESS;
}


lcb_error_t lcb_connection_init(lcb_connection_t conn, lcb_t instance)
{
    conn->instance = instance;

    conn->sockfd = INVALID_SOCKET;
    conn->state = LCB_CONNSTATE_UNINIT;
    conn->timeout.timer = instance->io->v.v0.create_timer(instance->io);

    if (LCB_SUCCESS != lcb_connection_reset_buffers(conn)) {
        lcb_connection_cleanup(conn);
        return LCB_CLIENT_ENOMEM;
    }
    if (conn->timeout.timer == NULL) {
        lcb_connection_cleanup(conn);
        return LCB_CLIENT_ENOMEM;
    }

    return LCB_SUCCESS;
}
