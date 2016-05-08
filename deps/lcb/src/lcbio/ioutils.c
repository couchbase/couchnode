/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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
#include <errno.h>
#endif

#include "connect.h"
#include "ioutils.h"
#include "hostlist.h"
#include "manager.h"
#include "iotable.h"
#include <stdio.h>
#include "ssl.h"

lcbio_CSERR
lcbio_mkcserr(int syserr)
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

void
lcbio_mksyserr(lcbio_OSERR in, lcbio_OSERR *out)
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

static lcb_error_t
ioerr2lcberr(lcbio_OSERR in, const lcb_settings *settings)
{
    switch (in) {
    case 0:
        return LCB_ESOCKSHUTDOWN;
    case ECONNREFUSED:
        return LCB_ECONNREFUSED;
    case ENETUNREACH:
    case EHOSTUNREACH:
    case EHOSTDOWN:
        return LCB_ENETUNREACH;
    case EMFILE:
    case ENFILE:
        return LCB_EFDLIMITREACHED;
    case EADDRINUSE:
    case EADDRNOTAVAIL:
        return LCB_ECANTGETPORT;
    case ECONNRESET:
    case ECONNABORTED:
        return LCB_ECONNRESET;
    default:
        lcb_log(settings, "lcbio", LCB_LOG_WARN, __FILE__, __LINE__, "FIXME: Unknown iops/os error code %d. Using NETWORK_ERROR", in);
        return LCB_NETWORK_ERROR;
    }
}

lcb_error_t
lcbio_mklcberr(lcbio_OSERR in, const lcb_settings *settings)
{
    if (settings->detailed_neterr == 0) {
        lcb_log(settings, "lcbio", LCB_LOG_INFO, __FILE__, __LINE__, "Translating errno=%d, lcb=0x%x to NETWORK_ERROR",
            in, ioerr2lcberr(in, settings));
        return LCB_NETWORK_ERROR;
    }

    return ioerr2lcberr(in, settings);
}

lcb_socket_t
lcbio_E_ai2sock(lcbio_TABLE *io, struct addrinfo **ai, int *connerr)
{
    lcb_socket_t ret = INVALID_SOCKET;
    *connerr = 0;

    for (; *ai; *ai = (*ai)->ai_next) {
        ret = IOT_V0IO(io).socket0(
                IOT_ARG(io), (*ai)->ai_family, (*ai)->ai_socktype,
                (*ai)->ai_protocol);

        if (ret != INVALID_SOCKET) {
            return ret;
        } else {
            *connerr = IOT_ERRNO(io);
        }
    }

    return ret;
}

lcb_sockdata_t *
lcbio_C_ai2sock(lcbio_TABLE *io, struct addrinfo **ai, int *connerr)
{
    lcb_sockdata_t *ret = NULL;
    for (; *ai; *ai = (*ai)->ai_next) {
        ret = IOT_V1(io).socket(
                IOT_ARG(io), (*ai)->ai_family, (*ai)->ai_socktype,
                (*ai)->ai_protocol);
        if (ret) {
            return ret;
        } else {
            *connerr = IOT_ERRNO(io);
        }
    }
    return ret;
}

struct nameinfo_common {
    char remote[NI_MAXHOST + NI_MAXSERV + 2];
    char local[NI_MAXHOST + NI_MAXSERV + 2];
};

static int
saddr_to_string(struct sockaddr *saddr, int len, char *buf, lcb_size_t nbuf)
{
    char h[NI_MAXHOST + 1];
    char p[NI_MAXSERV + 1];
    int rv;

    rv = getnameinfo(saddr, len, h, sizeof(h), p, sizeof(p),
                     NI_NUMERICHOST | NI_NUMERICSERV);
    if (rv < 0) {
        return 0;
    }

    if (snprintf(buf, nbuf, "%s;%s", h, p) < 0) {
        return 0;
    }

    return 1;
}

