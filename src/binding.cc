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
#include "couchbase_impl.h"
#include "exception.h"
#include <libcouchbase/libuv_io_opts.h>

using namespace Couchnode;

Persistent<String> CouchbaseImpl::valueKey;
Persistent<String> CouchbaseImpl::casKey;
Persistent<String> CouchbaseImpl::flagsKey;
Persistent<String> CouchbaseImpl::datatypeKey;
Persistent<String> lcbErrorKey;

extern "C" {
    static void init(Handle<Object> target)
    {
        NanAssignPersistent(lcbErrorKey, NanNew<String>("lcbError"));

        Error::Init();
        DefaultTranscoder::Init();
        CouchbaseImpl::Init(target);
    }

    NODE_MODULE(couchbase_impl, init)
}

Persistent<Function> Error::errorClass;
Persistent<String> Error::codeKey;

void CouchbaseImpl::Init(Handle<Object> target)
{
    NanScope();

    Local<FunctionTemplate> t = NanNew<FunctionTemplate>(fnNew);
    t->InstanceTemplate()->SetInternalFieldCount(1);
    t->SetClassName(NanNew<String>("CouchbaseImpl"));

    NODE_SET_PROTOTYPE_METHOD(t, "shutdown", fnShutdown);
    NODE_SET_PROTOTYPE_METHOD(t, "control", fnControl);
    NODE_SET_PROTOTYPE_METHOD(t, "connect", fnConnect);
    NODE_SET_PROTOTYPE_METHOD(t, "getViewNode", fnGetViewNode);
    NODE_SET_PROTOTYPE_METHOD(t, "getMgmtNode", fnGetMgmtNode);
    NODE_SET_PROTOTYPE_METHOD(t, "_errorTest", fnErrorTest);

    NODE_SET_PROTOTYPE_METHOD(t, "setConnectCallback", fnSetConnectCallback);
    NODE_SET_PROTOTYPE_METHOD(t, "setTranscoder", fnSetTranscoder);
    NODE_SET_PROTOTYPE_METHOD(t, "lcbVersion", fnLcbVersion);

    NODE_SET_PROTOTYPE_METHOD(t, "get", fnGet);
    NODE_SET_PROTOTYPE_METHOD(t, "getReplica", fnGetReplica);
    NODE_SET_PROTOTYPE_METHOD(t, "touch", fnTouch);
    NODE_SET_PROTOTYPE_METHOD(t, "unlock", fnUnlock);
    NODE_SET_PROTOTYPE_METHOD(t, "remove", fnRemove);
    NODE_SET_PROTOTYPE_METHOD(t, "store", fnStore);
    NODE_SET_PROTOTYPE_METHOD(t, "arithmetic", fnArithmetic);
    NODE_SET_PROTOTYPE_METHOD(t, "durability", fnDurability);

    target->Set(NanNew<String>("CouchbaseImpl"), t->GetFunction());
    target->Set(NanNew<String>("Constants"), createConstants());
    NODE_SET_METHOD(target, "_setErrorClass", sfnSetErrorClass);

    NanAssignPersistent(valueKey, NanNew<String>("value"));
    NanAssignPersistent(casKey, NanNew<String>("cas"));
    NanAssignPersistent(flagsKey, NanNew<String>("flags"));
    NanAssignPersistent(datatypeKey, NanNew<String>("datatype"));
}

