/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2015-2020 Couchbase, Inc.
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
#include "iotests.h"
#include <string>

namespace std
{
inline ostream &operator<<(ostream &os, const lcb_STATUS &rc)
{
    os << "LcbError <0x";
    os << std::hex << static_cast< unsigned >(rc);
    os << " (";
    os << lcb_strerror_short(rc);
    os << ")>";
    return os;
}
} // namespace std

class SubdocUnitTest : public MockUnitTest
{
  public:
    SubdocUnitTest()
    {
        key = "subdocItem";
        value = "{"
                "\"dictkey\":\"dictval\","
                "\"array\":["
                "1,2,3,4,[10,20,30,[100,200,300]]"
                "]"
                "}";

        nonJsonKey = "nonJsonItem";
    }

  protected:
    std::string key;
    std::string value;
    std::string nonJsonKey;
    bool createSubdocConnection(HandleWrap &hw, lcb_INSTANCE **instance);
};

struct Result {
    lcb_STATUS rc;
    uint64_t cas;
    std::string value;
    int index;

    Result()
    {
        clear();
    }

    Result(const lcb_RESPSUBDOC *resp, size_t idx)
    {
        clear();
        assign(resp, idx);
    }

    void clear()
    {
        rc = LCB_ERR_GENERIC;
        cas = 0;
        index = -1;
        value.clear();
    }

    void assign(const lcb_RESPSUBDOC *resp, size_t idx)
    {
        rc = lcb_respsubdoc_result_status(resp, idx);
        index = idx;
        const char *p;
        size_t n;
        lcb_respsubdoc_result_value(resp, idx, &p, &n);
        if (n) {
            value.assign(p, n);
        }
    }
};

struct MultiResult {
    std::vector< Result > results;
    uint64_t cas;
    lcb_STATUS rc;
    unsigned cbtype;
    bool is_single;

    void clear()
    {
        cas = 0;
        results.clear();
        cbtype = 0;
        rc = LCB_ERR_AUTH_CONTINUE;
        is_single = false;
    }

    size_t size() const
    {
        return results.size();
    }

    const Result &operator[](size_t ix) const
    {
        if (cbtype == LCB_CALLBACK_SDMUTATE) {
            for (size_t ii = 0; ii < results.size(); ++ii) {
                if (results[ix].index == ix) {
                    return results[ix];
                }

                // Force bad index behavior
                return results[results.size()];
            }
        }
        return results[ix];
    }

    const std::string &single_value() const
    {
        return results[0].value;
    }

    MultiResult()
    {
        clear();
    }
};

static ::testing::AssertionResult verifySingleOk(const char *, const MultiResult &mr, const char *value = NULL)
{
    using namespace ::testing;
    if (mr.rc != LCB_SUCCESS) {
        return AssertionFailure() << "Top-level error code failed. " << mr.rc;
    }
    if (mr.size() != 1) {
        return AssertionFailure() << "Expected a single result. Got " << mr.size();
    }

    if (mr[0].rc != LCB_SUCCESS) {
        return AssertionFailure() << "Nested error code is " << mr[0].rc;
    }
    if (!mr.cas) {
        return AssertionFailure() << "Got zero CAS for successful op";
    }
    if (value != NULL) {
        if (value != mr.single_value()) {
            return AssertionFailure() << "Expected match: '" << value << "' Got '" << mr.single_value() << "'";
        }
    } else if (!mr.single_value().empty()) {
        return AssertionFailure() << "Expected empty value. Got " << mr.single_value();
    }

    return AssertionSuccess();
}

static ::testing::AssertionResult verifySingleOk(const char *, const char *, const MultiResult &mr, const char *value)
{
    return verifySingleOk(NULL, mr, value);
}

static ::testing::AssertionResult verifySingleError(const char *, const char *, const MultiResult &mr, lcb_STATUS exp)
{
    using namespace ::testing;
    if (mr.rc != LCB_SUCCESS) {
        return AssertionFailure() << "Top-level error code is not SUCCESS. Got" << mr.rc;
    }
    if (mr.size() != 1) {
        return AssertionFailure() << "Expected single result. Got " << mr.size();
    }
    if (mr[0].rc != exp) {
        return AssertionFailure() << "Expected sub-error " << exp << ". Got << " << mr[0].rc;
    }
    return AssertionSuccess();
}

