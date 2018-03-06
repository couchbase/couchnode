/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017 Couchbase, Inc.
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
uint64_t lcbtrace_now()
{
    uint64_t ret;
    struct timeval tv;
    if (gettimeofday(&tv, NULL) == -1) {
        return -1;
    }
    ret = (uint64_t)tv.tv_sec * 1000000;
    ret += (uint64_t)tv.tv_usec;
    return ret;
}

LIBCOUCHBASE_API
void lcbtrace_span_finish(lcbtrace_SPAN *span, uint64_t now)
{
    span->finish(now);
    delete span;
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_str(lcbtrace_SPAN *span, const char *name, const char *value)
{
    span->add_tag(name, value);
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_uint64(lcbtrace_SPAN *span, const char *name, uint64_t value)
{
    span->add_tag(name, (Json::Value::UInt64)value);
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_double(lcbtrace_SPAN *span, const char *name, double value)
{
    span->add_tag(name, value);
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_bool(lcbtrace_SPAN *span, const char *name, int value)
{
    span->add_tag(name, value);
}

LCB_INTERNAL_API
void lcbtrace_spann_add_system_tags(lcbtrace_SPAN *span, lcb_settings *settings, const char *service)
{
    lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_SERVICE, service);
    std::string client_string(LCB_CLIENT_ID);
    if (settings->client_string) {
        client_string += " ";
        client_string += settings->client_string;
    }
    lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT, client_string.c_str());
    if (settings->bucket) {
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_DB_INSTANCE, settings->bucket);
    }
}

LIBCOUCHBASE_API
lcbtrace_SPAN *lcbtrace_span_get_parent(lcbtrace_SPAN *span)
{
    return span->m_parent;
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_start_ts(lcbtrace_SPAN *span)
{
    return span->m_start;
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_finish_ts(lcbtrace_SPAN *span)
{
    return span->m_finish;
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_span_id(lcbtrace_SPAN *span)
{
    return span->m_span_id;
}

LIBCOUCHBASE_API
const char *lcbtrace_span_get_operation(lcbtrace_SPAN *span)
{
    return span->m_opname.c_str();
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_trace_id(lcbtrace_SPAN *span)
{
    if (span->m_parent) {
        return span->m_parent->m_span_id;
    }
    return span->m_span_id;
}

LIBCOUCHBASE_API
lcb_error_t lcbtrace_span_get_tag_str(lcbtrace_SPAN *span, const char *name, char **value, size_t *nvalue)
{
    Json::Value &val = span->tags[name];
    if (val.isString()) {
        std::string str = val.asString();
        if (*nvalue) {
            /* string has been pre-allocated */
            if (str.size() < *nvalue) {
                *nvalue = str.size();
            }
        } else {
            *nvalue = str.size();
            *value = (char *)calloc(*nvalue, sizeof(char));
        }
        str.copy(*value, *nvalue, 0);
        return LCB_SUCCESS;
    }
    return LCB_KEY_ENOENT;
}

LIBCOUCHBASE_API lcb_error_t lcbtrace_span_get_tag_uint64(lcbtrace_SPAN *span, const char *name, uint64_t *value)
{
    Json::Value &val = span->tags[name];
    if (val.isNumeric()) {
        *value = val.asUInt64();
        return LCB_SUCCESS;
    }
    return LCB_KEY_ENOENT;
}

LIBCOUCHBASE_API lcb_error_t lcbtrace_span_get_tag_double(lcbtrace_SPAN *span, const char *name, double *value)
{
    Json::Value &val = span->tags[name];
    if (val.isNumeric()) {
        *value = val.asDouble();
        return LCB_SUCCESS;
    }
    return LCB_KEY_ENOENT;
}

LIBCOUCHBASE_API lcb_error_t lcbtrace_span_get_tag_bool(lcbtrace_SPAN *span, const char *name, int *value)
{
    Json::Value &val = span->tags[name];
    if (val.isBool()) {
        *value = val.asBool();
        return LCB_SUCCESS;
    }
    return LCB_KEY_ENOENT;
}

LIBCOUCHBASE_API int lcbtrace_span_has_tag(lcbtrace_SPAN *span, const char *name)
{
    return span->tags.isMember(name);
}

using namespace lcb::trace;

Span::Span(lcbtrace_TRACER *tracer, const char *opname, uint64_t start, lcbtrace_REF_TYPE ref, lcbtrace_SPAN *other)
    : m_tracer(tracer), m_opname(opname)
{
    m_start = start ? start : lcbtrace_now();
    m_span_id = lcb_next_rand64();
    add_tag(LCBTRACE_TAG_DB_TYPE, "couchbase");
    add_tag(LCBTRACE_TAG_SPAN_KIND, "client");

    if (other != NULL && ref == LCBTRACE_REF_CHILD_OF) {
        m_parent = other;
    } else {
        m_parent = NULL;
    }
}

void Span::finish(uint64_t finish)
{
    m_finish = finish ? finish : lcbtrace_now();
    if (m_tracer && m_tracer->version == 0 && m_tracer->v.v0.report) {
        m_tracer->v.v0.report(m_tracer, this);
    }
}

template < typename T > void Span::add_tag(const char *name, T value)
{
    tags[name] = value;
}
