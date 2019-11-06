#include "config.h"
#include "iotests.h"
#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include "internal.h"

using namespace std;

struct N1QLResult {
    vector<string> rows;
    string meta;
    int htcode;
    lcb_error_t rc;
    bool called;
    string status;
    vector<pair<unsigned int, string> > errors;

    N1QLResult() {
        reset();
    }

    void reset() {
        called = false;
        rc = LCB_SUCCESS;
        meta.clear();
        rows.clear();
        status.clear();
        errors.clear();
        htcode = 0;
    }
};

#define SKIP_QUERY_TEST() \
    fprintf(stderr, "Requires recent mock with query support"); \
    return

extern "C" {
static void rowcb(lcb_t, int, const lcb_RESPN1QL *resp)
{
    N1QLResult *res = reinterpret_cast<N1QLResult*>(resp->cookie);
    if (resp->rflags & LCB_RESP_F_FINAL) {
        res->rc = resp->rc;
        if (resp->row) {
            res->meta.assign(static_cast<const char*>(resp->row), resp->nrow);

            Json::Value meta;
            if (Json::Reader().parse(resp->row, resp->row + resp->nrow, meta)) {
                res->status = meta["status"].asString();

                Json::Value& errors = meta["errors"];
                if (errors.isArray()) {
                    for (Json::ArrayIndex ii = 0; ii < errors.size(); ++ii) {
                        Json::Value& err = errors[ii];
                        if (err.isObject()) {
                            res->errors.push_back(make_pair(err["code"].asUInt(), err["msg"].asString()));
                        }
                    }
                }
            }
        }
        if (resp->htresp) {
            res->htcode = resp->htresp->htstatus;
        }
    } else {
        string row(static_cast<const char*>(resp->row), resp->nrow);
        res->rows.push_back(row);
    }
    res->called = true;
}
}

class QueryUnitTest : public MockUnitTest {
protected:
    lcb_N1QLPARAMS *params;
    void SetUp() {
        params = lcb_n1p_new();
    }
    void TearDown() {
        lcb_n1p_free(params);
    }
    bool createQueryConnection(HandleWrap& hw, lcb_t& instance) {
        if (MockEnvironment::getInstance()->isRealCluster()) {
            return false;
        }
        createConnection(hw, instance);
        const lcbvb_CONFIG *vbc;
        lcb_error_t rc;
        rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
        EXPECT_EQ(LCB_SUCCESS, rc);
        int ix = lcbvb_get_randhost(vbc, LCBVB_SVCTYPE_N1QL, LCBVB_SVCMODE_PLAIN);
        return ix > -1;
    }

    void makeCommand(const char *query, lcb_CMDN1QL& cmd, bool prepared=false) {
        lcb_n1p_setstmtz(params, query);
        lcb_error_t rc = lcb_n1p_mkcmd(params, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);

        cmd.callback = rowcb;
        if (prepared) {
            cmd.cmdflags |= LCB_CMDN1QL_F_PREPCACHE;
        }
    }
};

TEST_F(QueryUnitTest, testSimple)
{
    lcb_t instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, instance)) {
        SKIP_QUERY_TEST();
    }

    lcb_CMDN1QL cmd = { 0 };
    N1QLResult res;
    makeCommand("SELECT mockrow", cmd);
    lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, res.rc);
    ASSERT_EQ(1, res.rows.size());
}

TEST_F(QueryUnitTest, testQueryError)
{
    lcb_t instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, instance)) {
        SKIP_QUERY_TEST();
    }
    lcb_CMDN1QL cmd = { 0 };
    N1QLResult res;
    makeCommand("SELECT blahblah FROM blahblah", cmd);
    lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_TRUE(res.rows.empty());
}

TEST_F(QueryUnitTest, testInvalidJson)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    lcb_CMDN1QL cmd = { 0 };
    cmd.query = "blahblah";
    cmd.nquery = strlen(cmd.query);
    cmd.callback = rowcb;
    lcb_error_t rc = lcb_n1ql_query(instance, NULL, &cmd);
    ASSERT_NE(LCB_SUCCESS, rc);
}

