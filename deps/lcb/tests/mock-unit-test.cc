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
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include <map>

#include "server.h"
#include "mock-unit-test.h"
#include "mock-environment.h"
#include "internal.h" /* vbucket_* things from lcb_t */
#include "testutil.h"
#include "bucketconfig/bc_http.h"

#define LOGARGS(instance, lvl) \
    &instance->settings, "tests-MUT", LCB_LOG_##lvl, __FILE__, __LINE__

/**
 * Keep these around in case we do something useful here in the future
 */
void MockUnitTest::SetUp() {
    MockEnvironment::Reset();
}

extern "C" {
    static void error_callback(lcb_t instance,
                               lcb_error_t err,
                               const char *errinfo)
    {
        std::cerr << "Error " << lcb_strerror(instance, err) << std::endl;
        fflush(NULL);
        if (errinfo) {
            std::cerr << errinfo;
        }

        ASSERT_TRUE(false);
    }
}

void MockUnitTest::createConnection(HandleWrap &handle, lcb_t &instance)
{
    MockEnvironment::getInstance()->createConnection(handle, instance);
    (void)lcb_set_error_callback(handle.getLcb(), error_callback);
    ASSERT_EQ(LCB_SUCCESS, lcb_connect(handle.getLcb()));
    lcb_wait(handle.getLcb());
}

void MockUnitTest::createConnection(lcb_t &instance)
{
    MockEnvironment::getInstance()->createConnection(instance);
    (void)lcb_set_error_callback(instance, error_callback);
    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance);
}

void MockUnitTest::createConnection(HandleWrap &handle)
{
    lcb_t instance = NULL;
    createConnection(handle, instance);
}

extern "C" {
    static void flags_store_callback(lcb_t,
                                     const void *,
                                     lcb_storage_t operation,
                                     lcb_error_t error,
                                     const lcb_store_resp_t *resp)
    {
        ASSERT_EQ(LCB_SUCCESS, error);
        ASSERT_EQ(5, resp->v.v0.nkey);
        ASSERT_EQ(0, memcmp(resp->v.v0.key, "flags", 5));
        ASSERT_EQ(LCB_SET, operation);
    }

    static void flags_get_callback(lcb_t, const void *,
                                   lcb_error_t error,
                                   const lcb_get_resp_t *resp)
    {
        ASSERT_EQ(LCB_SUCCESS, error);
        ASSERT_EQ(5, resp->v.v0.nkey);
        ASSERT_EQ(0, memcmp(resp->v.v0.key, "flags", 5));
        ASSERT_EQ(1, resp->v.v0.nbytes);
        ASSERT_EQ(0, memcmp(resp->v.v0.bytes, "x", 1));
        ASSERT_EQ(0xdeadbeef, resp->v.v0.flags);
    }
}

TEST_F(MockUnitTest, testFlags)
{
    lcb_t instance;
    HandleWrap hw;

    createConnection(hw, instance);

    (void)lcb_set_get_callback(instance, flags_get_callback);
    (void)lcb_set_store_callback(instance, flags_store_callback);

    lcb_store_cmd_t storeCommand(LCB_SET, "flags", 5, "x", 1, 0xdeadbeef);
    lcb_store_cmd_t *storeCommands[] = { &storeCommand };

    ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, NULL, 1, storeCommands));
    // Wait for it to be persisted
    lcb_wait(instance);

    lcb_get_cmd_t cmd("flags", 5);
    lcb_get_cmd_t *cmds[] = { &cmd };
    ASSERT_EQ(LCB_SUCCESS, lcb_get(instance, NULL, 1, cmds));

    /* Wait for it to be received */
    lcb_wait(instance);
}


extern "C" {
    static void syncmode_store_callback(lcb_t,
                                        const void *cookie,
                                        lcb_storage_t,
                                        lcb_error_t error,
                                        const lcb_store_resp_t *)
    {
        int *status = (int *)cookie;
        *status = error;
    }
}

TEST_F(MockUnitTest, testSyncmodeDefault)
{

    lcb_t instance;
    HandleWrap hw;

    createConnection(hw, instance);
    ASSERT_EQ(LCB_ASYNCHRONOUS, lcb_behavior_get_syncmode(instance));
}

