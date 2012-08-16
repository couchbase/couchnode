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
#include "cas.h"

using namespace std;
using namespace Couchnode;

typedef libcouchbase_io_opt_st *(*loop_factory_fn)(uv_loop_t *, uint16_t);

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

#ifdef COUCHNODE_DEBUG
unsigned int Couchbase::objectCount;
#endif

v8::Handle<v8::Value> Couchnode::ThrowException(const char *str)
{
    return v8::ThrowException(v8::Exception::Error(v8::String::New(str)));
}

v8::Handle<v8::Value> Couchnode::ThrowIllegalArgumentsException(void)
{
    return Couchnode::ThrowException("Illegal Arguments");
}

Couchbase::Couchbase(libcouchbase_t inst) :
    ObjectWrap(), connected(false), useHashtableParams(false),
    instance(inst), lastError(LIBCOUCHBASE_SUCCESS)

{
    libcouchbase_set_cookie(instance, reinterpret_cast<void *>(this));
    setupLibcouchbaseCallbacks();
#ifdef COUCHNODE_DEBUG
    ++objectCount;
#endif
}

Couchbase::~Couchbase()
{
#ifdef COUCHNODE_DEBUG
    --objectCount;
    cerr << "Destroying handle.." << endl
         << "Still have " << objectCount << " handles remaining" << endl;
#endif

    libcouchbase_destroy(instance);

    EventMap::iterator iter = events.begin();
    while (iter != events.end()) {
        if (!iter->second.IsEmpty()) {
            iter->second.Dispose();
            iter->second.Clear();
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
    NODE_SET_PROTOTYPE_METHOD(s_ct, "_opCallStyle", OpCallStyle);

    target->Set(v8::String::NewSymbol("Couchbase"), s_ct->GetFunction());

    NameMap::initialize();
    Cas::initialize();
}

v8::Handle<v8::Value> Couchbase::On(const v8::Arguments &args)
{
    if (args.Length() != 2 || !args[0]->IsString() || !args[1]->IsFunction()) {
        return ThrowException("Usage: cb.on('event', 'callback')");
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

    events[function] =
        v8::Persistent<v8::Function>::New(
            v8::Local<v8::Function>::Cast(args[1]));

    return scope.Close(v8::True());
}

v8::Handle<v8::Value> Couchbase::OpCallStyle(const v8::Arguments &args)
{
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());

    v8::Handle<v8::String> rv = me->useHashtableParams ?
                                NameMap::names[NameMap::OPSTYLE_HASHTABLE] :
                                NameMap::names[NameMap::OPSTYLE_POSITIONAL];

    if (!args.Length()) {
        return rv;
    }

    if (args.Length() != 1 || args[0]->IsString() == false) {
        return ThrowException("First (and only) argument must be a string");
    }

    if (NameMap::names[NameMap::OPSTYLE_HASHTABLE]->Equals(args[0])) {
        me->useHashtableParams = true;
    } else if (NameMap::names[NameMap::OPSTYLE_POSITIONAL]->Equals(args[0])) {
        me->useHashtableParams = false;
    } else {
        return ThrowException("Unrecognized call style");
    }

    return rv;
}

v8::Handle<v8::Value> Couchbase::New(const v8::Arguments &args)
{
    v8::HandleScope scope;

    if (args.Length() < 1) {
        return ThrowException("You need to specify the URI for the REST server");
    }

    if (args.Length() > 4) {
        return ThrowException("Too many arguments");
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
            return ThrowIllegalArgumentsException();
        }
    }

    libcouchbase_io_opt_st *iops = lcb_luv_create_io_opts(uv_default_loop(),
                                                          1024);
    if (iops == NULL) {
        return ThrowException("Failed to create a new IO ops structure");
    }

    libcouchbase_t instance = libcouchbase_create(argv[0], argv[1], argv[2],
                                                  argv[3], iops);
    for (int ii = 0; ii < 4; ++ii) {
        delete[] argv[ii];
    }

    if (instance == NULL) {
        return ThrowException("Failed to create libcouchbase instance");
    }

    if (libcouchbase_connect(instance) != LIBCOUCHBASE_SUCCESS) {
        return ThrowException("Failed to schedule connection");
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
        return ThrowIllegalArgumentsException();
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
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    return scope.Close(v8::Integer::New(libcouchbase_get_timeout(me->instance)));
}

v8::Handle<v8::Value> Couchbase::GetRestUri(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        return ThrowIllegalArgumentsException();
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
        return ThrowIllegalArgumentsException();
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
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    if (libcouchbase_behavior_get_syncmode(me->instance)
            == LIBCOUCHBASE_SYNCHRONOUS) {
        return v8::True();
    }

    return v8::False();
}

v8::Handle<v8::Value> Couchbase::GetLastError(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    const char *msg = libcouchbase_strerror(me->instance, me->lastError);
    return scope.Close(v8::String::New(msg));
}

void Couchbase::errorCallback(libcouchbase_error_t err, const char *errinfo)
{

    if (!connected) {
        // Time to fail out all the commands..
        connected = true;
        runScheduledCommands();
    }

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
        if (!connected) {
            connected = true;
            runScheduledCommands();
        }
    }
    libcouchbase_set_configuration_callback(instance, NULL);
}

bool Couchbase::onTimeout(void)
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
