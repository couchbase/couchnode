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

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <event2/event.h>

static void
bootstrap_callback(lcb_t instance, lcb_error_t err)
{
    lcb_CMDSTORE cmd = { 0 };
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "ERROR: %s\n", lcb_strerror(instance, err));
        exit(EXIT_FAILURE);
    }
    /* Since we've got our configuration, let's go ahead and store a value */
    LCB_CMD_SET_KEY(&cmd, "foo", 3);
    LCB_CMD_SET_VALUE(&cmd, "bar", 3);
    cmd.operation = LCB_SET;
    err = lcb_store3(instance, NULL, &cmd);
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Failed to set up store request: %s\n", lcb_strerror(instance, err));
        exit(EXIT_FAILURE);
    }
}

static void get_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    const lcb_RESPGET *rg = (const lcb_RESPGET *)rb;
    if (rg->rc != LCB_SUCCESS) {
        fprintf(stderr, "Failed to get key: %s\n", lcb_strerror(instance, rg->rc));
        exit(EXIT_FAILURE);
    }

    fprintf(stdout, "I stored and retrieved the key 'foo'. Value: %.*s. Terminate program\n", (int)rg->nvalue, rg->value);
    event_base_loopbreak((void *)lcb_get_cookie(instance));
    (void)cbtype;
}

static void store_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    lcb_error_t rc;
    lcb_CMDGET gcmd =  { 0 };

    if (rb->rc != LCB_SUCCESS) {
        fprintf(stderr, "Failed to store key: %s\n", lcb_strerror(instance, rb->rc));
        exit(EXIT_FAILURE);
    }

    LCB_CMD_SET_KEY(&gcmd, rb->key, rb->nkey);
    rc = lcb_get3(instance, NULL, &gcmd);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "Failed to schedule get request: %s\n", lcb_strerror(NULL, rc));
        exit(EXIT_FAILURE);
    }
    (void)cbtype;
}

static lcb_io_opt_t
create_libevent_io_ops(struct event_base *evbase)
{
    struct lcb_create_io_ops_st ciops;
    lcb_io_opt_t ioops;
    lcb_error_t error;

    memset(&ciops, 0, sizeof(ciops));
    ciops.v.v0.type = LCB_IO_OPS_LIBEVENT;
    ciops.v.v0.cookie = evbase;

    error = lcb_create_io_ops(&ioops, &ciops);
    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create an IOOPS structure for libevent: %s\n", lcb_strerror(NULL, error));
        exit(EXIT_FAILURE);
    }

    return ioops;
}

static lcb_t
create_libcouchbase_handle(lcb_io_opt_t ioops)
{
    lcb_t instance;
    lcb_error_t error;
    struct lcb_create_st copts;

    memset(&copts, 0, sizeof(copts));

    /* If NULL, will default to localhost */
    copts.v.v0.host = getenv("LCB_EVENT_SERVER");
    copts.v.v0.io = ioops;
    error = lcb_create(&instance, &copts);

    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create a libcouchbase instance: %s\n", lcb_strerror(NULL, error));
        exit(EXIT_FAILURE);
    }

    /* Set up the callbacks */
    lcb_set_bootstrap_callback(instance, bootstrap_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_GET, get_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, store_callback);

    if ((error = lcb_connect(instance)) != LCB_SUCCESS) {
        fprintf(stderr, "Failed to connect libcouchbase instance: %s\n", lcb_strerror(NULL, error));
        lcb_destroy(instance);
        exit(EXIT_FAILURE);
    }

    return instance;
}

/* This example shows how we can hook ourself into an external event loop.
 * You may find more information in the blogpost: http://goo.gl/fCTrX */
int main(void)
{
    struct event_base *evbase = event_base_new();
    lcb_io_opt_t ioops = create_libevent_io_ops(evbase);
    lcb_t instance = create_libcouchbase_handle(ioops);

    /*Store the event base as the user cookie in our instance so that
     * we may terminate the program when we're done */
    lcb_set_cookie(instance, evbase);

    /* Run the event loop */
    event_base_loop(evbase, 0);

    /* Cleanup */
    event_base_free(evbase);
    lcb_destroy(instance);
    exit(EXIT_SUCCESS);
}
