/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2020 Couchbase, Inc.
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

static bool hasPendingOps(lcb_INSTANCE *instance)
{
    for (size_t ii = 0; ii < LCBT_NSERVERS(instance); ++ii) {
        if (instance->get_server(ii)->has_pending()) {
            return true;
        }
    }
    return false;
}

static void opCallback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    size_t *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testSched)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;
    size_t counter;
    createConnection(hw, &instance);

    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)opCallback);

    // lcb_store
    lcb_CMDSTORE *scmd;
    lcb_cmdstore_create(&scmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(scmd, "key", 3);
    lcb_cmdstore_value(scmd, "val", 3);

    rc = lcb_store(instance, &counter, scmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(hasPendingOps(instance));
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    ASSERT_FALSE(hasPendingOps(instance));

    lcb_sched_enter(instance);
    rc = lcb_store(instance, &counter, scmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_FALSE(hasPendingOps(instance));
    lcb_sched_leave(instance);
    ASSERT_TRUE(hasPendingOps(instance));
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    ASSERT_FALSE(hasPendingOps(instance));

    // Try with multiple operations..
    counter = 0;
    for (size_t ii = 0; ii < 5; ++ii) {
        rc = lcb_store(instance, &counter, scmd);
    }

    ASSERT_TRUE(hasPendingOps(instance));
    lcb_sched_enter(instance);
    rc = lcb_store(instance, &counter, scmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_sched_fail(instance);
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    ASSERT_EQ(5, counter);

    lcb_cmdstore_destroy(scmd);
}

static void counterCallback(lcb_INSTANCE *, int, const lcb_RESPCOUNTER *resp)
{
    size_t *counter;
    lcb_respcounter_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleIncrementBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDCOUNTER *cmd;
    lcb_install_callback(instance, LCB_CALLBACK_COUNTER, (lcb_RESPCALLBACK)counterCallback);
    lcb_cmdcounter_create(&cmd);
    lcb_cmdcounter_key(cmd, "key", 3);
    lcb_cmdcounter_delta(cmd, 1);
    size_t counter = 0;
    rc = lcb_counter(instance, &counter, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_cmdcounter_destroy(cmd);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());
    ASSERT_EQ(0, counter);

    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_EQ(1, counter);
}

static void existsCallback(lcb_INSTANCE *, int, const lcb_RESPEXISTS *resp)
{
    size_t *counter;
    lcb_respexists_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleExistsBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDEXISTS *cmd;
    lcb_install_callback(instance, LCB_CALLBACK_EXISTS, (lcb_RESPCALLBACK)existsCallback);
    lcb_cmdexists_create(&cmd);
    lcb_cmdexists_key(cmd, "key", 3);
    size_t counter = 0;
    rc = lcb_exists(instance, &counter, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_cmdexists_destroy(cmd);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_EQ(1, counter);
}

static void getCallback(lcb_INSTANCE *, int, const lcb_RESPGET *resp)
{
    size_t *counter;
    lcb_respget_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleGetBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDGET *cmd;
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)getCallback);
    lcb_cmdget_create(&cmd);
    lcb_cmdget_key(cmd, "key", 3);
    size_t counter = 0;
    rc = lcb_get(instance, &counter, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_cmdget_destroy(cmd);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_EQ(1, counter);
}

static void removeCallback(lcb_INSTANCE *, int, const lcb_RESPREMOVE *resp)
{
    size_t *counter;
    lcb_respremove_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleRemoveBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDREMOVE *cmd;
    lcb_install_callback(instance, LCB_CALLBACK_REMOVE, (lcb_RESPCALLBACK)removeCallback);
    lcb_cmdremove_create(&cmd);
    lcb_cmdremove_key(cmd, "key", 3);
    size_t counter = 0;
    rc = lcb_remove(instance, &counter, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_cmdremove_destroy(cmd);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_EQ(1, counter);
}

static void storeCallback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    size_t *counter;
    lcb_respstore_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleStoreBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDSTORE *cmd;
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)storeCallback);
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, "key", 3);
    lcb_cmdstore_value(cmd, "foo", 3);
    size_t counter = 0;
    rc = lcb_store(instance, &counter, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_cmdstore_destroy(cmd);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_EQ(1, counter);
}

static void subdocCallback(lcb_INSTANCE *, int, const lcb_RESPSUBDOC *resp)
{
    size_t *counter;
    lcb_respsubdoc_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleSubdocBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDSUBDOC *cmd;
    lcb_install_callback(instance, LCB_CALLBACK_SDLOOKUP, (lcb_RESPCALLBACK)subdocCallback);
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, "key", 3);
    lcb_SUBDOCSPECS *specs;
    lcb_subdocspecs_create(&specs, 1);
    lcb_subdocspecs_get(specs, 0, 0, "p", 1);
    size_t counter = 0;
    lcb_cmdsubdoc_specs(cmd, specs);
    rc = lcb_subdoc(instance, &counter, cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    lcb_subdocspecs_destroy(specs);
    lcb_cmdsubdoc_destroy(cmd);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_EQ(1, counter);
}

static void queryCallback(lcb_INSTANCE *, int, const lcb_RESPQUERY *resp)
{
    size_t *counter;
    lcb_respquery_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleQueryBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDQUERY *cmd;
    lcb_cmdquery_create(&cmd);
    std::string statement("SELECT 'hello' AS greeting");
    lcb_cmdquery_statement(cmd, statement.c_str(), statement.size());
    lcb_cmdquery_callback(cmd, queryCallback);
    size_t counter = 0;
    rc = lcb_query(instance, &counter, cmd);
    lcb_cmdquery_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    if (MockEnvironment::getInstance()->isRealCluster()) {
        ASSERT_EQ(2, counter); /* single row + meta */
    } else {
        ASSERT_EQ(1, counter); /* reduced implementation */
    }
}

static void searchCallback(lcb_INSTANCE *, int, const lcb_RESPSEARCH *resp)
{
    size_t *counter;
    lcb_respsearch_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleSearchBeforeConnection)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)
    SKIP_UNLESS_SEARCH_INDEX()

    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDSEARCH *cmd;
    lcb_cmdsearch_create(&cmd);
    std::string query(R"({"indexName":")" + search_index + R"(","limit":2,"query":{"query":"golf"}})");
    lcb_cmdsearch_payload(cmd, query.c_str(), query.size());
    lcb_cmdsearch_callback(cmd, searchCallback);
    size_t counter = 0;
    rc = lcb_search(instance, &counter, cmd);
    lcb_cmdsearch_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_EQ(3, counter); /* two rows + meta */
}

