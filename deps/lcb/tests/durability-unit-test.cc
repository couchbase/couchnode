#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include "server.h"
#include "mock-unit-test.h"
#include "mock-environment.h"
#include "testutil.h"
#include <map>

using namespace std;

#define SECS_USECS(f) ((f) * 1000000)

class DurabilityUnitTest : public MockUnitTest
{
protected:
    static void SetUpTestCase() {
        MockUnitTest::SetUpTestCase();
    }

    static void defaultOptions(lcb_t instance, lcb_durability_opts_st &opts) {
        lcb_size_t nservers = lcb_get_num_nodes(instance);
        lcb_size_t nreplicas = lcb_get_num_replicas(instance);

        opts.v.v0.persist_to = min(nreplicas + 1, nservers);
        opts.v.v0.replicate_to = min(nreplicas, nservers - 1);
    }
};

extern "C" {
    static void defaultDurabilityCallback(lcb_t, const void *, lcb_error_t,
                                          const lcb_durability_resp_t *);

    static void multiDurabilityCallback(lcb_t, const void *, lcb_error_t,
                                        const lcb_durability_resp_t *);
}

class DurabilityOperation
{
public:
    DurabilityOperation() {
    }

    string key;
    lcb_durability_resp_st resp;
    lcb_durability_cmd_st req;

    void assign(const lcb_durability_resp_st *resp) {
        this->resp = *resp;
        key.assign((const char *)resp->v.v0.key, resp->v.v0.nkey);
        this->resp.v.v0.key = NULL;
    }

    void wait(lcb_t instance) {
        lcb_set_durability_callback(instance, defaultDurabilityCallback);
        EXPECT_EQ(LCB_SUCCESS, lcb_wait(instance));
    }

    void wait(lcb_t instance,
              const lcb_durability_opts_t *opts,
              const lcb_durability_cmd_t *cmdp) {
        EXPECT_EQ(LCB_SUCCESS,
                  lcb_durability_poll(instance, this, opts, 1, &cmdp));
        wait(instance);
    }

    void run(lcb_t instance,
             const lcb_durability_opts_t *opts,
             const Item &itm) {

        lcb_durability_cmd_t cmd = { 0 };

        ASSERT_FALSE(itm.key.empty());

        cmd.v.v0.key = itm.key.data();
        cmd.v.v0.nkey = itm.key.length();
        cmd.v.v0.cas = itm.cas;

        wait(instance, opts, &cmd);
    }

    void assertCriteriaMatch(const lcb_durability_opts_st &opts) {
        ASSERT_EQ(LCB_SUCCESS, resp.v.v0.err);
        ASSERT_TRUE(resp.v.v0.persisted_master);
        ASSERT_TRUE(opts.v.v0.persist_to <= resp.v.v0.npersisted);
        ASSERT_TRUE(opts.v.v0.replicate_to <= resp.v.v0.nreplicated);
    }

    void dump(std::string &str) {
        if (key.empty()) {
            str = "<No Key>\n";
            return;
        }
        std::stringstream ss;
        ss << "Key: " << key << std::endl
           << "Error: " << resp.v.v0.err << std::endl
           << "Persisted (master?): " << resp.v.v0.npersisted
           << " (" << resp.v.v0.persisted_master << ")" << std::endl
           << "Replicated: " << resp.v.v0.nreplicated << std::endl
           << "CAS: 0x" << std::hex << resp.v.v0.cas << std::endl;
        str += ss.str();
    }

    void dump() {
        string s;
        dump(s);
        cout << s;
    }
};

class DurabilityMultiOperation
{
public:

    DurabilityMultiOperation() : counter(0) {
    }

