/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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
#include "config.h"
#include "iotests.h"
#include <map>
#include <climits>
#include <algorithm>
#include "internal.h" /* vbucket_* things from lcb_t */
#include "auth-priv.h"
#include <lcbio/iotable.h>
#include "bucketconfig/bc_http.h"

#define LOGARGS(instance, lvl) \
    instance->settings, "tests-MUT", LCB_LOG_##lvl, __FILE__, __LINE__


extern "C" {
static void timings_callback(lcb_t, const void *cookie, lcb_timeunit_t,
    lcb_U32, lcb_U32, lcb_U32, lcb_U32)
{
    bool *bPtr = (bool *)cookie;
    *bPtr = true;
}
}

TEST_F(MockUnitTest, testTimings)
{
    lcb_t instance;
    HandleWrap hw;
    bool called = false;
    createConnection(hw, instance);

    lcb_enable_timings(instance);

    lcb_store_cmd_t storecmd(LCB_SET, "counter", 7, "0", 1);
    lcb_store_cmd_t *storecmds[] = { &storecmd };

    lcb_store(instance, NULL, 1, storecmds);
    lcb_wait(instance);
    lcb_get_timings(instance, &called, timings_callback);
    lcb_disable_timings(instance);
    ASSERT_TRUE(called);
}


namespace {
struct TimingInfo {
    lcb_U64 ns_start;
    lcb_U64 ns_end;
    size_t count;

    TimingInfo() : ns_start(-1), ns_end(-1), count(-1) {}

    bool operator<(const TimingInfo& other) const {
        return other.ns_start > ns_start;
    }
    bool operator>(const TimingInfo& other) const {
        return ns_start > other.ns_start;
    }

    bool valid() const {
        return count != -1;
    }
};

static lcb_U64 intervalToNsec(lcb_U64 interval, lcb_timeunit_t unit)
{
    if (unit == LCB_TIMEUNIT_NSEC) {
        return interval;
    } else if (unit == LCB_TIMEUNIT_USEC) {
        return interval * 1000;
    } else if (unit == LCB_TIMEUNIT_MSEC) {
        return interval * 1000000;
    } else if (unit == LCB_TIMEUNIT_SEC) {
        return interval * 1000000000;
    } else {
        return -1;
    }
}

struct LcbTimings {
    LcbTimings() {}
    std::vector<TimingInfo> m_info;
    void load(lcb_t);
    void clear();

    TimingInfo infoAt(hrtime_t duration, lcb_timeunit_t unit = LCB_TIMEUNIT_NSEC);
    size_t countAt(hrtime_t duration, lcb_timeunit_t unit = LCB_TIMEUNIT_NSEC) {
        return infoAt(duration, unit).count;
    }

    void dump() const;
};

extern "C" {
static void load_timings_callback(lcb_t, const void *cookie, lcb_timeunit_t unit,
    lcb_U32 min, lcb_U32 max, lcb_U32 total, lcb_U32 maxtotal)
{
    lcb_U64 start = intervalToNsec(min, unit);
    lcb_U64 end = intervalToNsec(max, unit);
    LcbTimings *timings = (LcbTimings *)cookie;
    TimingInfo info;

    info.ns_start = start;
    info.ns_end = end;
    info.count = total;
    timings->m_info.push_back(info);
}
} // extern "C"

void
LcbTimings::load(lcb_t instance)
{
    lcb_get_timings(instance, this, load_timings_callback);
    std::sort(m_info.begin(), m_info.end());
}

TimingInfo
LcbTimings::infoAt(hrtime_t duration, lcb_timeunit_t unit)
{
    duration = intervalToNsec(duration, unit);
    std::vector<TimingInfo>::iterator ii;
    for (ii = m_info.begin(); ii != m_info.end(); ++ii) {
        if (ii->ns_start <= duration && ii->ns_end > duration) {
            return *ii;
        }
    }
    return TimingInfo();
}

void
LcbTimings::dump() const
{
    std::vector<TimingInfo>::const_iterator ii = m_info.begin();
    for (; ii != m_info.end(); ii++) {
        if (ii->ns_end < 1000) {
            printf("[%llu-%llu ns] %lu\n",
                ii->ns_start, ii->ns_end, ii->count);
        } else if (ii->ns_end < 10000000) {
            printf("[%llu-%llu us] %lu\n",
                ii->ns_start / 1000, ii->ns_end / 1000, ii->count);
        } else {
            printf("[%llu-%llu ms] %lu\n",
                ii->ns_start / 1000000, ii->ns_end / 1000000, ii->count);
        }
    }
}

} // namespace{

