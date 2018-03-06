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
#include "durability_internal.h"

struct DurStoreCtx : mc_REQDATAEX {
    lcb_t instance;
    lcb_U16 persist_to;
    lcb_U16 replicate_to;

    static mc_REQDATAPROCS proctable;

    DurStoreCtx(lcb_t instance_, lcb_U16 persist_, lcb_U16 replicate_,
                const void *cookie_)
        : mc_REQDATAEX(cookie_, proctable, gethrtime()),
          instance(instance_), persist_to(persist_), replicate_to(replicate_) {
    }
};

/** Observe stuff */
static void
handle_dur_storecb(mc_PIPELINE *, mc_PACKET *pkt,
    lcb_error_t err, const void *arg)
{
    lcb_RESPCALLBACK cb;
    lcb_RESPSTOREDUR resp = { 0 };
    lcb_CMDENDURE dcmd = { 0 };
    const lcb_MUTATION_TOKEN *mt;
    DurStoreCtx *dctx = static_cast<DurStoreCtx*>(pkt->u_rdata.exdata);
    lcb_MULTICMD_CTX *mctx;
    lcb_durability_opts_t opts = { 0 };
    const lcb_RESPSTORE *sresp = (const lcb_RESPSTORE *)arg;

    if (err != LCB_SUCCESS) {
        goto GT_BAIL;
    }
    if (sresp->rc != LCB_SUCCESS) {
        err = sresp->rc;
        goto GT_BAIL;
    }

    resp.store_ok = 1;
    LCB_CMD_SET_KEY(&dcmd, sresp->key, sresp->nkey);
    dcmd.cas = sresp->cas;

    mt = lcb_resp_get_mutation_token(LCB_CALLBACK_STORE, (const lcb_RESPBASE*)sresp);
    if (LCB_MUTATION_TOKEN_ISVALID(mt)) {
        dcmd.mutation_token = mt;
    }

    /* Set the options.. */
    opts.v.v0.persist_to = dctx->persist_to;
    opts.v.v0.replicate_to = dctx->replicate_to;

    mctx = lcb_endure3_ctxnew(dctx->instance, &opts, &err);
    if (mctx == NULL) {
        goto GT_BAIL;
    }

    lcbdurctx_set_durstore(mctx, 1);
    err = mctx->addcmd(mctx, (lcb_CMDBASE*)&dcmd);
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

    GT_BAIL:
    {
        lcb_RESPENDURE dresp = { 0 };
        resp.key = sresp->key;
        resp.nkey = sresp->nkey;
        resp.cookie = sresp->cookie;
        resp.rc = err;
        resp.dur_resp = &dresp;
        cb = lcb_find_callback(dctx->instance, LCB_CALLBACK_STOREDUR);
        cb(dctx->instance, LCB_CALLBACK_STOREDUR, (const lcb_RESPBASE*)&resp);
        delete dctx;
    }
}

static void handle_dur_schedfail(mc_PACKET *pkt) {
    delete static_cast<DurStoreCtx*>(pkt->u_rdata.exdata);
}

