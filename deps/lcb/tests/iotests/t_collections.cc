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

using std::string;
using std::vector;

class CollectionUnitTest : public MockUnitTest
{
};

// --- Utility create/drop scope/collection functions ----

extern "C" {
static void http_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPHTTP *resp)
{
    const char *body = NULL;
    size_t nbody = 0;
    lcb_resphttp_body(resp, &body, &nbody);
    uint16_t status;
    lcb_resphttp_http_status(resp, &status);
    EXPECT_EQ(200, status) << std::string(body, nbody);
    const char *const *headers;
    EXPECT_EQ(LCB_SUCCESS, lcb_resphttp_headers(resp, &headers));
    EXPECT_EQ(LCB_SUCCESS, lcb_resphttp_status(resp));
}
}

lcb_STATUS drop_scope(lcb_INSTANCE *instance, const std::string &scope)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    lcb_STATUS err;
    std::string path = "/pools/default/buckets/default/collections/" + scope;

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_DELETE);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());

    err = lcb_http(instance, NULL, cmd);
    lcb_cmdhttp_destroy(cmd);
    EXPECT_EQ(LCB_SUCCESS, err);
    return lcb_wait(instance, LCB_WAIT_DEFAULT);
}

lcb_STATUS drop_collection(lcb_INSTANCE *instance, const std::string &scope, const std::string &collection)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    lcb_STATUS err;
    std::string path = "/pools/default/buckets/default/collections/" + scope + "/" + collection;

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_DELETE);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());

    err = lcb_http(instance, NULL, cmd);
    lcb_cmdhttp_destroy(cmd);
    EXPECT_EQ(LCB_SUCCESS, err);
    return lcb_wait(instance, LCB_WAIT_DEFAULT);
}

lcb_STATUS list_collections(lcb_INSTANCE *instance, const std::string &bucket)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    lcb_STATUS err;
    std::string path = "/pools/default/buckets/" + bucket + "/collections";

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_GET);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());

    err = lcb_http(instance, NULL, cmd);
    lcb_cmdhttp_destroy(cmd);
    EXPECT_EQ(LCB_SUCCESS, err);
    return lcb_wait(instance, LCB_WAIT_DEFAULT);
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
    ASSERT_EQ(LCB_ERR_SCOPE_NOT_FOUND, lcb_respstore_status(resp)) << lcb_strerror_short(lcb_respstore_status(resp));
    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    std::string val(key, nkey);
    ASSERT_TRUE(val == "testScopeMiss1" || val == "testScopeMiss2");
    ++(*counter);
}
}

extern "C" {
static void testGetScopeMissCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    int *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    lcb_STATUS rc = lcb_respget_status(resp);
    ASSERT_EQ(LCB_ERR_SCOPE_NOT_FOUND, rc) << lcb_strerror_short(rc);
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
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70);
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
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
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
    ASSERT_EQ(LCB_ERR_COLLECTION_NOT_FOUND, rc) << lcb_strerror_short(rc);
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
    ASSERT_EQ(LCB_ERR_COLLECTION_NOT_FOUND, rc) << lcb_strerror_short(rc);
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
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetCollectionMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetCollectionMissCallback);

    std::string key1("testCollectionMiss1"), key2("testCollectionMiss2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sCollectionMiss")), collection(unique_name("cCollectionMiss"));

    // Create scope, no collection
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    lcb_STATUS rc = lcb_store(instance, &numcallbacks, cmd);
    EXPECT_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    rc = lcb_store(instance, &numcallbacks, cmd);
    EXPECT_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    rc = lcb_get(instance, &numcallbacks, cmdget);
    EXPECT_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    rc = lcb_get(instance, &numcallbacks, cmdget);
    EXPECT_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);
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
    ASSERT_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);
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
    EXPECT_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);
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
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetHitCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetHitCallback);

    std::string key1("testStoreKey1"), val1("key1"), key2("testStoreKey2"), val2("key2");
    std::string scope(unique_name("sSuccess")), collection(unique_name("cSuccess"));

    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);
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
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetCollectionMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetCollectionMissCallback);

    std::string key1("testCollectionMiss1"), key2("testCollectionMiss2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sCollectionDropMiss")), collection(unique_name("cCollectionDropMiss"));

    // Create scope + collection, then drop collection
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));

    EXPECT_EQ(LCB_SUCCESS, drop_collection(instance, scope, collection));
    sleep(1); /* sleep for a second to make sure that collection has been dropped */

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);
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
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetHitCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetHitCallback);

    std::string key1("testStoreKey1"), key2("testStoreKey2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sCollectionFlush")), collection(unique_name("cCollectionFlush"));

    // Create scope + collection, then drop collection
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());

    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    EXPECT_EQ(LCB_SUCCESS, drop_collection(instance, scope, collection));
    sleep(1); /* sleep for a second to make sure that collection has been dropped */
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));

    numcallbacks = 0;
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_cmdstore_destroy(cmd);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
    lcb_cmdget_destroy(cmdget);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(4, numcallbacks);
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
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetScopeMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetScopeMissCallback);

    std::string key1("testScopeMiss1"), key2("testScopeMiss2");
    std::string val1("val1"), val2("val2");
    std::string scope(unique_name("sScopeDropMiss")), collection(unique_name("cScopeDropMiss"));

    // Create scope + collection, then drop scope
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));

    EXPECT_EQ(LCB_SUCCESS, drop_scope(instance, scope));
    sleep(1);

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key1.c_str(), key1.size());
    lcb_cmdstore_value(cmd, val1.c_str(), val1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));

    lcb_cmdstore_key(cmd, key2.c_str(), key2.size());
    lcb_cmdstore_value(cmd, val2.c_str(), val2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_cmdstore_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    EXPECT_EQ(2, numcallbacks);

    lcb_CMDGET *cmdget;

    lcb_cmdget_create(&cmdget);
    lcb_cmdget_collection(cmdget, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdget_key(cmdget, key1.c_str(), key1.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));

    lcb_cmdget_key(cmdget, key2.c_str(), key2.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, cmdget));
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
TEST_F(CollectionUnitTest, testMaxCollectionsPerScope)
{
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)testSetScopeMissCallback);
    (void)lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)testGetScopeMissCallback);
    lcb_STATUS rc;

    std::string scope(unique_name("sScope1"));
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    for (int i = 0; i < 1000; ++i) {
        std::stringstream ss;
        ss << i;
        rc = create_collection(instance, scope, ss.str());
        if (rc != LCB_SUCCESS) {
            fprintf(stderr, "Failed creating collection %d . Got error: %s\n", i, lcb_strerror_short(rc));
        }
    }
}