struct UnitInterval {
    lcb_U64 n;
    lcb_timeunit_t unit;
    UnitInterval(lcb_U64 n, lcb_timeunit_t unit) : n(n), unit(unit) {}
};

static void addTiming(lcb_t instance, const UnitInterval& interval)
{
    hrtime_t n = intervalToNsec(interval.n, interval.unit);
    lcb_histogram_record(instance->kv_timings, n);
}


TEST_F(MockUnitTest, testTimingsEx)
{
    lcb_t instance;
    HandleWrap hw;

    createConnection(hw, instance);
    lcb_disable_timings(instance);
    lcb_enable_timings(instance);

    std::vector<UnitInterval> intervals;
    intervals.push_back(UnitInterval(1, LCB_TIMEUNIT_NSEC));
    intervals.push_back(UnitInterval(250, LCB_TIMEUNIT_NSEC));
    intervals.push_back(UnitInterval(4, LCB_TIMEUNIT_USEC));
    intervals.push_back(UnitInterval(32, LCB_TIMEUNIT_USEC));
    intervals.push_back(UnitInterval(942, LCB_TIMEUNIT_USEC));
    intervals.push_back(UnitInterval(1243, LCB_TIMEUNIT_USEC));
    intervals.push_back(UnitInterval(1732, LCB_TIMEUNIT_USEC));
    intervals.push_back(UnitInterval(5630, LCB_TIMEUNIT_USEC));
    intervals.push_back(UnitInterval(42, LCB_TIMEUNIT_MSEC));
    intervals.push_back(UnitInterval(434, LCB_TIMEUNIT_MSEC));

    intervals.push_back(UnitInterval(8234, LCB_TIMEUNIT_MSEC));
    intervals.push_back(UnitInterval(1294, LCB_TIMEUNIT_MSEC));
    intervals.push_back(UnitInterval(48, LCB_TIMEUNIT_SEC));

    for (size_t ii = 0; ii < intervals.size(); ++ii) {
        addTiming(instance, intervals[ii]);
    }

    // Ensure they all exist, at least. Currently we bundle everything
    LcbTimings timings;
    timings.load(instance);

    //timings.dump();

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
}


struct async_ctx {
    int count;
    lcbio_pTABLE table;
};

extern "C" {
static void dtor_callback(const void *cookie)
{
    async_ctx *ctx = (async_ctx *)cookie;
    ctx->count++;
    IOT_STOP(ctx->table);
}
}

TEST_F(MockUnitTest, testAsyncDestroy)
{
    lcb_t instance;
    createConnection(instance);
    lcbio_pTABLE iot = instance->iotable;
    lcb_settings *settings = instance->settings;

    storeKey(instance, "foo", "bar");
    // Now destroy the instance
    async_ctx ctx;
    ctx.count = 0;
    ctx.table = iot;
    lcb_set_destroy_callback(instance, dtor_callback);
    lcb_destroy_async(instance, &ctx);
    lcb_settings_ref(settings);
    lcbio_table_ref(iot);
    lcb_run_loop(instance);
    lcb_settings_unref(settings);
    lcbio_table_unref(iot);
    ASSERT_EQ(1, ctx.count);
}

