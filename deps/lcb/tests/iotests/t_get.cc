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
#include <libcouchbase/couchbase.h>
#include <map>
#include "iotests.h"

class GetUnitTest : public MockUnitTest
{
};

extern "C" {
    static void testGetMissGetCallback(lcb_t, const void *cookie,
                                       lcb_error_t error,
                                       const lcb_get_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_KEY_ENOENT, error);
        ASSERT_NE((const lcb_get_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        std::string val((const char *)resp->v.v0.key, resp->v.v0.nkey);
        EXPECT_TRUE(val == "testGetMiss1" || val == "testGetMiss2");
        ++(*counter);
    }
}

/**
 * @test
 * Get Miss
 *
 * @pre
 * Request two non-existent keys
 *
 * @post
 * Responses for both keys are received with error code
 * @c KEY_ENOENT; response structure is not NULL, and the keys match their
 * expected value
 *
 * @todo (maybe check the values too?)
 */
TEST_F(GetUnitTest, testGetMiss)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_get_callback(instance, testGetMissGetCallback);
    int numcallbacks = 0;

    removeKey(instance, "testGetMiss1");
    removeKey(instance, "testGetMiss2");

    lcb_get_cmd_t cmd1("testGetMiss1");
    lcb_get_cmd_t cmd2("testGetMiss2");
    lcb_get_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, 2, cmds));

    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
    static void testGetHitGetCallback(lcb_t, const void *cookie,
                                      lcb_error_t error,
                                      const lcb_get_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_SUCCESS, error);
        ASSERT_NE((const lcb_get_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test
 * Get Hit
 *
 * @pre
 * Store two keys, and retrieve them
 *
 * @post
 * Both keys exist, and their return code is successul
 */
TEST_F(GetUnitTest, testGetHit)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_get_callback(instance, testGetHitGetCallback);
    int numcallbacks = 0;

    storeKey(instance, "testGetKey1", "foo");
    storeKey(instance, "testGetKey2", "foo");
    lcb_get_cmd_t cmd1("testGetKey1");
    lcb_get_cmd_t cmd2("testGetKey2");
    lcb_get_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, 2, cmds));

    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
    static void testTouchMissCallback(lcb_t, const void *cookie,
                                      lcb_error_t error,
                                      const lcb_touch_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_KEY_ENOENT, error);
        ASSERT_NE((const lcb_touch_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Touch (Miss)
 * @pre Schedule a touch for a non existent key with an expiry @c 666
 * @post Touch fails with @c KEY_ENOENT
 */
TEST_F(GetUnitTest, testTouchMiss)
{
    std::string key("testTouchMissKey");
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_touch_callback(instance, testTouchMissCallback);
    removeKey(instance, key);

    int numcallbacks = 0;
    lcb_touch_cmd_t cmd(key.data(), key.length(), 666);
    lcb_touch_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_touch(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
    static void testTouchHitCallback(lcb_t, const void *cookie,
                                     lcb_error_t error,
                                     const lcb_touch_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_SUCCESS, error);
        ASSERT_NE((const lcb_touch_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Touch (Hit)
 * @pre Store a key, and schedule a touch operation with an expiry of @c 666
 * @post Touch succeeds.
 */
TEST_F(GetUnitTest, testTouchHit)
{
    std::string key("testTouchHitKey");
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_touch_callback(instance, testTouchHitCallback);
    storeKey(instance, key, "foo");

    int numcallbacks = 0;
    lcb_touch_cmd_t cmd(key.data(), key.length(), 666);
    lcb_touch_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_touch(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
    static void testMixedMultiGetCallback(lcb_t, const void *cookie,
                                          lcb_error_t error,
                                          const lcb_get_resp_t *resp)
    {
        using namespace std;
        map<string, Item> *kmap = (map<string, Item> *)cookie;

        Item itm;
        itm.assign(resp, error);

        (*kmap)[itm.key] = itm;
    }
}

/**
 * Adopted from smoke-test.c:test_get2
 *
 * @test Multi Get (Interleaved)
 *
 * @pre
 * Create two maps of 26 key-value pairs, one called @c kexisting and one
 * called @c kmissing. Store the @c kexisting map but not the @c kmissing one.
 *
 * Create a list of GET commands interleaving keys from @c kmissing and
 * @c kexisting. Schedule the operation
 *
 * @post
 * Returned result set has exactly 52 items. All the keys from @c kmissing
 * have @c KEY_ENOENT from their result code, and all keys from @c kexisting
 * contain the appropriate values.
 */
TEST_F(GetUnitTest, testMixedMultiGet)
{
    using namespace std;
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);


    vector<string> kexisting;
    vector<string> kmissing;
    map<string, Item> kmap;

    vector<lcb_get_cmd_t> cmds;
    vector<lcb_get_cmd_t *> cmdptrs;

    int iterations = 4;

    for (int ii = 0; ii < iterations; ii++) {
        char suffix = 'a' + ii;
        string k("existingKey");
        k += suffix;
        kexisting.push_back(k);
        storeKey(instance, k, k);

        k = "nonExistKey";
        k += suffix;
        removeKey(instance, k);
        kmissing.push_back(k);
    }

    for (int ii = 0; ii < iterations; ii++) {
        lcb_get_cmd_t cmdhit(kexisting[ii].c_str(), kexisting[ii].size());
        lcb_get_cmd_t cmdmiss(kmissing[ii].c_str(), kmissing[ii].size());

        cmds.push_back(cmdhit);
        cmds.push_back(cmdmiss);
    }

    for (unsigned int ii = 0; ii < cmds.size(); ii++) {
        cmdptrs.push_back(&cmds[ii]);
    }

    lcb_set_get_callback(instance, testMixedMultiGetCallback);

    EXPECT_EQ(LCB_SUCCESS,
              lcb_get(instance, &kmap, cmds.size(), &cmdptrs[0]));

    lcb_wait(instance);
    ASSERT_EQ(iterations * 2, kmap.size());

    for (int ii = 0; ii < iterations; ii++) {
        string k = kexisting[ii];
        ASSERT_EQ(1, kmap.count(k));
        Item itm = kmap[k];
        ASSERT_EQ(LCB_SUCCESS, itm.err);
        ASSERT_EQ(k, itm.val);

        k = kmissing[ii];
        ASSERT_EQ(1, kmap.count(k));
        itm = kmap[k];
        ASSERT_EQ(LCB_KEY_ENOENT, itm.err);
    }
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

TEST_F(GetUnitTest, testFlags)
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

struct RGetCookie {
    unsigned remaining;
    lcb_error_t expectrc;
    std::string value;
    lcb_U64 cas;
};

extern "C" {
static void
rget_callback(lcb_t instance, int, const lcb_RESPBASE *resp)
{
    const lcb_RESPGET *gresp = (const lcb_RESPGET *)resp;
    RGetCookie *rck = (RGetCookie *)resp->cookie;

    ASSERT_EQ(rck->expectrc, resp->rc);
    ASSERT_NE(0, rck->remaining);
    rck->remaining--;

    if (resp->rc == LCB_SUCCESS) {
        std::string value((const char*)gresp->value, gresp->nvalue);
        ASSERT_STREQ(rck->value.c_str(), value.c_str());
        ASSERT_EQ(rck->cas, resp->cas);
    }

}
static void rget_noop_callback(lcb_t,int,const lcb_RESPBASE*){}
}

TEST_F(GetUnitTest, testGetReplica)
{
    SKIP_UNLESS_MOCK();
    MockEnvironment *mock = MockEnvironment::getInstance();
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);
    std::string key("a_key_GETREPLICA");
    std::string val("a_value");

    lcb_CMDGETREPLICA rcmd = { 0 };

    lcb_install_callback3(instance, LCB_CALLBACK_GETREPLICA, rget_callback);
    RGetCookie rck;
    rck.remaining = 1;
    rck.expectrc = LCB_SUCCESS;
    LCB_CMD_SET_KEY(&rcmd, key.c_str(), key.size());
    unsigned nreplicas = lcb_get_num_replicas(instance);

    for (unsigned ii = 0; ii < nreplicas; ii++) {
        MockMutationCommand mcCmd(MockCommand::CACHE, key);
        mcCmd.cas = ii + 100;
        rck.cas = ((lcb_U64)htonl((lcb_U32)mcCmd.cas)) << 32;
        mcCmd.replicaList.clear();
        mcCmd.replicaList.push_back(ii);

        mock->sendCommand(mcCmd);
        mock->getResponse();

        lcb_error_t err;
        rcmd.index = ii;
        rcmd.strategy = LCB_REPLICA_SELECT;

        rck.remaining = 1;
        lcb_sched_enter(instance);
        err = lcb_rget3(instance, &rck, &rcmd);
        ASSERT_EQ(LCB_SUCCESS, err);

        lcb_sched_leave(instance);
        lcb_wait(instance);
        ASSERT_EQ(0, rck.remaining);
    }

    // Test with the "All" mode
    MockMutationCommand mcCmd(MockCommand::CACHE, key);
    mcCmd.cas = 999;
    mcCmd.onMaster = false;
    mcCmd.replicaCount = nreplicas;
    mock->sendCommand(mcCmd);
    mock->getResponse();

    rck.remaining = nreplicas;
    rck.cas = ((lcb_U64)ntohl((lcb_U32)mcCmd.cas)) << 32;
    rck.expectrc = LCB_SUCCESS;
    rcmd.strategy = LCB_REPLICA_ALL;

    lcb_sched_enter(instance);
    lcb_error_t err = lcb_rget3(instance, &rck, &rcmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);
    lcb_wait(instance);
    ASSERT_EQ(0, rck.remaining);

    MockMutationCommand purgeCmd(MockCommand::PURGE, key);
    purgeCmd.onMaster = true;
    purgeCmd.replicaCount = nreplicas;
    mock->sendCommand(purgeCmd);
    mock->getResponse();

    // Test with the "First" mode. Ensure that only the _last_ replica
    // contains the item
    mcCmd.onMaster = false;
    mcCmd.replicaCount = 0 ;
    mcCmd.replicaList.clear();
    mcCmd.replicaList.push_back(nreplicas-1);
    mcCmd.cas = 42;
    rck.cas = ((lcb_U64)ntohl((lcb_U32)mcCmd.cas)) << 32;

    // Set the timeout to something higher, since we have more than one packet
    // to send.
    lcb_cntl_setu32(instance, LCB_CNTL_OP_TIMEOUT, 10000000);

    // The first replica should respond with ENOENT, the second should succeed
    // though
    mock->sendCommand(mcCmd);
    mock->getResponse();
    rcmd.strategy = LCB_REPLICA_FIRST;
    rck.remaining = 1;
    lcb_sched_enter(instance);
    err = lcb_rget3(instance, &rck, &rcmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);
    lcb_wait(instance);
    ASSERT_EQ(0, rck.remaining);

    // Test with an invalid index
    rcmd.index = nreplicas;
    rcmd.strategy = LCB_REPLICA_SELECT;
    err = lcb_rget3(instance, NULL, &rcmd);
    ASSERT_EQ(LCB_NO_MATCHING_SERVER, err);

    // If no crash, it's good.
    if (lcb_get_num_replicas(instance) > 1) {
        // Use the 'first' mode, but make the second replica index be -1, so
        // that in the retry we need to skip over an index.

        lcbvb_CONFIG *vbc;
        err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, (void *)&vbc);
        int vbid = lcbvb_k2vb(vbc, key.c_str(), key.size());
        int oldix;

        lcbvb_VBUCKET* vb = &vbc->vbuckets[vbid];
        oldix = vb->servers[2];
        vb->servers[2] = -1;

        rck.expectrc = LCB_KEY_ENOENT;
        rck.remaining = 1;
        lcb_sched_enter(instance);
        rcmd.strategy = LCB_REPLICA_FIRST;
        err = lcb_rget3(instance, &rck, &rcmd);
        ASSERT_EQ(LCB_SUCCESS, err);
        lcb_sched_leave(instance);
        lcb_wait(instance);
        ASSERT_EQ(0, rck.remaining);

        // Try with ALL again (should give an error)
        rcmd.strategy = LCB_REPLICA_ALL;
        lcb_sched_enter(instance);
        err = lcb_rget3(instance, NULL, &rcmd);
        ASSERT_EQ(LCB_NO_MATCHING_SERVER, err);
        lcb_sched_leave(instance);

        vb->servers[2] = oldix;
    } else {
        printf("Not enough replicas for get-with-replica test\n");
    }

    // Test rget with a missing key. Fixes a potential bug
    lcb_install_callback3(instance, LCB_CALLBACK_GETREPLICA, rget_noop_callback);
    removeKey(instance, key);
    rcmd.strategy = LCB_REPLICA_FIRST;
    lcb_sched_enter(instance);
    err = lcb_rget3(instance, NULL, &rcmd);
    lcb_sched_leave(instance);
    lcb_wait(instance);
}
