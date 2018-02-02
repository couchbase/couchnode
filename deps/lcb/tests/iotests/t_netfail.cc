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
#include <map>

#include "internal.h" /* vbucket_* things from lcb_t */
#include <lcbio/iotable.h>
#include "bucketconfig/bc_http.h"

#define LOGARGS(instance, lvl) \
    instance->settings, "tests-MUT", LCB_LOG_##lvl, __FILE__, __LINE__

#if defined(_WIN32) && !defined(usleep)
#define usleep(n) Sleep((n) / 1000)
#endif

namespace {
class Retryer {
public:
    Retryer(time_t maxDuration) : maxDuration(maxDuration) {}
    bool run() {
        time_t maxTime = time(NULL) + maxDuration;
        while (!checkCondition()) {
            trigger();
            if (checkCondition()) {
                break;
            }
            if (time(NULL) > maxTime) {
                printf("Time expired and condition still false!\n");
                break;
            } else {
                printf("Sleeping for a bit to allow failover/respawn propagation\n");
                usleep(100000); // Sleep for 100ms
            }
        }
        return checkCondition();
    }
protected:
    virtual bool checkCondition() = 0;
    virtual void trigger() = 0;
private:
    time_t maxDuration;
};

extern "C" {
static void nopStoreCb(lcb_t, int, const lcb_RESPBASE *) {}
}

class NumNodeRetryer : public Retryer {
public:
    NumNodeRetryer(time_t duration, lcb_t instance, size_t expCount) :
        Retryer(duration), instance(instance), expCount(expCount) {
        genDistKeys(LCBT_VBCONFIG(instance), distKeys);
    }
    virtual ~NumNodeRetryer() {}

protected:
    virtual bool checkCondition() {
        return lcb_get_num_nodes(instance) == expCount;
    }
    virtual void trigger() {
        lcb_RESPCALLBACK oldCb = lcb_install_callback3(instance, LCB_CALLBACK_STORE, nopStoreCb);
        lcb_CMDSTORE scmd = { 0 };
        scmd.operation = LCB_SET;
        lcb_sched_enter(instance);

        size_t nSubmit = 0;
        for (size_t ii = 0; ii < distKeys.size(); ii++) {
            LCB_CMD_SET_KEY(&scmd, distKeys[ii].c_str(), distKeys[ii].size());
            LCB_CMD_SET_VALUE(&scmd, distKeys[ii].c_str(), distKeys[ii].size());
            lcb_error_t rc = lcb_store3(instance, NULL, &scmd);
            if (rc != LCB_SUCCESS) {
                continue;
            }
            nSubmit++;
        }
        if (nSubmit) {
            lcb_sched_leave(instance);
            lcb_wait(instance);
        }

        lcb_install_callback3(instance, LCB_CALLBACK_STORE, oldCb);
    }

private:
    lcb_t instance;
    size_t expCount;
    std::vector<std::string> distKeys;
};
}

static bool
syncWithNodeCount_(lcb_t instance, size_t expCount)
{
    NumNodeRetryer rr(60, instance, expCount);
    return rr.run();
}

#define SYNC_WITH_NODECOUNT(instance, expCount) \
    if (!syncWithNodeCount_(instance, expCount)) { \
        lcb_log(LOGARGS(instance, WARN), "Timed out waiting for new configuration. Slow system?"); \
        fprintf(stderr, "*** FIXME: TEST NOT RUN! (not an SDK error)\n"); \
        return; \
    }



