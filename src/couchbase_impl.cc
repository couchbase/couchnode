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
#include "cas.h"
#include "logger.h"
#include <libcouchbase/libuv_io_opts.h>

using namespace std;
using namespace Couchnode;

Logger logger;

// libcouchbase handlers keep a C linkage...
extern "C" {
    // node.js will call the init method when the shared object
    // is successfully loaded. Time to register our class!
    static void init(Handle<Object> target)
    {
        CouchbaseImpl::Init(target);
    }

    NODE_MODULE(couchbase_impl, init)
}

#ifdef COUCHNODE_DEBUG
unsigned int CouchbaseImpl::objectCount;
#endif


static Handle<Value> bailOut(const Arguments &args, CBExc &ex)
{
    Handle<Function> cb;
    if (args.Length()) {
        cb = args[args.Length()-1].As<Function>();
    }

    if (cb.IsEmpty() || !cb->IsFunction()) {
        // no callback. must bail.
        return ex.eArguments("No callback provided. Bailing out").throwV8();
    }

    Handle<Value> excObj = ex.asValue();
    node::MakeCallback(v8::Context::GetCurrent()->Global(),
                       cb, 1, &excObj);
    return v8::False();
}


CouchbaseImpl::CouchbaseImpl(lcb_t inst) :
    ObjectWrap(), connected(false), useHashtableParams(false),
    instance(inst), lastError(LCB_SUCCESS), isShutdown(false)

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
    if (instance) {
        lcb_destroy(instance);
    }

    EventMap::iterator iter = events.begin();
    while (iter != events.end()) {
        if (!iter->second.IsEmpty()) {
            iter->second.Dispose();
            iter->second.Clear();
        }
        ++iter;
    }
}

void CouchbaseImpl::Init(Handle<Object> target)
{
    HandleScope scope;

    Local<FunctionTemplate> t = FunctionTemplate::New(New);

    Persistent<FunctionTemplate> s_ct;
    s_ct = Persistent<FunctionTemplate>::New(t);
    s_ct->InstanceTemplate()->SetInternalFieldCount(1);
    s_ct->SetClassName(String::NewSymbol("CouchbaseImpl"));

    NODE_SET_PROTOTYPE_METHOD(s_ct, "strError", StrError);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "on", On);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "shutdown", Shutdown);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "setMulti", SetMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "addMulti", AddMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "replaceMulti", ReplaceMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "appendMulti", AppendMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "prependMulti", PrependMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "getMulti", GetMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "touchMulti", TouchMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "lockMulti", LockMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "unlockMulti", UnlockMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "arithmeticMulti", ArithmeticMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "removeMulti", RemoveMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "deleteMulti", RemoveMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "observeMulti", ObserveMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "endureMulti", EndureMulti);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "stats", Stats);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "httpRequest", HttpRequest);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "_control", _Control);
    NODE_SET_PROTOTYPE_METHOD(s_ct, "_connect", Connect);
    target->Set(String::NewSymbol("CouchbaseImpl"), s_ct->GetFunction());

    target->Set(String::NewSymbol("Constants"), createConstants());
    NameMap::initialize();
    ValueFormat::initialize();
}

Handle<Value> CouchbaseImpl::On(const Arguments &args)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    return me->on(args);
}

Handle<Value> CouchbaseImpl::on(const Arguments &args)
{
    HandleScope scope;
    CBExc ex;
    if (args.Length() != 2) {
        return ex.eArguments("Need event and callback").throwV8();
    }

    Handle<Value> cbName = args[0];
    Handle<Value> cbTarget = args[1];
    String::AsciiValue func(cbName);

    if (func.length() == 0) {
        return ex.eArguments("Bad callback parameter", cbName).throwV8();
    }

    if (!cbTarget->IsFunction()) {
        return ex.eArguments("Parameter is not a function", cbTarget).throwV8();
    }

    EventMap::iterator iter = events.find(*func);
    if (iter != events.end()) {
        if (!iter->second.IsEmpty()) {
            iter->second.Dispose();
            iter->second.Clear();
        }
        events.erase(iter);
    }

    events[*func] = Persistent<Function>::New(cbTarget.As<Function>());
    return scope.Close(True());
}

