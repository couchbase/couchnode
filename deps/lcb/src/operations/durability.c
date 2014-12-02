/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
 * High(er) level durability operations, based on observe
 * @author Mark Nunberg
 */

/**
 * So, how does this stuff work?
 * -----------------------------
 *
 * Each key in a durability request is mapped to a single entry. This entry
 * contains state about what the keys' status is in respect to its criteria
 * being met.
 *
 * Once an entry has its criteria met (or receives an error which prevents it
 * from ever being met (e.g. CAS mismatch on master)) the entry is marked as
 * done.
 *
 * Entries are polled for all at once. This polling involves sending out a
 * number of observe broadcast primitives to the related nodes (this itself
 * is implemented in observe.c). The client will then asynchronously wait
 * for the responses for all those entries to arrive (asynchronously, of course).
 *
 * If all entries have been set to a 'done' mode then the operation is complete;
 * otherwise the polling is rescheduled to be performed within a given interval
 * (the exact duration of this interval is adaptive by default, but may be
 * user-specified).
 *
 * This cycle repeats until either all entries have been set to the 'done' mode
 * or the operation timeout has been reached (at which point, all non-done
 * entries are set to done and have their error set to LCB_ETIMEDOUT).
 *
 * Entries themselves are part of a set which contains state for timeout and
 * polling infomation. This contains the criteria for all the entries and
 * is also the resource parent for them. Sets are reference-counted and are
 * destroyed when their reference count hits zero.
 *
 * The reference count semantics works as follows:
 *
 * 1. The reference counter has an initial value of 0 when the `DURSET` is
 * first created. Any errors encountered before the command being submitted
 * results in explicit resource destruction.
 * 2. Once the commands have been submitted, the reference count is incremented
 * once more.
 * 3. When all callbacks have been received for a single polling loop, the
 * reference count is decremented once more.
 * 4. When all commands have been completed (i.e. `nremaining` is 0) the
 * reference count is decremented again.
 */

#include "internal.h"
#include "durability_internal.h"
#include <lcbio/iotable.h>
#define LOGARGS(c, lvl) (c)->instance->settings, "endure", LCB_LOG_##lvl, __FILE__, __LINE__
#define RESFLD(e, f) (e)->result.f
#define ENT_CAS(e) (e)->request.options.cas

#define OPTFLD(opts, opt) (opts)->v.v0.opt
#define DSET_OPTFLD(ds, opt) OPTFLD(&(ds)->opts, opt)

enum {
    STATE_OBSPOLL = 1,
    STATE_TIMEOUT = 2,

    /* spurious events. set after purge */
    STATE_IGNORE = 3
};

static void timer_callback(lcb_socket_t sock, short which, void *arg);
static void timer_schedule(lcb_DURSET *, unsigned int);
static lcb_error_t poll_once(lcb_DURSET *dset, int initial);
static void purge_entries(lcb_DURSET *dset, lcb_error_t err);
#define dset_ref(dset) (dset)->refcnt++;
static void dset_unref(lcb_DURSET *dset);


/**
 * Returns true if the entry is complete, false otherwise. This only assumes
 * successful entries.
 */
static int ent_is_complete(lcb_DURITEM *ent)
{
    lcb_durability_opts_t *opts = &ent->parent->opts;

    if (!RESFLD(ent, exists_master)) {
        /** Primary cache doesn't have correct version */
        return 0;
    }

    if (OPTFLD(opts, persist_to)) {
        if (!RESFLD(ent, persisted_master)) {
            return 0;
        }

        if (RESFLD(ent, npersisted) < OPTFLD(opts, persist_to)) {
            return 0;
        }
    }

    if (OPTFLD(opts, replicate_to)) {
        if (RESFLD(ent, nreplicated) < OPTFLD(opts, replicate_to)) {
            return 0;
        }
    }

    return 1;
}

/**
 * Set the logical state of the entry to done, and invoke the callback.
 * It is safe to call this multiple times
 */
