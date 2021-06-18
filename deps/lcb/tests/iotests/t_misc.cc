/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2020 Couchbase, Inc.
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
#include "config.h"
#include "iotests.h"
#include <map>
#include <climits>
#include <cstring>
#include <algorithm>
#include "internal.h" /* vbucket_* things from lcb_INSTANCE * */
#include "auth-priv.h"
#include <lcbio/iotable.h>
#include "bucketconfig/bc_http.h"
#include "check_config.h"

#include "capi/cmd_observe.hh"
#include "capi/cmd_endure.hh"

#define LOGARGS(instance, lvl) instance->settings, "tests-MUT", LCB_LOG_##lvl, __FILE__, __LINE__

extern "C" {
static void timings_callback(lcb_INSTANCE *, const void *cookie, lcb_timeunit_t, lcb_U32, lcb_U32, lcb_U32, lcb_U32)
{
    bool *bPtr = (bool *)cookie;
    *bPtr = true;
}
}

TEST_F(MockUnitTest, testTimings)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    bool called = false;
    createConnection(hw, &instance);

    lcb_enable_timings(instance);
    std::string key = "counter";
    std::string val = "0";

    lcb_CMDSTORE *storecmd;
    lcb_cmdstore_create(&storecmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(storecmd, key.c_str(), key.size());
    lcb_cmdstore_value(storecmd, val.c_str(), val.size());
    ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, nullptr, storecmd));
    lcb_cmdstore_destroy(storecmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    lcb_get_timings(instance, &called, timings_callback);
    lcb_disable_timings(instance);
    ASSERT_TRUE(called);
}

namespace
{
struct TimingInfo {
    lcb_U64 ns_start;
    lcb_U64 ns_end;
    size_t count;

    TimingInfo() : ns_start(-1), ns_end(-1), count(-1) {}

    bool operator<(const TimingInfo &other) const
    {
        return other.ns_start > ns_start;
    }
    bool operator>(const TimingInfo &other) const
    {
        return ns_start > other.ns_start;
    }

    bool valid() const
    {
        return count != -1;
    }
};

static lcb_U64 intervalToNsec(lcb_U64 interval, lcb_timeunit_t unit)
{
    switch (unit) {
        case LCB_TIMEUNIT_NSEC:
            return interval;
        case LCB_TIMEUNIT_USEC:
            return interval * 1000;
        case LCB_TIMEUNIT_MSEC:
            return interval * 1000000;
        case LCB_TIMEUNIT_SEC:
            return interval * 1000000000;
    }
    return 0;
}

struct LcbTimings {
    LcbTimings() = default;
    std::vector<TimingInfo> m_info;
    void load(lcb_INSTANCE *);

    TimingInfo infoAt(hrtime_t duration, lcb_timeunit_t unit = LCB_TIMEUNIT_NSEC);
    size_t countAt(hrtime_t duration, lcb_timeunit_t unit = LCB_TIMEUNIT_NSEC)
    {
        return infoAt(duration, unit).count;
    }

    void dump() const;
};

extern "C" {
static void load_timings_callback(lcb_INSTANCE *, const void *cookie, lcb_timeunit_t unit, lcb_U32 min, lcb_U32 max,
                                  lcb_U32 total, lcb_U32 /* maxtotal */)
{
    lcb_U64 start = intervalToNsec(min, unit);
    lcb_U64 end = intervalToNsec(max, unit);
    auto *timings = (LcbTimings *)cookie;
    TimingInfo info;

    info.ns_start = start;
    info.ns_end = end;
    info.count = total;
    timings->m_info.push_back(info);
}
} // extern "C"

void LcbTimings::load(lcb_INSTANCE *instance)
{
    lcb_get_timings(instance, this, load_timings_callback);
    std::sort(m_info.begin(), m_info.end());
}

TimingInfo LcbTimings::infoAt(hrtime_t duration, lcb_timeunit_t unit)
{
    duration = intervalToNsec(duration, unit);
    for (auto &ii : m_info) {
        if (ii.ns_start <= duration && ii.ns_end > duration) {
            return ii;
        }
    }
    return {};
}

void LcbTimings::dump() const
{
    auto ii = m_info.begin();
    for (; ii != m_info.end(); ii++) {
        if (ii->ns_end < 1000) {
            printf("[%llu-%llu ns] %llu\n", (unsigned long long)ii->ns_start, (unsigned long long)ii->ns_end,
                   (unsigned long long)ii->count);
        } else if (ii->ns_end < 10000000) {
            printf("[%llu-%llu us] %llu\n", (unsigned long long)(ii->ns_start / 1000),
                   (unsigned long long)ii->ns_end / 1000, (unsigned long long)ii->count);
        } else {
            printf("[%llu-%llu ms] %llu\n", (unsigned long long)(ii->ns_start / 1000000),
                   (unsigned long long)(ii->ns_end / 1000000), (unsigned long long)ii->count);
        }
    }
}

} // namespace

