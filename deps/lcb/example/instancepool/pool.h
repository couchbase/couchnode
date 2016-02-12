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

#ifndef POOL_H
#define POOL_H

#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <pthread.h>
#include <queue>
#include <vector>

namespace lcb {

class Pool {
public:
    /**
     * Create a new pool to use across threads
     * @param options The options used to initialize the instance
     * @param items How many items should be in the pool
     */
    Pool(const lcb_create_st& options, size_t items = 10);
    virtual ~Pool();

    /**Get an instance from the pool. You should call #push() when you are
     * done with the instance
     * @return an lcb_t instance */
    lcb_t pop();

    /**Release an instance back into the pool
     * @param instance The instance to release */
    void push(lcb_t instance);

    // Connect all the instances in the pool. This should be called once the
    // pool has been constructed
    lcb_error_t connect();

protected:
    /**Function called after the instance is created. You may
     * customize the instance here with e.g. lcb_set_cookie()
     * @param instance the newly created instance */
    virtual void initialize(lcb_t instance) = 0;

private:
    pthread_mutex_t mutex;
    pthread_cond_t cond;
    std::queue<lcb_t> instances;

    // List of all instances
    std::vector<lcb_t> all_instances;
    size_t initial_size;
};
} // namespace

#endif
