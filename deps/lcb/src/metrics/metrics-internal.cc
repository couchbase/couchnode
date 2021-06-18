/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2020 Couchbase, Inc.
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

#include "internal.h"
#include "capi/cmd_store.hh"

const char *op_name_from_store_operation(lcb_STORE_OPERATION operation)
{
    switch (operation) {
        case LCB_STORE_INSERT:
            return "insert";
        case LCB_STORE_REPLACE:
            return "replace";
        case LCB_STORE_APPEND:
            return "append";
        case LCB_STORE_PREPEND:
            return "prepend";
        case LCB_STORE_UPSERT:
            return "upsert";
        default:
            return "unknown";
    }
}

void record_op_latency(const char *op, const char *svc, lcb_settings_st *settings, hrtime_t start)
{
    if (settings->op_metrics_enabled && settings->meter) {
        lcbmetrics_TAG tags[2] = {{METRICS_SVC_TAG_NAME, svc ? svc : ""}, {METRICS_OP_TAG_NAME, op ? op : ""}};
        auto recorder = settings->meter->value_recorder_(settings->meter, METRICS_OPS_METER_NAME, tags, 2);
        if (recorder) {
            recorder->record_value_(recorder, gethrtime() - start);
        }
    }
}

void record_kv_op_latency(const char *op, lcb_INSTANCE *instance, mc_PACKET *request)
{
    record_op_latency(op, "kv", instance->settings, MCREQ_PKT_RDATA(request)->start);
}

void record_kv_op_latency_store(lcb_INSTANCE *instance, mc_PACKET *request, lcb_RESPSTORE *response)
{
    record_kv_op_latency(op_name_from_store_operation(response->op), instance, request);
}

void record_http_op_latency(const char *op, const char *svc, lcb_INSTANCE *instance, hrtime_t start)
{
    record_op_latency(op, svc, instance->settings, start);
}
