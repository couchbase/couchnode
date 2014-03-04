/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2013 Couchbase, Inc.
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

/**
 * This file contains the implementations of the callback handlers
 * fired when a packet is received on the wire.
 *
 * @author Trond Norbye
 * @todo add more documentation
 */

#include "internal.h"
#include "packetutils.h"
#include "bucketconfig/clconfig.h"

void setup_lcb_get_resp_t(lcb_get_resp_t *resp,
                          const void *key,
                          lcb_size_t nkey,
                          const void *bytes,
                          lcb_size_t nbytes,
                          lcb_uint32_t flags,
                          lcb_cas_t cas,
                          lcb_datatype_t datatype)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
    resp->v.v0.bytes = bytes;
    resp->v.v0.nbytes = nbytes;
    resp->v.v0.flags = flags;
    resp->v.v0.cas = cas;
    resp->v.v0.datatype = datatype;
}

void setup_lcb_remove_resp_t(lcb_remove_resp_t *resp,
                             const void *key,
                             lcb_size_t nkey,
                             lcb_cas_t cas)
{
    resp->version = 0;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
    resp->v.v0.cas = cas;
}

void setup_lcb_store_resp_t(lcb_store_resp_t *resp,
                            const void *key,
                            lcb_size_t nkey,
                            lcb_cas_t cas)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
    resp->v.v0.cas = cas;
}

void setup_lcb_touch_resp_t(lcb_touch_resp_t *resp,
                            const void *key,
                            lcb_size_t nkey,
                            lcb_cas_t cas)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
    resp->v.v0.cas = cas;
}

void setup_lcb_unlock_resp_t(lcb_unlock_resp_t *resp,
                             const void *key,
                             lcb_size_t nkey)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
}

void setup_lcb_arithmetic_resp_t(lcb_arithmetic_resp_t *resp,
                                 const void *key,
                                 lcb_size_t nkey,
                                 lcb_uint64_t value,
                                 lcb_cas_t cas)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
    resp->v.v0.value = value;
    resp->v.v0.cas = cas;
}

void setup_lcb_observe_resp_t(lcb_observe_resp_t *resp,
                              const void *key,
                              lcb_size_t nkey,
                              lcb_cas_t cas,
                              lcb_observe_t status,
                              int from_master,
                              lcb_time_t ttp,
                              lcb_time_t ttr)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
    resp->v.v0.cas = cas;
    resp->v.v0.status = status;
    resp->v.v0.from_master = from_master;
    resp->v.v0.ttp = ttp;
    resp->v.v0.ttr = ttr;
}

void setup_lcb_server_stat_resp_t(lcb_server_stat_resp_t *resp,
                                  const char *server_endpoint,
                                  const void *key,
                                  lcb_size_t nkey,
                                  const void *bytes,
                                  lcb_size_t nbytes)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.server_endpoint = server_endpoint;
    resp->v.v0.key = key;
    resp->v.v0.nkey = nkey;
    resp->v.v0.bytes = bytes;
    resp->v.v0.nbytes = nbytes;
}

void setup_lcb_server_version_resp_t(lcb_server_version_resp_t *resp,
                                     const char *server_endpoint,
                                     const char *vstring,
                                     lcb_size_t nvstring)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.server_endpoint = server_endpoint;
    resp->v.v0.vstring = vstring;
    resp->v.v0.nvstring = nvstring;
}

void setup_lcb_verbosity_resp_t(lcb_verbosity_resp_t *resp,
                                const char *server_endpoint)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.server_endpoint = server_endpoint;
}

void setup_lcb_flush_resp_t(lcb_flush_resp_t *resp,
                            const char *server_endpoint)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.server_endpoint = server_endpoint;
}

/**
 * Default mapping for user-modifiable behavior
 */
LIBCOUCHBASE_API
lcb_error_t lcb_errmap_default(lcb_t instance, lcb_uint16_t in)
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

static lcb_error_t map_error(lcb_t instance,
                             protocol_binary_response_status in)
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
 * Get a pointer to the key. If the buffer isn't continous we need to
 * allocate a temporary chunk of memory and copy the packet over there.
 * packet will return the pointer to the newly allocated packet or
 * NULL if we didn't have to allocate anything.
 *
 * @param server the server owning the key
 * @param nkey the number of bytes in the key
 * @param packet where to store the result
 * @return pointer to the key
 */
