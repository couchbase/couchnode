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
#include "trace.h"

LIBCOUCHBASE_API
lcb_error_t
lcb_touch3(lcb_t instance, const void *cookie, const lcb_CMDTOUCH *cmd)
{
    protocol_binary_request_touch tcmd;
    protocol_binary_request_header *hdr = &tcmd.message.header;
    mc_PIPELINE *pl;
    mc_PACKET *pkt;
    lcb_error_t err;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    err = mcreq_basic_packet(&instance->cmdq, cmd, hdr, 4, &pkt, &pl,
        MCREQ_BASICPACKET_F_FALLBACKOK);
    if (err != LCB_SUCCESS) {
        return err;
    }

    hdr->request.magic = PROTOCOL_BINARY_REQ;
    hdr->request.opcode = PROTOCOL_BINARY_CMD_TOUCH;
    hdr->request.cas = 0;
    hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr->request.opaque = pkt->opaque;
    hdr->request.bodylen = htonl(4 + ntohs(hdr->request.keylen));
    tcmd.message.body.expiration = htonl(cmd->exptime);
    memcpy(SPAN_BUFFER(&pkt->kh_span), tcmd.bytes, sizeof(tcmd.bytes));
    pkt->u_rdata.reqdata.cookie = cookie;
    pkt->u_rdata.reqdata.start = gethrtime();
    LCB_SCHED_ADD(instance, pl, pkt);
    LCBTRACE_KV_START(instance->settings, cmd, pkt->opaque, pkt->u_rdata.reqdata.span);
    TRACE_TOUCH_BEGIN(instance, hdr, cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_touch(lcb_t instance, const void *cookie, lcb_size_t num,
          const lcb_touch_cmd_t * const * items)
{
    unsigned ii;

    lcb_sched_enter(instance);
    for (ii = 0; ii < num; ii++) {
        const lcb_touch_cmd_t *src = items[ii];
        lcb_CMDTOUCH dst;
        lcb_error_t err;

        memset(&dst, 0, sizeof(dst));
        dst.key.contig.bytes = src->v.v0.key;
        dst.key.contig.nbytes = src->v.v0.nkey;
        dst._hashkey.contig.bytes = src->v.v0.hashkey;
        dst._hashkey.contig.nbytes = src->v.v0.nhashkey;
        dst.exptime = src->v.v0.exptime;
        err = lcb_touch3(instance, cookie, &dst);
        if (err != LCB_SUCCESS) {
            lcb_sched_fail(instance);
            return err;
        }
    }
    lcb_sched_leave(instance);
    SYNCMODE_INTERCEPT(instance)
}
