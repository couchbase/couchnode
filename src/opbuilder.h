#pragma once
#ifndef OPBUILDER_H
#define OPBUILDER_H

#include "connection.h"
#include "instance.h"
#include "lcbx.h"
#include "tracespan.h"
#include "tracing.h"
#include "valueparser.h"
#include <libcouchbase/couchbase.h>

namespace couchnode
{

using namespace v8;

class OpCookie : public Nan::AsyncResource
{
public:
    OpCookie(Instance *inst, const Nan::Callback &callback,
             const Nan::Persistent<Object> &transcoder, TraceSpan span,
             WrappedRequestSpan *parentSpan)
        : Nan::AsyncResource("couchbase::op")
        , _inst(inst)
        , _parentSpan(parentSpan)
        , _traceSpan(span)
    {
        _callback.Reset(callback.GetFunction());
        _transcoder.Reset(transcoder);
    }

    ~OpCookie()
    {
        // We do not end the trace here, as the callback is responsible for
        // ending the trace at the appropriate point in time.

        _callback.Reset();
        _transcoder.Reset();

        if (_parentSpan) {
            delete _parentSpan;
            _parentSpan = nullptr;
        }
    }

    TraceSpan startDecodeTrace()
    {
        return TraceSpan::beginDecodeTrace(_inst, _traceSpan);
    }

    void endTrace()
    {
        _traceSpan.end();
    }

    Nan::AsyncResource *asyncContext()
    {
        return static_cast<Nan::AsyncResource *>(this);
    }

    Local<Value> invokeCallback(int argc, Local<Value> argv[])
    {
        return _callback.Call(argc, argv, asyncContext()).ToLocalChecked();
    }

    Instance *_inst;
    Nan::Callback _callback;
    Nan::Persistent<Object> _transcoder;
    WrappedRequestSpan *_parentSpan;
    TraceSpan _traceSpan;
};

template <typename CmdType>
class CmdBuilder
{
public:
    template <typename... Ts>
    CmdBuilder(ValueParser &valueParser, Ts... args)
        : _valueParser(valueParser)
    {
        if (lcbx_cmd_create(&_cmd, args...) != LCB_SUCCESS) {
            _cmd = nullptr;
        }
    }

    ~CmdBuilder()
    {
        if (_cmd) {
            lcbx_cmd_destroy(_cmd);
        }
    }

    template <lcb_STATUS (*SetFn)(CmdType *, const char *, size_t)>
    bool parseOption(Local<Value> value)
    {
        if (value.IsEmpty() || value->IsUndefined()) {
            return true;
        }

        const char *bytes;
        size_t nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
        }

        // Don't call the LCB function if the string is blank.
        if (bytes == nullptr || nbytes == 0) {
            return true;
        }

        return SetFn(_cmd, bytes, nbytes) == LCB_SUCCESS;
    }

    template <lcb_STATUS (*SetFn)(CmdType *, lcb_DURABILITY_LEVEL)>
    bool parseOption(Local<Value> value)
    {
        return _parseIntOption<lcb_DURABILITY_LEVEL, SetFn>(value);
    }

    template <lcb_STATUS (*SetFn)(CmdType *, lcb_HTTP_METHOD)>
    bool parseOption(Local<Value> value)
    {
        return _parseIntOption<lcb_HTTP_METHOD, SetFn>(value);
    }

    template <lcb_STATUS (*SetFn)(CmdType *, int32_t)>
    bool parseOption(Local<Value> value)
    {
        return _parseIntOption<int32_t, SetFn>(value);
    }

    template <lcb_STATUS (*SetFn)(CmdType *, int64_t)>
    bool parseOption(Local<Value> value)
    {
        return _parseIntOption<int64_t, SetFn>(value);
    }

    template <lcb_STATUS (*SetFn)(CmdType *, uint32_t)>
    bool parseOption(Local<Value> value)
    {
        return _parseUintOption<uint32_t, SetFn>(value);
    }

    template <lcb_STATUS (*SetFn)(CmdType *, uint64_t)>
    bool parseCasOption(Local<Value> value)
    {
        uint64_t cas;

        if (!Cas::parse(value, &cas)) {
            return false;
        }

        if (cas == 0) {
            return true;
        }

        return SetFn(_cmd, cas) == LCB_SUCCESS;
    }

    template <lcb_STATUS (*SetFn)(CmdType *, uint64_t)>
    bool parseOption(Local<Value> value)
    {
        return _parseUintOption<uint64_t, SetFn>(value);
    }

    template <lcb_STATUS (*SetFn)(CmdType *, int, int)>
    bool parseOption(Local<Value> valuea, Local<Value> valueb)
    {
        int parsedValueA;
        if (!_valueParser.parseUint(&parsedValueA, valuea)) {
            return false;
        }

        int parsedValueB;
        if (!_valueParser.parseUint(&parsedValueB, valueb)) {
            return false;
        }

        return SetFn(_cmd, parsedValueA, parsedValueB) == LCB_SUCCESS;
    }