static const char *get_key(lcb_server_t *server, lcb_uint16_t *nkey,
                           char **packet)
{
    protocol_binary_request_header req;
    lcb_size_t nr = ringbuffer_peek(&server->cmd_log,
                                    req.bytes, sizeof(req));
    lcb_size_t packetsize = ntohl(req.request.bodylen) + (lcb_uint32_t)sizeof(req);
    char *keyptr;
    *packet = server->cmd_log.read_head;
    lcb_assert(nr == sizeof(req));

    *nkey = ntohs(req.request.keylen);
    keyptr = *packet + sizeof(req) + req.request.extlen;
    *packet = NULL;

    if (!ringbuffer_is_continous(&server->cmd_log,
                                 RINGBUFFER_READ,
                                 packetsize)) {
        *packet = malloc(packetsize);
        if (*packet == NULL) {
            lcb_error_handler(server->instance, LCB_CLIENT_ENOMEM,
                              NULL);
            return NULL;
        }

        nr = ringbuffer_peek(&server->cmd_log, *packet, packetsize);
        if (nr != packetsize) {
            lcb_error_handler(server->instance, LCB_EINTERNAL,
                              NULL);
            free(*packet);
            return NULL;
        }
        keyptr = *packet + sizeof(req) + req.request.extlen;
    }

    return keyptr;
}

/**
 * Return the index of one of the servers that contains an entry for
 * the requested command (note that it may not be the first response we're
 * expecting for that server)
 *
 * @param instance the intance to operate on
 * @param opcode the command opcode we're searching for
 * @param opaque the sequence number to search for
 * @param exc ignore this server.
 */
int lcb_lookup_server_with_command(lcb_t instance,
                                   lcb_uint8_t opcode,
                                   lcb_uint32_t opaque,
                                   lcb_server_t *exc)
{
    protocol_binary_request_header cmd;
    lcb_server_t *server;
    lcb_size_t nr;
    lcb_size_t ii;

    for (ii = 0; ii < instance->nservers; ++ii) {
        server = instance->servers + ii;
        if (server != exc) {
            lcb_size_t offset = 0;
            while ((nr = ringbuffer_peek_at(&server->cmd_log,
                                            offset,
                                            cmd.bytes,
                                            sizeof(cmd))) == sizeof(cmd)) {
                if (cmd.request.opaque >= opaque) {
                    break;
                }
                /* look at the next server */
                offset += sizeof(cmd) + ntohl(cmd.request.bodylen);
            }

            if (nr == sizeof(cmd) &&
                    cmd.request.opcode == opcode &&
                    cmd.request.opaque == opaque) {
                return (int)ii;
            }
        }
    }

    return -1;
}

static void release_key(lcb_server_t *server, char *packet)
{
    /*
     * Packet is a NIL pointer if we didn't allocate a temporary
     * object.
     */
    free(packet);
    (void)server;
}

static void getq_response_handler(lcb_server_t *server, packet_info *info)
{
    lcb_t root = server->instance;
    char *packet;
    lcb_uint16_t nkey;
    const char *key = get_key(server, &nkey, &packet);
    lcb_error_t rc;
    lcb_get_resp_t resp;


    if (key == NULL) {
        lcb_error_handler(server->instance, LCB_EINTERNAL, NULL);
        return;

    } else if (PACKET_STATUS(info) == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        const protocol_binary_response_getq *getq = PACKET_EPHEMERAL_START(info);
        rc = LCB_SUCCESS;
        setup_lcb_get_resp_t(&resp, key, nkey,
                             PACKET_VALUE(info), PACKET_NVALUE(info),
                             ntohl(getq->message.body.flags),
                             PACKET_CAS(info),
                             PACKET_DATATYPE(info));

    } else {
        rc = map_error(root, PACKET_STATUS(info));
        setup_lcb_get_resp_t(&resp, key, nkey, NULL, 0, 0, 0, 0);
    }

    root->callbacks.get(root, info->ct.cookie, rc, &resp);
    release_key(server, packet);
}