static void analyticsCallback(lcb_INSTANCE *, int, const lcb_RESPANALYTICS *resp)
{
    size_t *counter;
    lcb_respanalytics_cookie(resp, (void **)&counter);
    *counter += 1;
}

TEST_F(SchedUnitTests, testScheduleAnalyticsBeforeConnection)
{
    SKIP_IF_MOCK()
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_70)

    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDANALYTICS *cmd;
    lcb_cmdanalytics_create(&cmd);
    std::string query(R"({"statement":"SELECT * FROM Metadata.`Dataverse`"})");
    lcb_cmdanalytics_payload(cmd, query.c_str(), query.size());
    lcb_cmdanalytics_callback(cmd, analyticsCallback);
    size_t counter = 0;
    rc = lcb_analytics(instance, &counter, cmd);
    lcb_cmdanalytics_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_GE(counter, 2); /* meta + some rows */
}

static void viewCallback(lcb_INSTANCE *, int, const lcb_RESPVIEW *resp)
{
    size_t *counter;
    lcb_respview_cookie(resp, (void **)&counter);
    *counter += 1;

    ASSERT_STATUS_EQ(LCB_ERR_VIEW_NOT_FOUND, lcb_respview_status(resp));
}

TEST_F(SchedUnitTests, testScheduleViewBeforeConnection)
{
    HandleWrap hw;
    lcb_INSTANCE *instance;
    lcb_STATUS rc;

    MockEnvironment::getInstance()->createConnection(hw, &instance);

    lcb_CMDVIEW *cmd;
    lcb_cmdview_create(&cmd);
    std::string design_document("does_not_exist");
    std::string view("unknown");
    lcb_cmdview_design_document(cmd, design_document.c_str(), design_document.size());
    lcb_cmdview_view_name(cmd, view.c_str(), view.size());
    lcb_cmdview_callback(cmd, viewCallback);
    size_t counter = 0;
    rc = lcb_view(instance, &counter, cmd);
    lcb_cmdview_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, rc);
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_TRUE(instance->has_deferred_operations());

    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    ASSERT_FALSE(instance->has_deferred_operations());
    ASSERT_FALSE(hasPendingOps(instance));
    ASSERT_GE(1, counter);
}
