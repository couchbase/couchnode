/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

#ifndef LCB_RETRYQ_H
#define LCB_RETRYQ_H
#ifdef __cplusplus
extern "C" {
#endif

#include <lcbio/lcbio.h>
#include <lcbio/timer-ng.h>
#include <mc/mcreq.h>
#include "list.h"

/**
 * @file
 * @brief Retry Queue
 *
 * @defgroup lcb-retryq Retry Queue
 *
 * @details
 * Retry queue for operations. The retry queue accepts commands which have
 * previously failed and aims to retry them within a specified interval.
 *
 * @addtogroup lcb-retryq
 * @{
 */

typedef struct lcb_RETRYQ {
    /** List of operations in retry ordering. Sorted by 'crtime' */
    lcb_list_t schedops;
    /** List of operations in timeout ordering. Ordered by 'start_time' */
    lcb_list_t tmoops;
    /** Parent command queue */
    mc_CMDQUEUE *cq;
    lcb_settings *settings;
    lcbio_pTIMER timer;
} lcb_RETRYQ;

/**
 * @brief Create a new retry queue.
 * The retry queue serves as an asynchronous poller which will retry operations
 * with a certain throttle.
 *
 * @param cq The parent cmdqueue object
 * @param table used to create the timer
 * @param settings Used for logging and interval timeouts
 * @return A new retry queue object
 */
lcb_RETRYQ *
lcb_retryq_new(mc_CMDQUEUE *cq, lcbio_pTABLE table, lcb_settings *settings);

void
lcb_retryq_destroy(lcb_RETRYQ *rq);

/**
 * @brief Enqueue a failed command
 * @param rq The retried queue
 * @param detchpkt A detached packet allocated with mcreq_renew_packet()
 * @param err the error code which caused the packet to be placed inside the
 * retry queue. Depending on the error code and subsequent errors, this code
 * will ultimately be sent back to the operation callback when the result is
 * final.
 *
 * @attention Only simple commands containing vBuckets may be placed here.
 * Complex commands such as OBSERVE or STAT may _not_ be retried through this
 * mechanism. Additionally since this relies on determining a vBucket master
 * it may _not_ be used for memcached buckets (which is typically OK, as we only
 * map things here as a response for a not-my-vbucket).
 */
void
lcb_retryq_add(lcb_RETRYQ *rq, mc_EXPACKET *detchpkt, lcb_error_t err);

/**
 * Retries the given packet as a result of a NOT_MY_VBUCKET failure. Currently
 * this is provided to allow for different behavior when handling these types
 * of responses.
 *
 * @param rq The retry queue
 * @param detchpkt The new packet
 */
void
lcb_retryq_nmvadd(lcb_RETRYQ *rq, mc_EXPACKET *detchpkt);

/**
 * @brief Retry all queued operations
 *
 * This should normally be called when a new server connection is made or when
 * a new configuration update has arrived.
 *
 * @param rq The queue
 */
void
lcb_retryq_signal(lcb_RETRYQ *rq);

/**
 * If this packet has been previously retried, this obtains the original error
 * which caused it to be enqueued in the first place. This eliminates spurious
 * timeout errors which mask the real cause of the error.
 *
 * @param pkt The packet to check for
 * @return An error code, or LCB_SUCCESS if the packet does not have an
 * original error.
 */
lcb_error_t
lcb_retryq_origerr(const mc_PACKET *pkt);

/**
 * Dumps the packets inside the queue
 * @param rq The request queue
 * @param fp The file to which the output should be written to
 */
void
lcb_retryq_dump(lcb_RETRYQ *rq, FILE *fp, mcreq_payload_dump_fn dumpfn);

/**
 * @brief Check if there are operations to retry
 * @param rq the queue
 * @return nonzero if there are pending operations
 */
#define lcb_retryq_empty(rq) LCB_LIST_IS_EMPTY(&(rq)->schedops)

/**@}*/

#ifdef __cplusplus
}
#endif
#endif
