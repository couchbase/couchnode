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

#include "view_handle.hh"
#include "sllist-inl.h"
#include "http/http.h"
#include "internal.h"

#include "capi/cmd_http.hh"

template <typename value_type, typename size_type>
void IOV2PTRLEN(const lcb_IOV *iov, value_type *&ptr, size_type &len)
{
    ptr = reinterpret_cast<const value_type *>(iov->iov_base);
    len = iov->iov_len;
}

#define LOGARGS(instance, lvl) instance->settings, "views", LCB_LOG_##lvl, __FILE__, __LINE__

void lcb_VIEW_HANDLE_::invoke_last(lcb_STATUS err)
{
    lcb_RESPVIEW resp{};
    if (callback_ == nullptr) {
        return;
    }
    if (document_queue_ && document_queue_->has_pending()) {
        return;
    }

    resp.ctx.rc = err;
    resp.cookie = cookie_;
    resp.rflags = LCB_RESP_F_FINAL;
    resp.handle = this;
    resp.htresp = http_response_;
    if (resp.htresp) {
        resp.ctx.http_response_code = resp.htresp->ctx.response_code;
        resp.ctx.endpoint = resp.htresp->ctx.endpoint;
        resp.ctx.endpoint_len = resp.htresp->ctx.endpoint_len;
        resp.ctx.http_response_body = resp.htresp->ctx.body;
        resp.ctx.http_response_body_len = resp.htresp->ctx.body_len;
    }
    resp.ctx.design_document = design_document_.c_str();
    resp.ctx.design_document_len = design_document_.size();
    resp.ctx.view = view_.c_str();
    resp.ctx.view_len = view_.size();
    resp.ctx.query_params = query_params_.c_str();
    resp.ctx.query_params_len = query_params_.size();
    if (parser_ && parser_->meta_complete) {
        resp.value = parser_->meta_buf.c_str();
        resp.nvalue = parser_->meta_buf.size();
        Json::Value meta;
        if (Json::Reader().parse(resp.value, resp.value + resp.nvalue, meta)) {
            Json::Value &errors = meta["errors"];
            if (errors.isArray() && !errors.empty()) {
                const Json::Value &error = errors[0];
                const Json::Value &message = error["reason"];
                if (message.isString()) {
                    first_error_message_ = message.asString();
                    resp.ctx.first_error_message = first_error_message_.c_str();
                    resp.ctx.first_error_message_len = first_error_message_.size();
                }
            }
        }
    } else {
        resp.rflags |= LCB_RESP_F_CLIENTGEN;
        if (http_response_ && http_response_->ctx.response_code != 200 && http_response_->ctx.body_len) {
            // chances that were not able to parse response
            Json::Value meta;
            if (Json::Reader(Json::Features::strictMode())
                    .parse(http_response_->ctx.body, http_response_->ctx.body + http_response_->ctx.body_len, meta)) {
                const Json::Value &error = meta["error"];
                if (error.isString()) {
                    first_error_code_ = error.asString();
                    resp.ctx.first_error_code = first_error_code_.c_str();
                    resp.ctx.first_error_code_len = first_error_code_.size();
                }
                const Json::Value &message = meta["reason"];
                if (message.isString()) {
                    first_error_message_ = message.asString();
                    resp.ctx.first_error_message = first_error_message_.c_str();
                    resp.ctx.first_error_message_len = first_error_message_.size();
                }
            }
        }
    }
    if (first_error_code_ == "not_found") {
        resp.ctx.rc = LCB_ERR_VIEW_NOT_FOUND;
    }

    if (span_ != nullptr) {
        lcb::trace::finish_http_span(span_, this);
        span_ = nullptr;
    }
    if (http_request_ != nullptr) {
        http_request_->span = nullptr;
    }
    if (http_request_ != nullptr) {
        record_http_op_latency((design_document_ + "/" + view_).c_str(), "views", instance_, http_request_->start);
    }

    callback_(instance_, LCB_CALLBACK_VIEWQUERY, &resp);
    cancel();
}

void lcb_VIEW_HANDLE_::invoke_row(lcb_RESPVIEW *resp)
{
    if (callback_ == nullptr) {
        return;
    }
    resp->cookie = cookie_;
    resp->htresp = http_response_;
    if (resp->htresp) {
        resp->ctx.http_response_code = resp->htresp->ctx.response_code;
        resp->ctx.endpoint = resp->htresp->ctx.endpoint;
        resp->ctx.endpoint_len = resp->htresp->ctx.endpoint_len;
    }
    resp->ctx.design_document = design_document_.c_str();
    resp->ctx.design_document_len = design_document_.size();
    resp->ctx.view = view_.c_str();
    resp->ctx.view_len = view_.size();
    resp->ctx.query_params = query_params_.c_str();
    resp->ctx.query_params_len = query_params_.size();
    callback_(instance_, LCB_CALLBACK_VIEWQUERY, resp);
}

