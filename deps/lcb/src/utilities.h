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

#ifndef LIBCOUCHBASE_UTILITIES_H
#define LIBCOUCHBASE_UTILITIES_H 1

#include "config.h"

#ifdef __cplusplus
#include <string>
#include <vector>

namespace lcb
{
namespace flexible_framing_extras
{
lcb_STATUS encode_impersonate_user(const std::string &username, std::vector<std::uint8_t> &flexible_framing_extras);

lcb_STATUS encode_impersonate_users_extra_privilege(const std::string &privilege,
                                                    std::vector<std::uint8_t> &flexible_framing_extras);
} // namespace flexible_framing_extras
} // namespace lcb

extern "C" {
#endif

/**
 * Added to avoid triggering unexpected behaviour of strdup from stdlib.
 * See https://stackoverflow.com/questions/8359966/strdup-returning-address-out-of-bounds
 *
 * All usages have to be replaced with std::string eventually.
 *
 * @private
 */
LCB_INTERNAL_API
char *lcb_strdup(const char *);

#ifdef __cplusplus
}
#endif

#endif
