/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

class Hostname : public ::testing::Test
{
public:

};

TEST_F(Hostname, testSchemas)
{
    lcb_t instance;
    struct lcb_create_st options;
    memset(&options, 0, sizeof(options));
    options.v.v0.host = "ftp://localhost";
    EXPECT_EQ(LCB_INVALID_HOST_FORMAT, lcb_create(&instance, &options));

    options.v.v0.host = "https://localhost";
    EXPECT_EQ(LCB_INVALID_HOST_FORMAT, lcb_create(&instance, &options));

    options.v.v0.host = "://localhost";
    EXPECT_EQ(LCB_INVALID_HOST_FORMAT, lcb_create(&instance, &options));

    options.v.v0.host = "https://localhost";
    EXPECT_EQ(LCB_INVALID_HOST_FORMAT, lcb_create(&instance, &options));

    options.v.v0.host = "http://localhost";
    EXPECT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    lcb_destroy(instance);
}

TEST_F(Hostname, testPaths)
{
    lcb_t instance;
    struct lcb_create_st options;
    memset(&options, 0, sizeof(options));
    options.v.v0.host = "http://localhost/foo";
    EXPECT_EQ(LCB_INVALID_HOST_FORMAT, lcb_create(&instance, &options));

    options.v.v0.host = "http://localhost/";
    EXPECT_EQ(LCB_INVALID_HOST_FORMAT, lcb_create(&instance, &options));

    options.v.v0.host = "http://localhost/pools";
    EXPECT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    lcb_destroy(instance);

    options.v.v0.host = "http://localhost/pools/";
    EXPECT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    lcb_destroy(instance);
}

TEST_F(Hostname, testPort)
{
    lcb_t instance;
    struct lcb_create_st options;
    memset(&options, 0, sizeof(options));

    options.v.v0.host = "localhost:80:0";
    EXPECT_EQ(LCB_INVALID_HOST_FORMAT, lcb_create(&instance, &options));

    options.v.v0.host = "localhost";
    EXPECT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    lcb_destroy(instance);

    options.v.v0.host = "localhost:80";
    EXPECT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    lcb_destroy(instance);

    options.v.v0.host = "http://localhost:80";
    EXPECT_EQ(LCB_SUCCESS, lcb_create(&instance, &options));
    lcb_destroy(instance);
}
