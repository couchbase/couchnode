/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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
#include <sstream>
#include <stdlib.h>
using namespace Couchnode;

void Cas::Init() {
    Nan::HandleScope();

    Local<FunctionTemplate> t = Nan::New<FunctionTemplate>();
    t->InstanceTemplate()->SetInternalFieldCount(1);
    t->SetClassName(Nan::New<String>("CouchbaseCas").ToLocalChecked());

    Nan::SetPrototypeMethod(t, "toString", fnToString);
    Nan::SetPrototypeMethod(t, "toJSON", fnToString);
    Nan::SetPrototypeMethod(t, "inspect", fnInspect);

    casClass.Reset(t->GetFunction());
}

NAN_METHOD(Cas::fnToString)
{
    uint64_t casVal = 0;
    char casStr[24] = "";
    Nan::HandleScope();

    Cas::GetCas(info.This(), &casVal);
    sprintf(casStr, "%llu", casVal);
    return info.GetReturnValue().Set(
            Nan::New<String>(casStr).ToLocalChecked());
}

NAN_METHOD(Cas::fnInspect)
{
    uint64_t casVal = 0;
    char casStr[14+24] = "";
    Nan::HandleScope();

    Cas::GetCas(info.This(), &casVal);
    sprintf(casStr, "CouchbaseCas<%llu>", casVal);
    return info.GetReturnValue().Set(
            Nan::New<String>(casStr).ToLocalChecked());
}

void casDtor(const Nan::WeakCallbackInfo<int> &data) {
    uint64_t *value = reinterpret_cast<uint64_t*>(data.GetParameter());
    delete value;
}

Handle<Value> Cas::CreateCas(uint64_t cas) {
    Local<Object> ret = Nan::New<Function>(casClass)->NewInstance();
    uint64_t *p = new uint64_t(cas);

    ret->SetIndexedPropertiesToExternalArrayData(
        p, v8::kExternalUnsignedIntArray, 2);

    Nan::Persistent<v8::Object> persistent(ret);
    persistent.SetWeak(reinterpret_cast<int*>(p), casDtor,
        Nan::WeakCallbackType::kInternalFields);

    return ret;
}

bool _StrToCas(Handle<Value> obj, uint64_t *p) {
    if (sscanf(*Nan::Utf8String(obj->ToString()), "%llu", p) != 1) {
        return false;
    }
    return true;
}

bool _ObjToCas(Handle<Value> obj, uint64_t *p) {
    Handle<Object> realObj = obj.As<Object>();
    if (realObj->GetIndexedPropertiesExternalArrayDataLength() != 2) {
        return false;
    }
    *p = *(uint64_t*)realObj->GetIndexedPropertiesExternalArrayData();
    return true;
}

bool Cas::GetCas(Handle<Value> obj, uint64_t *p) {
    Nan::HandleScope();
    if (obj->IsObject()) {
        return _ObjToCas(obj, p);
    } else if (obj->IsString()) {
        return _StrToCas(obj, p);
    } else {
        return false;
    }
}
