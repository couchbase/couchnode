/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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

#include <include/memcached/protocol_binary.h>
#include "internal.h"

static lcb_RETRY_REASON mc_code_to_reason(lcb_STATUS status)
{
    switch (status) {
        case LCB_ERR_TOPOLOGY_CHANGE:
        case LCB_ERR_NOT_MY_VBUCKET:
            return LCB_RETRY_REASON_KV_NOT_MY_VBUCKET;
        case LCB_ERR_COLLECTION_NOT_FOUND:
        case LCB_ERR_SCOPE_NOT_FOUND:
            return LCB_RETRY_REASON_KV_COLLECTION_OUTDATED;
        case LCB_ERR_DOCUMENT_LOCKED:
            return LCB_RETRY_REASON_KV_LOCKED;
        case LCB_ERR_TEMPORARY_FAILURE:
            return LCB_RETRY_REASON_KV_TEMPORARY_FAILURE;
        case LCB_ERR_DURABLE_WRITE_IN_PROGRESS:
            return LCB_RETRY_REASON_KV_SYNC_WRITE_IN_PROGRESS;
        case LCB_ERR_DURABLE_WRITE_RE_COMMIT_IN_PROGRESS:
            return LCB_RETRY_REASON_KV_SYNC_WRITE_RE_COMMIT_IN_PROGRESS;
        case LCB_ERR_CANNOT_GET_PORT:
        case LCB_ERR_SOCKET_SHUTDOWN:
        case LCB_ERR_NETWORK:
        case LCB_ERR_CONNECTION_REFUSED:
        case LCB_ERR_CONNECTION_RESET:
        case LCB_ERR_FD_LIMIT_REACHED:
            return LCB_RETRY_REASON_SOCKET_NOT_AVAILABLE;
        case LCB_ERR_NAMESERVER:
        case LCB_ERR_NODE_UNREACHABLE:
        case LCB_ERR_CONNECT_ERROR:
        case LCB_ERR_UNKNOWN_HOST:
            return LCB_RETRY_REASON_NODE_NOT_AVAILABLE;
        default:
            return LCB_RETRY_REASON_UNKNOWN;
    }
}

static int mc_is_idempotent(uint8_t opcode)
{
    switch (opcode) {
        case PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG:
        case PROTOCOL_BINARY_CMD_GET:
        case PROTOCOL_BINARY_CMD_SUBDOC_MULTI_LOOKUP:
        case PROTOCOL_BINARY_CMD_GET_REPLICA:
        case PROTOCOL_BINARY_CMD_COLLECTIONS_GET_CID:
        case PROTOCOL_BINARY_CMD_COLLECTIONS_GET_MANIFEST:
        case PROTOCOL_BINARY_CMD_NOOP:
        case PROTOCOL_BINARY_CMD_OBSERVE:
        case PROTOCOL_BINARY_CMD_OBSERVE_SEQNO:
            return 1;
        default:
            return 0;
    }
}

lcb_RETRY_ACTION lcb_kv_should_retry(const lcb_settings *settings, const mc_PACKET *pkt, lcb_STATUS err)
{
    protocol_binary_request_header hdr;

    mcreq_read_hdr(pkt, &hdr);

    lcb_RETRY_REASON retry_reason = mc_code_to_reason(err);
    lcb_RETRY_REQUEST retry_req;
    retry_req.operation_cookie = const_cast<void *>(MCREQ_PKT_COOKIE(pkt));
    retry_req.is_idempotent = mc_is_idempotent(hdr.request.opcode);
    retry_req.retry_attempts = pkt->retries;
    lcb_RETRY_ACTION retry_action{};

    if (err == LCB_ERR_AUTHENTICATION_FAILURE || err == LCB_ERR_TOPOLOGY_CHANGE || err == LCB_ERR_BUCKET_NOT_FOUND) {
        /* spurious auth error */
        /* special, topology change */
        retry_action.should_retry = 1;
    } else if (err == LCB_ERR_TIMEOUT || err == LCB_ERR_MAP_CHANGED || retry_reason == LCB_RETRY_REASON_UNKNOWN) {
        /* We can't exceed a timeout for ETIMEDOUT
         * MAP_CHANGED is sent after we've already called this function on the packet once before
         * Don't retry operations with status code that maps to unknown reason, as it is not specified in RFC */
        retry_action.should_retry = 0;
    } else if (lcb_retry_reason_is_always_retry(retry_reason)) {
        retry_action.should_retry = 1;
    } else {
        retry_action = settings->retry_strategy(&retry_req, retry_reason);
    }

    return retry_action;
}
