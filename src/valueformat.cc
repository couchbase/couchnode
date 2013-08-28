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

#include "couchbase_impl.h"
#include "node_buffer.h"
namespace Couchnode {
Persistent<Function> ValueFormat::jsonParse;
Persistent<Function> ValueFormat::jsonStringify;

void ValueFormat::initialize()
{
    HandleScope scope;
    Handle<Object> jMod = v8::Context::GetEntered()->Global()->Get(
            String::NewSymbol("JSON")).As<Object>();
    assert(!jMod.IsEmpty());


    jsonParse = Persistent<Function>::New(
            jMod->Get(String::NewSymbol("parse")).As<Function>());
    jsonStringify = Persistent<Function>::New(jMod->Get(
            String::NewSymbol("stringify")).As<Function>());

    assert(!jsonParse.IsEmpty());
    assert(!jsonStringify.IsEmpty());
}

Handle<Value> ValueFormat::decode(const char *bytes, size_t n,
                                  uint32_t flags)
{
    if (flags == UTF8) {
        return String::New(bytes, n);

    } else if (flags == RAW) {
        // 0.8 defines this as char*, hence the cast
        node::Buffer *buf = node::Buffer::New(const_cast<char*>(bytes), n);
        return buf->handle_;

    } else if (flags == JSON) {
        Handle<Value> s = decode(bytes, n, UTF8);
        v8::TryCatch try_catch;
        Handle<Value> ret = jsonParse->Call(
                v8::Context::GetEntered()->Global(), 1, &s);
        if (try_catch.HasCaught()) {
            return decode(bytes, n, RAW);
        }

        return ret;
    } else {
        // unrecognized format
        return decode(bytes, n, RAW);
    }

    return Handle<Value>();
}

static bool returnEmptyString(char **k, size_t *n)
{
    if (*n == 0) {
        *k = const_cast<char *>("");
        return true;
    }
    return false;
}

bool ValueFormat::encodeNodeBuffer(Handle<Object> input, BufferList &buf,
                                   char **k, size_t *n, CBExc &ex)
{
    *n = node::Buffer::Length(input);
    if (!*n) {

    }
    // TODO: Check if we're connected or not..
    *k = buf.getBuffer(*n);
    if (!*k) {
        ex.eMemory();
        return false;
    }
    memcpy(*k, node::Buffer::Data(input), *n);
    return true;
}

ValueFormat::Spec ValueFormat::getAutoSpec(Handle<Value> input)
{
    Spec spec;
    if (input->IsString()) {
        spec = UTF8;

    } else if (input->IsNumber() || input->IsArray()) {
        spec = JSON;

    } else if (input->IsObject()) {
        if (node::Buffer::HasInstance(input)) {
            spec = RAW;
        } else {
            spec = JSON;
        }
    } else {
        spec = UTF8;
    }

    return spec;
}

bool ValueFormat::encode(Handle<Value> input,
                         Spec spec,
                         BufferList &buf,
                         uint32_t *flags,
                         char **k,
                         size_t *n,
                         CBExc &ex)
{
    if (spec == INVALID) {
        ex.eArguments("Passed an invalid specifier");
        return false;
    }

    if (spec == AUTO) {
        spec = getAutoSpec(input);
    }

    if (spec == UTF8) {
        Handle<String> s;
        *flags = UTF8;

        if (!input->IsString()) {
            ex.eArguments("Input not a string", input);
            return false;
        }

        s = input.As<String>();
        *n = s->Utf8Length();

        if (returnEmptyString(k, n)) {
            return true;
        }

        *k = buf.getBuffer(*n);
        if (!*k) {
            ex.eMemory();
            return false;
        }

        size_t nw = s->WriteUtf8(*k, *n, NULL, String::NO_NULL_TERMINATION);
        if (nw != *n) {
            ex.eArguments("Incomplete conversion", s);
            return false;
        }
        return true;

    } else if (spec == RAW) {
        if (node::Buffer::HasInstance(input)) {
            *flags = RAW;
            return encodeNodeBuffer(input.As<Object>(), buf, k, n, ex);

        } else {
            bool ret = encode(input, UTF8, buf, flags, k, n, ex);
            *flags = RAW;
            return ret;
        }

    } else if (spec == JSON) {
        v8::TryCatch try_catch;
        Handle<Value> ret = jsonStringify->Call(
                v8::Context::GetEntered()->Global(), 1, &input);

        if (try_catch.HasCaught()) {
            ex.eArguments("Couldn't convert to JSON", try_catch.Exception());
            return false;
        }

        if (!encode(ret, UTF8, buf, flags, k, n, ex)) {
            return false;
        }

        *flags = JSON;
        return true;

    } else {
        ex.eArguments("Can't parse spec");
        return false;
    }
}

}
