/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
#ifndef EXCEPTION_H
#define EXCEPTION_H 1

#ifndef COUCHBASE_H
#error "include couchbase_impl.h first"
#endif

namespace Couchnode
{

using namespace v8;

class Error
{
public:
    static void Init();

    static Local<Value> create(const std::string &msg, int err = 0);
    static Local<Value> create(lcb_error_t err);

    static void setErrorClass(Local<Function> func);
    static Local<Function> getErrorClass();

private:
    static Nan::Persistent<Function> errorClass;
    static Nan::Persistent<String> codeKey;

    Error() {}

};


}

#endif
