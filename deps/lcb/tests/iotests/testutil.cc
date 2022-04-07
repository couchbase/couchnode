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

#include "mock-unit-test.h"
#include "testutil.h"
#include <map>
#include <libcouchbase/utils.h>
#include "rnd.h"

/*
 * Helper functions
 */
extern "C" {
static void storeKvoCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPSTORE *resp)
{
    KVOperation *kvo;
    lcb_respstore_cookie(resp, (void **)&kvo);
    kvo->cbCommon(lcb_respstore_status(resp));
    kvo->result.assign(resp);
    lcb_STORE_OPERATION op;
    lcb_respstore_operation(resp, &op);
    ASSERT_EQ(LCB_STORE_UPSERT, op);
}

static void getKvoCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPGET *resp)
{
    KVOperation *kvo;
    lcb_respget_cookie(resp, (void **)&kvo);
    kvo->cbCommon(lcb_respget_status(resp));
    kvo->result.assign(resp);
}

static void removeKvoCallback(lcb_INSTANCE *, lcb_CALLBACK_TYPE, const lcb_RESPREMOVE *resp)
{
    KVOperation *kvo;
    lcb_respremove_cookie(resp, (void **)&kvo);
    kvo->cbCommon(lcb_respremove_status(resp));
    kvo->result.assign(resp);
}
}

void KVOperation::handleInstanceError(lcb_INSTANCE *instance, lcb_STATUS err, const char *)
{
    auto *kvo = reinterpret_cast<KVOperation *>(const_cast<void *>(lcb_get_cookie(instance)));
    kvo->assertOk(err);
    kvo->globalErrors.insert(err);
}

void KVOperation::enter(lcb_INSTANCE *instance)
{
    callbacks.get = lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)getKvoCallback);
    callbacks.rm = lcb_install_callback(instance, LCB_CALLBACK_REMOVE, (lcb_RESPCALLBACK)removeKvoCallback);
    callbacks.store = lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)storeKvoCallback);
    oldCookie = lcb_get_cookie(instance);
    lcb_set_cookie(instance, this);
}

void KVOperation::leave(lcb_INSTANCE *instance)
{
    lcb_install_callback(instance, LCB_CALLBACK_GET, callbacks.get);
    lcb_install_callback(instance, LCB_CALLBACK_REMOVE, callbacks.rm);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, callbacks.store);
    lcb_set_cookie(instance, oldCookie);
}

void KVOperation::assertOk(lcb_STATUS err)
{
    if (ignoreErrors) {
        return;
    }

    if (allowableErrors.empty()) {
        ASSERT_STATUS_EQ(LCB_SUCCESS, err);
        return;
    }
    ASSERT_TRUE(allowableErrors.find(err) != allowableErrors.end())
        << "Unable to find " << lcb_strerror_short(err) << " in allowable errors";
}

void KVOperation::store(lcb_INSTANCE *instance)
{
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, request->key.data(), request->key.length());
    lcb_cmdstore_value(cmd, request->val.data(), request->val.length());
    lcb_cmdstore_flags(cmd, request->flags);
    lcb_cmdstore_expiry(cmd, request->exp);
    lcb_cmdstore_cas(cmd, request->cas);
    lcb_cmdstore_datatype(cmd, request->datatype);

    enter(instance);
    EXPECT_EQ(LCB_SUCCESS, lcb_store(instance, this, cmd));
    lcb_cmdstore_destroy(cmd);
    EXPECT_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    leave(instance);

    ASSERT_EQ(1, callCount);
}

void KVOperation::remove(lcb_INSTANCE *instance)
{
    lcb_CMDREMOVE *cmd;
    lcb_cmdremove_create(&cmd);
    lcb_cmdremove_key(cmd, request->key.data(), request->key.length());

    enter(instance);
    EXPECT_EQ(LCB_SUCCESS, lcb_remove(instance, this, cmd));
    lcb_cmdremove_destroy(cmd);
    EXPECT_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    leave(instance);

    ASSERT_EQ(1, callCount);
}

