/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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
#ifdef __cplusplus
extern "C" {
#endif
#include <libcouchbase/couchbase.h>
lcb_error_t lcb_urlencode_path(const char *path,
                               lcb_size_t npath,
                               char **out,
                               lcb_size_t *nout);

/**
 * Decode a string from 'percent-encoding'
 * @param in The input string
 * @param out The output buffer. Must be at least the same size as the input
 * @param n The size of the input buffer. May be -1 if NUL-terminated
 * @return 0 if converted successfuly, -1 on error
 */
int
lcb_urldecode(const char *in, char *out, lcb_SSIZE n);

/**
 * Base64 encode a string into an output buffer.
 * @param src string to encode
 * @param dst destination buffer
 * @param sz size of destination buffer
 * @return 0 if success, -1 if the destination buffer isn't big enough
 */
int lcb_base64_encode(const char *src, char *dst, lcb_size_t sz);

#ifdef __cplusplus
}
#endif
#endif
