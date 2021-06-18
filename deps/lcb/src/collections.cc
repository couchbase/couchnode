/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018-2020 Couchbase, Inc.
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
#include "settings.h"
#include "internal.h"
#include "collections.h"
#include "mcserver/negotiate.h"

#include <string>

#include "capi/cmd_getcid.hh"
#include "capi/cmd_getmanifest.hh"

#define LOGARGS(instance, lvl) (instance)->settings, "c9smgmt", LCB_LOG_##lvl, __FILE__, __LINE__

namespace lcb
{
CollectionCache::CollectionCache()
{
    static const std::string default_collection("_default._default");
    put(default_collection, 0);
}

std::string CollectionCache::id_to_name(uint32_t cid)
{
    std::map<uint32_t, std::string>::const_iterator pos = cache_i2n.find(cid);
    if (pos != cache_i2n.end()) {
        return pos->second;
    }
    return "";
}

bool CollectionCache::get(const std::string &path, uint32_t *cid)
{
    std::map<std::string, uint32_t>::const_iterator pos = cache_n2i.find(path);
    if (pos != cache_n2i.end()) {
        *cid = pos->second;
        return true;
    }
    return false;
}

void CollectionCache::put(const std::string &path, uint32_t cid)
{
    cache_n2i[path] = cid;
    cache_i2n[cid] = path;
}

void CollectionCache::erase(uint32_t cid)
{
    auto pos = cache_i2n.find(cid);
    if (pos != cache_i2n.end()) {
        cache_n2i.erase(pos->second);
        cache_i2n.erase(pos);
    }
}
} // namespace lcb

std::string collcache_build_spec(const char *scope, size_t nscope, const char *collection, size_t ncollection)
{
    std::string spec;
    if (scope && nscope) {
        spec.append(scope, nscope);
    } else {
        spec.append("_default");
    }
    spec.append(".");
    if (collection && ncollection) {
        spec.append(collection, ncollection);
    } else {
        spec.append("_default");
    }
    return spec;
}

lcb_STATUS collcache_get(lcb_INSTANCE *instance, const char *scope, size_t nscope, const char *collection,
                         size_t ncollection, uint32_t *cid)
{
    if (LCBT_SETTING(instance, conntype) != LCB_TYPE_BUCKET) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    if (!LCBT_SETTING(instance, use_collections)) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }

    std::string spec = collcache_build_spec(scope, nscope, collection, ncollection);
    if (instance->collcache->get(spec, cid)) {
        return LCB_SUCCESS;
    }
    return LCB_ERR_COLLECTION_NOT_FOUND;
}

