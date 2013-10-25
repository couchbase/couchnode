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
 * The reference count semantics works as follows.
 *
 * It is incremented once during the creation of the operation (i.e.
 * lcb_durability_poll).
 *
 * It is incremented once for each polling 'sweep', at which this code (i.e.
 * poll_once) sends out observe broadcasts.
 *
 * It is decremented when all the responses for the observe broadcasts have been
 * received (indicated by a callback with the key appearing as NULL).
 *
 * Finally, it is decremented when all entries are set to 'done'.
 *
 * This mechanism allows users to be notified on a per-key basis
 */

#include "internal.h"
#include "durability_internal.h"

#define RESFLD(e, f) (e)->result.v.v0.f
#define REQFLD(e, f) (e)->request.v.v0.f
#define OCMDFLD(e, f) (e)->ocmd.v.v0.f

#define OPTFLD(opts, opt) (opts)->v.v0.opt
#define DSET_OPTFLD(ds, opt) OPTFLD(&(ds)->opts, opt)

enum {
    STATE_OBSPOLL = 1,
    STATE_TIMEOUT = 2,

    /* spurious events. set after purge */
    STATE_IGNORE = 3
};

static void timer_callback(lcb_socket_t sock, short which, void *arg);
static void timer_schedule(lcb_durability_set_t *dset,
                           unsigned long delay,
                           unsigned int state);
static void poll_once(lcb_durability_set_t *dset);
static void purge_entries(lcb_durability_set_t *dset, lcb_error_t err);
#define dset_ref(dset) (dset)->refcnt++;
static void dset_unref(lcb_durability_set_t *dset);



/**
 * Returns true if the entry is complete, false otherwise. This only assumes
 * successful entries.
 */
static int ent_is_complete(lcb_durability_entry_t *ent)
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
static void ent_set_resdone(lcb_durability_entry_t *ent)
{
    if (ent->done) {
        return;
    }

    ent->done = 1;
    ent->parent->nremaining--;

    /**
     * Invoke the callback now :)
     */
    ent->parent->instance->callbacks.durability(ent->parent->instance,
                                                ent->parent->cookie,
                                                LCB_SUCCESS,
                                                &ent->result);

    if (ent->parent->nremaining == 0) {
        dset_unref(ent->parent);
    }
}

/**
 * Called when the last (primitive) OBSERVE response is received for the entry.
 */
static void dset_done_waiting(lcb_durability_set_t *dset)
{
    lcb_assert(dset->waiting || ("Got NULL callback twice!" && 0));

    dset->waiting = 0;

    if (dset->nremaining > 0) {
        timer_schedule(dset, DSET_OPTFLD(dset, interval), STATE_OBSPOLL);
    }
    dset_unref(dset);
}

/**
 * Purge all non-complete (i.e. not 'resdone') entries and invoke their
 * callback, setting the result's error code with the specified error
 */
static void purge_entries(lcb_durability_set_t *dset, lcb_error_t err)
{
    lcb_size_t ii;
    dset->us_timeout = 0;
    dset->next_state = STATE_IGNORE;

    /**
     * Each time we call 'ent_set_resdone' we might cause the refcount to drop
     * to zero, making 'dset' point to freed memory. To avoid this, we bump
     * up the refcount before the loop and defer the possible free operation
     * until the end.
     */
    dset_ref(dset);

    for (ii = 0; ii < dset->nentries; ii++) {
        lcb_durability_entry_t *ent = dset->entries + ii;
        if (ent->done) {
            continue;
        }
        RESFLD(ent, err) = err;
        ent_set_resdone(ent);
    }

    dset_unref(dset);
}

/**
 * Schedules a single sweep of observe requests.
 */
