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
#include "durability_internal.h"

struct observe_st {
    int allocated;
    protocol_binary_request_no_extras packet;
    ringbuffer_t body;
    lcb_size_t nbody;
};

struct observe_requests_st {
    struct observe_st *requests;
    lcb_size_t nrequests;
};

static int init_request(struct observe_st *reqinfo)
{
    memset(&reqinfo->packet, 0, sizeof(reqinfo->packet));

    if (!ringbuffer_initialize(&reqinfo->body, 512)) {
        return 0;
    }
    reqinfo->allocated = 1;
    return 1;
}

static void destroy_requests(struct observe_requests_st *reqs)
{
    lcb_size_t ii;
    for (ii = 0; ii < reqs->nrequests; ii++) {
        struct observe_st *rr = reqs->requests + ii;

        if (!rr->allocated) {
            continue;
        }

        ringbuffer_destruct(&rr->body);
        rr->allocated = 0;
    }
    free(reqs->requests);
}

/**
 * Extended version of observe command. This allows us to service
 * various forms of higher level operations which use observe in one way
 * or another
 */
lcb_error_t lcb_observe_ex(lcb_t instance,
                           const void *command_cookie,
                           lcb_size_t num,
                           const void *const *items,
                           lcb_observe_type_t type)
{
    lcb_size_t ii;
    lcb_size_t maxix;
    lcb_uint32_t opaque;
    struct lcb_command_data_st ct;
    struct observe_requests_st reqs;

    memset(&reqs, 0, sizeof(reqs));

    if (instance->type != LCB_TYPE_BUCKET) {
        return lcb_synchandler_return(instance, LCB_EBADHANDLE);
    }

    if (instance->vbucket_config == NULL) {
        return lcb_synchandler_return(instance, LCB_CLIENT_ETMPFAIL);
    }

    if (instance->dist_type != VBUCKET_DISTRIBUTION_VBUCKET) {
        return lcb_synchandler_return(instance, LCB_NOT_SUPPORTED);
    }

    opaque = ++instance->seqno;
    ct.cookie = command_cookie;
    maxix = instance->nreplicas;

    if (type == LCB_OBSERVE_TYPE_CHECK) {
        maxix = 0;

    } else {
        if (type == LCB_OBSERVE_TYPE_DURABILITY) {
            ct.flags = LCB_CMD_F_OBS_DURABILITY | LCB_CMD_F_OBS_BCAST;

        } else {
            ct.flags = LCB_CMD_F_OBS_BCAST;
        }
    }

    reqs.nrequests = instance->nservers;
    reqs.requests = calloc(reqs.nrequests, sizeof(*reqs.requests));

    for (ii = 0; ii < num; ii++) {
        const void *key, *hashkey;
        lcb_size_t nkey, nhashkey;
        int vbid, jj;

        if (type == LCB_OBSERVE_TYPE_DURABILITY) {
            const lcb_durability_entry_t *ent = items[ii];
            key = ent->request.v.v0.key;
            nkey = ent->request.v.v0.nkey;
            hashkey = ent->request.v.v0.hashkey;
            nhashkey = ent->request.v.v0.nhashkey;
        } else {
            const lcb_observe_cmd_t *ocmd = items[ii];
            key = ocmd->v.v0.key;
            nkey = ocmd->v.v0.nkey;
            hashkey = ocmd->v.v0.hashkey;
            nhashkey = ocmd->v.v0.nhashkey;
        }
        if (!nhashkey) {
            hashkey = key;
            nhashkey = nkey;
        }

        vbid = vbucket_get_vbucket_by_key(instance->vbucket_config,
                                          hashkey,
                                          nhashkey);

        for (jj = -1; jj < (int)maxix; jj++) {
            struct observe_st *rr;

            int idx = vbucket_get_replica(instance->vbucket_config,
                                          vbid,
                                          jj);

            if (idx < 0 || idx > (int)instance->nservers) {
                if (jj == -1) {
                    destroy_requests(&reqs);
                    return lcb_synchandler_return(instance, LCB_NO_MATCHING_SERVER);
                }
                continue;
            }
            lcb_assert(idx < (int)reqs.nrequests);
            rr = reqs.requests + idx;

            if (!rr->allocated) {
                if (!init_request(rr)) {
                    destroy_requests(&reqs);
                    return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
                }
            }

            {
                lcb_uint16_t vb = htons((lcb_uint16_t)vbid);
                lcb_uint16_t len = htons((lcb_uint16_t)nkey);

                rr->packet.message.header.request.magic = PROTOCOL_BINARY_REQ;
                rr->packet.message.header.request.opcode = CMD_OBSERVE;
                rr->packet.message.header.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
                rr->packet.message.header.request.opaque = opaque;

                ringbuffer_ensure_capacity(&rr->body,
                                           sizeof(vb) + sizeof(len) + nkey);
                rr->nbody += ringbuffer_write(&rr->body, &vb, sizeof(vb));
                rr->nbody += ringbuffer_write(&rr->body, &len, sizeof(len));
                rr->nbody += ringbuffer_write(&rr->body, key, nkey);
            }
        }
    }

    for (ii = 0; ii < reqs.nrequests; ii++) {
        struct observe_st *rr = reqs.requests + ii;
        struct lcb_server_st *server = instance->servers + ii;
        char *tmp;

        if (!rr->allocated) {
            continue;
        }

        rr->packet.message.header.request.bodylen = ntohl((lcb_uint32_t)rr->nbody);
        ct.start = gethrtime();

        lcb_server_start_packet_ct(server, &ct, rr->packet.bytes,
                                   sizeof(rr->packet.bytes));

        if (ringbuffer_is_continous(&rr->body, RINGBUFFER_READ, rr->nbody)) {
            tmp = ringbuffer_get_read_head(&rr->body);
            TRACE_OBSERVE_BEGIN(&rr->packet, server->authority, tmp, rr->nbody);
            lcb_server_write_packet(server, tmp, rr->nbody);
        } else {
            tmp = malloc(ringbuffer_get_nbytes(&rr->body));
            if (!tmp) {
                /* FIXME by this time some of requests might be scheduled */
                destroy_requests(&reqs);
                return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
            } else {
                ringbuffer_read(&rr->body, tmp, rr->nbody);
                TRACE_OBSERVE_BEGIN(&rr->packet, server->authority, tmp, rr->nbody);
                lcb_server_write_packet(server, tmp, rr->nbody);
            }
        }
        lcb_server_end_packet(server);
        lcb_server_send_packets(server);
    }

    destroy_requests(&reqs);
    return lcb_synchandler_return(instance, LCB_SUCCESS);
}

LIBCOUCHBASE_API
lcb_error_t lcb_observe(lcb_t instance,
                        const void *command_cookie,
                        lcb_size_t num,
                        const lcb_observe_cmd_t *const *items)
{
    return lcb_observe_ex(instance, command_cookie, num,
                          (const void * const *)items,
                          LCB_OBSERVE_TYPE_BCAST);
}

/**
 * So here we invoke observe callbacks and potentially free resources
 */
void lcb_observe_invoke_callback(lcb_t instance,
                                 const struct lcb_command_data_st *ct,
                                 lcb_error_t error,
                                 const lcb_observe_resp_t *resp)
{
    if (ct->flags & LCB_CMD_F_OBS_DURABILITY) {
        lcb_durability_dset_update(instance,
                                   (lcb_durability_set_t *)ct->cookie,
                                   error,
                                   resp);
    } else if (ct->flags & LCB_CMD_F_OBS_CHECK) {
        instance->callbacks.exists(instance, ct->cookie, error, resp);

    } else {
        instance->callbacks.observe(instance, ct->cookie, error, resp);
    }
}
