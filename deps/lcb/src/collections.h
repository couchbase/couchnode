/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2019-2020 Couchbase, Inc.
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

#ifndef LCB_COLLECTIONS_H
#define LCB_COLLECTIONS_H

#ifdef __cplusplus
#include <memory>

#include "capi/cmd_getcid.hh"
#include "capi/collection_qualifier.hh"
#include "capi/deferred_command_context.hh"

namespace lcb
{
class CollectionCache
{
    std::map<std::string, uint32_t> cache_n2i{};
    std::map<uint32_t, std::string> cache_i2n{};

  public:
    CollectionCache();

    ~CollectionCache() = default;

    bool get(const std::string &path, uint32_t *cid);

    void put(const std::string &path, uint32_t cid);

    std::string id_to_name(uint32_t cid);

    void erase(uint32_t cid);
};
} // namespace lcb
typedef lcb::CollectionCache lcb_COLLCACHE;

lcb_STATUS collcache_get(lcb_INSTANCE *instance, const char *scope, size_t nscope, const char *collection,
                         size_t ncollection, uint32_t *cid);
lcb_STATUS collcache_get(lcb_INSTANCE *instance, lcb::collection_qualifier &collection);
std::string collcache_build_spec(const char *scope, size_t nscope, const char *collection, size_t ncollection);

template <typename Command, typename Operation, typename Destructor>
struct GetCidCtx : mc_REQDATAEX {
    std::string path_;
    Operation op_;
    Command cmd_;
    Destructor dtor_;

    static mc_REQDATAPROCS proctable;

    GetCidCtx(std::string path, Operation op, Command cmd, Destructor dtor)
        : mc_REQDATAEX(nullptr, proctable, gethrtime()), path_(std::move(path)), op_(op), cmd_(cmd), dtor_(dtor)
    {
    }

    ~GetCidCtx()
    {
        if (cmd_) {
            dtor_(cmd_);
            cmd_ = nullptr;
        }
    }
};

template <typename Command, typename Operation, typename Destructor>
GetCidCtx<Command, Operation, Destructor> *make_cid_ctx(std::string path, Operation op, Command cmd, Destructor dtor)
{
    return new GetCidCtx<Command, Operation, Destructor>(path, op, cmd, dtor);
}

template <typename Command, typename Operation, typename Destructor>
static void handle_collcache_proc(mc_PIPELINE *pipeline, mc_PACKET *pkt, lcb_CALLBACK_TYPE /* cbtype */,
                                  lcb_STATUS /* err */, const void *rb)
{
    auto *instance = reinterpret_cast<lcb_INSTANCE *>(pipeline->parent->cqdata);
    auto *ctx = static_cast<GetCidCtx<Command, Operation, Destructor> *>(pkt->u_rdata.exdata);
    const auto *resp = (const lcb_RESPGETCID *)rb;
    uint32_t cid = resp->collection_id;
    if (resp->ctx.rc == LCB_SUCCESS) {
        instance->collcache->put(ctx->path_, cid);
        ctx->cmd_->cid = cid;
    } else {
        lcb_log((instance)->settings, "collcache", LCB_LOG_DEBUG, __FILE__, __LINE__,
                "failed to resolve collection, rc: %s", lcb_strerror_short(resp->ctx.rc));
    }
    ctx->op_(resp, ctx->cmd_);
    delete ctx;
}

template <typename Command, typename Operation, typename Destructor>
static void handle_collcache_schedfail(mc_PACKET *pkt)
{
    delete static_cast<GetCidCtx<Command, Operation, Destructor> *>(pkt->u_rdata.exdata);
}

template <typename Command, typename Operation, typename Destructor>
mc_REQDATAPROCS GetCidCtx<Command, Operation, Destructor>::proctable = {
    handle_collcache_proc<Command, Operation, Destructor>, handle_collcache_schedfail<Command, Operation, Destructor>};