extern "C" {
static void opFromCallback_storeCB(lcb_t, const void *, lcb_storage_t,
    lcb_error_t error, const lcb_store_resp_t *) {
    ASSERT_EQ(LCB_SUCCESS, error);
}

static void opFromCallback_statsCB(lcb_t instance, const void *,
    lcb_error_t error, const lcb_server_stat_resp_t *resp)
{
    lcb_error_t err;
    char *statkey;
    lcb_size_t nstatkey;

    ASSERT_EQ(0, resp->version);
    const char *server_endpoint = resp->v.v0.server_endpoint;
    const void *key = resp->v.v0.key;
    lcb_size_t nkey = resp->v.v0.nkey;
    const void *bytes = resp->v.v0.bytes;
    lcb_size_t nbytes = resp->v.v0.nbytes;

    ASSERT_EQ(LCB_SUCCESS, error);
    if (server_endpoint != NULL) {
        nstatkey = strlen(server_endpoint) + nkey + 2;
        statkey = new char[nstatkey];
        snprintf(statkey, nstatkey, "%s-%.*s", server_endpoint,
                 (int)nkey, (const char *)key);

        lcb_store_cmd_t storecmd(LCB_SET, statkey, nstatkey, bytes, nbytes);
        lcb_store_cmd_t *storecmds[] = { &storecmd };
        err = lcb_store(instance, NULL, 1, storecmds);
        ASSERT_EQ(LCB_SUCCESS, err);
        delete []statkey;
    }
}
}

TEST_F(MockUnitTest, testOpFromCallback)
{
    // @todo we need to have a test that actually tests the timeout callback..
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_set_stat_callback(instance, opFromCallback_statsCB);
    lcb_set_store_callback(instance, opFromCallback_storeCB);

    lcb_server_stats_cmd_t stat;
    lcb_server_stats_cmd_t *commands[] = {&stat };

    ASSERT_EQ(LCB_SUCCESS, lcb_cntl_string(instance, "operation_timeout", "5.0"));
    ASSERT_EQ(LCB_SUCCESS, lcb_server_stats(instance, NULL, 1, commands));
    lcb_wait(instance);
}

struct timeout_test_cookie {
    int *counter;
    lcb_error_t expected;
};
extern "C" {
static void set_callback(lcb_t instance,
                         const void *cookie,
                         lcb_storage_t, lcb_error_t err,
                         const lcb_store_resp_t *)
{
    timeout_test_cookie *tc = (timeout_test_cookie*)cookie;;
    lcb_log(LOGARGS(instance, INFO), "Got code 0x%x. Expected 0x%x", err, tc->expected);
    EXPECT_EQ(tc->expected, err);
    if (err == LCB_ETIMEDOUT) {
        // Remove the hiccup at the first timeout failure
        MockEnvironment::getInstance()->hiccupNodes(0, 0);
    }
    *tc->counter -= 1;
}

struct next_store_st {
    lcb_t instance;
    struct timeout_test_cookie *tc;
    const lcb_store_cmd_t * const * cmdpp;
};

static void reschedule_callback(void *cookie)
{
    lcb_error_t err;
    struct next_store_st *ns = (struct next_store_st *)cookie;
    lcb_log(LOGARGS(ns->instance, INFO), "Rescheduling operation..");
    err = lcb_store(ns->instance, ns->tc, 1, ns->cmdpp);
    lcb_loop_unref(ns->instance);
    EXPECT_EQ(LCB_SUCCESS, err);
}

}

TEST_F(MockUnitTest, testTimeoutOnlyStale)
{
    SKIP_UNLESS_MOCK();

    HandleWrap hw;
    createConnection(hw);
    lcb_t instance = hw.getLcb();
    lcb_uint32_t tmoval = 1000000;
    int nremaining = 2;
    struct timeout_test_cookie cookies[2];
    MockEnvironment *mock = MockEnvironment::getInstance();

    // Set the timeout
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmoval);

    lcb_set_store_callback(instance, set_callback);

    lcb_store_cmd_t scmd, *cmdp;
    const char *key = "i'm a key";
    const char *value = "a value";
    cmdp = &scmd;

    removeKey(instance, key);

    // Make the mock timeout the first cookie. The extras length is:
    mock->hiccupNodes(1500, 1);



    memset(&scmd, 0, sizeof(scmd));
    scmd.v.v0.key = key;
    scmd.v.v0.nkey = strlen(key);
    scmd.v.v0.bytes = value;
    scmd.v.v0.nbytes = strlen(value);
    scmd.v.v0.operation = LCB_SET;
    cookies[0].counter = &nremaining;
    cookies[0].expected = LCB_ETIMEDOUT;
    lcb_store(instance, cookies, 1, &cmdp);

    cookies[1].counter = &nremaining;
    cookies[1].expected = LCB_SUCCESS;
    struct next_store_st ns;
    ns.cmdpp = &cmdp;
    ns.tc = cookies+1;
    ns.instance = instance;
    lcbio_pTIMER timer = lcbio_timer_new(instance->iotable, &ns, reschedule_callback);
    lcb_loop_ref(instance);
    lcbio_timer_rearm(timer, 900000);

    lcb_log(LOGARGS(instance, INFO), "Waiting..");
    lcb_wait(instance);
    lcbio_timer_destroy(timer);

    ASSERT_EQ(0, nremaining);
}


