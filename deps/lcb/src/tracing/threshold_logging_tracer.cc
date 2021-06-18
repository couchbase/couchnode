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

#include "internal.h"

#include <iostream>
#include <vector>

#define LOGARGS(tracer, lvl) tracer->m_settings, "tracer", LCB_LOG_##lvl, __FILE__, __LINE__

using namespace lcb::trace;

extern "C" {
static void tlt_destructor(lcbtrace_TRACER *wrapper)
{
    if (wrapper == nullptr) {
        return;
    }
    if (wrapper->cookie) {
        auto *tracer = reinterpret_cast<ThresholdLoggingTracer *>(wrapper->cookie);
        tracer->do_flush_orphans();
        tracer->do_flush_threshold();
        delete tracer;
        wrapper->cookie = nullptr;
    }
    delete wrapper;
}

static void tlt_report(lcbtrace_TRACER *wrapper, lcbtrace_SPAN *span)
{
    if (wrapper == nullptr || wrapper->cookie == nullptr) {
        return;
    }

    auto *tracer = reinterpret_cast<ThresholdLoggingTracer *>(wrapper->cookie);
    if (span->is_dispatch()) {
        span->find_outer_or_this()->increment_dispatch(span->duration());
    }
    if (span->is_encode()) {
        span->find_outer_or_this()->m_encode = span->duration();
    }
    if (span->is_outer()) {
        if (span->m_orphaned) {
            tracer->add_orphan(span);
        } else {
            tracer->check_threshold(span);
        }
    }
}
}

lcbtrace_TRACER *ThresholdLoggingTracer::wrap()
{
    if (m_wrapper) {
        return m_wrapper;
    }
    m_wrapper = new lcbtrace_TRACER();
    m_wrapper->version = 0;
    m_wrapper->flags = LCBTRACE_F_THRESHOLD;
    m_wrapper->cookie = this;
    m_wrapper->destructor = tlt_destructor;
    m_wrapper->v.v0.report = tlt_report;
    return m_wrapper;
}

QueueEntry ThresholdLoggingTracer::convert(lcbtrace_SPAN *span)
{
    QueueEntry orphan;
    orphan.duration = span->duration();
    Json::Value entry;
    char *value, *value2;
    size_t nvalue, nvalue2;

    entry["operation_name"] = std::string(span->m_opname);
    if (lcbtrace_span_get_tag_str(span, LCBTRACE_TAG_OPERATION_ID, &value, &nvalue) == LCB_SUCCESS) {
        entry["last_operation_id"] = std::string(value, value + nvalue);
    }
    if (lcbtrace_span_get_tag_str(span, LCBTRACE_TAG_LOCAL_ID, &value, &nvalue) == LCB_SUCCESS) {
        entry["last_local_id"] = std::string(value, value + nvalue);
    }
    if (lcbtrace_span_get_tag_str(span, LCBTRACE_TAG_LOCAL_ADDRESS, &value, &nvalue) == LCB_SUCCESS) {
        if (lcbtrace_span_get_tag_str(span, LCBTRACE_TAG_LOCAL_PORT, &value2, &nvalue2) == LCB_SUCCESS) {
            std::string address(value, value + nvalue);
            address.append(":");
            address.append(value2, nvalue2);
            entry["last_local_socket"] = address;
        }
    }
    if (lcbtrace_span_get_tag_str(span, LCBTRACE_TAG_PEER_ADDRESS, &value, &nvalue) == LCB_SUCCESS) {
        if (lcbtrace_span_get_tag_str(span, LCBTRACE_TAG_PEER_PORT, &value2, &nvalue2) == LCB_SUCCESS) {
            std::string address(value, value + nvalue);
            address.append(":");
            address.append(value2, nvalue2);
            entry["last_remote_socket"] = address;
        }
    }
    if (span->service() == LCBTRACE_THRESHOLD_KV) {
        entry["last_server_duration_us"] = (Json::UInt64)span->m_last_server;
        entry["total_server_duration_us"] = (Json::UInt64)span->m_total_server;
    }
    if (span->m_encode > 0) {
        entry["encode_duration_us"] = (Json::UInt64)span->m_encode;
    }
    entry["total_duration_us"] = (Json::UInt64)orphan.duration;
    entry["last_dispatch_duration_us"] = (Json::UInt64)span->m_last_dispatch;
    entry["total_dispatch_duration_us"] = (Json::UInt64)span->m_total_dispatch;
    orphan.payload = Json::FastWriter().write(entry);
    return orphan;
}

