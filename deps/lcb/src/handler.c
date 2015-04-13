/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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
#include "packetutils.h"
#include "mc/mcreq.h"
#include "mc/compress.h"
#include "trace.h"

LIBCOUCHBASE_API
lcb_error_t
lcb_errmap_default(lcb_t instance, lcb_uint16_t in)
{
    (void)instance;

    switch (in) {
    case PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET:
        return LCB_ETIMEDOUT;
    case PROTOCOL_BINARY_RESPONSE_AUTH_CONTINUE:
        return LCB_AUTH_CONTINUE;
    case PROTOCOL_BINARY_RESPONSE_EBUSY:
        return LCB_EBUSY;
    case PROTOCOL_BINARY_RESPONSE_ETMPFAIL:
        return LCB_ETMPFAIL;
    case PROTOCOL_BINARY_RESPONSE_EINTERNAL:
        return LCB_EINTERNAL;
    default:
        return LCB_UNKNOWN_MEMCACHED_ERROR;
    }
}

static lcb_error_t
map_error(lcb_t instance, int in)
{
    (void)instance;
    switch (in) {
    case PROTOCOL_BINARY_RESPONSE_SUCCESS:
        return LCB_SUCCESS;
    case PROTOCOL_BINARY_RESPONSE_KEY_ENOENT:
        return LCB_KEY_ENOENT;
    case PROTOCOL_BINARY_RESPONSE_E2BIG:
        return LCB_E2BIG;
    case PROTOCOL_BINARY_RESPONSE_ENOMEM:
        return LCB_ENOMEM;
    case PROTOCOL_BINARY_RESPONSE_KEY_EEXISTS:
        return LCB_KEY_EEXISTS;
    case PROTOCOL_BINARY_RESPONSE_EINVAL:
        return LCB_EINVAL;
    case PROTOCOL_BINARY_RESPONSE_NOT_STORED:
        return LCB_NOT_STORED;
    case PROTOCOL_BINARY_RESPONSE_DELTA_BADVAL:
        return LCB_DELTA_BADVAL;
    case PROTOCOL_BINARY_RESPONSE_AUTH_ERROR:
        return LCB_AUTH_ERROR;
    case PROTOCOL_BINARY_RESPONSE_ERANGE:
        return LCB_ERANGE;
    case PROTOCOL_BINARY_RESPONSE_UNKNOWN_COMMAND:
        return LCB_UNKNOWN_COMMAND;
    case PROTOCOL_BINARY_RESPONSE_NOT_SUPPORTED:
        return LCB_NOT_SUPPORTED;
    default:
        return instance->callbacks.errmap(instance, in);
    }
}

static lcb_RESPCALLBACK
find_callback(lcb_t instance, lcb_CALLBACKTYPE type)
{
    lcb_RESPCALLBACK cb = instance->callbacks.v3callbacks[type];
    if (!cb) {
        cb = lcb_find_callback(instance, type);
    }
    return cb;
}


/**
 * This file contains the mapping of various protocol response codes for
 * a given command. Each handler receives the following parameters:
 *
 * @param pipeline the pipeline (or "Server") upon which the request was sent
 * (and response was received)
 *
 * @param request the original request (including associated data). The request
 *  may be used to determine additional information about it, such as the
 *  user-defined "Cookie", number of related requests remaining, and more.
 *
 * @param response the response which was received. This is an opaque
 *  representation of a memcached response packet
 *
 * @param immerr in the case of an abnormal failure (i.e. network failure) the
 *  handler will be invoked with this callback set to a non-success value. The
 *  'info' structure will still contain a valid (albeit empty and cryptic)
 *  header. If the user depends on special data being found in the payload then
 *  the handler must check that this variable is set to LCB_SUCCESS before
 *  continuing. Also note that a negative reply may also be present within
 *  the response itself; however this is not the purpose of this parameter.
 *
 * @return request status
 *  The return value should indicate whether outstanding responses remain
 *  to be received for this request, or if this request is deemed to be
 *  satisfied.
 */

#define MK_ERROR(root, resp, response, imm) do { \
    if (imm) { \
        (resp)->rc = imm; \
        (resp)->rflags |= LCB_RESP_F_CLIENTGEN; \
    } else if (PACKET_STATUS(response) == PROTOCOL_BINARY_RESPONSE_SUCCESS) { \
        (resp)->rc = LCB_SUCCESS; \
    } else { \
        (resp)->rc = map_error(root, PACKET_STATUS(response)); \
    } \
}  while (0);

