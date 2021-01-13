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

#include "rnd.h"
#include "internal.h"

#include <random>

LCB_INTERNAL_API
lcb_U32 lcb_next_rand32(void)
{
    static thread_local std::mt19937 gen{std::random_device{}()};
    std::uniform_int_distribution<lcb_U32> dis;
    return dis(gen);
}

LCB_INTERNAL_API
lcb_U64 lcb_next_rand64(void)
{
    static thread_local std::mt19937 gen{std::random_device{}()};
    std::uniform_int_distribution<lcb_U64> dis;
    return dis(gen);
}
