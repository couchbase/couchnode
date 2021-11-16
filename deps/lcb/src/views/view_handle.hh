/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2021 Couchbase, Inc.
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

#include <libcouchbase/couchbase.h>
#include <libcouchbase/pktfwd.h>
#include <jsparse/parser.h>
#include <string>
#include "docreq/docreq.h"

#include "capi/cmd_view.hh"

struct VRDocRequest : lcb::docreq::DocRequest {
    lcb_VIEW_HANDLE *view_request_{nullptr};
    lcb_IOV key;
    lcb_IOV value;
    lcb_IOV geo;
    std::string rowbuf;
};

struct lcb_VIEW_HANDLE_ : lcb::jsparse::Parser::Actions {
    lcb_VIEW_HANDLE_(lcb_INSTANCE *, void *, const lcb_CMDVIEW *);
    ~lcb_VIEW_HANDLE_() override;
    void invoke_last(lcb_STATUS err);
    void invoke_last()
    {
        invoke_last(last_error_);
    }
    void invoke_row(lcb_RESPVIEW *);
    void unref(unsigned expected_minimum_count = 1)
    {
        lcb_assert(refcount_ >= expected_minimum_count);
        if (!--refcount_) {
            delete this;
        }
    }
    void ref()
    {
        refcount_++;
    }
    void cancel();

    /**
     * Perform the actual HTTP request
     * @param cmd User's command
     */
    lcb_STATUS request_http(const lcb_CMDVIEW *cmd);

    void JSPARSE_on_row(const lcb::jsparse::Row &) override;
    void JSPARSE_on_error(const std::string &) override;
    void JSPARSE_on_complete(const std::string &) override;

    void http_response(const lcb_RESPHTTP *resp)
    {
        http_response_ = resp;
    }

    void clear_http_response()
    {
        http_response_ = nullptr;
    }

    void clear_http_request()
    {
        http_request_ = nullptr;
    }

    bool is_cancelled() const
    {
        return callback_ == nullptr;
    }

    bool has_error() const
    {
        return last_error_ != LCB_SUCCESS;
    }

    void last_error(lcb_STATUS error)
    {
        last_error_ = error;
    }

    lcb_STATUS last_error() const
    {
        return last_error_;
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

    lcbtrace_SPAN *span()
    {
        return span_;
    }

    lcb_HTTP_HANDLE_ *http_request()
    {
        return http_request_;
    }

    static lcbtrace_THRESHOLDOPTS service()
    {
        return LCBTRACE_THRESHOLD_VIEW;
    }

    static const std::string &operation_name()
    {
        static std::string name = LCBTRACE_OP_VIEW;
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
    /** Current HTTP response to provide in callbacks */
    const lcb_RESPHTTP *http_response_{nullptr};
    /** HTTP request object, in case we need to cancel prematurely */
    lcb_HTTP_HANDLE *http_request_{nullptr};
    lcb::jsparse::Parser *parser_{nullptr};
    void *cookie_{nullptr};
    lcb::docreq::Queue *document_queue_{nullptr};
    lcb_VIEW_CALLBACK callback_{nullptr};
    lcb_INSTANCE *instance_{nullptr};

    std::string design_document_{};
    std::string view_{};
    std::string query_params_{};
    std::string first_error_code_{};
    std::string first_error_message_{};
    std::string client_context_id_{};

    unsigned refcount_{1};
    bool include_docs_{false};
    bool do_not_parse_rows_{false};
    bool spatial_{false};
    int retries_{0};

    lcb_STATUS last_error_{LCB_SUCCESS};
    lcbtrace_SPAN *parent_span_{nullptr};
    lcbtrace_SPAN *span_{nullptr};
};
