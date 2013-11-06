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
#include "internal.h"

class RegressionUnitTest : public MockUnitTest
{
protected:
    static void SetUpTestCase() {
        MockUnitTest::SetUpTestCase();
    }
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
    ASSERT_EQ(callbackCounter, 0);
}


struct CCBC282_Info {
    int passCount;
    std::string kExists;
    std::string kMissing;
    std::string kHashKey;
    std::string kValue;
    lcb_server_t *server;

    template <typename T> void
    mkCommand(T* cmd, bool useExisting = true) {
        std::string &curKey = useExisting ? kExists : kMissing;
        cmd->v.v0.key = curKey.c_str();
        cmd->v.v0.nkey = curKey.size();
        cmd->v.v0.hashkey = kHashKey.c_str();
        cmd->v.v0.nhashkey = kHashKey.size();
    }
};

static void scheduleCommands_282(lcb_t instance, CCBC282_Info *info)
{
    // Schedule lots of items
    int ncmds = info->passCount == 0 ? 5 : 100;
    lcb_get_cmd_t *cmds = new lcb_get_cmd_t[ncmds];
    lcb_get_cmd_t **cmdlist = new lcb_get_cmd_t*[ncmds];
    void *cmdlog_head = info->server->cmd_log.read_head;

    info->passCount++;

    memset(cmds, 0, ncmds);

    for (int ii = 1; ii < ncmds; ii++) {
        info->mkCommand(cmds + ii, true);
        cmdlist[ii] = cmds + ii;
    }

    info->mkCommand(cmds, false);
    cmdlist[0] = cmds;

    lcb_error_t err;
    do {
        err = lcb_get(instance, info, ncmds, cmdlist);
        ASSERT_EQ(err, LCB_SUCCESS);
    } while (info->server->cmd_log.read_head == cmdlog_head);
    delete[] cmds;
    delete[] cmdlist;
}

extern "C" {
static void get_callback_282(lcb_t instance,
                             const void *cookie, lcb_error_t err,
                             const lcb_get_resp_t *resp)
{
    if (err == LCB_SUCCESS) {
        return;
    }

    CCBC282_Info *info = reinterpret_cast<CCBC282_Info*>(
            const_cast<void*>(cookie));

    if (info->passCount > 2) {
        return;
    }
    scheduleCommands_282(instance, info);

}
}

/**
 * Issue many gets from a multi-get MISS callback
 */
TEST_F(RegressionUnitTest, CCBC_282)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    CCBC282_Info info;
    info.passCount = 0;
    info.kExists = "ek";
    info.kMissing = "mk";
    info.kHashKey = "HK";
    info.kValue = "v";

    // Figure out which server this belongs to..
    int vbid, rv, ix;
    rv = vbucket_map(instance->vbucket_config,
                     info.kHashKey.c_str(),
                     (unsigned long)info.kHashKey.size(),
                     &vbid, &ix);

    ASSERT_NE(rv, -1);
    info.server = instance->servers + ix;

    struct lcb_remove_cmd_st rmcmd, *rmcmdp;
    struct lcb_store_cmd_st scmd, *scmdp;

    memset(&rmcmd, 0, sizeof(rmcmd));
    memset(&scmd, 0, sizeof(scmd));

    rmcmdp = &rmcmd;
    scmdp = &scmd;
    info.mkCommand(&rmcmd, false);
    info.mkCommand(&scmd, true);
    scmd.v.v0.operation = LCB_SET;
    scmd.v.v0.bytes = info.kValue.c_str();
    scmd.v.v0.nbytes = info.kValue.size();

    lcb_error_t err;
    err = lcb_remove(instance, NULL, 1, &rmcmdp);
    ASSERT_EQ(err, LCB_SUCCESS);
    lcb_wait(instance);

    err = lcb_store(instance, NULL, 1, &scmdp);
    ASSERT_EQ(err, LCB_SUCCESS);
    lcb_wait(instance);

    // Schedule the first set of get operations
    lcb_set_get_callback(instance, get_callback_282);
    scheduleCommands_282(instance, &info);
    lcb_wait(instance);
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
    MockEnvironment *mock = MockEnvironment::createSpecial(argv);
    struct ccbc_275_info_st info = { 0, LCB_SUCCESS };

    mock->makeConnectParams(crOpts, NULL);
    crOpts.v.v0.user = "protected";
    crOpts.v.v0.passwd = "secret";
    crOpts.v.v0.bucket = "protected";

    err = lcb_create(&instance, &crOpts);
    ASSERT_EQ(LCB_SUCCESS, err);

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
    ASSERT_EQ(LCB_ETIMEDOUT, info.last_err);

    // Make sure we've fully purged and disconnected the server
    struct lcb_cntl_vbinfo_st vbi;
    memset(&vbi, 0, sizeof(vbi));
    vbi.v.v0.key = key.c_str();
    vbi.v.v0.nkey = key.size();
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBMAP, &vbi);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_CONNSTATE_UNINIT,
              instance->servers[vbi.v.v0.server_index].connection.state);

    // Restore the timeout to something sane
    tmo_usec = 2500000;
    err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmo_usec);
    ASSERT_EQ(LCB_SUCCESS, err);

    info.call_count = 0;
    err = lcb_get(instance, &info, 1, &cmdp);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(1, info.call_count);

    ASSERT_EQ(LCB_KEY_ENOENT, info.last_err);

    lcb_destroy(instance);
    MockEnvironment::destroySpecial(mock);
}
