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
#include <libcouchbase/vbucket.h>

using namespace Couchnode;

Nan::Persistent<Function> CouchbaseImpl::jsonParse;
Nan::Persistent<Function> CouchbaseImpl::jsonStringify;
Nan::Persistent<String> CouchbaseImpl::valueKey;
Nan::Persistent<String> CouchbaseImpl::casKey;
Nan::Persistent<String> CouchbaseImpl::flagsKey;
Nan::Persistent<String> CouchbaseImpl::datatypeKey;
Nan::Persistent<String> CouchbaseImpl::idKey;
Nan::Persistent<String> CouchbaseImpl::keyKey;
Nan::Persistent<String> CouchbaseImpl::docKey;
Nan::Persistent<String> CouchbaseImpl::geometryKey;
Nan::Persistent<String> CouchbaseImpl::rowsKey;
Nan::Persistent<String> CouchbaseImpl::resultsKey;
Nan::Persistent<String> CouchbaseImpl::tokenKey;
Nan::Persistent<String> CouchbaseImpl::errorKey;
Nan::Persistent<String> lcbErrorKey;

extern "C" {
    static NAN_MODULE_INIT(init)
    {
        lcbErrorKey.Reset(Nan::New<String>("lcbError").ToLocalChecked());

        Error::Init();
        Cas::Init();
        MutationToken::Init();
        CouchbaseImpl::Init(target);
    }

    NODE_MODULE(couchbase_impl, init)
}

Nan::Persistent<Function> Cas::casClass;
Nan::Persistent<Function> MutationToken::tokenClass;
Nan::Persistent<Function> Error::errorClass;
Nan::Persistent<String> Error::codeKey;

NAN_MODULE_INIT(CouchbaseImpl::Init)
{
    Nan::HandleScope scope;

    Local<FunctionTemplate> t = Nan::New<FunctionTemplate>(fnNew);
    t->InstanceTemplate()->SetInternalFieldCount(1);
    t->SetClassName(Nan::New<String>("CouchbaseImpl").ToLocalChecked());

    Nan::SetPrototypeMethod(t, "shutdown", fnShutdown);
    Nan::SetPrototypeMethod(t, "control", fnControl);
    Nan::SetPrototypeMethod(t, "connect", fnConnect);
    Nan::SetPrototypeMethod(t, "getViewNode", fnGetViewNode);
    Nan::SetPrototypeMethod(t, "getMgmtNode", fnGetMgmtNode);
    Nan::SetPrototypeMethod(t, "invalidateQueryCache", fnInvalidateQueryCache);
    Nan::SetPrototypeMethod(t, "_errorTest", fnErrorTest);

    Nan::SetPrototypeMethod(t, "setConnectCallback", fnSetConnectCallback);
    Nan::SetPrototypeMethod(t, "setTranscoder", fnSetTranscoder);
    Nan::SetPrototypeMethod(t, "lcbVersion", fnLcbVersion);

    Nan::SetPrototypeMethod(t, "get", fnGet);
    Nan::SetPrototypeMethod(t, "getReplica", fnGetReplica);
    Nan::SetPrototypeMethod(t, "touch", fnTouch);
    Nan::SetPrototypeMethod(t, "unlock", fnUnlock);
    Nan::SetPrototypeMethod(t, "remove", fnRemove);
    Nan::SetPrototypeMethod(t, "store", fnStore);
    Nan::SetPrototypeMethod(t, "arithmetic", fnArithmetic);
    Nan::SetPrototypeMethod(t, "durability", fnDurability);
    Nan::SetPrototypeMethod(t, "viewQuery", fnViewQuery);
    Nan::SetPrototypeMethod(t, "n1qlQuery", fnN1qlQuery);
    Nan::SetPrototypeMethod(t, "ftsQuery", fnFtsQuery);
    Nan::SetPrototypeMethod(t, "lookupIn", fnLookupIn);
    Nan::SetPrototypeMethod(t, "mutateIn", fnMutateIn);
    Nan::SetPrototypeMethod(t, "ping", fnPing);
    Nan::SetPrototypeMethod(t, "diag", fnDiag);

    target->Set(
            Nan::New<String>("CouchbaseImpl").ToLocalChecked(),
            t->GetFunction());
    target->Set(
            Nan::New<String>("Constants").ToLocalChecked(),
            createConstants());
    Nan::SetMethod(target, "_setErrorClass", sfnSetErrorClass);

    valueKey.Reset(Nan::New<String>("value").ToLocalChecked());
    casKey.Reset(Nan::New<String>("cas").ToLocalChecked());
    flagsKey.Reset(Nan::New<String>("flags").ToLocalChecked());
    datatypeKey.Reset(Nan::New<String>("datatype").ToLocalChecked());
    idKey.Reset(Nan::New<String>("id").ToLocalChecked());
    keyKey.Reset(Nan::New<String>("key").ToLocalChecked());
    docKey.Reset(Nan::New<String>("doc").ToLocalChecked());
    geometryKey.Reset(Nan::New<String>("geometry").ToLocalChecked());
    rowsKey.Reset(Nan::New<String>("rows").ToLocalChecked());
    resultsKey.Reset(Nan::New<String>("results").ToLocalChecked());
    tokenKey.Reset(Nan::New<String>("token").ToLocalChecked());
    errorKey.Reset(Nan::New<String>("error").ToLocalChecked());

    Handle<Object> jMod = Nan::GetCurrentContext()->Global()->Get(
            Nan::New<String>("JSON").ToLocalChecked()).As<Object>();
    assert(!jMod.IsEmpty());
    jsonParse.Reset(
            jMod->Get(Nan::New<String>("parse").ToLocalChecked()).As<Function>());
    jsonStringify.Reset(
            jMod->Get(Nan::New<String>("stringify").ToLocalChecked()).As<Function>());
    assert(!jsonParse.IsEmpty());
    assert(!jsonStringify.IsEmpty());
}

