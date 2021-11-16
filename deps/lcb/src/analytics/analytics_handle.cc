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

#include "n1ql/query_utils.hh"
#include "analytics_handle.hh"
#include "capi/cmd_analytics.hh"
#include "capi/cmd_http.hh"
#include "capi/cmd_store.hh"

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) (req)->instance_->settings, "analyticsh", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGARGS2(req, lvl) (instance)->settings, "analyticsh", LCB_LOG_##lvl, __FILE__, __LINE__

static void doc_callback(lcb_INSTANCE *, int, const lcb_RESPSTORE *rb)
{
    lcb::docreq::DocRequest *dreq;
    lcb_respstore_cookie(rb, reinterpret_cast<void **>(&dreq));
    lcb::docreq::Queue *q = dreq->parent;

    q->ref();

    q->n_awaiting_response--;
    dreq->ready = 1;

    q->check();

    q->unref();
}

static lcb_STATUS cb_op_schedule(lcb::docreq::Queue *q, lcb::docreq::DocRequest *dreq)
{
    auto *req = reinterpret_cast<IngestRequest *>(dreq);
    lcb_ANALYTICS_HANDLE_ *areq = req->request_;

    lcb_STORE_OPERATION op = LCB_STORE_UPSERT;
    switch (areq->ingest_options().method) {
        case LCB_INGEST_METHOD__MAX:
        case LCB_INGEST_METHOD_NONE:
            return LCB_ERR_INVALID_ARGUMENT;
        case LCB_INGEST_METHOD_INSERT:
            op = LCB_STORE_INSERT;
            break;
        case LCB_INGEST_METHOD_REPLACE:
            op = LCB_STORE_REPLACE;
            break;
        case LCB_INGEST_METHOD_UPSERT:
            op = LCB_STORE_UPSERT;
            break;
    }

    lcb_INGEST_PARAM param;
    param.method = areq->ingest_options().method;
    param.row = req->row.c_str();
    param.row_len = req->row.size();
    param.cookie = areq->cookie();
    switch (areq->ingest_options().data_converter(q->instance, &param)) {
        case LCB_INGEST_STATUS_OK:
            /* continue */
            break;
        case LCB_INGEST_STATUS_IGNORE:
            /* assume that the user hasn't allocated anything */
            return LCB_SUCCESS;
        default:
            return LCB_ERR_SDK_INTERNAL;
    }
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, op);
    lcb_cmdstore_expiry(cmd, areq->ingest_options().exptime);
    lcb_cmdstore_key(cmd, param.id, param.id_len);
    lcb_cmdstore_parent_span(cmd, areq->span());
    if (param.out) {
        lcb_cmdstore_value(cmd, param.out, param.out_len);
    } else {
        lcb_cmdstore_value(cmd, req->row.c_str(), req->row.size());
    }
    dreq->callback = (lcb_RESPCALLBACK)doc_callback;
    cmd->treat_cookie_as_callback(true);
    lcb_STATUS err = lcb_store(q->instance, &dreq->callback, cmd);
    lcb_cmdstore_destroy(cmd);
    if (param.id_dtor && param.id) {
        param.id_dtor(param.id);
    }
    if (param.out_dtor && param.out) {
        param.out_dtor(param.out);
    }
    return err;
}

static void cb_doc_ready(lcb::docreq::Queue *q, lcb::docreq::DocRequest *req_base)
{
    auto *req = (IngestRequest *)req_base;
    /* TODO: check if we should ignore errors */
    delete req;

    if (q->parent) {
        reinterpret_cast<lcb_ANALYTICS_HANDLE_ *>(q->parent)->unref();
    }
}

static void cb_docq_throttle(lcb::docreq::Queue *q, int enabled)
{
    const auto *req = reinterpret_cast<const lcb_ANALYTICS_HANDLE_ *>(q->parent);
    if (req == nullptr || req->http_request() == nullptr) {
        return;
    }
    if (enabled) {
        req->http_request()->pause();
    } else {
        req->http_request()->resume();
    }
}

