/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2013 Couchbase, Inc.
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
#include <ctype.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

static int maybe_skip_encoding(const char *p, lcb_size_t c, lcb_size_t l)
{
    int ii;
    p += c;

    for (ii = 0; ii < 2; ++ii, ++p, ++c) {
        if (c == l) {
            return 0;
        }

        switch (tolower(*p)) {
        case 'a':
        case 'b':
        case 'c':
        case 'd':
        case 'e':
        case 'f':
            break;
        default:
            if (isdigit(*p) == 0) {
                return 0;
            }
        }
    }

    return 1;
}

static int is_legal_uri_character(char c)
{
    unsigned char uc = (unsigned char)c;
    if (isalpha(uc) || isdigit(uc)) {
        return 1;
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
        return 1;
    default:
        ;
    }

    return 0;
}

lcb_error_t lcb_urlencode_path(const char *path,
                               lcb_size_t npath,
                               char **out,
                               lcb_size_t *nout)
{
    lcb_size_t ii;
    lcb_size_t n = 0;
    int skip_encoding = 0, is_ualloc = 0;
    char *op;
    lcb_error_t err;

    /* If the input buffer is not initialized, assume it's the correct size */
    if (*out) {
        is_ualloc = 1;
        op = *out;
    } else if ((*out = op = malloc(npath *3)) == NULL) {
        return LCB_CLIENT_ENOMEM;
    }

    for (ii = 0; ii < npath; ++ii) {
        if (skip_encoding == 0) {
            switch (path[ii]) {
            case '%':
                skip_encoding = maybe_skip_encoding(path, ii + 1, npath);
                break;
            case '+':
                skip_encoding = 1;
            default:
                ;
            }
        }

        if (skip_encoding || is_legal_uri_character(path[ii])) {
            if (skip_encoding && path[ii] != '%' && !is_legal_uri_character(path[ii])) {
                err = LCB_INVALID_CHAR;
                goto GT_ERR;
            }

            op[n++] = path[ii];
        } else {
            unsigned int c = (unsigned char)path[ii];
            int numbytes;
            int xx;

            if ((c & 0x80) == 0) {  /* ASCII character */
                numbytes = 1;
            } else if ((c & 0xE0) == 0xC0) {    /* 110x xxxx */
                numbytes = 2;
            } else if ((c & 0xF0) == 0xE0) {    /* 1110 xxxx */
                numbytes = 3;
            } else if ((c & 0xF8) == 0xF0) {    /* 1111 0xxx */
                numbytes = 4;
            } else {
                err = LCB_INVALID_CHAR;
                goto GT_ERR;
            }

            for (xx = 0; xx < numbytes; ++xx, ++ii) {
                c = (unsigned char)path[ii];
                sprintf(op + n, "%%%02X", c);
                n += 3;
            }

            /* we updated ii too much */
            --ii;
        }
    }

    *nout = n;

    return LCB_SUCCESS;

    GT_ERR:
    if (!is_ualloc) {
        free(op);
        *out = NULL;
    }
    return err;
}

int
lcb_urldecode(const char *in, char *out, lcb_SSIZE n)
{
    int iix, oix = 0;
    if (n == -1) {
        n = strlen(in);
    }
    for (iix = 0; iix < n && in[iix]; ++iix) {
        if (in[iix] != '%') {
            out[oix++] = in[iix];
        } else {
            unsigned octet = 0;
            if (iix + 3 > n) {
                return -1;
            }
            if (sscanf(&in[iix+1], "%2X", &octet) != 1) {
                return -1;
            }
            out[oix++] = (char)octet;
            iix += 2;
        }
    }
    out[oix] = '\0';
    return 0;
}

/* See: https://url.spec.whatwg.org/#urlencoded-serializing: */
/*
 * 0x2A
 * 0x2D
 * 0x2E
 * 0x30 to 0x39
 * 0x41 to 0x5A
 * 0x5F
 * 0x61 to 0x7A
 *  Append a code point whose value is byte to output.
 * Otherwise
 *  Append byte, percent encoded, to output.
 */
size_t
lcb_formencode(const char *s, size_t n, char *out)
{
    size_t ii;
    size_t oix = 0;

    for (ii = 0; ii < n; ii++) {
        unsigned char c = s[ii];
        if (isalnum(c)) {
            out[oix++] = c;
            continue;
        } else if (c == ' ') {
            out[oix++] = '+';
        } else if (
                (c == 0x2A || c == 0x2D || c == 0x2E) ||
                (c >= 0x30 && c <= 0x39) ||
                (c >= 0x41 && c <= 0x5A) ||
                (c == 0x5F) ||
                (c >= 0x60 && c <= 0x7A)) {
            out[oix++] = c;
        } else {
            out[oix++] = '%';
            sprintf(out + oix, "%02X", c);
            oix += 2;
        }
    }
    return oix;
}
