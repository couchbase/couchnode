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
#ifndef COUCHBASE_H
#define COUCHBASE_H 1

#ifdef _MSC_VER
#pragma warning(disable : 4244)
#pragma warning(disable : 4267)
#pragma warning(disable : 4506)
#pragma warning(disable : 4530)
#endif

#ifndef BUILDING_NODE_EXTENSION
#define BUILDING_NODE_EXTENSION
#endif

// Unfortunately the v8 header spits out a lot of warnings..
// let's disable them..
#if __GNUC__
#if __GNUC__ >= 4 && __GNUC_MINOR__ >= 6
#pragma GCC diagnostic ignored "-Wunused-parameter"
#endif
#endif

#include <node.h>
#include "nan.h"

#if __GNUC__
#if __GNUC__ >= 4 && __GNUC_MINOR__ >= 6
#pragma GCC diagnostic pop
#endif
#endif

#include <iostream>
#include <map>
#include <string>
#include <vector>
#include <queue>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <libcouchbase/views.h>
#include <libcouchbase/n1ql.h>
#include <libcouchbase/cbft.h>

#include "cas.h"
#include "token.h"
#include "exception.h"
#include "cmdencoder.h"
#include "transcoder.h"

#if LCB_VERSION < 0x020503
#error "Couchnode requires libcouchbase >= 2.5.3"
#endif

namespace Couchnode
{
using v8::Value;
using v8::Handle;
using v8::Local;
using v8::Persistent;
using v8::Function;
using v8::HandleScope;
using v8::String;
using v8::Number;
using v8::Object;
using v8::Integer;
using v8::FunctionTemplate;
using v8::Uint32;
using v8::Array;
using v8::Exception;

// These codes *should* be in lcb_cntl, but currently aren't.
enum ControlCode {
    _BEGIN = 0x1000,
    CNTL_COUCHNODE_VERSION = 0x1001,
    CNTL_LIBCOUCHBASE_VERSION = 0x1002,
    CNTL_CLNODES = 0x1003,
    CNTL_RESTURI = 0x1004
};

class CouchbaseImpl: public Nan::ObjectWrap
{
public:
    // Methods called directly from JavaScript
    static NAN_MODULE_INIT(Init);

    static Handle<Object> createConstants();

    static NAN_METHOD(sfnSetErrorClass);

    static NAN_METHOD(fnNew);

    static NAN_METHOD(fnConnect);
    static NAN_METHOD(fnShutdown);

    static NAN_METHOD(fnSetConnectCallback);
    static NAN_METHOD(fnSetTranscoder);
    static NAN_METHOD(fnLcbVersion);
    static NAN_METHOD(fnControl);
    static NAN_METHOD(fnGetViewNode);
    static NAN_METHOD(fnGetMgmtNode);
    static NAN_METHOD(fnInvalidateQueryCache);
    static NAN_METHOD(fnErrorTest);

    static NAN_METHOD(fnGet);
    static NAN_METHOD(fnGetReplica);
    static NAN_METHOD(fnTouch);
    static NAN_METHOD(fnUnlock);
    static NAN_METHOD(fnRemove);
    static NAN_METHOD(fnStore);
    static NAN_METHOD(fnArithmetic);
    static NAN_METHOD(fnDurability);
    static NAN_METHOD(fnViewQuery);
    static NAN_METHOD(fnN1qlQuery);
    static NAN_METHOD(fnFtsQuery);
    static NAN_METHOD(fnLookupIn);
    static NAN_METHOD(fnMutateIn);
    static NAN_METHOD(fnPing);
    static NAN_METHOD(fnDiag);

public:
    CouchbaseImpl(lcb_t inst);
    virtual ~CouchbaseImpl();

    void onConnect(lcb_error_t err);
    void onShutdown();

    lcb_t getLcbHandle(void) const {
        return instance;
    }


    Handle<Value> decodeDoc(const void *bytes, size_t nbytes, lcb_U32 flags);
    bool encodeDoc(CommandEncoder& enc, const void **,
            lcb_SIZE *nbytes, lcb_U32 *flags, Local<Value> value);

protected:
    lcb_t instance;
    uv_prepare_t flushWatch;

    void setupLibcouchbaseCallbacks(void);

    Nan::Callback *connectCallback;
    Nan::Callback *transEncodeFunc;
    Nan::Callback *transDecodeFunc;

public:
    static Nan::Persistent<Function> jsonParse;
    static Nan::Persistent<Function> jsonStringify;
    static Nan::Persistent<String> valueKey;
    static Nan::Persistent<String> casKey;
    static Nan::Persistent<String> flagsKey;
    static Nan::Persistent<String> datatypeKey;
    static Nan::Persistent<String> idKey;
    static Nan::Persistent<String> keyKey;
    static Nan::Persistent<String> docKey;
    static Nan::Persistent<String> geometryKey;
    static Nan::Persistent<String> rowsKey;
    static Nan::Persistent<String> resultsKey;
    static Nan::Persistent<String> tokenKey;
    static Nan::Persistent<String> errorKey;

};

} // namespace Couchnode

extern "C" {
void viewrow_callback(lcb_t instance, int ignoreme,
        const lcb_RESPVIEWQUERY *resp);
void n1qlrow_callback(lcb_t instance, int ignoreme,
        const lcb_RESPN1QL *resp);
void ftsrow_callback(lcb_t instance, int ignoreme,
        const lcb_RESPFTS *resp);
}

#endif
