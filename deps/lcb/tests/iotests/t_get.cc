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
#include <libcouchbase/couchbase.h>
#include <libcouchbase/utils.h>
#include <map>
#include "iotests.h"
#include "logging.h"
#include "internal.h"

#define LOGARGS(instance, lvl) instance->settings, "tests-GET", LCB_LOG_##lvl, __FILE__, __LINE__

class GetUnitTest : public MockUnitTest
{
};

extern "C" {
static void testGetMissGetCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    int *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, lcb_respget_status(resp));
    const char *key;
    size_t nkey;
    lcb_respget_key(resp, &key, &nkey);
    std::string val(key, nkey);
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
 * @c KEY_ENOENT; response structure is not nullptr, and the keys match their
 * expected value
 *
 * @todo (maybe check the values too?)
 */
TEST_F(GetUnitTest, testGetMiss)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetMissGetCallback);
    int numcallbacks = 0;
    std::string key1("testGetMiss1"), key2("testGetMiss2");

    removeKey(instance, key1);
    removeKey(instance, key2);

    lcb_CMDGET *cmd;

    lcb_cmdget_create(&cmd);
    lcb_cmdget_key(cmd, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmd));

    lcb_cmdget_key(cmd, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmd));
    lcb_cmdget_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
static void testGetHitGetCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    int *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_SUCCESS, lcb_respget_status(resp));
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
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetHitGetCallback);
    int numcallbacks = 0;
    std::string key1("testGetKey1"), key2("testGetKey2");

    storeKey(instance, key1, "foo");
    storeKey(instance, key2, "foo");

    lcb_CMDGET *cmd;

    lcb_cmdget_create(&cmd);
    lcb_cmdget_key(cmd, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmd));

    lcb_cmdget_key(cmd, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmd));
    lcb_cmdget_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
static void testTouchMissCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPTOUCH *resp)
{
    int *counter;
    lcb_resptouch_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, lcb_resptouch_status(resp));
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
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_TOUCH, (lcb_RESPCALLBACK)testTouchMissCallback);
    removeKey(instance, key);

    int numcallbacks = 0;

    lcb_CMDTOUCH *cmd;
    lcb_cmdtouch_create(&cmd);
    lcb_cmdtouch_key(cmd, key.c_str(), key.size());
    lcb_cmdtouch_expiry(cmd, 666);
    lcb_touch(instance, &numcallbacks, cmd);
    lcb_cmdtouch_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
static void testTouchHitCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPTOUCH *resp)
{
    int *counter;
    lcb_resptouch_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_SUCCESS, lcb_resptouch_status(resp));
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
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_TOUCH, (lcb_RESPCALLBACK)testTouchHitCallback);
    storeKey(instance, key, "foo");

    int numcallbacks = 0;
    lcb_CMDTOUCH *cmd;
    lcb_cmdtouch_create(&cmd);
    lcb_cmdtouch_key(cmd, key.c_str(), key.size());
    lcb_cmdtouch_expiry(cmd, 666);
    lcb_touch(instance, &numcallbacks, cmd);
    lcb_cmdtouch_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
static void flags_store_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    ASSERT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));

    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    ASSERT_EQ(5, nkey);
    ASSERT_EQ(0, memcmp(key, "flags", 5));

    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
    ++(*counter);
}

static void flags_get_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    int *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_SUCCESS, lcb_respget_status(resp));

    const char *key;
    size_t nkey;
    lcb_respget_key(resp, &key, &nkey);
    ASSERT_EQ(5, nkey);
    ASSERT_EQ(0, memcmp(key, "flags", 5));

    const char *value;
    size_t nvalue;
    lcb_respget_value(resp, &value, &nvalue);
    ASSERT_EQ(1, nvalue);
    ASSERT_EQ(0, memcmp(value, "x", 1));

    uint32_t flags;
    lcb_respget_flags(resp, &flags);
    ASSERT_EQ(0xdeadbeef, flags);
    ++(*counter);
}
}

