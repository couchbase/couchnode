#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include "mock-environment.h"
#include "internal.h"
#include "bucketconfig/clconfig.h"
#include <set>

class Confmon : public ::testing::Test
{
    void SetUp() {
        MockEnvironment::Reset();
    }
};

struct evstop_listener {
    clconfig_listener base;
    lcb_io_opt_t io;
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
    me->io->v.v0.stop_event_loop(me->io);
}
}

TEST_F(Confmon, testBasic)
{
    HandleWrap hw;
    lcb_t instance;
    MockEnvironment::getInstance()->createConnection(hw, instance);


    lcb_confmon *mon = lcb_confmon_create(&instance->settings);
    lcb_confmon_set_nodes(mon, instance->usernodes, NULL);
    clconfig_provider *http = lcb_confmon_get_provider(mon, LCB_CLCONFIG_HTTP);
    lcb_clconfig_http_enable(http);
    lcb_clconfig_http_set_nodes(http, instance->usernodes);

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
    listener.io = hw.getIo();

    lcb_confmon_add_listener(mon, &listener.base);
    lcb_confmon_start(mon);
    hw.getIo()->v.v0.run_event_loop(hw.getIo());

    ASSERT_NE(0, listener.called);

    lcb_confmon_destroy(mon);
}


struct listener2 {
    clconfig_listener base;
    int call_count;
    lcb_io_opt_t io;
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
        lsn->io->v.v0.stop_event_loop(lsn->io);
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
    lsn->io->v.v0.stop_event_loop(lsn->io);
}
}

static void runConfmon(lcb_io_opt_t io, lcb_confmon *mon)
{
    io->v.v0.run_event_loop(io);
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
    instance->settings.bc_http_stream_time = 100000;
    instance->memd_sockpool->idle_timeout = 100000;

    lcb_confmon *mon = lcb_confmon_create(&instance->settings);
    lcb_confmon_set_nodes(mon, instance->usernodes, NULL);

    struct listener2 lsn;
    lsn.base.callback = listen_callback2;
    lsn.io = hw.getIo();
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
    lcb_clconfig_http_set_nodes(http, instance->usernodes);
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
