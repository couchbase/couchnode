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
    if (resp->rflags & LCB_RESP_F_ERRINFO) {
        lcb_RESPEXISTS *mut = const_cast<lcb_RESPEXISTS *>(resp);
        mut->ctx.context = lcb_resp_get_error_context(LCB_CALLBACK_EXISTS, (const lcb_RESPBASE *)resp);
        if (mut->ctx.context) {
            mut->ctx.context_len = strlen(resp->ctx.context);
        }
        mut->ctx.ref = lcb_resp_get_error_ref(LCB_CALLBACK_EXISTS, (const lcb_RESPBASE *)resp);
        if (mut->ctx.ref) {
            mut->ctx.ref_len = strlen(resp->ctx.ref);
        }
    }
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
    *key = (const char *)resp->ctx.key;
    *key_len = resp->ctx.key_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respexists_mutation_token(const lcb_RESPEXISTS *resp, lcb_MUTATION_TOKEN *token)
{
    const lcb_MUTATION_TOKEN *mt = lcb_resp_get_mutation_token(LCB_CALLBACK_EXISTS, (const lcb_RESPBASE *)resp);
    if (token && mt) {
        *token = *mt;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_create(lcb_CMDEXISTS **cmd)
{
    *cmd = (lcb_CMDEXISTS *)calloc(1, sizeof(lcb_CMDEXISTS));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_clone(const lcb_CMDEXISTS *cmd, lcb_CMDEXISTS **copy)
{
    LCB_CMD_CLONE(lcb_CMDEXISTS, cmd, copy);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_destroy(lcb_CMDEXISTS *cmd)
{
    LCB_CMD_DESTROY_CLONE(cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_timeout(lcb_CMDEXISTS *cmd, uint32_t timeout)
{
    cmd->timeout = timeout;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_parent_span(lcb_CMDEXISTS *cmd, lcbtrace_SPAN *span)
{
    cmd->pspan = span;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_collection(lcb_CMDEXISTS *cmd, const char *scope, size_t scope_len,
                                                     const char *collection, size_t collection_len)
{
    cmd->scope = scope;
    cmd->nscope = scope_len;
    cmd->collection = collection;
    cmd->ncollection = collection_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdexists_key(lcb_CMDEXISTS *cmd, const char *key, size_t key_len)
{
    LCB_CMD_SET_KEY(cmd, key, key_len);
    return LCB_SUCCESS;
}

static lcb_STATUS exists_validate(lcb_INSTANCE *instance, const lcb_CMDEXISTS *cmd)
{
    auto err = lcb_is_collection_valid(instance, cmd->scope, cmd->nscope, cmd->collection, cmd->ncollection);
    if (err != LCB_SUCCESS) {
        return err;
    }
    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (!instance->cmdq.config) {
        return LCB_ERR_NO_CONFIGURATION;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_exists(lcb_INSTANCE *instance, void *cookie, const lcb_CMDEXISTS *command)
{
    lcb_STATUS rc;

    rc = exists_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto operation = [instance, cookie](const lcb_RESPGETCID *resp, const lcb_CMDEXISTS *cmd) {
        if (resp && resp->ctx.rc != LCB_SUCCESS) {
            lcb_RESPCALLBACK cb = lcb_find_callback(instance, LCB_CALLBACK_EXISTS);
            lcb_RESPEXISTS ext{};
            ext.ctx = resp->ctx;
            ext.ctx.key = static_cast<const char *>(cmd->key.contig.bytes);
            ext.ctx.key_len = cmd->key.contig.nbytes;
            ext.cookie = cookie;
            cb(instance, LCB_CALLBACK_EXISTS, reinterpret_cast<const lcb_RESPBASE *>(&ext));
            return resp->ctx.rc;
        }

        mc_CMDQUEUE *cq = &instance->cmdq;

        protocol_binary_request_header hdr;
        mc_PIPELINE *pipeline;
        mc_PACKET *pkt;
        lcb_STATUS err;
        err = mcreq_basic_packet(cq, (const lcb_CMDBASE *)cmd, &hdr, 0, 0, &pkt, &pipeline,
                                 MCREQ_BASICPACKET_F_FALLBACKOK);
        if (err != LCB_SUCCESS) {
            return err;
        }

        hdr.request.opcode = PROTOCOL_BINARY_CMD_GET_META;
        hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        hdr.request.bodylen = htonl(ntohs(hdr.request.keylen));
        hdr.request.opaque = pkt->opaque;
        hdr.request.cas = 0;

        pkt->u_rdata.reqdata.cookie = cookie;
        pkt->u_rdata.reqdata.start = gethrtime();
        pkt->u_rdata.reqdata.deadline =
            pkt->u_rdata.reqdata.start +
            LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));
        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, MCREQ_PKT_BASESIZE);

        LCB_SCHED_ADD(instance, pipeline, pkt);
        LCBTRACE_KV_START(instance->settings, cmd, LCBTRACE_OP_EXISTS, pkt->opaque, pkt->u_rdata.reqdata.span);
        TRACE_EXISTS_BEGIN(instance, &hdr, cmd);
        return LCB_SUCCESS;
    };

    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return operation(nullptr, command);
    }

    uint32_t cid = 0;
    if (collcache_get(instance, command->scope, command->nscope, command->collection, command->ncollection, &cid) ==
        LCB_SUCCESS) {
        lcb_CMDEXISTS clone = *command; /* shallow clone */
        clone.cid = cid;
        return operation(nullptr, &clone);
    } else {
        return collcache_resolve(instance, command, operation, lcb_cmdexists_clone, lcb_cmdexists_destroy);
    }
}