    template <lcb_STATUS (*SetFn)(CmdType *, const char *, size_t, const char *,
                                  size_t)>
    bool parseOption(Local<Value> valuea, Local<Value> valueb)
    {
        const char *bytesa;
        size_t nbytesa;
        if (!_valueParser.parseString(&bytesa, &nbytesa, valuea)) {
            return false;
        }

        const char *bytesb;
        size_t nbytesb;
        if (!_valueParser.parseString(&bytesb, &nbytesb, valueb)) {
            return false;
        }

        return SetFn(_cmd, bytesa, nbytesa, bytesb, nbytesb) == LCB_SUCCESS;
    }

    template <lcb_STATUS (*SetFn)(lcb_SUBDOCSPECS *, size_t, uint32_t,
                                  const char *, size_t)>
    bool parseOption(size_t index, Local<Value> flags, Local<Value> value)
    {
        uint32_t parsedFlags = 0;
        if (!_valueParser.parseUint(&parsedFlags, flags)) {
            return false;
        }

        const char *parsedPath;
        size_t parsedNPath;
        if (!_valueParser.parseString(&parsedPath, &parsedNPath, value)) {
            return false;
        }

        return SetFn(_cmd, index, parsedFlags, parsedPath, parsedNPath) ==
               LCB_SUCCESS;
    }

    template <lcb_STATUS (*SetFn)(lcb_SUBDOCSPECS *, size_t, uint32_t,
                                  const char *, size_t, const char *, size_t)>
    bool parseOption(size_t index, Local<Value> flags, Local<Value> path,
                     Local<Value> value)
    {
        uint32_t parsedFlags = 0;
        if (!_valueParser.parseUint(&parsedFlags, flags)) {
            return false;
        }

        const char *parsedPath;
        size_t parsedNPath;
        if (!_valueParser.parseString(&parsedPath, &parsedNPath, path)) {
            return false;
        }

        const char *parsedValue;
        size_t parsedNValue;
        if (!_valueParser.parseString(&parsedValue, &parsedNValue, value)) {
            return false;
        }

        return SetFn(_cmd, index, parsedFlags, parsedPath, parsedNPath,
                     parsedValue, parsedNValue) == LCB_SUCCESS;
    }

    template <lcb_STATUS (*SetFn)(lcb_SUBDOCSPECS *, size_t, uint32_t,
                                  const char *, size_t, int64_t)>
    bool parseOption(size_t index, Local<Value> flags, Local<Value> path,
                     Local<Value> value)
    {
        uint32_t parsedFlags = 0;
        if (!_valueParser.parseUint(&parsedFlags, flags)) {
            return false;
        }

        const char *parsedPath;
        size_t parsedNPath;
        if (!_valueParser.parseString(&parsedPath, &parsedNPath, path)) {
            return false;
        }

        int64_t parsedValue = 0;
        if (!_valueParser.parseInt(&parsedValue, value)) {
            return false;
        }

        return SetFn(_cmd, index, parsedFlags, parsedPath, parsedNPath,
                     parsedValue) == LCB_SUCCESS;
    }

    CmdType *cmd()
    {
        return _cmd;
    }

protected:
    template <typename T, lcb_STATUS (*SetFn)(CmdType *, T)>
    bool _parseIntOption(Local<Value> value)
    {
        if (value.IsEmpty() || value->IsUndefined()) {
            return true;
        }

        T parsedValue;
        if (!_valueParser.parseInt(&parsedValue, value)) {
            return false;
        }
        return SetFn(_cmd, parsedValue) == LCB_SUCCESS;
    }

    template <typename T, lcb_STATUS (*SetFn)(CmdType *, T)>
    bool _parseUintOption(Local<Value> value)
    {
        if (value.IsEmpty() || value->IsUndefined()) {
            return true;
        }

        T parsedValue;
        if (!_valueParser.parseUint(&parsedValue, value)) {
            return false;
        }
        return SetFn(_cmd, parsedValue) == LCB_SUCCESS;
    }

    CmdType *_cmd;
    ValueParser &_valueParser;
};

template <typename CmdType>
class OpBuilder : public CmdBuilder<CmdType>
{
public:
    template <typename... Ts>
    OpBuilder(Instance *inst, Ts... args)
        : CmdBuilder<CmdType>(_valueParser, args...)
        , _inst(inst)
        , _parentSpan(nullptr)
    {
    }

    ~OpBuilder()
    {
        _callback.Reset();
        _transcoder.Reset();

        if (_parentSpan) {
            delete _parentSpan;
            _parentSpan = nullptr;
        }
    }

    TraceSpan startEncodeTrace()
    {
        return TraceSpan::beginEncodeTrace(_inst, _traceSpan);
    }