static void ent_set_resdone(lcb_DURITEM *ent)
{
    lcb_RESPCALLBACK callback;
    if (ent->done) {
        return;
    }

    ent->done = 1;
    ent->parent->nremaining--;

    /** Invoke the callback now :) */
    ent->result.cookie = (void *)ent->parent->cookie;
    if (ent->result.rc != LCB_SCHEDFAIL_INTERNAL) {
        callback = lcb_find_callback(ent->parent->instance, LCB_CALLBACK_ENDURE);
        callback(ent->parent->instance, LCB_CALLBACK_ENDURE,
            (lcb_RESPBASE*)&ent->result);
    }
    if (ent->parent->nremaining == 0) {
        dset_unref(ent->parent);
    }
}

/**
 * Called when the last (primitive) OBSERVE response is received for the entry.
 */
static void dset_done_waiting(lcb_DURSET *dset)
{
    lcb_assert(dset->waiting || ("Got NULL callback twice!" && 0));

    dset->waiting = 0;

    if (dset->nremaining > 0) {
        timer_schedule(dset, STATE_OBSPOLL);
    }
    dset_unref(dset);
}

/**
 * Purge all non-complete (i.e. not 'resdone') entries and invoke their
 * callback, setting the result's error code with the specified error
 */
static void purge_entries(lcb_DURSET *dset, lcb_error_t err)
{
    lcb_size_t ii;
    dset->ns_timeout = 0;
    dset->next_state = STATE_IGNORE;

    /**
     * Each time we call 'ent_set_resdone' we might cause the refcount to drop
     * to zero, making 'dset' point to freed memory. To avoid this, we bump
     * up the refcount before the loop and defer the possible free operation
     * until the end.
     */
    dset_ref(dset);

    for (ii = 0; ii < dset->nentries; ii++) {
        lcb_DURITEM *ent = dset->entries + ii;
        if (ent->done) {
            continue;
        }
        RESFLD(ent, rc) = err;
        ent_set_resdone(ent);
    }

    dset_unref(dset);
}

/**
 * Schedules a single sweep of observe requests.
 * The `initial` parameter determines if this is a retry or if this is the
 * initial scheduling.
 */
static lcb_error_t poll_once(lcb_DURSET *dset, int initial)
{
    unsigned ii, n_added = 0;
    lcb_error_t err;
    lcb_MULTICMD_CTX *mctx = NULL;

    /**
     * We should never be called while an 'iter' operation is still
     * in progress
     */
    lcb_assert(dset->waiting == 0);
    dset_ref(dset);
    mctx = lcb_observe_ctx_dur_new(dset->instance);
    if (!mctx) {
        err = LCB_CLIENT_ENOMEM;
        goto GT_ERR;
    }

    for (ii = 0; ii < dset->nentries; ii++) {
        lcb_CMDOBSERVE cmd = { 0 };
        struct lcb_DURITEM_st *ent = dset->entries + ii;
        if (ent->done) {
            continue;
        }

        /* reset all the per-iteration fields */
        RESFLD(ent, persisted_master) = 0;
        RESFLD(ent, exists_master) = 0;
        RESFLD(ent, npersisted) = 0;
        RESFLD(ent, nreplicated) = 0;
        RESFLD(ent, cas) = 0;
        RESFLD(ent, rc) = LCB_SUCCESS;

        LCB_KREQ_SIMPLE(&cmd.key, RESFLD(ent, key), RESFLD(ent, nkey));
        cmd._hashkey = ent->hashkey;

        err = mctx->addcmd(mctx, (lcb_CMDBASE *)&cmd);
        if (err != LCB_SUCCESS) {
            goto GT_ERR;
        }
        n_added ++;
    }

    lcb_assert(n_added == dset->nremaining);

    if (n_added) {
        if (!initial) {
            lcb_sched_enter(dset->instance);
        }

        err = mctx->done(mctx, dset);
        mctx = NULL;

        if (err == LCB_SUCCESS) {
            if (initial == 0) {
                lcb_sched_leave(dset->instance);
            }
        } else {
            goto GT_ERR;
        }
    }

    GT_ERR:
    if (err != LCB_SUCCESS) {
        if (initial) {
            err = LCB_SCHEDFAIL_INTERNAL;
        }
        if (mctx) {
            mctx->fail(mctx);
        }

        for (ii = 0; ii < dset->nentries; ii++) {
            lcb_DURITEM *ent = dset->entries + ii;
            if (ent->done) {
                continue;
            }
            RESFLD(ent, rc) = err;
            ent_set_resdone(ent);
        }

    } else {
        dset->waiting = 1;
        dset_ref(dset);
    }

    if (dset->waiting && n_added) {
        timer_schedule(dset, STATE_TIMEOUT);
    } else {
        purge_entries(dset, LCB_ERROR);
    }

    dset_unref(dset);
    return err;
}

