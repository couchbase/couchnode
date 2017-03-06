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
    Nan::HandleScope scope;

    Local<FunctionTemplate> t = Nan::New<FunctionTemplate>();
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
    Nan::HandleScope scope;

    Cas::GetCas(info.This(), &casVal);
    sprintf(casStr, "%llu", (unsigned long long int)casVal);
    return info.GetReturnValue().Set(
            Nan::New<String>(casStr).ToLocalChecked());
}

NAN_METHOD(Cas::fnInspect)
{
    uint64_t casVal = 0;
    char casStr[14+24] = "";
    Nan::HandleScope scope;

    Cas::GetCas(info.This(), &casVal);
    sprintf(casStr, "CouchbaseCas<%llu>", (unsigned long long int)casVal);
    return info.GetReturnValue().Set(
            Nan::New<String>(casStr).ToLocalChecked());
}

Handle<Value> Cas::CreateCas(uint64_t cas) {
    Local<Object> ret =
        Nan::NewInstance(Nan::New<Function>(casClass)).ToLocalChecked();

    Local<Value> casData =
            Nan::CopyBuffer((char*)&cas, sizeof(uint64_t)).ToLocalChecked();
    ret->Set(0, casData);

    return ret;
}

bool _StrToCas(Handle<Value> obj, uint64_t *p) {
    if (sscanf(*Nan::Utf8String(obj->ToString()), "%llu",
            (unsigned long long int*)p) != 1) {
        return false;
    }
    return true;
}

bool _ObjToCas(Local<Value> obj, uint64_t *p) {
    Local<Object> realObj = obj.As<Object>();
    Local<Value> casData = realObj->Get(0);

    if (!node::Buffer::HasInstance(casData)) {
        return false;
    }

    if (node::Buffer::Length(casData) != sizeof(uint64_t)) {
        return false;
    }

    *p = *(uint64_t*)node::Buffer::Data(casData);

    return true;
}

bool Cas::GetCas(Local<Value> obj, uint64_t *p) {
    Nan::HandleScope scope;
    *p = 0;
    if (obj->IsObject()) {
        return _ObjToCas(obj, p);
    } else if (obj->IsString()) {
        return _StrToCas(obj, p);
    } else {
        return false;
    }
}
