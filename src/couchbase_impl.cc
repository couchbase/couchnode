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
#include "exception.h"
#include "opbuilder.h"
#include "token.h"
#include "transcoder.h"
#include <libcouchbase/libuv_io_opts.h>

using namespace std;
using namespace Couchnode;

#ifdef UV_VERSION_MAJOR
#ifndef UV_VERSION_PATCH
#define UV_VERSION_PATCH 0
#endif
#define NAUV_UVVERSION                                                         \
    ((UV_VERSION_MAJOR << 16) | (UV_VERSION_MINOR << 8) | (UV_VERSION_PATCH))
#else
#define NAUV_UVVERSION 0x000b00
#endif

#if NAUV_UVVERSION < 0x000b00
#define NAUV_PREPARE_CB(func) void func(uv_prepare_t *handle, int)
#else
#define NAUV_PREPARE_CB(func) void func(uv_prepare_t *handle)
#endif

Local<String> lcbNanToString(const void *value, lcb_U32 nvalue)
{
    return Nan::New<String>((const char *)value, (int)nvalue).ToLocalChecked();
}

Local<Value> lcbNanParseJson(const void *value, lcb_U32 nvalue)
{
    Local<String> lclString = lcbNanToString(value, nvalue);
    Nan::MaybeLocal<Value> lclValue = Nan::JSON{}.Parse(lclString);
    if (lclValue.IsEmpty()) {
        return Nan::New<Object>();
    }

    return lclValue.ToLocalChecked();
}

void cbNanMaybeDeleteProp(Local<Value> value, Local<String> propName)
{
    Nan::MaybeLocal<Object> valueObj = Nan::To<Object>(value);
    if (!valueObj.IsEmpty()) {
        Nan::Delete(valueObj.ToLocalChecked(), propName);
    }
}

NAUV_PREPARE_CB(lcbuv_flush)
{
    CouchbaseImpl *me = reinterpret_cast<CouchbaseImpl *>(handle->data);
    lcb_sched_flush(me->getLcbHandle());
}

CouchbaseImpl::CouchbaseImpl(lcb_t inst)
    : ObjectWrap()
    , instance(inst)
    , clientStringCache(NULL)
    , logger(NULL)
    , connectContext(NULL)
    , connectCallback(NULL)
    , transEncodeFunc(NULL)
    , transDecodeFunc(NULL)
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
    if (logger) {
        delete logger;
        logger = NULL;
    }
}

extern "C" {
static void bootstrap_callback_empty(lcb_t, lcb_error_t)
{
}
}
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
        lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_SCHED_IMPLICIT_FLUSH,
                 &flushMode);
    }

    Nan::HandleScope scope;
    if (connectCallback) {
        Local<Value> args[] = {Error::create(err)};
        connectCallback->Call(1, args, connectContext);
    }
}

void CouchbaseImpl::onShutdown()
{
    uv_prepare_stop(&flushWatch);
}

const char *CouchbaseImpl::getClientString()
{
    // Check to see if our cache is already populated
    if (clientStringCache) {
        return clientStringCache;
    }

    // Fetch from libcouchbase if we are not populated
    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_CLIENT_STRING,
             &clientStringCache);
    if (clientStringCache) {
        return clientStringCache;
    }

    // Backup string in case something goes wrong
    return "couchbase-nodejs-sdk";
};

Handle<Value> CouchbaseImpl::decodeDoc(const void *bytes, size_t nbytes,
                                       lcb_U32 flags,
                                       Nan::AsyncResource *asyncContext)
{
    if (transDecodeFunc) {
        Local<Object> decObj = Nan::New<Object>();
        decObj->Set(Nan::New(valueKey),
                    Nan::CopyBuffer((char *)bytes, nbytes).ToLocalChecked());
        decObj->Set(Nan::New(flagsKey), Nan::New<Integer>(flags));
        Local<Value> args[] = {decObj};
        return transDecodeFunc->Call(1, args, asyncContext).ToLocalChecked();
    }

    return DefaultTranscoder::decode(bytes, nbytes, flags);
}

