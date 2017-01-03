/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016 Couchbase, Inc.
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
#include <libcouchbase/couchbase.h>
#include <map>
#include "iotests.h"
#include "internal.h"

class SchedUnitTests : public MockUnitTest
{
};

static bool
hasPendingOps(lcb_t instance)
{
    for (size_t ii = 0; ii < LCBT_NSERVERS(instance); ++ii) {
        if (instance->get_server(ii)->has_pending()) {
            return true;
        }
    }
    return false;
}

static void
opCallback(lcb_t, int, const lcb_RESPBASE *rb) {
    size_t *counter = reinterpret_cast<size_t*>(rb->cookie);
    *counter += 1;
}

TEST_F(SchedUnitTests, testSched)
{
    HandleWrap hw;
    lcb_t instance;
    lcb_error_t rc;
    size_t counter;
    createConnection(hw, instance);

    lcb_install_callback3(instance, LCB_CALLBACK_STORE, opCallback);

    // lcb_store3
    lcb_CMDSTORE scmd = { 0 };
    LCB_CMD_SET_KEY(&scmd, "key", 3);
    LCB_CMD_SET_VALUE(&scmd, "val", 3);
    scmd.operation = LCB_SET;

    rc = lcb_store3(instance, &counter, &scmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(hasPendingOps(instance));
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    ASSERT_FALSE(hasPendingOps(instance));

    lcb_sched_enter(instance);
    rc = lcb_store3(instance, &counter, &scmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_FALSE(hasPendingOps(instance));
    lcb_sched_leave(instance);
    ASSERT_TRUE(hasPendingOps(instance));
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    ASSERT_FALSE(hasPendingOps(instance));

    // Try with multiple operations..
    counter = 0;
    for (size_t ii = 0; ii < 5; ++ii) {
        rc = lcb_store3(instance, &counter, &scmd);
    }

    ASSERT_TRUE(hasPendingOps(instance));
    lcb_sched_enter(instance);
    rc = lcb_store3(instance, &counter, &scmd);
    lcb_sched_fail(instance);
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    ASSERT_EQ(5, counter);
}
