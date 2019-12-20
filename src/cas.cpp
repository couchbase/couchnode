#include "cas.h"

namespace couchnode
{

NAN_MODULE_INIT(Cas::Init)
{
    Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>();
    tpl->SetClassName(Nan::New<String>("CbCas").ToLocalChecked());

    Nan::SetPrototypeMethod(tpl, "toString", fnToString);
    Nan::SetPrototypeMethod(tpl, "toJSON", fnToString);
    Nan::SetPrototypeMethod(tpl, "inspect", fnInspect);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());
}

NAN_METHOD(Cas::fnToString)
{
    Nan::HandleScope scope;
    uint64_t casVal = 0;
    char casStr[24 + 1] = "";

    Cas::parse(info.This(), &casVal);
    sprintf(casStr, "%llu", (unsigned long long int)casVal);

    info.GetReturnValue().Set(Nan::New<String>(casStr).ToLocalChecked());
}

NAN_METHOD(Cas::fnInspect)
{
    Nan::HandleScope scope;
    uint64_t casVal = 0;
    char casStr[7 + 24 + 1] = "";

    Cas::parse(info.This(), &casVal);
    sprintf(casStr, "CbCas<%llu>", (unsigned long long int)casVal);

    return info.GetReturnValue().Set(Nan::New<String>(casStr).ToLocalChecked());
}

Local<Value> Cas::create(uint64_t cas)
{
    Local<Object> ret =
        Nan::NewInstance(Nan::New<Function>(constructor())).ToLocalChecked();

    Local<Value> casData =
        Nan::CopyBuffer((char *)&cas, sizeof(uint64_t)).ToLocalChecked();
    Nan::Set(ret, 0, casData);

    return ret;
}

bool _StrToCas(Local<Value> obj, uint64_t *p)
{
    if (sscanf(*Nan::Utf8String(
                   obj->ToString(Nan::GetCurrentContext()).ToLocalChecked()),
               "%llu", (unsigned long long int *)p) != 1) {
        return false;
    }
    return true;
}

bool _ObjToCas(Local<Value> obj, uint64_t *p)
{
    Local<Object> realObj = obj.As<Object>();
    Local<Value> casData = Nan::Get(realObj, 0).ToLocalChecked();

    if (!node::Buffer::HasInstance(casData)) {
        return false;
    }

    if (node::Buffer::Length(casData) != sizeof(uint64_t)) {
        return false;
    }

    memcpy(p, node::Buffer::Data(casData), sizeof(uint64_t));

    return true;
}

bool Cas::parse(Local<Value> obj, uint64_t *p)
{
    Nan::HandleScope scope;

    *p = 0;
    if (obj->IsNull() || obj->IsUndefined()) {
        *p = 0;
        return true;
    } else if (obj->IsObject()) {
        return _ObjToCas(obj, p);
    } else if (obj->IsString()) {
        return _StrToCas(obj, p);
    }

    return false;
}

} // namespace couchnode