struct UnitInterval {
    lcb_U64 n;
    lcb_timeunit_t unit;
    UnitInterval(lcb_U64 n, lcb_timeunit_t unit) : n(n), unit(unit) {}
};

static void addTiming(lcb_INSTANCE *instance, const UnitInterval &interval)
{
    hrtime_t n = intervalToNsec(interval.n, interval.unit);
    lcb_histogram_record(instance->kv_timings, n);
}

TEST_F(MockUnitTest, testTimingsEx)
{
#ifndef LCB_USE_HDR_HISTOGRAM
    lcb_INSTANCE *instance;
    HandleWrap hw;

    createConnection(hw, &instance);
    lcb_disable_timings(instance);
    lcb_enable_timings(instance);

    std::vector<UnitInterval> intervals;
    intervals.emplace_back(1, LCB_TIMEUNIT_NSEC);
    intervals.emplace_back(250, LCB_TIMEUNIT_NSEC);
    intervals.emplace_back(4, LCB_TIMEUNIT_USEC);
    intervals.emplace_back(32, LCB_TIMEUNIT_USEC);
    intervals.emplace_back(942, LCB_TIMEUNIT_USEC);
    intervals.emplace_back(1243, LCB_TIMEUNIT_USEC);
    intervals.emplace_back(1732, LCB_TIMEUNIT_USEC);
    intervals.emplace_back(5630, LCB_TIMEUNIT_USEC);
    intervals.emplace_back(42, LCB_TIMEUNIT_MSEC);
    intervals.emplace_back(434, LCB_TIMEUNIT_MSEC);

    intervals.emplace_back(8234, LCB_TIMEUNIT_MSEC);
    intervals.emplace_back(1294, LCB_TIMEUNIT_MSEC);
    intervals.emplace_back(48, LCB_TIMEUNIT_SEC);

    for (auto &interval : intervals) {
        addTiming(instance, interval);
    }

    // Ensure they all exist, at least. Currently we bundle everything
    LcbTimings timings{};
    timings.load(instance);

    timings.dump();

    // Measuring in < us
    ASSERT_EQ(2, timings.countAt(50, LCB_TIMEUNIT_NSEC));

    ASSERT_EQ(1, timings.countAt(4, LCB_TIMEUNIT_USEC));
    ASSERT_EQ(1, timings.countAt(30, LCB_TIMEUNIT_USEC));
    ASSERT_EQ(-1, timings.countAt(900, LCB_TIMEUNIT_USEC));
    ASSERT_EQ(1, timings.countAt(940, LCB_TIMEUNIT_USEC));
    ASSERT_EQ(1, timings.countAt(1200, LCB_TIMEUNIT_USEC));
    ASSERT_EQ(1, timings.countAt(1250, LCB_TIMEUNIT_USEC));
    ASSERT_EQ(1, timings.countAt(5600, LCB_TIMEUNIT_USEC));
    ASSERT_EQ(1, timings.countAt(40, LCB_TIMEUNIT_MSEC));
    ASSERT_EQ(1, timings.countAt(430, LCB_TIMEUNIT_MSEC));
    ASSERT_EQ(1, timings.countAt(1, LCB_TIMEUNIT_SEC));
    ASSERT_EQ(1, timings.countAt(8, LCB_TIMEUNIT_SEC));
    ASSERT_EQ(1, timings.countAt(93, LCB_TIMEUNIT_SEC));
#endif
}

extern "C" {
static void record_callback(const lcbmetrics_VALUERECORDER *recorder, uint64_t value)
{
    return;
}

static const lcbmetrics_VALUERECORDER *new_recorder(const lcbmetrics_METER *meter, const char *name,
                                                    const lcbmetrics_TAG *tags, size_t ntags)
{
    bool has_service, has_operation = false;
    for (int i = 0; i < ntags; i++) {
        if (strcmp("db.operation", tags[i].key) == 0) {
            has_operation = true;
            EXPECT_STREQ(tags[i].value, "upsert");
        } else if (strcmp("db.couchbase.service", tags[i].key) == 0) {
            has_service = true;
            EXPECT_STREQ(tags[i].value, "kv");
        } else {
            ADD_FAILURE() << "unknown key " << tags[i].key;
        }
    }
    EXPECT_TRUE(has_service && has_operation);

    lcbmetrics_VALUERECORDER *recorder;
    lcbmetrics_valuerecorder_create(&recorder, nullptr);
    lcbmetrics_valuerecorder_record_value_callback(recorder, record_callback);
    return recorder;
}

static void store_cb(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    size_t *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    ++(*counter);
    ASSERT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
}
} // extern "C"

