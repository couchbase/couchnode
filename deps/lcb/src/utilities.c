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

#include "internal.h"

/**
 * This file contains utility functions which don't have another place
 * to call home
 */

#if !defined(HAVE_HTONLL) && !defined(WORDS_BIGENDIAN)
extern lcb_uint64_t lcb_byteswap64(lcb_uint64_t val)
{
    lcb_size_t ii;
    lcb_uint64_t ret = 0;
    for (ii = 0; ii < sizeof(lcb_uint64_t); ii++) {
        ret <<= 8;
        ret |= val & 0xff;
        val >>= 8;
    }
    return ret;
}
#endif

/**
 * While the C standard library uses 'putenv' for environment variable
 * manipulation, POSIX defines setenv (which works sanely) but Windows
 * only has putenv (via the CRT interface).
 * However Windows also has the 'GetEnvironmentVariable' etc. API - which
 * actually uses a different interface.
 *
 * We prefer to use actual API calls rather than hack into a poor excuse
 * of conformance. Since putenv requires ownership of the string, its use
 * is discouraged (and _putenv_s isn't available in MinGW); thus the
 * assumption that the most common APIs are GetEnvironmentVariable and
 * SetEnvironmentVariable. We try to abstract this away from the rest of the
 * library.
 */

#ifdef _WIN32
int lcb_getenv_nonempty(const char *key, char *buf, lcb_size_t len)
{
    DWORD nvalue = GetEnvironmentVariable(key, buf, (DWORD)len);

    if (nvalue == 0 || nvalue >= len) {
        return 0;
    }

    if (!buf[0]) {
        return 0;
    }
    return 1;
}

#else
int lcb_getenv_nonempty(const char *key, char *buf, lcb_size_t len)
{
    const char *cur = getenv(key);
    if (cur == NULL || *cur == '\0') {
        return 0;
    }

    strncpy(buf, cur, len);
    return 1;
}
#endif

int lcb_getenv_boolean(const char *key)
{
    char value[4096] = { 0 };
    int rv;
    rv = lcb_getenv_nonempty(key, value, sizeof(value));
    return rv != 0 && value[0] != '\0' && value[0] != '0';
}

#ifdef _WIN32
lcb_error_t lcb_initialize_socket_subsystem(void)
{
    static volatile LONG initialized = 0;
    WSADATA wsaData;

    if (InterlockedCompareExchange(&initialized, 1, 0)) {
        return LCB_SUCCESS;
    }
    if (WSAStartup(MAKEWORD(2, 0), &wsaData) != 0) {
        lcb_assert("Winsock initialization error" && 0);
    }
    return LCB_SUCCESS;
}
#else
lcb_error_t lcb_initialize_socket_subsystem(void)
{
    return LCB_SUCCESS;
}
#endif
