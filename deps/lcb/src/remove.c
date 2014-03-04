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
#include "vbcheck.h"

/**
 * Send a delete command to the correct server
 *
 * @author Trond Norbye
 * @todo improve the error handling
 */
LIBCOUCHBASE_API
lcb_error_t lcb_remove(lcb_t instance,
                       const void *command_cookie,
                       lcb_size_t num,
                       const lcb_remove_cmd_t *const *items)
{
    lcb_size_t ii;
    vbcheck_ctx vbc;
    lcb_error_t err;

    VBC_SANITY(instance);

    err = vbcheck_ctx_init(&vbc, instance, num);
    if (err != LCB_SUCCESS) {
        return lcb_synchandler_return(instance, err);
    }

    for (ii = 0; ii < num; ii++) {
        const void *k;
        lcb_size_t nk;
        VBC_GETK0(items[ii], k, nk);
        err = vbcheck_populate(&vbc, instance, ii, k, nk);
        if (err != LCB_SUCCESS) {
            vbcheck_ctx_clean(&vbc);
            return lcb_synchandler_return(instance, err);
        }
    }

    for (ii = 0; ii < num; ++ii) {
        vbcheck_keyinfo *ki = vbc.ptr_ki + ii;
        lcb_server_t *server = instance->servers + ki->ix;
        protocol_binary_request_delete req;
        const void *key = items[ii]->v.v0.key;
        lcb_size_t nkey = items[ii]->v.v0.nkey;
        lcb_cas_t cas = items[ii]->v.v0.cas;

        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.opcode = PROTOCOL_BINARY_CMD_DELETE;
        req.message.header.request.keylen = ntohs((lcb_uint16_t)nkey);
        req.message.header.request.extlen = 0;
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.vbucket = ntohs(ki->vb);
        req.message.header.request.bodylen = ntohl((lcb_uint32_t)nkey);
        req.message.header.request.opaque = ++instance->seqno;
        req.message.header.request.cas = cas;

        TRACE_REMOVE_BEGIN(&req, key, nkey);
        lcb_server_start_packet(server, command_cookie,
                                req.bytes, sizeof(req.bytes));
        lcb_server_write_packet(server, key, nkey);
        lcb_server_end_packet(server);
    }

    for (ii = 0; ii < instance->nservers; ii++) {
        if (vbc.ptr_srv[ii]) {
            lcb_server_send_packets(instance->servers + ii);
        }
    }

    vbcheck_ctx_clean(&vbc);
    return lcb_synchandler_return(instance, LCB_SUCCESS);
}
