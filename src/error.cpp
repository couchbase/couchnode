#include "error.h"

namespace couchnode
{

NAN_MODULE_INIT(Error::Init)
{
}

Local<Value> Error::create(const std::string &msg, lcb_STATUS err)
{
    Local<Object> errObj = Nan::Error(msg.c_str()).As<Object>();
    Nan::Set(errObj, Nan::New<String>("code").ToLocalChecked(),
             Nan::New<Integer>(err));

    return errObj;
}

Local<Value> Error::create(lcb_STATUS err)
{
    if (err == LCB_SUCCESS) {
        return Nan::Null();
    }

    Local<Object> errObj = Nan::Error(lcb_strerror_long(err)).As<Object>();
    Nan::Set(errObj, Nan::New<String>("code").ToLocalChecked(),
             Nan::New<Integer>(err));

    return errObj;
}

} // namespace couchnode
