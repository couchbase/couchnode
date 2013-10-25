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

#include "server.h"
#include "mock-unit-test.h"
#include "mock-environment.h"
#include "testutil.h"

class ServeropsUnitTest : public MockUnitTest
{
protected:
    static void SetUpTestCase() {
        MockUnitTest::SetUpTestCase();
    }
};

extern "C" {
    static void testServerStatsCallback(lcb_t, const void *cookie,
                                        lcb_error_t error,
                                        const lcb_server_stat_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_SUCCESS, error);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
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
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_stat_callback(instance, testServerStatsCallback);
    int numcallbacks = 0;
    lcb_server_stats_cmd_t cmd;
    lcb_server_stats_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_server_stats(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_LT(1, numcallbacks);
}

extern "C" {
    static void testServerVersionsCallback(lcb_t, const void *cookie,
                                           lcb_error_t error,
                                           const lcb_server_version_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_SUCCESS, error);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Server Versions
 * @pre Request the server versions
 * @post Response is successful, and the version callback is invoked more than
 * once.
 */
TEST_F(ServeropsUnitTest, testServerVersion)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_version_callback(instance, testServerVersionsCallback);
    int numcallbacks = 0;
    lcb_server_version_cmd_t cmd;
    lcb_server_version_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_server_versions(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_LT(1, numcallbacks);
}


extern "C" {
    static void testFlushCallback(lcb_t, const void *cookie,
                                  lcb_error_t error,
                                  const lcb_flush_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_TRUE(error == LCB_SUCCESS || error == LCB_NOT_SUPPORTED);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Flush
 * @pre Request a flush operation
 * @post Response is either a success or a @c NOT_SUPPORTED return
 */
TEST_F(ServeropsUnitTest, testFlush)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_flush_callback(instance, testFlushCallback);
    int numcallbacks = 0;
    lcb_flush_cmd_t cmd;
    lcb_flush_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_flush(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_LT(1, numcallbacks);
}

extern "C" {
    static char *verbosity_endpoint;

    static void verbosity_all_callback(lcb_t instance,
                                       const void *cookie,
                                       lcb_error_t error,
                                       const lcb_verbosity_resp_t *resp)
    {
        int *counter = (int *)cookie;
        ASSERT_EQ(0, resp->version);
        ASSERT_EQ(LCB_SUCCESS, error);
        if (resp->v.v0.server_endpoint == NULL) {
            EXPECT_EQ(MockEnvironment::getInstance()->getNumNodes(), *counter);
            lcb_io_opt_t io;
            io = (lcb_io_opt_t)lcb_get_cookie(instance);
            io->v.v0.stop_event_loop(io);
            return;
        } else if (verbosity_endpoint == NULL) {
            verbosity_endpoint = strdup(resp->v.v0.server_endpoint);
        }
        ++(*counter);
    }

    static void verbosity_single_callback(lcb_t instance,
                                          const void *,
                                          lcb_error_t error,
                                          const lcb_verbosity_resp_t *resp)
    {
        ASSERT_EQ(0, resp->version);
        ASSERT_EQ(LCB_SUCCESS, error);
        if (resp->v.v0.server_endpoint == NULL) {
            lcb_io_opt_t io;
            io = (lcb_io_opt_t)lcb_get_cookie(instance);
            io->v.v0.stop_event_loop(io);
        } else {
            EXPECT_STREQ(verbosity_endpoint, resp->v.v0.server_endpoint);
        }
    }
}

/**
 * @test Server Verbosity
 * @todo (document this..)
 */
TEST_F(ServeropsUnitTest, testVerbosity)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_verbosity_callback(instance, verbosity_all_callback);

    int counter = 0;

    lcb_verbosity_cmd_t cmd(LCB_VERBOSITY_DEBUG);
    lcb_verbosity_cmd_t *commands[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_set_verbosity(instance, &counter, 1, commands));

    lcb_io_opt_t io;
    io = (lcb_io_opt_t)lcb_get_cookie(instance);
    io->v.v0.run_event_loop(io);

    EXPECT_EQ(MockEnvironment::getInstance()->getNumNodes(), counter);
    EXPECT_NE((char *)NULL, verbosity_endpoint);

    (void)lcb_set_verbosity_callback(instance, verbosity_single_callback);

    lcb_verbosity_cmd_t cmd2(LCB_VERBOSITY_DEBUG, verbosity_endpoint);
    lcb_verbosity_cmd_t *commands2[] = { &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_set_verbosity(instance, &counter, 1, commands2));
    io->v.v0.run_event_loop(io);
    free((void *)verbosity_endpoint);
    verbosity_endpoint = NULL;

}
