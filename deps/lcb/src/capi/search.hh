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
    const char *query{nullptr};
    std::size_t nquery{0};
    lcb_SEARCH_CALLBACK callback{nullptr};
    lcb_SEARCH_HANDLE **handle{nullptr};
};

#endif // LIBCOUCHBASE_CAPI_SEARCH_HH
