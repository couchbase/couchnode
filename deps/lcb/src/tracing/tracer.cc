/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017-2020 Couchbase, Inc.
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

using namespace lcb::trace;

LIBCOUCHBASE_API lcbtrace_TRACER *lcbtrace_new(lcb_INSTANCE *instance, uint64_t flags)
{
    switch (flags) {
        case LCBTRACE_F_THRESHOLD:
            if (nullptr == instance) {
                return nullptr;
            }
            return (new ThresholdLoggingTracer(instance))->wrap();
        case LCBTRACE_F_EXTERNAL: {
            lcbtrace_TRACER *retval = new lcbtrace_TRACER;
            retval->version = 0;
            retval->flags = LCBTRACE_F_EXTERNAL;
            retval->cookie = nullptr;
            retval->destructor = nullptr;
            retval->v.v0.report = nullptr;
            retval->v.v1.start_span = nullptr;
            retval->v.v1.end_span = nullptr;
            retval->v.v1.destroy_span = nullptr;
            retval->v.v1.add_tag_string = nullptr;
            retval->v.v1.add_tag_uint64 = nullptr;
            return retval;
        }
        default:
            return nullptr;
    }
}

LIBCOUCHBASE_API void lcbtrace_destroy(lcbtrace_TRACER *tracer)
{
    if (tracer && tracer->destructor) {
        tracer->destructor(tracer);
    }
}

LIBCOUCHBASE_API
lcbtrace_SPAN *lcbtrace_span_start(lcbtrace_TRACER *tracer, const char *opname, uint64_t start, lcbtrace_REF *ref)
{
    lcbtrace_REF_TYPE type = LCBTRACE_REF_NONE;
    lcbtrace_SPAN *other = nullptr;
    if (ref) {
        type = ref->type;
        other = ref->span;
    }
    return new Span(tracer, opname, start, type, other, nullptr);
}

LIBCOUCHBASE_API
lcb_STATUS lcbtrace_span_wrap(lcbtrace_TRACER *tracer, const char *opname, uint64_t start, void *external_span,
                              lcbtrace_SPAN **lcbspan)
{
    if (nullptr == *lcbspan && nullptr != external_span && nullptr != tracer && tracer->version == 1) {
        *lcbspan = new Span(tracer, opname, start, LCBTRACE_REF_NONE, nullptr, external_span);
        return LCB_SUCCESS;
    }
    return LCB_ERR_INVALID_ARGUMENT;
}

LIBCOUCHBASE_API
lcbtrace_TRACER *lcb_get_tracer(lcb_INSTANCE *instance)
{
    return (instance && instance->settings) ? instance->settings->tracer : nullptr;
}

LIBCOUCHBASE_API
void lcb_set_tracer(lcb_INSTANCE *instance, lcbtrace_TRACER *tracer)
{
    // TODO: this leaks the original one in the instance, _if_ it is
    // the default ThresholdLoggingTracer
    if (instance && instance->settings) {
        instance->settings->tracer = tracer;
    }
}

void lcbtrace_span_add_host_and_port(lcbtrace_SPAN *span, lcbio_CONNINFO *info)
{
    if (span) {
        lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_LOCAL_ADDRESS, info->ep_local.host);
        lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_LOCAL_PORT, info->ep_local.port);
        lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_PEER_ADDRESS, info->ep_remote.host);
        lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_PEER_PORT, info->ep_remote.port);
    }
}

const char *dur_level_to_string(lcb_DURABILITY_LEVEL dur_level)
{
    switch (dur_level) {
        case LCB_DURABILITYLEVEL_NONE:
            return "none";
        case LCB_DURABILITYLEVEL_MAJORITY:
            return "majority";
        case LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE:
            return "majority_and_persist_to_active";
        case LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY:
            return "persist_to_majority";
        default:
            return "unknown";
    }
}
