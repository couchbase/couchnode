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

#include <stdio.h>
#include <libcouchbase/couchbase.h>
#include <stdlib.h>
#include <string.h> /* strlen */
#ifdef _WIN32
#define PRIx64 "I64x"
#else
#include <inttypes.h>
#endif

static void check(lcb_STATUS err, const char *msg)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "[\x1b[31mERROR\x1b[0m] %s: %s\n", msg, lcb_strerror_short(err));
        exit(EXIT_FAILURE);
    }
}

static void open_callback(lcb_INSTANCE *instance, lcb_STATUS rc)
{
    printf("[\x1b[%dmOPEN\x1b[0m] %s\n", rc == LCB_SUCCESS ? 32 : 31, lcb_strerror_short(rc));
    fflush(stdout);
}

static void row_callback(lcb_INSTANCE *instance, int type, const lcb_RESPQUERY *resp)
{
    const char *row;
    size_t nrow;

    lcb_respquery_row(resp, &row, &nrow);
    printf("[\x1b[%dmQUERY-%s\x1b[0m] %d bytes\n%.*s\n", lcb_respquery_status(resp) == LCB_SUCCESS ? 32 : 31,
           lcb_respquery_is_final(resp) ? "META" : "ROW", (int)nrow, (int)nrow, row);
    fflush(stdout);
}

static void store_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPSTORE *resp)
{
    check(lcb_respstore_status(resp), "store the document");

    const char *key;
    size_t nkey;
    uint64_t cas;
    lcb_respstore_key(resp, &key, &nkey);
    lcb_respstore_cas(resp, &cas);
    printf("[\x1b[32mSTORE\x1b[0m] %.*s, CAS: 0x%" PRIx64 "\n", (int)nkey, key, cas);
    fflush(stdout);
}

static void get_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPGET *resp)
{
    check(lcb_respget_status(resp), "get the document");

    const char *key, *value;
    size_t nkey, nvalue;
    uint64_t cas;
    uint32_t flags;
    lcb_respget_key(resp, &key, &nkey);
    lcb_respget_cas(resp, &cas);
    lcb_respget_value(resp, &value, &nvalue);
    lcb_respget_flags(resp, &flags);
    printf("[\x1b[32mGET\x1b[0m] %.*s, CAS: 0x%" PRIx64 ", FLAGS: 0x%08x\n", (int)nkey, key, cas, flags);
    printf("%.*s\n", (int)nvalue, value);
    fflush(stdout);
}

int main(int argc, char *argv[])
{
    lcb_INSTANCE *instance;
    lcb_CREATEOPTS *options = NULL;
    lcb_CMDGET *gcmd;

    if (argc < 4) {
        fprintf(stderr, "Usage: %s couchbase://127.0.0.1 Administrator password [bucket]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    lcb_createopts_create(&options, LCB_TYPE_CLUSTER);
    lcb_createopts_connstr(options, argv[1], strlen(argv[1]));
    lcb_createopts_credentials(options, argv[2], strlen(argv[2]), argv[3], strlen(argv[3]));

    check(lcb_create(&instance, options), "create couchbase handle");
    lcb_createopts_destroy(options);
    check(lcb_connect(instance), "schedule connection");
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    check(lcb_get_bootstrap_status(instance), "bootstrap from cluster");

    {
        lcb_CMDQUERY *cmd;
        const char *query = "SELECT CLOCK_LOCAL() AS now";

        lcb_cmdquery_create(&cmd);
        check(lcb_cmdquery_statement(cmd, query, strlen(query)), "set QUERY statement");
        check(lcb_cmdquery_pretty(cmd, 0), "set QUERY statement");
        lcb_cmdquery_callback(cmd, row_callback);
        check(lcb_query(instance, NULL, cmd), "schedule QUERY operation");
        lcb_cmdquery_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }

    if (argc > 4) {
        const char *bucket = argv[4];

        {
            lcb_set_open_callback(instance, open_callback);
            check(lcb_open(instance, bucket, strlen(bucket)), "schedule bucket opening");
            lcb_wait(instance, LCB_WAIT_DEFAULT);
        }

        {
            lcb_CMDSTORE *cmd;
            lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
            lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
            lcb_cmdstore_key(cmd, "key", strlen("key"));
            lcb_cmdstore_value(cmd, "value", strlen("value"));
            check(lcb_store(instance, NULL, cmd), "schedule storage operation");
            lcb_cmdstore_destroy(cmd);
            lcb_wait(instance, LCB_WAIT_DEFAULT);
        }

        {
            lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
            lcb_cmdget_create(&gcmd);
            lcb_cmdget_key(gcmd, "key", strlen("key"));
            check(lcb_get(instance, NULL, gcmd), "schedule retrieval operation");
            lcb_cmdget_destroy(gcmd);
            lcb_wait(instance, LCB_WAIT_DEFAULT);
        }
    }

    /* Now that we're all done, close down the connection handle */
    lcb_destroy(instance);
    return 0;
}
