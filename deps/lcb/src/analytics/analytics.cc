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
#include "auth-priv.h"
#include "http/http.h"
#include <list>
#include "defer.h"

#include "analytics_handle.hh"

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) req->instance->settings, "analytics", LCB_LOG_##lvl, __FILE__, __LINE__

using namespace lcb;

static lcb_STATUS analytics_validate(lcb_INSTANCE * /* instance */, const lcb_CMDANALYTICS *cmd)
{
    if (cmd->empty_statement_and_root_object() || !cmd->has_callback()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return LCB_SUCCESS;
}

static lcb_STATUS analytics_schedule(lcb_INSTANCE * /* instance */, lcb_ANALYTICS_HANDLE_ *req)
{
    if (req->has_error()) {
        return req->last_error();
    }

    return req->issue_htreq();
}

static lcb_STATUS analytics_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDANALYTICS> cmd)
{
    auto *req = new lcb_ANALYTICS_HANDLE_(instance, cmd->cookie(), cmd.get());
    lcb_STATUS err = analytics_schedule(instance, req);
    if (err != LCB_SUCCESS) {
        req->clear_callback();
        req->unref();
        return err;
    }

    cmd->handle(req);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_analytics(lcb_INSTANCE *instance, void *cookie, const lcb_CMDANALYTICS *command)
{
    lcb_STATUS err = analytics_validate(instance, command);
    if (err != LCB_SUCCESS) {
        return err;
    }

    auto cmd = std::make_shared<lcb_CMDANALYTICS>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            lcb_ANALYTICS_CALLBACK operation_callback = cmd->callback();
            lcb_RESPANALYTICS response{};
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, LCB_CALLBACK_ANALYTICS, &response);
                return;
            }
            response.ctx.rc = analytics_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, LCB_CALLBACK_ANALYTICS, &response);
            }
        });
    }
    return analytics_execute(instance, cmd);
}

LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_poll(lcb_INSTANCE *instance, void *cookie, lcb_DEFERRED_HANDLE *handle)
{
    if (handle->callback == nullptr || handle->handle.empty()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    auto *req = new lcb_ANALYTICS_HANDLE_(instance, cookie, handle);
    lcb_STATUS err = analytics_schedule(instance, req);
    if (err != LCB_SUCCESS) {
        req->clear_callback();
        req->unref();
        return err;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_analytics_cancel(lcb_INSTANCE * /* instance */, lcb_ANALYTICS_HANDLE *handle)
{
    if (handle) {
        return handle->cancel();
    }
    return LCB_SUCCESS;
}
