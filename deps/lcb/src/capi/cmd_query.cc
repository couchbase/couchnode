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

#include <cstring>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/vbucket.h>

#include "cmd_query.hh"
#include "../mutation_token.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respquery_status(const lcb_RESPQUERY *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respquery_cookie(const lcb_RESPQUERY *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respquery_row(const lcb_RESPQUERY *resp, const char **row, size_t *row_len)
{
    *row = resp->row;
    *row_len = resp->nrow;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respquery_http_response(const lcb_RESPQUERY *resp, const lcb_RESPHTTP **http)
{
    *http = resp->htresp;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respquery_handle(const lcb_RESPQUERY *resp, lcb_QUERY_HANDLE **handle)
{
    *handle = resp->handle;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respquery_error_context(const lcb_RESPQUERY *resp, const lcb_QUERY_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API int lcb_respquery_is_final(const lcb_RESPQUERY *resp)
{
    return resp->rflags & LCB_RESP_F_FINAL;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_create(lcb_CMDQUERY **cmd)
{
    *cmd = new lcb_CMDQUERY();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_destroy(lcb_CMDQUERY *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_timeout(lcb_CMDQUERY *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scope_name(lcb_CMDQUERY *cmd, const char *scope, size_t scope_len)
{
    if (scope == nullptr || scope_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->scope(std::string(scope, scope_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scope_qualifier(lcb_CMDQUERY *cmd, const char *qualifier, size_t qualifier_len)
{
    if (qualifier == nullptr || qualifier_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->scope_qualifier(std::string(qualifier, qualifier_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_reset(lcb_CMDQUERY *cmd)
{
    return cmd->clear();
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_parent_span(lcb_CMDQUERY *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_callback(lcb_CMDQUERY *cmd, lcb_QUERY_CALLBACK callback)
{
    return cmd->callback(callback);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_encoded_payload(lcb_CMDQUERY *cmd, const char **payload, size_t *payload_len)
{
    lcb_STATUS rc = cmd->encode_payload();
    if (rc != LCB_SUCCESS) {
        return rc;
    }
    *payload = cmd->query().c_str();
    *payload_len = cmd->query().size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_payload(lcb_CMDQUERY *cmd, const char *query, size_t query_len)
{
    return cmd->payload(query, query_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_statement(lcb_CMDQUERY *cmd, const char *statement, size_t statement_len)
{
    return cmd->statement(statement, statement_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_named_param(lcb_CMDQUERY *cmd, const char *name, size_t name_len,
                                                     const char *value, size_t value_len)
{
    if (name == nullptr || name_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->option("$" + std::string(name, name_len), value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_positional_params(lcb_CMDQUERY *cmd, const char *value, size_t value_len)
{
    return cmd->option_array("args", value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_positional_param(lcb_CMDQUERY *cmd, const char *value, size_t value_len)
{
    return cmd->option_array_append("args", value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_adhoc(lcb_CMDQUERY *cmd, int adhoc)
{
    return cmd->prepare_statement(!adhoc);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_client_context_id(lcb_CMDQUERY *cmd, const char *value, size_t value_len)
{
    return cmd->option_string("client_context_id", value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pretty(lcb_CMDQUERY *cmd, int pretty)
{
    return cmd->pretty(pretty);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_readonly(lcb_CMDQUERY *cmd, int readonly)
{
    return cmd->readonly(readonly);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_metrics(lcb_CMDQUERY *cmd, int metrics)
{
    return cmd->metrics(metrics);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scan_cap(lcb_CMDQUERY *cmd, int value)
{
    return cmd->scan_cap(value);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scan_wait(lcb_CMDQUERY *cmd, uint32_t us)
{
    return cmd->scan_wait(us);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pipeline_cap(lcb_CMDQUERY *cmd, int value)
{
    return cmd->pipeline_cap(value);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pipeline_batch(lcb_CMDQUERY *cmd, int value)
{
    return cmd->pipeline_batch(value);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_flex_index(lcb_CMDQUERY *cmd, int value)
{
    return cmd->flex_index(value);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_profile(lcb_CMDQUERY *cmd, lcb_QUERY_PROFILE mode)
{
    return cmd->profile(mode);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency(lcb_CMDQUERY *cmd, lcb_QUERY_CONSISTENCY mode)
{
    return cmd->consistency(mode);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency_token_for_keyspace(lcb_CMDQUERY *cmd, const char *keyspace,
                                                                        size_t keyspace_len,
                                                                        const lcb_MUTATION_TOKEN *token)
{
    return cmd->consistency_token_for_keyspace(keyspace, keyspace_len, token);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency_tokens(lcb_CMDQUERY *cmd, lcb_INSTANCE *instance)
{
    lcbvb_CONFIG *vbc;
    lcb_STATUS rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    const char *keyspace = nullptr;
    rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &keyspace);
    if (rc != LCB_SUCCESS) {
        return rc;
    }
    std::size_t keyspace_len = strlen(keyspace);

    auto vbmax = static_cast<std::uint16_t>(vbc->nvb);
    for (std::uint16_t ii = 0; ii < vbmax; ++ii) {
        lcb_KEYBUF kb;
        kb.type = LCB_KV_VBID;
        kb.vbid = ii;
        const lcb_MUTATION_TOKEN *mt = lcb_get_mutation_token(instance, &kb, &rc);
        if (rc == LCB_SUCCESS && mt != nullptr) {
            cmd->consistency_token_for_keyspace(keyspace, keyspace_len, mt);
        }
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_max_parallelism(lcb_CMDQUERY *cmd, int value)
{
    return cmd->max_parallelism(value);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_option(lcb_CMDQUERY *cmd, const char *name, size_t name_len, const char *value,
                                                size_t value_len)
{
    return cmd->option(name, name_len, value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_handle(lcb_CMDQUERY *cmd, lcb_QUERY_HANDLE **handle)
{
    return cmd->store_handle_refence_to(handle);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_on_behalf_of(lcb_CMDQUERY *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_preserve_expiry(lcb_CMDQUERY *cmd, int preserve_expiry)
{
    return cmd->preserve_expiry(preserve_expiry);
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_rc(const lcb_QUERY_ERROR_CONTEXT *ctx)
{
    return ctx->rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_first_error_code(const lcb_QUERY_ERROR_CONTEXT *ctx, uint32_t *code)
{
    *code = ctx->first_error_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_first_error_message(const lcb_QUERY_ERROR_CONTEXT *ctx,
                                                                 const char **message, size_t *message_len)
{
    *message = ctx->first_error_message;
    *message_len = ctx->first_error_message_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_error_response_body(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **body,
                                                                 size_t *body_len)
{
    *body = ctx->error_response_body;
    *body_len = ctx->error_response_body_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_statement(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **statement,
                                                       size_t *statement_len)
{
    *statement = ctx->statement;
    *statement_len = ctx->statement_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_client_context_id(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **id,
                                                               size_t *id_len)
{
    *id = ctx->client_context_id;
    *id_len = ctx->client_context_id_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_query_params(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **params,
                                                          size_t *params_len)
{
    *params = ctx->query_params;
    *params_len = ctx->query_params_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_http_response_code(const lcb_QUERY_ERROR_CONTEXT *ctx, uint32_t *code)
{
    *code = ctx->http_response_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_http_response_body(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **body,
                                                                size_t *body_len)
{
    *body = ctx->http_response_message;
    *body_len = ctx->http_response_message_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_query_endpoint(const lcb_QUERY_ERROR_CONTEXT *ctx, const char **endpoint,
                                                      size_t *endpoint_len)
{
    *endpoint = ctx->endpoint;
    *endpoint_len = ctx->endpoint_len;
    return LCB_SUCCESS;
}
