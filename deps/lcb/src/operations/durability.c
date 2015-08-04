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

#define LCBDUR_PRIV_SYMS 1

#include "internal.h"
#include "durability_internal.h"
#include <lcbio/iotable.h>
#define LOGARGS(c, lvl) (c)->instance->settings, "endure", LCB_LOG_##lvl, __FILE__, __LINE__

static void timer_callback(lcb_socket_t sock, short which, void *arg);
static void poll_once(lcb_DURSET *dset);

int
lcbdur_ent_check_done(lcb_DURITEM *ent)
{
    lcb_DURABILITYOPTSv0 *opts = &ent->parent->opts;

    if (!RESFLD(ent, exists_master)) {
        /** Primary cache doesn't have correct version */
        return 0;
    }
    if (opts->persist_to) {
        if (!RESFLD(ent, persisted_master)) {
            return 0;
        }
        if (RESFLD(ent, npersisted) < opts->persist_to) {
            return 0;
        }
    }

    if (opts->replicate_to) {
        if (RESFLD(ent, nreplicated) < opts->replicate_to) {
            return 0;
        }
    }

    return 1;
}

static int
server_criteria_satisfied(const lcb_DURITEM *item,
    const lcbdur_SERVINFO *info, int is_master)
{
    const lcb_DURSET *dset = item->parent;
    if (!info->exists) {
        return 0;
    }
    if (info->persisted) {
        return 1;
    }
    if (DSET_OPTFLD(dset, persist_to) == 0) {
        return 1;
    }
    if (DSET_OPTFLD(dset, persist_to) == 1 && !is_master) {
        return 1;
    }
    return 0;
}

void
lcbdur_prepare_item(lcb_DURITEM *ent, lcb_U16 *ixarray, size_t *nitems)
{
    size_t ii, oix = 0, maxix = 0;
    lcb_DURSET *dset = ent->parent;
    lcb_t instance = dset->instance;
    lcbvb_CONFIG *vbc = LCBT_VBCONFIG(instance);

    RESFLD(ent, persisted_master) = 0;
    RESFLD(ent, exists_master) = 0;
    RESFLD(ent, npersisted) = 0;
    RESFLD(ent, nreplicated) = 0;
    RESFLD(ent, cas) = 0;
    RESFLD(ent, rc) = LCB_SUCCESS;

    if (DSET_OPTFLD(dset, persist_to) == 1 &&
            DSET_OPTFLD(dset, replicate_to) == 0) {
        maxix = 1; /* Only master! */
    } else {
        maxix = LCBT_NREPLICAS(instance) + 1;
    }

    for (ii = 0; ii < maxix; ii++) {
        int cur_ix;
        lcbdur_SERVINFO *info = &ent->sinfo[ii];
        const mc_SERVER *s_exp;

        cur_ix = lcbvb_vbserver(vbc, ent->vbid, ii);
        if (cur_ix < 0) {
            memset(info, 0, sizeof(*info));
            continue;
        }

        s_exp = LCBT_GET_SERVER(instance, cur_ix);
        if (s_exp != info->server) {
            memset(info, 0, sizeof(*info));

        } else if (server_criteria_satisfied(ent, info, ii==0)) {
            /* Update counters as required */
            if (ii == 0) {
                RESFLD(ent, exists_master) = 1;
            } else {
                RESFLD(ent, nreplicated)++;
            }

            if (info->persisted) {
                RESFLD(ent, npersisted)++;
                if (ii == 0) {
                    RESFLD(ent, persisted_master) = 1;
                }
            }
            continue;
        }

        /* Otherwise, write the expected server out */
        ixarray[oix++] = s_exp->pipeline.index;
    }
    *nitems = oix;
}

void
lcbdur_update_item(lcb_DURITEM *item, int flags, int srvix)
{
    lcbdur_SERVINFO *info;
    lcb_t instance;
    int is_master;
    const mc_SERVER *server;

    if (!flags || item->done) {
        return;
    }

    info = lcbdur_ent_getinfo(item, srvix);
    if (!info) {
        lcb_log(LOGARGS(item->parent, DEBUG), "Ignoring response from server %d. Not a master or replica for vBucket %d", srvix, item->vbid);
        return;
    }

    instance = item->parent->instance;
    is_master = lcbvb_vbmaster(LCBT_VBCONFIG(instance), item->vbid) == srvix;
    server = LCBT_GET_SERVER(instance, srvix);

    memset(info, 0, sizeof(*info));
    info->server = server;

    if (flags & LCBDUR_UPDATE_PERSISTED) {
        info->persisted = 1;
        RESFLD(item, npersisted)++;
        if (is_master) {
            RESFLD(item, persisted_master) = 1;
        }
    }
    if (flags & LCBDUR_UPDATE_REPLICATED) {
        info->exists = 1;
        if (is_master) {
            RESFLD(item, exists_master) = 1;
        } else {
            RESFLD(item, nreplicated)++;
        }
    }
    if (lcbdur_ent_check_done(item)) {
        RESFLD(item, rc) = LCB_SUCCESS;
        lcbdur_ent_finish(item);
    }
}

