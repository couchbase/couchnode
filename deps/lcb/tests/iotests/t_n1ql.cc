/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2020 Couchbase, Inc.
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
#include <libcouchbase/couchbase.h>

#include <utility>
#include "internal.h"

using std::string;
using std::vector;

struct N1QLResult {
    vector<string> rows;
    string meta;
    uint16_t htcode{};
    lcb_STATUS rc{};
    bool called{};
    string status;
    vector<std::pair<unsigned int, string>> errors;

    N1QLResult()
    {
        reset();
    }

    void reset()
    {
        called = false;
        rc = LCB_SUCCESS;
        meta.clear();
        rows.clear();
        status.clear();
        errors.clear();
        htcode = 0;
    }
};

#define SKIP_QUERY_TEST()                                                                                              \
    fprintf(stderr, "Requires recent mock with query support\n");                                                      \
    return

#define SKIP_CLUSTER_QUERY_TEST()                                                                                      \
    fprintf(stderr, "Requires recent server with query support\n");                                                    \
    return

extern "C" {
static void rowcb(lcb_INSTANCE *, int, const lcb_RESPQUERY *resp)
{
    N1QLResult *res;
    lcb_respquery_cookie(resp, (void **)&res);

    const char *row;
    size_t nrow;
    lcb_respquery_row(resp, &row, &nrow);

    if (lcb_respquery_is_final(resp)) {
        res->rc = lcb_respquery_status(resp);
        if (row) {
            res->meta.assign(row, nrow);
            Json::Value meta;
            if (Json::Reader().parse(res->meta.data(), res->meta.data() + res->meta.size(), meta)) {
                res->status = meta["status"].asString();

                Json::Value &errors = meta["errors"];
                if (errors.isArray()) {
                    for (auto &err : errors) {
                        if (err.isObject()) {
                            res->errors.emplace_back(err["code"].asUInt(), err["msg"].asString());
                        }
                    }
                }
            }
        }
        const lcb_RESPHTTP *http = nullptr;
        lcb_respquery_http_response(resp, &http);
        if (http) {
            lcb_resphttp_http_status(http, &res->htcode);
        }
    } else {
        res->rows.emplace_back(row, nrow);
    }
    res->called = true;
}
}

class QueryUnitTest : public MockUnitTest
{
  protected:
    lcb_CMDQUERY *cmd{};
    void SetUp() override
    {
        lcb_cmdquery_create(&cmd);
    }
    void TearDown() override
    {
        lcb_cmdquery_destroy(cmd);
    }
    bool createQueryConnection(HandleWrap &hw, lcb_INSTANCE **instance)
    {
        if (MockEnvironment::getInstance()->isRealCluster()) {
            return false;
        }
        createConnection(hw, instance);
        const lcbvb_CONFIG *vbc;
        lcb_STATUS rc;
        rc = lcb_cntl(*instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
        EXPECT_EQ(LCB_SUCCESS, rc);
        int ix = lcbvb_get_randhost(vbc, LCBVB_SVCTYPE_QUERY, LCBVB_SVCMODE_PLAIN);
        return ix > -1;
    }

    bool createClusterQueryConnection(HandleWrap &hw, lcb_INSTANCE **instance)
    {
        if (!MockEnvironment::getInstance()->isRealCluster()) {
            return false;
        }
        createClusterConnection(hw, instance);
        const lcbvb_CONFIG *vbc = nullptr;
        lcb_STATUS rc;
        rc = lcb_cntl(*instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
        EXPECT_TRUE(vbc != nullptr);
        EXPECT_EQ(LCB_SUCCESS, rc);
        int ix = lcbvb_get_randhost(vbc, LCBVB_SVCTYPE_QUERY, LCBVB_SVCMODE_PLAIN);
        return ix > -1;
    }

    void makeCommand(const char *query, bool prepared = false)
    {
        lcb_cmdquery_reset(cmd);
        lcb_cmdquery_statement(cmd, query, strlen(query));
        lcb_cmdquery_callback(cmd, rowcb);
        lcb_cmdquery_adhoc(cmd, !prepared);
    }
};

TEST_F(QueryUnitTest, testSimple)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, &instance)) {
        SKIP_QUERY_TEST();
    }

    N1QLResult res;
    makeCommand("SELECT mockrow");
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, res.rc);
    ASSERT_EQ(1, res.rows.size());
}

