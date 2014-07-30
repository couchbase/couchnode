/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2013 Couchbase, Inc.
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
 * @file
 *
 * This is a minimal example file showing how to connect to a cluster and
 * set and retrieve a single item.
 */

#include <stdio.h>
#include <libcouchbase/couchbase.h>
#include <stdlib.h>
#ifdef _WIN32
#define PRIx64 "I64x"
#else
#include <inttypes.h>
#endif

static void
die(lcb_t instance, const char *msg, lcb_error_t err)
{
    fprintf(stderr, "%s. Received code 0x%X (%s)\n",
        msg, err, lcb_strerror(instance, err));
    exit(EXIT_FAILURE);
}

static void
store_callback(lcb_t instance, const void *cookie,
    lcb_storage_t operation, lcb_error_t error, const lcb_store_resp_t *item)
{
    if (error == LCB_SUCCESS) {
        fprintf(stderr, "=== STORED ===\n");
        fprintf(stderr, "KEY: %.*s\n", (int)item->v.v0.nkey, item->v.v0.key);
        fprintf(stderr, "CAS: 0x%"PRIx64"\n", item->v.v0.cas);
    } else {
        die(instance, "Couldn't store item", error);
    }

    (void)operation;
}

static void
get_callback(lcb_t instance, const void *cookie, lcb_error_t error,
    const lcb_get_resp_t *item)
{
    if (error == LCB_SUCCESS) {
        fprintf(stderr, "=== RETRIEVED ===\n");
        fprintf(stderr, "KEY: %.*s\n", (int)item->v.v0.nkey, item->v.v0.key);
        fprintf(stderr, "VALUE: %.*s\n", (int)item->v.v0.nbytes, item->v.v0.bytes);
        fprintf(stderr, "CAS: 0x%"PRIx64"\n", item->v.v0.cas);
        fprintf(stderr, "FLAGS: 0x%x\n", item->v.v0.flags);
    } else {
        die(instance, "Couldn't retrieve", error);
    }
    (void)cookie;
}

int main(int argc, char *argv[])
{
    lcb_error_t err;
    lcb_t instance;
    struct lcb_create_st create_options = { 0 };
    lcb_store_cmd_t scmd = { 0 };
    const lcb_store_cmd_t *scmdlist[1];
    lcb_get_cmd_t gcmd = { 0 };
    const lcb_get_cmd_t *gcmdlist[1];

    create_options.version = 3;

    if (argc < 2) {
        fprintf(stderr, "Usage: %s couchbase://host/bucket [ password ]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    create_options.v.v3.connstr = argv[1];
    if (argc >= 3) {
        create_options.v.v3.passwd = argv[2];
    }

    err = lcb_create(&instance, &create_options);
    if (err != LCB_SUCCESS) {
        die(NULL, "Couldn't create couchbase handle", err);
    }

    err = lcb_connect(instance);
    if (err != LCB_SUCCESS) {
        die(instance, "Couldn't schedule connection", err);
    }

    lcb_wait(instance);

    err = lcb_get_bootstrap_status(instance);
    if (err != LCB_SUCCESS) {
        die(instance, "Couldn't bootstrap from cluster", err);
    }

    /* Assign the handlers to be called for the operation types */
    lcb_set_get_callback(instance, get_callback);
    lcb_set_store_callback(instance, store_callback);

    scmd.v.v0.operation = LCB_SET;
    scmd.v.v0.key = "foo"; scmd.v.v0.nkey = 3;
    scmd.v.v0.bytes = "bar"; scmd.v.v0.nbytes = 3;
    scmdlist[0] = &scmd;

    err = lcb_store(instance, NULL, 1, scmdlist);
    if (err != LCB_SUCCESS) {
        die(instance, "Couldn't schedule storage operation", err);
    }

    /* The store_callback is invoked from lcb_wait() */
    fprintf(stderr, "Will wait for storage operation to complete..\n");
    lcb_wait(instance);

    /* Now fetch the item back */
    gcmd.v.v0.key = "foo";
    gcmd.v.v0.nkey = 3;
    gcmdlist[0] = &gcmd;
    err = lcb_get(instance, NULL, 1, gcmdlist);
    if (err != LCB_SUCCESS) {
        die(instance, "Couldn't schedule retrieval operation", err);
    }

    /* Likewise, the get_callback is invoked from here */
    fprintf(stderr, "Will wait to retrieve item..\n");
    lcb_wait(instance);

    /* Now that we're all done, close down the connection handle */
    lcb_destroy(instance);
    return 0;
}
