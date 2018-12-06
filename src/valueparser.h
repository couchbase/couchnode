/*
 * valueparser.h
 *
 *  Created on: Feb 29, 2016
 *      Author: brettlawson
 */

#ifndef VALUEPARSER_H_
#define VALUEPARSER_H_

#include "cas.h"
#include <libcouchbase/couchbase.h>
#include <stdint.h>
#include <vector>

using namespace v8;

namespace Couchnode
{

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

        Nan::Utf8String *utfStr = new Nan::Utf8String(str);
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
            return Cas::GetCas(cas, casOut);
        }
        return true;
    }

    template <typename T>
    static bool parseUint(T *out, Local<Value> value)
    {
        if (value.IsEmpty()) {
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
        if (value.IsEmpty()) {
            return true;
        }

        Nan::MaybeLocal<Integer> valueTyped = Nan::To<Integer>(value);
        if (valueTyped.IsEmpty()) {
            return false;
        }

        *out = valueTyped.ToLocalChecked()->Value();
        return true;
    }

    static lcb_U32 asUint(Local<Value> value)
    {
        lcb_U32 parsedValue = 0;
        parseUint(&parsedValue, value);
        return parsedValue;
    }

private:
    std::vector<Nan::Utf8String *> _strings;
};

} // namespace Couchnode

#endif /* VALUEPARSER_H_ */