TEST_F(QueryUnitTest, testQueryError)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, &instance)) {
        SKIP_QUERY_TEST();
    }
    N1QLResult res;
    makeCommand("SELECT blahblah FROM blahblah");
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_TRUE(res.rows.empty());
}

TEST_F(QueryUnitTest, testInvalidJson)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    createConnection(hw, &instance);
    lcb_CMDQUERY *cmd;
    lcb_cmdquery_create(&cmd);

    const char *bad_query = "blahblah";
    ASSERT_NE(LCB_SUCCESS, lcb_cmdquery_payload(cmd, bad_query, strlen(bad_query)));
    lcb_cmdquery_destroy(cmd);
}

TEST_F(QueryUnitTest, testPrepareOk)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, &instance)) {
        SKIP_QUERY_TEST();
    }
    N1QLResult res;
    makeCommand("SELECT mockrow", true);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(res.rc, LCB_SUCCESS);
    ASSERT_EQ(1, res.rows.size());

    // Get the plan contents
    string query("SELECT mockrow");
    string plan;
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan);
    // We have the plan!
    ASSERT_FALSE(plan.empty());

    // Issue it again..
    makeCommand("SELECT mockrow", true);
    res.reset();
    rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    string plan2;
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan2);
    ASSERT_FALSE(plan2.empty());
    ASSERT_EQ(plan, plan2) << "Reused the same query (cache works!)";

    lcb_n1qlcache_clear(instance->n1ql_cache);
    plan.clear();
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan);
    ASSERT_TRUE(plan.empty());

    // Issue it again!
    makeCommand("SELECT mockrow", true);
    res.reset();
    rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    ASSERT_EQ(1, res.rows.size());
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan);
    ASSERT_FALSE(plan.empty());
}

TEST_F(QueryUnitTest, testPrepareStale)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, &instance)) {
        SKIP_QUERY_TEST();
    }
    N1QLResult res;
    makeCommand("SELECT mockrow", true);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(1, res.rows.size());

    // Reset the index "state"
    MockCommand mcmd(MockCommand::RESET_QUERYSTATE);
    doMockTxn(mcmd);

    // Ensure the previous plan fails
    string query("SELECT mockrow");

    string raw;
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, raw);
    ASSERT_FALSE(raw.empty());

    lcb_cmdquery_reset(cmd);
    lcb_cmdquery_callback(cmd, rowcb);
    ASSERT_EQ(LCB_SUCCESS, lcb_cmdquery_payload(cmd, raw.c_str(), raw.size()));

    res.reset();
    rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_TRUE(res.rows.empty());
    ASSERT_FALSE(res.meta.empty());
    ASSERT_NE(string::npos, res.meta.find("indexNotFound"));

    // Now that we've verified our current plan isn't working, let's try to
    // issue the cached plan again. lcb should get us a new plan
    makeCommand("SELECT mockrow", true);
    res.reset();
    rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(1, res.rows.size());
}

TEST_F(QueryUnitTest, testPrepareFailure)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, &instance)) {
        SKIP_QUERY_TEST();
    }
    N1QLResult res;
    makeCommand("SELECT blahblah", true);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_TRUE(res.called);
    ASSERT_NE(LCB_SUCCESS, res.rc);
    ASSERT_TRUE(res.rows.empty());
}

