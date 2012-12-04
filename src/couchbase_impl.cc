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

#include "couchbase_impl.h"
#include "io/libcouchbase-libuv.h"
#include "cas.h"

using namespace std;
using namespace Couchnode;

typedef lcb_io_opt_st *(*loop_factory_fn)(uv_loop_t *, uint16_t);

// libcouchbase handlers keep a C linkage...
extern "C" {
    // node.js will call the init method when the shared object
    // is successfully loaded. Time to register our class!
    static void init(v8::Handle<v8::Object> target)
    {
        CouchbaseImpl::Init(target);
    }

    NODE_MODULE(couchbase_impl, init)
}

#ifdef COUCHNODE_DEBUG
unsigned int CouchbaseImpl::objectCount;
#endif

v8::Handle<v8::Value> Couchnode::ThrowException(const char *str)
{
    return v8::ThrowException(v8::Exception::Error(v8::String::New(str)));
}

v8::Handle<v8::Value> Couchnode::ThrowIllegalArgumentsException(void)
{
    return Couchnode::ThrowException("Illegal Arguments");
}

CouchbaseImpl::CouchbaseImpl(lcb_t inst) :
    ObjectWrap(), connected(false), useHashtableParams(false),
    instance(inst), lastError(LCB_SUCCESS)

{
    lcb_set_cookie(instance, reinterpret_cast<void *>(this));
    setupLibcouchbaseCallbacks();
#ifdef COUCHNODE_DEBUG
    ++objectCount;
#endif
}

CouchbaseImpl::~CouchbaseImpl()
{
#ifdef COUCHNODE_DEBUG
    --objectCount;
    cerr << "Destroying handle.." << endl
         << "Still have " << objectCount << " handles remaining" << endl;
#endif

    lcb_destroy(instance);

    EventMap::iterator iter = events.begin();
    while (iter != events.end()) {
        if (!iter->second.IsEmpty()) {
            iter->second.Dispose();
            iter->second.Clear();
        }
        ++iter;
    }
}

void CouchbaseImpl::Init(v8::Handle<v8::Object> target)
{
    v8::HandleScope scope;

    v8::Local<v8::FunctionTemplate> t = v8::FunctionTemplate::New(New);

    v8::Persistent<v8::FunctionTemplate> s_ct;
    s_ct = v8::Persistent<v8::FunctionTemplate>::New(t);
    s_ct->InstanceTemplate()->SetInternalFieldCount(1);
    s_ct->SetClassName(v8::String::NewSymbol("CouchbaseImpl"));

    NODE_SET_PROTOTYPE_METHOD(s_ct, "strError", StrError);
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
    NODE_SET_PROTOTYPE_METHOD(s_ct, "remove", Remove);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "touch", Touch);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "observe", Observe);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "_opCallStyle", OpCallStyle);

    target->Set(v8::String::NewSymbol("CouchbaseImpl"), s_ct->GetFunction());

    NameMap::initialize();
    Cas::initialize();
}

v8::Handle<v8::Value> CouchbaseImpl::On(const v8::Arguments &args)
{
    if (args.Length() != 2 || !args[0]->IsString() || !args[1]->IsFunction()) {
        return ThrowException("Usage: cb.on('event', 'callback')");
    }

    // @todo verify that the user specifies a valid monitor ;)
    v8::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    v8::Handle<v8::Value> ret = me->on(args);
    return scope.Close(ret);
}

v8::Handle<v8::Value> CouchbaseImpl::on(const v8::Arguments &args)
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

v8::Handle<v8::Value> CouchbaseImpl::OpCallStyle(const v8::Arguments &args)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());

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

