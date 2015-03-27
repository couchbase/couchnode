/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2014 Couchbase, Inc.
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

#include "internal.h"
#include "logging.h"
#include "vbucket/aliases.h"
#include "settings.h"
#include "negotiate.h"
#include "bucketconfig/clconfig.h"
#include "mc/mcreq-flush-inl.h"
#include <lcbio/ssl.h>
#include "ctx-log-inl.h"

#define LOGARGS(c, lvl) (c)->settings, "server", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGFMT "<%s:%s> (SRV=%p,IX=%d) "
#define LOGID(server) get_ctx_host(server->connctx), get_ctx_port(server->connctx), (void*)server, server->pipeline.index
#define MCREQ_MAXIOV 32
#define LCBCONN_UNWANT(conn, flags) (conn)->want &= ~(flags)

typedef enum {
    /* There are no known errored commands on this server */
    S_CLEAN,

    /* In the process of draining remaining commands to be flushed. The commands
     * being drained may have already been rescheduled to another server or
     * placed inside the error queue, but are pending being flushed. This will
     * only happen in completion-style I/O plugins. When this state is in effect,
     * subsequent attempts to connect will be blocked until all commands have
     * been properly drained.
     */
    S_ERRDRAIN,

    /* The server object has been closed, either because it has been removed
     * from the cluster or because the related lcb_t has been destroyed.
     */
    S_CLOSED
} mcserver_STATE;

static int check_closed(mc_SERVER *);
static void start_errored_ctx(mc_SERVER *server, mcserver_STATE next_state);
static void finalize_errored_ctx(mc_SERVER *server);
static void on_error(lcbio_CTX *ctx, lcb_error_t err);
static void server_socket_failed(mc_SERVER *server, lcb_error_t err);

static void
on_flush_ready(lcbio_CTX *ctx)
{
    mc_SERVER *server = lcbio_ctx_data(ctx);
    nb_IOV iov[MCREQ_MAXIOV];
    int ready;

    do {
        int niov = 0;
        unsigned nb;
        nb = mcreq_flush_iov_fill(&server->pipeline, iov, MCREQ_MAXIOV, &niov);
        if (!nb) {
            return;
        }
        ready = lcbio_ctx_put_ex(ctx, (lcb_IOV *)iov, niov, nb);
    } while (ready);
    lcbio_ctx_wwant(ctx);
}

static void
on_flush_done(lcbio_CTX *ctx, unsigned expected, unsigned actual)
{
    mc_SERVER *server = lcbio_ctx_data(ctx);
    mcreq_flush_done(&server->pipeline, actual, expected);
    check_closed(server);
}

void
mcserver_flush(mc_SERVER *server)
{
    /** Call into the wwant stuff.. */
    if (!server->connctx->rdwant) {
        lcbio_ctx_rwant(server->connctx, 24);
    }

    lcbio_ctx_wwant(server->connctx);
    lcbio_ctx_schedule(server->connctx);

    if (!lcbio_timer_armed(server->io_timer)) {
        /**
         * XXX: Maybe use get_next_timeout(), although here we can assume
         * that a command was just scheduled
         */
        lcbio_timer_rearm(server->io_timer, MCSERVER_TIMEOUT(server));
    }
}

LIBCOUCHBASE_API
void
lcb_sched_flush(lcb_t instance)
{
    unsigned ii;
    for (ii = 0; ii < LCBT_NSERVERS(instance); ii++) {
        mc_SERVER *server = LCBT_GET_SERVER(instance, ii);

        if (!mcserver_has_pending(server)) {
            continue;
        }
        server->pipeline.flush_start(&server->pipeline);
    }
}

/**
 * Invoked when get a NOT_MY_VBUCKET response. If the response contains a JSON
 * payload then we refresh the configuration with it.
 *
 * This function returns 1 if the operation was successfully rescheduled;
 * otherwise it returns 0. If it returns 0 then we give the error back to the
 * user.
 */