/**
 * Called when the criteria is to ensure the key exists somewhow
 */
static void
check_positive_durability(lcb_DURITEM *ent, const lcb_RESPOBSERVE *res)
{
    switch (res->status) {

    case LCB_OBSERVE_NOT_FOUND:
    case LCB_OBSERVE_LOGICALLY_DELETED:
        /**
         * If we get NOT_FOUND from the master, this means the key
         * simply does not exists (and we don't have to continue polling)
         */
        if (res->ismaster) {
            RESFLD(ent, rc) = LCB_KEY_ENOENT;
            ent_set_resdone(ent);
        }
        return;

    case LCB_OBSERVE_PERSISTED:
        RESFLD(ent, npersisted)++;

        if (res->ismaster) {
            RESFLD(ent, persisted_master) = 1;
            RESFLD(ent, exists_master) = 1;

        } else {
            RESFLD(ent, nreplicated)++;
        }
        break;

    case LCB_OBSERVE_FOUND:
        if (res->ismaster) {
            RESFLD(ent, exists_master) = 1;
            break; /* don't care */
        }
        RESFLD(ent, nreplicated)++;
        break;

    default:
        RESFLD(ent, rc) = LCB_EINTERNAL;
        ent_set_resdone(ent);
        break;
    }
}

/**
 * Called when the criteria is to ensure that the key is deleted somehow
 */
static void
check_negative_durability(lcb_DURITEM *ent, const lcb_RESPOBSERVE *res)
{
    switch (res->status) {
    case LCB_OBSERVE_PERSISTED:
    case LCB_OBSERVE_FOUND:
        return;

    case LCB_OBSERVE_LOGICALLY_DELETED:
        /**
         * The key has been removed from cache, but not actually deleted from
         * disk
         */
        RESFLD(ent, nreplicated)++;

        if (res->ismaster) {
            RESFLD(ent, exists_master) = 1;
        }
        break;

    case LCB_OBSERVE_NOT_FOUND:
        /**
         * No knowledge of key.
         */
        RESFLD(ent, npersisted)++;

        if (res->ismaster) {
            RESFLD(ent, persisted_master) = 1;
            RESFLD(ent, exists_master) = 1;

        } else {
            RESFLD(ent, nreplicated)++;
        }
        break;

    default:
        RESFLD(ent, rc) = LCB_EINTERNAL;
        ent_set_resdone(ent);
        break;
    }
}

/**
 * Observe callback. Called internally by libcouchbase's observe handlers
 */
