/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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

#include "strcodecs.h"
#include <string.h>

/*
 * Function to base64 encode a text string as described in RFC 4648
 *
 * @author Trond Norbye
 */

/**
 * An array of the legal charracters used for direct lookup
 */
static const lcb_uint8_t code[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Encode up to 3 characters to 4 output character.
 *
 * @param s pointer to the input stream
 * @param d pointer to the output stream
 * @param num the number of characters from s to encode
 * @return 0 upon success, -1 otherwise.
 */
static int encode_rest(const lcb_uint8_t *s, lcb_uint8_t *d, lcb_size_t num)
{
    lcb_uint32_t val = 0;

    switch (num) {
    case 2:
        val = (lcb_uint32_t)((*s << 16) | (*(s + 1) << 8));
        break;
    case 1:
        val = (lcb_uint32_t)((*s << 16));
        break;
    default:
        return -1;
    }

    d[3] = '=';

    if (num == 2) {
        d[2] = code[(val >> 6) & 63];
    } else {
        d[2] = '=';
    }

    d[1] = code[(val >> 12) & 63];
    d[0] = code[(val >> 18) & 63];

    return 0;
}

/**
 * Encode 3 characters to 4 output character.
 *
 * @param s pointer to the input stream
 * @param d pointer to the output stream
 */
static int encode_triplet(const lcb_uint8_t *s, lcb_uint8_t *d)
{
    lcb_uint32_t val = (lcb_uint32_t)((*s << 16) | (*(s + 1) << 8) | (*(s + 2)));
    d[3] = code[val & 63] ;
    d[2] = code[(val >> 6) & 63];
    d[1] = code[(val >> 12) & 63];
    d[0] = code[(val >> 18) & 63];

    return 0;
}

/**
 * Base64 encode a string into an output buffer.
 * @param src string to encode
 * @param dst destination buffer
 * @param sz size of destination buffer
 * @return 0 if success, -1 if the destination buffer isn't big enough
 */
int lcb_base64_encode(const char *src, char *dst, lcb_size_t sz)
{
    lcb_size_t len = strlen(src);
    lcb_size_t triplets = len / 3;
    lcb_size_t rest = len % 3;
    lcb_size_t ii;
    const lcb_uint8_t *in = (const lcb_uint8_t *)src;
    lcb_uint8_t *out = (lcb_uint8_t *)dst;

    if (sz < (lcb_size_t)((triplets + 1) * 4)) {
        return -1;
    }

    for (ii = 0; ii < triplets; ++ii) {
        if (encode_triplet(in, out) != 0) {
            return -1;
        }
        in += 3;
        out += 4;
    }

    if (rest > 0) {
        if (encode_rest(in, out, rest) != 0) {
            return -1;
        }
        out += 4;
    }
    *out = '\0';

    return 0;
}
