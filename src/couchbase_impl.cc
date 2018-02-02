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

#ifdef UV_VERSION_MAJOR
#ifndef UV_VERSION_PATCH
#define UV_VERSION_PATCH 0
#endif
#define NAUV_UVVERSION  ((UV_VERSION_MAJOR << 16) | \
                     (UV_VERSION_MINOR <<  8) | \
                     (UV_VERSION_PATCH))
#else
#define NAUV_UVVERSION 0x000b00
#endif

#if NAUV_UVVERSION < 0x000b00
#define NAUV_PREPARE_CB(func) \
    void func(uv_prepare_t *handle, int)
#else
#define NAUV_PREPARE_CB(func) \
    void func(uv_prepare_t *handle)
#endif

NAUV_PREPARE_CB(lcbuv_flush) {
    CouchbaseImpl *me = reinterpret_cast<CouchbaseImpl*>(handle->data);
    lcb_sched_flush(me->getLcbHandle());
}

CouchbaseImpl::CouchbaseImpl(lcb_t inst) :
    ObjectWrap(), instance(inst), connectCallback(NULL),
    transEncodeFunc(NULL), transDecodeFunc(NULL)
{
    lcb_set_cookie(instance, reinterpret_cast<void *>(this));
    setupLibcouchbaseCallbacks();
}

CouchbaseImpl::~CouchbaseImpl()
{
    if (connectCallback) {
        delete connectCallback;
        connectCallback = NULL;
    }
    if (transEncodeFunc) {
        delete transEncodeFunc;
        transEncodeFunc = NULL;
    }
    if (transDecodeFunc) {
        delete transDecodeFunc;
        transDecodeFunc = NULL;
    }
    if (instance) {
        lcb_destroy(instance);
    }
}

extern "C" { static void bootstrap_callback_empty(lcb_t, lcb_error_t) {} }
void CouchbaseImpl::onConnect(lcb_error_t err)
{
    if (err != 0) {
        lcb_set_bootstrap_callback(instance, bootstrap_callback_empty);
        lcb_destroy_async(instance, NULL);
    } else {
        uv_prepare_init(uv_default_loop(), &flushWatch);
        flushWatch.data = this;
        uv_prepare_start(&flushWatch, &lcbuv_flush);

        int flushMode = 0;
        lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_SCHED_IMPLICIT_FLUSH, &flushMode);
    }

    Nan::HandleScope scope;
    if (connectCallback) {
        Local<Value> args[] = { Error::create(err) };
        connectCallback->Call(1, args);
    }
}

void CouchbaseImpl::onShutdown()
{
    uv_prepare_stop(&flushWatch);
}

Handle<Value> CouchbaseImpl::decodeDoc(
        const void *bytes, size_t nbytes, lcb_U32 flags)
{
    if (transDecodeFunc) {
        Local<Object> decObj = Nan::New<Object>();
        decObj->Set(Nan::New(valueKey),
                Nan::CopyBuffer((char*)bytes, nbytes).ToLocalChecked());
        decObj->Set(Nan::New(flagsKey), Nan::New<Integer>(flags));
        Local<Value> args[] = { decObj };
        return transDecodeFunc->Call(1, args);
    }

    return DefaultTranscoder::decode(bytes, nbytes, flags);
}

