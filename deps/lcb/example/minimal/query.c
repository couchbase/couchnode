/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018-2020 Couchbase, Inc.
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
   make query

 */

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/ixmgmt.h>

static void check(lcb_STATUS err, const char *msg)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "[\x1b[31mERROR\x1b[0m] %s: %s\n", msg, lcb_strerror_short(err));
        exit(EXIT_FAILURE);
    }
}

static int err2color(lcb_STATUS err)
{
    switch (err) {
        case LCB_SUCCESS:
            return 32;
        case LCB_ERR_DOCUMENT_EXISTS:
            return 33;
        default:
            return 31;
    }
}

static void ln2space(const void *buf, size_t nbuf)
{
    size_t ii;
    char *str = (char *)buf;
    for (ii = 0; ii < nbuf; ii++) {
        if (str[ii] == '\n') {
            str[ii] = ' ';
        }
    }
}

static void row_callback(lcb_INSTANCE *instance, int type, const lcb_RESPQUERY *resp)
{
    const char *row;
    size_t nrow;
    lcb_STATUS rc = lcb_respquery_status(resp);

    lcb_respquery_row(resp, &row, &nrow);
    ln2space(row, nrow);
    fprintf(stderr, "[\x1b[%dmQUERY\x1b[0m] %s, (size=%d) %.*s\n", err2color(rc), lcb_strerror_short(rc), (int)nrow,
            (int)nrow, row);
    if (lcb_respquery_is_final(resp)) {
        fprintf(stderr, "\n");
    }
}

static void idx_callback(lcb_INSTANCE *instance, int type, const lcb_RESPN1XMGMT *resp)
{
    const lcb_RESPQUERY *inner = resp->inner;
    const char *row;
    size_t nrow;

    lcb_respquery_row(inner, &row, &nrow);
    ln2space(row, nrow);
    fprintf(stderr, "[\x1b[%dmINDEX\x1b[0m] %s, (%d) %.*s\n", err2color(resp->rc), lcb_strerror_short(resp->rc),
            (int)nrow, (int)nrow, row);
}

static void store_callback(lcb_INSTANCE *instance, int type, const lcb_RESPSTORE *resp)
{
    lcb_STATUS rc = lcb_respstore_status(resp);
    const char *key;
    size_t nkey;
    lcb_respstore_key(resp, &key, &nkey);
    fprintf(stderr, "[\x1b[%dm%-5s\x1b[0m] %s, key=%.*s\n", err2color(rc), lcb_strcbtype(type), lcb_strerror_short(rc),
            (int)nkey, key);
}

static void get_callback(lcb_INSTANCE *instance, int type, const lcb_RESPGET *resp)
{
    lcb_STATUS rc;
    const char *key;
    size_t nkey;

    rc = lcb_respget_status(resp);
    lcb_respget_key(resp, &key, &nkey);
    fprintf(stderr, "[\x1b[%dm%-5s\x1b[0m] %s, key=%.*s\n", err2color(rc), lcb_strcbtype(type), lcb_strerror_short(rc),
            (int)nkey, key);
}

static int running = 1;
static void sigint_handler(int unused)
{
    running = 0;
}

int main(int argc, char *argv[])
{
    lcb_INSTANCE *instance;
    char *bucket = NULL;
    const char *key = "user:king_arthur";
    const char *val = "{"
                      "  \"email\": \"kingarthur@couchbase.com\","
                      "  \"interests\": [\"Holy Grail\", \"African Swallows\"]"
                      "}";

    if (argc < 2) {
        fprintf(stderr, "Usage: %s couchbase://host/bucket [ password [ username ] ]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    {
        lcb_CREATEOPTS *options = NULL;
        lcb_createopts_create(&options, LCB_TYPE_BUCKET);
        lcb_createopts_connstr(options, argv[1], strlen(argv[1]));
        if (argc > 3) {
            lcb_createopts_credentials(options, argv[3], strlen(argv[3]), argv[2], strlen(argv[2]));
        }
        check(lcb_create(&instance, options), "create couchbase handle");
        lcb_createopts_destroy(options);
        check(lcb_connect(instance), "schedule connection");
        lcb_wait(instance, LCB_WAIT_DEFAULT);
        check(lcb_get_bootstrap_status(instance), "bootstrap from cluster");
        check(lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &bucket), "get bucket name");
        lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
        lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    }

    {
        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key, strlen(key));
        lcb_cmdstore_value(cmd, val, strlen(val));
        check(lcb_store(instance, NULL, cmd), "schedule STORE operation");
        lcb_cmdstore_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }

    {
        lcb_CMDGET *cmd;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key, strlen(key));
        check(lcb_get(instance, NULL, cmd), "schedule GET operation");
        lcb_cmdget_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }

    {
        lcb_CMDQUERY *cmd;
        char query[1024] = {0};
        lcb_cmdquery_create(&cmd);
        snprintf(query, sizeof(query), "CREATE PRIMARY INDEX ON `%s` USING gsi", bucket);
        check(lcb_cmdquery_statement(cmd, query, strlen(query)), "set QUERY statement");
        lcb_cmdquery_callback(cmd, row_callback);
        check(lcb_query(instance, NULL, cmd), "schedule QUERY INDEX create operation");
        lcb_cmdquery_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }

    /* setup CTRL-C handler */
    struct sigaction action;
    sigemptyset(&action.sa_mask);
    action.sa_handler = sigint_handler;
    action.sa_flags = 0;
    sigaction(SIGINT, &action, NULL);

    while (running) {
        lcb_CMDQUERY *cmd;
        char query[1024] = {0};
        const char *params = "[\"African Swallows\"]";
        lcb_cmdquery_create(&cmd);

        snprintf(query, sizeof(query), "SELECT * FROM `%s` WHERE $1 in interests LIMIT 1", bucket);
        check(lcb_cmdquery_statement(cmd, query, strlen(query)), "set QUERY statement");
        check(lcb_cmdquery_positional_params(cmd, params, strlen(params)), "set QUERY positional parameters");
        check(lcb_cmdquery_option(cmd, "pretty", strlen("pretty"), "false", strlen("false")),
              "set QUERY 'pretty' option");
        lcb_cmdquery_callback(cmd, row_callback);
        check(lcb_query(instance, NULL, cmd), "schedule QUERY operation");
        lcb_cmdquery_destroy(cmd);
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }

    /* Now that we're all done, close down the connection handle */
    lcb_destroy(instance);
    return 0;
}