void
lcb_durability_dset_update(lcb_t instance,
    lcb_DURSET *dset, lcb_error_t err, const lcb_RESPOBSERVE *resp)
{
    lcb_DURITEM *ent;

    /**
     * So we have two counters to decrement. One is the global 'done' counter
     * and the other is the iteration counter.
     *
     * The iteration counter is only decremented when we receive a NULL signal
     * in the callback, whereas the global counter is decremented once, whenever
     * the entry's criteria have been satisfied
     */

    if (resp->key == NULL) {
        dset_done_waiting(dset);
        return;
    }

    if (dset->nentries == 1) {
        ent = &dset->single.ent;
    } else {
        ent = genhash_find(dset->ht, resp->key, resp->nkey);
    }

    if (ent->done) {
        /* ignore subsequent errors */
        return;
    }

    if (err != LCB_SUCCESS) {
        RESFLD(ent, rc) = err;
        /* If it's a non-scheduling error then the item will be retried in the
         * next iteration */
        if (err == LCB_SCHEDFAIL_INTERNAL) {
            ent_set_resdone(ent);
        }
        return;
    }

    RESFLD(ent, nresponses)++;
    if (resp->cas && resp->ismaster) {
        RESFLD(ent, cas) = resp->cas;

        if (ent->reqcas && ent->reqcas != resp->cas) {
            RESFLD(ent, rc) = LCB_KEY_EEXISTS;
            ent_set_resdone(ent);
            return;
        }
    }

    if (DSET_OPTFLD(ent->parent, check_delete)) {
        check_negative_durability(ent, resp);
    } else {
        check_positive_durability(ent, resp);
    }

    if (ent_is_complete(ent)) {
        /* clear any transient errors */
        RESFLD(ent, rc) = LCB_SUCCESS;
        ent_set_resdone(ent);
    }

    (void)instance;

}

/**
 * Ensure that the user-specified criteria is possible; i.e. we have enough
 * servers and replicas. If the user requested capping, we do that here too.
 */
static int verify_critera(lcb_t instance, lcb_DURSET *dset)
{
    lcb_durability_opts_t *options = &dset->opts;

    int replica_max = LCBT_NREPLICAS(instance);
    int persist_max = replica_max + 1;

    /* persist_max is always one more than replica_max */
    if ((int)OPTFLD(options, persist_to) > persist_max) {
        if (OPTFLD(options, cap_max)) {
            OPTFLD(options, persist_to) = persist_max;

        } else {
            return -1;
        }
    }

    if (OPTFLD(options, replicate_to) == 0) {
        return 0;
    }

    if (replica_max < 0) {
        replica_max = 0;
    }
    /* now, we need at least as many nodes as we have replicas */
    if ((int)OPTFLD(options, replicate_to) > replica_max) {
        if (OPTFLD(options, cap_max)) {
            OPTFLD(options, replicate_to) = replica_max;
        } else {
            return -1;
        }
    }

    return 0;
}

#define CTX_FROM_MULTI(mcmd) (void *) ((((char *) (mcmd))) - offsetof(lcb_DURSET, mctx))

static lcb_error_t
dset_ctx_add(lcb_MULTICMD_CTX *mctx, const lcb_CMDBASE *cmd)
{
    lcb_DURSET *dset = CTX_FROM_MULTI(mctx);
    lcb_DURITEM *ent;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    /* ensure we have enough space first */
    if (dset->nentries == 0) {
        /* First entry. Optimize */
        ent = &dset->single.ent;
        dset->entries = &dset->single.ent;

    } else if (dset->nentries == 1) {
        /* More than a single entry */
        dset->ents_alloced = 2;
        dset->entries = malloc(2 * sizeof(*dset->entries));
        if (!dset->entries) {
            return LCB_CLIENT_ENOMEM;
        }
        dset->entries[0] = dset->single.ent;
        ent = &dset->entries[1];
        dset->ht = lcb_hashtable_nc_new(16);
        if (!dset->ht) {
            return LCB_CLIENT_ENOMEM;
        }
    } else if (dset->nentries < dset->ents_alloced) {
        ent = &dset->entries[dset->nentries];
    } else {
        lcb_DURITEM *newarr;
        lcb_SIZE newsize = dset->ents_alloced * 1.5;
        newarr = realloc(dset->entries, sizeof(*ent) * newsize);
        if (!newarr) {
            return LCB_CLIENT_ENOMEM;
        }
        dset->entries = newarr;
        dset->ents_alloced = newsize;
        ent = &dset->entries[dset->nentries];
    }

    /* ok. now let's initialize the entry..*/
    memset(ent, 0, sizeof (*ent));
    RESFLD(ent, nkey) = cmd->key.contig.nbytes;
    ent->hashkey = cmd->_hashkey;
    ent->reqcas = cmd->cas;
    ent->parent = dset;

    lcb_string_append(&dset->kvbufs,
        cmd->key.contig.bytes, cmd->key.contig.nbytes);
    if (cmd->_hashkey.contig.nbytes) {
        lcb_string_append(&dset->kvbufs,
            cmd->_hashkey.contig.bytes,  cmd->_hashkey.contig.nbytes);
    }
    dset->nentries++;
    return LCB_SUCCESS;
}

