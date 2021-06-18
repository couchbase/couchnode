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

#ifndef LCB_LOGGINGMETER_H
#define LCB_LOGGINGMETER_H

#include "metrics/metrics-internal.h"
#include "settings.h"
#include "lcbio/timer-cxx.h"
#include <libcouchbase/metrics.h>
#include <libcouchbase/utils.h>
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>

namespace lcb
{
namespace metrics
{

class LoggingValueRecorder
{
  public:
    LoggingValueRecorder();
    ~LoggingValueRecorder();

    const lcbmetrics_VALUERECORDER *wrap();

    void recordValue(std::uint64_t value);

    Json::Value flush();

  protected:
    lcbmetrics_VALUERECORDER *wrapper_;
    struct hdr_histogram *histogram_;
};

class LoggingMeter
{
  public:
    explicit LoggingMeter(lcb_INSTANCE *lcb);

    const lcbmetrics_METER *wrap();

    const lcbmetrics_VALUERECORDER *findValueRecorder(const char *name, const lcbmetrics_TAG *tags, size_t ntags);

    void flush();

  protected:
    LoggingValueRecorder &findValueRecorder(const char *svcName, const char *opName);

    lcbmetrics_METER *wrapper_{nullptr};
    lcb_settings *settings_;
    lcb::io::Timer<LoggingMeter, &LoggingMeter::flush> timer_;
    std::unordered_map<std::string, std::unordered_map<std::string, LoggingValueRecorder>> valueRecorders_;
};

} // namespace metrics
} // namespace lcb

#endif // LCB_LOGGINGMETER_H