TEST_F(MockUnitTest, testSyncmodeBehaviorToggle)
{
    lcb_t instance;
    HandleWrap hw;

    createConnection(hw, instance);
    lcb_behavior_set_syncmode(instance, LCB_SYNCHRONOUS);
    ASSERT_EQ(LCB_SYNCHRONOUS, lcb_behavior_get_syncmode(instance));
}

TEST_F(MockUnitTest, testSyncStore)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_behavior_set_syncmode(instance, LCB_SYNCHRONOUS);
    ASSERT_EQ(LCB_SYNCHRONOUS, lcb_behavior_get_syncmode(instance));

    lcb_set_store_callback(instance, syncmode_store_callback);

    int cookie = 0xffff;
    lcb_store_cmd_t cmd(LCB_SET, "key", 3);
    lcb_store_cmd_t *cmds[] = { &cmd };
    lcb_error_t ret = lcb_store(instance, &cookie, 1, cmds);
    ASSERT_EQ(LCB_SUCCESS, ret);
    ASSERT_EQ((int)LCB_SUCCESS, cookie);
    cookie = 0xffff;

    cmd.v.v0.operation = LCB_ADD;
    ret = lcb_store(instance, &cookie, 1, cmds);
    ASSERT_TRUE(ret == LCB_KEY_EEXISTS &&
                cookie == LCB_KEY_EEXISTS);
}

extern "C" {
    static void timings_callback(lcb_t,
                                 const void *cookie,
                                 lcb_timeunit_t timeunit,
                                 lcb_uint32_t min,
                                 lcb_uint32_t max,
                                 lcb_uint32_t total,
                                 lcb_uint32_t maxtotal)
    {
        FILE *fp = (FILE *)cookie;
        if (fp != NULL) {
            fprintf(fp, "[%3u - %3u]", min, max);

            switch (timeunit) {
            case LCB_TIMEUNIT_NSEC:
                fprintf(fp, "ns");
                break;
            case LCB_TIMEUNIT_USEC:
                fprintf(fp, "us");
                break;
            case LCB_TIMEUNIT_MSEC:
                fprintf(fp, "ms");
                break;
            case LCB_TIMEUNIT_SEC:
                fprintf(fp, "s");
                break;
            default:
                ;
            }

            int num = (int)((float)20.0 * (float)total / (float)maxtotal);

            fprintf(fp, " |");
            for (int ii = 0; ii < num; ++ii) {
                fprintf(fp, "#");
            }

            fprintf(fp, " - %u\n", total);
        }
    }
}

TEST_F(MockUnitTest, testTimings)
{
    FILE *fp = stdout;
    if (getenv("LCB_VERBOSE_TESTS") == NULL) {
        fp = NULL;
    }

    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_enable_timings(instance);

    lcb_store_cmd_t storecmd(LCB_SET, "counter", 7, "0", 1);
    lcb_store_cmd_t *storecmds[] = { &storecmd };

    lcb_store(instance, NULL, 1, storecmds);
    lcb_wait(instance);
    for (int ii = 0; ii < 100; ++ii) {
        lcb_arithmetic_cmd_t acmd("counter", 7, 1);
        lcb_arithmetic_cmd_t *acmds[] = { &acmd };
        lcb_arithmetic(instance, NULL, 1, acmds);
        lcb_wait(instance);
    }
    if (fp) {
        fprintf(fp, "              +---------+---------+\n");
    }
    lcb_get_timings(instance, fp, timings_callback);
    if (fp) {
        fprintf(fp, "              +--------------------\n");
    }
    lcb_disable_timings(instance);
}