static void
init_resp3(lcb_t instance, const packet_info *mc_resp, const mc_PACKET *req,
    lcb_error_t immerr, lcb_RESPBASE *resp)
{
    MK_ERROR(instance, resp, mc_resp, immerr);
    resp->cas = PACKET_CAS(mc_resp);
    resp->cookie = (void *)MCREQ_PKT_COOKIE(req);
    mcreq_get_key(req, &resp->key, &resp->nkey);
}

/**
 * Handles the propagation and population of the 'synctoken' information.
 * @param mc_resp The response packet
 * @param req The request packet (used to get the vBucket)
 * @param tgt Pointer to synctoken which should be populated.
 */
static void
handle_synctoken(lcb_t instance, const packet_info *mc_resp,
    const mc_PACKET *req, lcb_SYNCTOKEN *stok)
{
    const char *sbuf;
    uint16_t vbid;

    if (PACKET_EXTLEN(mc_resp) == 0) {
        return; /* No extras */
    }

    if (!instance->dcpinfo && LCBT_SETTING(instance, dur_synctokens)) {
        size_t nvb = LCBT_VBCONFIG(instance)->nvb;
        if (nvb) {
            instance->dcpinfo = calloc(nvb, sizeof(*instance->dcpinfo));
        }
    }

    sbuf = PACKET_BODY(mc_resp);
    vbid = mcreq_get_vbucket(req);
    stok->vbid_ = vbid;
    memcpy(&stok->uuid_, sbuf, 8);
    memcpy(&stok->seqno_, sbuf + 8, 8);

    stok->uuid_ = lcb_ntohll(stok->uuid_);
    stok->seqno_ = lcb_ntohll(stok->seqno_);

    if (instance->dcpinfo) {
        instance->dcpinfo[vbid] = *stok;
    }
}

#define MK_RESPKEY3(resp, req) do { \
    mcreq_get_key(req, &(resp)->key, &(resp)->nkey); \
} while (0);


static void
invoke_callback3(const mc_PACKET *pkt,
    lcb_t instance,lcb_CALLBACKTYPE cbtype, lcb_RESPBASE * resp)
{
    if (!(pkt->flags & MCREQ_F_INVOKED)) {
        resp->cookie = (void *)MCREQ_PKT_COOKIE(pkt);
        if ((pkt->flags & MCREQ_F_PRIVCALLBACK) == 0) {
            find_callback(instance, cbtype)(instance, cbtype, resp);
        } else {
            (*(lcb_RESPCALLBACK*)resp->cookie)(instance, cbtype, resp);
        }
    }
}
#define INVOKE_CALLBACK3(req, res_, instance, type) { \
    invoke_callback3(req, instance, type, (lcb_RESPBASE *)res_); \
}

/**
 * Optionally decompress an incoming payload.
 * @param o The instance
 * @param resp The response received
 * @param[out] bytes pointer to the final payload
 * @param[out] nbytes pointer to the size of the final payload
 * @param[out] freeptr pointer to free. This should be initialized to `NULL`.
 * If temporary dynamic storage is required this will be set to the allocated
 * pointer upon return. Otherwise it will be set to NULL. In any case it must
 */
static void
maybe_decompress(lcb_t o,
    const packet_info *respkt, lcb_RESPGET *rescmd, void **freeptr)
{
    lcb_U8 dtype = 0;
    if (!PACKET_NVALUE(respkt)) {
        return;
    }

    if (PACKET_DATATYPE(respkt) & PROTOCOL_BINARY_DATATYPE_JSON) {
        dtype = LCB_VALUE_F_JSON;
    }

    if (PACKET_DATATYPE(respkt) & PROTOCOL_BINARY_DATATYPE_COMPRESSED) {
        if (LCBT_SETTING(o, compressopts) & LCB_COMPRESS_IN) {
            /* if we inflate, we don't set the flag */
            mcreq_inflate_value(
                PACKET_VALUE(respkt), PACKET_NVALUE(respkt),
                &rescmd->value, &rescmd->nvalue, freeptr);

        } else {
            /* user doesn't want inflation. signal it's compressed */
            dtype |= LCB_VALUE_F_SNAPPYCOMP;
        }
    }
    rescmd->datatype = dtype;
}