extern "C" {
    struct rvbuf {
        lcb_error_t error;
        lcb_cas_t cas1;
        lcb_cas_t cas2;
        char *bytes;
        lcb_size_t nbytes;
        lcb_int32_t counter;
    };
    int store_cnt;

    /* Needed for "testPurgedBody", to ensure preservation of connection */
    static void io_close_wrap(lcb_io_opt_t, lcb_socket_t)
    {
        fprintf(stderr, "We requested to close, but we were't expecting it\n");
        abort();
    }

    static void store_callback(lcb_t instance, const void *cookie,
                               lcb_storage_t, lcb_error_t error,
                               const lcb_store_resp_t *)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        lcb_log(LOGARGS(instance, INFO),
                "Got storage callback for cookie %p with err=0x%x",
                (void *)cookie,
                (int)error);

        rv->error = error;
        store_cnt++;
        if (!instance->wait) { /* do not touch IO if we are using lcb_wait() */
            lcb_stop_loop(instance);
        }
    }

    static void get_callback(lcb_t instance, const void *cookie,
                             lcb_error_t error, const lcb_get_resp_t *resp)
    {
        struct rvbuf *rv = (struct rvbuf *)cookie;
        rv->error = error;
        rv->bytes = (char *)malloc(resp->v.v0.nbytes);
        memcpy((void *)rv->bytes, resp->v.v0.bytes, resp->v.v0.nbytes);
        rv->nbytes = resp->v.v0.nbytes;
        if (!instance->wait) { /* do not touch IO if we are using lcb_wait() */
            lcb_stop_loop(instance);
        }
    }
}

struct StoreContext {
    std::map<std::string, lcb_error_t> mm;
    typedef std::map<std::string, lcb_error_t>::iterator MyIter;

    void check(int expected) {
        EXPECT_EQ(expected, mm.size());

        for (MyIter iter = mm.begin(); iter != mm.end(); iter++) {
            EXPECT_EQ(LCB_SUCCESS, iter->second);
        }
    }

    void clear() {
        mm.clear();
    }
};

extern "C" {
static void ctx_store_callback(lcb_t, const void *cookie, lcb_storage_t,
                                  lcb_error_t err, const lcb_store_resp_t *resp)
{
    StoreContext *ctx = reinterpret_cast<StoreContext *>(
            const_cast<void *>(cookie));

    std::string s((const char *)resp->v.v0.key, resp->v.v0.nkey);
    ctx->mm[s] = err;
}
}

