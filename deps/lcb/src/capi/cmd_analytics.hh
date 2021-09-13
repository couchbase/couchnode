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

#ifndef LIBCOUCHBASE_CAPI_ANALYTICS_HH
#define LIBCOUCHBASE_CAPI_ANALYTICS_HH

#include <cstddef>
#include <cstdint>
#include <string>
#include <chrono>

#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

struct lcb_INGEST_PARAM_ {
    lcb_INGEST_METHOD method;
    void *cookie;

    const char *row;
    std::size_t row_len;

    const char *id;
    std::size_t id_len;
    void (*id_dtor)(const char *);

    const char *out;
    std::size_t out_len;
    void (*out_dtor)(const char *);
};

lcb_INGEST_STATUS default_data_converter(lcb_INSTANCE *, lcb_INGEST_PARAM *param);

struct lcb_INGEST_OPTIONS_ {
    lcb_INGEST_METHOD method{LCB_INGEST_METHOD_NONE};
    std::uint32_t exptime{0};
    bool ignore_errors{false};
    lcb_INGEST_DATACONVERTER_CALLBACK data_converter{default_data_converter};
};

/**
 * @private
 */
struct lcb_ANALYTICS_ERROR_CONTEXT_ {
    lcb_STATUS rc;
    uint32_t first_error_code;
    const char *first_error_message;
    size_t first_error_message_len;
    const char *statement;
    size_t statement_len;
    const char *client_context_id;
    size_t client_context_id_len;
    const char *query_params;
    size_t query_params_len;
    uint32_t http_response_code;
    const char *http_response_body;
    size_t http_response_body_len;
    const char *endpoint;
    size_t endpoint_len;
};

struct lcb_RESPANALYTICS_ {
    lcb_ANALYTICS_ERROR_CONTEXT ctx;
    void *cookie;
    std::uint16_t rflags;
    const char *row;
    std::size_t nrow;
    const lcb_RESPHTTP *htresp;
    lcb_ANALYTICS_HANDLE *handle;
};

struct lcb_DEFERRED_HANDLE_ {
    std::string status;
    std::string handle;
    lcb_ANALYTICS_CALLBACK callback;
};

struct lcb_CMDANALYTICS_ {
    bool empty_statement_and_root_object() const
    {
        return query_.empty() && root_.empty();
    }

    bool has_callback() const
    {
        return callback_ != nullptr;
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
        if (timeout_ == std::chrono::milliseconds ::zero()) {
            return default_val;
        }
        return static_cast<std::uint32_t>(std::chrono::microseconds(timeout_).count());
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

    lcb_STATUS scope(std::string name)
    {
        scope_name_ = std::move(name);
        return LCB_SUCCESS;
    }

    const std::string &scope() const
    {
        return scope_name_;
    }

    bool has_scope() const
    {
        return !scope_name_.empty();
    }

    void handle(lcb_ANALYTICS_HANDLE *handle) const
    {
        if (handle_ != nullptr) {
            *handle_ = handle;
        }
    }

    lcb_STATUS encode_payload()
    {
        query_ = Json::FastWriter().write(root_);
        return LCB_SUCCESS;
    }

    lcb_STATUS callback(lcb_ANALYTICS_CALLBACK row_callback)
    {
        callback_ = row_callback;
        return LCB_SUCCESS;
    }

    const std::string &query() const
    {
        return query_;
    }

    lcb_STATUS priority(bool priority)
    {
        priority_ = priority;
        return LCB_SUCCESS;
    }

    lcb_STATUS readonly(bool readonly)
    {
        root_["readonly"] = readonly;
        return LCB_SUCCESS;
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

    lcb_STATUS deferred(bool defer_query)
    {
        if (defer_query) {
            root_["mode"] = std::string("async");
        } else {
            root_.removeMember("mode");
        }
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

    void *cookie()
    {
        return cookie_;
    }

    void cookie(void *cookie)
    {
        cookie_ = cookie;
    }

    lcb_STATUS store_handle_refence_to(lcb_ANALYTICS_HANDLE **storage)
    {
        handle_ = storage;
        return LCB_SUCCESS;
    }

    const lcb_INGEST_OPTIONS_ &ingest_options() const
    {
        return ingest_options_;
    }

    lcb_STATUS ingest_options(const lcb_INGEST_OPTIONS *options)
    {
        if (options == nullptr) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        ingest_options_ = *options;
        return LCB_SUCCESS;
    }

    lcb_ANALYTICS_CALLBACK callback() const
    {
        return callback_;
    }

    const Json::Value &root() const
    {
        return root_;
    }

    lcb_STATUS consistency(lcb_ANALYTICS_CONSISTENCY mode)
    {
        switch (mode) {
            case LCB_ANALYTICS_CONSISTENCY_NOT_BOUNDED:
                root_["scan_consistency"] = "not_bounded";
                break;
            case LCB_ANALYTICS_CONSISTENCY_REQUEST_PLUS:
                root_["scan_consistency"] = "request_plus";
                break;
            default:
                return LCB_ERR_INVALID_ARGUMENT;
        }
        return LCB_SUCCESS;
    }

    lcb_STATUS clear()
    {
        root_.clear();
        scope_name_.clear();
        scope_qualifier_.clear();
        return LCB_SUCCESS;
    }

    bool priority() const
    {
        return priority_;
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
    std::chrono::microseconds timeout_{0};
    std::chrono::nanoseconds start_time_{0};
    lcbtrace_SPAN *parent_span_{nullptr};
    Json::Value root_{Json::objectValue};
    std::string query_{};
    void *cookie_{nullptr};
    lcb_ANALYTICS_CALLBACK callback_{nullptr};
    lcb_ANALYTICS_HANDLE **handle_{nullptr};
    lcb_INGEST_OPTIONS ingest_options_{};
    bool priority_{false};
    std::string scope_qualifier_{};
    std::string scope_name_{};
    std::string impostor_{};
};

#endif // LIBCOUCHBASE_CAPI_ANALYTICS_HH
