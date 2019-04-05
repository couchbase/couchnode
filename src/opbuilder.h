#pragma once
#ifndef OPBUILDER_H
#define OPBUILDER_H

#include "connection.h"
#include "lcbx.h"
#include "tracespan.h"
#include "valueparser.h"
#include <libcouchbase/couchbase.h>

namespace couchnode
{

using namespace v8;

class OpCookie : public Nan::AsyncResource
{
public:
    OpCookie(Connection *impl, const Nan::Callback &callback, TraceSpan span)
        : Nan::AsyncResource("couchbase::op")
        , _impl(impl)
        , _traceSpan(span)
    {
        _callback.Reset(callback.GetFunction());
    }

    ~OpCookie()
    {
        // We do not end the trace here, as the callback is responsible for
        // ending the trace at the appropriate point in time.

        _callback.Reset();
    }

    TraceSpan startDecodeTrace()
    {
        return TraceSpan::beginDecodeTrace(_impl, _traceSpan);
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

    Connection *_impl;
    Nan::Callback _callback;
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
        const char *bytes;
        size_t nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
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

    template <lcb_STATUS (*SetFn)(CmdType *, lcb_CAS)>
    bool parseOption(Local<Value> value)
    {
        lcb_CAS cas;

        if (!Cas::parse(value, &cas)) {
            return false;
        }

        return SetFn(_cmd, cas) == LCB_SUCCESS;
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

    template <lcb_STATUS (*SetFn)(lcb_SUBDOCOPS *, size_t, uint32_t,
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

    template <lcb_STATUS (*SetFn)(lcb_SUBDOCOPS *, size_t, uint32_t,
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

    template <lcb_STATUS (*SetFn)(lcb_SUBDOCOPS *, size_t, uint32_t,
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
        T parsedValue;
        if (!_valueParser.parseInt(&parsedValue, value)) {
            return false;
        }
        return SetFn(_cmd, parsedValue) == LCB_SUCCESS;
    }

    template <typename T, lcb_STATUS (*SetFn)(CmdType *, T)>
    bool _parseUintOption(Local<Value> value)
    {
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
    OpBuilder(Connection *impl, Ts... args)
        : CmdBuilder<CmdType>(_valueParser, args...)
        , _impl(impl)
    {
    }

    ~OpBuilder()
    {
    }

    template <lcb_STATUS (*ValueFn)(CmdType *, const char *, size_t),
              lcb_STATUS (*FlagsFn)(CmdType *, uint32_t),
              lcb_STATUS (*DatatypeFn)(CmdType *, uint8_t)>
    bool parseValue(Local<Value> value)
    {
        ScopedTraceSpan encSpan =
            TraceSpan::beginEncodeTrace(_impl, _traceSpan);

        const char *bytes;
        size_t nbytes;
        uint32_t flags;
        if (!_impl->encodeDoc(_valueParser, &bytes, &nbytes, &flags, value)) {
            return false;
        }

        uint8_t datatype = 0;

        if (DatatypeFn(this->cmd(), datatype) != LCB_SUCCESS) {
            return false;
        }
        if (FlagsFn(this->cmd(), flags) != LCB_SUCCESS) {
            return false;
        }
        if (ValueFn(this->cmd(), bytes, nbytes) != LCB_SUCCESS) {
            return false;
        }

        return true;
    }

    bool parseCallback(Local<Value> callback)
    {
        if (callback->IsFunction()) {
            _callback.Reset(callback.As<v8::Function>());
            return true;
        }
        return false;
    }

    template <typename SubCmdType, typename... Ts>
    CmdBuilder<SubCmdType> makeSubCmdBuilder(Ts... args)
    {
        return CmdBuilder<SubCmdType>(this->_valueParser, args...);
    }

    void beginTrace(const char *opName)
    {
        TraceSpan span = TraceSpan::beginOpTrace(_impl, opName);
        _traceSpan = span;
    }

    ValueParser &valueParser()
    {
        return _valueParser;
    }

    template <lcb_STATUS (*ExecFn)(lcb_INSTANCE *, void *, const CmdType *)>
    lcb_STATUS execute()
    {
        OpCookie *cookie =
            new OpCookie(this->_impl, this->_callback, this->_traceSpan);

        lcb_STATUS err = ExecFn(this->_impl->lcbHandle(), cookie, this->cmd());
        if (err != LCB_SUCCESS) {
            // If the result was unsuccessful, we need to destroy the cookie
            // since we won't see it in any callbacks.
            delete cookie;
        }

        return err;
    }

protected:
    Connection *_impl;
    ValueParser _valueParser;
    std::vector<Nan::Utf8String *> _strings;
    Nan::Callback _callback;
    TraceSpan _traceSpan;
};

} // namespace couchnode

#endif // OPBUILDER_H
