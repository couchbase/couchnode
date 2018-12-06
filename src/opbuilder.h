#ifndef OPBUILDER_H_
#define OPBUILDER_H_

#include "couchbase_impl.h"
#include "tracing.h"
#include "valueparser.h"
#include <libcouchbase/couchbase.h>

using namespace v8;

namespace Couchnode
{

void setHandleParentSpan(lcb_t inst, lcb_VIEWHANDLE &handle, TraceSpan span);
void setHandleParentSpan(lcb_t inst, lcb_N1QLHANDLE &handle, TraceSpan span);
void setHandleParentSpan(lcb_t inst, lcb_FTSHANDLE &handle, TraceSpan span);

class OpCookie : public Nan::AsyncResource
{
public:
    OpCookie(CouchbaseImpl *impl, const Nan::Callback &callback, TraceSpan span)
        : Nan::AsyncResource("couchbase:op.Callback")
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

    CouchbaseImpl *_impl;
    Nan::Callback _callback;
    TraceSpan _traceSpan;
};

template <typename CmdType>
class CmdBuilder
{
public:
    CmdBuilder(ValueParser &valueParser)
        : _valueParser(valueParser)
    {
        memset(&_cmd, 0, sizeof(_cmd));
    }

    template <const char *CmdType::*Field>
    bool parseCstrOption(Local<Value> value)
    {
        const char *bytes;
        if (!_valueParser.parseString(&bytes, value)) {
            return false;
        }

        _cmd.*Field = bytes;

        return true;
    }

    // We have to implement a unsigned int version and an unsigned long version
    // because libcouchbase occasionally uses size_t and occasionally uses
    // lcb_SIZE. Unfortunately, lcb_SIZE resolves to SIZE_T on windows, which is
    // not the same size as size_t, and causes all sorts of headaches.
    template <const char *CmdType::*Field, unsigned int CmdType::*NField>
    bool parseNstrOption(Local<Value> value)
    {
        const char *bytes;
        lcb_U32 nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
        }

        _cmd.*Field = bytes;
        _cmd.*NField = nbytes;

        return true;
    }
    template <const char *CmdType::*Field, unsigned long CmdType::*NField>
    bool parseNstrOption(Local<Value> value)
    {
        const char *bytes;
        lcb_U32 nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
        }

        _cmd.*Field = bytes;
        _cmd.*NField = nbytes;

        return true;
    }
#ifdef _MSC_VER
    template <const char *CmdType::*Field, unsigned __int64 CmdType::*NField>
    bool parseNstrOption(Local<Value> value)
    {
        const char *bytes;
        lcb_U32 nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
        }

        _cmd.*Field = bytes;
        _cmd.*NField = nbytes;

        return true;
    }
#endif

    template <const char *CmdType::*Field>
    bool parseStrOption(Local<Value> value);

    template <lcb_KEYBUF CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        lcb_KEYBUF &valRef = _cmd.*Field;

        const char *bytes;
        lcb_U32 nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
        }

        // LCB_CMD_SET_KEY
        valRef.type = LCB_KV_COPY;
        valRef.contig.bytes = bytes;
        valRef.contig.nbytes = nbytes;

        return true;
    }

    template <lcb_VALBUF CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        lcb_VALBUF &valRef = _cmd.*Field;

        const char *bytes;
        lcb_U32 nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
        }

        // LCB_CMD_SET_VALUE
        valRef.vtype = LCB_KV_COPY;
        valRef.u_buf.contig.bytes = bytes;
        valRef.u_buf.contig.nbytes = nbytes;

        return true;
    }

    template <int CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseInt(&(_cmd.*Field), value);
    }

    template <lcb_int64_t CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseInt(&(_cmd.*Field), value);
    }

    template <lcb_U8 CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseUint(&(_cmd.*Field), value);
    }

    template <lcb_U16 CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseUint(&(_cmd.*Field), value);
    }

    template <lcb_U32 CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseUint(&(_cmd.*Field), value);
    }

    // also cover lcb_cas_t
    template <lcb_U64 CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        if (_valueParser.parseCas(&(_cmd.*Field), value)) {
            return true;
        }

        return _valueParser.parseUint(&(_cmd.*Field), value);
    }

    template <lcb_storage_t CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseUint(&(_cmd.*Field), value);
    }

    template <lcb_http_type_t CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseUint(&(_cmd.*Field), value);
    }

    template <lcb_http_method_t CmdType::*Field>
    bool parseOption(Local<Value> value)
    {
        return _valueParser.parseUint(&(_cmd.*Field), value);
    }

    CmdType *cmd()
    {
        return &_cmd;
    }

