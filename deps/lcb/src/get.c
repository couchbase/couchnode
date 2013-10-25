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

struct server_info_st {
    int vb;
    int idx;
};

static lcb_error_t single_get(lcb_t instance,
                              const void *command_cookie,
                              const lcb_get_cmd_t *item);
static lcb_error_t multi_get(lcb_t instance,
                             const void *command_cookie,
                             lcb_size_t num,
                             const lcb_get_cmd_t *const *items);

/**
 * libcouchbase_mget use the GETQ command followed by a NOOP command to avoid
 * transferring not-found responses. All of the not-found callbacks are
 * generated implicit by receiving a successful get or the NOOP.
 *
 * @author Trond Norbye
 * @todo improve the error handling
 */
LIBCOUCHBASE_API
lcb_error_t lcb_get(lcb_t instance,
                    const void *command_cookie,
                    lcb_size_t num,
                    const lcb_get_cmd_t *const *items)
{
    if (num == 1) {
        return single_get(instance, command_cookie, items[0]);
    } else {
        return multi_get(instance, command_cookie, num, items);
    }
}

LIBCOUCHBASE_API
lcb_error_t lcb_unlock(lcb_t instance,
                       const void *command_cookie,
                       lcb_size_t num,
                       const lcb_unlock_cmd_t *const *items)
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
        protocol_binary_request_no_extras req;
        int vb, idx;
        const void *hashkey = items[ii]->v.v0.hashkey;
        lcb_size_t nhashkey = items[ii]->v.v0.nhashkey;
        const void *key = items[ii]->v.v0.key;
        lcb_size_t nkey = items[ii]->v.v0.nkey;
        lcb_cas_t cas = items[ii]->v.v0.cas;

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
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.vbucket = ntohs((lcb_uint16_t)vb);
        req.message.header.request.bodylen = ntohl((lcb_uint32_t)(nkey));
        req.message.header.request.cas = cas;
        req.message.header.request.opaque = ++instance->seqno;
        req.message.header.request.opcode = CMD_UNLOCK_KEY;

        TRACE_UNLOCK_BEGIN(&req, key, nkey);
        lcb_server_start_packet(server, command_cookie, req.bytes,
                                sizeof(req.bytes));
        lcb_server_write_packet(server, key, nkey);
        lcb_server_end_packet(server);
        lcb_server_send_packets(server);
    }

    return lcb_synchandler_return(instance, LCB_SUCCESS);
}