extern "C" {
    static void timeout_error_callback(lcb_t instance,
                                       lcb_error_t err,
                                       const char *errinfo)
    {
        if (err == LCB_ETIMEDOUT) {
            return;
        }
        std::cerr << "Error " << lcb_strerror(instance, err);
        if (errinfo) {
            std::cerr << errinfo;
        }
        std::cerr << std::endl;
        abort();
    }

    int timeout_seqno = 0;
    int timeout_stats_done = 0;

    static void timeout_store_callback(lcb_t,
                                       const void *cookie,
                                       lcb_storage_t,
                                       lcb_error_t error,
                                       const lcb_store_resp_t *)
    {
        lcb_io_opt_t io = (lcb_io_opt_t)cookie;

        ASSERT_EQ(LCB_SUCCESS, error);
        timeout_seqno--;
        if (timeout_stats_done && timeout_seqno == 0) {
            io->v.v0.stop_event_loop(io);
        }
    }

    static void timeout_stat_callback(lcb_t instance,
                                      const void *cookie,
                                      lcb_error_t error,
                                      const lcb_server_stat_resp_t *resp)
    {
        lcb_error_t err;
        lcb_io_opt_t io = (lcb_io_opt_t)cookie;
        char *statkey;
        lcb_size_t nstatkey;

        ASSERT_EQ(0, resp->version);
        const char *server_endpoint = resp->v.v0.server_endpoint;
        const void *key = resp->v.v0.key;
        lcb_size_t nkey = resp->v.v0.nkey;
        const void *bytes = resp->v.v0.bytes;
        lcb_size_t nbytes = resp->v.v0.nbytes;

        ASSERT_EQ(LCB_SUCCESS, error);
        if (server_endpoint != NULL) {
            nstatkey = strlen(server_endpoint) + nkey + 2;
            statkey = new char[nstatkey];
            snprintf(statkey, nstatkey, "%s-%.*s", server_endpoint,
                     (int)nkey, (const char *)key);

            lcb_store_cmd_t storecmd(LCB_SET, statkey, nstatkey, bytes, nbytes);
            lcb_store_cmd_t *storecmds[] = { &storecmd };
            err = lcb_store(instance, io, 1, storecmds);
            ASSERT_EQ(LCB_SUCCESS, err);
            timeout_seqno++;
            delete []statkey;
        } else {
            timeout_stats_done = 1;
        }
    }
}

TEST_F(MockUnitTest, testTimeout)
{
    // @todo we need to have a test that actually tests the timeout callback..
    lcb_t instance;
    HandleWrap hw;
    lcb_io_opt_t io;
    createConnection(hw, instance);

    (void)lcb_set_error_callback(instance, timeout_error_callback);
    (void)lcb_set_stat_callback(instance, timeout_stat_callback);
    (void)lcb_set_store_callback(instance, timeout_store_callback);

    io = (lcb_io_opt_t)lcb_get_cookie(instance);

    lcb_server_stats_cmd_t stat;
    lcb_server_stats_cmd_t *commands[] = {&stat };

    ASSERT_EQ(LCB_SUCCESS, lcb_server_stats(instance, io, 1, commands));
    io->v.v0.run_event_loop(io);
}

struct timeout_test_cookie {
    int *counter;
    lcb_error_t expected;
};
extern "C" {
static void set_callback(lcb_t,
                         const void *cookie,
                         lcb_storage_t, lcb_error_t err,
                         const lcb_store_resp_t *)
{
    timeout_test_cookie *tc = (timeout_test_cookie*)cookie;;
    EXPECT_EQ(tc->expected, err);
    if (err == LCB_ETIMEDOUT) {
        // Remove the hiccup at the first timeout failure
        MockEnvironment::getInstance()->hiccupNodes(0, 0);
    }
    *tc->counter -= 1;
}

struct next_store_st {
    struct timeout_test_cookie *tc;
    const lcb_store_cmd_t * const * cmdpp;
};

static void reschedule_callback(lcb_timer_t timer,
                                lcb_t instance,
                                const void *cookie)
{
    lcb_error_t err;
    struct next_store_st *ns = (struct next_store_st *)cookie;
    err = lcb_store(instance, ns->tc, 1, ns->cmdpp);
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_timer_destroy(instance, timer);

}

}

