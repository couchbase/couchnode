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

#ifdef LCBUV_EMBEDDED_SOURCE
#define LCBUV_API
#else
#define LCBUV_API LIBCOUCHBASE_API
#endif

    typedef struct lcbuv_options_st {
        int version;
        union {
            struct {
                /** External loop to be used (if not default) */
                uv_loop_t *loop;

                /** Whether run_event_loop/stop_event_loop should do anything */
                int startsop_noop;
            } v0;
        } v;
    } lcbuv_options_t;

    /**
     * Use this if using an existing uv_loop_t
     * @param io a pointer to an io pointer. Will be populated on success
     * @param loop a uv_loop_t. You may use 'NULL', in which case the default
     * @param options the options to be passed. From libcouchbase this is a
     * 'void' parameter.
     */
    LCBUV_API
    lcb_error_t lcb_create_libuv_io_opts(int version,
                                         lcb_io_opt_t *io,
                                         lcbuv_options_t *options);

#ifdef __cplusplus
}
#endif
#endif