static void chunk_callback(lcb_INSTANCE *instance, int, const lcb_RESPHTTP *resp)
{
    lcb_VIEW_HANDLE_ *req = nullptr;
    lcb_resphttp_cookie(resp, reinterpret_cast<void **>(&req));

    req->http_response(resp);

    lcb_STATUS rc = lcb_resphttp_status(resp);
    std::uint16_t response_code = 0;
    lcb_resphttp_http_status(resp, &response_code);
    if (rc != LCB_SUCCESS || response_code != 200 || lcb_resphttp_is_final(resp)) {
        if (!req->has_error() && response_code != 200) {
            if (rc != LCB_SUCCESS) {
                req->last_error(rc);
            } else {
                lcb_log(LOGARGS(instance, DEBUG), "Got not ok http status %d", (int)response_code);
                req->last_error(LCB_ERR_HTTP);
            }
        }
        req->ref();
        req->invoke_last();
        if (lcb_resphttp_is_final(resp)) {
            req->clear_http_request();
            req->unref(2);
        }
        req->clear_http_response();
        req->unref();
        return;
    }

    if (req->is_cancelled()) {
        return;
    }

    req->ref();
    req->consume_http_chunk();
    req->clear_http_response();
    req->unref();
}

static void do_copy_iov(std::string &dstbuf, lcb_IOV *dstiov, const lcb_IOV *srciov)
{
    dstiov->iov_len = srciov->iov_len;
    dstiov->iov_base = const_cast<char *>(dstbuf.c_str() + dstbuf.size());
    dstbuf.append(reinterpret_cast<const char *>(srciov->iov_base), srciov->iov_len);
}

static VRDocRequest *mk_docreq(const lcb::jsparse::Row *datum)
{
    VRDocRequest *dreq;
    size_t extra_alloc = datum->key.iov_len + datum->value.iov_len + datum->geo.iov_len + datum->docid.iov_len;

    dreq = new VRDocRequest();
    dreq->rowbuf.reserve(extra_alloc);
    do_copy_iov(dreq->rowbuf, &dreq->key, &datum->key);
    do_copy_iov(dreq->rowbuf, &dreq->value, &datum->value);
    do_copy_iov(dreq->rowbuf, &dreq->docid, &datum->docid);
    do_copy_iov(dreq->rowbuf, &dreq->geo, &datum->geo);
    return dreq;
}

void lcb_VIEW_HANDLE_::JSPARSE_on_row(const lcb::jsparse::Row &datum)
{
    using lcb::jsparse::Row;
    if (!do_not_parse_rows_ && parser_ != nullptr) {
        parser_->parse_viewrow(const_cast<Row &>(datum));
    }

    if (include_docs_ && datum.docid.iov_len && callback_ != nullptr && document_queue_ != nullptr) {
        document_queue_->add(mk_docreq(&datum));
        ref();

    } else {
        lcb_RESPVIEW resp{};
        if (do_not_parse_rows_) {
            IOV2PTRLEN(&datum.row, resp.value, resp.nvalue);
        } else {
            IOV2PTRLEN(&datum.key, resp.key, resp.nkey);
            IOV2PTRLEN(&datum.docid, resp.docid, resp.ndocid);
            IOV2PTRLEN(&datum.value, resp.value, resp.nvalue);
            IOV2PTRLEN(&datum.geo, resp.geometry, resp.ngeometry);
        }
        resp.htresp = http_response_;
        invoke_row(&resp);
    }
}

void lcb_VIEW_HANDLE_::JSPARSE_on_error(const std::string &)
{
    invoke_last(LCB_ERR_PROTOCOL_ERROR);
}

void lcb_VIEW_HANDLE_::JSPARSE_on_complete(const std::string &)
{
    // Nothing
}

static void doc_callback(lcb_INSTANCE *, int, const lcb_RESPGET *resp)
{
    auto *dreq = reinterpret_cast<lcb::docreq::DocRequest *>(resp->cookie);
    lcb::docreq::Queue *q = dreq->parent;

    q->ref();

    q->n_awaiting_response--;
    dreq->docresp = *resp;
    dreq->ready = 1;
    dreq->docresp.ctx.key.assign((const char *)dreq->docid.iov_base, dreq->docid.iov_len);

    /* Reference the response data, since we might not be invoking this right
     * away */
    if (resp->ctx.rc == LCB_SUCCESS) {
        lcb_backbuf_ref(reinterpret_cast<lcb_BACKBUF>(dreq->docresp.bufh));
    }
    q->check();

    q->unref();
}

static lcb_STATUS cb_op_schedule(lcb::docreq::Queue *q, lcb::docreq::DocRequest *dreq)
{
    lcb_CMDGET gcmd{};

    gcmd.key(std::string(static_cast<const char *>(dreq->docid.iov_base), dreq->docid.iov_len));
    dreq->callback = (lcb_RESPCALLBACK)doc_callback;
    gcmd.treat_cookie_as_callback(true);
    return lcb_get(q->instance, &dreq->callback, &gcmd);
}

