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

#ifndef LIBCOUCHBASE_CAPI_SEARCH_HH
#define LIBCOUCHBASE_CAPI_SEARCH_HH

#include <cstddef>
#include <cstdint>
#include <string>
#include <chrono>

/**
 * @private
 */
struct lcb_SEARCH_ERROR_CONTEXT_ {
    lcb_STATUS rc;
    int has_top_level_error;
    const char *error_message;
    std::size_t error_message_len;
    const char *index;
    std::size_t index_len;
    const char *search_query;
    std::size_t search_query_len;
    const char *search_params;
    std::size_t search_params_len;
    std::uint32_t http_response_code;
    const char *http_response_body;
    std::size_t http_response_body_len;
    const char *endpoint;
    std::size_t endpoint_len;
};

/**
 * Response structure for full-text searches.
 * @private
 */
struct lcb_RESPSEARCH_ {
    lcb_SEARCH_ERROR_CONTEXT_ ctx;
    void *cookie;
    std::uint16_t rflags;
    /**
     * A query hit, or response metadta
     * (if #rflags contains @ref LCB_RESP_F_FINAL). The format of the row will
     * be JSON, and should be decoded by a JSON decoded in your application.
     */
    const char *row;
    /** Length of #row */
    std::size_t nrow;
    /** Original HTTP response obejct */
    const lcb_RESPHTTP *htresp;
    lcb_SEARCH_HANDLE_ *handle;
};

/**
 * @brief Search Command
 * @private
 */
struct lcb_CMDSEARCH_ {
    static const std::string &operation_name()
    {
        static std::string name = LCBTRACE_OP_SEARCH;
        return name;
    }

    bool has_callback() const
    {
        return callback_ != nullptr;
    }

    lcb_STATUS callback(lcb_SEARCH_CALLBACK row_callback)
    {
        callback_ = row_callback;
        return LCB_SUCCESS;
    }

    lcb_SEARCH_CALLBACK callback() const
    {
        return callback_;
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

    const std::string &query() const
    {
        return query_;
    }

    lcb_STATUS query(const char *payload, std::size_t payload_len)
    {
        if (payload == nullptr || payload_len == 0) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        query_.assign(payload, payload_len);
        return LCB_SUCCESS;
    }

    void handle(lcb_SEARCH_HANDLE *handle) const
    {
        if (handle_ != nullptr) {
            *handle_ = handle;
        }
    }

    lcb_STATUS store_handle_refence_to(lcb_SEARCH_HANDLE **storage)
    {
        handle_ = storage;
        return LCB_SUCCESS;
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
    std::string query_{};
    void *cookie_{nullptr};
    lcb_SEARCH_CALLBACK callback_{nullptr};
    lcb_SEARCH_HANDLE **handle_{nullptr};
    std::string impostor_{};
};

#endif // LIBCOUCHBASE_CAPI_SEARCH_HH
