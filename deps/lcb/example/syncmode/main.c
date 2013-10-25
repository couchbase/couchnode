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

#include "config.h"
#include <libcouchbase/couchbase.h>
#include <stdlib.h>
#include <stdio.h>

static const char *key = "mykey";
static const char *value = "myvalue";

static void error_handler(lcb_t instance, lcb_error_t err, const char *info)
{
    fprintf(stderr, "FATAL! an error occured: %s (%s)\n",
            lcb_strerror(instance, err), info ? info : "none");
    exit(EXIT_FAILURE);
}

static lcb_t create_instance(void)
{
    lcb_t instance;
    struct lcb_create_st copt;
    lcb_error_t error;

    memset(&copt, 0, sizeof(copt));
    /*
     * The only field I want to set in the first version of the
     * connect option is the hostname (to connect to the default
     * bucket and use the default IO option (Note: if getenv
     * returns NULL or an empty string we'll connect to
     * localhost:8091)
     */
    copt.v.v0.host = getenv("LCB_SYNCMODE_SERVER");

    if ((error = lcb_create(&instance, &copt)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create libcuchbase instance: %s\n",
                lcb_strerror(NULL, error));
        exit(EXIT_FAILURE);
    }

    lcb_behavior_set_syncmode(instance, LCB_SYNCHRONOUS);
    lcb_set_error_callback(instance, error_handler);

    return instance;
}

static void store_handler(lcb_t instance, const void *cookie,
                          lcb_storage_t operation, lcb_error_t error,
                          const lcb_store_resp_t *resp)
{
    (void)cookie;
    (void)operation;

    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to store the key on the server: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }

    if (resp->version == 0) {
        fprintf(stdout, "Successfully stored \"");
        fwrite(resp->v.v0.key, 1, resp->v.v0.nkey, stdout);
        fprintf(stdout, "\"\n");
    }
}

static void set_key(lcb_t instance)
{
    lcb_store_cmd_t cmd;
    lcb_error_t error;
    const lcb_store_cmd_t *commands[1];

    commands[0] = &cmd;
    memset(&cmd, 0, sizeof(cmd));
    cmd.v.v0.key = key;
    cmd.v.v0.nkey = strlen(key);
    cmd.v.v0.bytes = value;
    cmd.v.v0.nbytes = strlen(value);
    cmd.v.v0.operation = LCB_SET;

    lcb_set_store_callback(instance, store_handler);
    if ((error = lcb_store(instance, NULL, 1, commands)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to store key: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }
}

static void get_handler(lcb_t instance, const void *cookie,
                        lcb_error_t error, const lcb_get_resp_t *resp)
{
    (void)cookie;

    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to read the key from the server: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }

    /* Validate that I read the correct key and value back */
    if (resp->version != 0) {
        fprintf(stderr,
                "WARNING: I don't support this version of libcouchbase\n");
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "I received \"");
    fwrite(resp->v.v0.key, 1, resp->v.v0.nkey, stdout);
    fprintf(stdout, "\" with the value: [");
    fwrite(resp->v.v0.bytes, 1, resp->v.v0.nbytes, stdout);
    fprintf(stdout, "]\n");
}

static void get_key(lcb_t instance)
{
    lcb_get_cmd_t cmd;
    lcb_error_t error;
    const lcb_get_cmd_t *commands[1];

    commands[0] = &cmd;
    memset(&cmd, 0, sizeof(cmd));
    cmd.v.v0.key = key;
    cmd.v.v0.nkey = strlen(key);

    lcb_set_get_callback(instance, get_handler);
    if ((error = lcb_get(instance, NULL, 1, commands)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to get key: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }
}


/**
 * The following programs shows you how you may use libcouchbase
 * in a synchronous way, so that it will block and wait until
 * the operation is performed before the function call returns.
 */
int main(void)
{
    lcb_error_t error;
    lcb_t instance = create_instance();

    if ((error = lcb_connect(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to connect to cluster: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }

    /* Store the key on the server */
    set_key(instance);

    /* Read a key from the server */
    get_key(instance);

    lcb_destroy(instance);
    exit(EXIT_SUCCESS);
}