TEST_F(MockUnitTest, testOpMetrics)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    lcb_CMDSTORE *scmd;
    size_t counter = 0;
    lcbmetrics_METER *meter;

    lcbmetrics_meter_create(&meter, nullptr);
    lcbmetrics_meter_value_recorder_callback(meter, new_recorder);

    lcb_CREATEOPTS *crparams = nullptr;
    MockEnvironment::getInstance()->makeConnectParams(crparams, nullptr, LCB_TYPE_BUCKET);
    lcb_createopts_meter(crparams, meter);

    tryCreateConnection(hw, &instance, crparams);
    lcb_createopts_destroy(crparams);

    int enable = 1;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_ENABLE_OP_METRICS, &enable);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_cb);

    lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(scmd, "key", strlen("key"));
    lcb_cmdstore_value(scmd, "value", strlen("value"));
    ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, &counter, scmd));
    lcb_cmdstore_destroy(scmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(1, counter);
    lcbmetrics_meter_destroy(meter);
}

struct async_ctx {
    int count;
    lcbio_pTABLE table;
};

extern "C" {
static void dtor_callback(const void *cookie)
{
    auto *ctx = (async_ctx *)cookie;
    ctx->count++;
    IOT_STOP(ctx->table);
}
}

TEST_F(MockUnitTest, testAsyncDestroy)
{
    lcb_INSTANCE *instance;
    createConnection(&instance);
    lcbio_pTABLE iot = instance->iotable;
    lcb_settings *settings = instance->settings;

    storeKey(instance, "foo", "bar");
    // Now destroy the instance
    async_ctx ctx{};
    ctx.count = 0;
    ctx.table = iot;
    lcb_set_destroy_callback(instance, dtor_callback);
    lcb_destroy_async(instance, &ctx);
    lcbio_table_ref(iot);
    lcb_run_loop(instance);
    lcbio_table_unref(iot);
    ASSERT_EQ(1, ctx.count);
}

TEST_F(MockUnitTest, testGetHostInfo)
{
    lcb_INSTANCE *instance;
    createConnection(&instance);
    lcb_BOOTSTRAP_TRANSPORT tx;
    const char *hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG, 0);
    ASSERT_FALSE(hoststr == nullptr);

    hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG_CONNECTED, 0);
    lcb_STATUS err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_CONFIG_TRANSPORT, &tx);

    ASSERT_EQ(LCB_SUCCESS, err);
    if (tx == LCB_CONFIG_TRANSPORT_HTTP) {
        ASSERT_FALSE(hoststr == nullptr);
        hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG_CONNECTED, 99);
        ASSERT_FALSE(hoststr == nullptr);
    } else {
        if (hoststr) {
            printf("%s\n", hoststr);
        }
        ASSERT_TRUE(hoststr == nullptr);
    }

    // Get any data node
    using std::map;
    using std::string;
    map<string, bool> smap;

    // Ensure we only get unique nodes
    for (lcb_S32 ii = 0; ii < lcb_get_num_nodes(instance); ii++) {
        const char *cur = lcb_get_node(instance, LCB_NODE_DATA, ii);
        ASSERT_FALSE(cur == nullptr);
        ASSERT_FALSE(smap[cur]);
        smap[cur] = true;
    }
    lcb_destroy(instance);

    // Try with no connection
    err = lcb_create(&instance, nullptr);
    ASSERT_EQ(LCB_SUCCESS, err);

    hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG_CONNECTED, 0);
    ASSERT_TRUE(nullptr == hoststr);

    hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG, 0);
    ASSERT_TRUE(nullptr == hoststr);

    lcb_destroy(instance);
}

extern "C" {
static void store_callback(lcb_INSTANCE *instance, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    size_t *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STATUS rc = lcb_respstore_status(resp);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ++(*counter);
}

static void get_callback(lcb_INSTANCE *instance, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    size_t *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    lcb_STATUS rc = lcb_respget_status(resp);
    const char *key;
    size_t nkey;
    lcb_respget_key(resp, &key, &nkey);
    std::string keystr(key, nkey);
    ++(*counter);
    lcb_log(LOGARGS(instance, DEBUG), "receive '%s' on get callback %lu, status: %s", keystr.c_str(), size_t(*counter),
            lcb_strerror_short(rc));
    EXPECT_TRUE(rc == LCB_ERR_KVENGINE_INVALID_PACKET || rc == LCB_ERR_DOCUMENT_NOT_FOUND || rc == LCB_SUCCESS);
}

lcb_RETRY_ACTION retry_strategy_fail_fast_but_not_quite(lcb_RETRY_REQUEST *req, lcb_RETRY_REASON reason)
{
    if (reason == LCB_RETRY_REASON_SOCKET_NOT_AVAILABLE || reason == LCB_RETRY_REASON_SOCKET_CLOSED_WHILE_IN_FLIGHT) {
        return lcb_retry_strategy_best_effort(req, reason);
    }
    lcb_RETRY_ACTION res{0, 0};
    return res;
}
}

