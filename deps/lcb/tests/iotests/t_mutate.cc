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

class MutateUnitTest : public MockUnitTest
{
};

extern "C" {
    static void testSimpleSetStoreCallback(lcb_t, const void *cookie,
                                           lcb_storage_t operation,
                                           lcb_error_t error,
                                           const lcb_store_resp_t *resp)
    {
        using namespace std;
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_SET, operation);
        EXPECT_EQ(LCB_SUCCESS, error);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        std::string val((const char *)resp->v.v0.key, resp->v.v0.nkey);
        EXPECT_TRUE(val == "testSimpleStoreKey1" || val == "testSimpleStoreKey2");
        ++(*counter);
        EXPECT_NE(0, resp->v.v0.cas);
    }
}

/**
 * @test
 * Simple Set
 *
 * @pre
 * Set two keys
 *
 * @post
 *
 * @c SUCCESS, both keys are received
 */
TEST_F(MutateUnitTest, testSimpleSet)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testSimpleSetStoreCallback);
    int numcallbacks = 0;
    lcb_store_cmd_t cmd1(LCB_SET, "testSimpleStoreKey1", 19, "key1", 4);
    lcb_store_cmd_t cmd2(LCB_SET, "testSimpleStoreKey2", 19, "key2", 4);
    lcb_store_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 2, cmds));
    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

/**
 * @test Zero length key
 * @pre set a zero length for a key foo
 * @post should not be able to schedule operation
 */
TEST_F(MutateUnitTest, testStoreZeroLengthKey)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_sched_enter(instance);
    lcb_CMDSTORE cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, NULL, 0);
    LCB_CMD_SET_VALUE(&cmd, "bar", 3);
    cmd.operation = LCB_SET;
    EXPECT_EQ(LCB_EMPTY_KEY, lcb_store3(instance, NULL, &cmd));
    lcb_sched_leave(instance);
}


extern "C" {
    static void
    testStoreZeroLengthValueCallback(lcb_t, int, const lcb_RESPBASE *resp)
    {
        lcb_RESPSTORE *sresp = (lcb_RESPSTORE *)resp;
        int *counter = (int *)sresp->cookie;
        ASSERT_EQ(LCB_SET, sresp->op);
        EXPECT_EQ(LCB_SUCCESS, sresp->rc);
        ++(*counter);
    }
}
/**
 * @test Zero length value
 * @pre set a zero length value for a key foo
 * @post should be able to retreive back empty value
 */
TEST_F(MutateUnitTest, testStoreZeroLengthValue)
{
    std::string key("foo");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_sched_enter(instance);
    (void)lcb_install_callback3(instance, LCB_CALLBACK_STORE, testStoreZeroLengthValueCallback);
    lcb_CMDSTORE cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, key.data(), key.length());
    LCB_CMD_SET_VALUE(&cmd, NULL, 0);
    cmd.operation = LCB_SET;
    int numcallbacks = 0;
    EXPECT_EQ(LCB_SUCCESS, lcb_store3(instance, &numcallbacks, &cmd));
    lcb_sched_leave(instance);
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    EXPECT_EQ(1, numcallbacks);

    Item itm;
    getKey(instance, key, itm);
    EXPECT_EQ(0, itm.val.length());
}