void KVOperation::get(lcb_INSTANCE *instance)
{
    lcb_CMDGET *cmd;
    lcb_cmdget_create(&cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdget_key(cmd, request->key.data(), request->key.length()));
    if (request->exp > 0) {
        ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_cmdget_expiry(cmd, request->exp));
    }

    enter(instance);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_get(instance, this, cmd));
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    leave(instance);

    lcb_cmdget_destroy(cmd);

    ASSERT_EQ(1, callCount);
}

void storeKey(lcb_INSTANCE *instance, const std::string &key, const std::string &value)
{
    Item req = Item(key, value);
    KVOperation kvo = KVOperation(&req);
    kvo.store(instance);
}

void removeKey(lcb_INSTANCE *instance, const std::string &key)
{
    Item req = Item();
    req.key = key;
    KVOperation kvo = KVOperation(&req);
    kvo.allowableErrors.insert(LCB_SUCCESS);
    kvo.allowableErrors.insert(LCB_ERR_DOCUMENT_NOT_FOUND);
    kvo.remove(instance);
}

void getKey(lcb_INSTANCE *instance, const std::string &key, Item &item)
{
    Item req = Item();
    req.key = key;
    KVOperation kvo = KVOperation(&req);
    kvo.result.cas = 0xdeadbeef;

    kvo.get(instance);
    ASSERT_NE(0xdeadbeef, kvo.result.cas);
    item = kvo.result;
}

void genDistKeys(lcbvb_CONFIG *vbc, std::vector<std::string> &out)
{
    char buf[1024] = {'\0'};
    int servers_max = lcbvb_get_nservers(vbc);
    std::map<int, bool> found_servers;
    EXPECT_TRUE(servers_max > 0);

    for (int cur_num = 0; found_servers.size() != servers_max; cur_num++) {
        int ksize = sprintf(buf, "VBKEY_%d", cur_num);
        int vbid;
        int srvix;
        lcbvb_map_key(vbc, buf, ksize, &vbid, &srvix);

        if (!found_servers[srvix]) {
            out.emplace_back(buf);
            found_servers[srvix] = true;
        }
    }

    EXPECT_EQ(servers_max, out.size());
}

void genStoreCommands(const std::vector<std::string> &keys, std::vector<lcb_CMDSTORE *> &cmds)
{
    for (const auto &key : keys) {
        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key.c_str(), key.size());
        lcb_cmdstore_value(cmd, key.c_str(), key.size());
        cmds.push_back(cmd);
    }
}

/**
 * This doesn't _actually_ attempt to make sense of an operation. It simply
 * will try to keep the event loop alive.
 */
void doDummyOp(lcb_INSTANCE *instance)
{
    Item itm("foo", "bar");
    KVOperation kvo(&itm);
    kvo.ignoreErrors = true;
    kvo.store(instance);
}

/**
 * Dump the item object to a stream
 * @param out where to dump the object to
 * @param item the item to print
 * @return the stream
 */
std::ostream &operator<<(std::ostream &out, const Item &item)
{
    using namespace std;
    out << "Key: " << item.key << endl;
    if (item.val.length()) {
        out << "Value: " << item.val << endl;
    }

    out << ios::hex << "CAS: 0x" << item.cas << endl << "Flags: 0x" << item.flags << endl;

    if (item.err != LCB_SUCCESS) {
        out << "Error: " << item.err << endl;
    }

    return out;
}

struct http_result {
    lcb_STATUS rc{LCB_SUCCESS};
    uint16_t status{0};
    std::string path{};
    std::string body{};
    std::map<std::string, std::string> headers{};
};

struct manifest_result {
    lcb_STATUS rc{LCB_SUCCESS};
    std::string value{};
};

