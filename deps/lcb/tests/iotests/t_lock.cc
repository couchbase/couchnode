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
#include <map>
#include "iotests.h"

class LockUnitTest : public MockUnitTest
{
};

extern "C" {
    static void getLockedCallback(lcb_t, const void *cookie,
                                  lcb_error_t err,
                                  const lcb_get_resp_t *resp)
    {
        Item *itm = (Item *)cookie;
        itm->assign(resp, err);
    }
    static void unlockCallback(lcb_t, const void *cookie,
                               lcb_error_t err,
                               const lcb_unlock_resp_t *resp)
    {
        *(lcb_error_t *)cookie = err;
    }
}

/**
 * @test
 * Lock (lock and unlock)
 *
 * @pre
 * Set a key, and get the value specifying the lock option with a timeout
 * of @c 10.
 *
 * @post
 * Lock operation succeeds.
 *
 * @pre Unlock the key using the CAS from the previous get result.
 * @post Unlock succeeds
 */
TEST_F(LockUnitTest, testSimpleLockAndUnlock)
{
    LCB_TEST_REQUIRE_FEATURE("lock")

    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    std::string key = "lockKey";
    std::string value = "lockValue";

    removeKey(instance, key);
    storeKey(instance, key, value);

    lcb_get_cmd_st cmd = lcb_get_cmd_st(key.c_str(), key.size(),
                                        1, 10);
    lcb_get_cmd_st *cmdlist = &cmd;
    Item itm;
    lcb_error_t err;

    lcb_set_get_callback(instance, getLockedCallback);

    err = lcb_get(instance, &itm, 1, &cmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, itm.err);

    lcb_unlock_cmd_st ucmd(key.c_str(), key.size(), itm.cas);
    lcb_unlock_cmd_st *ucmdlist = &ucmd;

    lcb_error_t reserr = LCB_ERROR;

    lcb_set_unlock_callback(instance, unlockCallback);
    err = lcb_unlock(instance, &reserr, 1, &ucmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);

    lcb_wait(instance);

    ASSERT_EQ(LCB_SUCCESS, reserr);

}

/**
 * @test Lock (Missing CAS)
 *
 * @pre
 * Store a key and attempt to unlock it with an invalid CAS
 *
 * @post
 * Error result of @c ETMPFAIL
 */
TEST_F(LockUnitTest, testUnlockMissingCas)
{
    LCB_TEST_REQUIRE_FEATURE("lock")

    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);

    lcb_error_t err, reserr = LCB_ERROR;

    storeKey(instance, "lockKey", "lockValue");

    lcb_unlock_cmd_t cmd("lockKey", sizeof("lockKey") - 1, 0);
    lcb_unlock_cmd_t *cmdlist = &cmd;
    lcb_set_unlock_callback(instance, unlockCallback);

    err = lcb_unlock(instance, &reserr, 1, &cmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    if (CLUSTER_VERSION_IS_HIGHER_THAN(MockEnvironment::VERSION_50)) {
        ASSERT_EQ(LCB_EINVAL_MCD, reserr);
    } else {
        ASSERT_EQ(LCB_ETMPFAIL, reserr);
    }
}

extern "C" {
    static void lockedStorageCallback(lcb_t,
                                      const void *cookie,
                                      lcb_storage_t operation,
                                      lcb_error_t err,
                                      const lcb_store_resp_t *resp)
    {
        Item *itm = (Item *)cookie;
        itm->assignKC<lcb_store_resp_t>(resp, err);
    }
}
/**
 * @test Lock (Storage Contention)
 *
 * @pre
 * Store a key, perform a GET operation with the lock option, specifying a
 * timeout of @c 10.
 *
 * Then attempt to store the key (without specifying any CAS).
 *
 * @post Store operation fails with @c KEY_EEXISTS. Getting the key retains
 * the old value.
 *
 * @pre store the key using the CAS specified from the first GET
 * @post Storage succeeds. Get returns new value.
 */
