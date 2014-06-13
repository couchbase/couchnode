/**
 * This file contains the common bucket of routines necessary for interfacing
 * with OpenSSL.
 */
#include "ssl_iot_common.h"
#include "settings.h"
#include "logging.h"
#include <openssl/err.h>

#define LOGARGS(ssl, lvl) \
    ((lcbio_SOCKET*)SSL_get_app_data(ssl))->settings, "SSL", lvl, __FILE__, __LINE__
static char *global_event = "dummy event for ssl";

/******************************************************************************
 ******************************************************************************
 ** Boilerplate lcbio_TABLE Wrappers                                         **
 ******************************************************************************
 ******************************************************************************/
static void loop_run(lcb_io_opt_t io) {
    lcbio_XSSL *xs = IOTSSL_FROM_IOPS(io);
    IOT_START(xs->orig);
}
static void loop_stop(lcb_io_opt_t io) {
    lcbio_XSSL *xs = IOTSSL_FROM_IOPS(io);
    IOT_STOP(xs->orig);
}
static void *create_event(lcb_io_opt_t io) {
    (void)io;
    return global_event;
}
static void destroy_event(lcb_io_opt_t io, void *event) {
    (void) io; (void) event;
}
static void *create_timer(lcb_io_opt_t io) {
    lcbio_XSSL *xs = IOTSSL_FROM_IOPS(io);
    return xs->orig->timer.create(IOT_ARG(xs->orig));
}
static int schedule_timer(lcb_io_opt_t io, void *timer, lcb_uint32_t us,
    void *arg, lcb_ioE_callback callback) {
    lcbio_XSSL *xs = IOTSSL_FROM_IOPS(io);
    return xs->orig->timer.schedule(IOT_ARG(xs->orig), timer, us, arg, callback);
}
static void destroy_timer(lcb_io_opt_t io, void *timer) {
    lcbio_XSSL *xs = IOTSSL_FROM_IOPS(io);
    xs->orig->timer.destroy(IOT_ARG(xs->orig), timer);
}
static void cancel_timer(lcb_io_opt_t io, void *timer) {
    lcbio_XSSL *xs = IOTSSL_FROM_IOPS(io);
    xs->orig->timer.cancel(IOT_ARG(xs->orig), timer);
}

/******************************************************************************
 ******************************************************************************
 ** Common Routines for lcbio_TABLE Emulation                                **
 ******************************************************************************
 ******************************************************************************/
void
iotssl_init_common(lcbio_XSSL *xs, lcbio_TABLE *orig, SSL_CTX *sctx)
{
    lcbio_TABLE *base = &xs->base_;
    xs->iops_dummy_ = calloc(1, sizeof(*xs->iops_dummy_));
    xs->iops_dummy_->v.v0.cookie = xs;
    xs->orig = orig;
    base->model = xs->orig->model;
    base->p = xs->iops_dummy_;
    base->refcount = 1;
    base->loop.start = loop_run;
    base->loop.stop = loop_stop;
    base->timer.create = create_timer;
    base->timer.destroy = destroy_timer;
    base->timer.schedule = schedule_timer;
    base->timer.cancel = cancel_timer;

    if (orig->model == LCB_IOMODEL_EVENT) {
        base->u_io.v0.ev.create = create_event;
        base->u_io.v0.ev.destroy = destroy_event;
    }

    lcbio_table_ref(xs->orig);

    xs->error = 0;
    xs->ssl = SSL_new(sctx);

    xs->rbio = BIO_new(BIO_s_mem());
    xs->wbio = BIO_new(BIO_s_mem());

    SSL_set_bio(xs->ssl, xs->rbio, xs->wbio);
    SSL_set_read_ahead(xs->ssl, 0);

    /* Indicate that we are a client */
    SSL_set_connect_state(xs->ssl);
}

void
iotssl_destroy_common(lcbio_XSSL *xs)
{
    free(xs->iops_dummy_);
    SSL_free(xs->ssl);
    lcbio_table_unref(xs->orig);
}

void
iotssl_bm_reserve(BUF_MEM *bm)
{
    int oldlen;
    oldlen = bm->length;
    while (bm->max - bm->length < 4096) {
        /* there's also a BUF_MEM_grow_clean() but that actually clears the
         * used portion of the buffer */
        BUF_MEM_grow(bm, bm->max + 4096);
    }
    bm->length = oldlen;
}

void
iotssl_log_errors(lcbio_XSSL *xs)
{
    unsigned long curerr;
    while ((curerr = ERR_get_error())) {
        char errbuf[4096];
        ERR_error_string_n(curerr, errbuf, sizeof errbuf);
        lcb_log(LOGARGS(xs->ssl, LCB_LOG_ERROR), "%s", errbuf);
    }
}

