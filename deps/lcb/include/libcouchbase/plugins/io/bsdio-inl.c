/**
 * Inline routines for common 'BSD'-style I/O for plugins.
 *
 * Include this file in your plugin and then call wire_lcb_bsd_impl on the
 * plugin instance.
 */

static void
wire_lcb_bsd_impl(lcb_io_opt_t io);

#ifdef _WIN32
#include "wsaerr-inl.c"
static int
get_wserr(lcb_socket_t sock)
{
    DWORD error = WSAGetLastError();
    int ext = 0;
    int len = sizeof(ext);

    /* Retrieves extended error status and clear */
    getsockopt(sock, SOL_SOCKET, SO_ERROR, (char *)&ext, &len);
    return wsaerr_map_impl(error);
}

static lcb_ssize_t
recvv_impl(lcb_io_opt_t iops, lcb_socket_t sock,
           struct lcb_iovec_st *iov, lcb_size_t niov)
{
    DWORD flags = 0, nr;
    WSABUF *bufptr = (WSABUF *)iov;

    if (WSARecv(sock, bufptr, niov, &nr, &flags, NULL, NULL) == SOCKET_ERROR) {
        iops->v.v0.error = get_wserr(sock);
        if (iops->v.v0.error == ECONNRESET) {
            return 0;
        }
        return -1;
    }

    (void)iops;
    return (lcb_ssize_t)nr;
}

static lcb_ssize_t
recv_impl(lcb_io_opt_t iops, lcb_socket_t sock, void *buf, lcb_size_t nbuf,
          int fl_unused)
{
    WSABUF iov;
    iov.len = nbuf;
    iov.buf = buf;
    (void)fl_unused;
    return recvv_impl(iops, sock, (struct lcb_iovec_st *)&iov, 1);
}

static lcb_ssize_t
sendv_impl(lcb_io_opt_t iops, lcb_socket_t sock, struct lcb_iovec_st *iov,
           lcb_size_t niov)
{
    DWORD nw, fl = 0;
    WSABUF *bufptr = (WSABUF *)iov;
    if (WSASend(sock, bufptr, niov, &nw, fl, NULL, NULL) == SOCKET_ERROR) {
        iops->v.v0.error = get_wserr(sock);
        return -1;
    }
    return (lcb_ssize_t)nw;
}

static lcb_ssize_t
send_impl(lcb_io_opt_t iops, lcb_socket_t sock, const void *buf, lcb_size_t nbuf,
          int flags)
{
    WSABUF iov;
    iov.buf = (void *)buf;
    iov.len = nbuf;
    (void)flags;
    return sendv_impl(iops, sock, (struct lcb_iovec_st *)&iov, 1);
}

#else
static lcb_ssize_t
recvv_impl(lcb_io_opt_t iops, lcb_socket_t sock, struct lcb_iovec_st *iov,
           lcb_size_t niov)
{
    struct msghdr mh;
    lcb_ssize_t ret;

    memset(&mh, 0, sizeof(mh));
    mh.msg_iov = (struct iovec *)iov;
    mh.msg_iovlen = niov;
    ret = recvmsg(sock, &mh, 0);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
    return ret;
}

static lcb_ssize_t
recv_impl(lcb_io_opt_t iops, lcb_socket_t sock, void *buf, lcb_size_t nbuf,
          int flags)
{
    lcb_ssize_t ret = recv(sock, buf, nbuf, flags);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
    return ret;
}

static lcb_ssize_t
sendv_impl(lcb_io_opt_t iops, lcb_socket_t sock, struct lcb_iovec_st *iov,
           lcb_size_t niov)
{
    struct msghdr mh;
    lcb_ssize_t ret;

    memset(&mh, 0, sizeof(mh));
    mh.msg_iov = (struct iovec *)iov;
    mh.msg_iovlen = niov;
    ret = sendmsg(sock, &mh, 0);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
    return ret;
}

static lcb_ssize_t
send_impl(lcb_io_opt_t iops, lcb_socket_t sock, const void *buf, lcb_size_t nbuf,
          int flags)
{
    lcb_ssize_t ret = send(sock, buf, nbuf, flags);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
    return ret;
}

#endif

static int make_socket_nonblocking(lcb_socket_t sock)
{
#ifdef _WIN32
    u_long nonblocking = 1;
    if (ioctlsocket(sock, FIONBIO, &nonblocking) == SOCKET_ERROR) {
        return -1;
    }
#else
    int flags;
    if ((flags = fcntl(sock, F_GETFL, NULL)) < 0) {
        return -1;
    }
    if (fcntl(sock, F_SETFL, flags | O_NONBLOCK) == -1) {
        return -1;
    }
#endif
    return 0;
}

static lcb_socket_t
socket_impl(lcb_io_opt_t iops, int domain, int type, int protocol)
{
    lcb_socket_t sock;
#ifdef _WIN32
    sock = (lcb_socket_t)WSASocket(domain, type, protocol, NULL, 0, 0);
#else
    sock = socket(domain, type, protocol);
#endif
    if (sock == INVALID_SOCKET) {
        iops->v.v0.error = errno;
    } else {
        if (make_socket_nonblocking(sock) != 0) {
#ifdef _WIN32
            iops->v.v0.error = get_wserr(sock);
#else
            iops->v.v0.error = errno;
#endif
            iops->v.v0.close(iops, sock);
            sock = INVALID_SOCKET;
        }
    }
    return sock;
}

static void
close_impl(lcb_io_opt_t iops, lcb_socket_t sock)
{
    (void)iops;
#ifdef _WIN32
    closesocket(sock);
#else
    close(sock);
#endif
}

static int
connect_impl(lcb_io_opt_t iops, lcb_socket_t sock, const struct sockaddr *name,
             unsigned int namelen)
{
    int ret;

#ifdef _WIN32
    ret = WSAConnect(sock, name, (int)namelen, NULL, NULL, NULL, NULL);
    if (ret == SOCKET_ERROR) {
        iops->v.v0.error = get_wserr(sock);
    }
#else
    ret = connect(sock, name, (socklen_t)namelen);
    if (ret < 0) {
        iops->v.v0.error = errno;
    }
#endif
    return ret;
}

static void
wire_lcb_bsd_impl(lcb_io_opt_t io)
{
    io->v.v0.recv = recv_impl;
    io->v.v0.recvv = recvv_impl;
    io->v.v0.send = send_impl;
    io->v.v0.sendv = sendv_impl;
    io->v.v0.socket = socket_impl;
    io->v.v0.connect = connect_impl;
    io->v.v0.close = close_impl;
}