TEST_F(MockUnitTest, testKeyTooLong)
{
    SKIP_IF_MOCK();
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    size_t nbCallbacks = 20;
    std::vector<std::string> keys;
    keys.resize(nbCallbacks);

    lcb_retry_strategy(instance, retry_strategy_fail_fast_but_not_quite); // lcb_retry_strategy_best_effort by default

    std::string tooLongKey(
        "JfGnEbifrrqPuVo6H8S26W5KJmxCf963zt49bKMBjUCDCzjpw_P8T1FACNykylGmMIHN1hzPa0MsM.2bp4zjy4CJCNJHxVEVqV1_"
        "g85GMvd74hFo36j47eaHRdpTQDBlHq_qcz95xkpIh6g3Y5y4sESPZk4.lwqmgekh4GpREt413Hpn8q_"
        "N0let0A409uwj8MZkDr4D7op3uJsbNouPC1y3Y4qEb7zOTrpm1Ivu2tpPCw6Qv_3EfDA.M2u");

    // store keys
    lcb_sched_enter(instance);

    size_t counter = 0;
    for (size_t ii = 0; ii < nbCallbacks; ++ii) {
        char key[6];
        sprintf(key, "key%lu", ii);
        keys[ii] = std::string(key);
        lcb_CMDSTORE *scmd;
        lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(scmd, key, strlen(key));
        lcb_cmdstore_value(scmd, "val", 3);
        ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, &counter, scmd));
        lcb_cmdstore_destroy(scmd);
    }

    lcb_sched_leave(instance);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    lcb_wait(instance, LCB_WAIT_NOCHECK);

    // multiget OK
    lcb_sched_enter(instance);

    counter = 0;
    for (size_t ii = 0; ii < nbCallbacks; ++ii) {
        lcb_CMDGET *gcmd;
        lcb_cmdget_create(&gcmd);
        lcb_cmdget_key(gcmd, keys[ii].c_str(), strlen(keys[ii].c_str()));
        ASSERT_EQ(LCB_SUCCESS, lcb_get(instance, &counter, gcmd));
        lcb_cmdget_destroy(gcmd);

        if (ii == nbCallbacks / 2) {
            lcb_CMDGET *cmd1;
            lcb_cmdget_create(&cmd1);
            lcb_cmdget_key(cmd1, tooLongKey.c_str(), strlen(tooLongKey.c_str()));
            ASSERT_EQ(LCB_SUCCESS, lcb_get(instance, &counter, cmd1));
            lcb_cmdget_destroy(cmd1);
        }
    }

    lcb_sched_leave(instance);
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_wait(instance, LCB_WAIT_NOCHECK);

    ASSERT_EQ(nbCallbacks + 1, counter);

    // multiget OK
    lcb_sched_enter(instance);
    counter = 0;
    for (size_t ii = 0; ii < nbCallbacks; ++ii) {
        lcb_CMDGET *gcmd;
        lcb_cmdget_create(&gcmd);
        lcb_cmdget_key(gcmd, keys[ii].c_str(), strlen(keys[ii].c_str()));
        ASSERT_EQ(LCB_SUCCESS, lcb_get(instance, &counter, gcmd));
        lcb_cmdget_destroy(gcmd);
    }

    lcb_sched_leave(instance);
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_wait(instance, LCB_WAIT_NOCHECK);

    ASSERT_EQ(nbCallbacks, counter);
}

