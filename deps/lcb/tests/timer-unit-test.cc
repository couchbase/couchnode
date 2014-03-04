#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include "mock-unit-test.h"
#include "internal.h"

class Timers : public MockUnitTest
{
};


extern "C"
{
static void timer_callback(lcb_timer_t tm, lcb_t instance, const void *)
{
    if (instance != NULL) {
        lcb_maybe_breakout(instance);
    } else {
        tm->io->v.v0.stop_event_loop(tm->io);
    }
    lcb_timer_destroy(instance, tm);
}

static void periodic_callback(lcb_timer_t tm, lcb_t instance,
                              const void *cookie)
{
    int *ptr = (int *)cookie;
    *ptr += 1;
    if (*ptr == 5) {
        timer_callback(tm, instance, cookie);
    }
}

}

TEST_F(Timers, testStandalone)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);
    lcb_error_t err;

    lcb_timer_t tm = lcb_timer_create(instance, NULL,
                                      1000,
                                      0,
                                      timer_callback,
                                      &err);
    ASSERT_EQ(1, hashset_num_items(instance->timers));
    lcb_wait(instance);

    tm = lcb_timer_create2(instance->settings.io,
                           NULL, 0,
                           LCB_TIMER_STANDALONE,
                           timer_callback,
                           NULL,
                           &err);

    ASSERT_EQ(0, hashset_num_items(instance->timers));
    instance->settings.io->v.v0.run_event_loop(instance->settings.io);

    lcb_async_t async = lcb_async_create(instance->settings.io,
                                         NULL, timer_callback, &err);
    ASSERT_EQ(0, hashset_num_items(instance->timers));
    instance->settings.io->v.v0.run_event_loop(instance->settings.io);

    // Try a periodic timer...
    int ncalled = 0;
    tm = lcb_timer_create(instance, &ncalled, 1, 1, periodic_callback, &err);
    lcb_wait(instance);
    ASSERT_EQ(5, ncalled);

    // Try a periodic, standalone timer
    ncalled = 0;
    tm = lcb_timer_create2(instance->settings.io,
                           &ncalled,
                           1,
                           (lcb_timer_options)(LCB_TIMER_STANDALONE|LCB_TIMER_PERIODIC),
                           periodic_callback,
                           NULL,
                           &err);

    instance->settings.io->v.v0.run_event_loop(instance->settings.io);
    ASSERT_EQ(5, ncalled);

}