protected:
    CmdType _cmd;
    ValueParser &_valueParser;
};

template <typename CmdType, CmdType *(*NewFn)()>
class DynCmdBuilder
{
public:
    DynCmdBuilder(ValueParser &valueParser)
        : _valueParser(valueParser)
    {
        _cmd = NewFn();
    }

    template <lcb_error_t (*SetFn)(CmdType *, const char *, size_t)>
    bool parseOption(Local<Value> value)
    {
        const char *bytes;
        size_t nbytes;
        if (!_valueParser.parseString(&bytes, &nbytes, value)) {
            return false;
        }
        return SetFn(_cmd, bytes, nbytes) == LCB_SUCCESS;
    }

    template <lcb_error_t (*SetFn)(CmdType *, int)>
    bool parseOption(Local<Value> value)
    {
        return _parseIntOption<int, SetFn>(value);
    }

    template <lcb_error_t (*SetFn)(CmdType *, lcb_U32)>
    bool parseOption(Local<Value> value)
    {
        return _parseUintOption<lcb_U32, SetFn>(value);
    }

    CmdType *cmd()
    {
        return _cmd;
    }

protected:
    template <typename T, lcb_error_t (*SetFn)(CmdType *, T)>
    bool _parseIntOption(Local<Value> value)
    {
        T parsedValue;
        if (!_valueParser.parseInt(&parsedValue, value)) {
            return false;
        }
        return SetFn(_cmd, parsedValue) == LCB_SUCCESS;
    }

    template <typename T, lcb_error_t (*SetFn)(CmdType *, T)>
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

template <typename CmdType, typename CmdBuilderType>
class BaseOpBuilder : public CmdBuilderType
{
public:
    BaseOpBuilder(CouchbaseImpl *impl)
        : CmdBuilderType(_valueParser)
        , _impl(impl)
    {
    }

    ~BaseOpBuilder()
    {
    }

