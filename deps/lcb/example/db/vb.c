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
 *      ./vb key size <connstr> <passwd>
 *      vb.exe key size <connstr> <passwd>
 */

#include <stdio.h>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <libcouchbase/views.h>
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


static void
store_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    if (rb->rc == LCB_SUCCESS) {
        fprintf(stderr, "STORED \"%.*s\" CAS: %"PRIu64"\n", (int)rb->nkey, rb->key, rb->cas);
    } else {
        fprintf(stderr, "STORE ERROR: %s (0x%x)\n", lcb_strerror(instance, rb->rc), rb->rc);
        exit(EXIT_FAILURE);
    }
    (void)cbtype;
}

const char *view;
const char *design;

static void
do_query_view(lcb_t instance);

static void
viewrow_callback(lcb_t instance, int cbtype, const lcb_RESPVIEWQUERY *resp)
{
    if (resp->rflags & LCB_RESP_F_FINAL) {
        if (resp->rc == LCB_SUCCESS) {
            do_query_view(instance);
        } else {
            fprintf(stderr, "Couldn't query view: %s (0x%x)\n", lcb_strerror(NULL, resp->rc), resp->rc);
            if (resp->htresp != NULL) {
                fprintf(stderr, "HTTP Status: %u\n", resp->htresp->htstatus);
                fprintf(stderr, "HTTP Body: %.*s\n", (int)resp->htresp->nbody, resp->htresp->body);
            }
            exit(EXIT_FAILURE);
        }
    }
    (void)cbtype;
}

static void
http_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *rh = (const lcb_RESPHTTP *)rb;
    fprintf(stderr, "%.*s... %d\n", (int)rb->nkey, rh->key, rh->htstatus);
    if (rh->rc != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't issue HTTP request: %s\n", lcb_strerror(NULL, rh->rc));
        exit(EXIT_FAILURE);
    } else if (rh->htstatus != 201) {
        fprintf(stderr, "Negative reply from server!\n");
        fprintf(stderr, "%*.s\n", (int)rh->nbody, rh->body);
        exit(EXIT_FAILURE);
    }

    (void)cbtype;
}

static void
do_query_view(lcb_t instance)
{
    lcb_CMDVIEWQUERY cmd = { 0 };
    lcb_error_t err;
    lcb_view_query_initcmd(&cmd, design, view, NULL, viewrow_callback);
    cmd.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    err = lcb_view_query(instance, NULL, &cmd);
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't schedule view query: %s\n", lcb_strerror(NULL, err));
        exit(EXIT_FAILURE);
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
    size_t nbytes = 6; /* the size of the value */

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
        fprintf(stderr, "Failed to create libcouchbase instance: %s\n",
                lcb_strerror(NULL, err));
        exit(EXIT_FAILURE);
    }
    /* Initiate the connect sequence in libcouchbase */
    if ((err = lcb_connect(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to initiate connect: %s\n", lcb_strerror(NULL, err));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }
    lcb_wait(instance);
    if ((err = lcb_get_bootstrap_status(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to establish connection to cluster: %s\n", lcb_strerror(NULL, err));
        exit(EXIT_FAILURE);
    }
    lcb_install_callback3(instance, LCB_CALLBACK_HTTP, http_callback);
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
    lcb_wait(instance);

    /* Set view and design name: */
    view = "all";
    design = key;

    {
        char design_path[64] = { 0 };
        char doc[256] = { 0 };
        lcb_CMDHTTP cmd = { 0 };
        sprintf(design_path, "_design/%s", design);
        sprintf(doc, "{\"views\":{\"all\":{\"map\":\"function(doc,meta){if(meta.id=='%s'){emit(meta.id)}}\"}}}", key);

        LCB_CMD_SET_KEY(&cmd, design_path, strlen(design_path));
        cmd.body = doc;
        cmd.nbody = strlen(doc);
        cmd.method = LCB_HTTP_METHOD_PUT;
        cmd.type = LCB_HTTP_TYPE_VIEW;
        cmd.content_type = "application/json";
        err = lcb_http3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to create design document: %s (0x%02x)\n", lcb_strerror(NULL, err), err);
            exit(EXIT_FAILURE);
        }
    }
    lcb_wait(instance);

    do_query_view(instance);
    lcb_wait(instance);
    lcb_destroy(instance);

    exit(EXIT_SUCCESS);
}
