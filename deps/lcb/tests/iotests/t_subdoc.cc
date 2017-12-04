/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2015 Couchbase, Inc.
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
#include <libcouchbase/api3.h>
#include "iotests.h"
#include <string>

namespace std {
inline ostream& operator<<(ostream& os, const lcb_error_t& rc) {
    os << "LcbError <0x";
    os << std::hex << static_cast<unsigned>(rc);
    os << " (";
    os << lcb_strerror(NULL, rc);
    os << ")>";
    return os;
}
}

class SubdocUnitTest : public MockUnitTest {
public:
    SubdocUnitTest() {
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
    bool createSubdocConnection(HandleWrap& hw, lcb_t& instance);
};

struct Result {
    lcb_error_t rc;
    lcb_CAS cas;
    std::string value;
    int index;

    Result() {
        clear();
    }

    Result(const lcb_SDENTRY *ent) {
        assign(ent);
    }

    void clear() {
        rc = LCB_ERROR;
        cas = 0;
        index = -1;
        value.clear();
    }
    void assign(const lcb_SDENTRY *ent) {
        rc = ent->status;
        index = ent->index;
        if (ent->nvalue) {
            value.assign(reinterpret_cast<const char*>(ent->value), ent->nvalue);
        }
    }
};

struct MultiResult {
    std::vector<Result> results;
    lcb_CAS cas;
    lcb_error_t rc;
    unsigned cbtype;
    bool is_single;

    void clear() {
        cas = 0;
        results.clear();
        cbtype = 0;
        rc = LCB_AUTH_CONTINUE;
        is_single = false;
    }

    size_t size() const {
        return results.size();
    }

    const Result& operator[](size_t ix) const {
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

    const std::string& single_value() const {
        return results[0].value;
    }

    MultiResult() { clear(); }
};

static
::testing::AssertionResult
verifySingleOk(const char *, const MultiResult& mr, const char *value = NULL)
{
    using namespace ::testing;
    if (!mr.is_single) {
        return AssertionFailure() << "RESP_F_SDSINGLE not set!";
    }

    if (mr.rc != LCB_SUCCESS) {
        if (mr.rc == LCB_SUBDOC_MULTI_FAILURE) {
            if (!mr.size()) {
                return AssertionFailure() << "Top-level MULTI_FAILURE with no results";
            } else {
                return AssertionFailure() << "Got MULTI_FAILURE with sub-code: " << mr[0].rc;
            }
        }
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
            return AssertionFailure() <<
                    "Expected match: '" << value << "' Got '" << mr.single_value() << "'";
        }
    } else if (!mr.single_value().empty()) {
        return AssertionFailure() << "Expected empty value. Got " << mr.single_value();
    }

    return AssertionSuccess();
}

static
::testing::AssertionResult
verifySingleOk(const char *, const char *, const MultiResult& mr, const char *value)
{
    return verifySingleOk(NULL, mr, value);
}

static
::testing::AssertionResult
verifySingleError(const char *, const char *, const MultiResult& mr, lcb_error_t exp)
{
    using namespace ::testing;
    if (!mr.is_single) {
        return AssertionFailure() << "RESP_F_SDSINGLE not set!";
    }
    if (mr.rc != LCB_SUBDOC_MULTI_FAILURE) {
        return AssertionFailure() <<
                "Top-level error code is not MULTI_FAILURE. Got" <<
                mr.rc;
    }
    if (mr.size() != 1) {
        return AssertionFailure() << "Expected single result. Got " << mr.size();
    }
    if (mr[0].rc != exp) {
        return AssertionFailure() << "Expected sub-error " << exp << ". Got << " << mr.rc;
    }
    return AssertionSuccess();
}

#define ASSERT_SD_OK(res) ASSERT_PRED_FORMAT1(verifySingleOk, res)
#define ASSERT_SD_VAL(res, val) ASSERT_PRED_FORMAT2(verifySingleOk, res, val)
#define ASSERT_SD_ERR(res, err) ASSERT_PRED_FORMAT2(verifySingleError, res, err)

extern "C" {
static void
subdocCallback(lcb_t, int cbtype, const lcb_RESPBASE *rb)
{
    MultiResult *mr = reinterpret_cast<MultiResult*>(rb->cookie);
    const lcb_RESPSUBDOC *resp = reinterpret_cast<const lcb_RESPSUBDOC*>(rb);

    mr->rc = rb->rc;
    if (rb->rc == LCB_SUCCESS) {
        mr->cas = resp->cas;
    }
    if (resp->rflags & LCB_RESP_F_SDSINGLE) {
        mr->is_single = true;
    }
    size_t iterval = 0;
    lcb_SDENTRY cur_res;
    while (lcb_sdresult_next(resp, &cur_res, &iterval)) {
        mr->results.push_back(Result(&cur_res));
    }
}
}

bool
SubdocUnitTest::createSubdocConnection(HandleWrap& hw, lcb_t& instance)
{
    createConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_SDMUTATE, subdocCallback);
    lcb_install_callback3(instance, LCB_CALLBACK_SDLOOKUP, subdocCallback);