bool CouchbaseImpl::encodeDoc(ValueParser &venc, const void **bytes,
                              lcb_SIZE *nbytes, lcb_U32 *flags,
                              Local<Value> value)
{
    // There must never be a NanScope here, the system relies on the fact
    //   that the scope will exist until the lcb_cmd_XXX_t object has been
    //   passed to LCB already.
    if (transEncodeFunc) {
        Local<Value> args[] = {value};
        Nan::TryCatch tryCatch;
        Nan::MaybeLocal<Value> mres =
            Nan::CallAsFunction(transEncodeFunc->GetFunction(),
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
                        *flags = flagsObj->Uint32Value(Nan::GetCurrentContext())
                                     .FromMaybe(0);

                        return true;
                    }
                }
            }
        }
    }
    DefaultTranscoder::encode(venc, bytes, nbytes, flags, value);
    return true;
}

void _DispatchValueCallback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *respbase)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPGET *resp = (const lcb_RESPGET *)respbase;
    OpCookie *cookie = (OpCookie *)resp->cookie;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Value> resData;
        {
            ScopedTraceSpan decSpan = cookie->startDecodeTrace();
            resData = me->decodeDoc(resp->value, resp->nvalue, resp->itmflags,
                                    cookie->asyncContext());
        }

        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resObj->Set(Nan::New(me->valueKey), resData);
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    cookie->endTrace();

    Local<Value> args[] = {errObj, resVal};
    cookie->invokeCallback(2, args);

    delete cookie;
}

void _DispatchArithCallback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *respbase)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPCOUNTER *resp = (const lcb_RESPCOUNTER *)respbase;
    OpCookie *cookie = (OpCookie *)resp->cookie;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resObj->Set(Nan::New(me->tokenKey),
                    MutationToken::CreateToken(instance, cbtype, respbase));
        resObj->Set(Nan::New(me->valueKey), Nan::New<Number>(resp->value));
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    cookie->endTrace();

    Local<Value> args[] = {errObj, resVal};
    cookie->invokeCallback(2, args);

    delete cookie;
}

void _DispatchBasicCallback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *resp)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    OpCookie *cookie = (OpCookie *)resp->cookie;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    cookie->endTrace();

    Local<Value> args[] = {errObj, resVal};
    cookie->invokeCallback(2, args);

    delete cookie;
}

void _DispatchStoreCallback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *resp)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    OpCookie *cookie = (OpCookie *)resp->cookie;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->casKey), Cas::CreateCas(resp->cas));
        resObj->Set(Nan::New(me->tokenKey),
                    MutationToken::CreateToken(instance, cbtype, resp));
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    cookie->endTrace();

    Local<Value> args[] = {errObj, resVal};
    cookie->invokeCallback(2, args);

    delete cookie;
}

void _DispatchErrorCallback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *resp)
{
    Nan::HandleScope scope;
    OpCookie *cookie = (OpCookie *)resp->cookie;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal = Nan::Null();

    cookie->endTrace();

    Local<Value> args[] = {errObj, resVal};
    cookie->invokeCallback(2, args);

    delete cookie;
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

static void arithmetic_callback(lcb_t instance, int cbtype,
                                const lcb_RESPBASE *resp)
{
    _DispatchArithCallback(instance, cbtype, resp);
}

static void remove_callback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *resp)
{
    _DispatchStoreCallback(instance, cbtype, resp);
}

static void touch_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *resp)
{
    _DispatchBasicCallback(instance, cbtype, resp);
}

static void unlock_callback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *resp)
{
    _DispatchErrorCallback(instance, cbtype, resp);
}

static void durability_callback(lcb_t instance, int cbtype,
                                const lcb_RESPBASE *resp)
{
    _DispatchErrorCallback(instance, cbtype, resp);
}