static void
H_get(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
      lcb_error_t immerr)
{
    lcb_t o;
    lcb_RESPGET resp = { 0 };
    void *freeptr = NULL;

    o = pipeline->parent->cqdata;
    init_resp3(o, response, request, immerr, (lcb_RESPBASE *)&resp);

    if (resp.rc == LCB_SUCCESS) {
        const protocol_binary_response_getq *getq =
                PACKET_EPHEMERAL_START(response);
        resp.datatype = PACKET_DATATYPE(response);
        resp.itmflags = ntohl(getq->message.body.flags);
        resp.value = PACKET_VALUE(response);
        resp.nvalue = PACKET_NVALUE(response);
        resp.bufh = response->bufh;
    }

    maybe_decompress(o, response, &resp, &freeptr);
    TRACE_GET_END(response, &resp);
    INVOKE_CALLBACK3(request, &resp, o, LCB_CALLBACK_GET);
    free(freeptr);
}

static void
H_getreplica(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
             lcb_error_t immerr)
{
    lcb_RESPGET resp = { 0 };
    lcb_t instance = pipeline->parent->cqdata;
    void *freeptr = NULL;
    mc_REQDATAEX *rd = request->u_rdata.exdata;

    init_resp3(instance, response, request, immerr, (lcb_RESPBASE *)&resp);

    if (resp.rc == LCB_SUCCESS) {
        const protocol_binary_response_get *get = PACKET_EPHEMERAL_START(response);
        resp.itmflags = ntohl(get->message.body.flags);
        resp.datatype = PACKET_DATATYPE(response);
        resp.value = PACKET_VALUE(response);
        resp.nvalue = PACKET_NVALUE(response);
        resp.bufh = response->bufh;
    }

    maybe_decompress(instance, response, &resp, &freeptr);
    rd->procs->handler(pipeline, request, resp.rc, &resp);
    free(freeptr);
}

static void
H_delete(mc_PIPELINE *pipeline, mc_PACKET *packet, packet_info *response,
         lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPREMOVE resp = { 0 };
    init_resp3(root, response, packet, immerr, (lcb_RESPBASE *)&resp);
    handle_synctoken(root, response, packet, &resp.synctoken);
    TRACE_REMOVE_END(response, &resp);
    INVOKE_CALLBACK3(packet, &resp, root, LCB_CALLBACK_REMOVE);
}

static void
H_observe(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
          lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    uint32_t ttp;
    uint32_t ttr;
    lcb_size_t pos;
    lcbvb_CONFIG* config;
    const char *end, *ptr;
    mc_REQDATAEX *rd = request->u_rdata.exdata;
    lcb_RESPOBSERVE resp = { 0 };
    MK_ERROR(root, &resp, response, immerr);

    if (resp.rc != LCB_SUCCESS) {
        if (! (request->flags & MCREQ_F_INVOKED)) {
            rd->procs->handler(pipeline, request, resp.rc, NULL);
        }
        return;
    }

    /** The CAS field is split into TTP/TTR values */
    ptr = (char *)&response->res.response.cas;
    memcpy(&ttp, ptr, sizeof(ttp));
    memcpy(&ttr, ptr + sizeof(ttp), sizeof(ttp));

    ttp = ntohl(ttp);
    ttr = ntohl(ttr);

    /** Actual payload sequence of (vb, nkey, key). Repeats multiple times */
    ptr = response->payload;
    end = (char *)ptr + PACKET_NBODY(response);
    config = pipeline->parent->config;

    for (pos = 0; ptr < end; pos++) {
        lcb_cas_t cas;
        lcb_uint8_t obs;
        lcb_uint16_t nkey, vb;
        const char *key;

        memcpy(&vb, ptr, sizeof(vb));
        vb = ntohs(vb);
        ptr += sizeof(vb);
        memcpy(&nkey, ptr, sizeof(nkey));
        nkey = ntohs(nkey);
        ptr += sizeof(nkey);
        key = (const char *)ptr;
        ptr += nkey;
        obs = *((lcb_uint8_t *)ptr);
        ptr += sizeof(obs);
        memcpy(&cas, ptr, sizeof(cas));
        ptr += sizeof(cas);

        resp.key = key;
        resp.nkey = nkey;
        resp.cas = cas;
        resp.status = obs;
        resp.ismaster = pipeline->index == lcbvb_vbmaster(config, vb);
        resp.ttp = 0;
        resp.ttr = 0;
        TRACE_OBSERVE_PROGRESS(response, &resp);
        if (! (request->flags & MCREQ_F_INVOKED)) {
            rd->procs->handler(pipeline, request, resp.rc, &resp);
        }
    }
    TRACE_OBSERVE_END(response);
}

