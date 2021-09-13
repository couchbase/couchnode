#pragma once
#ifndef VALUEPARSER_H
#define VALUEPARSER_H

#include "cas.h"
#include <libcouchbase/couchbase.h>
#include <stdint.h>
#include <vector>

namespace couchnode
{

using namespace v8;

class ValueParser
{
public:
    ValueParser()
    {
    }

    ~ValueParser()
    {
        for (size_t i = 0; i < _strings.size(); ++i) {
            delete _strings[i];
        }
    }

    template <typename T, typename V>
    bool parseString(const T **val, V *nval, Local<Value> str)
    {
        if (str->IsUndefined() || str->IsNull()) {
            if (nval) {
                *nval = 0;
            }
            *val = NULL;
            return true;
        }

        if (node::Buffer::HasInstance(str)) {
            if (val) {
                *val = node::Buffer::Data(str);
            }
            if (nval) {
                *nval = node::Buffer::Length(str);
            }

            return true;
        }

        Nan::Utf8String *utfStr = new Nan::Utf8String(str);

        if (utfStr->length() == 0) {
            // If the length of the string is Zero, we can return a NULL val
            // along with an nval of 0 and avoid holding onto the string ref.

            delete utfStr;

            *val = NULL;
            *nval = 0;

            return true;
        }

        _strings.push_back(utfStr);

        if (val) {
            *val = **utfStr;
        }
        if (nval) {
            *nval = utfStr->length();
        }

        return true;
    }

    template <typename T>
    bool parseString(const T **val, Local<Value> str)
    {
        return parseString(val, (size_t *)NULL, str);
    }

    bool parseCas(lcb_U64 *casOut, Local<Value> cas)
    {
        if (!cas->IsUndefined() && !cas->IsNull()) {
            return Cas::parse(cas, casOut);
        }
        return true;
    }

    static bool isSet(Local<Value> val)
    {
        return !val.IsEmpty() && !val->IsUndefined() && !val->IsNull();
    }

    template <typename T>
    static bool parseUint(T *out, Local<Value> value)
    {
        if (value.IsEmpty() || value->IsUndefined()) {
            return true;
        }

        Nan::MaybeLocal<Uint32> valueTyped = Nan::To<Uint32>(value);
        if (valueTyped.IsEmpty()) {
            return false;
        }

        *out = (T)valueTyped.ToLocalChecked()->Value();
        return true;
    }

    template <typename T>
    static bool parseInt(T *out, Local<Value> value)
    {
        if (value.IsEmpty() || value->IsUndefined()) {
            return true;
        }

        Nan::MaybeLocal<Integer> valueTyped = Nan::To<Integer>(value);
        if (valueTyped.IsEmpty()) {
            return false;
        }

        *out = static_cast<T>(valueTyped.ToLocalChecked()->Value());
        return true;
    }

    static int32_t asInt(Local<Value> value)
    {
        int32_t parsedValue = 0;
        parseInt(&parsedValue, value);
        return parsedValue;
    }

    static uint32_t asUint(Local<Value> value)
    {
        uint32_t parsedValue = 0;
        parseUint(&parsedValue, value);
        return parsedValue;
    }

    static int64_t asInt64(Local<Value> value)
    {
        int64_t parsedValue = 0;
        parseInt(&parsedValue, value);
        return parsedValue;
    }

private:
    std::vector<Nan::Utf8String *> _strings;
};

} // namespace couchnode

#endif // VALUEPARSER_H
