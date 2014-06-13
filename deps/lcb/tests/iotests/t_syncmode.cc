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
#include "iotests.h"

extern "C" {
    static void error_callback(lcb_t, lcb_error_t err, const char *)
    {
        ASSERT_EQ(LCB_SUCCESS, err);
    }

    static void store_callback(lcb_t, const void *cookie,
                               lcb_storage_t operation,
                               lcb_error_t error,
                               const lcb_store_resp_t *)
    {
        int *counter = (int *)cookie;
        ASSERT_EQ(LCB_SET, operation);
        ASSERT_EQ(LCB_SUCCESS, error);
        ++(*counter);
    }

}

class SyncmodeUnitTest : public MockUnitTest
{
protected:
    void createConnection(lcb_t &instance) {
        MockEnvironment::getInstance()->createConnection(instance);
        (void)lcb_set_error_callback(instance, error_callback);
        (void)lcb_behavior_set_syncmode(instance, LCB_SYNCHRONOUS);
        ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    }
};

TEST_F(SyncmodeUnitTest, testSet)
{
    lcb_t instance;
    createConnection(instance);
    (void)lcb_set_store_callback(instance, store_callback);

    int counter = 0;
    std::string key("SyncmodeUnitTest::testSet");
    std::string value("Hello World");
    lcb_store_cmd_t cmd(LCB_SET, key.data(), key.length(),
                        value.data(), value.length());
    lcb_store_cmd_t *cmds[] = { &cmd };
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, &counter, 1, cmds));
    ASSERT_EQ(1, counter);
    lcb_destroy(instance);
}
