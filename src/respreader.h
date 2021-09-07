#pragma once
#ifndef RESPREADER_H
#define RESPREADER_H

#include "error.h"
#include "instance.h"
#include "mutationtoken.h"
#include "opbuilder.h"

namespace couchnode
{

template <typename RespType, typename CtxType,
          lcb_STATUS (*CtxFn)(const RespType *, const CtxType **)>
class CtxReader
{
public:
    CtxReader(const RespType *resp)
    {
        lcb_STATUS rc = CtxFn(resp, &_ctx);
        if (rc != LCB_SUCCESS) {
            _ctx = nullptr;
        }
    }

    template <lcb_STATUS (*GetFn)(const CtxType *, uint16_t *)>
    Local<Value> parseValue()
    {
        return _parseValueNumber<uint16_t, GetFn>();
    }

    template <lcb_STATUS (*GetFn)(const CtxType *, uint32_t *)>
    Local<Value> parseValue()
    {
        return _parseValueNumber<uint32_t, GetFn>();
    }

    template <lcb_STATUS (*GetFn)(const CtxType *, uint64_t *)>
    Local<Value> decodeCas()
    {
        return _parseValueCas<GetFn>();
    }

    template <lcb_STATUS (*GetFn)(const CtxType *, const char **, size_t *)>
    Local<Value> parseValue()
    {
        return _parseValueString<GetFn>();
    }

private:
    template <typename ValueType,
              lcb_STATUS (*GetFn)(const CtxType *, ValueType *)>
    Local<Value> _parseValueNumber()
    {
        ValueType value;

        lcb_STATUS rc = GetFn(_ctx, &value);
        if (rc != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Nan::New<Number>(value);
    }

    template <lcb_STATUS (*GetFn)(const CtxType *, uint64_t *)>
    Local<Value> _parseValueCas()
    {
        uint64_t value;

        lcb_STATUS rc = GetFn(_ctx, &value);
        if (rc != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Cas::create(value);
    }

    template <lcb_STATUS (*GetFn)(const CtxType *, const char **, size_t *)>
    Local<Value> _parseValueString() const
    {
        const char *value = NULL;
        size_t nvalue = 0;
        if (GetFn(_ctx, &value, &nvalue) != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Nan::New<String>(value, nvalue).ToLocalChecked();
    }

    const CtxType *_ctx;
};

template <typename RespType, lcb_STATUS (*CookieFn)(const RespType *, void **)>
class RespReader
{
public:
    RespReader(lcb_INSTANCE *instance, const RespType *resp)
        : _instance(instance)
        , _resp(resp)
    {
        lcb_STATUS rc = CookieFn(_resp, reinterpret_cast<void **>(&_cookie));
        if (rc != LCB_SUCCESS) {
            _cookie = nullptr;
        }
    }

    Instance *instance() const
    {
        return Instance::fromLcbInst(_instance);
    }

    OpCookie *cookie() const
    {
        return _cookie;
    }

    template <lcb_STATUS (*GetFn)(const RespType *)>
    lcb_STATUS getValue()
    {
        return GetFn(_resp);
    }

    template <size_t (*GetFn)(const RespType *)>
    size_t getValue()
    {
        return GetFn(_resp);
    }

    template <lcb_STATUS (*GetFn)(const RespType *, size_t index)>
    lcb_STATUS getValue(size_t index)
    {
        return GetFn(_resp, index);
    }

    template <int (*GetFn)(const RespType *)>
    int getValue()
    {
        return GetFn(_resp);
    }

    template <lcb_STATUS (*GetFn)(const RespType *, uint16_t *)>
    Local<Value> parseValue() const
    {
        uint16_t value;

        lcb_STATUS rc = GetFn(_resp, &value);
        if (rc != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Nan::New<Number>(value);
    }

    template <lcb_STATUS (*GetFn)(const RespType *, uint32_t *)>
    Local<Value> parseValue() const
    {
        uint32_t value;

        lcb_STATUS rc = GetFn(_resp, &value);
        if (rc != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Nan::New<Number>(value);
    }

    template <lcb_STATUS (*GetFn)(const RespType *, uint64_t *)>
    Local<Value> parseValue() const
    {
        uint64_t value;

        lcb_STATUS rc = GetFn(_resp, &value);
        if (rc != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Nan::New<Number>(value);
    }

    template <lcb_STATUS (*CtxFn)(const RespType *,
                                  const lcb_KEY_VALUE_ERROR_CONTEXT **)>
    Local<Value> decodeError(lcb_STATUS rc) const
    {
        if (rc == LCB_SUCCESS) {
            return Nan::Null();
        }

        Local<Value> errVal = Error::create(rc);
        Local<Object> errValObj = errVal.As<Object>();

        CtxReader<RespType, lcb_KEY_VALUE_ERROR_CONTEXT, CtxFn> ctxRdr(_resp);
        Nan::Set(errValObj, Nan::New<String>("ctxtype").ToLocalChecked(),
                 Nan::New<String>("kv").ToLocalChecked());
        Nan::Set(errValObj, Nan::New<String>("status_code").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_status_code>());
        Nan::Set(errValObj, Nan::New<String>("opaque").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_opaque>());
        Nan::Set(errValObj, Nan::New<String>("cas").ToLocalChecked(),
                 ctxRdr.template decodeCas<&lcb_errctx_kv_cas>());
        Nan::Set(errValObj, Nan::New<String>("key").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_key>());
        Nan::Set(errValObj, Nan::New<String>("bucket").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_bucket>());
        Nan::Set(errValObj, Nan::New<String>("collection").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_collection>());
        Nan::Set(errValObj, Nan::New<String>("scope").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_scope>());
        Nan::Set(errValObj, Nan::New<String>("context").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_context>());
        Nan::Set(errValObj, Nan::New<String>("ref").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_kv_ref>());

        return errVal;
    }

    template <lcb_STATUS (*CtxFn)(const RespType *,
                                  const lcb_VIEW_ERROR_CONTEXT **)>
    Local<Value> decodeError(lcb_STATUS rc) const
    {
        if (rc == LCB_SUCCESS) {
            return Nan::Null();
        }

        Local<Value> errVal = Error::create(rc);
        Local<Object> errValObj = errVal.As<Object>();

        CtxReader<RespType, lcb_VIEW_ERROR_CONTEXT, CtxFn> ctxRdr(_resp);
        Nan::Set(errValObj, Nan::New<String>("ctxtype").ToLocalChecked(),
                 Nan::New<String>("views").ToLocalChecked());
        Nan::Set(
            errValObj, Nan::New<String>("first_error_code").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_view_first_error_code>());
        Nan::Set(
            errValObj, Nan::New<String>("first_error_message").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_view_first_error_message>());
        Nan::Set(
            errValObj, Nan::New<String>("design_document").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_view_design_document>());
        Nan::Set(errValObj, Nan::New<String>("view").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_view_view>());
        Nan::Set(errValObj, Nan::New<String>("parameters").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_view_query_params>());
        Nan::Set(
            errValObj, Nan::New<String>("http_response_code").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_view_http_response_code>());
        Nan::Set(
            errValObj, Nan::New<String>("http_response_body").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_view_http_response_body>());

        return errVal;
    }

    template <lcb_STATUS (*CtxFn)(const RespType *,
                                  const lcb_QUERY_ERROR_CONTEXT **)>
    Local<Value> decodeError(lcb_STATUS rc) const
    {
        if (rc == LCB_SUCCESS) {
            return Nan::Null();
        }

        Local<Value> errVal = Error::create(rc);
        Local<Object> errValObj = errVal.As<Object>();

        CtxReader<RespType, lcb_QUERY_ERROR_CONTEXT, CtxFn> ctxRdr(_resp);
        Nan::Set(errValObj, Nan::New<String>("ctxtype").ToLocalChecked(),
                 Nan::New<String>("query").ToLocalChecked());
        Nan::Set(
            errValObj, Nan::New<String>("first_error_code").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_query_first_error_code>());
        Nan::Set(
            errValObj, Nan::New<String>("first_error_message").ToLocalChecked(),
            ctxRdr
                .template parseValue<&lcb_errctx_query_first_error_message>());
        Nan::Set(errValObj, Nan::New<String>("statement").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_query_statement>());
        Nan::Set(
            errValObj, Nan::New<String>("client_context_id").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_query_client_context_id>());
        Nan::Set(errValObj, Nan::New<String>("parameters").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_query_query_params>());
        Nan::Set(
            errValObj, Nan::New<String>("http_response_code").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_query_http_response_code>());
        Nan::Set(
            errValObj, Nan::New<String>("http_response_body").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_query_http_response_body>());

        return errVal;
    }

    template <lcb_STATUS (*CtxFn)(const RespType *,
                                  const lcb_SEARCH_ERROR_CONTEXT **)>
    Local<Value> decodeError(lcb_STATUS rc) const
    {
        if (rc == LCB_SUCCESS) {
            return Nan::Null();
        }

        Local<Value> errVal = Error::create(rc);
        Local<Object> errValObj = errVal.As<Object>();

        CtxReader<RespType, lcb_SEARCH_ERROR_CONTEXT, CtxFn> ctxRdr(_resp);
        Nan::Set(errValObj, Nan::New<String>("ctxtype").ToLocalChecked(),
                 Nan::New<String>("search").ToLocalChecked());
        Nan::Set(
            errValObj, Nan::New<String>("error_message").ToLocalChecked(),
            ctxRdr.template parseValue<&lcb_errctx_search_error_message>());
        Nan::Set(errValObj, Nan::New<String>("index_name").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_search_index_name>());
        Nan::Set(errValObj, Nan::New<String>("query").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_search_query>());
        Nan::Set(errValObj, Nan::New<String>("parameters").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_search_params>());
        Nan::Set(
            errValObj, Nan::New<String>("http_response_code").ToLocalChecked(),
            ctxRdr
                .template parseValue<&lcb_errctx_search_http_response_code>());
        Nan::Set(
            errValObj, Nan::New<String>("http_response_body").ToLocalChecked(),
            ctxRdr
                .template parseValue<&lcb_errctx_search_http_response_body>());

        return errVal;
    }

    template <lcb_STATUS (*CtxFn)(const RespType *,
                                  const lcb_ANALYTICS_ERROR_CONTEXT **)>
    Local<Value> decodeError(lcb_STATUS rc) const
    {
        if (rc == LCB_SUCCESS) {
            return Nan::Null();
        }

        Local<Value> errVal = Error::create(rc);
        Local<Object> errValObj = errVal.As<Object>();

        CtxReader<RespType, lcb_ANALYTICS_ERROR_CONTEXT, CtxFn> ctxRdr(_resp);
        Nan::Set(errValObj, Nan::New<String>("ctxtype").ToLocalChecked(),
                 Nan::New<String>("analytics").ToLocalChecked());
        Nan::Set(
            errValObj, Nan::New<String>("first_error_code").ToLocalChecked(),
            ctxRdr
                .template parseValue<&lcb_errctx_analytics_first_error_code>());
        Nan::Set(errValObj,
                 Nan::New<String>("first_error_message").ToLocalChecked(),
                 ctxRdr.template parseValue<
                     &lcb_errctx_analytics_first_error_message>());
        Nan::Set(errValObj, Nan::New<String>("statement").ToLocalChecked(),
                 ctxRdr.template parseValue<&lcb_errctx_analytics_statement>());
        Nan::Set(errValObj,
                 Nan::New<String>("client_context_id").ToLocalChecked(),
                 ctxRdr.template parseValue<
                     &lcb_errctx_analytics_client_context_id>());
        Nan::Set(errValObj,
                 Nan::New<String>("http_response_code").ToLocalChecked(),
                 ctxRdr.template parseValue<
                     &lcb_errctx_analytics_http_response_code>());
        Nan::Set(errValObj,
                 Nan::New<String>("http_response_body").ToLocalChecked(),
                 ctxRdr.template parseValue<
                     &lcb_errctx_analytics_http_response_body>());

        return errVal;
    }

    template <lcb_STATUS (*GetFn)(const RespType *, uint64_t *)>
    Local<Value> decodeCas() const
    {
        uint64_t value;

        lcb_STATUS rc = GetFn(_resp, &value);
        if (rc != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Cas::create(value);
    }

    template <lcb_STATUS (*GetFn)(const RespType *, lcb_MUTATION_TOKEN *)>
    Local<Value> decodeMutationToken() const
    {
        lcb_MUTATION_TOKEN value;

        lcb_STATUS rc = GetFn(_resp, &value);
        if (rc != LCB_SUCCESS) {
            return Nan::Null();
        }

        return MutationToken::create(value, instance()->bucketName());
    }

    template <lcb_STATUS (*ValFn)(const RespType *, const char **, size_t *)>
    Local<Value> parseValue() const
    {
        const char *value = NULL;
        size_t nvalue = 0;
        if (ValFn(_resp, &value, &nvalue) != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Nan::CopyBuffer(value, nvalue).ToLocalChecked();
    }

    template <lcb_STATUS (*ValFn)(const RespType *, size_t, const char **,
                                  size_t *)>
    Local<Value> parseValue(size_t index) const
    {
        const char *value = NULL;
        size_t nvalue = 0;
        if (ValFn(_resp, index, &value, &nvalue) != LCB_SUCCESS) {
            return Nan::Null();
        }

        return Nan::CopyBuffer(value, nvalue).ToLocalChecked();
    }

    template <lcb_STATUS (*BytesFn)(const RespType *, const char **, size_t *),
              lcb_STATUS (*FlagsFn)(const RespType *, uint32_t *)>
    Local<Value> parseDocValue() const
    {
        ScopedTraceSpan decodeTrace = this->_cookie->startDecodeTrace();

        Local<Object> transcoderObj = Nan::New(this->_cookie->_transcoder);

        Nan::MaybeLocal<Value> decodeFnValM =
            Nan::Get(transcoderObj, Nan::New("decode").ToLocalChecked());
        if (decodeFnValM.IsEmpty()) {
            return Nan::Undefined();
        }

        Nan::MaybeLocal<Function> decodeFnM =
            Nan::To<Function>(decodeFnValM.ToLocalChecked());
        if (decodeFnM.IsEmpty()) {
            return Nan::Undefined();
        }

        Local<Function> decodeFn = decodeFnM.ToLocalChecked();

        Local<Value> valueVal = parseValue<BytesFn>();
        Local<Value> flagsVal = parseValue<FlagsFn>();

        Local<Value> argsArr[] = {valueVal, flagsVal};
        Nan::MaybeLocal<Value> resValM =
            Nan::CallAsFunction(decodeFn, transcoderObj, 2, argsArr);
        if (resValM.IsEmpty()) {
            return Nan::Undefined();
        }

        return resValM.ToLocalChecked();
    }

    template <typename... Ts>
    void invokeNonFinalCallback(Ts... args) const
    {
        OpCookie *lclCookie = cookie();

        Local<Value> argsArr[] = {args...};
        lclCookie->invokeCallback(sizeof...(args), argsArr);
    }

    template <typename... Ts>
    void invokeCallback(Ts... args) const
    {
        OpCookie *lclCookie = cookie();

        lclCookie->endTrace();

        Local<Value> argsArr[] = {args...};
        lclCookie->invokeCallback(sizeof...(args), argsArr);

        delete lclCookie;
    }

private:
    lcb_INSTANCE *_instance;
    const RespType *_resp;
    OpCookie *_cookie;
};

} // namespace couchnode

#endif // RESPREADER_H