extern "C" {
    static void testRemoveCallback(lcb_t, const void *cookie,
                                   lcb_error_t error,
                                   const lcb_remove_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_SUCCESS, error);
        ASSERT_NE((const lcb_remove_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Remove
 *
 * @pre Set two keys and remove them
 * @post Remove succeeds for both keys
 */
TEST_F(MutateUnitTest, testRemove)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_remove_callback(instance, testRemoveCallback);
    int numcallbacks = 0;
    storeKey(instance, "testRemoveKey1", "foo");
    storeKey(instance, "testRemoveKey2", "foo");
    lcb_remove_cmd_t cmd1("testRemoveKey1");
    lcb_remove_cmd_t cmd2("testRemoveKey2");
    lcb_remove_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, &numcallbacks, 2, cmds));

    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
    static void testRemoveMissCallback(lcb_t, const void *cookie,
                                       lcb_error_t error,
                                       const lcb_remove_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_KEY_ENOENT, error);
        ASSERT_NE((const lcb_remove_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Remove (Miss)
 * @pre Remove two non-existent keys
 * @post Remove fails for both keys with @c KEY_ENOENT
 */
TEST_F(MutateUnitTest, testRemoveMiss)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_remove_callback(instance, testRemoveMissCallback);
    int numcallbacks = 0;
    removeKey(instance, "testRemoveMissKey1");
    removeKey(instance, "testRemoveMissKey2");
    lcb_remove_cmd_t cmd1("testRemoveMissKey1");
    lcb_remove_cmd_t cmd2("testRemoveMissKey2");
    lcb_remove_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, &numcallbacks, 2, cmds));

    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
    static void testSimpleAddStoreCallback(lcb_t, const void *cookie,
                                           lcb_storage_t operation,
                                           lcb_error_t error,
                                           const lcb_store_resp_t *resp)
    {
        using namespace std;
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_ADD, operation);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        std::string val((const char *)resp->v.v0.key, resp->v.v0.nkey);
        EXPECT_STREQ("testSimpleAddKey", val.c_str());
        if (*counter == 0) {
            EXPECT_EQ(LCB_SUCCESS, error);
            EXPECT_NE(0, resp->v.v0.cas);
        } else {
            EXPECT_EQ(LCB_KEY_EEXISTS, error);
        }
        ++(*counter);
    }
}

/**
 * @test Add (Simple)
 * @pre Schedule to Add operations on the same key
 * @post First operation is a success. Second fails with @c KEY_EEXISTS
 */
TEST_F(MutateUnitTest, testSimpleAdd)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testSimpleAddStoreCallback);
    removeKey(instance, "testSimpleAddKey");
    int numcallbacks = 0;
    lcb_store_cmd_t cmd1(LCB_ADD, "testSimpleAddKey", 16, "key1", 4);
    lcb_store_cmd_t cmd2(LCB_ADD, "testSimpleAddKey", 16, "key2", 4);
    lcb_store_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 2, cmds));
    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
    static void testSimpleAppendStoreCallback(lcb_t, const void *cookie,
                                              lcb_storage_t operation,
                                              lcb_error_t error,
                                              const lcb_store_resp_t *resp)
    {
        using namespace std;
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_APPEND, operation);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        EXPECT_EQ(LCB_SUCCESS, error);
        EXPECT_NE(0, resp->v.v0.cas);
        ++(*counter);
    }
}

/**
 * @test Append
 * @pre Set a key to @c foo, append it with @c bar. Retrieve the key
 * @post Key is now @c foobar
 */
TEST_F(MutateUnitTest, testSimpleAppend)
{
    std::string key("testSimpleAppendKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testSimpleAppendStoreCallback);
    storeKey(instance, key, "foo");
    int numcallbacks = 0;
    lcb_store_cmd_t cmd(LCB_APPEND, key.data(), key.length(), "bar", 3);
    lcb_store_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);

    Item itm;
    getKey(instance, key, itm);
    EXPECT_STREQ("foobar", itm.val.c_str());

}

extern "C" {
    static void
    testAppendNonExistingKeyCallback(lcb_t, int, const lcb_RESPBASE *resp)
    {
        lcb_RESPSTORE *sresp = (lcb_RESPSTORE *)resp;
        int *counter = (int *)sresp->cookie;
        ASSERT_EQ(LCB_APPEND, sresp->op);
        EXPECT_EQ(LCB_NOT_STORED, sresp->rc);
        ++(*counter);
    }
}

/**
 * @test Append
 * @pre Append a non existing key
 * @post Returns key not stored
 */
