#include "config.h"
#include "internal.h"
#include <lcbio/iotable.h>
#include "iotests.h"

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
        IOT_STOP(tm->io);
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
    hashset_t hs = lcb_aspend_get(&instance->pendops, LCB_PENDTYPE_TIMER);

    lcb_timer_t tm = lcb_timer_create(instance, NULL,
                                      1000,
                                      0,
                                      timer_callback,
                                      &err);
    ASSERT_EQ(1, hashset_num_items(hs));
    lcb_wait(instance);

    tm = lcb_timer_create2(instance->iotable,
                           NULL, 0,
                           LCB_TIMER_STANDALONE,
                           timer_callback,
                           NULL,
                           &err);

    ASSERT_EQ(0, hashset_num_items(hs));
    lcb_run_loop(instance);

    lcb_async_t async = lcb_async_create(instance->getIOT(),
                                         NULL, timer_callback, &err);
    ASSERT_EQ(0, hashset_num_items(hs));
    lcb_run_loop(instance);

    // Try a periodic timer...
    int ncalled = 0;
    tm = lcb_timer_create(instance, &ncalled, 1, 1, periodic_callback, &err);
    lcb_wait(instance);
    ASSERT_EQ(5, ncalled);

    // Try a periodic, standalone timer
    ncalled = 0;
    tm = lcb_timer_create2(instance->getIOT(),
                           &ncalled,
                           1,
                           (lcb_timer_options)(LCB_TIMER_STANDALONE|LCB_TIMER_PERIODIC),
                           periodic_callback,
                           NULL,
                           &err);

    lcb_run_loop(instance);
    ASSERT_EQ(5, ncalled);

}
