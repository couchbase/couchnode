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

#ifndef LCB_DEFER_H
#define LCB_DEFER_H

#ifdef __cplusplus
#include <functional>

namespace lcb
{
lcb_STATUS defer_operation(lcb_INSTANCE *instance, std::function<void(lcb_STATUS)> operation);
void execute_deferred_operations(lcb_INSTANCE *instance);
void cancel_deferred_operations(lcb_INSTANCE *instance);
} // namespace lcb

#endif

#endif