static int
handle_nmv(mc_SERVER *oldsrv, packet_info *resinfo, mc_PACKET *oldpkt)
{
    mc_PACKET *newpkt;
    protocol_binary_request_header hdr;
    lcb_error_t err = LCB_ERROR;
    lcb_t instance = oldsrv->instance;
    lcb_U16 vbid;
    int tmpix;
    clconfig_provider *cccp = lcb_confmon_get_provider(instance->confmon,
        LCB_CLCONFIG_CCCP);

    mcreq_read_hdr(oldpkt, &hdr);
    vbid = ntohs(hdr.request.vbucket);
    lcb_log(LOGARGS(oldsrv, WARN), LOGFMT "NOT_MY_VBUCKET. Packet=%p (S=%u). VBID=%u", LOGID(oldsrv), (void*)oldpkt, oldpkt->opaque, vbid);

    /* Notify of new map */
    tmpix = lcb_vbguess_remap(instance, vbid, oldsrv->pipeline.index);
    if (tmpix > -1 && tmpix != oldsrv->pipeline.index) {
        lcb_log(LOGARGS(oldsrv, TRACE), LOGFMT "Heuristically set IX=%d as master for VBID=%u", LOGID(oldsrv), tmpix, vbid);
    }

    if (PACKET_NBODY(resinfo) && cccp->enabled) {
        lcb_string s;

        lcb_string_init(&s);
        lcb_string_append(&s, PACKET_VALUE(resinfo), PACKET_NVALUE(resinfo));
        err = lcb_cccp_update(cccp, mcserver_get_host(oldsrv), &s);
        lcb_string_release(&s);
    }

    if (err != LCB_SUCCESS) {
        lcb_bootstrap_common(instance, LCB_BS_REFRESH_ALWAYS);
    }

    if (!lcb_should_retry(oldsrv->settings, oldpkt, LCB_NOT_MY_VBUCKET)) {
        return 0;
    }

    /** Reschedule the packet again .. */
    newpkt = mcreq_renew_packet(oldpkt);
    newpkt->flags &= ~MCREQ_STATE_FLAGS;
    lcb_retryq_nmvadd(instance->retryq, (mc_EXPACKET*)newpkt);
    return 1;
}

#define PKT_READ_COMPLETE 1
#define PKT_READ_PARTIAL 0

/* This function is called within a loop to process a single packet.
 *
 * If a full packet is available, it will process the packet and return
 * PKT_READ_COMPLETE, resulting in the `on_read()` function calling this
 * function in a loop.
 *
 * When a complete packet is not available, PKT_READ_PARTIAL will be returned
 * and the `on_read()` loop will exit, scheduling any required pending I/O.
 */
static int
try_read(lcbio_CTX *ctx, mc_SERVER *server, rdb_IOROPE *ior)
{
    packet_info info_s, *info = &info_s;
    mc_PACKET *request;
    mc_PIPELINE *pl = &server->pipeline;
    unsigned pktsize = 24, is_last = 1;

    #define RETURN_NEED_MORE(n) \
        if (mcserver_has_pending(server)) { \
            lcbio_ctx_rwant(ctx, n); \
        } \
        return PKT_READ_PARTIAL; \

    #define DO_ASSIGN_PAYLOAD() \
        rdb_consumed(ior, sizeof(info->res.bytes)); \
        if (PACKET_NBODY(info)) { \
            info->payload = rdb_get_consolidated(ior, PACKET_NBODY(info)); \
        } {

    #define DO_SWALLOW_PAYLOAD() \
        } if (PACKET_NBODY(info)) { \
            rdb_consumed(ior, PACKET_NBODY(info)); \
        }

    if (rdb_get_nused(ior) < pktsize) {
        RETURN_NEED_MORE(pktsize)
    }

    /* copy bytes into the info structure */
    rdb_copyread(ior, info->res.bytes, sizeof info->res.bytes);

    pktsize += PACKET_NBODY(info);
    if (rdb_get_nused(ior) < pktsize) {
        RETURN_NEED_MORE(pktsize);
    }

    /* Find the packet */
    if (PACKET_OPCODE(info) == PROTOCOL_BINARY_CMD_STAT && PACKET_NKEY(info) != 0) {
        is_last = 0;
        request = mcreq_pipeline_find(pl, PACKET_OPAQUE(info));
    } else {
        is_last = 1;
        request = mcreq_pipeline_remove(pl, PACKET_OPAQUE(info));
    }

    if (!request) {
        lcb_log(LOGARGS(server, WARN), LOGFMT "Found stale packet (OP=0x%x, RC=0x%x, SEQ=%u)", LOGID(server), PACKET_OPCODE(info), PACKET_STATUS(info), PACKET_OPAQUE(info));
        rdb_consumed(ior, pktsize);
        return PKT_READ_COMPLETE;
    }

    if (PACKET_STATUS(info) == PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET) {
        /* consume the header */
        DO_ASSIGN_PAYLOAD()
        if (!handle_nmv(server, info, request)) {
            mcreq_dispatch_response(pl, request, info, LCB_NOT_MY_VBUCKET);
        }
        DO_SWALLOW_PAYLOAD()
        goto GT_DONE;
    }

    /* Figure out if the request is 'ufwd' or not */
    if (!(request->flags & MCREQ_F_UFWD)) {
        DO_ASSIGN_PAYLOAD();
        info->bufh = rdb_get_first_segment(ior);
        mcreq_dispatch_response(pl, request, info, LCB_SUCCESS);
        DO_SWALLOW_PAYLOAD()

    } else {
        /* figure out how many buffers we want to use as an upper limit for the
         * IOV arrays. Currently we'll keep it simple and ensure the entire
         * response is contiguous. */
        lcb_PKTFWDRESP resp = { 0 };
        rdb_ROPESEG *segs;
        nb_IOV iov;

        rdb_consolidate(ior, pktsize);
        rdb_refread_ex(ior, &iov, &segs, 1, pktsize);

        resp.bufs = &segs;
        resp.iovs = (lcb_IOV*)&iov;
        resp.nitems = 1;
        resp.header = info->res.bytes;
        server->instance->callbacks.pktfwd(
            server->instance, MCREQ_PKT_COOKIE(request), LCB_SUCCESS, &resp);
        rdb_consumed(ior, pktsize);
    }

    GT_DONE:
    if (is_last) {
        mcreq_packet_handled(pl, request);
    }
    return PKT_READ_COMPLETE;
}

