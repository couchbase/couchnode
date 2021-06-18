/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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

static void ext_callback_proxy(mc_PIPELINE *pl, mc_PACKET *req, lcb_CALLBACK_TYPE /* cbtype */, lcb_STATUS rc,
                               const void *resdata)
{
    auto *server = static_cast<lcb::Server *>(pl);
    const auto *res = reinterpret_cast<const lcb::MemcachedResponse *>(resdata);

    mc_REQDATAEX *rd = req->u_rdata.exdata;
    switch (res->opcode()) {
        case PROTOCOL_BINARY_CMD_SELECT_BUCKET:
            lcb::clconfig::select_status(rd->cookie, rc);
            if (rc == LCB_SUCCESS) {
                server->selected_bucket = 1;
                server->bucket.assign(server->settings->bucket, strlen(server->settings->bucket));
            }
            break;
        case PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG:
            lcb::clconfig::cccp_update(rd->cookie, rc, res->value(), res->vallen(),
                                       server->has_valid_host() ? &server->get_host() : nullptr);
            break;
    }
    free(rd);
    req->u_rdata.exdata = nullptr;
}

static void ext_callback_dtor(mc_PACKET *pkt)
{
    mc_REQDATAEX *rd = pkt->u_rdata.exdata;
    free(rd);
    pkt->u_rdata.exdata = nullptr;
}

static mc_REQDATAPROCS procs = {ext_callback_proxy, ext_callback_dtor};

lcb_STATUS lcb_st::request_config(void *cookie_, lcb::Server *server)
{
    lcb_STATUS err;
    mc_PACKET *packet;
    mc_REQDATAEX *rd;

    packet = mcreq_allocate_packet(server);
    if (!packet) {
        return LCB_ERR_NO_MEMORY;
    }

    err = mcreq_reserve_header(server, packet, 24);
    if (err != LCB_SUCCESS) {
        mcreq_release_packet(server, packet);
        return err;
    }

    rd = reinterpret_cast<mc_REQDATAEX *>(calloc(1, sizeof(*rd)));
    rd->procs = &procs;
    rd->cookie = cookie_;
    rd->start = gethrtime();
    rd->deadline =
        rd->start + LCB_US2NS(LCBT_SETTING(reinterpret_cast<lcb_INSTANCE *>(cmdq.cqdata), operation_timeout));
    packet->u_rdata.exdata = rd;
    packet->flags |= MCREQ_F_REQEXT;

    lcb::MemcachedRequest hdr(PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG, packet->opaque);
    hdr.opaque(packet->opaque);
    memcpy(SPAN_BUFFER(&packet->kh_span), hdr.data(), hdr.size());

    mcreq_sched_enter(&cmdq);
    mcreq_sched_add(server, packet);
    mcreq_sched_leave(&cmdq, 1);
    return LCB_SUCCESS;
}

lcb_STATUS lcb_st::select_bucket(void *cookie_, lcb::Server *server)
{
    lcb_STATUS err;
    mc_PACKET *packet;
    mc_REQDATAEX *rd;
    lcb_assert(settings->bucket);
    packet = mcreq_allocate_packet(server);
    if (!packet) {
        return LCB_ERR_NO_MEMORY;
    }

    err = mcreq_reserve_header(server, packet, 24);
    if (err != LCB_SUCCESS) {
        mcreq_release_packet(server, packet);
        return err;
    }

    rd = reinterpret_cast<mc_REQDATAEX *>(calloc(1, sizeof(*rd)));
    rd->procs = &procs;
    rd->cookie = cookie_;
    rd->start = gethrtime();
    rd->deadline =
        rd->start + LCB_US2NS(LCBT_SETTING(reinterpret_cast<lcb_INSTANCE *>(cmdq.cqdata), operation_timeout));
    packet->u_rdata.exdata = rd;
    packet->flags |= MCREQ_F_REQEXT;

    lcb_KEYBUF key = {};
    LCB_KREQ_SIMPLE(&key, settings->bucket, strlen(settings->bucket));
    packet->flags |= MCREQ_F_NOCID;
    mcreq_reserve_key(server, packet, MCREQ_PKT_BASESIZE, &key, 0);

    lcb::MemcachedRequest hdr(PROTOCOL_BINARY_CMD_SELECT_BUCKET, packet->opaque);
    hdr.opaque(packet->opaque);
    hdr.sizes(0, strlen(settings->bucket), 0);
    memcpy(SPAN_BUFFER(&packet->kh_span), hdr.data(), hdr.size());

    mcreq_sched_enter(&cmdq);
    mcreq_sched_add(server, packet);
    mcreq_sched_leave(&cmdq, 0);
    return LCB_SUCCESS;
}
