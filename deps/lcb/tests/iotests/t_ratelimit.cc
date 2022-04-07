/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2021 Couchbase, Inc.
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

#include "iotests.h"
#include <libcouchbase/couchbase.h>
#include "internal.h"
#include <chrono>

class RateLimitTest : public MockUnitTest
{
  public:
    lcb_STATUS retry_connect_on_auth_failure(HandleWrap &hw, lcb_INSTANCE **instance, const std::string &username,
                                             const std::string &password,
                                             std::chrono::seconds timeout = std::chrono::seconds(10))
    {
        lcb_CREATEOPTS *options = nullptr;
        MockEnvironment::getInstance()->makeConnectParams(options);
        lcb_createopts_credentials(options, username.c_str(), username.size(), password.c_str(), password.size());

        auto start = std::chrono::high_resolution_clock::now();
        lcb_STATUS err;

        while (std::chrono::high_resolution_clock::now() < start + timeout) {
            err = tryCreateConnection(hw, instance, options);
            if (err != LCB_ERR_AUTHENTICATION_FAILURE) {
                break;
            }
            hw.destroy();
        }

        return err;
    }
};

extern "C" {
static void store_callback(lcb_INSTANCE *, int cbtype, const lcb_RESPSTORE *resp)
{
    lcb_STATUS *err;
    lcb_respstore_cookie(resp, (void **)&err);
    *err = lcb_respstore_status(resp);
}

static void query_callback(lcb_INSTANCE *, int, const lcb_RESPQUERY *resp)
{
    lcb_STATUS *err;
    lcb_respquery_cookie(resp, (void **)&err);
    *err = lcb_respquery_status(resp);
}

static void concurrent_query_callback(lcb_INSTANCE *, int, const lcb_RESPQUERY *resp)
{
    std::vector<lcb_STATUS> *errors;
    lcb_respquery_cookie(resp, (void **)&errors);
    auto err = lcb_respquery_status(resp);
    errors->emplace_back(err);
}

static void search_callback(lcb_INSTANCE *, int, const lcb_RESPSEARCH *resp)
{
    lcb_STATUS *err;
    lcb_respsearch_cookie(resp, (void **)&err);
    *err = lcb_respsearch_status(resp);
}

static void concurrent_search_callback(lcb_INSTANCE *, int, const lcb_RESPSEARCH *resp)
{
    std::vector<lcb_STATUS> *errors;
    lcb_respsearch_cookie(resp, (void **)&errors);
    auto err = lcb_respsearch_status(resp);
    errors->emplace_back(err);
}
}

