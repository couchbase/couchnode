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
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <libcouchbase/couchbase.h>
#include <event2/event.h>

static void error_callback(lcb_t instance,
                           lcb_error_t error,
                           const char *errinfo)
{
    fprintf(stderr, "ERROR: %s %s\n", lcb_strerror(instance, error), errinfo);
    exit(EXIT_FAILURE);
}

static void configuration_callback(lcb_t instance, lcb_configuration_t config)
{
    if (config == LCB_CONFIGURATION_NEW) {
        lcb_error_t err;
        /* Since we've got our configuration, let's go ahead and store a value */
        lcb_store_cmd_t cmd;
        const lcb_store_cmd_t *cmds[1];
        cmds[0] = &cmd;
        memset(&cmd, 0, sizeof(cmd));
        cmd.v.v0.key = "foo";
        cmd.v.v0.nkey = 3;
        cmd.v.v0.bytes = "bar";
        cmd.v.v0.nbytes = 3;
        cmd.v.v0.operation = LCB_SET;
        err = lcb_store(instance, NULL, 1, cmds);
        if (err != LCB_SUCCESS) {
            fprintf(stderr, "Failed to set up store request: %s\n",
                    lcb_strerror(instance, err));
            exit(EXIT_FAILURE);
        }
    }
}

static void get_callback(lcb_t instance,
                         const void *cookie,
                         lcb_error_t error,
                         const lcb_get_resp_t *resp)
{
    (void)cookie;
    (void)resp;

    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to get key: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "I stored and retrieved the key \"foo\". Terminate program\n");
    event_base_loopbreak((void *)lcb_get_cookie(instance));
}

static void store_callback(lcb_t instance,
                           const void *cookie,
                           lcb_storage_t operation,
                           lcb_error_t error,
                           const lcb_store_resp_t *resp)
{
    lcb_get_cmd_t cmd;
    const lcb_get_cmd_t *cmds[1];

    cmds[0] = &cmd;
    (void)cookie;
    (void)operation;
    (void)resp;

    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to store key: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }

    /* Time to read it back */
    memset(&cmd, 0, sizeof(cmd));
    cmd.v.v0.key = "foo";
    cmd.v.v0.nkey = 3;
    if ((error = lcb_get(instance, NULL, 1, cmds)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to setup get request: %s\n",
                lcb_strerror(instance, error));
        exit(EXIT_FAILURE);
    }
}

static lcb_io_opt_t create_libevent_io_ops(struct event_base *evbase)
{
    struct lcb_create_io_ops_st ciops;
    lcb_io_opt_t ioops;
    lcb_error_t error;

    memset(&ciops, 0, sizeof(ciops));
    ciops.v.v0.type = LCB_IO_OPS_LIBEVENT;
    ciops.v.v0.cookie = evbase;

    error = lcb_create_io_ops(&ioops, &ciops);
    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create an IOOPS structure for libevent: %s\n",
                lcb_strerror(NULL, error));
        exit(EXIT_FAILURE);
    }

    return ioops;
}

static lcb_t create_libcouchbase_handle(lcb_io_opt_t ioops)
{
    lcb_t instance;
    lcb_error_t error;
    struct lcb_create_st copts;

    memset(&copts, 0, sizeof(copts));
    /*
     * The only field I want to set in the first version of the
     * connect option is the hostname (to connect to the default
     * bucket and use the default IO option (Note: if getenv
     * returns NULL or an empty string we'll connect to
     * localhost:8091)
     */
    copts.v.v0.host = getenv("LCB_EVENT_SERVER");
    copts.v.v0.io = ioops;

    if ((error = lcb_create(&instance, &copts)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create a libcouchbase instance: %s\n",
                lcb_strerror(NULL, error));
        exit(EXIT_FAILURE);
    }

    /* Set up the callbacks */
    lcb_set_error_callback(instance, error_callback);
    lcb_set_configuration_callback(instance, configuration_callback);
    lcb_set_get_callback(instance, get_callback);
    lcb_set_store_callback(instance, store_callback);

    if ((error = lcb_connect(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to connect libcouchbase instance: %s\n",
                lcb_strerror(NULL, error));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }

    return instance;
}

/*
 * This example shows how we can hook ourself into an external event loop.
 * You may find more information in the blogpost: http://goo.gl/fCTrX
 */
int main(void)
{
    struct event_base *evbase = event_base_new();
    lcb_io_opt_t ioops = create_libevent_io_ops(evbase);
    lcb_t instance = create_libcouchbase_handle(ioops);

    /*
     * Store the event base as the user cookie in our instance so that
     * we may terminate the program when we're done
     */
    lcb_set_cookie(instance, evbase);

    /*
     * Run the event loop.
     */
    event_base_loop(evbase, 0);

    /* Cleanup */
    event_base_free(evbase);
    lcb_destroy(instance);
    exit(EXIT_SUCCESS);
}