static lcb_error_t
dset_ctx_schedule(lcb_MULTICMD_CTX *mctx, const void *cookie)
{
    unsigned ii;
    char *kptr;
    lcb_DURSET *dset = CTX_FROM_MULTI(mctx);

    kptr = dset->kvbufs.base;
    for (ii = 0; ii < dset->nentries; ii++) {
        lcb_DURITEM *ent = dset->entries + ii;

        RESFLD(ent, key) = kptr;
        kptr += RESFLD(ent, nkey);
        if (ent->hashkey.contig.nbytes) {
            ent->hashkey.contig.bytes = kptr;
            kptr += ent->hashkey.contig.nbytes;
        }

        if (dset->ht) {
            int mt = genhash_update(dset->ht, RESFLD(ent, key),
                RESFLD(ent, nkey), ent, 0);
            if (mt != NEW) {
                lcb_durability_dset_destroy(dset);
                return LCB_DUPLICATE_COMMANDS;
            }
        }
    }

    dset_ref(dset);
    dset->cookie = cookie;
    dset->nremaining = dset->nentries;
    dset->ns_timeout = gethrtime() + LCB_US2NS(DSET_OPTFLD(dset, timeout));


    lcb_aspend_add(&dset->instance->pendops, LCB_PENDTYPE_DURABILITY, dset);
    return poll_once(dset, 1);
}

static void
dset_ctx_fail(lcb_MULTICMD_CTX *mctx)
{
    lcb_DURSET *dset = CTX_FROM_MULTI(mctx);
    lcb_durability_dset_destroy(dset);
}