#define ASSERT_SD_OK(res) ASSERT_PRED_FORMAT1(verifySingleOk, res)
#define ASSERT_SD_VAL(res, val) ASSERT_PRED_FORMAT2(verifySingleOk, res, val)
#define ASSERT_SD_ERR(res, err) ASSERT_PRED_FORMAT2(verifySingleError, res, err)

extern "C" {
static void subdocCallback(lcb_INSTANCE *, int cbtype, const lcb_RESPSUBDOC *resp)
{
    MultiResult *mr;
    lcb_respsubdoc_cookie(resp, (void **)&mr);
    mr->rc = lcb_respsubdoc_status(resp);
    if (mr->rc == LCB_SUCCESS) {
        lcb_respsubdoc_cas(resp, &mr->cas);
    }
    size_t total = lcb_respsubdoc_result_size(resp);
    for (size_t idx = 0; idx < total; idx++) {
        mr->results.push_back(Result(resp, idx));
    }
}
}

bool SubdocUnitTest::createSubdocConnection(HandleWrap &hw, lcb_INSTANCE **instance)
{
    createConnection(hw, instance);
    lcb_install_callback(*instance, LCB_CALLBACK_SDMUTATE, (lcb_RESPCALLBACK)subdocCallback);
    lcb_install_callback(*instance, LCB_CALLBACK_SDLOOKUP, (lcb_RESPCALLBACK)subdocCallback);

    lcb_SUBDOCSPECS *specs;
    lcb_subdocspecs_create(&specs, 1);
    lcb_subdocspecs_get(specs, 0, 0, "pth", 3);

    lcb_CMDSUBDOC *cmd;
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, "key", 3);
    lcb_cmdsubdoc_specs(cmd, specs);
    MultiResult res;
    lcb_STATUS rc = lcb_subdoc(*instance, &res, cmd);
    lcb_subdocspecs_destroy(specs);
    lcb_cmdsubdoc_destroy(cmd);
    EXPECT_EQ(LCB_SUCCESS, rc);
    if (rc != LCB_SUCCESS) {
        return false;
    }
    lcb_wait(*instance, LCB_WAIT_DEFAULT);

    if (res.rc == LCB_ERR_UNSUPPORTED_OPERATION || res.rc == LCB_ERR_UNSUPPORTED_OPERATION) {
        return false;
    }

    storeKey(*instance, key, value);
    storeKey(*instance, nonJsonKey, "non-json-value");

    return true;
}

#define CREATE_SUBDOC_CONNECTION(hw, instance)                                                                         \
    do {                                                                                                               \
        if (!createSubdocConnection(hw, instance)) {                                                                   \
            fprintf(stderr, "Subdoc not supported on cluster!\n");                                                     \
            return;                                                                                                    \
        }                                                                                                              \
    } while (0);

template < typename T >
lcb_STATUS schedwait(lcb_INSTANCE *instance, MultiResult *res, const T *cmd,
                     lcb_STATUS (*fn)(lcb_INSTANCE *, void *, const T *))
{
    res->clear();
    lcb_STATUS rc = fn(instance, res, cmd);
    if (rc == LCB_SUCCESS) {
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }
    return rc;
}

static ::testing::AssertionResult verifyPathValue(const char *, const char *, const char *, const char *,
                                                  lcb_INSTANCE *instance, const std::string &docid, const char *path,
                                                  const char *exp)
{
    using namespace ::testing;
    MultiResult mr;
    lcb_SUBDOCSPECS *specs;
    lcb_subdocspecs_create(&specs, 1);
    lcb_subdocspecs_get(specs, 0, 0, path, strlen(path));
    lcb_CMDSUBDOC *cmd;
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, docid.c_str(), docid.size());
    lcb_cmdsubdoc_specs(cmd, specs);
    lcb_STATUS rc = schedwait(instance, &mr, cmd, lcb_subdoc);
    lcb_subdocspecs_destroy(specs);
    lcb_cmdsubdoc_destroy(cmd);
    if (rc != LCB_SUCCESS) {
        return AssertionFailure() << "Couldn't schedule operation: " << rc;
    }
    return verifySingleOk(NULL, NULL, mr, exp);
}