NAN_METHOD(CouchbaseImpl::sfnSetErrorClass)
{
    Nan::HandleScope scope;

    if (info.Length() != 1) {
        info.GetReturnValue().Set(Error::create("invalid number of parameters passed"));
        return;
    }

    Error::setErrorClass(info[0].As<Function>());

    info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnNew)
{
    //CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This());
    Nan::HandleScope scope;

    if (info.Length() != 3) {
        return Nan::ThrowError(Error::create("expected 3 parameters"));
    }

    lcb_error_t err;

    lcb_io_opt_st *iops;
    lcbuv_options_t iopsOptions;

    iopsOptions.version = 0;
    iopsOptions.v.v0.loop = uv_default_loop();
    iopsOptions.v.v0.startsop_noop = 1;

    err = lcb_create_libuv_io_opts(0, &iops, &iopsOptions);
    if (err != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(err));
    }

    lcb_create_st createOptions;
    memset(&createOptions, 0, sizeof(createOptions));
    createOptions.version = 3;

    Nan::Utf8String *utfConnStr = NULL;
    if (info[0]->BooleanValue()) {
        utfConnStr = new Nan::Utf8String(info[0]);
        createOptions.v.v3.connstr = **utfConnStr;
    }

    Nan::Utf8String *utfUsername = NULL;
    if (info[1]->BooleanValue()) {
        utfUsername = new Nan::Utf8String(info[1]);
        createOptions.v.v3.username = **utfUsername;
    }

    Nan::Utf8String *utfPassword = NULL;
    if (info[2]->BooleanValue()) {
        utfPassword = new Nan::Utf8String(info[2]);
        createOptions.v.v3.passwd = **utfPassword;
    }
    createOptions.v.v3.io = iops;

    lcb_t instance;
    err = lcb_create(&instance, &createOptions);

    if (utfConnStr) {
        delete utfConnStr;
    }
    if (utfUsername) {
        delete utfUsername;
    }
    if (utfPassword) {
        delete utfPassword;
    }

    if (err != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(err));
    }

    CouchbaseImpl *hw = new CouchbaseImpl(instance);
    hw->Wrap(info.This());
    return info.GetReturnValue().Set(info.This());
}

