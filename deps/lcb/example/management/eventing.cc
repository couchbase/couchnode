/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2019-2020 Couchbase, Inc.
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

#include <libcouchbase/couchbase.h>

#include <string>

#include <cstdio>
#include <cstdlib>
#include <cinttypes>

static void check(lcb_STATUS err, const char *msg)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "[\x1b[31mERROR\x1b[0m] %s: %s\n", msg, lcb_strerror_short(err));
        exit(EXIT_FAILURE);
    }
}

void http_callback(lcb_INSTANCE *, int, const lcb_RESPHTTP *resp)
{
    check(lcb_resphttp_status(resp), "HTTP operation status in the callback");

    uint16_t status;
    lcb_resphttp_http_status(resp, &status);
    printf("HTTP status: %d\n", status);

    const char *body;
    size_t body_length = 0;
    lcb_resphttp_body(resp, &body, &body_length);
    if (body_length) {
        printf("%*s\n", (int)body_length, body);
    }
}

int main(int argc, char *argv[])
{
    lcb_INSTANCE *instance;
    lcb_CREATEOPTS *options = nullptr;

    if (argc < 4) {
        fprintf(stderr, "Usage: %s couchbase://127.0.0.1 Administrator password\n", argv[0]);
        exit(EXIT_FAILURE);
    }
    std::string connection_string(argv[1]);
    std::string username(argv[2]);
    std::string password(argv[3]);

    check(lcb_createopts_create(&options, LCB_TYPE_CLUSTER), "build options object for lcb_create");
    check(lcb_createopts_connstr(options, connection_string.c_str(), connection_string.size()),
          "assign connection string");
    check(lcb_createopts_credentials(options, username.c_str(), username.size(), password.c_str(), password.size()),
          "assign credentials");

    check(lcb_create(&instance, options), "create couchbase handle");
    check(lcb_createopts_destroy(options), "destroy options object for lcb_create");
    check(lcb_connect(instance), "schedule connection");
    check(lcb_wait(instance, LCB_WAIT_DEFAULT), "wait for connection");
    check(lcb_get_bootstrap_status(instance), "check bootstrap status");

    std::string get_all_functions_path{"/api/v1/functions"};

    lcb_install_callback(instance, LCB_CALLBACK_HTTP, reinterpret_cast<lcb_RESPCALLBACK>(http_callback));

    lcb_CMDHTTP *cmd = nullptr;
    check(lcb_cmdhttp_create(&cmd, LCB_HTTP_TYPE_EVENTING), "create HTTP command object");
    check(lcb_cmdhttp_method(cmd, LCB_HTTP_METHOD_GET), "set HTTP method");
    check(lcb_cmdhttp_path(cmd, get_all_functions_path.c_str(), get_all_functions_path.size()), "set HTTP path");
    check(lcb_http(instance, nullptr, cmd), "schedule HTTP command");
    check(lcb_wait(instance, LCB_WAIT_DEFAULT), "wait for completion");
    check(lcb_cmdhttp_destroy(cmd), "destroy command object");

    /* Now that we're all done, close down the connection handle */
    lcb_destroy(instance);
    return 0;
}
