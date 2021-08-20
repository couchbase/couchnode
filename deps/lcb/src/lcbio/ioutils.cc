/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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

#ifndef _WIN32
#include <cerrno>
#endif

#include "connect.h"
#include "ioutils.h"
#include "hostlist.h"
#include "iotable.h"
#include "ssl.h"

lcbio_CSERR lcbio_mkcserr(int syserr)
{
    switch (syserr) {
        case 0:
            return LCBIO_CSERR_CONNECTED;

        case EINTR:
            return LCBIO_CSERR_INTR;

        case EWOULDBLOCK:
#ifdef USE_EAGAIN
        case EAGAIN:
#endif
        case EINPROGRESS:
        case EALREADY:
            return LCBIO_CSERR_BUSY;

        case EISCONN:
            return LCBIO_CSERR_CONNECTED;

#ifdef _WIN32
        case EINVAL:
            return LCBIO_CSERR_EINVAL;
#endif
        default:
            return LCBIO_CSERR_EFAIL;
    }
}

void lcbio_mksyserr(lcbio_OSERR in, lcbio_OSERR *out)
{
    switch (in) {
        case EINTR:
        case EWOULDBLOCK:
#ifdef USE_EAGAIN
        case EAGAIN:
#endif
        case EINVAL:
        case EINPROGRESS:
        case EISCONN:
        case EALREADY:
            return;
        default:
            *out = in;
            break;
    }
}

static lcb_STATUS ioerr2lcberr(lcbio_OSERR in, const lcb_settings *settings)
{
    switch (in) {
        case 0:
            return LCB_ERR_SOCKET_SHUTDOWN;
        case ECONNREFUSED:
            return LCB_ERR_CONNECTION_REFUSED;
        case ENETUNREACH:
        case EHOSTUNREACH:
        case EHOSTDOWN:
            return LCB_ERR_NODE_UNREACHABLE;
        case EMFILE:
        case ENFILE:
            return LCB_ERR_FD_LIMIT_REACHED;
        case EADDRINUSE:
        case EADDRNOTAVAIL:
            return LCB_ERR_CANNOT_GET_PORT;
        case ECONNRESET:
        case ECONNABORTED:
            return LCB_ERR_CONNECTION_RESET;
        default:
            lcb_log(settings, "lcbio", LCB_LOG_WARN, __FILE__, __LINE__,
                    "OS errno %d (%s) does not have a direct client error code equivalent. Using NETWORK_ERROR", in,
                    strerror(in));
            return LCB_ERR_NETWORK;
    }
}

lcb_STATUS lcbio_mklcberr(lcbio_OSERR in, const lcb_settings *settings)
{
    if (settings->detailed_neterr == 0) {
        lcb_log(settings, "lcbio", LCB_LOG_WARN, __FILE__, __LINE__, "Translating errno=%d (%s), %s to LCB_ERR_NETWORK",
                in, strerror(in), lcb_strerror_short(ioerr2lcberr(in, settings)));
        return LCB_ERR_NETWORK;
    }

    return ioerr2lcberr(in, settings);
}

lcb_socket_t lcbio_E_ai2sock(lcbio_TABLE *io, struct addrinfo **ai, int *connerr)
{
    lcb_socket_t ret = INVALID_SOCKET;
    *connerr = 0;

    for (; *ai; *ai = (*ai)->ai_next) {
        ret = io->E_socket(*ai);

        if (ret != INVALID_SOCKET) {
            return ret;
        } else {
            *connerr = io->get_errno();
        }
    }

    return ret;
}

lcb_sockdata_t *lcbio_C_ai2sock(lcbio_TABLE *io, struct addrinfo **ai, int *connerr)
{
    lcb_sockdata_t *ret = nullptr;
    for (; *ai; *ai = (*ai)->ai_next) {
        ret = io->C_socket(*ai);
        if (ret) {
            return ret;
        } else {
            *connerr = IOT_ERRNO(io);
        }
    }
    return ret;
}
static int saddr_to_host_and_port(struct sockaddr *saddr, int len, char *host, lcb_size_t nhost, char *port,
                                  lcb_size_t nport)
{
    return getnameinfo(saddr, len, host, nhost, port, nport, NI_NUMERICHOST | NI_NUMERICSERV);
}

static int saddr_to_string(struct sockaddr *saddr, int len, char *buf, lcb_size_t nbuf)
{
    char h[NI_MAXHOST + 1];
    char p[NI_MAXSERV + 1];
    int rv;

    rv = saddr_to_host_and_port(saddr, len, h, sizeof(h), p, sizeof(p));
    if (rv < 0) {
        return 0;
    }

    if (snprintf(buf, nbuf, "%s;%s", h, p) < 0) {
        return 0;
    }

    return 1;
}