TEST_F(GetUnitTest, testFlags)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;

    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)flags_get_callback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)flags_store_callback);

    int numcallbacks = 0;

    lcb_CMDSTORE *scmd;
    lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(scmd, "flags", 5);
    lcb_cmdstore_value(scmd, "x", 1);
    lcb_cmdstore_flags(scmd, 0xdeadbeef);

    ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, scmd));
    lcb_cmdstore_destroy(scmd);

    // Wait for it to be persisted
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    lcb_CMDGET *gcmd;
    lcb_cmdget_create(&gcmd);
    lcb_cmdget_key(gcmd, "flags", 5);
    ASSERT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, gcmd));
    lcb_cmdget_destroy(gcmd);

    /* Wait for it to be received */
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);
}

struct RGetCookie {
    unsigned remaining{};
    lcb_STATUS expectrc{};
    std::string value;
    lcb_U64 cas{};
};

extern "C" {
static void rget_callback(lcb_INSTANCE *instance, int, const lcb_RESPGETREPLICA *resp)
{
    RGetCookie *rck;
    lcb_respgetreplica_cookie(resp, (void **)&rck);

    lcb_STATUS rc = lcb_respgetreplica_status(resp);
    ASSERT_EQ(rck->expectrc, rc);
    ASSERT_NE(0, rck->remaining);
    rck->remaining--;

    if (rc == LCB_SUCCESS) {
        const char *v;
        size_t n;
        lcb_respgetreplica_value(resp, &v, &n);
        std::string value(v, n);
        ASSERT_STREQ(rck->value.c_str(), value.c_str());

        uint64_t cas;
        lcb_respgetreplica_cas(resp, &cas);
        ASSERT_EQ(rck->cas, cas);
    }
}
static void rget_noop_callback(lcb_INSTANCE *, int, const lcb_RESPGETREPLICA *) {}
}