static void poll_once(lcb_durability_set_t *dset)
{
    lcb_size_t ii, oix;
    lcb_error_t err;

    /**
     * We should never be called while an 'iter' operation is still
     * in progress
     */
    lcb_assert(dset->waiting == 0);
    dset_ref(dset);

    for (ii = 0, oix = 0; ii < dset->nentries; ii++) {
        struct lcb_durability_entry_st *ent = dset->entries + ii;

        if (ent->done) {
            continue;
        }

        /* reset all the per-iteration fields */
        RESFLD(ent, persisted_master) = 0;
        RESFLD(ent, exists_master) = 0;
        RESFLD(ent, npersisted) = 0;
        RESFLD(ent, nreplicated) = 0;
        RESFLD(ent, cas) = 0;
        RESFLD(ent, err) = LCB_SUCCESS;

        dset->valid_entries[oix++] = ent;
    }

    lcb_assert(oix == dset->nremaining);

    err = lcb_observe_ex(dset->instance,
                         dset,
                         dset->nremaining,
                         (const void * const *)dset->valid_entries,
                         LCB_OBSERVE_TYPE_DURABILITY);

    if (err != LCB_SUCCESS) {
        for (ii = 0; ii < dset->nentries; ii++) {
            lcb_durability_entry_t *ent = dset->entries + ii;
            if (ent->done) {
                continue;
            }
            RESFLD(ent, err) = err;
            ent_set_resdone(ent);
        }

    } else {
        dset->waiting = 1;
        dset_ref(dset);
    }

    if (dset->waiting && oix) {
        lcb_uint32_t us_now = (lcb_uint32_t)(gethrtime() / 1000);
        lcb_uint32_t us_tmo;

        if (dset->us_timeout > us_now) {
            us_tmo = dset->us_timeout - us_now;
        } else {
            us_tmo = 1;
        }

        timer_schedule(dset,
                       us_tmo,
                       STATE_TIMEOUT);

    } else {
        purge_entries(dset, LCB_ERROR);
    }

    dset_unref(dset);
}

/**
 * Called when the criteria is to ensure the key exists somewhow
 */
static void check_positive_durability(lcb_durability_entry_t *ent,
                                      const lcb_observe_resp_t *res)
{
    switch (res->v.v0.status) {

    case LCB_OBSERVE_NOT_FOUND:
    case LCB_OBSERVE_LOGICALLY_DELETED:
        /**
         * If we get NOT_FOUND from the master, this means the key
         * simply does not exists (and we don't have to continue polling)
         */
        if (res->v.v0.from_master) {
            RESFLD(ent, err) = LCB_KEY_ENOENT;
            ent_set_resdone(ent);
        }
        return;

    case LCB_OBSERVE_PERSISTED:
        RESFLD(ent, npersisted)++;

        if (res->v.v0.from_master) {
            RESFLD(ent, persisted_master) = 1;
            RESFLD(ent, exists_master) = 1;

        } else {
            RESFLD(ent, nreplicated)++;
        }
        break;

    case LCB_OBSERVE_FOUND:
        if (res->v.v0.from_master) {
            RESFLD(ent, exists_master) = 1;
            break; /* don't care */
        }
        RESFLD(ent, nreplicated)++;
        break;

    default:
        RESFLD(ent, err) = LCB_EINTERNAL;
        ent_set_resdone(ent);
        break;
    }
}

/**
 * Called when the criteria is to ensure that the key is deleted somehow
 */
static void check_negative_durability(lcb_durability_entry_t *ent,
                                      const lcb_observe_resp_t *res)
{
    switch (res->v.v0.status) {
    case LCB_OBSERVE_PERSISTED:
    case LCB_OBSERVE_FOUND:
        return;

    case LCB_OBSERVE_LOGICALLY_DELETED:
        /**
         * The key has been removed from cache, but not actually deleted from
         * disk
         */
        RESFLD(ent, nreplicated)++;

        if (res->v.v0.from_master) {
            RESFLD(ent, exists_master) = 1;
        }
        break;

    case LCB_OBSERVE_NOT_FOUND:
        /**
         * No knowledge of key.
         */
        RESFLD(ent, npersisted)++;

        if (res->v.v0.from_master) {
            RESFLD(ent, persisted_master) = 1;
            RESFLD(ent, exists_master) = 1;

        } else {
            RESFLD(ent, nreplicated)++;
        }

        break;

    default:
        RESFLD(ent, err) = LCB_EINTERNAL;
        ent_set_resdone(ent);
        break;
    }
}

/**
 * Observe callback. Called internally by libcouchbase's observe handlers
 */
