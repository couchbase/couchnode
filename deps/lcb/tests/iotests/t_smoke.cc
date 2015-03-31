#include <gtest/gtest.h>
#include "iotests.h"
using std::vector;
using std::string;

// This file contains the 'migrated' tests from smoke-test.c

static lcb_config_transport_t transports[] = {
        LCB_CONFIG_TRANSPORT_HTTP, LCB_CONFIG_TRANSPORT_LIST_END };
struct rvbuf {
    lcb_error_t error;
    lcb_storage_t operation;
    vector<char> bytes;
    vector<char> key;
    lcb_cas_t cas;
    lcb_uint32_t flags;
    lcb_int32_t counter;
    lcb_uint32_t errorCount;

    template <typename T> void setKey(const T* resp) {
        const char *ktmp, *kend;
        ktmp = (const char*)resp->v.v0.key;
        kend = ktmp + resp->v.v0.nkey;
        key.assign(ktmp, kend);
    }

    void setValue(const lcb_get_resp_t *resp) {
        const char *btmp = (const char*)resp->v.v0.bytes;
        const char *bend = btmp + resp->v.v0.nbytes;
        bytes.assign(btmp, bend);
    }

    string getKeyString() {
        return string(key.begin(), key.end());
    }

    string getValueString() {
        return string(bytes.begin(), bytes.end());
    }

    rvbuf() {
        reset();
    }

    void reset() {
        error = LCB_SUCCESS;
        operation = LCB_SET;
        cas = 0;
        flags = 0;
        counter = 0;
        errorCount = 0;
        key.clear();
        bytes.clear();
    }

    void setError(lcb_error_t err) {
        EXPECT_GT(counter, 0);
        counter--;
        if (err != LCB_SUCCESS) {
            error = err;
            errorCount++;
        }
    }
    void incRemaining() { counter++; }
};

extern "C"
{
static void store_callback(lcb_t, const void *cookie, lcb_storage_t op,
    lcb_error_t err, const lcb_store_resp_t *resp)
{
    rvbuf *rv = (rvbuf *)cookie;
    rv->setError(err);
    rv->setKey(resp);
    rv->operation = op;
}
static void get_callback(lcb_t, const void *cookie, lcb_error_t err,
    const lcb_get_resp_t *resp)
{
    rvbuf *rv = (rvbuf*)cookie;
    rv->setError(err);
    rv->setKey(resp);
    if (err == LCB_SUCCESS) {
        rv->setValue(resp);
    }
}
static void touch_callback(lcb_t, const void *cookie, lcb_error_t err,
    const lcb_touch_resp_t *resp)
{
    rvbuf *rv = (rvbuf *)cookie;
    rv->setError(err);
    rv->setKey(resp);
    EXPECT_EQ(LCB_SUCCESS, err);
}
static void version_callback(lcb_t, const void *cookie, lcb_error_t err,
    const lcb_server_version_resp_t *resp)
{
    const char *server_endpoint = (const char *)resp->v.v0.server_endpoint;
    const char *vstring = (const char *)resp->v.v0.vstring;
    lcb_size_t nvstring = resp->v.v0.nvstring;
    rvbuf *rv = (rvbuf *)cookie;
    char *str;
    EXPECT_EQ(LCB_SUCCESS, err);

    if (server_endpoint == NULL) {
        assert(rv->counter == 0);
        return;
    }

    rv->setError(err);
    /*copy the key to an allocated buffer and ensure the key read from vstring
     * will not segfault
     */
    str = (char *)malloc(nvstring);
    memcpy(str, vstring, nvstring);
    free(str);

}
} //extern "C"
static void
setupCallbacks(lcb_t instance)
{
    lcb_set_store_callback(instance, store_callback);
    lcb_set_get_callback(instance, get_callback);
    lcb_set_touch_callback(instance, touch_callback);
    lcb_set_version_callback(instance, version_callback);
}

class SmokeTest : public ::testing::Test
{
protected:
    MockEnvironment *mock;
    lcb_t session;
    void SetUp() {
        assert(session == NULL);
        session = NULL;
        mock = NULL;
    }

    void TearDown() {
        if (session != NULL) {
            lcb_destroy(session);
        }
        if (mock != NULL) {
            delete mock;
        }

        session = NULL;
        mock = NULL;
    }
    void destroySession() {
        if (session != NULL) {
            lcb_destroy(session);
            session = NULL;
        }
    }

