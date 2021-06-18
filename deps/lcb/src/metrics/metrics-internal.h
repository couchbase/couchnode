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

#ifndef LCB_METRICS_INTERNAL_H
#define LCB_METRICS_INTERNAL_H

#include <libcouchbase/metrics.h>
#include "mc/mcreq.h"

#define METRICS_OPS_METER_NAME "db.couchbase.operations"
#define METRICS_SVC_TAG_NAME "db.couchbase.service"
#define METRICS_OP_TAG_NAME "db.operation"

struct lcbmetrics_VALUERECORDER_ {
    void *cookie_;
    void (*destructor_)(const lcbmetrics_VALUERECORDER *recorder);
    lcbmetrics_RECORD_VALUE record_value_;
};

struct lcbmetrics_METER_ {
    void *cookie_;
    void (*destructor_)(const lcbmetrics_METER *meter);
    lcbmetrics_VALUE_RECORDER_CALLBACK value_recorder_;
};

void record_kv_op_latency(const char *op, lcb_INSTANCE *instance, mc_PACKET *request);
void record_kv_op_latency_store(lcb_INSTANCE *instance, mc_PACKET *request, lcb_RESPSTORE *response);
void record_http_op_latency(const char *op, const char *svc, lcb_INSTANCE *instance, hrtime_t start);

#endif // LCB_METRICS_INTERNAL_H