lcbdur_SERVINFO *
lcbdur_ent_getinfo(lcb_DURITEM *item, int srvix)
{
    size_t ii;
    lcb_t instance = item->parent->instance;

    for (ii = 0; ii < LCBT_NREPLICAS(instance)+1; ii++) {
        int ix = lcbvb_vbserver(LCBT_VBCONFIG(instance), item->vbid, ii);
        if (ix > -1 && ix == srvix) {
            return &item->sinfo[ii];
        }
    }
    return NULL;
}

void lcbdur_ent_finish(lcb_DURITEM *ent)
{
    lcb_RESPCALLBACK callback;
    lcb_t instance;

    if (ent->done) {
        return;
    }

    ent->done = 1;
    ent->parent->nremaining--;

    /** Invoke the callback now :) */
    ent->result.cookie = (void *)ent->parent->cookie;
    instance = ent->parent->instance;

    if (ent->parent->is_durstore) {
        lcb_RESPSTOREDUR resp = { 0 };
        resp.key = ent->result.key;
        resp.nkey = ent->result.nkey;
        resp.rc = ent->result.rc;
        resp.cas = ent->reqcas;
        resp.cookie = ent->result.cookie;
        resp.store_ok = 1;
        resp.dur_resp = &ent->result;

        callback = lcb_find_callback(instance, LCB_CALLBACK_STOREDUR);
        callback(instance, LCB_CALLBACK_STOREDUR, (lcb_RESPBASE*)&resp);
    } else {
        callback = lcb_find_callback(instance, LCB_CALLBACK_ENDURE);
        callback(instance, LCB_CALLBACK_ENDURE, (lcb_RESPBASE*)&ent->result);
    }

    if (ent->parent->nremaining == 0) {
        lcbdur_unref(ent->parent);
    }
}

/**
 * Called when the last (primitive) OBSERVE response is received for the entry.
 */
void lcbdur_reqs_done(lcb_DURSET *dset)
{
    lcb_assert(dset->waiting || ("Got NULL callback twice!" && 0));

    dset->waiting = 0;

    if (dset->nremaining > 0) {
        lcbdur_switch_state(dset, LCBDUR_STATE_OBSPOLL);
    }
    lcbdur_unref(dset);
}

/**
 * Schedules a single sweep of observe requests.
 * The `initial` parameter determines if this is a retry or if this is the
 * initial scheduling.
 */
static void poll_once(lcb_DURSET *dset)
{
    lcb_error_t err;

    /* We should never be called while an 'iter' operation is still in progress */
    lcb_assert(dset->waiting == 0);
    lcbdur_ref(dset);

    err = DSET_PROCS(dset)->poll(dset);
    if (err == LCB_SUCCESS) {
        lcbdur_ref(dset);
        lcbdur_switch_state(dset, LCBDUR_STATE_TIMEOUT);
    } else {
        dset->lasterr = err;
        lcbdur_switch_state(dset, LCBDUR_STATE_OBSPOLL);
    }

    lcbdur_unref(dset);
}

#define DUR_MIN(a,b) (a) < (b) ? (a) : (b)

LIBCOUCHBASE_API
lcb_error_t
lcb_durability_validate(lcb_t instance,
    lcb_U16 *persist_to, lcb_U16 *replicate_to, int options)
{
    int replica_max = DUR_MIN(
        LCBT_NREPLICAS(instance),
        LCBT_NDATASERVERS(instance)-1);
    int persist_max = replica_max + 1;

    if (*persist_to == 0 && *replicate_to == 0) {
        /* Empty values! */
        return LCB_EINVAL;
    }

    /* persist_max is always one more than replica_max */
    if ((int)*persist_to > persist_max) {
        if (options & LCB_DURABILITY_VALIDATE_CAPMAX) {
            *persist_to = persist_max;
        } else {
            return LCB_DURABILITY_ETOOMANY;
        }
    }

    if (*replicate_to == 0) {
        return LCB_SUCCESS;
    }

    if (replica_max < 0) {
        replica_max = 0;
    }

    /* now, we need at least as many nodes as we have replicas */
    if ((int)*replicate_to > replica_max) {
        if (options & LCB_DURABILITY_VALIDATE_CAPMAX) {
            *replicate_to = replica_max;
        } else {
            return LCB_DURABILITY_ETOOMANY;
        }
    }
    return LCB_SUCCESS;

}

