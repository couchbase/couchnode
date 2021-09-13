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

#include "cmd_search.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_status(const lcb_RESPSEARCH *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_cookie(const lcb_RESPSEARCH *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_row(const lcb_RESPSEARCH *resp, const char **row, size_t *row_len)
{
    *row = resp->row;
    *row_len = resp->nrow;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_http_response(const lcb_RESPSEARCH *resp, const lcb_RESPHTTP **http)
{
    *http = resp->htresp;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_handle(const lcb_RESPSEARCH *resp, lcb_SEARCH_HANDLE **handle)
{
    *handle = resp->handle;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respsearch_error_context(const lcb_RESPSEARCH *resp,
                                                         const lcb_SEARCH_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API int lcb_respsearch_is_final(const lcb_RESPSEARCH *resp)
{
    return resp->rflags & LCB_RESP_F_FINAL;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_create(lcb_CMDSEARCH **cmd)
{
    *cmd = new lcb_CMDSEARCH_{};
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_destroy(lcb_CMDSEARCH *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_timeout(lcb_CMDSEARCH *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_parent_span(lcb_CMDSEARCH *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_callback(lcb_CMDSEARCH *cmd, lcb_SEARCH_CALLBACK callback)
{
    return cmd->callback(callback);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_payload(lcb_CMDSEARCH *cmd, const char *payload, size_t payload_len)
{
    return cmd->query(payload, payload_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_handle(lcb_CMDSEARCH *cmd, lcb_SEARCH_HANDLE **handle)
{
    return cmd->store_handle_refence_to(handle);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdsearch_on_behalf_of(lcb_CMDSEARCH *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_rc(const lcb_SEARCH_ERROR_CONTEXT *ctx)
{
    return ctx->rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_error_message(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **message,
                                                            size_t *message_len)
{
    *message = ctx->error_message;
    *message_len = ctx->error_message_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_index_name(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **name,
                                                         size_t *name_len)
{
    *name = ctx->index;
    *name_len = ctx->index_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_query(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **query,
                                                    size_t *query_len)
{
    *query = ctx->search_query;
    *query_len = ctx->search_query_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_params(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **params,
                                                     size_t *params_len)
{
    *params = ctx->search_params;
    *params_len = ctx->search_params_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_http_response_code(const lcb_SEARCH_ERROR_CONTEXT *ctx, uint32_t *code)
{
    *code = ctx->http_response_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_http_response_body(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **body,
                                                                 size_t *body_len)
{
    *body = ctx->http_response_body;
    *body_len = ctx->http_response_body_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_search_endpoint(const lcb_SEARCH_ERROR_CONTEXT *ctx, const char **endpoint,
                                                       size_t *endpoint_len)
{
    *endpoint = ctx->endpoint;
    *endpoint_len = ctx->endpoint_len;
    return LCB_SUCCESS;
}
