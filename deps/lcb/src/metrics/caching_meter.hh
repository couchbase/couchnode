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

#ifndef LCB_CACHEINGETERS_HH
#define LCB_CACHEINGETERS_HH

#include "metrics/metrics-internal.h"
#include <libcouchbase/metrics.h>
#include <unordered_map>

namespace lcb
{
namespace metrics
{

class CachingMeter
{
  public:
    explicit CachingMeter(const lcbmetrics_METER *base);
    ~CachingMeter();

    const lcbmetrics_METER *wrap();

    const lcbmetrics_VALUERECORDER *findValueRecorder(const char *name, const lcbmetrics_TAG *tags, size_t ntags);

  protected:
    lcbmetrics_METER *wrapper_{nullptr};
    const lcbmetrics_METER *base_;
    std::unordered_map<std::string, const lcbmetrics_VALUERECORDER *> valueRecorders_;
};

} // namespace metrics
} // namespace lcb

#endif // LCB_CACHEINGETERS_HH