#define CTX_FROM_MULTI(mcmd) (void *) ((((char *) (mcmd))) - offsetof(lcb_DURSET, mctx))

static lcb_error_t
dset_ctx_add(lcb_MULTICMD_CTX *mctx, const lcb_CMDBASE *cmd)
{
    lcb_DURSET *dset = CTX_FROM_MULTI(mctx);
    lcb_DURITEM *ent;
    int vbid, srvix;

    if (LCB_KEYBUF_IS_EMPTY(&cmd->key)) {
        return LCB_EMPTY_KEY;
    }

    LCB_SSOBUF_ALLOC(&ent, &dset->entries_, lcb_DURITEM);
    if (!ent) {
        return LCB_CLIENT_ENOMEM;
    }

    mcreq_map_key(&dset->instance->cmdq, &cmd->key, &cmd->_hashkey,
        MCREQ_PKT_BASESIZE, &vbid, &srvix);

    /* ok. now let's initialize the entry..*/
    memset(ent, 0, sizeof (*ent));
    RESFLD(ent, nkey) = cmd->key.contig.nbytes;
    ent->reqcas = cmd->cas;
    ent->parent = dset;
    ent->vbid = vbid;

    lcb_string_append(&dset->kvbufs,
        cmd->key.contig.bytes, cmd->key.contig.nbytes);
    if (DSET_PROCS(dset)->ent_add) {
        return DSET_PROCS(dset)->ent_add(dset, ent, (lcb_CMDENDURE*)cmd);
    } else {
        return LCB_SUCCESS;
    }
}

static lcb_error_t
dset_ctx_schedule(lcb_MULTICMD_CTX *mctx, const void *cookie)
{
    size_t ii;
    lcb_error_t err;
    lcb_DURSET *dset = CTX_FROM_MULTI(mctx);
    char *kptr = dset->kvbufs.base;

    if (!DSET_COUNT(dset)) {
        lcbdur_destroy(dset);
        return LCB_EINVAL;
    }

    for (ii = 0; ii < DSET_COUNT(dset); ii++) {
        lcb_DURITEM *ent = DSET_ENTRIES(dset) + ii;
        RESFLD(ent, key) = kptr;
        kptr += RESFLD(ent, nkey);
    }

    if (DSET_PROCS(dset)->schedule) {
        err = DSET_PROCS(dset)->schedule(dset);
        if (err != LCB_SUCCESS) {
            lcbdur_destroy(dset);
            return err;
        }
    }

    lcbdur_ref(dset);
    dset->cookie = cookie;
    dset->nremaining = DSET_COUNT(dset);
    dset->ns_timeout = gethrtime() + LCB_US2NS(DSET_OPTFLD(dset, timeout));

    lcb_aspend_add(&dset->instance->pendops, LCB_PENDTYPE_DURABILITY, dset);
    lcbdur_switch_state(dset, LCBDUR_STATE_INIT);
    return LCB_SUCCESS;
}

static void
dset_ctx_fail(lcb_MULTICMD_CTX *mctx)
{
    lcb_DURSET *dset = CTX_FROM_MULTI(mctx);
    lcbdur_destroy(dset);
}

void lcbdurctx_set_durstore(lcb_MULTICMD_CTX *mctx, int enabled)
{

    lcb_DURSET *dset = CTX_FROM_MULTI(mctx);
    dset->is_durstore = enabled;
}

static lcb_U8
get_poll_meth(lcb_t instance, const lcb_DURABILITYOPTSv0 *options)
{
    /* Need to call this first, so we can actually allocate the appropriate
     * data for this.. */
    lcb_U8 meth = options->pollopts;
    if (meth == LCB_DURABILITY_MODE_DEFAULT) {
        meth = LCB_DURABILITY_MODE_CAS;

        if (LCBT_SETTING(instance, fetch_mutation_tokens) &&
                LCBT_SETTING(instance, dur_mutation_tokens)) {
            size_t ii;
            for (ii = 0; ii < LCBT_NSERVERS(instance); ii++) {
                mc_SERVER *s = LCBT_GET_SERVER(instance, ii);
                if (s->mutation_tokens) {
                    meth = LCB_DURABILITY_MODE_SEQNO;
                    break;
                }
            }
        }
    }
    return meth;
}

