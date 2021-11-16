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
#include "settings.h"
#include "iotests.h"

using std::string;
using std::vector;

class CollectionUnitTest : public MockUnitTest
{
};

// --- Utility create/drop scope/collection functions ----

extern "C" {
static void http_callback(lcb_INSTANCE * /* instance */, int /* cbtype */, const lcb_RESPHTTP *resp)
{
    const char *body = nullptr;
    size_t nbody = 0;
    lcb_resphttp_body(resp, &body, &nbody);
    uint16_t status;
    lcb_resphttp_http_status(resp, &status);
    EXPECT_EQ(200, status) << std::string(body, nbody);
    const char *const *headers;
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_resphttp_headers(resp, &headers));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_resphttp_status(resp));
}
}

void list_collections(lcb_INSTANCE *instance, const std::string &bucket)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/pools/default/buckets/" + bucket + "/scopes";

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_GET);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());

    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, nullptr, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
}
// ---- Tests ----

extern "C" {
static void testSetScopeMissCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
    ASSERT_STATUS_EQ(LCB_ERR_TIMEOUT, lcb_respstore_status(resp)) << lcb_strerror_short(lcb_respstore_status(resp));
    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    std::string val(key, nkey);
    ASSERT_TRUE(val == "testScopeMiss1" || val == "testScopeMiss2") << "actual key is: " << val;
    ++(*counter);
}
}

extern "C" {
static void testGetScopeMissCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    int *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    lcb_STATUS rc = lcb_respget_status(resp);
    ASSERT_EQ(LCB_ERR_TIMEOUT, rc) << lcb_strerror_short(rc);
    const char *key;
    size_t nkey;
    lcb_respget_key(resp, &key, &nkey);
    std::string val(key, nkey);
    ASSERT_TRUE(val == "testScopeMiss1" || val == "testScopeMiss2");
    ++(*counter);
}
}

/**
 * @test
 * Try set/get to non-existing scope
 *
 * @pre
 * Set/get key to non existing scope
 *
 * @post
 * Response for store/get with error code
 * @c LCB_ERR_SCOPE_NOT_FOUND
 *
 */
TEST_F(CollectionUnitTest, testScopeMiss)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetScopeMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetScopeMissCallback);

    std::string key1("testScopeMiss1"), key2("testScopeMiss2");
    std::string val1("val1"), val2("val2");
    std::string scope("scopeScopeMiss"), collection("collectionScopeMiss");

    // Dont create scope/collection

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);
}

extern "C" {
static void testSetCollectionMissCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
    lcb_STATUS rc = lcb_respstore_status(resp);
    ASSERT_EQ(LCB_ERR_TIMEOUT, rc) << lcb_strerror_short(rc);
    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    std::string val(key, nkey);
    ASSERT_TRUE(val == "testCollectionMiss1" || val == "testCollectionMiss2");
    ++(*counter);
}
}

extern "C" {
static void testGetCollectionMissCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    int *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    lcb_STATUS rc = lcb_respget_status(resp);
    ASSERT_EQ(LCB_ERR_TIMEOUT, rc) << lcb_strerror_short(rc);
    const char *key;
    size_t nkey;
    lcb_respget_key(resp, &key, &nkey);
    std::string val(key, nkey);
    ASSERT_TRUE(val == "testCollectionMiss1" || val == "testCollectionMiss2");
    ++(*counter);
}
}

/**
 * @test
 * Set/Get to non-existing collection
 *
 * @pre
 * Create scope, Set/Get key to non-existing collection
 *
 * @post
 * Response for set/get with error code
 * @c LCB_ERR_COLLECTION_NOT_FOUND
 *
 */
