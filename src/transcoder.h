#pragma once
#ifndef TRANSCODER_H
#define TRANSCODER_H

#include "valueparser.h"

namespace couchnode
{

using namespace v8;

class DefaultTranscoder
{
public:
    static Local<Value> decodeJson(const char *bytes, size_t nbytes);
    static void encodeJson(ValueParser &venc, const char **bytes,
                           size_t *nbytes, Local<Value> value);

    static Local<Value> decode(const char *bytes, size_t nbytes,
                               uint32_t flags);
    static void encode(ValueParser &venc, const char **bytes, size_t *nbytes,
                       uint32_t *flags, Local<Value> value);
};

} // namespace couchnode

#endif // TRANSCODER_H