static void
on_read(lcbio_CTX *ctx, unsigned nb)
{
    int rv;
    mc_SERVER *server = lcbio_ctx_data(ctx);
    rdb_IOROPE *ior = &ctx->ior;

    if (check_closed(server)) {
        return;
    }

    while ((rv = try_read(ctx, server, ior)) == PKT_READ_COMPLETE);
    lcbio_ctx_schedule(ctx);
    lcb_maybe_breakout(server->instance);

    (void)nb;
}

LCB_INTERNAL_API
int
mcserver_has_pending(mc_SERVER *server)
{
    return !SLLIST_IS_EMPTY(&server->pipeline.requests);
}

static void flush_noop(mc_PIPELINE *pipeline) {
    (void)pipeline;
}
static void server_connect(mc_SERVER *server);

typedef enum {
    REFRESH_ALWAYS,
    REFRESH_ONFAILED,
    REFRESH_NEVER
} mc_REFRESHPOLICY;

static int
maybe_retry(mc_PIPELINE *pipeline, mc_PACKET *pkt, lcb_error_t err)
{
    mc_SERVER *srv = (mc_SERVER *)pipeline;
    mc_PACKET *newpkt;
    lcb_t instance = pipeline->parent->cqdata;
    lcbvb_DISTMODE dist_t = lcbvb_get_distmode(pipeline->parent->config);

    if (dist_t != LCBVB_DIST_VBUCKET) {
        /** memcached bucket */
        return 0;
    }
    if (!lcb_should_retry(srv->settings, pkt, err)) {
        return 0;
    }

    newpkt = mcreq_renew_packet(pkt);
    newpkt->flags &= ~MCREQ_STATE_FLAGS;
    lcb_retryq_add(instance->retryq, (mc_EXPACKET *)newpkt, err);
    return 1;
}

static void
fail_callback(mc_PIPELINE *pipeline, mc_PACKET *pkt, lcb_error_t err, void *arg)
{
    int rv;
    mc_SERVER *server = (mc_SERVER *)pipeline;
    packet_info info;
    protocol_binary_request_header hdr;
    protocol_binary_response_header *res = &info.res;

    if (maybe_retry(pipeline, pkt, err)) {
        return;
    }

    if (err == LCB_AUTH_ERROR) {
        /* In-situ auth errors are actually dead servers. Let's provide this
         * as the actual error code. */
        err = LCB_MAP_CHANGED;
    }

    if (err == LCB_ETIMEDOUT) {
        lcb_error_t tmperr = lcb_retryq_origerr(pkt);
        if (tmperr != LCB_SUCCESS) {
            err = tmperr;
        }
    }

    memset(&info, 0, sizeof(info));
    memcpy(hdr.bytes, SPAN_BUFFER(&pkt->kh_span), sizeof(hdr.bytes));

    res->response.status = ntohs(PROTOCOL_BINARY_RESPONSE_EINVAL);
    res->response.opcode = hdr.request.opcode;
    res->response.opaque = hdr.request.opaque;

    lcb_log(LOGARGS(server, WARN), LOGFMT "Failing command (pkt=%p, opaque=%lu, opcode=0x%x) with error 0x%x", LOGID(server), (void*)pkt, (unsigned long)pkt->opaque, hdr.request.opcode, err);
    rv = mcreq_dispatch_response(pipeline, pkt, &info, err);
    lcb_assert(rv == 0);
    (void)arg;
}