#define ASSERT_PATHVAL_EQ(exp, instance, docid, path) ASSERT_PRED_FORMAT4(verifyPathValue, instance, docid, path, exp)

TEST_F(SubdocUnitTest, testSdGetExists)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    CREATE_SUBDOC_CONNECTION(hw, &instance);

    lcb_CMDSUBDOC *cmd;
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());

    lcb_SUBDOCSPECS *specs;
    MultiResult res;

    lcb_subdocspecs_create(&specs, 1);
    lcb_cmdsubdoc_specs(cmd, specs);

    lcb_subdocspecs_get(specs, 0, 0, "dictkey", strlen("dictkey"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "\"dictval\"");
    lcb_subdocspecs_exists(specs, 0, 0, "dictkey", strlen("dictkey"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);

    lcb_subdocspecs_get(specs, 0, 0, "array", strlen("array"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "[1,2,3,4,[10,20,30,[100,200,300]]]");
    lcb_subdocspecs_exists(specs, 0, 0, "array", strlen("array"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);

    lcb_subdocspecs_get(specs, 0, 0, "array[0]", strlen("array[0]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "1");
    lcb_subdocspecs_exists(specs, 0, 0, "array[0]", strlen("array[0]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);

    lcb_subdocspecs_get(specs, 0, 0, "non-exist", strlen("non-exist"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_NOT_FOUND);
    lcb_subdocspecs_exists(specs, 0, 0, "non-exist", strlen("non-exist"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_NOT_FOUND);

    lcb_cmdsubdoc_key(cmd, "non-exist", strlen("non-exist"));

    lcb_subdocspecs_get(specs, 0, 0, "non-exist", strlen("non-exist"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, res.rc) << "Get non-exist document";
    lcb_subdocspecs_exists(specs, 0, 0, "non-exist", strlen("non-exist"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, res.rc);

    // Store non-JSON document
    lcb_cmdsubdoc_key(cmd, nonJsonKey.c_str(), nonJsonKey.size());

    lcb_subdocspecs_get(specs, 0, 0, "non-exist", strlen("non-exist"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    if (MockEnvironment::getInstance()->isRealCluster()) {
        ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON);
    } else {
        ASSERT_EQ(LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON, res.rc);
    }
    lcb_subdocspecs_exists(specs, 0, 0, "non-exist", strlen("non-exist"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    if (MockEnvironment::getInstance()->isRealCluster()) {
        ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON);
    } else {
        ASSERT_EQ(LCB_ERR_SUBDOC_DOCUMENT_NOT_JSON, res.rc);
    }

    // Restore the key back to the document..
    lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());

    // Invalid paths
    lcb_subdocspecs_get(specs, 0, 0, "invalid..path", strlen("invalid..path"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_INVALID);

    lcb_subdocspecs_get(specs, 0, 0, "invalid[-2]", strlen("invalid[-2]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_INVALID);

    // Test negative paths
    lcb_subdocspecs_get(specs, 0, 0, "array[-1][-1][-1]", strlen("array[-1][-1][-1]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "300");

    // Test nested arrays
    lcb_subdocspecs_get(specs, 0, 0, "array[4][3][2]", strlen("array[4][3][2]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "300");
    ASSERT_EQ("300", res.single_value());

    // Test path mismatch
    lcb_subdocspecs_get(specs, 0, 0, "array.key", strlen("array.key"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_MISMATCH);

    lcb_subdocspecs_destroy(specs);
    lcb_cmdsubdoc_destroy(cmd);
}

TEST_F(SubdocUnitTest, testSdStore)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    CREATE_SUBDOC_CONNECTION(hw, &instance);

    lcb_SUBDOCSPECS *spec;
    lcb_subdocspecs_create(&spec, 1);

    lcb_CMDSUBDOC *cmd;
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());

    MultiResult res;

    // Insert
    lcb_subdocspecs_dict_add(spec, 0, 0, "newpath", strlen("newpath"), "123", strlen("123"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);

    lcb_subdocspecs_dict_add(spec, 0, 0, "newpath", strlen("newpath"), "123", strlen("123"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_EXISTS);

    lcb_subdocspecs_dict_upsert(spec, 0, 0, "newpath", strlen("newpath"), "123", strlen("123"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    // See if our value actually matches
    ASSERT_PATHVAL_EQ("123", instance, key, "newpath");

    // Try with a bad CAS
    lcb_cmdsubdoc_cas(cmd, res.cas + 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_EQ(LCB_ERR_CAS_MISMATCH, res.rc);
    lcb_cmdsubdoc_cas(cmd, 0); // Reset CAS

    // Try to add a compound value
    const char *v = "{\"key\":\"value\"}";
    lcb_subdocspecs_dict_upsert(spec, 0, 0, "dict", strlen("dict"), v, strlen(v));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    // Get it back
    ASSERT_PATHVAL_EQ("\"value\"", instance, key, "dict.key");

    // Try to insert a non-JSON value
    lcb_subdocspecs_dict_upsert(spec, 0, 0, "dict", strlen("dict"), "non-json", strlen("non-json"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_VALUE_INVALID);

    const char *p = "parent.with.missing.children";

    // Intermediate paths
    lcb_subdocspecs_dict_upsert(spec, 0, 0, p, strlen(p), "null", strlen("null"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_NOT_FOUND);

    // set MKINTERMEDIATES (MKDIR_P)
    lcb_subdocspecs_dict_upsert(spec, 0, LCB_SUBDOCSPECS_F_MKINTERMEDIATES, p, strlen(p), "null", strlen("null"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    // Should succeed now..
    ASSERT_PATHVAL_EQ("null", instance, key, p);

    // Test replace
    lcb_subdocspecs_replace(spec, 0, 0, "dict", strlen("dict"), "123", strlen("123"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);

    // Try replacing a non-existing path
    lcb_subdocspecs_replace(spec, 0, 0, "not-exists", strlen("not-exists"), "123", strlen("123"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_NOT_FOUND);

    // Try replacing array element
    lcb_subdocspecs_replace(spec, 0, 0, "array[1]", strlen("array[1]"), "true", strlen("true"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    ASSERT_PATHVAL_EQ("true", instance, key, "array[1]");

    // Try replacing root element. Invalid path for operation
    lcb_subdocspecs_replace(spec, 0, 0, "", 0, "{\"foo\":42}", strlen("{\"foo\":42}"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    // See if our value actually matches
    ASSERT_PATHVAL_EQ("42", instance, key, "foo");
    lcb_cmdsubdoc_destroy(cmd);
    lcb_subdocspecs_destroy(spec);
}

TEST_F(SubdocUnitTest, testMkdoc)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_50);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    MultiResult res;

    CREATE_SUBDOC_CONNECTION(hw, &instance);

    // Remove the item first
    removeKey(instance, key);

    lcb_CMDSUBDOC *cmd;
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());
    lcb_cmdsubdoc_store_semantics(cmd, LCB_SUBDOC_STORE_UPSERT);

    lcb_SUBDOCSPECS *spec;

    lcb_subdocspecs_create(&spec, 1);
    lcb_subdocspecs_dict_upsert(spec, 0, 0, "pth", 3, "123", 3);
    lcb_cmdsubdoc_specs(cmd, spec);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_PATHVAL_EQ("123", instance, key, "pth");
    lcb_subdocspecs_destroy(spec);

    removeKey(instance, key);
    lcb_subdocspecs_create(&spec, 2);
    lcb_subdocspecs_dict_upsert(spec, 0, 0, "pth", 3, "123", 3);
    lcb_subdocspecs_dict_upsert(spec, 1, 0, "pth2", 4, "456", 3);
    lcb_cmdsubdoc_specs(cmd, spec);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    lcb_subdocspecs_destroy(spec);

    ASSERT_PATHVAL_EQ("123", instance, key, "pth");
    ASSERT_PATHVAL_EQ("456", instance, key, "pth2");

    lcb_cmdsubdoc_destroy(cmd);
}

TEST_F(SubdocUnitTest, testUnique)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    MultiResult res;

    CREATE_SUBDOC_CONNECTION(hw, &instance);

    lcb_CMDSUBDOC *cmd;

    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());

    lcb_SUBDOCSPECS *spec;
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);

    // Test array operations: ADD_UNIQUE
    lcb_subdocspecs_array_add_unique(spec, 0, LCB_SUBDOCSPECS_F_MKINTERMEDIATES, "a", strlen("a"), "1", strlen("1"));

    // Push to a non-existent array (without _P)
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    // Get the item back
    ASSERT_PATHVAL_EQ("1", instance, key, "a[0]");

    // Try adding the item again
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_EXISTS);

    // Try adding a primitive
    lcb_subdocspecs_array_add_unique(spec, 0, LCB_SUBDOCSPECS_F_MKINTERMEDIATES, "a", strlen("a"), "{}", strlen("{}"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_VALUE_INVALID);

    // Add the primitive using append
    lcb_subdocspecs_array_add_last(spec, 0, LCB_SUBDOCSPECS_F_MKINTERMEDIATES, "a", strlen("a"), "{}", strlen("{}"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    ASSERT_PATHVAL_EQ("{}", instance, key, "a[-1]");

    lcb_subdocspecs_array_add_unique(spec, 0, LCB_SUBDOCSPECS_F_MKINTERMEDIATES, "a", strlen("a"), "null",
                                     strlen("null"));
    // Add unique to array with non-primitive
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_MISMATCH);

    lcb_subdocspecs_destroy(spec);
    lcb_cmdsubdoc_destroy(cmd);
}

TEST_F(SubdocUnitTest, testCounter)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    MultiResult res;

    CREATE_SUBDOC_CONNECTION(hw, &instance);

    lcb_CMDSUBDOC *cmd;
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());

    lcb_SUBDOCSPECS *spec;
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_subdocspecs_counter(spec, 0, 0, "counter", strlen("counter"), 42);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "42");
    // Try it again
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "84");
    lcb_subdocspecs_destroy(spec);

    static const char *si64max = "9223372036854775807";
    // Use a large value
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_subdocspecs_dict_upsert(spec, 0, 0, "counter", strlen("counter"), si64max, strlen(si64max));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    ASSERT_PATHVAL_EQ(si64max, instance, key, "counter");
    lcb_subdocspecs_destroy(spec);

    // Try to increment by 1
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_subdocspecs_counter(spec, 0, 0, "counter", strlen("counter"), 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_VALUE_INVALID);
    lcb_subdocspecs_destroy(spec);

    // Try to increment by 0
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_subdocspecs_counter(spec, 0, 0, "counter", strlen("counter"), 0);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_DELTA_INVALID);
    lcb_subdocspecs_destroy(spec);

    // Try to use an already large number (so the number is too big on the server)
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    std::string biggerNum(si64max);
    biggerNum += "999999999999999999999999999999";
    lcb_subdocspecs_dict_upsert(spec, 0, 0, "counter", strlen("counter"), biggerNum.c_str(), biggerNum.size());
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    lcb_subdocspecs_destroy(spec);

    // Try the counter op again
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_subdocspecs_counter(spec, 0, 0, "counter", strlen("counter"), 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_NUMBER_TOO_BIG);
    lcb_subdocspecs_destroy(spec);

    // Try the counter op with a non-numeric existing value
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_subdocspecs_counter(spec, 0, 0, "dictkey", strlen("dictkey"), 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_ERR(res, LCB_ERR_SUBDOC_PATH_MISMATCH);
    lcb_subdocspecs_destroy(spec);

    // Reset the value again to 0
    lcb_subdocspecs_create(&spec, 1);
    lcb_cmdsubdoc_specs(cmd, spec);
    lcb_subdocspecs_dict_upsert(spec, 0, 0, "counter", strlen("counter"), "0", 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_OK(res);
    ASSERT_EQ(LCB_SUCCESS, res.rc);

    // Try decrement
    lcb_subdocspecs_counter(spec, 0, 0, "counter", strlen("counter"), -42);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_SD_VAL(res, "-42");
    // Try it again
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, cmd, lcb_subdoc));
    ASSERT_EQ(LCB_SUCCESS, res.rc);
    ASSERT_SD_VAL(res, "-84");

    lcb_subdocspecs_destroy(spec);
    lcb_cmdsubdoc_destroy(cmd);
}

TEST_F(SubdocUnitTest, testMultiLookup)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    CREATE_SUBDOC_CONNECTION(hw, &instance);

    MultiResult mr;
    lcb_STATUS rc;

    lcb_CMDSUBDOC *mcmd;
    lcb_cmdsubdoc_create(&mcmd);
    lcb_cmdsubdoc_key(mcmd, key.c_str(), key.size());

    lcb_SUBDOCSPECS *specs;
    lcb_subdocspecs_create(&specs, 4);
    lcb_cmdsubdoc_specs(mcmd, specs);

    lcb_subdocspecs_get(specs, 0, 0, "dictkey", strlen("dictkey"));
    lcb_subdocspecs_exists(specs, 1, 0, "array[0]", strlen("array[0]"));
    lcb_subdocspecs_get(specs, 2, 0, "nonexist", strlen("nonexist"));
    lcb_subdocspecs_get(specs, 3, 0, "array[1]", strlen("array[1]"));
    rc = lcb_subdoc(instance, &mr, mcmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    ASSERT_EQ(LCB_SUCCESS, mr.rc);
    ASSERT_EQ(4, mr.results.size());
    //    ASSERT_NE(0, mr.cas);

    ASSERT_EQ("\"dictval\"", mr.results[0].value);
    ASSERT_EQ(LCB_SUCCESS, mr.results[0].rc);

    ASSERT_TRUE(mr.results[1].value.empty());
    ASSERT_EQ(LCB_SUCCESS, mr.results[1].rc);

    ASSERT_TRUE(mr.results[2].value.empty());
    ASSERT_EQ(LCB_ERR_SUBDOC_PATH_NOT_FOUND, mr.results[2].rc);

    ASSERT_EQ("2", mr.results[3].value);
    ASSERT_EQ(LCB_SUCCESS, mr.results[0].rc);

    // Test multi lookups with bad command types
    lcb_subdocspecs_remove(specs, 1, 0, "array[0]", strlen("array[0]"));
    rc = lcb_subdoc(instance, NULL, mcmd);
    ASSERT_EQ(LCB_ERR_OPTIONS_CONFLICT, rc);
    // Reset it to its previous command
    lcb_subdocspecs_get(specs, 1, 0, "array[0]", strlen("array[0]"));

    // Test multi lookups with missing key
    std::string missing_key("missing-key");
    removeKey(instance, missing_key);

    mr.clear();
    lcb_cmdsubdoc_key(mcmd, missing_key.c_str(), missing_key.size());
    rc = lcb_subdoc(instance, &mr, mcmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, mr.rc);
    ASSERT_TRUE(mr.results.empty());

    lcb_subdocspecs_destroy(specs);
    lcb_cmdsubdoc_destroy(mcmd);
}

TEST_F(SubdocUnitTest, testMultiMutations)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    CREATE_SUBDOC_CONNECTION(hw, &instance);

    lcb_CMDSUBDOC *mcmd;
    lcb_cmdsubdoc_create(&mcmd);
    lcb_cmdsubdoc_key(mcmd, key.c_str(), key.size());

    lcb_SUBDOCSPECS *specs;

    MultiResult mr;
    lcb_STATUS rc;

    lcb_subdocspecs_create(&specs, 2);
    lcb_cmdsubdoc_specs(mcmd, specs);
    lcb_subdocspecs_dict_upsert(specs, 0, 0, "newPath", strlen("newPath"), "true", strlen("true"));
    lcb_subdocspecs_counter(specs, 1, 0, "counter", strlen("counter"), 42);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mr, mcmd, lcb_subdoc));
    ASSERT_EQ(LCB_SUCCESS, mr.rc);

    // COUNTER returns a value
    ASSERT_EQ(2, mr.results.size());
    ASSERT_EQ("42", mr.results[1].value);
    ASSERT_EQ(1, mr.results[1].index);
    ASSERT_EQ(LCB_SUCCESS, mr.results[1].rc);

    // Ensure the parameters were encoded correctly..
    ASSERT_PATHVAL_EQ("true", instance, key, "newPath");
    ASSERT_PATHVAL_EQ("42", instance, key, "counter");

    // New context. Try with mismatched commands
    lcb_subdocspecs_get(specs, 0, 0, "p", 1);
    rc = lcb_subdoc(instance, NULL, mcmd);
    ASSERT_EQ(LCB_ERR_OPTIONS_CONFLICT, rc);
    lcb_subdocspecs_destroy(specs);

    lcb_subdocspecs_create(&specs, 3);
    lcb_cmdsubdoc_specs(mcmd, specs);
    lcb_subdocspecs_replace(specs, 0, 0, "newPath", strlen("newPath"), "null", 4);
    lcb_subdocspecs_replace(specs, 1, 0, "nested.nonexist", strlen("nested.nonexist"), "null", 4);
    lcb_subdocspecs_replace(specs, 2, 0, "bad..bad", strlen("bad..path"), "null", 4);

    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mr, mcmd, lcb_subdoc));
    ASSERT_EQ(LCB_SUCCESS, mr.rc);
    ASSERT_EQ(3, mr.size());
    ASSERT_EQ(LCB_ERR_SUBDOC_PATH_NOT_FOUND, mr.results[1].rc);
    lcb_subdocspecs_destroy(specs);

    /* check if lcb_subdoc3 can detect mutation, and allow setting exptime */
    lcb_subdocspecs_create(&specs, 1);
    lcb_cmdsubdoc_specs(mcmd, specs);
    lcb_cmdsubdoc_expiry(mcmd, 42);
    lcb_subdocspecs_dict_upsert(specs, 0, 0, "tmpPath", strlen("tmpPath"), "null", 4);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mr, mcmd, lcb_subdoc));
    ASSERT_EQ(LCB_SUCCESS, mr.rc);
    ASSERT_EQ(1, mr.size());
    ASSERT_EQ(LCB_SUCCESS, mr.results[0].rc);
    lcb_subdocspecs_destroy(specs);

    lcb_cmdsubdoc_destroy(mcmd);
}

TEST_F(SubdocUnitTest, testGetCount)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_50);
    HandleWrap hw;
    lcb_INSTANCE *instance;
    MultiResult mres;

    CREATE_SUBDOC_CONNECTION(hw, &instance);

    lcb_CMDSUBDOC *cmd;

    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, key.c_str(), key.size());

    lcb_SUBDOCSPECS *spec;
    lcb_subdocspecs_create(&spec, 1);
    lcb_subdocspecs_get_count(spec, 0, 0, "", 0);
    lcb_cmdsubdoc_specs(cmd, spec);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mres, cmd, lcb_subdoc));
    ASSERT_SD_VAL(mres, "2");
    lcb_subdocspecs_destroy(spec);

    // Use this within an array of specs
    lcb_subdocspecs_create(&spec, 2);
    lcb_subdocspecs_get_count(spec, 0, 0, "404", 3);
    lcb_subdocspecs_get_count(spec, 1, 0, "array", strlen("array"));
    lcb_cmdsubdoc_specs(cmd, spec);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mres, cmd, lcb_subdoc));
    ASSERT_EQ(LCB_SUCCESS, mres.rc);
    ASSERT_EQ(LCB_ERR_SUBDOC_PATH_NOT_FOUND, mres.results[0].rc);
    ASSERT_EQ(LCB_SUCCESS, mres.results[1].rc);
    ASSERT_EQ("5", mres.results[1].value);
    lcb_subdocspecs_destroy(spec);

    lcb_cmdsubdoc_destroy(cmd);
}
