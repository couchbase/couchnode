/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
#include <cstdlib>
#include <cstring>
#include <sstream>

#include "couchbase.h"

using namespace std;
using namespace Couchnode;

// libcouchbase handlers keep a C linkage...
extern "C" {

    static void configuration_callback(libcouchbase_t instance,
                                       libcouchbase_configuration_t config)
    {
        void *cookie = const_cast<void *>(libcouchbase_get_cookie(instance));
        Couchbase *me = reinterpret_cast<Couchbase *>(cookie);
        me->onConnect(config);
    }

    static void error_callback(libcouchbase_t instance,
                               libcouchbase_error_t err, const char *errinfo)
    {
        void *cookie = const_cast<void *>(libcouchbase_get_cookie(instance));
        Couchbase *me = reinterpret_cast<Couchbase *>(cookie);
        me->errorCallback(err, errinfo);
    }

    static void get_callback(libcouchbase_t instance,
                             const void *commandCookie,
                             libcouchbase_error_t error,
                             const void *key,
                             libcouchbase_size_t nkey,
                             const void *bytes,
                             libcouchbase_size_t nbytes,
                             libcouchbase_uint32_t flags,
                             libcouchbase_cas_t cas)
    {
        void *cookie = const_cast<void *>(libcouchbase_get_cookie(instance));
        Couchbase *me = reinterpret_cast<Couchbase *>(cookie);
        me->getCallback(commandCookie, error, key, nkey, bytes, nbytes, flags,
                        cas);
    }

    static void storage_callback(libcouchbase_t instance,
                                 const void *commandCookie,
                                 libcouchbase_storage_t operation,
                                 libcouchbase_error_t error,
                                 const void *key,
                                 libcouchbase_size_t nkey,
                                 libcouchbase_cas_t cas)
    {
        void *cookie = const_cast<void *>(libcouchbase_get_cookie(instance));
        Couchbase *me = reinterpret_cast<Couchbase *>(cookie);
        me->storageCallback(commandCookie, operation, error, key, nkey, cas);
    }

    // node.js will call the init method when the shared object
    // is successfully loaded. Time to register our class!
    static void init(v8::Handle<v8::Object> target)
    {
        Couchbase::Init(target);
    }

    NODE_MODULE(couchbase, init)
}

Couchbase::Couchbase(libcouchbase_t inst) :
    ObjectWrap(), instance(inst), lastError(LIBCOUCHBASE_SUCCESS)
{
    libcouchbase_set_cookie(instance, reinterpret_cast<void *>(this));
    libcouchbase_set_error_callback(instance, error_callback);
    libcouchbase_set_get_callback(instance, get_callback);
    libcouchbase_set_storage_callback(instance, storage_callback);
    libcouchbase_set_configuration_callback(instance, configuration_callback);
}

Couchbase::~Couchbase()
{
    libcouchbase_destroy(instance);

    EventMap::iterator iter = events.begin();
    while (iter != events.end()) {
        if (!iter->second.IsEmpty()) {
            iter->second.Dispose();
        }
        ++iter;
    }
}

void Couchbase::Init(v8::Handle<v8::Object> target)
{
    v8::HandleScope scope;

    v8::Local<v8::FunctionTemplate> t = v8::FunctionTemplate::New(New);

    v8::Persistent<v8::FunctionTemplate> s_ct;
    s_ct = v8::Persistent<v8::FunctionTemplate>::New(t);
    s_ct->InstanceTemplate()->SetInternalFieldCount(1);
    s_ct->SetClassName(v8::String::NewSymbol("Couchbase"));

    NODE_SET_PROTOTYPE_METHOD(s_ct, "getVersion", GetVersion);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "setTimeout", SetTimeout);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "getTimeout", GetTimeout);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "getRestUri", GetRestUri);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "setSynchronous", SetSynchronous);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "isSynchronous", IsSynchronous);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "connect", Connect);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "getLastError", GetLastError);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "get", Get);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "set", Set);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "add", Add);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "replace", Replace);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "append", Append);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "prepend", Prepend);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "wait", Wait);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "on", On);

    target->Set(v8::String::NewSymbol("Couchbase"), s_ct->GetFunction());
}