    template <typename T>
    void run(lcb_t instance, const lcb_durability_opts_t *opts, const T &items) {
        std::vector<lcb_durability_cmd_t> cmds;
        std::vector<const lcb_durability_cmd_t *> cmds_p;

        counter = 0;
        unsigned ii = 0;
        typename T::const_iterator iter = items.begin();

        for (; iter != items.end(); iter++, ii++) {

            lcb_durability_cmd_t cmd;
            memset(&cmd, 0, sizeof(cmd));
            const Item &itm = *iter;

            cmd.v.v0.cas = itm.cas;
            cmd.v.v0.key = itm.key.c_str();
            cmd.v.v0.nkey = itm.key.length();
            cmds.push_back(cmd);
            kmap[itm.key] = DurabilityOperation();
        }

        for (ii = 0; ii < cmds.size(); ii++) {
            cmds_p.push_back(&cmds[ii]);
        }



        lcb_set_durability_callback(instance, multiDurabilityCallback);

        lcb_error_t err = lcb_durability_poll(instance,
                                              this, opts,
                                              items.size(),
                                              (const lcb_durability_cmd_t * const *)&cmds_p[0]);
        ASSERT_EQ(LCB_SUCCESS, err);
        ASSERT_EQ(LCB_SUCCESS, lcb_wait(instance));
        ASSERT_EQ(items.size(), counter);
    }

    void assign(const lcb_durability_resp_t *resp) {
        ASSERT_GT(resp->v.v0.nkey, 0);
        counter++;

        string key;
        key.assign((const char *)resp->v.v0.key, resp->v.v0.nkey);
        ASSERT_TRUE(kmap.find(key) != kmap.end());
        kmap[key].assign(resp);
    }

    template <typename T>
    bool _findItem(const string &s, const T &items, Item &itm) {
        for (typename T::const_iterator iter = items.begin();
                iter != items.end(); iter++) {
            if (iter->key.compare(s) == 0) {
                itm = *iter;
                return true;
            }
        }
        return false;
    }

    template <typename T>
    void assertAllMatch(const lcb_durability_opts_t &opts,
                        const T &items_ok,
                        const T &items_missing,
                        lcb_error_t missing_err = LCB_KEY_ENOENT) {

        for (map<string, DurabilityOperation>::iterator iter = kmap.begin();
                iter != kmap.end();
                iter++) {

            Item itm_tmp;
            // make sure we were expecting it
            if (_findItem(iter->second.key, items_ok, itm_tmp)) {
                iter->second.assertCriteriaMatch(opts);

            } else if (_findItem(iter->second.key, items_missing, itm_tmp)) {
                ASSERT_EQ(missing_err, iter->second.resp.v.v0.err);

            } else {
                ASSERT_STREQ("",
                             "Key not in missing or OK list");
            }
        }

        // Finally, make sure they're all there

        for (typename T::const_iterator iter = items_ok.begin();
                iter != items_ok.end();
                iter++) {
            ASSERT_TRUE(kmap.find(iter->key) != kmap.end());
        }

        for (typename T::const_iterator iter = items_missing.begin();
                iter != items_missing.end(); iter++) {
            ASSERT_TRUE(kmap.find(iter->key) != kmap.end());
        }
    }

    unsigned counter;
    map<string, DurabilityOperation> kmap;
};

extern "C" {

    static void defaultDurabilityCallback(lcb_t,
                                          const void *cookie,
                                          lcb_error_t,
                                          const lcb_durability_resp_t *resp)
    {
        ((DurabilityOperation *)cookie)->assign(resp);
    }

    static void multiDurabilityCallback(lcb_t,
                                        const void *cookie,
                                        lcb_error_t,
                                        const lcb_durability_resp_t *resp)
    {
        ((DurabilityMultiOperation *)cookie)->assign(resp);
    }

}

TEST_F(DurabilityUnitTest, testInvalidCriteria)
{
    /**
     * We don't schedule stuff to the network here
     */
    HandleWrap hwrap;
    createConnection(hwrap);

    lcb_t instance = hwrap.getLcb();

    lcb_durability_opts_t opts = { 0 };
    lcb_durability_cmd_t cmd = { 0 }, *cmd_p = &cmd;
    lcb_error_t err;

    defaultOptions(instance, opts);

    err = lcb_durability_poll(instance, NULL, &opts, 0, &cmd_p);
    ASSERT_EQ(LCB_EINVAL, err);

    opts.v.v0.persist_to = 10;
    opts.v.v0.replicate_to = 100;
    opts.v.v0.cap_max = 0;

    err = lcb_durability_poll(instance, NULL, &opts, 1, &cmd_p);
    ASSERT_EQ(err, LCB_DURABILITY_ETOOMANY);
}

/**
 * Test various criteria for durability
 */