TEST_F(GetUnitTest, testGetReplica)
{
    SKIP_UNLESS_MOCK()
    MockEnvironment *mock = MockEnvironment::getInstance();
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);
    std::string key("a_key_GETREPLICA");
    std::string val("a_value");

    lcb_CMDGETREPLICA *rcmd;

    lcb_install_callback(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPCALLBACK)rget_callback);
    RGetCookie rck;
    rck.remaining = 1;
    rck.expectrc = LCB_SUCCESS;
    int nreplicas = lcb_get_num_replicas(instance);

    for (int ii = 0; ii < nreplicas; ii++) {
        MockMutationCommand mcCmd(MockCommand::CACHE, key);
        mcCmd.cas = static_cast<uint64_t>(ii) + 100;
        rck.cas = mcCmd.cas;
        mcCmd.replicaList.clear();
        mcCmd.replicaList.push_back(ii);

        mock->sendCommand(mcCmd);
        mock->getResponse();

        lcb_STATUS err;
        lcb_REPLICA_MODE mode;
        switch (ii) {
            case 0:
                mode = LCB_REPLICA_MODE_IDX0;
                break;
            case 1:
                mode = LCB_REPLICA_MODE_IDX1;
                break;
            case 2:
                mode = LCB_REPLICA_MODE_IDX2;
                break;
            default:
                ASSERT_FALSE("Unexpected replica index");
                break;
        }
        lcb_cmdgetreplica_create(&rcmd, mode);
        lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());

        rck.remaining = 1;
        lcb_sched_enter(instance);
        err = lcb_getreplica(instance, &rck, rcmd);
        ASSERT_EQ(LCB_SUCCESS, err);
        lcb_cmdgetreplica_destroy(rcmd);

        lcb_sched_leave(instance);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
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
    rck.cas = mcCmd.cas;
    rck.expectrc = LCB_SUCCESS;

    lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_ALL);
    lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
    lcb_sched_enter(instance);
    lcb_STATUS err = lcb_getreplica(instance, &rck, rcmd);
    lcb_cmdgetreplica_destroy(rcmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(0, rck.remaining);

    MockMutationCommand purgeCmd(MockCommand::PURGE, key);
    purgeCmd.onMaster = true;
    purgeCmd.replicaCount = nreplicas;
    mock->sendCommand(purgeCmd);
    mock->getResponse();

    // Test with the "First" mode. Ensure that only the _last_ replica
    // contains the item
    mcCmd.onMaster = false;
    mcCmd.replicaCount = 0;
    mcCmd.replicaList.clear();
    mcCmd.replicaList.push_back(nreplicas - 1);
    mcCmd.cas = 42;
    rck.cas = mcCmd.cas;

    // Set the timeout to something higher, since we have more than one packet
    // to send.
    lcb_cntl_setu32(instance, LCB_CNTL_OP_TIMEOUT, 10000000);

    // The first replica should respond with ENOENT, the second should succeed
    // though
    mock->sendCommand(mcCmd);
    mock->getResponse();
    lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_ANY);
    lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
    rck.remaining = 1;
    lcb_sched_enter(instance);
    err = lcb_getreplica(instance, &rck, rcmd);
    lcb_cmdgetreplica_destroy(rcmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(0, rck.remaining);

    // Test with an invalid index
    rcmd = nullptr;
    ASSERT_EQ(LCB_ERR_INVALID_ARGUMENT, lcb_cmdgetreplica_create(&rcmd, (lcb_REPLICA_MODE)42));
    ASSERT_EQ((lcb_CMDGETREPLICA *)nullptr, rcmd);

    // If no crash, it's good.
    if (lcb_get_num_replicas(instance) > 1) {
        // Use the 'first' mode, but make the second replica index be -1, so
        // that in the retry we need to skip over an index.

        lcbvb_CONFIG *vbc;
        err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, (void *)&vbc);
        int vbid = lcbvb_k2vb(vbc, key.c_str(), key.size());
        int oldix;

        lcbvb_VBUCKET *vb = &vbc->vbuckets[vbid];
        oldix = vb->servers[2];
        vb->servers[2] = -1;

        rck.expectrc = LCB_ERR_DOCUMENT_NOT_FOUND;
        rck.remaining = 1;
        lcb_sched_enter(instance);
        lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_ANY);
        lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
        err = lcb_getreplica(instance, &rck, rcmd);
        lcb_cmdgetreplica_destroy(rcmd);
        ASSERT_EQ(LCB_SUCCESS, err);
        lcb_sched_leave(instance);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_EQ(0, rck.remaining);

        // Try with ALL again (should give an error)
        lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_ALL);
        lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
        lcb_sched_enter(instance);
        err = lcb_getreplica(instance, nullptr, rcmd);
        lcb_cmdgetreplica_destroy(rcmd);
        ASSERT_EQ(LCB_ERR_NO_MATCHING_SERVER, err);
        lcb_sched_leave(instance);

        vb->servers[2] = oldix;
    } else {
        printf("Not enough replicas for get-with-replica test\n");
    }

    // Test rget with a missing key. Fixes a potential bug
    lcb_install_callback(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPCALLBACK)rget_noop_callback);
    removeKey(instance, key);
    lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_ANY);
    lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
    lcb_sched_enter(instance);
    err = lcb_getreplica(instance, nullptr, rcmd);
    lcb_cmdgetreplica_destroy(rcmd);
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
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
}

struct ReplicaGetCookie {
    unsigned remaining{};
    std::set<lcb_STATUS> expectrc;
};

static void replicaget_callback(lcb_INSTANCE *instance, int, const lcb_RESPGETREPLICA *resp)
{
    ReplicaGetCookie *rck;
    lcb_respgetreplica_cookie(resp, (void **)&rck);

    lcb_STATUS rc = lcb_respgetreplica_status(resp);
    EXPECT_EQ(1, rck->expectrc.count(rc));
    EXPECT_NE(0, rck->remaining);
    rck->remaining--;
}
}