    SmokeTest() : mock(NULL), session(NULL) {}
public:
    void testSet1();
    void testSet2();
    void testGet1();
    void testGet2();
    void testTouch1();
    void testVersion1();
    void testSpuriousSaslError();
    lcb_error_t testMissingBucket();

    // Call to connect instance
    void connectCommon(const char *password = NULL, lcb_error_t expected = LCB_SUCCESS);
};

void
SmokeTest::testSet1()
{
    lcb_error_t err;
    rvbuf rv;
    lcb_store_cmd_t cmd;
    const lcb_store_cmd_t *cmds[] = { &cmd };
    memset(&cmd, 0, sizeof(cmd));

    string key("foo");
    string value("bar");

    cmd.v.v0.key = key.c_str();
    cmd.v.v0.nkey = key.size();
    cmd.v.v0.bytes = value.c_str();
    cmd.v.v0.nbytes = value.size();
    cmd.v.v0.operation = LCB_SET;
    err = lcb_store(session, &rv, 1, cmds);
    rv.incRemaining();
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_wait(session);
    EXPECT_EQ(LCB_SUCCESS, rv.error);
    EXPECT_EQ(LCB_SET, rv.operation);
    EXPECT_EQ(key, rv.getKeyString());
}

void
SmokeTest::testSet2()
{
    lcb_error_t err;
    struct rvbuf rv;
    lcb_size_t ii;
    lcb_store_cmd_t cmd;
    const lcb_store_cmd_t *cmds[] = { &cmd };
    string key("foo"), value("bar");

    memset(&cmd, 0, sizeof(cmd));
    cmd.v.v0.key = key.c_str();
    cmd.v.v0.nkey = key.size();
    cmd.v.v0.bytes = value.c_str();
    cmd.v.v0.nbytes = value.size();
    cmd.v.v0.operation = LCB_SET;

    rv.errorCount = 0;
    rv.counter = 0;
    for (ii = 0; ii < 10; ++ii, rv.incRemaining()) {
        err = lcb_store(session, &rv, 1, cmds);
        EXPECT_EQ(LCB_SUCCESS, err);
    }
    lcb_wait(session);
    EXPECT_EQ(0, rv.errorCount);
}

void
SmokeTest::testGet1()
{
    lcb_error_t err;
    struct rvbuf rv;
    lcb_store_cmd_t storecmd;
    const lcb_store_cmd_t *storecmds[] = { &storecmd };
    lcb_get_cmd_t getcmd;
    const lcb_get_cmd_t *getcmds[] = { &getcmd };
    string key("foo"), value("bar");

    memset(&storecmd, 0, sizeof(storecmd));
    storecmd.v.v0.key = key.c_str();
    storecmd.v.v0.nkey = key.size();
    storecmd.v.v0.bytes = value.c_str();
    storecmd.v.v0.nbytes = value.size();
    storecmd.v.v0.operation = LCB_SET;
    rv.incRemaining();
    err = lcb_store(session, &rv, 1, storecmds);
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_wait(session);
    EXPECT_EQ(LCB_SUCCESS, rv.error);

    rv.reset();
    memset(&getcmd, 0, sizeof(getcmd));
    getcmd.v.v0.key = key.c_str();
    getcmd.v.v0.nkey = key.size();
    rv.incRemaining();
    err = lcb_get(session, &rv, 1, getcmds);
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_wait(session);
    EXPECT_EQ(rv.error, LCB_SUCCESS);
    EXPECT_EQ(key, rv.getKeyString());
    EXPECT_EQ(value, rv.getValueString());
}

static void
genAZString(vector<string>& coll)
{
    string base("foo");
    for (size_t ii = 0; ii < 26; ++ii) {
        coll.push_back(base);
        coll.back() += ('a' + ii);
    }
}

