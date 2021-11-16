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

#ifndef LIBCOUCHBASE_CAPI_VIEWS_HH
#define LIBCOUCHBASE_CAPI_VIEWS_HH

#include <cstddef>
#include <cstdint>
#include <string>
#include <chrono>

/**
 * @private
 */
struct lcb_VIEW_ERROR_CONTEXT_ {
    lcb_STATUS rc;
    const char *first_error_code;
    std::size_t first_error_code_len;
    const char *first_error_message;
    std::size_t first_error_message_len;
    const char *design_document;
    std::size_t design_document_len;
    const char *view;
    std::size_t view_len;
    const char *query_params;
    std::size_t query_params_len;
    uint32_t http_response_code;
    const char *http_response_body;
    std::size_t http_response_body_len;
    const char *endpoint;
    std::size_t endpoint_len;
};

/** @private */
struct lcb_CMDVIEW_ {
    static const std::string &operation_name()
    {
        static std::string name = LCBTRACE_OP_VIEW;
        return name;
    }

    bool view_or_design_document_empty() const
    {
        return view_name_.empty() || design_document_name_.empty();
    }

    bool has_callback() const
    {
        return callback_ != nullptr;
    }

    lcb_STATUS callback(lcb_VIEW_CALLBACK row_callback)
    {
        callback_ = row_callback;
        return LCB_SUCCESS;
    }

    lcb_VIEW_CALLBACK callback() const
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

    lcb_STATUS design_document_name(const char *name, std::size_t name_len)
    {
        if (name == nullptr || name_len == 0) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        design_document_name_.assign(name, name_len);
        return LCB_SUCCESS;
    }

    const std::string &design_document_name() const
    {
        return design_document_name_;
    }

    lcb_STATUS view_name(const char *name, std::size_t name_len)
    {
        if (name == nullptr || name_len == 0) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        view_name_.assign(name, name_len);
        return LCB_SUCCESS;
    }

    const std::string &view_name() const
    {
        return view_name_;
    }

    lcb_STATUS option_string(const char *options, std::size_t options_len)
    {
        if (options == nullptr || options_len == 0) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        option_string_.assign(options, options_len);
        return LCB_SUCCESS;
    }

    const std::string &option_string() const
    {
        return option_string_;
    }

    lcb_STATUS post_data(const char *data, std::size_t data_len)
    {
        if (data == nullptr || data_len == 0) {
            return LCB_ERR_INVALID_ARGUMENT;
        }
        post_data_.assign(data, data_len);
        return LCB_SUCCESS;
    }

    const std::string &post_data() const
    {
        return post_data_;
    }

    bool has_post_data() const
    {
        return !post_data_.empty();
    }

    lcb_STATUS include_documents(bool include_docs)
    {
        include_documents_ = include_docs;
        return LCB_SUCCESS;
    }

    bool include_documents() const
    {
        return include_documents_;
    }

    lcb_STATUS max_concurrent_documents(std::uint32_t max_docs)
    {
        max_concurrent_documents_ = max_docs;
        return LCB_SUCCESS;
    }

    std::uint32_t max_concurrent_documents() const
    {
        return max_concurrent_documents_;
    }

    lcb_STATUS do_not_parse_rows(bool flag)
    {
        do_not_parse_rows_ = flag;
        return LCB_SUCCESS;
    }

    bool do_not_parse_rows() const
    {
        return do_not_parse_rows_;
    }

    void *cookie()
    {
        return cookie_;
    }

    void cookie(void *cookie)
    {
        cookie_ = cookie;
    }

    lcb_STATUS store_handle_refence_to(lcb_VIEW_HANDLE **storage)
    {
        handle_ = storage;
        return LCB_SUCCESS;
    }

    void handle(lcb_VIEW_HANDLE *handle) const
    {
        if (handle_ != nullptr) {
            *handle_ = handle;
        }
    }

  private:
    std::chrono::microseconds timeout_{0};
    std::chrono::nanoseconds start_time_{0};