TEST_F(DurabilityUnitTest, testDurabilityCriteria)
{
    HandleWrap hwrap;
    lcb_t instance;

    createConnection(hwrap);
    instance = hwrap.getLcb();

    lcb_durability_opts_st opts = { 0 };
    lcb_durability_cmd_st cmd = { 0 };
    lcb_durability_cmd_st *cmd_p = &cmd;
    lcb_error_t err;

    /** test with no persist/replicate */
    defaultOptions(instance, opts);

    opts.v.v0.replicate_to = 0;
    opts.v.v0.persist_to = 0;
}

/**
 * @test Test several 'basic' durability functions
 *
 * @pre Store a key. Perform a durability check with master-only persistence
 * (i.e. persist_to = 1, replicate_to = 0)
 * @post Operation succeeds
 *
 * @pre Check the key against 'maximum possible' durability by estimating the
 * maximum replica/server count
 *
 * @post Operation succeeds
 *
 * @pre Set the durability options to a very large criteria, but set the
 * @c cap_max flag so the API will reduce it to a sane default. Then use it
 * for a durability check
 *
 * @post the response is successful
 */
TEST_F(DurabilityUnitTest, testSimpleDurability)
{
    /** need real cluster for durability tests */
    LCB_TEST_REQUIRE_FEATURE("observe");
    SKIP_UNLESS_MOCK();

    HandleWrap hwrap;
    lcb_t instance;

    Item kv = Item("a_key", "a_value", 0);
    createConnection(hwrap);
    instance = hwrap.getLcb();

    removeKey(instance, kv.key);

    KVOperation kvo = KVOperation(&kv);
    kvo.store(instance);

    // Now wait for it to persist
    lcb_durability_opts_t opts;
    memset(&opts, 0, sizeof(opts));
    opts.v.v0.persist_to = 1;
    opts.v.v0.replicate_to = 0;

    kvo = KVOperation(&kv);
    kvo.get(instance);

    DurabilityOperation dop;
    dop.run(instance, &opts, kvo.result);

    dop.assertCriteriaMatch(opts);
    ASSERT_STREQ(kv.key.c_str(), dop.key.c_str());


    // Try with more expanded criteria
    defaultOptions(instance, opts);
    dop = DurabilityOperation();
    dop.run(instance, &opts, kvo.result);
    dop.assertCriteriaMatch(opts);

    // Make the options to some absurd number. Ensure it's capped!
    opts.v.v0.persist_to = 100;
    opts.v.v0.replicate_to = 100;
    opts.v.v0.cap_max = 1;

    dop = DurabilityOperation();
    dop.run(instance, &opts, kvo.result);
    defaultOptions(instance, opts);
    dop.assertCriteriaMatch(opts);
}

/**
 * @test Durability checks against non-existent keys
 * @pre Remove a key, and perform a durability check against it
 * @post Operation fails with @c LCB_KEY_ENOENT
 */
TEST_F(DurabilityUnitTest, testNonExist)
{
    LCB_TEST_REQUIRE_FEATURE("observe");
    SKIP_UNLESS_MOCK();

    lcb_t instance;
    HandleWrap hwrap;

    string key = "non-exist-key";

    createConnection(hwrap);
    instance = hwrap.getLcb();

    removeKey(instance, key);

    Item itm = Item(key, "", 0);

    DurabilityOperation dop;
    lcb_durability_opts_t opts = { 0 };
    opts.v.v0.timeout = SECS_USECS(2);

    defaultOptions(instance, opts);
    dop.run(instance, &opts, itm);
    ASSERT_EQ(LCB_KEY_ENOENT, dop.resp.v.v0.err);
}

/**
 * @test Test negative durability (Delete)
 *
 * @pre Store a key, Remove it, perform a durability check against the key,
 * using the @c check_delete flag
 *
 * @post A positive reply is received indicating the item has been deleted
 *
 * @pre Store the key, but don't remove it. Perform a durability check against
 * the key using the delete flag
 *
 * @post Operation is returned with @c LCB_ETIMEDOUT
 */
