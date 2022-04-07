/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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

#include <memory>

#include <libcouchbase/couchbase.h>
#include "internal.h"
#include "http/http.h"
#include "logging.h"

#include "query_handle.hh"
#include "defer.h"

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) (req)->instance_->settings, "n1ql", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGARGS2(req, lvl) (instance)->settings, "n1qlh", LCB_LOG_##lvl, __FILE__, __LINE__

static lcb_RETRY_REASON query_code_to_reason(lcb_STATUS err)
{
    switch (err) {
        case LCB_ERR_PREPARED_STATEMENT_FAILURE:
            return LCB_RETRY_REASON_QUERY_PREPARED_STATEMENT_FAILURE;
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

lcb_RETRY_ACTION lcb_query_should_retry(const lcb_settings *settings, lcb_QUERY_HANDLE *query, lcb_STATUS err,
                                        int retry_attribute)
{
    lcb_RETRY_ACTION retry_action{};
    lcb_RETRY_REASON retry_reason = query_code_to_reason(err);
    if (retry_attribute) {
        retry_reason = LCB_RETRY_REASON_QUERY_ERROR_RETRYABLE;
    }
    if (err == LCB_ERR_TIMEOUT) {
        /* We can't exceed a timeout for ETIMEDOUT */
        retry_action.should_retry = 0;
    } else if (err == LCB_ERR_AUTHENTICATION_FAILURE || lcb_retry_reason_is_always_retry(retry_reason)) {
        retry_action.should_retry = 1;
    } else {
        lcb_RETRY_REQUEST retry_req;
        retry_req.operation_cookie = query->cookie();
        retry_req.is_idempotent = query->is_idempotent();
        retry_req.retry_attempts = query->retry_attempts();
        retry_action = settings->retry_strategy(&retry_req, retry_reason);
    }
    return retry_action;
}

static lcb_STATUS query_validate(lcb_INSTANCE * /* instance */, const lcb_CMDQUERY *cmd)
{
    if (cmd->empty_statement_and_root_object() || !cmd->has_callback()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return LCB_SUCCESS;
}

static lcb_STATUS query_schedule(lcb_INSTANCE *instance, lcb_QUERY_HANDLE_ *req)
{
    if (req->has_error()) {
        return req->last_error();
    }
    if (req->use_prepcache()) {
        if (req->statement().empty()) {
            return LCB_ERR_INVALID_ARGUMENT;
        }

        const Plan *cached = req->cache().get_entry(req->statement());
        if (cached != nullptr) {
            lcb_STATUS rc = req->apply_plan(*cached);
            if (rc != LCB_SUCCESS) {
                return rc;
            }
        } else {
            lcb_log(LOGARGS2(instance, DEBUG), LOGFMT "No cached plan found. Issuing prepare", LOGID(req));
            lcb_STATUS rc = req->request_plan();
            if (rc != LCB_SUCCESS) {
                return rc;
            }
        }
    } else {
        // No prepare
        lcb_STATUS rc = req->issue_htreq();
        if (rc != LCB_SUCCESS) {
            return rc;
        }
    }
    return LCB_SUCCESS;
}

static lcb_STATUS query_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDQUERY> cmd)
{
    auto req = new lcb_QUERY_HANDLE_(instance, cmd->cookie(), cmd.get());
    lcb_STATUS err = query_schedule(instance, req);
    if (err != LCB_SUCCESS) {
        req->clear_callback();
        delete req;
        return err;
    }

    cmd->handle(req);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_query(lcb_INSTANCE *instance, void *cookie, const lcb_CMDQUERY *command)
{
    lcb_STATUS err = query_validate(instance, command);
    if (err != LCB_SUCCESS) {
        return err;
    }

    auto cmd = std::make_shared<lcb_CMDQUERY>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            lcb_QUERY_CALLBACK operation_callback = cmd->callback();
            lcb_RESPQUERY response{};
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, LCB_CALLBACK_QUERY, &response);
                return;
            }
            response.ctx.rc = query_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, LCB_CALLBACK_QUERY, &response);
            }
        });
    }
    return query_execute(instance, cmd);
}

LIBCOUCHBASE_API lcb_STATUS lcb_query_cancel(lcb_INSTANCE * /* instance */, lcb_QUERY_HANDLE *handle)
{
    // Note that this function is just an elaborate way to nullify the
    // callback. We are very particular about _not_ cancelling the underlying
    // http request, because the handle's deletion is controlled
    // from the HTTP callback, which checks if the callback is nullptr before
    // deleting.
    // at worst, deferring deletion to the http response might cost a few
    // extra network reads; whereas this function itself is intended as a
    // bailout for unexpected destruction.

    if (handle) {
        return handle->cancel();
    }
    return LCB_SUCCESS;
}
