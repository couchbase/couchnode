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

static void error_callback(lcb_t instance, lcb_error_t error, const char *errinfo)
{
    fprintf(stderr, "ERROR: %s (0x%x), %s\n",
            lcb_strerror(instance, error), error, errinfo);
    exit(EXIT_FAILURE);
}

static void store_callback(lcb_t instance, const void *cookie,
                           lcb_storage_t operation,
                           lcb_error_t error,
                           const lcb_store_resp_t *item)
{
    if (error == LCB_SUCCESS) {
        fprintf(stderr, "STORED \"");
        fwrite(item->v.v0.key, sizeof(char), item->v.v0.nkey, stderr);
        fprintf(stderr, "\" CAS: %"PRIu64"\n", item->v.v0.cas);
    } else {
        fprintf(stderr, "STORE ERROR: %s (0x%x)\n",
                lcb_strerror(instance, error), error);
        exit(EXIT_FAILURE);
    }
    (void)cookie;
    (void)operation;
}

static void get_callback(lcb_t instance, const void *cookie, lcb_error_t error,
                         const lcb_get_resp_t *item)
{
    if (error == LCB_SUCCESS) {
        lcb_get_cmd_t cmd;
        lcb_error_t err;
        const lcb_get_cmd_t *commands[1];
        commands[0] = &cmd;
        memset(&cmd, 0, sizeof(cmd));
        cmd.v.v0.key = item->v.v0.key;
        cmd.v.v0.nkey = item->v.v0.nkey;
        err = lcb_get(instance, NULL, 1, commands);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to get: %s\n", lcb_strerror(NULL, err));
            exit(EXIT_FAILURE);
        }
    } else {
        fprintf(stderr, "GET ERROR: %s (0x%x)\n",
                lcb_strerror(instance, error), error);
        exit(EXIT_FAILURE);
    }
    (void)cookie;
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

    if (argc > 1) {
        key = argv[1];
        nkey = strlen(key);
    }
    if (argc > 2) {
        nbytes = atol(argv[2]);
    }
    if (argc > 3) {
        create_options.v.v0.host = argv[3];
    }
    if (argc > 4) {
        create_options.v.v0.user = argv[4];
        create_options.v.v0.bucket = argv[4];
    }
    if (argc > 5) {
        create_options.v.v0.passwd = argv[5];
    }

    INSTALL_SIGINT_HANDLER();

    err = lcb_create(&instance, &create_options);
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create libcouchbase instance: %s\n",
                lcb_strerror(NULL, err));
        exit(EXIT_FAILURE);
    }
    (void)lcb_set_error_callback(instance, error_callback);
    /* Initiate the connect sequence in libcouchbase */
    if ((err = lcb_connect(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to initiate connect: %s\n",
                lcb_strerror(NULL, err));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }
    (void)lcb_set_get_callback(instance, get_callback);
    (void)lcb_set_store_callback(instance, store_callback);
    /* Run the event loop and wait until we've connected */
    lcb_wait(instance);

    fprintf(stderr, "key: \"%s\"\n", key);
    fprintf(stderr, "value size: %ld\n", nbytes);
    fprintf(stderr, "host: %s\n", lcb_get_host(instance));
    fprintf(stderr, "port: %s\n", lcb_get_port(instance));
    fprintf(stderr, "bucket: %s\n", create_options.v.v0.bucket ? create_options.v.v0.bucket : "default");
    fprintf(stderr, "password: %s\n", create_options.v.v0.passwd);
    bytes = malloc(nbytes);

    {
        lcb_store_cmd_t cmd;
        const lcb_store_cmd_t *commands[1];

        commands[0] = &cmd;
        memset(&cmd, 0, sizeof(cmd));
        cmd.v.v0.operation = LCB_SET;
        cmd.v.v0.key = key;
        cmd.v.v0.nkey = nkey;
        cmd.v.v0.bytes = bytes;
        cmd.v.v0.nbytes = nbytes;
        err = lcb_store(instance, NULL, 1, commands);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to store: %s\n", lcb_strerror(NULL, err));
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait(instance);
    fprintf(stderr, "Benchmarking... CTRL-C to stop\n");
    {
        lcb_get_cmd_t cmd;
        const lcb_get_cmd_t *commands[1];
        commands[0] = &cmd;
        memset(&cmd, 0, sizeof(cmd));
        cmd.v.v0.key = key;
        cmd.v.v0.nkey = nkey;
        err = lcb_get(instance, NULL, 1, commands);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to get: %s\n", lcb_strerror(NULL, err));
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait(instance);
    lcb_destroy(instance);

    exit(EXIT_SUCCESS);
}