extern "C" {
static void http_callback(lcb_INSTANCE * /* instance */, int /* cbtype */, const lcb_RESPHTTP *resp)
{
    http_result *result = nullptr;
    lcb_resphttp_cookie(resp, reinterpret_cast<void **>(&result));

    result->rc = lcb_resphttp_status(resp);

    const char *body = nullptr;
    size_t nbody = 0;
    lcb_resphttp_body(resp, &body, &nbody);
    result->body.assign(body, nbody);

    const char *path = nullptr;
    size_t npath = 0;
    lcb_resphttp_path(resp, &path, &npath);
    result->path.assign(path, npath);

    lcb_resphttp_http_status(resp, &result->status);

    const char *const *headers = nullptr;
    lcb_resphttp_headers(resp, &headers);
    for (; headers && *headers; headers++) {
        const char *key = *headers;
        const char *value = nullptr;
        if (headers + 1) {
            value = *(++headers);
            result->headers.emplace(key, value);
        }
    }

    EXPECT_EQ(200, result->status) << result->path << ": " << result->body;
}

static void get_manifest_callback(lcb_INSTANCE *, int, const lcb_RESPGETMANIFEST *resp)
{
    manifest_result *result = nullptr;
    lcb_respgetmanifest_cookie(resp, reinterpret_cast<void **>(&result));

    result->rc = lcb_respgetmanifest_status(resp);
    if (result->rc == LCB_SUCCESS) {
        const char *value;
        size_t nvalue;
        lcb_respgetmanifest_value(resp, &value, &nvalue);
        result->value.assign(value, nvalue);
    }
}
}

static std::uint64_t get_manifest_id(lcb_INSTANCE *instance)
{
    lcb_install_callback(instance, LCB_CALLBACK_COLLECTIONS_GET_MANIFEST, (lcb_RESPCALLBACK)get_manifest_callback);

    lcb_CMDGETMANIFEST *cmd;
    lcb_cmdgetmanifest_create(&cmd);
    manifest_result result;
    EXPECT_EQ(LCB_SUCCESS, lcb_getmanifest(instance, &result, cmd));
    lcb_cmdgetmanifest_destroy(cmd);
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    if (result.rc == LCB_ERR_TIMEOUT) {
        return 0;
    }

    Json::Value payload;
    EXPECT_EQ(LCB_SUCCESS, result.rc);
    EXPECT_FALSE(result.value.empty());
    EXPECT_TRUE(Json::Reader().parse(result.value, payload));
    EXPECT_TRUE(payload.isMember("uid") && payload["uid"].isString());
    return std::stoull(payload["uid"].asString(), nullptr, 16);
}

#ifdef WIN32
#define usleep(n) Sleep(n / 1000)
#endif
static void wait_for_manifest_uid(lcb_INSTANCE *instance, std::uint64_t uid)
{
    while (true) {
        std::uint64_t visible_uid = get_manifest_id(instance);
        if (visible_uid < uid) {
            usleep(100000);
        } else {
            break;
        }
    }
}

void create_scope(lcb_INSTANCE *instance, const std::string &scope, bool wait)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/pools/default/buckets/" + MockEnvironment::getInstance()->getBucket() + "/scopes";
    std::string body = "name=" + scope;
    std::string content_type = "application/x-www-form-urlencoded";

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_content_type(cmd, content_type.c_str(), content_type.size());
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());
    lcb_cmdhttp_body(cmd, body.c_str(), body.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));

    Json::Value payload;
    ASSERT_TRUE(Json::Reader().parse(result.body, payload)) << result.body;
    ASSERT_TRUE(payload.isMember("uid") && payload["uid"].isString()) << result.body;
    std::uint64_t uid = std::stoull(payload["uid"].asString(), nullptr, 16);
    ASSERT_GT(uid, 0);
    if (wait) {
        wait_for_manifest_uid(instance, uid);
    }
}

void create_collection(lcb_INSTANCE *instance, const std::string &scope, const std::string &collection, bool wait)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path =
        "/pools/default/buckets/" + MockEnvironment::getInstance()->getBucket() + "/scopes/" + scope + "/collections";
    std::string body = "name=" + collection;
    std::string content_type = "application/x-www-form-urlencoded";

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_content_type(cmd, content_type.c_str(), content_type.size());
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());
    lcb_cmdhttp_body(cmd, body.c_str(), body.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);

    Json::Value payload;
    ASSERT_TRUE(Json::Reader().parse(result.body, payload)) << result.body;
    ASSERT_TRUE(payload.isMember("uid") && payload["uid"].isString()) << result.body;
    std::uint64_t uid = std::stoull(payload["uid"].asString(), nullptr, 16);
    ASSERT_GT(uid, 0);
    if (wait) {
        wait_for_manifest_uid(instance, uid);
    }
}

