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

class Cluster : public ::testing::Test
{
public:
    virtual void SetUp() {
        struct lcb_create_st options(NULL, "Administrator", "password", NULL, NULL, LCB_TYPE_CLUSTER);
        ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    }

    virtual void TearDown() {
        lcb_destroy(instance);
    }

protected:
    lcb_t instance;
};

TEST_F(Cluster, IsntAllowedToMakeDataCalls)
{
    EXPECT_EQ(LCB_EBADHANDLE, lcb_get(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_get_replica(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_store(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_touch(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_remove(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_unlock(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_flush(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_arithmetic(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_observe(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_server_stats(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_server_versions(instance, NULL, 0, NULL));
    EXPECT_EQ(LCB_EBADHANDLE, lcb_set_verbosity(instance, NULL, 0, NULL));
    return;
}
