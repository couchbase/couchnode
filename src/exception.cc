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

void Error::Init() {
    codeKey.Reset(Nan::New<String>("code").ToLocalChecked());
}

Local<Value> Error::create(const std::string &msg, int err) {
    Local<Value> args[] = {
        Nan::New<String>(msg.c_str()).ToLocalChecked()
    };
    Local<Object> errObj =
        Nan::NewInstance(getErrorClass(), 1, args).ToLocalChecked();
    if (err > 0) {
        errObj->Set(Nan::New(codeKey), Nan::New<Integer>(err));
    }
    return errObj;
}

Local<Value> Error::create(lcb_error_t err) {
    if (err == LCB_SUCCESS) {
        return Nan::Null();
    }

    Local<Value> args[] = {
        Nan::New<String>(lcb_strerror(NULL, err)).ToLocalChecked()
    };
    Local<Object> errObj =
        Nan::NewInstance(getErrorClass(), 1, args).ToLocalChecked();
    errObj->Set(Nan::New(codeKey), Nan::New<Integer>(err));
    return errObj;
}

void Error::setErrorClass(Local<Function> func) {
    errorClass.Reset(func);
}

Local<Function> Error::getErrorClass() {
    return Nan::New(errorClass);
}
