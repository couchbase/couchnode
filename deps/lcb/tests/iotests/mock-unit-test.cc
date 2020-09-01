/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2020 Couchbase, Inc.
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

#include "internal.h" /* vbucket_* things from lcb_INSTANCE **/
#include <lcbio/iotable.h>
#include "bucketconfig/bc_http.h"

#define LOGARGS(instance, lvl) instance->settings, "tests-MUT", LCB_LOG_##lvl, __FILE__, __LINE__

/**
 * Keep these around in case we do something useful here in the future
 */
void MockUnitTest::SetUp()
{
    srand(time(NULL));
    MockEnvironment::Reset();
}

void checkConnectCommon(lcb_INSTANCE *instance)
{
    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
}

void MockUnitTest::createClusterConnection(HandleWrap &handle, lcb_INSTANCE **instance)
{
    lcb_CREATEOPTS *options = NULL;
    MockEnvironment::getInstance()->makeConnectParams(options, NULL, LCB_TYPE_CLUSTER);
    MockEnvironment::getInstance()->createConnection(handle, instance, options);
    checkConnectCommon(handle.getLcb());
    lcb_createopts_destroy(options);
}

void MockUnitTest::createConnection(HandleWrap &handle, lcb_INSTANCE **instance)
{
    MockEnvironment::getInstance()->createConnection(handle, instance);
    checkConnectCommon(handle.getLcb());
}

void MockUnitTest::createConnection(lcb_INSTANCE **instance)
{
    MockEnvironment::getInstance()->createConnection(instance);
    checkConnectCommon(*instance);
}

void MockUnitTest::createConnection(HandleWrap &handle)
{
    lcb_INSTANCE *instance = NULL;
    createConnection(handle, &instance);
}

lcb_STATUS MockUnitTest::tryCreateConnection(HandleWrap &hw, lcb_INSTANCE **instance, lcb_CREATEOPTS *&crparams)
{
    MockEnvironment::getInstance()->createConnection(hw, instance, crparams);
    EXPECT_EQ(LCB_SUCCESS, lcb_connect(*instance));
    lcb_wait(*instance, LCB_WAIT_DEFAULT);
    return lcb_get_bootstrap_status(*instance);
}