static int
purge_single_server(mc_SERVER *server, lcb_error_t error,
                    hrtime_t thresh, hrtime_t *next, int policy)
{
    unsigned affected;
    mc_PIPELINE *pl = &server->pipeline;

    if (thresh) {
        affected = mcreq_pipeline_timeout(
                pl, error, fail_callback, NULL, thresh, next);

    } else {
        mcreq_pipeline_fail(pl, error, fail_callback, NULL);
        affected = -1;
    }

    if (policy == REFRESH_NEVER) {
        return affected;
    }

    if (affected || policy == REFRESH_ALWAYS) {
        lcb_bootstrap_common(server->instance,
            LCB_BS_REFRESH_THROTTLE|LCB_BS_REFRESH_INCRERR);
    }
    return affected;
}

static void flush_errdrain(mc_PIPELINE *pipeline)
{
    /* Called when we are draining errors. */
    mc_SERVER *server = (mc_SERVER *)pipeline;
    if (!lcbio_timer_armed(server->io_timer)) {
        lcbio_timer_rearm(server->io_timer, MCSERVER_TIMEOUT(server));
    }
}

void
mcserver_fail_chain(mc_SERVER *server, lcb_error_t err)
{
    purge_single_server(server, err, 0, NULL, REFRESH_NEVER);
}


static uint32_t
get_next_timeout(mc_SERVER *server)
{
    hrtime_t now, expiry, diff;
    mc_PACKET *pkt = mcreq_first_packet(&server->pipeline);

    if (!pkt) {
        return MCSERVER_TIMEOUT(server);
    }

    now = gethrtime();
    expiry = MCREQ_PKT_RDATA(pkt)->start + LCB_US2NS(MCSERVER_TIMEOUT(server));
    if (expiry <= now) {
        diff = 0;
    } else {
        diff = expiry - now;
    }

    return LCB_NS2US(diff);
}

static void
timeout_server(void *arg)
{
    mc_SERVER *server = arg;
    hrtime_t now, min_valid, next_ns = 0;
    uint32_t next_us;
    int npurged;

    now = gethrtime();
    min_valid = now - LCB_US2NS(MCSERVER_TIMEOUT(server));
    npurged = purge_single_server(server,
        LCB_ETIMEDOUT, min_valid, &next_ns, REFRESH_ONFAILED);
    if (npurged) {
        lcb_log(LOGARGS(server, ERROR), LOGFMT "Server timed out. Some commands have failed", LOGID(server));
    }

    next_us = get_next_timeout(server);
    lcb_log(LOGARGS(server, DEBUG), LOGFMT "Scheduling next timeout for %u ms", LOGID(server), next_us / 1000);
    lcbio_timer_rearm(server->io_timer, next_us);
    lcb_maybe_breakout(server->instance);
}

static void
on_connected(lcbio_SOCKET *sock, void *data, lcb_error_t err, lcbio_OSERR syserr)
{
    mc_SERVER *server = data;
    lcbio_CTXPROCS procs;
    uint32_t tmo;
    mc_pSESSINFO sessinfo = NULL;
    LCBIO_CONNREQ_CLEAR(&server->connreq);

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(server, ERR), LOGFMT "Got error for connection! (OS=%d)", LOGID(server), syserr);
        server_socket_failed(server, err);
        return;
    }

    lcb_assert(sock);

    /** Do we need sasl? */
    sessinfo = mc_sess_get(sock);
    if (sessinfo == NULL) {
        mc_pSESSREQ sreq;
        lcb_log(LOGARGS(server, TRACE), "<%s:%s> (SRV=%p) Session not yet negotiated. Negotiating", server->curhost->host, server->curhost->port, (void*)server);
        sreq = mc_sessreq_start(sock, server->settings, MCSERVER_TIMEOUT(server),
            on_connected, data);
        LCBIO_CONNREQ_MKGENERIC(&server->connreq, sreq, mc_sessreq_cancel);
        return;
    } else {
        server->compsupport = mc_sess_chkfeature(sessinfo,
            PROTOCOL_BINARY_FEATURE_DATATYPE);
        server->synctokens = mc_sess_chkfeature(sessinfo,
            PROTOCOL_BINARY_FEATURE_MUTATION_SEQNO);
    }

    procs.cb_err = on_error;
    procs.cb_read = on_read;
    procs.cb_flush_done = on_flush_done;
    procs.cb_flush_ready = on_flush_ready;
    server->connctx = lcbio_ctx_new(sock, server, &procs);
    server->connctx->subsys = "memcached";
    server->pipeline.flush_start = (mcreq_flushstart_fn)mcserver_flush;

    tmo = get_next_timeout(server);
    lcb_log(LOGARGS(server, DEBUG), LOGFMT "Setting initial timeout=%ums", LOGID(server), tmo/1000);
    lcbio_timer_rearm(server->io_timer, get_next_timeout(server));
    mcserver_flush(server);
}

