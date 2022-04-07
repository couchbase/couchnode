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

#ifndef LIBCOUCHBASE_CAPI_QUERY_HH
#define LIBCOUCHBASE_CAPI_QUERY_HH

#include <cstddef>
#include <cstdint>
#include <chrono>

#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include "collection_qualifier.hh"

/**
 * @private
 */
struct lcb_QUERY_ERROR_CONTEXT_ {
    lcb_STATUS rc;
    uint32_t first_error_code{};
    const char *first_error_message{};
    size_t first_error_message_len{};
    const char *error_response_body{};
    size_t error_response_body_len{};
    const char *statement{};
    size_t statement_len{};
    const char *client_context_id{};
    size_t client_context_id_len{};
    const char *query_params{};
    size_t query_params_len{};
    uint32_t http_response_code{};
    const char *http_response_message{};
    size_t http_response_message_len{};
    const char *endpoint{};
    size_t endpoint_len{};
};

/**
 * Command structure for N1QL queries. Typically an application will use the
 * lcb_N1QLPARAMS structure to populate the #query and #content_type fields.
 *
 * The #callback field must be specified, and indicates the function the
 * library should call when more response data has arrived.
 */
struct lcb_CMDQUERY_ {
    bool empty_statement_and_root_object() const
    {
        return query_.empty() && root_.empty();
    }

    bool is_query_json() const
    {
        return query_is_json_;
    }

    const Json::Value &root() const
    {
        return root_;
    }

    void root(const Json::Value &new_body)
    {
        root_ = new_body;
        query_is_json_ = true;
    }

    void use_multi_bucket_authentication(bool use)
    {
        use_multi_bucket_authentication_ = use;
    }

    bool use_multi_bucket_authentication() const
    {
        return use_multi_bucket_authentication_;
    }

    bool prepare_statement() const
    {
        return prepare_statement_;
    }

    lcb_STATUS prepare_statement(bool prepare)
    {
        prepare_statement_ = prepare;
        return LCB_SUCCESS;
    }

    lcb_STATUS pretty(bool pretty)
    {
        root_["pretty"] = pretty;
        return LCB_SUCCESS;
    }

    lcb_STATUS readonly(bool readonly)
    {
        root_["readonly"] = readonly;
        return LCB_SUCCESS;
    }

    lcb_STATUS metrics(bool show_metrics)
    {
        root_["metrics"] = show_metrics;
        return LCB_SUCCESS;
    }

    lcb_STATUS scan_cap(int cap_value)
    {
        root_["scan_cap"] = Json::valueToString(cap_value);
        return LCB_SUCCESS;
    }

    lcb_STATUS scan_wait(uint32_t duration_us)
    {
        root_["scan_wait"] = Json::valueToString(duration_us) + "us";
        return LCB_SUCCESS;
    }

    lcb_STATUS pipeline_cap(int value)
    {
        root_["pipeline_cap"] = Json::valueToString(value);
        return LCB_SUCCESS;
    }

    lcb_STATUS pipeline_batch(int value)
    {
        root_["pipeline_batch"] = Json::valueToString(value);
        return LCB_SUCCESS;
    }

    lcb_STATUS max_parallelism(int value)
    {
        root_["max_parallelism"] = Json::valueToString(value);
        return LCB_SUCCESS;
    }

    lcb_STATUS flex_index(bool value)
    {
        if (value) {
            root_["use_fts"] = true;
        } else {
            root_.removeMember("use_fts");
        }
        return LCB_SUCCESS;
    }

    lcb_STATUS profile(lcb_QUERY_PROFILE mode)
    {
        switch (mode) {
            case LCB_QUERY_PROFILE_OFF:
                root_["profile"] = "off";
                break;
            case LCB_QUERY_PROFILE_PHASES:
                root_["profile"] = "phases";
                break;
            case LCB_QUERY_PROFILE_TIMINGS:
                root_["profile"] = "timings";
                break;
            default:
                return LCB_ERR_INVALID_ARGUMENT;
        }
        return LCB_SUCCESS;
    }

    lcb_STATUS consistency(lcb_QUERY_CONSISTENCY mode)
    {
        switch (mode) {
            case LCB_QUERY_CONSISTENCY_NONE:
                root_.removeMember("scan_consistency");
                break;
            case LCB_QUERY_CONSISTENCY_REQUEST:
                root_["scan_consistency"] = "request_plus";
                break;
            case LCB_QUERY_CONSISTENCY_STATEMENT:
                root_["scan_consistency"] = "statement_plus";
                break;
            default:
                return LCB_ERR_INVALID_ARGUMENT;
        }
        return LCB_SUCCESS;
    }

