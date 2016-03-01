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

#ifndef TRANSCODER_H
#define TRANSCODER_H

#ifndef COUCHBASE_H
#error "include couchbase_impl.h first"
#endif

namespace Couchnode
{

using namespace v8;

class DefaultTranscoder
{
public:
    static Local<Value> decodeJson(const void *bytes,
            size_t nbytes);
    static void encodeJson(CommandEncoder &enc, const void **bytes,
            lcb_SIZE *nbytes, Local<Value> value);

    static Local<Value> decode(const void *bytes,
            size_t nbytes, lcb_U32 flags);
    static void encode(CommandEncoder &enc,
            const void **bytes, lcb_SIZE *nbytes,
            lcb_U32 *flags, Local<Value> value);

};


}

#endif
