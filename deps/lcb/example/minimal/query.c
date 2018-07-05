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
   make query

 */

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include <libcouchbase/ixmgmt.h>

static void check(lcb_error_t err, const char *msg)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "[\x1b[31mERROR\x1b[0m] %s: %s\n", msg, lcb_strerror_short(err));
        exit(EXIT_FAILURE);
    }
}

static int err2color(lcb_error_t err)
{
    switch (err) {
        case LCB_SUCCESS:
            return 32;
        case LCB_KEY_EEXISTS:
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

static void row_callback(lcb_t instance, int type, const lcb_RESPN1QL *resp)
{
    ln2space(resp->row, resp->nrow);
    fprintf(stderr, "[\x1b[%dmQUERY\x1b[0m] %s, (%d) %.*s\n", err2color(resp->rc), lcb_strerror_short(resp->rc),
            (int)resp->nrow, (int)resp->nrow, (char *)resp->row);
    if (resp->rflags & LCB_RESP_F_FINAL) {
        fprintf(stderr, "\n");
    }
}

static void idx_callback(lcb_t instance, int type, const lcb_RESPN1XMGMT *resp)
{
    const lcb_RESPN1QL *inner = resp->inner;
    ln2space(inner->row, inner->nrow);
    fprintf(stderr, "[\x1b[%dmINDEX\x1b[0m] %s, (%d) %.*s\n", err2color(resp->rc), lcb_strerror_short(resp->rc),
            (int)inner->nrow, (int)inner->nrow, (char *)inner->row);
}

static void kv_callback(lcb_t instance, int type, const lcb_RESPBASE *resp)
{
    fprintf(stderr, "[\x1b[%dm%-5s\x1b[0m] %s, key=%.*s\n", err2color(resp->rc), lcb_strcbtype(type),
            lcb_strerror_short(resp->rc), (int)resp->nkey, resp->key);
}

static int running = 1;
static void sigint_handler(int unused)
{
    running = 0;
}

int main(int argc, char *argv[])
{
    lcb_error_t err;
    lcb_t instance;
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
        lcb_install_callback3(instance, LCB_CALLBACK_GET, kv_callback);
        lcb_install_callback3(instance, LCB_CALLBACK_STORE, kv_callback);
    }

    {
        lcb_CMDSTORE cmd = {0};
        LCB_CMD_SET_KEY(&cmd, key, strlen(key));
        LCB_CMD_SET_VALUE(&cmd, val, strlen(val));
        cmd.operation = LCB_SET;
        check(lcb_store3(instance, NULL, &cmd), "schedule STORE operation");
        lcb_wait(instance);
    }

    {
        lcb_CMDGET cmd = {0};
        LCB_CMD_SET_KEY(&cmd, key, strlen(key));
        check(lcb_get3(instance, NULL, &cmd), "schedule GET operation");
        lcb_wait(instance);
    }

    {
        lcb_CMDN1XMGMT cmd = {0};
        cmd.callback = idx_callback;
        cmd.spec.flags = LCB_N1XSPEC_F_PRIMARY;
        cmd.spec.ixtype = LCB_N1XSPEC_T_GSI;
        check(lcb_n1x_create(instance, NULL, &cmd), "schedule N1QL index creation operation");
        lcb_wait(instance);
    }

    /* setup CTRL-C handler */
    struct sigaction action;
    sigemptyset(&action.sa_mask);
    action.sa_handler = sigint_handler;
    action.sa_flags = 0;
    sigaction(SIGINT, &action, NULL);

    while (running) {
        lcb_CMDN1QL cmd = {0};
        char query[1024] = {0};
        const char *param = "\"African Swallows\"";
        lcb_N1QLPARAMS *builder = lcb_n1p_new();

        snprintf(query, sizeof(query), "SELECT * FROM `%s` WHERE $1 in interests LIMIT 1", bucket);
        check(lcb_n1p_setstmtz(builder, query), "set QUERY statement");
        check(lcb_n1p_posparam(builder, param, strlen(param)), "set QUERY positional parameter");
        check(lcb_n1p_setopt(builder, "pretty", strlen("pretty"), "false", strlen("false")),
              "set QUERY 'pretty' option");
        check(lcb_n1p_mkcmd(builder, &cmd), "build QUERY command structure");
        cmd.callback = row_callback;
        check(lcb_n1ql_query(instance, NULL, &cmd), "schedule QUERY operation");
        lcb_n1p_free(builder);
        lcb_wait(instance);
    }

    /* Now that we're all done, close down the connection handle */
    lcb_destroy(instance);
    return 0;
}