static void chunk_callback(lcb_INSTANCE * /* instance */, int /* cbtype */, const lcb_RESPHTTP *resp)
{
    lcb_ANALYTICS_HANDLE_ *req = nullptr;
    lcb_resphttp_cookie(resp, reinterpret_cast<void **>(&req));

    req->http_response(resp);

    if (lcb_resphttp_is_final(resp)) {
        req->clear_http_request();
        if (!req->maybe_retry()) {
            req->unref();
        }
        return;
    } else if (req->is_cancelled()) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        req->unref();
        return;
    }
    req->consume_http_chunk();
}

lcb_ANALYTICS_HANDLE_::lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, const lcb_CMDANALYTICS *cmd)
    : parser_(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_ANALYTICS, this)), cookie_(user_cookie),
      callback_(cmd->callback()), instance_(obj), ingest_options_(cmd->ingest_options())
{

    std::string encoded = Json::FastWriter().write(cmd->root());

    if (!Json::Reader().parse(encoded, json)) {
        last_error_ = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    const Json::Value &j_statement = json_const()["statement"];
    if (j_statement.isString()) {
        statement_ = j_statement.asString();
    } else if (!j_statement.isNull()) {
        last_error_ = LCB_ERR_INVALID_ARGUMENT;
        return;
    }
    if (cmd->has_explicit_scope_qualifier()) {
        json["query_context"] = cmd->scope_qualifier();
    } else if (cmd->has_scope()) {
        if (obj->settings->conntype != LCB_TYPE_BUCKET || obj->settings->bucket == nullptr) {
            lcb_log(LOGARGS(this, ERROR),
                    LOGFMT
                    "The instance must be associated with a bucket name to use query with query context qualifier",
                    LOGID(this));
            last_error_ = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
        std::string scope_qualifier("default:`");
        scope_qualifier += obj->settings->bucket;
        scope_qualifier += "`.`" + cmd->scope() + "`";
        json["query_context"] = scope_qualifier;
    }
    priority_ = cmd->priority();

    Json::Value &tmoval = json["timeout"];
    if (tmoval.isNull()) {
        // Set the default timeout as the server-side query timeout if no
        // other timeout is used.
        char buf[64] = {0};
        sprintf(buf, "%uus", LCBT_SETTING(obj, analytics_timeout));
        tmoval = buf;
        timeout_ = LCBT_SETTING(obj, analytics_timeout);
    } else if (tmoval.isString()) {
        try {
            auto tmo_ns = lcb_parse_golang_duration(tmoval.asString());
            timeout_ = std::chrono::duration_cast<std::chrono::microseconds>(tmo_ns).count();
        } catch (const lcb_duration_parse_error &) {
            last_error_ = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
    } else {
        // Timeout is not a string!
        last_error_ = LCB_ERR_INVALID_ARGUMENT;
        return;
    }
    const Json::Value &ccid = json["client_context_id"];
    if (ccid.isNull()) {
        char buf[32];
        size_t nbuf = snprintf(buf, sizeof(buf), "%016" PRIx64, lcb_next_rand64());
        client_context_id_.assign(buf, nbuf);
        json["client_context_id"] = client_context_id_;
    } else {
        client_context_id_ = ccid.asString();
    }

    Json::Value tmp = json;
    tmp.removeMember("statement");
    query_params_ = Json::FastWriter().write(cmd->root());

    if (instance_->settings->tracer) {
        parent_span_ = cmd->parent_span();
    }

    if (ingest_options().method != LCB_INGEST_METHOD_NONE) {
        document_queue_ = new lcb::docreq::Queue(instance_);
        document_queue_->parent = this;
        document_queue_->cb_schedule = cb_op_schedule;
        document_queue_->cb_ready = cb_doc_ready;
        document_queue_->cb_throttle = cb_docq_throttle;
        // TODO: docq->max_pending_response;
        lcb_aspend_add(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    }
    if (cmd->want_impersonation()) {
        impostor_ = cmd->impostor();
    }
}

lcb_ANALYTICS_HANDLE_::lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, lcb_DEFERRED_HANDLE *handle)
    : parser_(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_ANALYTICS, this)), cookie_(user_cookie),
      callback_(handle->callback), instance_(obj), deferred_handle_(handle->handle)
{
    timeout_ = LCBT_SETTING(obj, analytics_timeout);
}

lcb_STATUS lcb_ANALYTICS_HANDLE_::issue_htreq(const std::string &body)
{
    lcb_CMDHTTP *htcmd;
    std::string content_type("application/json");

    lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_ANALYTICS);
    lcb_cmdhttp_body(htcmd, body.c_str(), body.size());
    lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());

    std::string url("/query/service");
    std::string hostname{};
    if (deferred_handle_.empty()) {
        lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
    } else {
        lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_GET);
        struct http_parser_url url_info = {};
        if (_lcb_http_parser_parse_url(deferred_handle_.c_str(), deferred_handle_.size(), 0, &url_info)) {
            return LCB_ERR_PROTOCOL_ERROR;
        }
        hostname = deferred_handle_.substr(url_info.field_data[UF_HOST].off, url_info.field_data[UF_HOST].len);
        hostname += ':';
        hostname += deferred_handle_.substr(url_info.field_data[UF_PORT].off, url_info.field_data[UF_PORT].len);
        url = deferred_handle_.substr(url_info.field_data[UF_PATH].off, url_info.field_data[UF_PATH].len);
    }
    lcb_cmdhttp_streaming(htcmd, true);
    lcb_cmdhttp_handle(htcmd, &http_request_);
    lcb_cmdhttp_timeout(htcmd, timeout_);
    lcb_cmdhttp_path(htcmd, url.c_str(), url.size());
    if (!hostname.empty()) {
        lcb_cmdhttp_host(htcmd, hostname.c_str(), hostname.size());
    }
    if (!impostor_.empty()) {
        htcmd->set_header("cb-on-behalf-of", impostor_);
    }

    span_ = lcb::trace::start_http_span_with_statement(instance_->settings, this, statement_);
    lcb_cmdhttp_parent_span(htcmd, span_);

    lcb_STATUS rc = lcb_http(instance_, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (rc == LCB_SUCCESS) {
        http_request_->set_callback(reinterpret_cast<lcb_RESPCALLBACK>(chunk_callback));
        if (priority_) {
            http_request_->add_header("Analytics-Priority", "-1");
        }
    }
    return rc;
}