TEST_F(MutateUnitTest, testAppendNonExistingKey)
{
    std::string key("testAppendNonExistingKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_sched_enter(instance);
    (void)lcb_install_callback3(instance, LCB_CALLBACK_STORE, testAppendNonExistingKeyCallback);
    lcb_CMDSTORE cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, key.data(), key.length());
    LCB_CMD_SET_VALUE(&cmd, "bar", 3);
    cmd.operation = LCB_APPEND;
    int numcallbacks = 0;
    EXPECT_EQ(LCB_SUCCESS, lcb_store3(instance, &numcallbacks, &cmd));
    lcb_sched_leave(instance);
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
    static void testSimplePrependStoreCallback(lcb_t, const void *cookie,
                                               lcb_storage_t operation,
                                               lcb_error_t error,
                                               const lcb_store_resp_t *resp)
    {
        using namespace std;
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_PREPEND, operation);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        EXPECT_EQ(LCB_SUCCESS, error);
        EXPECT_NE(0, resp->v.v0.cas);
        ++(*counter);
    }
}

/**
 * @test Prepend
 * @pre Set a key with the value @c foo, prepend it with the value @c bar.
 * Get the key
 *
 * @post Key is now @c barfoo
 */
TEST_F(MutateUnitTest, testSimplePrepend)
{
    std::string key("testSimplePrependKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testSimplePrependStoreCallback);
    storeKey(instance, key, "foo");
    int numcallbacks = 0;
    lcb_store_cmd_t cmd(LCB_PREPEND, key.data(), key.length(), "bar", 3);
    lcb_store_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);

    Item itm;
    getKey(instance, key, itm);
    EXPECT_STREQ("barfoo", itm.val.c_str());
}

extern "C" {
    static void
    testPrependNonExistingKeyCallback(lcb_t, int, const lcb_RESPBASE *resp)
    {
        lcb_RESPSTORE *sresp = (lcb_RESPSTORE *)resp;
        int *counter = (int *)sresp->cookie;
        ASSERT_EQ(LCB_PREPEND, sresp->op);
        EXPECT_EQ(LCB_NOT_STORED, sresp->rc);
        ++(*counter);
    }
}

/**
 * @test Prepend
 * @pre prepend a non existing key
 * @post Returns key not stored
 */
TEST_F(MutateUnitTest, testPrependNonExistingKey)
{
    std::string key("testPrependNonExistingKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_sched_enter(instance);
    (void)lcb_install_callback3(instance, LCB_CALLBACK_STORE, testPrependNonExistingKeyCallback);
    lcb_CMDSTORE cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, key.data(), key.length());
    LCB_CMD_SET_VALUE(&cmd, "foo", 3);
    cmd.operation = LCB_PREPEND;
    int numcallbacks = 0;
    EXPECT_EQ(LCB_SUCCESS, lcb_store3(instance, &numcallbacks, &cmd));
    lcb_sched_leave(instance);
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
    static void testSimpleReplaceNonexistingStoreCallback(lcb_t, const void *cookie,
                                                          lcb_storage_t operation,
                                                          lcb_error_t error,
                                                          const lcb_store_resp_t *resp)
    {
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_REPLACE, operation);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        EXPECT_EQ(LCB_KEY_ENOENT, error);
        ++(*counter);
    }
}

/**
 * @test Replace (Non-Existing)
 *
 * @pre Replace a non-existing key
 * @post Fails with @c KEY_ENOENT
 */
TEST_F(MutateUnitTest, testSimpleReplaceNonexisting)
{
    std::string key("testSimpleReplaceNonexistingKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testSimpleReplaceNonexistingStoreCallback);
    removeKey(instance, key);
    int numcallbacks = 0;
    lcb_store_cmd_t cmd(LCB_REPLACE, key.data(), key.length(), "bar", 3);
    lcb_store_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
    static void testSimpleReplaceStoreCallback(lcb_t, const void *cookie,
                                               lcb_storage_t operation,
                                               lcb_error_t error,
                                               const lcb_store_resp_t *resp)
    {
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_REPLACE, operation);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        EXPECT_EQ(LCB_SUCCESS, error);
        EXPECT_NE(0, resp->v.v0.cas);
        ++(*counter);
    }
}

