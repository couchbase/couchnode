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
#include "internal.h"
#include "iotests.h"

class RegressionUnitTest : public MockUnitTest
{
};

static bool callbackInvoked = false;

extern "C" {
    static void get_callback(lcb_t, const void *cookie,
                             lcb_error_t err, const lcb_get_resp_t *)
    {
        EXPECT_EQ(err, LCB_KEY_ENOENT);
        int *counter_p = reinterpret_cast<int *>(const_cast<void *>(cookie));
        EXPECT_TRUE(counter_p != NULL);
        EXPECT_GT(*counter_p, 0);
        *counter_p -= 1;
        callbackInvoked = true;
    }

    static void stats_callback(lcb_t, const void *cookie, lcb_error_t err,
                               const lcb_server_stat_resp_t *resp)
    {
        EXPECT_EQ(err, LCB_SUCCESS);
        if (resp->v.v0.nkey == 0) {
            int *counter_p = reinterpret_cast<int *>(const_cast<void *>(cookie));
            *counter_p -= 1;
        }
        callbackInvoked = true;
    }
}

TEST_F(RegressionUnitTest, CCBC_150)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    callbackInvoked = false;
    lcb_set_get_callback(instance, get_callback);
    lcb_set_stat_callback(instance, stats_callback);
    lcb_uint32_t tmoval = 15000000;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmoval);

    lcb_get_cmd_t getCmd1("testGetMiss1");
    lcb_get_cmd_t *getCmds[] = { &getCmd1 };

    lcb_server_stats_cmd_t statCmd;
    lcb_server_stats_cmd_t *statCmds[] = { &statCmd };
    int ii;

    // Lets spool up a lot of commands in one of the buffers so that we
    // know we need to search for it a few times when we get responses..
    int callbackCounter = 1000;
    void *ptr = &callbackCounter;

    for (ii = 0; ii < 1000; ++ii) {
        EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, ptr, 1, getCmds));
    }

    callbackCounter++;
    EXPECT_EQ(LCB_SUCCESS, lcb_server_stats(instance, ptr, 1, statCmds));

    callbackCounter += 1000;
    for (ii = 0; ii < 1000; ++ii) {
        EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, ptr, 1, getCmds));
    }

    callbackCounter++;
    EXPECT_EQ(LCB_SUCCESS, lcb_server_stats(instance, ptr, 1, statCmds));

    callbackCounter++;
    EXPECT_EQ(LCB_SUCCESS, lcb_server_stats(instance, ptr, 1, statCmds));

    EXPECT_EQ(LCB_SUCCESS, lcb_wait(instance));
    ASSERT_TRUE(callbackInvoked);
    ASSERT_EQ(0, callbackCounter);
}

struct ccbc_275_info_st {
    int call_count;
    lcb_error_t last_err;
};

extern "C" {
static void get_callback_275(lcb_t instance,
                             const void *cookie,
                             lcb_error_t err,
                             const lcb_get_resp_t *)
{
    struct ccbc_275_info_st *info = (struct ccbc_275_info_st *)cookie;
    info->call_count++;
    info->last_err = err;
    lcb_breakout(instance);
}

}

TEST_F(RegressionUnitTest, CCBC_275)
{
    SKIP_UNLESS_MOCK();
    lcb_t instance;
    lcb_error_t err;
    struct lcb_create_st crOpts;
    const char *argv[] = { "--buckets", "protected:secret:couchbase", NULL };
    MockEnvironment mock_o(argv, "protected"), *mock = &mock_o;
    struct ccbc_275_info_st info = { 0, LCB_SUCCESS };

    mock->makeConnectParams(crOpts, NULL);
    crOpts.v.v0.user = "protected";
    crOpts.v.v0.passwd = "secret";
    crOpts.v.v0.bucket = "protected";
    doLcbCreate(&instance, &crOpts, mock);

    err = lcb_connect(instance);
    ASSERT_EQ(LCB_SUCCESS, err);

    err = lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, err);

    std::string key = "key_CCBC_275";
    lcb_get_cmd_t cmd, *cmdp;
    memset(&cmd, 0, sizeof(cmd));
    cmd.v.v0.key = key.c_str();
    cmd.v.v0.nkey = key.size();
    cmdp = &cmd;

    // Set timeout for a short interval
    lcb_uint32_t tmo_usec = 100000;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmo_usec);

    // In the past this issue would result in several symptoms:
    // (1) the client would crash (ringbuffer_consumed in failout_server)
    // (2) the client would hang
    // (3) the subsequent lcb_wait would return immediately.
    // So far I've managed to reproduce (1), not clear on (2) and (3)
    mock->hiccupNodes(1000, 1);
    lcb_set_get_callback(instance, get_callback_275);

    err = lcb_get(instance, &info, 1, &cmdp);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(1, info.call_count);

    ASSERT_ERRISA(info.last_err, LCB_ERRTYPE_NETWORK);

    // Make sure we've fully purged and disconnected the server
    struct lcb_cntl_vbinfo_st vbi;
    memset(&vbi, 0, sizeof(vbi));
    vbi.v.v0.key = key.c_str();
    vbi.v.v0.nkey = key.size();
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBMAP, &vbi);
    ASSERT_EQ(LCB_SUCCESS, err);
//    ASSERT_EQ(LCB_CONNSTATE_UNINIT,
//              instance->servers[vbi.v.v0.server_index].connection.state);

    // Restore the timeout to something sane
    tmo_usec = 5000000;
    err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmo_usec);
    ASSERT_EQ(LCB_SUCCESS, err);

    mock->hiccupNodes(0, 0);
    info.call_count = 0;
    err = lcb_get(instance, &info, 1, &cmdp);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(1, info.call_count);

    ASSERT_EQ(LCB_KEY_ENOENT, info.last_err);

    lcb_destroy(instance);
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
        lcb_stop_loop(instance);
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
        lcb_stop_loop(instance);
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
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    /* prefill the bucket */
    (void)lcb_set_store_callback(instance, df_store_callback1);

    lcb_store_cmd_t storecmd(LCB_SET, key, nkey, value, nvalue);
    lcb_store_cmd_t *storecmds[] = { &storecmd };

    err = lcb_store(instance, &rv, 1, storecmds);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_run_loop(instance);
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
    lcb_run_loop(instance);
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
    nodes = "1.2.3.4:4321;" + nodes;
    options.v.v0.host = nodes.c_str();

    lcb_t instance;
    doLcbCreate(&instance, &options, mock);
    lcb_cntl_setu32(instance, LCB_CNTL_OP_TIMEOUT, LCB_MS2US(200));
    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_destroy(instance);
}
