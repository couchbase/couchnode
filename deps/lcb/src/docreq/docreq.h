/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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
 * Document request routines
 */
#ifndef LCB_DOCREQ_H
#define LCB_DOCREQ_H

#include <libcouchbase/couchbase.h>
#include <libcouchbase/pktfwd.h>
#include <lcbio/lcbio.h>
#include "sllist.h"
#include "internalstructs.h"

#include "capi/cmd_get.hh"

namespace lcb
{
namespace docreq
{

struct Queue;
struct DocRequest;

struct Queue {
    explicit Queue(lcb_INSTANCE *);
    ~Queue();
    void add(DocRequest *);
    void unref();
    void ref()
    {
        refcount++;
    }
    void cancel();
    void check();
    bool has_pending() const
    {
        return n_awaiting_response || n_awaiting_schedule;
    }

    lcb_INSTANCE *instance;
    void *parent{nullptr};
    lcbio_pTIMER timer;

    /**Called when a operation is ready to be scheduled
     * @param The queue
     * @param The document */
    lcb_STATUS (*cb_schedule)(struct Queue *, lcb::docreq::DocRequest *dreq){nullptr};

    /**Called when a document is ready
     * @param The queue
     * @param The document */
    void (*cb_ready)(struct Queue *, struct DocRequest *){nullptr};

    /**Called when throttle state changes. This may be used by higher layers
     * for appropriate flow control
     * @param The queue
     * @param enabled Whether throttling has been enabled or disabled */
    void (*cb_throttle)(struct Queue *, int enabled){nullptr};

    /**This queue holds requests which were not yet issued to the library
     * via lcb_get3(). This list is aggregated after each chunk callback and
     * sent as a batch*/
    sllist_root pending_gets{};

    /**This queue holds the requests which were already passed to lcb_get3().
     * It is popped when the callback arrives (and is popped in order!) */
    sllist_root cb_queue{};

    unsigned n_awaiting_schedule{0};
    unsigned n_awaiting_response{0};

    static const int default_max_pending_docreq{10};
    unsigned max_pending_response{default_max_pending_docreq};

    static const int default_min_sched_size{5};
    unsigned min_batch_size{default_min_sched_size};
    unsigned cancelled{false};
    unsigned refcount{1};
};

struct DocRequest {
    /* Callback. Must be first */
    lcb_RESPCALLBACK callback;
    sllist_node slnode;
    Queue *parent;
    lcb_RESPGET_ docresp;
    /* To be filled in by the subclass */
    lcb_IOV docid;
    unsigned ready;
};

} // namespace docreq
} // namespace lcb
#endif