static void
server_connect(mc_SERVER *server)
{
    lcbio_pMGRREQ mr;
    mr = lcbio_mgr_get(server->instance->memd_sockpool, server->curhost,
                       MCSERVER_TIMEOUT(server), on_connected, server);
    LCBIO_CONNREQ_MKPOOLED(&server->connreq, mr);
    server->pipeline.flush_start = flush_noop;
    server->state = S_CLEAN;
}

static void
buf_done_cb(mc_PIPELINE *pl, const void *cookie, void *kbuf, void *vbuf)
{
    mc_SERVER *server = (mc_SERVER*)pl;
    server->instance->callbacks.pktflushed(server->instance, cookie);
    (void)kbuf; (void)vbuf;
}

static char *
dupstr_or_null(const char *s) {
    if (s) {
        return strdup(s);
    }
    return NULL;
}

mc_SERVER *
mcserver_alloc2(lcb_t instance, lcbvb_CONFIG* vbc, int ix)
{
    mc_SERVER *ret;
    lcbvb_SVCMODE mode;
    ret = calloc(1, sizeof(*ret));
    if (!ret) {
        return ret;
    }

    ret->instance = instance;
    ret->settings = instance->settings;
    ret->curhost = calloc(1, sizeof(*ret->curhost));
    mode = ret->settings->sslopts & LCB_SSL_ENABLED
            ? LCBVB_SVCMODE_SSL : LCBVB_SVCMODE_PLAIN;

    ret->datahost = dupstr_or_null(VB_MEMDSTR(vbc, ix, mode));
    ret->resthost = dupstr_or_null(VB_MGMTSTR(vbc, ix, mode));
    ret->viewshost = dupstr_or_null(VB_CAPIURL(vbc, ix, mode));

    lcb_settings_ref(ret->settings);
    mcreq_pipeline_init(&ret->pipeline);
    ret->pipeline.flush_start = (mcreq_flushstart_fn)server_connect;
    ret->pipeline.buf_done_callback = buf_done_cb;
    if (ret->datahost) {
        lcb_host_parsez(ret->curhost, ret->datahost, LCB_CONFIG_MCD_PORT);
    } else {
        lcb_log(LOGARGS(ret, DEBUG), LOGFMT "Server does not have data service", LOGID(ret));
    }
    ret->io_timer = lcbio_timer_new(instance->iotable, ret, timeout_server);
    return ret;
}

mc_SERVER *
mcserver_alloc(lcb_t instance, int ix)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    return mcserver_alloc2(instance, cq->config, ix);
}


static void
server_free(mc_SERVER *server)
{
    mcreq_pipeline_cleanup(&server->pipeline);

    if (server->io_timer) {
        lcbio_timer_destroy(server->io_timer);
    }

    free(server->resthost);
    free(server->viewshost);
    free(server->datahost);
    free(server->curhost);
    lcb_settings_unref(server->settings);
    free(server);
}

static void
close_cb(lcbio_SOCKET *sock, int reusable, void *arg)
{
    lcbio_ref(sock);
    lcbio_mgr_discard(sock);
    (void)reusable;(void)arg;
}


/**Marks any unflushed data inside this server as being already flushed. This
 * should be done within error handling. If subsequent data is flushed on this
 * pipeline to the same connection, the results are undefined. */
static void
release_unflushed_packets(mc_SERVER *server)
{
    unsigned toflush;
    nb_IOV iov;
    mc_PIPELINE *pl = &server->pipeline;
    while ((toflush = mcreq_flush_iov_fill(pl, &iov, 1, NULL))) {
        mcreq_flush_done(pl, toflush, toflush);
    }
}

