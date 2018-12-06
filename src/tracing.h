/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#ifndef TRACING_H_
#define TRACING_H_

#include "couchbase_impl.h"
#include <libcouchbase/couchbase.h>
#include <libcouchbase/tracing.h>

namespace Couchnode
{

class TraceSpan
{
public:
    TraceSpan()
        : _span(NULL)
    {
    }

    ~TraceSpan()
    {
        // We do not stop the trace here, as it is expected that it will
        // stopped explicitly rather than implicitly.
    }

    void end()
    {
        if (_span) {
            lcbtrace_span_finish(_span, LCBTRACE_NOW);
        }
    }

    lcbtrace_SPAN *span() const
    {
        return _span;
    }

    operator bool() const
    {
        return !!_span;
    }

    static TraceSpan beginOpTrace(CouchbaseImpl *impl, const char *opName)
    {
        lcbtrace_TRACER *tracer = lcb_get_tracer(impl->getLcbHandle());
        if (!tracer) {
            return TraceSpan();
        }

        lcbtrace_SPAN *span = lcbtrace_span_start(tracer, opName, 0, NULL);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT,
                                  impl->getClientString());

        return TraceSpan(span);
    }

    static TraceSpan beginEncodeTrace(CouchbaseImpl *impl, TraceSpan opSpan)
    {
        if (!opSpan) {
            return TraceSpan();
        }

        lcbtrace_TRACER *tracer = lcb_get_tracer(impl->getLcbHandle());
        if (!tracer) {
            return TraceSpan();
        }

        lcbtrace_REF ref;
        ref.type = LCBTRACE_REF_CHILD_OF;
        ref.span = opSpan.span();
        lcbtrace_SPAN *span = lcbtrace_span_start(
            tracer, LCBTRACE_OP_REQUEST_ENCODING, LCBTRACE_NOW, &ref);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT,
                                  impl->getClientString());

        return TraceSpan(span);
    }

    static TraceSpan beginDecodeTrace(CouchbaseImpl *impl, TraceSpan opSpan)
    {
        if (!opSpan) {
            return NULL;
        }

        lcbtrace_TRACER *tracer = lcb_get_tracer(impl->getLcbHandle());
        if (!tracer) {
            return NULL;
        }

        lcbtrace_REF ref;
        ref.type = LCBTRACE_REF_CHILD_OF;
        ref.span = opSpan.span();
        lcbtrace_SPAN *span = lcbtrace_span_start(
            tracer, LCBTRACE_OP_RESPONSE_DECODING, LCBTRACE_NOW, &ref);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT,
                                  impl->getClientString());

        return TraceSpan(span);
    }

private:
    TraceSpan(lcbtrace_SPAN *span)
        : _span(span)
    {
    }

    lcbtrace_SPAN *_span;
};

class ScopedTraceSpan
{
public:
    ScopedTraceSpan(TraceSpan span)
        : _span(span)
    {
    }

    ~ScopedTraceSpan()
    {
        _span.end();
    }

private:
    TraceSpan _span;
};

} // namespace Couchnode

#endif /* TRACING_H_ */
