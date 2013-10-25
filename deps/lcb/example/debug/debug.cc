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
#include <libcouchbase/debug.h>
#include <cstdlib>

using namespace std;

/**
 * This is just an example program intended to show you how to use
 * the debug functionalities of libcouchbase
 */

static void dumpHttpCommand(void) {
    lcb_http_cmd_t http_cmd("/foo/bar", 8, NULL, 0, LCB_HTTP_METHOD_POST,
                            1, "applicaiton/json");
    cout << http_cmd << endl;
}

int main(void)
{
    dumpHttpCommand();
    exit(EXIT_SUCCESS);
}