TEST_F(MockUnitTest, testEmptyKeys)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    union {
    } u{};
    memset(&u, 0, sizeof u);

    lcb_sched_enter(instance);

    lcb_CMDGET *get;
    lcb_cmdget_create(&get);
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, lcb_get(instance, nullptr, get));
    lcb_cmdget_destroy(get);

    lcb_CMDGETREPLICA *rget;
    lcb_cmdgetreplica_create(&rget, LCB_REPLICA_MODE_ANY);
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, lcb_getreplica(instance, nullptr, rget));
    lcb_cmdgetreplica_destroy(rget);

    lcb_CMDSTORE *store;
    lcb_cmdstore_create(&store, LCB_STORE_UPSERT);
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, lcb_store(instance, nullptr, store));
    lcb_cmdstore_destroy(store);

    lcb_CMDTOUCH *touch;
    lcb_cmdtouch_create(&touch);
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, lcb_touch(instance, nullptr, touch));
    lcb_cmdtouch_destroy(touch);

    lcb_CMDUNLOCK *unlock;
    lcb_cmdunlock_create(&unlock);
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, lcb_unlock(instance, nullptr, unlock));
    lcb_cmdunlock_destroy(unlock);

    lcb_CMDCOUNTER *counter;
    lcb_cmdcounter_create(&counter);
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, lcb_counter(instance, nullptr, counter));
    lcb_cmdcounter_destroy(counter);

    // Observe and such
    lcb_MULTICMD_CTX *ctx = lcb_observe3_ctxnew(instance);
    lcb_CMDOBSERVE observe{};
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, ctx->add_observe(ctx, &observe));
    ctx->fail(ctx);

    lcb_durability_opts_t dopts;
    memset(&dopts, 0, sizeof dopts);
    dopts.v.v0.persist_to = 1;

    ctx = lcb_endure3_ctxnew(instance, &dopts, nullptr);
    ASSERT_TRUE(ctx != nullptr);
    lcb_CMDENDURE endure{};
    ASSERT_EQ(LCB_ERR_EMPTY_KEY, ctx->add_endure(ctx, &endure));
    ctx->fail(ctx);

    lcb_CMDSTATS *stats;
    lcb_cmdstats_create(&stats);
    ASSERT_EQ(LCB_SUCCESS, lcb_stats(instance, nullptr, stats));
    lcb_cmdstats_destroy(stats);
    lcb_sched_fail(instance);
}

template <typename T>
static bool ctlSet(lcb_INSTANCE *instance, int setting, T val)
{
    lcb_STATUS err = lcb_cntl(instance, LCB_CNTL_SET, setting, &val);
    return err == LCB_SUCCESS;
}

template <>
bool ctlSet<const char *>(lcb_INSTANCE *instance, int setting, const char *val)
{
    return lcb_cntl(instance, LCB_CNTL_SET, setting, (void *)val) == LCB_SUCCESS;
}

template <typename T>
static T ctlGet(lcb_INSTANCE *instance, int setting)
{
    T tmp;
    lcb_STATUS err = lcb_cntl(instance, LCB_CNTL_GET, setting, &tmp);
    EXPECT_EQ(LCB_SUCCESS, err);
    return tmp;
}
template <typename T>
static void ctlGetSet(lcb_INSTANCE *instance, int setting, T val)
{
    EXPECT_TRUE(ctlSet<T>(instance, setting, val));
    EXPECT_EQ(val, ctlGet<T>(instance, setting));
}

template <>
void ctlGetSet<const char *>(lcb_INSTANCE *instance, int setting, const char *val)
{
    EXPECT_TRUE(ctlSet<const char *>(instance, setting, val));
    EXPECT_STREQ(val, ctlGet<const char *>(instance, setting));
}

static bool ctlSetInt(lcb_INSTANCE *instance, int setting, int val)
{
    return ctlSet<int>(instance, setting, val);
}
static int ctlGetInt(lcb_INSTANCE *instance, int setting)
{
    return ctlGet<int>(instance, setting);
}
static bool ctlSetU32(lcb_INSTANCE *instance, int setting, lcb_U32 val)
{
    return ctlSet<lcb_U32>(instance, setting, val);
}