    lcb_SDSPEC spec = { 0 };
    lcb_CMDSUBDOC cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    cmd.specs = &spec;
    cmd.nspecs = 1;

    spec.sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&spec, "pth", 3);

    MultiResult res;
    lcb_error_t rc = lcb_subdoc3(instance, &res, &cmd);
    EXPECT_EQ(LCB_SUCCESS, rc);
    if (rc != LCB_SUCCESS) {
        return false;
    }
    lcb_wait(instance);

    if (res.rc == LCB_NOT_SUPPORTED || res.rc == LCB_UNKNOWN_COMMAND) {
        return false;
    }

    storeKey(instance, key, value);
    storeKey(instance, nonJsonKey, "non-json-value");

    return true;
}

#define CREATE_SUBDOC_CONNECTION(hw, instance) \
    do { \
        if (!createSubdocConnection(hw, instance)) { \
            fprintf(stderr, "Subdoc not supported on cluster!\n"); \
            return; \
        } \
    } while (0);

template <typename T> lcb_error_t
schedwait(lcb_t instance, MultiResult *res, const T *cmd,
    lcb_error_t (*fn)(lcb_t, const void *, const T*))
{
    res->clear();
    lcb_error_t rc = fn(instance, res, cmd);
    if (rc == LCB_SUCCESS) {
        lcb_wait(instance);
    }
    return rc;
}

static ::testing::AssertionResult
verifyPathValue(const char *, const char *, const char *, const char *,
    lcb_t instance, const std::string& docid, const char *path, const char *exp)
{
    using namespace ::testing;
    MultiResult mr;
    lcb_CMDSUBDOC cmd = { 0 };
    lcb_SDSPEC spec = { 0 };
    LCB_CMD_SET_KEY(&cmd, docid.c_str(), docid.size());
    spec.sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&spec, path, strlen(path));
    cmd.specs = &spec;
    cmd.nspecs = 1;
    lcb_error_t rc = schedwait(instance, &mr, &cmd, lcb_subdoc3);
    if (rc != LCB_SUCCESS) {
        return AssertionFailure() << "Couldn't schedule operation: " << rc;
    }
    return verifySingleOk(NULL, NULL, mr, exp);
}

#define ASSERT_PATHVAL_EQ(exp, instance, docid, path) \
        ASSERT_PRED_FORMAT4(verifyPathValue, instance, docid, path, exp)

