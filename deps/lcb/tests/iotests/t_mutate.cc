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

class MutateUnitTest : public MockUnitTest
{
};

extern "C" {
static void testSimpleSetStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    using namespace std;
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
    EXPECT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    std::string val(key, nkey);
    EXPECT_TRUE(val == "testSimpleStoreKey1" || val == "testSimpleStoreKey2");
    ++(*counter);
    uint64_t cas;
    lcb_respstore_cas(resp, &cas);
    EXPECT_NE(0, cas);
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSimpleSetStoreCallback);

    std::string key1("testSimpleStoreKey1"), val1("key1"), key2("testSimpleStoreKey2"), val2("key2");

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);
}

/**
 * @test Zero length key
 * @pre set a zero length for a key foo
 * @post should not be able to schedule operation
 */
TEST_F(MutateUnitTest, testStoreZeroLengthKey)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    lcb_sched_enter(instance);
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, nullptr, 0);
    lcb_cmdstore_value(cmd, "bar", 3);
    EXPECT_EQ(LCB_ERR_EMPTY_KEY, lcb_store(instance, nullptr, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_sched_leave(instance);
}

extern "C" {
static void testStoreZeroLengthValueCallback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
    EXPECT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    lcb_sched_enter(instance);
    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testStoreZeroLengthValueCallback);
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, nullptr, 0);
    int numcallbacks = 0;
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    EXPECT_EQ(1, numcallbacks);

    Item itm;
    getKey(instance, key, itm);
    EXPECT_EQ(0, itm.val.length());
}

extern "C" {
static void testRemoveCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPREMOVE *resp)
{
    int *counter;
    lcb_respremove_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_SUCCESS, lcb_respremove_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    std::string key1("testRemoveKey1"), key2("testRemoveKey2");

    (void)lcb_install_callback(instance, LCB_CALLBACK_REMOVE, (lcb_RESPCALLBACK)testRemoveCallback);
    int numcallbacks = 0;
    storeKey(instance, key1, "foo");
    storeKey(instance, key2, "foo");

    lcb_CMDREMOVE *cmd;
    lcb_cmdremove_create(&cmd);

    lcb_cmdremove_key(cmd, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, &numcallbacks, cmd));

    lcb_cmdremove_key(cmd, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, &numcallbacks, cmd));

    lcb_cmdremove_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
static void testRemoveMissCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPREMOVE *resp)
{
    int *counter;
    lcb_respremove_cookie(resp, (void **)&counter);
    EXPECT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, lcb_respremove_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_REMOVE, (lcb_RESPCALLBACK)testRemoveMissCallback);
    int numcallbacks = 0;
    std::string key1("testRemoveMissKey1"), key2("testRemoveMissKey2");
    removeKey(instance, key1);
    removeKey(instance, key2);

    lcb_CMDREMOVE *cmd;
    lcb_cmdremove_create(&cmd);

    lcb_cmdremove_key(cmd, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, &numcallbacks, cmd));

    lcb_cmdremove_key(cmd, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, &numcallbacks, cmd));

    lcb_cmdremove_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
static void testSimpleAddStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    using namespace std;
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_INSERT, op);

    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    std::string val(key, nkey);
    EXPECT_STREQ("testSimpleAddKey", val.c_str());

    lcb_STATUS rc = lcb_respstore_status(resp);
    if (*counter == 0) {
        uint64_t cas;
        EXPECT_EQ(LCB_SUCCESS, rc);
        lcb_respstore_cas(resp, &cas);
        EXPECT_NE(0, cas);
    } else {
        EXPECT_EQ(LCB_ERR_DOCUMENT_EXISTS, rc);
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSimpleAddStoreCallback);
    removeKey(instance, "testSimpleAddKey");
    int numcallbacks = 0;
    std::string key("testSimpleAddKey"), val1("key1"), val2("key2");
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_INSERT);
    lcb_cmdstore_key(cmd, key.c_str(), key.size());

    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);
    lcb_cmdstore_destroy(cmd);
}