    lcb_STATUS consistency_token_for_keyspace(const char *keyspace, size_t keyspace_len,
                                              const lcb_MUTATION_TOKEN *token)
    {
        if (!lcb_mutation_token_is_valid(token)) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_["scan_consistency"] = "at_plus";
        auto &vb = root_["scan_vectors"][std::string(keyspace, keyspace_len)][std::to_string(token->vbid_)];
        vb[0] = static_cast<Json::UInt64>(token->seqno_);
        vb[1] = std::to_string(token->uuid_);
        return LCB_SUCCESS;
    }

    lcb_STATUS preserve_expiry(bool preserve_expiry)
    {
        root_["preserve_expiry"] = preserve_expiry;
        return LCB_SUCCESS;
    }

    lcb_STATUS callback(lcb_QUERY_CALLBACK row_callback)
    {
        callback_ = row_callback;
        return LCB_SUCCESS;
    }

    lcb_QUERY_CALLBACK callback() const
    {
        return callback_;
    }

    bool has_callback() const
    {
        return callback_ != nullptr;
    }

    lcb_STATUS store_handle_refence_to(lcb_QUERY_HANDLE **storage)
    {
        handle_ = storage;
        return LCB_SUCCESS;
    }

    void handle(lcb_QUERY_HANDLE *handle) const
    {
        if (handle_ != nullptr) {
            *handle_ = handle;
        }
    }

    lcb_STATUS scope(std::string name)
    {
        scope_ = std::move(name);
        return LCB_SUCCESS;
    }

    bool has_explicit_scope_qualifier() const
    {
        return !scope_qualifier_.empty();
    }

    lcb_STATUS scope_qualifier(std::string qualifier)
    {
        scope_qualifier_ = std::move(qualifier);
        return LCB_SUCCESS;
    }

    const std::string &scope_qualifier() const
    {
        return scope_qualifier_;
    }

    lcb_STATUS parent_span(lcbtrace_SPAN *parent_span)
    {
        parent_span_ = parent_span;
        return LCB_SUCCESS;
    }

    lcbtrace_SPAN *parent_span() const
    {
        return parent_span_;
    }

    lcb_STATUS timeout_in_milliseconds(std::uint32_t timeout)
    {
        timeout_ = std::chrono::milliseconds(timeout);
        return LCB_SUCCESS;
    }

    lcb_STATUS timeout_in_microseconds(std::uint32_t timeout)
    {
        timeout_ = std::chrono::microseconds(timeout);
        return LCB_SUCCESS;
    }

    std::uint32_t timeout_or_default_in_microseconds(std::uint32_t default_val) const
    {
        if (timeout_ == std::chrono::microseconds ::zero()) {
            return default_val;
        }
        return static_cast<std::uint32_t>(timeout_.count());
    }

    lcb_STATUS start_time_in_nanoseconds(std::uint64_t val)
    {
        start_time_ = std::chrono::nanoseconds(val);
        return LCB_SUCCESS;
    }

    std::uint64_t start_time_or_default_in_nanoseconds(std::uint64_t default_val) const
    {
        if (start_time_ == std::chrono::nanoseconds::zero()) {
            return default_val;
        }
        return start_time_.count();
    }

    const std::string &scope() const
    {
        return scope_;
    }

    bool has_scope() const
    {
        return !scope_.empty();
    }

    lcb_STATUS encode_payload()
    {
        query_ = Json::FastWriter().write(root_);
        return LCB_SUCCESS;
    }

    lcb_STATUS payload(const char *query, std::size_t query_len)
    {
        Json::Value value;
        if (!Json::Reader().parse(query, query + query_len, value)) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_ = value;
        return LCB_SUCCESS;
    }

    const std::string &query() const
    {
        return query_;
    }

    lcb_STATUS statement(const char *statement, std::size_t statement_len)
    {
        if (statement == nullptr) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_["statement"] = std::string(statement, statement_len);
        return LCB_SUCCESS;
    }

    lcb_STATUS option(const char *name, std::size_t name_len, const char *value, std::size_t value_len)
    {
        if (name == nullptr || value == nullptr) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        Json::Value json_value;
        if (!Json::Reader().parse(value, value + value_len, json_value)) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_[std::string(name, name_len)] = json_value;
        return LCB_SUCCESS;
    }

