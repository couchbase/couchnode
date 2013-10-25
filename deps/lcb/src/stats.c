/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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

/**
 * lcb_stat use the STATS command
 *
 * @author Sergey Avseyev
 */
LIBCOUCHBASE_API
lcb_error_t lcb_server_stats(lcb_t instance,
                             const void *command_cookie,
                             lcb_size_t num,
                             const lcb_server_stats_cmd_t *const *commands)
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
        const void *arg = commands[count]->v.v0.name;
        lcb_size_t narg = commands[count]->v.v0.nname;
        lcb_server_t *server;
        protocol_binary_request_stats req;
        lcb_size_t ii;

        if (commands[count]->version != 0) {
            return lcb_synchandler_return(instance, LCB_EINVAL);
        }

        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.opcode = PROTOCOL_BINARY_CMD_STAT;
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.keylen = ntohs((lcb_uint16_t)narg);
        req.message.header.request.bodylen = ntohl((lcb_uint32_t)narg);
        req.message.header.request.opaque = ++instance->seqno;

        for (ii = 0; ii < instance->nservers; ++ii) {
            server = instance->servers + ii;
            TRACE_STATS_BEGIN(&req, server->authority, arg, narg);
            lcb_server_start_packet(server, command_cookie,
                                    req.bytes, sizeof(req.bytes));
            lcb_server_write_packet(server, arg, narg);
            lcb_server_end_packet(server);
            lcb_server_send_packets(server);
        }
    }

    return lcb_synchandler_return(instance, LCB_SUCCESS);
}


/**
 * Get the servers' versions using the VERSION command.
 *
 */
LIBCOUCHBASE_API
lcb_error_t lcb_server_versions(lcb_t instance,
                                const void *command_cookie,
                                lcb_size_t num,
                                const lcb_server_version_cmd_t *const *commands)
{
    lcb_size_t count;

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
        lcb_server_t *server;
        protocol_binary_request_version req;
        lcb_size_t ii;

        if (commands[count]->version != 0) {
            return LCB_EINVAL;
        }

        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.opcode = PROTOCOL_BINARY_CMD_VERSION;
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.opaque = ++instance->seqno;

        for (ii = 0; ii < instance->nservers; ++ii) {
            server = instance->servers + ii;
            TRACE_VERSIONS_BEGIN(&req, server->authority);
            lcb_server_complete_packet(server, command_cookie,
                                       req.bytes, sizeof(req.bytes));
            lcb_server_send_packets(server);
        }
    }


    return lcb_synchandler_return(instance, LCB_SUCCESS);
}
