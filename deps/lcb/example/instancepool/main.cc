/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013-2020 Couchbase, Inc.
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
#include <cstring>
#include <cstdlib>

using namespace lcb;

extern "C" {
static void get_callback(lcb_INSTANCE *instance, int, const lcb_RESPBASE *rb)
{
    const lcb_RESPGET *rg = reinterpret_cast< const lcb_RESPGET * >(rb);
    if (lcb_respget_status(rg) != LCB_SUCCESS) {
        fprintf(stderr, "%p: Couldn't get key", instance);
    } else {
        const char *key, *value;
        size_t nkey, nvalue;
        lcb_respget_key(rg, &key, &nkey);
        lcb_respget_value(rg, &value, &nvalue);
        fprintf(stderr, "%p: Got key %.*s with value %.*s\n", instance, (int)nkey, key, (int)nvalue, value);
    }
}
}

class MyPool : public Pool
{
  public:
    MyPool(const lcb_CREATEOPTS *opts, size_t items) : Pool(opts, items) {}

  protected:
    void initialize(lcb_INSTANCE *instance)
    {
        // We override the initialize function to set the proper callback we
        // care about
        fprintf(stderr, "Initializing %p\n", instance);
        lcb_install_callback(instance, LCB_CALLBACK_GET, get_callback);
    }
};

extern "C" {
static void *pthr_func(void *arg)
{
    Pool *pool = reinterpret_cast< Pool * >(arg);
    lcb_CMDGET *gcmd;
    lcb_cmdget_create(&gcmd);
    lcb_cmdget_key(gcmd, "foo", 3);

    // Get an instance to use
    lcb_INSTANCE *instance = pool->pop();

    // Issue the command
    lcb_get(instance, NULL, gcmd);
    lcb_cmdget_destroy(gcmd);

    // Wait for the command to complete
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    // Release back to pool
    pool->push(instance);

    return NULL;
}
}

#define NUM_WORKERS 20
int main(int argc, char *argv[])
{
    lcb_CREATEOPTS *options = NULL;
    pthread_t workers[NUM_WORKERS];
    Pool *pool;
    lcb_STATUS err;

    lcb_createopts_create(&options, LCB_TYPE_BUCKET);
    if (argc > 1) {
        lcb_createopts_connstr(options, argv[1], strlen(argv[1]));
    }
    if (argc > 3) {
        lcb_createopts_credentials(options, argv[3], strlen(argv[3]), argv[2], strlen(argv[2]));
    }

    pool = new MyPool(options, 5);

    err = pool->connect();
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Couldn't connect all instances: %s\n", lcb_strerror_short(err));
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

    lcb_createopts_destroy(options);
    return 0;
}