bool CouchbaseImpl::encodeDoc(CommandEncoder& enc, const void **bytes,
        lcb_SIZE *nbytes, lcb_U32 *flags, Local<Value> value) {
    // There must never be a NanScope here, the system relies on the fact
    //   that the scope will exist until the lcb_cmd_XXX_t object has been
    //   passed to LCB already.
    if (transEncodeFunc) {
        Local<Value> args[] = { value };
        Nan::TryCatch tryCatch;
        Nan::MaybeLocal<Value> mres = Nan::CallAsFunction(
          transEncodeFunc->GetFunction(),
          Nan::GetCurrentContext()->Global(), 1, args);
        if (tryCatch.HasCaught()) {
            tryCatch.ReThrow();
            return false;
        }
        if (!mres.IsEmpty()) {
          Local<Value> res = mres.ToLocalChecked();
          if (res->IsObject()) {
              Handle<Object> encObj = res.As<Object>();
              Handle<Value> flagsObj = encObj->Get(Nan::New(flagsKey));
              Handle<Value> valueObj = encObj->Get(Nan::New(valueKey));
              if (!flagsObj.IsEmpty() && !valueObj.IsEmpty()) {
                  if (node::Buffer::HasInstance(valueObj)) {
                      *nbytes = node::Buffer::Length(valueObj);
                      *bytes = node::Buffer::Data(valueObj);
                      *flags = flagsObj->Uint32Value();
                      return true;
                  }
              }
          }
        }
    }
    DefaultTranscoder::encode(enc, bytes, nbytes, flags, value);
    return true;
}

void _DispatchValueCallback(lcb_t instance, int cbtype, const lcb_RESPBASE *respbase) {
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPGET *resp = (const lcb_RESPGET*)respbase;
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resObj->Set(Nan::New(me->valueKey), me->decodeDoc(resp->value, resp->nvalue, resp->itmflags));
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    Local<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

void _DispatchArithCallback(lcb_t instance, int cbtype, const lcb_RESPBASE *respbase) {
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPCOUNTER *resp = (const lcb_RESPCOUNTER*)respbase;
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resObj->Set(Nan::New(me->tokenKey), MutationToken::CreateToken(instance, cbtype, respbase));
        resObj->Set(Nan::New(me->valueKey), Nan::New<Number>(resp->value));
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    Local<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

void _DispatchBasicCallback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp) {
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    Local<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

void _DispatchStoreCallback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp) {
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resObj->Set(Nan::New(me->tokenKey), MutationToken::CreateToken(instance, cbtype, resp));
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    Local<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

void _DispatchErrorCallback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp) {
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal = Nan::Null();

    Local<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

extern "C" {
static void bootstrap_callback(lcb_t instance, lcb_error_t err)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    me->onConnect(err);
}

static void get_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchValueCallback(instance, cbtype, resp);
}

static void store_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchStoreCallback(instance, cbtype, resp);
}

static void arithmetic_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchArithCallback(instance, cbtype, resp);
}

static void remove_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchStoreCallback(instance, cbtype, resp);
}

static void touch_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchBasicCallback(instance, cbtype, resp);
}

static void unlock_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchErrorCallback(instance, cbtype, resp);
}

static void durability_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchErrorCallback(instance, cbtype, resp);
}

