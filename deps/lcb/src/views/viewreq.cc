/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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

#include "viewreq.h"
#include "sllist-inl.h"
#include "http/http.h"
#include "internal.h"

#define MAX_GET_URI_LENGTH 2048

static void chunk_callback(lcb_INSTANCE *, int, const lcb_RESPBASE *);

template <typename value_type, typename size_type>
void IOV2PTRLEN(const lcb_IOV *iov, value_type *&ptr, size_type &len)
{
    ptr = reinterpret_cast<const value_type *>(iov->iov_base);
    len = iov->iov_len;
}

/* Whether the request (from the user side) is still ongoing */
#define CAN_CONTINUE(req) ((req)->callback != nullptr)
#define LOGARGS(instance, lvl) instance->settings, "views", LCB_LOG_##lvl, __FILE__, __LINE__

void lcb_VIEW_HANDLE_::invoke_last(lcb_STATUS err)
{
    lcb_RESPVIEW resp{};
    if (callback == nullptr) {
        return;
    }
    if (docq && docq->has_pending()) {
        return;
    }

    resp.ctx.rc = err;
    resp.cookie = const_cast<void *>(cookie);
    resp.rflags = LCB_RESP_F_FINAL;
    resp.handle = this;
    resp.htresp = cur_htresp;
    if (cur_htresp) {
        resp.ctx.http_response_code = cur_htresp->ctx.response_code;
        resp.ctx.endpoint = cur_htresp->ctx.endpoint;
        resp.ctx.endpoint_len = cur_htresp->ctx.endpoint_len;
    }
    resp.ctx.design_document = design_document.c_str();
    resp.ctx.design_document_len = design_document.size();
    resp.ctx.view = view.c_str();
    resp.ctx.view_len = view.size();
    resp.ctx.query_params = query_params.c_str();
    resp.ctx.query_params_len = query_params.size();
    if (parser && parser->meta_complete) {
        resp.value = parser->meta_buf.c_str();
        resp.nvalue = parser->meta_buf.size();
        Json::Value meta;
        if (Json::Reader().parse(resp.value, resp.value + resp.nvalue, meta)) {
            Json::Value &errors = meta["errors"];
            if (errors.isArray() && !errors.empty()) {
                Json::Value &error = errors[0];
                Json::Value &message = error["reason"];
                if (message.isString()) {
                    first_error_message = message.asString();
                    resp.ctx.first_error_message = first_error_message.c_str();
                    resp.ctx.first_error_message_len = first_error_message.size();
                }
            }
        }
    } else {
        resp.rflags |= LCB_RESP_F_CLIENTGEN;
        if (cur_htresp && cur_htresp->ctx.response_code != 200 && cur_htresp->ctx.body_len) {
            // chances that were not able to parse response
            Json::Value meta;
            if (Json::Reader().parse((const char *)cur_htresp->ctx.body,
                                     (const char *)cur_htresp->ctx.body + cur_htresp->ctx.body_len, meta)) {
                Json::Value &error = meta["error"];
                if (error.isString()) {
                    first_error_code = error.asString();
                    resp.ctx.first_error_code = first_error_code.c_str();
                    resp.ctx.first_error_code_len = first_error_code.size();
                }
                Json::Value &message = meta["reason"];
                if (message.isString()) {
                    first_error_message = message.asString();
                    resp.ctx.first_error_message = first_error_message.c_str();
                    resp.ctx.first_error_message_len = first_error_message.size();
                }
            }
        }
    }
    if (first_error_code == "not_found") {
        resp.ctx.http_response_code = LCB_ERR_VIEW_NOT_FOUND;
    }

    callback(instance, LCB_CALLBACK_VIEWQUERY, &resp);
    cancel();
}

void lcb_VIEW_HANDLE_::invoke_row(lcb_RESPVIEW *resp)
{
    if (callback == nullptr) {
        return;
    }
    resp->cookie = const_cast<void *>(cookie);
    resp->htresp = cur_htresp;
    if (cur_htresp) {
        resp->ctx.http_response_code = cur_htresp->ctx.response_code;
        resp->ctx.endpoint = cur_htresp->ctx.endpoint;
        resp->ctx.endpoint_len = cur_htresp->ctx.endpoint_len;
    }
    resp->ctx.design_document = design_document.c_str();
    resp->ctx.design_document_len = design_document.size();
    resp->ctx.view = view.c_str();
    resp->ctx.view_len = view.size();
    resp->ctx.query_params = query_params.c_str();
    resp->ctx.query_params_len = query_params.size();
    callback(instance, LCB_CALLBACK_VIEWQUERY, resp);
}