LIBCOUCHBASE_API
lcb_MULTICMD_CTX *
lcb_endure3_ctxnew(lcb_t instance, const lcb_durability_opts_t *options,
    lcb_error_t *errp)
{
    lcb_DURSET *dset;
    lcb_error_t err_s;
    lcbio_pTABLE io = instance->iotable;

    if (!errp) {
        errp = &err_s;
    }

    if (!LCBT_VBCONFIG(instance)) {
        *errp = LCB_CLIENT_ETMPFAIL;
        return NULL;
    }

    dset = calloc(1, sizeof(*dset));

    if (!dset) {
        *errp = LCB_CLIENT_ENOMEM;
        return NULL;
    }

    dset->opts = *options;
    dset->instance = instance;
    dset->mctx.addcmd = dset_ctx_add;
    dset->mctx.done = dset_ctx_schedule;
    dset->mctx.fail = dset_ctx_fail;

    if (!DSET_OPTFLD(dset, timeout)) {
        DSET_OPTFLD(dset, timeout) = LCBT_SETTING(instance, durability_timeout);
    }
    if (!DSET_OPTFLD(dset, interval)) {
        DSET_OPTFLD(dset, interval) = LCBT_SETTING(instance, durability_interval);
    }

    if (-1 == verify_critera(instance, dset)) {
        free(dset);
        *errp = LCB_DURABILITY_ETOOMANY;
        return NULL;
    }
    dset->timer = io->timer.create(io->p);
    lcb_string_init(&dset->kvbufs);
    return &dset->mctx;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_durability_poll(lcb_t instance, const void *cookie,
    const lcb_durability_opts_t *options, lcb_size_t ncmds,
    const lcb_durability_cmd_t *const *cmds)
{
    lcb_MULTICMD_CTX *mctx;
    unsigned ii;
    lcb_error_t err;

    if (ncmds == 0) {
        return LCB_EINVAL;
    }

    mctx = lcb_endure3_ctxnew(instance, options, &err);
    if (!mctx) {
        return err;
    }

    for (ii = 0; ii < ncmds; ii++) {
        lcb_CMDENDURE cmd = { 0 };
        const lcb_DURABILITYCMDv0 *src = &cmds[ii]->v.v0;
        cmd.key.contig.bytes = src->key;
        cmd.key.contig.nbytes = src->nkey;
        cmd._hashkey.contig.bytes = src->hashkey;
        cmd._hashkey.contig.nbytes = src->nhashkey;
        cmd.cas = src->cas;

        err = mctx->addcmd(mctx, (lcb_CMDBASE*)&cmd);
        if (err != LCB_SUCCESS) {
            mctx->fail(mctx);
            return err;
        }
    }

    lcb_sched_enter(instance);
    err = mctx->done(mctx, cookie);
    if (err != LCB_SUCCESS) {
        lcb_sched_fail(instance);
        return err;
    } else {
        lcb_sched_leave(instance);
        SYNCMODE_INTERCEPT(instance)
    }
}

/**
 * Decrement the refcount for the 'dset'. When it hits zero then the dset is
 * freed.
 */
static void dset_unref(lcb_DURSET *dset)
{
    if (--dset->refcnt == 0) {
        lcb_durability_dset_destroy(dset);
    }
}

/**
 * Actually free the resources allocated by the dset (and all its entries).
 * Called by some other functions in libcouchbase
 */
void lcb_durability_dset_destroy(lcb_DURSET *dset)
{
    lcb_t instance = dset->instance;

    if (dset->timer) {
        lcbio_TABLE *io = instance->iotable;
        io->timer.cancel(io->p, dset->timer);
        io->timer.destroy(io->p, dset->timer);
        dset->timer = NULL;
    }

    lcb_aspend_del(&dset->instance->pendops, LCB_PENDTYPE_DURABILITY, dset);

    if (dset->nentries > 1) {
        if (dset->ht) {
            genhash_free(dset->ht);
        }
        free(dset->entries);
    }
    lcb_string_release(&dset->kvbufs);

    free(dset);
    lcb_maybe_breakout(instance);
}

/**
 * All-purpose callback dispatcher.
 */
static void timer_callback(lcb_socket_t sock, short which, void *arg)
{
    lcb_DURSET *dset = arg;
    hrtime_t now = gethrtime();

    if (dset->ns_timeout && now > dset->ns_timeout) {
        dset->next_state = STATE_TIMEOUT;
    }

    switch (dset->next_state) {
    case STATE_OBSPOLL:
        poll_once(dset, 0);
        break;

    case STATE_TIMEOUT: {
        lcb_log(LOGARGS(dset, WARN), "Polling durability timed out!");
        purge_entries(dset, LCB_ETIMEDOUT);
        break;
    }

    case STATE_IGNORE:
        break;

    default:
        lcb_assert("unexpected state" && 0);
        break;
    }

    (void)sock;
    (void)which;
}

/**
 * Schedules us to be notified with the given state within a particular amount
 * of time. This is used both for the timeout and for the interval
 */
static void
timer_schedule(lcb_DURSET *dset, unsigned int state)
{
    lcb_U32 delay = 0;
    lcbio_TABLE* io = dset->instance->iotable;
    hrtime_t now = gethrtime();

    if (state == STATE_TIMEOUT) {
        if (dset->ns_timeout && now < dset->ns_timeout) {
            delay = LCB_NS2US(dset->ns_timeout - now);
        } else {
            delay = 0;
        }

    } else if (state == STATE_OBSPOLL) {
        if (now + LCB_US2NS(DSET_OPTFLD(dset, interval)) < dset->ns_timeout) {
            delay = DSET_OPTFLD(dset, interval);
        } else {
            delay = 0;
            state = STATE_TIMEOUT;
        }
    }

    lcb_log(LOGARGS(dset, TRACE), "Scheduling timeout for %u us (%u ms)", delay, delay/1000);

    dset->next_state = state;
    io->timer.cancel(io->p, dset->timer);
    io->timer.schedule(io->p, dset->timer, delay, dset, timer_callback);
}