static void
H_observe_seqno(mc_PIPELINE *pipeline, mc_PACKET *request,
    packet_info *response, lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPOBSEQNO resp = { 0 };
    init_resp3(root, response, request, immerr, (lcb_RESPBASE*)&resp);

    resp.server_index = pipeline->index;

    if (resp.rc == LCB_SUCCESS) {
        const lcb_U8 *data = PACKET_BODY(response);
        int is_failover = *data != 0;

        data++;
        #define COPY_ADV(dstfld, n, conv_fn) \
                memcpy(&resp.dstfld, data, n); \
                data += n; \
                resp.dstfld = conv_fn(resp.dstfld);

        COPY_ADV(vbid, 2, ntohs);
        COPY_ADV(cur_uuid, 8, lcb_ntohll);
        COPY_ADV(persisted_seqno, 8, lcb_ntohll);
        COPY_ADV(mem_seqno, 8, lcb_ntohll);
        if (is_failover) {
            COPY_ADV(old_uuid, 8, lcb_ntohll);
            COPY_ADV(old_seqno, 8, lcb_ntohll);
        }
        #undef COPY_ADV

        /* Get the server for this command. Note that since this is a successful
         * operation, the server is never a dummy */
    }
    INVOKE_CALLBACK3(request, &resp, root, LCB_CALLBACK_OBSEQNO);
}

static void
H_store(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPSTORE resp = { 0 };
    lcb_U8 opcode;
    init_resp3(root, response, request, immerr, (lcb_RESPBASE*)&resp);
    if (!immerr) {
        opcode = PACKET_OPCODE(response);
    } else {
        protocol_binary_request_header hdr;
        mcreq_read_hdr(request, &hdr);
        opcode = hdr.request.opcode;
    }
    if (opcode == PROTOCOL_BINARY_CMD_ADD) {
        resp.op = LCB_ADD;
    } else if (opcode == PROTOCOL_BINARY_CMD_REPLACE) {
        resp.op = LCB_REPLACE;
    } else if (opcode == PROTOCOL_BINARY_CMD_APPEND) {
        resp.op = LCB_APPEND;
    } else if (opcode == PROTOCOL_BINARY_CMD_PREPEND) {
        resp.op = LCB_PREPEND;
    } else if (opcode == PROTOCOL_BINARY_CMD_SET) {
        resp.op = LCB_SET;
    }
    handle_synctoken(root, response, request, &resp.synctoken);
    TRACE_STORE_END(response, &resp);
    INVOKE_CALLBACK3(request, &resp, root, LCB_CALLBACK_STORE);
}

static void
H_arithmetic(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
             lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPCOUNTER resp = { 0 };
    init_resp3(root, response, request, immerr, (lcb_RESPBASE*)&resp);

    if (resp.rc == LCB_SUCCESS) {
        memcpy(&resp.value, PACKET_VALUE(response), sizeof(resp.value));
        resp.value = lcb_ntohll(resp.value);
        handle_synctoken(root, response, request, &resp.synctoken);
    }
    resp.cas = PACKET_CAS(response);
    TRACE_ARITHMETIC_END(response, &resp);
    INVOKE_CALLBACK3(request, &resp, root, LCB_CALLBACK_COUNTER);
}

static void
H_stats(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPSTATS resp = { 0 };
    mc_REQDATAEX *exdata;

    MK_ERROR(root, &resp, response, immerr);
    resp.version = 0;

    exdata = request->u_rdata.exdata;
    if (resp.rc != LCB_SUCCESS || PACKET_NKEY(response) == 0) {
        /* Call the handler without a response, this indicates that this server
         * has finished responding */
        exdata->procs->handler(pipeline, request, resp.rc, NULL);
        return;
    }

    if ((resp.nkey = PACKET_NKEY(response))) {
        resp.key = PACKET_KEY(response);
        if ((resp.value = PACKET_VALUE(response))) {
            resp.nvalue = PACKET_NVALUE(response);
        }
    }

    exdata->procs->handler(pipeline, request, resp.rc, &resp);
}

static void
H_verbosity(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
            lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPBASE dummy = { 0 };
    mc_REQDATAEX *exdata = request->u_rdata.exdata;
    MK_ERROR(root, &dummy, response, immerr);

    exdata->procs->handler(pipeline, request, dummy.rc, NULL);
}

static void
H_version(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
          lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPMCVERSION resp = { 0 };
    mc_REQDATAEX *exdata = request->u_rdata.exdata;

    MK_ERROR(root, &resp, response, immerr);

    if (PACKET_NBODY(response)) {
        resp.mcversion = response->payload;
        resp.nversion = PACKET_NBODY(response);
    }


    exdata->procs->handler(pipeline, request, resp.rc, &resp);
}

static void
H_touch(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPTOUCH resp = { 0 };

    init_resp3(root, response, request, immerr, &resp);
    TRACE_TOUCH_END(response, &resp);
    INVOKE_CALLBACK3(request, &resp, root, LCB_CALLBACK_TOUCH);
}

