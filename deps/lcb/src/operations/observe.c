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
    ringbuffer_t body;
};

struct observe_requests_st {
    struct observe_st *requests;
    lcb_size_t nrequests;
};

struct obs_cookie_st {
    mc_REQDATAEX base;
    unsigned remaining;
    unsigned otype;
};

typedef enum {
    F_DURABILITY = 0x01,
    F_BCAST = 0x02,
    F_DESTROY = 0x04
} obs_flags;

static void
handle_observe_callback(
        mc_PIPELINE *pl, mc_PACKET *pkt, lcb_error_t err, const void *arg)
{
    struct obs_cookie_st *oc = (struct obs_cookie_st *)pkt->u_rdata.exdata;
    const lcb_observe_resp_t *resp = arg;
    lcb_server_t *server = (lcb_server_t *)pl;
    lcb_t instance = server->instance;;

    if (resp == NULL) {
        int nfailed = 0;
        /** We need to fail the request manually.. */
        const char *ptr = SPAN_BUFFER(&pkt->u_value.single);
        const char *end = ptr + pkt->u_value.single.size;
        while (ptr < end) {
            lcb_uint16_t nkey;
            lcb_observe_resp_t cur;
            ptr += 2;
            memcpy(&nkey, ptr, sizeof(nkey));
            nkey = ntohs(nkey);
            ptr += 2;

            memset(&cur, 0, sizeof(cur));
            cur.v.v0.key = ptr;
            cur.v.v0.nkey = nkey;
            handle_observe_callback(pl, pkt, err, &cur);
            ptr += nkey;
            nfailed++;
        }
        lcb_assert(nfailed);
        return;
    }


    if (oc->otype & F_DURABILITY) {
        lcb_durability_dset_update(
                instance,
                (lcb_durability_set_t *)MCREQ_PKT_COOKIE(pkt), err, resp);
    } else {
        instance->callbacks.observe(instance, MCREQ_PKT_COOKIE(pkt), err, resp);
    }

    if (oc->otype & F_DESTROY) {
        return;
    }

    if (--oc->remaining) {
        return;
    } else {
        lcb_observe_resp_t resp2;

        memset(&resp2, 0, sizeof(resp2));
        oc->otype |= F_DESTROY;
        handle_observe_callback(pl, pkt, err, &resp2);
        free(oc);
    }
}

