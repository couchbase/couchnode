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
#include <stdio.h>
#include <vector>

using namespace lcb;

extern "C" {
static void
get_callback(lcb_t instance, const void*, lcb_error_t err,
    const lcb_get_resp_t *resp)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "%p: Couldn't get key", instance);
    } else {
        fprintf(stderr, "%p: Got key %.*s with value %.*s\n", instance,
            (int)resp->v.v0.nkey, resp->v.v0.key,
            (int)resp->v.v0.nbytes, resp->v.v0.bytes);
    }
}
}

class MyPool : public Pool {
public:
    MyPool(const lcb_create_st& opts, size_t items) : Pool(opts, items) {}
protected:
    void initialize(lcb_t instance) {
        // We override the initialize function to set the proper callback we
        // care about
        fprintf(stderr, "Initializing %p\n", instance);
        lcb_set_get_callback(instance, get_callback);
    }
};

extern "C" {
static void *
pthr_func(void *arg) {
    Pool *pool = reinterpret_cast<Pool*>(arg);
    lcb_get_cmd_t gcmd;
    const lcb_get_cmd_t *cmdlist[1];
    memset(&gcmd, 0, sizeof gcmd);
    gcmd.v.v0.key = "foo";
    gcmd.v.v0.nkey = 3;
    cmdlist[0] = &gcmd;

    // Get an instance to use
    lcb_t instance = pool->pop();

    // Issue the command
    lcb_get(instance, NULL, 1, cmdlist);

    // Wait for the command to complete
    lcb_wait(instance);

    // Release back to pool
    pool->push(instance);

    return NULL;
}
}

#define NUM_WORKERS 20
int main(void) {
    lcb_create_st options;
    pthread_t workers[NUM_WORKERS];
    Pool *pool;
    lcb_error_t err;

    // set up the options to represent your cluster (hostname etc)
    memset(&options, 0, sizeof options);
    options.version = 3;
    options.v.v3.connstr = "couchbase://localhost/default";
    pool = new MyPool(options, 5);

    err = pool->connect();
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't connect all instances: %s\n", lcb_strerror(NULL, err));
        exit(EXIT_FAILURE);
    }

    for (size_t ii = 0; ii < NUM_WORKERS; ii++) {
        pthread_create(&workers[ii], NULL, pthr_func, pool);
    }

    for (size_t ii = 0; ii < NUM_WORKERS; ii++) {
        void *unused;
        pthread_join(workers[ii], &unused);
    }

    delete pool;
    return 0;
}