void viewrow_callback(lcb_t instance, int ignoreme,
        const lcb_RESPVIEWQUERY *resp)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Function> jsonParseLcl = Nan::New(CouchbaseImpl::jsonParse);

    if (resp->rflags & LCB_RESP_F_FINAL) {
        Local<Value> dataRes;
        if (resp->rc != LCB_SUCCESS) {
            if (resp->htresp && resp->htresp->body) {
                dataRes = Nan::New<String>((const char*)resp->htresp->body, (int)resp->htresp->nbody).ToLocalChecked();
            } else {
                dataRes = Nan::Null();
            }
        } else {
            Local<Value> metaStr =
                    Nan::New<String>((const char*)resp->value, (int)resp->nvalue).ToLocalChecked();
            dataRes = jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &metaStr);
            Local<Object> metaObj = dataRes->ToObject();
            if (!metaObj.IsEmpty()) {
                metaObj->Delete(Nan::New(CouchbaseImpl::rowsKey));
            }
        }

        Local<Value> args[] = {
                Nan::New<Number>(resp->rc),
                dataRes
        };
        callback->Call(2, args);

        delete callback;
        return;
    }

    Local<Object> rowObj = Nan::New<Object>();

    Handle<Value> keyStr =
            Nan::New<String>((const char*)resp->key, (int)resp->nkey).ToLocalChecked();
    rowObj->Set(Nan::New(CouchbaseImpl::keyKey),
            jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &keyStr));

    if (resp->value) {
        Handle<Value> valueStr =
                Nan::New<String>((const char*)resp->value, (int)resp->nvalue).ToLocalChecked();
        rowObj->Set(Nan::New(CouchbaseImpl::valueKey),
                jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &valueStr));
    } else {
        rowObj->Set(Nan::New(CouchbaseImpl::valueKey), Nan::Null());
    }

    if (resp->geometry) {
        Handle<Value> geometryStr =
                Nan::New<String>((const char*)resp->geometry, (int)resp->ngeometry).ToLocalChecked();
        rowObj->Set(Nan::New(CouchbaseImpl::geometryKey),
                jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &geometryStr));
    }

    if (resp->docid) {
        rowObj->Set(Nan::New(CouchbaseImpl::idKey),
                Nan::New<String>((const char*)resp->docid, (int)resp->ndocid).ToLocalChecked());

        if (resp->docresp) {
            const lcb_RESPGET *rg = resp->docresp;
            if (rg->rc == LCB_SUCCESS) {
                rowObj->Set(Nan::New(CouchbaseImpl::docKey),
                        me->decodeDoc(rg->value, rg->nvalue, rg->itmflags));
            } else {
                rowObj->Set(Nan::New(CouchbaseImpl::docKey), Nan::Null());
            }
        }
    } else {
        rowObj->Set(Nan::New(CouchbaseImpl::idKey), Nan::Null());
    }

    Local<Value> args[] = {
            Nan::New<Number>(-1),
            rowObj
    };
    callback->Call(2, args);
}

void n1qlrow_callback(lcb_t instance, int ignoreme,
        const lcb_RESPN1QL *resp)
{
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Function> jsonParseLcl = Nan::New(CouchbaseImpl::jsonParse);

    if (resp->rflags & LCB_RESP_F_FINAL) {
        Local<Value> dataRes;
        if (resp->rc != LCB_SUCCESS) {
            if (resp->row) {
                dataRes = Nan::New<String>((const char*)resp->row, (int)resp->nrow).ToLocalChecked();
            } else {
                dataRes = Nan::Null();
            }
        } else {
            Handle<Value> metaStr =
                    Nan::New<String>((const char*)resp->row, (int)resp->nrow).ToLocalChecked();
            dataRes = jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &metaStr);
            Local<Object> metaObj = dataRes->ToObject();
            if (!metaObj.IsEmpty()) {
                metaObj->Delete(Nan::New(CouchbaseImpl::resultsKey));
            }
        }

        Local<Value> args[] = {
                Nan::New<Number>(resp->rc),
                dataRes
        };
        callback->Call(2, args);

        delete callback;
        return;
    }

    Handle<Value> rowStr =
            Nan::New<String>((const char*)resp->row, (int)resp->nrow).ToLocalChecked();
    Local<Value> rowObj =
            jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &rowStr);
    Local<Value> args[] = {
            Nan::New<Number>(-1),
            rowObj
    };
    callback->Call(2, args);
}

void ftsrow_callback(lcb_t instance, int ignoreme,
        const lcb_RESPFTS *resp)
{
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Function> jsonParseLcl = Nan::New(CouchbaseImpl::jsonParse);

    if (resp->rflags & LCB_RESP_F_FINAL) {
        Local<Value> dataRes;
        if (resp->rc != LCB_SUCCESS) {
            if (resp->row) {
                dataRes = Nan::New<String>((const char*)resp->row, (int)resp->nrow).ToLocalChecked();
            } else {
                dataRes = Nan::Null();
            }
        } else {
            Handle<Value> metaStr =
                    Nan::New<String>((const char*)resp->row, (int)resp->nrow).ToLocalChecked();
            dataRes = jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &metaStr);
            Local<Object> metaObj = dataRes->ToObject();
            if (!metaObj.IsEmpty()) {
                metaObj->Delete(Nan::New(CouchbaseImpl::resultsKey));
            }
        }

        Local<Value> args[] = {
                Nan::New<Number>(resp->rc),
                dataRes
        };
        callback->Call(2, args);

        delete callback;
        return;
    }

    Handle<Value> rowStr =
            Nan::New<String>((const char*)resp->row, (int)resp->nrow).ToLocalChecked();
    Local<Value> rowObj =
            jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &rowStr);
    Local<Value> args[] = {
            Nan::New<Number>(-1),
            rowObj
    };
    callback->Call(2, args);
}