TEST_F(SubdocUnitTest, testSdGetExists)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_t instance;
    CREATE_SUBDOC_CONNECTION(hw, instance);

    MultiResult res;
    lcb_SDSPEC spec = { 0 };
    lcb_CMDSUBDOC cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    cmd.specs = &spec;
    cmd.nspecs = 1;

    LCB_SDSPEC_SET_PATH(&spec, "dictkey", strlen("dictkey"));
    // get
    spec.sdcmd = LCB_SDCMD_GET;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "\"dictval\"");
    // exists
    spec.sdcmd = LCB_SDCMD_EXISTS;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);

    LCB_SDSPEC_SET_PATH(&spec, "array", strlen("array"));
    // get
    spec.sdcmd = LCB_SDCMD_GET;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "[1,2,3,4,[10,20,30,[100,200,300]]]");
    // exists
    spec.sdcmd = LCB_SDCMD_EXISTS;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd , lcb_subdoc3));
    ASSERT_SD_OK(res);

    LCB_SDSPEC_SET_PATH(&spec, "array[0]", strlen("array[0]"));
    // get
    spec.sdcmd = LCB_SDCMD_GET;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "1");
    // exists
    spec.sdcmd = LCB_SDCMD_EXISTS;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);

    LCB_SDSPEC_SET_PATH(&spec, "non-exist", strlen("non-exist"));
    // get
    spec.sdcmd = LCB_SDCMD_GET;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_ENOENT);
    // exists
    spec.sdcmd = LCB_SDCMD_EXISTS;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_ENOENT);

    LCB_CMD_SET_KEY(&cmd, "non-exist", strlen("non-exist"));
    // get
    spec.sdcmd = LCB_SDCMD_GET;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_EQ(LCB_KEY_ENOENT, res.rc) << "Get non-exist document";
    // exists
    spec.sdcmd = LCB_SDCMD_EXISTS;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_EQ(LCB_KEY_ENOENT, res.rc);

    // Store non-JSON document
    LCB_CMD_SET_KEY(&cmd, nonJsonKey.c_str(), nonJsonKey.size());

    // Get
    spec.sdcmd = LCB_SDCMD_GET;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_DOC_NOTJSON);
    // exists
    spec.sdcmd = LCB_SDCMD_EXISTS;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_DOC_NOTJSON);

    // Restore the key back to the document..
    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());

    // Invalid paths
    spec.sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&spec, "invalid..path", strlen("invalid..path"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_EINVAL);

    LCB_SDSPEC_SET_PATH(&spec, "invalid[-2]", strlen("invalid[-2]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_EINVAL);

    // Test negative paths
    LCB_SDSPEC_SET_PATH(&spec, "array[-1][-1][-1]", strlen("array[-1][-1][-1]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "300");

    // Test nested arrays
    LCB_SDSPEC_SET_PATH(&spec, "array[4][3][2]", strlen("array[4][3][2]"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "300");
    ASSERT_EQ("300", res.single_value());

    // Test path mismatch
    LCB_SDSPEC_SET_PATH(&spec, "array.key", strlen("array.key"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_MISMATCH);
}

TEST_F(SubdocUnitTest, testSdStore)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_t instance;
    CREATE_SUBDOC_CONNECTION(hw, instance);
    lcb_CMDSUBDOC cmd = { 0 };
    lcb_SDSPEC spec = { 0 };

    cmd.specs = &spec;
    cmd.nspecs = 1;

    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    LCB_SDSPEC_SET_PATH(&spec, "newpath", strlen("newpath"));
    LCB_SDSPEC_SET_VALUE(&spec, "123", strlen("123"));
    MultiResult res;

    // Insert
    spec.sdcmd = LCB_SDCMD_DICT_ADD;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);

    spec.sdcmd = LCB_SDCMD_DICT_ADD;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_EEXISTS);

    spec.sdcmd = LCB_SDCMD_DICT_UPSERT;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    // See if our value actually matches
    ASSERT_PATHVAL_EQ("123", instance, key, "newpath");

    // Try with a bad CAS
    cmd.cas = res.cas + 1;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_EQ(LCB_KEY_EEXISTS, res.rc);
    cmd.cas = 0; // Reset CAS

    // Try to add a compound value
    LCB_SDSPEC_SET_PATH(&spec, "dict", strlen("dict"));
    const char *v = "{\"key\":\"value\"}";
    LCB_SDSPEC_SET_VALUE(&spec, v, strlen(v));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    // Get it back
    ASSERT_PATHVAL_EQ("\"value\"", instance, key, "dict.key");

    // Try to insert a non-JSON value
    LCB_SDSPEC_SET_VALUE(&spec, "non-json", strlen("non-json"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_VALUE_CANTINSERT);

    const char *p = "parent.with.missing.children";

    // Intermediate paths
    LCB_SDSPEC_SET_PATH(&spec, p, strlen(p));
    LCB_SDSPEC_SET_VALUE(&spec, "null", strlen("null"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_ENOENT);

    // set MKINTERMEDIATES (MKDIR_P)
    spec.options = LCB_SDSPEC_F_MKINTERMEDIATES;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    // Should succeed now..
    ASSERT_PATHVAL_EQ("null", instance, key, p);

    spec.options = 0;
    // Test replace
    spec.sdcmd = LCB_SDCMD_REPLACE;
    LCB_SDSPEC_SET_PATH(&spec, "dict", strlen("dict"));
    LCB_SDSPEC_SET_VALUE(&spec, "123", strlen("123"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);

    // Try replacing a non-existing path
    LCB_SDSPEC_SET_PATH(&spec, "non-exist", strlen("non-exist"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_ENOENT);

    // Try replacing root element. Invalid path for operation
    LCB_SDSPEC_SET_PATH(&spec, "", 0);
    ASSERT_EQ(LCB_EMPTY_PATH, schedwait(instance, &res, &cmd, lcb_subdoc3));

    // Try replacing array element
    LCB_SDSPEC_SET_PATH(&spec, "array[1]", strlen("array[1]"));
    LCB_SDSPEC_SET_VALUE(&spec, "true", strlen("true"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    ASSERT_PATHVAL_EQ("true", instance, key, "array[1]");
}

TEST_F(SubdocUnitTest, testMkdoc) {
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_50);
    HandleWrap hw;
    lcb_t instance;
    lcb_CMDSUBDOC cmd = { 0 };
    lcb_SDSPEC spec[2] = {{0}};
    MultiResult res;

    CREATE_SUBDOC_CONNECTION(hw, instance);

    // Remove the item first
    removeKey(instance, key);

    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    cmd.specs = spec;
    cmd.nspecs = 1;
    cmd.cmdflags = LCB_CMDSUBDOC_F_UPSERT_DOC;

    LCB_SDSPEC_SET_PATH(&spec[0], "pth", 3);
    LCB_SDSPEC_SET_VALUE(&spec[0], "123", 3);
    spec[0].sdcmd = LCB_SDCMD_DICT_UPSERT;

    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));

    ASSERT_PATHVAL_EQ("123", instance, key, "pth");

    removeKey(instance, key);
    LCB_SDSPEC_SET_PATH(&spec[1], "pth2", 4);
    LCB_SDSPEC_SET_VALUE(&spec[1], "456", 3);
    spec[1].sdcmd = LCB_SDCMD_DICT_UPSERT;
    cmd.nspecs = 2;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));

    ASSERT_PATHVAL_EQ("123", instance, key, "pth");
    ASSERT_PATHVAL_EQ("456", instance, key, "pth2");
}

TEST_F(SubdocUnitTest, testUnique)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_t instance;
    lcb_CMDSUBDOC cmd = { 0 };
    lcb_SDSPEC spec = { 0 };
    MultiResult res;

    CREATE_SUBDOC_CONNECTION(hw, instance);

    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    cmd.specs = &spec;
    cmd.nspecs = 1;

    // Test array operations: ADD_UNIQUE
    LCB_SDSPEC_SET_PATH(&spec, "a", strlen("a"));
    LCB_SDSPEC_SET_VALUE(&spec, "1", strlen("1"));
    spec.sdcmd = LCB_SDCMD_ARRAY_ADD_UNIQUE;
    spec.options |= LCB_SDSPEC_F_MKINTERMEDIATES;

    // Push to a non-existent array (without _P)
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    cmd.cmdflags = 0;

    // Get the item back
    ASSERT_PATHVAL_EQ("1", instance, key, "a[0]");

    // Try adding the item again
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_EEXISTS);

    // Try adding a primitive
    LCB_SDSPEC_SET_VALUE(&spec, "{}", strlen("{}"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_VALUE_CANTINSERT);

    // Add the primitive using append
    spec.sdcmd = LCB_SDCMD_ARRAY_ADD_LAST;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    ASSERT_PATHVAL_EQ("{}", instance, key, "a[-1]");

    spec.sdcmd = LCB_SDCMD_ARRAY_ADD_UNIQUE;
    LCB_SDSPEC_SET_VALUE(&spec, "null", strlen("null"));
    // Add unique to array with non-primitive
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_MISMATCH);
}

TEST_F(SubdocUnitTest, testCounter)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_t instance;
    lcb_CMDSUBDOC cmd = { 0 };
    lcb_SDSPEC spec = { 0 };
    MultiResult res;

    CREATE_SUBDOC_CONNECTION(hw, instance);
    cmd.specs = &spec;
    cmd.nspecs = 1;

    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    LCB_SDSPEC_SET_PATH(&spec, "counter", strlen("counter"));
    LCB_SDSPEC_SET_VALUE(&spec, "42", 2);
    spec.sdcmd = LCB_SDCMD_COUNTER;

    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "42");
    // Try it again
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "84");

    static const char *si64max = "9223372036854775807";
    // Use a large value
    LCB_SDSPEC_SET_VALUE(&spec, si64max, strlen(si64max));
    spec.sdcmd = LCB_SDCMD_DICT_UPSERT;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    ASSERT_PATHVAL_EQ(si64max, instance, key, "counter");

    // Try to increment by 1
    spec.sdcmd = LCB_SDCMD_COUNTER;
    LCB_SDSPEC_SET_VALUE(&spec, "1", 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_VALUE_CANTINSERT);

    // Try to increment by 0
    spec.sdcmd = LCB_SDCMD_COUNTER;
    LCB_SDSPEC_SET_VALUE(&spec, "0", 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_BAD_DELTA);

    // Try to use an already large number (so the number is too big on the server)
    std::string biggerNum(si64max);
    biggerNum += "999999999999999999999999999999";
    LCB_SDSPEC_SET_VALUE(&spec, biggerNum.c_str(), biggerNum.size());
    spec.sdcmd = LCB_SDCMD_DICT_UPSERT;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);

    // Try the counter op again
    LCB_SDSPEC_SET_VALUE(&spec, "1", 1);
    spec.sdcmd = LCB_SDCMD_COUNTER;
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_NUM_ERANGE);

    // Try the counter op with a non-numeric existing value
    LCB_SDSPEC_SET_PATH(&spec, "dictkey", strlen("dictkey"));
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_ERR(res, LCB_SUBDOC_PATH_MISMATCH);

    // Reset the value again to 0
    spec.sdcmd = LCB_SDCMD_DICT_UPSERT;
    LCB_SDSPEC_SET_PATH(&spec, "counter", strlen("counter"));
    LCB_SDSPEC_SET_VALUE(&spec, "0", 1);
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_OK(res);
    ASSERT_EQ(LCB_SUCCESS, res.rc);

    // Try decrement
    spec.sdcmd = LCB_SDCMD_COUNTER;
    LCB_SDSPEC_SET_PATH(&spec, "counter", strlen("counter"));
    LCB_SDSPEC_SET_VALUE(&spec, "-42", 3)
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(res, "-42");
    // Try it again
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &res, &cmd, lcb_subdoc3));
    ASSERT_EQ(LCB_SUCCESS, res.rc);
    ASSERT_SD_VAL(res, "-84");
}

