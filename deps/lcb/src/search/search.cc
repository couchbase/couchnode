/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2020 Couchbase, Inc.
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

#include <string>
#include <memory>

#include <libcouchbase/couchbase.h>
#include "internal.h"
#include "http/http.h"
#include "defer.h"

#include "search/search_handle.hh"

#define LOGFMT "(FTR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) req->instance->settings, "search", LCB_LOG_##lvl, __FILE__, __LINE__

static lcb_STATUS search_validate(lcb_INSTANCE * /* instance */, const lcb_CMDSEARCH *cmd)
{
    if (!cmd->has_callback()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    return LCB_SUCCESS;
}

static lcb_STATUS search_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDSEARCH> cmd)
{

    auto *req = new lcb_SEARCH_HANDLE_(instance, cmd->cookie(), cmd.get());
    if (req->has_error()) {
        lcb_STATUS rc = req->last_error();
        req->clear_callback();
        delete req;
        return rc;
    }
    cmd->handle(req);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_search(lcb_INSTANCE *instance, void *cookie, const lcb_CMDSEARCH *command)
{
    lcb_STATUS err = search_validate(instance, command);
    if (err != LCB_SUCCESS) {
        return err;
    }

    auto cmd = std::make_shared<lcb_CMDSEARCH>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            lcb_SEARCH_CALLBACK operation_callback = cmd->callback();
            lcb_RESPSEARCH response{};
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, LCB_CALLBACK_SEARCH, &response);
                return;
            }
            response.ctx.rc = search_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, LCB_CALLBACK_SEARCH, &response);
            }
        });
    }
    return search_execute(instance, cmd);
}

LIBCOUCHBASE_API lcb_STATUS lcb_search_cancel(lcb_INSTANCE * /* instance */, lcb_SEARCH_HANDLE *handle)
{
    if (handle) {
        return handle->cancel();
    }
    return LCB_SUCCESS;
}
