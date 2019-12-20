#pragma once
#ifndef CAS_H
#define CAS_H

#include <libcouchbase/sysdefs.h>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class Cas
{
public:
    static NAN_MODULE_INIT(Init);

    static v8::Local<v8::Value> create(uint64_t);

    static bool parse(Local<Value>, uint64_t *);

    static inline Nan::Persistent<Function> &constructor()
    {
        static Nan::Persistent<Function> class_constructor;
        return class_constructor;
    }

private:
    static NAN_METHOD(fnToString);
    static NAN_METHOD(fnInspect);
};

} // namespace couchnode

#endif // CAS_H
