/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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

#include "internal.h"
#include "errmap.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

using namespace lcb::errmap;

ErrorMap::ErrorMap() : revision(0), version(0) {}

static ErrorAttribute getAttribute(const std::string &s)
{
#define X(c, s_)                                                                                                       \
    if (s == s_) {                                                                                                     \
        return c;                                                                                                      \
    }
    LCB_XERRMAP_ATTRIBUTES(X)
#undef X
    return INVALID_ATTRIBUTE;
}

RetrySpec *Error::getRetrySpec() const
{
    return retry.specptr;
}

RetrySpec *RetrySpec::parse(const Json::Value &retryJson, std::string &emsg)
{

    auto *spec = new RetrySpec();
    spec->refcount = 1;

#define FAIL_RETRY(s)                                                                                                  \
    emsg = s;                                                                                                          \
    delete spec;                                                                                                       \
    return nullptr

    if (!retryJson.isObject()) {
        FAIL_RETRY("Missing retry specification");
    }

    const Json::Value &strategyJson = retryJson["strategy"];
    if (!strategyJson.isString()) {
        FAIL_RETRY("Missing `strategy`");
    }
    const char *strategy = strategyJson.asCString();
    if (!strcasecmp(strategy, "constant")) {
        spec->strategy = CONSTANT;
    } else if (!strcasecmp(strategy, "linear")) {
        spec->strategy = LINEAR;
    } else if (!strcasecmp(strategy, "exponential")) {
        spec->strategy = EXPONENTIAL;
    } else {
        FAIL_RETRY("Unknown strategy");
    }

#define GET_TIMEFLD(srcname, dstname, required)                                                                        \
    do {                                                                                                               \
        Json::Value dstname##Json = retryJson[srcname];                                                                \
        if (dstname##Json.isNumeric()) {                                                                               \
            spec->dstname = (dstname##Json).asUInt() * 1000;                                                           \
        } else if (required) {                                                                                         \
            FAIL_RETRY("Missing " #srcname);                                                                           \
        } else {                                                                                                       \
            spec->dstname = 0;                                                                                         \
        }                                                                                                              \
    } while (0)

    GET_TIMEFLD("interval", interval, true);
    GET_TIMEFLD("after", after, true);
    GET_TIMEFLD("ceil", ceil, false);
    GET_TIMEFLD("max-duration", max_duration, false);

    return spec;

#undef FAIL_RETRY
#undef GET_TIMEFLD
}

const uint32_t ErrorMap::MAX_VERSION = 1;

ErrorMap::ParseStatus ErrorMap::parse(const char *s, size_t n, std::string &errmsg)
{
    Json::Value root_nonconst;
    Json::Reader reader;
    if (!reader.parse(s, s + n, root_nonconst)) {
        errmsg = "Invalid JSON";
        return PARSE_ERROR;
    }

    const Json::Value &root = root_nonconst;
    const Json::Value &verJson = root["version"];
    if (!verJson.isNumeric()) {
        errmsg = "'version' is not a number";
        return PARSE_ERROR;
    }

    if (verJson.asUInt() > MAX_VERSION) {
        errmsg = "'version' is unreasonably high";
        return UNKNOWN_VERSION;
    }

    const Json::Value &revJson = root["revision"];
    if (!revJson.isNumeric()) {
        errmsg = "'revision' is not a number";
        return PARSE_ERROR;
    }

    if (revJson.asUInt() <= revision) {
        return NOT_UPDATED;
    }

    const Json::Value &errsJson = root["errors"];
    if (!errsJson.isObject()) {
        errmsg = "'errors' is not an object";
        return PARSE_ERROR;
    }

    Json::Value::const_iterator ii = errsJson.begin();
    for (; ii != errsJson.end(); ++ii) {
        // Key is the version in hex
        unsigned ec = 0;
        if (sscanf(ii.key().asCString(), "%x", &ec) != 1) {
            errmsg = "key " + ii.key().asString() + " is not a hex number";
            return PARSE_ERROR;
        }

        const Json::Value &errorJson = *ii;

        // Descend into the error attributes
        Error error;
        error.code = static_cast<uint16_t>(ec);

        error.shortname = errorJson["name"].asString();
        error.description = errorJson["desc"].asString();

        const Json::Value &attrs = errorJson["attrs"];
        if (!attrs.isArray()) {
            errmsg = "'attrs' is not an array";
            return PARSE_ERROR;
        }

        Json::Value::const_iterator jj = attrs.begin();
        for (; jj != attrs.end(); ++jj) {
            ErrorAttribute attr = getAttribute(jj->asString());
            if (attr == INVALID_ATTRIBUTE) {
                errmsg = "unknown attribute received";
                return UNKNOWN_VERSION;
            }
            error.attributes.insert(attr);
        }
        if (error.hasAttribute(AUTO_RETRY)) {
            const Json::Value &retryJson = errorJson["retry"];
            if (!retryJson.isObject()) {
                errmsg = "Need `retry` specification for `auto-retry` attribute";
                return PARSE_ERROR;
            }
            if ((error.retry.specptr = RetrySpec::parse(retryJson, errmsg)) == nullptr) {
                return PARSE_ERROR;
            }
        }
        errors.insert(MapType::value_type(ec, error));
    }

    return UPDATED;
}

const Error &ErrorMap::getError(uint16_t code) const
{
    static const Error invalid;
    auto it = errors.find(code);

    if (it != errors.end()) {
        return it->second;
    } else {
        return invalid;
    }
}

ErrorMap *lcb_errmap_new()
{
    return new ErrorMap();
}

void lcb_errmap_free(ErrorMap *m)
{
    delete m;
}

LIBCOUCHBASE_API int lcb_retry_reason_allows_non_idempotent_retry(lcb_RETRY_REASON code)
{
#define X(n, c, nir, ar)                                                                                               \
    if (code == c) {                                                                                                   \
        return nir;                                                                                                    \
    }
    LCB_XRETRY_REASON(X)
#undef X
    return 0;
}

LIBCOUCHBASE_API int lcb_retry_reason_is_always_retry(lcb_RETRY_REASON code)
{
#define X(n, c, nir, ar)                                                                                               \
    if (code == c) {                                                                                                   \
        return ar;                                                                                                     \
    }
    LCB_XRETRY_REASON(X)
#undef X
    return 0;
}

LIBCOUCHBASE_API int lcb_retry_request_is_idempotent(lcb_RETRY_REQUEST *req)
{
    return req->is_idempotent;
}

LIBCOUCHBASE_API int lcb_retry_request_retry_attempts(lcb_RETRY_REQUEST *req)
{
    return req->retry_attempts;
}

LIBCOUCHBASE_API void *lcb_retry_request_operation_cookie(lcb_RETRY_REQUEST *req)
{
    return req->operation_cookie;
}

lcb_RETRY_ACTION lcb_retry_strategy_best_effort(lcb_RETRY_REQUEST *req, lcb_RETRY_REASON reason)
{
    lcb_RETRY_ACTION res{0, 0};
    if (lcb_retry_request_is_idempotent(req) || lcb_retry_reason_allows_non_idempotent_retry(reason)) {
        res.should_retry = 1;
        res.retry_after_ms = 0;
    }
    return res;
}

lcb_RETRY_ACTION lcb_retry_strategy_fail_fast(lcb_RETRY_REQUEST *, lcb_RETRY_REASON)
{
    lcb_RETRY_ACTION res{0, 0};
    return res;
}

LIBCOUCHBASE_API lcb_STATUS lcb_retry_strategy(lcb_INSTANCE *instance, lcb_RETRY_STRATEGY strategy)
{
    if (strategy == nullptr || instance == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    instance->settings->retry_strategy = strategy;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_rc(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx)
{
    return ctx->rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_status_code(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, uint16_t *status_code)
{
    *status_code = ctx->status_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_opaque(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, uint32_t *opaque)
{
    *opaque = ctx->opaque;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_cas(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, uint64_t *cas)
{
    *cas = ctx->cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_key(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **key, size_t *key_len)
{
    *key = ctx->key;
    *key_len = ctx->key_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_bucket(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **bucket,
                                                 size_t *bucket_len)
{
    *bucket = ctx->bucket;
    *bucket_len = ctx->bucket_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_collection(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **collection,
                                                     size_t *collection_len)
{
    *collection = ctx->collection;
    *collection_len = ctx->collection_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_scope(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **scope,
                                                size_t *scope_len)
{
    *scope = ctx->scope;
    *scope_len = ctx->scope_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_context(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **context,
                                                  size_t *context_len)
{
    *context = ctx->context;
    *context_len = ctx->context_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_ref(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **ref, size_t *ref_len)
{
    *ref = ctx->ref;
    *ref_len = ctx->ref_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_kv_endpoint(const lcb_KEY_VALUE_ERROR_CONTEXT *ctx, const char **endpoint,
                                                   size_t *endpoint_len)
{
    *endpoint = ctx->endpoint;
    *endpoint_len = ctx->endpoint_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_rc(const lcb_HTTP_ERROR_CONTEXT *ctx)
{
    return ctx->rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_path(const lcb_HTTP_ERROR_CONTEXT *ctx, const char **path, size_t *path_len)
{
    *path = ctx->path;
    *path_len = ctx->path_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_response_code(const lcb_HTTP_ERROR_CONTEXT *ctx, uint32_t *code)
{
    *code = ctx->response_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_response_body(const lcb_HTTP_ERROR_CONTEXT *ctx, const char **body,
                                                          size_t *body_len)
{
    *body = ctx->body;
    *body_len = ctx->body_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_http_endpoint(const lcb_HTTP_ERROR_CONTEXT *ctx, const char **endpoint,
                                                     size_t *endpoint_len)
{
    *endpoint = ctx->endpoint;
    *endpoint_len = ctx->endpoint_len;
    return LCB_SUCCESS;
}