static void
subdoc_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *respbase)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPSUBDOC *resp = (const lcb_RESPSUBDOC*)respbase;
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;
    std::vector<lcb_SDENTRY> results;
    Local<Array> outArr;
    Local<Object> outObj;
    int errorCount = 0;

    Local<Function> jsonParseLcl = Nan::New(CouchbaseImpl::jsonParse);

    if (resp->rc != LCB_SUCCESS && resp->rc != LCB_SUBDOC_MULTI_FAILURE) {
        Local<Value> errObj = Error::create(resp->rc);
        callback->Call(1, &errObj);
        return;
    }

    {
        lcb_SDENTRY respitem;
        for (size_t iter = 0; lcb_sdresult_next(resp, &respitem, &iter) != 0; ) {
            results.push_back(respitem);
        }
    }

    outObj = Nan::New<Object>();
    outObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));

    // Create an array of the correct size
    outArr = Nan::New<Array>(results.size());
    outObj->Set(Nan::New(me->resultsKey), outArr);

    for (size_t i = 0; i < results.size(); ++i) {
        lcb_SDENTRY respitem = results[i];
        Local<Object> resObj = Nan::New<Object>();

        if (cbtype == LCB_CALLBACK_SDMUTATE) {
            resObj->Set(Nan::New(me->idKey), Nan::New(respitem.index));
        } else {
            resObj->Set(Nan::New(me->idKey), Nan::New((uint8_t)i));
        }

        if (respitem.status != LCB_SUCCESS) {
            errorCount++;

            Local<Value> errObj = Error::create(respitem.status);
            resObj->Set(Nan::New(me->errorKey), errObj);
        } else {
            if (respitem.nvalue > 0) {
                Handle<Value> valueStr =
                        Nan::New<String>((const char*)respitem.value, (int)respitem.nvalue).ToLocalChecked();
                Local<Value> valueObj =
                        jsonParseLcl->Call(Nan::GetCurrentContext()->Global(), 1, &valueStr);
                resObj->Set(Nan::New(me->valueKey), valueObj);
            } else {
                resObj->Set(Nan::New(me->valueKey), Nan::Null());
            }
        }

        outArr->Set(i, resObj);
    }

    Local<Value> args[] = {
            Nan::New<Number>(errorCount),
            outObj};
    callback->Call(2, args);

    delete callback;
}

static void
ping_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *respbase)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPPING *resp = (const lcb_RESPPING*)respbase;
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->valueKey),
          Nan::New<String>((const char*)resp->json, (int)resp->njson).ToLocalChecked());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    Local<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

static void
diag_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *respbase)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPDIAG *resp = (const lcb_RESPDIAG*)respbase;
    Nan::Callback *callback = (Nan::Callback*)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->valueKey),
          Nan::New<String>((const char*)resp->json, (int)resp->njson).ToLocalChecked());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    Local<Value> args[] = { errObj, resVal };
    callback->Call(2, args);

    delete callback;
}

}

void CouchbaseImpl::setupLibcouchbaseCallbacks(void)
{
    lcb_set_bootstrap_callback(instance, bootstrap_callback);

    lcb_install_callback3(instance, LCB_CALLBACK_GET, get_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_GETREPLICA, get_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, store_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_COUNTER, arithmetic_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_REMOVE, remove_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_TOUCH, touch_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_UNLOCK, unlock_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_ENDURE, durability_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_SDLOOKUP, subdoc_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_SDMUTATE, subdoc_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_PING, ping_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_DIAG, diag_callback);
}
