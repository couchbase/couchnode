#pragma once
#ifndef TRACING_H
#define TRACING_H

#include <libcouchbase/couchbase.h>
#include <nan.h>
#include <node.h>

typedef void lcbxtrace_SPAN;

namespace couchnode
{

using namespace v8;

class RequestTracer
{
public:
    RequestTracer(Local<Object> impl);
    ~RequestTracer();

    lcbtrace_TRACER *lcbProcs() const;

    lcbxtrace_SPAN *requestSpan(const char *name, const lcbxtrace_SPAN *parent);

    void disconnect();

protected:
    bool _enabled;
    lcbtrace_TRACER *_lcbTracer;
    Nan::Persistent<Object> _impl;
    Nan::Persistent<Function> _requestSpanImpl;
};

class RequestSpan
{
public:
    RequestSpan(Local<Object> impl, bool isWrapped = false);
    ~RequestSpan();

    lcbxtrace_SPAN *lcbProcs() const;
    static void destroy(const RequestSpan *span);
    const Nan::Persistent<Object> &impl() const;

    void addTagString(const char *key, const char *value, size_t nvalue);
    void addTagUint64(const char *key, uint64_t value);
    void end();

protected:
    lcbxtrace_SPAN *_lcbSpan;
    bool _isWrapped;
    Nan::Persistent<Object> _impl;
    Nan::Persistent<Function> _addTagImpl;
    Nan::Persistent<Function> _endImpl;
};

} // namespace couchnode

#endif // TRACING_H