TEST_F(GetUnitTest, testFailoverAndGetReplica)
{
    SKIP_UNLESS_MOCK()
    const char *argv[] = {"--replicas", "3", "--nodes", "4", nullptr};
    MockEnvironment mock_o(argv), *mock = &mock_o;
    HandleWrap hw;
    lcb_INSTANCE *instance;
    mock->createConnection(hw, &instance);
    lcb_connect(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(3, lcb_get_num_replicas(instance));
    ASSERT_EQ(4, lcb_get_num_nodes(instance));

    // Set the timeout for 100 ms
    lcb_uint32_t tmoval = 100000;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmoval);
    // Reduce configuration poll interval to get new configuration sooner
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_CONFIG_POLL_INTERVAL, &tmoval);

    // store keys
    size_t counter = 0;
    lcb_CMDSTORE *scmd;
    lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
    std::string key("key");
    lcb_cmdstore_key(scmd, key.c_str(), strlen(key.c_str()));
    lcb_cmdstore_value(scmd, "val", 3);
    ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, &counter, scmd));
    lcb_cmdstore_destroy(scmd);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    ASSERT_EQ(1U, counter);

    // check server index
    int nodeFirstReplica = mock->getKeyIndex(instance, key, "default", 1);
    // failover node first replica
    mock->failoverNode(nodeFirstReplica, "default", false);
    lcb_log(LOGARGS(instance, INFO), "Failover node %d (1st replica)...", nodeFirstReplica);

    counter = 0;
    {
        lcb_CMDGET *gcmd;
        lcb_cmdget_create(&gcmd);
        lcb_cmdget_key(gcmd, key.c_str(), strlen(key.c_str()));
        ASSERT_EQ(LCB_SUCCESS, lcb_get(instance, &counter, gcmd));
        lcb_cmdget_destroy(gcmd);
        lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
        lcb_log(LOGARGS(instance, INFO), "get master");
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_EQ(1U, counter);
    }

    // check server second replica
    int nodeSecondReplica = mock->getKeyIndex(instance, key, "default", 2);
    // failover node second replica
    mock->failoverNode(nodeSecondReplica, "default", false);
    lcb_log(LOGARGS(instance, INFO), "Failover node %d (2nd replica)...", nodeSecondReplica);

    // check server third replica
    int nodeThirdReplica = mock->getKeyIndex(instance, key, "default", 3);
    // failover node third replica
    mock->failoverNode(nodeThirdReplica, "default", false);
    lcb_log(LOGARGS(instance, INFO), "Failover node %d (3rd replica)...", nodeThirdReplica);

    usleep(LCB_MS2US(300));
    {
        lcb_CMDGETREPLICA *rcmd;
        lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_IDX2); // third replica
        lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
        ReplicaGetCookie rck;
        rck.remaining = 1;
        rck.expectrc.insert(LCB_ERR_MAP_CHANGED);
        rck.expectrc.insert(LCB_ERR_TIMEOUT);
        EXPECT_EQ(LCB_SUCCESS, lcb_getreplica(instance, &rck, rcmd));
        lcb_cmdgetreplica_destroy(rcmd);
        lcb_install_callback(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPCALLBACK)replicaget_callback);
        lcb_log(LOGARGS(instance, INFO), "get third replica");
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        EXPECT_EQ(0, rck.remaining);
    }
    {
        lcb_CMDGETREPLICA *rcmd;
        lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_IDX1); // second replica
        lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
        ReplicaGetCookie rck;
        rck.remaining = 1;
        rck.expectrc.insert(LCB_ERR_MAP_CHANGED);
        rck.expectrc.insert(LCB_ERR_TIMEOUT);
        lcb_STATUS rc = lcb_getreplica(instance, &rck, rcmd);
        EXPECT_TRUE(rc == LCB_SUCCESS || rc == LCB_ERR_NO_MATCHING_SERVER);
        lcb_cmdgetreplica_destroy(rcmd);
        if (rc == LCB_SUCCESS) {
            lcb_install_callback(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPCALLBACK)replicaget_callback);
            lcb_log(LOGARGS(instance, INFO), "get second replica");
            lcb_wait(instance, LCB_WAIT_DEFAULT);
            EXPECT_EQ(0, rck.remaining);
        }
    }
    lcb_tick_nowait(instance);
    {
        lcb_CMDGETREPLICA *rcmd;
        lcb_cmdgetreplica_create(&rcmd, LCB_REPLICA_MODE_IDX0); // first replica
        lcb_cmdgetreplica_key(rcmd, key.c_str(), key.size());
        /* here we definitely have new configuration already and the library will reject get_with_replica request */
        EXPECT_EQ(LCB_ERR_NO_MATCHING_SERVER, lcb_getreplica(instance, nullptr, rcmd));
        lcb_cmdgetreplica_destroy(rcmd);
    }

    counter = 0;
    {
        lcb_CMDGET *gcmd;
        lcb_cmdget_create(&gcmd);
        lcb_cmdget_key(gcmd, key.c_str(), strlen(key.c_str()));
        EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &counter, gcmd));
        lcb_cmdget_destroy(gcmd);
        lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
        lcb_log(LOGARGS(instance, INFO), "get master");
        lcb_wait(instance, LCB_WAIT_NOCHECK);
        EXPECT_EQ(1U, counter);
    }
}

