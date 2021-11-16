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
#include "sllist-inl.h"
#ifdef HAVE__FTIME64_S
#include <sys/timeb.h>
#endif

#include "n1ql/query_handle.hh"

typedef enum { TAGVAL_STRING, TAGVAL_UINT64, TAGVAL_DOUBLE, TAGVAL_BOOL } tag_type;
typedef struct tag_value {
    sllist_node slnode;
    struct {
        char *p;
        int need_free;
    } key;
    tag_type t;
    union {
        struct {
            char *p;
            size_t l;
            int need_free;
        } s;
        lcb_U64 u64;
        double d;
        int b;
    } v;
} tag_value;

LIBCOUCHBASE_API
uint64_t lcbtrace_now()
{
    uint64_t ret;
#ifdef HAVE__FTIME64_S
    struct __timeb64 tb;
    _ftime64_s(&tb);
    ret = (uint64_t)tb.time * 1000000; /* sec */
    ret += (uint64_t)tb.millitm * 1000;
#else
    struct timeval tv {
    };
    if (gettimeofday(&tv, nullptr) == -1) {
        return -1;
    }
    ret = (uint64_t)tv.tv_sec * 1000000;
    ret += (uint64_t)tv.tv_usec;
#endif
    return ret;
}

LIBCOUCHBASE_API
void lcbtrace_span_finish(lcbtrace_SPAN *span, uint64_t now)
{
    if (!span) {
        return;
    }

    span->finish(now);
    delete span;
}