TEST_F(MockUnitTest, testCtls)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    lcb_STATUS err;
    createConnection(hw, &instance);

    ctlGetSet<lcb_U32>(instance, LCB_CNTL_OP_TIMEOUT, UINT_MAX);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_VIEW_TIMEOUT, UINT_MAX);

    ASSERT_EQ(LCB_TYPE_BUCKET, ctlGet<lcb_INSTANCE_TYPE>(instance, LCB_CNTL_HANDLETYPE));
    ASSERT_FALSE(ctlSet<lcb_INSTANCE_TYPE>(instance, LCB_CNTL_HANDLETYPE, LCB_TYPE_BUCKET));

    auto *cfg = ctlGet<lcbvb_CONFIG *>(instance, LCB_CNTL_VBCONFIG);
    // Do we have a way to verify this?
    ASSERT_FALSE(cfg == nullptr);
    ASSERT_GT(cfg->nsrv, (unsigned int)0);

    auto io = ctlGet<lcb_io_opt_t>(instance, LCB_CNTL_IOPS);
    ASSERT_TRUE(io == instance->getIOT()->p);
    // Try to set it?
    ASSERT_FALSE(ctlSet<lcb_io_opt_t>(instance, LCB_CNTL_IOPS, (lcb_io_opt_t) "Hello"));

    // Map a key
    lcb_cntl_vbinfo_t vbi = {0};
    vbi.v.v0.key = "123";
    vbi.v.v0.nkey = 3;
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBMAP, &vbi);
    ASSERT_EQ(LCB_SUCCESS, err);

    // Try to modify it?
    err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_VBMAP, &vbi);
    ASSERT_NE(LCB_SUCCESS, err);

    ctlGetSet<lcb_ipv6_t>(instance, LCB_CNTL_IP6POLICY, LCB_IPV6_DISABLED);
    ctlGetSet<lcb_ipv6_t>(instance, LCB_CNTL_IP6POLICY, LCB_IPV6_ONLY);
    ctlGetSet<lcb_SIZE>(instance, LCB_CNTL_CONFERRTHRESH, UINT_MAX);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_DURABILITY_TIMEOUT, UINT_MAX);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_DURABILITY_INTERVAL, UINT_MAX);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_HTTP_TIMEOUT, UINT_MAX);
    ctlGetSet<int>(instance, LCB_CNTL_IOPS_DLOPEN_DEBUG, 55);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_CONFIGURATION_TIMEOUT, UINT_MAX);

    ctlGetSet<int>(instance, LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS, 1);
    ctlGetSet<int>(instance, LCB_CNTL_RANDOMIZE_BOOTSTRAP_HOSTS, 0);

    ASSERT_EQ(0, ctlGetInt(instance, LCB_CNTL_CONFIG_CACHE_LOADED));
    ASSERT_FALSE(ctlSetInt(instance, LCB_CNTL_CONFIG_CACHE_LOADED, 99));

    ctlGetSet<const char *>(instance, LCB_CNTL_FORCE_SASL_MECH, "SECRET");

    ctlGetSet<int>(instance, LCB_CNTL_MAX_REDIRECTS, SHRT_MAX);
    ctlGetSet<int>(instance, LCB_CNTL_MAX_REDIRECTS, -1);
    ctlGetSet<int>(instance, LCB_CNTL_MAX_REDIRECTS, 0);

    // LCB_CNTL_LOGGER handled in other tests

    ctlGetSet<lcb_U32>(instance, LCB_CNTL_CONFDELAY_THRESH, UINT_MAX);

    // CONFIG_TRANSPORT. Test that we shouldn't be able to set it
    ASSERT_FALSE(ctlSet<lcb_BOOTSTRAP_TRANSPORT>(instance, LCB_CNTL_CONFIG_TRANSPORT, LCB_CONFIG_TRANSPORT_LIST_END));

    ctlGetSet<lcb_U32>(instance, LCB_CNTL_CONFIG_NODE_TIMEOUT, UINT_MAX);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_HTCONFIG_IDLE_TIMEOUT, UINT_MAX);

    ASSERT_FALSE(ctlSet<const char *>(instance, LCB_CNTL_CHANGESET, "deadbeef"));
    ASSERT_FALSE(ctlGet<const char *>(instance, LCB_CNTL_CHANGESET) == nullptr);
    ctlGetSet<const char *>(instance, LCB_CNTL_CONFIGCACHE, "/foo/bar/baz");
    ASSERT_FALSE(ctlSetInt(instance, LCB_CNTL_SSL_MODE, 90));
    ASSERT_GE(ctlGetInt(instance, LCB_CNTL_SSL_MODE), 0);
    ASSERT_FALSE(ctlSet<const char *>(instance, LCB_CNTL_SSL_CACERT, "/tmp"));

    lcb_U32 ro_in, ro_out;
    ro_in = LCB_RETRYOPT_CREATE(LCB_RETRY_ON_SOCKERR, LCB_RETRY_CMDS_GET);
    ASSERT_TRUE(ctlSet<lcb_U32>(instance, LCB_CNTL_RETRYMODE, ro_in));

    ro_out = LCB_RETRYOPT_CREATE(LCB_RETRY_ON_SOCKERR, 0);
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_RETRYMODE, &ro_out);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_RETRY_CMDS_GET, LCB_RETRYOPT_GETPOLICY(ro_out));

    ASSERT_EQ(LCB_SUCCESS, lcb_cntl_string(instance, "retry_policy", "topochange:get"));
    ro_out = LCB_RETRYOPT_CREATE(LCB_RETRY_ON_TOPOCHANGE, 0);
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_RETRYMODE, &ro_out);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_RETRY_CMDS_GET, LCB_RETRYOPT_GETPOLICY(ro_out));

    ctlGetSet<int>(instance, LCB_CNTL_HTCONFIG_URLTYPE, LCB_HTCONFIG_URLTYPE_COMPAT);
    ctlGetSet<int>(instance, LCB_CNTL_COMPRESSION_OPTS, LCB_COMPRESS_FORCE);

    ctlSetU32(instance, LCB_CNTL_CONLOGGER_LEVEL, 3);
    lcb_U32 tmp;
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_CONLOGGER_LEVEL, &tmp);
    ASSERT_NE(LCB_SUCCESS, err);

    ctlGetSet<int>(instance, LCB_CNTL_DETAILED_ERRCODES, 1);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_RETRY_INTERVAL, UINT_MAX);
    ctlGetSet<lcb_SIZE>(instance, LCB_CNTL_HTTP_POOLSIZE, UINT_MAX);
    ctlGetSet<int>(instance, LCB_CNTL_HTTP_REFRESH_CONFIG_ON_ERROR, 0);

    // Allow timeouts to be expressed as fractional seconds.
    err = lcb_cntl_string(instance, "operation_timeout", "1.0");
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(1000000, ctlGet<lcb_U32>(instance, LCB_CNTL_OP_TIMEOUT));
    err = lcb_cntl_string(instance, "operation_timeout", "0.255");
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(255000, ctlGet<lcb_U32>(instance, LCB_CNTL_OP_TIMEOUT));

    // Test default for nmv retry
    int itmp = ctlGetInt(instance, LCB_CNTL_RETRY_NMV_IMM);
    ASSERT_NE(1, itmp);

    err = lcb_cntl_string(instance, "retry_nmv_imm", "0");
    ASSERT_EQ(LCB_SUCCESS, err);
    itmp = ctlGetInt(instance, LCB_CNTL_RETRY_NMV_IMM);
    ASSERT_EQ(0, itmp);
}