void drop_scope(lcb_INSTANCE *instance, const std::string &scope, bool wait)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/pools/default/buckets/default/scopes/" + scope;

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_DELETE);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);

    Json::Value payload;
    ASSERT_TRUE(Json::Reader().parse(result.body, payload)) << result.body;
    ASSERT_TRUE(payload.isMember("uid") && payload["uid"].isString()) << result.body;
    std::uint64_t uid = std::stoull(payload["uid"].asString(), nullptr, 16);
    ASSERT_GT(uid, 0);
    if (wait) {
        wait_for_manifest_uid(instance, uid);
    }
}

void drop_collection(lcb_INSTANCE *instance, const std::string &scope, const std::string &collection, bool wait)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/pools/default/buckets/default/scopes/" + scope + "/collections/" + collection;

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_DELETE);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);

    Json::Value payload;
    ASSERT_TRUE(Json::Reader().parse(result.body, payload)) << result.body;
    ASSERT_TRUE(payload.isMember("uid") && payload["uid"].isString()) << result.body;
    std::uint64_t uid = std::stoull(payload["uid"].asString(), nullptr, 16);
    ASSERT_GT(uid, 0);
    if (wait) {
        wait_for_manifest_uid(instance, uid);
    }
}

std::string unique_name(const std::string &prefix)
{
    std::stringstream ss;
    ss << prefix << lcb_next_rand32();
    return ss.str();
}

void TestSpan::SetAttribute(std::string key, uint64_t value)
{
    int_tags[std::move(key)] = value;
}

void TestSpan::SetAttribute(std::string key, std::string value)
{
    str_tags[std::move(key)] = std::move(value);
}

void TestSpan::End()
{
    finished = true;
}

TestSpan::TestSpan(std::string span_name)
{
    name = std::move(span_name);
}

std::shared_ptr<TestSpan> TestTracer::StartSpan(std::string name)
{
    auto t_span = std::make_shared<TestSpan>(name);
    spans.push_back(t_span);
    return t_span;
}

void TestTracer::reset()
{
    spans.clear();
}

static void *start_span(lcbtrace_TRACER *tracer, const char *name, void *parent)
{
    auto test_tracer = static_cast<TestTracer *>(tracer->cookie);
    if (!test_tracer->enabled()) {
        return nullptr;
    }
    auto test_span = test_tracer->StartSpan(std::string(name));
    return test_span.get();
}

static void end_span(void *span)
{
    if (span == nullptr) {
        return;
    }
    static_cast<TestSpan *>(span)->End();
}

static void add_tag_string(void *span, const char *name, const char *value, size_t value_len)
{
    if (span == nullptr) {
        return;
    }
    std::string val;
    val.append(value, value_len);
    static_cast<TestSpan *>(span)->SetAttribute(std::string(name), val);
}

static void add_tag_uint64(void *span, const char *name, uint64_t value)
{
    if (span == nullptr) {
        return;
    }
    static_cast<TestSpan *>(span)->SetAttribute(name, value);
}

void TestTracer::create_lcb_tracer()
{
    lcbtracer_ = lcbtrace_new(nullptr, LCBTRACE_F_EXTERNAL);
    lcbtracer_->version = 1;
    lcbtracer_->v.v1.start_span = start_span;
    lcbtracer_->v.v1.end_span = end_span;
    lcbtracer_->v.v1.add_tag_string = add_tag_string;
    lcbtracer_->v.v1.add_tag_uint64 = add_tag_uint64;
    lcbtracer_->cookie = static_cast<void *>(this);
}

void TestTracer::destroy_lcb_tracer()
{
    if (lcbtracer_ != nullptr) {
        lcbtrace_destroy(lcbtracer_);
        delete lcbtracer_;
        lcbtracer_ = nullptr;
    }
}