TEST_F(CollectionUnitTest, testCollectionMiss)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetCollectionMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetCollectionMissCallback);

    std::string key1("testCollectionMiss1"), key2("testCollectionMiss2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sCollectionMiss")), collection(unique_name("cCollectionMiss"));

    // Create scope, no collection
    create_scope(instance, scope);

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    lcb_STATUS rc = lcb_store(instance, &numcallbacks, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    rc = lcb_store(instance, &numcallbacks, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    rc = lcb_get(instance, &numcallbacks, cmdget);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    rc = lcb_get(instance, &numcallbacks, cmdget);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);

    drop_scope(instance, scope);
}

extern "C" {
static void testSetHitCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
    lcb_STATUS rc = lcb_respstore_status(resp);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);
    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    std::string val(key, nkey);
    ASSERT_TRUE(val == "testStoreKey1" || val == "testStoreKey2") << "val = \"" << val << "\"";
    ++(*counter);
    uint64_t cas;
    lcb_respstore_cas(resp, &cas);
    ASSERT_NE(0, cas);
}
}

extern "C" {
static void testGetHitCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    int *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    lcb_STATUS rc = lcb_respget_status(resp);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);
    ++(*counter);
}
}

/**
 * @test
 * Set/Get hit
 *
 * @pre
 * Create scope, collection, set two keys, get both keys
 *
 * @post
 *
 * @c SUCCESS, both keys are set and received
 */
TEST_F(CollectionUnitTest, testCollectionSet)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetHitCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetHitCallback);

    std::string key1("testStoreKey1"), val1("key1"), key2("testStoreKey2"), val2("key2");
    std::string scope(unique_name("sSuccess")), collection(unique_name("cSuccess"));

    create_scope(instance, scope);
    create_collection(instance, scope, collection);

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);

    drop_scope(instance, scope);
}

/**
 * @test
 * Set/get doc to collection that has been dropped
 *
 * @pre
 * Create scope, collection, drop collection. Try set/get to collection
 *
 * @post
 *
 * @c LCB_ERR_COLLECTION_NOT_FOUND, collection is dropped
 */
TEST_F(CollectionUnitTest, testDroppedCollection)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetCollectionMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetCollectionMissCallback);

    std::string key1("testCollectionMiss1"), key2("testCollectionMiss2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sCollectionDropMiss")), collection(unique_name("cCollectionDropMiss"));

    std::uint64_t uid;

    // Create scope + collection, then drop collection
    create_scope(instance, scope);
    create_collection(instance, scope, collection);

    drop_collection(instance, scope, collection);
    sleep(1); /* sleep for a second to make sure that collection has been dropped */

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);

    drop_scope(instance, scope);
}

/**
 * @test
 * Set/get doc to collection that has been "flushed", i.e. dropped and created with the same name
 *
 * @pre
 * 1. create scope, collection
 * 2. try set/get to collection
 * 3. drop collection.
 * 4. try set/get to collection
 *
 * @post
 *
 * @c LCB_ERR_COLLECTION_NOT_FOUND, collection is dropped
 */
TEST_F(CollectionUnitTest, testFlushCollection)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetHitCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetHitCallback);

    std::string key1("testStoreKey1"), key2("testStoreKey2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sCollectionFlush")), collection(unique_name("cCollectionFlush"));

    // Create scope + collection, then drop collection
    create_scope(instance, scope);
    create_collection(instance, scope, collection);

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());

    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    drop_collection(instance, scope, collection);
    sleep(1); /* sleep for a second to make sure that collection has been dropped */
    create_collection(instance, scope, collection);

    numcallbacks = 0;
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_cmdstore_destroy(cmd);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);

    drop_scope(instance, scope);
}

/**
 * @test
 * Set/get doc to collection that is on a scope that has been dropped
 *
 * @pre
 * Create scope and collection, drop scope
 *
 * @post
 *
 * @c LCB_ERR_SCOPE_NOT_FOUND, scope+collection is dropped
 */
