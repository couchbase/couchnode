/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2020 Couchbase, Inc.
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

/* Dumb Benchmark. This application is using libcouchbase to store
 * single key and then get this key back infinitely.
 *
 * BUILD:
 *
 *      cc -o db db.c -lcouchbase
 *      cl /DWIN32 /Iinclude db.c lib\libcouchbase.lib
 *
 * RUN:
 *
 *      valgrind -v --tool=memcheck  --leak-check=full --show-reachable=yes ./db
 *      ./db key size <host:port> <bucket> <passwd> <username>
 *      db.exe key size <host:port> <bucket> <passwd> <username>
 */
#include <stdio.h>
#include <libcouchbase/couchbase.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#ifdef _WIN32
#define PRIu64 "I64u"
#else
#include <signal.h>
#include <inttypes.h>
#endif

#ifndef _WIN32
static void handle_sigint(int sig)
{
    (void)sig;
    printf("Exiting on SIGINT\n");
    exit(0);
}

#define INSTALL_SIGINT_HANDLER() signal(SIGINT, handle_sigint)
#else
#define INSTALL_SIGINT_HANDLER()
#endif

static void store_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPSTORE *resp)
{
    lcb_STATUS rc = lcb_respstore_status(resp);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't perform initial storage: %s\n", lcb_strerror_short(rc));
        exit(EXIT_FAILURE);
    }
    (void)cbtype; /* unused argument */
}

static void get_callback(lcb_INSTANCE *instance, int cbtype, const lcb_RESPGET *resp)
{
    const char *key;
    size_t nkey;
    lcb_STATUS rc;

    rc = lcb_respget_status(resp);
    if (rc == LCB_SUCCESS) {
        lcb_CMDGET *gcmd;
        lcb_respget_key(resp, &key, &nkey);
        lcb_cmdget_create(&gcmd);
        lcb_cmdget_key(gcmd, key, nkey);
        rc = lcb_get(instance, NULL, gcmd);
        lcb_cmdget_destroy(gcmd);
        if (rc != LCB_SUCCESS) {
            fprintf(stderr, "Failed to schedule get operation: %s\n", lcb_strerror_short(rc));
            exit(EXIT_FAILURE);
        }
    } else {
        fprintf(stderr, "Failed to retrieve key: %s\n", lcb_strerror_short(rc));
    }
}

int main(int argc, char *argv[])
{
    lcb_STATUS err;
    lcb_INSTANCE *instance;
    lcb_CREATEOPTS *create_options;
    const char *key = "foo";
    size_t nkey = strlen(key);
    void *bytes;
    long nbytes = 6; /* the size of the value */

    if (argc > 1) {
        key = argv[1];
        nkey = strlen(key);
    }
    if (argc > 2) {
        nbytes = atol(argv[2]);
    }
    lcb_createopts_create(&create_options, LCB_TYPE_BUCKET);
    if (argc > 3) {
        fprintf(stderr, "connection string: %s\n", argv[3]);
        lcb_createopts_connstr(create_options, argv[3], strlen(argv[3]));
    }
    if (argc > 5) {
        fprintf(stderr, "username: %s\n", argv[5]);
        fprintf(stderr, "password: %s\n", argv[4]);
        lcb_createopts_credentials(create_options, argv[5], strlen(argv[5]), argv[4], strlen(argv[4]));
    }

    INSTALL_SIGINT_HANDLER();

    err = lcb_create(&instance, create_options);
    lcb_createopts_destroy(create_options);
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create libcouchbase instance: %s\n", lcb_strerror_short(err));
        exit(EXIT_FAILURE);
    }

    /* Initiate the connect sequence in libcouchbase */
    if ((err = lcb_connect(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to initiate connect: %s\n", lcb_strerror_short(err));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    if ((err = lcb_get_bootstrap_status(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't establish connection to cluster: %s\n", lcb_strerror_short(err));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }

    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);

    fprintf(stderr, "key: \"%s\"\n", key);
    fprintf(stderr, "value size: %ld\n", nbytes);

    bytes = malloc(nbytes);

    {
        lcb_CMDSTORE *cmd;
        lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
        lcb_cmdstore_key(cmd, key, nkey);
        lcb_cmdstore_value(cmd, bytes, nbytes);
        err = lcb_store(instance, NULL, cmd);
        lcb_cmdstore_destroy(cmd);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to store: %s\n", lcb_strerror_short(err));
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait(instance, LCB_WAIT_NOCHECK);
    fprintf(stderr, "Benchmarking... CTRL-C to stop\n");
    while (1) {
        lcb_CMDGET *cmd;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key, nkey);
        err = lcb_get(instance, NULL, cmd);
        lcb_cmdget_destroy(cmd);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to schedule get operation: %s\n", lcb_strerror_short(err));
            exit(EXIT_FAILURE);
        }
        lcb_wait(instance, LCB_WAIT_NOCHECK);
        fprintf(stderr, "retry\n");
    }
    lcb_destroy(instance);

    exit(EXIT_SUCCESS);
}
