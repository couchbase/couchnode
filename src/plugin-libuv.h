/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#ifndef LCB_PLUGIN_UV_H
#define LCB_PLUGIN_UV_H
#ifdef __cplusplus
extern "C" {
#endif

#include <libcouchbase/couchbase.h>
#include <uv.h>

lcb_error_t create_libuv_io_opts(lcb_io_opt_t *io);

#ifdef __cplusplus
}
#endif
#endif