TestTracer::~TestTracer()
{
    destroy_lcb_tracer();
}

TestMeter::TestMeter() = default;

void TestMeter::reset()
{
    recorders.clear();
}

void TestValueRecorder::RecordValue(uint64_t value)
{
    values.push_back(value);
}

std::shared_ptr<TestValueRecorder> TestMeter::ValueRecorder(std::string name,
                                                            std::unordered_map<std::string, std::string> tags)
{
    auto key = name + ":" + tags["db.couchbase.service"];
    auto op = tags["db.operation"];
    if (!op.empty()) {
        key = key + ":" + op;
    }
    std::shared_ptr<TestValueRecorder> test_recorder;
    if (recorders.find(key) == recorders.end()) {
        test_recorder = std::make_shared<TestValueRecorder>();
        recorders[key] = test_recorder;
    } else {
        test_recorder = recorders[key];
    }
    return test_recorder;
}

static void record_callback(const lcbmetrics_VALUERECORDER *recorder, uint64_t value)
{
    void *test_recorder;
    lcbmetrics_valuerecorder_cookie(recorder, &test_recorder);
    static_cast<TestValueRecorder *>(test_recorder)->RecordValue(value);
}

static const lcbmetrics_VALUERECORDER *new_recorder(const lcbmetrics_METER *meter, const char *name,
                                                    const lcbmetrics_TAG *tags, size_t ntags)
{
    std::unordered_map<std::string, std::string> recorder_tags;
    for (int i = 0; i < ntags; i++) {
        recorder_tags[tags[i].key] = tags[i].value;
    }

    void *test_meter_;
    lcbmetrics_meter_cookie(meter, &test_meter_);
    auto test_meter = static_cast<TestMeter *>(test_meter_);
    auto test_value_recorder = test_meter->ValueRecorder(std::string(name), recorder_tags);

    lcbmetrics_VALUERECORDER *recorder;
    lcbmetrics_valuerecorder_create(&recorder, test_value_recorder.get());
    lcbmetrics_valuerecorder_record_value_callback(recorder, record_callback);

    return recorder;
}

void TestMeter::create_lcb_meter()
{
    lcbmetrics_meter_create(&lcbmeter_, static_cast<void *>(this));
    lcbmetrics_meter_value_recorder_callback(lcbmeter_, new_recorder);
}

void TestMeter::destroy_lcb_meter()
{
    if (lcbmeter_ != nullptr) {
        lcbmetrics_meter_destroy(lcbmeter_);
        lcbmeter_ = nullptr;
    }
}

void enforce_rate_limits(lcb_INSTANCE *instance)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/internalSettings";
    std::string body = "enforceLimits=true";

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());
    lcb_cmdhttp_body(cmd, body.c_str(), body.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);
}

