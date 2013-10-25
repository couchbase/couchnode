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
 * Spool a store request
 *
 * @author Trond Norbye
 * @todo add documentation
 * @todo fix the expiration so that it works relative/absolute etc..
 * @todo we might want to wait to write the data to the sockets if the
 *       user want to run a batch of store requests?
 */
LIBCOUCHBASE_API
lcb_error_t lcb_store(lcb_t instance,
                      const void *command_cookie,
                      lcb_size_t num,
                      const lcb_store_cmd_t *const *items)
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
        protocol_binary_request_set req;
        lcb_size_t headersize;
        lcb_size_t bodylen;
        int vb, idx;

        lcb_storage_t operation = items[ii]->v.v0.operation;
        const void *key = items[ii]->v.v0.key;
        lcb_size_t nkey = items[ii]->v.v0.nkey;
        lcb_cas_t cas = items[ii]->v.v0.cas;
        lcb_uint32_t flags = items[ii]->v.v0.flags;
        lcb_time_t exp = items[ii]->v.v0.exptime;
        const void *bytes = items[ii]->v.v0.bytes;
        lcb_size_t nbytes = items[ii]->v.v0.nbytes;
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
        req.message.header.request.keylen = ntohs((lcb_uint16_t)nkey);
        req.message.header.request.extlen = 8;
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.vbucket = ntohs((lcb_uint16_t)vb);
        req.message.header.request.opaque = ++instance->seqno;
        req.message.header.request.cas = cas;
        req.message.body.flags = htonl(flags);
        req.message.body.expiration = htonl((lcb_uint32_t)exp);

        headersize = sizeof(req.bytes);
        switch (operation) {
        case LCB_ADD:
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_ADD;
            break;
        case LCB_REPLACE:
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_REPLACE;
            break;
        case LCB_SET:
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_SET;
            break;
        case LCB_APPEND:
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_APPEND;
            req.message.header.request.extlen = 0;
            headersize -= 8;
            break;
        case LCB_PREPEND:
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_PREPEND;
            req.message.header.request.extlen = 0;
            headersize -= 8;
            break;
        default:
            /* We were given an unknown storage operation. */
            return lcb_synchandler_return(instance,
                                          lcb_error_handler(instance, LCB_EINVAL,
                                                            "Invalid value passed as storage operation"));
        }

        /* Make it known that this was a success. */
        lcb_error_handler(instance, LCB_SUCCESS, NULL);

        bodylen = nkey + nbytes + req.message.header.request.extlen;
        req.message.header.request.bodylen = htonl((lcb_uint32_t)bodylen);

        TRACE_STORE_BEGIN(&req, key, nkey, bytes, nbytes, flags, exp);
        lcb_server_start_packet(server, command_cookie, &req, headersize);
        lcb_server_write_packet(server, key, nkey);
        lcb_server_write_packet(server, bytes, nbytes);
        lcb_server_end_packet(server);
        lcb_server_send_packets(server);
    }

    return lcb_synchandler_return(instance, LCB_SUCCESS);
}