    lcbtrace_SPAN *parent_span_{nullptr};
    std::string design_document_name_{};
    std::string view_name_{};

    /**Any URL parameters to be passed to the view should be specified here.
     * The library will internally insert a `?` character before the options
     * (if specified), so do not place one yourself.
     *
     * The format of the options follows the standard for passing parameters
     * via HTTP requests; thus e.g. `key1=value1&key2=value2`. This string
     * is itself not parsed by the library but simply appended to the URL. */
    std::string option_string_{};

    std::string post_data_{};

    /**
     * The maximum number of internal get requests to issue concurrently for
     * @c F_INCLUDE_DOCS. This is useful for large view responses where
     * there is a potential for a large number of responses resulting in a large
     * number of get requests; increasing memory usage.
     *
     * Setting this value will attempt to throttle the number of get requests,
     * so that no more than this number of requests will be in progress at any
     * given time.
     */
    std::uint32_t max_concurrent_documents_{0};
    bool include_documents_{false};
    bool do_not_parse_rows_{false};

    void *cookie_{nullptr};
    lcb_VIEW_CALLBACK callback_{nullptr};
    lcb_VIEW_HANDLE **handle_{nullptr};
};

/**@brief Response structure representing a row.
 *
 * This is provided for each invocation of the
 * lcb_CMDVIEWQUERY::callback invocation. The `key` and `nkey` fields here
 * refer to the first argument passed to the `emit` function by the
 * `map` function.
 *
 * This response structure may be used as-is, in case the values are simple,
 * or may be relayed over to a more advanced JSON parser to decode the
 * individual key and value properties.
 *
 * @note
 * The #key and #value fields are JSON encoded. This means that if they are
 * bare strings, they will be surrounded by quotes. On the other hand, the
 * #docid is _not_ JSON encoded and is provided with any surrounding quotes
 * stripped out (this is because the document ID is always a string). Please
 * take note of this if doing any form of string comparison/processing.
 *
 * @note
 * If the @ref LCB_CMDVIEWQUERY_F_NOROWPARSE flag has been set, the #value
 * field will contain the raw row contents, rather than the constituent
 * elements.
 *
 */
struct lcb_RESPVIEW_ {
    lcb_VIEW_ERROR_CONTEXT ctx;
    void *cookie;
    std::uint16_t rflags;

    const char *docid;  /**< Document ID (i.e. memcached key) associated with this row */
    std::size_t ndocid; /**< Length of document ID */

    const char *key;
    std::size_t nkey;

    /**Emitted value. If `rflags & LCB_RESP_F_FINAL` is true then this will
     * contain the _metadata_ of the view response itself. This includes the
     * `total_rows` field among other things, and should be parsed as JSON */
    const char *value;

    std::size_t nvalue; /**< Length of emitted value */

    /**If this is a spatial view, the GeoJSON geometry fields will be here */
    const char *geometry;
    std::size_t ngeometry;

    /**If the request failed, this will contain the raw underlying request.
     * You may inspect this request and perform some other processing on
     * the underlying HTTP data. Note that this may not necessarily contain
     * the entire response body; just the chunk at which processing failed.*/
    const lcb_RESPHTTP *htresp;

    /**If @ref LCB_CMDVIEWQUERY_F_INCLUDE_DOCS was specified in the request,
     * this will contain the response for the _GET_ command. This is the same
     * response as would be received in the `LCB_CALLBACK_GET` for
     * lcb_get3().
     *
     * Note that this field should be checked for various errors as well, as it
     * is remotely possible the get request did not succeed.
     *
     * If the @ref LCB_CMDVIEWQUERY_F_INCLUDE_DOCS flag was not specified, this
     * field will be `NULL`.
     */
    const lcb_RESPGET *docresp;

    lcb_VIEW_HANDLE *handle;
};

#endif // LIBCOUCHBASE_CAPI_VIEWS_HH
