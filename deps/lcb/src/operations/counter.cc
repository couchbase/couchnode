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
#include "internal.h"
#include "collections.h"
#include "trace.h"

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_status(const lcb_RESPCOUNTER *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_error_context(const lcb_RESPCOUNTER *resp,
                                                          const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    if (resp->rflags & LCB_RESP_F_ERRINFO) {
        lcb_RESPCOUNTER *mut = const_cast<lcb_RESPCOUNTER *>(resp);
        mut->ctx.context = lcb_resp_get_error_context(LCB_CALLBACK_COUNTER, (const lcb_RESPBASE *)resp);
        if (mut->ctx.context) {
            mut->ctx.context_len = strlen(resp->ctx.context);
        }
        mut->ctx.ref = lcb_resp_get_error_ref(LCB_CALLBACK_COUNTER, (const lcb_RESPBASE *)resp);
        if (mut->ctx.ref) {
            mut->ctx.ref_len = strlen(resp->ctx.ref);
        }
    }
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
    *key = (const char *)resp->ctx.key;
    *key_len = resp->ctx.key_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respcounter_mutation_token(const lcb_RESPCOUNTER *resp, lcb_MUTATION_TOKEN *token)
{
    const lcb_MUTATION_TOKEN *mt = lcb_resp_get_mutation_token(LCB_CALLBACK_COUNTER, (const lcb_RESPBASE *)resp);
    if (token && mt) {
        *token = *mt;
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
    *cmd = (lcb_CMDCOUNTER *)calloc(1, sizeof(lcb_CMDCOUNTER));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_clone(const lcb_CMDCOUNTER *cmd, lcb_CMDCOUNTER **copy)
{
    LCB_CMD_CLONE(lcb_CMDCOUNTER, cmd, copy);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_destroy(lcb_CMDCOUNTER *cmd)
{
    LCB_CMD_DESTROY_CLONE(cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_cas(lcb_CMDCOUNTER *cmd, uint64_t cas)
{
    cmd->cas = cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_timeout(lcb_CMDCOUNTER *cmd, uint32_t timeout)
{
    cmd->timeout = timeout;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_parent_span(lcb_CMDCOUNTER *cmd, lcbtrace_SPAN *span)
{
    cmd->pspan = span;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_collection(lcb_CMDCOUNTER *cmd, const char *scope, size_t scope_len,
                                                      const char *collection, size_t collection_len)
{
    cmd->scope = scope;
    cmd->nscope = scope_len;
    cmd->collection = collection;
    cmd->ncollection = collection_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_key(lcb_CMDCOUNTER *cmd, const char *key, size_t key_len)
{
    LCB_CMD_SET_KEY(cmd, key, key_len);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_expiry(lcb_CMDCOUNTER *cmd, uint32_t expiration)
{
    cmd->exptime = expiration;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_delta(lcb_CMDCOUNTER *cmd, int64_t number)
{
    cmd->delta = number;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_initial(lcb_CMDCOUNTER *cmd, uint64_t number)
{
    cmd->initial = number;
    cmd->create = 1;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdcounter_durability(lcb_CMDCOUNTER *cmd, lcb_DURABILITY_LEVEL level)
{
    cmd->dur_level = level;
    return LCB_SUCCESS;
}

static lcb_STATUS counter_validate(lcb_INSTANCE *instance, const lcb_CMDCOUNTER *cmd)
{
    auto err = lcb_is_collection_valid(instance, cmd->scope, cmd->nscope, cmd->collection, cmd->ncollection);
    if (err != LCB_SUCCESS) {
        return err;
    }
    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (cmd->cas || (cmd->create == 0 && cmd->exptime != 0)) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }
    if (cmd->dur_level && !LCBT_SUPPORT_SYNCREPLICATION(instance)) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }

    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_counter(lcb_INSTANCE *instance, void *cookie, const lcb_CMDCOUNTER *command)
{
    lcb_STATUS rc;

    rc = counter_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto operation = [instance, cookie](const lcb_RESPGETCID *resp, const lcb_CMDCOUNTER *cmd) {
        if (resp && resp->ctx.rc != LCB_SUCCESS) {
            lcb_RESPCALLBACK cb = lcb_find_callback(instance, LCB_CALLBACK_COUNTER);
            lcb_RESPCOUNTER cnt{};
            cnt.ctx = resp->ctx;
            cnt.ctx.key = static_cast<const char *>(cmd->key.contig.bytes);
            cnt.ctx.key_len = cmd->key.contig.nbytes;
            cnt.cookie = cookie;
            cb(instance, LCB_CALLBACK_COUNTER, reinterpret_cast<const lcb_RESPBASE *>(&cnt));
            return resp->ctx.rc;
        }

        mc_CMDQUEUE *q = &instance->cmdq;
        mc_PIPELINE *pipeline;
        mc_PACKET *packet;
        mc_REQDATA *rdata;
        lcb_STATUS err;
        int new_durability_supported = LCBT_SUPPORT_SYNCREPLICATION(instance);
        lcb_U8 ffextlen = 0;
        size_t hsize;

        protocol_binary_request_incr acmd;
        protocol_binary_request_header *hdr = &acmd.message.header;

        if (cmd->dur_level && new_durability_supported) {
            hdr->request.magic = PROTOCOL_BINARY_AREQ;
            ffextlen = 4;
        }

        err = mcreq_basic_packet(q, (const lcb_CMDBASE *)cmd, hdr, 20, ffextlen, &packet, &pipeline,
                                 MCREQ_BASICPACKET_F_FALLBACKOK);
        if (err != LCB_SUCCESS) {
            return err;
        }
        hsize = hdr->request.extlen + sizeof(*hdr) + ffextlen;

        rdata = &packet->u_rdata.reqdata;
        rdata->cookie = cookie;
        rdata->start = gethrtime();
        rdata->deadline =
            rdata->start + LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));
        hdr->request.magic = PROTOCOL_BINARY_REQ;
        hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        hdr->request.cas = cmd->cas;
        hdr->request.opaque = packet->opaque;
        hdr->request.bodylen = htonl(ffextlen + hdr->request.extlen + mcreq_get_key_size(hdr));

        uint32_t *exp;
        uint64_t *delta;
        if (cmd->dur_level && new_durability_supported) {
            acmd.message.body.alt.meta = (1u << 4u) | 3u;
            acmd.message.body.alt.level = cmd->dur_level;
            acmd.message.body.alt.timeout = lcb_durability_timeout(instance, cmd->timeout);
            acmd.message.body.alt.initial = lcb_htonll(cmd->initial);
            exp = &acmd.message.body.alt.expiration;
            delta = &acmd.message.body.alt.delta;
        } else {
            acmd.message.body.norm.initial = lcb_htonll(cmd->initial);
            exp = &acmd.message.body.norm.expiration;
            delta = &acmd.message.body.norm.delta;
        }
        if (!cmd->create) {
            memset(exp, 0xff, sizeof(*exp));
        } else {
            *exp = htonl(cmd->exptime);
        }

        if (cmd->delta < 0) {
            hdr->request.opcode = PROTOCOL_BINARY_CMD_DECREMENT;
            *delta = lcb_htonll((lcb_uint64_t)(cmd->delta * -1));
        } else {
            hdr->request.opcode = PROTOCOL_BINARY_CMD_INCREMENT;
            *delta = lcb_htonll(cmd->delta);
        }

        memcpy(SPAN_BUFFER(&packet->kh_span), acmd.bytes, hsize);
        LCBTRACE_KV_START(instance->settings, cmd, LCBTRACE_OP_COUNTER, packet->opaque, rdata->span);
        TRACE_ARITHMETIC_BEGIN(instance, hdr, cmd);
        LCB_SCHED_ADD(instance, pipeline, packet);
        return LCB_SUCCESS;
    };

    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return operation(nullptr, command);
    }

    uint32_t cid = 0;
    if (collcache_get(instance, command->scope, command->nscope, command->collection, command->ncollection, &cid) ==
        LCB_SUCCESS) {
        lcb_CMDCOUNTER clone = *command; /* shallow clone */
        clone.cid = cid;
        return operation(nullptr, &clone);
    } else {
        return collcache_resolve(instance, command, operation, lcb_cmdcounter_clone, lcb_cmdcounter_destroy);
    }
}
