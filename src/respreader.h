#pragma once
#ifndef RESPREADER_H
#define RESPREADER_H

#include "connection.h"
#include "opbuilder.h"

namespace couchnode
{

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

    Connection *connection() const
    {
        return Connection::fromInstance(_instance);
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

    template <lcb_STATUS (*CtxFn)(const RespType *, const char **, size_t *),
              lcb_STATUS (*RefFn)(const RespType *, const char **, size_t *)>
    Local<Value> decodeError(lcb_STATUS rc) const
    {
        if (rc == LCB_SUCCESS) {
            return Nan::Null();
        }

        Local<Value> errVal = Error::create(rc);
        Local<Object> errValObj = errVal.As<Object>();

        Nan::Set(errValObj, Nan::New<String>("context").ToLocalChecked(),
                 parseValue<CtxFn>());

        Nan::Set(errValObj, Nan::New<String>("ref").ToLocalChecked(),
                 parseValue<RefFn>());

        return errVal;
    }

    template <lcb_STATUS (*GetFn)(const RespType *, lcb_CAS *)>
    Local<Value> decodeCas() const
    {
        lcb_CAS value;

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

        return MutationToken::create(value, connection()->bucketName());
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