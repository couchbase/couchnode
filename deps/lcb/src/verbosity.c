/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
lcb_error_t lcb_set_verbosity(lcb_t instance,
                              const void *command_cookie,
                              lcb_size_t num,
                              const lcb_verbosity_cmd_t *const *commands)
{
    lcb_size_t count;
    /* we need a vbucket config before we can start getting data.. */
    if (instance->vbucket_config == NULL) {
        switch (instance->type) {
        case LCB_TYPE_CLUSTER:
            return lcb_synchandler_return(instance, LCB_EBADHANDLE);
        case LCB_TYPE_BUCKET:
        default:
            return lcb_synchandler_return(instance, LCB_CLIENT_ETMPFAIL);
        }
    }

    for (count = 0; count < num; ++count) {
        lcb_server_t *srv;
        protocol_binary_request_verbosity req;
        lcb_size_t ii;
        uint32_t lvl;
        int found = 0;
        const char *server = commands[count]->v.v0.server;


        switch (commands[count]->v.v0.level) {
        case LCB_VERBOSITY_DETAIL:
            lvl = 3;
            break;
        case LCB_VERBOSITY_DEBUG:
            lvl = 2;
            break;
        case LCB_VERBOSITY_INFO:
            lvl = 1;
            break;
        case LCB_VERBOSITY_WARNING:
        default:
            lvl = 0;
        }

        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.opcode = PROTOCOL_BINARY_CMD_VERBOSITY;
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.opaque = ++instance->seqno;
        req.message.header.request.extlen = 4;
        req.message.header.request.bodylen = htonl(4);
        req.message.body.level = htonl(lvl);

        for (ii = 0; ii < instance->nservers; ++ii) {
            srv = instance->servers + ii;

            if (server && strncmp(server, srv->authority, strlen(server)) != 0) {
                continue;
            }

            TRACE_VERBOSITY_BEGIN(&req, server, lvl);
            lcb_server_start_packet(srv, command_cookie, req.bytes,
                                    sizeof(req.bytes));
            lcb_server_end_packet(srv);
            lcb_server_send_packets(srv);
            found = 1;
        }

        if (server && found == 0) {
            return lcb_synchandler_return(instance, LCB_UNKNOWN_HOST);
        }
    }

    return lcb_synchandler_return(instance, LCB_SUCCESS);
}