Handle<Value> CouchbaseImpl::New(const Arguments &args)
{
    HandleScope scope;
    CBExc exc;

    if (args.Length() < 1) {
        return exc.eArguments("Need a URI").throwV8();
    }

    if (args.Length() > 4) {
        return exc.eArguments("Too many arguments").throwV8();
    }

    std::string argv[4];
    lcb_error_t err;

    for (int ii = 0; ii < args.Length(); ++ii) {
        Local<Value> arg = args[ii];
        if (arg->IsString()) {
            String::Utf8Value s(arg);
            argv[ii] = (char *)*s;
        } else if (arg->IsNull() || arg->IsUndefined()) {
            continue;
        } else {
            return exc.eArguments("Incorrect argument", args[ii]).throwV8();
        }
    }

    lcb_io_opt_st *iops;
    lcbuv_options_t iopsOptions;

    iopsOptions.version = 0;
    iopsOptions.v.v0.loop = uv_default_loop();
    iopsOptions.v.v0.startsop_noop = 1;

    err = lcb_create_libuv_io_opts(0, &iops, &iopsOptions);

    if (iops == NULL) {
        return exc.eLcb(err).throwV8();
    }

    lcb_create_st createOptions(argv[0].c_str(),
                                argv[1].c_str(),
                                argv[2].c_str(),
                                argv[3].c_str(),
                                iops);

    lcb_t instance;
    err = lcb_create(&instance, &createOptions);

    if (err != LCB_SUCCESS) {
        exc.eLcb(err).throwV8();
    }

    CouchbaseImpl *hw = new CouchbaseImpl(instance);
    hw->Wrap(args.This());
    return args.This();
}

Handle<Value> CouchbaseImpl::Connect(const Arguments &args)
{
    HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    lcb_error_t ec = lcb_connect(me->getLibcouchbaseHandle());
    if (ec != LCB_SUCCESS) {
        return CBExc().eLcb(ec).throwV8();
    }

    return scope.Close(True());
}

Handle<Value> CouchbaseImpl::StrError(const Arguments &args)
{
    HandleScope scope;
    if (args.Length() != 1) {
        return CBExc().eArguments("Method takes a single parameter").throwV8();
    }
    Handle<Value> errObj = args[0]->ToInt32();
    if (errObj.IsEmpty()) {
        return CBExc().eArguments("Couldn't convert to number", args[0]).throwV8();
    }

    return scope.Close(String::NewSymbol(lcb_strerror(NULL,
            (lcb_error_t)errObj->IntegerValue())));

}

void CouchbaseImpl::onConnect(lcb_error_t err)
{
    if (connected) {
        return;
    }

    connected = true;
    HandleScope scope;
    Handle<Value> errObj;

    if (err != LCB_SUCCESS) {
        errObj = CBExc().eLcb(err).asValue();
    } else {
        errObj = v8::Undefined();
    }

    EventMap::iterator iter = events.find("connect");
    if (iter == events.end() || iter->second.IsEmpty()) {
        return;
    }

    node::MakeCallback(v8::Context::GetCurrent()->Global(),
                       iter->second, 1, &errObj);
}

void CouchbaseImpl::errorCallback(lcb_error_t err, const char *errinfo)
{

    if (!connected) {
        onConnect(err);
    }

    EventMap::iterator iter = events.find("error");
    if (iter == events.end() || iter->second.IsEmpty()) {
        return;
    }

    HandleScope scope;
    CBExc ex;
    ex.eLcb(err);
    if (errinfo) {
        ex.setMessage(errinfo);
    }
    Handle<Value> exObj = ex.asValue();
    node::MakeCallback(v8::Context::GetCurrent()->Global(),
                       iter->second, 1, &exObj);
    return;
}

void CouchbaseImpl::onConfig(lcb_configuration_t config)
{
    if (connected) {
        return;
    }

    if (config != LCB_CONFIGURATION_NEW) {
        return;
    }

    onConnect(LCB_SUCCESS);
    runScheduledOperations();
    lcb_set_configuration_callback(instance, NULL);
}

