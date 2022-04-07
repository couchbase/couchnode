/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2020 Couchbase, Inc.
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

#include <memory>

#include "internal.h"
#include "collections.h"
#include "trace.h"
#include "defer.h"

#include "capi/cmd_get.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respget_status(const lcb_RESPGET *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respget_error_context(const lcb_RESPGET *resp, const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respget_cookie(const lcb_RESPGET *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respget_cas(const lcb_RESPGET *resp, uint64_t *cas)
{
    *cas = resp->ctx.cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respget_datatype(const lcb_RESPGET *resp, uint8_t *datatype)
{
    *datatype = resp->datatype;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respget_flags(const lcb_RESPGET *resp, uint32_t *flags)
{
    *flags = resp->itmflags;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respget_key(const lcb_RESPGET *resp, const char **key, size_t *key_len)
{
    *key = resp->ctx.key.c_str();
    *key_len = resp->ctx.key.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respget_value(const lcb_RESPGET *resp, const char **value, size_t *value_len)
{
    *value = (const char *)resp->value;
    *value_len = resp->nvalue;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_create(lcb_CMDGET **cmd)
{
    *cmd = new lcb_CMDGET{};
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_destroy(lcb_CMDGET *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_timeout(lcb_CMDGET *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_parent_span(lcb_CMDGET *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_collection(lcb_CMDGET *cmd, const char *scope, size_t scope_len,
                                                  const char *collection, size_t collection_len)
{
    try {
        lcb::collection_qualifier qualifier(scope, scope_len, collection, collection_len);
        return cmd->collection(std::move(qualifier));
    } catch (const std::invalid_argument &) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_key(lcb_CMDGET *cmd, const char *key, size_t key_len)
{
    if (key == nullptr || key_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->key(std::string(key, key_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_expiry(lcb_CMDGET *cmd, uint32_t expiration)
{
    return cmd->with_touch(expiration);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_locktime(lcb_CMDGET *cmd, uint32_t duration)
{
    return cmd->with_lock(duration);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_on_behalf_of(lcb_CMDGET *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdget_on_behalf_of_extra_privilege(lcb_CMDGET *cmd, const char *privilege,
                                                                    size_t privilege_len)
{
    return cmd->on_behalf_of_add_extra_privilege(std::string(privilege, privilege_len));
}

static lcb_STATUS get_validate(lcb_INSTANCE *instance, const lcb_CMDGET *cmd)
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

static lcb_STATUS get_schedule(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDGET> cmd)
{
    mc_PIPELINE *pl;
    mc_PACKET *pkt;
    mc_REQDATA *rdata;
    mc_CMDQUEUE *q = &instance->cmdq;
    lcb_uint8_t extlen = 0;
    lcb_uint8_t opcode = PROTOCOL_BINARY_CMD_GET;
    protocol_binary_request_header hdr{};
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

    if (cmd->with_lock()) {
        extlen = 4;
        opcode = PROTOCOL_BINARY_CMD_GET_LOCKED;
    } else if (cmd->with_touch()) {
        extlen = 4;
        opcode = PROTOCOL_BINARY_CMD_GAT;
    }

    lcb_KEYBUF keybuf{LCB_KV_COPY, {cmd->key().c_str(), cmd->key().size()}};
    err = mcreq_basic_packet(q, &keybuf, cmd->collection().collection_id(), &hdr, extlen, ffextlen, &pkt, &pl,
                             MCREQ_BASICPACKET_F_FALLBACKOK);
    if (err != LCB_SUCCESS) {
        return err;
    }

    rdata = &pkt->u_rdata.reqdata;
    rdata->cookie = cmd->cookie();
    rdata->start = cmd->start_time_or_default_in_nanoseconds(gethrtime());
    rdata->deadline =
        rdata->start + cmd->timeout_or_default_in_nanoseconds(LCB_US2NS(LCBT_SETTING(instance, operation_timeout)));

    hdr.request.opcode = opcode;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.bodylen = htonl(extlen + ffextlen + mcreq_get_key_size(&hdr));
    hdr.request.opaque = pkt->opaque;
    hdr.request.cas = 0;

    if (cmd->is_cookie_callback()) {
        pkt->flags |= MCREQ_F_PRIVCALLBACK;
    }

    memcpy(SPAN_BUFFER(&pkt->kh_span), &hdr, sizeof(hdr));
    std::size_t offset = sizeof(hdr);
    if (!framing_extras.empty()) {
        memcpy(SPAN_BUFFER(&pkt->kh_span) + offset, framing_extras.data(), framing_extras.size());
        offset += framing_extras.size();
    }
    if (cmd->with_lock()) {
        std::uint32_t lock_expiry = htonl(cmd->lock_time());
        memcpy(SPAN_BUFFER(&pkt->kh_span) + offset, &lock_expiry, sizeof(lock_expiry));
    } else if (cmd->with_touch()) {
        std::uint32_t expiry = htonl(cmd->expiry());
        memcpy(SPAN_BUFFER(&pkt->kh_span) + offset, &expiry, sizeof(expiry));
    }

    rdata->span = lcb::trace::start_kv_span(instance->settings, pkt, cmd);
    LCB_SCHED_ADD(instance, pl, pkt)
    TRACE_GET_BEGIN(instance, &hdr, cmd);
    return LCB_SUCCESS;
}

static lcb_STATUS get_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDGET> cmd)
{
    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return get_schedule(instance, cmd);
    }

    if (collcache_get(instance, cmd->collection()) == LCB_SUCCESS) {
        return get_schedule(instance, cmd);
    }

    return collcache_resolve(
        instance, cmd,
        [instance](lcb_STATUS status, const lcb_RESPGETCID *resp, std::shared_ptr<lcb_CMDGET> operation) {
            const auto callback_type = LCB_CALLBACK_GET;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPGET response{};
            if (resp != nullptr) {
                response.ctx = resp->ctx;
            }
            response.ctx.key = operation->key();
            response.ctx.scope = operation->collection().scope();
            response.ctx.collection = operation->collection().collection();
            response.cookie = operation->cookie();
            if (status == LCB_ERR_SHEDULE_FAILURE || resp == nullptr) {
                response.ctx.rc = LCB_ERR_TIMEOUT;
                operation_callback(instance, callback_type, &response);
                return;
            }
            if (resp->ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = get_schedule(instance, operation);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
}

LIBCOUCHBASE_API
lcb_STATUS lcb_get(lcb_INSTANCE *instance, void *cookie, const lcb_CMDGET *command)
{
    lcb_STATUS rc;

    rc = get_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto cmd = std::make_shared<lcb_CMDGET>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        cmd->start_time_in_nanoseconds(gethrtime());
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            const auto callback_type = LCB_CALLBACK_GET;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPGET response{};
            response.ctx.key = cmd->key();
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = get_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
    }
    return get_execute(instance, cmd);
}
