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
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include <map>

#include "server.h"
#include "mock-unit-test.h"
#include "testutil.h"

class GetUnitTest : public MockUnitTest
{
protected:
    static void SetUpTestCase() {
        MockUnitTest::SetUpTestCase();
    }
};

extern "C" {
    static void testGetMissGetCallback(lcb_t, const void *cookie,
                                       lcb_error_t error,
                                       const lcb_get_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_KEY_ENOENT, error);
        ASSERT_NE((const lcb_get_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        std::string val((const char *)resp->v.v0.key, resp->v.v0.nkey);
        EXPECT_TRUE(val == "testGetMiss1" || val == "testGetMiss2");
        ++(*counter);
    }
}

/**
 * @test
 * Get Miss
 *
 * @pre
 * Request two non-existent keys
 *
 * @post
 * Responses for both keys are received with error code
 * @c KEY_ENOENT; response structure is not NULL, and the keys match their
 * expected value
 *
 * @todo (maybe check the values too?)
 */
TEST_F(GetUnitTest, testGetMiss)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_get_callback(instance, testGetMissGetCallback);
    int numcallbacks = 0;

    removeKey(instance, "testGetMiss1");
    removeKey(instance, "testGetMiss2");

    lcb_get_cmd_t cmd1("testGetMiss1");
    lcb_get_cmd_t cmd2("testGetMiss2");
    lcb_get_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, 2, cmds));

    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
    static void testGetHitGetCallback(lcb_t, const void *cookie,
                                      lcb_error_t error,
                                      const lcb_get_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_SUCCESS, error);
        ASSERT_NE((const lcb_get_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test
 * Get Hit
 *
 * @pre
 * Store two keys, and retrieve them
 *
 * @post
 * Both keys exist, and their return code is successul
 */
TEST_F(GetUnitTest, testGetHit)
{
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_get_callback(instance, testGetHitGetCallback);
    int numcallbacks = 0;

    storeKey(instance, "testGetKey1", "foo");
    storeKey(instance, "testGetKey2", "foo");
    lcb_get_cmd_t cmd1("testGetKey1");
    lcb_get_cmd_t cmd2("testGetKey2");
    lcb_get_cmd_t *cmds[] = { &cmd1, &cmd2 };
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, &numcallbacks, 2, cmds));

    lcb_wait(instance);
    EXPECT_EQ(2, numcallbacks);
}

extern "C" {
    static void testTouchMissCallback(lcb_t, const void *cookie,
                                      lcb_error_t error,
                                      const lcb_touch_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_KEY_ENOENT, error);
        ASSERT_NE((const lcb_touch_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Touch (Miss)
 * @pre Schedule a touch for a non existent key with an expiry @c 666
 * @post Touch fails with @c KEY_ENOENT
 */
TEST_F(GetUnitTest, testTouchMiss)
{
    std::string key("testTouchMissKey");
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_touch_callback(instance, testTouchMissCallback);
    removeKey(instance, key);

    int numcallbacks = 0;
    lcb_touch_cmd_t cmd(key.data(), key.length(), 666);
    lcb_touch_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_touch(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
    static void testTouchHitCallback(lcb_t, const void *cookie,
                                     lcb_error_t error,
                                     const lcb_touch_resp_t *resp)
    {
        int *counter = (int *)cookie;
        EXPECT_EQ(LCB_SUCCESS, error);
        ASSERT_NE((const lcb_touch_resp_t *)NULL, resp);
        EXPECT_EQ(0, resp->version);
        ++(*counter);
    }
}

/**
 * @test Touch (Hit)
 * @pre Store a key, and schedule a touch operation with an expiry of @c 666
 * @post Touch succeeds.
 */
TEST_F(GetUnitTest, testTouchHit)
{
    std::string key("testTouchHitKey");
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);

    (void)lcb_set_touch_callback(instance, testTouchHitCallback);
    storeKey(instance, key, "foo");

    int numcallbacks = 0;
    lcb_touch_cmd_t cmd(key.data(), key.length(), 666);
    lcb_touch_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_touch(instance, &numcallbacks, 1, cmds));
    lcb_wait(instance);
    EXPECT_EQ(1, numcallbacks);
}

extern "C" {
    static void testMixedMultiGetCallback(lcb_t, const void *cookie,
                                          lcb_error_t error,
                                          const lcb_get_resp_t *resp)
    {
        using namespace std;
        map<string, Item> *kmap = (map<string, Item> *)cookie;

        Item itm;
        itm.assign(resp, error);

        (*kmap)[itm.key] = itm;
    }
}

/**
 * Adopted from smoke-test.c:test_get2
 *
 * @test Multi Get (Interleaved)
 *
 * @pre
 * Create two maps of 26 key-value pairs, one called @c kexisting and one
 * called @c kmissing. Store the @c kexisting map but not the @c kmissing one.
 *
 * Create a list of GET commands interleaving keys from @c kmissing and
 * @c kexisting. Schedule the operation
 *
 * @post
 * Returned result set has exactly 52 items. All the keys from @c kmissing
 * have @c KEY_ENOENT from their result code, and all keys from @c kexisting
 * contain the appropriate values.
 */
TEST_F(GetUnitTest, testMixedMultiGet)
{
    using namespace std;
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);


    vector<string> kexisting;
    vector<string> kmissing;
    map<string, Item> kmap;

    vector<lcb_get_cmd_t> cmds;
    vector<lcb_get_cmd_t *> cmdptrs;

    int iterations = 4;

    for (int ii = 0; ii < iterations; ii++) {
        char suffix = 'a' + ii;
        string k("existingKey");
        k += suffix;
        kexisting.push_back(k);
        storeKey(instance, k, k);

        k = "nonExistKey";
        k += suffix;
        removeKey(instance, k);
        kmissing.push_back(k);
    }

    for (int ii = 0; ii < iterations; ii++) {
        lcb_get_cmd_t cmdhit(kexisting[ii].c_str(), kexisting[ii].size());
        lcb_get_cmd_t cmdmiss(kmissing[ii].c_str(), kmissing[ii].size());

        cmds.push_back(cmdhit);
        cmds.push_back(cmdmiss);
    }

    for (int ii = 0; ii < cmds.size(); ii++) {
        cmdptrs.push_back(&cmds[ii]);
    }

    lcb_set_get_callback(instance, testMixedMultiGetCallback);

    EXPECT_EQ(LCB_SUCCESS,
              lcb_get(instance, &kmap, cmds.size(), &cmdptrs[0]));

    lcb_wait(instance);
    ASSERT_EQ(iterations * 2, kmap.size());

    for (int ii = 0; ii < iterations; ii++) {
        string k = kexisting[ii];
        ASSERT_EQ(1, kmap.count(k));
        Item itm = kmap[k];
        ASSERT_EQ(LCB_SUCCESS, itm.err);
        ASSERT_EQ(k, itm.val);

        k = kmissing[ii];
        ASSERT_EQ(1, kmap.count(k));
        itm = kmap[k];
        ASSERT_EQ(LCB_KEY_ENOENT, itm.err);
    }
}