TEST_F(RateLimitTest, testRateLimitsKVNumOps)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.kv_limits.enforce = true;
    limits.kv_limits.num_ops_per_min = 10;

    auto username = unique_name("rate_limited_user");

    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    bool found_error = false;
    auto start = std::chrono::high_resolution_clock::now();

    while (std::chrono::high_resolution_clock::now() < start + std::chrono::seconds(10)) {
        std::string key{"ratelimit"};
        std::string value{"test"};
        Item req = Item(key, value);
        KVOperation kvo = KVOperation(&req);
        kvo.ignoreErrors = true;
        kvo.store(instance);
        if (kvo.result.err == LCB_ERR_RATE_LIMITED) {
            found_error = true;
            break;
        }
    }

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsKVIngress)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.kv_limits.enforce = true;
    limits.kv_limits.ingress_mib_per_min = 1;
    auto username = unique_name("rate_limited_user");
    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::string key{"ratelimitingress"};
    std::string value(1025 * 1024, '*');

    Item req = Item(key, value);
    KVOperation kvo = KVOperation(&req);
    kvo.ignoreErrors = true;
    kvo.store(instance);
    ASSERT_STATUS_EQ(kvo.result.err, LCB_ERR_RATE_LIMITED);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsKVEgress)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.kv_limits.enforce = true;
    limits.kv_limits.egress_mib_per_min = 1;
    auto username = unique_name("rate_limited_user");
    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::string key{"ratelimitegress"};
    std::string value(512 * 1024, '*');

    storeKey(instance, key, value);
    Item item;
    getKey(instance, key, item);
    getKey(instance, key, item);

    Item req = Item(key);
    KVOperation kvo = KVOperation(&req);
    kvo.ignoreErrors = true;
    kvo.get(instance);
    ASSERT_STATUS_EQ(kvo.result.err, LCB_ERR_RATE_LIMITED);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsKVMaxConnections)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.kv_limits.enforce = true;
    limits.kv_limits.num_connections = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    // max connections is per node so if we have multiple nodes, we need to force a connection to all of them to trigger
    // an error

    lcb_CMDPING *cmd;
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdping_create(&cmd));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdping_all(cmd));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_ping(instance, nullptr, cmd));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));

    lcb_INSTANCE *instance2;
    HandleWrap hw2;

    lcb_CREATEOPTS *options = nullptr;
    MockEnvironment::getInstance()->makeConnectParams(options);
    lcb_createopts_credentials(options, username.c_str(), username.size(), password.c_str(), password.size());

    lcb_CREATEOPTS *bucketless_options = nullptr;
    MockEnvironment::getInstance()->makeConnectParams(bucketless_options, nullptr, LCB_TYPE_CLUSTER);
    lcb_createopts_credentials(bucketless_options, username.c_str(), username.size(), password.c_str(), password.size());

    ASSERT_STATUS_EQ(LCB_ERR_RATE_LIMITED, tryCreateConnection(hw2, &instance2, options));
    ASSERT_STATUS_EQ(LCB_ERR_RATE_LIMITED, tryCreateConnection(hw2, &instance2, bucketless_options));
}

TEST_F(RateLimitTest, testRateLimitsQueryNumQueries)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.query_limits.enforce = true;
    limits.query_limits.num_queries_per_min = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    bool found_error = false;
    auto start = std::chrono::high_resolution_clock::now();

    while (std::chrono::high_resolution_clock::now() < start + std::chrono::seconds(10)) {
        lcb_STATUS err;
        lcb_CMDQUERY *cmd{};
        std::string statement{"select * from " + MockEnvironment::getInstance()->getBucket() + " limit 1"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_statement(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_callback(cmd, query_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_query(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        if (err == LCB_ERR_RATE_LIMITED) {
            found_error = true;
            break;
        }
    }

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsQueryEgress)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.query_limits.enforce = true;
    limits.query_limits.egress_mib_per_min = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::string key{"ratelimitingress"};
    // query only returns json
    std::string value_inner(1024 * 1024, '1');
    std::string value{"[" + value_inner + "]"};

    storeKey(instance, key, value);

    bool found_error = false;
    auto start = std::chrono::high_resolution_clock::now();

    while (std::chrono::high_resolution_clock::now() < start + std::chrono::seconds(10)) {
        lcb_STATUS err;
        lcb_CMDQUERY *cmd{};
        std::string statement{"select * from " + MockEnvironment::getInstance()->getBucket() + " where META().id = '" + key + "'"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_statement(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_callback(cmd, query_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_query(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        if (err == LCB_ERR_RATE_LIMITED) {
            found_error = true;
            break;
        }
    }

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsQueryIngress)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.query_limits.enforce = true;
    limits.query_limits.ingress_mib_per_min = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::string key{"ratelimitingress"};
    // query only accepts json
    std::string value_inner(1024 * 1024, '1');
    std::string value{"[" + value_inner + "]"};

    bool found_error = false;
    auto start = std::chrono::high_resolution_clock::now();

    while (std::chrono::high_resolution_clock::now() < start + std::chrono::seconds(10)) {
        lcb_STATUS err;
        lcb_CMDQUERY *cmd{};
        std::string statement{"upsert into " + MockEnvironment::getInstance()->getBucket() + " (KEY, VALUE) VALUES (\"" + key + "\", \"" + value + "\")"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_statement(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_callback(cmd, query_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_query(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        if (err == LCB_ERR_RATE_LIMITED) {
            found_error = true;
            break;
        }
    }

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsQueryConcurrentRequests)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.query_limits.enforce = true;
    limits.query_limits.num_concurrent_requests = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::string key{"ratelimitingress"};
    // query only accepts json
    std::string value_inner(1024 * 1024, '1');
    std::string value{"[" + value_inner + "]"};

    std::vector<lcb_STATUS> errors{};
    errors.reserve(10);

    lcb_sched_enter(instance);
    for (int ii = 0; ii < 10; ++ii) {
        lcb_CMDQUERY *cmd{};
        std::string statement{"select * from " + MockEnvironment::getInstance()->getBucket() + " limit 1"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_statement(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_callback(cmd, concurrent_query_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_query(instance, &errors, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_destroy(cmd));
    }
    lcb_sched_leave(instance);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));

    bool found_error = std::count_if(errors.begin(), errors.end(), [](lcb_STATUS err) { return err == LCB_ERR_RATE_LIMITED; }) > 0;

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsKVScopeDataSize)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);
    auto bucket = MockEnvironment::getInstance()->getBucket();
    auto scope = unique_name("scope");
    auto collection = unique_name("collection");

    enforce_rate_limits(instance);
    scope_rate_limits limits{};
    limits.kv_scope_limits.enforce = true;
    // each vbucket gets a separate limit of 1024 bytes
    // so this limits the size of value you can store to 1024 bytes
    limits.kv_scope_limits.data_size = 1024 * 1024;
    create_rate_limited_scope(instance, bucket, scope, limits);
    create_collection(instance, scope, collection);

    auto key = unique_name("ratelimitdata");

    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);

    std::string value(1025, '*');
    lcb_CMDSTORE *cmd;
    lcb_STATUS err;
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(),
                                                            collection.size()));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_key(cmd, key.c_str(), key.size()));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_value(cmd, value.c_str(), value.size()));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdstore_timeout(cmd, LCB_S2US(10)));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_store(instance, &err, cmd));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_ERR_QUOTA_LIMITED, err);

    drop_scope(instance, scope);
}