v8::Handle<v8::Value> Couchbase::On(const v8::Arguments &args)
{
    if (args.Length() != 2 || !args[0]->IsString() || !args[1]->IsFunction()) {
        const char *msg = "Usage: cb.on('event', 'callback')";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    // @todo verify that the user specifies a valid monitor ;)
    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    v8::Handle<v8::Value> ret = me->on(args);
    return scope.Close(ret);
}

v8::Handle<v8::Value> Couchbase::on(const v8::Arguments &args)
{
    v8::HandleScope scope;
    v8::Local<v8::String> s = args[0]->ToString();
    char *func = new char[s->Length() + 1];
    memset(func, 0, s->Length() + 1);
    s->WriteAscii(func);

    string function(func);
    delete []func;

    EventMap::iterator iter = events.find(function);
    if (iter != events.end() && !iter->second.IsEmpty()) {
        iter->second.Dispose();
    }

    events[function] = v8::Persistent<v8::Function>::New(v8::Local<v8::Function>::Cast(args[0]));

    return scope.Close(v8::True());
}

v8::Handle<v8::Value> Couchbase::New(const v8::Arguments &args)
{
    v8::HandleScope scope;

    if (args.Length() < 1) {
        const char *msg = "You need to specify the URI for the REST server";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    if (args.Length() > 4) {
        const char *msg = "Too many arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    char *argv[4];
    memset(argv, 0, sizeof(argv));

    for (int ii = 0; ii < args.Length(); ++ii) {
        if (args[ii]->IsString()) {
            v8::Local<v8::String> s = args[ii]->ToString();
            argv[ii] = new char[s->Length() + 1];
            s->WriteAscii(argv[ii]);
        } else if (!args[ii]->IsNull()) {
            // @todo handle NULL
            const char *msg = "Illegal argument";
            return v8::ThrowException(
                       v8::Exception::Error(v8::String::New(msg)));
        }
    }

    libcouchbase_t instance = libcouchbase_create(argv[0], argv[1], argv[2],
                                                  argv[3], NULL);
    for (int ii = 0; ii < 4; ++ii) {
        delete[] argv[ii];
    }

    if (instance == NULL) {
        const char *msg = "Failed to create libcouchbase instance";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    Couchbase *hw = new Couchbase(instance);
    hw->Wrap(args.This());
    return args.This();
}

v8::Handle<v8::Value> Couchbase::GetVersion(const v8::Arguments &)
{
    v8::HandleScope scope;

    stringstream ss;
    ss << "libcouchbase node.js v1.0.0 (v" << libcouchbase_get_version(NULL)
       << ")";

    v8::Local<v8::String> result = v8::String::New(ss.str().c_str());
    return scope.Close(result);
}

v8::Handle<v8::Value> Couchbase::SetTimeout(const v8::Arguments &args)
{
    if (args.Length() != 1 || !args[0]->IsInt32()) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    uint32_t timeout = args[0]->Int32Value();
    libcouchbase_set_timeout(me->instance, timeout);

    return v8::True();
}

v8::Handle<v8::Value> Couchbase::GetTimeout(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    return scope.Close(v8::Integer::New(libcouchbase_get_timeout(me->instance)));
}

v8::Handle<v8::Value> Couchbase::GetRestUri(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    stringstream ss;
    ss << libcouchbase_get_host(me->instance) << ":" << libcouchbase_get_port(
           me->instance);

    return scope.Close(v8::String::New(ss.str().c_str()));
}

v8::Handle<v8::Value> Couchbase::SetSynchronous(const v8::Arguments &args)
{
    if (args.Length() != 1) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;

    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());

    libcouchbase_syncmode_t mode;
    if (args[0]->BooleanValue()) {
        mode = LIBCOUCHBASE_SYNCHRONOUS;
    } else {
        mode = LIBCOUCHBASE_ASYNCHRONOUS;
    }

    libcouchbase_behavior_set_syncmode(me->instance, mode);
    return v8::True();
}

v8::Handle<v8::Value> Couchbase::IsSynchronous(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    if (libcouchbase_behavior_get_syncmode(me->instance)
            == LIBCOUCHBASE_SYNCHRONOUS) {
        return v8::True();
    }

    return v8::False();
}

v8::Handle<v8::Value> Couchbase::Connect(const v8::Arguments &args)
{
    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());

    if (args.Length() != 0) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    me->lastError = libcouchbase_connect(me->instance);
    if (me->lastError == LIBCOUCHBASE_SUCCESS) {
        return v8::True();
    } else {
        return v8::False();
    }
}

v8::Handle<v8::Value> Couchbase::GetLastError(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    const char *msg = libcouchbase_strerror(me->instance, me->lastError);
    return scope.Close(v8::String::New(msg));
}

class CommandCallbackCookie
{
public:
    CommandCallbackCookie(const v8::Local<v8::Value>& func, int r = 1) : refcount(r) {
        assert(func->IsFunction());
        handler = v8::Persistent<v8::Function>::New(
                      v8::Local<v8::Function>::Cast(func));
    }

    ~CommandCallbackCookie() {
        handler.Dispose();
    }

    void release() {
        if (--refcount == 0) {
            delete this;
        }
    }

    int refcount;
    v8::Persistent<v8::Function> handler;
};

v8::Handle<v8::Value> Couchbase::Get(const v8::Arguments &args)
{
    if (args.Length() == 0) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());

    void *commandCookie = NULL;
    int offset = 0;
    if (args[0]->IsFunction()) {
        if (args.Length() == 1) {
            const char *msg = "Illegal arguments";
            return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
        }

        commandCookie = static_cast<void *>(new CommandCallbackCookie(args[0], args.Length() - 1));
        offset = 1;
    }

    int tot = args.Length() - offset;
    char* *keys = new char*[tot];
    libcouchbase_size_t *lengths = new libcouchbase_size_t[tot];
    // @todo handle allocation failures

    for (int ii = offset; ii < args.Length(); ++ii) {
        if (args[ii]->IsString()) {
            v8::Local<v8::String> s = args[ii]->ToString();
            keys[ii - offset] = new char[s->Length() + 1];
            lengths[ii - offset] = s->WriteAscii(keys[ii - offset]);
        } else {
            // @todo handle NULL
            // Clean up allocated memory!
            const char *msg = "Illegal argument";
            return v8::ThrowException(
                       v8::Exception::Error(v8::String::New(msg)));
        }
    }

    me->lastError = libcouchbase_mget(me->instance, commandCookie, tot,
                                      reinterpret_cast<const void * const *>(keys), lengths, NULL);

    if (me->lastError == LIBCOUCHBASE_SUCCESS) {
        return v8::True();
    } else {
        return v8::False();
    }
}

v8::Handle<v8::Value> Couchbase::Set(const v8::Arguments &args)
{
    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    return me->store(args, LIBCOUCHBASE_SET);
}

v8::Handle<v8::Value> Couchbase::Add(const v8::Arguments &args)
{
    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    return me->store(args, LIBCOUCHBASE_ADD);
}

v8::Handle<v8::Value> Couchbase::Replace(const v8::Arguments &args)
{
    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    return me->store(args, LIBCOUCHBASE_REPLACE);
}

v8::Handle<v8::Value> Couchbase::Append(const v8::Arguments &args)
{
    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    return me->store(args, LIBCOUCHBASE_APPEND);
}

v8::Handle<v8::Value> Couchbase::Prepend(const v8::Arguments &args)
{
    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    return me->store(args, LIBCOUCHBASE_PREPEND);
}

v8::Handle<v8::Value> Couchbase::Wait(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    libcouchbase_wait(me->instance);
    return v8::True();
}

struct CouchbaseObject {
    CouchbaseObject() :
        commandCookie(NULL), key(NULL), nkey(0), data(NULL), ndata(0), flags(0), exptime(0), cas(0) {
        // empty
    }

    ~CouchbaseObject() {
        delete[] key;
        delete[] data;
    }

    // @todo improve this parser
    bool parse(const v8::Arguments &args) {
        if (args.Length() == 0) {
            return false;
        }

        int idx = 0;
        // First we might have a callback function...
        if (args[0]->IsFunction()) {
            ++idx;
            commandCookie = static_cast<void *>(new CommandCallbackCookie(args[0]));
        }

        // but the next _must_ be the key
        if (args[idx]->IsString()) {
            v8::Local<v8::String> str = args[idx]->ToString();
            key = new char[str->Length()];
            nkey = str->WriteAscii(key);
        } else {
            // Format error
            return false;
        }
        ++idx;

        if (args.Length() > idx && args[idx]->IsString()) {
            v8::Local<v8::String> str = args[idx]->ToString();
            data = new char[str->Length()];
            ndata = str->WriteAscii(data);
            ++idx;
        }

        if (args.Length() > idx) {
            if (!args[idx]->IsNumber()) {
                return false;
            }

            flags = args[idx]->Int32Value();
            ++idx;
        }

        if (args.Length() > idx) {
            if (!args[idx]->IsNumber()) {
                return false;
            }

            exptime = args[idx]->Int32Value();
            ++idx;
        }

        if (args.Length() > idx) {
            if (!args[idx]->IsNumber()) {
                return false;
            }

            cas = args[idx]->IntegerValue();
            ++idx;
        }

        if (args.Length() > idx) {
            return false;
        }

        return true;
    }

    void *commandCookie;
    char *key;
    size_t nkey;
    char *data;
    size_t ndata;
    uint32_t flags;
    uint32_t exptime;
    uint64_t cas;
};

v8::Handle<v8::Value> Couchbase::store(const v8::Arguments &args,
                                       libcouchbase_storage_t operation)
{

    CouchbaseObject obj;
    if (!obj.parse(args)) {
        delete static_cast<CommandCallbackCookie *>(obj.commandCookie);
        const char *msg = "Illegal arguments";
        return v8::ThrowException(v8::Exception::Error(v8::String::New(msg)));
    }

    lastError = libcouchbase_store(instance, obj.commandCookie, operation, obj.key,
                                   obj.nkey, obj.data, obj.ndata, obj.flags, obj.exptime, obj.cas);

    if (lastError == LIBCOUCHBASE_SUCCESS) {
        return v8::True();;
    } else {
        return v8::False();
    }
}

void Couchbase::errorCallback(libcouchbase_error_t err, const char *errinfo)
{
    if (err == LIBCOUCHBASE_ETIMEDOUT && onTimeout()) {
        return;
    }

    lastError = err;
    EventMap::iterator iter = events.find("error");
    if (iter != events.end() && !iter->second.IsEmpty()) {
        using namespace v8;
        Local<Value> argv[1] = { Local<Value>::New(String::New(errinfo)) };
        iter->second->Call(Context::GetEntered()->Global(), 1, argv);
    }
}

void Couchbase::getCallback(const void *commandCookie,
                            libcouchbase_error_t error,
                            const void *key,
                            libcouchbase_size_t nkey,
                            const void *bytes,
                            libcouchbase_size_t nbytes,
                            libcouchbase_uint32_t flags,
                            libcouchbase_cas_t cas)
{
    lastError = error;

    CommandCallbackCookie *data = reinterpret_cast<CommandCallbackCookie *>(const_cast<void *>(commandCookie));

    EventMap::iterator iter = events.find("get");
    if (data || (iter != events.end() && !iter->second.IsEmpty())) {
        // Ignore everything if the user hasn't set up a get handler
        if (error == LIBCOUCHBASE_SUCCESS) {
            using namespace v8;
            Local<Value> argv[5];
            argv[0] = Local<Value>::New(True());
            argv[1] = Local<Value>::New(String::New((const char *) key, nkey));
            argv[2] = Local<Value>::New(
                          String::New((const char *) bytes, nbytes));
            argv[3] = Local<Value>::New(Integer::NewFromUnsigned(flags));
            argv[4] = Local<Value>::New(Number::New(cas));

            if (data) {
                data->handler->Call(Context::GetEntered()->Global(), 5, argv);
                data->release();
            } else {
                iter->second->Call(Context::GetEntered()->Global(), 5, argv);
            }
        } else {
            using namespace v8;
            Local<Value> argv[3];
            argv[0] = Local<Value>::New(False());
            argv[1] = Local<Value>::New(String::New((const char *) key, nkey));
            argv[2] = Local<Value>::New(
                          String::New(libcouchbase_strerror(instance, error)));
            if (data) {
                data->handler->Call(Context::GetEntered()->Global(), 3, argv);
                data->release();
            } else {
                iter->second->Call(Context::GetEntered()->Global(), 3, argv);
            }
        }
    }
}

void Couchbase::storageCallback(const void *commandCookie,
                                libcouchbase_storage_t /*operation*/,
                                libcouchbase_error_t error,
                                const void *key,
                                libcouchbase_size_t nkey,
                                libcouchbase_cas_t cas)
{
    lastError = error;
    CommandCallbackCookie *data = reinterpret_cast<CommandCallbackCookie *>(const_cast<void *>(commandCookie));
    EventMap::iterator iter = events.find("store");
    if (data || (iter != events.end() && !iter->second.IsEmpty())) {
        // Ignore everything if the user hasn't set up a get handler
        using namespace v8;
        Local<Value> argv[3];
        argv[1] = Local<Value>::New(String::New((const char *) key, nkey));
        if (error == LIBCOUCHBASE_SUCCESS) {
            argv[0] = Local<Value>::New(True());
            argv[2] = Local<Value>::New(Number::New(cas));
        } else {
            argv[0] = Local<Value>::New(False());
            argv[2] = Local<Value>::New(
                          String::New(libcouchbase_strerror(instance, error)));
        }
        if (data) {
            data->handler->Call(Context::GetEntered()->Global(), 3, argv);
            data->release();
        } else {
            iter->second->Call(Context::GetEntered()->Global(), 3, argv);
        }
    }
}

void Couchbase::onConnect(libcouchbase_configuration_t config)
{
    if (config == LIBCOUCHBASE_CONFIGURATION_NEW) {
        EventMap::iterator iter = events.find("connect");
        if (iter != events.end() && !iter->second.IsEmpty()) {
            // @todo pass on the config parameter ;)
            using namespace v8;
            Local<Value> argv[1];
            iter->second->Call(v8::Context::GetEntered()->Global(), 0, argv);
        }
    }
}

bool Couchbase::onTimeout()
{
    EventMap::iterator iter = events.find("timeout");
    if (iter != events.end() && !iter->second.IsEmpty()) {
        using namespace v8;
        Local<Value> argv[1];
        iter->second->Call(v8::Context::GetEntered()->Global(), 0, argv);
        return true;
    }

    return false;
}
