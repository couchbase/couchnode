/*
 *     Copyright 2015 Couchbase, Inc.
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

lcb_error_t
lcb_observe_seqno3(lcb_t instance, const void *cookie, const lcb_CMDOBSEQNO *cmd)
{
    mc_PACKET *pkt;
    mc_SERVER *server;
    mc_PIPELINE *pl;
    protocol_binary_request_header hdr;
    lcb_U64 uuid;

    if (cmd->server_index > LCBT_NSERVERS(instance)) {
        return LCB_EINVAL;
    }

    server = LCBT_GET_SERVER(instance, cmd->server_index);
    pl = &server->pipeline;
    pkt = mcreq_allocate_packet(pl);
    mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);
    mcreq_reserve_value2(pl, pkt, 8);

    /* Set the static fields */
    MCREQ_PKT_RDATA(pkt)->cookie = cookie;
    MCREQ_PKT_RDATA(pkt)->start = gethrtime();
    if (cmd->cmdflags & LCB_CMD_F_INTERNAL_CALLBACK) {
        pkt->flags |= MCREQ_F_PRIVCALLBACK;
    }

    memset(&hdr, 0, sizeof hdr);
    hdr.request.opaque = pkt->opaque;
    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.opcode = PROTOCOL_BINARY_CMD_OBSERVE_SEQNO;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.bodylen = htonl((lcb_U32)8);
    hdr.request.vbucket = htons(cmd->vbid);
    memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof hdr.bytes);

    uuid = lcb_htonll(cmd->uuid);
    memcpy(SPAN_BUFFER(&pkt->u_value.single), &uuid, sizeof uuid);
    mcreq_sched_add(pl, pkt);
    return LCB_SUCCESS;
}

const lcb_SYNCTOKEN *
lcb_resp_get_synctoken(int cbtype, const lcb_RESPBASE *rb)
{
    const lcb_SYNCTOKEN *ss = NULL;
    if (cbtype == LCB_CALLBACK_STORE) {
        ss = &((const lcb_RESPSTORE*)rb)->synctoken;
    } else if (cbtype == LCB_CALLBACK_COUNTER) {
        ss = &((const lcb_RESPCOUNTER*)rb)->synctoken;
    } else if (cbtype == LCB_CALLBACK_REMOVE) {
        ss = &((const lcb_RESPREMOVE*)rb)->synctoken;
    } else {
        return NULL;
    }
    if (ss->uuid_ == 0 && ss->seqno_ == 0) {
        return NULL;
    }
    return ss;
}

const lcb_SYNCTOKEN *
lcb_get_synctoken(lcb_t instance, const lcb_KEYBUF *kb, lcb_error_t *errp)
{
    int vbix, srvix;
    lcb_error_t err_s;
    const lcb_SYNCTOKEN *existing;

    if (!errp) {
        errp = &err_s;
    }

    if (!LCBT_VBCONFIG(instance)) {
        *errp = LCB_CLIENT_ETMPFAIL;
        return NULL;
    }
    if (LCBT_VBCONFIG(instance)->dtype != LCBVB_DIST_VBUCKET) {
        *errp = LCB_NOT_SUPPORTED;
        return NULL;
    }
    if (!LCBT_SETTING(instance, fetch_synctokens)) {
        *errp = LCB_NOT_SUPPORTED;
        return NULL;
    }

    if (!instance->dcpinfo) {
        *errp = LCB_DURABILITY_NO_SYNCTOKEN;
        return NULL;
    }

    mcreq_map_key(&instance->cmdq, kb, kb, 0, &vbix, &srvix);
    existing = instance->dcpinfo + vbix;
    if (existing->uuid_ == 0 && existing->seqno_ == 0) {
        *errp = LCB_DURABILITY_NO_SYNCTOKEN;
        return NULL;
    }
    *errp = LCB_SUCCESS;
    return existing;
}