TEST_F(MockUnitTest, testTimeoutOnlyStale)
{
    SKIP_UNLESS_MOCK();

    HandleWrap hw;
    createConnection(hw);
    lcb_t instance = hw.getLcb();
    lcb_uint32_t tmoval = 1000000;
    int nremaining = 2;
    lcb_error_t err;
    struct timeout_test_cookie cookies[2];
    MockEnvironment *mock = MockEnvironment::getInstance();

    // Set the timeout
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmoval);

    lcb_set_store_callback(instance, set_callback);

    lcb_store_cmd_t scmd, *cmdp;
    const char *key = "i'm a key";
    const char *value = "a value";
    cmdp = &scmd;

    removeKey(instance, key);

    // Make the mock timeout the first cookie. The extras length is:
    mock->hiccupNodes(1500, 1);



    memset(&scmd, 0, sizeof(scmd));
    scmd.v.v0.key = key;
    scmd.v.v0.nkey = strlen(key);
    scmd.v.v0.bytes = value;
    scmd.v.v0.nbytes = strlen(value);
    scmd.v.v0.operation = LCB_SET;
    cookies[0].counter = &nremaining;
    cookies[0].expected = LCB_ETIMEDOUT;
    lcb_store(instance, cookies, 1, &cmdp);

    cookies[1].counter = &nremaining;
    cookies[1].expected = LCB_SUCCESS;
    struct next_store_st ns;
    ns.cmdpp = &cmdp;
    ns.tc = cookies+1;
    lcb_timer_t timer = lcb_timer_create(instance, &ns,
                                         900000,
                                         0,
                                         reschedule_callback,
                                         &err);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_wait(instance);

    ASSERT_EQ(0, nremaining);
}


TEST_F(MockUnitTest, testIssue59)
{
    // lcb_wait() blocks forever if there is nothing queued
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_wait(instance);
    lcb_wait(instance);
    lcb_wait(instance);
    lcb_wait(instance);
    lcb_wait(instance);
    lcb_wait(instance);
    lcb_wait(instance);
    lcb_wait(instance);
}

extern "C" {
    struct rvbuf {
        lcb_error_t error;
        lcb_cas_t cas1;
        lcb_cas_t cas2;
        char *bytes;
        lcb_size_t nbytes;
        lcb_int32_t counter;
    };

    static void df_store_callback1(lcb_t instance,
                                   const void *cookie,
                                   lcb_storage_t,
                                   lcb_error_t error,
                                   const lcb_store_resp_t *)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        rv->error = error;
        lcb_io_opt_t io = (lcb_io_opt_t)lcb_get_cookie(instance);
        io->v.v0.stop_event_loop(io);
    }

    static void df_store_callback2(lcb_t instance,
                                   const void *cookie,
                                   lcb_storage_t,
                                   lcb_error_t error,
                                   const lcb_store_resp_t *resp)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        rv->error = error;
        rv->cas2 = resp->v.v0.cas;
        lcb_io_opt_t io = (lcb_io_opt_t)lcb_get_cookie(instance);
        io->v.v0.stop_event_loop(io);
    }

    static void df_get_callback(lcb_t instance,
                                const void *cookie,
                                lcb_error_t error,
                                const lcb_get_resp_t *resp)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        const char *value = "{\"bar\"=>1, \"baz\"=>2}";
        lcb_size_t nvalue = strlen(value);
        lcb_error_t err;

        rv->error = error;
        rv->cas1 = resp->v.v0.cas;
        lcb_store_cmd_t storecmd(LCB_SET, resp->v.v0.key, resp->v.v0.nkey,
                                 value, nvalue, 0, 0, resp->v.v0.cas);
        lcb_store_cmd_t *storecmds[] = { &storecmd };

        err = lcb_store(instance, rv, 1, storecmds);
        ASSERT_EQ(LCB_SUCCESS, err);
    }
}

TEST_F(MockUnitTest, testDoubleFreeError)
{
    lcb_error_t err;
    struct rvbuf rv;
    const char *key = "test_compare_and_swap_async_", *value = "{\"bar\" => 1}";
    lcb_size_t nkey = strlen(key), nvalue = strlen(value);
    lcb_io_opt_t io;
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    io = (lcb_io_opt_t)lcb_get_cookie(instance);

    /* prefill the bucket */
    (void)lcb_set_store_callback(instance, df_store_callback1);

    lcb_store_cmd_t storecmd(LCB_SET, key, nkey, value, nvalue);
    lcb_store_cmd_t *storecmds[] = { &storecmd };

    err = lcb_store(instance, &rv, 1, storecmds);
    ASSERT_EQ(LCB_SUCCESS, err);
    io->v.v0.run_event_loop(io);
    ASSERT_EQ(LCB_SUCCESS, rv.error);

    /* run exercise
     *
     * 1. get the valueue and its cas
     * 2. atomic set new valueue using old cas
     */
    (void)lcb_set_store_callback(instance, df_store_callback2);
    (void)lcb_set_get_callback(instance, df_get_callback);

    lcb_get_cmd_t getcmd(key, nkey);
    lcb_get_cmd_t *getcmds[] = { &getcmd };

    err = lcb_get(instance, &rv, 1, getcmds);
    ASSERT_EQ(LCB_SUCCESS, err);
    rv.cas1 = rv.cas2 = 0;
    io->v.v0.run_event_loop(io);
    ASSERT_EQ(LCB_SUCCESS, rv.error);
    ASSERT_GT(rv.cas1, 0);
    ASSERT_GT(rv.cas2, 0);
    ASSERT_NE(rv.cas1, rv.cas2);
}

