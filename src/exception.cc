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

namespace Couchnode {

CBExc::CBExc(const char *msg, Handle<Value> at) :
        code(ErrorCode::GENERIC), set_(true)
{
    setMessage(msg, at);
}

CBExc::CBExc()
    : message(""), code(0), set_(false), obj_set_(false)
{
}

void CBExc::setMessage(const std::string &msg, const Handle<Value> value)
{
    std::stringstream ss;
    message = msg;
    if (!atObject.IsEmpty()) {
        atObject.Dispose();
        atObject.Clear();
    }
    if (!value.IsEmpty()) {
        obj_set_ = true;
        atObject = Persistent<Value>::New(value);
    }
}

CBExc::~CBExc() {
    if (!atObject.IsEmpty()) {
        atObject.Dispose();
        atObject.Clear();
    }
}


std::string CBExc::formatMessage() const
{
    std::stringstream ss;
    ss << "[couchnode]: ";
    ss << "Code: " << std::dec << code << ",";
    ss << "Message=" << message;
    return ss.str();
}

Handle<Value> CBExc::asValue()
{
    // Use a symbol unless we have an object's stringification
    // attached.
    Handle<String> omsg;
    if (!hasObject()) {
        omsg = String::NewSymbol(message.c_str());
    } else {
        omsg = String::New(message.c_str());
    }
    Handle<Value> e = Exception::Error(omsg);
    Handle<Object> obj = e->ToObject();
    obj->Set(NameMap::names[NameMap::EXC_CODE], Number::New(code));
    if (!atObject.IsEmpty()) {
        obj->Set(String::NewSymbol("at"), atObject);
    }
    return e;
}

}
