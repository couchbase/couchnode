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
#include "internal.h"

class ServeropsUnitTest : public MockUnitTest
{
};

extern "C" {
static void testServerStatsCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTATS *resp)
{
    int *counter;
    lcb_respstats_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_SUCCESS, lcb_respstats_status(resp));
    ++(*counter);
}

static void statKey_callback(lcb_INSTANCE *, int, const lcb_RESPSTATS *resp)
{
    const char *server;
    size_t server_len;
    lcb_respstats_server(resp, &server, &server_len);
    if (server == nullptr) {
        return;
    }
    EXPECT_EQ(LCB_SUCCESS, lcb_respstats_status(resp));
    std::map<std::string, bool> *mm;
    lcb_respstats_cookie(resp, (void **)&mm);
    (*mm)[std::string(server, server_len)] = true;
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
    lcb_CMDSTATS *cmd;
    lcb_cmdstats_create(&cmd);
    EXPECT_EQ(LCB_SUCCESS, lcb_stats(instance, &numcallbacks, cmd));
    lcb_cmdstats_destroy(cmd);
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
    lcb_CMDSTATS *cmd;
    lcb_cmdstats_create(&cmd);

    std::string key = "keystats_test";
    storeKey(instance, key, "blah blah");
    lcb_cmdstats_key(cmd, key.c_str(), key.size());
    lcb_cmdstats_is_keystats(cmd, true);
    std::map<std::string, bool> mm;

    lcb_sched_enter(instance);
    lcb_STATUS err = lcb_stats(instance, &mm, cmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(lcb_get_num_replicas(instance) + 1, mm.size());

    // Ensure that a key with an embedded space fails
    key = "key with space";
    lcb_cmdstats_key(cmd, key.c_str(), key.size());
    lcb_cmdstats_is_keystats(cmd, true);
    err = lcb_stats(instance, nullptr, cmd);
    ASSERT_NE(LCB_SUCCESS, err);
    lcb_cmdstats_destroy(cmd);
}