TEST_F(MockUnitTest, testBrokenFirstNodeInList)
{
    MockEnvironment *mock = MockEnvironment::getInstance();
    lcb_create_st options;
    mock->makeConnectParams(options, NULL);
    std::string nodes = options.v.v0.host;
    nodes = "1.2.3.4;" + nodes;
    options.v.v0.host = nodes.c_str();

    lcb_t instance;
    ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    lcb_set_timeout(instance, 200000); /* 200 ms */
    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_destroy(instance);
}

extern "C" {
    int config_cnt;

    static void vbucket_state_callback(lcb_server_t *server)
    {
        config_cnt++;
    }

    int store_cnt;

    /* Needed for "testPurgedBody", to ensure preservation of connection */
    static void io_close_wrap(lcb_io_opt_t, lcb_socket_t)
    {
        fprintf(stderr, "We requested to close, but we were't expecting it\n");
        abort();
    }

    static void store_callback(lcb_t instance, const void *cookie,
                               lcb_storage_t, lcb_error_t error,
                               const lcb_store_resp_t *)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        lcb_log(LOGARGS(instance, INFO),
                "Got storage callback for cookie %p with err=0x%x",
                (void *)cookie,
                (int)error);

        rv->error = error;
        store_cnt++;
        if (!instance->wait) { /* do not touch IO if we are using lcb_wait() */
            instance->settings.io->v.v0.stop_event_loop(instance->settings.io);
        }
    }

    static void get_callback(lcb_t instance, const void *cookie,
                             lcb_error_t error, const lcb_get_resp_t *resp)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        rv->error = error;
        rv->bytes = (char *)malloc(resp->v.v0.nbytes);
        memcpy((void *)rv->bytes, resp->v.v0.bytes, resp->v.v0.nbytes);
        rv->nbytes = resp->v.v0.nbytes;
        if (!instance->wait) { /* do not touch IO if we are using lcb_wait() */
            instance->settings.io->v.v0.stop_event_loop(instance->settings.io);
        }
    }

    static void tpb_get_callback(lcb_t instance, const void *cookie,
                                 lcb_error_t error, const lcb_get_resp_t *resp)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        rv->error = error;
        rv->counter--;
        if (rv->counter <= 0) {
            lcb_io_opt_t io = (lcb_io_opt_t)lcb_get_cookie(instance);
            assert(io);
            io->v.v0.stop_event_loop(io);
        }

        (void)resp;
    }

    static void timer_callback(lcb_timer_t, lcb_t, const void *) {
        abort();
    }
}

class DummyTimer {
public:
    DummyTimer(lcb_t instance) : instance(instance) {
        lcb_error_t err;
        tm = lcb_timer_create(instance, this, 100 * 1000000, 1,
                              timer_callback, &err);
        EXPECT_EQ(LCB_SUCCESS, err);
    }

    void clear() {
        lcb_timer_destroy(instance, tm);
        tm = NULL;
    }

    ~DummyTimer() {
    }

private:
    lcb_timer_t tm;
    lcb_t instance;
};