TEST_F(DurabilityUnitTest, testDelete)
{
    LCB_TEST_REQUIRE_FEATURE("observe");
    SKIP_UNLESS_MOCK();

    HandleWrap hwrap;
    lcb_t instance;
    lcb_durability_opts_t opts = { 0 };
    string key = "deleted-key";
    createConnection(hwrap);
    instance = hwrap.getLcb();

    storeKey(instance, key, "value");

    Item itm = Item(key, "value", 0);

    KVOperation kvo = KVOperation(&itm);
    DurabilityOperation dop;

    kvo.remove(instance);

    // Ensure the key is actually purged!
    MockMutationCommand mcmd(MockCommand::PURGE, key);
    mcmd.onMaster = true;
    mcmd.replicaCount = lcb_get_num_replicas(instance);
    doMockTxn(mcmd);

    defaultOptions(instance, opts);
    opts.v.v0.check_delete = 1;
    dop.run(instance, &opts, itm);
    dop.assertCriteriaMatch(opts);

    kvo.clear();
    kvo.request = &itm;
    kvo.store(instance);

    opts.v.v0.timeout = SECS_USECS(1);
    dop = DurabilityOperation();
    dop.run(instance, &opts, itm);
    ASSERT_EQ(LCB_ETIMEDOUT, dop.resp.v.v0.err);
}

/**
 * @test Test behavior when a key is modified (exists with a different CAS)
 *
 * @pre Store a key. Store it again. Keep the CAS from the first store as the
 * stale CAS. Keep the current CAS as well.
 *
 * @pre Perform a durability check against the stale CAS
 * @post Operation fails with @c LCB_KEY_EEXISTS
 *
 * @pre Perform a durability check against the new CAS
 * @post Operation succeeds
 */
TEST_F(DurabilityUnitTest, testModified)
{
    LCB_TEST_REQUIRE_FEATURE("observe");

    HandleWrap hwrap;
    lcb_t instance;
    lcb_durability_opts_t opts = { 0 };
    string key = "mutated-key";
    Item itm = Item(key, key);
    KVOperation kvo_cur(&itm), kvo_stale(&itm);

    createConnection(hwrap);
    instance = hwrap.getLcb();

    kvo_stale.store(instance);
    kvo_cur.store(instance);

    kvo_stale.result.val = kvo_cur.result.val = key;

    defaultOptions(instance, opts);
    DurabilityOperation dop;
    dop.run(instance, &opts, kvo_stale.result);
    ASSERT_EQ(LCB_KEY_EEXISTS, dop.resp.v.v0.err);
}

/**
 * @test Test with very quick timeouts
 * @pre Schedule an operation with an interval of 2 usec and a timeout of
 * 5 usec
 *
 * @post Operation returns with LCB_ETIMEDOUT
 */
TEST_F(DurabilityUnitTest, testQuickTimeout)
{
    LCB_TEST_REQUIRE_FEATURE("observe");
    lcb_t instance;
    HandleWrap hwrap;
    lcb_durability_opts_t opts = { 0 };
    string key = "a_key";

    createConnection(hwrap);
    instance = hwrap.getLcb();

    Item itm = Item(key, key);
    KVOperation(&itm).store(instance);

    defaultOptions(instance, opts);

    /* absurd */
    opts.v.v0.timeout = 5;
    opts.v.v0.interval = 2;

    for (unsigned ii = 0; ii < 10; ii++) {
        DurabilityOperation dop;
        dop.run(instance, &opts, itm);
        ASSERT_EQ(LCB_ETIMEDOUT, dop.resp.v.v0.err);
    }
}

/**
 * @test Test a durability request for multiple keys
 *
 * @pre Store ten keys, and check that they exist all at once
 * @post all ten keys are received in the response, and they're ok
 *
 * @pre Check that ten missing keys exist all at once
 * @post all ten keys are received in the response, and they have an error
 *
 * @pre Check the ten stored and ten missing keys in a single operation
 * @post The ten missing keys are present and have a negative status, the ten
 * stored keys are present and are OK
 */
