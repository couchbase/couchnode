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
#include <pthread.h>
#include <stdlib.h>
#include <assert.h>
#include <stdio.h>

/**
 * The inner guts of the connection pool.
 */
struct lcb_pool_st {
    /**
     * Access to the pool should be allowed from multiple threads
     * concurrently (but an instance should still be used from one
     * thread only at any given point in time).
     */
    pthread_mutex_t mutex;
    /**
     * Given that we have a fixed set of resources in the pool we
     * need a way to block thrads while we're waiting for resources
     * to become available.
     */
    pthread_cond_t cond;
    /**
     * An array where we keep all of the available resources. A "better"
     * implementation would most likely use a queue here to do some sort
     * of round robin on the different instances and dynamically resize
     * itself upon the users need.
     *
     * In this small example I just mark the entry as NULL when the
     * resource is in use, and store the lcb_t there when it is available
     */
    lcb_t *instances;
    /**
     * The number of entries in the pool initially (and the size of
     * the instance array) so that we know when to stop searching.
     */
    unsigned int size;
    /**
     * The avail member is only used as a small optimization to avoid
     * searching the entire array when it is empty.
     */
    unsigned int avail;
};

/**
 * Allocate an entry from the array and return it to the user. The thing
 * we need to look out for is the situation when all of the instances
 * are being used. If that is the case we need to wait.
 */
lcb_t pool_pop(lcb_pool_t pool)
{
    lcb_t ret = NULL;
    unsigned int ii;

    /*
     * All access to the pools structure must be performed by one
     * thread only at any given time to avoid race conditions.
     */
    pthread_mutex_lock(&pool->mutex);

    /*
     * Loop and block on the condition variable as long as there are
     * no available resources. We need to reevaluate the availability
     * every time pthread_cond_wait returns because we might get spurious
     * wakeups
     */
    while (pool->avail == 0) {
        /*
         * pthread_cond_wait will atomically block the current thread
         * and release the mutex so that other threads may start
         * executing.
         */
        pthread_cond_wait(&pool->cond, &pool->mutex);
    }

    /*
     * We *KNOW* that there should at least be a one available
     * lcb_t instance in the instance array. Try to find it and
     * return it.
     */
    for (ii = 0; ii < pool->size; ++ii) {
        if (pool->instances[ii] != NULL) {
            /*
             * We've found an available instance. Set the entry in the
             * instances table to NULL to mark it as used, and decrease
             * the number of available instances
             */
            pool->avail--;
            ret = pool->instances[ii];
            pool->instances[ii] = NULL;
            break;
        }
    }

    /*
     * Release the lock to the connection pool to allow other threads
     * to allocate/relase entries.
     */
    pthread_mutex_unlock(&pool->mutex);

    /*
     * Programming errors do happen, so let's just assert that we really
     * have an entry, and that someone didn't modify the logic of the
     * "avail" member so that it is incorrect.
     */
    assert(ret != NULL);
    return ret;
}

/**
 * Put an instance back into the pool so that it may be used by others
 */
void pool_push(lcb_pool_t pool, lcb_t instance)
{
    unsigned int ii;
    int released = 0;
    /* As with the pop method we need exclusive access */
    pthread_mutex_lock(&pool->mutex);

    /* Ensure that there actually _IS_ space in the pool */
    assert(pool->avail < pool->size);

    /*
     * Search through the array and find an available spot to
     * put it. We could terminate the loop once we found
     * a free spot, but I'm searching through the entire array
     * to do some sanity check (ensure that someone isn't releasing
     * the object twice).
     */
    for (ii = 0; ii < pool->size; ++ii) {
        assert(pool->instances[ii] != instance);
        if (pool->instances[ii] == NULL && released == 0) {
            pool->instances[ii] = instance;
            pool->avail++;
            released = 1;
        }
    }

    /* Do an extra sanity check that we actually found an spot to put it */
    assert(released == 1);

    /*
     * If this is the only instance in the connection pool, another thread
     * might be blocked wating for a resource to become available.
     * I don't keep track of if that is the case or not, so let's just
     * try to wake up any potential thread that might be blocked.
     */
    if (pool->avail == 1) {
        pthread_cond_signal(&pool->cond);
    }

    /* Release the lock to allow other threads to access the pool */
    pthread_mutex_unlock(&pool->mutex);
}

/**
 * Create a pool of connections.
 */
lcb_error_t pool_create(unsigned int size,
                        const struct lcb_create_st *options,
                        lcb_pool_t *pool,
                        void (*initiate)(lcb_t))
{
    struct lcb_pool_st *ret;
    unsigned int ii;
    lcb_io_opt_t io = NULL;

    /*
     * Lets start by doing sanity check that the user didn't provide
     * an IO operation in the create options. In theory there is nothing
     * wrong by using an common IO operation structure between the
     * multiple threads, but if you do that the IO operation <b>must</b>
     * be multithread safe!
     */
    switch(options->version) {
    case 0:
        io = options->v.v0.io;
        break;
    case 1:
        io = options->v.v1.io;
        break;
    default:
        /*
         * I don't know the layout of the option structure (its created
         * after I wrote the example) so I don't now if an io ops structure
         * is provided or not.
         */
        return LCB_EINTERNAL;
    }
    if (io != NULL) {
        return LCB_EINVAL;
    }

    /* Allocate memory for the pool and initialize the size the members */
    ret = calloc(1, sizeof(struct lcb_pool_st));
    if (ret == NULL) {
        return LCB_CLIENT_ENOMEM;
    }

    ret->instances = calloc(size, sizeof(lcb_t));
    if (ret->instances == NULL) {
        free(ret);
        return LCB_CLIENT_ENOMEM;
    }

    ret->size = size;
    ret->avail = size;
    pthread_mutex_init(&ret->mutex, NULL);
    pthread_cond_init(&ret->cond, NULL);

    /* Loop through and create the requested number of libcouchbase instances */
    for (ii = 0; ii < size; ++ii) {
        lcb_error_t error = lcb_create(&ret->instances[ii], options);
        if (error == LCB_SUCCESS) {
            /*
             * Call the user-supplied initialization function to allow
             * the user to do user-specific init.
             */
            initiate(ret->instances[ii]);
            /* Connect it to the cluster */
            lcb_connect(ret->instances[ii]);
            lcb_wait(ret->instances[ii]);
        } else {
            while (ii > 0) {
                --ii;
                lcb_destroy(ret->instances[ii]);
            }
            free(ret->instances);
            free(ret);
            return error;
        }
    }

    /* Return the pool back to the user */
    *pool = ret;
    return LCB_SUCCESS;
}
