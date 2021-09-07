#include "tracing.h"

namespace couchnode
{

RequestTracer *unwrapTracer(const lcbtrace_TRACER *procs)
{
    return reinterpret_cast<RequestTracer *>(procs->cookie);
}

RequestSpan *unwrapSpan(const lcbxtrace_SPAN *procs)
{
    return reinterpret_cast<RequestSpan *>((void *)procs);
}

static lcbxtrace_SPAN *lcbTracerStartSpan(lcbtrace_TRACER *procs,
                                          const char *name,
                                          lcbxtrace_SPAN *parent)
{
    RequestTracer *tracer = unwrapTracer(procs);
    if (tracer) {
        return tracer->requestSpan(name, parent);
    }
    return nullptr;
}

static void lcbSpanEnd(lcbxtrace_SPAN *procs)
{
    RequestSpan *span = unwrapSpan(procs);
    if (span) {
        span->end();
    }
}

static void lcbSpanDestroy(lcbxtrace_SPAN *procs)
{
    RequestSpan *span = unwrapSpan(procs);
    if (span) {
        RequestSpan::destroy(span);
    }
}

static void lcbSpanAddTagString(lcbxtrace_SPAN *procs, const char *name,
                                const char *value, size_t nvalue)
{
    RequestSpan *span = unwrapSpan(procs);
    if (span) {
        span->addTagString(name, value, nvalue);
    }
}

static void lcbSpanAddTagUint64(lcbxtrace_SPAN *procs, const char *name,
                                uint64_t value)
{
    RequestSpan *span = unwrapSpan(procs);
    if (span) {
        span->addTagUint64(name, value);
    }
}

RequestTracer::RequestTracer(Local<Object> impl)
    : _enabled(true)
{
    _lcbTracer = lcbtrace_new(nullptr, LCBTRACE_F_EXTERNAL);
    _lcbTracer->version = 1;
    _lcbTracer->destructor = nullptr;
    _lcbTracer->v.v1.start_span = lcbTracerStartSpan;
    _lcbTracer->v.v1.end_span = lcbSpanEnd;
    _lcbTracer->v.v1.destroy_span = lcbSpanDestroy;
    _lcbTracer->v.v1.add_tag_string = lcbSpanAddTagString;
    _lcbTracer->v.v1.add_tag_uint64 = lcbSpanAddTagUint64;
    _lcbTracer->cookie = reinterpret_cast<void *>(this);

    _impl.Reset(impl);
    _requestSpanImpl.Reset(
        Nan::Get(impl, Nan::New("requestSpan").ToLocalChecked())
            .ToLocalChecked()
            .As<Function>());
}

RequestTracer::~RequestTracer()
{
    _requestSpanImpl.Reset();
    _impl.Reset();
    lcbtrace_destroy(_lcbTracer);
    _lcbTracer = nullptr;
}

lcbtrace_TRACER *RequestTracer::lcbProcs() const
{
    return _lcbTracer;
}

void RequestTracer::disconnect()
{
    _enabled = false;
}

lcbxtrace_SPAN *RequestTracer::requestSpan(const char *name,
                                           const lcbxtrace_SPAN *parent)
{
    if (!_enabled) {
        return nullptr;
    }

    Nan::HandleScope scope;
    Local<Object> impl = Nan::New(_impl);
    Local<Function> requestSpanImpl = Nan::New(_requestSpanImpl);
    if (impl.IsEmpty() || requestSpanImpl.IsEmpty()) {
        return nullptr;
    }

    Local<String> nameVal = Nan::New<String>(name).ToLocalChecked();
    Local<Value> parentVal = Nan::Undefined();
    if (parent) {
        RequestSpan *parentSpan = unwrapSpan(parent);
        if (parentSpan) {
            parentVal = Nan::New(parentSpan->impl());
        }
    }
    Local<Value> argv[] = {nameVal, parentVal};
    Local<Value> res =
        Nan::Call(requestSpanImpl, impl, 2, argv).ToLocalChecked();
    if (res.IsEmpty() || !res->IsObject()) {
        return nullptr;
    }

    return (new RequestSpan(res.As<Object>()))->lcbProcs();
}

RequestSpan::RequestSpan(Local<Object> impl, bool isWrapped)
    : _lcbSpan(this)
    , _isWrapped(isWrapped)
{
    _addTagImpl.Reset(Nan::Get(impl, Nan::New("addTag").ToLocalChecked())
                          .ToLocalChecked()
                          .As<Function>());
    _endImpl.Reset(Nan::Get(impl, Nan::New("end").ToLocalChecked())
                       .ToLocalChecked()
                       .As<Function>());
    _impl.Reset(impl);
}

RequestSpan::~RequestSpan()
{
    _addTagImpl.Reset();
    _endImpl.Reset();
    _impl.Reset();
}

lcbxtrace_SPAN *RequestSpan::lcbProcs() const
{
    return _lcbSpan;
}

void RequestSpan::destroy(const RequestSpan *span)
{
    if (span->_isWrapped) {
        // if its wrapped, the owner is responsible for cleanup
        return;
    }

    delete span;
}

const Nan::Persistent<Object> &RequestSpan::impl() const
{
    return _impl;
}

void RequestSpan::addTagString(const char *key, const char *value,
                               size_t nvalue)
{
    if (_isWrapped) {
        return;
    }

    Nan::HandleScope scope;
    Local<Object> impl = Nan::New(_impl);
    Local<Function> addTagImpl = Nan::New(_addTagImpl);
    if (impl.IsEmpty() || addTagImpl.IsEmpty()) {
        return;
    }

    Local<String> keyVal = Nan::New<String>(key).ToLocalChecked();
    Local<String> valueVal = Nan::New<String>(value, nvalue).ToLocalChecked();
    Local<Value> argv[] = {keyVal, valueVal};
    Nan::Call(addTagImpl, impl, 2, argv);
}

void RequestSpan::addTagUint64(const char *key, uint64_t value)
{
    if (_isWrapped) {
        return;
    }

    Nan::HandleScope scope;
    Local<Object> impl = Nan::New(_impl);
    Local<Function> addTagImpl = Nan::New(_addTagImpl);
    if (impl.IsEmpty() || addTagImpl.IsEmpty()) {
        return;
    }

    Local<String> keyVal = Nan::New<String>(key).ToLocalChecked();
    Local<Number> valueVal = Nan::New<Number>(value);
    Local<Value> argv[] = {keyVal, valueVal};
    Nan::Call(addTagImpl, impl, 2, argv);
}

void RequestSpan::end()
{
    if (_isWrapped) {
        return;
    }

    Nan::HandleScope scope;
    Local<Object> impl = Nan::New(_impl);
    Local<Function> endImpl = Nan::New(_endImpl);
    if (impl.IsEmpty() || endImpl.IsEmpty()) {
        return;
    }

    Nan::Call(endImpl, impl, 0, nullptr);
}

} // namespace couchnode
