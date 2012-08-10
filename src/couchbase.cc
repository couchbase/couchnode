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
#include "io/libcouchbase-libuv.h"

using namespace std;
using namespace Couchnode;

typedef libcouchbase_io_opt_st* (*loop_factory_fn)(uv_loop_t*,uint16_t);

// libcouchbase handlers keep a C linkage...
extern "C" {
    // node.js will call the init method when the shared object
    // is successfully loaded. Time to register our class!
    static void init(v8::Handle<v8::Object> target)
    {
        Couchbase::Init(target);
    }

    NODE_MODULE(couchbase, init)
}

// @todo killme!
#define COUCHNODE_DEVDEBUG
#ifdef COUCHNODE_DEVDEBUG
static unsigned int _cbo_count = 0;
#define cbo_count_incr() { _cbo_count++; }
#define cbo_count_decr() { _cbo_count--; \
    printf("Still have %d handles remaining\n", _cbo_count); \
}
#else
#define cbo_count_incr()
#define cbo_count_decr()
#endif

Couchbase::Couchbase(libcouchbase_t inst) :
    ObjectWrap(), instance(inst), lastError(LIBCOUCHBASE_SUCCESS)
{
    libcouchbase_set_cookie(instance, reinterpret_cast<void *>(this));
    setupLibcouchbaseCallbacks();
    cbo_count_incr()
}

Couchbase::~Couchbase()
{
    cerr << "Destroying handle..\n";
    libcouchbase_destroy(instance);

    EventMap::iterator iter = events.begin();
    while (iter != events.end()) {
        if (!iter->second.IsEmpty()) {
            iter->second.Dispose();
            iter->second.Clear();
        }
        ++iter;
    }

    cbo_count_decr();
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
    NODE_SET_PROTOTYPE_METHOD(s_ct, "on", On);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "arithmetic", Arithmetic);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "delete", Remove);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "touch", Touch);

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
        iter->second.Clear();
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

    libcouchbase_io_opt_st *iops = lcb_luv_create_io_opts(uv_default_loop(),
                                                          1024);
    if (iops == NULL) {
        using namespace v8;
        const char *msg = "Failed to create a new IO ops structure";
        return ThrowException(Exception::Error(String::New(msg)));
    }

    libcouchbase_t instance = libcouchbase_create(argv[0], argv[1], argv[2],
                                                  argv[3], iops);
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
    Couchbase* me = ObjectWrap::Unwrap<Couchbase>(args.This());

    if (!me->connectHandler.IsEmpty()) {
        me->connectHandler.Dispose();
        me->connectHandler.Clear();
    }

    if (args.Length() == 1 && args[0]->IsFunction()) {
        me->connectHandler = v8::Persistent<v8::Function>::New(
                               v8::Local<v8::Function>::Cast(args[0]));
    } else if (args.Length() != 0) {
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

#define COUCHNODE_API_VARS_INIT(argcls) \
    v8::Handle<v8::Value> exc; \
    argcls cargs = argcls(args, exc); \
    if (!exc.IsEmpty()) { \
        return exc; \
    } \
    CouchbaseCookie *cookie = cargs.makeCookie(); \

#define COUCHNODE_API_VARS_INIT_SCOPED(argcls) \
    v8::HandleScope scope; \
    COUCHNODE_API_VARS_INIT(argcls);

#define COUCHNODE_API_CLEANUP(self) \
    if (self->lastError == LIBCOUCHBASE_SUCCESS) { \
        return v8::True(); \
    } \
    delete cookie; \
    return v8::False();

v8::Handle<v8::Value> Couchbase::Get(const v8::Arguments& args)
{
    COUCHNODE_API_VARS_INIT_SCOPED(MGetArgs);
    Couchbase* me = ObjectWrap::Unwrap<Couchbase>(args.This());
    cookie->remaining = cargs.kcount;

    assert (cargs.keys);
    me->lastError = libcouchbase_mget(me->instance,
                                      cookie,
                                      cargs.kcount,
                                      (const void * const*)cargs.keys,
                                      cargs.sizes,
                                      cargs.exps);

    COUCHNODE_API_CLEANUP(me);
}

v8::Handle<v8::Value> Couchbase::Touch(const v8::Arguments& args)
{
    COUCHNODE_API_VARS_INIT_SCOPED(MGetArgs);
    Couchbase* me = ObjectWrap::Unwrap<Couchbase>(args.This());

    cookie->remaining = cargs.kcount;
    me->lastError = libcouchbase_mtouch(me->instance,
                                        cookie,
                                        cargs.kcount,
                                        (const void* const*)cargs.keys,
                                        cargs.sizes,
                                        cargs.exps);
    COUCHNODE_API_CLEANUP(me);
}

#define COUCHBASE_STOREFN_DEFINE(name, mode) \
    v8::Handle<v8::Value> Couchbase::name(const v8::Arguments& args) { \
        v8::HandleScope  scope; \
        Couchbase* me = ObjectWrap::Unwrap<Couchbase>(args.This()); \
        return me->store(args, LIBCOUCHBASE_##mode); \
    }

COUCHBASE_STOREFN_DEFINE(Set, SET)
COUCHBASE_STOREFN_DEFINE(Add, ADD)
COUCHBASE_STOREFN_DEFINE(Replace, REPLACE)
COUCHBASE_STOREFN_DEFINE(Append, APPEND)
COUCHBASE_STOREFN_DEFINE(Prepend, PREPEND)


v8::Handle<v8::Value> Couchbase::store(const v8::Arguments& args,
        libcouchbase_storage_t operation)
{
    COUCHNODE_API_VARS_INIT(StorageArgs);

    lastError = libcouchbase_store(instance,
                                   cookie,
                                   operation,
                                   cargs.key,
                                   cargs.nkey,
                                   cargs.data,
                                   cargs.ndata,
                                   0,
                                   cargs.exp,
                                   cargs.cas);

    COUCHNODE_API_CLEANUP(this);
}

v8::Handle<v8::Value> Couchbase::Arithmetic(const v8::Arguments& args)
{
    COUCHNODE_API_VARS_INIT_SCOPED(ArithmeticArgs);
    Couchbase* me = ObjectWrap::Unwrap<Couchbase>(args.This());

    me->lastError = libcouchbase_arithmetic(me->instance,
                                                cookie,
                                                cargs.key,
                                                cargs.nkey,
                                                cargs.delta,
                                                cargs.exp,
                                                cargs.create,
                                                cargs.initial);
    COUCHNODE_API_CLEANUP(me);
}

v8::Handle<v8::Value> Couchbase::Remove(const v8::Arguments& args)
{
    COUCHNODE_API_VARS_INIT_SCOPED(KeyopArgs);
    Couchbase* me = ObjectWrap::Unwrap<Couchbase>(args.This());
    me->lastError = libcouchbase_remove(me->instance,
                                    cookie,
                                    cargs.key,
                                    cargs.nkey,
                                    cargs.cas);
    COUCHNODE_API_CLEANUP(me);
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

        if (!connectHandler.IsEmpty()) {
            using namespace v8;
            HandleScope handle_scope;
            Persistent<Context> context = Context::New();
            Local<Value> argv[1];
            connectHandler->Call(Context::GetEntered()->Global(), 0, argv);
            connectHandler.Dispose();
            connectHandler.Clear();
            context.Dispose();
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
