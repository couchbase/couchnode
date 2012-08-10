#include "lcb_luv_internal.h"

static int _yolog_initialized = 0;

static void __attribute__((unused))
lcb_luv_noop(struct libcouchbase_io_opt_st *iops)
{
    (void)iops;
}

static void
lcb_luv_dtor(struct libcouchbase_io_opt_st *iops)
{
    /**
     * First, clean up any dangling sockets
     */
    int ii;
    struct lcb_luv_cookie_st *cookie = IOPS_COOKIE(iops);
    uv_loop_t *l = cookie->loop;

    for (ii = 0; ii < cookie->fd_max; ii++) {
        if (cookie->socktable[ii]) {
            log_iops_warn("Dangling socket structure %p with index %d",
                       cookie->socktable + ii,
                       ii);
        }
    }

    log_iops_debug("Destroying %p", iops);
    log_iops_warn("Still have %d timers", cookie->timer_count);
    assert (cookie->timer_count == 0);
    free (cookie->socktable);
    free (cookie);
    free (iops);
}

static void
invoke_startstop_callback(struct lcb_luv_cookie_st *cookie,
                          lcb_luv_start_cb_t cb)
{
    if (cb) {
        cb(cookie);
    }
}

static void
invoke_start_callback(struct libcouchbase_io_opt_st *iops)
{
    log_iops_debug("Start event loop..");
    invoke_startstop_callback(IOPS_COOKIE(iops), IOPS_COOKIE(iops)->start_callback);
}

static void
invoke_stop_callback(struct libcouchbase_io_opt_st *iops)
{
    invoke_startstop_callback(IOPS_COOKIE(iops), IOPS_COOKIE(iops)->stop_callback);
}

static void sync_loop_run(struct libcouchbase_io_opt_st *iops)
{
    log_iops_info("=== LOOP: run ===");
    IOPS_COOKIE(iops)->do_stop = 0;
    /** node's libuv does not export uv_run_once */
#ifdef LCB_LUV_VANILLA
    while (IOPS_COOKIE(iops)->do_stop == 0) {
        uv_run_once(IOPS_COOKIE(iops)->loop);
    }
#endif /* LCB_LUV_NODEJS */
}

static void sync_loop_stop(struct libcouchbase_io_opt_st *iops)
{
    log_iops_info("=== LOOP: stop ===");
    IOPS_COOKIE(iops)->do_stop = 1;
}

struct libcouchbase_io_opt_st *
lcb_luv_create_io_opts(uv_loop_t *loop, uint16_t sock_max)
{
    struct libcouchbase_io_opt_st *ret = calloc(1, sizeof(*ret));
    struct lcb_luv_cookie_st *cookie = calloc(1, sizeof(*cookie));

    if (!_yolog_initialized) {
        lcb_luv_yolog_init(NULL);
        _yolog_initialized = 1;
    }

    assert(loop);
    cookie->loop = loop;
    assert(loop);

    cookie->socktable = calloc(sock_max, sizeof(struct lcb_luv_socket_st*));
    cookie->fd_max = sock_max;
    cookie->fd_next = 0;
    ret->cookie = cookie;

    /* socket.c */
    ret->connect = lcb_luv_connect;
    ret->socket = lcb_luv_socket;
    ret->close = lcb_luv_close;

    ret->create_event = lcb_luv_create_event;
    ret->update_event = lcb_luv_update_event;
    ret->delete_event = lcb_luv_delete_event;
    ret->destroy_event = lcb_luv_destroy_event;

    /* read.c */
    ret->recv = lcb_luv_recv;
    ret->recvv = lcb_luv_recvv;

    /* write.c */
    ret->send = lcb_luv_send;
    ret->sendv = lcb_luv_sendv;

    /* timer.c */
    ret->create_timer = lcb_luv_create_timer;
    ret->delete_timer = lcb_luv_delete_timer;
    ret->update_timer = lcb_luv_update_timer;
    ret->destroy_timer = lcb_luv_destroy_timer;

    /* noops */
    ret->run_event_loop = invoke_start_callback;
    ret->stop_event_loop = invoke_stop_callback;

    ret->destructor = lcb_luv_dtor;

    return ret;
}

struct libcouchbase_io_opt_st *
libcouchbase__TestLoop(void)
{
    uv_loop_t *loop = uv_default_loop();
    struct libcouchbase_io_opt_st *ret = lcb_luv_create_io_opts(loop, 1024);
    ret->run_event_loop = sync_loop_run;
    ret->stop_event_loop = sync_loop_stop;
    return ret;
}