static void chunk_callback(lcb_INSTANCE *instance, int, const lcb_RESPBASE *rb)
{
    const auto *rh = (const lcb_RESPHTTP *)rb;
    auto *req = reinterpret_cast<lcb_VIEW_HANDLE_ *>(rh->cookie);

    req->cur_htresp = rh;

    if (rh->ctx.rc != LCB_SUCCESS || rh->ctx.response_code != 200 || (rh->rflags & LCB_RESP_F_FINAL)) {
        if (req->lasterr == LCB_SUCCESS && rh->ctx.response_code != 200) {
            if (rh->ctx.rc != LCB_SUCCESS) {
                req->lasterr = rh->ctx.rc;
            } else {
                lcb_log(LOGARGS(instance, DEBUG), "Got not ok http status %d", rh->ctx.response_code);
                req->lasterr = LCB_ERR_HTTP;
            }
        }
        req->ref();
        req->invoke_last();
        if (rh->rflags & LCB_RESP_F_FINAL) {
            req->htreq = nullptr;
            lcb_assert(req->refcount > 1);
            req->unref();
        }
        req->cur_htresp = nullptr;
        lcb_assert(req->refcount > 0);
        req->unref();
        return;
    }

    if (!CAN_CONTINUE(req)) {
        return;
    }

    req->refcount++;
    req->parser->feed(reinterpret_cast<const char *>(rh->ctx.body), rh->ctx.body_len);
    req->cur_htresp = nullptr;
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
    if (!is_no_rowparse()) {
        parser->parse_viewrow(const_cast<Row &>(datum));
    }

    if (is_include_docs() && datum.docid.iov_len && callback) {
        VRDocRequest *dreq = mk_docreq(&datum);
        dreq->parent = this;
        docq->add(dreq);
        ref();

    } else {
        lcb_RESPVIEW resp{};
        if (is_no_rowparse()) {
            IOV2PTRLEN(&datum.row, resp.value, resp.nvalue);
        } else {
            IOV2PTRLEN(&datum.key, resp.key, resp.nkey);
            IOV2PTRLEN(&datum.docid, resp.docid, resp.ndocid);
            IOV2PTRLEN(&datum.value, resp.value, resp.nvalue);
            IOV2PTRLEN(&datum.geo, resp.geometry, resp.ngeometry);
        }
        resp.htresp = cur_htresp;
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

static void doc_callback(lcb_INSTANCE *, int, const lcb_RESPBASE *rb)
{
    const auto *rg = (const lcb_RESPGET *)rb;
    auto *dreq = reinterpret_cast<lcb::docreq::DocRequest *>(rb->cookie);
    lcb::docreq::Queue *q = dreq->parent;

    q->ref();

    q->n_awaiting_response--;
    dreq->docresp = *rg;
    dreq->ready = 1;
    dreq->docresp.ctx.key = (const char *)dreq->docid.iov_base;
    dreq->docresp.ctx.key_len = dreq->docid.iov_len;

    /* Reference the response data, since we might not be invoking this right
     * away */
    if (rg->ctx.rc == LCB_SUCCESS) {
        lcb_backbuf_ref(reinterpret_cast<lcb_BACKBUF>(dreq->docresp.bufh));
    }
    q->check();

    q->unref();
}

static lcb_STATUS cb_op_schedule(lcb::docreq::Queue *q, lcb::docreq::DocRequest *dreq)
{
    lcb_CMDGET gcmd = {0};

    LCB_CMD_SET_KEY(&gcmd, dreq->docid.iov_base, dreq->docid.iov_len);
    if (dreq->parent->parent) {
        auto *req = reinterpret_cast<lcb_VIEW_HANDLE_ *>(dreq->parent->parent);
        if (req->span) {
            LCB_CMD_SET_TRACESPAN(&gcmd, req->span);
        }
    }
    dreq->callback = doc_callback;
    gcmd.cmdflags |= LCB_CMD_F_INTERNAL_CALLBACK;
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
    if (req == nullptr || req->htreq == nullptr) {
        return;
    }
    if (enabled) {
        req->htreq->pause();
    } else {
        req->htreq->resume();
    }
}

lcb_VIEW_HANDLE_::~lcb_VIEW_HANDLE_()
{
    invoke_last();

    if (span) {
        if (htreq) {
            lcbio_CTX *ctx = htreq->ioctx;
            if (ctx) {
                lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_PEER_ADDRESS, htreq->peer.c_str());
                lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_LOCAL_ADDRESS, ctx->sock->info->ep_local);
            }
        }
        lcbtrace_span_finish(span, LCBTRACE_NOW);
        span = nullptr;
    }

    delete parser;

    if (htreq != nullptr) {
        lcb_http_cancel(instance, htreq);
    }
    if (docq != nullptr) {
        docq->parent = nullptr;
        docq->unref();
    }
}