static void get_replica_response_handler(lcb_server_t *server,
                                         packet_info *info)
{
    lcb_t root = server->instance;
    lcb_uint16_t nkey;
    const char *key;
    char *packet;
    lcb_uint16_t status = PACKET_STATUS(info);

    lcb_error_t rc = map_error(root, status);

    /**
     * Success? always perform the callback
     */
    if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        const protocol_binary_response_get *get = PACKET_EPHEMERAL_START(info);
        lcb_get_resp_t resp;
        setup_lcb_get_resp_t(&resp,
                             PACKET_KEY(info), PACKET_NKEY(info),
                             PACKET_VALUE(info), PACKET_NVALUE(info),
                             ntohl(get->message.body.flags),
                             PACKET_CAS(info),
                             PACKET_DATATYPE(info));
        root->callbacks.get(root, info->ct.cookie, rc, &resp);
        return;
    }

    key = get_key(server, &nkey, &packet);

    /**
     * Following code handles errors.
     */
    if (info->ct.replica == -1) {
        /* Perform the callback. Either SELECT or ALL */
        lcb_get_resp_t resp;
        setup_lcb_get_resp_t(&resp, key, nkey, NULL, 0, 0, 0, 0);
        PACKET_TRACE(TRACE_GET_END, info, rc, &resp);
        root->callbacks.get(root, info->ct.cookie, rc, &resp);
        release_key(server, packet);
        return;
    }

    /** LCB_REPLICA_FIRST */
    if (status == PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET) {
        /**
         * the config was updated, start from first replica.
         * Reset the iteration count
         */
        info->ct.replica = 0;
    } else {
        info->ct.replica++;
    }

    if (info->ct.replica < root->nreplicas) {
        /* try next replica */
        protocol_binary_request_get req;
        lcb_server_t *new_server;
        int idx = vbucket_get_replica(root->vbucket_config,
                                      info->ct.vbucket,
                                      info->ct.replica);
        if (idx < 0 || idx > (int)root->nservers) {
            lcb_error_handler(root, LCB_NETWORK_ERROR,
                              "GET_REPLICA: missing server");
            release_key(server, packet);
            return;
        }
        new_server = root->servers + idx;
        memset(&req, 0, sizeof(req));
        req.message.header.request.magic = PROTOCOL_BINARY_REQ;
        req.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        req.message.header.request.opcode = CMD_GET_REPLICA;
        req.message.header.request.keylen = ntohs((lcb_uint16_t)nkey);
        req.message.header.request.vbucket = ntohs(info->ct.vbucket);
        req.message.header.request.bodylen = ntohl((lcb_uint32_t)nkey);
        req.message.header.request.opaque = ++root->seqno;
        TRACE_GET_BEGIN(&req, key, nkey, 0);
        lcb_server_retry_packet(new_server, &info->ct,
                                req.bytes, sizeof(req.bytes));
        lcb_server_write_packet(new_server, key, nkey);
        lcb_server_end_packet(new_server);
        lcb_server_send_packets(new_server);
    } else {
        /* give up and report the error */
        lcb_get_resp_t resp;
        setup_lcb_get_resp_t(&resp, key, nkey, NULL, 0, 0, 0, 0);
        PACKET_TRACE(TRACE_GET_END, info, rc, &resp);
        root->callbacks.get(root, info->ct.cookie, rc, &resp);
    }

    release_key(server, packet);
}

static void delete_response_handler(lcb_server_t *server, packet_info *info)
{
    lcb_t root = server->instance;
    lcb_error_t rc = map_error(root, PACKET_STATUS(info));
    char *packet;
    lcb_uint16_t nkey;
    const char *key = get_key(server, &nkey, &packet);

    if (key == NULL) {
        lcb_error_handler(server->instance, LCB_EINTERNAL, NULL);
    } else {
        lcb_remove_resp_t resp;
        setup_lcb_remove_resp_t(&resp, key, nkey, PACKET_CAS(info));
        PACKET_TRACE(TRACE_REMOVE_END, info, rc, &resp);
        root->callbacks.remove(root, info->ct.cookie, rc, &resp);
        release_key(server, packet);
    }
}