TEST_F(QueryUnitTest, testCancellation)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, &instance)) {
        SKIP_QUERY_TEST();
    }
    N1QLResult res;
    makeCommand("SELECT mockrow");
    lcb_QUERY_HANDLE *handle = nullptr;
    lcb_cmdquery_handle(cmd, &handle);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(handle != nullptr);
    lcb_query_cancel(instance, handle);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_FALSE(res.called);
}

TEST_F(QueryUnitTest, testClusterwide)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    if (!createClusterQueryConnection(hw, &instance)) {
        SKIP_CLUSTER_QUERY_TEST();
    }
    N1QLResult res;
    makeCommand("SELECT 1");
    lcb_QUERY_HANDLE *handle = nullptr;
    lcb_cmdquery_handle(cmd, &handle);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(handle != nullptr);
    lcb_query_cancel(instance, handle);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_FALSE(res.called);
}

extern "C" {
static void setCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    int *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
    lcb_STATUS rc = lcb_respstore_status(resp);
    ASSERT_EQ(LCB_SUCCESS, rc) << lcb_strerror_short(rc);
}
}

string insert_doc(lcb_INSTANCE *instance, const string &scope, const string &collection)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)setCallback);

    string key = unique_name("id");
    string val = unique_name("foo");

    int numcallbacks = 0;
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_collection(cmd, scope.c_str(), scope.size(), collection.c_str(), collection.size());
    lcb_cmdstore_key(cmd, key.c_str(), key.size());
    lcb_cmdstore_value(cmd, val.c_str(), val.size());
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &numcallbacks, cmd));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    lcb_cmdstore_destroy(cmd);
    return key;
}

void create_index(lcb_INSTANCE *instance, const string &index, const string &scope, const string &collection)
{
    string keyspace = "`default`:`default`.`" + scope + "`.`" + collection + "`";
    string statement = "CREATE PRIMARY INDEX ";
    statement += "`" + index + "`" + " ON " + keyspace + " USING GSI";

    N1QLResult res;
    lcb_CMDQUERY *cmd;
    lcb_cmdquery_create(&cmd);
    lcb_cmdquery_statement(cmd, statement.c_str(), statement.size());
    lcb_cmdquery_callback(cmd, rowcb);

    lcb_QUERY_HANDLE *handle = nullptr;
    lcb_cmdquery_handle(cmd, &handle);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(handle != nullptr);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

/**
 * @test
 * End-to-End query test on a collection
 *
 * @pre
 * 1. Create scope and collection
 * 2. Add primary index to collection
 * 3. Upsert doc to collection
 * 4. Query on the collection
 *
 * @post
 *
 * Query on collection is successful
 */
TEST_F(QueryUnitTest, testCollectionQuery)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    string scope = unique_name("scope");
    string collection = unique_name("collection");
    string index = "test-index";

    // Create a scope and collection
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));
    sleep(5);

    // Create an index on the collection
    create_index(instance, index, scope, collection);
    sleep(10); /* Wait for index to be available. Should replace with poll.*/

    // Insert a doc
    string id = insert_doc(instance, scope, collection);

    N1QLResult res;
    lcb_CMDQUERY *cmd;
    lcb_cmdquery_create(&cmd);
    string query = "SELECT * FROM `" + collection + "` where meta().id=\"" + id + "\"";
    lcb_cmdquery_statement(cmd, query.c_str(), query.size());
    lcb_cmdquery_callback(cmd, rowcb);
    lcb_cmdquery_scope_name(cmd, scope.c_str(), scope.size());

    lcb_QUERY_HANDLE *handle = nullptr;
    lcb_cmdquery_handle(cmd, &handle);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(handle != nullptr);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_TRUE(res.called);
    ASSERT_EQ(1, res.rows.size());
}