extern "C" {
static void testSimpleAppendStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    using namespace std;
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_APPEND, op);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
    uint64_t cas;
    lcb_respstore_cas(resp, &cas);
    EXPECT_NE(0, cas);
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSimpleAppendStoreCallback);
    storeKey(instance, key, "foo");
    int numcallbacks = 0;

    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_APPEND);

    std::string val("bar");
    lcb_cmdstore_key(cmd, key.c_str(), key.size());
    lcb_cmdstore_value(cmd, val.c_str(), val.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);

    Item itm;
    getKey(instance, key, itm);
    EXPECT_STREQ("foobar", itm.val.c_str());
}

extern "C" {
static void testAppendNonExistingKeyCallback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_APPEND, op);
    EXPECT_EQ(LCB_ERR_NOT_STORED, lcb_respstore_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    lcb_sched_enter(instance);
    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testAppendNonExistingKeyCallback);
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_APPEND);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, "bar", 3);
    int numcallbacks = 0;
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
static void testSimplePrependStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    using namespace std;
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_PREPEND, op);
    EXPECT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
    uint64_t cas;
    lcb_respstore_cas(resp, &cas);
    EXPECT_NE(0, cas);
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSimplePrependStoreCallback);
    storeKey(instance, key, "foo");
    int numcallbacks = 0;

    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_PREPEND);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, "bar", 3);
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);

    Item itm;
    getKey(instance, key, itm);
    EXPECT_STREQ("barfoo", itm.val.c_str());
}

extern "C" {
static void testPrependNonExistingKeyCallback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_PREPEND, op);
    EXPECT_EQ(LCB_ERR_NOT_STORED, lcb_respstore_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    lcb_sched_enter(instance);
    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testPrependNonExistingKeyCallback);
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_PREPEND);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, "foo", 3);
    int numcallbacks = 0;
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
static void testSimpleReplaceNonexistingStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_REPLACE, op);
    EXPECT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, lcb_respstore_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE,
                               (lcb_RESPCALLBACK)testSimpleReplaceNonexistingStoreCallback);
    removeKey(instance, key);
    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_REPLACE);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, "bar", 3);
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
static void testSimpleReplaceStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_REPLACE, op);
    EXPECT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
    uint64_t cas;
    lcb_respstore_cas(resp, &cas);
    EXPECT_NE(0, cas);
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSimpleReplaceStoreCallback);
    storeKey(instance, key, "foo");
    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_REPLACE);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, "bar", 3);
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);
    Item itm;
    getKey(instance, key, itm);
    EXPECT_STREQ("bar", itm.val.c_str());
}

extern "C" {
static void testIncorrectCasReplaceStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_REPLACE, op);
    EXPECT_EQ(LCB_ERR_CAS_MISMATCH, lcb_respstore_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testIncorrectCasReplaceStoreCallback);
    storeKey(instance, key, "foo");
    Item itm;
    getKey(instance, key, itm);

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_REPLACE);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, "bar", 3);
    lcb_cmdstore_cas(cmd, itm.cas + 1);

    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
static void testCasReplaceStoreCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_REPLACE, op);
    EXPECT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
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
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testCasReplaceStoreCallback);
    storeKey(instance, key, "foo");
    Item itm;
    getKey(instance, key, itm);

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_REPLACE);
    lcb_cmdstore_key(cmd, key.data(), key.length());
    lcb_cmdstore_value(cmd, "bar", 3);
    lcb_cmdstore_cas(cmd, itm.cas);
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(1, numcallbacks);
    getKey(instance, key, itm);
    EXPECT_STREQ("bar", itm.val.c_str());
}

extern "C" {
static void storeCb(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    bool *rv;
    ASSERT_EQ(LCB_SUCCESS, lcb_respstore_status(resp));
    lcb_respstore_cookie(resp, (void **)&rv);
    *rv = true;
}
}

TEST_F(MutateUnitTest, testSetDefault)
{
    std::string key("testDefaultMode");
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)storeCb);

    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, key.c_str(), key.size());
    lcb_cmdstore_value(cmd, "foo", 3);
    bool cookie = false;
    ASSERT_EQ(LCB_SUCCESS, lcb_store(instance, &cookie, cmd));
    lcb_cmdstore_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

struct lookup_result {
    bool called{false};
    lcb_STATUS rc{LCB_ERR_GENERIC};

    lcb_STATUS rc_expiry{LCB_ERR_GENERIC};
    std::uint32_t expiry{0};

    lcb_STATUS rc_cas{LCB_ERR_GENERIC};
    std::uint64_t cas{0};
};

