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
    NanScope();

    Local<FunctionTemplate> t = NanNew<FunctionTemplate>();
    t->InstanceTemplate()->SetInternalFieldCount(1);
    t->SetClassName(NanNew<String>("CouchbaseCas"));

    NODE_SET_PROTOTYPE_METHOD(t, "toString", fnToString);
    NODE_SET_PROTOTYPE_METHOD(t, "toJSON", fnToString);
    NODE_SET_PROTOTYPE_METHOD(t, "inspect", fnInspect);

    NanAssignPersistent(casClass, t->GetFunction());
}

NAN_METHOD(Cas::fnToString)
{
    uint64_t casVal = 0;
    char casStr[24] = "";
    NanScope();

    Cas::GetCas(args.This(), &casVal);
    sprintf(casStr, "%llu", casVal);
    NanReturnValue(NanNew<String>(casStr));
}

NAN_METHOD(Cas::fnInspect)
{
    uint64_t casVal = 0;
    char casStr[14+24] = "";
    NanScope();

    Cas::GetCas(args.This(), &casVal);
    sprintf(casStr, "CouchbaseCas<%llu>", casVal);
    NanReturnValue(NanNew<String>(casStr));
}

NAN_WEAK_CALLBACK(casDtor) {
    uint64_t *value = data.GetParameter();
    delete value;
}

Handle<Value> Cas::CreateCas(uint64_t cas) {
    Local<Object> ret = NanNew<Function>(casClass)->NewInstance();
    uint64_t *p = new uint64_t(cas);
    ret->SetIndexedPropertiesToExternalArrayData(
        p, v8::kExternalUnsignedIntArray, 2);
    NanMakeWeakPersistent(ret, p, casDtor);
    return ret;
}

bool _StrToCas(Handle<Value> obj, uint64_t *p) {
    if (sscanf(*NanUtf8String(obj->ToString()), "%llu", p) != 1) {
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
    NanScope();
    if (obj->IsObject()) {
        return _ObjToCas(obj, p);
    } else if (obj->IsString()) {
        return _StrToCas(obj, p);
    } else {
        return false;
    }
}