static void observe_response_handler(lcb_server_t *server,
                                     packet_info *info)
{
    lcb_t root = server->instance;
    lcb_error_t rc = map_error(root, PACKET_STATUS(info));
    lcb_uint32_t ttp;
    lcb_uint32_t ttr;
    lcb_size_t pos;

    VBUCKET_CONFIG_HANDLE config;
    const char *end, *ptr;

    /**
     * If we have an error we must decode the request instead
     */
    if (rc != LCB_SUCCESS) {
        protocol_binary_request_header req;
        lcb_size_t nr;

        nr = ringbuffer_peek(&server->cmd_log, req.bytes, sizeof(req.bytes));
        if (nr != sizeof(req.bytes)) {
            lcb_error_handler(server->instance, LCB_EINTERNAL, NULL);
            abort();
        }

        if (req.request.bodylen) {
            lcb_size_t npacket = sizeof(req.bytes) + ntohl(req.request.bodylen);
            char *packet = server->cmd_log.read_head;
            int allocated = 0;

            if (!ringbuffer_is_continous(&server->cmd_log, RINGBUFFER_READ, npacket)) {
                packet = malloc(npacket);
                if (packet == NULL) {
                    lcb_error_handler(root, LCB_CLIENT_ENOMEM, NULL);
                    abort();
                }
                nr = ringbuffer_peek(&server->cmd_log, packet, npacket);
                if (nr != npacket) {
                    lcb_error_handler(root, LCB_EINTERNAL, NULL);
                    free(packet);
                    abort();
                }
                allocated = 1;
            }
            lcb_failout_observe_request(server, &info->ct, packet, npacket, rc);
            if (allocated) {
                free(packet);
            }
        }
        return;
    }

    /** The CAS field is split into TTP/TTR values */
    ptr = (char *)&info->res.response.cas;
    memcpy(&ttp, ptr, sizeof(ttp));
    memcpy(&ttr, ptr + sizeof(ttp), sizeof(ttp));

    ttp = ntohl(ttp);
    ttr = ntohl(ttr);

    /** Actual payload sequence of (vb, nkey, key). Repeats multiple times */
    ptr = info->payload;
    end = (char *)ptr + PACKET_NBODY(info);
    config = root->vbucket_config;

    for (pos = 0; ptr < end; pos++) {
        lcb_cas_t cas;
        lcb_uint8_t obs;
        lcb_uint16_t nkey, vb;
        const char *key;
        lcb_observe_resp_t resp;

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

        setup_lcb_observe_resp_t(&resp, key, nkey, cas, obs,
                                 server->index == vbucket_get_master(config, vb),
                                 ttp, ttr);

        lcb_observe_invoke_callback(root, &info->ct, rc, &resp,
                                    PACKET_OPAQUE(info), PACKET_OPCODE(info),
                                    vb);
    }
}

static void store_response_handler(lcb_server_t *server, packet_info *info)
{
    lcb_t root = server->instance;
    lcb_storage_t op;

    char *packet;
    lcb_uint16_t nkey;
    lcb_error_t rc;
    lcb_uint16_t status = PACKET_STATUS(info);

    const char *key = get_key(server, &nkey, &packet);
    if (PACKET_STATUS(info) == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        rc = LCB_SUCCESS;
    } else {
        rc = map_error(root, status);
    }

    switch (PACKET_OPCODE(info)) {
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
        /*
        ** It is impossible to get here (since we're called from our
        ** lookup table... If we _DO_ get here, it must be a development
        ** version where the developer isn't done yet (and should be
        ** forced to think about what to do...)
        */
        lcb_error_handler(root, LCB_EINTERNAL,
                          "Internal error. Received an illegal command opcode");
        abort();
    }

    if (key == NULL) {
        lcb_error_handler(server->instance, LCB_EINTERNAL,
                          NULL);
    } else {
        lcb_store_resp_t resp;
        setup_lcb_store_resp_t(&resp, key, nkey, PACKET_CAS(info));
        PACKET_TRACE(TRACE_STORE_END, info, rc, &resp);
        root->callbacks.store(root, info->ct.cookie, op, rc, &resp);
        release_key(server, packet);
    }
}

static void arithmetic_response_handler(lcb_server_t *server,
                                        packet_info *info)
{
    lcb_t root = server->instance;
    lcb_uint16_t status = PACKET_STATUS(info);
    lcb_error_t rc = map_error(root, status);
    char *packet;
    lcb_uint16_t nkey;
    const char *key = get_key(server, &nkey, &packet);
    lcb_arithmetic_resp_t resp;
    lcb_uint64_t value = 0;
    struct lcb_command_data_st *command_data = &info->ct;

    if (key == NULL) {
        lcb_error_handler(server->instance, LCB_EINTERNAL,
                          NULL);
        return ;
    }

    if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        memcpy(&value, info->payload, sizeof(value));
        value = ntohll(value);
    }

    setup_lcb_arithmetic_resp_t(&resp, key, nkey, value, PACKET_CAS(info));
    PACKET_TRACE(TRACE_ARITHMETIC_END, info, rc, &resp);
    root->callbacks.arithmetic(root, command_data->cookie, rc, &resp);
    release_key(server, packet);
}