static void preserve_expiry_get_expiry(lcb_INSTANCE *, int, const lcb_RESPSUBDOC *resp)
{
    lookup_result *cookie = nullptr;
    lcb_respsubdoc_cookie(resp, reinterpret_cast<void **>(&cookie));

    cookie->called = true;
    cookie->rc = lcb_respsubdoc_status(resp);
    ASSERT_EQ(2, lcb_respsubdoc_result_size(resp));

    const char *value = nullptr;
    std::size_t value_len = 0;

    cookie->rc_expiry = lcb_respsubdoc_result_status(resp, 0);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_respsubdoc_result_value(resp, 0, &value, &value_len));
    ASSERT_GT(value_len, 0);
    cookie->expiry = std::strtoul(value, nullptr, 10);

    cookie->rc_cas = lcb_respsubdoc_result_status(resp, 1);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_respsubdoc_result_value(resp, 1, &value, &value_len));
    // CAS is encoded as string of HEX number, so the length should be at least greater than strlen("\"0x\"")
    ASSERT_GT(value_len, 4);
    cookie->cas = std::strtoull(value + 1, nullptr, 16);
}

struct store_result {
    bool called{false};
    lcb_STATUS rc{LCB_ERR_GENERIC};
    std::uint64_t cas{0};
};

static void preserve_expiry_upsert(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    store_result *res = nullptr;
    lcb_respstore_cookie(resp, (void **)&res);
    res->called = true;
    res->rc = lcb_respstore_status(resp);
    lcb_respstore_cas(resp, &res->cas);
}

TEST_F(MutateUnitTest, testUpsertPreservesExpiry)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)

    std::string key("testUpsertPreservesExpiry");

    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);
    lcb_install_callback(instance, LCB_CALLBACK_SDLOOKUP,
                         reinterpret_cast<lcb_RESPCALLBACK>(preserve_expiry_get_expiry));
    lcb_install_callback(instance, LCB_CALLBACK_STORE, reinterpret_cast<lcb_RESPCALLBACK>(preserve_expiry_upsert));

    std::uint32_t birthday = 1878422400;
    std::uint64_t cas = 0;

    {
        std::string value = R"({"foo": "bar"})";

        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, value.c_str(), value.size());
        lcb_cmdstore_expiry(cmd, birthday);
        store_result res{};
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &res, cmd));
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_NE(0, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        cas = res.cas;
    }

    std::string expiry_path = "$document.exptime";
    std::string cas_path = "$document.CAS";

    {
        lookup_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 2);
        lcb_subdocspecs_get(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH, expiry_path.c_str(), expiry_path.size());
        lcb_subdocspecs_get(ops, 1, LCB_SUBDOCSPECS_F_XATTRPATH, cas_path.c_str(), cas_path.size());
        lcb_cmdsubdoc_specs(cmd, ops);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_cas);
        ASSERT_EQ(cas, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_expiry);
        ASSERT_EQ(birthday, res.expiry);
    }

    {
        std::string value = R"({"foo": "baz"})";
        store_result res{};

        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, value.c_str(), value.size());
        lcb_cmdstore_preserve_expiry(cmd, true);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &res, cmd));
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_NE(0, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        cas = res.cas;
    }

    {
        lookup_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 2);
        lcb_subdocspecs_get(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH, expiry_path.c_str(), expiry_path.size());
        lcb_subdocspecs_get(ops, 1, LCB_SUBDOCSPECS_F_XATTRPATH, cas_path.c_str(), cas_path.size());
        lcb_cmdsubdoc_specs(cmd, ops);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_cas);
        ASSERT_EQ(cas, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_expiry);
        ASSERT_EQ(birthday, res.expiry);
    }

    {
        std::string value = R"({"foo": "bar"})";

        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, value.c_str(), value.size());
        store_result res{};
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &res, cmd));
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);

        ASSERT_TRUE(res.called);
        ASSERT_NE(0, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        cas = res.cas;
    }

    {
        lookup_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 2);
        lcb_subdocspecs_get(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH, expiry_path.c_str(), expiry_path.size());
        lcb_subdocspecs_get(ops, 1, LCB_SUBDOCSPECS_F_XATTRPATH, cas_path.c_str(), cas_path.size());
        lcb_cmdsubdoc_specs(cmd, ops);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_cas);
        ASSERT_EQ(cas, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_expiry);
        ASSERT_EQ(0, res.expiry);
    }
}