int
iotssl_maybe_error(lcbio_XSSL *xs, int rv)
{
    assert(rv < 1);
    if (rv == -1) {
        int err = SSL_get_error(xs->ssl, rv);
        if (err == SSL_ERROR_WANT_READ || err == SSL_ERROR_WANT_WRITE) {
            /* this is ok. */
            return 0;
        }
    }
    iotssl_log_errors(xs);
    return -1;
}

/******************************************************************************
 ******************************************************************************
 ** Higher Level SSL_CTX Wrappers                                            **
 ******************************************************************************
 ******************************************************************************/
static void
log_callback(const SSL *ssl, int where, int ret)
{
    const char *retstr = "";
    lcbio_SOCKET *sock = SSL_get_app_data(ssl);
    if (where & SSL_CB_ALERT) {
        retstr = SSL_alert_type_string(ret);
    }
    lcb_log(LOGARGS(ssl, LCB_LOG_TRACE), "sock=%p: ST(0x%x). %s. R(0x%x)%s",
        (void*)sock, where, SSL_state_string_long(ssl), ret, retstr);
}

#if 0
static void
msg_callback(int write_p, int version, int ctype, const void *buf, size_t n,
    SSL *ssl, void *arg)
{
    printf("Got message (%s). V=0x%x. T=%d. N=%lu\n",
        write_p ? ">" : "<", version, ctype, n);
    (void)ssl; (void)arg; (void)buf;
}
#endif

struct lcbio_SSLCTX {
    SSL_CTX *ctx;
};

lcbio_pSSLCTX
lcbio_ssl_new(const char *cafile, int noverify)
{
    lcbio_pSSLCTX ret = calloc(1, sizeof(*ret));
    ret->ctx = SSL_CTX_new(SSLv3_client_method());
    assert(ret->ctx);

    if (cafile) {
        SSL_CTX_load_verify_locations(ret->ctx, cafile, NULL);
    }
    if (noverify) {
        SSL_CTX_set_verify(ret->ctx, SSL_VERIFY_NONE, NULL);
    } else {
        SSL_CTX_set_verify(ret->ctx, SSL_VERIFY_PEER, NULL);
    }

    SSL_CTX_set_info_callback(ret->ctx, log_callback);
    #if 0
    SSL_CTX_set_msg_callback(ret->ctx, msg_callback);
    #endif

    /* this will allow us to do SSL_write and use a different buffer if the
     * first one fails. This is helpful in the scenario where an initial
     * SSL_write() returns an SSL_ERROR_WANT_READ in the ssl_e.c plugin. In
     * such a scenario the correct behavior is to return EWOULDBLOCK. However
     * we have no guarantee that the next time we get a write request we would
     * be using the same buffer.
     */
    SSL_CTX_set_mode(ret->ctx, SSL_MODE_ACCEPT_MOVING_WRITE_BUFFER);
    return ret;
}

static void
noop_dtor(lcbio_PROTOCTX *arg) {
    free(arg);
}

lcb_error_t
lcbio_ssl_apply(lcbio_SOCKET *sock, lcbio_pSSLCTX sctx)
{
    lcbio_pTABLE old_iot = sock->io, new_iot;
    lcbio_PROTOCTX *sproto;

    if (old_iot->model == LCB_IOMODEL_EVENT) {
        new_iot = lcbio_Essl_new(old_iot, sock->u.fd, sctx->ctx);
    } else {
        new_iot = lcbio_Cssl_new(old_iot, sock->u.sd, sctx->ctx);
    }

    if (new_iot) {
        sproto = calloc(1, sizeof(*sproto));
        sproto->id = LCBIO_PROTOCTX_SSL;
        sproto->dtor = noop_dtor;
        lcbio_protoctx_add(sock, sproto);
        lcbio_table_unref(old_iot);
        sock->io = new_iot;
        /* just for logging */
        SSL_set_app_data(((lcbio_XSSL *)new_iot)->ssl, sock);
        return LCB_SUCCESS;

    } else {
        return LCB_ERROR;
    }
}

int
lcbio_ssl_check(lcbio_SOCKET *sock)
{
    return lcbio_protoctx_get(sock, LCBIO_PROTOCTX_SSL) != NULL;
}

void
lcbio_ssl_free(lcbio_pSSLCTX ctx)
{
    SSL_CTX_free(ctx->ctx);
    free(ctx);
}

/** TODO: Is this safe to call twice? */
static volatile int ossl_initialized = 0;
void lcbio_ssl_global_init(void)
{
    if (ossl_initialized) {
        return;
    }
    ossl_initialized = 1;
    SSL_library_init();
    SSL_load_error_strings();
}

lcb_error_t
lcbio_sslify_if_needed(lcbio_SOCKET *sock, lcb_settings *settings)
{
    if (!(settings->sslopts & LCB_SSL_ENABLED)) {
        return LCB_SUCCESS; /*not needed*/
    }
    if (lcbio_ssl_check(sock)) {
        return LCB_SUCCESS; /*already ssl*/
    }
    return lcbio_ssl_apply(sock, settings->ssl_ctx);
}
