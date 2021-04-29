#pragma once
#ifndef COOKIE_H
#define COOKIE_H

#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class Cookie : public Nan::AsyncResource
{
public:
    Cookie(const char *name, Local<Function> callback)
        : Nan::AsyncResource(name)
        , _callback(callback)
    {
    }

    ~Cookie()
    {
        _callback.Reset();
    }

    Nan::MaybeLocal<Value> Call(int argc, Local<Value> *argv)
    {
        Local<Function> callback = Nan::New<Function>(_callback);
        return runInAsyncScope(Nan::New<Object>(), callback, argc, argv);
    }

    Nan::Persistent<Function> _callback;
};

} // namespace couchnode

#endif // COOKIE_H