void viewrow_callback(lcb_t instance, int ignoreme,
                      const lcb_RESPVIEWQUERY *resp)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    OpCookie *cookie = (OpCookie *)resp->cookie;

    if (resp->rflags & LCB_RESP_F_FINAL) {
        Local<Value> dataRes;
        if (resp->rc != LCB_SUCCESS) {
            if (resp->htresp && resp->htresp->body) {
                dataRes =
                    lcbNanToString(resp->htresp->body, resp->htresp->nbody);
            } else {
                dataRes = Nan::Null();
            }
        } else {
            dataRes = lcbNanParseJson(resp->value, resp->nvalue);
            cbNanMaybeDeleteProp(dataRes, Nan::New(CouchbaseImpl::rowsKey));
        }

        cookie->endTrace();

        Local<Value> args[] = {Nan::New<Number>(resp->rc), dataRes};
        cookie->invokeCallback(2, args);

        delete cookie;
        return;
    }

    Local<Object> rowObj = Nan::New<Object>();
    rowObj->Set(Nan::New(CouchbaseImpl::keyKey),
                lcbNanParseJson(resp->key, resp->nkey));

    if (resp->value) {
        rowObj->Set(Nan::New(CouchbaseImpl::valueKey),
                    lcbNanParseJson(resp->value, resp->nvalue));
    } else {
        rowObj->Set(Nan::New(CouchbaseImpl::valueKey), Nan::Null());
    }

    if (resp->geometry) {
        rowObj->Set(Nan::New(CouchbaseImpl::geometryKey),
                    lcbNanParseJson(resp->geometry, resp->ngeometry));
    }

    if (resp->docid) {
        rowObj->Set(Nan::New(CouchbaseImpl::idKey),
                    lcbNanToString(resp->docid, resp->ndocid));

        if (resp->docresp) {
            const lcb_RESPGET *rg = resp->docresp;
            if (rg->rc == LCB_SUCCESS) {
                Local<Value> rowVal =
                    me->decodeDoc(rg->value, rg->nvalue, rg->itmflags,
                                  cookie->asyncContext());
                rowObj->Set(Nan::New(CouchbaseImpl::docKey), rowVal);
            } else {
                rowObj->Set(Nan::New(CouchbaseImpl::docKey), Nan::Null());
            }
        }
    } else {
        rowObj->Set(Nan::New(CouchbaseImpl::idKey), Nan::Null());
    }

    Local<Value> args[] = {Nan::New<Number>(-1), rowObj};
    cookie->invokeCallback(2, args);
}

void cbasn1qlrow_callback(lcb_t instance, int ignoreme,
                          const lcb_RESPN1QL *resp)
{
    Nan::HandleScope scope;
    OpCookie *cookie = (OpCookie *)resp->cookie;

    if (resp->rflags & LCB_RESP_F_FINAL) {
        Local<Value> dataRes;
        if (resp->rc != LCB_SUCCESS) {
            if (resp->row) {
                dataRes = lcbNanToString(resp->row, resp->nrow);
            } else {
                dataRes = Nan::Null();
            }
        } else {
            dataRes = lcbNanParseJson(resp->row, resp->nrow);
            cbNanMaybeDeleteProp(dataRes, Nan::New(CouchbaseImpl::resultsKey));
        }

        cookie->endTrace();

        Local<Value> args[] = {Nan::New<Number>(resp->rc), dataRes};
        cookie->invokeCallback(2, args);

        delete cookie;
        return;
    }

    Local<Value> rowObj = lcbNanParseJson(resp->row, resp->nrow);

    Local<Value> args[] = {Nan::New<Number>(-1), rowObj};
    cookie->invokeCallback(2, args);
}

void n1qlrow_callback(lcb_t instance, int ignoreme, const lcb_RESPN1QL *resp)
{
    cbasn1qlrow_callback(instance, ignoreme, resp);
}

void cbasrow_callback(lcb_t instance, int ignoreme, const lcb_RESPN1QL *resp)
{
    cbasn1qlrow_callback(instance, ignoreme, resp);
}

void ftsrow_callback(lcb_t instance, int ignoreme, const lcb_RESPFTS *resp)
{
    Nan::HandleScope scope;
    OpCookie *cookie = (OpCookie *)resp->cookie;

    if (resp->rflags & LCB_RESP_F_FINAL) {
        Local<Value> dataRes;
        if (resp->rc != LCB_SUCCESS) {
            if (resp->row) {
                dataRes = lcbNanToString(resp->row, resp->nrow);
            } else {
                dataRes = Nan::Null();
            }
        } else {
            dataRes = lcbNanParseJson(resp->row, resp->nrow);
            cbNanMaybeDeleteProp(dataRes, Nan::New(CouchbaseImpl::resultsKey));
        }

        cookie->endTrace();

        Local<Value> args[] = {Nan::New<Number>(resp->rc), dataRes};
        cookie->invokeCallback(2, args);

        delete cookie;
        return;
    }

    Local<Value> rowObj = lcbNanParseJson(resp->row, resp->nrow);

    Local<Value> args[] = {Nan::New<Number>(-1), rowObj};
    cookie->invokeCallback(2, args);
}

