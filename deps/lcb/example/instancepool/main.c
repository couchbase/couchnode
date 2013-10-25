/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#include "pool.h"
#include <stdlib.h>
#include <stdio.h>

/**
 * This is a function called from the instance pool when it creates
 * a new instance. The purpose of the function is to allow the
 * user of a pool to set up the callbacks on the instances as part
 * of the creation of the pool.
 *
 * Please note that you can still set the callbacks every time you
 * grab an instance from the pool, but it is a good practice to keep
 * the instances in the pool in a "well known state" (so that the
 * users of the pool knows what to expect when they grab an instance
 *
 * @param instance this is the newly created instance to initiate.
 */
static void initiate(lcb_t instance) {
    /*
     * attach all of the callbacks you want. Let's for instance just
     * set it to sync mode
     */
    lcb_behavior_set_syncmode(instance, LCB_SYNCHRONOUS);
}

int main(void) {
    lcb_pool_t pool;
    lcb_t instance;
    struct lcb_create_st options;
    lcb_error_t error;

    /* set up the options to represent your cluster (hostname etc) */
    /* ... */

    /* Create the pool */
    error = pool_create(10, &options, &pool, initiate);
    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create pool: %s\n",
                lcb_strerror(NULL, error));
        exit(EXIT_FAILURE);
    }

    /*
     * Every time you want to use libcouchbase you would grab an instance
     * from the pool by:
     */
    instance = pool_pop(pool);

    /* use the instance for whatever you wanted to do */


    /*
     * When you're done using the instance you would put it back into the
     * pool (and ready for others to use) by:
     */
    pool_push(pool, instance);

    return 0;
}
