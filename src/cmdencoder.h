/*
 * cmdencoder.h
 *
 *  Created on: Feb 29, 2016
 *      Author: brettlawson
 */

#ifndef CMDENCODER_H_
#define CMDENCODER_H_

#ifndef COUCHBASE_H
#error "include couchbase_impl.h first"
#endif

namespace Couchnode
{

class OpCookie : public Nan::AsyncResource
{
public:
    OpCookie() : Nan::AsyncResource("couchbase:op.Callback"), traceSpan(NULL)
    {
    }

    ~OpCookie()
    {
        callback.Reset();

        if (traceSpan) {
            lcbtrace_span_finish(traceSpan, LCBTRACE_NOW);
        }
    }

    Nan::AsyncResource *asyncContext()
    {
        return static_cast<Nan::AsyncResource *>(this);
    }

    Nan::Callback callback;
    lcbtrace_SPAN *traceSpan;
};

using namespace v8;

class CommandEncoder
{
public:
    CommandEncoder() : _cookie(new OpCookie()), _cookiePersist(false)
    {
    }

    ~CommandEncoder()
    {
        if (!_cookiePersist) {
            delete _cookie;
        }

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
        if (nval) {
            *nval = utfStr->length();
        }
        *val = **utfStr;
        return true;
    }

    template <typename T> bool parseString(const T **val, Local<Value> str)
    {
        return parseString(val, (size_t *)NULL, str);
    }

    bool parseKeyBuf(lcb_KEYBUF *buf, Local<Value> key)
    {
        buf->type = LCB_KV_COPY;
        return parseString(&buf->contig.bytes, &buf->contig.nbytes, key);
    }

    bool parseCallback(Local<Value> callback)
    {
        if (callback->IsFunction()) {
            _cookie->callback.Reset(callback.As<v8::Function>());
            return true;
        }
        return false;
    }

    bool parseCas(lcb_U64 *casOut, Local<Value> cas)
    {
        if (!cas->IsUndefined() && !cas->IsNull()) {
            return Cas::GetCas(cas, casOut);
        }
        return true;
    }

    template <typename T> bool parseUintOption(T *out, Local<Value> value)
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

    template <typename T> bool parseIntOption(T *out, Local<Value> value)
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

    void registerTraceSpan(lcbtrace_SPAN *span)
    {
        _cookie->traceSpan = span;
    }

    void persistCookie()
    {
        _cookiePersist = true;
    }

    OpCookie *cookie() const
    {
        return _cookie;
    }

private:
    std::vector<Nan::Utf8String *> _strings;
    OpCookie *_cookie;
    bool _cookiePersist;
};

} // namespace Couchnode

#endif /* CMDENCODER_H_ */