TEST_F(CollectionUnitTest, testDroppedScope)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetScopeMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetScopeMissCallback);

    std::string key1("testScopeMiss1"), key2("testScopeMiss2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sScopeDropMiss")), collection(unique_name("cScopeDropMiss"));

    // Create scope + collection, then drop scope
    create_scope(instance, scope);
    create_collection(instance, scope, collection);

    drop_scope(instance, scope);
    sleep(1);

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);
}

/**
 * @test
 * Create 1000 collections for a single scope
 *
 * @pre
 * Create scope and collection
 *
 * @post
 *
 * Collection creations are successful
 */
TEST_F(ContaminatingUnitTest, test_CCBC_1483_MaxCollectionsPerScope)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetScopeMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetScopeMissCallback);

    std::string scope(unique_name("sScope1"));
    create_scope(instance, scope);
    for (int i = 0; i < 1000; ++i) {
        create_collection(instance, scope, std::to_string(i), false);
    }
    drop_scope(instance, scope);
}

struct operation_result {
    bool called{false};
    lcb_STATUS rc{LCB_SUCCESS};
    std::string key{};
    std::string value{};
};

extern "C" {
static void store_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    const char *ptr;
    size_t len;

    operation_result *res = nullptr;
    lcb_respstore_cookie(resp, (void **)&res);

    res->called = true;
    res->rc = lcb_respstore_status(resp);
    lcb_respstore_key(resp, &ptr, &len);
    res->key = std::string(ptr, len);
}

static void get_callback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    const char *ptr;
    size_t len;

    operation_result *res = nullptr;
    lcb_respget_cookie(resp, (void **)&res);

    res->called = true;
    res->rc = lcb_respget_status(resp);
    lcb_respget_key(resp, &ptr, &len);
    res->key = std::string(ptr, len);
    if (res->rc == LCB_SUCCESS) {
        lcb_respget_value(resp, &ptr, &len);
        res->value = std::string(ptr, len);
    }
}
}

TEST_F(CollectionUnitTest, testItDoesNotRouteKeysToDefaultCollectionOnScopeDrop)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);

    std::string key("ccbc1400");
    std::string val("now_" + std::to_string(time(nullptr)));
    std::string scope(unique_name("scope1400")), collection(unique_name("collection1400"));

    // Create scope + collection, then drop scope
    create_scope(instance, scope);
    create_collection(instance, scope, collection);

    {
        // default scope does not have the key
        operation_result res{};
        lcb_CMDGET *cmd;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key.c_str(), key.size());
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &res, cmd));
        lcb_cmdget_destroy(cmd);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, res.rc);
        ASSERT_EQ(key, res.key);
    }

    {
        // upsert new document to "scope1400.collection1400"
        operation_result res{};
        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, val.c_str(), val.size());
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &res, cmd));
        lcb_cmdstore_destroy(cmd);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_EQ(key, res.key);
    }

    {
        // "scope1400.collection1400" has the key
        operation_result res{};
        lcb_CMDGET *cmd;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
        lcb_cmdget_key(cmd, key.c_str(), key.size());
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &res, cmd));
        lcb_cmdget_destroy(cmd);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        ASSERT_TRUE(res.called);
        ASSERT_STATUS_EQ(LCB_SUCCESS, res.rc);
        ASSERT_EQ(key, res.key);
        ASSERT_EQ(val, res.value);
    }

    drop_scope(instance, scope);
    sleep(1);

    {
        // try to upsert new document to "scope1400.collection1400", expected LCB_ERR_TIMEOUT
        operation_result res{};
        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_timeout(cmd, LCB_MS2US(500));
        lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, val.c_str(), val.size());
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &res, cmd));
        lcb_cmdstore_destroy(cmd);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_ERR_TIMEOUT, res.rc);
        ASSERT_EQ(key, res.key);
    }

    {
        // default scope still does not have the key
        operation_result res{};
        lcb_CMDGET *cmd;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key.c_str(), key.size());
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, &res, cmd));
        lcb_cmdget_destroy(cmd);
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, res.rc);
        ASSERT_EQ(key, res.key);
    }
}