static void preserve_expiry_subdoc(lcb_INSTANCE *, int, const lcb_RESPSUBDOC *resp)
{
    store_result *res = nullptr;
    lcb_respsubdoc_cookie(resp, (void **)&res);
    res->called = true;
    res->rc = lcb_respsubdoc_status(resp);
    lcb_respsubdoc_cas(resp, &res->cas);
}

TEST_F(MutateUnitTest, testMutateInPreservesExpiry)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)

    std::string key("testMutateInPreservesExpiry");

    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);
    lcb_install_callback(instance, LCB_CALLBACK_SDLOOKUP,
                         reinterpret_cast<lcb_RESPCALLBACK>(preserve_expiry_get_expiry));
    lcb_install_callback(instance, LCB_CALLBACK_SDMUTATE, reinterpret_cast<lcb_RESPCALLBACK>(preserve_expiry_subdoc));
    lcb_install_callback(instance, LCB_CALLBACK_STORE, reinterpret_cast<lcb_RESPCALLBACK>(preserve_expiry_upsert));

    std::uint32_t birthday = 1878422400;
    std::uint64_t cas = 0;

    {
        store_result res{};
        std::string value = R"({"foo": "bar"})";

        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_key(cmd, key.c_str(), key.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_value(cmd, value.c_str(), value.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_expiry(cmd, birthday));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &res, cmd));
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_NE(0, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        cas = res.cas;
    }

    std::string expiry_path = "$document.exptime";
    std::string cas_path = "$document.CAS";

    {
        lookup_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 2);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdocspecs_get(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH, expiry_path.c_str(),
                                                          expiry_path.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS,
                         lcb_subdocspecs_get(ops, 1, LCB_SUBDOCSPECS_F_XATTRPATH, cas_path.c_str(), cas_path.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsubdoc_specs(cmd, ops));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_cas);
        ASSERT_EQ(cas, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_expiry);
        ASSERT_EQ(birthday, res.expiry);
    }

    {
        std::string path = "foo";
        std::string value = R"("baz")";
        store_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 1);
        ASSERT_STATUS_EQ(LCB_SUCCESS,
                         lcb_subdocspecs_replace(ops, 0, 0, path.c_str(), path.size(), value.c_str(), value.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsubdoc_specs(cmd, ops));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsubdoc_preserve_expiry(cmd, true));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_NE(0, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        cas = res.cas;
    }

    {
        lookup_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 2);
        lcb_subdocspecs_get(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH, expiry_path.c_str(), expiry_path.size());
        lcb_subdocspecs_get(ops, 1, LCB_SUBDOCSPECS_F_XATTRPATH, cas_path.c_str(), cas_path.size());
        lcb_cmdsubdoc_specs(cmd, ops);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_cas);
        ASSERT_EQ(cas, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_expiry);
        ASSERT_EQ(birthday, res.expiry);
    }

    {
        std::string path = "foo";
        std::string value = R"("bar")";
        store_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 1);
        lcb_subdocspecs_replace(ops, 0, 0, path.c_str(), path.size(), value.c_str(), value.size());
        lcb_cmdsubdoc_specs(cmd, ops);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_NE(0, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        cas = res.cas;
    }

    {
        lookup_result res{};

        lcb_CMDSUBDOC *cmd;
        lcb_cmdsubdoc_create(&cmd);
        lcb_cmdsubdoc_key(cmd, key.data(), key.size());
        lcb_SUBDOCSPECS *ops;
        lcb_subdocspecs_create(&ops, 2);
        lcb_subdocspecs_get(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH, expiry_path.c_str(), expiry_path.size());
        lcb_subdocspecs_get(ops, 1, LCB_SUBDOCSPECS_F_XATTRPATH, cas_path.c_str(), cas_path.size());
        lcb_cmdsubdoc_specs(cmd, ops);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_subdoc(instance, &res, cmd));
        lcb_subdocspecs_destroy(ops);
        lcb_cmdsubdoc_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);

        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_cas);
        ASSERT_EQ(cas, res.cas);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc_expiry);
        ASSERT_EQ(0, res.expiry);
    }
}
