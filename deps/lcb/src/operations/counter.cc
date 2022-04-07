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

#include "capi/cmd_counter.hh"
#include "capi/deferred_command_context.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_status(const lcb_RESPCOUNTER *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_error_context(const lcb_RESPCOUNTER *resp,
                                                          const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_cookie(const lcb_RESPCOUNTER *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_cas(const lcb_RESPCOUNTER *resp, uint64_t *cas)
{
    *cas = resp->ctx.cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_key(const lcb_RESPCOUNTER *resp, const char **key, size_t *key_len)
{
    *key = resp->ctx.key.c_str();
    *key_len = resp->ctx.key.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_mutation_token(const lcb_RESPCOUNTER *resp, lcb_MUTATION_TOKEN *token)
{
    if (token) {
        *token = resp->mt;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_value(const lcb_RESPCOUNTER *resp, uint64_t *value)
{
    *value = resp->value;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_create(lcb_CMDCOUNTER **cmd)
{
    *cmd = new lcb_CMDCOUNTER{};
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_destroy(lcb_CMDCOUNTER *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_cas(lcb_CMDCOUNTER * /* cmd */, uint64_t /* cas */)
{
    return LCB_ERR_UNSUPPORTED_OPERATION;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_timeout(lcb_CMDCOUNTER *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_parent_span(lcb_CMDCOUNTER *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_collection(lcb_CMDCOUNTER *cmd, const char *scope, size_t scope_len,
                                                      const char *collection, size_t collection_len)
{
    try {
        lcb::collection_qualifier qualifier(scope, scope_len, collection, collection_len);
        return cmd->collection(std::move(qualifier));
    } catch (const std::invalid_argument &) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_key(lcb_CMDCOUNTER *cmd, const char *key, size_t key_len)
{
    if (key == nullptr || key_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->key(std::string(key, key_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_expiry(lcb_CMDCOUNTER *cmd, uint32_t expiration)
{
    return cmd->expiry(expiration);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_delta(lcb_CMDCOUNTER *cmd, int64_t number)
{
    return cmd->delta(number);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_initial(lcb_CMDCOUNTER *cmd, uint64_t number)
{
    return cmd->initialize_with(number);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_durability(lcb_CMDCOUNTER *cmd, lcb_DURABILITY_LEVEL level)
{
    return cmd->durability_level(level);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_on_behalf_of(lcb_CMDCOUNTER *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_on_behalf_of_extra_privilege(lcb_CMDCOUNTER *cmd, const char *privilege,
                                                                        size_t privilege_len)
{
    return cmd->on_behalf_of_add_extra_privilege(std::string(privilege, privilege_len));
}

static lcb_STATUS counter_validate(lcb_INSTANCE *instance, const lcb_CMDCOUNTER *cmd)
{
    if (cmd->key().empty()) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (!LCBT_SETTING(instance, use_collections) && !cmd->collection().is_default_collection()) {
        /* only allow default collection when collections disabled for the instance */
        return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }
    if (!LCBT_SETTING(instance, enable_durable_write) && cmd->has_durability_requirements()) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    return LCB_SUCCESS;
}

static lcb_STATUS counter_schedule(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDCOUNTER> cmd)
{
    mc_CMDQUEUE *q = &instance->cmdq;
    mc_PIPELINE *pipeline;
    mc_PACKET *packet;
    mc_REQDATA *rdata;
    lcb_STATUS err;
    int new_durability_supported = LCBT_SUPPORT_SYNCREPLICATION(instance);

    protocol_binary_request_header hdr{};

    std::vector<std::uint8_t> framing_extras;
    if (new_durability_supported && cmd->has_durability_requirements()) {
        auto durability_timeout = htons(lcb_durability_timeout(instance, cmd->timeout_in_microseconds()));
        std::uint8_t frame_id = 0x01;
        std::uint8_t frame_size = durability_timeout > 0 ? 3 : 1;
        framing_extras.emplace_back(frame_id << 4U | frame_size);
        framing_extras.emplace_back(cmd->durability_level());
        if (durability_timeout > 0) {
            framing_extras.emplace_back(durability_timeout >> 8U);
            framing_extras.emplace_back(durability_timeout & 0xff);
        }
    }
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
    err = mcreq_basic_packet(q, &keybuf, cmd->collection().collection_id(), &hdr, 20, ffextlen, &packet, &pipeline,
                             MCREQ_BASICPACKET_F_FALLBACKOK);
    if (err != LCB_SUCCESS) {
        return err;
    }

    rdata = &packet->u_rdata.reqdata;
    rdata->cookie = cmd->cookie();
    rdata->start = cmd->start_time_or_default_in_nanoseconds(gethrtime());
    rdata->deadline =
        rdata->start + cmd->timeout_or_default_in_nanoseconds(LCB_US2NS(LCBT_SETTING(instance, operation_timeout)));
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.cas = 0;
    hdr.request.opaque = packet->opaque;
    hdr.request.bodylen = htonl(ffextlen + hdr.request.extlen + mcreq_get_key_size(&hdr));

    std::uint64_t delta;
    if (cmd->delta() < 0) {
        hdr.request.opcode = PROTOCOL_BINARY_CMD_DECREMENT;
        delta = lcb_htonll((std::uint64_t)(cmd->delta() * -1));
    } else {
        hdr.request.opcode = PROTOCOL_BINARY_CMD_INCREMENT;
        delta = lcb_htonll(cmd->delta());
    }

    memcpy(SPAN_BUFFER(&packet->kh_span), &hdr, sizeof(hdr));
    std::size_t offset = sizeof(hdr);
    if (!framing_extras.empty()) {
        memcpy(SPAN_BUFFER(&packet->kh_span) + offset, framing_extras.data(), framing_extras.size());
        offset += framing_extras.size();
    }

    memcpy(SPAN_BUFFER(&packet->kh_span) + offset, &delta, sizeof(delta));
    offset += sizeof(delta);

    std::uint64_t initial = lcb_htonll(cmd->initial_value());
    memcpy(SPAN_BUFFER(&packet->kh_span) + offset, &initial, sizeof(initial));
    offset += sizeof(initial);

    std::uint32_t expiry;
    if (cmd->initialize_if_does_not_exist()) {
        expiry = htonl(cmd->expiry());
    } else {
        memset(&expiry, 0xff, sizeof(expiry));
    }
    memcpy(SPAN_BUFFER(&packet->kh_span) + offset, &expiry, sizeof(expiry));

    rdata->span = lcb::trace::start_kv_span(instance->settings, packet, cmd);
    TRACE_ARITHMETIC_BEGIN(instance, &hdr, cmd);
    LCB_SCHED_ADD(instance, pipeline, packet);
    return LCB_SUCCESS;
}

static lcb_STATUS counter_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDCOUNTER> cmd)
{
    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return counter_schedule(instance, cmd);
    }

    if (collcache_get(instance, cmd->collection()) == LCB_SUCCESS) {
        return counter_schedule(instance, cmd);
    }

    return collcache_resolve(
        instance, cmd,
        [instance](lcb_STATUS status, const lcb_RESPGETCID *resp, std::shared_ptr<lcb_CMDCOUNTER> operation) {
            const auto callback_type = LCB_CALLBACK_COUNTER;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPCOUNTER response{};
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
            response.ctx.rc = counter_schedule(instance, operation);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
}

LIBCOUCHBASE_API
lcb_STATUS lcb_counter(lcb_INSTANCE *instance, void *cookie, const lcb_CMDCOUNTER *command)
{
    lcb_STATUS rc = counter_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto cmd = std::make_shared<lcb_CMDCOUNTER>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        cmd->start_time_in_nanoseconds(gethrtime());
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            const auto callback_type = LCB_CALLBACK_COUNTER;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPCOUNTER response{};
            response.ctx.key = cmd->key();
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = counter_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
    }
    return counter_execute(instance, cmd);
}
