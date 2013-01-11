/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "lcb_luv_internal.h"

struct my_timer_st {
    uv_timer_t uvt;
    lcb_luv_callback_t callback;
    void *cb_arg;
};

static void timer_cb(uv_timer_t *uvt, int status)
{
    struct my_timer_st *timer = (struct my_timer_st *)uvt;
    if (timer->callback) {
        timer->callback(-1, 0, timer->cb_arg);
    }
    (void)status;
}

void *lcb_luv_create_timer(struct lcb_io_opt_st *iops)
{
    struct my_timer_st *timer = calloc(1, sizeof(*timer));
    uv_timer_init(IOPS_COOKIE(iops)->loop, &timer->uvt);
    IOPS_COOKIE(iops)->timer_count++;
    return timer;
}

int lcb_luv_update_timer(struct lcb_io_opt_st *iops,
                         void *timer_opaque,
                         lcb_uint32_t usec,
                         void *cbdata,
                         lcb_luv_callback_t callback)
{
    struct my_timer_st *timer = (struct my_timer_st *)timer_opaque;
    timer->callback = callback;
    timer->cb_arg = cbdata;
    (void)iops;
    return uv_timer_start(&timer->uvt, timer_cb, usec, 0);
}


void lcb_luv_delete_timer(struct lcb_io_opt_st *iops,
                          void *timer_opaque)
{
    uv_timer_stop((uv_timer_t *)timer_opaque);
    ((struct my_timer_st *)timer_opaque)->callback = NULL;
    (void)iops;
}

static void timer_close_cb(uv_handle_t *handle)
{
    free(handle);
}

void lcb_luv_destroy_timer(struct lcb_io_opt_st *iops,
                           void *timer_opaque)
{
    lcb_luv_delete_timer(iops, timer_opaque);
    IOPS_COOKIE(iops)->timer_count--;
    uv_close((uv_handle_t *)timer_opaque, timer_close_cb);
}