static void
on_error(lcbio_CTX *ctx, lcb_error_t err)
{
    mc_SERVER *server = lcbio_ctx_data(ctx);
    lcb_log(LOGARGS(server, WARN), LOGFMT "Got socket error 0x%x", LOGID(server), err);
    if (check_closed(server)) {
        return;
    }
    server_socket_failed(server, err);
}

/**Handle a socket error. This function will close the current connection
 * and trigger a failout of any pending commands.
 * This function triggers a configuration refresh */
static void
server_socket_failed(mc_SERVER *server, lcb_error_t err)
{
    if (check_closed(server)) {
        return;
    }

    purge_single_server(server, err, 0, NULL, REFRESH_ALWAYS);
    lcb_maybe_breakout(server->instance);
    start_errored_ctx(server, S_ERRDRAIN);
}

void
mcserver_close(mc_SERVER *server)
{
    /* Should never be called twice */
    lcb_assert(server->state != S_CLOSED);
    start_errored_ctx(server, S_CLOSED);
}

/**
 * Call to signal an error or similar on the current socket.
 * @param server The server
 * @param next_state The next state (S_CLOSED or S_ERRDRAIN)
 */
static void
start_errored_ctx(mc_SERVER *server, mcserver_STATE next_state)
{
    lcbio_CTX *ctx = server->connctx;

    server->state = next_state;
    /* Cancel any pending connection attempt? */
    lcbio_connreq_cancel(&server->connreq);

    /* If the server is being destroyed, silence the timer */
    if (next_state == S_CLOSED && server->io_timer != NULL) {
        lcbio_timer_destroy(server->io_timer);
        server->io_timer = NULL;
    }

    if (ctx == NULL) {
        if (next_state == S_CLOSED) {
            server_free(server);
            return;
        } else {
            /* Not closed but don't have a current context */
            server->pipeline.flush_start = (mcreq_flushstart_fn)server_connect;
            if (mcserver_has_pending(server)) {
                if (!lcbio_timer_armed(server->io_timer)) {
                    /* TODO: Maybe throttle reconnection attempts? */
                    lcbio_timer_rearm(server->io_timer, MCSERVER_TIMEOUT(server));
                }
                server_connect(server);
            }
        }

    } else {
        if (ctx->npending) {
            /* Have pending items? */

            /* Flush any remaining events */
            lcbio_ctx_schedule(ctx);

            /* Close the socket not to leak resources */
            lcbio_shutdown(lcbio_ctx_sock(ctx));
            if (next_state == S_ERRDRAIN) {
                server->pipeline.flush_start = (mcreq_flushstart_fn)flush_errdrain;
            }
        } else {
            finalize_errored_ctx(server);
        }
    }
}

/**
 * This function actually finalizes a ctx which has an error on it. If the
 * ctx has pending operations remaining then this function returns immediately.
 * Otherwise this will either reinitialize the connection or free the server
 * object depending on the actual object state (i.e. if it was closed or
 * simply errored).
 */
static void
finalize_errored_ctx(mc_SERVER *server)
{
    if (server->connctx->npending) {
        return;
    }

    lcb_log(LOGARGS(server, DEBUG), LOGFMT "Finalizing ctx %p", LOGID(server), (void*)server->connctx);

    /* Always close the existing context. */
    lcbio_ctx_close(server->connctx, close_cb, NULL);
    server->connctx = NULL;

    /* And pretend to flush any outstanding data. There's nothing pending! */
    release_unflushed_packets(server);

    if (server->state == S_CLOSED) {
        /* If the server is closed, time to free it */
        server_free(server);
    } else {
        /* Otherwise, cycle the state back to CLEAN and reinit
         * the connection */
        server->state = S_CLEAN;
        server->pipeline.flush_start = (mcreq_flushstart_fn)server_connect;
        server_connect(server);
    }
}

/**
 * This little function checks to see if the server struct is still valid, or
 * whether it should just be cleaned once no pending I/O remainds.
 *
 * If this function returns false then the server is still valid; otherwise it
 * is invalid and must not be used further.
 */
static int
check_closed(mc_SERVER *server)
{
    if (server->state == S_CLEAN) {
        return 0;
    }
    lcb_log(LOGARGS(server, INFO), LOGFMT "Got handler after close. Checking pending calls", LOGID(server));
    finalize_errored_ctx(server);
    return 1;
}
