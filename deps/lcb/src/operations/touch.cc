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

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_status(const lcb_RESPTOUCH *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_error_context(const lcb_RESPTOUCH *resp,
                                                        const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    if (resp->rflags & LCB_RESP_F_ERRINFO) {
        lcb_RESPTOUCH *mut = const_cast<lcb_RESPTOUCH *>(resp);
        mut->ctx.context = lcb_resp_get_error_context(LCB_CALLBACK_TOUCH, (const lcb_RESPBASE *)resp);
        if (mut->ctx.context) {
            mut->ctx.context_len = strlen(resp->ctx.context);
        }
        mut->ctx.ref = lcb_resp_get_error_ref(LCB_CALLBACK_TOUCH, (const lcb_RESPBASE *)resp);
        if (mut->ctx.ref) {
            mut->ctx.ref_len = strlen(resp->ctx.ref);
        }
    }
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_error_ref(const lcb_RESPTOUCH *resp, const char **ref, size_t *ref_len)
{
    if ((resp->rflags & LCB_RESP_F_ERRINFO) == 0) {
        return LCB_ERR_DOCUMENT_NOT_FOUND;
    }
    const char *val = lcb_resp_get_error_ref(LCB_CALLBACK_TOUCH, (const lcb_RESPBASE *)resp);
    if (val) {
        *ref = val;
        *ref_len = strlen(val);
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_cookie(const lcb_RESPTOUCH *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_cas(const lcb_RESPTOUCH *resp, uint64_t *cas)
{
    *cas = resp->ctx.cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_key(const lcb_RESPTOUCH *resp, const char **key, size_t *key_len)
{
    *key = (const char *)resp->ctx.key;
    *key_len = resp->ctx.key_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_resptouch_mutation_token(const lcb_RESPTOUCH *resp, lcb_MUTATION_TOKEN *token)
{
    const lcb_MUTATION_TOKEN *mt = lcb_resp_get_mutation_token(LCB_CALLBACK_TOUCH, (const lcb_RESPBASE *)resp);
    if (token && mt) {
        *token = *mt;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_create(lcb_CMDTOUCH **cmd)
{
    *cmd = (lcb_CMDTOUCH *)calloc(1, sizeof(lcb_CMDTOUCH));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_clone(const lcb_CMDTOUCH *cmd, lcb_CMDTOUCH **copy)
{
    LCB_CMD_CLONE(lcb_CMDTOUCH, cmd, copy);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_destroy(lcb_CMDTOUCH *cmd)
{
    LCB_CMD_DESTROY_CLONE(cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_timeout(lcb_CMDTOUCH *cmd, uint32_t timeout)
{
    cmd->timeout = timeout;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_parent_span(lcb_CMDTOUCH *cmd, lcbtrace_SPAN *span)
{
    cmd->pspan = span;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_collection(lcb_CMDTOUCH *cmd, const char *scope, size_t scope_len,
                                                    const char *collection, size_t collection_len)
{
    cmd->scope = scope;
    cmd->nscope = scope_len;
    cmd->collection = collection;
    cmd->ncollection = collection_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_key(lcb_CMDTOUCH *cmd, const char *key, size_t key_len)
{
    LCB_CMD_SET_KEY(cmd, key, key_len);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_expiry(lcb_CMDTOUCH *cmd, uint32_t expiration)
{
    cmd->exptime = expiration;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdtouch_durability(lcb_CMDTOUCH *cmd, lcb_DURABILITY_LEVEL level)
{
    cmd->dur_level = level;
    return LCB_SUCCESS;
}

static lcb_STATUS touch_validate(lcb_INSTANCE *instance, const lcb_CMDTOUCH *cmd)
{
    auto err = lcb_is_collection_valid(instance, cmd->scope, cmd->nscope, cmd->collection, cmd->ncollection);
    if (err != LCB_SUCCESS) {
        return err;
    }
    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (cmd->dur_level && !LCBT_SUPPORT_SYNCREPLICATION(instance)) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_touch(lcb_INSTANCE *instance, void *cookie, const lcb_CMDTOUCH *command)
{
    lcb_STATUS rc = touch_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto operation = [instance, cookie](const lcb_RESPGETCID *resp, const lcb_CMDTOUCH *cmd) {
        if (resp && resp->ctx.rc != LCB_SUCCESS) {
            lcb_RESPCALLBACK cb = lcb_find_callback(instance, LCB_CALLBACK_TOUCH);
            lcb_RESPTOUCH touch{};
            touch.ctx = resp->ctx;
            touch.ctx.key = static_cast<const char *>(cmd->key.contig.bytes);
            touch.ctx.key_len = cmd->key.contig.nbytes;
            touch.cookie = cookie;
            cb(instance, LCB_CALLBACK_TOUCH, reinterpret_cast<const lcb_RESPBASE *>(&touch));
            return resp->ctx.rc;
        }

        protocol_binary_request_touch tcmd;
        protocol_binary_request_header *hdr = &tcmd.message.header;
        int new_durability_supported = LCBT_SUPPORT_SYNCREPLICATION(instance);
        mc_PIPELINE *pl;
        mc_PACKET *pkt;
        lcb_STATUS err;
        lcb_U8 ffextlen = 0;
        size_t hsize;

        if (cmd->dur_level && new_durability_supported) {
            hdr->request.magic = PROTOCOL_BINARY_AREQ;
            ffextlen = 4;
        }

        err = mcreq_basic_packet(&instance->cmdq, (const lcb_CMDBASE *)cmd, hdr, 4, ffextlen, &pkt, &pl,
                                 MCREQ_BASICPACKET_F_FALLBACKOK);
        if (err != LCB_SUCCESS) {
            return err;
        }
        hsize = hdr->request.extlen + sizeof(*hdr) + ffextlen;

        hdr->request.magic = PROTOCOL_BINARY_REQ;
        hdr->request.opcode = PROTOCOL_BINARY_CMD_TOUCH;
        hdr->request.cas = 0;
        hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        hdr->request.opaque = pkt->opaque;
        hdr->request.bodylen = htonl(4 + ffextlen + ntohs(hdr->request.keylen));
        if (cmd->dur_level && new_durability_supported) {
            tcmd.message.body.alt.meta = (1u << 4u) | 3u;
            tcmd.message.body.alt.level = cmd->dur_level;
            tcmd.message.body.alt.timeout = lcb_durability_timeout(instance, cmd->timeout);
            tcmd.message.body.alt.expiration = htonl(cmd->exptime);
        } else {
            tcmd.message.body.norm.expiration = htonl(cmd->exptime);
        }

        memcpy(SPAN_BUFFER(&pkt->kh_span), tcmd.bytes, hsize);
        pkt->u_rdata.reqdata.cookie = cookie;
        pkt->u_rdata.reqdata.start = gethrtime();
        pkt->u_rdata.reqdata.deadline =
            pkt->u_rdata.reqdata.start - (cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));
        LCB_SCHED_ADD(instance, pl, pkt);
        LCBTRACE_KV_START(instance->settings, cmd, LCBTRACE_OP_TOUCH, pkt->opaque, pkt->u_rdata.reqdata.span);
        TRACE_TOUCH_BEGIN(instance, hdr, cmd);
        return LCB_SUCCESS;
    };

    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return operation(nullptr, command);
    }

    uint32_t cid = 0;
    if (collcache_get(instance, command->scope, command->nscope, command->collection, command->ncollection, &cid) ==
        LCB_SUCCESS) {
        lcb_CMDTOUCH clone = *command; /* shallow clone */
        clone.cid = cid;
        return operation(nullptr, &clone);
    } else {
        return collcache_resolve(instance, command, operation, lcb_cmdtouch_clone, lcb_cmdtouch_destroy);
    }
}
