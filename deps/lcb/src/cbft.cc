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

#include <libcouchbase/couchbase.h>
#include <jsparse/parser.h>
#include "internal.h"
#include "http/http.h"
#include "logging.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include <string>

#include "capi/search.hh"

#define LOGFMT "(FTR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) req->instance->settings, "n1ql", LCB_LOG_##lvl, __FILE__, __LINE__

struct lcb_SEARCH_HANDLE_ : lcb::jsparse::Parser::Actions {
    const lcb_RESPHTTP *cur_htresp;
    lcb_HTTP_HANDLE *htreq;
    lcb::jsparse::Parser *parser;
    const void *cookie;
    lcb_SEARCH_CALLBACK callback;
    lcb_INSTANCE *instance;
    size_t nrows;
    lcb_STATUS lasterr;
    lcbtrace_SPAN *span;
    std::string index_name;
    std::string error_message;

    void invoke_row(lcb_RESPSEARCH *resp);
    void invoke_last();

    lcb_SEARCH_HANDLE_(lcb_INSTANCE *, const void *, const lcb_CMDSEARCH *);
    ~lcb_SEARCH_HANDLE_() override;
    void JSPARSE_on_row(const lcb::jsparse::Row &datum) override
    {
        lcb_RESPSEARCH resp{};
        resp.row = static_cast<const char *>(datum.row.iov_base);
        resp.nrow = datum.row.iov_len;
        nrows++;
        invoke_row(&resp);
    }
    void JSPARSE_on_error(const std::string &) override
    {
        lasterr = LCB_ERR_PROTOCOL_ERROR;
    }
    void JSPARSE_on_complete(const std::string &) override
    {
        // Nothing
    }
};

static void chunk_callback(lcb_INSTANCE *, int, const lcb_RESPBASE *rb)
{
    const auto *rh = (const lcb_RESPHTTP *)rb;
    auto *req = static_cast<lcb_SEARCH_HANDLE_ *>(rh->cookie);

    req->cur_htresp = rh;
    if (rh->ctx.rc != LCB_SUCCESS || rh->ctx.response_code != 200) {
        if (req->lasterr == LCB_SUCCESS || rh->ctx.response_code != 200) {
            req->lasterr = rh->ctx.rc ? rh->ctx.rc : LCB_ERR_HTTP;
        }
    }

    if (rh->rflags & LCB_RESP_F_FINAL) {
        req->invoke_last();
        delete req;

    } else if (req->callback == nullptr) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        delete req;
    } else {
        req->parser->feed(static_cast<const char *>(rh->ctx.body), rh->ctx.body_len);
    }
}

void lcb_SEARCH_HANDLE_::invoke_row(lcb_RESPSEARCH *resp)
{
    resp->cookie = const_cast<void *>(cookie);
    resp->htresp = cur_htresp;
    resp->handle = this;
    resp->ctx.http_response_code = cur_htresp->ctx.response_code;
    resp->ctx.endpoint = resp->htresp->ctx.endpoint;
    resp->ctx.endpoint_len = resp->htresp->ctx.endpoint_len;
    resp->ctx.index = index_name.c_str();
    resp->ctx.index_len = index_name.size();
    switch (resp->ctx.http_response_code) {
        case 500:
            resp->ctx.rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
            break;
        case 401:
        case 403:
            resp->ctx.rc = LCB_ERR_AUTHENTICATION_FAILURE;
            break;
    }

    if (callback) {
        if (resp->rflags & LCB_RESP_F_FINAL) {
            Json::Value meta;
            if (Json::Reader().parse(resp->row, resp->row + resp->nrow, meta)) {
                Json::Value &top_error = meta["error"];
                if (top_error.isString()) {
                    resp->ctx.has_top_level_error = 1;
                    error_message = top_error.asString();
                } else {
                    Json::Value &status = meta["status"];
                    if (status.isObject()) {
                        Json::Value &errors = meta["errors"];
                        if (!errors.isNull()) {
                            error_message = Json::FastWriter().write(errors);
                        }
                    }
                }
                if (!error_message.empty()) {
                    resp->ctx.error_message = error_message.c_str();
                    resp->ctx.error_message_len = error_message.size();
                    if (error_message.find("QueryBleve parsing") != std::string::npos) {
                        resp->ctx.rc = LCB_ERR_PARSING_FAILURE;
                    } else if (resp->ctx.http_response_code == 400 &&
                               error_message.find("not_found") != std::string::npos) {
                        resp->ctx.rc = LCB_ERR_INDEX_NOT_FOUND;
                    }
                }
            }
        }

        callback(instance, LCB_CALLBACK_SEARCH, resp);
    }
}