void
lcbio__load_socknames(lcbio_SOCKET *sock)
{
    int n_salocal, n_saremote, rv;
    struct lcb_nameinfo_st ni;
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

        if (ni.local.len == 0 || ni.remote.len == 0 || rv < 0) {
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
}

int
lcbio_get_nameinfo(lcbio_SOCKET *sock, struct lcbio_NAMEINFO *nistrs)
{
    lcbio_CONNINFO *info = sock->info;
    if (!info) {
        return 0;
    }
    if (!info->naddr) {
        return 0;
    }

    if (!saddr_to_string((struct sockaddr*)&info->sa_remote, info->naddr,
                         nistrs->remote, sizeof(nistrs->remote))) {
        return 0;
    }

    if (!saddr_to_string((struct sockaddr*)&info->sa_local, info->naddr,
                         nistrs->local, sizeof(nistrs->local))) {
        return 0;
    }

    return 1;
}

int
lcbio_is_netclosed(lcbio_SOCKET *sock, int flags)
{
    lcbio_pTABLE iot = sock->io;

    if (IOT_IS_EVENT(iot)) {
        return IOT_V0IO(iot).is_closed(IOT_ARG(iot), sock->u.fd, flags);
    } else {
        return IOT_V1(iot).is_closed(IOT_ARG(iot), sock->u.sd, flags);
    }
}

lcb_error_t
lcbio_disable_nagle(lcbio_SOCKET *s)
{
    lcbio_pTABLE iot = s->io;
    int val = 1, rv;
    int is_supp = ((IOT_IS_EVENT(iot) && IOT_V0IO(iot).cntl)) ||
            (!IOT_IS_EVENT(iot) && IOT_V1(iot).cntl);

    if (!is_supp) {
        return LCB_NOT_SUPPORTED;
    }

    if (IOT_IS_EVENT(iot)) {
        rv = IOT_V0IO(iot).cntl(IOT_ARG(iot), s->u.fd, LCB_IO_CNTL_SET,
            LCB_IO_CNTL_TCP_NODELAY, &val);
    } else {
        rv = IOT_V1(iot).cntl(IOT_ARG(iot), s->u.sd, LCB_IO_CNTL_SET,
            LCB_IO_CNTL_TCP_NODELAY, &val);
    }
    if (rv != 0) {
        return lcbio_mklcberr(IOT_ERRNO(iot), s->settings);
    } else {
        return LCB_SUCCESS;
    }
}

void
lcbio_connreq_cancel(lcbio_CONNREQ *req)
{
    if (!req->u.cs) {
        return;
    }

    if (req->type == LCBIO_CONNREQ_POOLED) {
        lcbio_mgr_cancel(req->u.preq);
    } else if (req->type == LCBIO_CONNREQ_RAW) {
        lcbio_connect_cancel(req->u.cs);
    } else {
        req->dtor(req->u.p_generic);
    }

    req->u.cs = NULL;
}

int
lcbio_ssl_supported(void)
{
#ifdef LCB_NO_SSL
    return 0;
#else
    return 1;
#endif
}

lcbio_pSSLCTX
lcbio_ssl_new__fallback(const char *ca, int noverify, lcb_error_t *errp,
    lcb_settings *settings)
{
    (void)ca; (void)noverify; (void)settings;
    if (errp) { *errp = LCB_CLIENT_FEATURE_UNAVAILABLE; }
    return NULL;
}


#ifdef LCB_NO_SSL
void lcbio_ssl_free(lcbio_pSSLCTX a) {
    (void)a;
}
lcb_error_t lcbio_ssl_apply(lcbio_SOCKET *a, lcbio_pSSLCTX b) {
    (void)a;(void)b;
    return LCB_CLIENT_FEATURE_UNAVAILABLE;
}
int lcbio_ssl_check(lcbio_SOCKET *s) {
    (void)s;
    return 0;
}
lcb_error_t lcbio_ssl_get_error(lcbio_SOCKET *s) {
    (void)s;
    return LCB_SUCCESS;
}
void lcbio_ssl_global_init(void) {
}
lcb_error_t lcbio_sslify_if_needed(lcbio_SOCKET *s, lcb_settings *st) {
    (void)s;(void)st;
    return LCB_SUCCESS;
}
#endif