static void subdoc_callback(lcb_t instance, int cbtype,
                            const lcb_RESPBASE *respbase)
{
    Nan::HandleScope scope;
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPSUBDOC *resp = (const lcb_RESPSUBDOC *)respbase;
    OpCookie *cookie = (OpCookie *)resp->cookie;
    std::vector<lcb_SDENTRY> results;
    Local<Array> outArr;
    Local<Object> outObj;
    int errorCount = 0;

    if (resp->rc != LCB_SUCCESS && resp->rc != LCB_SUBDOC_MULTI_FAILURE) {
        Local<Value> errObj = Error::create(resp->rc);
        cookie->invokeCallback(1, &errObj);
        return;
    }

    {
        lcb_SDENTRY respitem;
        for (size_t iter = 0; lcb_sdresult_next(resp, &respitem, &iter) != 0;) {
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
                Local<Value> valueObj =
                    lcbNanParseJson(respitem.value, respitem.nvalue);
                resObj->Set(Nan::New(me->valueKey), valueObj);
            } else {
                resObj->Set(Nan::New(me->valueKey), Nan::Null());
            }
        }

        outArr->Set(i, resObj);
    }

    cookie->endTrace();

    Local<Value> args[] = {Nan::New<Number>(errorCount), outObj};
    cookie->invokeCallback(2, args);

    delete cookie;
}

static void ping_callback(lcb_t instance, int cbtype,
                          const lcb_RESPBASE *respbase)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPPING *resp = (const lcb_RESPPING *)respbase;
    OpCookie *cookie = (OpCookie *)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->valueKey),
                    Nan::New<String>((const char *)resp->json, (int)resp->njson)
                        .ToLocalChecked());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    cookie->endTrace();

    Local<Value> args[] = {errObj, resVal};
    cookie->invokeCallback(2, args);

    delete cookie;
}

static void diag_callback(lcb_t instance, int cbtype,
                          const lcb_RESPBASE *respbase)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPDIAG *resp = (const lcb_RESPDIAG *)respbase;
    OpCookie *cookie = (OpCookie *)resp->cookie;
    Nan::HandleScope scope;

    Local<Value> errObj = Error::create(resp->rc);
    Local<Value> resVal;
    if (!resp->rc) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New(me->valueKey),
                    Nan::New<String>((const char *)resp->json, (int)resp->njson)
                        .ToLocalChecked());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    cookie->endTrace();

    Local<Value> args[] = {errObj, resVal};
    cookie->invokeCallback(2, args);

    delete cookie;
}

static void httpdata_callback(lcb_t instance, int ignoreme,
                              const lcb_RESPBASE *respbase)
{
    CouchbaseImpl *me = (CouchbaseImpl *)lcb_get_cookie(instance);
    const lcb_RESPHTTP *resp = (const lcb_RESPHTTP *)respbase;
    OpCookie *cookie = (OpCookie *)resp->cookie;
    Nan::HandleScope scope;

    if (resp->rflags & LCB_RESP_F_FINAL) {
        Local<Object> metaObj = Nan::New<Object>();
        metaObj->Set(Nan::New(me->statusCodeKey),
                     Nan::New<Number>(resp->htstatus));

        cookie->endTrace();

        Local<Value> args[] = {
            Nan::New<Number>(resp->rc),
            metaObj,
        };
        cookie->invokeCallback(2, args);

        delete cookie;
        return;
    }

    Local<Value> bodyData =
        Nan::New<String>((const char *)resp->body, (int)resp->nbody)
            .ToLocalChecked();

    Local<Value> args[] = {Nan::New<Number>(-1), bodyData};
    cookie->invokeCallback(2, args);
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
    lcb_install_callback3(instance, LCB_CALLBACK_HTTP, httpdata_callback);
}
