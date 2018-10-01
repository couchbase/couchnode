/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018 Couchbase, Inc.
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

/**

   CFLAGS="-I$(realpath ../../include) -I$(realpath ../../build/generated)"
   LDFLAGS="-L$(realpath ../../build/lib) -lcouchbase -Wl,-rpath=$(realpath ../../build/lib)"
   make analytics

 */

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>

#include "queries.h"
#include "cJSON.h"

static void fail(const char *msg)
{
    printf("[\x1b[31mERROR\x1b[0m] %s\n", msg);
    exit(EXIT_FAILURE);
}

static void check(lcb_error_t err, const char *msg)
{
    if (err != LCB_SUCCESS) {
        char buf[1024] = {0};
        snprintf(buf, sizeof(buf), "%s: %s\n", msg, lcb_strerror_short(err));
        fail(buf);
    }
}

static int err2color(lcb_error_t err)
{
    switch (err) {
        case LCB_SUCCESS:
            return 49;
        default:
            return 31;
    }
}

static void row_callback(lcb_t instance, int type, const lcb_RESPN1QL *resp)
{
    int *idx = (int *)resp->cookie;
    if (resp->rc != LCB_SUCCESS) {
        printf("\x1b[31m%s\x1b[0m", lcb_strerror_short(resp->rc));
        if (resp->htresp) {
            printf(", HTTP status: %d", resp->htresp->htstatus);
        }
        printf("\n");
        if (resp->nrow) {
            cJSON *json;
            char *data = calloc(resp->nrow + 1, sizeof(char));
            memcpy(data, resp->row, resp->nrow);
            json = cJSON_Parse(data);
            if (json && json->type == cJSON_Object) {
                cJSON *errors = cJSON_GetObjectItem(json, "errors");
                if (errors && errors->type == cJSON_Array) {
                    int ii, nerrors = cJSON_GetArraySize(errors);
                    for (ii = 0; ii < nerrors; ii++) {
                        cJSON *err = cJSON_GetArrayItem(errors, ii);
                        if (err && err->type == cJSON_Object) {
                            cJSON *code, *msg;
                            code = cJSON_GetObjectItem(err, "code");
                            msg = cJSON_GetObjectItem(err, "msg");
                            if (code && code->type == cJSON_Number && msg && msg->type == cJSON_String) {
                                printf(
                                    "\x1b[1mcode\x1b[0m: \x1b[31m%d\x1b[0m, \x1b[1mmessage\x1b[0m: \x1b[31m%s\x1b[0m\n",
                                    code->valueint, msg->valuestring);
                            }
                        }
                    }
                }
            }
            free(data);
        }
    }
    if (resp->rflags & LCB_RESP_F_FINAL) {
        printf("\x1b[1mMETA:\x1b[0m ");
    } else {
        printf("\x1b[1mR%d:\x1b[0m ", (*idx)++);
    }
    printf("%.*s\n", (int)resp->nrow, (char *)resp->row);
    if (resp->rflags & LCB_RESP_F_FINAL) {
        printf("\n");
    }
}

int main(int argc, char *argv[])
{
    lcb_error_t err;
    lcb_t instance;
    char *bucket = NULL;
    size_t ii;

    if (argc < 2) {
        printf("Usage: %s couchbase://host/beer-sample [ password [ username ] ]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    {
        struct lcb_create_st create_options = {0};
        create_options.version = 3;
        create_options.v.v3.connstr = argv[1];
        if (argc > 2) {
            create_options.v.v3.passwd = argv[2];
        }
        if (argc > 3) {
            create_options.v.v3.username = argv[3];
        }
        check(lcb_create(&instance, &create_options), "create couchbase handle");
        check(lcb_connect(instance), "schedule connection");
        lcb_wait(instance);
        check(lcb_get_bootstrap_status(instance), "bootstrap from cluster");
        check(lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &bucket), "get bucket name");
        if (strcmp(bucket, "beer-sample") != 0) {
            fail("expected bucket to be \"beer-sample\"");
        }
    }

    for (ii = 0; ii < num_queries; ii++) {
        lcb_CMDN1QL cmd = {0};
        int idx = 0;
        /* NOTE: with this flag, the request will be issued to Analytics service */
        cmd.cmdflags = LCB_CMDN1QL_F_ANALYTICSQUERY;
        cmd.callback = row_callback;
        cmd.query = queries[ii].query;
        cmd.nquery = queries[ii].query_len;
        check(lcb_n1ql_query(instance, &idx, &cmd), "schedule analytics query");
        printf("----> \x1b[1m%s\x1b[0m\n", queries[ii].comment);
        printf("----> \x1b[36m%.*s\x1b[0m\n", (int)queries[ii].query_len, queries[ii].query);
        lcb_wait(instance);
    }

    /* Now that we're all done, close down the connection handle */
    lcb_destroy(instance);
    return 0;
}
