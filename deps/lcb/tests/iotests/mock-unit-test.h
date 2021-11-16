/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2020 Couchbase, Inc.
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
#ifndef TESTS_MOCK_UNIT_TESTS_H
#define TESTS_MOCK_UNIT_TESTS_H 1

#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include "mock-environment.h"
#include "testutil.h"

class HandleWrap;

#define SKIP_IF_MOCK()                                                                                                 \
    if (!getenv(LCB_TEST_REALCLUSTER_ENV)) {                                                                           \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__, "needs real cluster");                                   \
        return;                                                                                                        \
    }

#define SKIP_UNLESS_MOCK()                                                                                             \
    if (getenv(LCB_TEST_REALCLUSTER_ENV)) {                                                                            \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__, "needs mock cluster");                                   \
        return;                                                                                                        \
    }

#define SKIP_UNLESS_SEARCH_INDEX()                                                                                     \
    auto search_index = MockEnvironment::getInstance()->getSearchIndex();                                              \
    if (search_index.empty()) {                                                                                        \
        MockEnvironment::printSkipMessage(__FILE__, __LINE__,                                                          \
                                          "needs search index specified using " LCB_TEST_SEARCH_INDEX_ENV);            \
        return;                                                                                                        \
    }

struct KVSpanAssertions {
    lcb_DURABILITY_LEVEL durability_level{LCB_DURABILITYLEVEL_NONE};
    std::string scope{"_default"};
    std::string collection{"_default"};
};

struct HTTPSpanAssertions {
    std::string statement{};
    std::string scope{};
    std::string collection{};
    std::string bucket{};
    std::string op{};
    std::string operation_id{};
    std::string service{};
};

class MockUnitTest : public ::testing::Test
{
  protected:
    virtual void SetUp();
    virtual void createConnection(lcb_INSTANCE **instance);
    virtual void createConnection(HandleWrap &handle);
    virtual void createConnection(HandleWrap &handle, lcb_INSTANCE **instance);
    virtual void createConnection(HandleWrap &handle, lcb_INSTANCE **instance, const std::string &username,
                                  const std::string &password);
    virtual void createClusterConnection(HandleWrap &handle, lcb_INSTANCE **instance);
    virtual lcb_STATUS tryCreateConnection(HandleWrap &hw, lcb_INSTANCE **instance, lcb_CREATEOPTS *&crparams);

    static void assert_kv_span(const std::shared_ptr<TestSpan> &span, const std::string &expectedName,
                               const KVSpanAssertions &assertions);
    static void assert_http_span(const std::shared_ptr<TestSpan> &span, const std::string &expectedName,
                                 const HTTPSpanAssertions &assertions);
    void assert_kv_metrics(const std::string &metric_name, const std::string &op, uint32_t length, bool at_least_len);
    void assert_metrics(const std::string &key, uint32_t length, bool at_least_len);

    // A mock "Transaction"
    void doMockTxn(MockCommand &cmd)
    {
        MockEnvironment::getInstance()->sendCommand(cmd);
        MockResponse tmp;
        MockEnvironment::getInstance()->getResponse(tmp);
        ASSERT_TRUE(tmp.isOk());
    }
};

/*
 * This test class groups tests that might be problematic when executed together with all other tests.
 * Every test case in this suite must start with Jira ticket number for future.
 */
class ContaminatingUnitTest : public MockUnitTest
{
};

#endif
