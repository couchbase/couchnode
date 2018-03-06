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
#include <bucketconfig/clconfig.h>

static void
ext_callback_proxy(mc_PIPELINE *pl, mc_PACKET *req, lcb_error_t rc,
                   const void  *resdata)
{
    lcb::Server *server = static_cast<lcb::Server*>(pl);
    mc_REQDATAEX *rd = req->u_rdata.exdata;
    const lcb::MemcachedResponse *res =
            reinterpret_cast<const lcb::MemcachedResponse*>(resdata);

    lcb::clconfig::cccp_update(rd->cookie, rc, res->value(), res->vallen(),
        &server->get_host());
    free(rd);
}

static mc_REQDATAPROCS procs = { ext_callback_proxy };

lcb_error_t
lcb_st::request_config(const void *cookie_, lcb::Server *server)
{
    lcb_error_t err;
    mc_PACKET *packet;
    mc_REQDATAEX *rd;

    packet = mcreq_allocate_packet(server);
    if (!packet) {
        return LCB_CLIENT_ENOMEM;
    }

    err = mcreq_reserve_header(server, packet, 24);
    if (err != LCB_SUCCESS) {
        mcreq_release_packet(server, packet);
        return err;
    }

    rd = reinterpret_cast<mc_REQDATAEX*>(calloc(1, sizeof(*rd)));
    rd->procs = &procs;
    rd->cookie = cookie_;
    rd->start = gethrtime();
    packet->u_rdata.exdata = rd;
    packet->flags |= MCREQ_F_REQEXT;

    lcb::MemcachedRequest hdr(
        PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG, packet->opaque);
    hdr.opaque(packet->opaque);
    memcpy(SPAN_BUFFER(&packet->kh_span), hdr.data(), hdr.size());

    mcreq_sched_enter(&cmdq);
    mcreq_sched_add(server, packet);
    mcreq_sched_leave(&cmdq, 1);
    return LCB_SUCCESS;
}
