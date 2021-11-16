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
#include "libcouchbase/couchbase.h"

#define LOGARGS(instance, lvl) instance->settings, "tests-MUT", LCB_LOG_##lvl, __FILE__, __LINE__

/**
 * Keep these around in case we do something useful here in the future
 */
void MockUnitTest::SetUp()
{
    srand(time(nullptr));
    MockEnvironment::Reset();
}

void checkConnectCommon(lcb_INSTANCE *instance)
{
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_connect(instance));
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
}

void MockUnitTest::createClusterConnection(HandleWrap &handle, lcb_INSTANCE **instance)
{
    lcb_CREATEOPTS *options = nullptr;
    MockEnvironment::getInstance()->makeConnectParams(options, nullptr, LCB_TYPE_CLUSTER);
    MockEnvironment::getInstance()->createConnection(handle, instance, options);
    checkConnectCommon(handle.getLcb());
    lcb_createopts_destroy(options);
}

void MockUnitTest::createConnection(HandleWrap &handle, lcb_INSTANCE **instance)
{
    MockEnvironment::getInstance()->createConnection(handle, instance);
    checkConnectCommon(handle.getLcb());
}

void MockUnitTest::createConnection(HandleWrap &handle, lcb_INSTANCE **instance, const std::string &username,
                                    const std::string &password)
{
    MockEnvironment::getInstance()->createConnection(handle, instance, username, password);
    checkConnectCommon(handle.getLcb());
}

void MockUnitTest::createConnection(lcb_INSTANCE **instance)
{
    MockEnvironment::getInstance()->createConnection(instance);
    checkConnectCommon(*instance);
}

void MockUnitTest::createConnection(HandleWrap &handle)
{
    lcb_INSTANCE *instance = nullptr;
    createConnection(handle, &instance);
}

lcb_STATUS MockUnitTest::tryCreateConnection(HandleWrap &hw, lcb_INSTANCE **instance, lcb_CREATEOPTS *&crparams)
{
    MockEnvironment::getInstance()->createConnection(hw, instance, crparams);
    EXPECT_EQ(LCB_SUCCESS, lcb_connect(*instance));
    lcb_wait(*instance, LCB_WAIT_DEFAULT);
    return lcb_get_bootstrap_status(*instance);
}

void MockUnitTest::assert_kv_span(const std::shared_ptr<TestSpan> &span, const std::string &expectedName,
                                  const KVSpanAssertions &assertions)
{
    auto bucket = MockEnvironment::getInstance()->getBucket();
    ASSERT_EQ(expectedName, span->name);
    ASSERT_EQ("couchbase", span->str_tags["db.system"]);
    ASSERT_TRUE(span->int_tags.find("db.couchbase.server_duration") != span->int_tags.end());
    ASSERT_EQ(bucket, span->str_tags["db.name"]);
    ASSERT_EQ(assertions.scope, span->str_tags["db.couchbase.scope"]);
    ASSERT_EQ(assertions.collection, span->str_tags["db.couchbase.collection"]);
    ASSERT_EQ("kv", span->str_tags["db.couchbase.service"]);
    ASSERT_EQ(expectedName, span->str_tags["db.operation"]);
    ASSERT_EQ("IP.TCP", span->str_tags["net.transport"]);
    ASSERT_TRUE(span->str_tags.count("db.couchbase.operation_id") > 0);
    ASSERT_TRUE(span->str_tags.count("db.couchbase.local_id") > 0);
    ASSERT_TRUE(span->str_tags.count("net.host.name") > 0);
    ASSERT_TRUE(span->str_tags.count("net.host.port") > 0);
    ASSERT_TRUE(span->str_tags.count("net.peer.name") > 0);
    ASSERT_TRUE(span->str_tags.count("net.peer.port") > 0);
    ASSERT_TRUE(span->int_tags.count("db.couchbase.retries") > 0);
    if (assertions.durability_level == LCB_DURABILITYLEVEL_NONE) {
        ASSERT_TRUE(span->str_tags.count("db.couchbase.durability") == 0);
    } else {
        ASSERT_EQ(dur_level_to_string(assertions.durability_level), span->str_tags["db.couchbase.durability"]);
    }
    ASSERT_TRUE(span->finished);
}

void MockUnitTest::assert_http_span(const std::shared_ptr<TestSpan> &span, const std::string &expectedName,
                                    const HTTPSpanAssertions &assertions)
{
    ASSERT_EQ(expectedName, span->name);
    ASSERT_EQ("couchbase", span->str_tags["db.system"]);
    if (!assertions.bucket.empty()) {
        ASSERT_EQ(assertions.bucket, span->str_tags["db.name"]);
    }
    if (!assertions.scope.empty()) {
        ASSERT_EQ(assertions.scope, span->str_tags["db.couchbase.scope"]);
    }
    if (!assertions.collection.empty()) {
        ASSERT_EQ(assertions.collection, span->str_tags["db.couchbase.collection"]);
    }
    if (!assertions.service.empty()) {
        ASSERT_EQ(assertions.service, span->str_tags["db.couchbase.service"]);
    }
    if (!assertions.op.empty()) {
        ASSERT_EQ(assertions.op, span->str_tags["db.operation"]);
    }
    ASSERT_EQ("IP.TCP", span->str_tags["net.transport"]);
    if (assertions.operation_id.empty()) {
        ASSERT_TRUE(span->str_tags.find("db.couchbase.operation_id") == span->str_tags.end());
    } else if (assertions.operation_id == "any") {
        ASSERT_TRUE(span->str_tags.find("db.couchbase.operation_id") != span->str_tags.end());
    } else {
        ASSERT_EQ(assertions.operation_id, span->str_tags["db.couchbase.operation_id"]);
    }
    ASSERT_TRUE(span->str_tags.find("net.host.name") != span->str_tags.end());
    ASSERT_TRUE(span->str_tags.find("net.host.port") != span->str_tags.end());
    ASSERT_TRUE(span->str_tags.find("net.peer.name") != span->str_tags.end());
    ASSERT_TRUE(span->str_tags.find("net.peer.port") != span->str_tags.end());
    ASSERT_TRUE(span->int_tags.find("db.couchbase.retries") != span->int_tags.end());
    if (!assertions.statement.empty()) {
        ASSERT_EQ(assertions.statement, span->str_tags["db.statement"]);
    }
    ASSERT_TRUE(span->finished);
}

void MockUnitTest::assert_kv_metrics(const std::string &metric_name, const std::string &op, uint32_t length,
                                     bool at_least_len)
{
    std::string key = metric_name + ":kv";
    if (op != "") {
        key = key + ":" + op;
    }
    assert_metrics(key, length, at_least_len);
}

void MockUnitTest::assert_metrics(const std::string &key, uint32_t length, bool at_least_len)
{
    auto meter = MockEnvironment::getInstance()->getMeter();
    ASSERT_TRUE(meter.recorders.find(key) != meter.recorders.end());
    if (at_least_len) {
        ASSERT_TRUE(meter.recorders[key]->values.size() >= length);
    } else {
        ASSERT_TRUE(meter.recorders[key]->values.size() == length);
    }
    for (const auto value : meter.recorders[key]->values) {
        ASSERT_NE(0, value);
    }
}