void CouchbaseImpl::runScheduledOperations(lcb_error_t globalerr)
{
    while (!pendingCommands.empty()) {
        Command *p = pendingCommands.front();
        lcb_error_t err;

        if (globalerr == LCB_SUCCESS) {
            err = p->execute(getLibcouchbaseHandle());
        } else {
            err = globalerr;
        }

        if (err != LCB_SUCCESS) {
            p->getCookie()->cancel(err, p->getKeyList());
        }

        delete p;
        pendingCommands.pop();
    }
}

// static
template <typename T>
Handle<Value> CouchbaseImpl::makeOperation(const Arguments &args, T &op)
{
    HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());

    if (!op.initialize()) {
        return bailOut(args, op.getError());
    }

    if (!op.process()) {
        return bailOut(args, op.getError());
    }

    Cookie *cc = op.createCookie();
    cc->setParent(args.This());

    if (!me->connected) {
        // Schedule..
        Command *cp = op.makePersistent();
        me->pendingCommands.push(cp);
        // Place into queue..
        return scope.Close(v8::True());

    } else {
        lcb_error_t err = op.execute(me->getLibcouchbaseHandle());

        if (err == LCB_SUCCESS) {
            return scope.Close(v8::True());

        } else {
            cc->cancel(err, op.getKeyList());
            return scope.Close(v8::False());
        }
    }
}

/*******************************************
 ** Entry point for all of the operations **
 ******************************************/

#define DEFINE_STOREOP(name, mode) \
Handle<Value> CouchbaseImpl::name##Multi(const Arguments &args) \
{ \
    StoreCommand op(args, mode, ARGMODE_MULTI); \
    return makeOperation(args, op); \
}

DEFINE_STOREOP(Set, LCB_SET)
DEFINE_STOREOP(Add, LCB_ADD)
DEFINE_STOREOP(Replace, LCB_REPLACE)
DEFINE_STOREOP(Append, LCB_APPEND)
DEFINE_STOREOP(Prepend, LCB_PREPEND)

Handle<Value> CouchbaseImpl::GetMulti(const Arguments &args)
{
    GetCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::LockMulti(const Arguments &args)
{
    LockCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::UnlockMulti(const Arguments &args)
{
    UnlockCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::TouchMulti(const Arguments &args)
{
    TouchCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::ArithmeticMulti(const Arguments &args)
{
    ArithmeticCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::RemoveMulti(const Arguments &args)
{
    DeleteCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::ObserveMulti(const Arguments &args)
{
    ObserveCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::EndureMulti(const Arguments &args)
{
    EndureCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::Stats(const Arguments &args)
{
    StatsCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::HttpRequest(const Arguments &args)
{
    HttpCommand op(args, ARGMODE_MULTI);
    return makeOperation(args, op);
}

Handle<Value> CouchbaseImpl::Shutdown(const Arguments &args)
{
    HandleScope scope;
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    me->shutdown();
    return scope.Close(True());
}

extern "C" {
    static void libuv_generic_close_cb(uv_handle_t *handle) {
        delete handle;
    }

    static void libuv_shutdown_cb(uv_idle_t* idle, int) {
        ScopeLogger sl("libuv_shutdown_cb");
        lcb_t instance = (lcb_t)idle->data;
        lcb_destroy(instance);
        uv_idle_stop(idle);
        uv_close((uv_handle_t*)idle, libuv_generic_close_cb);
    }
}

void CouchbaseImpl::shutdown(void)
{
    if (isShutdown) {
        return;
    }
    uv_idle_t *idle = new uv_idle_t;
    memset(idle, 0, sizeof(*idle));
    uv_idle_init(uv_default_loop(), idle);
    idle->data = instance;
    lcb_create(&instance, NULL);
    isShutdown = true;
    uv_idle_start(idle, libuv_shutdown_cb);
}


void CouchbaseImpl::dumpMemoryInfo(const std::string& mark="")
{
    HeapStatistics stats;
    return;

    V8::GetHeapStatistics(&stats);
    printf("%-20s: HEAP: Used %lu/%lu\n", mark.c_str(), stats.used_heap_size(),
           stats.total_heap_size());
}
