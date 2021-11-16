/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2021 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_SEARCH_HANDLE_HH
#define LIBCOUCHBASE_SEARCH_HANDLE_HH

#include <cstddef>
#include <cstdint>
#include <chrono>

#include <jsparse/parser.h>

#include "capi/cmd_search.hh"

/**
 * @private
 */
struct lcb_SEARCH_HANDLE_ : lcb::jsparse::Parser::Actions {
    void invoke_row(lcb_RESPSEARCH *resp);

    void invoke_last();

    lcb_SEARCH_HANDLE_(lcb_INSTANCE *, void *, const lcb_CMDSEARCH *);

    ~lcb_SEARCH_HANDLE_() override;

    void JSPARSE_on_row(const lcb::jsparse::Row &datum) override
    {
        lcb_RESPSEARCH resp{};
        resp.row = static_cast<const char *>(datum.row.iov_base);
        resp.nrow = datum.row.iov_len;
        rows_number_++;
        invoke_row(&resp);
    }
    void JSPARSE_on_error(const std::string &) override
    {
        last_error_ = LCB_ERR_PROTOCOL_ERROR;
    }
    void JSPARSE_on_complete(const std::string &) override
    {
        // Nothing
    }

    bool is_cancelled() const
    {
        return callback_ == nullptr;
    }

    bool has_error() const
    {
        return last_error_ != LCB_SUCCESS;
    }

    lcb_STATUS cancel()
    {
        callback_ = nullptr;
        return LCB_SUCCESS;
    }

    lcb_STATUS last_error() const
    {
        return last_error_;
    }

    void clear_callback()
    {
        callback_ = nullptr;
    }

    void clear_http_request()
    {
        http_request_ = nullptr;
    }

    void clear_http_response()
    {
        http_response_ = nullptr;
    }

    void http_response(const lcb_RESPHTTP *resp)
    {
        http_response_ = resp;

        const lcb_HTTP_ERROR_CONTEXT *ctx;
        lcb_resphttp_error_context(http_response_, &ctx);
        lcb_STATUS rc = lcb_errctx_http_rc(ctx);
        std::uint32_t status_code = 0;
        lcb_errctx_http_response_code(ctx, &status_code);
        if ((rc != LCB_SUCCESS || status_code != 200) && last_error_ == LCB_SUCCESS) {
            last_error_ = rc != LCB_SUCCESS ? rc : LCB_ERR_HTTP;
        }
    }

    void consume_http_chunk()
    {
        if (http_response_) {
            const char *body = nullptr;
            std::size_t body_len = 0;
            lcb_resphttp_body(http_response_, &body, &body_len);
            parser_->feed(body, body_len);
        }
    }

    static lcbtrace_THRESHOLDOPTS service()
    {
        return LCBTRACE_THRESHOLD_SEARCH;
    }

    static const std::string &operation_name()
    {
        static std::string name = LCBTRACE_OP_SEARCH;
        return name;
    }

    lcbtrace_SPAN *parent_span() const
    {
        return parent_span_;
    }

    const std::string &client_context_id() const
    {
        return client_context_id_;
    }

    int retries() const
    {
        return retries_;
    }

  private:
    const lcb_RESPHTTP *http_response_{nullptr};
    lcb_HTTP_HANDLE *http_request_{nullptr};
    lcb::jsparse::Parser *parser_{nullptr};
    void *cookie_{nullptr};
    lcb_SEARCH_CALLBACK callback_{nullptr};
    lcb_INSTANCE *instance_{nullptr};
    size_t rows_number_{0};
    lcb_STATUS last_error_{LCB_SUCCESS};
    lcbtrace_SPAN *parent_span_{nullptr};
    lcbtrace_SPAN *span_{nullptr};
    std::string index_name_;
    std::string error_message_;
    std::string client_context_id_{};
    int retries_{0};
};

#endif // LIBCOUCHBASE_SEARCH_HANDLE_HH
