/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2019-2020 Couchbase, Inc.
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
#include "collections.h"
#include "trace.h"
#include "defer.h"

#include "capi/cmd_exists.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_status(const lcb_RESPEXISTS *resp)
{
    return resp->ctx.rc == LCB_ERR_DOCUMENT_NOT_FOUND ? LCB_SUCCESS : resp->ctx.rc;
}

LIBCOUCHBASE_API int lcb_respexists_is_found(const lcb_RESPEXISTS *resp)
{
    return resp->ctx.rc == LCB_SUCCESS && !resp->deleted;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_error_context(const lcb_RESPEXISTS *resp,
                                                         const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_cookie(const lcb_RESPEXISTS *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_cas(const lcb_RESPEXISTS *resp, uint64_t *cas)
{
    *cas = resp->ctx.cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_key(const lcb_RESPEXISTS *resp, const char **key, size_t *key_len)
{
    *key = resp->ctx.key.c_str();
    *key_len = resp->ctx.key.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_mutation_token(const lcb_RESPEXISTS *resp, lcb_MUTATION_TOKEN *token)
{
    if (token) {
        *token = resp->mt;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_create(lcb_CMDEXISTS **cmd)
{
    *cmd = new lcb_CMDEXISTS{};
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_destroy(lcb_CMDEXISTS *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_timeout(lcb_CMDEXISTS *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_parent_span(lcb_CMDEXISTS *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_collection(lcb_CMDEXISTS *cmd, const char *scope, size_t scope_len,
                                                     const char *collection, size_t collection_len)
{
    try {
        lcb::collection_qualifier qualifier(scope, scope_len, collection, collection_len);
        return cmd->collection(std::move(qualifier));
    } catch (const std::invalid_argument &) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_key(lcb_CMDEXISTS *cmd, const char *key, size_t key_len)
{
    if (key == nullptr || key_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->key(std::string(key, key_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_on_behalf_of(lcb_CMDEXISTS *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_on_behalf_of_extra_privilege(lcb_CMDEXISTS *cmd, const char *privilege,
                                                                       size_t privilege_len)
{
    return cmd->on_behalf_of_add_extra_privilege(std::string(privilege, privilege_len));
}

static lcb_STATUS exists_validate(lcb_INSTANCE *instance, const lcb_CMDEXISTS *cmd)
{
    if (cmd->key().empty()) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (!LCBT_SETTING(instance, use_collections) && !cmd->collection().is_default_collection()) {
        /* only allow default collection when collections disabled for the instance */
        return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }
    return LCB_SUCCESS;
}

static lcb_STATUS exists_schedule(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDEXISTS> cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;

    protocol_binary_request_header hdr{};
    mc_PIPELINE *pipeline;
    mc_PACKET *pkt;
    lcb_STATUS err;

    std::vector<std::uint8_t> framing_extras;
    if (cmd->want_impersonation()) {
        err = lcb::flexible_framing_extras::encode_impersonate_user(cmd->impostor(), framing_extras);
        if (err != LCB_SUCCESS) {
            return err;
        }
        for (const auto &privilege : cmd->extra_privileges()) {
            err = lcb::flexible_framing_extras::encode_impersonate_users_extra_privilege(privilege, framing_extras);
            if (err != LCB_SUCCESS) {
                return err;
            }
        }
    }

    hdr.request.magic = framing_extras.empty() ? PROTOCOL_BINARY_REQ : PROTOCOL_BINARY_AREQ;
    auto ffextlen = static_cast<std::uint8_t>(framing_extras.size());

    lcb_KEYBUF keybuf{LCB_KV_COPY, {cmd->key().c_str(), cmd->key().size()}};
    err = mcreq_basic_packet(cq, &keybuf, cmd->collection().collection_id(), &hdr, 0, ffextlen, &pkt, &pipeline,
                             MCREQ_BASICPACKET_F_FALLBACKOK);
    if (err != LCB_SUCCESS) {
        return err;
    }

    hdr.request.opcode = PROTOCOL_BINARY_CMD_GET_META;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.bodylen = ntohl(mcreq_get_key_size(&hdr));
    hdr.request.opaque = pkt->opaque;
    hdr.request.cas = 0;

    pkt->u_rdata.reqdata.cookie = cmd->cookie();
    pkt->u_rdata.reqdata.start = cmd->start_time_or_default_in_nanoseconds(gethrtime());
    pkt->u_rdata.reqdata.deadline =
        pkt->u_rdata.reqdata.start +
        cmd->timeout_or_default_in_nanoseconds(LCB_US2NS(LCBT_SETTING(instance, operation_timeout)));
    memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, MCREQ_PKT_BASESIZE);
    std::size_t offset = sizeof(hdr);
    if (!framing_extras.empty()) {
        memcpy(SPAN_BUFFER(&pkt->kh_span) + offset, framing_extras.data(), framing_extras.size());
    }

    pkt->u_rdata.reqdata.span = lcb::trace::start_kv_span(instance->settings, pkt, cmd);
    LCB_SCHED_ADD(instance, pipeline, pkt)
    TRACE_EXISTS_BEGIN(instance, &hdr, cmd);
    return LCB_SUCCESS;
}

static lcb_STATUS exists_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDEXISTS> cmd)
{
    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return exists_schedule(instance, cmd);
    }

    if (collcache_get(instance, cmd->collection()) == LCB_SUCCESS) {
        return exists_schedule(instance, cmd);
    }

    return collcache_resolve(
        instance, cmd,
        [instance](lcb_STATUS status, const lcb_RESPGETCID *resp, std::shared_ptr<lcb_CMDEXISTS> operation) {
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, LCB_CALLBACK_EXISTS);
            lcb_RESPEXISTS response{};
            if (resp != nullptr) {
                response.ctx = resp->ctx;
            }
            response.ctx.key = operation->key();
            response.ctx.scope = operation->collection().scope();
            response.ctx.collection = operation->collection().collection();
            response.cookie = operation->cookie();
            if (status == LCB_ERR_SHEDULE_FAILURE || resp == nullptr) {
                response.ctx.rc = LCB_ERR_TIMEOUT;
                operation_callback(instance, LCB_CALLBACK_EXISTS, &response);
                return;
            }
            if (resp->ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, LCB_CALLBACK_EXISTS, &response);
                return;
            }
            response.ctx.rc = exists_schedule(instance, operation);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, LCB_CALLBACK_EXISTS, &response);
            }
        });
}

LIBCOUCHBASE_API
lcb_STATUS lcb_exists(lcb_INSTANCE *instance, void *cookie, const lcb_CMDEXISTS *command)
{
    lcb_STATUS rc;

    rc = exists_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto cmd = std::make_shared<lcb_CMDEXISTS>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        cmd->start_time_in_nanoseconds(gethrtime());
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            const auto callback_type = LCB_CALLBACK_EXISTS;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPEXISTS response{};
            response.ctx.key = cmd->key();
            response.cookie = cmd->cookie();
            response.ctx.rc = status;
            if (response.ctx.rc == LCB_ERR_REQUEST_CANCELED) {
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = exists_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
    }
    return exists_execute(instance, cmd);
}
