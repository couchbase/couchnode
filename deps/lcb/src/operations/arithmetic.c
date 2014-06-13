/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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

LIBCOUCHBASE_API
lcb_error_t
lcb_arithmetic3(
        lcb_t instance, const void *cookie, const lcb_CMDINCRDECR *cmd)
{
    mc_CMDQUEUE *q = &instance->cmdq;
    mc_PIPELINE *pipeline;
    mc_PACKET *packet;
    mc_REQDATA *rdata;
    lcb_error_t err;

    protocol_binary_request_incr acmd;
    protocol_binary_request_header *hdr = &acmd.message.header;

    err = mcreq_basic_packet(
            q, (const lcb_CMDBASE *)cmd, hdr, 20, &packet, &pipeline);

    if (err != LCB_SUCCESS) {
        return err;
    }

    rdata = &packet->u_rdata.reqdata;
    rdata->cookie = cookie;
    rdata->start = gethrtime();
    hdr->request.magic = PROTOCOL_BINARY_REQ;
    hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr->request.cas = 0;
    hdr->request.opaque = packet->opaque;
    hdr->request.bodylen =
            htonl(hdr->request.extlen + ntohs(hdr->request.keylen));

    acmd.message.body.delta = ntohll((lcb_uint64_t)cmd->delta);
    acmd.message.body.initial = ntohll(cmd->initial);
    if (!cmd->create) {
        memset(&acmd.message.body.expiration, 0xff,
               sizeof(acmd.message.body.expiration));
    } else {
        acmd.message.body.expiration = htonl(cmd->options.exptime);
    }

    if (cmd->delta < 0) {
        hdr->request.opcode = PROTOCOL_BINARY_CMD_DECREMENT;
        acmd.message.body.delta = ntohll((lcb_uint64_t)(cmd->delta * -1));
    } else {
        hdr->request.opcode = PROTOCOL_BINARY_CMD_INCREMENT;
    }

    memcpy(SPAN_BUFFER(&packet->kh_span), acmd.bytes, sizeof(acmd.bytes));
    mcreq_sched_add(pipeline, packet);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t lcb_arithmetic(lcb_t instance,
                           const void *cookie,
                           lcb_size_t num,
                           const lcb_arithmetic_cmd_t *const *items)
{
    unsigned ii;

    mcreq_sched_enter(&instance->cmdq);

    for (ii = 0; ii < num; ii++) {
        const lcb_arithmetic_cmd_t *src = items[ii];
        lcb_CMDINCRDECR dst;
        lcb_error_t err;

        memset(&dst, 0, sizeof(dst));

        dst.create = src->v.v0.create;
        dst.delta = src->v.v0.delta;
        dst.initial = src->v.v0.initial;
        dst.key.type = LCB_KV_COPY;
        dst.key.contig.bytes = src->v.v0.key;
        dst.key.contig.nbytes = src->v.v0.nkey;
        dst.hashkey.type = LCB_KV_COPY;
        dst.hashkey.contig.bytes = src->v.v0.hashkey;
        dst.hashkey.contig.nbytes = src->v.v0.nhashkey;
        dst.options.exptime = src->v.v0.exptime;
        err = lcb_arithmetic3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            mcreq_sched_fail(&instance->cmdq);
            return err;
        }
    }

    mcreq_sched_leave(&instance->cmdq, 1);
    SYNCMODE_INTERCEPT(instance)
}