TEST_F(MockUnitTest, testConflictingOptions)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    const char *key = "key";
    size_t nkey = 3;
    const char *value = "value";
    size_t nvalue = 5;
    lcb_STATUS err;

    lcb_CMDSTORE *scmd;
    lcb_cmdstore_create(&scmd, LCB_STORE_APPEND);
    ASSERT_EQ(LCB_ERR_OPTIONS_CONFLICT, lcb_cmdstore_expiry(scmd, 1));
    ASSERT_EQ(LCB_ERR_OPTIONS_CONFLICT, lcb_cmdstore_flags(scmd, 99));
    lcb_cmdstore_destroy(scmd);

    lcb_cmdstore_create(&scmd, LCB_STORE_INSERT);
    lcb_cmdstore_key(scmd, key, nkey);
    ASSERT_EQ(LCB_ERR_INVALID_ARGUMENT, lcb_cmdstore_cas(scmd, 0xdeadbeef));

    lcb_cmdstore_cas(scmd, 0);
    err = lcb_store(instance, nullptr, scmd);
    lcb_cmdstore_destroy(scmd);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_CMDCOUNTER *ccmd;
    lcb_cmdcounter_create(&ccmd);

    lcb_cmdcounter_key(ccmd, key, nkey);

    err = lcb_cmdcounter_expiry(ccmd, 10);
    ASSERT_EQ(LCB_ERR_OPTIONS_CONFLICT, err);

    lcb_cmdcounter_initial(ccmd, 0);
    err = lcb_cmdcounter_expiry(ccmd, 10);
    ASSERT_EQ(LCB_SUCCESS, err);
    err = lcb_counter(instance, nullptr, ccmd);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_cmdcounter_destroy(ccmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

TEST_F(MockUnitTest, testDump)
{
    const char *fpname;
#ifdef _WIN32
    fpname = "NUL:";
#else
    fpname = "/dev/null";
#endif
    FILE *fp = fopen(fpname, "w");
    if (!fp) {
        perror(fpname);
        return;
    }

    // Simply try to dump the instance;
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);
    std::vector<std::string> keys;
    genDistKeys(LCBT_VBCONFIG(instance), keys);
    for (auto &key : keys) {
        storeKey(instance, key, key);
    }
    lcb_dump(instance, fp, LCB_DUMP_ALL);
    fclose(fp);
}

TEST_F(MockUnitTest, testRefreshConfig)
{
    SKIP_UNLESS_MOCK()
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);
    lcb_refresh_config(instance);
    lcb_wait(instance, LCB_WAIT_NOCHECK);
}

extern "C" {
static void tickOpCb(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    int *p;
    lcb_respstore_cookie(resp, (void **)&p);
    *p -= 1;
    EXPECT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
}
}

