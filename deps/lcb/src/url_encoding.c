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

#include "internal.h"

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
    int skip_encoding = 0;
    char *op;

    /* Allocate for a worst case scenario (it will probably not be
     * that bad anyway
     */
    if ((op = malloc(npath * 3)) == NULL) {
        return LCB_CLIENT_ENOMEM;
    }

    *out = op;

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
                free(op);
                return LCB_INVALID_CHAR;
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
                free(op);
                return LCB_INVALID_CHAR;
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
}