static void lcbio_cache_local_name(lcbio_CONNINFO *sock)
{
    char addr_str[NI_MAXHOST + 1];
    switch (sock->sa_local.ss_family) {
        case AF_INET: {
            auto *addr = (struct sockaddr_in *)&sock->sa_local;
            inet_ntop(AF_INET, &(addr->sin_addr), addr_str, sizeof(addr_str));
            strncpy(sock->ep_local.host, addr_str, sizeof(sock->ep_local.host));
            snprintf(sock->ep_local.port, sizeof(sock->ep_local.port), "%d", (int)ntohs(addr->sin_port));
        } break;

        case AF_INET6: {
            auto *addr = (struct sockaddr_in6 *)&sock->sa_local;
            inet_ntop(AF_INET6, &(addr->sin6_addr), addr_str, sizeof(addr_str));
            strncpy(sock->ep_local.host, addr_str, sizeof(sock->ep_local.host));
            snprintf(sock->ep_local.port, sizeof(sock->ep_local.port), "%d", (int)ntohs(addr->sin6_port));
        } break;
    }
    snprintf(sock->ep_local_host_and_port, sizeof(sock->ep_local_host_and_port), "%s:%s", sock->ep_local.host,
             sock->ep_local.port);
}

void lcbio__load_socknames(lcbio_SOCKET *sock)
{
    int n_salocal, n_saremote, rv;
    struct lcb_nameinfo_st ni {
    };
    lcbio_CONNINFO *info = sock->info;

    n_salocal = sizeof(info->sa_local);
    n_saremote = sizeof(info->sa_remote);
    ni.local.name = (struct sockaddr *)&info->sa_local;
    ni.local.len = &n_salocal;
    ni.remote.name = (struct sockaddr *)&info->sa_remote;
    ni.remote.len = &n_saremote;

    if (!IOT_IS_EVENT(sock->io)) {
        if (!sock->u.sd) {
            return;
        }

        rv = IOT_V1(sock->io).nameinfo(IOT_ARG(sock->io), sock->u.sd, &ni);

        if (ni.local.len == nullptr || ni.remote.len == nullptr || rv < 0) {
            return;
        }

    } else {
        socklen_t sl_tmp = sizeof(info->sa_local);
        if (sock->u.fd == INVALID_SOCKET) {
            return;
        }

        rv = getsockname(sock->u.fd, ni.local.name, &sl_tmp);
        n_salocal = sl_tmp;
        if (rv < 0) {
            return;
        }
        rv = getpeername(sock->u.fd, ni.remote.name, &sl_tmp);
        n_saremote = sl_tmp;
        if (rv < 0) {
            return;
        }
    }
    info->naddr = n_salocal;
    lcbio_cache_local_name(info);
}

int lcbio_get_nameinfo(lcbio_SOCKET *sock, struct lcbio_NAMEINFO *nistrs)
{
    lcbio_CONNINFO *info = sock->info;
    if (!info) {
        return 0;
    }
    if (!info->naddr) {
        return 0;
    }

    if (!saddr_to_string((struct sockaddr *)&info->sa_remote, info->naddr, nistrs->remote, sizeof(nistrs->remote))) {
        return 0;
    }

    if (!saddr_to_string((struct sockaddr *)&info->sa_local, info->naddr, nistrs->local, sizeof(nistrs->local))) {
        return 0;
    }

    return 1;
}

int lcbio_is_netclosed(lcbio_SOCKET *sock, int flags)
{
    lcbio_pTABLE iot = sock->io;

    if (iot->is_E()) {
        return iot->E_check_closed(sock->u.fd, flags);
    } else {
        return iot->C_check_closed(sock->u.sd, flags);
    }
}

lcb_STATUS lcbio_enable_sockopt(lcbio_SOCKET *s, int cntl)
{
    lcbio_pTABLE iot = s->io;
    int rv;
    int value = 1;

    if (!iot->has_cntl()) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    if (iot->is_E()) {
        rv = iot->E_cntl(s->u.fd, LCB_IO_CNTL_SET, cntl, &value);
    } else {
        rv = iot->C_cntl(s->u.sd, LCB_IO_CNTL_SET, cntl, &value);
    }
    if (rv != 0) {
        return lcbio_mklcberr(IOT_ERRNO(iot), s->settings);
    } else {
        return LCB_SUCCESS;
    }
}

const char *lcbio_strsockopt(int cntl)
{
    switch (cntl) {
        case LCB_IO_CNTL_TCP_KEEPALIVE:
            return "TCP_KEEPALIVE";
        case LCB_IO_CNTL_TCP_NODELAY:
            return "TCP_NODELAY";
        default:
            return "FIXME: Unknown option";
    }
}

int lcbio_ssl_supported(void)
{
#ifdef LCB_NO_SSL
    return 0;
#else
    return 1;
#endif
}

lcbio_pSSLCTX lcbio_ssl_new__fallback(const char *, const char *, const char *, int, lcb_STATUS *errp, lcb_settings *)
{
    if (errp) {
        *errp = LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }
    return nullptr;
}

#ifdef LCB_NO_SSL
void lcbio_ssl_free(lcbio_pSSLCTX) {}
lcb_STATUS lcbio_ssl_apply(lcbio_SOCKET *, lcbio_pSSLCTX)
{
    return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
}
int lcbio_ssl_check(lcbio_SOCKET *)
{
    return 0;
}
lcb_STATUS lcbio_ssl_get_error(lcbio_SOCKET *)
{
    return LCB_SUCCESS;
}
void lcbio_ssl_global_init(void) {}
lcb_STATUS lcbio_sslify_if_needed(lcbio_SOCKET *, lcb_settings *)
{
    return LCB_SUCCESS;
}
#endif