TEST_F(SubdocUnitTest, testMultiLookup)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_t instance;
    CREATE_SUBDOC_CONNECTION(hw, instance);

    MultiResult mr;
    lcb_error_t rc;

    lcb_CMDSUBDOC mcmd = { 0 };
    mcmd.multimode = LCB_SDMULTI_MODE_LOOKUP;
    LCB_CMD_SET_KEY(&mcmd, key.c_str(), key.size());

    lcb_SDSPEC specs[4] = { { 0 } };
    specs[0].sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&specs[0], "dictkey", strlen("dictkey"));

    specs[1].sdcmd = LCB_SDCMD_EXISTS;
    LCB_SDSPEC_SET_PATH(&specs[1], "array[0]", strlen("array[0]"));

    specs[2].sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&specs[2], "nonexist", strlen("nonexist"));

    specs[3].sdcmd = LCB_SDCMD_GET;
    LCB_SDSPEC_SET_PATH(&specs[3], "array[1]", strlen("array[1]"));

    mcmd.specs = specs;
    mcmd.nspecs = 4;
    rc = lcb_subdoc3(instance, &mr, &mcmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);

    ASSERT_EQ(LCB_SUBDOC_MULTI_FAILURE, mr.rc);
    ASSERT_EQ(4, mr.results.size());
