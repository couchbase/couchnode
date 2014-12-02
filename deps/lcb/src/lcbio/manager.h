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

#ifndef LCBIO_MANAGER_H
#define LCBIO_MANAGER_H
#include "connect.h"
#include "settings.h"
#include "contrib/genhash/genhash.h"
#include "list.h"
#include <stdio.h>


/**
 * @file
 * @brief Socket pooling routines
 *
 * @details
 * General purpose connection manager for LCB sockets. This object is
 * responsible for maintaining and properly handling idle connections
 * and pooling them (optionally).
 */

/**
 * @ingroup lcbio
 * @defgroup lcbio-mgr Socket Pooling
 * @addtogroup lcbio-mgr
 * @{
 */

#ifdef __cplusplus
extern "C" {
#endif

/** Cancellable pool request */
struct lcbio_MGRREQ;

/** @brief Socket Pool */
typedef struct lcbio_MGR {
    genhash_t* ht;
    lcb_settings *settings;
    lcbio_pTABLE io;

    /**
     * Maximum number of microseconds for a connection to idle inside the pool
     * before being closed
     */
    uint32_t tmoidle;
    unsigned maxtotal;
    unsigned maxidle; /**< Maximum number of idle connections, per host */
    unsigned refcount;
} lcbio_MGR;

/**
 * Create a socket pool controlled by the given settings and IO structure.
 * This function will increment the refcount on both the settings and table
 * objects.
 */
LCB_INTERNAL_API
lcbio_MGR*
lcbio_mgr_create(lcb_settings *settings, lcbio_pTABLE io);

/**
 * Destroy the socket pool. Note that internally this just decrements the
 * reference count. The object is only destroyed when its count hits zero.
 */
LCB_INTERNAL_API
void
lcbio_mgr_destroy(lcbio_MGR *);

/**
 * Request a connection from the socket pool. The semantics and prototype
 * of this function are by design similar to lcbio_connect() as they do the
 * same things.
 *
 * @param mgr
 * @param dest the host to connect to
 * @param timeout amount of time to wait for a connection to be estblished
 * @param handler a callback to invoke when the result is ready
 * @param arg an argument passed to the callback
 * @return a request handle which may be cancelled
 * @see lcbio_connect()
 */
LCB_INTERNAL_API
struct lcbio_MGRREQ *
lcbio_mgr_get(lcbio_MGR *mgr, lcb_host_t *dest, uint32_t timeout,
              lcbio_CONNDONE_cb handler, void *arg);

/**
 * Cancel a pending request. The callback for the request must have not already
 * been invoked (if it has, use sockpool_put)
 * @param req the request to cancel
 */
LCB_INTERNAL_API
void
lcbio_mgr_cancel(struct lcbio_MGRREQ *req);

/**
 * Release a socket back into the pool. This means the socket is no longer
 * used and shall be available for reuse for another request. To verify these
 * constraints, the socket's reference count must be one. Once the socket
 * has been released its reference count should not be modified.
 */
LCB_INTERNAL_API
void lcbio_mgr_put(lcbio_SOCKET *sock);

/**
 * Mark a slot as available but discard the current connection. This should be
 * done if the connection itself is "dirty", i.e. has a protocol error on it
 * or is otherwise not suitable for reuse
 */
LCB_INTERNAL_API
void lcbio_mgr_discard(lcbio_SOCKET *sock);

/**
 * Like lcbio_mgr_discard() except the source connection is left untouched. It
 * is removed from the pool instead.
 *
 * Because the lcbio_MGR object itself has internal limits and thresholds on how
 * many leased and/or open connections it can contain, when a connection receives
 * an error it must either be discarded back to the pool (in which case the
 * connection is cleaned up and is freed) or it must be detached (in which case
 * the connection object itself still remains valid, but the pool does not know
 * about it, and all its counters are restored, as with lcbio_mgr_discard()).
 *
 * lcbio_mgr_discard() itself is now implemented as the equivalent to:
 *  `lcbio_mgr_detach(mgr, conn)`;
 */
LCB_INTERNAL_API
void lcbio_mgr_detach(lcbio_SOCKET *sock);

/**
 * Dumps the connection manager state to stderr
 */
LCB_INTERNAL_API
void lcbio_mgr_dump(lcbio_MGR *mgr, FILE *out);

#ifdef __cplusplus
}
#endif
/**@}*/

#endif /* LCB_SOCKPOOL_H */
