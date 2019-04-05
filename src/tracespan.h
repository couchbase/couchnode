#pragma once
#ifndef TRACING_H
#define TRACING_H

#include <libcouchbase/couchbase.h>
#include <libcouchbase/tracing.h>

namespace couchnode
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

    static TraceSpan beginOpTrace(Connection *impl, const char *opName)
    {
        lcbtrace_TRACER *tracer = lcb_get_tracer(impl->lcbHandle());
        if (!tracer) {
            return TraceSpan();
        }

        lcbtrace_SPAN *span = lcbtrace_span_start(tracer, opName, 0, NULL);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT,
                                  impl->clientString());

        return TraceSpan(span);
    }

    static TraceSpan beginEncodeTrace(Connection *impl, TraceSpan opSpan)
    {
        if (!opSpan) {
            return TraceSpan();
        }

        lcbtrace_TRACER *tracer = lcb_get_tracer(impl->lcbHandle());
        if (!tracer) {
            return TraceSpan();
        }

        lcbtrace_REF ref;
        ref.type = LCBTRACE_REF_CHILD_OF;
        ref.span = opSpan.span();
        lcbtrace_SPAN *span = lcbtrace_span_start(
            tracer, LCBTRACE_OP_REQUEST_ENCODING, LCBTRACE_NOW, &ref);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT,
                                  impl->clientString());

        return TraceSpan(span);
    }

    static TraceSpan beginDecodeTrace(Connection *impl, TraceSpan opSpan)
    {
        if (!opSpan) {
            return NULL;
        }

        lcbtrace_TRACER *tracer = lcb_get_tracer(impl->lcbHandle());
        if (!tracer) {
            return NULL;
        }

        lcbtrace_REF ref;
        ref.type = LCBTRACE_REF_CHILD_OF;
        ref.span = opSpan.span();
        lcbtrace_SPAN *span = lcbtrace_span_start(
            tracer, LCBTRACE_OP_RESPONSE_DECODING, LCBTRACE_NOW, &ref);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT,
                                  impl->clientString());

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

} // namespace couchnode

#endif // TRACING_H
