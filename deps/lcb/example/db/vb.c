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

/* View Benchmark. This application is using libcouchbase to store
 * single key and then get this key back infinitely through the view
 * through the views.
 *
 * BUILD:
 *
 *      cc -o vb vb.c -lcouchbase
 *      cl /DWIN32 /Iinclude vb.c lib\libcouchbase.lib
 *
 * RUN:
 *
 *      valgrind -v --tool=memcheck  --leak-check=full --show-reachable=yes ./vb
 *      ./vb key size <host:port> <bucket> <passwd>
 *      vb.exe key size <host:port> <bucket> <passwd>
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

char *view = NULL;

static void http_callback(lcb_http_request_t request, lcb_t instance,
                          const void *cookie, lcb_error_t error,
                          const lcb_http_resp_t *resp)
{
    unsigned long id = (unsigned long)cookie + 1;

    if (error == LCB_SUCCESS) {
        if (view) {
            lcb_http_cmd_t cmd;
            lcb_error_t err;

            if (resp->v.v0.status != LCB_HTTP_STATUS_OK) {
                fprintf(stderr, "%ld. HTTP status = %d (must be 200 OK)\n",
                        id, resp->v.v0.status);
            }
            memset(&cmd, 0, sizeof(cmd));
            cmd.v.v0.path = view;
            cmd.v.v0.npath = strlen(view);
            cmd.v.v0.method = LCB_HTTP_METHOD_GET;
            cmd.v.v0.content_type = "application/json";
            err = lcb_make_http_request(instance, (void *)id, LCB_HTTP_TYPE_VIEW, &cmd, NULL);
            if (err != LCB_SUCCESS) {
                fprintf(stderr, "%ld. Failed to fetch view: %s\n",
                        id, lcb_strerror(NULL, err));
                exit(EXIT_FAILURE);
            }
        }
    } else {
        fprintf(stderr, "%ld. HTTP ERROR: %s (0x%x)\n",
                id, lcb_strerror(instance, error), error);
        exit(EXIT_FAILURE);
    }
    (void)request;
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
    (void)lcb_set_http_complete_callback(instance, http_callback);
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

    {
        char *docid;
        char *doc;
        lcb_http_cmd_t cmd;
        lcb_http_request_t req;

        docid = calloc(9 + nkey, sizeof(char));
        if (docid == NULL) {
            fprintf(stderr, "Failed to allocate memory for docid\n");
            exit(EXIT_FAILURE);
        }
        sprintf(docid, "_design/%s", key);
        doc = calloc(81 + nkey, sizeof(char));
        if (doc == NULL) {
            fprintf(stderr, "Failed to allocate memory for doc\n");
            exit(EXIT_FAILURE);
        }
        sprintf(doc, "{\"views\":{\"all\":{\"map\":\"function(doc,meta){if(meta.id=='%s'){emit(meta.id)}}\"}}}", key);
        cmd.version = 0;
        cmd.v.v0.path = docid;
        cmd.v.v0.npath = strlen(docid);
        cmd.v.v0.body = doc;
        cmd.v.v0.nbody = strlen(doc);
        cmd.v.v0.method = LCB_HTTP_METHOD_PUT;
        cmd.v.v0.content_type = "application/json";
        err = lcb_make_http_request(instance, NULL, LCB_HTTP_TYPE_VIEW, &cmd, &req);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to create design document: %s (0x%02x)\n", lcb_strerror(NULL, err), err);
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait(instance);

    view = calloc(37 + nkey, sizeof(char));
    if (view == NULL) {
        fprintf(stderr, "Failed to allocate memory for view\n");
        exit(EXIT_FAILURE);
    }
    sprintf(view, "_design/%s/_view/all?include_docs=true", key);
    fprintf(stderr, "Benchmarking \"%s\"... CTRL-C to stop\n", view);
    {
        lcb_http_cmd_t cmd;

        memset(&cmd, 0, sizeof(cmd));
        cmd.v.v0.path = view;
        cmd.v.v0.npath = strlen(view);
        cmd.v.v0.method = LCB_HTTP_METHOD_GET;
        cmd.v.v0.content_type = "application/json";
        err = lcb_make_http_request(instance, NULL, LCB_HTTP_TYPE_VIEW, &cmd, NULL);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to fetch view: %s\n", lcb_strerror(NULL, err));
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait(instance);
    lcb_destroy(instance);

    exit(EXIT_SUCCESS);
}
