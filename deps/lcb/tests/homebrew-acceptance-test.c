/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#include <internal.h> /* getenv, system, snprintf */

int main(void)
{
#ifndef WIN32
    int status;

    status = system("./tools/cbc version > /dev/null 2>&1");
    if (status == -1 || WIFSIGNALED(status) || WEXITSTATUS(status) != 0) {
        return 1;
    }
    status = system("./tools/cbc help > /dev/null 2>&1");
    if (status == -1 || WIFSIGNALED(status) || WEXITSTATUS(status) != 0) {
        return 1;
    }
#endif
    return 0;
}

