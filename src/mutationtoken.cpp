#include "mutationtoken.h"

namespace couchnode
{

struct TokenData {
    lcb_MUTATION_TOKEN token;
    char bucketName[256];
};

NAN_MODULE_INIT(MutationToken::Init)
{
    Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>();
    tpl->SetClassName(Nan::New<String>("CbMutationToken").ToLocalChecked());

    Nan::SetPrototypeMethod(tpl, "toString", fnToString);
    Nan::SetPrototypeMethod(tpl, "toJSON", fnToString);
    Nan::SetPrototypeMethod(tpl, "inspect", fnInspect);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());
}

NAN_METHOD(MutationToken::fnToString)
{
    Nan::HandleScope scope;
    lcb_MUTATION_TOKEN token;
    char bucketName[256];
    char tokenStr[1024];

    MutationToken::parse(info.This(), &token, bucketName);
    sprintf(tokenStr, "%hu:%llu:%llu:%s", token.vbid_, token.uuid_,
            token.seqno_, bucketName);
    return info.GetReturnValue().Set(
        Nan::New<String>(tokenStr).ToLocalChecked());
}

NAN_METHOD(MutationToken::fnInspect)
{
    Nan::HandleScope scope;
    lcb_MUTATION_TOKEN token;
    char bucketName[256];
    char tokenStr[1024];

    MutationToken::parse(info.This(), &token, bucketName);
    sprintf(tokenStr, "CbMutationToken<%hu:%llu:%llu:%s>", token.vbid_,
            token.uuid_, token.seqno_, bucketName);
    return info.GetReturnValue().Set(
        Nan::New<String>(tokenStr).ToLocalChecked());
}

v8::Local<v8::Value> MutationToken::create(lcb_MUTATION_TOKEN token,
                                           const char *bucketName)
{
    if (!lcb_mutation_token_is_valid(&token) || !bucketName) {
        return Nan::Undefined();
    }

    Local<Object> ret =
        Nan::NewInstance(Nan::New<Function>(constructor())).ToLocalChecked();

    TokenData tokenData;
    tokenData.token = token;
    strcpy(tokenData.bucketName, bucketName);

    Local<Value> tokenBuf =
        Nan::CopyBuffer(reinterpret_cast<const char *>(&tokenData),
                        sizeof(TokenData))
            .ToLocalChecked();
    Nan::Set(ret, 0, tokenBuf);

    return ret;
}

bool _StrToToken(Local<Value> obj, lcb_MUTATION_TOKEN *token, char *bucketName)
{
    if (sscanf(*Nan::Utf8String(
                   obj->ToString(Nan::GetCurrentContext()).ToLocalChecked()),
               "%hu:%llu:%llu:%s", &token->vbid_, &token->uuid_, &token->seqno_,
               bucketName) != 1) {
        return false;
    }
    return true;
}

bool _ObjToToken(Local<Value> obj, lcb_MUTATION_TOKEN *token, char *bucketName)
{
    Local<Object> realObj = obj.As<Object>();
    Local<Value> tokenBuf = Nan::Get(realObj, 0).ToLocalChecked();

    if (!node::Buffer::HasInstance(tokenBuf)) {
        return false;
    }

    if (node::Buffer::Length(tokenBuf) != sizeof(TokenData)) {
        return false;
    }

    const TokenData *tokenData =
        reinterpret_cast<const TokenData *>(node::Buffer::Data(tokenBuf));

    memcpy(token, &tokenData->token, sizeof(lcb_MUTATION_TOKEN));
    strcpy(bucketName, tokenData->bucketName);

    return true;
}

bool MutationToken::parse(Local<Value> obj, lcb_MUTATION_TOKEN *token,
                          char *bucketName)
{
    Nan::HandleScope scope;

    memset(token, 0, sizeof(lcb_MUTATION_TOKEN));
    if (obj->IsObject()) {
        return _ObjToToken(obj, token, bucketName);
    } else if (obj->IsString()) {
        return _StrToToken(obj, token, bucketName);
    } else {
        return false;
    }
}

} // namespace couchnode
