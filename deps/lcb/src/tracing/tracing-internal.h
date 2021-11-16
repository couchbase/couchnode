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

#ifndef LCB_TRACING_INTERNAL_H
#define LCB_TRACING_INTERNAL_H

#include <libcouchbase/tracing.h>
#include "rnd.h"

#ifdef __cplusplus

#include <queue>
#include <map>
#include <string>
#include <memory>

LCB_INTERNAL_API
void lcbtrace_span_add_system_tags(lcbtrace_SPAN *span, const lcb_settings *settings, lcbtrace_THRESHOLDOPTS svc);
LIBCOUCHBASE_API
void lcbtrace_span_add_tag_str_nocopy(lcbtrace_SPAN *span, const char *name, const char *value);
void lcbtrace_span_add_host_and_port(lcbtrace_SPAN *span, lcbio_CONNINFO *info);

namespace lcb
{
namespace trace
{

class Span
{
  public:
    Span(lcbtrace_TRACER *tracer, const char *opname, uint64_t start, lcbtrace_REF_TYPE ref, lcbtrace_SPAN *other,
         void *external_span);
    ~Span();

    void finish(uint64_t finish);
    uint64_t duration() const
    {
        return m_finish - m_start;
    }

    void add_tag(const char *name, const std::string &value);
    void add_tag(const char *name, int copy, const char *value, int copy_value);
    void add_tag(const char *name, int copy_key, const char *value, size_t value_len, int copy_value);
    void add_tag(const char *name, int copy, uint64_t value);
    void add_tag(const char *name, int copy, double value);
    void add_tag(const char *name, int copy, bool value);

    void service(lcbtrace_THRESHOLDOPTS svc);
    lcbtrace_THRESHOLDOPTS service() const;

    void increment_dispatch(uint64_t dispatch_time);
    void increment_server(uint64_t server_time);
    lcbtrace_SPAN *find_outer_or_this();

    const char *service_str() const;

    void *external_span() const;
    void external_span(void *ext);

    bool is_outer() const;
    void is_outer(bool outer);
    bool is_dispatch() const;
    void is_dispatch(bool dispatch);
    bool is_encode() const;
    void is_encode(bool encode);
    bool should_finish() const;
    void should_finish(bool finish);

    lcbtrace_TRACER *m_tracer;
    std::string m_opname;
    uint64_t m_span_id;
    uint64_t m_start;
    uint64_t m_finish{0};
    bool m_orphaned;
    Span *m_parent;
    void *m_extspan;
    sllist_root m_tags{};
    bool m_is_outer{false};
    bool m_is_dispatch{false};
    bool m_is_encode{false};
    bool m_should_finish{true};
    lcbtrace_THRESHOLDOPTS m_svc{LCBTRACE_THRESHOLD__MAX};
    const char *m_svc_string{nullptr};
    uint64_t m_total_dispatch{0};
    uint64_t m_last_dispatch{0};
    uint64_t m_total_server{0};
    uint64_t m_last_server{0};
    uint64_t m_encode{0};
};

struct ReportedSpan {
    uint64_t duration;
    std::string payload;

    bool operator<(const ReportedSpan &rhs) const
    {
        return duration < rhs.duration;
    }
};

template <typename T>
class FixedQueue : private std::priority_queue<T>
{
  public:
    explicit FixedQueue(size_t capacity) : m_capacity(capacity) {}

    void push(const T &item)
    {
        std::priority_queue<T>::push(item);
        if (this->size() > m_capacity) {
            this->c.pop_back();
        }
    }
    using std::priority_queue<T>::empty;
    using std::priority_queue<T>::top;
    using std::priority_queue<T>::pop;
    using std::priority_queue<T>::size;

  private:
    size_t m_capacity;
};

typedef ReportedSpan QueueEntry;
typedef FixedQueue<QueueEntry> FixedSpanQueue;
class ThresholdLoggingTracer
{
    lcbtrace_TRACER *m_wrapper;
    lcb_settings *m_settings;
    size_t m_threshold_queue_size;

    FixedSpanQueue m_orphans;
    std::map<std::string, FixedSpanQueue> m_queues;

    void flush_queue(FixedSpanQueue &queue, const char *message, const char *service, bool warn);
    QueueEntry convert(lcbtrace_SPAN *span);

  public:
    explicit ThresholdLoggingTracer(lcb_INSTANCE *instance);

    lcbtrace_TRACER *wrap();
    void add_orphan(lcbtrace_SPAN *span);
    void check_threshold(lcbtrace_SPAN *span);

    void flush_orphans();
    void flush_threshold();
    void do_flush_orphans();
    void do_flush_threshold();