v8::Handle<v8::Value> CouchbaseImpl::New(const v8::Arguments &args)
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
        } else if (!args[ii]->IsNull() && !args[ii]->IsUndefined()) {
            stringstream ss;
            ss << "Incorrect datatype provided as argument nr. "
               << ii + 1 << " (expected string)";
            return ThrowException(ss.str().c_str());
        }
    }

    lcb_io_opt_st *iops = lcb_luv_create_io_opts(uv_default_loop(),
                                                 1024);
    if (iops == NULL) {
        return ThrowException("Failed to create a new IO ops structure");
    }

    lcb_create_st createOptions(argv[0], argv[1], argv[2],
                                argv[3], iops);
    lcb_t instance;
    lcb_error_t err = lcb_create(&instance, &createOptions);
    for (int ii = 0; ii < 4; ++ii) {
        delete[] argv[ii];
    }

    if (err != LCB_SUCCESS) {
        return ThrowException("Failed to create libcouchbase instance");
    }

    if (lcb_connect(instance) != LCB_SUCCESS) {
        return ThrowException("Failed to schedule connection");
    }

    CouchbaseImpl *hw = new CouchbaseImpl(instance);
    hw->Wrap(args.This());
    return args.This();
}

v8::Handle<v8::Value> CouchbaseImpl::StrError(const v8::Arguments &args)
{
    v8::HandleScope scope;

    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    lcb_error_t errorCode = (lcb_error_t)args[0]->Int32Value();
    const char *errorStr = lcb_strerror(me->instance, errorCode);

    v8::Local<v8::String> result = v8::String::New(errorStr);
    return scope.Close(result);
}

v8::Handle<v8::Value> CouchbaseImpl::GetVersion(const v8::Arguments &)
{
    v8::HandleScope scope;

    stringstream ss;
    ss << "libcouchbase node.js v1.0.0 (v" << lcb_get_version(NULL)
       << ")";

    v8::Local<v8::String> result = v8::String::New(ss.str().c_str());
    return scope.Close(result);
}

v8::Handle<v8::Value> CouchbaseImpl::SetTimeout(const v8::Arguments &args)
{
    if (args.Length() != 1 || !args[0]->IsInt32()) {
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    uint32_t timeout = args[0]->Int32Value();
    lcb_set_timeout(me->instance, timeout);

    return v8::True();
}

v8::Handle<v8::Value> CouchbaseImpl::GetTimeout(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    return scope.Close(v8::Integer::New(lcb_get_timeout(me->instance)));
}

v8::Handle<v8::Value> CouchbaseImpl::GetRestUri(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    stringstream ss;
    ss << lcb_get_host(me->instance) << ":" << lcb_get_port(
           me->instance);

    return scope.Close(v8::String::New(ss.str().c_str()));
}

v8::Handle<v8::Value> CouchbaseImpl::SetSynchronous(const v8::Arguments &args)
{
    if (args.Length() != 1) {
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;

    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());

    lcb_syncmode_t mode;
    if (args[0]->BooleanValue()) {
        mode = LCB_SYNCHRONOUS;
    } else {
        mode = LCB_ASYNCHRONOUS;
    }

    lcb_behavior_set_syncmode(me->instance, mode);
    return v8::True();
}

v8::Handle<v8::Value> CouchbaseImpl::IsSynchronous(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    if (lcb_behavior_get_syncmode(me->instance)
            == LCB_SYNCHRONOUS) {
        return v8::True();
    }

    return v8::False();
}

v8::Handle<v8::Value> CouchbaseImpl::GetLastError(const v8::Arguments &args)
{
    if (args.Length() != 0) {
        return ThrowIllegalArgumentsException();
    }

    v8::HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    const char *msg = lcb_strerror(me->instance, me->lastError);
    return scope.Close(v8::String::New(msg));
}

void CouchbaseImpl::errorCallback(lcb_error_t err, const char *errinfo)
{

    if (!connected) {
        // Time to fail out all the commands..
        connected = true;
        runScheduledCommands();
    }

    if (err == LCB_ETIMEDOUT && onTimeout()) {
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

void CouchbaseImpl::onConnect(lcb_configuration_t config)
{
    if (config == LCB_CONFIGURATION_NEW) {
        if (!connected) {
            connected = true;
            runScheduledCommands();
        }
    }
    lcb_set_configuration_callback(instance, NULL);

    EventMap::iterator iter = events.find("connect");
    if (iter != events.end() && !iter->second.IsEmpty()) {
        using namespace v8;
        Local<Value> argv[1];
        iter->second->Call(Context::GetEntered()->Global(), 0, argv);
    }
}

bool CouchbaseImpl::onTimeout(void)
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