NAN_METHOD(CouchbaseImpl::sfnSetErrorClass)
{
    NanScope();

    if (args.Length() != 1) {
        NanReturnValue(Error::create("invalid number of parameters passed"));
    }

    Error::setErrorClass(args[0].As<Function>());

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnNew)
{
    //CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    NanScope();

    if (args.Length() != 3) {
        return NanThrowError(Error::create("expected 3 parameters"));
    }

    lcb_error_t err;

    lcb_io_opt_st *iops;
    lcbuv_options_t iopsOptions;

    iopsOptions.version = 0;
    iopsOptions.v.v0.loop = uv_default_loop();
    iopsOptions.v.v0.startsop_noop = 1;

    err = lcb_create_libuv_io_opts(0, &iops, &iopsOptions);
    if (err != LCB_SUCCESS) {
        return NanThrowError(Error::create(err));
    }

    lcb_create_st createOptions;
    memset(&createOptions, 0, sizeof(createOptions));
    createOptions.version = 3;
    if (args[0]->BooleanValue()) {
        createOptions.v.v3.connstr = (char*)_NanRawString(
            args[0], Nan::UTF8, NULL, NULL, 0, v8::String::NO_OPTIONS);
    }
    if (args[1]->BooleanValue()) {
        createOptions.v.v3.username = (char*)_NanRawString(
            args[1], Nan::UTF8, NULL, NULL, 0, v8::String::NO_OPTIONS);
    }
    if (args[2]->BooleanValue()) {
        createOptions.v.v3.passwd = (char*)_NanRawString(
            args[2], Nan::UTF8, NULL, NULL, 0, v8::String::NO_OPTIONS);
    }
    createOptions.v.v3.io = iops;

    lcb_t instance;
    err = lcb_create(&instance, &createOptions);

    if (createOptions.v.v3.connstr) {
        delete[] createOptions.v.v3.connstr;
    }
    if (createOptions.v.v3.username) {
        delete[] createOptions.v.v3.username;
    }
    if (createOptions.v.v3.passwd) {
        delete[] createOptions.v.v3.passwd;
    }

    if (err != LCB_SUCCESS) {
        return NanThrowError(Error::create(err));
    }

    CouchbaseImpl *hw = new CouchbaseImpl(instance);
    hw->Wrap(args.This());
    NanReturnValue(args.This());
}

NAN_METHOD(CouchbaseImpl::fnConnect)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    NanScope();

    lcb_error_t ec = lcb_connect(me->getLcbHandle());
    if (ec != LCB_SUCCESS) {
        return NanThrowError(Error::create(ec));
    }

    NanReturnValue(NanTrue());
}


NAN_METHOD(CouchbaseImpl::fnSetConnectCallback)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    NanScope();

    if (args.Length() != 1) {
        NanReturnValue(Error::create("invalid number of parameters passed"));
    }

    if (me->connectCallback) {
      delete me->connectCallback;
      me->connectCallback = NULL;
    }

    if (args[0]->BooleanValue()) {
      if (!args[0]->IsFunction()) {
          return NanThrowError(Error::create("must pass function"));
      }

      me->connectCallback = new NanCallback(args[0].As<Function>());
    }

    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnSetTranscoder)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    NanScope();

    if (args.Length() != 2) {
        return NanThrowError(Error::create("invalid number of parameters passed"));
    }

    if (me->transEncodeFunc) {
      delete me->transEncodeFunc;
      me->transEncodeFunc = NULL;
    }
    if (me->transDecodeFunc) {
      delete me->transDecodeFunc;
      me->transDecodeFunc = NULL;
    }

    if (args[0]->BooleanValue()) {
      if (!args[0]->IsFunction()) {
          return NanThrowError(Error::create("must pass function"));
      }

      me->transEncodeFunc = new NanCallback(args[0].As<Function>());
    }

    if (args[1]->BooleanValue()) {
      if (!args[1]->IsFunction()) {
          return NanThrowError(Error::create("must pass function"));
      }

      me->transDecodeFunc = new NanCallback(args[1].As<Function>());
    }

    NanReturnValue(NanTrue());
}


NAN_METHOD(CouchbaseImpl::fnLcbVersion)
{
    NanScope();
    NanReturnValue(NanNew<String>(lcb_get_version(NULL)));
}

NAN_METHOD(CouchbaseImpl::fnGetViewNode)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    NanScope();

    lcb_int32_t numNodes = lcb_get_num_nodes(me->getLcbHandle());
    if (numNodes <= 0) {
        NanReturnNull();
    }

    int nodeIdx = rand() % numNodes;
    const char *viewNode =
            lcb_get_node(me->getLcbHandle(), LCB_NODE_VIEWS, nodeIdx);

    NanReturnValue(NanNew<String>(viewNode));
}

NAN_METHOD(CouchbaseImpl::fnGetMgmtNode)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    NanScope();

    lcb_int32_t numNodes = lcb_get_num_nodes(me->getLcbHandle());
    if (numNodes <= 0) {
        NanReturnNull();
    }

    int nodeIdx = rand() % numNodes;
    const char *viewNode =
            lcb_get_node(me->getLcbHandle(), LCB_NODE_HTCONFIG, nodeIdx);

    NanReturnValue(NanNew<String>(viewNode));
}

NAN_METHOD(CouchbaseImpl::fnShutdown)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    NanScope();
    lcb_destroy_async(me->getLcbHandle(), NULL);
    me->onShutdown();
    NanReturnValue(NanTrue());
}

NAN_METHOD(CouchbaseImpl::fnErrorTest)
{
    NanScope();
    NanReturnValue(Error::create("test error"));
}