static void
H_flush(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPFLUSH resp = { 0 };
    mc_REQDATAEX *exdata = request->u_rdata.exdata;
    MK_ERROR(root, &resp, response, immerr);
    exdata->procs->handler(pipeline, request, resp.rc, &resp);
}

static void
H_unlock(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
         lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->cqdata;
    lcb_RESPUNLOCK resp = { 0 };
    init_resp3(root, response, request, immerr, &resp);
    TRACE_UNLOCK_END(response, &resp);
    INVOKE_CALLBACK3(request, &resp, root, LCB_CALLBACK_UNLOCK);
}

static void
H_config(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
         lcb_error_t immerr)
{
    /** We just jump to the normal config handler */
    lcb_RESPBASE dummy;
    mc_REQDATAEX *exdata = request->u_rdata.exdata;
    MK_ERROR(pipeline->parent->cqdata, &dummy, response, immerr);

    exdata->procs->handler(pipeline, request, dummy.rc, response);
}

static void
record_metrics(mc_PIPELINE *pipeline, mc_PACKET *req, packet_info *res)
{
    lcb_t instance = pipeline->parent->cqdata;
    if (instance->histogram) {
        lcb_record_metrics(
                instance, gethrtime() - MCREQ_PKT_RDATA(req)->start,
                PACKET_OPCODE(res));
    }
}

static void
dispatch_ufwd_error(mc_PIPELINE *pipeline, mc_PACKET *req, lcb_error_t immerr)
{
    lcb_PKTFWDRESP resp = { 0 };
    lcb_t instance = ((mc_SERVER*)pipeline)->instance;
    assert(immerr != LCB_SUCCESS);
    resp.version = 0;
    instance->callbacks.pktfwd(instance, MCREQ_PKT_COOKIE(req), immerr, &resp);
}

int
mcreq_dispatch_response(
        mc_PIPELINE *pipeline, mc_PACKET *req, packet_info *res,
        lcb_error_t immerr)
{
    record_metrics(pipeline, req, res);

    if (req->flags & MCREQ_F_UFWD) {
        dispatch_ufwd_error(pipeline, req, immerr);
        return 0;
    }


#define INVOKE_OP(handler) \
    handler(pipeline, req, res, immerr); \
    return 0; \
    break;

    switch (PACKET_OPCODE(res)) {
    case PROTOCOL_BINARY_CMD_GETQ:
    case PROTOCOL_BINARY_CMD_GATQ:
    case PROTOCOL_BINARY_CMD_GET:
    case PROTOCOL_BINARY_CMD_GAT:
    case PROTOCOL_BINARY_CMD_GET_LOCKED:
        INVOKE_OP(H_get);

    case PROTOCOL_BINARY_CMD_ADD:
    case PROTOCOL_BINARY_CMD_REPLACE:
    case PROTOCOL_BINARY_CMD_SET:
    case PROTOCOL_BINARY_CMD_APPEND:
    case PROTOCOL_BINARY_CMD_PREPEND:
        INVOKE_OP(H_store);

    case PROTOCOL_BINARY_CMD_INCREMENT:
    case PROTOCOL_BINARY_CMD_DECREMENT:
        INVOKE_OP(H_arithmetic);

    case PROTOCOL_BINARY_CMD_OBSERVE:
        INVOKE_OP(H_observe);

    case PROTOCOL_BINARY_CMD_GET_REPLICA:
        INVOKE_OP(H_getreplica);

    case PROTOCOL_BINARY_CMD_UNLOCK_KEY:
        INVOKE_OP(H_unlock);

    case PROTOCOL_BINARY_CMD_DELETE:
        INVOKE_OP(H_delete);

    case PROTOCOL_BINARY_CMD_TOUCH:
        INVOKE_OP(H_touch);

    case PROTOCOL_BINARY_CMD_OBSERVE_SEQNO:
        INVOKE_OP(H_observe_seqno);

    case PROTOCOL_BINARY_CMD_STAT:
        INVOKE_OP(H_stats);

    case PROTOCOL_BINARY_CMD_FLUSH:
        INVOKE_OP(H_flush);

    case PROTOCOL_BINARY_CMD_VERSION:
        INVOKE_OP(H_version);

    case PROTOCOL_BINARY_CMD_VERBOSITY:
        INVOKE_OP(H_verbosity);

#if 0
    case PROTOCOL_BINARY_CMD_NOOP:
        INVOKE_OP(H_noop);
#endif

    case PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG:
        INVOKE_OP(H_config);

    default:
        return -1;
    }
}