static void stat_response_handler(lcb_server_t *server, packet_info *info)
{
    lcb_t root = server->instance;
    lcb_uint16_t status = PACKET_STATUS(info);
    lcb_error_t rc = map_error(root, status);
    lcb_server_stat_resp_t resp;
    struct lcb_command_data_st *command_data = &info->ct;

    if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
        if (!PACKET_NKEY(info)) {
            if (lcb_lookup_server_with_command(root, PROTOCOL_BINARY_CMD_STAT,
                                               PACKET_OPAQUE(info), server) < 0) {
                /* notify client that data is ready */
                setup_lcb_server_stat_resp_t(&resp, NULL, NULL, 0, NULL, 0);
                PACKET_TRACE_NORES(TRACE_STATS_END, info, rc);
                root->callbacks.stat(root, command_data->cookie, rc, &resp);
            }
            return;
        }
        setup_lcb_server_stat_resp_t(&resp, server->authority,
                                     PACKET_KEY(info), PACKET_NKEY(info),
                                     PACKET_VALUE(info), PACKET_NVALUE(info));
        PACKET_TRACE(TRACE_STATS_PROGRESS, info, rc, &resp);
        root->callbacks.stat(root, command_data->cookie, rc, &resp);
    } else {
        setup_lcb_server_stat_resp_t(&resp, server->authority,
                                     NULL, 0, NULL, 0);
        PACKET_TRACE_NORES(TRACE_STATS_END, info, rc);
        root->callbacks.stat(root, command_data->cookie, rc, &resp);

        /* run callback with null-null-null to signal the end of transfer */
        if (lcb_lookup_server_with_command(root, PROTOCOL_BINARY_CMD_STAT,
                                           PACKET_OPAQUE(info), server) < 0) {
            setup_lcb_server_stat_resp_t(&resp, NULL, NULL, 0, NULL, 0);
            PACKET_TRACE_NORES(TRACE_STATS_END, info, LCB_SUCCESS);
            root->callbacks.stat(root, command_data->cookie, LCB_SUCCESS, &resp);
        }
    }
}

static void verbosity_response_handler(lcb_server_t *server,
                                       packet_info *info)
{
    lcb_t root = server->instance;
    lcb_uint16_t status = PACKET_STATUS(info);
    lcb_error_t rc = map_error(root, status);
    lcb_verbosity_resp_t resp;
    struct lcb_command_data_st *command_data = &info->ct;

    setup_lcb_verbosity_resp_t(&resp, server->authority);

    TRACE_VERBOSITY_END(PACKET_OPAQUE(info), command_data->vbucket,
                        PACKET_OPCODE(info), rc, &resp);
    root->callbacks.verbosity(root, command_data->cookie, rc, &resp);

    /* run callback with null-null-null to signal the end of transfer */
    if (lcb_lookup_server_with_command(root, PROTOCOL_BINARY_CMD_VERBOSITY,
                                       PACKET_OPAQUE(info), server) < 0) {
        setup_lcb_verbosity_resp_t(&resp, NULL);
        PACKET_TRACE(TRACE_VERBOSITY_END, info, LCB_SUCCESS, &resp);
        root->callbacks.verbosity(root, command_data->cookie, LCB_SUCCESS, &resp);
    }
}

static void version_response_handler(lcb_server_t *server,
                                     packet_info *info)
{
    lcb_t root = server->instance;
    lcb_uint16_t status = PACKET_STATUS(info);
    lcb_error_t rc = map_error(root, status);
    lcb_uint32_t nvstring = PACKET_NBODY(info);
    const char *vstring;
    lcb_server_version_resp_t resp;
    struct lcb_command_data_st *command_data = &info->ct;

    if (nvstring) {
        vstring = info->payload;
    } else {
        vstring = NULL;
    }

    setup_lcb_server_version_resp_t(&resp, server->authority, vstring, nvstring);
    PACKET_TRACE(TRACE_VERSIONS_PROGRESS, info, rc, &resp);
    root->callbacks.version(root, command_data->cookie, rc, &resp);

    if (lcb_lookup_server_with_command(root, PROTOCOL_BINARY_CMD_VERSION,
                                       PACKET_OPAQUE(info), server) < 0) {
        memset(&resp, 0, sizeof(resp));
        PACKET_TRACE_NORES(TRACE_VERSIONS_END, info, LCB_SUCCESS);
        root->callbacks.version(root, command_data->cookie, LCB_SUCCESS, &resp);
    }

}