mc_REQDATAPROCS DurStoreCtx::proctable = {
        handle_dur_storecb,
        handle_dur_schedfail
};

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
    if (ucmd == LCB_SET || ucmd == LCB_UPSERT) {
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
can_compress(lcb_t instance, const mc_PIPELINE *pipeline, lcb_datatype_t datatype)
{
    const lcb::Server *server = static_cast<const lcb::Server*>(pipeline);
    int compressopts = LCBT_SETTING(instance, compressopts);

    if ((compressopts & LCB_COMPRESS_OUT) == 0) {
        return 0;
    }
    if (server->supports_compression() == false &&
            (compressopts & LCB_COMPRESS_FORCE) == 0) {
        return 0;
    }
    if (datatype & LCB_VALUE_F_SNAPPYCOMP) {
        return 0;
    }
    return 1;
}

static lcb_error_t
do_store3(lcb_t instance, const void *cookie,
    const lcb_CMDBASE *cmd, int is_durstore)
{
    mc_PIPELINE *pipeline;
    mc_PACKET *packet;
    mc_CMDQUEUE *cq = &instance->cmdq;
    int hsize;
    int should_compress = 0;
    lcb_error_t err;

    lcb_storage_t operation;
    lcb_U32 flags;
    const lcb_VALBUF *vbuf;
    lcb_datatype_t datatype;

    protocol_binary_request_set scmd;
    protocol_binary_request_header *hdr = &scmd.message.header;

    if (!is_durstore) {
        const lcb_CMDSTORE *simple_cmd = (const lcb_CMDSTORE *)cmd;
        operation = simple_cmd->operation;
        flags = simple_cmd->flags;
        vbuf = &simple_cmd->value;
        datatype = simple_cmd->datatype;
    } else {
        const lcb_CMDSTOREDUR *durcmd = (const lcb_CMDSTOREDUR *)cmd;
        operation = durcmd->operation;
        flags = durcmd->flags;
        vbuf = &durcmd->value;
        datatype = durcmd->datatype;
    }

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    err = get_esize_and_opcode(
        operation, &hdr->request.opcode, &hdr->request.extlen);
    if (err != LCB_SUCCESS) {
        return err;
    }

    switch (operation) {
    case LCB_APPEND:
    case LCB_PREPEND:
        if (cmd->exptime || flags) {
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

    should_compress = can_compress(instance, pipeline, datatype);
    if (should_compress) {
        int rv = mcreq_compress_value(pipeline, packet, vbuf);
        if (rv != 0) {
            mcreq_release_packet(pipeline, packet);
            return LCB_CLIENT_ENOMEM;
        }
    } else {
        mcreq_reserve_value(pipeline, packet, vbuf);
    }

    if (is_durstore) {
        int duropts = 0;
        lcb_U16 persist_u , replicate_u;
        const lcb_CMDSTOREDUR *dcmd = (const lcb_CMDSTOREDUR *)cmd;
        persist_u = dcmd->persist_to;
        replicate_u = dcmd->replicate_to;
        if (dcmd->replicate_to == (char)-1 || dcmd->persist_to == (char)-1) {
            duropts = LCB_DURABILITY_VALIDATE_CAPMAX;
        }

        err = lcb_durability_validate(instance, &persist_u, &replicate_u, duropts);
        if (err != LCB_SUCCESS) {
            mcreq_wipe_packet(pipeline, packet);
            mcreq_release_packet(pipeline, packet);
            return err;
        }

        DurStoreCtx *dctx = new DurStoreCtx(instance, persist_u, replicate_u,
                                            cookie);
        packet->u_rdata.exdata = dctx;
        packet->flags |= MCREQ_F_REQEXT;
    } else {
        mc_REQDATA *rdata = MCREQ_PKT_RDATA(packet);
        rdata->cookie = cookie;
        rdata->start = gethrtime();
    }

    scmd.message.body.expiration = htonl(cmd->exptime);
    scmd.message.body.flags = htonl(flags);
    hdr->request.magic = PROTOCOL_BINARY_REQ;
    hdr->request.cas = lcb_htonll(cmd->cas);
    hdr->request.datatype = PROTOCOL_BINARY_RAW_BYTES;

    if (should_compress || (datatype & LCB_VALUE_F_SNAPPYCOMP)) {
        hdr->request.datatype |= PROTOCOL_BINARY_DATATYPE_COMPRESSED;
    }
    if (datatype & LCB_VALUE_F_JSON) {
        hdr->request.datatype |= PROTOCOL_BINARY_DATATYPE_JSON;
    }

    hdr->request.opaque = packet->opaque;
    hdr->request.bodylen = htonl(
            hdr->request.extlen + ntohs(hdr->request.keylen)
            + get_value_size(packet));

    memcpy(SPAN_BUFFER(&packet->kh_span), scmd.bytes, hsize);
    LCB_SCHED_ADD(instance, pipeline, packet);
    LCBTRACE_KV_START(instance->settings, cmd, packet->opaque, MCREQ_PKT_RDATA(packet)->span);
    TRACE_STORE_BEGIN(instance, hdr, (lcb_CMDSTORE *)cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_store3(lcb_t instance, const void *cookie, const lcb_CMDSTORE *cmd)
{
    return do_store3(instance, cookie, (const lcb_CMDBASE*)cmd, 0);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_storedur3(lcb_t instance, const void *cookie, const lcb_CMDSTOREDUR *cmd)
{
    return do_store3(instance, cookie, (const lcb_CMDBASE*)cmd, 1);
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
