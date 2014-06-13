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
 * @defgroup LCB_RETRYQ Retry Queue
 *
 * @details
 * Retry queue for operations. The retry queue accepts commands which have
 * previously failed and aims to retry them within a specified interval.
 *
 * @addtogroup LCB_RETRYQ
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
 * @param detchpkt A detached packet allocated with mcreq_dup_packet()
 *
 * @attention Only simple commands containing vBuckets may be placed here.
 * Complex commands such as OBSERVE or STAT may _not_ be retried through this
 * mechanism. Additionally since this relies on determining a vBucket master
 * it may _not_ be used for memcached buckets (which is typically OK, as we only
 * map things here as a response for a not-my-vbucket).
 */
void
lcb_retryq_add(lcb_RETRYQ *rq, mc_PACKET *detchpkt);

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
