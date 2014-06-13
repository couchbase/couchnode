#include "internal.h"
#include <bucketconfig/clconfig.h>
LCB_INTERNAL_API
lcb_server_t *
lcb_find_server_by_host(lcb_t instance, const lcb_host_t *host)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    unsigned ii;
    for (ii = 0; ii < cq->npipelines; ii++) {
        lcb_server_t *server = (lcb_server_t *)cq->pipelines[ii];
        if (lcb_host_equals(server->curhost, host)) {
            return server;
        }
    }
    return NULL;
}

LCB_INTERNAL_API
lcb_server_t *
lcb_find_server_by_index(lcb_t instance, int ix)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    if (ix < 0 || ix >= (int)cq->npipelines) {
        return NULL;
    }
    return (lcb_server_t *)cq->pipelines[ix];
}

static void
ext_callback_proxy(mc_PIPELINE *pl, mc_PACKET *req, lcb_error_t rc,
                   const void  *resdata)
{
    mc_SERVER *server = (mc_SERVER *)pl;
    mc_REQDATAEX *rd = req->u_rdata.exdata;
    const packet_info *res = resdata;

    lcb_cccp_update2(rd->cookie, rc, res->payload, PACKET_NBODY(res),
                     server->curhost);
    free(rd);
}

LCB_INTERNAL_API
lcb_error_t
lcb_getconfig(lcb_t instance, const void *cookie, lcb_server_t *server)
{
    lcb_error_t err;
    mc_CMDQUEUE *cq = &instance->cmdq;
    mc_PIPELINE *pipeline = (mc_PIPELINE *)server;
    mc_PACKET *packet;
    mc_REQDATAEX *rd;

    protocol_binary_request_header hdr;
    packet = mcreq_allocate_packet(pipeline);
    if (!packet) {
        return LCB_CLIENT_ENOMEM;
    }

    err = mcreq_reserve_header(pipeline, packet, 24);
    if (err != LCB_SUCCESS) {
        mcreq_release_packet(pipeline, packet);
        return err;
    }

    rd = calloc(1, sizeof(*rd));
    rd->callback = ext_callback_proxy;
    rd->cookie = cookie;
    rd->start = gethrtime();
    packet->u_rdata.exdata = rd;
    packet->flags |= MCREQ_F_REQEXT;

    memset(&hdr, 0, sizeof(hdr));
    hdr.request.opaque = packet->opaque;
    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.opcode = PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG;
    memcpy(SPAN_BUFFER(&packet->kh_span), hdr.bytes, sizeof(hdr.bytes));

    mcreq_sched_enter(cq);
    mcreq_sched_add(pipeline, packet);
    mcreq_sched_leave(cq, 1);
    return LCB_SUCCESS;
}
