/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
 * A function used to check for the size of structures.
 *
 * Remember to add support for "old" structs when we bump the version
 * number for one of the structs...
 */
#include "internal.h"

struct entry {
    lcb_uint32_t v;
    lcb_size_t s;
};

static const struct entry sizes[] = {
    { LCB_C_ST_V, sizeof(struct lcb_create_st) },
    { LCB_C_I_O_ST_V, sizeof(struct lcb_create_io_ops_st) },
    { LCB_G_C_ST_V, sizeof(struct lcb_get_cmd_st) },
    { LCB_G_R_C_ST_V, sizeof(struct lcb_get_replica_cmd_st) },
    { LCB_U_C_ST_V, sizeof(struct lcb_unlock_cmd_st) },
    { LCB_T_C_ST_V, sizeof(lcb_touch_cmd_t) },
    { LCB_S_C_ST_V, sizeof(struct lcb_store_cmd_st) },
    { LCB_A_C_ST_V, sizeof(struct lcb_arithmetic_cmd_st) },
    { LCB_O_C_ST_V, sizeof(struct lcb_observe_cmd_st) },
    { LCB_R_C_ST_V, sizeof(struct lcb_remove_cmd_st) },
    { LCB_H_C_ST_V, sizeof(struct lcb_http_cmd_st) },
    { LCB_S_S_C_ST_V, sizeof(struct lcb_server_stats_cmd_st) },
    { LCB_S_V_C_ST_V, sizeof(struct lcb_server_version_cmd_st) },
    { LCB_V_C_ST_V, sizeof(struct lcb_verbosity_cmd_st) },
    { LCB_F_C_ST_V, sizeof(struct lcb_flush_cmd_st) },
    { LCB_G_R_ST_V, sizeof(lcb_get_resp_t) },
    { LCB_S_R_ST_V, sizeof(lcb_store_resp_t) },
    { LCB_R_R_ST_V, sizeof(lcb_remove_resp_t) },
    { LCB_T_R_ST_V, sizeof(lcb_touch_resp_t) },
    { LCB_U_R_ST_V, sizeof(lcb_unlock_resp_t) },
    { LCB_A_R_ST_V, sizeof(lcb_arithmetic_resp_t) },
    { LCB_O_R_ST_V, sizeof(lcb_observe_resp_t) },
    { LCB_H_R_ST_V, sizeof(lcb_http_resp_t) },
    { LCB_S_S_R_ST_V, sizeof(lcb_server_stat_resp_t) },
    { LCB_S_V_R_ST_V, sizeof(lcb_server_version_resp_t) },
    { LCB_V_R_ST_V, sizeof(lcb_verbosity_resp_t) },
    { LCB_F_R_ST_V, sizeof(lcb_flush_resp_t) }
};

LIBCOUCHBASE_API
lcb_error_t lcb_verify_struct_size(lcb_uint32_t id, lcb_uint32_t version,
                                   lcb_size_t size)
{
    if (id > LCB_ST_M || version > sizes[id].v || size != sizes[id].s) {
        return LCB_EINVAL;
    }

    return LCB_SUCCESS;
}