LIBCOUCHBASE_API
lcb_error_t lcb_get_replica(lcb_t instance,
                            const void *command_cookie,
                            lcb_size_t num,
                            const lcb_get_replica_cmd_t *const *items)
{
    lcb_server_t *server;
    protocol_binary_request_get req;
    int vb, idx;
    lcb_size_t ii, *affected_servers = NULL;

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

    affected_servers = calloc(instance->nservers, sizeof(lcb_size_t));
    if (affected_servers == NULL) {
        return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
    }
    memset(&req, 0, sizeof(req));
    req.message.header.request.magic = PROTOCOL_BINARY_REQ;
    req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    req.message.header.request.opcode = CMD_GET_REPLICA;
    for (ii = 0; ii < num; ++ii) {
        const void *key;
        lcb_size_t nkey;
        int r0, r1;
        lcb_replica_t strategy;
        struct lcb_command_data_st ct;

        memset(&ct, 0, sizeof(struct lcb_command_data_st));
        ct.start = gethrtime();
        ct.cookie = command_cookie;
        strategy = LCB_REPLICA_FIRST;
        r0 = 0; /* begin */
        r1 = 0; /* end */

        switch (items[ii]->version) {
        case 0:
            key = items[ii]->v.v0.key;
            nkey = items[ii]->v.v0.nkey;
            break;
        case 1:
            key = items[ii]->v.v1.key;
            nkey = items[ii]->v.v1.nkey;
            strategy = items[ii]->v.v1.strategy;
            switch (strategy) {
            case LCB_REPLICA_FIRST:
                r0 = r1 = 0;
                /* iterate replicas in a sequence until first
                 * successful response */
                ct.replica = 0;
                break;
            case LCB_REPLICA_SELECT:
                r0 = r1 = items[ii]->v.v1.index;
                if (r0 >= instance->nreplicas) {
                    return lcb_synchandler_return(instance, LCB_EINVAL);
                }
                ct.replica = -1; /* do not iterate */
                break;
            case LCB_REPLICA_ALL:
                r0 = 0;
                r1 = instance->nreplicas;
                ct.replica = -1; /* do not iterate */
                break;
            }
            break;
        default:
            return lcb_synchandler_return(instance, LCB_EINVAL);
        }

        do {
            vb = vbucket_get_vbucket_by_key(instance->vbucket_config,
                                            key, nkey);
            idx = vbucket_get_replica(instance->vbucket_config, vb, r0);
            if (idx < 0 || idx > (int)instance->nservers) {
                free(affected_servers);
                /* FIXME: when 'packet' patch will be applied, here
                 * should be rollback of all the previous commands
                 * queued */
                return lcb_synchandler_return(instance, LCB_NO_MATCHING_SERVER);
            }
            affected_servers[idx]++;
            server = instance->servers + idx;
            req.message.header.request.keylen = ntohs((lcb_uint16_t)nkey);
            req.message.header.request.vbucket = ntohs((lcb_uint16_t)vb);
            req.message.header.request.bodylen = ntohl((lcb_uint32_t)nkey);
            req.message.header.request.opaque = ++instance->seqno;

            TRACE_GET_BEGIN(&req, key, nkey, 0);
            lcb_server_start_packet_ex(server, &ct, req.bytes,
                                       sizeof(req.bytes));
            lcb_server_write_packet(server, key, nkey);
            lcb_server_end_packet(server);
            ++r0;
        } while (r0 < r1);
    }

    for (ii = 0; ii < instance->nservers; ++ii) {
        if (affected_servers[ii]) {
            server = instance->servers + ii;
            lcb_server_send_packets(server);
        }
    }

    free(affected_servers);
    return lcb_synchandler_return(instance, LCB_SUCCESS);
}

static lcb_error_t single_get(lcb_t instance,
                              const void *command_cookie,
                              const lcb_get_cmd_t *item)
{
    lcb_server_t *server;
    protocol_binary_request_gat req;
    int vb, idx;
    lcb_size_t nbytes;
    const void *hashkey = item->v.v0.hashkey;
    lcb_size_t nhashkey = item->v.v0.nhashkey;
    const void *key = item->v.v0.key;
    lcb_size_t nkey = item->v.v0.nkey;
    lcb_time_t exp = item->v.v0.exptime;

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
    req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    req.message.header.request.vbucket = ntohs((lcb_uint16_t)vb);
    req.message.header.request.bodylen = ntohl((lcb_uint32_t)(nkey));
    req.message.header.request.opaque = ++instance->seqno;

    if (!exp) {
        req.message.header.request.opcode = PROTOCOL_BINARY_CMD_GET;
        nbytes = sizeof(req.bytes) - 4;
    } else {
        req.message.header.request.opcode = PROTOCOL_BINARY_CMD_GAT;
        req.message.header.request.extlen = 4;
        req.message.body.expiration = ntohl((lcb_uint32_t)exp);
        req.message.header.request.bodylen = ntohl((lcb_uint32_t)(nkey) + 4);
        nbytes = sizeof(req.bytes);
    }

    if (item->v.v0.lock) {
        /* the expiration is optional for GETL command */
        req.message.header.request.opcode = CMD_GET_LOCKED;
    }
    TRACE_GET_BEGIN(&req, key, nkey, exp);
    lcb_server_start_packet(server, command_cookie, req.bytes, nbytes);
    lcb_server_write_packet(server, key, nkey);
    lcb_server_end_packet(server);
    lcb_server_send_packets(server);

    return lcb_synchandler_return(instance, LCB_SUCCESS);
}

