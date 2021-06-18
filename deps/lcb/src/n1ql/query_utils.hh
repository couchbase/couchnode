/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2021 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_N1QL_QUERY_UTILS_HH
#define LIBCOUCHBASE_N1QL_QUERY_UTILS_HH

#include <cstddef>
#include <cstdint>
#include <chrono>
#include <string>
#include <stdexcept>

/**
 * @private
 */
class lcb_duration_parse_error : public std::runtime_error
{
  public:
    explicit lcb_duration_parse_error(const std::string &msg) : std::runtime_error(msg) {}
};

/**
 * @private
 */
std::chrono::nanoseconds lcb_parse_golang_duration(const std::string &text);

#endif // LIBCOUCHBASE_N1QL_QUERY_UTILS_HH
