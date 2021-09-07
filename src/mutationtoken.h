#pragma once
#ifndef TOKEN_H
#define TOKEN_H

#include "addondata.h"
#include <libcouchbase/couchbase.h>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class MutationToken
{
public:
    static NAN_MODULE_INIT(Init);

    static v8::Local<v8::Value> create(lcb_MUTATION_TOKEN token,
                                       const char *bucketName);

    static bool parse(Local<Value> obj, lcb_MUTATION_TOKEN *token,
                      char *bucketName);

    static inline Nan::Persistent<Function> &constructor()
    {
        return addondata::Get()->_mutationtokenConstructor;
    }

private:
    static NAN_METHOD(fnToString);
    static NAN_METHOD(fnInspect);
};

} // namespace couchnode

#endif // TOKEN_H