TEST_F(QueryUnitTest, testPrepareOk)
{
    lcb_t instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, instance)) {
        SKIP_QUERY_TEST();
    }
    lcb_CMDN1QL cmd = { 0 };
    N1QLResult res;
    makeCommand("SELECT mockrow", cmd, true);
    lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(res.rc, LCB_SUCCESS);
    ASSERT_EQ(1, res.rows.size());

    // Get the plan contents
    string query("SELECT mockrow");
    string plan;
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan);
    // We have the plan!
    ASSERT_FALSE(plan.empty());

    // Issue it again..
    makeCommand("SELECT mockrow", cmd, true);
    res.reset();
    rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    string plan2;
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan2);
    ASSERT_FALSE(plan2.empty());
    ASSERT_EQ(plan, plan2) << "Reused the same query (cache works!)";

    lcb_n1qlcache_clear(instance->n1ql_cache);
    plan.clear();
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan);
    ASSERT_TRUE(plan.empty());

    // Issue it again!
    makeCommand("SELECT mockrow", cmd, true);
    res.reset();
    rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);

    ASSERT_EQ(1, res.rows.size());
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, plan);
    ASSERT_FALSE(plan.empty());
}

TEST_F(QueryUnitTest, testPrepareStale)
{
    lcb_t instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, instance)) {
        SKIP_QUERY_TEST();
    }
    lcb_CMDN1QL cmd = { 0 };
    N1QLResult res;
    makeCommand("SELECT mockrow", cmd, true);
    lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(1, res.rows.size());

    // Reset the index "state"
    MockCommand mcmd(MockCommand::RESET_QUERYSTATE);
    doMockTxn(mcmd);

    // Ensure the previous plan fails
    string query("SELECT mockrow");
    string raw;
    lcb_n1qlcache_getplan(instance->n1ql_cache, query, raw);
    ASSERT_FALSE(raw.empty());

    cmd.query = raw.c_str();
    cmd.nquery = raw.size();
    cmd.cmdflags = 0;

    res.reset();
    rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_TRUE(res.rows.empty());
    ASSERT_FALSE(res.meta.empty());
    ASSERT_NE(string::npos, res.meta.find("indexNotFound"));

    // Now that we've verified our current plan isn't working, let's try to
    // issue the cached plan again. lcb should get us a new plan
    makeCommand("SELECT mockrow", cmd , true);
    res.reset();
    rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(1, res.rows.size());
}

TEST_F(QueryUnitTest, testPrepareFailure)
{
    lcb_t instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, instance)) {
        SKIP_QUERY_TEST();
    }
    lcb_CMDN1QL cmd = { 0 };
    N1QLResult res;
    makeCommand("SELECT blahblah", cmd, true);
    lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_TRUE(res.called);
    ASSERT_NE(LCB_SUCCESS, res.rc);
    ASSERT_TRUE(res.rows.empty());
}

TEST_F(QueryUnitTest, testCancellation)
{
    lcb_t instance;
    HandleWrap hw;
    if (!createQueryConnection(hw, instance)) {
        SKIP_QUERY_TEST();
    }
    lcb_CMDN1QL cmd = { 0 };
    N1QLResult res;
    makeCommand("SELECT mockrow", cmd);
    lcb_N1QLHANDLE handle = NULL;
    cmd.handle = &handle;
    lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(handle != NULL);
    lcb_n1ql_cancel(instance, handle);
    lcb_wait(instance);
    ASSERT_FALSE(res.called);
}

typedef pair<string, string> credentials;

struct cycled_auth {
  private:
    vector<credentials> store_;
    size_t cur_;
    size_t num_cyles_;
    credentials fallback_;
    string port_;

  public:
    cycled_auth(string port, credentials fallback): store_(), cur_(0), fallback_(fallback), port_(port) {}

    void add(string username, string password) {
        store_.push_back(credentials(username, password));
    }

