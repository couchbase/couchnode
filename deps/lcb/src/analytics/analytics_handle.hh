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

#ifndef LIBCOUCHBASE_ANALYTICS_HANDLE_HH
#define LIBCOUCHBASE_ANALYTICS_HANDLE_HH

#include <cstddef>
#include <cstdint>
#include <chrono>

#include <jsparse/parser.h>

#include "docreq/docreq.h"

#include "capi/cmd_analytics.hh"

/**
 * @private
 */
struct IngestRequest : lcb::docreq::DocRequest {
    lcb_ANALYTICS_HANDLE *request_{nullptr};
    std::string row;
};

/**
 * @private
 */
struct lcb_ANALYTICS_HANDLE_ : lcb::jsparse::Parser::Actions {
    const Json::Value &json_const() const
    {
        return json;
    }

    void unref()
    {
        if (!--refcount) {
            delete this;
        }
    }

    void ref()
    {
        refcount++;
    }

    /**
     * Issues the HTTP request for the query
     * @param payload The body to send
     * @return Error code from lcb's http subsystem
     */
    lcb_STATUS issue_htreq(const std::string &body);

    lcb_STATUS issue_htreq()
    {
        std::string s = Json::FastWriter().write(json);
        return issue_htreq(s);
    }

    /**
     * Attempt to retry the query. This will inspect the meta (if present)
     * for any errors indicating that a failure might be a result of a stale
     * plan, and if this query was retried already.
     * @return true if the retry was successful.
     */
    bool maybe_retry();

    /**
     * Returns true if payload matches retry conditions.
     */
    bool has_retriable_error(const Json::Value &root);

    /**
     * Pass a row back to the application
     * @param resp The response. This is populated with state information
     *  from the current query
     * @param is_last Whether this is the last row. If this is the last, then
     *  the RESP_F_FINAL flag is set, and no further callbacks will be invoked
     */
    void invoke_row(lcb_RESPANALYTICS *resp, bool is_last);

    lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, const lcb_CMDANALYTICS *cmd);
    lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, lcb_DEFERRED_HANDLE *handle);
    ~lcb_ANALYTICS_HANDLE_() override;

    // Parser overrides:
    void JSPARSE_on_row(const lcb::jsparse::Row &row) override
    {
        lcb_RESPANALYTICS resp{};
        resp.handle = this;
        resp.row = static_cast<const char *>(row.row.iov_base);
        resp.nrow = row.row.iov_len;
        rows_number_++;
        if (ingest_options_.method != LCB_INGEST_METHOD_NONE) {
            auto *req = new IngestRequest();
            req->request_ = this;
            req->row.assign(static_cast<const char *>(row.row.iov_base), row.row.iov_len);
            document_queue_->add(req);
            ref();
        }
        invoke_row(&resp, false);
    }
    void JSPARSE_on_error(const std::string &) override
    {
        last_error_ = LCB_ERR_PROTOCOL_ERROR;
    }

    void JSPARSE_on_complete(const std::string &) override
    {
        // Nothing
    }

    const lcb_INGEST_OPTIONS &ingest_options() const
    {
        return ingest_options_;
    }

    lcbtrace_SPAN *span() const
    {
        return span_;
    }

    void *cookie()
    {
        return cookie_;
    }

    const lcb_RESPHTTP *http_response() const
    {
        return http_response_;
    }

    lcb_HTTP_HANDLE_ *http_request() const
    {
        return http_request_;
    }

    bool is_cancelled() const
    {
        return callback_ == nullptr;
    }

    lcb_STATUS cancel()
    {
        if (callback_ != nullptr) {
            callback_ = nullptr;
            if (document_queue_) {
                document_queue_->cancel();
            }
        }
        return LCB_SUCCESS;
    }

    void clear_callback()
    {
        callback_ = nullptr;
    }

    void clear_http_request()
    {
        http_request_ = nullptr;
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

    bool has_error() const
    {
        return last_error_ != LCB_SUCCESS;
    }

    lcb_STATUS last_error() const
    {
        return last_error_;
    }

    static lcbtrace_THRESHOLDOPTS service()
    {
        return LCBTRACE_THRESHOLD_ANALYTICS;
    }

    static const std::string &operation_name()
    {
        static std::string name = LCBTRACE_OP_ANALYTICS;
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
    lcb_ANALYTICS_CALLBACK callback_{nullptr};
    lcb_INSTANCE *instance_{nullptr};
    lcb_STATUS last_error_{LCB_SUCCESS};
    lcb_U32 timeout_{0};
    // How many rows were received. Used to avoid parsing the meta
    size_t rows_number_{0};
    int retries_{0};

    /** Request body as received from the application */
    Json::Value json{};
    /** String of the original statement. Cached here to avoid jsoncpp lookups */
    std::string statement_{};
    std::string query_params_{};
    std::string client_context_id_{};
    std::string first_error_message_{};
    uint32_t first_error_code_{};

    /** Whether we're retrying this */
    bool was_retried_{false};
    bool priority_{false};

    /** Non-empty if this is deferred query check/fetch */
    std::string deferred_handle_{};

    lcb_INGEST_OPTIONS ingest_options_{};
    lcb::docreq::Queue *document_queue_{nullptr};
    unsigned refcount{1};

    lcbtrace_SPAN *parent_span_{nullptr};
    lcbtrace_SPAN *span_{nullptr};
    std::string impostor_{};
};

#endif // LIBCOUCHBASE_ANALYTICS_HANDLE_HH