TEST_F(MockUnitTest, testTickLoop)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS err;
    createConnection(hw, &instance);

    const char *key = "tickKey";
    const char *value = "tickValue";

    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)tickOpCb);
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, key, strlen(key));
    lcb_cmdstore_value(cmd, value, strlen(value));

    err = lcb_tick_nowait(instance);
    if (err == LCB_ERR_SDK_FEATURE_UNAVAILABLE) {
        fprintf(stderr, "Current event loop does not support tick!");
        return;
    }

    lcb_sched_enter(instance);
    int counter = 0;
    for (int ii = 0; ii < 10; ii++) {
        err = lcb_store(instance, &counter, cmd);
        ASSERT_EQ(LCB_SUCCESS, err);
        counter++;
    }
    lcb_cmdstore_destroy(cmd);

    lcb_sched_leave(instance);
    while (counter) {
        lcb_tick_nowait(instance);
    }
}

TEST_F(MockUnitTest, testEmptyCtx)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS err = LCB_SUCCESS;
    createConnection(hw, &instance);

    lcb_MULTICMD_CTX *mctx;
    lcb_durability_opts_t duropts = {0};
    duropts.v.v0.persist_to = 1;
    mctx = lcb_endure3_ctxnew(instance, &duropts, &err);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_FALSE(mctx == nullptr);

    err = mctx->done(mctx, nullptr);
    ASSERT_NE(LCB_SUCCESS, err);

    mctx = lcb_observe3_ctxnew(instance);
    ASSERT_FALSE(mctx == nullptr);
    err = mctx->done(mctx, nullptr);
    ASSERT_NE(LCB_SUCCESS, err);
}

TEST_F(MockUnitTest, testMultiCreds)
{
    SKIP_IF_CLUSTER_VERSION_IS_HIGHER_THAN(MockEnvironment::VERSION_50)
    using lcb::Authenticator;

    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    lcb_BUCKETCRED cred;
    cred[0] = "protected";
    cred[1] = "secret";
    lcb_STATUS rc = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_BUCKET_CRED, cred);
    ASSERT_EQ(LCB_SUCCESS, rc);
    Authenticator &auth = *instance->settings->auth;
    auto res = auth.buckets().find("protected");
    ASSERT_NE(auth.buckets().end(), res);
    ASSERT_EQ("secret", res->second);
}

extern "C" {
static void appendE2BIGcb(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    lcb_STATUS *e;
    lcb_respstore_cookie(resp, (void **)&e);
    *e = lcb_respstore_status(resp);
}
}

TEST_F(MockUnitTest, testAppendE2BIG)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)appendE2BIGcb);

    lcb_STATUS err, res;

    const char *key = "key";
    size_t nkey = strlen(key);

    size_t nvalue1 = 20 * 1024 * 1024;
    void *value1 = calloc(nvalue1, sizeof(char));
    lcb_CMDSTORE *scmd;
    lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(scmd, key, nkey);
    lcb_cmdstore_value(scmd, (const char *)value1, nvalue1);
    err = lcb_store(instance, &res, scmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_cmdstore_destroy(scmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, res);
    free(value1);

    size_t nvalue2 = 1 * 1024 * 1024;
    void *value2 = calloc(nvalue2, sizeof(char));
    lcb_CMDSTORE *acmd;
    lcb_cmdstore_create(&acmd, LCB_STORE_APPEND);
    lcb_cmdstore_key(acmd, key, nkey);
    lcb_cmdstore_value(acmd, (const char *)value2, nvalue2);
    err = lcb_store(instance, &res, acmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_cmdstore_destroy(acmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_ERR_VALUE_TOO_LARGE, res);
    free(value2);
}

extern "C" {
static void existsCb(lcb_INSTANCE *, int, const lcb_RESPEXISTS *rb)
{
    int *e;
    lcb_respexists_cookie(rb, (void **)&e);
    *e = lcb_respexists_is_found(rb);
}
}

TEST_F(MockUnitTest, testExists)
{
    SKIP_IF_MOCK()
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    lcb_install_callback(instance, LCB_CALLBACK_EXISTS, (lcb_RESPCALLBACK)existsCb);

    std::stringstream ss;
    ss << "testExistsKey" << time(nullptr);
    std::string key = ss.str();

    lcb_STATUS err;
    lcb_CMDEXISTS *cmd;
    int res;

    lcb_cmdexists_create(&cmd);
    lcb_cmdexists_key(cmd, key.data(), key.size());
    res = 0xff;
    err = lcb_exists(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_cmdexists_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(0, res);

    storeKey(instance, key, "value");

    lcb_cmdexists_create(&cmd);
    lcb_cmdexists_key(cmd, key.data(), key.size());
    res = 0;
    err = lcb_exists(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_cmdexists_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(1, res);
}