bool lcb_ANALYTICS_HANDLE_::has_retriable_error(const Json::Value &root)
{
    if (!root.isObject()) {
        return false;
    }
    const Json::Value &errors = root["errors"];
    if (!errors.isArray()) {
        return false;
    }
    Json::Value::const_iterator ii;
    for (ii = errors.begin(); ii != errors.end(); ++ii) {
        const Json::Value &cur = *ii;
        if (!cur.isObject()) {
            continue; // eh?
        }
        const Json::Value &jcode = cur["code"];
        if (jcode.isNumeric()) {
            unsigned code = jcode.asUInt();
            switch (code) {
                case 23000:
                case 23003:
                case 23007:
                    lcb_log(LOGARGS(this, TRACE), LOGFMT "Will retry request. code: %d", LOGID(this), code);
                    return true;
                default:
                    break;
            }
        }
    }
    return false;
}

bool lcb_ANALYTICS_HANDLE_::maybe_retry()
{
    // Examines the buffer to determine the type of error
    Json::Value root;
    lcb_IOV meta;

    if (is_cancelled()) {
        // Cancelled
        return false;
    }

    if (rows_number_ > 0) {
        // Has results:
        return false;
    }

    if (was_retried_) {
        return false;
    }

    was_retried_ = true;
    parser_->get_postmortem(meta);

    if (!Json::Reader().parse(static_cast<const char *>(meta.iov_base),
                              static_cast<const char *>(meta.iov_base) + meta.iov_len, json)) {
        return false; // Not JSON
    }
    if (has_retriable_error(root)) {
        return true;
    }

    return false;
}

