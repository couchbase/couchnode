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

#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

/**
 * @private
 */
struct lcb_QUERY_ERROR_CONTEXT_ {
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
    const char *http_response_message;
    size_t http_response_message_len;
    const char *endpoint;
    size_t endpoint_len;
};

/**
 * Prepare and cache the query if required. This may be used on frequently
 * issued queries, so they perform better.
 */
#define LCB_CMDN1QL_F_PREPCACHE (1u << 16u)

/** The lcb_CMDQUERY::query member is an internal JSON structure. @internal */
#define LCB_CMDN1QL_F_JSONQUERY (1u << 17u)

/**
 * This is an Analytics query.
 *
 * @committed
 */
#define LCB_CMDN1QL_F_ANALYTICSQUERY (1u << 18u)

/**
 * Command structure for N1QL queries. Typically an application will use the
 * lcb_N1QLPARAMS structure to populate the #query and #content_type fields.
 *
 * The #callback field must be specified, and indicates the function the
 * library should call when more response data has arrived.
 */
struct lcb_CMDQUERY_ {
    std::uint32_t cmdflags;
    std::uint32_t exptime;
    std::uint64_t cas;
    std::uint32_t cid;
    const char *scope;
    std::size_t nscope;
    const char *collection;
    std::size_t ncollection;
    lcb_KEYBUF key;
    std::uint32_t timeout{0};
    lcbtrace_SPAN *pspan{nullptr};

    Json::Value root{};
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
    std::string query{};
    std::string scope_qualifier{};
    std::string scope_name{};

    /** Callback to be invoked for each row */
    lcb_QUERY_CALLBACK callback{nullptr};

    /**Request handle. Will be set to the handle which may be passed to
     * lcb_query_cancel() */
    lcb_QUERY_HANDLE **handle{nullptr};
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
