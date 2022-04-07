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
#ifndef TESTS_TESTUTIL_H
#define TESTS_TESTUTIL_H 1

#include <libcouchbase/couchbase.h>
#include <libcouchbase/vbucket.h>
#include <string>
#include <memory>
#include <unordered_map>

#define ASSERT_STATUS_EQ(expected, actual)                                                                             \
    lcb_STATUS GTEST_CONCAT_TOKEN_(actual_code__, __LINE__) = (actual);                                                \
    ASSERT_EQ(expected, GTEST_CONCAT_TOKEN_(actual_code__, __LINE__))                                                  \
        << lcb_strerror_short(expected) << " != " << lcb_strerror_short(GTEST_CONCAT_TOKEN_(actual_code__, __LINE__))

#define EXPECT_STATUS_EQ(expected, actual)                                                                             \
    lcb_STATUS GTEST_CONCAT_TOKEN_(actual_code__, __LINE__) = (actual);                                                \
    EXPECT_EQ(expected, GTEST_CONCAT_TOKEN_(actual_code__, __LINE__))                                                  \
        << lcb_strerror_short(expected) << " != " << lcb_strerror_short(GTEST_CONCAT_TOKEN_(actual_code__, __LINE__))

struct Item {
    void assign(const lcb_RESPGET *resp)
    {
        err = lcb_respget_status(resp);

        const char *p;
        size_t n;

        lcb_respget_key(resp, &p, &n);
        key.assign(p, n);
        lcb_respget_value(resp, &p, &n);
        val.assign(p, n);
        lcb_respget_flags(resp, &flags);
        lcb_respget_cas(resp, &cas);
        lcb_respget_datatype(resp, &datatype);
    }

    void assign(const lcb_RESPSTORE *resp)
    {
        err = lcb_respstore_status(resp);

        const char *p;
        size_t n;

        lcb_respstore_key(resp, &p, &n);
        key.assign(p, n);
        lcb_respstore_cas(resp, &cas);
    }

    void assign(const lcb_RESPREMOVE *resp)
    {
        err = lcb_respremove_status(resp);

        const char *p;
        size_t n;

        lcb_respremove_key(resp, &p, &n);
        key.assign(p, n);
        lcb_respremove_cas(resp, &cas);
    }

    /**
     * Extract the key and CAS from a response.
     */
    template <typename T>
    void assignKC(const T *resp)
    {
        key.assign((const char *)resp->key, resp->nkey);
        cas = resp->cas;
        err = resp->ctx.rc;
    }

    Item()
    {
        key.clear();
        val.clear();

        err = LCB_SUCCESS;
        flags = 0;
        cas = 0;
        datatype = 0;
        exp = 0;
    }

    explicit Item(const std::string &key, const std::string &value = "", uint64_t cas = 0)
    {

        this->key = key;
        this->val = value;
        this->cas = cas;

        flags = 0;
        datatype = 0;
        exp = 0;
    }

    friend std::ostream &operator<<(std::ostream &out, const Item &item);

    /**
     * Dump the string representation of the item to standard output
     */
    void dump() const
    {
        std::cout << *this;
    }

    std::string key;
    std::string val;
    lcb_uint32_t flags;
    uint64_t cas;
    uint8_t datatype;
    lcb_STATUS err{};
    lcb_time_t exp{0};
};

struct KVOperation {
    /** The resultant item */
    Item result;

    /** The request item */
    const Item *request;

    /** whether the callback was at all received */
    unsigned callCount;

    /** Acceptable errors during callback */
    std::set<lcb_STATUS> allowableErrors;

    /** Errors received from error handler */
    std::set<lcb_STATUS> globalErrors;

    void assertOk(lcb_STATUS err);

    explicit KVOperation(const Item *request)
    {
        this->request = request;
        this->ignoreErrors = false;
        callCount = 0;
    }

    void clear()
    {
        result = Item();
        callCount = 0;
        allowableErrors.clear();
        globalErrors.clear();
    }

    void store(lcb_INSTANCE *instance);
    void get(lcb_INSTANCE *instance);
    void remove(lcb_INSTANCE *instance);

    void cbCommon(lcb_STATUS error)
    {
        callCount++;
        if (error != LCB_SUCCESS) {
            globalErrors.insert(error);
        }
        assertOk(error);
    }

    static void handleInstanceError(lcb_INSTANCE *, lcb_STATUS, const char *);
    bool ignoreErrors;

  private:
    void enter(lcb_INSTANCE *);
    void leave(lcb_INSTANCE *);
    const void *oldCookie{};

    struct {
        lcb_RESPCALLBACK get;
        lcb_RESPCALLBACK store;
        lcb_RESPCALLBACK rm;
    } callbacks{};
};

void storeKey(lcb_INSTANCE *instance, const std::string &key, const std::string &value);
void removeKey(lcb_INSTANCE *instance, const std::string &key);
void getKey(lcb_INSTANCE *instance, const std::string &key, Item &item);