    bool parseParentSpan(Local<Value> parentSpan)
    {
        if (_parentSpan) {
            delete _parentSpan;
            _parentSpan = nullptr;
        }

        if (!parentSpan.IsEmpty() && parentSpan->IsObject()) {
            _parentSpan =
                new WrappedRequestSpan(_inst, parentSpan.As<Object>());
        }

        return true;
    }

    bool parseTranscoder(Local<Value> transcoder)
    {
        if (transcoder->IsUndefined() || transcoder->IsNull()) {
            return true;
        }

        Nan::MaybeLocal<Object> transcoderObjM = Nan::To<Object>(transcoder);
        if (transcoderObjM.IsEmpty()) {
            return false;
        }

        _transcoder.Reset(transcoderObjM.ToLocalChecked());

        return true;
    }

    bool parseCallback(Local<Value> callback)
    {
        Nan::MaybeLocal<Function> callbackFnM = Nan::To<Function>(callback);
        if (callbackFnM.IsEmpty()) {
            return false;
        }

        _callback.Reset(callbackFnM.ToLocalChecked());
        return true;
    }

    template <lcb_STATUS (*BytesFn)(CmdType *, const char *, size_t),
              lcb_STATUS (*FlagsFn)(CmdType *, uint32_t)>
    bool parseDocValue(Local<Value> value)
    {
        ScopedTraceSpan encSpan = this->startEncodeTrace();

        Local<Object> transcoderObj = Nan::New(this->_transcoder);

        Nan::MaybeLocal<Value> encodeFnValM =
            Nan::Get(transcoderObj, Nan::New("encode").ToLocalChecked());
        if (encodeFnValM.IsEmpty()) {
            return false;
        }

        Nan::MaybeLocal<Function> encodeFnM =
            Nan::To<Function>(encodeFnValM.ToLocalChecked());
        if (encodeFnM.IsEmpty()) {
            return false;
        }

        Local<Function> encodeFn = encodeFnM.ToLocalChecked();

        Local<Value> argsArr[] = {value};
        Nan::MaybeLocal<Value> resValM =
            Nan::CallAsFunction(encodeFn, transcoderObj, 1, argsArr);
        if (resValM.IsEmpty()) {
            return false;
        }

        Nan::MaybeLocal<Object> resArrM =
            Nan::To<Object>(resValM.ToLocalChecked());
        if (resArrM.IsEmpty()) {
            return false;
        }

        Local<Object> resArr = resArrM.ToLocalChecked();

        Nan::MaybeLocal<Value> valueValM = Nan::Get(resArr, 0);
        if (valueValM.IsEmpty()) {
            return false;
        }
        Local<Value> valueVal = valueValM.ToLocalChecked();

        Nan::MaybeLocal<Value> flagsValM = Nan::Get(resArr, 1);
        if (flagsValM.IsEmpty()) {
            return false;
        }
        Local<Value> flagsVal = flagsValM.ToLocalChecked();

        if (!this->template parseOption<BytesFn>(valueVal)) {
            return false;
        }
        if (!this->template parseOption<FlagsFn>(flagsVal)) {
            return false;
        }
        return true;
    }

    template <typename SubCmdType, typename... Ts>
    CmdBuilder<SubCmdType> makeSubCmdBuilder(Ts... args)
    {
        return CmdBuilder<SubCmdType>(this->_valueParser, args...);
    }

    void beginTrace(lcbtrace_SERVICE service, const char *opName)
    {
        TraceSpan parentSpan;
        if (_parentSpan && *_parentSpan) {
            parentSpan = TraceSpan::wrap(_parentSpan->span());
        }

        TraceSpan span =
            TraceSpan::beginOpTrace(_inst, service, opName, parentSpan);
        _traceSpan = span;
    }

    ValueParser &valueParser()
    {
        return _valueParser;
    }

    template <lcb_STATUS (*ExecFn)(lcb_INSTANCE *, void *, const CmdType *)>
    lcb_STATUS execute()
    {
        if (_traceSpan) {
            lcb_STATUS err =
                lcbx_cmd_parent_span(this->cmd(), _traceSpan.span());
            if (err != LCB_SUCCESS) {
                return err;
            }
        }

        OpCookie *cookie =
            new OpCookie(this->_inst, this->_callback, this->_transcoder,
                         this->_traceSpan, this->_parentSpan);

        // ownership of the parent span wrapper transfers to the opcookie
        _parentSpan = nullptr;

        lcb_STATUS err = ExecFn(this->_inst->lcbHandle(), cookie, this->cmd());
        if (err != LCB_SUCCESS) {
            // If the result was unsuccessful, we need to destroy the cookie
            // since we won't see it in any callbacks.
            delete cookie;
        }

        return err;
    }

protected:
    Instance *_inst;
    ValueParser _valueParser;
    std::vector<Nan::Utf8String *> _strings;
    Nan::Callback _callback;
    Nan::Persistent<Object> _transcoder;
    WrappedRequestSpan *_parentSpan;
    TraceSpan _traceSpan;
};

} // namespace couchnode

#endif // OPBUILDER_H