TEST_F(GetUnitTest, testFailoverAndMultiGet)
{
    SKIP_UNLESS_MOCK()
    MockEnvironment *mock = MockEnvironment::getInstance();
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);
    size_t nbCallbacks = 50;
    std::vector<std::string> keys;
    keys.resize(nbCallbacks);

    // Set the timeout for 100 ms
    lcb_uint32_t tmoval = 100000;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmoval);

    // store keys
    lcb_sched_enter(instance);

    size_t counter = 0;
    for (size_t ii = 0; ii < nbCallbacks; ++ii) {
        lcb_CMDSTORE *scmd;
        lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
        char key[6];
        sprintf(key, "key%zu", ii);
        keys[ii] = std::string(key);
        lcb_cmdstore_key(scmd, key, strlen(key));
        lcb_cmdstore_value(scmd, "val", 3);
        ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, &counter, scmd));
        lcb_cmdstore_destroy(scmd);
    }

    lcb_sched_leave(instance);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    ASSERT_EQ(nbCallbacks, counter);

    // check server index
    size_t nbKeyinNode0 = 0;
    for (size_t ii = 0; ii < nbCallbacks; ++ii) {
        if (mock->getKeyIndex(instance, keys[ii]) == 0) { // master copy of key in node 0
            ++nbKeyinNode0;
        }
    }
    EXPECT_GE(nbKeyinNode0, 2); // at least 2 keys with master in node 0

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

    // failover index 0
    mock->failoverNode(0, "default", false);
    lcb_log(LOGARGS(instance, INFO), "Failover node 0 ...");

    // multiget KO
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

    // multiget KO
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

    // multiget KO
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

extern "C" {

struct pl_result {
    lcb_STATUS status{LCB_ERR_GENERIC};
    bool invoked{false};
    uint64_t cas{0};
};

static void pl_store_callback(lcb_INSTANCE *instance, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    pl_result *res = nullptr;
    lcb_respstore_cookie(resp, (void **)&res);
    res->invoked = true;
    res->status = lcb_respstore_status(resp);
    if (res->status == LCB_SUCCESS) {
        lcb_respstore_cas(resp, &res->cas);
    }
}

static void pl_get_callback(lcb_INSTANCE *instance, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    pl_result *res = nullptr;
    lcb_respget_cookie(resp, (void **)&res);
    res->invoked = true;
    res->status = lcb_respget_status(resp);
    if (res->status == LCB_SUCCESS) {
        lcb_respget_cas(resp, &res->cas);
    }
}

static void pl_unlock_callback(lcb_INSTANCE *instance, lcb_CALLBACK_TYPE, const lcb_RESPUNLOCK *resp)
{
    pl_result *res = nullptr;
    lcb_respunlock_cookie(resp, (void **)&res);
    res->invoked = true;
    res->status = lcb_respunlock_status(resp);
    if (res->status == LCB_SUCCESS) {
        lcb_respunlock_cas(resp, &res->cas);
    }
}
}

