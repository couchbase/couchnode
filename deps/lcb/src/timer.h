#ifndef LCB_TIMER_H
#define LCB_TIMER_H

#include <libcouchbase/couchbase.h>

#ifdef __cplusplus
extern "C" {
#endif /** __cplusplus */


typedef enum {
    LCB_TIMER_STANDALONE = 1 << 0,
    LCB_TIMER_PERIODIC = 1 << 1,
    LCB_TIMER_EX = 1 << 2
} lcb_timer_options;


typedef enum {
    LCB_TIMER_S_ENTERED = 0x01,
    LCB_TIMER_S_DESTROYED = 0x02,
    LCB_TIMER_S_ARMED = 0x04
} lcb_timer_state;



struct lcb_timer_st {
    /** Interval */
    lcb_uint32_t usec_;

    /** Internal state of the timer */
    lcb_timer_state state;

    /** Options for the timer itself. Do not modify */
    lcb_timer_options options;

    /** Handle for the IO Plugin */
    void *event;

    /** User data */
    const void *cookie;

    /** Callback to invoke */
    lcb_timer_callback callback;

    /** Note that 'instance' may be NULL in this case */
    lcb_t instance;

    /** IO instance pointer */
    lcb_io_opt_t io;
};

typedef lcb_timer_t lcb_async_t;

/**
 * Creates a timer using the io plugins' timer capabilities. The timer
 * may optionally be bound to an instance in which case the lcb_wait
 * called upon the instance will not return until the timer has fired.
 * @param io the I/O instance for the timer
 * @param usec seconds from now at which the timer will fire
 * @param options flag of LCB_TIMER_* options. The options are:
 *  LCB_TIMER_STANDALONE: Don't peg the timer to the instance. This means
 *  the timer will not be associated with a call to lcb_wait and will
 *  thus not control the exiting or entering of the instance' event loop.
 *  The default is a standalone timer (for which instance must be provided)
 *
 *  LCB_TIMER_PERIODIC:
 *  Repeat the call to the timer callback periodically until the timer
 *  is explicitly stopped
 * @param callback the callback to invoke for each interval
 * @param instance the instance to provide for the timer. Required if the
 * timer is not standalone.
 * @param error a pointer to an error which is set if this function failes.
 */
LCB_INTERNAL_API
lcb_timer_t lcb_timer_create2(lcb_io_opt_t io,
                              const void *cookie,
                              lcb_uint32_t usec,
                              lcb_timer_options options,
                              lcb_timer_callback callback,
                              lcb_t instance,
                              lcb_error_t *error);

/**
 * Creates an 'asynchronous call'. An asynchronous call is like a timer
 * except that it has no interval and will be called "immediately" when the
 * event loop regains control. Asynchronous calls are implemented using
 * timers - and specifically, standalone timers. lcb_async_t is currently
 * a typedef of lcb_timer_t
 */
LCB_INTERNAL_API
lcb_async_t lcb_async_create(lcb_io_opt_t io,
                             const void *command_cookie,
                             lcb_timer_callback callback,
                             lcb_error_t *error);

#define lcb_async_destroy lcb_timer_destroy

/**
 * Create a simple one-shot standalone timer.
 */
LCB_INTERNAL_API
lcb_timer_t lcb_timer_create_simple(lcb_io_opt_t io,
                                    const void *cookie,
                                    lcb_uint32_t usec,
                                    lcb_timer_callback callback);

/**
 * Rearm the timer to fire within a specified number of microseconds. The timer
 * must have not already been fired.
 * The timer may be currently armed, in which case a pending call is delayed
 * until the new interval is reached.
 *
 * @param timer the timer to rearm
 * @param usec the number of microseconds by which the timer should be
 * rearmed.
 */
LCB_INTERNAL_API
void lcb_timer_rearm(lcb_timer_t timer, lcb_uint32_t usec);

/**
 * Disarm the timer so that any pending calls are cancelled. The timer must
 * then be re-armed via rearmed to be used again.
 */
LCB_INTERNAL_API
void lcb_timer_disarm(lcb_timer_t timer);

/**
 * Returns true if the timer is armed. Usually you can do this in somehitng like
 * if (!lcb_timer_armed(timer)) {
 *     lcb_timer_arm(timer, usec);
 * }
 */
#define lcb_timer_armed(timer) ((timer)->state & LCB_TIMER_S_ARMED)

#define lcb_async_signal(async) lcb_timer_rearm(async, 0)
#define lcb_async_cancel(async) lcb_timer_disarm(async)


/**
 * Gets the last interval the timer was scheduled with.
 */
#define lcb_timer_last_interval(timer) ((const lcb_uint32_t)(timer)->usec_)


#ifdef __cplusplus
}
#endif /** __cplusplus */
#endif /* LCB_TIMER_H */