void lcb_SEARCH_HANDLE_::invoke_last()
{
    lcb_RESPSEARCH resp{};
    resp.rflags |= LCB_RESP_F_FINAL;
    resp.ctx.rc = lasterr;

    if (parser) {
        lcb_IOV meta;
        parser->get_postmortem(meta);
        resp.row = static_cast<const char *>(meta.iov_base);
        resp.nrow = meta.iov_len;
    }
    invoke_row(&resp);
    callback = nullptr;
}

lcb_SEARCH_HANDLE_::lcb_SEARCH_HANDLE_(lcb_INSTANCE *instance_, const void *cookie_, const lcb_CMDSEARCH *cmd)
    : lcb::jsparse::Parser::Actions(), cur_htresp(nullptr), htreq(nullptr),
      parser(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_FTS, this)), cookie(cookie_), callback(cmd->callback),
      instance(instance_), nrows(0), lasterr(LCB_SUCCESS), span(nullptr)
{
    if (!callback) {
        lasterr = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    std::string content_type("application/json");

    lcb_CMDHTTP *htcmd;
    lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_SEARCH);
    lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_handle(htcmd, &htreq);
    lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());
    lcb_cmdhttp_streaming(htcmd, true);

    Json::Value root;
    Json::Reader rr;
    if (!rr.parse(cmd->query, cmd->query + cmd->nquery, root)) {
        lasterr = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    const Json::Value &constRoot = root;
    const Json::Value &j_ixname = constRoot["indexName"];
    if (!j_ixname.isString()) {
        lasterr = LCB_ERR_INVALID_ARGUMENT;
        return;
    }
    index_name = j_ixname.asString();

    std::string url;
    url.append("api/index/").append(j_ixname.asCString()).append("/query");
    lcb_cmdhttp_path(htcmd, url.c_str(), url.size());

    // Making a copy here to ensure that we don't accidentally create a new
    // 'ctl' field.
    const Json::Value &ctl = constRoot["value"];
    uint32_t timeout = cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, search_timeout);
    if (ctl.isObject()) {
        const Json::Value &tmo = ctl["timeout"];
        if (tmo.isNumeric()) {
            timeout = tmo.asLargestUInt();
        }
    } else {
        root["ctl"]["timeout"] = timeout / 1000;
    }
    lcb_cmdhttp_timeout(htcmd, timeout);

    std::string qbody(Json::FastWriter().write(root));
    lcb_cmdhttp_body(htcmd, qbody.c_str(), qbody.size());

    lasterr = lcb_http(instance, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (lasterr == LCB_SUCCESS) {
        htreq->set_callback(chunk_callback);
        if (cmd->handle) {
            *cmd->handle = reinterpret_cast<lcb_SEARCH_HANDLE_ *>(this);
        }
        if (instance->settings->tracer) {
            char id[20] = {0};
            snprintf(id, sizeof(id), "%p", (void *)this);
            span =
                lcbtrace_span_start(instance->settings->tracer, LCBTRACE_OP_DISPATCH_TO_SERVER, LCBTRACE_NOW, nullptr);
            lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_OPERATION_ID, id);
            lcbtrace_span_add_system_tags(span, instance->settings, LCBTRACE_TAG_SERVICE_SEARCH);
        }
    }
}

lcb_SEARCH_HANDLE_::~lcb_SEARCH_HANDLE_()
{
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
    if (htreq != nullptr) {
        lcb_http_cancel(instance, htreq);
        htreq = nullptr;
    }
    if (parser) {
        delete parser;
        parser = nullptr;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_search(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSEARCH *cmd)
{
    auto *req = new lcb_SEARCH_HANDLE_(instance, cookie, cmd);
    if (req->lasterr) {
        lcb_STATUS rc = req->lasterr;
        delete req;
        return rc;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_search_cancel(lcb_INSTANCE * /* instance */, lcb_SEARCH_HANDLE *handle)
{
    handle->callback = nullptr;
    return LCB_SUCCESS;
}
