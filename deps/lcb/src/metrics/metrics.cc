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

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_meter_create(lcbmetrics_METER **meter, void *cookie)
{
    *meter = new lcbmetrics_METER();
    (*meter)->cookie_ = cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_meter_dtor_callback(lcbmetrics_METER *meter, void (*callback)(const lcbmetrics_METER *meter))
{
    meter->destructor_ = callback;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_meter_value_recorder_callback(lcbmetrics_METER *meter,
                                                    lcbmetrics_VALUE_RECORDER_CALLBACK callback)
{
    meter->value_recorder_ = callback;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_meter_cookie(const lcbmetrics_METER *meter, void **cookie)
{
    *cookie = meter->cookie_;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
void lcbmetrics_meter_destroy(const lcbmetrics_METER *meter)
{
    if (meter) {
        if (meter->destructor_) {
            meter->destructor_(meter);
        }

        delete meter;
    }
}

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_valuerecorder_create(lcbmetrics_VALUERECORDER **recorder, void *cookie)
{
    *recorder = new lcbmetrics_VALUERECORDER();
    (*recorder)->cookie_ = cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_valuerecorder_dtor_callback(lcbmetrics_VALUERECORDER *recorder,
                                                  void (*callback)(const lcbmetrics_VALUERECORDER *recorder))
{
    recorder->destructor_ = callback;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_valuerecorder_record_value_callback(lcbmetrics_VALUERECORDER *recorder,
                                                          lcbmetrics_RECORD_VALUE callback)
{
    recorder->record_value_ = callback;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_STATUS lcbmetrics_valuerecorder_cookie(const lcbmetrics_VALUERECORDER *recorder, void **cookie)
{
    *cookie = recorder->cookie_;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
void lcbmetrics_valuerecorder_destroy(const lcbmetrics_VALUERECORDER *recorder)
{
    if (recorder) {
        if (recorder->destructor_) {
            recorder->destructor_(recorder);
        }

        delete recorder;
    }
}