TEST_F(MockUnitTest, testGetHostInfo)
{
    lcb_t instance;
    createConnection(instance);
    lcb_config_transport_t tx;
    const char *hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG, 0);
    ASSERT_FALSE(hoststr == NULL);

    hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG_CONNECTED, 0);
    lcb_error_t err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_CONFIG_TRANSPORT, &tx);

    ASSERT_EQ(LCB_SUCCESS, err);
    if (tx == LCB_CONFIG_TRANSPORT_HTTP) {
        ASSERT_FALSE(hoststr == NULL);
        hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG_CONNECTED, 99);
        ASSERT_FALSE(hoststr == NULL);
    } else {
        if (hoststr) {
            printf("%s\n", hoststr);
        }
        ASSERT_TRUE(hoststr == NULL);
    }

    // Get any data node
    using std::map;
    using std::string;
    map<string,bool> smap;

    // Ensure we only get unique nodes
    for (lcb_S32 ii = 0; ii < lcb_get_num_nodes(instance); ii++) {
        const char *cur = lcb_get_node(instance, LCB_NODE_DATA, ii);
        ASSERT_FALSE(cur == NULL);
        ASSERT_FALSE(smap[cur]);
        smap[cur] = true;
    }
    lcb_destroy(instance);

    // Try with no connection
    err = lcb_create(&instance, NULL);
    ASSERT_EQ(LCB_SUCCESS, err);

    hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG_CONNECTED, 0);
    ASSERT_TRUE(NULL == hoststr);

    hoststr = lcb_get_node(instance, LCB_NODE_HTCONFIG, 0);
    ASSERT_TRUE(NULL == hoststr);



    // These older API functions are special as they should never return NULL
    hoststr = lcb_get_host(instance);
    ASSERT_FALSE(hoststr == NULL);
    ASSERT_STREQ("localhost", hoststr);

    hoststr = lcb_get_port(instance);
    ASSERT_FALSE(hoststr == NULL);
    ASSERT_STREQ("8091", hoststr);

    lcb_destroy(instance);
}

TEST_F(MockUnitTest, testEmptyKeys)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    union {
        lcb_CMDGET get;
        lcb_CMDSTORE store;
        lcb_CMDCOUNTER counter;
        lcb_CMDENDURE endure;
        lcb_CMDOBSERVE observe;
        lcb_CMDTOUCH touch;
        lcb_CMDUNLOCK unlock;
        lcb_CMDGETREPLICA rget;
        lcb_CMDBASE base;
        lcb_CMDSTATS stats;
    } u;
    memset(&u, 0, sizeof u);

    lcb_sched_enter(instance);

    ASSERT_EQ(LCB_EMPTY_KEY, lcb_get3(instance, NULL, &u.get));
    ASSERT_EQ(LCB_EMPTY_KEY, lcb_store3(instance, NULL, &u.store));
    ASSERT_EQ(LCB_EMPTY_KEY, lcb_counter3(instance, NULL, &u.counter));
    ASSERT_EQ(LCB_EMPTY_KEY, lcb_touch3(instance, NULL, &u.touch));
    ASSERT_EQ(LCB_EMPTY_KEY, lcb_unlock3(instance, NULL, &u.unlock));
    ASSERT_EQ(LCB_EMPTY_KEY, lcb_rget3(instance, NULL, &u.rget));

    // Observe and such
    lcb_MULTICMD_CTX *ctx = lcb_observe3_ctxnew(instance);
    ASSERT_EQ(LCB_EMPTY_KEY, ctx->addcmd(ctx, (lcb_CMDBASE*)&u.observe));
    ctx->fail(ctx);

    lcb_durability_opts_t dopts;
    memset(&dopts, 0, sizeof dopts);
    dopts.v.v0.persist_to = 1;

    ctx = lcb_endure3_ctxnew(instance, &dopts, NULL);
    ASSERT_TRUE(ctx != NULL);
    ASSERT_EQ(LCB_EMPTY_KEY, ctx->addcmd(ctx, (lcb_CMDBASE*)&u.endure));
    ctx->fail(ctx);

    ASSERT_EQ(LCB_SUCCESS, lcb_stats3(instance, NULL, &u.stats));
    lcb_sched_fail(instance);
}

template <typename T>
static bool ctlSet(lcb_t instance, int setting, T val)
{
    lcb_error_t err = lcb_cntl(instance, LCB_CNTL_SET, setting, &val);
    return err == LCB_SUCCESS;
}

template<>
bool ctlSet<const char*>(lcb_t instance, int setting, const char *val)
{
    return lcb_cntl(instance, LCB_CNTL_SET, setting, (void*)val) == LCB_SUCCESS;
}

