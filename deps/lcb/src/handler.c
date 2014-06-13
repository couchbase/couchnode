#include <ep-engine/command_ids.h>
#include "internal.h"
#include "packetutils.h"
#include "mc/mcreq.h"
#include "mc/compress.h"

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
        return LCB_ERROR;
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


#define SET_RESP_CAS(resp, vers, c) do { \
    (resp)->v.v##vers.cas = c; \
} while (0)

#define MK_RESPKEY(resp, ver, req) do { \
    mcreq_get_key(req, &((resp)->v.v##ver.key), &((resp)->v.v##ver.nkey)); \
} while (0);

#define MK_ERROR(root, rc, response, imm) do { \
    if (imm) { \
        rc = imm; \
    } else if (PACKET_STATUS(response) == PROTOCOL_BINARY_RESPONSE_SUCCESS) { \
        rc = LCB_SUCCESS; \
    } else { \
        rc = map_error(root, PACKET_STATUS(response)); \
    } \
}  while (0);

#define INVOKE_CALLBACK(req, cb, args) \
if (! (req->flags & MCREQ_F_INVOKED)) { \
    cb args; \
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
    const packet_info *respkt, lcb_get_resp_t *rescmd, void **freeptr)
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
                &rescmd->v.v0.bytes, &rescmd->v.v0.nbytes, freeptr);

        } else {
            /* user doesn't want inflation. signal it's compressed */
            dtype |= LCB_VALUE_F_SNAPPYCOMP;
        }
    }
    rescmd->v.v0.datatype = dtype;
}

static void
H_get(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
      lcb_error_t immerr)
{
    lcb_error_t rc;
    lcb_t o;
    lcb_get_resp_t resp;
    void *freeptr = NULL;

    o = pipeline->parent->instance;
    MK_RESPKEY(&resp, 0, request);
    MK_ERROR(o, rc, response, immerr);
    resp.version = 0;

    if (rc == LCB_SUCCESS) {
        const protocol_binary_response_getq *getq =
                PACKET_EPHEMERAL_START(response);

        resp.v.v0.cas = PACKET_CAS(response);
        resp.v.v0.datatype = PACKET_DATATYPE(response);
        resp.v.v0.flags = ntohl(getq->message.body.flags);
        resp.v.v0.bytes = PACKET_VALUE(response);
        resp.v.v0.nbytes = PACKET_NVALUE(response);
        rc = LCB_SUCCESS;
    } else {
        resp.v.v0.cas = 0;
        resp.v.v0.nbytes = 0;
        resp.v.v0.bytes = NULL;
        resp.v.v0.flags = 0;
    }

    maybe_decompress(o, response, &resp, &freeptr);
    INVOKE_CALLBACK(request, o->callbacks.get,
                    (o, MCREQ_PKT_COOKIE(request), rc, &resp));
    free(freeptr);
}

static void
H_getreplica(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
             lcb_error_t immerr)
{
    lcb_error_t rc;
    lcb_get_resp_t resp;
    lcb_t instance = pipeline->parent->instance;
    void *freeptr = NULL;

    MK_RESPKEY(&resp, 0, request);
    MK_ERROR(instance, rc, response, immerr);
    resp.version = 0;

    if (rc == LCB_SUCCESS) {
        const protocol_binary_response_get *get = PACKET_EPHEMERAL_START(response);
        resp.v.v0.cas = PACKET_CAS(response);
        resp.v.v0.datatype = PACKET_DATATYPE(response);
        resp.v.v0.flags = ntohl(get->message.body.flags);
        resp.v.v0.bytes = PACKET_VALUE(response);
        resp.v.v0.nbytes = PACKET_NVALUE(response);
    }
    maybe_decompress(instance, response, &resp, &freeptr);
    request->u_rdata.exdata->callback(pipeline, request, rc, &resp);
    free(freeptr);
}

static void
H_delete(mc_PIPELINE *pipeline, mc_PACKET *packet, packet_info *response,
         lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_error_t rc;
    lcb_remove_resp_t resp;

    resp.version = 0;
    SET_RESP_CAS(&resp, 0, PACKET_CAS(response));
    MK_RESPKEY(&resp, 0, packet);
    MK_ERROR(root, rc, response, immerr);

    INVOKE_CALLBACK(packet, root->callbacks.remove,
                    (root, MCREQ_PKT_COOKIE(packet), rc, &resp));
}

