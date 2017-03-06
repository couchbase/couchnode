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

using namespace Couchnode;

enum Flags {
    // Node Flags - Formats
    NF_JSON = 0x00,
    NF_RAW = 0x02,
    NF_UTF8 = 0x04,
    NF_MASK = 0xFF,

    // Common Flags - Formats
    CF_NONE,
    CF_PRIVATE = 0x01 << 24,
    CF_JSON = 0x02 << 24,
    CF_RAW = 0x03 << 24,
    CF_UTF8 = 0x04 << 24,
    CF_MASK = 0xFF << 24,

    // Common Flags - Compressions

};

Local<Value> DefaultTranscoder::decodeJson(const void *bytes,
        size_t nbytes)
{
    Handle<Value> stringVal =
            Nan::New<String>((char*)bytes, nbytes).ToLocalChecked();

    Local<Function> jsonParseLcl = Nan::New(CouchbaseImpl::jsonParse);
    return jsonParseLcl->Call(
            Nan::GetCurrentContext()->Global(), 1, &stringVal);
}

void DefaultTranscoder::encodeJson(CommandEncoder &enc, const void **bytes,
        lcb_SIZE *nbytes, Local<Value> value)
{
    Local<Function> jsonStringifyLcl = Nan::New(CouchbaseImpl::jsonStringify);
    Local<Value> ret = jsonStringifyLcl->Call(
            Nan::GetCurrentContext()->Global(), 1, &value);

    enc.parseString(bytes, nbytes, ret);
}

Local<Value> DefaultTranscoder::decode(const void *bytes,
        size_t nbytes, lcb_U32 flags)
{
    lcb_U32 format = flags & NF_MASK;
    lcb_U32 cfformat = flags & CF_MASK;

    if (cfformat != 0) {
      if (cfformat == CF_JSON) {
        format = NF_JSON;
      } else if (cfformat == CF_RAW) {
        format = NF_RAW;
      } else if (cfformat == CF_UTF8) {
        format = NF_UTF8;
      } else if (cfformat != CF_PRIVATE) {
        // Unknown CF Format!  The following will force
        //   fallback to reporting RAW data.
        format = 0x100;
      }
    }

    if (format == NF_UTF8) {
        // UTF8 decodes into a String
        return Nan::New<String>((char*)bytes, nbytes).ToLocalChecked();
    } else if (format == NF_RAW) {
        // RAW decodes into a Buffer
        return Nan::CopyBuffer((char*)bytes, nbytes).ToLocalChecked();
    } else if (format == NF_JSON) {
        // JSON decodes to an Object
        Nan::TryCatch tryCatch;
        Local<Value> ret = decodeJson(bytes, nbytes);
        if (!tryCatch.HasCaught()) {
            return ret;
        }

        // If there was an exception inside JSON.parse, we fall through
        //   to the default handling below and read it as RAW.
    }

    // Default to decoding as RAW
    return decode(bytes, nbytes, NF_RAW);
}

void DefaultTranscoder::encode(CommandEncoder &enc, const void **bytes, lcb_SIZE *nbytes,
        lcb_U32 *flags, Local<Value> value)
{
    if (value->IsString()) {
        enc.parseString(bytes, nbytes, value);
        *flags = CF_UTF8 | NF_UTF8;
        return;
    } else if (node::Buffer::HasInstance(value)) {
        // This relies on the fact that value would have came from the
        //   function which invoked the operation, thus it's lifetime is
        //   implicitly going to outlive the command operation we create.
        *nbytes = node::Buffer::Length(value);
        *bytes = node::Buffer::Data(value);
        *flags = CF_RAW | NF_RAW;
        return;
    } else {
        encodeJson(enc, bytes, nbytes, value);
        *flags = CF_JSON | NF_JSON;
        return;
    }
}