/**
 * Generate keys which will trigger all the servers in the map.
 */
void genDistKeys(lcbvb_CONFIG *vbc, std::vector<std::string> &out);
void genStoreCommands(const std::vector<std::string> &keys, std::vector<lcb_CMDSTORE *> &cmds);
/**
 * This doesn't _actually_ attempt to make sense of an operation. It simply
 * will try to keep the event loop alive.
 */
void doDummyOp(lcb_INSTANCE *instance);

void create_scope(lcb_INSTANCE *instance, const std::string &scope, bool wait = true);

void create_collection(lcb_INSTANCE *instance, const std::string &scope, const std::string &collection,
                       bool wait = true);

void drop_scope(lcb_INSTANCE *instance, const std::string &scope, bool wait = true);

void drop_collection(lcb_INSTANCE *instance, const std::string &scope, const std::string &collection, bool wait = true);

std::string unique_name(const std::string &);

class TestSpan
{
  public:
    explicit TestSpan(std::string name);
    void SetAttribute(std::string key, std::string value);
    void SetAttribute(std::string key, uint64_t value);
    void End();

    std::unordered_map<std::string, std::string> str_tags{};
    std::unordered_map<std::string, uint64_t> int_tags{};
    bool finished{false};
    std::string name{};

    TestSpan *parent{nullptr};
};

class TestTracer
{
  public:
    TestTracer() = default;
    ~TestTracer();
    std::shared_ptr<TestSpan> StartSpan(std::string name);

    std::vector<std::shared_ptr<TestSpan>> spans{};

    void reset();

    bool set_enabled(bool new_value)
    {
        bool old_value = enabled_;
        enabled_ = new_value;

        reset();
        destroy_lcb_tracer();
        if (new_value) {
            create_lcb_tracer();
        }
        return old_value;
    }

    bool enabled() const
    {
        return enabled_;
    }

    lcbtrace_TRACER *lcb_tracer()
    {
        return lcbtracer_;
    }

  private:
    void create_lcb_tracer();
    void destroy_lcb_tracer();

    lcbtrace_TRACER *lcbtracer_{nullptr};
    bool enabled_{false};
};

class TestValueRecorder
{
  public:
    TestValueRecorder() = default;
    void RecordValue(uint64_t value);

    std::vector<uint64_t> values{};
};

class TestMeter
{
  public:
    TestMeter();
    void reset();
    std::shared_ptr<TestValueRecorder> ValueRecorder(std::string name,
                                                     std::unordered_map<std::string, std::string> tags);

    std::unordered_map<std::string, std::shared_ptr<TestValueRecorder>> recorders{};

    bool set_enabled(bool new_value)
    {
        bool old_value = enabled_;
        enabled_ = new_value;

        reset();
        destroy_lcb_meter();
        if (new_value) {
            create_lcb_meter();
        }
        return old_value;
    }

    bool enabled() const
    {
        return enabled_;
    }

    lcbmetrics_METER *lcb_meter()
    {
        return lcbmeter_;
    }

  private:
    void create_lcb_meter();
    void destroy_lcb_meter();

    lcbmetrics_METER *lcbmeter_{nullptr};
    bool enabled_{false};
};

struct kv_rate_limits {
    uint32_t num_connections{0};
    uint32_t num_ops_per_min{0};
    uint32_t ingress_mib_per_min{0};
    uint32_t egress_mib_per_min{0};
    bool enforce{false};
};

struct query_rate_limits {
    uint32_t ingress_mib_per_min{0};
    uint32_t egress_mib_per_min{0};
    uint32_t num_concurrent_requests{0};
    uint32_t num_queries_per_min{0};
    bool enforce{false};
};

struct search_rate_limits {
    uint32_t ingress_mib_per_min{0};
    uint32_t egress_mib_per_min{0};
    uint32_t num_concurrent_requests{0};
    uint32_t num_queries_per_min{0};
    bool enforce{false};
};

struct rate_limits {
    kv_rate_limits kv_limits{};
    query_rate_limits query_limits{};
    search_rate_limits search_limits{};
};

struct kv_scope_rate_limits {
    uint32_t data_size;
    bool enforce{false};
};

struct index_scope_rate_limits {
    uint32_t num_indexes{0};
    bool enforce{false};
};

struct scope_rate_limits {
    kv_scope_rate_limits kv_scope_limits;
    index_scope_rate_limits index_scope_limits;
};

void enforce_rate_limits(lcb_INSTANCE *instance);
void create_rate_limited_user(lcb_INSTANCE *instance, const std::string &username, const rate_limits &limits);
void drop_user(lcb_INSTANCE *instance, const std::string &username);
void create_rate_limited_scope(lcb_INSTANCE *instance, const std::string &bucket, std::string &scope,
                               const scope_rate_limits &limits);
void create_search_index(lcb_INSTANCE *instance, const std::string &index_name, const std::string &type,
                         const std::string &source_type, const std::string &source_name);

#endif
