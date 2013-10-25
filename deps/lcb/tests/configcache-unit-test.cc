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
#include "mock-unit-test.h"
#include "testutil.h"

#include <cstdio>

class ConfigCacheUnitTest : public MockUnitTest
{
protected:
    static void SetUpTestCase() {
        MockUnitTest::SetUpTestCase();
    }
};

TEST_F(ConfigCacheUnitTest, testConfigCache)
{
    lcb_t instance;
    lcb_error_t err;

    struct lcb_cached_config_st cacheinfo;

    // Get the filename:
    char filename[L_tmpnam + 0];
    ASSERT_TRUE(NULL != tmpnam(filename));

    memset(&cacheinfo, 0, sizeof(cacheinfo));

    cacheinfo.cachefile = filename;
    MockEnvironment::getInstance()->makeConnectParams(cacheinfo.createopt, NULL);

    err = lcb_create_compat(LCB_CACHED_CONFIG, &cacheinfo, &instance, NULL);
    ASSERT_EQ(err, LCB_SUCCESS);

    int is_loaded;
    err = lcb_cntl(instance, LCB_CNTL_GET,
                   LCB_CNTL_CONFIG_CACHE_LOADED, &is_loaded);

    ASSERT_EQ(err, LCB_SUCCESS);
    ASSERT_EQ(is_loaded, 0);

    err = lcb_connect(instance);
    ASSERT_EQ(err, LCB_SUCCESS);

    err = lcb_wait(instance);
    ASSERT_EQ(err, LCB_SUCCESS);

    // now try another one
    lcb_destroy(instance);
    err = lcb_create_compat(LCB_CACHED_CONFIG, &cacheinfo, &instance, NULL);
    ASSERT_EQ(err, LCB_SUCCESS);

    err = lcb_cntl(instance, LCB_CNTL_GET,
                   LCB_CNTL_CONFIG_CACHE_LOADED, &is_loaded);
    ASSERT_NE(is_loaded, 0);

    /* Just make sure we can schedule a command */
    storeKey(instance, "a_key", "a_value");

    lcb_destroy(instance);
    remove(filename);
}
