/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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
 *      ./db key size <host:port> <bucket> <passwd>
 *      db.exe key size <host:port> <bucket> <passwd>
 */
#include <stdio.h>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
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

static void store_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    if (rb->rc != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't perform initial storage: %s\n", lcb_strerror(NULL, rb->rc));
        exit(EXIT_FAILURE);
    }
    (void)cbtype; /* unused argument */
}

static void get_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    if (rb->rc == LCB_SUCCESS) {
        lcb_CMDGET gcmd = { 0 };
        lcb_error_t rc;
        LCB_CMD_SET_KEY(&gcmd, rb->key, rb->nkey);
        rc = lcb_get3(instance, NULL, &gcmd);
        if (rc != LCB_SUCCESS) {
            fprintf(stderr, "Failed to schedule get operation: %s\n", lcb_strerror(NULL, rc));
            exit(EXIT_FAILURE);
        }
    } else {
        fprintf(stderr, "Failed to retrieve key: %s\n", lcb_strerror(NULL, rb->rc));
    }
}

int main(int argc, char *argv[])
{
    lcb_error_t err;
    lcb_t instance;
    struct lcb_create_st create_options;
    const char *key = "foo";
    size_t nkey = strlen(key);
    void *bytes;
    long nbytes = 6; /* the size of the value */

    memset(&create_options, 0, sizeof(create_options));
    create_options.version = 3;

    if (argc > 1) {
        key = argv[1];
        nkey = strlen(key);
    }
    if (argc > 2) {
        nbytes = atol(argv[2]);
    }
    if (argc > 3) {
        create_options.v.v3.connstr = argv[3];
    }
    if (argc > 4) {
        create_options.v.v3.passwd = argv[4];
    }

    INSTALL_SIGINT_HANDLER();

    err = lcb_create(&instance, &create_options);
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create libcouchbase instance: %s\n", lcb_strerror(NULL, err));
        exit(EXIT_FAILURE);
    }

    /* Initiate the connect sequence in libcouchbase */
    if ((err = lcb_connect(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to initiate connect: %s\n", lcb_strerror(NULL, err));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    if ((err = lcb_get_bootstrap_status(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't establish connection to cluster: %s\n", lcb_strerror(NULL, err));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }

    lcb_install_callback3(instance, LCB_CALLBACK_GET, get_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, store_callback);

    fprintf(stderr, "key: \"%s\"\n", key);
    fprintf(stderr, "value size: %ld\n", nbytes);
    fprintf(stderr, "connection string: %s\n", create_options.v.v3.connstr ? create_options.v.v3.connstr : "");
    fprintf(stderr, "password: %s\n", create_options.v.v0.passwd ? create_options.v.v3.passwd : "");

    bytes = malloc(nbytes);

    {
        lcb_CMDSTORE cmd = { 0 };
        cmd.operation = LCB_SET;
        LCB_CMD_SET_KEY(&cmd, key, nkey);
        LCB_CMD_SET_VALUE(&cmd, bytes, nbytes);
        err = lcb_store3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to store: %s\n", lcb_strerror(NULL, err));
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    fprintf(stderr, "Benchmarking... CTRL-C to stop\n");
    {
        lcb_CMDGET cmd = { 0 };
        LCB_CMD_SET_KEY(&cmd, key, nkey);
        err = lcb_get3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to get: %s\n", lcb_strerror(NULL, err));
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait3(instance, LCB_WAIT_NOCHECK);
    lcb_destroy(instance);

    exit(EXIT_SUCCESS);
}