    lcb::io::Timer<ThresholdLoggingTracer, &ThresholdLoggingTracer::flush_orphans> m_oflush;
    lcb::io::Timer<ThresholdLoggingTracer, &ThresholdLoggingTracer::flush_threshold> m_tflush;
};

template <typename COMMAND>
lcbtrace_SPAN *start_kv_span(const lcb_settings *settings, const mc_PACKET *packet, std::shared_ptr<COMMAND> cmd)
{
    if (settings == nullptr || settings->tracer == nullptr) {
        return nullptr;
    }
    lcbtrace_SPAN *span;
    lcbtrace_SPAN *parent_span = cmd->parent_span();
    if (parent_span != nullptr && parent_span->is_outer() && settings->tracer->flags & LCBTRACE_F_THRESHOLD) {
        span = parent_span;
        span->should_finish(false);
    } else {
        lcbtrace_REF ref;
        ref.type = LCBTRACE_REF_CHILD_OF;
        ref.span = parent_span;
        bool is_dispatch = (parent_span != nullptr && parent_span->is_outer());
        span = lcbtrace_span_start((settings)->tracer,
                                   is_dispatch ? LCBTRACE_OP_DISPATCH_TO_SERVER : cmd->operation_name().c_str(),
                                   LCBTRACE_NOW, &ref);
        span->should_finish(true);
        span->is_outer(!is_dispatch);
    }
    span->is_dispatch(true);
    std::string operation_id = std::to_string(packet->opaque);
    lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_OPERATION_ID, operation_id.c_str());
    lcbtrace_span_add_system_tags(span, settings, LCBTRACE_THRESHOLD_KV);
    span->add_tag(LCBTRACE_TAG_SCOPE, cmd->collection().scope());
    span->add_tag(LCBTRACE_TAG_COLLECTION, cmd->collection().collection());
    span->add_tag(LCBTRACE_TAG_OPERATION, cmd->operation_name());
    return span;
}

void finish_kv_span(const mc_PIPELINE *pipeline, const mc_PACKET *request_pkt, const MemcachedResponse *response_pkt);

template <typename COMMAND>
lcbtrace_SPAN *start_kv_span_with_durability(const lcb_settings *settings, const mc_PACKET *packet,
                                             std::shared_ptr<COMMAND> cmd)
{
    lcbtrace_SPAN *span = start_kv_span(settings, packet, cmd);
    if (span != nullptr && cmd->durability_level() != LCB_DURABILITYLEVEL_NONE) {
        span->add_tag(LCBTRACE_TAG_DURABILITY, 0, dur_level_to_string(cmd->durability_level()), 0);
    }
    return span;
}

template <typename COMMAND>
lcbtrace_SPAN *start_http_span(const lcb_settings *settings, const COMMAND *cmd)
{
    if (settings == nullptr || settings->tracer == nullptr) {
        return nullptr;
    }
    lcbtrace_SPAN *span;
    lcbtrace_SPAN *parent_span = cmd->parent_span();
    if (parent_span != nullptr && parent_span->is_outer() && settings->tracer->flags & LCBTRACE_F_THRESHOLD) {
        span = parent_span;
        span->should_finish(false);
    } else {
        lcbtrace_REF ref;
        ref.type = LCBTRACE_REF_CHILD_OF;
        ref.span = parent_span;
        bool is_dispatch = (parent_span != nullptr && parent_span->is_outer());
        span = lcbtrace_span_start((settings)->tracer,
                                   is_dispatch ? LCBTRACE_OP_DISPATCH_TO_SERVER : cmd->operation_name().c_str(),
                                   LCBTRACE_NOW, &ref);
        span->should_finish(true);
        span->is_outer(!is_dispatch);
    }
    span->is_dispatch(true);
    lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_OPERATION_ID, cmd->client_context_id().c_str());
    lcbtrace_span_add_system_tags(span, settings, cmd->service());
    span->add_tag(LCBTRACE_TAG_OPERATION, cmd->operation_name());
    return span;
}

template <typename COMMAND>
lcbtrace_SPAN *start_http_span_with_statement(const lcb_settings *settings, const COMMAND *cmd,
                                              const std::string &statement)
{
    lcbtrace_SPAN *span = start_http_span(settings, cmd);
    if (span != nullptr && !statement.empty()) {
        span->add_tag(LCBTRACE_TAG_STATEMENT, statement);
    }
    return span;
}

template <typename COMMAND>
void finish_http_span(lcbtrace_SPAN *span, const COMMAND *cmd)
{
    if (span != nullptr) {
        span->find_outer_or_this()->add_tag(LCBTRACE_TAG_RETRIES, 0, (uint64_t)cmd->retries());
        if (span->should_finish()) {
            lcbtrace_span_finish(span, LCBTRACE_NOW);
        }
    }
}

} // namespace trace
} // namespace lcb

extern "C" {
#endif /* __cplusplus */
LCB_INTERNAL_API
void lcbtrace_span_set_orphaned(lcbtrace_SPAN *span, int val);

const char *dur_level_to_string(lcb_DURABILITY_LEVEL dur_level);
#ifdef __cplusplus
}
#endif /* __cplusplus*/
#endif /* LCB_TRACING_INTERNAL_H */