    lcb_STATUS option(const std::string &name, const char *value, std::size_t value_len)
    {
        if (name.empty() || value == nullptr) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        Json::Value json_value;
        if (!Json::Reader().parse(value, value + value_len, json_value)) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_[name] = json_value;
        return LCB_SUCCESS;
    }

    lcb_STATUS option_array(const std::string &name, const char *value, std::size_t value_len)
    {
        if (name.empty() || value == nullptr) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        Json::Value json_value;
        if (!Json::Reader().parse(value, value + value_len, json_value)) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        if (json_value.type() != Json::ValueType::arrayValue) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_[name] = json_value;
        return LCB_SUCCESS;
    }

    lcb_STATUS option_array_append(const std::string &name, const char *value, std::size_t value_len)
    {
        if (name.empty() || value == nullptr) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        Json::Value json_value;
        if (!Json::Reader().parse(value, value + value_len, json_value)) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_[name].append(json_value);
        return LCB_SUCCESS;
    }

    lcb_STATUS option_string(const std::string &name, const char *value, std::size_t value_len)
    {
        if (name.empty() || value == nullptr || value_len == 0) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        root_[name] = std::string(value, value_len);
        return LCB_SUCCESS;
    }

    lcb_STATUS clear()
    {
        timeout_ = std::chrono::milliseconds::zero();
        parent_span_ = nullptr;
        root_.clear();
        scope_.clear();
        scope_qualifier_.clear();
        query_.clear();
        cookie_ = nullptr;
        callback_ = nullptr;
        handle_ = nullptr;
        prepare_statement_ = false;
        query_is_json_ = false;
        use_multi_bucket_authentication_ = false;
        return LCB_SUCCESS;
    }

    void *cookie()
    {
        return cookie_;
    }

    void cookie(void *cookie)
    {
        cookie_ = cookie;
    }

    lcb_STATUS on_behalf_of(std::string user)
    {
        impostor_ = std::move(user);
        return LCB_SUCCESS;
    }

    bool want_impersonation() const
    {
        return !impostor_.empty();
    }

    const std::string &impostor() const
    {
        return impostor_;
    }

  private:
    std::string scope_{};
    std::string scope_qualifier_{};
    std::chrono::microseconds timeout_{0};
    std::chrono::nanoseconds start_time_{0};
    lcbtrace_SPAN *parent_span_{nullptr};
    void *cookie_{nullptr};

    bool prepare_statement_{false};
    bool query_is_json_{false};
    bool use_multi_bucket_authentication_{false};

    Json::Value root_{};
    /**Query to be placed in the POST request. The library will not perform
     * any conversions or validation on this string, so it is up to the user
     * (or wrapping library) to ensure that the string is well formed.
     *
     * If using the @ref lcb_N1QLPARAMS structure, the lcb_n1p_mkcmd() function
     * will properly populate this field.
     *
     * In general the string should either be JSON (in which case, the
     * #content_type field should be `application/json`) or url-encoded
     * (in which case the #content_type field should be
     * `application/x-www-form-urlencoded`)
     */
    std::string query_{};

    /** Callback to be invoked for each row */
    lcb_QUERY_CALLBACK callback_{nullptr};

    /**Request handle. Will be set to the handle which may be passed to
     * lcb_query_cancel() */
    lcb_QUERY_HANDLE **handle_{nullptr};

    std::string impostor_{};
};

/**
 * Response for a N1QL query. This is delivered in the @ref lcb_N1QLCALLBACK
 * callback function for each result row received. The callback is also called
 * one last time when all
 */
struct lcb_RESPQUERY_ {
    lcb_QUERY_ERROR_CONTEXT ctx;
    void *cookie;
    std::uint16_t rflags;

    /**Current result row. If #rflags has the ::LCB_RESP_F_FINAL bit set, then
     * this field does not contain the actual row, but the remainder of the
     * data not included with the resultset; e.g. the JSON surrounding
     * the "results" field with any errors or metadata for the response.
     */
    const char *row;
    /** Length of the row */
    std::size_t nrow;
    /** Raw HTTP response, if applicable */
    const lcb_RESPHTTP *htresp;
    lcb_QUERY_HANDLE *handle;
};

#endif // LIBCOUCHBASE_CAPI_QUERY_HH
