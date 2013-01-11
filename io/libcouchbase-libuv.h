/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#ifndef LIBCOUCHBASE_LIBUV_H_
#define LIBCOUCHBASE_LIBUV_H_

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */

    /* <sys/types.h> needed for size_t used in couchbase.h */
#include <sys/types.h>

#include <libcouchbase/couchbase.h>
#include <uv.h>

    /* These variables define how much our read-ahead and write buffers
     * should be. Do not make these too low, but setting them to insanely
     * low amounts (for testing) should be nice. I've seen them work with
     * as little as 0x80.
     *
     * The size is static and not expanded, for each socket.
     */
#define LCB_LUV_READAHEAD 0x4000
#define LCB_LUV_WRITEBUFSZ 0x4000

    typedef void (*lcb_luv_callback_t)(lcb_socket_t, short, void *);
    struct lcb_luv_socket_st;
    typedef struct lcb_luv_socket_st *lcb_luv_socket_t;

    struct lcb_luv_cookie_st;

    typedef void (*lcb_luv_start_cb_t)(struct lcb_luv_cookie_st *luv_cookie);
    typedef void (*lcb_luv_stop_cb_t)(struct lcb_luv_cookie_st *luv_cookie);

    /**
     * Structure we place inside the iops. This is usually global per-event loop
     */
    struct lcb_luv_cookie_st {
        /* Private. Don't modify these or rely on them for meaning */
        uv_loop_t *loop;
        lcb_luv_socket_t *socktable;
        uint16_t fd_next;
        uint16_t fd_max;
        int do_stop;
        unsigned timer_count;

        /* --- Public --- */

        /* Data, put anything you want here */
        void *data;

        /* These two functions will be called whenever
         * libcouchbase calls io->run_event_loop and io_stop_event_loop,
         * respectively
         */
        lcb_luv_start_cb_t start_callback;
        lcb_luv_stop_cb_t stop_callback;
    };

    /**
     * Create a new IO operation structure.
     *
     * @param loop The libuv loop (can be obtained normally
     *              via uv_default_loop())
     * @param sock_max - The maximum amount of concurrent 'sockets' to
     *                   be open. sock_max * sizeof(char*) bytes are
     *                   allocated per cookie you create, so you
     *                   probably don't want to make it too large.
     *                   8092 or such is a safe bet.
     */
    struct lcb_io_opt_st *lcb_luv_create_io_opts(uv_loop_t *loop,
                                                 uint16_t sock_max);

    /**
     * This macro 'safely' extracts and casts the cookie from the iops.
     */
#define lcb_luv_from_iops(iops) \
    (struct lcb_luv_cookie_st *)(iops->cookie)

#ifdef __cplusplus
}
#endif /* __cplusplus */


#endif /* LCB_LIBUV_H_ */
