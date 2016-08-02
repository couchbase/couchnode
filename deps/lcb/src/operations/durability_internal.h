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

#ifndef LCB_DURABILITY_INTERNAL_H
#define LCB_DURABILITY_INTERNAL_H

#include "simplestring.h"
#include "ssobuf.h"
#ifdef __cplusplus
extern "C" {
#endif

/**
 * Here is the internal API for the durability functions.
 *
 * Durability works on polling multiple observe responses and waiting until a
 * key (or set of keys) have either been persisted, or the wait period has
 * expired.
 *
 * The operation maintains an internal counter which counts how many keys
 * do not have a conclusive observe response yet (i.e. how many do not have
 * their criteria satisfied yet). The operation is considered complete when
 * the counter reaches 0.
 */

/**
 * Information about a particular server's state -- whether it has been
 * persisted to or replicated to. This is tied to a given mc_SERVER
 * instance.
 */
typedef struct {
    const mc_SERVER *server; /**< Server pointer (for comparison only) */
    lcb_U16 persisted; /**< Exists on server */
    lcb_U16 exists; /**< Persisted to server */
} lcbdur_SERVINFO;

/**Information a single entry in a durability set. Each entry contains a single
 * key */
typedef struct lcb_DURITEM_st {
    lcb_U64 reqcas; /**< Last known CAS for the user */
    lcb_U64 reqseqno; /**< Last known seqno for the user */
    lcb_U64 uuid;
    lcb_RESPENDURE result; /**< Result to be passed to user */
    struct lcb_DURSET_st *parent;
    lcb_RESPCALLBACK callback; /**< For F_INTERNAL_CALLBACK */
    lcb_U16 vbid; /**< vBucket ID (computed via hashkey) */
    lcb_U8 done; /**< Whether we have a conclusive result for this entry */

    /** Array of servers which have satisfied constraints */
    lcbdur_SERVINFO sinfo[4];
} lcb_DURITEM;

struct lcbdur_PROCS_st;

enum {
    LCBDUR_STATE_OBSPOLL = 0,
    LCBDUR_STATE_INIT,
    LCBDUR_STATE_TIMEOUT,
    LCBDUR_STATE_IGNORE
};

/**
 * A collection encompassing one or more entries which are to be checked for
 * persistence
 */
typedef struct lcb_DURSET_st {
    lcb_MULTICMD_CTX mctx; /**< Base class returned to user for scheduling */
    lcb_DURABILITYOPTSv0 opts; /**< Sanitized user options */
    LCB_SSOBUF_DECLARE(lcb_DURITEM) entries_;
    unsigned nremaining; /**< Number of entries remaining to poll for */
    int waiting; /**< Set if currently awaiting an observe callback */
    unsigned refcnt; /**< Reference count */
    unsigned next_state; /**< Internal state */
    lcb_error_t lasterr;
    int is_durstore; /** Whether the callback should be DURSTORE */
    lcb_string kvbufs; /**< Backing storage for key buffers */
    const void *cookie; /**< User cookie */
    hrtime_t ns_timeout; /**< Timestamp of next timeout */
    void *timer;
    lcb_t instance;
    void *impldata;
} lcb_DURSET;

typedef struct lcbdur_PROCS_st {
    lcb_error_t (*poll)(lcb_DURSET *dset);
    lcb_error_t (*ent_add)(lcb_DURSET*,lcb_DURITEM*,const lcb_CMDENDURE*);
    lcb_error_t (*schedule)(lcb_DURSET*);
    void (*clean)(lcb_DURSET*);
} lcbdur_PROCS;

void
lcbdur_cas_update(lcb_t instance, lcb_DURSET *dset, lcb_error_t err,
    const lcb_RESPOBSERVE *resp);
void
lcbdur_update_seqno(lcb_t instance, lcb_DURSET *dset,
    const lcb_RESPOBSEQNO *resp);

/** Indicate that this durability command context is for an original storage op */
void
lcbdurctx_set_durstore(lcb_MULTICMD_CTX *ctx, int enabled);

lcb_MULTICMD_CTX *
lcb_observe_ctx_dur_new(lcb_t instance);

#ifdef LCBDUR_PRIV_SYMS

extern lcbdur_PROCS lcbdur_cas_procs;
extern lcbdur_PROCS lcbdur_seqno_procs;

#define RESFLD(e, f) (e)->result.f
#define ENT_CAS(e) (e)->request.options.cas
#define DSET_OPTFLD(ds, opt) (ds)->opts.opt
#define DSET_COUNT(ds) (ds)->entries_.count
#define DSET_ENTRIES(ds) LCB_SSOBUF_ARRAY(&(ds)->entries_, lcb_DURITEM)
#define DSET_PROCS(ds) ((ds)->opts.pollopts == LCB_DURABILITY_MODE_CAS \
    ? (&lcbdur_cas_procs) : (&lcbdur_seqno_procs))
#define ENT_NUMINFO(ent) 4

/**
 * Returns true if the entry is complete, false otherwise. This only assumes
 * successful entries.
 */
int lcbdur_ent_check_done(lcb_DURITEM *ent);

/**
 * Set the logical state of the entry to done, and invoke the callback.
 * It is safe to call this multiple times
 */
void lcbdur_ent_finish(lcb_DURITEM *ent);

/**
 * Called when the last (primitive) OBSERVE response is received for the entry.
 */
void lcbdur_reqs_done(lcb_DURSET *dset);

/**
 * Updates the state of the given entry and synchronizes it with the
 * current server list.
 *
 * Specifically this function will return a list of
 * servers which still need to be contacted, and will increment internal
 * counters on behalf of those (still active) servers which the item has
 * already been replicated to (and persisted to, if requested).
 *
 * This will invalidate any cached information of the cluster configuration
 * in respect to this item has changed -- this includes things like servers
 * moving indices or being recreated entirely.
 *
 * This function should be called during poll().
 * @param item The item to update
 * @param[out] ixarray An array of server indices which should be queried
 * @param[out] nitems the number of effective entries in the array.
 */
void
lcbdur_prepare_item(lcb_DURITEM *item, lcb_U16 *ixarray, size_t *nitems);

#define LCBDUR_UPDATE_PERSISTED 1
#define LCBDUR_UPDATE_REPLICATED 2
/**
 * Update an item's status.
 * @param item The item to update
 * @param flags OR'd set of UPDATE_PERSISTED and UPDATE_REPLICATED
 * @param ix The server index
 */
void
lcbdur_update_item(lcb_DURITEM *item, int flags, int ix);

lcbdur_SERVINFO *
lcbdur_ent_getinfo(lcb_DURITEM *item, int srvix);

/**
 * Schedules us to be notified with the given state within a particular amount
 * of time. This is used both for the timeout and for the interval
 */
void lcbdur_switch_state(lcb_DURSET *dset, unsigned int state);
#define lcbdur_ref(dset) (dset)->refcnt++;
void lcbdur_unref(lcb_DURSET *dset);

#endif /* PRIV_SYMS */

#ifdef __cplusplus
}
#endif

#endif