static int init_request(struct observe_st *reqinfo)
{
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
                           const void *ucookie,
                           lcb_size_t num,
                           const void *const *items,
                           lcb_observe_type_t type)
{
    lcb_size_t ii;
    lcb_size_t maxix;
    struct observe_requests_st reqs;
    struct obs_cookie_st *ocookie;
    mc_CMDQUEUE *cq = &instance->cmdq;

    memset(&reqs, 0, sizeof(reqs));

    if (instance->type != LCB_TYPE_BUCKET) {
        return LCB_EBADHANDLE;
    }

    if (cq->config == NULL) {
        return LCB_CLIENT_ETMPFAIL;
    }

    if (instance->dist_type != VBUCKET_DISTRIBUTION_VBUCKET) {
        return LCB_NOT_SUPPORTED;
    }

    ocookie = calloc(1, sizeof(*ocookie));
    ocookie->base.start = gethrtime();
    ocookie->base.cookie = ucookie;
    ocookie->base.callback = handle_observe_callback;

    if (!ocookie) {
        return LCB_CLIENT_ENOMEM;
    }

    mcreq_sched_enter(cq);

    maxix = vbucket_config_get_num_replicas(cq->config);
    if (type == LCB_OBSERVE_TYPE_DURABILITY) {
        ocookie->otype = F_DURABILITY | F_BCAST;

    } else {
        ocookie->otype = F_BCAST;
    }

    reqs.nrequests = cq->npipelines;
    reqs.requests = calloc(reqs.nrequests, sizeof(*reqs.requests));

    for (ii = 0; ii < num; ii++) {
        const void *key, *hashkey;
        lcb_size_t nkey, nhashkey;
        int vbid, jj, master_only = 0;

        if (type == LCB_OBSERVE_TYPE_DURABILITY) {
            const lcb_durability_entry_t *ent = items[ii];
            key = ent->request.v.v0.key;
            nkey = ent->request.v.v0.nkey;
            hashkey = ent->request.v.v0.hashkey;
            nhashkey = ent->request.v.v0.nhashkey;
        } else {
            const lcb_observe_cmd_t *ocmd = items[ii];
            key = ocmd->v.v1.key;
            nkey = ocmd->v.v1.nkey;
            hashkey = ocmd->v.v1.hashkey;
            nhashkey = ocmd->v.v1.nhashkey;
            if (ocmd->version == 1 &&
                    (ocmd->v.v1.options & LCB_OBSERVE_MASTER_ONLY)) {
                master_only = 1;
            }
        }

        if (!nhashkey) {
            hashkey = key;
            nhashkey = nkey;
        }

        vbid = vbucket_get_vbucket_by_key(cq->config, hashkey, nhashkey);

        for (jj = -1; jj < (int)maxix; jj++) {
            struct observe_st *rr;
            int idx = vbucket_get_replica(cq->config, vbid, jj);
            if (idx < 0 || idx > (int)cq->npipelines) {
                if (jj == -1) {
                    destroy_requests(&reqs);
                    return LCB_NO_MATCHING_SERVER;
                }
                continue;
            }
            lcb_assert(idx < (int)reqs.nrequests);
            rr = reqs.requests + idx;

            if (!rr->allocated) {
                if (!init_request(rr)) {
                    destroy_requests(&reqs);
                    return LCB_CLIENT_ENOMEM;
                }
            }

            {
                lcb_uint16_t vb = htons((lcb_uint16_t)vbid);
                lcb_uint16_t len = htons((lcb_uint16_t)nkey);
                ringbuffer_ensure_capacity(&rr->body, sizeof(vb) + sizeof(len) + nkey);
                ringbuffer_write(&rr->body, &vb, sizeof(vb));
                ringbuffer_write(&rr->body, &len, sizeof(len));
                ringbuffer_write(&rr->body, key, nkey);
            }
            ocookie->remaining++;

            if (master_only) {
                break;
            }
        }
    }

    mcreq_sched_enter(cq);
    for (ii = 0; ii < reqs.nrequests; ii++) {
        protocol_binary_request_header hdr;
        mc_PACKET *pkt;
        mc_PIPELINE *pipeline;
        struct observe_st *rr = reqs.requests + ii;
        pipeline = cq->pipelines[ii];

        if (!rr->allocated) {
            continue;
        }

        pkt = mcreq_allocate_packet(pipeline);
        lcb_assert(pkt);

        mcreq_reserve_header(pipeline, pkt, MCREQ_PKT_BASESIZE);
        mcreq_reserve_value2(pipeline, pkt, rr->body.nbytes);

        hdr.request.magic = PROTOCOL_BINARY_REQ;
        hdr.request.opcode = PROTOCOL_BINARY_CMD_OBSERVE;
        hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
        hdr.request.keylen = 0;
        hdr.request.cas = 0;
        hdr.request.vbucket = 0;
        hdr.request.extlen = 0;
        hdr.request.opaque = pkt->opaque;
        hdr.request.bodylen = htonl((lcb_uint32_t)rr->body.nbytes);

        memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));
        ringbuffer_read(&rr->body, SPAN_BUFFER(&pkt->u_value.single), rr->body.nbytes);

        pkt->flags |= MCREQ_F_REQEXT;
        pkt->u_rdata.exdata = (mc_REQDATAEX *)ocookie;
        mcreq_sched_add(pipeline, pkt);
    }

    destroy_requests(&reqs);
    mcreq_sched_leave(cq, 1);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t lcb_observe(lcb_t instance,
                        const void *command_cookie,
                        lcb_size_t num,
                        const lcb_observe_cmd_t *const *items)
{
    lcb_error_t err = lcb_observe_ex(instance, command_cookie, num,
        (const void * const *)items, LCB_OBSERVE_TYPE_BCAST);
    if (err == LCB_SUCCESS) {
        SYNCMODE_INTERCEPT(instance)
    } else {
        return err;
    }
}
