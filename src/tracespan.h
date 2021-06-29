#pragma once
#ifndef TRACESPAN_H
#define TRACESPAN_H

#include "tracing.h"
#include <libcouchbase/couchbase.h>
#include <libcouchbase/tracing.h>

namespace couchnode
{

class TraceSpan
{
public:
    TraceSpan()
        : _span(nullptr)
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

    static TraceSpan wrap(lcbtrace_SPAN *span)
    {
        return TraceSpan(span);
    }

    static TraceSpan beginOpTrace(Connection *impl, lcbtrace_SERVICE service,
                                  const char *opName, TraceSpan parent)
    {
        lcbtrace_TRACER *tracer = lcb_get_tracer(impl->lcbHandle());
        if (!tracer) {
            return TraceSpan();
        }

        lcbtrace_REF *refPtr = nullptr;
        lcbtrace_REF ref;
        if (parent) {
            ref.type = LCBTRACE_REF_CHILD_OF;
            ref.span = parent.span();
            refPtr = &ref;
        }

        lcbtrace_SPAN *span = lcbtrace_span_start(tracer, opName, 0, refPtr);
        lcbtrace_span_set_is_outer(span, 1);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_COMPONENT,
                                  impl->clientString());
        lcbtrace_span_set_service(span, service);

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

class WrappedRequestSpan
{
public:
    WrappedRequestSpan(Connection *conn, Local<Object> val)
        : _reqSpan(val, true)
        , _span(nullptr)
    {
        lcbtrace_TRACER *tracer = lcb_get_tracer(conn->lcbHandle());
        if (!tracer) {
            _span = nullptr;
            return;
        }

        lcb_STATUS err =
            lcbtrace_span_wrap(tracer, "wrapped-app-span", LCBTRACE_NOW,
                               _reqSpan.lcbProcs(), &_span);
        if (err != LCB_SUCCESS) {
            _span = nullptr;
        }
    }

    ~WrappedRequestSpan()
    {
        if (_span) {
            lcbtrace_span_finish(_span, 0);
            _span = nullptr;
        }
    }

    operator bool() const
    {
        return _span != nullptr;
    }

    lcbtrace_SPAN *span() const
    {
        return _span;
    }

private:
    RequestSpan _reqSpan;
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

#endif // TRACESPAN_H
