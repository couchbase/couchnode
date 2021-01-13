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
#include <libcouchbase/utils.h>
#include "internalstructs.h"

class ServeropsUnitTest : public MockUnitTest
{
};

extern "C" {
static void testServerStatsCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTATS *resp)
{
    int *counter = (int *)resp->cookie;
    EXPECT_EQ(LCB_SUCCESS, resp->ctx.rc);
    ++(*counter);
}

static void statKey_callback(lcb_INSTANCE *, int, const lcb_RESPBASE *resp_base)
{
    const lcb_RESPSTATS *resp = (const lcb_RESPSTATS *)resp_base;
    if (!resp->server) {
        return;
    }
    EXPECT_EQ(LCB_SUCCESS, resp->ctx.rc);
    std::map<std::string, bool> &mm = *(std::map<std::string, bool> *)resp->cookie;
    mm[resp->server] = true;
}
}

/**
 * @test Server Statistics
 * @pre Schedule a server statistics command
 * @post The response is a valid statistics structure and its status is
 * @c SUCCESS.
 *
 * @post the statistics callback is invoked more than once.
 */
TEST_F(ServeropsUnitTest, testServerStats)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    lcb_install_callback(instance, LCB_CALLBACK_STATS, (lcb_RESPCALLBACK)testServerStatsCallback);
    int numcallbacks = 0;
    lcb_CMDSTATS cmd = {0};
    EXPECT_EQ(LCB_SUCCESS, lcb_stats3(instance, &numcallbacks, &cmd));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_LT(1, numcallbacks);
}

TEST_F(ServeropsUnitTest, testKeyStats)
{
    SKIP_UNLESS_MOCK(); // FIXME: works on 5.5.0, fails on 6.0.0
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);
    lcb_install_callback(instance, LCB_CALLBACK_STATS, (lcb_RESPCALLBACK)statKey_callback);
    lcb_CMDSTATS cmd = {0};

    std::string key = "keystats_test";
    storeKey(instance, key, "blah blah");
    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    cmd.cmdflags = LCB_CMDSTATS_F_KV;
    std::map<std::string, bool> mm;

    lcb_sched_enter(instance);
    lcb_STATUS err = lcb_stats3(instance, &mm, &cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(lcb_get_num_replicas(instance) + 1, mm.size());

    // Ensure that a key with an embedded space fails
    key = "key with space";
    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    err = lcb_stats3(instance, nullptr, &cmd);
    ASSERT_NE(LCB_SUCCESS, err);
}