    bool parseValue(Local<Value> value)
    {
        ScopedTraceSpan encSpan =
            TraceSpan::beginEncodeTrace(_impl, _traceSpan);

        const void *bytes;
        lcb_SIZE nbytes;
        lcb_U32 flags;
        if (!_impl->encodeDoc(_valueParser, &bytes, &nbytes, &flags, value)) {
            return false;
        }

        this->cmd()->datatype = 0;
        this->cmd()->flags = flags;

        // LCB_CMD_SET_VALUE
        this->cmd()->value.vtype = LCB_KV_COPY;
        this->cmd()->value.u_buf.contig.bytes = bytes;
        this->cmd()->value.u_buf.contig.nbytes = nbytes;

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

    template <typename SubCmdType>
    CmdBuilder<SubCmdType> makeSubCmdBuilder()
    {
        return CmdBuilder<SubCmdType>(this->_valueParser);
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

protected:
    CouchbaseImpl *_impl;
    ValueParser _valueParser;
    std::vector<Nan::Utf8String *> _strings;
    Nan::Callback _callback;
    TraceSpan _traceSpan;
};

template <typename CmdType>
class OpBuilder : public BaseOpBuilder<CmdType, CmdBuilder<CmdType>>
{
public:
    OpBuilder(CouchbaseImpl *impl)
        : BaseOpBuilder<CmdType, CmdBuilder<CmdType>>(impl)
    {
    }

    template <lcb_error_t (*ExecFn)(lcb_t, const void *, const CmdType *)>
    lcb_error_t execute()
    {
        OpCookie *cookie =
            new OpCookie(this->_impl, this->_callback, this->_traceSpan);

        lcb_error_t err =
            ExecFn(this->_impl->getLcbHandle(), cookie, this->cmd());
        if (err != LCB_SUCCESS) {
            // If the result was unsuccessful, we need to destroy the cookie
            // since we won't see it in any callbacks.
            delete cookie;
        }

        return err;
    }
};

template <typename CmdType, CmdType *(*NewCmdFn)()>
class DynOpBuilder
    : public BaseOpBuilder<CmdType, DynCmdBuilder<CmdType, NewCmdFn>>
{
public:
    DynOpBuilder(CouchbaseImpl *impl)
        : BaseOpBuilder<CmdType, DynCmdBuilder<CmdType, NewCmdFn>>(impl)
    {
    }

    template <lcb_error_t (*ExecFn)(lcb_t, const void *, CmdType *)>
    lcb_error_t execute()
    {
        OpCookie *cookie =
            new OpCookie(this->_impl, this->_callback, this->_traceSpan);

        lcb_error_t err =
            ExecFn(this->_impl->getLcbHandle(), cookie, this->cmd());
        if (err != LCB_SUCCESS) {
            // If the result was unsuccessful, we need to destroy the cookie
            // since we won't see it in any callbacks.
            delete cookie;
        }

        return err;
    }
};

template <typename CmdType, typename HandleType>
class HandleOpBuilder : public BaseOpBuilder<CmdType, CmdBuilder<CmdType>>
{
public:
    HandleOpBuilder(CouchbaseImpl *impl)
        : BaseOpBuilder<CmdType, CmdBuilder<CmdType>>(impl)
    {
    }

    void beginTrace(const char *opName)
    {
        BaseOpBuilder<CmdType, CmdBuilder<CmdType>>::beginTrace(opName);
    }

    template <lcb_error_t (*ExecFn)(lcb_t, const void *, const CmdType *)>
    lcb_error_t execute()
    {
        HandleType handle;
        this->cmd()->handle = &handle;

        OpCookie *cookie =
            new OpCookie(this->_impl, this->_callback, this->_traceSpan);

        lcb_t instance = this->_impl->getLcbHandle();

        lcb_error_t err = ExecFn(instance, cookie, this->cmd());
        if (err != LCB_SUCCESS) {
            // If the result was unsuccessful, we need to destroy the cookie
            // since we won't see it in any callbacks.
            delete cookie;
        }

        if (err == LCB_SUCCESS) {
            if (this->_traceSpan) {
                setHandleParentSpan(instance, handle, this->_traceSpan);
            }
        }

        return err;
    }
};

template <typename OptsVType, typename CmdType>
class MultiCmdOpBuilder;

template <>
class MultiCmdOpBuilder<lcb_DURABILITYOPTSv0, lcb_CMDENDURE>
    : public BaseOpBuilder<lcb_DURABILITYOPTSv0,
                           CmdBuilder<lcb_DURABILITYOPTSv0>>
{
    typedef lcb_MULTICMD_CTX CtxType;
    typedef lcb_DURABILITYOPTSv0 OptsVType;
    typedef lcb_durability_opts_t OptsType;
    typedef lcb_CMDENDURE CmdType;

public:
    MultiCmdOpBuilder(CouchbaseImpl *impl)
        : BaseOpBuilder<lcb_DURABILITYOPTSv0, CmdBuilder<lcb_DURABILITYOPTSv0>>(
              impl)
    {
    }

    void addSubCmd(CmdBuilder<lcb_CMDENDURE> enc)
    {
        _subCmds.push_back(*enc.cmd());
    }

    template <CtxType *(*ExecFn)(lcb_t, const OptsType *, lcb_error_t *)>
    lcb_error_t execute()
    {
        lcb_durability_opts_st duraOpts;
        duraOpts.version = 0;
        duraOpts.v.v0 = *this->cmd();

        lcb_error_t err;
        lcb_MULTICMD_CTX *mctx =
            ExecFn(this->_impl->getLcbHandle(), &duraOpts, &err);
        if (err) {
            return err;
        }

        for (size_t i = 0; i < _subCmds.size(); ++i) {
            err = mctx->addcmd(mctx, (const lcb_CMDBASE *)&_subCmds[i]);
            if (err) {
                mctx->fail(mctx);
                return err;
            }
        }

        OpCookie *cookie = new OpCookie(_impl, _callback, _traceSpan);

        err = mctx->done(mctx, cookie);
        if (err != LCB_SUCCESS) {
            // If the result was unsuccessful, we need to destroy the cookie
            // since we won't see it in any callbacks.
            delete cookie;
        }

        return err;
    }

protected:
    std::vector<lcb_CMDENDURE> _subCmds;
};

} // namespace Couchnode

#endif /* OPBUILDER_H_ */
