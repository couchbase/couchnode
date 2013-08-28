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
#ifndef COUCHNODE_VALUEFORMAT_H
#ifndef COUCHBASE_H
#error "include couchbase_impl.h first"
#endif

namespace Couchnode
{

class ValueFormat {
public:
    enum Spec {
        INVALID = -1,
        JSON = 0x00,
        UTF16 = 0x01,
        RAW = 0x02,
        UTF8 = 0x04,
        MASK = 0x07,
        AUTO = 0x777777
    };

    static void initialize();
    static Persistent<Function> jsonParse;
    static Persistent<Function> jsonStringify;

    static Spec toSpec(Handle<Value> input, CBExc& ex) {
        if (input.IsEmpty()) {
            return AUTO;

        } else if (input->IsString()) {
            Handle<String> s = input.As<String>();
            if (s->StrictEquals(NameMap::get(NameMap::FMT_AUTO))) {
                return AUTO;
            } else if (s->StrictEquals(NameMap::get(NameMap::FMT_RAW))) {
                return RAW;
            } else if (s->StrictEquals(NameMap::get(NameMap::FMT_JSON))) {
                return JSON;
            } else if (s->StrictEquals(NameMap::get(NameMap::FMT_UTF8))) {
                return UTF8;
            } else {
                ex.eArguments("Invalid format specifier", input);
                return INVALID;
            }

        } else if (input->IsNumber()) {
            Handle<Number> i = input.As<Number>();
            switch (i->IntegerValue()) {
            case AUTO:
                return AUTO;
            case JSON:
                return JSON;
            case UTF8:
                return UTF8;
            case UTF16:
                return UTF16;
            case RAW:
                return RAW;
            default:
                ex.eArguments("Unknown format specifier", input);
                return INVALID;
            }
        } else if (!input->BooleanValue()) {
            return AUTO;
        } else {
            ex.eArguments("Specifier must be constant or string");
            return INVALID;
        }
    }

    /**
     * Decodes a value based on the flags
     * @param bytes the input buffer to decode
     * @param n the size of the input buffer
     * @param flags format specifier
     */
    static Handle<Value> decode(const char *bytes, size_t n, uint32_t flags);

    /**
     * Encodes a value
     * @param input a Value to encode
     * @param spec an input specifier
     * @param buf a BufferList structure which will be written to
     * @param flags output flags for the value
     * @param k pointer to be set to the encoded data
     * @param n size of encoded data
     * @param ex error if this function fails
     * @return true if successful, false otherwise
     */
    static bool encode(Handle<Value> input,
                       Spec spec,
                       BufferList &buf,
                       uint32_t *flags,
                       char **k,
                       size_t *n,
                       CBExc& ex);

    static bool writeUtf8(Handle<Value> input,
                          BufferList &buf,
                          char **k, size_t n,
                          CBExc& ex,
                          bool addNul=false);

private:

    // static instance
    ValueFormat();
    static inline Spec getAutoSpec(Handle<Value>);
    static inline bool encodeNodeBuffer(Handle<Object>, BufferList&,
                                        char **, size_t*, CBExc&);
};

}

#endif