/**
 * @test Replace (Hit)
 * @pre
 * Set a key to the value @c foo, replace it with the value @c bar, get the key
 *
 * @post
 * Replace is a success, and the value is now @c bar
 */
TEST_F(MutateUnitTest, testSimpleReplace)
{
    std::string key("testSimpleReplaceKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testSimpleReplaceStoreCallback);
    storeKey(instance, key, "foo");
    int numcallbacks = 0;
    lcb_store_cmd_t cmd(LCB_REPLACE, key.data(), key.length(), "bar", 3);
    lcb_store_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
    Item itm;
    getKey(instance, key, itm);
    EXPECT_STREQ("bar", itm.val.c_str());
}

extern "C" {
    static void testIncorrectCasReplaceStoreCallback(lcb_t, const void *cookie,
                                                     lcb_storage_t operation,
                                                     lcb_error_t error,
                                                     const lcb_store_resp_t *resp)
    {
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_REPLACE, operation);
        EXPECT_EQ(LCB_KEY_EEXISTS, error);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Replace (Invalid CAS)
 *
 * @pre Set a key to the value @c foo. Replace the key specifying a garbage
 * CAS value.
 *
 * @post Replace fails with @c KEY_EEXISTS
 */
TEST_F(MutateUnitTest, testIncorrectCasReplace)
{
    std::string key("testIncorrectCasReplaceKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testIncorrectCasReplaceStoreCallback);
    storeKey(instance, key, "foo");
    Item itm;
    getKey(instance, key, itm);

    int numcallbacks = 0;
    lcb_store_cmd_t cmd(LCB_REPLACE, key.data(), key.length(), "bar", 3);
    lcb_store_cmd_t *cmds[] = { &cmd };

    cmd.v.v0.cas = itm.cas + 1;
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
}
extern "C" {
    static void testCasReplaceStoreCallback(lcb_t, const void *cookie,
                                            lcb_storage_t operation,
                                            lcb_error_t error,
                                            const lcb_store_resp_t *resp)
    {
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_REPLACE, operation);
        EXPECT_EQ(LCB_SUCCESS, error);
        ASSERT_NE((const lcb_store_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Replace (CAS)
 *
 * @pre Store a key with the value @c foo, retrieve its CAS, and use retrieved
 * cas to replace the value with @c bar
 *
 * @post Replace succeeds, get on the key yields the new value @c bar.
 */
TEST_F(MutateUnitTest, testCasReplace)
{
    std::string key("testCasReplaceKey");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    (void)lcb_set_store_callback(instance, testCasReplaceStoreCallback);
    storeKey(instance, key, "foo");
    Item itm;
    getKey(instance, key, itm);

    int numcallbacks = 0;
    lcb_store_cmd_t cmd(LCB_REPLACE, key.data(), key.length(), "bar", 3);
    lcb_store_cmd_t *cmds[] = { &cmd };

    cmd.v.v0.cas = itm.cas;
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
    getKey(instance, key, itm);
    EXPECT_STREQ("bar", itm.val.c_str());
}

extern "C" {
static void storeCb(lcb_t, int, const lcb_RESPBASE *rb)
{
    ASSERT_EQ(LCB_SUCCESS, rb->rc);
    *(bool*)rb->cookie = true;
}
}

TEST_F(MutateUnitTest, testSetDefault)
{
    std::string key("testDefaultMode");
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, storeCb);

    lcb_CMDSTORE cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    LCB_CMD_SET_VALUE(&cmd, "foo", 3);
    bool cookie = false;
    ASSERT_EQ(LCB_SUCCESS, lcb_store3(instance, &cookie, &cmd));
    lcb_wait(instance);
}