static void
H_observe(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
          lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_error_t rc;
    uint32_t ttp;
    uint32_t ttr;
    lcb_size_t pos;
    VBUCKET_CONFIG_HANDLE config;
    const char *end, *ptr;
    mc_REQDATAEX *rd = request->u_rdata.exdata;

    MK_ERROR(root, rc, response, immerr);

    if (rc != LCB_SUCCESS) {
        if (! (request->flags & MCREQ_F_INVOKED)) {
            rd->callback(pipeline, request, rc, NULL);
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
        lcb_observe_resp_t resp;

        memset(&resp, 0, sizeof(resp));

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

        resp.v.v0.key = key;
        resp.v.v0.nkey = nkey;
        resp.v.v0.cas = cas;
        resp.v.v0.status = obs;
        resp.v.v0.ttp = 0;
        resp.v.v0.ttr = 0;
        resp.v.v0.from_master = pipeline->index == vbucket_get_master(config, vb);
        if (! (request->flags & MCREQ_F_INVOKED)) {
            rd->callback(pipeline, request, rc, &resp);
        }
    }
}

static void
H_store(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_storage_t op;
    lcb_error_t rc;
    lcb_store_resp_t resp;

    MK_ERROR(root, rc, response, immerr);

    switch (PACKET_OPCODE(response)) {
    case PROTOCOL_BINARY_CMD_ADD:
        op = LCB_ADD;
        break;
    case PROTOCOL_BINARY_CMD_REPLACE:
        op = LCB_REPLACE;
        break;
    case PROTOCOL_BINARY_CMD_SET:
        op = LCB_SET;
        break;
    case PROTOCOL_BINARY_CMD_APPEND:
        op = LCB_APPEND;
        break;
    case PROTOCOL_BINARY_CMD_PREPEND:
        op = LCB_PREPEND;
        break;
    default:
        abort();
        break;
    }

    resp.version = 0;
    MK_RESPKEY(&resp, 0, request);
    SET_RESP_CAS(&resp, 0, PACKET_CAS(response));

    INVOKE_CALLBACK(request, root->callbacks.store,
                    (root, MCREQ_PKT_COOKIE(request), op, rc, &resp));
}

static void
H_arithmetic(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
             lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_error_t rc;
    lcb_arithmetic_resp_t resp;

    MK_ERROR(root, rc, response, immerr);
    if (rc == LCB_SUCCESS) {
        memcpy(&resp.v.v0.value, response->payload, sizeof(resp.v.v0.value));
        resp.v.v0.value = ntohll(resp.v.v0.value);
    }

    MK_RESPKEY(&resp, 0, request);
    SET_RESP_CAS(&resp, 0, PACKET_CAS(response));
    INVOKE_CALLBACK(request, root->callbacks.arithmetic,
                   (root, MCREQ_PKT_COOKIE(request), rc, &resp));
}

static void
H_stats(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_error_t rc;
    lcb_server_stat_resp_t resp;
    mc_REQDATAEX *exdata;

    MK_ERROR(root, rc, response, immerr);
    resp.version = 0;

    exdata = request->u_rdata.exdata;
    if (rc != LCB_SUCCESS || PACKET_NKEY(response) == 0) {
        /* Call the handler without a response, this indicates that this server
         * has finished responding */
        exdata->callback(pipeline, request, rc, NULL);
        return;
    }

    if ((resp.v.v0.nkey = PACKET_NKEY(response))) {
        resp.v.v0.key = PACKET_KEY(response);
        if ((resp.v.v0.nbytes = PACKET_NVALUE(response))) {
            resp.v.v0.bytes = PACKET_VALUE(response);
        }
    }

    exdata->callback(pipeline, request, rc, &resp);
}

static void
H_verbosity(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
            lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_error_t rc;
    mc_REQDATAEX *exdata = request->u_rdata.exdata;
    MK_ERROR(root, rc, response, immerr);

    exdata->callback(pipeline, request, rc, NULL);
}

static void
H_version(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
          lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_error_t rc;
    lcb_server_version_resp_t resp;
    mc_REQDATAEX *exdata = request->u_rdata.exdata;

    MK_ERROR(root, rc, response, immerr);

    if (PACKET_NBODY(response)) {
        resp.v.v0.vstring = response->payload;
        resp.v.v0.nvstring = PACKET_NBODY(response);
    }


    exdata->callback(pipeline, request, rc, &resp);
}

static void
H_touch(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_touch_resp_t resp;
    lcb_error_t rc;

    MK_ERROR(root, rc, response, immerr);
    MK_RESPKEY(&resp, 0, request);
    SET_RESP_CAS(&resp, 0, PACKET_CAS(response));
    resp.version = 0;
    root->callbacks.touch(root, MCREQ_PKT_RDATA(request)->cookie, rc, &resp);
}

static void
H_flush(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
        lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_error_t rc;
    lcb_flush_resp_t resp;
    mc_REQDATAEX *exdata = request->u_rdata.exdata;
    MK_ERROR(root, rc, response, immerr);
    exdata->callback(pipeline, request, rc, &resp);
}

static void
H_unlock(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
         lcb_error_t immerr)
{
    lcb_t root = pipeline->parent->instance;
    lcb_unlock_resp_t resp;
    lcb_error_t rc;

    MK_ERROR(root, rc, response, immerr);
    MK_RESPKEY(&resp, 0, request);
    root->callbacks.unlock(root, MCREQ_PKT_RDATA(request)->cookie, rc, &resp);
}

static void
H_config(mc_PIPELINE *pipeline, mc_PACKET *request, packet_info *response,
         lcb_error_t immerr)
{
    /** We just jump to the normal config handler */
    lcb_error_t rc;
    mc_REQDATAEX *exdata = request->u_rdata.exdata;
    MK_ERROR(pipeline->parent->instance, rc, response, immerr);

    exdata->callback(pipeline, request, rc, response);
}

static void
record_metrics(mc_PIPELINE *pipeline, mc_PACKET *req, packet_info *res)
{
    lcb_t instance = pipeline->parent->instance;
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
