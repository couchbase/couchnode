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
#include <cinttypes>

#include <libcouchbase/couchbase.h>

#include "cmd_analytics.hh"
#include "../rnd.h"

lcb_INGEST_STATUS default_data_converter(lcb_INSTANCE *, lcb_INGEST_PARAM *param)
{
    param->id_dtor = (void (*)(const char *))free;
    char *buf = static_cast<char *>(calloc(34, sizeof(char)));
    param->id_len = snprintf(buf, 34, "%016" PRIx64 "-%016" PRIx64, lcb_next_rand64(), lcb_next_rand64());
    param->id = buf;
    return LCB_INGEST_STATUS_OK;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_cookie(lcb_INGEST_PARAM *param, void **cookie)
{
    *cookie = param->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_row(lcb_INGEST_PARAM *param, const char **row,
                                                               size_t *row_len)
{
    *row = param->row;
    *row_len = param->row_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_method(lcb_INGEST_PARAM *param, lcb_INGEST_METHOD *method)
{
    *method = param->method;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_set_id(lcb_INGEST_PARAM *param, const char *id,
                                                                  size_t id_len, void (*id_dtor)(const char *))
{
    param->id = id;
    param->id_len = id_len;
    param->id_dtor = id_dtor;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_dataconverter_param_set_out(lcb_INGEST_PARAM *param, const char *out,
                                                                   size_t out_len, void (*out_dtor)(const char *))
{
    param->out_dtor = out_dtor;
    param->out_len = out_len;
    param->out = out;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_status(const lcb_RESPANALYTICS *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_cookie(const lcb_RESPANALYTICS *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_http_response(const lcb_RESPANALYTICS *resp, const lcb_RESPHTTP **http)
{
    *http = resp->htresp;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_row(const lcb_RESPANALYTICS *resp, const char **row, size_t *row_len)
{
    *row = resp->row;
    *row_len = resp->nrow;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_handle(const lcb_RESPANALYTICS *resp, lcb_ANALYTICS_HANDLE **handle)
{
    *handle = resp->handle;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_error_context(const lcb_RESPANALYTICS *resp,
                                                            const lcb_ANALYTICS_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API int lcb_respanalytics_is_final(const lcb_RESPANALYTICS *resp)
{
    return resp->rflags & LCB_RESP_F_FINAL;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_create(lcb_CMDANALYTICS **cmd)
{
    *cmd = new lcb_CMDANALYTICS();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_destroy(lcb_CMDANALYTICS *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_timeout(lcb_CMDANALYTICS *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_scope_name(lcb_CMDANALYTICS *cmd, const char *scope, size_t scope_len)
{
    if (scope == nullptr || scope_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->scope(std::string(scope, scope_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_scope_qualifier(lcb_CMDANALYTICS *cmd, const char *qualifier,
                                                             size_t qualifier_len)
{
    if (qualifier == nullptr || qualifier_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->scope_qualifier(std::string(qualifier, qualifier_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_reset(lcb_CMDANALYTICS *cmd)
{
    return cmd->clear();
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_parent_span(lcb_CMDANALYTICS *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_handle(lcb_CMDANALYTICS *cmd, lcb_ANALYTICS_HANDLE **handle)
{
    return cmd->store_handle_refence_to(handle);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_callback(lcb_CMDANALYTICS *cmd, lcb_ANALYTICS_CALLBACK callback)
{
    return cmd->callback(callback);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_encoded_payload(lcb_CMDANALYTICS *cmd, const char **payload,
                                                             size_t *payload_len)
{
    lcb_STATUS rc = cmd->encode_payload();
    if (rc != LCB_SUCCESS) {
        return rc;
    }
    *payload = cmd->query().c_str();
    *payload_len = cmd->query().size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_payload(lcb_CMDANALYTICS *cmd, const char *query, size_t query_len)
{
    return cmd->payload(query, query_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_client_context_id(lcb_CMDANALYTICS *cmd, const char *value,
                                                               size_t value_len)
{
    return cmd->option_string("client_context_id", value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_readonly(lcb_CMDANALYTICS *cmd, int readonly)
{
    return cmd->readonly(readonly);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_priority(lcb_CMDANALYTICS *cmd, int priority)
{
    return cmd->priority(priority);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_consistency(lcb_CMDANALYTICS *cmd, lcb_ANALYTICS_CONSISTENCY level)
{
    return cmd->consistency(level);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_option(lcb_CMDANALYTICS *cmd, const char *name, size_t name_len,
                                                    const char *value, size_t value_len)
{
    return cmd->option(name, name_len, value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_statement(lcb_CMDANALYTICS *cmd, const char *statement,
                                                       size_t statement_len)
{
    return cmd->statement(statement, statement_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_named_param(lcb_CMDANALYTICS *cmd, const char *name, size_t name_len,
                                                         const char *value, size_t value_len)
{
    return cmd->option(name, name_len, value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_positional_params(lcb_CMDANALYTICS *cmd, const char *value,
                                                               size_t value_len)
{
    return cmd->option_array("args", value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_positional_param(lcb_CMDANALYTICS *cmd, const char *value,
                                                              size_t value_len)
{
    return cmd->option_array_append("args", value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_deferred(lcb_CMDANALYTICS *cmd, int deferred)
{
    return cmd->deferred(deferred);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_ingest_options(lcb_CMDANALYTICS *cmd, lcb_INGEST_OPTIONS *options)
{
    return cmd->ingest_options(options);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdanalytics_on_behalf_of(lcb_CMDANALYTICS *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_create(lcb_INGEST_OPTIONS **options)
{
    *options = new lcb_INGEST_OPTIONS();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_destroy(lcb_INGEST_OPTIONS *options)
{
    delete options;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_method(lcb_INGEST_OPTIONS *options, lcb_INGEST_METHOD method)
{
    options->method = method;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_expiry(lcb_INGEST_OPTIONS *options, uint32_t expiration)
{
    options->exptime = expiration;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_ignore_error(lcb_INGEST_OPTIONS *options, int flag)
{
    options->ignore_errors = flag ? true : false;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_ingest_options_data_converter(lcb_INGEST_OPTIONS *options,
                                                              lcb_INGEST_DATACONVERTER_CALLBACK callback)
{
    options->data_converter = callback;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respanalytics_deferred_handle_extract(const lcb_RESPANALYTICS *resp,
                                                                      lcb_DEFERRED_HANDLE **handle)
{
    *handle = nullptr;
    if (resp == nullptr || resp->ctx.rc != LCB_SUCCESS ||
        ((resp->rflags & (LCB_RESP_F_FINAL | LCB_RESP_F_EXTDATA)) == 0) || resp->nrow == 0 || resp->row == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    Json::Value payload;
    if (!Json::Reader().parse(resp->row, resp->row + resp->nrow, payload)) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (!payload.isObject()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    Json::Value status = payload["status"];
    Json::Value value = payload["handle"];
    if (status.isString() && value.isString()) {
        *handle = new lcb_DEFERRED_HANDLE_{status.asString(), value.asString(), nullptr};
        return LCB_SUCCESS;
    }
    return LCB_ERR_INVALID_ARGUMENT;
}

LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_destroy(lcb_DEFERRED_HANDLE *handle)
{
    if (handle == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    delete handle;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_status(lcb_DEFERRED_HANDLE *handle, const char **status,
                                                       size_t *status_len)
{
    if (handle == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    *status = handle->status.c_str();
    *status_len = handle->status.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_callback(lcb_DEFERRED_HANDLE *handle, lcb_ANALYTICS_CALLBACK callback)
{
    if (handle) {
        handle->callback = callback;
        return LCB_SUCCESS;
    }
    return LCB_ERR_INVALID_ARGUMENT;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_rc(const lcb_ANALYTICS_ERROR_CONTEXT *ctx)
{
    return ctx->rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_first_error_code(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                  uint32_t *code)
{
    *code = ctx->first_error_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_first_error_message(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                     const char **message, size_t *message_len)
{
    *message = ctx->first_error_message;
    *message_len = ctx->first_error_message_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_statement(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                           const char **statement, size_t *statement_len)
{
    *statement = ctx->statement;
    *statement_len = ctx->statement_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_query_params(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                              const char **query_params, size_t *query_params_len)
{
    *query_params = ctx->query_params;
    *query_params_len = ctx->query_params_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_client_context_id(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                   const char **id, size_t *id_len)
{
    *id = ctx->client_context_id;
    *id_len = ctx->client_context_id_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_http_response_code(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                    uint32_t *code)
{
    *code = ctx->http_response_code;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_http_response_body(const lcb_ANALYTICS_ERROR_CONTEXT *ctx,
                                                                    const char **body, size_t *body_len)
{
    *body = ctx->http_response_body;
    *body_len = ctx->http_response_body_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_errctx_analytics_endpoint(const lcb_ANALYTICS_ERROR_CONTEXT *ctx, const char **endpoint,
                                                          size_t *endpoint_len)
{
    *endpoint = ctx->endpoint;
    *endpoint_len = ctx->endpoint_len;
    return LCB_SUCCESS;
}
