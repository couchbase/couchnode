/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 - 2013 Couchbase, Inc.
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

/**
 * This file contains various debug functionality
 */
#ifndef LIBCOUCHBASE_DEBUG_H
#define LIBCOUCHBASE_DEBUG_H 1

#include <libcouchbase/couchbase.h>

#ifdef __cplusplus
#include <iostream>

LIBCOUCHBASE_API
extern std::ostream &operator <<(std::ostream &out,
                                 const lcb_http_type_t type);

LIBCOUCHBASE_API
extern std::ostream &operator <<(std::ostream &out,
                                 const lcb_http_method_t method);
LIBCOUCHBASE_API
extern std::ostream &operator <<(std::ostream &out, const lcb_http_cmd_t &cmd);

LIBCOUCHBASE_API
extern std::ostream &operator <<(std::ostream &out, const lcb_error_t op);

LIBCOUCHBASE_API
extern std::ostream &operator <<(std::ostream &out, const lcb_datatype_t op);

LIBCOUCHBASE_API
extern std::ostream &operator <<(std::ostream &out, const lcb_storage_t op);

LIBCOUCHBASE_API
extern std::ostream &operator <<(std::ostream &out, const lcb_store_cmd_t &cmd);

extern "C" {
#endif


#ifdef __cplusplus
}
#endif

#endif
