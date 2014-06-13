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
