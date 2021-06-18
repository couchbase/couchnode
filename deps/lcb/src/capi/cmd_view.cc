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

#include "cmd_view.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respview_status(const lcb_RESPVIEW *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_cookie(const lcb_RESPVIEW *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_key(const lcb_RESPVIEW *resp, const char **key, size_t *key_len)
{
    *key = resp->key;
    *key_len = resp->nkey;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_doc_id(const lcb_RESPVIEW *resp, const char **doc_id, size_t *doc_id_len)
{
    *doc_id = resp->docid;
    *doc_id_len = resp->ndocid;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_row(const lcb_RESPVIEW *resp, const char **row, size_t *row_len)
{
    *row = resp->value;
    *row_len = resp->nvalue;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_http_response(const lcb_RESPVIEW *resp, const lcb_RESPHTTP **http)
{
    *http = resp->htresp;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_document(const lcb_RESPVIEW *resp, const lcb_RESPGET **doc)
{
    *doc = resp->docresp;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_error_context(const lcb_RESPVIEW *resp, const lcb_VIEW_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respview_handle(const lcb_RESPVIEW *resp, lcb_VIEW_HANDLE **handle)
{
    *handle = resp->handle;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API int lcb_respview_is_final(const lcb_RESPVIEW *resp)
{
    return resp->rflags & LCB_RESP_F_FINAL;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_create(lcb_CMDVIEW **cmd)
{
    *cmd = new lcb_CMDVIEW{};
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_destroy(lcb_CMDVIEW *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_timeout(lcb_CMDVIEW *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_parent_span(lcb_CMDVIEW *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_callback(lcb_CMDVIEW *cmd, lcb_VIEW_CALLBACK callback)
{
    return cmd->callback(callback);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_design_document(lcb_CMDVIEW *cmd, const char *ddoc, size_t ddoc_len)
{
    return cmd->design_document_name(ddoc, ddoc_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_view_name(lcb_CMDVIEW *cmd, const char *view, size_t view_len)
{
    return cmd->view_name(view, view_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_option_string(lcb_CMDVIEW *cmd, const char *optstr, size_t optstr_len)
{
    return cmd->option_string(optstr, optstr_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_post_data(lcb_CMDVIEW *cmd, const char *data, size_t data_len)
{
    return cmd->post_data(data, data_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_include_docs(lcb_CMDVIEW *cmd, int include_docs)
{
    return cmd->include_documents(include_docs);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_max_concurrent_docs(lcb_CMDVIEW *cmd, uint32_t num)
{
    return cmd->max_concurrent_documents(num);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_no_row_parse(lcb_CMDVIEW *cmd, int flag)
{
    return cmd->do_not_parse_rows(flag);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdview_handle(lcb_CMDVIEW *cmd, lcb_VIEW_HANDLE **handle)
{
    return cmd->store_handle_refence_to(handle);
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_rc(const lcb_VIEW_ERROR_CONTEXT *ctx)
{
    return ctx->rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_first_error_code(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **code,
                                                             size_t *code_len)
{
    *code = ctx->first_error_code;
    *code_len = ctx->first_error_code_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_first_error_message(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **message,
                                                                size_t *message_len)
{
    *message = ctx->first_error_message;
    *message_len = ctx->first_error_message_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_design_document(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **name,
                                                            size_t *name_len)
{
    *name = ctx->design_document;
    *name_len = ctx->design_document_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_view(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **name, size_t *name_len)
{
    *name = ctx->view;
    *name_len = ctx->view_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_query_params(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **params,
                                                         size_t *params_len)
{
    *params = ctx->query_params;
    *params_len = ctx->query_params_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_http_response_code(const lcb_VIEW_ERROR_CONTEXT *ctx, uint32_t *code)
{
    *code = ctx->http_response_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_http_response_body(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **body,
                                                               size_t *body_len)
{
    *body = ctx->http_response_body;
    *body_len = ctx->http_response_body_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_view_endpoint(const lcb_VIEW_ERROR_CONTEXT *ctx, const char **endpoint,
                                                     size_t *endpoint_len)
{
    *endpoint = ctx->endpoint;
    *endpoint_len = ctx->endpoint_len;
    return LCB_SUCCESS;
}