//    ASSERT_NE(0, mr.cas);

    ASSERT_EQ("\"dictval\"", mr.results[0].value);
    ASSERT_EQ(LCB_SUCCESS, mr.results[0].rc);

    ASSERT_TRUE(mr.results[1].value.empty());
    ASSERT_EQ(LCB_SUCCESS, mr.results[1].rc);

    ASSERT_TRUE(mr.results[2].value.empty());
    ASSERT_EQ(LCB_SUBDOC_PATH_ENOENT, mr.results[2].rc);

    ASSERT_EQ("2", mr.results[3].value);
    ASSERT_EQ(LCB_SUCCESS, mr.results[0].rc);

    // Test multi lookups with bad command types
    int erridx = 0;
    specs[1].sdcmd = LCB_SDCMD_REMOVE;
    mcmd.error_index = &erridx;
    rc = lcb_subdoc3(instance, NULL, &mcmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, rc);
    ASSERT_EQ(1, erridx);
    // Reset it to its previous command
    specs[1].sdcmd = LCB_SDCMD_GET;

    // Test multi lookups with missing key
    std::string missing_key("missing-key");
    removeKey(instance, missing_key);

    mr.clear();
    LCB_CMD_SET_KEY(&mcmd, missing_key.c_str(), missing_key.size());
    rc = lcb_subdoc3(instance, &mr, &mcmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);
    ASSERT_EQ(LCB_KEY_ENOENT, mr.rc);
    ASSERT_TRUE(mr.results.empty());
}

