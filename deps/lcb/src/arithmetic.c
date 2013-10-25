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

/**
 * Spool an arithmetic request
 *
 * @author Trond Norbye
 * @todo add documentation
 */
LIBCOUCHBASE_API
lcb_error_t lcb_arithmetic(lcb_t instance,
                           const void *command_cookie,
                           lcb_size_t num,
                           const lcb_arithmetic_cmd_t *const *items)
{
    lcb_size_t ii;

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

    for (ii = 0; ii < num; ++ii) {
        lcb_server_t *server;
        protocol_binary_request_incr req;
        int vb, idx;
        const void *key = items[ii]->v.v0.key;
        lcb_size_t nkey = items[ii]->v.v0.nkey;
        lcb_time_t exp = items[ii]->v.v0.exptime;
        int create = items[ii]->v.v0.create;
        lcb_int64_t delta = items[ii]->v.v0.delta;
        lcb_uint64_t initial = items[ii]->v.v0.initial;
        const void *hashkey = items[ii]->v.v0.hashkey;
        lcb_size_t nhashkey = items[ii]->v.v0.nhashkey;

        if (nhashkey == 0) {
            hashkey = key;
            nhashkey = nkey;
        }

        (void)vbucket_map(instance->vbucket_config, hashkey, nhashkey,
                          &vb, &idx);

        if (idx < 0 || idx > (int)instance->nservers) {
            return lcb_synchandler_return(instance, LCB_NO_MATCHING_SERVER);
        }
        server = instance->servers + idx;

        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.opcode = PROTOCOL_BINARY_CMD_INCREMENT;
        req.message.header.request.keylen = ntohs((lcb_uint16_t)nkey);
        req.message.header.request.extlen = 20;
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.vbucket = ntohs((lcb_uint16_t)vb);
        req.message.header.request.bodylen = ntohl((lcb_uint32_t)(nkey + 20));
        req.message.header.request.opaque = ++instance->seqno;
        req.message.body.delta = ntohll((lcb_uint64_t)(delta));
        req.message.body.initial = ntohll(initial);
        req.message.body.expiration = ntohl((lcb_uint32_t)exp);

        if (delta < 0) {
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_DECREMENT;
            req.message.body.delta = ntohll((lcb_uint64_t)(delta * -1));
        }

        if (!create) {
            memset(&req.message.body.expiration, 0xff,
                   sizeof(req.message.body.expiration));
        }

        TRACE_ARITHMETIC_BEGIN(&req, key, nkey, delta, initial,
                               create ? exp : (lcb_time_t)0xffffffff);
        lcb_server_start_packet(server, command_cookie, req.bytes,
                                sizeof(req.bytes));
        lcb_server_write_packet(server, key, nkey);
        lcb_server_end_packet(server);
        lcb_server_send_packets(server);
    }


    return lcb_synchandler_return(instance, LCB_SUCCESS);
}