TEST_F(MockUnitTest, testReconfigurationOnNodeFailover)
{
    SKIP_UNLESS_MOCK();
    lcb_t instance;
    HandleWrap hw;
    lcb_error_t err;
    const char *argv[] = { "--replicas", "0", "--nodes", "4", NULL };

    MockEnvironment mock_o(argv), *mock = &mock_o;

    std::vector<std::string> keys;
    std::vector<lcb_store_cmd_t> cmds;
    std::vector<lcb_store_cmd_t *>ppcmds;

    mock->createConnection(hw, instance);
    instance->settings->vb_noguess = 1;
    lcb_connect(instance);
    lcb_wait(instance);
    ASSERT_EQ(0, lcb_get_num_replicas(instance));

    size_t numNodes = mock->getNumNodes();

    genDistKeys(LCBT_VBCONFIG(instance), keys);
    genStoreCommands(keys, cmds, ppcmds);
    StoreContext ctx;

    mock->failoverNode(0);
    SYNC_WITH_NODECOUNT(instance, numNodes-1);

    lcb_set_store_callback(instance, ctx_store_callback);
    err = lcb_store(instance, &ctx, cmds.size(), &ppcmds[0]);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ctx.check((int)cmds.size());

    mock->respawnNode(0);
    SYNC_WITH_NODECOUNT(instance, numNodes);

    ctx.clear();
    err = lcb_store(instance, &ctx, cmds.size(), &ppcmds[0]);
    lcb_wait(instance);
    ctx.check((int)cmds.size());
}



struct fo_context_st {
    MockEnvironment *env;
    int index;
    lcb_t instance;
};
// Hiccup the server, then fail it over.
extern "C" {
static void fo_callback(void *cookie)
{
    fo_context_st *ctx = (fo_context_st *)cookie;
    ctx->env->failoverNode(ctx->index);
    ctx->env->hiccupNodes(0, 0);
    lcb_loop_unref(ctx->instance);
}
}

TEST_F(MockUnitTest, testBufferRelocationOnNodeFailover)
{
    SKIP_UNLESS_MOCK();
    lcb_error_t err;
    struct rvbuf rv;
    lcb_t instance;
    HandleWrap hw;
    std::string key = "testBufferRelocationOnNodeFailover";
    std::string val = "foo";

    const char *argv[] = { "--replicas", "0", "--nodes", "4", NULL };
    MockEnvironment mock_o(argv), *mock = &mock_o;

    // We need to disable CCCP for this test to receive "Push" style
    // configuration.
    mock->setCCCP(false);

    mock->createConnection(hw, instance);
    lcb_connect(instance);
    lcb_wait(instance);

    // Set the timeout for 15 seconds
    lcb_uint32_t tmoval = 15000000;
    lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_OP_TIMEOUT, &tmoval);

    lcb_set_store_callback(instance, store_callback);
    lcb_set_get_callback(instance, get_callback);

    // Initialize the nodes first..
    removeKey(instance, key);

    /* Schedule SET operation */
    lcb_store_cmd_t storecmd(LCB_SET, key.c_str(), key.size(),
                             val.c_str(), val.size());

    /* Determine what server should receive that operation */
    int vb, idx;
    lcbvb_map_key(LCBT_VBCONFIG(instance), key.c_str(), key.size(), &vb, &idx);
    mock->hiccupNodes(5000, 1);

    struct fo_context_st ctx = { mock, idx, instance };
    lcbio_pTIMER timer;
    timer = lcbio_timer_new(instance->iotable, &ctx, fo_callback);
    lcb_loop_ref(instance);
    lcbio_timer_rearm(timer, 500000);

    lcb_store_cmd_t *storecmds[] = { &storecmd };
    err = lcb_store(instance, &rv, 1, storecmds);
    ASSERT_EQ(LCB_SUCCESS, err);

    store_cnt = 0;
    lcb_wait(instance);
    ASSERT_EQ(1, store_cnt);
    ASSERT_EQ(LCB_SUCCESS, rv.error);

    memset(&rv, 0, sizeof(rv));
    err = lcb_store(instance, &rv, 1, storecmds);
    ASSERT_EQ(LCB_SUCCESS, err);
    store_cnt = 0;
    lcb_wait(instance);
    ASSERT_EQ(1, store_cnt);

    /* Check that value was actually set */
    lcb_get_cmd_t getcmd(key.c_str(), key.size());
    lcb_get_cmd_t *getcmds[] = { &getcmd };
    err = lcb_get(instance, &rv, 1, getcmds);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_wait(instance);
    lcbio_timer_destroy(timer);
    ASSERT_EQ(LCB_SUCCESS, rv.error);
    ASSERT_EQ(rv.nbytes, val.size());
    std::string bytes = std::string(rv.bytes, rv.nbytes);
    ASSERT_STREQ(bytes.c_str(), val.c_str());
    free(rv.bytes);
}