static void cb_doc_ready(lcb::docreq::Queue *q, lcb::docreq::DocRequest *req_base)
{
    lcb_RESPVIEW resp{};
    auto *dreq = (VRDocRequest *)req_base;
    resp.docresp = &dreq->docresp;
    IOV2PTRLEN(&dreq->key, resp.key, resp.nkey);
    IOV2PTRLEN(&dreq->value, resp.value, resp.nvalue);
    IOV2PTRLEN(&dreq->docid, resp.docid, resp.ndocid);
    IOV2PTRLEN(&dreq->geo, resp.geometry, resp.ngeometry);

    if (q->parent) {
        reinterpret_cast<lcb_VIEW_HANDLE_ *>(q->parent)->invoke_row(&resp);
    }

    delete dreq;

    if (q->parent) {
        reinterpret_cast<lcb_VIEW_HANDLE_ *>(q->parent)->unref();
    }
}

static void cb_docq_throttle(lcb::docreq::Queue *q, int enabled)
{
    auto *req = reinterpret_cast<lcb_VIEW_HANDLE_ *>(q->parent);
    if (req == nullptr || req->http_request() == nullptr) {
        return;
    }
    if (enabled) {
        req->http_request()->pause();
    } else {
        req->http_request()->resume();
    }
}

lcb_VIEW_HANDLE_::~lcb_VIEW_HANDLE_()
{
    invoke_last();

    if (http_request_ != nullptr) {
        lcb_http_cancel(instance_, http_request_);
        http_request_ = nullptr;
    }

    delete parser_;
    parser_ = nullptr;

    if (document_queue_ != nullptr) {
        document_queue_->parent = nullptr;
        document_queue_->unref();
    }
}

lcb_STATUS lcb_VIEW_HANDLE_::request_http(const lcb_CMDVIEW *cmd)
{
    lcb_CMDHTTP *htcmd;

    lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_VIEW);
    lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_GET);
    lcb_cmdhttp_streaming(htcmd, true);

    design_document_ = cmd->design_document_name();
    view_ = cmd->view_name();

    if (span_) {
        std::string operation = design_document_ + "/" + view_;
        lcbtrace_span_add_tag_str(span_, LCBTRACE_TAG_OPERATION, operation.c_str());
    }

    std::string path;
    path.append("_design/");
    path.append(design_document_.c_str(), design_document_.size());
    path.append(spatial_ ? "/_spatial/" : "/_view/");
    path.append(view_.c_str(), view_.size());

    query_params_ = cmd->option_string();
    if (!query_params_.empty()) {
        path.append("?").append(query_params_);
    }

    lcb_cmdhttp_path(htcmd, path.c_str(), path.size());
    lcb_cmdhttp_handle(htcmd, &http_request_);

    std::string content_type("application/json");
    if (cmd->has_post_data()) {
        lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
        lcb_cmdhttp_body(htcmd, cmd->post_data().c_str(), cmd->post_data().size());
        lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());
    }
    lcb_cmdhttp_timeout(htcmd, cmd->timeout_or_default_in_microseconds(LCBT_SETTING(instance_, views_timeout)));

    lcb_cmdhttp_parent_span(htcmd, span_);

    lcb_STATUS err = lcb_http(instance_, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (err == LCB_SUCCESS) {
        http_request_->set_callback(reinterpret_cast<lcb_RESPCALLBACK>(chunk_callback));
    }
    return err;
}

lcb_VIEW_HANDLE_::lcb_VIEW_HANDLE_(lcb_INSTANCE *instance, void *cookie, const lcb_CMDVIEW *cmd)
    : parser_(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_VIEWS, this)), cookie_(cookie),
      callback_(cmd->callback()), instance_(instance), include_docs_(cmd->include_documents()),
      do_not_parse_rows_(cmd->do_not_parse_rows()), spatial_(false)
{

    if (include_docs_) {
        document_queue_ = new lcb::docreq::Queue(instance_);
        document_queue_->parent = this;
        document_queue_->cb_schedule = cb_op_schedule;
        document_queue_->cb_ready = cb_doc_ready;
        document_queue_->cb_throttle = cb_docq_throttle;
        if (cmd->max_concurrent_documents() > 0) {
            document_queue_->max_pending_response = cmd->max_concurrent_documents();
        }
    }
    {
        char buf[32];
        size_t nbuf = snprintf(buf, sizeof(buf), "%016" PRIx64, lcb_next_rand64());
        client_context_id_.assign(buf, nbuf);
    }

    lcb_aspend_add(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    if (instance->settings->tracer) {
        parent_span_ = cmd->parent_span();
        span_ = lcb::trace::start_http_span(instance_->settings, this);
    }
    last_error_ = request_http(cmd);
}

void lcb_VIEW_HANDLE_::cancel()
{
    if (callback_ != nullptr) {
        callback_ = nullptr;
        lcb_aspend_del(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
        if (document_queue_) {
            document_queue_->cancel();
        }
    }
}
