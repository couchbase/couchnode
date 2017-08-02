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
    char tokenBuf[sizeof(lcb_MUTATION_TOKEN) + 256];
    lcb_MUTATION_TOKEN *tokenVal = (lcb_MUTATION_TOKEN*)tokenBuf;
    const char *tokenBucket = &tokenBuf[sizeof(lcb_MUTATION_TOKEN)];
    char tokenStr[24+24+24+3] = "";
    Nan::HandleScope scope;

    MutationToken::GetToken(info.This(), tokenVal,
            sizeof(lcb_MUTATION_TOKEN) + 256);
    sprintf(tokenStr, "%hu:%llu:%llu:%s",
            (unsigned short)LCB_MUTATION_TOKEN_VB(tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_ID(tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_SEQ(tokenVal),
            tokenBucket);
    return info.GetReturnValue().Set(
            Nan::New<String>(tokenStr).ToLocalChecked());
}

NAN_METHOD(MutationToken::fnInspect)
{
    char tokenBuf[sizeof(lcb_MUTATION_TOKEN) + 256];
    lcb_MUTATION_TOKEN *tokenVal = (lcb_MUTATION_TOKEN*)tokenBuf;
    const char *tokenBucket = &tokenBuf[sizeof(lcb_MUTATION_TOKEN)];
    char tokenStr[14+24+24+24+3] = "";
    Nan::HandleScope scope;

    MutationToken::GetToken(info.This(), tokenVal,
            sizeof(lcb_MUTATION_TOKEN) + 256);
    sprintf(tokenStr, "CouchbaseToken<%hu,%llu,%llu,%s>",
            (unsigned short)LCB_MUTATION_TOKEN_VB(tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_ID(tokenVal),
            (unsigned long long int)LCB_MUTATION_TOKEN_SEQ(tokenVal),
            tokenBucket);
    return info.GetReturnValue().Set(
            Nan::New<String>(tokenStr).ToLocalChecked());
}

Handle<Value> MutationToken::CreateToken(lcb_t instance, const lcb_MUTATION_TOKEN *token) {
    if (!LCB_MUTATION_TOKEN_ISVALID(token)) {
        return Nan::Undefined();
    }

    Local<Object> ret =
        Nan::NewInstance(Nan::New<Function>(tokenClass)).ToLocalChecked();

    const char *nameStr;
    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &nameStr);
    uint32_t nameStrLen = strlen(nameStr) + 1;
    char *tokenBuf = new char[sizeof(lcb_MUTATION_TOKEN) + nameStrLen];
    memcpy(tokenBuf, (const char*)token, sizeof(lcb_MUTATION_TOKEN));
    memcpy(&tokenBuf[sizeof(lcb_MUTATION_TOKEN)], nameStr, nameStrLen);

    Local<Value> tokenData =
            Nan::CopyBuffer((const char*)tokenBuf,
                    sizeof(lcb_MUTATION_TOKEN) + nameStrLen).ToLocalChecked();
    ret->Set(0, tokenData);

    delete[] tokenBuf;

    return ret;
}

Handle<Value> MutationToken::CreateToken(lcb_t instance, int cbtype, const lcb_RESPBASE *respbase) {
    return CreateToken(instance, lcb_resp_get_mutation_token(cbtype, respbase));
}

bool _StrToToken(Handle<Value> obj, lcb_MUTATION_TOKEN *p, int pSize) {
    if (sscanf(*Nan::Utf8String(obj->ToString()), "%hu:%llu:%llu",
            (unsigned short*)&LCB_MUTATION_TOKEN_VB(p),
            (unsigned long long int*)&LCB_MUTATION_TOKEN_ID(p),
            (unsigned long long int*)&LCB_MUTATION_TOKEN_SEQ(p)) != 1) {
        return false;
    }
    return true;
}

bool _ObjToToken(Local<Value> obj, lcb_MUTATION_TOKEN *p, int pSize) {
    Local<Object> realObj = obj.As<Object>();
    Local<Value> tokenData = realObj->Get(0);

    if (!node::Buffer::HasInstance(tokenData)) {
        return false;
    }

    if (node::Buffer::Length(tokenData) < sizeof(lcb_MUTATION_TOKEN)) {
        return false;
    }

    if (pSize > (int)node::Buffer::Length(tokenData)) {
        pSize = node::Buffer::Length(tokenData);
    }
    memcpy(p, node::Buffer::Data(tokenData), pSize);

    return true;
}

bool MutationToken::GetToken(Local<Value> obj, lcb_MUTATION_TOKEN *p, int pSize) {
    Nan::HandleScope scope;
    if (pSize == 0) {
        pSize = sizeof(lcb_MUTATION_TOKEN);
    }
    memset(p, 0, pSize);
    if (obj->IsObject()) {
        return _ObjToToken(obj, p, pSize);
    } else if (obj->IsString()) {
        return _StrToToken(obj, p, pSize);
    } else {
        return false;
    }
}