void lcb_ANALYTICS_HANDLE_::invoke_row(lcb_RESPANALYTICS *resp, bool is_last)
{
    resp->cookie = cookie_;
    resp->htresp = http_response_;

    if (resp->htresp != nullptr) {
        resp->ctx.http_response_code = resp->htresp->ctx.response_code;
        resp->ctx.endpoint = resp->htresp->ctx.endpoint;
        resp->ctx.endpoint_len = resp->htresp->ctx.endpoint_len;
    }
    resp->ctx.client_context_id = client_context_id_.c_str();
    resp->ctx.client_context_id_len = client_context_id_.size();
    resp->ctx.statement = statement_.c_str();
    resp->ctx.statement_len = statement_.size();
    resp->ctx.query_params = query_params_.c_str();
    resp->ctx.query_params_len = query_params_.size();

    if (is_last) {
        lcb_IOV meta_buf;
        resp->rflags |= LCB_RESP_F_FINAL;
        resp->ctx.rc = last_error_;
        parser_->get_postmortem(meta_buf);
        resp->row = static_cast<const char *>(meta_buf.iov_base);
        resp->nrow = meta_buf.iov_len;
        if (!deferred_handle_.empty()) {
            /* signal that response might have deferred handle */
            resp->rflags |= LCB_RESP_F_EXTDATA;
        }
        Json::Value meta;
        if (Json::Reader(Json::Features::strictMode()).parse(resp->row, resp->row + resp->nrow, meta)) {
            const Json::Value &errors = meta["errors"];
            if (errors.isArray() && !errors.empty()) {
                const Json::Value &err = errors[0];
                const Json::Value &msg = err["msg"];
                if (msg.isString()) {
                    first_error_message_ = msg.asString();
                    resp->ctx.first_error_message = first_error_message_.c_str();
                    resp->ctx.first_error_message_len = first_error_message_.size();
                }
                const Json::Value &code = err["code"];
                if (code.isNumeric()) {
                    first_error_code_ = code.asUInt();
                    resp->ctx.first_error_code = first_error_code_;
                    switch (first_error_code_) {
                        case 23000:
                        case 23003:
                            resp->ctx.rc = LCB_ERR_TEMPORARY_FAILURE;
                            break;
                        case 24000:
                            resp->ctx.rc = LCB_ERR_PARSING_FAILURE;
                            break;
                        case 23007:
                            resp->ctx.rc = LCB_ERR_JOB_QUEUE_FULL;
                            break;
                        case 24025:
                        case 24044:
                        case 24045:
                            resp->ctx.rc = LCB_ERR_DATASET_NOT_FOUND;
                            break;
                        case 24040:
                            resp->ctx.rc = LCB_ERR_DATASET_EXISTS;
                            break;
                        case 24034:
                            resp->ctx.rc = LCB_ERR_DATAVERSE_NOT_FOUND;
                            break;
                        case 24039:
                            resp->ctx.rc = LCB_ERR_DATAVERSE_EXISTS;
                            break;
                        case 24047:
                            resp->ctx.rc = LCB_ERR_INDEX_NOT_FOUND;
                            break;
                        case 24048:
                            resp->ctx.rc = LCB_ERR_INDEX_EXISTS;
                            break;
                        case 24006:
                            resp->ctx.rc = LCB_ERR_ANALYTICS_LINK_NOT_FOUND;
                            break;
                        default:
                            if (first_error_code_ >= 24000 && first_error_code_ < 25000) {
                                resp->ctx.rc = LCB_ERR_COMPILATION_FAILED;
                            } else if (first_error_code_ >= 25000 && first_error_code_ < 26000) {
                                resp->ctx.rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
                            } else if (first_error_code_ >= 20000 && first_error_code_ < 21000) {
                                resp->ctx.rc = LCB_ERR_AUTHENTICATION_FAILURE;
                            }
                            break;
                    }
                }
            }
        }

        if (span_ != nullptr) {
            lcb::trace::finish_http_span(span_, this);
            span_ = nullptr;
        }
        if (http_request_ != nullptr) {
            http_request_->span = nullptr;
        }
        if (http_request_ != nullptr) {
            record_http_op_latency(nullptr, "analytics", instance_, http_request_->start);
        }
    }

    if (callback_ != nullptr) {
        callback_(instance_, LCB_CALLBACK_ANALYTICS, resp);
    }
    if (is_last) {
        callback_ = nullptr;
    }
}

lcb_ANALYTICS_HANDLE_::~lcb_ANALYTICS_HANDLE_()
{
    if (callback_ != nullptr) {
        lcb_RESPANALYTICS resp{};
        invoke_row(&resp, true);
    }

    if (http_request_ != nullptr) {
        lcb_http_cancel(instance_, http_request_);
        http_request_ = nullptr;
    }

    delete parser_;
    parser_ = nullptr;

    if (document_queue_ != nullptr) {
        document_queue_->parent = nullptr;
        document_queue_->unref();
        lcb_aspend_del(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    }
}