TEST_F(MockUnitTest, DISABLED_testPurgedBody)
{
    SKIP_UNLESS_MOCK();
    lcb_error_t err;
    struct rvbuf rv;
    const char key[] = "testPurgedBody";
    lcb_size_t nkey = sizeof(key);

    int nvalue = 100000;
    std::string scoped_value;
    scoped_value.assign(nvalue, 0xff);
    const char *backed_value = scoped_value.c_str();

    lcb_t instance;
    HandleWrap hw;
    lcb_io_opt_t io;

    createConnection(hw, instance);

    io = (lcb_io_opt_t)lcb_get_cookie(instance);

    /* --enable-warnings --enable-werror won't let me use a simple void* */
    void (*io_close_old)(lcb_io_opt_t, lcb_socket_t) = io->v.v0.close;

    lcb_set_timeout(instance, 3100000); /* 3.1 seconds */
    hrtime_t now = gethrtime(), begin_time = 0;
    io->v.v0.close = io_close_wrap;

    lcb_set_store_callback(instance, store_callback);
    lcb_set_get_callback(instance, tpb_get_callback);

    /*
     * Store large 100000 bytes key in the bucket
     */
    lcb_store_cmd_t store_cmd(LCB_SET, key, nkey, backed_value, nvalue);
    lcb_store_cmd_t *store_cmds[] = { &store_cmd };
    err = lcb_store(instance, &rv, 1, store_cmds);
    ASSERT_EQ(LCB_SUCCESS, err);
    rv.counter = 1;
    io->v.v0.run_event_loop(io);
    ASSERT_EQ(LCB_SUCCESS, rv.error);

    /*
     * Schedule GET operation for the key
     */
    lcb_get_cmd_t get_cmd(key, nkey);
    lcb_get_cmd_t *get_cmds[] = { &get_cmd };
    err = lcb_get(instance, &rv, 1, get_cmds);
    ASSERT_EQ(LCB_SUCCESS, err);

    /*
     * Setup mock to split response in two parts: send first 40 bytes
     * immediately and send the rest after 3.5 seconds.
     */
    MockEnvironment::getInstance()->hiccupNodes(3500, 40); /* 3.5 seconds */

    /*
     * Run the IO loop and measure how long does it take to transfer the
     * backed_value back.
     */
    begin_time = gethrtime();
    io->v.v0.run_event_loop(io);
    io->v.v0.close = io_close_old;

    now = gethrtime();

    /*
     * The command must be timed out and it should take more than 2.8
     * seconds
     */
    ASSERT_EQ(LCB_ETIMEDOUT, rv.error);
    ASSERT_GE(now - begin_time, 2800000000LU); /* 2.8 seconds */
}

struct StoreContext {
    std::map<std::string, lcb_error_t> mm;
    typedef std::map<std::string, lcb_error_t>::iterator MyIter;

    void check(int expected) {
        EXPECT_EQ(expected, mm.size());

        for (MyIter iter = mm.begin(); iter != mm.end(); iter++) {
            EXPECT_EQ(LCB_SUCCESS, iter->second);
        }
    }

    void clear() {
        mm.clear();
    }
};

extern "C" {
static void ctx_store_callback(lcb_t, const void *cookie, lcb_storage_t,
                                  lcb_error_t err, const lcb_store_resp_t *resp)
{
    StoreContext *ctx = reinterpret_cast<StoreContext *>(
            const_cast<void *>(cookie));


    std::string s((const char *)resp->v.v0.key, resp->v.v0.nkey);
    ctx->mm[s] = err;
}
}

TEST_F(MockUnitTest, testReconfigurationOnNodeFailover)
{
    SKIP_UNLESS_MOCK();
    lcb_t instance;
    HandleWrap hw;
    lcb_error_t err;

    const char *argv[] = {
            "--replicas", "0", "--nodes", "10", NULL
    };

    MockEnvironment mock_o(argv), *mock = &mock_o;


    std::vector<std::string> keys;
    std::vector<lcb_store_cmd_t> cmds;
    std::vector<lcb_store_cmd_t *>ppcmds;

    mock->createConnection(hw, instance);
    lcb_uint32_t newtmo = 7500000; // 7.5 sec
    err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &newtmo);
    ASSERT_EQ(LCB_SUCCESS, err);
    instance->settings.vb_noguess = 1;
    lcb_connect(instance);
    lcb_wait(instance);
    ASSERT_EQ(0, lcb_get_num_replicas(instance));


    /* mock uses 10 nodes by default */
    ASSERT_EQ(10, mock->getNumNodes());
    instance->vbucket_state_listener = vbucket_state_callback;
    genDistKeys(instance->vbucket_config, keys);
    genStoreCommands(keys, cmds, ppcmds);
    StoreContext ctx;

    lcb_set_store_callback(instance, ctx_store_callback);

    err = lcb_store(instance, &ctx, cmds.size(), &ppcmds[0]);
    mock->failoverNode(0);
    lcb_wait(instance);

    ctx.check((int)cmds.size());
    ctx.clear();
    ASSERT_EQ(9, lcb_get_num_nodes(instance));

    config_cnt = 0;
    mock->respawnNode(0);
    err = lcb_store(instance, &ctx, cmds.size(), &ppcmds[0]);
    lcb_wait(instance);
    ctx.check((int)cmds.size());
    ASSERT_EQ(10, config_cnt);
}



