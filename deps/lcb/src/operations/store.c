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
#include "mc/compress.h"
#include "trace.h"

static lcb_size_t
get_value_size(mc_PACKET *packet)
{
    if (packet->flags & MCREQ_F_VALUE_IOV) {
        return packet->u_value.multi.total_length;
    } else {
        return packet->u_value.single.size;
    }
}

static lcb_error_t
get_esize_and_opcode(
        lcb_storage_t ucmd, lcb_uint8_t *opcode, lcb_uint8_t *esize)
{
    if (ucmd == LCB_SET) {
        *opcode = PROTOCOL_BINARY_CMD_SET;
        *esize = 8;
    } else if (ucmd == LCB_ADD) {
        *opcode = PROTOCOL_BINARY_CMD_ADD;
        *esize = 8;
    } else if (ucmd == LCB_REPLACE) {
        *opcode = PROTOCOL_BINARY_CMD_REPLACE;
        *esize = 8;
    } else if (ucmd == LCB_APPEND) {
        *opcode = PROTOCOL_BINARY_CMD_APPEND;
        *esize = 0;
    } else if (ucmd == LCB_PREPEND) {
        *opcode = PROTOCOL_BINARY_CMD_PREPEND;
        *esize = 0;
    } else {
        return LCB_EINVAL;
    }
    return LCB_SUCCESS;
}


static int
can_compress(lcb_t instance, const mc_PIPELINE *pipeline,
    const lcb_CMDSTORE *cmd)
{
    mc_SERVER *server = (mc_SERVER *)pipeline;
    int compressopts = LCBT_SETTING(instance, compressopts);

    if (mcreq_compression_supported() == 0) {
        return 0;
    }

    if (cmd->value.vtype != LCB_KV_COPY) {
        return 0;
    }
    if ((compressopts & LCB_COMPRESS_OUT) == 0) {
        return 0;
    }
    if (server->compsupport == 0 && (compressopts & LCB_COMPRESS_FORCE) == 0) {
        return 0;
    }
    if (cmd->datatype & LCB_VALUE_F_SNAPPYCOMP) {
        return 0;
    }
    return 1;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_store3(lcb_t instance, const void *cookie, const lcb_CMDSTORE *cmd)
{
    mc_PIPELINE *pipeline;
    mc_PACKET *packet;
    mc_REQDATA *rdata;
    mc_CMDQUEUE *cq = &instance->cmdq;
    int hsize;
    int should_compress = 0;
    lcb_error_t err;

    protocol_binary_request_set scmd;
    protocol_binary_request_header *hdr = &scmd.message.header;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    err = get_esize_and_opcode(
            cmd->operation, &hdr->request.opcode, &hdr->request.extlen);
    if (err != LCB_SUCCESS) {
        return err;
    }

    switch (cmd->operation) {
    case LCB_APPEND:
    case LCB_PREPEND:
        if (cmd->exptime || cmd->flags) {
            return LCB_OPTIONS_CONFLICT;
        }
        break;
    case LCB_ADD:
        if (cmd->cas) {
            return LCB_OPTIONS_CONFLICT;
        }
        break;
    default:
        break;
    }

    hsize = hdr->request.extlen + sizeof(*hdr);

    err = mcreq_basic_packet(cq, (const lcb_CMDBASE *)cmd, hdr,
        hdr->request.extlen, &packet, &pipeline, MCREQ_BASICPACKET_F_FALLBACKOK);

    if (err != LCB_SUCCESS) {
        return err;
    }

    should_compress = can_compress(instance, pipeline, cmd);
    if (should_compress) {
        int rv = mcreq_compress_value(pipeline, packet, &cmd->value.u_buf.contig);
        if (rv != 0) {
            mcreq_release_packet(pipeline, packet);
            return LCB_CLIENT_ENOMEM;
        }
    } else {
        mcreq_reserve_value(pipeline, packet, &cmd->value);
    }

    rdata = &packet->u_rdata.reqdata;
    rdata->cookie = cookie;
    rdata->start = gethrtime();

    scmd.message.body.expiration = htonl(cmd->exptime);
    scmd.message.body.flags = htonl(cmd->flags);
    hdr->request.magic = PROTOCOL_BINARY_REQ;
    hdr->request.cas = cmd->cas;
    hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;

    if (should_compress || (cmd->datatype & LCB_VALUE_F_SNAPPYCOMP)) {
        hdr->request.datatype |= PROTOCOL_BINARY_DATATYPE_COMPRESSED;
    }
    if (cmd->datatype & LCB_VALUE_F_JSON) {
        hdr->request.datatype |= PROTOCOL_BINARY_DATATYPE_JSON;
    }

    hdr->request.opaque = packet->opaque;
    hdr->request.bodylen = htonl(
            hdr->request.extlen + ntohs(hdr->request.keylen)
            + get_value_size(packet));

    memcpy(SPAN_BUFFER(&packet->kh_span), scmd.bytes, hsize);
    mcreq_sched_add(pipeline, packet);
    TRACE_STORE_BEGIN(hdr, cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_store(lcb_t instance, const void *cookie, lcb_size_t num,
          const lcb_store_cmd_t * const * items)
{
    unsigned ii;
    lcb_error_t err = LCB_SUCCESS;

    lcb_sched_enter(instance);
    for (ii = 0; ii < num; ii++) {
        const lcb_store_cmd_t *src = items[ii];
        lcb_CMDSTORE dst;
        memset(&dst, 0, sizeof(dst));

        dst.key.contig.bytes = src->v.v0.key;
        dst.key.contig.nbytes = src->v.v0.nkey;
        dst._hashkey.contig.bytes = src->v.v0.hashkey;
        dst._hashkey.contig.nbytes = src->v.v0.nhashkey;
        dst.value.u_buf.contig.bytes = src->v.v0.bytes;
        dst.value.u_buf.contig.nbytes = src->v.v0.nbytes;
        dst.operation = src->v.v0.operation;
        dst.flags = src->v.v0.flags;
        dst.datatype = src->v.v0.datatype;
        dst.cas = src->v.v0.cas;
        dst.exptime = src->v.v0.exptime;
        err = lcb_store3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            lcb_sched_fail(instance);
            return err;
        }
    }
    lcb_sched_leave(instance);
    SYNCMODE_INTERCEPT(instance)
}
