#define LCB_BOOTSTRAP_DEFINE_STRUCT

#include "iotests.h"
#include "config.h"
#include "internal.h"
#include "bucketconfig/clconfig.h"
#include <lcbio/iotable.h>
#include <set>

class Confmon : public ::testing::Test
{
    void SetUp() {
        MockEnvironment::Reset();
    }
};

struct evstop_listener {
    clconfig_listener base;
    lcbio_pTABLE io;
    int called;
};

extern "C" {
static void listen_callback1(clconfig_listener *lsn, clconfig_event_t event,
                             clconfig_info *info)
{
    if (event != CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        return;
    }

    evstop_listener *me = reinterpret_cast<evstop_listener*>(lsn);
    me->called = 1;
    IOT_STOP(me->io);
}
}

TEST_F(Confmon, testBasic)
{
    HandleWrap hw;
    lcb_t instance;
    MockEnvironment::getInstance()->createConnection(hw, instance);


    lcb_confmon *mon = lcb_confmon_create(instance->settings, instance->iotable);
    clconfig_provider *http = lcb_confmon_get_provider(mon, LCB_CLCONFIG_HTTP);
    lcb_clconfig_http_enable(http);
    lcb_clconfig_http_set_nodes(http, instance->ht_nodes);

    lcb_confmon_prepare(mon);

    EXPECT_EQ(NULL, lcb_confmon_get_config(mon));
    EXPECT_EQ(LCB_SUCCESS, lcb_confmon_start(mon));
    EXPECT_EQ(LCB_SUCCESS, lcb_confmon_start(mon));
    EXPECT_EQ(LCB_SUCCESS, lcb_confmon_stop(mon));
    EXPECT_EQ(LCB_SUCCESS, lcb_confmon_stop(mon));

    // Try to find a provider..
    clconfig_provider *provider = lcb_confmon_get_provider(mon, LCB_CLCONFIG_HTTP);
    ASSERT_NE(0, provider->enabled);

    struct evstop_listener listener;
    memset(&listener, 0, sizeof(listener));

    listener.base.callback = listen_callback1;
    listener.base.parent = mon;
    listener.io = instance->iotable;

    lcb_confmon_add_listener(mon, &listener.base);
    lcb_confmon_start(mon);
    IOT_START(instance->iotable);
    ASSERT_NE(0, listener.called);

    lcb_confmon_destroy(mon);
}


struct listener2 {
    clconfig_listener base;
    int call_count;
    lcbio_pTABLE io;
    clconfig_method_t last_source;
    std::set<clconfig_event_t> expected_events;

    void reset() {
        call_count = 0;
        last_source = LCB_CLCONFIG_PHONY;
        expected_events.clear();
    }

    listener2() {
        memset(&base, 0, sizeof(base));
        io = NULL;
        reset();
    }
};

static struct listener2* getListener2(const void *p)
{
    return reinterpret_cast<struct listener2*>(const_cast<void*>(p));
}

extern "C" {
static void listen_callback2(clconfig_listener *prov,
                             clconfig_event_t event,
                             clconfig_info *info)
{
    // Increase the number of times we've received a callback..
    struct listener2* lsn = getListener2(prov);

    if (event == CLCONFIG_EVENT_MONITOR_STOPPED) {
        IOT_START(lsn->io);
        return;
    }

    if (!lsn->expected_events.empty()) {
        if (lsn->expected_events.end() ==
            lsn->expected_events.find(event)) {
            return;
        }
    }

    lsn->call_count++;
    lsn->last_source = info->origin;
    IOT_STOP(lsn->io);
}
}

static void runConfmon(lcbio_pTABLE io, lcb_confmon *mon)
{
    IOT_START(io);
}