TEST_F(QueryUnitTest, testQueryWithUnknownCollection)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    string scope = unique_name("scope1");
    string collection = unique_name("collection1");
    string unknown_scope = unique_name("scope2");
    string unknown_collection = unique_name("collection2");

    string index = "test-index";

    // Create a scope and collection
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));
    sleep(5);

    // Create an index on the collection
    create_index(instance, index, scope, collection);
    sleep(10); /* Wait for index to be available. Should replace with poll.*/

    // Insert a doc
    string id = insert_doc(instance, scope, collection);

    {
        // Query with unknown scope
        N1QLResult res;
        lcb_CMDQUERY *cmd;
        lcb_cmdquery_create(&cmd);
        string query = "SELECT * FROM `" + collection + "` where meta().id=\"" + id + "\"";
        lcb_cmdquery_statement(cmd, query.c_str(), query.size());
        lcb_cmdquery_callback(cmd, rowcb);
        lcb_cmdquery_scope_name(cmd, unknown_scope.c_str(), unknown_scope.size());

        lcb_QUERY_HANDLE *handle = nullptr;
        lcb_cmdquery_handle(cmd, &handle);
        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        lcb_cmdquery_destroy(cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        ASSERT_TRUE(handle != nullptr);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(0, res.rows.size());
        ASSERT_EQ(LCB_ERR_SCOPE_NOT_FOUND, res.rc) << lcb_strerror_short(res.rc);
    }

    {
        // Query with unknown collection
        N1QLResult res;
        lcb_CMDQUERY *cmd;
        lcb_cmdquery_create(&cmd);
        string query = "SELECT * FROM `" + unknown_collection + "` where meta().id=\"" + id + "\"";
        lcb_cmdquery_statement(cmd, query.c_str(), query.size());
        lcb_cmdquery_callback(cmd, rowcb);
        lcb_cmdquery_scope_name(cmd, scope.c_str(), scope.size());

        lcb_QUERY_HANDLE *handle = nullptr;
        lcb_cmdquery_handle(cmd, &handle);
        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        lcb_cmdquery_destroy(cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        ASSERT_TRUE(handle != nullptr);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(0, res.rows.size());
        ASSERT_EQ(LCB_ERR_KEYSPACE_NOT_FOUND, res.rc) << lcb_strerror_short(res.rc);
    }
}

TEST_F(QueryUnitTest, testCollectionPreparedQuery)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    HandleWrap hw;
    lcb_INSTANCE *instance;
    createConnection(hw, &instance);

    string scope = unique_name("scope");
    string collection = unique_name("collection");
    string index = "test-index";

    // Create a scope and collection
    EXPECT_EQ(LCB_SUCCESS, create_scope(instance, scope));
    EXPECT_EQ(LCB_SUCCESS, create_collection(instance, scope, collection));
    sleep(5);

    // Create an index on the collection
    create_index(instance, index, scope, collection);
    sleep(10); /* Wait for index to be available. Should replace with poll.*/

    // Insert a doc
    string id = insert_doc(instance, scope, collection);

    N1QLResult res;
    lcb_CMDQUERY *cmd;
    lcb_cmdquery_create(&cmd);
    string query = "SELECT * FROM `" + collection + "` where meta().id=\"" + id + "\"";
    lcb_cmdquery_statement(cmd, query.c_str(), query.size());
    lcb_cmdquery_callback(cmd, rowcb);
    lcb_cmdquery_scope_name(cmd, scope.c_str(), scope.size());
    lcb_cmdquery_adhoc(cmd, false);

    lcb_QUERY_HANDLE *handle = nullptr;
    lcb_cmdquery_handle(cmd, &handle);
    lcb_STATUS rc = lcb_query(instance, &res, cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(handle != nullptr);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_TRUE(res.called);
    ASSERT_EQ(LCB_SUCCESS, res.rc) << lcb_strerror_short(res.rc);
    ASSERT_EQ(1, res.rows.size());
}

using credentials = std::pair<string, string>;

struct cycled_auth {
  private:
    vector<credentials> store_;
    size_t cur_;
    credentials fallback_;
    string port_;

  public:
    cycled_auth(string port, credentials fallback)
        : store_(), cur_(0), fallback_(std::move(fallback)), port_(std::move(port))
    {
    }

    void add(const string &username, const string &password)
    {
        store_.emplace_back(username, password);
    }

    void clear()
    {
        cur_ = 0;
        store_.clear();
    }

    const credentials &get(const string &port)
    {
        if (port == port_) {
            return store_[cur_];
        }
        return fallback_;
    }

    void advance(const string &port)
    {
        if (port == port_) {
            cur_ = (cur_ + 1) % store_.size();
        }
    }
};

extern "C" {
static const char *get_username(void *cookie, const char * /* host */, const char *port, const char * /* bucket */)
{
    auto *auth = static_cast<cycled_auth *>(cookie);
    return auth->get(port).first.c_str();
}

static const char *get_password(void *cookie, const char * /* host */, const char *port, const char * /* bucket */)
{
    auto *auth = static_cast<cycled_auth *>(cookie);
    const char *value = auth->get(port).second.c_str();
    auth->advance(port);
    return value;
}
}

string get_n1ql_port(lcb_INSTANCE *instance)
{

    lcbvb_CONFIG *vbc;
    lcb_STATUS rc;
    rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    EXPECT_EQ(LCB_SUCCESS, rc);
    std::stringstream buf;
    unsigned int port = lcbvb_get_port(vbc, 0, LCBVB_SVCTYPE_QUERY, LCBVB_SVCMODE_PLAIN);
    buf << port;
    return buf.str();
}

TEST_F(QueryUnitTest, testRetryOnAuthenticationFailure)
{
    lcb_INSTANCE *instance;
    HandleWrap hw;
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_50)
    createConnection(hw, &instance);
    lcb_cntl_setu32(instance, LCB_CNTL_QUERY_TIMEOUT, LCB_MS2US(100)); // 100ms before timeout

    string valid_username = MockEnvironment::getInstance()->getUsername();
    string valid_password = MockEnvironment::getInstance()->getPassword();
    string invalid_password = valid_password + "_garbage";

    credentials fallback_credentials(valid_username, valid_password);
    cycled_auth ca(get_n1ql_port(instance), fallback_credentials);

    lcb_AUTHENTICATOR *auth = lcbauth_new();
    lcbauth_set_callbacks(auth, &ca, get_username, get_password);
    lcbauth_set_mode(auth, LCBAUTH_MODE_DYNAMIC);
    lcb_set_auth(instance, auth);

    N1QLResult res;
    string query;

    query = string("CREATE PRIMARY INDEX ON `") + MockEnvironment::getInstance()->getBucket() + "`";
    makeCommand(query.c_str(), false);

    // make sure the index exists
    {
        res.reset();
        ca.clear();
        ca.add(valid_username, valid_password);

        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
    }

    query = string("SELECT * FROM `") + MockEnvironment::getInstance()->getBucket() + "`";
    makeCommand(query.c_str(), false);

    // send query with valid password
    {
        res.reset();
        ca.clear();
        ca.add(valid_username, valid_password);

        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
    }

    // send query with invalid password
    {
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password);

        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_ERR_TIMEOUT, res.rc); // timeout because of retrying
    }

    // send query with valid password
    {
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password); // first request
        ca.add(valid_username, valid_password);   // second request

        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
    }

    // the same as above, but for prepared statement
    query = string("SELECT * FROM `") + MockEnvironment::getInstance()->getBucket() + "`";
    makeCommand(query.c_str(), true);

    // send query with valid password
    {
        res.reset();
        ca.clear();
        ca.add(valid_username, valid_password);

        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
    }

    // send query with invalid password
    {
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password);

        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_ERR_TIMEOUT, res.rc); // timeout because of retrying
    }

    // send query with valid password
    {
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password); // first request
        ca.add(valid_username, valid_password);   // second request
        ca.add(valid_username, valid_password);   // third request

        lcb_STATUS rc = lcb_query(instance, &res, cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
    }
}