template <typename T>
static T ctlGet(lcb_t instance, int setting)
{
    T tmp;
    lcb_error_t err = lcb_cntl(instance, LCB_CNTL_GET, setting, &tmp);
    EXPECT_EQ(LCB_SUCCESS, err);
    return tmp;
}
template <typename T>
static void ctlGetSet(lcb_t instance, int setting, T val) {
    EXPECT_TRUE(ctlSet<T>(instance, setting, val));
    EXPECT_EQ(val, ctlGet<T>(instance, setting));
}

template <>
void ctlGetSet<const char*>(lcb_t instance, int setting, const char *val)
{
    EXPECT_TRUE(ctlSet<const char*>(instance, setting, val));
    EXPECT_STREQ(val, ctlGet<const char*>(instance, setting));
}

static bool ctlSetInt(lcb_t instance, int setting, int val) {
    return ctlSet<int>(instance, setting, val);
}
static int ctlGetInt(lcb_t instance, int setting) {
    return ctlGet<int>(instance, setting);
}
static bool ctlSetU32(lcb_t instance, int setting, lcb_U32 val) {
    return ctlSet<lcb_U32>(instance, setting, val);
}
static lcb_U32 ctlGetU32(lcb_t instance, int setting) {
    return ctlGet<lcb_U32>(instance, setting);
}

TEST_F(MockUnitTest, testCtls)
{
    lcb_t instance;
    HandleWrap hw;
    lcb_error_t err;
    createConnection(hw, instance);

    ctlGetSet<lcb_U32>(instance, LCB_CNTL_OP_TIMEOUT, UINT_MAX);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_VIEW_TIMEOUT, UINT_MAX);

    ASSERT_EQ(LCB_TYPE_BUCKET, ctlGet<lcb_type_t>(instance, LCB_CNTL_HANDLETYPE));
    ASSERT_FALSE(ctlSet<lcb_type_t>(instance, LCB_CNTL_HANDLETYPE, LCB_TYPE_BUCKET));

    lcbvb_CONFIG *cfg = ctlGet<lcbvb_CONFIG*>(instance, LCB_CNTL_VBCONFIG);
    // Do we have a way to verify this?
    ASSERT_FALSE(cfg == NULL);
    ASSERT_GT(cfg->nsrv, (unsigned int)0);

    lcb_io_opt_t io = ctlGet<lcb_io_opt_t>(instance, LCB_CNTL_IOPS);
    ASSERT_TRUE(io == instance->getIOT()->p);
    // Try to set it?
    ASSERT_FALSE(ctlSet<lcb_io_opt_t>(instance, LCB_CNTL_IOPS, (lcb_io_opt_t)"Hello"));

    // Map a key
    lcb_cntl_vbinfo_t vbi = { 0 };
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

    ctlGetSet<const char*>(instance, LCB_CNTL_FORCE_SASL_MECH, "SECRET");

    ctlGetSet<int>(instance, LCB_CNTL_MAX_REDIRECTS, SHRT_MAX);
    ctlGetSet<int>(instance, LCB_CNTL_MAX_REDIRECTS, -1);
    ctlGetSet<int>(instance, LCB_CNTL_MAX_REDIRECTS, 0);

    // LCB_CNTL_LOGGER handled in other tests

    ctlGetSet<lcb_U32>(instance, LCB_CNTL_CONFDELAY_THRESH, UINT_MAX);

    // CONFIG_TRANSPORT. Test that we shouldn't be able to set it
    ASSERT_FALSE(ctlSet<lcb_config_transport_t>(
        instance, LCB_CNTL_CONFIG_TRANSPORT, LCB_CONFIG_TRANSPORT_LIST_END));

    ctlGetSet<lcb_U32>(instance, LCB_CNTL_CONFIG_NODE_TIMEOUT, UINT_MAX);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_HTCONFIG_IDLE_TIMEOUT, UINT_MAX);

    ASSERT_FALSE(ctlSet<const char*>(instance, LCB_CNTL_CHANGESET, "deadbeef"));
    ASSERT_FALSE(ctlGet<const char*>(instance, LCB_CNTL_CHANGESET) == NULL);
    ctlGetSet<const char*>(instance, LCB_CNTL_CONFIGCACHE, "/foo/bar/baz");
    ASSERT_FALSE(ctlSetInt(instance, LCB_CNTL_SSL_MODE, 90));
    ASSERT_GE(ctlGetInt(instance, LCB_CNTL_SSL_MODE), 0);
    ASSERT_FALSE(ctlSet<const char*>(instance, LCB_CNTL_SSL_CACERT, "/tmp"));

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
    ASSERT_EQ(LCB_RETRY_CMDS_GET, LCB_RETRYOPT_GETPOLICY(ro_out));


    ctlGetSet<int>(instance, LCB_CNTL_HTCONFIG_URLTYPE, LCB_HTCONFIG_URLTYPE_COMPAT);
    ctlGetSet<int>(instance, LCB_CNTL_COMPRESSION_OPTS, LCB_COMPRESS_FORCE);

    ctlSetU32(instance, LCB_CNTL_CONLOGGER_LEVEL, 3);
    lcb_U32 tmp;
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_CONLOGGER_LEVEL, &tmp);
    ASSERT_NE(LCB_SUCCESS, err);

    ctlGetSet<int>(instance, LCB_CNTL_DETAILED_ERRCODES, 1);
    ctlGetSet<lcb_U32>(instance, LCB_CNTL_RETRY_INTERVAL, UINT_MAX);
    ctlGetSet<float>(instance, LCB_CNTL_RETRY_BACKOFF, (float)3.4);
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
    ASSERT_NE(0, itmp);

    err = lcb_cntl_string(instance, "retry_nmv_imm", "0");
    ASSERT_EQ(LCB_SUCCESS, err);
    itmp = ctlGetInt(instance, LCB_CNTL_RETRY_NMV_IMM);
    ASSERT_EQ(0, itmp);
}