static void touch_response_handler(lcb_server_t *server,
                                   packet_info *info)
{
    lcb_t root = server->instance;
    char *packet;
    lcb_uint16_t nkey;
    const char *key = get_key(server, &nkey, &packet);
    lcb_uint16_t status = PACKET_STATUS(info);
    lcb_error_t rc = map_error(root, status);

    if (key == NULL) {
        lcb_error_handler(server->instance, LCB_EINTERNAL,
                          NULL);
    } else {
        lcb_touch_resp_t resp;
        setup_lcb_touch_resp_t(&resp, key, nkey, PACKET_CAS(info));
        PACKET_TRACE(TRACE_TOUCH_END, info, rc, &resp);
        root->callbacks.touch(root, info->ct.cookie, rc, &resp);
        release_key(server, packet);
    }
}

static void flush_response_handler(lcb_server_t *server,
                                   packet_info *info)
{
    lcb_t root = server->instance;
    lcb_uint16_t status = PACKET_STATUS(info);
    lcb_error_t rc = map_error(root, status);
    lcb_flush_resp_t resp;
    struct lcb_command_data_st *command_data = &info->ct;

    setup_lcb_flush_resp_t(&resp, server->authority);


    PACKET_TRACE(TRACE_FLUSH_PROGRESS, info, rc, &resp);
    root->callbacks.flush(root, command_data->cookie, rc, &resp);

    if (lcb_lookup_server_with_command(root, PROTOCOL_BINARY_CMD_FLUSH,
                                       PACKET_OPAQUE(info), server) < 0) {
        setup_lcb_flush_resp_t(&resp, NULL);
        PACKET_TRACE_NORES(TRACE_FLUSH_END, info, LCB_SUCCESS);
        root->callbacks.flush(root, command_data->cookie, LCB_SUCCESS, &resp);
    }
}

static void unlock_response_handler(lcb_server_t *server,
                                    packet_info *info)
{
    lcb_t root = server->instance;
    lcb_uint16_t status = PACKET_STATUS(info);
    char *packet;
    lcb_uint16_t nkey;
    struct lcb_command_data_st *command_data = &info->ct;
    const char *key = get_key(server, &nkey, &packet);
    lcb_error_t rc = map_error(root, status);

    if (key == NULL) {
        lcb_error_handler(server->instance, LCB_EINTERNAL, NULL);
    } else {
        lcb_unlock_resp_t resp;
        setup_lcb_unlock_resp_t(&resp, key, nkey);
        TRACE_UNLOCK_END(PACKET_OPAQUE(info), info->ct.vbucket, rc, &resp);
        root->callbacks.unlock(root, command_data->cookie, rc, &resp);
        release_key(server, packet);
    }
}

static void config_handler(lcb_server_t *server, packet_info *info)
{
    lcb_error_t rc = map_error(server->instance, PACKET_STATUS(info));

    lcb_cccp_update2(info->ct.cookie, rc,
                     PACKET_VALUE(info),
                     PACKET_NVALUE(info),
                     &server->curhost);
}

static void dummy_error_callback(lcb_t instance,
                                 lcb_error_t error,
                                 const char *errinfo)
{
    lcb_breakout(instance);
    (void)error;
    (void)errinfo;
}

static void dummy_stat_callback(lcb_t instance,
                                const void *cookie,
                                lcb_error_t error,
                                const lcb_server_stat_resp_t *resp)
{
    (void)instance;
    (void)error;
    (void)cookie;
    (void)resp;
}

static void dummy_version_callback(lcb_t instance,
                                   const void *cookie,
                                   lcb_error_t error,
                                   const lcb_server_version_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)resp;
    (void)error;
}

static void dummy_verbosity_callback(lcb_t instance,
                                     const void *cookie,
                                     lcb_error_t error,
                                     const lcb_verbosity_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)resp;
    (void)error;
}

static void dummy_get_callback(lcb_t instance,
                               const void *cookie,
                               lcb_error_t error,
                               const lcb_get_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_store_callback(lcb_t instance,
                                 const void *cookie,
                                 lcb_storage_t operation,
                                 lcb_error_t error,
                                 const lcb_store_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)operation;
    (void)error;
    (void)resp;
}