void
SmokeTest::testGet2()
{
    lcb_error_t err;
    struct rvbuf rv;
    string value("bar");
    lcb_store_cmd_t storecmd;
    const lcb_store_cmd_t *storecmds[] = { &storecmd };
    lcb_get_cmd_t *getcmds[26];
    vector<string> coll;
    genAZString(coll);

    for (size_t ii = 0; ii < coll.size(); ii++) {
        const string& curKey = coll[ii];

        memset(&storecmd, 0, sizeof(storecmd));
        storecmd.v.v0.key = curKey.c_str();
        storecmd.v.v0.nkey = curKey.size();
        storecmd.v.v0.bytes = value.c_str();
        storecmd.v.v0.nbytes = value.size();
        storecmd.v.v0.operation = LCB_SET;
        err = lcb_store(session, &rv, 1, storecmds);
        EXPECT_EQ(LCB_SUCCESS, err);
        rv.incRemaining();
        lcb_wait(session);
        EXPECT_EQ(LCB_SUCCESS, rv.error);

        rv.reset();
        getcmds[ii] = (lcb_get_cmd_t *)calloc(1, sizeof(lcb_get_cmd_t));
        EXPECT_FALSE(NULL == getcmds[ii]);
        getcmds[ii]->v.v0.key = curKey.c_str();
        getcmds[ii]->v.v0.nkey = curKey.size();
    }

    rv.counter = coll.size();
    err = lcb_get(session, &rv, coll.size(), (const lcb_get_cmd_t * const *)getcmds);
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_wait(session);
    EXPECT_EQ(LCB_SUCCESS, rv.error);
    EXPECT_EQ(value, rv.getValueString());

    for (size_t ii = 0; ii < 26; ii++) {
        free(getcmds[ii]);
    }
}

void
SmokeTest::testTouch1()
{
    lcb_error_t err;
    struct rvbuf rv;
    lcb_store_cmd_t storecmd;
    const lcb_store_cmd_t *storecmds[] = { &storecmd };
    lcb_touch_cmd_t *touchcmds[26];
    vector<string> coll;
    string value("bar");
    genAZString(coll);
    for (size_t ii = 0; ii < coll.size(); ii++) {
        const string& curKey = coll[ii];
        memset(&storecmd, 0, sizeof(storecmd));
        storecmd.v.v0.key = curKey.c_str();
        storecmd.v.v0.nkey = curKey.size();
        storecmd.v.v0.bytes = value.c_str();
        storecmd.v.v0.nbytes = value.size();
        storecmd.v.v0.operation = LCB_SET;
        err = lcb_store(session, &rv, 1, storecmds);
        EXPECT_EQ(LCB_SUCCESS, err);
        rv.incRemaining();
        lcb_wait(session);
        EXPECT_EQ(LCB_SUCCESS, rv.error);

        rv.reset();
        touchcmds[ii] = (lcb_touch_cmd_t*)calloc(1, sizeof(lcb_touch_cmd_t));
        EXPECT_FALSE(touchcmds[ii] == NULL);
        touchcmds[ii]->v.v0.key = curKey.c_str();
        touchcmds[ii]->v.v0.nkey = curKey.size();
    }

    rv.counter = coll.size();
    err = lcb_touch(session, &rv, coll.size(), (const lcb_touch_cmd_t * const *)touchcmds);
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_wait(session);
    EXPECT_EQ(LCB_SUCCESS, rv.error);
    for (size_t ii = 0; ii < coll.size(); ii++) {
        free(touchcmds[ii]);
    }
}

void
SmokeTest::testVersion1()
{
    lcb_error_t err;
    struct rvbuf rv;
    lcb_server_version_cmd_t cmd;
    const lcb_server_version_cmd_t *cmds[] = { &cmd };
    memset(&cmd, 0, sizeof(cmd));

    err = lcb_server_versions(session, &rv, 1, cmds);
    EXPECT_EQ(LCB_SUCCESS, err);
    rv.counter = mock->getNumNodes();
    lcb_wait(session);
    EXPECT_EQ(LCB_SUCCESS, rv.error);
    EXPECT_EQ(0, rv.counter);
}

lcb_error_t
SmokeTest::testMissingBucket()
{
    destroySession();
    // create a new session
    lcb_create_st cropts;
    mock->makeConnectParams(cropts);
    cropts.v.v2.transports = transports;
    cropts.v.v2.bucket = "nonexist";
    cropts.v.v2.user = "nonexist";
    lcb_error_t err;
    err = lcb_create(&session, &cropts);
    EXPECT_EQ(LCB_SUCCESS, err);
    mock->postCreate(session);

    err = lcb_connect(session);
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_wait(session);
    err = lcb_get_bootstrap_status(session);
    EXPECT_NE(LCB_SUCCESS, err);
    EXPECT_TRUE(err == LCB_BUCKET_ENOENT||err == LCB_AUTH_ERROR);
    destroySession();
    return err;
}