TEST_F(GetUnitTest, testPessimisticLock)
{
    SKIP_IF_MOCK()
    MockEnvironment *mock = MockEnvironment::getInstance();
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    lcb_install_callback(instance, LCB_CALLBACK_GET, reinterpret_cast<lcb_RESPCALLBACK>(pl_get_callback));
    lcb_install_callback(instance, LCB_CALLBACK_STORE, reinterpret_cast<lcb_RESPCALLBACK>(pl_store_callback));
    lcb_install_callback(instance, LCB_CALLBACK_UNLOCK, reinterpret_cast<lcb_RESPCALLBACK>(pl_unlock_callback));

    std::string key("testPessimisticLock");

    std::uint64_t cas{0};
    {
        pl_result res{};

        std::string value{"foo"};
        lcb_CMDSTORE *cmd = nullptr;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, value.c_str(), value.size());
        lcb_store(instance, &res, cmd);
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_SUCCESS, res.status);
        cas = res.cas;
    }
    {
        // lock and record CAS of the locked document
        pl_result res{};

        lcb_CMDGET *cmd = nullptr;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key.c_str(), key.size());
        lcb_cmdget_locktime(cmd, 5);
        lcb_get(instance, &res, cmd);
        lcb_cmdget_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_SUCCESS, res.status);
        ASSERT_NE(cas, res.cas);
        cas = res.cas;
    }
    {
        // real CAS is masked now and not visible by regular GET
        pl_result res{};

        lcb_CMDGET *cmd = nullptr;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key.c_str(), key.size());
        lcb_get(instance, &res, cmd);
        lcb_cmdget_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_SUCCESS, res.status);
        ASSERT_NE(cas, res.cas);
    }
    {
        // it is not allowed to lock the same key twice
        pl_result res{};

        lcb_CMDGET *cmd = nullptr;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key.c_str(), key.size());
        lcb_cmdget_locktime(cmd, 5);
        lcb_get(instance, &res, cmd);
        lcb_cmdget_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_ERR_DOCUMENT_LOCKED, res.status);
    }
    {
        // it is not allowed to mutate the locked key
        pl_result res{};

        std::string value{"foo"};
        lcb_CMDSTORE *cmd = nullptr;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, value.c_str(), value.size());
        lcb_store(instance, &res, cmd);
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_ERR_DOCUMENT_LOCKED, res.status);
    }
    {
        // but mutating the locked key is allowed with known cas
        pl_result res{};

        std::string value{"foo"};
        lcb_CMDSTORE *cmd = nullptr;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, value.c_str(), value.size());
        lcb_cmdstore_cas(cmd, cas);
        lcb_store(instance, &res, cmd);
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_SUCCESS, res.status);
    }
    {
        pl_result res{};

        lcb_CMDGET *cmd = nullptr;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key.c_str(), key.size());
        lcb_cmdget_locktime(cmd, 5);
        lcb_get(instance, &res, cmd);
        lcb_cmdget_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_SUCCESS, res.status);
        ASSERT_NE(cas, res.cas);
        cas = res.cas;
    }
    {
        // to unlock key without mutation, lcb_unlock might be used
        pl_result res{};

        std::string value{"foo"};
        lcb_CMDUNLOCK *cmd = nullptr;
        lcb_cmdunlock_create(&cmd);
        lcb_cmdunlock_key(cmd, key.c_str(), key.size());
        lcb_cmdunlock_cas(cmd, cas);
        lcb_unlock(instance, &res, cmd);
        lcb_cmdunlock_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_SUCCESS, res.status);
    }
    {
        // now the key is not locked
        pl_result res{};

        std::string value{"foo"};
        lcb_CMDSTORE *cmd = nullptr;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, value.c_str(), value.size());
        lcb_store(instance, &res, cmd);
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.invoked);
        ASSERT_EQ(LCB_SUCCESS, res.status);
    }
}
