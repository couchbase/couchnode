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
#include "exception.h"
#include <libcouchbase/libuv_io_opts.h>

using namespace std;
using namespace Couchnode;


CouchbaseImpl::CouchbaseImpl(lcb_t inst) :
    ObjectWrap(), instance(inst), connectCallback(NULL),
    transEncodeFunc(NULL), transDecodeFunc(NULL)
{
    lcb_set_cookie(instance, reinterpret_cast<void *>(this));
    setupLibcouchbaseCallbacks();
}

CouchbaseImpl::~CouchbaseImpl()
{
    delete connectCallback;
    delete transEncodeFunc;
    delete transDecodeFunc;
    if (instance) {
        lcb_destroy(instance);
    }
}

void CouchbaseImpl::onConnect(lcb_error_t err)
{
    NanScope();
    if (connectCallback) {
        Handle<Value> args[] = { NanNew<Integer>(err) };
        connectCallback->Call(1, args);
    }
}

Handle<Value> CouchbaseImpl::decodeDoc(
        const void *bytes, size_t nbytes, lcb_U32 flags)
{
    if (transDecodeFunc) {
        Handle<Object> decObj = NanNew<Object>();
        decObj->Set(NanNew(valueKey), NanNewBufferHandle((char*)bytes, nbytes));
        decObj->Set(NanNew(flagsKey), NanNew<Integer>(flags));
        Handle<Value> args[] = { decObj };
        return transDecodeFunc->Call(1, args);
    }

    return DefaultTranscoder::decode(bytes, nbytes, flags);
}

void CouchbaseImpl::encodeDoc(DefaultTranscoder& transcoder, const void **bytes,
        lcb_SIZE *nbytes, lcb_U32 *flags, Handle<Value> value) {
    // There must never be a NanScope here, the system relies on the fact
    //   that the scope will exist until the lcb_cmd_XXX_t object has been
    //   passed to LCB already.
    if (transEncodeFunc) {
        Handle<Value> args[] = { value };
        Handle<Value> res = transEncodeFunc->Call(1, args);
        if (!res.IsEmpty() && res->IsObject()) {
            Handle<Object> encObj = res.As<Object>();
            Handle<Value> flagsObj = encObj->Get(NanNew(flagsKey));
            Handle<Value> valueObj = encObj->Get(NanNew(valueKey));
            if (!flagsObj.IsEmpty() && !valueObj.IsEmpty()) {
                if (node::Buffer::HasInstance(valueObj)) {
                    *nbytes = node::Buffer::Length(valueObj);
                    *bytes = node::Buffer::Data(valueObj);
                    *flags = flagsObj->Uint32Value();
                    return;
                }
            }
        }
    }
    transcoder.encode(bytes, nbytes, flags, value);
}

template<typename T>
void _DispatchValueCallback(lcb_t instance, const void *cookie, lcb_error_t error, const T *resp) {
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    NanCallback *callback = (NanCallback*)cookie;
    NanScope();

    Handle<Value> errObj = Error::create(error);
    Handle<Value> resVal;
    if (!error) {
        Handle<Object> resObj = NanNew<Object>();
        resObj->Set(NanNew(me->casKey), Cas::CreateCas(resp->v.v0.cas));
        resObj->Set(NanNew(me->valueKey), me->decodeDoc(resp->v.v0.bytes, resp->v.v0.nbytes, resp->v.v0.flags));
        resVal = resObj;
    } else {
        resVal = NanNull();
    }

    Handle<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

template<typename T>
void _DispatchArithCallback(lcb_t instance, const void *cookie, lcb_error_t error, const T *resp) {
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    NanCallback *callback = (NanCallback*)cookie;
    NanScope();

    Handle<Value> errObj = Error::create(error);
    Handle<Value> resVal;
    if (!error) {
        Handle<Object> resObj = NanNew<Object>();
        resObj->Set(NanNew(me->casKey), Cas::CreateCas(resp->v.v0.cas));
        resObj->Set(NanNew(me->valueKey), NanNew<Integer>(resp->v.v0.value));
        resVal = resObj;
    } else {
        resVal = NanNull();
    }

    Handle<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

template<typename T>
void _DispatchBasicCallback(lcb_t instance, const void *cookie, lcb_error_t error, const T *resp) {
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    NanCallback *callback = (NanCallback*)cookie;
    NanScope();

    Handle<Value> errObj = Error::create(error);
    Handle<Value> resVal;
    if (!error) {
        Handle<Object> resObj = NanNew<Object>();
        resObj->Set(NanNew(me->casKey), Cas::CreateCas(resp->v.v0.cas));
        resVal = resObj;
    } else {
        resVal = NanNull();
    }

    Handle<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

void _DispatchErrorCallback(lcb_t instance, const void *cookie, lcb_error_t error) {
    NanCallback *callback = (NanCallback*)cookie;
    NanScope();

    Handle<Value> errObj = Error::create(error);
    Handle<Value> resVal = NanNull();

    Handle<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

extern "C" {
static void bootstrap_callback(lcb_t instance, lcb_error_t err)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    me->onConnect(err);
}


static void get_callback(lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_get_resp_t *resp)
{
    _DispatchValueCallback(instance, cookie, error, resp);
}

static void store_callback(lcb_t instance, const void *cookie, lcb_storage_t,
        lcb_error_t error, const lcb_store_resp_t *resp)
{
    _DispatchBasicCallback(instance, cookie, error, resp);
}

static void arithmetic_callback(lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_arithmetic_resp_t *resp)
{
    _DispatchArithCallback(instance, cookie, error, resp);
}

static void remove_callback(lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_remove_resp_t *resp)
{
    _DispatchBasicCallback(instance, cookie, error, resp);

}

static void touch_callback(lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_touch_resp_t *resp)
{
    _DispatchBasicCallback(instance, cookie, error, resp);
}

static void unlock_callback(lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_unlock_resp_t *resp)
{
    _DispatchErrorCallback(instance, cookie, error);
}

static void durability_callback(lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_durability_resp_t *resp)
{
    _DispatchErrorCallback(instance, cookie, error);
}

}

void CouchbaseImpl::setupLibcouchbaseCallbacks(void)
{
    lcb_set_bootstrap_callback(instance, bootstrap_callback);

    lcb_set_get_callback(instance, get_callback);
    lcb_set_store_callback(instance, store_callback);
    lcb_set_arithmetic_callback(instance, arithmetic_callback);
    lcb_set_remove_callback(instance, remove_callback);
    lcb_set_touch_callback(instance, touch_callback);
    lcb_set_unlock_callback(instance, unlock_callback);
    lcb_set_durability_callback(instance, durability_callback);
}
