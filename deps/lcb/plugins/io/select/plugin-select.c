/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
#include "select_io_opts.h"
#include <libcouchbase/plugins/io/bsdio-inl.c>

#if defined(_WIN32) && !defined(usleep)
#define usleep(n) Sleep((n) / 1000)
#endif

typedef struct s_event_s s_event_t;
struct s_event_s {
    lcb_list_t list;
    lcb_socket_t sock;
    short flags;
    short eflags; /* effective flags */
    void *cb_data;
    void (*handler)(lcb_socket_t sock, short which, void *cb_data);
    s_event_t *next; /* for chaining active events */
};

typedef struct s_timer_s s_timer_t;
struct s_timer_s {
    lcb_list_t list;
    int active;
    hrtime_t exptime;
    void *cb_data;
    void (*handler)(lcb_socket_t sock, short which, void *cb_data);
};

typedef struct {
    s_event_t events;
    lcb_list_t timers;
    int event_loop;
} io_cookie_t;

static int timer_cmp_asc(lcb_list_t *a, lcb_list_t *b)
{
    s_timer_t *ta = LCB_LIST_ITEM(a, s_timer_t, list);
    s_timer_t *tb = LCB_LIST_ITEM(b, s_timer_t, list);
    if (ta->exptime > tb->exptime) {
        return 1;
    } else if (ta->exptime < tb->exptime) {
        return -1;
    } else {
        return 0;
    }
}

static void *lcb_io_create_event(lcb_io_opt_t iops)
{
    io_cookie_t *io = iops->v.v0.cookie;
    s_event_t *ret = calloc(1, sizeof(s_event_t));
    if (ret != NULL) {
        lcb_list_append(&io->events.list, &ret->list);
    }
    return ret;
}

static int lcb_io_update_event(lcb_io_opt_t iops,
                               lcb_socket_t sock,
                               void *event,
                               short flags,
                               void *cb_data,
                               void (*handler)(lcb_socket_t sock,
                                               short which,
                                               void *cb_data))
{
    s_event_t *ev = event;
    ev->sock = sock;
    ev->handler = handler;
    ev->cb_data = cb_data;
    ev->flags = flags;
    (void)iops;
    return 0;
}

static void lcb_io_destroy_event(lcb_io_opt_t iops,
                                 void *event)
{
    s_event_t *ev = event;
    lcb_list_delete(&ev->list);
    free(ev);
    (void)iops;
}

static void lcb_io_delete_event(lcb_io_opt_t iops,
                                lcb_socket_t sock,
                                void *event)
{
    s_event_t *ev = event;
    ev->flags = 0;
    ev->cb_data = NULL;
    ev->handler = NULL;
    (void)iops;
    (void)sock;
}

static void *lcb_io_create_timer(lcb_io_opt_t iops)
{
    s_timer_t *ret = calloc(1, sizeof(s_timer_t));
    (void)iops;
    return ret;
}

static void lcb_io_delete_timer(lcb_io_opt_t iops, void *timer)
{
    s_timer_t *tm = timer;
    if (tm->active) {
        tm->active = 0;
        lcb_list_delete(&tm->list);
    }
    (void)iops;
}


static void lcb_io_destroy_timer(lcb_io_opt_t iops, void *timer)
{
    lcb_io_delete_timer(iops, timer);
    free(timer);
    (void)iops;
}

static int lcb_io_update_timer(lcb_io_opt_t iops,
                               void *timer,
                               lcb_uint32_t usec,
                               void *cb_data,
                               void (*handler)(lcb_socket_t sock,
                                               short which,
                                               void *cb_data))
{
    s_timer_t *tm = timer;
    io_cookie_t *cookie = iops->v.v0.cookie;
    lcb_assert(!tm->active);
    tm->exptime = gethrtime() + (usec * (hrtime_t)1000);
    tm->cb_data = cb_data;
    tm->handler = handler;
    tm->active = 1;
    lcb_list_add_sorted(&cookie->timers, &tm->list, timer_cmp_asc);

    (void)iops;
    return 0;
}

static void lcb_io_stop_event_loop(struct lcb_io_opt_st *iops)
{
    io_cookie_t *io = iops->v.v0.cookie;
    io->event_loop = 0;
}

static s_timer_t *pop_next_timer(io_cookie_t *cookie, hrtime_t now)
{
    s_timer_t *ret;

    if (LCB_LIST_IS_EMPTY(&cookie->timers)) {
        return NULL;
    }

    ret = LCB_LIST_ITEM(cookie->timers.next, s_timer_t, list);
    if (ret->exptime > now) {
        return NULL;
    }
    lcb_list_shift(&cookie->timers);
    ret->active = 0;
    return ret;
}

static int get_next_timeout(io_cookie_t *cookie, struct timeval *tmo, hrtime_t now)
{
    s_timer_t *first;
    hrtime_t delta;

    if (LCB_LIST_IS_EMPTY(&cookie->timers)) {
        tmo->tv_sec = 0;
        tmo->tv_usec = 0;
        return 0;
    }

    first = LCB_LIST_ITEM(cookie->timers.next, s_timer_t, list);
    if (now < first->exptime) {
        delta = first->exptime - now;
    } else {
        delta = 0;
    }


    if (delta) {
        delta /= 1000;
        tmo->tv_sec = (long)(delta / 1000000);
        tmo->tv_usec = delta % 1000000;
    } else {
        tmo->tv_sec = 0;
        tmo->tv_usec = 0;
    }
    return 1;
}