lcb_STATUS lcb_VIEW_HANDLE_::request_http(const lcb_CMDVIEW *cmd)
{
    lcb_CMDHTTP *htcmd;

    lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_VIEW);
    lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_GET);
    lcb_cmdhttp_streaming(htcmd, true);

    design_document.assign(cmd->ddoc, cmd->nddoc);
    view.assign(cmd->view, cmd->nview);

    std::string path;
    path.append("_design/");
    path.append(cmd->ddoc, cmd->nddoc);
    path.append(is_spatial() ? "/_spatial/" : "/_view/");
    path.append(cmd->view, cmd->nview);
    if (cmd->noptstr) {
        query_params.assign(cmd->optstr, cmd->noptstr);
        path.append("?").append(cmd->optstr, cmd->noptstr);
    }

    lcb_cmdhttp_path(htcmd, path.c_str(), path.size());
    lcb_cmdhttp_handle(htcmd, &htreq);

    std::string content_type("application/json");
    if (cmd->npostdata) {
        lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
        lcb_cmdhttp_body(htcmd, cmd->postdata, cmd->npostdata);
        lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());
    }
    lcb_cmdhttp_timeout(htcmd, cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, views_timeout));

    lcb_STATUS err = lcb_http(instance, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (err == LCB_SUCCESS) {
        htreq->set_callback(chunk_callback);
    }
    return err;
}

lcb_VIEW_HANDLE_::lcb_VIEW_HANDLE_(lcb_INSTANCE *instance_, const void *cookie_, const lcb_CMDVIEW *cmd)
    : cur_htresp(nullptr), htreq(nullptr), parser(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_VIEWS, this)),
      cookie(cookie_), docq(nullptr), callback(cmd->callback), instance(instance_), refcount(1),
      cmdflags(cmd->cmdflags), lasterr(LCB_SUCCESS), span(nullptr)
{

    // Validate:
    if (cmd->nddoc == 0 || cmd->nview == 0 || callback == nullptr) {
        lasterr = LCB_ERR_INVALID_ARGUMENT;
    } else if (is_include_docs() && is_no_rowparse()) {
        lasterr = LCB_ERR_OPTIONS_CONFLICT;
    } else if (cmd->noptstr > MAX_GET_URI_LENGTH) {
        lasterr = LCB_ERR_VALUE_TOO_LARGE;
    }
    if (lasterr != LCB_SUCCESS) {
        return;
    }

    if (is_include_docs()) {
        docq = new lcb::docreq::Queue(instance);
        docq->parent = this;
        docq->cb_schedule = cb_op_schedule;
        docq->cb_ready = cb_doc_ready;
        docq->cb_throttle = cb_docq_throttle;
        if (cmd->docs_concurrent_max) {
            docq->max_pending_response = cmd->docs_concurrent_max;
        }
    }

    if (cmd->handle) {
        *cmd->handle = this;
    }

    lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, nullptr);

    lasterr = request_http(cmd);
    if (lasterr == LCB_SUCCESS && instance->settings->tracer) {
        char id[20] = {0};
        snprintf(id, sizeof(id), "%p", (void *)this);
        span = lcbtrace_span_start(instance->settings->tracer, LCBTRACE_OP_DISPATCH_TO_SERVER, LCBTRACE_NOW, nullptr);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_OPERATION_ID, id);
        lcbtrace_span_add_system_tags(span, instance->settings, LCBTRACE_TAG_SERVICE_VIEW);
    }
}

LIBCOUCHBASE_API
lcb_STATUS lcb_view(lcb_INSTANCE *instance, void *cookie, const lcb_CMDVIEW *cmd)
{
    auto *req = new lcb_VIEW_HANDLE_(instance, cookie, cmd);
    lcb_STATUS err = req->lasterr;
    if (err != LCB_SUCCESS) {
        req->cancel();
        delete req;
    }
    return err;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_view_cancel(lcb_INSTANCE *, lcb_VIEW_HANDLE *handle)
{
    handle->cancel();
    return LCB_SUCCESS;
}

void lcb_VIEW_HANDLE_::cancel()
{
    if (callback) {
        callback = nullptr;
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, nullptr);
        if (docq) {
            docq->cancel();
        }
    }
}