struct fo_context_st {
    MockEnvironment *env;
    int index;
};
// Hiccup the server, then fail it over.
extern "C" {
static void fo_callback(lcb_timer_t tm, lcb_t instance, const void *cookie)
{
    fo_context_st *ctx = (fo_context_st *)cookie;
    ctx->env->failoverNode(ctx->index);
    ctx->env->hiccupNodes(0, 0);
    lcb_timer_destroy(instance, tm);
}
}

TEST_F(MockUnitTest, testBufferRelocationOnNodeFailover)
{
    SKIP_UNLESS_MOCK();
    lcb_error_t err;
    struct rvbuf rv;
    lcb_t instance;
    HandleWrap hw;
    std::string key = "testBufferRelocationOnNodeFailover";
    std::string val = "foo";

    const char *argv[] = { "--replicas", "0", "--nodes", "10", NULL };
    MockEnvironment mock_o(argv), *mock = &mock_o;

    // We need to disable CCCP for this test to receive "Push" style
    // configuration.
    mock->setCCCP(false);

    mock->createConnection(hw, instance);
    lcb_connect(instance);
    lcb_wait(instance);

    // Set the timeout for 15 seconds
    lcb_uint32_t tmoval = 15000000;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmoval);

    /* mock uses 10 nodes by default */
    ASSERT_EQ(10, mock->getNumNodes());
    instance->vbucket_state_listener = vbucket_state_callback;
    lcb_set_store_callback(instance, store_callback);
    lcb_set_get_callback(instance, get_callback);

    // Initialize the nodes first..
    removeKey(instance, key);

    /* Schedule SET operation */
    lcb_store_cmd_t storecmd(LCB_SET, key.c_str(), key.size(),
                             val.c_str(), val.size());

    /* Determine what server should receive that operation */
    int vb, idx;
    vbucket_map(instance->vbucket_config, key.c_str(), key.size(), &vb, &idx);
    mock->hiccupNodes(5000, 1);

    struct fo_context_st ctx = { mock, idx };

    lcb_timer_t timer = lcb_timer_create_simple(instance->settings.io,
                                                &ctx,
                                                500000,
                                                fo_callback);

    lcb_store_cmd_t *storecmds[] = { &storecmd };
    err = lcb_store(instance, &rv, 1, storecmds);
    ASSERT_EQ(LCB_SUCCESS, err);

    config_cnt = 0;
    store_cnt = 0;
    lcb_wait(instance);
    ASSERT_EQ(1, store_cnt);
    ASSERT_EQ(LCB_SUCCESS, rv.error);
    ASSERT_EQ(9, config_cnt);

    memset(&rv, 0, sizeof(rv));
    err = lcb_store(instance, &rv, 1, storecmds);
    ASSERT_EQ(LCB_SUCCESS, err);
    config_cnt = 0;
    store_cnt = 0;
    lcb_wait(instance);
    ASSERT_EQ(1, store_cnt);

    /* Check that value was actually set */
    lcb_get_cmd_t getcmd(key.c_str(), key.size());
    lcb_get_cmd_t *getcmds[] = { &getcmd };
    err = lcb_get(instance, &rv, 1, getcmds);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, rv.error);
    ASSERT_EQ(rv.nbytes, val.size());
    std::string bytes = std::string(rv.bytes, rv.nbytes);
    ASSERT_STREQ(bytes.c_str(), val.c_str());
    free(rv.bytes);
}