static lcb_error_t multi_get(lcb_t instance,
                             const void *command_cookie,
                             lcb_size_t num,
                             const lcb_get_cmd_t *const *items)
{
    lcb_server_t *server = NULL;
    protocol_binary_request_noop noop;
    lcb_size_t ii, *affected_servers = NULL;
    struct server_info_st *servers = NULL;

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

    affected_servers = calloc(instance->nservers, sizeof(lcb_size_t));
    if (affected_servers == NULL) {
        return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
    }

    servers = malloc(num * sizeof(struct server_info_st));
    if (servers == NULL) {
        free(affected_servers);
        return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
    }

    for (ii = 0; ii < num; ++ii) {
        const void *key = items[ii]->v.v0.key;
        lcb_size_t nkey = items[ii]->v.v0.nkey;
        const void *hashkey = items[ii]->v.v0.hashkey;
        lcb_size_t nhashkey = items[ii]->v.v0.nhashkey;

        if (nhashkey == 0) {
            hashkey = key;
            nhashkey = nkey;
        }

        (void)vbucket_map(instance->vbucket_config, hashkey, nhashkey,
                          &servers[ii].vb, &servers[ii].idx);
        if (servers[ii].idx < 0 || servers[ii].idx > (int)instance->nservers) {
            free(servers);
            free(affected_servers);
            return lcb_synchandler_return(instance, LCB_NO_MATCHING_SERVER);
        }
        affected_servers[servers[ii].idx]++;
    }

    for (ii = 0; ii < num; ++ii) {
        protocol_binary_request_gat req;
        const void *key = items[ii]->v.v0.key;
        lcb_size_t nkey = items[ii]->v.v0.nkey;
        lcb_time_t exp = items[ii]->v.v0.exptime;
        lcb_size_t nreq = sizeof(req.bytes);
        int vb;

        server = instance->servers + servers[ii].idx;
        vb = servers[ii].vb;

        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.keylen = ntohs((lcb_uint16_t)nkey);
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.vbucket = ntohs((lcb_uint16_t)vb);
        req.message.header.request.bodylen = ntohl((lcb_uint32_t)(nkey));
        req.message.header.request.opaque = ++instance->seqno;

        if (!exp) {
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_GETQ;
            nreq -= 4;
        } else {
            req.message.header.request.opcode = PROTOCOL_BINARY_CMD_GATQ;
            req.message.header.request.extlen = 4;
            req.message.body.expiration = ntohl((lcb_uint32_t)exp);
            req.message.header.request.bodylen = ntohl((lcb_uint32_t)(nkey) + 4);
        }
        if (items[ii]->v.v0.lock) {
            /* the expiration is optional for GETL command */
            req.message.header.request.opcode = CMD_GET_LOCKED;
        }
        TRACE_GET_BEGIN(&req, key, nkey, exp);
        lcb_server_start_packet(server, command_cookie, req.bytes, nreq);
        lcb_server_write_packet(server, key, nkey);
        lcb_server_end_packet(server);
    }
    free(servers);

    memset(&noop, 0, sizeof(noop));
    noop.message.header.request.magic = PROTOCOL_BINARY_REQ;
    noop.message.header.request.opcode = PROTOCOL_BINARY_CMD_NOOP;
    noop.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;

    /*
     ** We don't know which server we sent the data to, so examine
     ** where to send the noop
     */
    for (ii = 0; ii < instance->nservers; ++ii) {
        if (affected_servers[ii]) {
            server = instance->servers + ii;
            noop.message.header.request.opaque = ++instance->seqno;
            lcb_server_complete_packet(server, command_cookie,
                                       noop.bytes, sizeof(noop.bytes));
            lcb_server_send_packets(server);
        }
    }
    free(affected_servers);

    return lcb_synchandler_return(instance, LCB_SUCCESS);
}