NAN_METHOD(CouchbaseImpl::fnConnect)
{
    CouchbaseImpl *me = Nan::ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    Nan::HandleScope scope;

    lcb_error_t ec = lcb_connect(me->getLcbHandle());
    if (ec != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(ec));
    }

    return info.GetReturnValue().Set(true);
}


NAN_METHOD(CouchbaseImpl::fnSetConnectCallback)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    Nan::HandleScope scope;

    if (info.Length() != 1) {
        return info.GetReturnValue().Set(
                Error::create("invalid number of parameters passed"));
    }

    if (me->connectCallback) {
      delete me->connectCallback;
      me->connectCallback = NULL;
    }

    if (info[0]->BooleanValue()) {
      if (!info[0]->IsFunction()) {
          return Nan::ThrowError(Error::create("must pass function"));
      }

      me->connectCallback = new Nan::Callback(info[0].As<Function>());
    }

    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnSetTranscoder)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    Nan::HandleScope scope;

    if (info.Length() != 2) {
        return Nan::ThrowError(Error::create("invalid number of parameters passed"));
    }

    if (me->transEncodeFunc) {
      delete me->transEncodeFunc;
      me->transEncodeFunc = NULL;
    }
    if (me->transDecodeFunc) {
      delete me->transDecodeFunc;
      me->transDecodeFunc = NULL;
    }

    if (info[0]->BooleanValue()) {
      if (!info[0]->IsFunction()) {
          return Nan::ThrowError(Error::create("must pass function"));
      }

      me->transEncodeFunc = new Nan::Callback(info[0].As<Function>());
    }

    if (info[1]->BooleanValue()) {
      if (!info[1]->IsFunction()) {
          return Nan::ThrowError(Error::create("must pass function"));
      }

      me->transDecodeFunc = new Nan::Callback(info[1].As<Function>());
    }

    return info.GetReturnValue().Set(true);
}


NAN_METHOD(CouchbaseImpl::fnLcbVersion)
{
    Nan::HandleScope scope;
    return info.GetReturnValue().Set(
        Nan::New<String>(lcb_get_version(NULL)).ToLocalChecked());
}

NAN_METHOD(CouchbaseImpl::fnGetViewNode)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    Nan::HandleScope scope;
    lcbvb_CONFIG *cfg;

    lcb_cntl(me->getLcbHandle(), LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &cfg);

    int nodeIdx =
        lcbvb_get_randhost(cfg, LCBVB_SVCTYPE_VIEWS, LCBVB_SVCMODE_PLAIN);

    const char *viewNode =
        lcb_get_node(
            me->getLcbHandle(),
            (lcb_GETNODETYPE)LCB_NODE_VIEWS,
            nodeIdx);

    return info.GetReturnValue().Set(
        Nan::New<String>(viewNode).ToLocalChecked());
}

NAN_METHOD(CouchbaseImpl::fnGetMgmtNode)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    Nan::HandleScope scope;
    lcbvb_CONFIG *cfg;

    lcb_cntl(me->getLcbHandle(), LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &cfg);

    int nodeIdx =
        lcbvb_get_randhost(cfg, LCBVB_SVCTYPE_MGMT, LCBVB_SVCMODE_PLAIN);

    const char *mgmtNode =
        lcb_get_node(
            me->getLcbHandle(),
            (lcb_GETNODETYPE)LCB_NODE_HTCONFIG,
            nodeIdx);

    return info.GetReturnValue().Set(
        Nan::New<String>(mgmtNode).ToLocalChecked());
}

NAN_METHOD(CouchbaseImpl::fnInvalidateQueryCache)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    lcb_cntl(me->getLcbHandle(), LCB_CNTL_SET, LCB_CNTL_N1QL_CLEARACHE, NULL);
}

NAN_METHOD(CouchbaseImpl::fnShutdown)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    Nan::HandleScope scope;
    lcb_destroy_async(me->getLcbHandle(), NULL);
    me->onShutdown();
    return info.GetReturnValue().Set(true);
}

NAN_METHOD(CouchbaseImpl::fnErrorTest)
{
    Nan::HandleScope scope;
    info.GetReturnValue().Set(Error::create("test error"));
}