static void lcb_io_run_event_loop(struct lcb_io_opt_st *iops)
{
    io_cookie_t *io = iops->v.v0.cookie;

    s_event_t *ev;
    lcb_list_t *ii;

    fd_set readfds, writefds, exceptfds;

    io->event_loop = 1;
    do {
        struct timeval tmo, *t;
        int ret;
        int nevents = 0;
        int has_timers;
        lcb_socket_t fdmax = 0;
        hrtime_t now;

        t = NULL;
        now = gethrtime();

        FD_ZERO(&readfds);
        FD_ZERO(&writefds);
        FD_ZERO(&exceptfds);

        LCB_LIST_FOR(ii, &io->events.list) {
            ev = LCB_LIST_ITEM(ii, s_event_t, list);
            if (ev->flags != 0) {
                if (ev->flags & LCB_READ_EVENT) {
                    FD_SET(ev->sock, &readfds);
                }

                if (ev->flags & LCB_WRITE_EVENT) {
                    FD_SET(ev->sock, &writefds);
                }

                FD_SET(ev->sock, &exceptfds);
                if (ev->sock > fdmax) {
                    fdmax = ev->sock;
                }
                ++nevents;
            }
        }

        has_timers = get_next_timeout(io, &tmo, now);
        if (has_timers) {
            t = &tmo;
        }


        if (nevents == 0 && has_timers == 0) {
            io->event_loop = 0;
            return;
        }

        if (nevents) {
            ret = select(fdmax + 1, &readfds, &writefds, &exceptfds, t);
            if (ret == SOCKET_ERROR) {
                return;
            }
        } else {
            ret = 0;
            usleep((t->tv_sec * 1000000) + t->tv_usec);
        }


        /** Always invoke the pending timers */
        if (has_timers) {
            s_timer_t *tm;
            now = gethrtime();

            while ((tm = pop_next_timer(io, now))) {
                tm->handler(-1, 0, tm->cb_data);
            }
        }

        /* To be completely safe, we need to copy active events
         * before handing them. Iterating over the list of
         * registered events isn't safe, because one callback can
         * cancel all registered events before iteration will end
         */

        if (ret && nevents) {
            s_event_t *active = NULL;
            LCB_LIST_FOR(ii, &io->events.list) {
                ev = LCB_LIST_ITEM(ii, s_event_t, list);
                if (ev->flags != 0) {
                    ev->eflags = 0;
                    if (FD_ISSET(ev->sock, &readfds)) {
                        ev->eflags |= LCB_READ_EVENT;
                    }
                    if (FD_ISSET(ev->sock, &writefds)) {
                        ev->eflags |= LCB_WRITE_EVENT;
                    }
                    if (FD_ISSET(ev->sock, &exceptfds)) {
                        ev->eflags = LCB_ERROR_EVENT | LCB_RW_EVENT; /** It should error */
                    }
                    if (ev->eflags != 0) {
                        ev->next = active;
                        active = ev;
                    }
                }
            }
            ev = active;
            while (ev) {
                s_event_t *p = ev->next;
                ev->handler(ev->sock, ev->eflags, ev->cb_data);
                ev = p;
            }
        }
    } while (io->event_loop);
}

static void lcb_destroy_io_opts(struct lcb_io_opt_st *iops)
{
    io_cookie_t *io = iops->v.v0.cookie;
    lcb_list_t *nn, *ii;
    s_event_t *ev;
    s_timer_t *tm;

    assert(io->event_loop == 0);
    LCB_LIST_SAFE_FOR(ii, nn, &io->events.list) {
        ev = LCB_LIST_ITEM(ii, s_event_t, list);
        iops->v.v0.destroy_event(iops, ev);
    }
    assert(LCB_LIST_IS_EMPTY(&io->events.list));
    LCB_LIST_SAFE_FOR(ii, nn, &io->timers) {
        tm = LCB_LIST_ITEM(ii, s_timer_t, list);
        iops->v.v0.destroy_timer(iops, tm);
    }
    assert(LCB_LIST_IS_EMPTY(&io->timers));
    free(io);
    free(iops);
}

LIBCOUCHBASE_API
lcb_error_t lcb_create_select_io_opts(int version, lcb_io_opt_t *io, void *arg)
{
    lcb_io_opt_t ret;
    io_cookie_t *cookie;

    if (version != 0) {
        return LCB_PLUGIN_VERSION_MISMATCH;
    }
    ret = calloc(1, sizeof(*ret));
    cookie = calloc(1, sizeof(*cookie));
    if (ret == NULL || cookie == NULL) {
        free(ret);
        free(cookie);
        return LCB_CLIENT_ENOMEM;
    }
    lcb_list_init(&cookie->events.list);
    lcb_list_init(&cookie->timers);

    /* setup io iops! */
    ret->version = 0;
    ret->dlhandle = NULL;
    ret->destructor = lcb_destroy_io_opts;
    /* consider that struct isn't allocated by the library,
     * `need_cleanup' flag might be set in lcb_create() */
    ret->v.v0.need_cleanup = 0;
    ret->v.v0.delete_event = lcb_io_delete_event;
    ret->v.v0.destroy_event = lcb_io_destroy_event;
    ret->v.v0.create_event = lcb_io_create_event;
    ret->v.v0.update_event = lcb_io_update_event;

    ret->v.v0.delete_timer = lcb_io_delete_timer;
    ret->v.v0.destroy_timer = lcb_io_destroy_timer;
    ret->v.v0.create_timer = lcb_io_create_timer;
    ret->v.v0.update_timer = lcb_io_update_timer;

    ret->v.v0.run_event_loop = lcb_io_run_event_loop;
    ret->v.v0.stop_event_loop = lcb_io_stop_event_loop;
    ret->v.v0.cookie = cookie;

    wire_lcb_bsd_impl(ret);

    *io = ret;
    (void)arg;
    return LCB_SUCCESS;
}