TEST_F(RateLimitTest, testRateLimitsQueryNumIndexes)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);
    auto bucket = MockEnvironment::getInstance()->getBucket();
    auto scope = unique_name("scope");
    auto collection = unique_name("collection");

    enforce_rate_limits(instance);
    scope_rate_limits limits{};
    limits.index_scope_limits.enforce = true;
    limits.index_scope_limits.num_indexes = 1;
    create_rate_limited_scope(instance, bucket, scope, limits);
    create_collection(instance, scope, collection);

    {
        lcb_STATUS err;
        lcb_CMDQUERY *cmd{};
        std::string statement{"CREATE PRIMARY INDEX ON `" + collection + "`"};
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_statement(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_callback(cmd, query_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_scope_name(cmd, scope.c_str(), scope.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_query(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        ASSERT_STATUS_EQ(LCB_SUCCESS, err);
    }

    {
        lcb_STATUS err;
        lcb_CMDQUERY *cmd{};
        std::string statement{"CREATE INDEX ratelimit ON `" + collection + "`(somefield)"};
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_statement(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_callback(cmd, query_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_scope_name(cmd, scope.c_str(), scope.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_query(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdquery_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        ASSERT_STATUS_EQ(LCB_ERR_QUOTA_LIMITED, err);
    }

    drop_scope(instance, scope);
}

TEST_F(RateLimitTest, testRateLimitsSearchNumQueries)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.search_limits.enforce = true;
    limits.search_limits.num_queries_per_min = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    auto index_name = unique_name("index");
    create_search_index(instance, index_name, "fulltext-index", "couchbase",
                        MockEnvironment::getInstance()->getBucket());

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    bool found_error = false;
    auto start = std::chrono::high_resolution_clock::now();

    while (std::chrono::high_resolution_clock::now() < start + std::chrono::seconds(10)) {
        lcb_STATUS err;
        lcb_CMDSEARCH *cmd{};
        std::string statement{R"({"indexName":")" + index_name + R"(","limit":2,"query":{"query":"*"}})"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_payload(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_callback(cmd, search_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_search(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        if (err == LCB_ERR_RATE_LIMITED) {
            found_error = true;
            break;
        }
    }

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsSearchEgress)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.search_limits.enforce = true;
    limits.search_limits.egress_mib_per_min = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    auto index_name = unique_name("index");
    create_search_index(instance, index_name, "fulltext-index", "couchbase",
                        MockEnvironment::getInstance()->getBucket());

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::string key{"ratelimitingress"};
    std::string value_inner(1024 * 1024, 'a');
    std::string value{R"({"value": ")" + value_inner + R"("})"};

    storeKey(instance, key, value);

    bool found_error = false;
    auto start = std::chrono::high_resolution_clock::now();

    while (std::chrono::high_resolution_clock::now() < start + std::chrono::seconds(10)) {
        lcb_STATUS err;
        lcb_CMDSEARCH *cmd{};
        std::string statement{R"({"indexName":")" + index_name + R"(","limit":1,"query":{"query":"a*"}})"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_payload(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_callback(cmd, search_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_search(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        if (err == LCB_ERR_RATE_LIMITED) {
            found_error = true;
            break;
        }
    }

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsSearchIngress)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.search_limits.enforce = true;
    limits.search_limits.ingress_mib_per_min = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    auto index_name = unique_name("index");
    create_search_index(instance, index_name, "fulltext-index", "couchbase",
                        MockEnvironment::getInstance()->getBucket());

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::string key{"ratelimitingress"};
    // fts chokes on a large payload
    std::string query(1024, 'a');

    bool found_error = false;
    auto start = std::chrono::high_resolution_clock::now();

    while (std::chrono::high_resolution_clock::now() < start + std::chrono::seconds(10)) {
        lcb_STATUS err;
        lcb_CMDSEARCH *cmd{};
        std::string statement{R"({"indexName":")" + index_name + R"(","limit":1,"query":{"query":")" + query + R"("}})"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_payload(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_callback(cmd, search_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_search(instance, &err, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_destroy(cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
        if (err == LCB_ERR_RATE_LIMITED) {
            found_error = true;
            break;
        }
    }

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}

TEST_F(RateLimitTest, testRateLimitsSearchConcurrentRequests)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_71)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    enforce_rate_limits(instance);
    rate_limits limits{};
    limits.search_limits.enforce = true;
    limits.search_limits.num_queries_per_min = 1;
    auto username = unique_name("rate_limited_user");
    std::string password{"password"};
    create_rate_limited_user(instance, username, limits);

    auto index_name = unique_name("index");
    create_search_index(instance, index_name, "fulltext-index", "couchbase",
                        MockEnvironment::getInstance()->getBucket());

    hw.destroy();

    ASSERT_STATUS_EQ(LCB_SUCCESS, retry_connect_on_auth_failure(hw, &instance, username, "password"));

    std::vector<lcb_STATUS> errors{};
    errors.reserve(10);

    lcb_sched_enter(instance);
    for (int ii = 0; ii < 10; ++ii) {
        lcb_CMDSEARCH *cmd{};
        std::string statement{R"({"indexName":")" + index_name + R"(","limit":2,"query":{"query":"*"}})"};

        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_create(&cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_payload(cmd, statement.c_str(), statement.size()));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_callback(cmd, concurrent_search_callback));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_search(instance, &errors, cmd));
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdsearch_destroy(cmd));
    }
    lcb_sched_leave(instance);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));

    bool found_error = std::count_if(errors.begin(), errors.end(), [](lcb_STATUS err) { return err == LCB_ERR_RATE_LIMITED; }) > 0;

    ASSERT_TRUE(found_error);

    drop_user(instance, username);
}