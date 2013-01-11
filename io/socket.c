/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "lcb_luv_internal.h"

lcb_socket_t lcb_luv_socket(struct lcb_io_opt_st *iops,
                            int domain,
                            int type,
                            int protocol)
{
    lcb_luv_socket_t newsock;
    iops->v.v0.error = EINVAL;

    if ((domain != AF_INET && domain != AF_INET6) ||
            type != SOCK_STREAM ||
            (protocol != IPPROTO_TCP && protocol != 0))  {
        log_socket_error("Bad arguments: domain=%d, type=%d, protocol=%d",
                         domain, type, protocol);
        return -1;
    }

    newsock = lcb_luv_socket_new(iops);
    if (newsock == NULL) {
        return -1;
    }

    return newsock->idx;
}

static void connect_cb(uv_connect_t *req, int status)
{
    lcb_luv_socket_t sock = (lcb_luv_socket_t)req->handle;
    struct lcb_luv_evstate_st *evstate = sock->evstate + LCB_LUV_EV_CONNECT;
    evstate->flags |= LCB_LUV_EVf_PENDING;
    log_socket_debug("Connection callback: status=%d", status);

    if (status) {
        /* Error */
        evstate->err =
            lcb_luv_errno_map((uv_last_error(sock->parent->loop)).code);
    } else {
        evstate->err = 0;
    }

    /* Since this is a write event on a socket, see if we should send the
     * callback
     */
    if (sock->event && (sock->event->lcb_events & LCB_WRITE_EVENT)) {
        log_socket_debug("Invoking libcouchbase write callback...");
        sock->event->lcb_cb(sock->idx, LCB_WRITE_EVENT, sock->event->lcb_arg);
    }

    lcb_luv_socket_unref(sock);
}

int lcb_luv_connect(struct lcb_io_opt_st *iops,
                    lcb_socket_t sock_i,
                    const struct sockaddr *saddr,
                    unsigned int saddr_len)
{
    int status, retval;
    lcb_luv_socket_t sock = lcb_luv_sock_from_idx(iops, sock_i);
    struct lcb_luv_evstate_st *evstate;

    if (sock == NULL) {
        iops->v.v0.error = EBADF;
        return -1;
    }


    evstate = sock->evstate + LCB_LUV_EV_CONNECT;

    /* Subsequent calls to connect() */
    if (EVSTATE_IS(evstate, ACTIVE)) {
        log_socket_trace("We were called again for connect()");
        if (EVSTATE_IS(evstate, PENDING)) {
            retval = evstate->err;
            if (retval) {
                iops->v.v0.error = retval;
                retval = -1;
            } else {
                evstate->flags |= LCB_LUV_EVf_CONNECTED;
                iops->v.v0.error = 0;
            }
            evstate->flags &= ~(LCB_LUV_EVf_PENDING);
        } else {
            retval = -1;
            if (EVSTATE_IS(evstate, CONNECTED)) {
                iops->v.v0.error = EISCONN;
            } else {
                iops->v.v0.error = EINPROGRESS;
            }
        }
        log_socket_trace("Returning %d for status", retval);
        return retval;
    }

    retval = -1;
    /* Else, first call to connect() */
    if (saddr_len == sizeof(struct sockaddr_in)) {
        status = uv_tcp_connect(&sock->u_req.connect, &sock->tcp,
                                *(struct sockaddr_in *)saddr, connect_cb);
    } else if (saddr_len == sizeof(struct sockaddr_in6)) {
        status = uv_tcp_connect6(&sock->u_req.connect, &sock->tcp,
                                 *(struct sockaddr_in6 *)saddr, connect_cb);
    } else {
        /* Neither AF_INET or AF_INET6 */
        iops->v.v0.error = EAFNOSUPPORT;
        return -1;
    }

    lcb_luv_socket_ref(sock);

    if (status == 0) {
        iops->v.v0.error = EINPROGRESS;
        evstate->flags |= LCB_LUV_EVf_ACTIVE;

    } else {
        iops->v.v0.error =
            lcb_luv_errno_map(
                (uv_last_error(IOPS_COOKIE(iops)->loop)).code);
    }
    return retval;
}

void lcb_luv_close(struct lcb_io_opt_st *iops, lcb_socket_t sock_i)
{
    /* Free a socket */
    lcb_luv_socket_t sock = lcb_luv_sock_from_idx(iops, sock_i);
    if (!sock) {
        log_socket_crit("Attempt to close already-closed socket. Abort");
        abort();
        iops->v.v0.error = EBADF;
        return;
    }

    lcb_luv_socket_deinit(sock);
}