TEST_F(DurabilityUnitTest, testMulti)
{
    LCB_TEST_REQUIRE_FEATURE("observe");
    unsigned ii;
    const unsigned limit = 10;

    vector<Item> items_stored;
    vector<Item> items_missing;

    lcb_durability_opts_t opts = { 0 };
    HandleWrap hwrap;
    lcb_t instance;

    createConnection(hwrap);
    instance = hwrap.getLcb();

    for (ii = 0; ii < limit; ii++) {
        char buf[64];
        sprintf(buf, "key-stored-%u", ii);
        string key_stored = buf;
        sprintf(buf, "key-missing-%u", ii);
        string key_missing = buf;

        removeKey(instance, key_stored);
        removeKey(instance, key_missing);

        Item itm_e = Item(key_stored, key_stored, 0);
        Item itm_m = Item(key_missing, key_missing, 0);

        KVOperation kvo(&itm_e);
        kvo.store(instance);
        items_stored.push_back(kvo.result);
        items_missing.push_back(itm_m);
    }

    defaultOptions(instance, opts);

    /**
     * Create the command..
     */
    DurabilityMultiOperation dmop = DurabilityMultiOperation();
    dmop.run(instance, &opts, items_stored);
    dmop.assertAllMatch(opts, items_stored, vector<Item>());

    // Store all the missing ones
    opts.v.v0.timeout = SECS_USECS(1.5);
    dmop = DurabilityMultiOperation();
    dmop.run(instance, &opts, items_missing);
    dmop.assertAllMatch(opts, vector<Item>(), items_missing, LCB_KEY_ENOENT);

    // Store them all together
    opts.v.v0.timeout = 0;
    vector<Item> combined;
    combined.insert(combined.end(), items_stored.begin(), items_stored.end());
    combined.insert(combined.end(), items_missing.begin(), items_missing.end());
    dmop.run(instance, &opts, combined);
    dmop.assertAllMatch(opts, items_stored, items_missing);
}

struct cb_cookie {
    int is_observe;
    int count;
};

extern "C" {
    static void dummyObserveCallback(lcb_t, const void *cookie,
                                     lcb_error_t,
                                     const lcb_observe_resp_t *)
    {
        struct cb_cookie *c = (struct cb_cookie *)cookie;
        ASSERT_EQ(1, c->is_observe);
        c->count++;
    }

    static void dummyDurabilityCallback(lcb_t, const void *cookie,
                                        lcb_error_t,
                                        const lcb_durability_resp_t *)
    {
        struct cb_cookie *c = (struct cb_cookie *)cookie;
        ASSERT_EQ(0, c->is_observe);
        c->count++;
    }
}

/**
 * @test Ensure basic observe functions as normal
 *
 * @pre pair up two batched commands, one a durability command, and one a
 * primitive observe. Set up distinct callbacks for the two (both of which
 * touch a counter, one incrementing and one decrementing an int*).
 * Wait for the operations to complete via @c lcb_wait
 *
 * @post The durability counter is decremented, observe counter incremented
 */
TEST_F(DurabilityUnitTest, testObserveSanity)
{
    LCB_TEST_REQUIRE_FEATURE("observe");
    HandleWrap handle;
    lcb_t instance;
    createConnection(handle);
    instance = handle.getLcb();
    lcb_error_t err;


    lcb_set_durability_callback(instance, dummyDurabilityCallback);
    lcb_set_observe_callback(instance, dummyObserveCallback);

    lcb_durability_opts_t opts = { 0 };

    lcb_observe_cmd_t ocmd, *ocmds[] = { &ocmd };
    lcb_durability_cmd_t dcmd, *dcmds[] = { &dcmd };

    memset(&ocmd, 0, sizeof(ocmd));
    memset(&dcmd, 0, sizeof(dcmd));

    ocmd.v.v0.key = "key";
    ocmd.v.v0.nkey = 3;

    dcmd.v.v0.key = "key";
    dcmd.v.v0.nkey = 3;

    storeKey(instance, "key", "value");

    defaultOptions(instance, opts);

    struct cb_cookie o_cookie = { 1, 0 };
    struct cb_cookie d_cookie = { 0, 0 };

    err = lcb_observe(instance, &o_cookie, 1, ocmds);
    ASSERT_EQ(LCB_SUCCESS, err);

    err = lcb_durability_poll(instance, &d_cookie, &opts, 1, dcmds);
    ASSERT_EQ(LCB_SUCCESS, err);

    ASSERT_EQ(LCB_SUCCESS, lcb_wait(instance));

    ASSERT_GT(o_cookie.count, 0);
    ASSERT_GT(d_cookie.count, 0);
}