TEST_F(MockUnitTest, testSaslMechs)
{
    // Ensure our SASL mech listing works.
    SKIP_UNLESS_MOCK();

    const char *argv[] = { "--buckets", "protected:secret:couchbase", NULL };

    lcb_t instance;
    lcb_error_t err;
    struct lcb_create_st crParams;
    MockEnvironment mock_o(argv, "protected"), *protectedEnv = &mock_o;
    protectedEnv->makeConnectParams(crParams, NULL);
    protectedEnv->setCCCP(false);

    crParams.v.v0.user = "protected";
    crParams.v.v0.passwd = "secret";
    crParams.v.v0.bucket = "protected";
    doLcbCreate(&instance, &crParams, protectedEnv);

    // Make the socket pool disallow idle connections
    instance->memd_sockpool->get_options().maxidle = 0;

    err = lcb_connect(instance);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);

    // Force our SASL mech
    err = lcb_cntl(instance, LCB_CNTL_SET,
                   LCB_CNTL_FORCE_SASL_MECH, (void *)"blah");
    ASSERT_EQ(LCB_SUCCESS, err);

    Item itm("key", "value");
    KVOperation kvo(&itm);

    kvo.allowableErrors.insert(LCB_SASLMECH_UNAVAILABLE);
    kvo.allowableErrors.insert(LCB_ETIMEDOUT);
    kvo.store(instance);

    ASSERT_FALSE(kvo.globalErrors.find(LCB_SASLMECH_UNAVAILABLE) ==
              kvo.globalErrors.end());

    err = lcb_cntl(instance, LCB_CNTL_SET,
                   LCB_CNTL_FORCE_SASL_MECH, (void *)"PLAIN");
    ASSERT_EQ(LCB_SUCCESS, err);

    kvo.clear();
    kvo.store(instance);

    lcb_destroy(instance);
}

extern "C" {
static const char *get_username(void *cookie, const char *host, const char *port, const char *bucket)
{
    return bucket;
}

static const char *get_password(void *cookie, const char *host, const char *port, const char *bucket)
{
    std::map< std::string, std::string > *credentials = static_cast< std::map< std::string, std::string > * >(cookie);
    return (*credentials)[bucket].c_str();
}
}

TEST_F(MockUnitTest, testDynamicAuth)
{
    SKIP_UNLESS_MOCK();

    const char *argv[] = {"--buckets", "protected:secret:couchbase", NULL};

    lcb_t instance;
    lcb_error_t err;
    struct lcb_create_st crParams;
    MockEnvironment mock_o(argv, "protected"), *mock = &mock_o;
    mock->makeConnectParams(crParams, NULL);
    mock->setCCCP(false);

    crParams.v.v0.bucket = "protected";
    doLcbCreate(&instance, &crParams, mock);

    std::map< std::string, std::string > credentials;
    credentials["protected"] = "secret";
    lcb_AUTHENTICATOR *auth = lcbauth_new();
    lcbauth_set_callbacks(auth, &credentials, get_username, get_password);
    lcbauth_set_mode(auth, LCBAUTH_MODE_DYNAMIC);
    lcb_set_auth(instance, auth);

    err = lcb_connect(instance);
    ASSERT_EQ(LCB_SUCCESS, err);
    ASSERT_EQ(LCB_SUCCESS, lcb_wait(instance));

    Item itm("key", "value");
    KVOperation kvo(&itm);
    kvo.store(instance);
    lcb_destroy(instance);
    lcbauth_unref(auth);
}

