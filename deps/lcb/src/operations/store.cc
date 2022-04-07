/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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
#include "internal.h"
#include "collections.h"
#include "mc/compress.h"
#include "trace.h"
#include "defer.h"
#include "durability_internal.h"

#include "capi/cmd_store.hh"

LIBCOUCHBASE_API int lcb_mutation_token_is_valid(const lcb_MUTATION_TOKEN *token)
{
    return token && !(token->uuid_ == 0 && token->seqno_ == 0 && token->vbid_ == 0);
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_status(const lcb_RESPSTORE *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_error_context(const lcb_RESPSTORE *resp,
                                                        const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_cookie(const lcb_RESPSTORE *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_cas(const lcb_RESPSTORE *resp, uint64_t *cas)
{
    *cas = resp->ctx.cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_key(const lcb_RESPSTORE *resp, const char **key, size_t *key_len)
{
    *key = resp->ctx.key.c_str();
    *key_len = resp->ctx.key.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_operation(const lcb_RESPSTORE *resp, lcb_STORE_OPERATION *operation)
{
    *operation = resp->op;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_stored(const lcb_RESPSTORE *resp, int *store_ok)
{
    if (resp->dur_resp == nullptr) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    *store_ok = resp->store_ok;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API int lcb_respstore_observe_attached(const lcb_RESPSTORE *resp)
{
    return resp->dur_resp != nullptr;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_master_exists(const lcb_RESPSTORE *resp, int *master_exists)
{
    if (resp->dur_resp == nullptr) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    *master_exists = resp->dur_resp->exists_master;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_master_persisted(const lcb_RESPSTORE *resp, int *master_persisted)
{
    if (resp->dur_resp == nullptr) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    *master_persisted = resp->dur_resp->persisted_master;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_num_responses(const lcb_RESPSTORE *resp, uint16_t *num_responses)
{
    if (resp->dur_resp == nullptr) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    *num_responses = resp->dur_resp->nresponses;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_num_persisted(const lcb_RESPSTORE *resp, uint16_t *num_persisted)
{
    if (resp->dur_resp == nullptr) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    *num_persisted = resp->dur_resp->npersisted;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_observe_num_replicated(const lcb_RESPSTORE *resp, uint16_t *num_replicated)
{
    if (resp->dur_resp == nullptr) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    *num_replicated = resp->dur_resp->nreplicated;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respstore_mutation_token(const lcb_RESPSTORE *resp, lcb_MUTATION_TOKEN *token)
{
    if (token) {
        *token = resp->mt;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_create(lcb_CMDSTORE **cmd, lcb_STORE_OPERATION operation)
{
    *cmd = new lcb_CMDSTORE{};
    (*cmd)->operation(operation);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_destroy(lcb_CMDSTORE *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_timeout(lcb_CMDSTORE *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_parent_span(lcb_CMDSTORE *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_collection(lcb_CMDSTORE *cmd, const char *scope, size_t scope_len,
                                                    const char *collection, size_t collection_len)
{
    try {
        lcb::collection_qualifier qualifier(scope, scope_len, collection, collection_len);
        return cmd->collection(std::move(qualifier));
    } catch (const std::invalid_argument &) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_key(lcb_CMDSTORE *cmd, const char *key, size_t key_len)
{
    if (key == nullptr || key_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->key(std::string(key, key_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_value(lcb_CMDSTORE *cmd, const char *value, size_t value_len)
{
    if (value == nullptr || value_len == 0) {
        return LCB_SUCCESS; /* empty values allowed */
    }

    return cmd->value(std::string(value, value_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_value_iov(lcb_CMDSTORE *cmd, const lcb_IOV *value, size_t value_len)
{
    return cmd->value(value, value_len);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_expiry(lcb_CMDSTORE *cmd, uint32_t expiration)
{
    return cmd->expiry(expiration);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_preserve_expiry(lcb_CMDSTORE *cmd, int should_preserve)
{
    return cmd->preserve_expiry(should_preserve);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_cas(lcb_CMDSTORE *cmd, uint64_t cas)
{
    return cmd->cas(cas);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_flags(lcb_CMDSTORE *cmd, uint32_t flags)
{
    return cmd->flags(flags);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_datatype(lcb_CMDSTORE *cmd, uint8_t datatype)
{
    if (datatype & LCB_VALUE_F_SNAPPYCOMP) {
        cmd->value_is_compressed(true);
    }
    if (datatype & LCB_VALUE_F_JSON) {
        cmd->value_is_json(true);
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_durability(lcb_CMDSTORE *cmd, lcb_DURABILITY_LEVEL level)
{
    return cmd->durability_level(level);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_durability_observe(lcb_CMDSTORE *cmd, int persist_to, int replicate_to)
{
    return cmd->durability_poll(persist_to, replicate_to);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_on_behalf_of(lcb_CMDSTORE *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdstore_on_behalf_of_extra_privilege(lcb_CMDSTORE *cmd, const char *privilege,
                                                                      size_t privilege_len)
{
    return cmd->on_behalf_of_add_extra_privilege(std::string(privilege, privilege_len));
}

struct DurStoreCtx : mc_REQDATAEX {
    lcb_INSTANCE *instance;
    lcb_U16 persist_to;
    lcb_U16 replicate_to;

    static mc_REQDATAPROCS proctable;

    DurStoreCtx(lcb_INSTANCE *instance_, lcb_U16 persist_, lcb_U16 replicate_, void *cookie_)
        : mc_REQDATAEX(cookie_, proctable, 0), instance(instance_), persist_to(persist_), replicate_to(replicate_)
    {
    }
};

/** Observe stuff */
static void handle_dur_storecb(mc_PIPELINE *, mc_PACKET *pkt, lcb_CALLBACK_TYPE /* cbtype */, lcb_STATUS err,
                               const void *arg)
{
    lcb_RESPCALLBACK cb;
    lcb_RESPSTORE resp{};
    lcb_CMDENDURE dcmd = {0};
    auto *dctx = static_cast<DurStoreCtx *>(pkt->u_rdata.exdata);
    lcb_MULTICMD_CTX *mctx;
    lcb_durability_opts_t opts = {0};
    const auto *sresp = (const lcb_RESPSTORE *)arg;
    lcbtrace_SPAN *span = nullptr;

    if (err != LCB_SUCCESS) {
        goto GT_BAIL;
    }
    if (sresp->ctx.rc != LCB_SUCCESS) {
        err = sresp->ctx.rc;
        goto GT_BAIL;
    }

    resp.store_ok = 1;
    LCB_CMD_SET_KEY(&dcmd, sresp->ctx.key.c_str(), sresp->ctx.key.size());
    dcmd.cas = sresp->ctx.cas;

    if (LCB_MUTATION_TOKEN_ISVALID(&sresp->mt)) {
        dcmd.mutation_token = &sresp->mt;
    }

    /* Set the options.. */
    opts.v.v0.persist_to = dctx->persist_to;
    opts.v.v0.replicate_to = dctx->replicate_to;

    mctx = lcb_endure3_ctxnew(dctx->instance, &opts, &err);
    if (mctx == nullptr) {
        goto GT_BAIL;
    }

    span = MCREQ_PKT_RDATA(pkt)->span;
    if (span) {
        mctx->setspan(mctx, span);
    }

    lcbdurctx_set_durstore(mctx, 1);
    err = mctx->add_endure(mctx, &dcmd);
    if (err != LCB_SUCCESS) {
        mctx->fail(mctx);
        goto GT_BAIL;
    }
    lcb_sched_enter(dctx->instance);
    err = mctx->done(mctx, sresp->cookie);
    lcb_sched_leave(dctx->instance);

    if (err == LCB_SUCCESS) {
        /* Everything OK? */
        delete dctx;
        return;
    }

GT_BAIL : {
    lcb_RESPENDURE dresp{};
    resp.ctx.key = sresp->ctx.key;
    resp.cookie = sresp->cookie;
    resp.ctx.rc = err;
    resp.dur_resp = &dresp;
    cb = lcb_find_callback(dctx->instance, LCB_CALLBACK_STORE);
    cb(dctx->instance, LCB_CALLBACK_STORE, (const lcb_RESPBASE *)&resp);
    delete dctx;
}
}

static void handle_dur_schedfail(mc_PACKET *pkt)
{
    delete static_cast<DurStoreCtx *>(pkt->u_rdata.exdata);
}

mc_REQDATAPROCS DurStoreCtx::proctable = {handle_dur_storecb, handle_dur_schedfail};

static lcb_size_t get_value_size(const mc_PACKET *packet)
{
    if (packet->flags & MCREQ_F_VALUE_IOV) {
        return packet->u_value.multi.total_length;
    } else {
        return packet->u_value.single.size;
    }
}

static bool can_compress(lcb_INSTANCE *instance, const mc_PIPELINE *pipeline, bool already_compressed)
{
    if (already_compressed) {
        return false;
    }

    const auto *server = static_cast<const lcb::Server *>(pipeline);
    uint8_t compressopts = LCBT_SETTING(instance, compressopts);

    if ((compressopts & LCB_COMPRESS_OUT) == 0) {
        return false;
    }
    if (server->supports_compression() == false && (compressopts & LCB_COMPRESS_FORCE) == 0) {
        return false;
    }
    return true;
}

static lcb_STATUS store_validate(lcb_INSTANCE *instance, const lcb_CMDSTORE *cmd)
{
    if (cmd->key().empty()) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (!LCBT_SETTING(instance, use_collections) && !cmd->collection().is_default_collection()) {
        /* only allow default collection when collections disabled for the instance */
        return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }
    if (!LCBT_SETTING(instance, enable_durable_write) && cmd->has_sync_durability_requirements()) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }

    return LCB_SUCCESS;
}

static lcb_STATUS store_schedule(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDSTORE> cmd)
{
    lcb_STATUS err;

    mc_PIPELINE *pipeline;
    mc_PACKET *packet;
    mc_CMDQUEUE *cq = &instance->cmdq;
    protocol_binary_request_header hdr{};
    int new_durability_supported = LCBT_SUPPORT_SYNCREPLICATION(instance);

    std::vector<std::uint8_t> framing_extras;
    if (new_durability_supported && cmd->has_sync_durability_requirements()) {
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
    if (cmd->should_preserve_expiry()) {
        std::uint8_t frame_id = 0x05;
        std::uint8_t frame_size = 0x00;
        framing_extras.emplace_back(frame_id << 4U | frame_size);
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
    auto ffextlen = static_cast<std::uint8_t>(framing_extras.size());
    hdr.request.magic = (ffextlen == 0) ? PROTOCOL_BINARY_REQ : PROTOCOL_BINARY_AREQ;
    hdr.request.opcode = cmd->opcode();
    hdr.request.extlen = cmd->extras_size();
    lcb_KEYBUF keybuf{LCB_KV_COPY, {cmd->key().c_str(), cmd->key().size()}};
    err = mcreq_basic_packet(cq, &keybuf, cmd->collection().collection_id(), &hdr, hdr.request.extlen, ffextlen,
                             &packet, &pipeline, MCREQ_BASICPACKET_F_FALLBACKOK);
    if (err != LCB_SUCCESS) {
        return err;
    }

    int should_compress = can_compress(instance, pipeline, cmd->value_is_compressed());
    lcb_VALBUF valuebuf{LCB_KV_COPY, {{cmd->value().c_str(), cmd->value().size()}}};
    if (should_compress) {
        int rv = mcreq_compress_value(pipeline, packet, &valuebuf, instance->settings, &should_compress);
        if (rv != 0) {
            mcreq_release_packet(pipeline, packet);
            return LCB_ERR_NO_MEMORY;
        }
    } else {
        mcreq_reserve_value(pipeline, packet, &valuebuf);
    }

    if (cmd->need_poll_durability()) {
        int duropts = 0;
        std::uint16_t persist_to = cmd->persist_to();
        std::uint16_t replicate_to = cmd->replicate_to();
        if (cmd->cap_to_maximum_nodes()) {
            duropts = LCB_DURABILITY_VALIDATE_CAPMAX;
        }
        err = lcb_durability_validate(instance, &persist_to, &replicate_to, duropts);
        if (err != LCB_SUCCESS) {
            mcreq_wipe_packet(pipeline, packet);
            mcreq_release_packet(pipeline, packet);
            return err;
        }

        auto *dctx = new DurStoreCtx(instance, persist_to, replicate_to, cmd->cookie());
        packet->u_rdata.exdata = dctx;
        packet->flags |= MCREQ_F_REQEXT;
    }
    mc_REQDATA *rdata = MCREQ_PKT_RDATA(packet);
    rdata->cookie = cmd->cookie();
    rdata->start = cmd->start_time_or_default_in_nanoseconds(gethrtime());
    rdata->deadline =
        rdata->start + cmd->timeout_or_default_in_nanoseconds(LCB_US2NS(LCBT_SETTING(instance, operation_timeout)));

    hdr.request.cas = lcb_htonll(cmd->cas());
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    if (should_compress || cmd->value_is_compressed()) {
        hdr.request.datatype |= PROTOCOL_BINARY_DATATYPE_COMPRESSED;
    }

    if (cmd->value_is_json() && static_cast<const lcb::Server *>(pipeline)->supports_json()) {
        hdr.request.datatype |= PROTOCOL_BINARY_DATATYPE_JSON;
    }

    hdr.request.opaque = packet->opaque;
    hdr.request.bodylen = htonl(hdr.request.extlen + ffextlen + mcreq_get_key_size(&hdr) + get_value_size(packet));

    if (cmd->is_cookie_callback()) {
        packet->flags |= MCREQ_F_PRIVCALLBACK;
    }

    memcpy(SPAN_BUFFER(&packet->kh_span), &hdr, sizeof(hdr));

    std::size_t offset = sizeof(hdr);
    if (!framing_extras.empty()) {
        memcpy(SPAN_BUFFER(&packet->kh_span) + offset, framing_extras.data(), framing_extras.size());
        offset += framing_extras.size();
    }

    if (hdr.request.extlen == 2 * sizeof(std::uint32_t)) {
        std::uint32_t flags = htonl(cmd->flags());
        memcpy(SPAN_BUFFER(&packet->kh_span) + offset, &flags, sizeof(flags));
        offset += sizeof(flags);

        std::uint32_t expiry = htonl(cmd->expiry());
        memcpy(SPAN_BUFFER(&packet->kh_span) + offset, &expiry, sizeof(expiry));
    }

    if (cmd->is_replace_semantics()) {
        packet->flags |= MCREQ_F_REPLACE_SEMANTICS;
    }
    rdata->span = lcb::trace::start_kv_span_with_durability(instance->settings, packet, cmd);
    LCB_SCHED_ADD(instance, pipeline, packet)

    TRACE_STORE_BEGIN(instance, &hdr, cmd);

    return LCB_SUCCESS;
}

static lcb_STATUS store_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDSTORE> cmd)
{
    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return store_schedule(instance, cmd);
    }

    if (collcache_get(instance, cmd->collection()) == LCB_SUCCESS) {
        return store_schedule(instance, cmd);
    }

    return collcache_resolve(
        instance, cmd,
        [instance](lcb_STATUS status, const lcb_RESPGETCID *resp, std::shared_ptr<lcb_CMDSTORE> operation) {
            const auto callback_type = LCB_CALLBACK_STORE;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPSTORE response{};
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
            response.ctx.rc = store_schedule(instance, operation);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
}

LIBCOUCHBASE_API lcb_STATUS lcb_store(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSTORE *command)
{
    lcb_STATUS rc;

    rc = store_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto cmd = std::make_shared<lcb_CMDSTORE>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        cmd->start_time_in_nanoseconds(gethrtime());
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            const auto callback_type = LCB_CALLBACK_STORE;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPSTORE response{};
            response.ctx.key = cmd->key();
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = store_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
    }
    return store_execute(instance, cmd);
}