void lcb_durability_dset_update(lcb_t instance,
                                lcb_durability_set_t *dset,
                                lcb_error_t err,
                                const lcb_observe_resp_t *resp)
{
    lcb_durability_entry_t *ent;

    /**
     * So we have two counters to decrement. One is the global 'done' counter
     * and the other is the iteration counter.
     *
     * The iteration counter is only decremented when we receive a NULL signal
     * in the callback, whereas the global counter is decremented once, whenever
     * the entry's criteria have been satisfied
     */

    if (resp->v.v0.key == NULL) {
        dset_done_waiting(dset);
        return;
    }

    if (dset->nentries == 1) {
        ent = &dset->single.ent;
    } else {
        ent = genhash_find(dset->ht, resp->v.v0.key, resp->v.v0.nkey);
    }

    if (ent->done) {
        /* ignore subsequent errors */
        return;
    }

    if (err != LCB_SUCCESS) {
        RESFLD(ent, err) = err;
        return;
    }

    RESFLD(ent, nresponses)++;

    if (resp->v.v0.cas && resp->v.v0.from_master) {

        RESFLD(ent, cas) = resp->v.v0.cas;

        if (REQFLD(ent, cas) && REQFLD(ent, cas) != resp->v.v0.cas) {
            RESFLD(ent, err) = LCB_KEY_EEXISTS;
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
        RESFLD(ent, err) = LCB_SUCCESS;
        ent_set_resdone(ent);
    }

    (void)instance;

}

/**
 * Initialize an entry from an API command.
 */
static void ent_init(const lcb_durability_cmd_t *cmd,
                     lcb_durability_entry_t *ent)
{
    REQFLD(ent, cas) = cmd->v.v0.cas;
    REQFLD(ent, nkey) = cmd->v.v0.nkey;
    REQFLD(ent, key) = malloc(REQFLD(ent, nkey));

    /**
     * Copy the request fields to the response fields. This way we only end up
     * allocating the key once.
     */
    RESFLD(ent, key) = REQFLD(ent, key);
    RESFLD(ent, nkey) = REQFLD(ent, nkey);

    memcpy((void *)REQFLD(ent, key), cmd->v.v0.key, REQFLD(ent, nkey));

    if (cmd->v.v0.nhashkey) {
        REQFLD(ent, nhashkey) = cmd->v.v0.nhashkey;
        REQFLD(ent, hashkey) = malloc(cmd->v.v0.nhashkey);
        memcpy((void *)REQFLD(ent, hashkey), cmd->v.v0.hashkey, REQFLD(ent, nhashkey));
    }
}

/**
 * Ensure that the user-specified criteria is possible; i.e. we have enough
 * servers and replicas. If the user requested capping, we do that here too.
 */
static int verify_critera(lcb_t instance, lcb_durability_set_t *dset)
{
    lcb_durability_opts_t *options = &dset->opts;

    int replica_max = instance->nreplicas;
    int persist_max = replica_max + 1;

    /**
     * persist_max is always one more than replica_max
     */
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

LIBCOUCHBASE_API
lcb_error_t lcb_durability_poll(lcb_t instance,
                                const void *cookie,
                                const lcb_durability_opts_t *options,
                                lcb_size_t ncmds,
                                const lcb_durability_cmd_t *const *cmds)
{
    hrtime_t now = gethrtime();
    lcb_durability_set_t *dset;
    lcb_size_t ii;

    if (!ncmds) {
        return LCB_EINVAL;
    }

    dset = calloc(1, sizeof(*dset));
    if (!dset) {
        return LCB_CLIENT_ENOMEM;
    }

    dset->opts = *options;
    dset->instance = instance;

    if (!DSET_OPTFLD(dset, timeout)) {
        DSET_OPTFLD(dset, timeout) = instance->durability_timeout;
    }

    if (-1 == verify_critera(instance, dset)) {
        free(dset);
        return LCB_DURABILITY_ETOOMANY;
    }

    /* set our timeouts now */
    dset->us_timeout = (lcb_uint32_t)(now / 1000) + DSET_OPTFLD(dset, timeout);
    dset->timer = instance->io->v.v0.create_timer(instance->io);
    dset->cookie = cookie;
    dset->nentries = ncmds;
    dset->nremaining = ncmds;

    /** Get the timings */
    if (!DSET_OPTFLD(dset, interval)) {
        DSET_OPTFLD(dset, interval) = LCB_DEFAULT_DURABILITY_INTERVAL;
    }

    /* list of observe commands to schedule */
    if (dset->nentries == 1) {
        dset->entries = &dset->single.ent;
        dset->valid_entries = &dset->single.entp;

    } else {
        dset->ht = lcb_hashtable_nc_new(dset->nentries);
        dset->entries = calloc(dset->nentries, sizeof(*dset->entries));
        dset->valid_entries = malloc(dset->nentries * sizeof(*dset->valid_entries));
        if (dset->entries == NULL || dset->valid_entries == NULL) {
            lcb_durability_dset_destroy(dset);
            return LCB_CLIENT_ENOMEM;
        }
    }

    /* set up the observe commands */
    for (ii = 0; ii < dset->nentries; ii++) {
        lcb_durability_entry_t *ent = dset->entries + ii;
        ent_init(cmds[ii], ent);
        ent->parent = dset;

        if (dset->nentries > 1) {
            int mt = genhash_update(dset->ht,
                                    REQFLD(ent, key),
                                    REQFLD(ent, nkey),
                                    ent, 0);
            if (mt != NEW) {
                lcb_durability_dset_destroy(dset);
                return LCB_DUPLICATE_COMMANDS;
            }
        }
    }

    /**
     * Increase the refcount by one. This will be decremented
     * when the remaining_total count hits 0
     */

    dset_ref(dset);
    hashset_add(instance->durability_polls, dset);
    timer_schedule(dset, 0, STATE_OBSPOLL);
    return lcb_synchandler_return(instance, LCB_SUCCESS);
}

/**
 * Decrement the refcount for the 'dset'. When it hits zero then the dset is
 * freed.
 */
static void dset_unref(lcb_durability_set_t *dset)
{
    if (--dset->refcnt == 0) {
        lcb_durability_dset_destroy(dset);
    }
}

/**
 * Actually free the resources allocated by the dset (and all its entries).
 * Called by some other functions in libcouchbase
 */
void lcb_durability_dset_destroy(lcb_durability_set_t *dset)
{
    lcb_size_t ii;
    lcb_t instance = dset->instance;

    if (dset->timer) {
        dset->instance->io->v.v0.delete_timer(dset->instance->io, dset->timer);
        dset->instance->io->v.v0.destroy_timer(dset->instance->io, dset->timer);
        dset->timer = NULL;
    }

    for (ii = 0; ii < dset->nentries; ii++) {
        lcb_durability_entry_t *ent = dset->entries + ii;
        free((void *)REQFLD(ent, key));
    }

    hashset_remove(dset->instance->durability_polls, dset);

    if (dset->nentries > 1) {
        if (dset->ht) {
            genhash_free(dset->ht);
        }
        free(dset->entries);
        free(dset->valid_entries);
    }

    free(dset);
    lcb_maybe_breakout(instance);
}

/**
 * All-purpose callback dispatcher.
 */
static void timer_callback(lcb_socket_t sock, short which, void *arg)
{
    lcb_durability_set_t *dset = arg;
    hrtime_t ns_now = gethrtime();
    lcb_uint32_t us_now = (lcb_uint32_t)(ns_now / 1000);

    if (us_now >= (dset->us_timeout - 50)) {
        dset->next_state = STATE_TIMEOUT;
    }


    switch (dset->next_state) {
    case STATE_OBSPOLL:
        poll_once(dset);
        break;

    case STATE_TIMEOUT: {


        if (us_now >= (dset->us_timeout - 50)) {
            purge_entries(dset, LCB_ETIMEDOUT);

        } else {
            timer_schedule(dset,
                           dset->us_timeout - us_now,
                           STATE_TIMEOUT);
        }
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
static void timer_schedule(lcb_durability_set_t *dset,
                           unsigned long delay,
                           unsigned int state)
{
    dset->next_state = state;
    if (!delay) {
        delay = 1;
    }
    dset->instance->io->v.v0.delete_timer(dset->instance->io, dset->timer);

    dset->instance->io->v.v0.update_timer(dset->instance->io,
                                          dset->timer,
                                          delay,
                                          dset,
                                          timer_callback);
}
