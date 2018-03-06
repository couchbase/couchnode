/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018 Couchbase, Inc.
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

#ifdef LCB_TRACING
#include <libcouchbase/tracing.h>
#include "rnd.h"

#ifdef __cplusplus

namespace lcb
{
namespace trace
{

class Span
{
  public:
    Span(lcbtrace_TRACER *tracer, const char *opname, uint64_t start, lcbtrace_REF_TYPE ref, lcbtrace_SPAN *other);

    void finish(uint64_t finish);
    template < typename T > void add_tag(const char *name, T value);

    lcbtrace_TRACER *m_tracer;
    std::string m_opname;
    uint64_t m_span_id;
    uint64_t m_start;
    uint64_t m_finish;
    Json::Value tags;
    Span *m_parent;
};

} // namespace trace
} // namespace lcb

extern "C" {
#endif
LCB_INTERNAL_API
void lcbtrace_spann_add_system_tags(lcbtrace_SPAN *span, lcb_settings *settings, const char *service);

#define LCBTRACE_KV_START(settings, cmd, opaque, outspan)                                                              \
    if ((settings)->tracer) {                                                                                          \
        lcbtrace_REF ref;                                                                                              \
        ref.type = LCBTRACE_REF_CHILD_OF;                                                                              \
        ref.span = (cmd->_hashkey.type & LCB_KV_TRACESPAN) ? (lcbtrace_SPAN *)cmd->_hashkey.contig.bytes : NULL;       \
        outspan = lcbtrace_span_start((settings)->tracer, LCBTRACE_OP_DISPATCH_TO_SERVER, LCBTRACE_NOW, &ref);         \
        lcbtrace_span_add_tag_uint64(outspan, LCBTRACE_TAG_OPERATION_ID, opaque);                                      \
        lcbtrace_spann_add_system_tags(outspan, (settings), LCBTRACE_TAG_SERVICE_KV);                                  \
    }

#define LCBTRACE_KV_FINISH(pipeline, request, response)                                                                \
    do {                                                                                                               \
        lcbtrace_SPAN *span = MCREQ_PKT_RDATA(request)->span;                                                          \
        if (span) {                                                                                                    \
            lcbtrace_span_add_tag_uint64(span, LCBTRACE_TAG_PEER_LATENCY, (response)->duration());                     \
            lcb::Server *server = static_cast< lcb::Server * >(pipeline);                                              \
            const lcb_host_t &remote = server->get_host();                                                             \
            std::string hh;                                                                                            \
            if (remote.ipv6) {                                                                                         \
                hh.append("[").append(remote.host).append("]:").append(remote.port);                                   \
            } else {                                                                                                   \
                hh.append(remote.host).append(":").append(remote.port);                                                \
            }                                                                                                          \
            lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_PEER_ADDRESS, hh.c_str());                                    \
            lcbio_CTX *ctx = server->connctx;                                                                          \
            if (ctx) {                                                                                                 \
                lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_LOCAL_ADDRESS,                                            \
                                          lcbio__inet_ntop(&ctx->sock->info->sa_local).c_str());                       \
            }                                                                                                          \
            lcbtrace_span_finish(span, LCBTRACE_NOW);                                                                  \
        }                                                                                                              \
    } while (0);

#ifdef __cplusplus
}
#endif

#else

#define LCBTRACE_KV_START(settings, cmd, opaque, outspan)
#define LCBTRACE_KV_FINISH(pipeline, request, response)

#endif /* LCB_TRACING */

#endif /* LCB_TRACING_INTERNAL_H */