    void clear() {
        num_cyles_ = 0;
        cur_ = 0;
        store_.clear();
    }

    const credentials& get(string port) {
        if (port == port_) {
            return store_[cur_];
        }
        return fallback_;
    }

    size_t num_cycles() {
        return num_cyles_;
    }

    void advance(string port) {
        if (port == port_) {
            num_cyles_++;
            cur_ = num_cyles_ % store_.size();
        }
    }
};

extern "C" {
static const char *get_username(void *cookie, const char *host, const char *port, const char *bucket)
{
    cycled_auth *auth = static_cast< cycled_auth * >(cookie);
    return auth->get(port).first.c_str();
}

static const char *get_password(void *cookie, const char *host, const char *port, const char *bucket)
{
    cycled_auth *auth = static_cast< cycled_auth * >(cookie);
    const char *value = auth->get(port).second.c_str();
    auth->advance(port);
    return value;
}
}

string get_n1ql_port(lcb_t instance)
{

    lcbvb_CONFIG *vbc;
    lcb_error_t rc;
    rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    EXPECT_EQ(LCB_SUCCESS, rc);
    stringstream buf;
    unsigned int port = lcbvb_get_port(vbc, 0, LCBVB_SVCTYPE_N1QL, LCBVB_SVCMODE_PLAIN);
    buf << port;
    return buf.str();
}

#include "auth-priv.h"

TEST_F(QueryUnitTest, testRetryOnAuthenticationFailure)
{
    lcb_t instance;
    HandleWrap hw;
    SKIP_IF_MOCK();
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_50);
    createConnection(hw, instance);
    lcb_cntl_setu32(instance, LCB_CNTL_N1QL_TIMEOUT, LCB_MS2US(100)); // 100ms before timeout

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
    lcb_CMDN1QL cmd = { 0 };
    string query;

    query = string("CREATE PRIMARY INDEX ON `") + MockEnvironment::getInstance()->getBucket() + "`";
    makeCommand(query.c_str(), cmd, false);

    // make sure the index exists
    {
        auth->reset_cache();
        res.reset();
        ca.clear();
        ca.add(valid_username, valid_password);

        lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance);
        ASSERT_TRUE(res.called);
    }


    query = string("SELECT * FROM `") + MockEnvironment::getInstance()->getBucket() + "`";
    makeCommand(query.c_str(), cmd, false);

    // send query with valid password
    {
        auth->reset_cache();
        res.reset();
        ca.clear();
        ca.add(valid_username, valid_password);

        lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
    }

    // send query with invalid password
    {
        auth->reset_cache();
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password);

        lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_ETIMEDOUT, res.rc); // timeout because of retrying
    }

    // send query with valid password
    {
        auth->reset_cache();
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password); // first request
        ca.add(valid_username, valid_password);   // second request

        lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
    }

    // the same as above, but for prepared statement
    query = string("SELECT * FROM `") + MockEnvironment::getInstance()->getBucket() + "`";
    makeCommand(query.c_str(), cmd, true);

    // send query with valid password
    {
        auth->reset_cache();
        res.reset();
        ca.clear();
        ca.add(valid_username, valid_password);

        lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
    }

    // send query with invalid password
    {
        auth->reset_cache();
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password);

        lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_ETIMEDOUT, res.rc); // timeout because of retrying
    }

    // send query with valid password
    {
        auth->reset_cache();
        res.reset();
        ca.clear();
        ca.add(valid_username, invalid_password); // first request
        ca.add(valid_username, valid_password);   // second request
        ca.add(valid_username, invalid_password); // won't be used because valid will be cached

        lcb_error_t rc = lcb_n1ql_query(instance, &res, &cmd);
        ASSERT_EQ(LCB_SUCCESS, rc);
        lcb_wait(instance);
        ASSERT_TRUE(res.called);
        ASSERT_EQ(LCB_SUCCESS, res.rc);
        ASSERT_TRUE(res.errors.empty());
        ASSERT_EQ(2, ca.num_cycles());
    }

}
