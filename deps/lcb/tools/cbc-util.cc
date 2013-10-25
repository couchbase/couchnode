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
#include "config.h"

#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

#include <string>
#include <list>
#include <iostream>
#include <cstdlib>
#include <cstdio>
#include <cerrno>
#include <cstring>
#include <libcouchbase/couchbase.h>
#include <memcached/protocol_binary.h>
#include "tools/cbc-util.h"

using namespace std;

void sendIt(const lcb_uint8_t *ptr, lcb_size_t size)
{
    do {
        lcb_size_t nw = fwrite(ptr, 1, size, stdout);
        switch (nw) {
        case 0:
        case -1:
            cerr << "Failed to send data: " << strerror(errno)
                 << endl;
            exit(1);
        default:
            size -= nw;
            ptr += nw;
        }
    } while (size > 0);
}

bool readIt(lcb_uint8_t *ptr, lcb_size_t size)
{
    do {
        lcb_size_t nw = fread(ptr, 1, size, stdin);
        switch (nw) {
        case 0:
        case -1:
            if (feof(stdin)) {
                return false;
            }
            cerr << "Failed to read data: " << strerror(errno)
                 << endl;
            exit(1);
        default:
            size -= nw;
            ptr += nw;
        }
    } while (size > 0);

    return true;
}

#ifdef _WIN32
void setBinaryIO(void)
{
    // Windows defaults to text mode, but we're going to read/write
    // binary data...
    _setmode(_fileno(stdout), _O_BINARY);
    _setmode(_fileno(stdin), _O_BINARY);
}
#endif