void ThresholdLoggingTracer::add_orphan(lcbtrace_SPAN *span)
{
    m_orphans.push(convert(span));
}

void ThresholdLoggingTracer::check_threshold(lcbtrace_SPAN *span)
{
    if (span->is_outer()) {
        if (span->service() == LCBTRACE_THRESHOLD__MAX) {
            return;
        }
        if (span->duration() > m_settings->tracer_threshold[span->service()]) {

            auto it = m_queues.find(span->service_str());
            if (it != m_queues.end()) {
                // found the queue, so push this in.
                it->second.push(convert(span));
            } else {
                // add a new queue, then push this in.
                auto pr = m_queues.emplace(span->service_str(), FixedSpanQueue{m_threshold_queue_size});
                pr.first->second.push(convert(span));
            }
        }
    }
}

void ThresholdLoggingTracer::flush_queue(FixedSpanQueue &queue, const char *message, const char *service,
                                         bool warn = false)
{
    Json::Value entries;
    if (nullptr != service) {
        entries["service"] = service;
    }
    entries["count"] = (Json::UInt)queue.size();
    Json::Value top;
    while (!queue.empty()) {
        Json::Value entry;
        if (Json::Reader().parse(queue.top().payload, entry)) {
            top.append(entry);
        }
        queue.pop();
    }
    entries["top"] = top;
    std::string doc = Json::FastWriter().write(entries);
    if (!doc.empty() && doc[doc.size() - 1] == '\n') {
        doc[doc.size() - 1] = '\0';
    }
    if (warn) {
        lcb_log(LOGARGS(this, WARN), "%s: %s", message, doc.c_str());
    } else {
        lcb_log(LOGARGS(this, INFO), "%s: %s", message, doc.c_str());
    }
}

void ThresholdLoggingTracer::do_flush_orphans()
{
    if (m_orphans.empty()) {
        return;
    }
    flush_queue(m_orphans, "Orphan responses observed", nullptr, true);
}

void ThresholdLoggingTracer::do_flush_threshold()
{
    for (auto &element : m_queues) {
        if (!element.second.empty()) {
            flush_queue(element.second, "Operations over threshold", element.first.c_str());
        }
    }
}

void ThresholdLoggingTracer::flush_orphans()
{
    lcb_U32 tv = m_settings->tracer_orphaned_queue_flush_interval;
    if (tv == 0) {
        m_oflush.cancel();
    } else {
        m_oflush.rearm(tv);
    }
    do_flush_orphans();
}

void ThresholdLoggingTracer::flush_threshold()
{
    lcb_U32 tv = m_settings->tracer_threshold_queue_flush_interval;
    if (tv == 0) {
        m_tflush.cancel();
    } else {
        m_tflush.rearm(tv);
    }
    do_flush_threshold();
}

ThresholdLoggingTracer::ThresholdLoggingTracer(lcb_INSTANCE *instance)
    : m_wrapper(nullptr), m_settings(instance->settings),
      m_threshold_queue_size(LCBT_SETTING(instance, tracer_threshold_queue_size)),
      m_orphans(LCBT_SETTING(instance, tracer_orphaned_queue_size)), m_oflush(instance->iotable, this),
      m_tflush(instance->iotable, this)
{
    lcb_U32 tv = m_settings->tracer_orphaned_queue_flush_interval;
    if (tv > 0) {
        m_oflush.rearm(tv);
    }
    tv = m_settings->tracer_threshold_queue_flush_interval;
    if (tv > 0) {
        m_tflush.rearm(tv);
    }
}