TEST_F(MockUnitTest, testConflictingOptions)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    lcb_sched_enter(instance);
    const char *key = "key";
    size_t nkey = 3;
    const char *value = "value";
    size_t nvalue = 5;

    lcb_CMDSTORE scmd = { 0 };
    scmd.operation = LCB_APPEND;
    scmd.exptime = 1;
    LCB_CMD_SET_KEY(&scmd, key, nkey);
    LCB_CMD_SET_VALUE(&scmd, value, nvalue);

    lcb_error_t err;
    err = lcb_store3(instance, NULL, &scmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, err);
    scmd.exptime = 0;
    scmd.flags = 99;
    err = lcb_store3(instance, NULL, &scmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, err);

    scmd.flags = 0;
    scmd.exptime = 0;
    err = lcb_store3(instance, NULL, &scmd);
    ASSERT_EQ(LCB_SUCCESS, err);

    scmd.operation = LCB_ADD;
    scmd.cas = 0xdeadbeef;
    err = lcb_store3(instance, NULL, &scmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, err);

    scmd.cas = 0;
    err = lcb_store3(instance, NULL, &scmd);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_CMDCOUNTER ccmd = { 0 };
    LCB_CMD_SET_KEY(&ccmd, key, nkey);
    ccmd.cas = 0xdeadbeef;
    err = lcb_counter3(instance, NULL, &ccmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, err);
    ccmd.cas = 0;
    err = lcb_counter3(instance, NULL, &ccmd);
    ASSERT_EQ(LCB_SUCCESS, err);

    ccmd.exptime = 10;
    ccmd.initial = 0;
    ccmd.create = 0;
    err = lcb_counter3(instance, NULL, &ccmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, err);
    ccmd.create = 1;
    err = lcb_counter3(instance, NULL, &ccmd);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_CMDGET gcmd = { 0 };
    LCB_CMD_SET_KEY(&gcmd, key, nkey);
    gcmd.cas = 0xdeadbeef;
    err = lcb_get3(instance, NULL, &gcmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, err);

    gcmd.cas = 0;
    err = lcb_get3(instance, NULL, &gcmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_fail(instance);
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
    lcb_t instance;
    createConnection(hw, instance);
    std::vector<std::string> keys;
    genDistKeys(LCBT_VBCONFIG(instance), keys);
    for (size_t ii = 0; ii < keys.size(); ii++) {
        storeKey(instance, keys[ii], keys[ii]);
    }
    lcb_dump(instance, fp, LCB_DUMP_ALL);
    fclose(fp);
}

TEST_F(MockUnitTest, testRefreshConfig)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);
    lcb_refresh_config(instance);
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
}