TEST_F(SubdocUnitTest, testMultiMutations)
{
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_45);
    HandleWrap hw;
    lcb_t instance;
    CREATE_SUBDOC_CONNECTION(hw, instance);

    lcb_CMDSUBDOC mcmd = { 0 };
    std::vector<lcb_SDSPEC> specs;
    LCB_CMD_SET_KEY(&mcmd, key.c_str(), key.size());
    mcmd.multimode = LCB_SDMULTI_MODE_MUTATE;

    MultiResult mr;
    lcb_error_t rc;

    lcb_SDSPEC spec = { 0 };
    LCB_SDSPEC_SET_PATH(&spec, "newPath", strlen("newPath"));
    LCB_SDSPEC_SET_VALUE(&spec, "true", strlen("true"));
    spec.sdcmd = LCB_SDCMD_DICT_UPSERT;
    specs.push_back(spec);

    LCB_SDSPEC_SET_PATH(&spec, "counter", strlen("counter"));
    LCB_SDSPEC_SET_VALUE(&spec, "42", 2)
    spec.sdcmd = LCB_SDCMD_COUNTER;
    specs.push_back(spec);
    mcmd.specs = &specs[0];
    mcmd.nspecs = specs.size();
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mr, &mcmd, lcb_subdoc3));
    ASSERT_EQ(LCB_SUCCESS, mr.rc);

    // COUNTER returns a value
    ASSERT_EQ(1, mr.results.size());
    ASSERT_EQ("42", mr.results[0].value);
    ASSERT_EQ(1, mr.results[0].index);
    ASSERT_EQ(LCB_SUCCESS, mr.results[0].rc);

    // Ensure the parameters were encoded correctly..
    ASSERT_PATHVAL_EQ("true", instance, key, "newPath");
    ASSERT_PATHVAL_EQ("42", instance, key, "counter");

    // New context. Try with mismatched commands
    specs.clear();

    LCB_SDSPEC_INIT(&spec, LCB_SDCMD_GET, "p", 1, NULL, 0);
    specs.push_back(spec);
    int error_index = 0;
    mcmd.error_index = &error_index;
    mcmd.specs = &specs[0];
    mcmd.nspecs = specs.size();
    rc = lcb_subdoc3(instance, NULL, &mcmd);
    ASSERT_EQ(LCB_OPTIONS_CONFLICT, rc);
    ASSERT_EQ(0, error_index);

    specs.clear();
    LCB_SDSPEC_INIT(&spec, LCB_SDCMD_REPLACE, "newPath", strlen("newPath"), "null", 4);
    specs.push_back(spec);
    LCB_SDSPEC_SET_PATH(&spec, "nested.nonexist", strlen("nested.nonexist"));
    specs.push_back(spec);
    LCB_SDSPEC_SET_PATH(&spec, "bad..bad", strlen("bad..path"));
    specs.push_back(spec);

    mcmd.specs = &specs[0];
    mcmd.nspecs = specs.size();
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mr, &mcmd, lcb_subdoc3));
    ASSERT_EQ(LCB_SUBDOC_MULTI_FAILURE, mr.rc);
    ASSERT_EQ(1, mr.size());
    ASSERT_EQ(LCB_SUBDOC_PATH_ENOENT, mr.results[0].rc);
    ASSERT_EQ(1, mr.results[0].index);

    /* check if lcb_subdoc3 can detect mutation, and allow setting exptime */
    specs.clear();
    mcmd.multimode = 0;
    mcmd.exptime = 42;

    LCB_SDSPEC_INIT(&spec, LCB_SDCMD_DICT_UPSERT, "tmpPath", strlen("tmpPath"), "null", 4);
    specs.push_back(spec);
    mcmd.specs = &specs[0];
    mcmd.nspecs = specs.size();
    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mr, &mcmd, lcb_subdoc3));
    ASSERT_EQ(LCB_SUCCESS, mr.rc);
    ASSERT_EQ(1, mr.size());
    ASSERT_EQ(LCB_SUCCESS, mr.results[0].rc);
}

