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

#ifndef LIBCOUCHBASE_N1QL_QUERY_HANDLE_HH
#define LIBCOUCHBASE_N1QL_QUERY_HANDLE_HH

#include <cstddef>
#include <cstdint>
#include <chrono>

#include <jsparse/parser.h>

#include "capi/cmd_query.hh"
#include "query_cache.hh"

/**
 * @private
 */
namespace lcb
{
struct query_error {
    std::string message{};
    uint32_t code{};
    bool retry{false};
    uint32_t reason_code{0};
};
} // namespace lcb

/**
 * @private
 */
struct lcb_QUERY_HANDLE_ : lcb::jsparse::Parser::Actions {
    lcb_QUERY_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, const lcb_CMDQUERY *cmd);
    ~lcb_QUERY_HANDLE_() override;

    bool is_cancelled() const
    {
        return callback_ == nullptr;
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

    const Json::Value &json_const() const
    {
        return json;
    }

    lcb_QUERY_CACHE &cache() const
    {
        return *instance_->n1ql_cache;
    }

    /**
     * Creates the sub-lcb_QUERY_HANDLE_ for the PREPARE statement. This inspects the
     * current request (see ::json) and copies it so that we execute the
     * PREPARE instead of the actual query.
     * @return see issue_htreq()
     */
    lcb_STATUS request_plan();

    /**
     * Use the plan to execute the given query, and issues the query
     * @param plan The plan itself
     * @return see issue_htreq()
     */
    lcb_STATUS apply_plan(const Plan &plan);

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

    void backoff_and_issue_http_request(uint32_t interval)
    {
        lcb_aspend_add(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
        backoff_timer_.rearm(interval);
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
    lcb_RETRY_ACTION has_retriable_error(lcb_STATUS &rc);

    lcbauth_RESULT request_credentials(lcbauth_REASON reason);
    lcb_STATUS request_address();

    /**
     * Did the application request this query to use prepared statements
     * @return true if using prepared statements
     */
    bool use_prepcache() const
    {
        return prepared_statement_;
    }

    /**
     * Pass a row back to the application
     * @param resp The response. This is populated with state information
     *  from the current query
     * @param is_last Whether this is the last row. If this is the last, then
     *  the RESP_F_FINAL flag is set, and no further callbacks will be invoked
     */
    void invoke_row(lcb_RESPQUERY *resp, bool is_last);

    bool parse_meta(const char *row, size_t row_len, lcb_STATUS &rc);

    /**
     * Fail an application-level query because the prepared statement failed
     * @param orig The response from the PREPARE request
     * @param err The error code
     */
    void fail_prepared(const lcb_RESPQUERY *orig, lcb_STATUS err);

    // Parser overrides:
    void JSPARSE_on_row(const lcb::jsparse::Row &row) override
    {
        lcb_RESPQUERY resp{};
        resp.row = static_cast<const char *>(row.row.iov_base);
        resp.nrow = row.row.iov_len;
        rows_number_++;
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

    void on_timeout()
    {
        if (last_error_ == LCB_SUCCESS) {
            last_error_ = LCB_ERR_TIMEOUT;
        }
        http_response_ = nullptr;
        delete this;
    }

    void cancel_prepare_query()
    {
        if (prepare_query_ != nullptr) {
            lcb_query_cancel(instance_, prepare_query_);
            prepare_query_ = nullptr;
        }
    }

    const std::string &statement() const
    {
        return statement_;
    }

    void *cookie()
    {
        return cookie_;
    }

    bool is_idempotent() const
    {
        return idempotent_;
    }

    int retry_attempts() const
    {
        return retries_;
    }

    bool has_error() const
    {
        return last_error_ != LCB_SUCCESS;
    }

    lcb_STATUS last_error() const
    {
        return last_error_;
    }

    lcb_STATUS cancel()
    {
        if (backoff_timer_.is_armed()) {
            lcb_aspend_del(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
            backoff_timer_.cancel();
        }
        if (prepare_query_) {
            prepare_query_->cancel();
            prepare_query_ = nullptr;
        }
        callback_ = nullptr;
        return LCB_SUCCESS;
    }

    static lcbtrace_THRESHOLDOPTS service()
    {
        return LCBTRACE_THRESHOLD_QUERY;
    }

    static const std::string &operation_name()
    {
        static std::string name = LCBTRACE_OP_QUERY;
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
    void on_backoff();

    const lcb_RESPHTTP *http_response_{nullptr};
    lcb_HTTP_HANDLE *http_request_{nullptr};
    lcb::jsparse::Parser *parser_{nullptr};
    void *cookie_{nullptr};
    lcb_QUERY_CALLBACK callback_{nullptr};
    lcb_INSTANCE *instance_{nullptr};
    lcb_STATUS last_error_{LCB_SUCCESS};
    bool prepared_statement_{false};
    bool use_multi_bucket_authentication_{false};
    std::uint32_t timeout{0};
    // How many rows were received. Used to avoid parsing the meta
    std::size_t rows_number_{0};

    /** The PREPARE query itself */
    struct lcb_QUERY_HANDLE_ *prepare_query_{nullptr};

    /** Request body as received from the application */
    Json::Value json;
    /** String of the original statement. Cached here to avoid jsoncpp lookups */
    std::string statement_;
    std::string client_context_id_;
    lcb::query_error first_error{};

    /** Whether we're retrying this */
    int retries_{0};

    std::string username_{};
    std::string password_{};
    std::string hostname{};
    std::string port{};
    std::string endpoint{};
    std::vector<int> used_nodes{};
    std::int64_t last_config_revision_{0};
    bool idempotent_{false};

    lcbtrace_SPAN *parent_span_{nullptr};
    lcbtrace_SPAN *span_{nullptr};

    lcb::io::Timer<lcb_QUERY_HANDLE_, &lcb_QUERY_HANDLE_::on_timeout> timeout_timer_;
    lcb::io::Timer<lcb_QUERY_HANDLE_, &lcb_QUERY_HANDLE_::on_backoff> backoff_timer_;
    std::string impostor_{};
};

#endif // LIBCOUCHBASE_N1QL_QUERY_HANDLE_HH
