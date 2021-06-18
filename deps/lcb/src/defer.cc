/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2021 Couchbase, Inc.
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
#include "defer.h"

namespace lcb
{
lcb_STATUS defer_operation(lcb_INSTANCE *instance, std::function<void(lcb_STATUS)> operation)
{
    if (instance == nullptr || instance->deferred_operations == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    instance->deferred_operations->emplace_back(std::move(operation));
    return LCB_SUCCESS;
}

void execute_deferred_operations(lcb_INSTANCE *instance)
{
    if (instance == nullptr || instance->deferred_operations == nullptr) {
        return;
    }
    if (instance->settings->conntype != LCB_TYPE_BUCKET) {
        return;
    }

    while (instance->has_deferred_operations()) {
        auto operation = instance->deferred_operations->front();
        instance->deferred_operations->pop_front();
        operation(LCB_SUCCESS);
    }
}

void cancel_deferred_operations(lcb_INSTANCE *instance)
{
    if (instance == nullptr || instance->deferred_operations == nullptr) {
        return;
    }
    while (instance->has_deferred_operations()) {
        auto operation = instance->deferred_operations->front();
        instance->deferred_operations->pop_front();
        operation(LCB_ERR_REQUEST_CANCELED);
    }
}
} // namespace lcb