LIBCOUCHBASE_API
lcb_MULTICMD_CTX *
lcb_endure3_ctxnew(lcb_t instance, const lcb_durability_opts_t *options,
    lcb_error_t *errp)
{
    lcb_DURSET *dset;
    lcb_error_t err_s;
    lcbio_pTABLE io = instance->iotable;
    const lcb_DURABILITYOPTSv0 *opts_in = &options->v.v0;

    if (!errp) {
        errp = &err_s;
    }

    *errp = LCB_SUCCESS;

    if (!LCBT_VBCONFIG(instance)) {
        *errp = LCB_CLIENT_ETMPFAIL;
        return NULL;
    }

    dset = calloc(1, sizeof(*dset));
    if (!dset) {
        *errp = LCB_CLIENT_ENOMEM;
        return NULL;
    }

    /* Ensure we don't clobber options from older versions */
    dset->opts.cap_max = opts_in->cap_max;
    dset->opts.check_delete = opts_in->check_delete;
    dset->opts.interval = opts_in->interval;
    dset->opts.persist_to = opts_in->persist_to;
    dset->opts.replicate_to = opts_in->replicate_to;
    dset->opts.timeout = opts_in->timeout;

    if (options->version > 0) {
        dset->opts.pollopts = opts_in->pollopts;
    }

    dset->opts.pollopts = get_poll_meth(instance, &dset->opts);

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

    *errp = lcb_durability_validate(instance,
        &dset->opts.persist_to, &dset->opts.replicate_to,
        dset->opts.cap_max ? LCB_DURABILITY_VALIDATE_CAPMAX : 0);

    if (*errp != LCB_SUCCESS) {
        free(dset);
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
void lcbdur_unref(lcb_DURSET *dset)
{
    if (--dset->refcnt == 0) {
        lcbdur_destroy(dset);
    }
}

/**
 * Actually free the resources allocated by the dset (and all its entries).
 * Called by some other functions in libcouchbase
 */
void lcbdur_destroy(lcb_DURSET *dset)
{
    lcb_t instance = dset->instance;

    if (DSET_PROCS(dset)->clean) {
        DSET_PROCS(dset)->clean(dset);
    }

    if (dset->timer) {
        lcbio_TABLE *io = instance->iotable;
        io->timer.cancel(io->p, dset->timer);
        io->timer.destroy(io->p, dset->timer);
        dset->timer = NULL;
    }

    lcb_aspend_del(&dset->instance->pendops, LCB_PENDTYPE_DURABILITY, dset);
    LCB_SSOBUF_CLEAN(&dset->entries_);
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
        dset->next_state = LCBDUR_STATE_TIMEOUT;
    }

    switch (dset->next_state) {
    case LCBDUR_STATE_OBSPOLL:
    case LCBDUR_STATE_INIT:
        poll_once(dset);
        break;

    case LCBDUR_STATE_TIMEOUT: {
        lcb_size_t ii;
        lcb_error_t err = dset->lasterr ? dset->lasterr : LCB_ETIMEDOUT;
        dset->ns_timeout = 0;
        dset->next_state = LCBDUR_STATE_IGNORE;

        lcb_log(LOGARGS(dset, WARN), "Polling durability timed out!");

        lcbdur_ref(dset);

        for (ii = 0; ii < DSET_COUNT(dset); ii++) {
            lcb_DURITEM *ent = DSET_ENTRIES(dset) + ii;
            if (ent->done) {
                continue;
            }
            if (RESFLD(ent, rc) == LCB_SUCCESS) {
                RESFLD(ent, rc) = err;
            }
            lcbdur_ent_finish(ent);
        }

        lcbdur_unref(dset);
        break;
    }

    case LCBDUR_STATE_IGNORE:
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
void
lcbdur_switch_state(lcb_DURSET *dset, unsigned int state)
{
    lcb_U32 delay = 0;
    lcbio_TABLE* io = dset->instance->iotable;
    hrtime_t now = gethrtime();

    if (state == LCBDUR_STATE_TIMEOUT) {
        if (dset->ns_timeout && now < dset->ns_timeout) {
            delay = LCB_NS2US(dset->ns_timeout - now);
        } else {
            delay = 0;
        }
    } else if (state == LCBDUR_STATE_OBSPOLL) {
        if (now + LCB_US2NS(DSET_OPTFLD(dset, interval)) < dset->ns_timeout) {
            delay = DSET_OPTFLD(dset, interval);
        } else {
            delay = 0;
            state = LCBDUR_STATE_TIMEOUT;
        }
    } else if (state == LCBDUR_STATE_INIT) {
        delay = 0;
    }

    dset->next_state = state;
    io->timer.cancel(io->p, dset->timer);
    io->timer.schedule(io->p, dset->timer, delay, dset, timer_callback);
}
