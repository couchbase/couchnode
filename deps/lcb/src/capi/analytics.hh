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

struct lcb_INGEST_OPTIONS_ {
    lcb_INGEST_METHOD method;
    std::uint32_t exptime;
    bool ignore_errors;
    lcb_INGEST_DATACONVERTER_CALLBACK data_converter;

    lcb_INGEST_OPTIONS_();
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

    Json::Value root{Json::objectValue};
    std::string query{};
    lcb_ANALYTICS_CALLBACK callback{nullptr};
    lcb_ANALYTICS_HANDLE **handle{nullptr};
    lcb_INGEST_OPTIONS *ingest{nullptr};
    int priority{-1};
};

#endif // LIBCOUCHBASE_CAPI_ANALYTICS_HH
