/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2020 Couchbase, Inc.
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

#include <memory>

#include "internal.h"
#include "collections.h"
#include "defer.h"

#include "capi/cmd_get.hh"
#include "capi/cmd_get_replica.hh"

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_status(const lcb_RESPGETREPLICA *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API int lcb_respgetreplica_is_active(const lcb_RESPGETREPLICA *resp)
{
    return resp->is_active;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_error_context(const lcb_RESPGETREPLICA *resp,
                                                             const lcb_KEY_VALUE_ERROR_CONTEXT **ctx)
{
    *ctx = &resp->ctx;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_cookie(const lcb_RESPGETREPLICA *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_cas(const lcb_RESPGETREPLICA *resp, uint64_t *cas)
{
    *cas = resp->ctx.cas;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_datatype(const lcb_RESPGETREPLICA *resp, uint8_t *datatype)
{
    *datatype = resp->datatype;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_flags(const lcb_RESPGETREPLICA *resp, uint32_t *flags)
{
    *flags = resp->itmflags;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_key(const lcb_RESPGETREPLICA *resp, const char **key, size_t *key_len)
{
    *key = resp->ctx.key.c_str();
    *key_len = resp->ctx.key.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetreplica_value(const lcb_RESPGETREPLICA *resp, const char **value,
                                                     size_t *value_len)
{
    *value = (const char *)resp->value;
    *value_len = resp->nvalue;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API int lcb_respgetreplica_is_final(const lcb_RESPGETREPLICA *resp)
{
    return resp->rflags & LCB_RESP_F_FINAL;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_create(lcb_CMDGETREPLICA **cmd, lcb_REPLICA_MODE mode)
{
    *cmd = new lcb_CMDGETREPLICA{};
    switch (mode) {
        case LCB_REPLICA_MODE_ANY:
            return (*cmd)->mode(get_replica_mode::any);
        case LCB_REPLICA_MODE_ALL:
            return (*cmd)->mode(get_replica_mode::all);
        case LCB_REPLICA_MODE_IDX0:
        case LCB_REPLICA_MODE_IDX1:
        case LCB_REPLICA_MODE_IDX2:
            return (*cmd)->select_index(mode - LCB_REPLICA_MODE_IDX0);
        default:
            delete *cmd;
            *cmd = nullptr;
            return LCB_ERR_INVALID_ARGUMENT;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_destroy(lcb_CMDGETREPLICA *cmd)
{
    delete cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_timeout(lcb_CMDGETREPLICA *cmd, uint32_t timeout)
{
    return cmd->timeout_in_microseconds(timeout);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_parent_span(lcb_CMDGETREPLICA *cmd, lcbtrace_SPAN *span)
{
    return cmd->parent_span(span);
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_collection(lcb_CMDGETREPLICA *cmd, const char *scope, size_t scope_len,
                                                         const char *collection, size_t collection_len)
{
    try {
        lcb::collection_qualifier qualifier(scope, scope_len, collection, collection_len);
        return cmd->collection(std::move(qualifier));
    } catch (const std::invalid_argument &) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_key(lcb_CMDGETREPLICA *cmd, const char *key, size_t key_len)
{
    if (key == nullptr || key_len == 0) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return cmd->key(std::string(key, key_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_on_behalf_of(lcb_CMDGETREPLICA *cmd, const char *data, size_t data_len)
{
    return cmd->on_behalf_of(std::string(data, data_len));
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetreplica_on_behalf_of_extra_privilege(lcb_CMDGETREPLICA *cmd,
                                                                           const char *privilege, size_t privilege_len)
{
    return cmd->on_behalf_of_add_extra_privilege(std::string(privilege, privilege_len));
}

struct RGetCookie : mc_REQDATAEX {
    RGetCookie(void *cookie, lcb_INSTANCE *instance, get_replica_mode, int vb);
    void decref()
    {
        if (!--remaining) {
            delete this;
        }
    }

    unsigned r_cur{0};
    unsigned r_max;
    int remaining{0};
    int vbucket;
    get_replica_mode strategy;
    lcb_INSTANCE *instance;
};

static void rget_dtor(mc_PACKET *pkt)
{
    static_cast<RGetCookie *>(pkt->u_rdata.exdata)->decref();
}

static void rget_callback(mc_PIPELINE *pipeline, mc_PACKET *pkt, lcb_CALLBACK_TYPE cbtype, lcb_STATUS err,
                          const void *arg)
{
    auto *instance = static_cast<lcb_INSTANCE *>(pipeline->parent->cqdata);
    lcb_RESPCALLBACK callback = lcb_find_callback(instance, LCB_CALLBACK_GETREPLICA);
    lcb_RESPGETREPLICA active_resp{};
    lcb_RESPGETREPLICA *resp = &active_resp;
    if (cbtype == LCB_CALLBACK_GET) {
        const auto *get_resp = reinterpret_cast<const lcb_RESPGET *>(arg);
        active_resp.is_active = true;
        active_resp.cookie = get_resp->cookie;
        active_resp.ctx = get_resp->ctx;
        active_resp.datatype = get_resp->datatype;
        active_resp.value = get_resp->value;
        active_resp.nvalue = get_resp->nvalue;
        active_resp.itmflags = get_resp->itmflags;
    } else {
        resp = reinterpret_cast<lcb_RESPGETREPLICA *>(const_cast<void *>(arg));
    }

    auto *rck = static_cast<RGetCookie *>(pkt->u_rdata.exdata);
    /** Figure out what the strategy is.. */
    if (rck->strategy == get_replica_mode::select || rck->strategy == get_replica_mode::all) {
        /** Simplest */
        if (rck->strategy == get_replica_mode::select || rck->remaining == 1) {
            resp->rflags |= LCB_RESP_F_FINAL;
        }
        callback(instance, LCB_CALLBACK_GETREPLICA, (const lcb_RESPBASE *)resp);
    } else {
        mc_CMDQUEUE *cq = &instance->cmdq;
        mc_PIPELINE *nextpl = nullptr;

        /** FIRST */
        do {
            int nextix;
            rck->r_cur++;
            nextix = lcbvb_vbreplica(cq->config, rck->vbucket, rck->r_cur);
            if (nextix > -1 && nextix < (int)cq->npipelines) {
                /* have a valid next index? */
                nextpl = cq->pipelines[nextix];
                break;
            }
        } while (rck->r_cur < rck->r_max);

        if (err == LCB_SUCCESS || rck->r_cur == rck->r_max || nextpl == nullptr) {
            resp->rflags |= LCB_RESP_F_FINAL;
            callback(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPBASE *)resp);
            /* refcount=1 . Free this now */
            rck->remaining = 1;
        } else if (err != LCB_SUCCESS) {
            mc_PACKET *newpkt = mcreq_renew_packet(pkt);
            newpkt->flags &= ~MCREQ_STATE_FLAGS;
            mcreq_sched_add(nextpl, newpkt);
            /* Use this, rather than lcb_sched_leave(), because this is being
             * invoked internally by the library. */
            mcreq_sched_leave(cq, 1);
            /* wait */
            rck->remaining = 2;
        }
    }
    rck->decref();
}

static const mc_REQDATAPROCS rget_procs = {rget_callback, rget_dtor};

RGetCookie::RGetCookie(void *cookie_, lcb_INSTANCE *instance_, get_replica_mode strategy_, int vbucket_)
    : mc_REQDATAEX(cookie_, rget_procs, gethrtime()), r_max(LCBT_NREPLICAS(instance_)), vbucket(vbucket_),
      strategy(strategy_), instance(instance_)
{
}

static lcb_STATUS get_replica_validate(lcb_INSTANCE *instance, const lcb_CMDGETREPLICA *cmd)
{
    if (cmd->key().empty()) {
        return LCB_ERR_EMPTY_KEY;
    }
    if (!LCBT_SETTING(instance, use_collections) && !cmd->collection().is_default_collection()) {
        /* only allow default collection when collections disabled for the instance */
        return LCB_ERR_SDK_FEATURE_UNAVAILABLE;
    }
    if (!LCBT_NREPLICAS(instance)) {
        return LCB_ERR_NO_MATCHING_SERVER;
    }

    mc_CMDQUEUE *cq = &instance->cmdq;
    int vbid, ixtmp;
    unsigned r0 = 0, r1 = 0;

    lcb_KEYBUF keybuf{LCB_KV_COPY, {cmd->key().c_str(), cmd->key().size()}};
    mcreq_map_key(cq, &keybuf, MCREQ_PKT_BASESIZE, &vbid, &ixtmp);
    switch (cmd->mode()) {
        case get_replica_mode::select:
            r0 = r1 = cmd->selected_replica_index();
            if (lcbvb_vbreplica(cq->config, vbid, r0) < 0) {
                return LCB_ERR_NO_MATCHING_SERVER;
            }
            break;

        case get_replica_mode::any:
            for (r0 = 0; r0 < LCBT_NREPLICAS(instance); r0++) {
                if (lcbvb_vbreplica(cq->config, vbid, r0) > -1) {
                    r1 = r0;
                    break;
                }
            }
            if (r0 == LCBT_NREPLICAS(instance)) {
                return LCB_ERR_NO_MATCHING_SERVER;
            }
            break;

        case get_replica_mode::all:
            r0 = 0;
            r1 = LCBT_NREPLICAS(instance);
            /* Make sure they're all online */
            for (unsigned ii = 0; ii < LCBT_NREPLICAS(instance); ii++) {
                if (lcbvb_vbreplica(cq->config, vbid, ii) < 0) {
                    return LCB_ERR_NO_MATCHING_SERVER;
                }
            }
            break;
    }

    if (r1 < r0 || r1 >= cq->npipelines) {
        return LCB_ERR_NO_MATCHING_SERVER;
    }

    return LCB_SUCCESS;
}

static lcb_STATUS get_replica_schedule(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDGETREPLICA> cmd)
{
    /**
     * Because we need to direct these commands to specific servers, we can't
     * just use the 'basic_packet()' function.
     */
    mc_CMDQUEUE *cq = &instance->cmdq;
    int vbid, ixtmp;
    protocol_binary_request_header req{};
    unsigned r0 = 0, r1 = 0;

    lcb_KEYBUF keybuf{LCB_KV_COPY, {cmd->key().c_str(), cmd->key().size()}};
    mcreq_map_key(cq, &keybuf, MCREQ_PKT_BASESIZE, &vbid, &ixtmp);

    /* The following blocks will also validate that the entire index range is
     * valid. This is in order to ensure that we don't allocate the cookie
     * if there aren't enough replicas online to satisfy the requirements */

    switch (cmd->mode()) {
        case get_replica_mode::select:
            r0 = r1 = cmd->selected_replica_index();
            if (lcbvb_vbreplica(cq->config, vbid, r0) < 0) {
                return LCB_ERR_NO_MATCHING_SERVER;
            }
            break;

        case get_replica_mode::all:
            r0 = 0;
            r1 = LCBT_NREPLICAS(instance);
            /* Make sure they're all online */
            for (unsigned ii = 0; ii < LCBT_NREPLICAS(instance); ii++) {
                if ((ixtmp = lcbvb_vbreplica(cq->config, vbid, ii)) < 0) {
                    return LCB_ERR_NO_MATCHING_SERVER;
                }
            }
            break;

        case get_replica_mode::any:
            for (r0 = 0; r0 < LCBT_NREPLICAS(instance); r0++) {
                if ((ixtmp = lcbvb_vbreplica(cq->config, vbid, r0)) > -1) {
                    r1 = r0;
                    break;
                }
            }
            if (r0 == LCBT_NREPLICAS(instance)) {
                return LCB_ERR_NO_MATCHING_SERVER;
            }
            break;
    }

    if (r1 < r0 || r1 >= cq->npipelines) {
        return LCB_ERR_NO_MATCHING_SERVER;
    }

    std::vector<std::uint8_t> framing_extras;
    if (cmd->want_impersonation()) {
        lcb_STATUS err = lcb::flexible_framing_extras::encode_impersonate_user(cmd->impostor(), framing_extras);
        if (err != LCB_SUCCESS) {
            return err;
        }
        for (const auto &privilege : cmd->extra_privileges()) {
            err = lcb::flexible_framing_extras::encode_impersonate_users_extra_privilege(privilege, framing_extras);
            if (err != LCB_SUCCESS) {
                return err;
            }
        }
    }

    /* Initialize the cookie */
    auto *rck = new RGetCookie(cmd->cookie(), instance, cmd->mode(), vbid);
    rck->start = cmd->start_time_or_default_in_nanoseconds(gethrtime());
    rck->deadline =
        rck->start + cmd->timeout_or_default_in_nanoseconds(LCB_US2NS(LCBT_SETTING(instance, operation_timeout)));

    /* Initialize the packet */
    req.request.magic = framing_extras.empty() ? PROTOCOL_BINARY_REQ : PROTOCOL_BINARY_AREQ;
    req.request.opcode = PROTOCOL_BINARY_CMD_GET_REPLICA;
    req.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    req.request.vbucket = htons(static_cast<std::uint16_t>(vbid));
    req.request.cas = 0;
    req.request.extlen = 0;

    auto ffextlen = static_cast<std::uint8_t>(framing_extras.size());

    rck->r_cur = r0;
    do {
        int curix;
        mc_PIPELINE *pl;
        mc_PACKET *pkt;

        curix = lcbvb_vbreplica(cq->config, vbid, r0);
        /* XXX: this is always expected to be in range. For the FIRST mode
         * it will seek to the first valid index (checked above), and for the
         * ALL mode, it will fail if not all replicas are already online
         * (also checked above) */
        pl = cq->pipelines[curix];
        pkt = mcreq_allocate_packet(pl);
        if (!pkt) {
            delete rck;
            return LCB_ERR_NO_MEMORY;
        }

        pkt->u_rdata.exdata = rck;
        pkt->flags |= MCREQ_F_REQEXT;

        mcreq_reserve_key(pl, pkt, sizeof(req.bytes) + ffextlen, &keybuf, cmd->collection().collection_id());
        size_t nkey = pkt->kh_span.size - MCREQ_PKT_BASESIZE + pkt->extlen;
        req.request.keylen = htons((uint16_t)nkey);
        req.request.bodylen = htonl((uint32_t)nkey);
        req.request.opaque = pkt->opaque;
        rck->remaining++;
        mcreq_write_hdr(pkt, &req);
        if (!framing_extras.empty()) {
            memcpy(SPAN_BUFFER(&pkt->kh_span) + sizeof(req.bytes), framing_extras.data(), framing_extras.size());
        }
        mcreq_sched_add(pl, pkt);
    } while (++r0 < r1);

    if (cmd->need_get_active()) {
        req.request.opcode = PROTOCOL_BINARY_CMD_GET;
        mc_PIPELINE *pl;
        mc_PACKET *pkt;
        lcb_STATUS err = mcreq_basic_packet(cq, &keybuf, cmd->collection().collection_id(), &req, 0, ffextlen, &pkt,
                                            &pl, MCREQ_BASICPACKET_F_FALLBACKOK);
        if (err != LCB_SUCCESS) {
            delete rck;
            return err;
        }
        req.request.opaque = pkt->opaque;
        pkt->u_rdata.exdata = rck;
        pkt->flags |= MCREQ_F_REQEXT;
        rck->remaining++;
        mcreq_write_hdr(pkt, &req);
        if (!framing_extras.empty()) {
            memcpy(SPAN_BUFFER(&pkt->kh_span) + sizeof(req.bytes), framing_extras.data(), framing_extras.size());
        }
        mcreq_sched_add(pl, pkt);
    }

    MAYBE_SCHEDLEAVE(instance)

    return LCB_SUCCESS;
}

static lcb_STATUS get_replica_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDGETREPLICA> cmd)
{
    if (!LCBT_SETTING(instance, use_collections)) {
        /* fast path if collections are not enabled */
        return get_replica_schedule(instance, cmd);
    }

    if (collcache_get(instance, cmd->collection()) == LCB_SUCCESS) {
        return get_replica_schedule(instance, cmd);
    }

    return collcache_resolve(
        instance, cmd,
        [instance](lcb_STATUS status, const lcb_RESPGETCID *resp, std::shared_ptr<lcb_CMDGETREPLICA> operation) {
            const auto callback_type = LCB_CALLBACK_GETREPLICA;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPGETREPLICA response{};
            if (resp != nullptr) {
                response.ctx = resp->ctx;
            }
            response.ctx.key = operation->key();
            response.ctx.scope = operation->collection().scope();
            response.ctx.collection = operation->collection().collection();
            response.cookie = operation->cookie();
            response.rflags |= LCB_RESP_F_FINAL;
            if (status == LCB_ERR_SHEDULE_FAILURE || resp == nullptr) {
                response.ctx.rc = LCB_ERR_TIMEOUT;
                operation_callback(instance, callback_type, &response);
                return;
            }
            if (resp->ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = get_replica_schedule(instance, operation);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
}

LIBCOUCHBASE_API
lcb_STATUS lcb_getreplica(lcb_INSTANCE *instance, void *cookie, const lcb_CMDGETREPLICA *command)
{
    lcb_STATUS rc;

    rc = get_replica_validate(instance, command);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    auto cmd = std::make_shared<lcb_CMDGETREPLICA>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        cmd->start_time_in_nanoseconds(gethrtime());
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            const auto callback_type = LCB_CALLBACK_GETREPLICA;
            lcb_RESPCALLBACK operation_callback = lcb_find_callback(instance, callback_type);
            lcb_RESPGETREPLICA response{};
            response.ctx.key = cmd->key();
            response.cookie = cmd->cookie();
            response.rflags |= LCB_RESP_F_FINAL;
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, callback_type, &response);
                return;
            }
            response.ctx.rc = get_replica_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, callback_type, &response);
            }
        });
    }
    return get_replica_execute(instance, cmd);
}