template <typename Command, typename Operation, typename Duplicator, typename Destructor>
lcb_STATUS collcache_resolve(lcb_INSTANCE *instance, Command cmd, Operation op, Duplicator dup, Destructor dtor)
{
    using MutableCommand = typename std::remove_const<typename std::remove_pointer<Command>::type>::type *;

    if (LCBT_SETTING(instance, conntype) != LCB_TYPE_BUCKET) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    if (!LCBT_SETTING(instance, use_collections)) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }

    std::string spec = collcache_build_spec(cmd->scope, cmd->nscope, cmd->collection, cmd->ncollection);

    mc_CMDQUEUE *cq = &instance->cmdq;
    if (cq->config == nullptr) {
        return LCB_ERR_NO_CONFIGURATION;
    }

    int vbid, idx;
    mcreq_map_key(cq, &cmd->key, MCREQ_PKT_BASESIZE, &vbid, &idx);
    if (idx < 0) {
        return LCB_ERR_NO_MATCHING_SERVER;
    }
    mc_PIPELINE *pl = cq->pipelines[idx];
    mc_PACKET *pkt = mcreq_allocate_packet(pl);
    if (!pkt) {
        return LCB_ERR_NO_MEMORY;
    }
    mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);
    pkt->flags |= MCREQ_F_NOCID;
    protocol_binary_request_header hdr{};
    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.opcode = PROTOCOL_BINARY_CMD_COLLECTIONS_GET_CID;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.opaque = pkt->opaque;
    hdr.request.keylen = 0;
    hdr.request.bodylen = htonl(spec.size());
    mcreq_write_hdr(pkt, &hdr);
    mcreq_reserve_value2(pl, pkt, spec.size());
    memcpy(SPAN_BUFFER(&pkt->u_value.single), spec.data(), spec.size());

    MutableCommand clone{};
    dup(cmd, &clone);
    pkt->u_rdata.exdata = make_cid_ctx(spec, op, clone, dtor);
    pkt->u_rdata.exdata->start = gethrtime();
    pkt->u_rdata.exdata->deadline =
        pkt->u_rdata.exdata->start + LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));
    pkt->flags |= MCREQ_F_REQEXT;

    LCB_SCHED_ADD(instance, pl, pkt)
    return LCB_SUCCESS;
}

template <typename Command, typename CommandScheduler>
lcb_STATUS collcache_resolve(lcb_INSTANCE *instance, std::shared_ptr<Command> cmd, CommandScheduler scheduler)
{
    if (LCBT_SETTING(instance, conntype) != LCB_TYPE_BUCKET) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    if (!LCBT_SETTING(instance, use_collections)) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }

    const std::string &spec = cmd->collection().spec();

    mc_CMDQUEUE *cq = &instance->cmdq;
    if (cq->config == nullptr) {
        return LCB_ERR_NO_CONFIGURATION;
    }

    int vbid, idx;
    lcb_KEYBUF keybuf{LCB_KV_COPY, {cmd->key().c_str(), cmd->key().size()}};
    mcreq_map_key(cq, &keybuf, MCREQ_PKT_BASESIZE, &vbid, &idx);
    if (idx < 0) {
        return LCB_ERR_NO_MATCHING_SERVER;
    }
    mc_PIPELINE *pl = cq->pipelines[idx];
    mc_PACKET *pkt = mcreq_allocate_packet(pl);
    if (!pkt) {
        return LCB_ERR_NO_MEMORY;
    }
    mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);
    pkt->flags |= MCREQ_F_NOCID;
    protocol_binary_request_header hdr{};
    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.opcode = PROTOCOL_BINARY_CMD_COLLECTIONS_GET_CID;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.opaque = pkt->opaque;
    hdr.request.keylen = 0;
    hdr.request.bodylen = htonl(spec.size());
    mcreq_write_hdr(pkt, &hdr);
    mcreq_reserve_value2(pl, pkt, spec.size());
    memcpy(SPAN_BUFFER(&pkt->u_value.single), spec.data(), spec.size());

    pkt->u_rdata.exdata = lcb::make_deferred_command_context<Command, lcb_RESPGETCID>(
        cmd, [instance, scheduler](lcb_STATUS rc, const lcb_RESPGETCID *resp, std::shared_ptr<Command> operation) {
            if (resp->ctx.rc == LCB_SUCCESS) {
                auto &collection = operation->collection();
                instance->collcache->put(collection.spec(), resp->collection_id);
                collection.collection_id(resp->collection_id);
            } else {
                lcb_log((instance)->settings, "collcache", LCB_LOG_DEBUG, __FILE__, __LINE__,
                        "failed to resolve collection, rc: %s", lcb_strerror_short(resp->ctx.rc));
            }
            scheduler(rc, resp, operation);
        });
    pkt->u_rdata.exdata->deadline =
        pkt->u_rdata.exdata->start +
        cmd->timeout_or_default_in_nanoseconds(LCB_US2NS(LCBT_SETTING(instance, operation_timeout)));
    pkt->flags |= MCREQ_F_REQEXT;

    LCB_SCHED_ADD(instance, pl, pkt)
    return LCB_SUCCESS;
}

#else
typedef struct lcb_CollectionCache_st lcb_COLLCACHE;
#endif

#endif