void
SmokeTest::testSpuriousSaslError()
{
    int iterations = 50;
    rvbuf rvs[50];
    int i;
    lcb_error_t err;
    lcb_store_cmd_t storecmd;
    const lcb_store_cmd_t *storecmds[] = { &storecmd };

    for (i = 0; i < iterations; i++) {
        rvs[i].counter = 999;
        memset(&storecmd, 0, sizeof(storecmd));
        storecmd.v.v0.key = "KEY";
        storecmd.v.v0.nkey = strlen((const char *)storecmd.v.v0.key);
        storecmd.v.v0.bytes = "KEY";
        storecmd.v.v0.nbytes = strlen((const char *)storecmd.v.v0.bytes);
        storecmd.v.v0.operation = LCB_SET;
        err = lcb_store(session, rvs + i, 1, storecmds);
        EXPECT_EQ(LCB_SUCCESS, err);
    }
    lcb_wait(session);

    for (i = 0; i < iterations; i++) {
        const char *errinfo = NULL;
        if (rvs[i].errorCount != LCB_SUCCESS) {
            errinfo = "Did not get success response";
        } else if (rvs[i].key.size() != 3) {
            errinfo = "Did not get expected key length";
        } else if (rvs[i].getKeyString() != string("KEY")) {
            errinfo = "Weird key size";
        }
        if (errinfo) {
            EXPECT_FALSE(true) << errinfo;
        }
    }
}

void
SmokeTest::connectCommon(const char *password, lcb_error_t expected)
{
    lcb_create_st cropts;
    mock->makeConnectParams(cropts, NULL);

    if (password != NULL) {
        cropts.v.v2.passwd = password;
    }
    cropts.v.v2.transports = transports;
    lcb_error_t err = lcb_create(&session, &cropts);
    EXPECT_EQ(LCB_SUCCESS, err);

    mock->postCreate(session);
    err = lcb_connect(session);
    EXPECT_EQ(LCB_SUCCESS, err);
    lcb_wait(session);
    EXPECT_EQ(expected, lcb_get_bootstrap_status(session));
    setupCallbacks(session);
}

TEST_F(SmokeTest, testMemcachedBucket)
{
    SKIP_UNLESS_MOCK();
    const char *args[] = { "--buckets", "default::memcache", NULL };
    mock = new MockEnvironment(args);
    mock->setCCCP(false);
    connectCommon();
    testSet1();
    testSet2();
    testGet1();
    testGet2();
    testVersion1();

    // A bit out of place, but check that replica commands fail at schedule-time
    lcb_sched_enter(session);
    lcb_CMDGETREPLICA cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    lcb_error_t rc;

    cmd.strategy = LCB_REPLICA_FIRST;
    rc = lcb_rget3(session, NULL, &cmd);
    ASSERT_EQ(LCB_NO_MATCHING_SERVER, rc);

    cmd.strategy = LCB_REPLICA_ALL;
    rc = lcb_rget3(session, NULL, &cmd);
    ASSERT_EQ(LCB_NO_MATCHING_SERVER, rc);

    cmd.strategy = LCB_REPLICA_SELECT;
    cmd.index = 0;
    rc = lcb_rget3(session, NULL, &cmd);
    ASSERT_EQ(LCB_NO_MATCHING_SERVER, rc);


    testMissingBucket();
}

TEST_F(SmokeTest, testCouchbaseBucket)
{
    SKIP_UNLESS_MOCK();
    const char *args[] = { "--buckets", "default::couchbase", NULL };
    mock = new MockEnvironment(args);
    mock->setCCCP(false);
    connectCommon();
    testSet1();
    testSet2();
    testGet1();
    testGet2();
    testVersion1();
    testMissingBucket();
}

TEST_F(SmokeTest, testSaslBucket)
{
    SKIP_UNLESS_MOCK();
    const char *args[] = { "--buckets", "protected:secret:couchbase", NULL };
    mock = new MockEnvironment(args, "protected");
    mock->setCCCP(false);


    testMissingBucket();

    connectCommon("secret");
    testSpuriousSaslError();

    destroySession();
    connectCommon("incorrect", LCB_AUTH_ERROR);
    destroySession();
}
