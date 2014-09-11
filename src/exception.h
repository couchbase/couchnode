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
    static void Init() {
    }

    static Handle<Value> create(const std::string &msg, const int err = 0) {
        v8::Local<v8::Value> error;

        if (err > 0) {
            error = NanError(msg.c_str(), err);
        } else {
            error = NanError(msg.c_str());
        }
        return error;
    }

    static Handle<Value> create(lcb_error_t err) {
        if (err == LCB_SUCCESS) {
            return NanNull();
        }

        v8::Local<v8::Value> error;
        error = NanError(lcb_strerror(NULL, err), err);
        return error;
    }

    static Handle<Function> getErrorClass() {
      Local<FunctionTemplate> tErr = NanNew<FunctionTemplate>();
      tErr->SetClassName(NanNew<String>("CouchbaseError"));
      return tErr->GetFunction();
    }

private:
};

}

#endif