extern "C" {
static void tickOpCb(lcb_t, int, const lcb_RESPBASE *rb)
{
    int *p = (int *)rb->cookie;
    *p -= 1;
    EXPECT_EQ(LCB_SUCCESS, rb->rc);
}
}

TEST_F(MockUnitTest, testTickLoop)
{
    HandleWrap hw;
    lcb_t instance;
    lcb_error_t err;
    createConnection(hw, instance);

    const char *key = "tickKey";
    const char *value = "tickValue";

    lcb_install_callback3(instance, LCB_CALLBACK_STORE, tickOpCb);
    lcb_CMDSTORE cmd = { 0 };
    cmd.operation = LCB_SET;
    LCB_CMD_SET_KEY(&cmd, key, strlen(key));
    LCB_CMD_SET_VALUE(&cmd, value, strlen(value));

    err = lcb_tick_nowait(instance);
    if (err == LCB_CLIENT_FEATURE_UNAVAILABLE) {
        fprintf(stderr, "Current event loop does not support tick!");
        return;
    }

    lcb_sched_enter(instance);
    int counter = 0;
    for (int ii = 0; ii < 10; ii++) {
        err = lcb_store3(instance, &counter, &cmd);
        ASSERT_EQ(LCB_SUCCESS, err);
        counter++;
    }

    lcb_sched_leave(instance);
    while (counter) {
        lcb_tick_nowait(instance);
    }
}

TEST_F(MockUnitTest, testEmptyCtx)
{
    HandleWrap hw;
    lcb_t instance;
    lcb_error_t err = LCB_SUCCESS;
    createConnection(hw, instance);

    lcb_MULTICMD_CTX *mctx;
    lcb_durability_opts_t duropts = { 0 };
    duropts.v.v0.persist_to = 1;
    mctx = lcb_endure3_ctxnew(instance, &duropts, &err);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_FALSE(mctx == NULL);

    err = mctx->done(mctx, NULL);
    ASSERT_NE(LCB_SUCCESS, err);

    mctx = lcb_observe3_ctxnew(instance);
    ASSERT_FALSE(mctx == NULL);
    err = mctx->done(mctx, NULL);
    ASSERT_NE(LCB_SUCCESS, err);
}

TEST_F(MockUnitTest, testMultiCreds)
{
    SKIP_IF_CLUSTER_VERSION_IS_HIGHER_THAN(MockEnvironment::VERSION_50);
    using lcb::Authenticator;

    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    lcb_BUCKETCRED cred;
    cred[0] = "protected";
    cred[1] = "secret";
    lcb_error_t rc = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_BUCKET_CRED, cred);
    ASSERT_EQ(LCB_SUCCESS, rc);
    Authenticator& auth = *instance->settings->auth;
    lcb::Authenticator::Map::const_iterator res = auth.buckets().find("protected");
    ASSERT_NE(auth.buckets().end(), res);
    ASSERT_EQ("secret", res->second);
}

extern "C" {
static void appendE2BIGcb(lcb_t, int, const lcb_RESPBASE *rb)
{
    lcb_error_t *e = (lcb_error_t *)rb->cookie;
    *e = rb->rc;
}
}

TEST_F(MockUnitTest, testAppendE2BIG)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, appendE2BIGcb);

    lcb_error_t err, res;

    const char *key = "key";
    size_t nkey = strlen(key);

    size_t nvalue1 = 20 * 1024 * 1024;
    void *value1 = malloc(nvalue1);
    lcb_CMDSTORE scmd = { 0 };
    scmd.operation = LCB_SET;
    LCB_CMD_SET_KEY(&scmd, key, nkey);
    LCB_CMD_SET_VALUE(&scmd, value1, nvalue1);
    err = lcb_store3(instance, &res, &scmd);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, res);
    free(value1);

    size_t nvalue2 = 1 * 1024 * 1024;
    void *value2 = malloc(nvalue2);
    lcb_CMDSTORE acmd = { 0 };
    acmd.operation = LCB_APPEND;
    LCB_CMD_SET_KEY(&acmd, key, nkey);
    LCB_CMD_SET_VALUE(&acmd, value2, nvalue2);
    err = lcb_store3(instance, &res, &acmd);
    lcb_wait(instance);
    ASSERT_EQ(LCB_E2BIG, res);
    free(value2);
}