TEST_F(LockUnitTest, testStorageLockContention)
{
    LCB_TEST_REQUIRE_FEATURE("lock")

    lcb_t instance;
    HandleWrap hw;
    lcb_error_t err;

    createConnection(hw, instance);
    Item itm;
    std::string key = "lockedKey", value = "lockedValue",
                newvalue = "newUnlockedValue";

    /* undo any funny business on our key */
    removeKey(instance, key);
    storeKey(instance, key, value);

    lcb_set_get_callback(instance, getLockedCallback);
    lcb_set_unlock_callback(instance, unlockCallback);
    lcb_set_store_callback(instance, lockedStorageCallback);

    /* get the key and lock it */
    lcb_get_cmd_st gcmd(key.c_str(), key.size(), 1, 10);
    lcb_get_cmd_st *cmdlist = &gcmd;
    err = lcb_get(instance, &itm, 1, &cmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, itm.err);
    ASSERT_GT(itm.cas, 0);

    /* now try to set the key, while the lock is still in place */
    lcb_store_cmd_t scmd(LCB_SET, key.c_str(), key.size(),
                         newvalue.c_str(), newvalue.size());
    lcb_store_cmd_t *scmdlist = &scmd;
    Item s_itm;
    err = lcb_store(instance, &s_itm, 1, &scmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(LCB_KEY_EEXISTS, s_itm.err);

    /* verify the value is still the old value */
    Item ritem;
    getKey(instance, key, ritem);
    ASSERT_EQ(ritem.val, value);

    /* now try to set it with the correct cas, implicitly unlocking the key */
    scmd.v.v0.cas = itm.cas;
    err = lcb_store(instance, &s_itm, 1, &scmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, itm.err);

    /* verify the value is now the new value */
    getKey(instance, key, ritem);
    ASSERT_EQ(ritem.val, newvalue);
}

/**
 * @test
 * Lock (Unlocking)
 *
 * @pre
 * Store a key, get it with the lock option, specifying an expiry of @c 10.
 * Try to unlock the key (using the @c lcb_unlock function) without a valid
 * CAS.
 *
 * @post Unlock fails with @c ETMPFAIL
 *
 * @pre
 * Unlock the key using the valid cas retrieved from the first lock operation.
 * Then try to store the key with a new value.
 *
 * @post Unlock succeeds and retrieval of key yields new value.
 */
TEST_F(LockUnitTest, testUnlLockContention)
{
    LCB_TEST_REQUIRE_FEATURE("lock")

    lcb_t instance;
    HandleWrap hw;
    lcb_error_t err, reserr = LCB_ERROR;
    createConnection(hw, instance);

    std::string key = "lockedKey2", value = "lockedValue2";
    storeKey(instance, key, value);
    Item gitm;

    lcb_set_get_callback(instance, getLockedCallback);
    lcb_set_unlock_callback(instance, unlockCallback);
    lcb_set_store_callback(instance, lockedStorageCallback);

    lcb_get_cmd_t gcmd(key.c_str(), key.size(), 1, 10);
    lcb_get_cmd_t *gcmdlist = &gcmd;

    err = lcb_get(instance, &gitm, 1, &gcmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, gitm.err);

    lcb_cas_t validCas = gitm.cas;
    err = lcb_get(instance, &gitm, 1, &gcmdlist);
    lcb_wait(instance);
    ASSERT_EQ(LCB_ETMPFAIL, gitm.err);

    lcb_unlock_cmd_t ucmd(key.c_str(), key.size(), validCas);
    lcb_unlock_cmd_t *ucmdlist = &ucmd;
    err = lcb_unlock(instance, &reserr, 1, &ucmdlist);
    ASSERT_EQ(LCB_SUCCESS, err);
    lcb_wait(instance);
    ASSERT_EQ(reserr, LCB_SUCCESS);

    std::string newval = "lockedValueNew2";
    storeKey(instance, key, newval);
    getKey(instance, key, gitm);
    ASSERT_EQ(gitm.val, newval);

}