static void dummy_arithmetic_callback(lcb_t instance,
                                      const void *cookie,
                                      lcb_error_t error,
                                      const lcb_arithmetic_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_remove_callback(lcb_t instance,
                                  const void *cookie,
                                  lcb_error_t error,
                                  const lcb_remove_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_touch_callback(lcb_t instance,
                                 const void *cookie,
                                 lcb_error_t error,
                                 const lcb_touch_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_flush_callback(lcb_t instance,
                                 const void *cookie,
                                 lcb_error_t error,
                                 const lcb_flush_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)resp;
    (void)error;
}

static void dummy_http_complete_callback(lcb_http_request_t request,
                                         lcb_t instance,
                                         const void *cookie,
                                         lcb_error_t error,
                                         const lcb_http_resp_t *resp)
{
    (void)request;
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_http_data_callback(lcb_http_request_t request,
                                     lcb_t instance,
                                     const void *cookie,
                                     lcb_error_t error,
                                     const lcb_http_resp_t *resp)
{
    (void)request;
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_unlock_callback(lcb_t instance,
                                  const void *cookie,
                                  lcb_error_t error,
                                  const lcb_unlock_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_configuration_callback(lcb_t instance,
                                         lcb_configuration_t val)
{
    (void)instance;
    (void)val;
}

static void dummy_observe_callback(lcb_t instance,
                                   const void *cookie,
                                   lcb_error_t error,
                                   const lcb_observe_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

static void dummy_durability_callback(lcb_t instance,
                                      const void *cookie,
                                      lcb_error_t error,
                                      const lcb_durability_resp_t *resp)
{
    (void)instance;
    (void)cookie;
    (void)error;
    (void)resp;
}

void lcb_initialize_packet_handlers(lcb_t instance)
{
    instance->callbacks.get = dummy_get_callback;
    instance->callbacks.store = dummy_store_callback;
    instance->callbacks.arithmetic = dummy_arithmetic_callback;
    instance->callbacks.remove = dummy_remove_callback;
    instance->callbacks.touch = dummy_touch_callback;
    instance->callbacks.error = dummy_error_callback;
    instance->callbacks.stat = dummy_stat_callback;
    instance->callbacks.version = dummy_version_callback;
    instance->callbacks.http_complete = dummy_http_complete_callback;
    instance->callbacks.http_data = dummy_http_data_callback;
    instance->callbacks.flush = dummy_flush_callback;
    instance->callbacks.unlock = dummy_unlock_callback;
    instance->callbacks.configuration = dummy_configuration_callback;
    instance->callbacks.observe = dummy_observe_callback;
    instance->callbacks.verbosity = dummy_verbosity_callback;
    instance->callbacks.durability = dummy_durability_callback;
    instance->callbacks.errmap = lcb_errmap_default;
}

int lcb_dispatch_response(lcb_server_t *c, packet_info *info)
{
    switch (info->res.response.opcode) {
    case PROTOCOL_BINARY_CMD_FLUSH:
        flush_response_handler(c, info);
        break;
    case PROTOCOL_BINARY_CMD_GETQ:
    case PROTOCOL_BINARY_CMD_GATQ:
    case PROTOCOL_BINARY_CMD_GET:
    case PROTOCOL_BINARY_CMD_GAT:
    case CMD_GET_LOCKED:
        getq_response_handler(c, info);
        break;
    case CMD_GET_REPLICA:
        get_replica_response_handler(c, info);
        break;

    case CMD_UNLOCK_KEY:
        unlock_response_handler(c, info);
        break;

    case PROTOCOL_BINARY_CMD_DELETE:
        delete_response_handler(c, info);
        break;

    case PROTOCOL_BINARY_CMD_ADD:
    case PROTOCOL_BINARY_CMD_REPLACE:
    case PROTOCOL_BINARY_CMD_SET:
    case PROTOCOL_BINARY_CMD_APPEND:
    case PROTOCOL_BINARY_CMD_PREPEND:
        store_response_handler(c, info);
        break;

    case PROTOCOL_BINARY_CMD_INCREMENT:
    case PROTOCOL_BINARY_CMD_DECREMENT:
        arithmetic_response_handler(c, info);
        break;

    case PROTOCOL_BINARY_CMD_TOUCH:
        touch_response_handler(c, info);
        break;
    case PROTOCOL_BINARY_CMD_STAT:
        stat_response_handler(c, info);
        break;
    case PROTOCOL_BINARY_CMD_VERSION:
        version_response_handler(c, info);
        break;
    case PROTOCOL_BINARY_CMD_VERBOSITY:
        verbosity_response_handler(c, info);
        break;
    case CMD_OBSERVE:
        observe_response_handler(c, info);
        break;
    case PROTOCOL_BINARY_CMD_NOOP:
        /* Ignore */
        break;

    case CMD_GET_CLUSTER_CONFIG:
        config_handler(c, info);
        break;

    default:
        return -1;
    }

    return 0;
}

LIBCOUCHBASE_API
lcb_get_callback lcb_set_get_callback(lcb_t instance,
                                      lcb_get_callback cb)
{
    lcb_get_callback ret = instance->callbacks.get;
    if (cb != NULL) {
        instance->callbacks.get = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_store_callback lcb_set_store_callback(lcb_t instance,
                                          lcb_store_callback cb)
{
    lcb_store_callback ret = instance->callbacks.store;
    if (cb != NULL) {
        instance->callbacks.store = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_arithmetic_callback lcb_set_arithmetic_callback(lcb_t instance,
                                                    lcb_arithmetic_callback cb)
{
    lcb_arithmetic_callback ret = instance->callbacks.arithmetic;
    if (cb != NULL) {
        instance->callbacks.arithmetic = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_observe_callback lcb_set_observe_callback(lcb_t instance,
                                              lcb_observe_callback cb)
{
    lcb_observe_callback ret = instance->callbacks.observe;
    instance->callbacks.observe = cb;
    return ret;
}

LIBCOUCHBASE_API
lcb_remove_callback lcb_set_remove_callback(lcb_t instance,
                                            lcb_remove_callback cb)
{
    lcb_remove_callback ret = instance->callbacks.remove;
    if (cb != NULL) {
        instance->callbacks.remove = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_touch_callback lcb_set_touch_callback(lcb_t instance,
                                          lcb_touch_callback cb)
{
    lcb_touch_callback ret = instance->callbacks.touch;
    if (cb != NULL) {
        instance->callbacks.touch = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_stat_callback lcb_set_stat_callback(lcb_t instance,
                                        lcb_stat_callback cb)
{
    lcb_stat_callback ret = instance->callbacks.stat;
    if (cb != NULL) {
        instance->callbacks.stat = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_version_callback lcb_set_version_callback(lcb_t instance,
                                              lcb_version_callback cb)
{
    lcb_version_callback ret = instance->callbacks.version;
    if (cb != NULL) {
        instance->callbacks.version = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_error_callback lcb_set_error_callback(lcb_t instance,
                                          lcb_error_callback cb)
{
    lcb_error_callback ret = instance->callbacks.error;
    if (cb != NULL) {
        instance->callbacks.error = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_flush_callback lcb_set_flush_callback(lcb_t instance,
                                          lcb_flush_callback cb)
{
    lcb_flush_callback ret = instance->callbacks.flush;
    if (cb != NULL) {
        instance->callbacks.flush = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_http_complete_callback lcb_set_http_complete_callback(lcb_t instance,
                                                          lcb_http_complete_callback cb)
{
    lcb_http_complete_callback ret = instance->callbacks.http_complete;
    if (cb != NULL) {
        instance->callbacks.http_complete = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_http_data_callback lcb_set_http_data_callback(lcb_t instance,
                                                  lcb_http_data_callback cb)
{
    lcb_http_data_callback ret = instance->callbacks.http_data;
    if (cb != NULL) {
        instance->callbacks.http_data = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_unlock_callback lcb_set_unlock_callback(lcb_t instance,
                                            lcb_unlock_callback cb)
{
    lcb_unlock_callback ret = instance->callbacks.unlock;
    if (cb != NULL) {
        instance->callbacks.unlock = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_configuration_callback lcb_set_configuration_callback(lcb_t instance,
                                                          lcb_configuration_callback cb)
{
    lcb_configuration_callback ret = instance->callbacks.configuration;
    if (cb != NULL) {
        instance->callbacks.configuration = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_verbosity_callback lcb_set_verbosity_callback(lcb_t instance,
                                                  lcb_verbosity_callback cb)
{
    lcb_verbosity_callback ret = instance->callbacks.verbosity;
    if (cb != NULL) {
        instance->callbacks.verbosity = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_durability_callback lcb_set_durability_callback(lcb_t instance,
                                                    lcb_durability_callback cb)
{
    lcb_durability_callback ret = instance->callbacks.durability;
    if (cb != NULL) {
        instance->callbacks.durability = cb;
    }
    return ret;
}

LIBCOUCHBASE_API
lcb_errmap_callback lcb_set_errmap_callback(lcb_t instance,
                                            lcb_errmap_callback cb)
{
    lcb_errmap_callback ret = instance->callbacks.errmap;
    if (cb != NULL) {
        instance->callbacks.errmap = cb;
    }
    return ret;
}
