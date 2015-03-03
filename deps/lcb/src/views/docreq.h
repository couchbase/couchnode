/**
 * Document request routines
 */
#ifndef LCB_DOCREQ_H
#define LCB_DOCREQ_H

#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <libcouchbase/pktfwd.h>
#include <lcbio/lcbio.h>
#include "sllist.h"

#ifdef __cplusplus
extern "C" {
#endif

struct lcb_DOCQUEUE_st;
struct lcb_DOCREQ_st;

typedef struct lcb_DOCQUEUE_st{
    lcb_t instance;
    void *parent;
    lcbio_pTIMER timer;

    /**Called when a document is ready
     * @param The queue
     * @param The document */
    void (*cb_ready)(struct lcb_DOCQUEUE_st*,struct lcb_DOCREQ_st*);

    /**Called when throttle state changes. This may be used by higher layers
     * for appropriate flow control
     * @param The queue
     * @param enabled Whether throttling has been enabled or disabled */
    void (*cb_throttle)(struct lcb_DOCQUEUE_st*, int enabled);

    /**This queue holds requests which were not yet issued to the library
     * via lcb_get3(). This list is aggregated after each chunk callback and
     * sent as a batch*/
    sllist_root pending_gets;

    /**This queue holds the requests which were already passed to lcb_get3().
     * It is popped when the callback arrives (and is popped in order!) */
    sllist_root cb_queue;

    unsigned n_awaiting_schedule;
    unsigned n_awaiting_response;

    unsigned max_pending_response;
    unsigned min_batch_size;
    unsigned cancelled;
    unsigned refcount;
} lcb_DOCQUEUE;

typedef struct lcb_DOCREQ_st {
    /* Callback. Must be first */
    lcb_RESPCALLBACK callback;
    sllist_node slnode;
    lcb_DOCQUEUE *parent;
    lcb_RESPGET docresp;
    /* To be filled in by the subclass */
    lcb_IOV docid;
    unsigned ready;
} lcb_DOCQREQ;

lcb_DOCQUEUE *
lcbdocq_create(lcb_t instance);

void
lcbdocq_add(lcb_DOCQUEUE *q, lcb_DOCQREQ *req);

void
lcbdocq_unref(lcb_DOCQUEUE *);

void
lcbdocq_cancel(lcb_DOCQUEUE *q);

#define lcbdocq_has_pending(q) \
    ((q)->n_awaiting_response || (q)->n_awaiting_schedule)

#ifdef __cplusplus
}
#endif
#endif