TEST_F(MockUnitTest, testSaslMechs)
{
    // Ensure our SASL mech listing works.
    SKIP_UNLESS_MOCK();

    const char *argv[] = { "--buckets", "protected:secret:couchbase", NULL };

    lcb_t instance;
    struct lcb_create_st crParams;
    MockEnvironment mock_o(argv, "protected"), *protectedEnv = &mock_o;
    protectedEnv->makeConnectParams(crParams, NULL);
    protectedEnv->setCCCP(false);

    crParams.v.v0.user = "protected";
    crParams.v.v0.passwd = "secret";
    crParams.v.v0.bucket = "protected";

    lcb_error_t err = lcb_create(&instance, &crParams);
    ASSERT_EQ(LCB_SUCCESS, err);

    // Make the socket pool disallow idle connections
    instance->memd_sockpool->max_idle = 0;

    err = lcb_connect(instance);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);

    // Force our SASL mech
    err = lcb_cntl(instance, LCB_CNTL_SET,
                   LCB_CNTL_FORCE_SASL_MECH, (void *)"blah");
    ASSERT_EQ(LCB_SUCCESS, err);

    Item itm("key", "value");
    KVOperation kvo(&itm);

    kvo.allowableErrors.insert(LCB_SASLMECH_UNAVAILABLE);
    kvo.allowableErrors.insert(LCB_ETIMEDOUT);
    kvo.store(instance);

    ASSERT_FALSE(kvo.globalErrors.find(LCB_SASLMECH_UNAVAILABLE) ==
              kvo.globalErrors.end());

    err = lcb_cntl(instance, LCB_CNTL_SET,
                   LCB_CNTL_FORCE_SASL_MECH, (void *)"PLAIN");
    ASSERT_EQ(LCB_SUCCESS, err);

    kvo.clear();
    kvo.store(instance);

    lcb_destroy(instance);
}


struct mcd_listener {
    clconfig_listener base;
    bool called;
};

extern "C" {
static void listener_callback(clconfig_listener *lsnbase,
                              clconfig_event_t event,
                              clconfig_info *)
{
    mcd_listener *lsn = (mcd_listener *)lsnbase;
    if (event == CLCONFIG_EVENT_GOT_ANY_CONFIG ||
            event == CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        lsn->called = true;
    }
}
}

TEST_F(MockUnitTest, testMemcachedFailover)
{
    SKIP_UNLESS_MOCK();
    const char *argv[] = { "--buckets", "cache::memcache", NULL };
    lcb_t instance;
    struct lcb_create_st crParams;
    mcd_listener lsn;
    memset(&lsn, 0, sizeof lsn);
    lsn.base.callback = listener_callback;

    MockEnvironment mock_o(argv, "cache"), *mock = &mock_o;
    mock->makeConnectParams(crParams, NULL);
    lcb_error_t err = lcb_create(&instance, &crParams);

    // No disconnection interval. It's disconnected immediately.
    instance->settings.bc_http_stream_time = 0;
    ASSERT_EQ(LCB_SUCCESS, err);

    // Attach the listener
    lcb_confmon_add_listener(instance->confmon, &lsn.base);

    // Check internal setting here
    lcb_connect(instance);
    lcb_wait(instance);
    ASSERT_TRUE(lsn.called);

    doDummyOp(instance);
    http_provider *htprov =
            (http_provider *)lcb_confmon_get_provider(instance->confmon,
                                                      LCB_CLCONFIG_HTTP);
    ASSERT_EQ((lcb_uint32_t)-1, instance->settings.bc_http_stream_time);
    ASSERT_EQ(0, lcb_timer_armed(htprov->disconn_timer));

    // Fail over the first node..
    mock->failoverNode(1, "cache");
    lsn.called = false;

    for (int ii = 0; ii < 100; ii++) {
        if (lsn.called) {
            break;
        }
        doDummyOp(instance);
    }
    ASSERT_TRUE(lsn.called);
    // Call again so the async callback may be invoked.
    doDummyOp(instance);
    ASSERT_EQ(9, lcb_get_num_nodes(instance));

    doDummyOp(instance);
    mock->respawnNode(1, "cache");
    lsn.called = false;
    for (int ii = 0; ii < 100; ii++) {
        if (lsn.called) {
            break;
        }
        doDummyOp(instance);
    }
    ASSERT_TRUE(lsn.called);
    lcb_confmon_remove_listener(instance->confmon, &lsn.base);
    lcb_destroy(instance);
}