TEST_F(SubdocUnitTest, testGetCount) {
    SKIP_IF_CLUSTER_VERSION_IS_LOWER_THAN(MockEnvironment::VERSION_50);
    HandleWrap hw;
    lcb_t instance;
    lcb_CMDSUBDOC cmd = { 0 };
    lcb_SDSPEC spec = { 0 };
    MultiResult mres;

    CREATE_SUBDOC_CONNECTION(hw, instance);
    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());

    cmd.specs = &spec;
    cmd.nspecs = 1;
    LCB_SDSPEC_SET_PATH(&spec, "", 0);
    spec.sdcmd = LCB_SDCMD_GET_COUNT;

    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mres, &cmd, lcb_subdoc3));
    ASSERT_SD_VAL(mres, "2");

    // Use this within an array of specs
    lcb_SDSPEC specs[2];
    memset(specs, 0, sizeof specs);
    cmd.specs = specs;
    cmd.nspecs = 2;

    LCB_SDSPEC_SET_PATH(&specs[0], "404", 3);
    specs[0].sdcmd = LCB_SDCMD_GET_COUNT;
    LCB_SDSPEC_SET_PATH(&specs[1], "array", strlen("array"));
    specs[1].sdcmd = LCB_SDCMD_GET_COUNT;

    ASSERT_EQ(LCB_SUCCESS, schedwait(instance, &mres, &cmd, lcb_subdoc3));
    ASSERT_EQ(LCB_SUBDOC_MULTI_FAILURE, mres.rc);

    ASSERT_EQ(LCB_SUBDOC_PATH_ENOENT, mres.results[0].rc);
    ASSERT_EQ(LCB_SUCCESS, mres.results[1].rc);
    ASSERT_EQ("5", mres.results[1].value);
}
