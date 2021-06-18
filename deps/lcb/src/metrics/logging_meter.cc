/*
 *     Copyright 2021 Couchbase, Inc.
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

#include <contrib/HdrHistogram_c/src/hdr_histogram.h>
#include "internal.h"
#include "logging_meter.hh"

using namespace lcb::metrics;

#define LOGARGS(meter, lvl) meter->settings_, "logging-meter", LCB_LOG_##lvl, __FILE__, __LINE__

extern "C" {
static void mlm_destructor(const lcbmetrics_METER *wrapper)
{
    if (wrapper != nullptr && wrapper->cookie_ != nullptr) {
        auto *meter = reinterpret_cast<LoggingMeter *>(wrapper->cookie_);
        delete meter;
    }
}

static const lcbmetrics_VALUERECORDER *mlm_find_value_recorder(const lcbmetrics_METER *wrapper, const char *name,
                                                               const lcbmetrics_TAG *tags, size_t ntags)
{
    if (wrapper == nullptr || wrapper->cookie_ == nullptr) {
        return nullptr;
    }

    auto *meter = reinterpret_cast<LoggingMeter *>(wrapper->cookie_);
    return meter->findValueRecorder(name, tags, ntags);
}

static void mlvr_destructor(const lcbmetrics_VALUERECORDER *wrapper)
{
    if (wrapper != nullptr && wrapper->cookie_ != nullptr) {
        auto *recorder = reinterpret_cast<LoggingValueRecorder *>(wrapper->cookie_);
        delete recorder;
    }
}

static void mlvr_record_value(const lcbmetrics_VALUERECORDER *wrapper, uint64_t value)
{
    if (wrapper == nullptr || wrapper->cookie_ == nullptr) {
        return;
    }

    auto *recorder = reinterpret_cast<LoggingValueRecorder *>(wrapper->cookie_);
    recorder->recordValue(value);
}
}

LoggingMeter::LoggingMeter(lcb_INSTANCE *instance) : settings_(instance->settings), timer_(instance->iotable, this)
{
    lcb_U32 tv = settings_->op_metrics_flush_interval;
    if (tv > 0) {
        timer_.rearm(tv);
    }
}

const lcbmetrics_METER *LoggingMeter::wrap()
{
    if (wrapper_ != nullptr) {
        return wrapper_;
    }

    wrapper_ = new lcbmetrics_METER();
    wrapper_->cookie_ = this;
    wrapper_->destructor_ = mlm_destructor;
    wrapper_->value_recorder_ = mlm_find_value_recorder;
    return wrapper_;
}

void LoggingMeter::flush()
{
    Json::Value meta;
    meta["emit_interval_s"] = Json::Int(LCB_US2S(settings_->op_metrics_flush_interval));

    Json::Value operations(Json::objectValue);
    for (auto &it : valueRecorders_) {
        Json::Value operations2;
        for (auto &it2 : it.second) {
            operations2[it2.first] = it2.second.flush();
        }
        operations[it.first] = operations2;
    }

    Json::Value top;
    top["meta"] = meta;
    top["operations"] = operations;

    std::string doc = Json::FastWriter().write(top);
    lcb_log(LOGARGS(this, INFO), "Metrics: %s", doc.c_str());

    lcb_U32 tv = settings_->op_metrics_flush_interval;
    if (tv > 0) {
        timer_.rearm(tv);
    }
}

const lcbmetrics_VALUERECORDER *LoggingMeter::findValueRecorder(const char *name, const lcbmetrics_TAG *tags,
                                                                size_t ntags)
{
    if (strcmp(name, METRICS_OPS_METER_NAME) != 0) {
        return nullptr;
    }

    const char *svcName = "";
    const char *opName = "";
    for (size_t i = 0; i < ntags; ++i) {
        if (strcmp(tags[i].key, METRICS_SVC_TAG_NAME) == 0) {
            svcName = tags[i].value;
        } else if (strcmp(tags[i].key, METRICS_OP_TAG_NAME) == 0) {
            opName = tags[i].value;
        }
    }

    return findValueRecorder(svcName, opName).wrap();
}

LoggingValueRecorder &LoggingMeter::findValueRecorder(const char *svcName, const char *opName)
{
    auto &first = valueRecorders_[svcName];
    auto &recorder = first[opName];
    return recorder;
}

LoggingValueRecorder::LoggingValueRecorder() : wrapper_(nullptr), histogram_(nullptr)
{
    hdr_init(/* minimum - 1 ns*/ 1,
             /* maximum - 30 s*/ 30e9,
             /* significant figures */ 3,
             /* pointer */ &histogram_);
}

LoggingValueRecorder::~LoggingValueRecorder()
{
    if (histogram_ != nullptr) {
        hdr_close(histogram_);
        histogram_ = nullptr;
    }
    delete wrapper_;
}

const lcbmetrics_VALUERECORDER *LoggingValueRecorder::wrap()
{
    if (wrapper_ != nullptr) {
        return wrapper_;
    }

    wrapper_ = new lcbmetrics_VALUERECORDER();
    wrapper_->cookie_ = this;
    wrapper_->destructor_ = mlvr_destructor;
    wrapper_->record_value_ = mlvr_record_value;
    return wrapper_;
}

void LoggingValueRecorder::recordValue(std::uint64_t value)
{
    hdr_record_value(histogram_, value);
}

Json::Value LoggingValueRecorder::flush()
{
    auto total_count = histogram_->total_count;
    auto val_500 = hdr_value_at_percentile(histogram_, 50.0);
    auto val_900 = hdr_value_at_percentile(histogram_, 90.0);
    auto val_990 = hdr_value_at_percentile(histogram_, 99.0);
    auto val_999 = hdr_value_at_percentile(histogram_, 99.9);
    auto val_1000 = hdr_value_at_percentile(histogram_, 100.0);

    hdr_reset(histogram_);

    Json::Value percentiles;
    percentiles["50.0"] = Json::Int64(val_500);
    percentiles["90.0"] = Json::Int64(val_900);
    percentiles["99.0"] = Json::Int64(val_990);
    percentiles["99.9"] = Json::Int64(val_999);
    percentiles["100.0"] = Json::Int64(val_1000);

    Json::Value top;
    top["total_count"] = Json::Int64(total_count);
    top["percentiles_us"] = percentiles;

    return top;
}
