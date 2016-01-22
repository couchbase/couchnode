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

void MutationToken::Init() {
    Nan::HandleScope scope;

    Local<FunctionTemplate> t = Nan::New<FunctionTemplate>();
    t->SetClassName(Nan::New<String>("CouchbaseToken").ToLocalChecked());

    Nan::SetPrototypeMethod(t, "toString", fnToString);
    Nan::SetPrototypeMethod(t, "toJSON", fnToString);
    Nan::SetPrototypeMethod(t, "inspect", fnInspect);

    tokenClass.Reset(t->GetFunction());
}

NAN_METHOD(MutationToken::fnToString)
{
    lcb_MUTATION_TOKEN tokenVal;
    char tokenStr[24+24+24+3] = "";
    Nan::HandleScope scope;

    memset(&tokenVal, 0, sizeof(lcb_MUTATION_TOKEN));
    MutationToken::GetToken(info.This(), &tokenVal);
    sprintf(tokenStr, "%hu:%llu:%llu",
            (unsigned short)LCB_MUTATION_TOKEN_VB(&tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_ID(&tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_SEQ(&tokenVal));
    return info.GetReturnValue().Set(
            Nan::New<String>(tokenStr).ToLocalChecked());
}

NAN_METHOD(MutationToken::fnInspect)
{
    lcb_MUTATION_TOKEN tokenVal;
    char tokenStr[14+24+24+24+3] = "";
    Nan::HandleScope scope;

    memset(&tokenVal, 0, sizeof(lcb_MUTATION_TOKEN));
    MutationToken::GetToken(info.This(), &tokenVal);
    sprintf(tokenStr, "CouchbaseToken<%hu,%llu,%llu>",
            (unsigned short)LCB_MUTATION_TOKEN_VB(&tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_ID(&tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_SEQ(&tokenVal));
    return info.GetReturnValue().Set(
            Nan::New<String>(tokenStr).ToLocalChecked());
}

Handle<Value> MutationToken::CreateToken(const lcb_MUTATION_TOKEN *token) {
    if (!LCB_MUTATION_TOKEN_ISVALID(token)) {
        return Nan::Undefined();
    }

    Local<Object> ret = Nan::New<Function>(tokenClass)->NewInstance();

    Local<Value> tokenData =
            Nan::CopyBuffer((const char*)token,
                    sizeof(lcb_MUTATION_TOKEN)).ToLocalChecked();
    ret->Set(0, tokenData);

    return ret;
}

bool _StrToToken(Handle<Value> obj, lcb_MUTATION_TOKEN *p) {
    if (sscanf(*Nan::Utf8String(obj->ToString()), "%hu:%llu:%llu",
            (unsigned short*)&LCB_MUTATION_TOKEN_VB(p),
            (unsigned long long int*)&LCB_MUTATION_TOKEN_ID(p),
            (unsigned long long int*)&LCB_MUTATION_TOKEN_SEQ(p)) != 1) {
        return false;
    }
    return true;
}

bool _ObjToToken(Local<Value> obj, lcb_MUTATION_TOKEN *p) {
    Local<Object> realObj = obj.As<Object>();
    Local<Value> tokenData = realObj->Get(0);

    if (!node::Buffer::HasInstance(tokenData)) {
        return false;
    }

    if (node::Buffer::Length(tokenData) != sizeof(lcb_MUTATION_TOKEN)) {
        return false;
    }

    *p = *(lcb_MUTATION_TOKEN*)node::Buffer::Data(tokenData);

    return true;
}

bool MutationToken::GetToken(Local<Value> obj, lcb_MUTATION_TOKEN *p) {
    Nan::HandleScope scope;
    memset(p, 0, sizeof(lcb_MUTATION_TOKEN));
    if (obj->IsObject()) {
        return _ObjToToken(obj, p);
    } else if (obj->IsString()) {
        return _StrToToken(obj, p);
    } else {
        return false;
    }
}