static void
doManyItems(lcb_t instance, std::vector<std::string> keys)
{
    lcb_CMDSTORE cmd = { 0 };
    cmd.operation = LCB_SET;
    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ii++) {
        LCB_CMD_SET_KEY(&cmd, keys[ii].c_str(), keys[ii].size());
        LCB_CMD_SET_VALUE(&cmd, keys[ii].c_str(), keys[ii].size());
        EXPECT_EQ(LCB_SUCCESS, lcb_store3(instance, NULL, &cmd));
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

extern "C" {
static void mcdFoVerifyCb(lcb_t, int, const lcb_RESPBASE *rb)
{
    EXPECT_EQ(LCB_SUCCESS, rb->rc);
}
}

TEST_F(MockUnitTest, DISABLED_testMemcachedFailover)
{
    SKIP_UNLESS_MOCK();
    const char *argv[] = { "--buckets", "cache::memcache", NULL };
    lcb_t instance;
    struct lcb_create_st crParams;
    lcb_RESPCALLBACK oldCb;

    MockEnvironment mock_o(argv, "cache"), *mock = &mock_o;
    mock->makeConnectParams(crParams, NULL);
    doLcbCreate(&instance, &crParams, mock);

    // Check internal setting here
    lcb_connect(instance);
    lcb_wait(instance);
    size_t numNodes = mock->getNumNodes();

    oldCb = lcb_install_callback3(instance, LCB_CALLBACK_STORE, mcdFoVerifyCb);

    // Get the command list:
    std::vector<std::string> distKeys;
    genDistKeys(LCBT_VBCONFIG(instance), distKeys);
    doManyItems(instance, distKeys);
    // Should succeed implicitly with callback above

    // Fail over the first node..
    mock->failoverNode(1, "cache");
    SYNC_WITH_NODECOUNT(instance, numNodes-1);

    // Set the callback to the previous one. We expect failures here
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, oldCb);
    doManyItems(instance, distKeys);

    mock->respawnNode(1, "cache");
    SYNC_WITH_NODECOUNT(instance, numNodes);
    ASSERT_EQ(numNodes, lcb_get_num_nodes(instance));

    // Restore the verify callback
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, mcdFoVerifyCb);
    doManyItems(instance, distKeys);

    lcb_destroy(instance);
}

struct NegativeIx {
    lcb_error_t err;
    int callCount;
};

extern "C" {
static void get_callback3(lcb_t, int, const lcb_RESPBASE *resp)
{
    NegativeIx *ni = (NegativeIx *)resp->cookie;
    ni->err = resp->rc;
    ni->callCount++;
}
}
/**
 * This tests the case where a negative index appears for a vbucket ID for the
 * mapped key. In this case we'd expect that the command would be retried
 * at least once, and not receive an LCB_NO_MATCHING_SERVER.
 *
 * Unfortunately this test is a bit hacky since we need to modify the vbucket
 * information, and hopefully get a new config afterwards. Additionally we'd
 * want to mod
 */
TEST_F(MockUnitTest, testNegativeIndex)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_GET, get_callback3);
    std::string key("ni_key");
    // Get the config
    lcbvb_CONFIG *vbc = instance->cur_configinfo->vbc;
    int vb = lcbvb_k2vb(vbc, key.c_str(), key.size());

    // Set the index to -1
    vbc->vbuckets[vb].servers[0] = -1;
    NegativeIx ni = { LCB_SUCCESS };
    lcb_CMDGET gcmd = { 0 };
    LCB_CMD_SET_KEY(&gcmd, key.c_str(), key.size());
    // Set the timeout to something a bit shorter
    lcb_cntl_setu32(instance, LCB_CNTL_OP_TIMEOUT, 500000);

    lcb_sched_enter(instance);
    lcb_error_t err = lcb_get3(instance, &ni, &gcmd);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_sched_leave(instance);
    lcb_wait(instance);
    ASSERT_EQ(1, ni.callCount);
    // That's it
}
