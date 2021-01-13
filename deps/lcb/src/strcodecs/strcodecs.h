/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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

#ifndef LCB_STRCODECS_H
#define LCB_STRCODECS_H
#include <cctype>
#include <libcouchbase/couchbase.h>
#include <cstddef>
#include <string>

/**
 * Base64 encode a string into an output buffer.
 * @param src string to encode
 * @param len size of source buffer
 * @param dst destination buffer
 * @param sz size of destination buffer
 * @return 0 if success, -1 if the destination buffer isn't big enough
 */
int lcb_base64_encode(const char *src, std::size_t len, char *dst, std::size_t sz);

/**
 * Base64 encode a string into an output buffer.
 * @param src string to encode
 * @param len size of source buffer
 * @param dst destination buffer
 * @param sz size of destination buffer
 * @return 0 if success, -1 if function wasn't able to allocate enough memory
 */
int lcb_base64_encode2(const char *src, std::size_t len, char **dst, std::size_t *sz);

std::ptrdiff_t lcb_base64_decode(const char *src, std::size_t nsrc, char *dst, std::size_t ndst);
std::ptrdiff_t lcb_base64_decode2(const char *src, std::size_t nsrc, char **dst, std::size_t *ndst);

void lcb_base64_encode_iov(lcb_IOV *iov, unsigned niov, unsigned nb, char **dst, int *ndst);

namespace lcb
{
namespace strcodecs
{
template <typename Ti, typename To>
bool urldecode(Ti first, Ti last, To out, std::size_t &nout)
{
    for (; first != last && *first != '\0'; ++first) {
        if (*first == '%') {
            char nextbuf[3] = {0};
            std::size_t jj = 0;
            first++;
            nextbuf[0] = *first;
            for (; first != last && jj < 2; ++jj) {
                nextbuf[jj] = *first;
                if (jj != 1) {
                    first++;
                }
            }
            if (jj != 2) {
                return false;
            }

            unsigned octet = 0;
            if (sscanf(nextbuf, "%2X", &octet) != 1) {
                return false;
            }

            *out = static_cast<char>(octet);
        } else {
            *out = *first;
        }

        out++;
        nout++;
    }
    return true;
}

inline bool urldecode(const char *input, char *output)
{
    const char *endp = input + strlen(input);
    std::size_t nout = 0;
    if (urldecode(input, endp, output, nout)) {
        output[nout] = '\0';
        return true;
    }
    return false;
}

inline bool urldecode(char *in_out)
{
    return urldecode(in_out, in_out);
}

inline bool urldecode(std::string &s)
{
    std::size_t n = 0;
    if (urldecode(s.begin(), s.end(), s.begin(), n)) {
        s.resize(n);
        return true;
    }
    return false;
}

namespace priv
{
inline bool is_legal_urichar(char c)
{
    auto uc = (unsigned char)c;
    if (isalpha(uc) || isdigit(uc)) {
        return true;
    }
    switch (uc) {
        case '-':
        case '_':
        case '.':
        case '~':
        case '!':
        case '*':
        case '\'':
        case '(':
        case ')':
        case ';':
        case ':':
        case '@':
        case '&':
        case '=':
        case '+':
        case '$':
        case ',':
        case '/':
        case '?':
        case '#':
        case '[':
        case ']':
            return true;
        default:
            break;
    }
    return false;
}

template <typename T>
inline bool is_already_escape(T first, T last)
{
    first++; // ignore '%'
    std::size_t jj;
    for (jj = 0; first != last && jj < 2; ++jj, ++first) {
        if (!isxdigit(*first)) {
            return false;
        }
    }
    if (jj != 2) {
        return false;
    }
    return true;
}
} // namespace priv

template <typename Ti, typename To>
bool urlencode(Ti first, Ti last, To &o, bool check_encoded = true)
{
    // If re-encoding detection is enabled, this flag indicates not to
    // re-encode
    bool skip_encoding = false;

    for (; first != last; ++first) {
        if (!skip_encoding && check_encoded) {
            if (*first == '%') {
                skip_encoding = priv::is_already_escape(first, last);
            } else if (*first == '+') {
                skip_encoding = true;
            }
        }
        if (skip_encoding || priv::is_legal_urichar(*first)) {
            if (skip_encoding && *first != '%' && !priv::is_legal_urichar(*first)) {
                return false;
            }

            o.insert(o.end(), first, first + 1);
        } else {
            unsigned int c = static_cast<unsigned char>(*first);
            std::size_t numbytes;

            if ((c & 0x80) == 0) { /* ASCII character */
                numbytes = 1;
            } else if ((c & 0xE0) == 0xC0) { /* 110x xxxx */
                numbytes = 2;
            } else if ((c & 0xF0) == 0xE0) { /* 1110 xxxx */
                numbytes = 3;
            } else if ((c & 0xF8) == 0xF0) { /* 1111 0xxx */
                numbytes = 4;
            } else {
                return false;
            }

            do {
                char buf[4];
                sprintf(buf, "%%%02X", static_cast<unsigned char>(*first));
                o.insert(o.end(), &buf[0], &buf[0] + 3);
            } while (--numbytes && ++first != last);
        }
    }
    return true;
}
template <typename Tin, typename Tout>
bool urlencode(const Tin &in, Tout &out)
{
    return urlencode(in.begin(), in.end(), out);
}

} // namespace strcodecs
} // namespace lcb

#endif
