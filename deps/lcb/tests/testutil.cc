/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2013 Couchbase, Inc.
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

#include "mock-unit-test.h"
#include "testutil.h"

/*
 * Helper functions
 */
extern "C" {
    static void kvoErrorHandler(lcb_t instance,
                                lcb_error_t err, const char *msg)
    {
        KVOperation::handleInstanceError(instance, err, msg);
    }

    static void storeKvoCallback(lcb_t, const void *cookie,
                                 lcb_storage_t operation,
                                 lcb_error_t error,
                                 const lcb_store_resp_t *resp)
    {

        KVOperation *kvo = (KVOperation *)cookie;
        kvo->cbCommon(error);
        kvo->result.assignKC(resp, error);
        ASSERT_EQ(LCB_SET, operation);
    }

    static void getKvoCallback(lcb_t, const void *cookie,
                               lcb_error_t error,
                               const lcb_get_resp_t *resp)
    {
        KVOperation *kvo = (KVOperation *)cookie;
        kvo->cbCommon(error);
        kvo->result.assign(resp, error);
    }

    static void removeKvoCallback(lcb_t, const void *cookie,
                                  lcb_error_t error,
                                  const lcb_remove_resp_t *resp)
    {
        KVOperation *kvo = (KVOperation *)cookie;
        kvo->cbCommon(error);
        kvo->result.assignKC(resp, error);
    }
}

void KVOperation::handleInstanceError(lcb_t instance, lcb_error_t err,
                                      const char *)
{
    KVOperation *kvo = reinterpret_cast<KVOperation *>(
            const_cast<void*>(lcb_get_cookie(instance)));
    kvo->assertOk(err);
    kvo->globalErrors.insert(err);
}

void KVOperation::enter(lcb_t instance)
{
    callbacks.err = lcb_set_error_callback(instance, kvoErrorHandler);
    callbacks.get = lcb_set_get_callback(instance, getKvoCallback);
    callbacks.rm = lcb_set_remove_callback(instance, removeKvoCallback);
    callbacks.store = lcb_set_store_callback(instance, storeKvoCallback);
    oldCookie = lcb_get_cookie(instance);
    lcb_set_cookie(instance, this);
}

void KVOperation::leave(lcb_t instance)
{
    lcb_set_error_callback(instance, callbacks.err);
    lcb_set_get_callback(instance, callbacks.get);
    lcb_set_remove_callback(instance, callbacks.rm);
    lcb_set_store_callback(instance, callbacks.store);
    lcb_set_cookie(instance, oldCookie);
}

void KVOperation::assertOk(lcb_error_t err)
{
    if (allowableErrors.empty()) {
        ASSERT_EQ(LCB_SUCCESS, err);
        return;
    }
    ASSERT_TRUE(allowableErrors.find(err) != allowableErrors.end());
}

void KVOperation::store(lcb_t instance)
{
    lcb_store_cmd_t cmd(LCB_SET,
                        request->key.data(), request->key.length(),
                        request->val.data(), request->val.length(),
                        request->flags,
                        request->exp,
                        request->cas,
                        request->datatype);
    lcb_store_cmd_t *cmds[] = { &cmd };

    enter(instance);
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, this, 1, cmds));
    EXPECT_EQ(LCB_SUCCESS, lcb_wait(instance));
    leave(instance);

    ASSERT_EQ(1, callCount);

}

void KVOperation::remove(lcb_t instance)
{
    lcb_remove_cmd_t cmd(request->key.data(), request->key.length(),
                         request->cas);
    lcb_remove_cmd_t *cmds[] = { &cmd };

    enter(instance);
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, this, 1, cmds));
    EXPECT_EQ(LCB_SUCCESS, lcb_wait(instance));
    leave(instance);

    ASSERT_EQ(1, callCount);

}

void KVOperation::get(lcb_t instance)
{
    lcb_get_cmd_t cmd(request->key.data(), request->key.length(), request->exp);
    lcb_get_cmd_t *cmds[] = { &cmd };

    enter(instance);
    EXPECT_EQ(LCB_SUCCESS, lcb_get(instance, this, 1, cmds));
    EXPECT_EQ(LCB_SUCCESS, lcb_wait(instance));
    leave(instance);

    ASSERT_EQ(1, callCount);
}

void storeKey(lcb_t instance, const std::string &key, const std::string &value)
{
    Item req = Item(key, value);
    KVOperation kvo = KVOperation(&req);
    kvo.store(instance);
}

void removeKey(lcb_t instance, const std::string &key)
{
    Item req = Item();
    req.key = key;
    KVOperation kvo = KVOperation(&req);
    kvo.allowableErrors.insert(LCB_SUCCESS);
    kvo.allowableErrors.insert(LCB_KEY_ENOENT);
    kvo.remove(instance);
}

void getKey(lcb_t instance, const std::string &key, Item &item)
{
    Item req = Item();
    req.key = key;
    KVOperation kvo = KVOperation(&req);
    kvo.result.cas = 0xdeadbeef;

    kvo.get(instance);
    ASSERT_NE(0xdeadbeef, kvo.result.cas);
    item = kvo.result;
}

/**
 * Dump the item object to a stream
 * @param out where to dump the object to
 * @param item the item to print
 * @return the stream
 */
std::ostream &operator<< (std::ostream &out, const Item &item)
{
    using namespace std;
    out << "Key: " << item.key << endl;
    if (item.val.length()) {
        out <<  "Value: " << item.val << endl;
    }

    out << ios::hex << "CAS: 0x" << item.cas << endl
        << "Flags: 0x" << item.flags << endl;

    if (item.err != LCB_SUCCESS) {
        out << "Error: " << item.err << endl;
    }

    return out;
}
