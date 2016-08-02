/*
 *     Copyright 2015 Couchbase, Inc.
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

#include "internal.h"
#include <libcouchbase/api3.h>
#include "durability_internal.h"

#define ENT_SEQNO(ent) (ent)->reqseqno

static void
seqno_callback(lcb_t instance, int ign, const lcb_RESPBASE *rb)
{
    const lcb_RESPOBSEQNO *resp = (const lcb_RESPOBSEQNO*)rb;
    char *pp = resp->cookie;
    lcb_DURITEM *ent;
    int flags = 0;
    lcb_U64 seqno_mem, seqno_disk;

    pp -= offsetof(lcb_DURITEM, callback);
    ent = (lcb_DURITEM *)pp;
    /* Now, process the response */

    if (resp->rc != LCB_SUCCESS) {
        RESFLD(ent, rc) = resp->rc;
        goto GT_TALLY;
    }

    if (resp->old_uuid) {
        /* Failover! */
        seqno_mem = seqno_disk = resp->old_seqno;
        if (seqno_mem < ENT_SEQNO(ent)) {
            RESFLD(ent, rc) = LCB_MUTATION_LOST;
            lcbdur_ent_finish(ent);
            goto GT_TALLY;
        }
    } else {
        seqno_mem = resp->mem_seqno;
        seqno_disk = resp->persisted_seqno;
    }

    if (seqno_mem < ENT_SEQNO(ent)) {
        goto GT_TALLY;
    }

    flags = LCBDUR_UPDATE_REPLICATED;
    if (seqno_disk >= ENT_SEQNO(ent)) {
        flags |= LCBDUR_UPDATE_PERSISTED;
    }

    lcbdur_update_item(ent, flags, resp->server_index);

    GT_TALLY:
    if (!--ent->parent->waiting) {
        /* avoid ssertion (wait==0)! */
        ent->parent->waiting = 1;
        lcbdur_reqs_done(ent->parent);
    }

    (void)ign; (void)instance;
}

static lcb_error_t
seqno_poll(lcb_DURSET *dset)
{
    lcb_error_t ret_err = LCB_EINTERNAL; /* This should never be returned */
    size_t ii;
    int has_ops = 0;
    lcb_t instance = dset->instance;

    lcb_sched_enter(instance);
    for (ii = 0; ii < DSET_COUNT(dset); ii++) {
        lcb_DURITEM *ent = DSET_ENTRIES(dset) + ii;
        size_t jj, nservers = 0;
        lcb_U16 servers[4];
        lcb_CMDOBSEQNO cmd = { 0 };

        if (ent->done) {
            continue;
        }

        cmd.uuid = ent->uuid;
        cmd.vbid = ent->vbid;
        cmd.cmdflags = LCB_CMD_F_INTERNAL_CALLBACK;
        ent->callback = seqno_callback;

        lcbdur_prepare_item(ent, servers, &nservers);
        for (jj = 0; jj < nservers; jj++) {
            lcb_error_t err;
            cmd.server_index = servers[jj];
            err = lcb_observe_seqno3(instance, &ent->callback, &cmd);
            if (err == LCB_SUCCESS) {
                dset->waiting++;
                has_ops = 1;
            } else {
                RESFLD(ent, rc) = ret_err = err;
            }
        }
    }
    lcb_sched_leave(instance);
    if (!has_ops) {
        return ret_err;
    } else {
        return LCB_SUCCESS;
    }
}

static lcb_error_t
seqno_ent_add(lcb_DURSET *dset, lcb_DURITEM *item, const lcb_CMDENDURE *cmd)
{
    const lcb_MUTATION_TOKEN *stok = NULL;

    if (cmd->cmdflags & LCB_CMDENDURE_F_MUTATION_TOKEN) {
        stok = cmd->mutation_token;
    }

    if (stok == NULL) {
        lcb_t instance = dset->instance;
        if (!instance->dcpinfo) {
            return LCB_DURABILITY_NO_MUTATION_TOKENS;
        }
        if (item->vbid >= LCBT_VBCONFIG(instance)->nvb) {
            return LCB_EINVAL;
        }
        stok = instance->dcpinfo + item->vbid;
        if (LCB_MUTATION_TOKEN_ID(stok) == 0) {
            return LCB_DURABILITY_NO_MUTATION_TOKENS;
        }
    }

    /* Set the fields */
    memset(item->sinfo, 0, sizeof(item->sinfo[0]) * 4);
    item->uuid = LCB_MUTATION_TOKEN_ID(stok);
    ENT_SEQNO(item) = LCB_MUTATION_TOKEN_SEQ(stok);
    return LCB_SUCCESS;
}

lcbdur_PROCS lcbdur_seqno_procs = {
        seqno_poll,
        seqno_ent_add,
        NULL, /*schedule*/
        NULL /*clean*/
};
