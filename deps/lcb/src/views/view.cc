/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2021 Couchbase, Inc.
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

#include "view_handle.hh"
#include "sllist-inl.h"
#include "http/http.h"
#include "internal.h"

#include "defer.h"

#define MAX_GET_URI_LENGTH 2048

static lcb_STATUS view_validate(lcb_INSTANCE * /* instance */, const lcb_CMDVIEW *cmd)
{
    if (!cmd->has_callback() || cmd->view_or_design_document_empty()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    if (cmd->include_documents() && cmd->do_not_parse_rows()) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }

    if (cmd->option_string().size() > MAX_GET_URI_LENGTH) {
        return LCB_ERR_VALUE_TOO_LARGE;
    }

    return LCB_SUCCESS;
}

static lcb_STATUS view_execute(lcb_INSTANCE *instance, std::shared_ptr<lcb_CMDVIEW> cmd)
{

    auto *req = new lcb_VIEW_HANDLE_(instance, cmd->cookie(), cmd.get());
    if (req->has_error()) {
        lcb_STATUS err = req->last_error();
        req->cancel();
        delete req;
        return err;
    }

    cmd->handle(req);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcb_view(lcb_INSTANCE *instance, void *cookie, const lcb_CMDVIEW *command)
{
    lcb_STATUS err = view_validate(instance, command);
    if (err != LCB_SUCCESS) {
        return err;
    }

    auto cmd = std::make_shared<lcb_CMDVIEW>(*command);
    cmd->cookie(cookie);

    if (instance->cmdq.config == nullptr) {
        return lcb::defer_operation(instance, [instance, cmd](lcb_STATUS status) {
            lcb_VIEW_CALLBACK operation_callback = cmd->callback();
            lcb_RESPVIEW response{};
            response.cookie = cmd->cookie();
            if (status == LCB_ERR_REQUEST_CANCELED) {
                response.ctx.rc = status;
                operation_callback(instance, LCB_CALLBACK_VIEWQUERY, &response);
                return;
            }
            response.ctx.rc = view_execute(instance, cmd);
            if (response.ctx.rc != LCB_SUCCESS) {
                operation_callback(instance, LCB_CALLBACK_VIEWQUERY, &response);
            }
        });
    }
    return view_execute(instance, cmd);
}

LIBCOUCHBASE_API
lcb_STATUS lcb_view_cancel(lcb_INSTANCE * /* instance */, lcb_VIEW_HANDLE *handle)
{
    handle->cancel();
    return LCB_SUCCESS;
}
