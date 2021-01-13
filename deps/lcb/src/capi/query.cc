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

#include "query.hh"
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
    cmd->timeout = timeout;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scope_name(lcb_CMDQUERY *cmd, const char *scope, size_t scope_len)
{
    if (scope == nullptr || scope_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    cmd->scope_name.assign(scope, scope_len);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scope_qualifier(lcb_CMDQUERY *cmd, const char *qualifier, size_t qualifier_len)
{
    if (qualifier == nullptr || qualifier_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    cmd->scope_qualifier.assign(qualifier, qualifier_len);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_reset(lcb_CMDQUERY *cmd)
{
    cmd->cmdflags = 0;
    cmd->exptime = 0;
    cmd->cas = 0;
    cmd->cid = 0;
    cmd->key.type = LCB_KV_COPY;
    cmd->key.contig.bytes = nullptr;
    cmd->key.contig.nbytes = 0;
    cmd->timeout = 0;
    cmd->pspan = nullptr;

    cmd->root = Json::Value();
    cmd->scope_name.clear();
    cmd->scope_qualifier.clear();
    cmd->query = "";
    cmd->callback = nullptr;
    cmd->handle = nullptr;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_parent_span(lcb_CMDQUERY *cmd, lcbtrace_SPAN *span)
{
    cmd->pspan = span;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_callback(lcb_CMDQUERY *cmd, lcb_QUERY_CALLBACK callback)
{
    cmd->callback = callback;
    return LCB_SUCCESS;
}

#define fix_strlen(s, n)                                                                                               \
    if (n == (size_t)-1) {                                                                                             \
        n = strlen(s);                                                                                                 \
    }

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_encoded_payload(lcb_CMDQUERY *cmd, const char **payload, size_t *payload_len)
{
    cmd->query = Json::FastWriter().write(cmd->root);
    *payload = cmd->query.c_str();
    *payload_len = cmd->query.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_payload(lcb_CMDQUERY *cmd, const char *query, size_t query_len)
{
    fix_strlen(query, query_len) Json::Value value;
    if (!Json::Reader().parse(query, query + query_len, value)) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    cmd->root = value;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_statement(lcb_CMDQUERY *cmd, const char *statement, size_t statement_len)
{
    fix_strlen(statement, statement_len) cmd->root["statement"] = std::string(statement, statement_len);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_named_param(lcb_CMDQUERY *cmd, const char *name, size_t name_len,
                                                     const char *value, size_t value_len)
{
    std::string key = "$" + std::string(name, name_len);
    return lcb_cmdquery_option(cmd, key.c_str(), key.size(), value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_positional_param(lcb_CMDQUERY *cmd, const char *value, size_t value_len)
{
    fix_strlen(value, value_len) Json::Value jval;
    if (!Json::Reader().parse(value, value + value_len, jval)) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    cmd->root["args"].append(jval);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_adhoc(lcb_CMDQUERY *cmd, int adhoc)
{
    if (adhoc) {
        cmd->cmdflags &= ~LCB_CMDN1QL_F_PREPCACHE;
    } else {
        cmd->cmdflags |= LCB_CMDN1QL_F_PREPCACHE;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_client_context_id(lcb_CMDQUERY *cmd, const char *value, size_t value_len)
{
    cmd->root["client_context_id"] = std::string(value, value_len);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pretty(lcb_CMDQUERY *cmd, int pretty)
{
    cmd->root["pretty"] = pretty != 0;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_readonly(lcb_CMDQUERY *cmd, int readonly)
{
    cmd->root["readonly"] = readonly != 0;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_metrics(lcb_CMDQUERY *cmd, int metrics)
{
    cmd->root["metrics"] = metrics != 0;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scan_cap(lcb_CMDQUERY *cmd, int value)
{
    cmd->root["scan_cap"] = Json::valueToString(value);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_scan_wait(lcb_CMDQUERY *cmd, uint32_t us)
{
    cmd->root["scan_wait"] = Json::valueToString(us) + "us";
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pipeline_cap(lcb_CMDQUERY *cmd, int value)
{
    cmd->root["pipeline_cap"] = Json::valueToString(value);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_pipeline_batch(lcb_CMDQUERY *cmd, int value)
{
    cmd->root["pipeline_batch"] = Json::valueToString(value);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_flex_index(lcb_CMDQUERY *cmd, int value)
{
    if (value) {
        cmd->root["use_fts"] = true;
    } else {
        cmd->root.removeMember("use_fts");
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_profile(lcb_CMDQUERY *cmd, lcb_QUERY_PROFILE mode)
{
    switch (mode) {
        case LCB_QUERY_PROFILE_OFF:
            cmd->root["profile"] = "off";
            break;
        case LCB_QUERY_PROFILE_PHASES:
            cmd->root["profile"] = "phases";
            break;
        case LCB_QUERY_PROFILE_TIMINGS:
            cmd->root["profile"] = "timings";
            break;
        default:
            return LCB_ERR_INVALID_ARGUMENT;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency(lcb_CMDQUERY *cmd, lcb_QUERY_CONSISTENCY mode)
{
    if (mode == LCB_QUERY_CONSISTENCY_NONE) {
        cmd->root.removeMember("scan_consistency");
    } else if (mode == LCB_QUERY_CONSISTENCY_REQUEST) {
        cmd->root["scan_consistency"] = "request_plus";
    } else if (mode == LCB_QUERY_CONSISTENCY_STATEMENT) {
        cmd->root["scan_consistency"] = "statement_plus";
    }
    return LCB_SUCCESS;
}

static void encode_mutation_token(Json::Value &sparse, const lcb_MUTATION_TOKEN *sv)
{
    char buf[64] = {0};
    sprintf(buf, "%u", sv->vbid_);
    Json::Value &cur_sv = sparse[buf];

    cur_sv[0] = static_cast<Json::UInt64>(sv->seqno_);
    sprintf(buf, "%llu", (unsigned long long)sv->uuid_);
    cur_sv[1] = buf;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency_token_for_keyspace(lcb_CMDQUERY *cmd, const char *keyspace,
                                                                        size_t keyspace_len,
                                                                        const lcb_MUTATION_TOKEN *token)
{
    if (!lcb_mutation_token_is_valid(token)) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    cmd->root["scan_consistency"] = "at_plus";
    encode_mutation_token(cmd->root["scan_vectors"][std::string(keyspace, keyspace_len)], token);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_consistency_tokens(lcb_CMDQUERY *cmd, lcb_INSTANCE *instance)
{
    lcbvb_CONFIG *vbc;
    lcb_STATUS rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    const char *bucketname;
    rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &bucketname);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    Json::Value *sv_json = nullptr;

    size_t vbmax = vbc->nvb;
    for (size_t ii = 0; ii < vbmax; ++ii) {
        lcb_KEYBUF kb;
        kb.type = LCB_KV_VBID;
        kb.vbid = ii;
        const lcb_MUTATION_TOKEN *mt = lcb_get_mutation_token(instance, &kb, &rc);
        if (rc == LCB_SUCCESS && mt != nullptr) {
            if (sv_json == nullptr) {
                sv_json = &cmd->root["scan_vectors"][bucketname];
                cmd->root["scan_consistency"] = "at_plus";
            }
            encode_mutation_token(*sv_json, mt);
        }
    }

    if (!sv_json) {
        return LCB_ERR_DOCUMENT_NOT_FOUND;
    }

    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_max_parallelism(lcb_CMDQUERY *cmd, int value)
{
    cmd->root["max_parallelism"] = std::to_string(value);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_option(lcb_CMDQUERY *cmd, const char *name, size_t name_len, const char *value,
                                                size_t value_len)
{
    fix_strlen(name, name_len) fix_strlen(value, value_len) Json::Reader rdr;
    Json::Value jsonValue;
    bool rv = rdr.parse(value, value + value_len, jsonValue);
    if (!rv) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    cmd->root[std::string(name, name_len)] = jsonValue;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdquery_handle(lcb_CMDQUERY *cmd, lcb_QUERY_HANDLE **handle)
{
    cmd->handle = handle;
    return LCB_SUCCESS;
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
