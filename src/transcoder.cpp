#include "transcoder.h"

#include "node_buffer.h"

namespace couchnode
{

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

Local<Value> DefaultTranscoder::decodeJson(const char *bytes, size_t nbytes)
{
    Local<String> stringVal =
        Nan::New<String>((const char *)bytes, nbytes).ToLocalChecked();
    Nan::MaybeLocal<Value> parseVal = Nan::JSON{}.Parse(stringVal);
    if (parseVal.IsEmpty()) {
        return Nan::Undefined();
    }
    return parseVal.ToLocalChecked();
}

void DefaultTranscoder::encodeJson(ValueParser &venc, const char **bytes,
                                   size_t *nbytes, Local<Value> value)
{
    Local<Object> objValue = Nan::To<Object>(value).ToLocalChecked();
    Local<String> ret = Nan::JSON{}.Stringify(objValue).ToLocalChecked();
    venc.parseString(bytes, nbytes, ret);
}

Local<Value> DefaultTranscoder::decode(const char *bytes, size_t nbytes,
                                       uint32_t flags)
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
        return Nan::New<String>((char *)bytes, nbytes).ToLocalChecked();
    } else if (format == NF_RAW) {
        // RAW decodes into a Buffer
        return Nan::CopyBuffer((char *)bytes, nbytes).ToLocalChecked();
    } else if (format == NF_JSON) {
        // JSON decodes to an Object
        Local<Value> ret = decodeJson(bytes, nbytes);
        if (!ret->IsUndefined()) {
            return ret;
        }

        // If there was an exception inside JSON.parse, we fall through
        //   to the default handling below and read it as RAW.
    }

    // Default to decoding as RAW
    return decode(bytes, nbytes, NF_RAW);
}

void DefaultTranscoder::encode(ValueParser &venc, const char **bytes,
                               size_t *nbytes, uint32_t *flags,
                               Local<Value> value)
{
    if (value->IsString()) {
        venc.parseString(bytes, nbytes, value);
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
        encodeJson(venc, bytes, nbytes, value);
        *flags = CF_JSON | NF_JSON;
        return;
    }
}

} // namespace couchnode