TEST_F(Confmon, testCycle)
{
    HandleWrap hw;
    lcb_t instance;
    lcb_create_st cropts;
    MockEnvironment *mock = MockEnvironment::getInstance();

    if (mock->isRealCluster()) {
        return;
    }

    mock->createConnection(hw, instance);
    instance->settings->bc_http_stream_time = 100000;
    instance->memd_sockpool->tmoidle = 100000;

    lcb_confmon *mon = lcb_confmon_create(instance->settings, instance->iotable);

    struct listener2 lsn;
    lsn.base.callback = listen_callback2;
    lsn.io = instance->iotable;
    lsn.reset();

    lcb_confmon_add_listener(mon, &lsn.base);

    mock->makeConnectParams(cropts, NULL);
    clconfig_provider *cccp = lcb_confmon_get_provider(mon, LCB_CLCONFIG_CCCP);
    clconfig_provider *http = lcb_confmon_get_provider(mon, LCB_CLCONFIG_HTTP);

    hostlist_t hl = hostlist_create();
    hostlist_add_stringz(hl, cropts.v.v2.mchosts, 11210);
    lcb_clconfig_cccp_enable(cccp, instance);
    lcb_clconfig_cccp_set_nodes(cccp, hl);

    lcb_clconfig_http_enable(http);
    lcb_clconfig_http_set_nodes(http, instance->ht_nodes);
    hostlist_destroy(hl);

    lcb_confmon_prepare(mon);
    lcb_confmon_start(mon);
    lsn.expected_events.insert(CLCONFIG_EVENT_GOT_NEW_CONFIG);
    runConfmon(lsn.io, mon);

    // Ensure CCCP is functioning properly and we're called only once.
    ASSERT_EQ(1, lsn.call_count);
    ASSERT_EQ(LCB_CLCONFIG_CCCP, lsn.last_source);

    lcb_confmon_start(mon);
    lsn.reset();
    lsn.expected_events.insert(CLCONFIG_EVENT_GOT_ANY_CONFIG);
    runConfmon(lsn.io, mon);
    ASSERT_EQ(1, lsn.call_count);
    ASSERT_EQ(LCB_CLCONFIG_CCCP, lsn.last_source);

    mock->setCCCP(false);
    mock->failoverNode(5);
    lsn.reset();
    lcb_confmon_start(mon);
    lsn.expected_events.insert(CLCONFIG_EVENT_GOT_ANY_CONFIG);
    lsn.expected_events.insert(CLCONFIG_EVENT_GOT_NEW_CONFIG);
    runConfmon(lsn.io, mon);
    ASSERT_EQ(LCB_CLCONFIG_HTTP, lsn.last_source);
    ASSERT_EQ(1, lsn.call_count);
    lcb_confmon_destroy(mon);
}

TEST_F(Confmon, testBootstrapMethods)
{
    lcb_t instance;
    HandleWrap hw;
    MockEnvironment::getInstance()->createConnection(hw, instance);
    lcb_error_t err = lcb_connect(instance);
    ASSERT_EQ(LCB_SUCCESS, err);

    // Try the various bootstrap times
    struct lcb_BOOTSTRAP *bs = instance->bootstrap;
    hrtime_t last = bs->last_refresh, cur = 0;

    // Reset it for the time being
    bs->last_refresh = 0;
    lcb_confmon_stop(instance->confmon);

    // Refreshing now should work
    lcb_bootstrap_common(instance, LCB_BS_REFRESH_THROTTLE);
    ASSERT_NE(0, lcb_confmon_is_refreshing(instance->confmon));

    cur = bs->last_refresh;
    ASSERT_GT(cur, 0);
    ASSERT_EQ(0, bs->errcounter);
    last = cur;

    // Stop it, so the state is reset
    lcb_confmon_stop(instance->confmon);
    ASSERT_EQ(0, lcb_confmon_is_refreshing(instance->confmon));

    lcb_bootstrap_common(instance, LCB_BS_REFRESH_THROTTLE|LCB_BS_REFRESH_INCRERR);
    ASSERT_EQ(last, bs->last_refresh);
    ASSERT_EQ(1, bs->errcounter);

    // Ensure that a throttled-without-incr doesn't actually incr
    lcb_bootstrap_common(instance, LCB_BS_REFRESH_THROTTLE);
    ASSERT_EQ(1, bs->errcounter);

    // No refresh yet
    ASSERT_EQ(0, lcb_confmon_is_refreshing(instance->confmon));

    lcb_bootstrap_common(instance, LCB_BS_REFRESH_ALWAYS);
    ASSERT_NE(0, lcb_confmon_is_refreshing(instance->confmon));
    lcb_confmon_stop(instance->confmon);
}
