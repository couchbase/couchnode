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

#include "internal.h"
#include "caching_meter.hh"
#include <sstream>

using namespace lcb::metrics;

extern "C" {
static void mcm_destructor(const lcbmetrics_METER *wrapper)
{
    if (wrapper != nullptr && wrapper->cookie_) {
        auto *meter = reinterpret_cast<CachingMeter *>(wrapper->cookie_);
        delete meter;
    }
}

static const lcbmetrics_VALUERECORDER *mcm_find_value_recorder(const lcbmetrics_METER *wrapper, const char *name,
                                                               const lcbmetrics_TAG *tags, size_t ntags)
{
    if (wrapper == nullptr || wrapper->cookie_ == nullptr) {
        return nullptr;
    }

    auto *meter = reinterpret_cast<CachingMeter *>(wrapper->cookie_);
    return meter->findValueRecorder(name, tags, ntags);
}
}

CachingMeter::CachingMeter(const lcbmetrics_METER *base) : base_(base) {}

CachingMeter::~CachingMeter()
{
    for (auto &item : valueRecorders_) {
        lcbmetrics_valuerecorder_destroy(item.second);
    }
}

const lcbmetrics_METER *CachingMeter::wrap()
{
    if (wrapper_) {
        return wrapper_;
    }

    wrapper_ = new lcbmetrics_METER();
    wrapper_->cookie_ = this;
    wrapper_->destructor_ = mcm_destructor;
    wrapper_->value_recorder_ = mcm_find_value_recorder;
    return wrapper_;
}

const lcbmetrics_VALUERECORDER *CachingMeter::findValueRecorder(const char *name, const lcbmetrics_TAG *tags,
                                                                size_t ntags)
{
    std::stringstream lkpNameBuilder;
    lkpNameBuilder << name << ";";
    for (size_t i = 0; i < ntags; ++i) {
        lkpNameBuilder << tags[i].key << "=" << tags[i].value;
    }

    auto lkpName = lkpNameBuilder.str();
    auto it = valueRecorders_.find(lkpName);
    if (it != valueRecorders_.end()) {
        return it->second;
    }

    auto recorder = base_->value_recorder_(base_, name, tags, ntags);
    valueRecorders_.emplace(lkpName, recorder);

    return recorder;
}