lcb_STATUS collcache_get(lcb_INSTANCE *instance, lcb::collection_qualifier &collection)
{
    uint32_t collection_id;
    lcb_STATUS rc = collcache_get(instance, collection.scope().c_str(), collection.scope().size(),
                                  collection.collection().c_str(), collection.collection().size(), &collection_id);
    if (rc != LCB_SUCCESS) {
        return rc;
    }
    collection.collection_id(collection_id);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetmanifest_status(const lcb_RESPGETMANIFEST *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetmanifest_cookie(const lcb_RESPGETMANIFEST *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetmanifest_value(const lcb_RESPGETMANIFEST *resp, const char **json,
                                                      size_t *json_len)
{
    *json = resp->value;
    *json_len = resp->nvalue;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetmanifest_create(lcb_CMDGETMANIFEST **cmd)
{
    *cmd = (lcb_CMDGETMANIFEST *)calloc(1, sizeof(lcb_CMDGETMANIFEST));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetmanifest_destroy(lcb_CMDGETMANIFEST *cmd)
{
    free(cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetmanifest_timeout(lcb_CMDGETMANIFEST *cmd, uint32_t timeout)
{
    cmd->timeout = timeout;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_getmanifest(lcb_INSTANCE *instance, void *cookie, const lcb_CMDGETMANIFEST *cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    if (cq->config == nullptr) {
        return LCB_ERR_NO_CONFIGURATION;
    }
    if (!LCBT_SETTING(instance, use_collections)) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    if (cq->npipelines < 1) {
        return LCB_ERR_NO_MATCHING_SERVER;
    }
    mc_PIPELINE *pl = cq->pipelines[0];

    mc_PACKET *pkt = mcreq_allocate_packet(pl);
    if (!pkt) {
        return LCB_ERR_NO_MEMORY;
    }
    mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);

    protocol_binary_request_header hdr{};
    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.opcode = PROTOCOL_BINARY_CMD_COLLECTIONS_GET_MANIFEST;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.opaque = pkt->opaque;
    memcpy(SPAN_BUFFER(&pkt->kh_span), hdr.bytes, sizeof(hdr.bytes));

    pkt->u_rdata.reqdata.cookie = cookie;
    pkt->u_rdata.reqdata.start = gethrtime();
    pkt->u_rdata.reqdata.deadline =
        pkt->u_rdata.reqdata.start + LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));

    LCB_SCHED_ADD(instance, pl, pkt)
    (void)cmd;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetcid_status(const lcb_RESPGETCID *resp)
{
    return resp->ctx.rc;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetcid_scoped_collection(const lcb_RESPGETCID *resp, const char **name,
                                                             size_t *name_len)
{
    *name = resp->ctx.key.c_str();
    *name_len = resp->ctx.key.size();
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetcid_collection_id(const lcb_RESPGETCID *resp, uint32_t *id)
{
    *id = resp->collection_id;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetcid_manifest_id(const lcb_RESPGETCID *resp, uint64_t *id)
{
    *id = resp->manifest_id;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_respgetcid_cookie(const lcb_RESPGETCID *resp, void **cookie)
{
    *cookie = resp->cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetcid_create(lcb_CMDGETCID **cmd)
{
    *cmd = (lcb_CMDGETCID *)calloc(1, sizeof(lcb_CMDGETCID));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetcid_destroy(lcb_CMDGETCID *cmd)
{
    free(cmd);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetcid_timeout(lcb_CMDGETCID *cmd, uint32_t timeout)
{
    cmd->timeout = timeout;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetcid_scope(lcb_CMDGETCID *cmd, const char *scope, size_t scope_len)
{
    cmd->scope = scope;
    cmd->nscope = scope_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_cmdgetcid_collection(lcb_CMDGETCID *cmd, const char *collection, size_t collection_len)
{
    cmd->collection = collection;
    cmd->ncollection = collection_len;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_getcid(lcb_INSTANCE *instance, void *cookie, const lcb_CMDGETCID *cmd)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    if (cq->config == nullptr) {
        return LCB_ERR_NO_CONFIGURATION;
    }
    if (!LCBT_SETTING(instance, use_collections)) {
        return LCB_ERR_UNSUPPORTED_OPERATION;
    }
    if (cmd->nscope == 0 || cmd->scope == nullptr || cmd->ncollection == 0 || cmd->collection == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    if (cq->npipelines < 1) {
        return LCB_ERR_NO_MATCHING_SERVER;
    }
    mc_PIPELINE *pl = cq->pipelines[0];

    mc_PACKET *pkt = mcreq_allocate_packet(pl);
    if (!pkt) {
        return LCB_ERR_NO_MEMORY;
    }
    mcreq_reserve_header(pl, pkt, MCREQ_PKT_BASESIZE);

    std::string path;
    path.append(cmd->scope, cmd->nscope);
    path.append(".");
    path.append(cmd->collection, cmd->ncollection);

    pkt->flags |= MCREQ_F_NOCID;
    protocol_binary_request_header hdr{};
    hdr.request.magic = PROTOCOL_BINARY_REQ;
    hdr.request.opcode = PROTOCOL_BINARY_CMD_COLLECTIONS_GET_CID;
    hdr.request.datatype = PROTOCOL_BINARY_RAW_BYTES;
    hdr.request.opaque = pkt->opaque;
    hdr.request.keylen = 0;
    hdr.request.bodylen = htonl(path.size());
    mcreq_write_hdr(pkt, &hdr);
    mcreq_reserve_value2(pl, pkt, path.size());
    memcpy(SPAN_BUFFER(&pkt->u_value.single), path.data(), path.size());

    pkt->u_rdata.reqdata.cookie = cookie;
    pkt->u_rdata.reqdata.start = gethrtime();
    pkt->u_rdata.reqdata.deadline =
        pkt->u_rdata.reqdata.start + LCB_US2NS(cmd->timeout ? cmd->timeout : LCBT_SETTING(instance, operation_timeout));

    LCB_SCHED_ADD(instance, pl, pkt)
    return LCB_SUCCESS;
}
