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

#include "internal.h"

#include "auth-priv.h"
#include "http/http-priv.h"

#include "search_handle.hh"
#include "capi/cmd_http.hh"

#include <regex>

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) (req)->instance_->settings, "searchh", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGARGS2(req, lvl) (instance)->settings, "searchh", LCB_LOG_##lvl, __FILE__, __LINE__

static void chunk_callback(lcb_INSTANCE *, int, const lcb_RESPHTTP *resp)
{
    lcb_SEARCH_HANDLE_ *req = nullptr;
    lcb_resphttp_cookie(resp, reinterpret_cast<void **>(&req));

    req->http_response(resp);

    if (lcb_resphttp_is_final(resp)) {
        req->invoke_last();
        delete req;

    } else if (req->is_cancelled()) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        delete req;
    } else {
        req->consume_http_chunk();
    }
}

void lcb_SEARCH_HANDLE_::invoke_row(lcb_RESPSEARCH *resp)
{
    resp->cookie = cookie_;
    resp->htresp = http_response_;
    resp->handle = this;
    if (resp->htresp) {
        resp->ctx.http_response_code = resp->htresp->ctx.response_code;
        resp->ctx.endpoint = resp->htresp->ctx.endpoint;
        resp->ctx.endpoint_len = resp->htresp->ctx.endpoint_len;
    }
    resp->ctx.index = index_name_.c_str();
    resp->ctx.index_len = index_name_.size();
    switch (resp->ctx.http_response_code) {
        case 500:
            resp->ctx.rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
            break;
        case 401:
        case 403:
            resp->ctx.rc = LCB_ERR_AUTHENTICATION_FAILURE;
            break;
    }

    if (callback_) {
        if (resp->rflags & LCB_RESP_F_FINAL) {
            Json::Value meta;
            if (Json::Reader(Json::Features::strictMode()).parse(resp->row, resp->row + resp->nrow, meta)) {
                const Json::Value &top_error = meta["error"];
                if (top_error.isString()) {
                    resp->ctx.has_top_level_error = 1;
                    error_message_ = top_error.asString();
                } else {
                    const Json::Value &status = meta["status"];
                    if (status.isObject()) {
                        const Json::Value &errors = meta["errors"];
                        if (!errors.isNull()) {
                            error_message_ = Json::FastWriter().write(errors);
                        }
                    }
                }
                if (!error_message_.empty()) {
                    resp->ctx.error_message = error_message_.c_str();
                    resp->ctx.error_message_len = error_message_.size();
                    if (error_message_.find("QueryBleve parsing") != std::string::npos) {
                        resp->ctx.rc = LCB_ERR_PARSING_FAILURE;
                    } else if (resp->ctx.http_response_code == 400) {
                        if (error_message_.find("not_found") != std::string::npos) {
                            resp->ctx.rc = LCB_ERR_INDEX_NOT_FOUND;
                        } else if (error_message_.find("num_fts_indexes") != std::string::npos) {
                            resp->ctx.rc = LCB_ERR_QUOTA_LIMITED;
                        }
                    } else if (resp->ctx.http_response_code == 429) {
                        std::regex rate_limiting_message(
                            "num_concurrent_requests|num_queries_per_min|ingress_mib_per_min|egress_mib_per_min");
                        if (std::regex_search(error_message_, rate_limiting_message)) {
                            resp->ctx.rc = LCB_ERR_RATE_LIMITED;
                        }
                    }
                }
            }
        }
        callback_(instance_, LCB_CALLBACK_SEARCH, resp);
    }
}

void lcb_SEARCH_HANDLE_::invoke_last()
{
    lcb_RESPSEARCH resp{};
    resp.rflags |= LCB_RESP_F_FINAL;
    resp.ctx.rc = last_error_;

    if (parser_) {
        lcb_IOV meta;
        parser_->get_postmortem(meta);
        resp.row = static_cast<const char *>(meta.iov_base);
        resp.nrow = meta.iov_len;
    }

    if (span_ != nullptr) {
        lcb::trace::finish_http_span(span_, this);
        span_ = nullptr;
    }
    if (http_request_ != nullptr) {
        http_request_->span = nullptr;
    }
    if (http_request_ != nullptr) {
        record_http_op_latency(index_name_.c_str(), "search", instance_, http_request_->start);
    }

    invoke_row(&resp);
    clear_callback();
}

lcb_SEARCH_HANDLE_::lcb_SEARCH_HANDLE_(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSEARCH *cmd)
    : lcb::jsparse::Parser::Actions(), parser_(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_FTS, this)),
      cookie_(cookie), callback_(cmd->callback()), instance_(instance)
{
    std::string content_type("application/json");

    lcb_CMDHTTP *htcmd;
    lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_SEARCH);
    lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_handle(htcmd, &http_request_);
    lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());
    lcb_cmdhttp_streaming(htcmd, true);

    Json::Value root;
    if (!Json::Reader().parse(cmd->query(), root)) {
        last_error_ = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    const Json::Value &constRoot = root;
    const Json::Value &j_ixname = constRoot["indexName"];
    if (!j_ixname.isString()) {
        last_error_ = LCB_ERR_INVALID_ARGUMENT;
        return;
    }
    index_name_ = j_ixname.asString();
    {
        char buf[32];
        size_t nbuf = snprintf(buf, sizeof(buf), "%016" PRIx64, lcb_next_rand64());
        client_context_id_.assign(buf, nbuf);
    }
    if (instance_->settings->tracer) {
        parent_span_ = cmd->parent_span();
    }

    std::string url;
    url.append("api/index/").append(j_ixname.asCString()).append("/query");
    lcb_cmdhttp_path(htcmd, url.c_str(), url.size());

    // Making a copy here to ensure that we don't accidentally create a new
    // 'ctl' field.
    const Json::Value &ctl = constRoot["value"];
    uint32_t timeout = cmd->timeout_or_default_in_microseconds(LCBT_SETTING(instance_, search_timeout));
    if (ctl.isObject()) {
        const Json::Value &tmo = ctl["timeout"];
        if (tmo.isNumeric()) {
            timeout = tmo.asLargestUInt() * 1000; /* ms -> us */
        }
    } else {
        root["ctl"]["timeout"] = timeout / 1000; /* us -> ms */
    }
    lcb_cmdhttp_timeout(htcmd, timeout);
    if (cmd->want_impersonation()) {
        htcmd->set_header("cb-on-behalf-of", cmd->impostor());
    }

    std::string qbody(Json::FastWriter().write(root));
    lcb_cmdhttp_body(htcmd, qbody.c_str(), qbody.size());

    span_ = lcb::trace::start_http_span(instance_->settings, this);
    lcb_cmdhttp_parent_span(htcmd, span_);

    last_error_ = lcb_http(instance_, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (last_error_ == LCB_SUCCESS) {
        http_request_->set_callback(reinterpret_cast<lcb_RESPCALLBACK>(chunk_callback));
    }
}

lcb_SEARCH_HANDLE_::~lcb_SEARCH_HANDLE_()
{
    invoke_last();

    if (http_request_ != nullptr) {
        lcb_http_cancel(instance_, http_request_);
        http_request_ = nullptr;
    }

    if (parser_ != nullptr) {
        delete parser_;
        parser_ = nullptr;
    }
}
