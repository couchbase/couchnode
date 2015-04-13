/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2015 Couchbase, Inc.
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

#define LCBDUR_PRIV_SYMS
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include "internal.h"
#include "durability_internal.h"

#define DSET_HT(dset) (dset)->impldata

/* Called when the criteria is to ensure the key exists somewhow */
static int
check_positive_durability(lcb_DURITEM *ent, const lcb_RESPOBSERVE *res)
{
    switch (res->status) {
    case LCB_OBSERVE_NOT_FOUND:
    case LCB_OBSERVE_LOGICALLY_DELETED:
        /* If we get NOT_FOUND from the master, this means the key
         * simply does not exists (and we don't have to continue polling) */
        if (res->ismaster) {
            RESFLD(ent, rc) = LCB_KEY_ENOENT;
            lcbdur_ent_finish(ent);
        }
        return 0;

    case LCB_OBSERVE_PERSISTED:
        return LCBDUR_UPDATE_PERSISTED | LCBDUR_UPDATE_REPLICATED;

    case LCB_OBSERVE_FOUND:
        return LCBDUR_UPDATE_REPLICATED;

    default:
        RESFLD(ent, rc) = LCB_EINTERNAL;
        lcbdur_ent_finish(ent);
        return 0;
    }
}

/* Called when the criteria is to ensure that the key is deleted somehow */
static int
check_negative_durability(lcb_DURITEM *ent, const lcb_RESPOBSERVE *res)
{
    switch (res->status) {
    case LCB_OBSERVE_PERSISTED:
    case LCB_OBSERVE_FOUND:
        /* Still there! */
        return 0;

    case LCB_OBSERVE_LOGICALLY_DELETED:
        /* removed from cache, but not actually deleted from disk */
        return LCBDUR_UPDATE_REPLICATED;

    case LCB_OBSERVE_NOT_FOUND:
        /* No knowledge of key. */
        return LCBDUR_UPDATE_PERSISTED | LCBDUR_UPDATE_REPLICATED;

    default:
        RESFLD(ent, rc) = LCB_EINTERNAL;
        lcbdur_ent_finish(ent);
        return 0;
    }
}

/* Observe callback. Called internally by observe.c */
void
lcbdur_cas_update(lcb_t instance,
    lcb_DURSET *dset, lcb_error_t err, const lcb_RESPOBSERVE *resp)
{
    lcb_DURITEM *ent;
    int flags;

    if (resp->key == NULL) {
        /* Last observe response for requests. Start polling after interval */
        lcbdur_reqs_done(dset);
        return;
    }

    if (DSET_COUNT(dset) == 1) {
        ent = DSET_ENTRIES(dset);
    } else {
        ent = genhash_find(DSET_HT(dset), resp->key, resp->nkey);
    }

    if (ent->done) {
        /* ignore subsequent errors */
        return;
    }

    if (err != LCB_SUCCESS) {
        RESFLD(ent, rc) = err;
        return;
    }

    RESFLD(ent, nresponses)++;
    if (resp->cas && resp->ismaster) {
        RESFLD(ent, cas) = resp->cas;

        if (ent->reqcas && ent->reqcas != resp->cas) {
            RESFLD(ent, rc) = LCB_KEY_EEXISTS;
            lcbdur_ent_finish(ent);
            return;
        }
    }

    if (DSET_OPTFLD(ent->parent, check_delete)) {
        flags = check_negative_durability(ent, resp);
    } else {
        flags = check_positive_durability(ent, resp);
    }

    lcbdur_update_item(ent, flags, resp->ttp);
    (void)instance;
}

static lcb_error_t
cas_poll(lcb_DURSET *dset)
{
    lcb_MULTICMD_CTX *mctx;
    size_t ii;
    lcb_error_t err;
    lcb_t instance = dset->instance;

    mctx = lcb_observe_ctx_dur_new(dset->instance);
    if (!mctx) {
        return LCB_CLIENT_ENOMEM;
    }

    for (ii = 0; ii < DSET_COUNT(dset); ii++) {
        lcb_CMDOBSERVE cmd = { 0 };
        lcb_U16 servers[4];
        size_t nservers = 0;

        struct lcb_DURITEM_st *ent = DSET_ENTRIES(dset) + ii;
        if (ent->done) {
            continue;
        }

        lcbdur_prepare_item(ent, servers, &nservers);
        if (nservers == 0) {
            RESFLD(ent, rc) = LCB_NO_MATCHING_SERVER;
            continue;
        }

        LCB_KREQ_SIMPLE(&cmd.key, RESFLD(ent, key), RESFLD(ent, nkey));
        LCB_CMD__SETVBID(&cmd, ent->vbid);
        cmd.servers_ = servers;
        cmd.nservers_ = nservers;

        err = mctx->addcmd(mctx, (lcb_CMDBASE *)&cmd);
        if (err != LCB_SUCCESS) {
            mctx->fail(mctx);
            return err;
        }
    }

    lcb_sched_enter(instance);
    err = mctx->done(mctx, dset);
    mctx = NULL;

    if (err == LCB_SUCCESS) {
        lcb_sched_leave(instance);
        dset->waiting = 1;
    } else {
        lcb_sched_fail(instance);
    }
    return err;
}

static lcb_error_t
cas_schedule(lcb_DURSET *dset)
{
    size_t ii;

    if (DSET_COUNT(dset) < 2) {
        return LCB_SUCCESS;
    }

    DSET_HT(dset) = lcb_hashtable_nc_new(DSET_COUNT(dset));
    if (!DSET_HT(dset)) {
        return LCB_CLIENT_ENOMEM;
    }

    for (ii = 0; ii < DSET_COUNT(dset); ++ii) {
        int mt;
        lcb_DURITEM *ent = DSET_ENTRIES(dset) + ii;

        mt = genhash_update(DSET_HT(dset),
            RESFLD(ent, key), RESFLD(ent, nkey), ent, 0);
        if (mt != NEW) {
            return LCB_DUPLICATE_COMMANDS;
        }
    }
    return LCB_SUCCESS;
}

static void
cas_clean(lcb_DURSET *dset)
{
    if (DSET_HT(dset)) {
        genhash_free(DSET_HT(dset));
    }
}

lcbdur_PROCS lcbdur_cas_procs = {
        cas_poll,
        NULL, /* ent_add */
        cas_schedule,
        cas_clean
};