LIBCOUCHBASE_API
int lcbtrace_span_should_finish(lcbtrace_SPAN *span)
{
    if (!span) {
        return false;
    }

    return span->should_finish();
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_str_nocopy(lcbtrace_SPAN *span, const char *name, const char *value)
{
    if (!span || name == nullptr || value == nullptr) {
        return;
    }
    span->add_tag(name, 0, value, 0);
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_str(lcbtrace_SPAN *span, const char *name, const char *value)
{
    if (!span || name == nullptr || value == nullptr) {
        return;
    }
    span->add_tag(name, 1, value, 1);
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_uint64(lcbtrace_SPAN *span, const char *name, uint64_t value)
{
    if (!span || name == nullptr) {
        return;
    }
    span->add_tag(name, 1, value);
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_double(lcbtrace_SPAN *span, const char *name, double value)
{
    if (!span || name == nullptr) {
        return;
    }
    span->add_tag(name, 1, value);
}

LIBCOUCHBASE_API
void lcbtrace_span_add_tag_bool(lcbtrace_SPAN *span, const char *name, int value)
{
    if (!span || name == nullptr) {
        return;
    }
    span->add_tag(name, 1, (bool)value);
}

LCB_INTERNAL_API
void lcbtrace_span_add_system_tags(lcbtrace_SPAN *span, const lcb_settings *settings, lcbtrace_THRESHOLDOPTS svc)
{
    if (!span) {
        return;
    }
    if (svc != LCBTRACE_THRESHOLD__MAX) {
        span->service(svc);
    }
    span->add_tag(LCBTRACE_TAG_SYSTEM, 0, "couchbase", 0);
    span->add_tag(LCBTRACE_TAG_TRANSPORT, 0, "IP.TCP", 0);
    std::string client_string(LCB_CLIENT_ID);
    if (settings->client_string) {
        client_string += " ";
        client_string += settings->client_string;
    }
    span->add_tag(LCBTRACE_TAG_COMPONENT, 0, client_string.c_str(), client_string.size(), 1);
    if (settings->bucket) {
        span->add_tag(LCBTRACE_TAG_DB_INSTANCE, 0, settings->bucket, 0);
    }
}

LIBCOUCHBASE_API
lcbtrace_SPAN *lcbtrace_span_get_parent(lcbtrace_SPAN *span)
{
    if (!span) {
        return nullptr;
    }
    return span->m_parent;
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_start_ts(lcbtrace_SPAN *span)
{
    if (!span) {
        return 0;
    }
    return span->m_start;
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_finish_ts(lcbtrace_SPAN *span)
{
    if (!span) {
        return 0;
    }
    return span->m_finish;
}

LIBCOUCHBASE_API
int lcbtrace_span_is_orphaned(lcbtrace_SPAN *span)
{
    return span && span->m_orphaned;
}

LCB_INTERNAL_API
void lcbtrace_span_set_orphaned(lcbtrace_SPAN *span, int val)
{
    if (!span) {
        return;
    }
    span->m_orphaned = (val != 0);
    if (val != 0 && span->m_parent && span->m_parent->is_outer()) {
        span->m_parent->m_orphaned = true;
    }
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_span_id(lcbtrace_SPAN *span)
{
    if (!span) {
        return 0;
    }
    return span->m_span_id;
}

LIBCOUCHBASE_API
const char *lcbtrace_span_get_operation(lcbtrace_SPAN *span)
{
    if (!span) {
        return nullptr;
    }
    return span->m_opname.c_str();
}

LIBCOUCHBASE_API
uint64_t lcbtrace_span_get_trace_id(lcbtrace_SPAN *span)
{
    if (!span) {
        return 0;
    }
    if (span->m_parent) {
        return span->m_parent->m_span_id;
    }
    return span->m_span_id;
}

LIBCOUCHBASE_API
lcb_STATUS lcbtrace_span_get_tag_str(lcbtrace_SPAN *span, const char *name, char **value, size_t *nvalue)
{
    if (!span || name == nullptr || nvalue == nullptr || value == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    sllist_iterator iter;
    SLLIST_ITERFOR(&span->m_tags, &iter)
    {
        tag_value *val = SLLIST_ITEM(iter.cur, tag_value, slnode);
        if (strcmp(name, val->key.p) == 0) {
            if (val->t != TAGVAL_STRING) {
                return LCB_ERR_INVALID_ARGUMENT;
            }
            *value = val->v.s.p;
            *nvalue = val->v.s.l;
            return LCB_SUCCESS;
        }
    }

    return LCB_ERR_DOCUMENT_NOT_FOUND;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_get_tag_uint64(lcbtrace_SPAN *span, const char *name, uint64_t *value)
{
    if (!span || name == nullptr || value == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    sllist_iterator iter;
    SLLIST_ITERFOR(&span->m_tags, &iter)
    {
        tag_value *val = SLLIST_ITEM(iter.cur, tag_value, slnode);
        if (strcmp(name, val->key.p) == 0) {
            if (val->t != TAGVAL_UINT64) {
                return LCB_ERR_INVALID_ARGUMENT;
            }
            *value = val->v.u64;
            return LCB_SUCCESS;
        }
    }

    return LCB_ERR_DOCUMENT_NOT_FOUND;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_get_tag_double(lcbtrace_SPAN *span, const char *name, double *value)
{
    if (!span || name == nullptr || value == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    sllist_iterator iter;
    SLLIST_ITERFOR(&span->m_tags, &iter)
    {
        tag_value *val = SLLIST_ITEM(iter.cur, tag_value, slnode);
        if (strcmp(name, val->key.p) == 0) {
            if (val->t != TAGVAL_DOUBLE) {
                return LCB_ERR_INVALID_ARGUMENT;
            }
            *value = val->v.d;
            return LCB_SUCCESS;
        }
    }

    return LCB_ERR_DOCUMENT_NOT_FOUND;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_get_tag_bool(lcbtrace_SPAN *span, const char *name, int *value)
{
    if (!span || name == nullptr || value == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    sllist_iterator iter;
    SLLIST_ITERFOR(&span->m_tags, &iter)
    {
        tag_value *val = SLLIST_ITEM(iter.cur, tag_value, slnode);
        if (strcmp(name, val->key.p) == 0) {
            if (val->t != TAGVAL_BOOL) {
                return LCB_ERR_INVALID_ARGUMENT;
            }
            *value = val->v.b;
            return LCB_SUCCESS;
        }
    }

    return LCB_ERR_DOCUMENT_NOT_FOUND;
}

LIBCOUCHBASE_API int lcbtrace_span_has_tag(lcbtrace_SPAN *span, const char *name)
{
    if (!span || name == nullptr) {
        return 0;
    }

    sllist_iterator iter;
    SLLIST_ITERFOR(&span->m_tags, &iter)
    {
        tag_value *val = SLLIST_ITEM(iter.cur, tag_value, slnode);
        if (strcmp(name, val->key.p) == 0) {
            return 1;
        }
    }
    return 0;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_get_service(lcbtrace_SPAN *span, lcbtrace_SERVICE *svc)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    *svc = static_cast<lcbtrace_SERVICE>(span->service());
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_set_service(lcbtrace_SPAN *span, lcbtrace_SERVICE svc)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    span->service(static_cast<lcbtrace_THRESHOLDOPTS>(svc));
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_set_is_dispatch(lcbtrace_SPAN *span, int dispatch)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    span->is_dispatch((bool)dispatch);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_set_is_outer(lcbtrace_SPAN *span, int outer)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    span->is_outer((bool)outer);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_set_is_encode(lcbtrace_SPAN *span, int encode)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    span->is_encode((bool)encode);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_get_is_dispatch(lcbtrace_SPAN *span, int *dispatch)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    *dispatch = span->is_dispatch() ? 1 : 0;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_get_is_outer(lcbtrace_SPAN *span, int *outer)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    *outer = span->is_outer() ? 1 : 0;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcbtrace_span_get_is_encode(lcbtrace_SPAN *span, int *encode)
{
    if (nullptr == span) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    *encode = span->is_encode() ? 1 : 0;
    return LCB_SUCCESS;
}

namespace lcb
{
namespace trace
{
void finish_kv_span(const mc_PIPELINE *pipeline, const mc_PACKET *request_pkt,
                    const lcb::MemcachedResponse *response_pkt)
{
    lcbtrace_SPAN *dispatch_span = MCREQ_PKT_RDATA(request_pkt)->span;
    if (dispatch_span) {
        if (response_pkt != nullptr) {
            dispatch_span->increment_server(response_pkt->duration());
        }
        auto *server = static_cast<const lcb::Server *>(pipeline);
        dispatch_span->find_outer_or_this()->add_tag(LCBTRACE_TAG_RETRIES, 0, (uint64_t)request_pkt->retries);
        lcbtrace_span_add_tag_str_nocopy(dispatch_span, LCBTRACE_TAG_TRANSPORT, "IP.TCP");
        lcbio_CTX *ctx = server->connctx;
        if (ctx) {
            char local_id[34] = {};
            snprintf(local_id, sizeof(local_id), "%016" PRIx64 "/%016" PRIx64, (uint64_t)server->get_settings()->iid,
                     (uint64_t)ctx->sock->id);
            lcbtrace_span_add_tag_str(dispatch_span, LCBTRACE_TAG_LOCAL_ID, local_id);
            lcbtrace_span_add_host_and_port(dispatch_span, ctx->sock->info);
        }
        if (dispatch_span->should_finish()) {
            lcbtrace_span_finish(dispatch_span, LCBTRACE_NOW);
        }
    }
}

} // namespace trace
} // namespace lcb

using namespace lcb::trace;

Span::Span(lcbtrace_TRACER *tracer, const char *opname, uint64_t start, lcbtrace_REF_TYPE ref, lcbtrace_SPAN *other,
           void *external_span)
    : m_tracer(tracer), m_opname(opname), m_extspan(external_span)
{
    if (other != nullptr && ref == LCBTRACE_REF_CHILD_OF) {
        m_parent = other;
    } else {
        m_parent = nullptr;
    }
    if (nullptr == m_extspan && nullptr != tracer && tracer->version == 1 && nullptr != tracer->v.v1.start_span) {
        void *parent = other == nullptr ? nullptr : other->external_span();
        m_extspan = tracer->v.v1.start_span(tracer, opname, parent);
    } else {
        m_start = start ? start : lcbtrace_now();
        m_span_id = lcb_next_rand64();
        m_orphaned = false;
        memset(&m_tags, 0, sizeof(m_tags));
        if (nullptr == m_extspan) {
            add_tag(LCBTRACE_TAG_SYSTEM, 0, "couchbase", 0);
            add_tag(LCBTRACE_TAG_SPAN_KIND, 0, "client", 0);
        }
    }
}

Span::~Span()
{
    if (nullptr != m_extspan) {
        // call external span destructor fn
        if (nullptr != m_tracer && m_tracer->version == 1 && nullptr != m_tracer->v.v1.destroy_span) {
            m_tracer->v.v1.destroy_span(m_extspan);
            m_extspan = nullptr;
        }
    } else {
        sllist_iterator iter;
        SLLIST_ITERFOR(&m_tags, &iter)
        {
            tag_value *val = SLLIST_ITEM(iter.cur, tag_value, slnode);
            sllist_iter_remove(&m_tags, &iter);
            if (val->key.need_free) {
                free(val->key.p);
            }
            if (val->t == TAGVAL_STRING && val->v.s.need_free) {
                free(val->v.s.p);
            }
            free(val);
        }
    }
}

void Span::service(lcbtrace_THRESHOLDOPTS svc)
{
    m_svc = svc;
    switch (svc) {
        case LCBTRACE_THRESHOLD_KV:
            m_svc_string = LCBTRACE_TAG_SERVICE_KV;
            break;
        case LCBTRACE_THRESHOLD_QUERY:
            m_svc_string = LCBTRACE_TAG_SERVICE_N1QL;
            break;
        case LCBTRACE_THRESHOLD_VIEW:
            m_svc_string = LCBTRACE_TAG_SERVICE_VIEW;
            break;
        case LCBTRACE_THRESHOLD_SEARCH:
            m_svc_string = LCBTRACE_TAG_SERVICE_SEARCH;
            break;
        case LCBTRACE_THRESHOLD_ANALYTICS:
            m_svc_string = LCBTRACE_TAG_SERVICE_ANALYTICS;
            break;
        default:
            m_svc_string = nullptr;
    }
    if (m_tracer && m_tracer->version != 0 && m_svc_string) {
        add_tag(LCBTRACE_TAG_SERVICE, 0, m_svc_string, 0);
    }
}

lcbtrace_THRESHOLDOPTS Span::service() const
{
    return m_svc;
}

const char *Span::service_str() const
{
    return m_svc_string;
}

void *Span::external_span() const
{
    return m_extspan;
}

void Span::increment_dispatch(uint64_t dispatch)
{
    // outer span needs this for threshold logging only
    Span *outer = find_outer_or_this();
    outer->m_total_dispatch += dispatch;
    outer->m_last_dispatch = dispatch;
}

void Span::increment_server(uint64_t server)
{
    // outer span needs this for threshold logging only
    Span *outer = find_outer_or_this();
    outer->m_total_server += server;
    outer->m_last_server = server;
    // but this span needs the tag always
    add_tag(LCBTRACE_TAG_PEER_LATENCY, 0, server);
}

lcbtrace_SPAN *Span::find_outer_or_this()
{
    lcbtrace_SPAN *outer = this;
    while (outer->m_parent != nullptr && !outer->is_outer()) {
        outer = outer->m_parent;
    }
    return outer;
}

void Span::external_span(void *extspan)
{
    m_extspan = extspan;
}

bool Span::is_dispatch() const
{
    return m_is_dispatch;
}

void Span::is_dispatch(bool dispatch)
{
    m_is_dispatch = dispatch;
}

bool Span::is_encode() const
{
    return m_is_encode;
}

void Span::is_encode(bool encode)
{
    m_is_encode = encode;
}

bool Span::is_outer() const
{
    return m_is_outer;
}

void Span::is_outer(bool outer)
{
    m_is_outer = outer;
}

void Span::should_finish(bool finish)
{
    m_should_finish = finish;
}

bool Span::should_finish() const
{
    // don't call finish on outer spans if external tracer is being used.
    return m_should_finish;
}

void Span::finish(uint64_t now)
{
    if (m_tracer && m_tracer->version == 1) {
        if (m_extspan != nullptr && m_tracer->v.v1.end_span != nullptr) {
            m_tracer->v.v1.end_span(m_extspan);
            return;
        }
    }
    m_finish = now ? now : lcbtrace_now();
    if (m_tracer && m_tracer->version == 0) {
        if (m_tracer->v.v0.report) {
            m_tracer->v.v0.report(m_tracer, this);
        }
    }
}

void Span::add_tag(const char *name, int copy_key, const char *value, int copy_value)
{
    if (name && value) {
        add_tag(name, copy_key, value, strlen(value), copy_value);
    }
}

void Span::add_tag(const char *name, const std::string &value)
{
    if (name != nullptr && !value.empty()) {
        add_tag(name, 0, value.c_str(), value.size(), 1);
    }
}

void Span::add_tag(const char *name, int copy_key, const char *value, size_t value_len, int copy_value)
{
    if (nullptr != m_extspan && nullptr != m_tracer) {
        if (1 == m_tracer->version && m_tracer->v.v1.add_tag_string) {
            // this always copies the key and value
            m_tracer->v.v1.add_tag_string(m_extspan, name, value, value_len);
        }
        return;
    }
    if (m_is_dispatch && m_parent && m_parent->is_outer()) {
        m_parent->add_tag(name, copy_key, value, value_len, copy_value);
        return;
    }
    auto *val = (tag_value *)calloc(1, sizeof(tag_value));
    val->t = TAGVAL_STRING;
    val->key.need_free = copy_key;
    if (copy_key) {
        val->key.p = lcb_strdup(name);
    } else {
        val->key.p = (char *)name;
    }
    val->v.s.need_free = copy_value;
    val->v.s.l = value_len;
    if (copy_value) {
        val->v.s.p = (char *)calloc(value_len, sizeof(char));
        memcpy(val->v.s.p, value, value_len);
    } else {
        val->v.s.p = (char *)value;
    }
    sllist_append(&m_tags, &val->slnode);
}

void Span::add_tag(const char *name, int copy, uint64_t value)
{
    if (nullptr != m_extspan && nullptr != m_tracer) {
        if (1 == m_tracer->version && m_tracer->v.v1.add_tag_string) {
            m_tracer->v.v1.add_tag_uint64(m_extspan, name, value);
        }
        return;
    }
    if (m_is_dispatch && m_parent && m_parent->is_outer()) {
        m_parent->add_tag(name, copy, value);
        return;
    }
    auto *val = (tag_value *)calloc(1, sizeof(tag_value));
    val->t = TAGVAL_UINT64;
    val->key.need_free = copy;
    if (copy) {
        val->key.p = lcb_strdup(name);
    } else {
        val->key.p = (char *)name;
    }
    val->v.u64 = value;
    sllist_append(&m_tags, &val->slnode);
}

void Span::add_tag(const char *name, int copy, double value)
{
    if (m_is_dispatch && m_parent && m_parent->is_outer()) {
        m_parent->add_tag(name, copy, value);
        return;
    }
    auto *val = (tag_value *)calloc(1, sizeof(tag_value));
    val->t = TAGVAL_DOUBLE;
    val->key.need_free = copy;
    if (copy) {
        val->key.p = lcb_strdup(name);
    } else {
        val->key.p = (char *)name;
    }
    val->v.d = value;
    sllist_append(&m_tags, &val->slnode);
}

void Span::add_tag(const char *name, int copy, bool value)
{
    if (m_is_dispatch && m_parent && m_parent->is_outer()) {
        m_parent->add_tag(name, copy, value);
        return;
    }
    auto *val = (tag_value *)calloc(1, sizeof(tag_value));
    val->t = TAGVAL_BOOL;
    val->key.need_free = copy;
    if (copy) {
        val->key.p = lcb_strdup(name);
    } else {
        val->key.p = (char *)name;
    }
    val->v.b = value;
    sllist_append(&m_tags, &val->slnode);
}