void create_rate_limited_user(lcb_INSTANCE *instance, const std::string &username, const rate_limits &limits)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/settings/rbac/users/local/" + username;
    std::string body = "password=password&roles=admin";
    Json::Value json_limits;
    if (limits.kv_limits.enforce) {
        Json::Value kv_limits;
        if (limits.kv_limits.num_connections > 0) {
            kv_limits["num_connections"] = limits.kv_limits.num_connections;
        }
        if (limits.kv_limits.num_ops_per_min > 0) {
            kv_limits["num_ops_per_min"] = limits.kv_limits.num_ops_per_min;
        }
        if (limits.kv_limits.ingress_mib_per_min > 0) {
            kv_limits["ingress_mib_per_min"] = limits.kv_limits.ingress_mib_per_min;
        }
        if (limits.kv_limits.egress_mib_per_min > 0) {
            kv_limits["egress_mib_per_min"] = limits.kv_limits.egress_mib_per_min;
        }
        json_limits["kv"] = kv_limits;
    }
    if (limits.query_limits.enforce) {
        Json::Value query_limits;
        if (limits.query_limits.num_concurrent_requests > 0) {
            query_limits["num_concurrent_requests"] = limits.query_limits.num_concurrent_requests;
        }
        if (limits.query_limits.num_queries_per_min > 0) {
            query_limits["num_queries_per_min"] = limits.query_limits.num_queries_per_min;
        }
        if (limits.query_limits.ingress_mib_per_min > 0) {
            query_limits["ingress_mib_per_min"] = limits.query_limits.ingress_mib_per_min;
        }
        if (limits.query_limits.egress_mib_per_min > 0) {
            query_limits["egress_mib_per_min"] = limits.query_limits.egress_mib_per_min;
        }
        json_limits["query"] = query_limits;
    }
    if (limits.search_limits.enforce) {
        Json::Value fts_limits;
        if (limits.search_limits.num_concurrent_requests > 0) {
            fts_limits["num_concurrent_requests"] = limits.search_limits.num_concurrent_requests;
        }
        if (limits.search_limits.num_queries_per_min > 0) {
            fts_limits["num_queries_per_min"] = limits.search_limits.num_queries_per_min;
        }
        if (limits.search_limits.ingress_mib_per_min > 0) {
            fts_limits["ingress_mib_per_min"] = limits.search_limits.ingress_mib_per_min;
        }
        if (limits.search_limits.egress_mib_per_min > 0) {
            fts_limits["egress_mib_per_min"] = limits.search_limits.egress_mib_per_min;
        }
        json_limits["fts"] = fts_limits;
    }
    std::string j_limits = Json::FastWriter().write(json_limits);
    body += "&limits=" + j_limits;
    std::string content_type = "application/x-www-form-urlencoded";

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_PUT);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());
    lcb_cmdhttp_body(cmd, body.c_str(), body.size());
    lcb_cmdhttp_content_type(cmd, content_type.c_str(), content_type.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);
}

void create_rate_limited_scope(lcb_INSTANCE *instance, const std::string &bucket, std::string &scope,
                               const scope_rate_limits &limits)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/pools/default/buckets/" + bucket + "/scopes";
    std::string body = "name=" + scope;
    Json::Value json_limits;
    if (limits.kv_scope_limits.enforce) {
        Json::Value kv_limits;
        kv_limits["data_size"] = limits.kv_scope_limits.data_size;
        json_limits["kv"] = kv_limits;
    }
    if (limits.index_scope_limits.enforce) {
        Json::Value index_limits;
        index_limits["num_indexes"] = limits.index_scope_limits.num_indexes;
        json_limits["index"] = index_limits;
    }
    std::string j_limits = Json::FastWriter().write(json_limits);
    body += "&limits=" + j_limits;
    std::string content_type = "application/x-www-form-urlencoded";

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());
    lcb_cmdhttp_body(cmd, body.c_str(), body.size());
    lcb_cmdhttp_content_type(cmd, content_type.c_str(), content_type.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);
}

void drop_user(lcb_INSTANCE *instance, const std::string &username)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/settings/rbac/users/local/" + username;

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_MANAGEMENT);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_DELETE);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);
}

void create_search_index(lcb_INSTANCE *instance, const std::string &index_name, const std::string &type,
                         const std::string &source_type, const std::string &source_name)
{
    (void)lcb_install_callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPCALLBACK)http_callback);

    lcb_CMDHTTP *cmd;
    std::string path = "/api/index/" + index_name;
    Json::Value json_body;
    json_body["name"] = index_name;
    json_body["type"] = type;
    json_body["sourceName"] = source_name;
    json_body["sourceType"] = source_type;

    auto body = Json::FastWriter().write(json_body);

    lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_SEARCH);
    lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_PUT);
    lcb_cmdhttp_path(cmd, path.c_str(), path.size());
    lcb_cmdhttp_body(cmd, body.c_str(), body.size());

    http_result result{};
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_http(instance, &result, cmd));
    lcb_cmdhttp_destroy(cmd);
    ASSERT_STATUS_EQ(LCB_SUCCESS, lcb_wait(instance, LCB_WAIT_DEFAULT));
    ASSERT_STATUS_EQ(LCB_SUCCESS, result.rc);
}