/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2013 Couchbase, Inc.
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

#include "internal.h"
#include "packetutils.h"
#include "bucketconfig/clconfig.h"
#include "vbucket/aliases.h"
#include "sllist-inl.h"

#define LOGARGS(instance, lvl) (instance)->settings, "newconfig", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOG(instance, lvlbase, msg) lcb_log(instance->settings, "newconfig", LCB_LOG_##lvlbase, __FILE__, __LINE__, msg)

#define SERVER_FMT "%s:%s (%p)"
#define SERVER_ARGS(s) (s)->curhost->host, (s)->curhost->port, (void *)s

typedef struct lcb_GUESSVB_st {
    time_t last_update; /**< Last time this vBucket was heuristically set */
    char newix; /**< New index, heuristically determined */
    char oldix; /**< Original index, according to map */
    char used; /**< Flag indicating whether or not this entry has been used */
} lcb_GUESSVB;

/* Ignore configuration updates for heuristically guessed vBuckets for a
 * maximum amount of [n] seconds */
#define MAX_KEEP_GUESS 20

static int
should_keep_guess(lcb_GUESSVB *guess, lcbvb_VBUCKET *vb)
{
    if (guess->newix == guess->oldix) {
        /* Heuristic position is the same as starting position */
        return 0;
    }
    if (vb->servers[0] != guess->oldix) {
        /* Previous master changed */
        return 0;
    }

    if (time(NULL) - guess->last_update > MAX_KEEP_GUESS) {
        /* Last usage too old */
        return 0;
    }

    return 1;
}

void
lcb_vbguess_newconfig(lcb_t instance, lcbvb_CONFIG *cfg, lcb_GUESSVB *guesses)
{
    unsigned ii;
    for (ii = 0; ii < cfg->nvb; ii++) {
        lcb_GUESSVB *guess = guesses + ii;
        lcbvb_VBUCKET *vb = cfg->vbuckets + ii;

        if (!guess->used) {
            continue;
        }

        /* IF: Heuristically learned a new index, _and_ the old index (which is
         * known to be bad) is the same index stated by the new config */
        if (should_keep_guess(guess, vb)) {
            lcb_log(LOGARGS(instance, TRACE), "Keeping heuristically guessed index. VBID=%d. Current=%d. Old=%d.", ii, guess->newix, guess->oldix);
            vb->servers[0] = guess->newix;
        } else {
            /* We don't reassign to the guess structure here. The idea is that
             * we will simply use the new config. If this gives us problems, the
             * config will re-learn again. */
            lcb_log(LOGARGS(instance, TRACE), "Ignoring heuristically guessed index. VBID=%d. Current=%d. Old=%d. New=%d", ii, guess->newix, guess->oldix, vb->servers[0]);
            guess->used = 0;
        }
    }
}

int
lcb_vbguess_remap(lcb_t instance, int vbid, int bad)
{

    lcb_GUESSVB *guesses = instance->vbguess;
    lcb_GUESSVB *guess = guesses + vbid;
    int newix;

    if (LCBT_SETTING(instance, vb_noguess)) {
        return -1;
    } else {
        newix = lcbvb_nmv_remap(LCBT_VBCONFIG(instance), vbid, bad);
    }

    if (guesses && newix > -1 && newix != bad) {
        guess->newix = newix;
        guess->oldix = bad;
        guess->used = 1;
        guess->last_update = time(NULL);
    }

    return newix;
}

/**
 * Finds the index of an older server using the current config
 * @param config The new configuration
 * @param server The server to match
 * @return The new index, or -1 if the current server is not present in the new
 * config
 */
static int
find_new_index(lcbvb_CONFIG* config, mc_SERVER *server)
{
    int ii, nnew;
    nnew = VB_NSERVERS(config);
    for (ii = 0; ii < nnew; ii++) {
        /** get the 'authority' */
        const char *newhost = VB_NODESTR(config, ii);
        if (!newhost) {
            continue;
        }
        if (strcmp(newhost, server->datahost) == 0) {
            return ii;
        }
    }
    return -1;
}

static void
log_vbdiff(lcb_t instance, lcbvb_CONFIGDIFF *diff)
{
    char **curserver;
    lcb_log(LOGARGS(instance, INFO), "Config Diff: [ vBuckets Modified=%d ], [Sequence Changed=%d]", diff->n_vb_changes, diff->sequence_changed);
    if (diff->servers_added) {
        for (curserver = diff->servers_added; *curserver; curserver++) {
            lcb_log(LOGARGS(instance, INFO), "Detected server %s added", *curserver);
        }
    }
    if (diff->servers_removed) {
        for (curserver = diff->servers_removed; *curserver; curserver++) {
            lcb_log(LOGARGS(instance, INFO), "Detected server %s removed", *curserver);
        }
    }
}

/**
 * This callback is invoked for packet relocation twice. It tries to relocate
 * commands to their destination server. Some commands may not be relocated
 * either because they have no explicit "Relocation Information" (i.e. no
 * specific vbucket) or because the command is tied to a specific server (i.e.
 * CMD_STAT).
 *
 * Note that `KEEP_PACKET` here doesn't mean to "Save" the packet, but rather
 * to keep the packet in the current queue (so that if the server ends up
 * being removed, the command will fail); rather than being relocated to
 * another server.
 */
static int
iterwipe_cb(mc_CMDQUEUE *cq, mc_PIPELINE *oldpl, mc_PACKET *oldpkt, void *arg)
{
    protocol_binary_request_header hdr;
    mc_SERVER *srv = (mc_SERVER *)oldpl;
    mc_PIPELINE *newpl;
    mc_PACKET *newpkt;
    int newix;

    (void)arg;

    mcreq_read_hdr(oldpkt, &hdr);

    if (!lcb_should_retry(srv->settings, oldpkt, LCB_MAX_ERROR)) {
        return MCREQ_KEEP_PACKET;
    }

    if (LCBVB_DISTTYPE(cq->config) == LCBVB_DIST_VBUCKET) {
        newix = lcbvb_vbmaster(cq->config, ntohs(hdr.request.vbucket));

    } else {
        const void *key = NULL;
        lcb_SIZE nkey = 0;
        int tmpid;

        /* XXX: We ignore hashkey. This is going away soon, and is probably
         * better than simply failing the items. */
        mcreq_get_key(oldpkt, &key, &nkey);
        lcbvb_map_key(cq->config, key, nkey, &tmpid, &newix);
    }

    if (newix < 0 || newix > (int)cq->npipelines) {
        return MCREQ_KEEP_PACKET;
    }


    newpl = cq->pipelines[newix];
    if (newpl == oldpl || newpl == NULL) {
        return MCREQ_KEEP_PACKET;
    }

    lcb_log(LOGARGS((lcb_t)cq->cqdata, DEBUG), "Remapped packet %p (SEQ=%u) from "SERVER_FMT " to " SERVER_FMT,
        (void*)oldpkt, oldpkt->opaque, SERVER_ARGS((mc_SERVER*)oldpl), SERVER_ARGS((mc_SERVER*)newpl));

    /** Otherwise, copy over the packet and find the new vBucket to map to */
    newpkt = mcreq_renew_packet(oldpkt);
    newpkt->flags &= ~MCREQ_STATE_FLAGS;
    mcreq_reenqueue_packet(newpl, newpkt);
    mcreq_packet_handled(oldpl, oldpkt);
    return MCREQ_REMOVE_PACKET;
}

static int
replace_config(lcb_t instance, clconfig_info *next_config)
{
    mc_CMDQUEUE *cq = &instance->cmdq;
    mc_PIPELINE **ppold, **ppnew;
    unsigned ii, nold, nnew;

    nnew = LCBVB_NSERVERS(next_config->vbc);
    ppnew = calloc(nnew, sizeof(*ppnew));
    ppold = mcreq_queue_take_pipelines(cq, &nold);

    /**
     * Determine which existing servers are still part of the new cluster config
     * and place it inside the new list.
     */
    for (ii = 0; ii < nold; ii++) {
        mc_SERVER *cur = (mc_SERVER *)ppold[ii];
        int newix = find_new_index(next_config->vbc, cur);
        if (newix > -1) {
            cur->pipeline.index = newix;
            ppnew[newix] = &cur->pipeline;
            ppold[ii] = NULL;
            lcb_log(LOGARGS(instance, INFO), "Reusing server "SERVER_FMT". OldIndex=%d. NewIndex=%d", SERVER_ARGS(cur), ii, newix);
        }
    }

    /**
     * Once we've moved the kept servers to the new list, allocate new mc_SERVER
     * structures for slots that don't have an existing mc_SERVER. We must do
     * this before add_pipelines() is called, so that there are no holes inside
     * ppnew
     */
    for (ii = 0; ii < nnew; ii++) {
        if (!ppnew[ii]) {
            ppnew[ii] = (mc_PIPELINE *)mcserver_alloc2(instance, next_config->vbc, ii);
            ppnew[ii]->index = ii;
        }
    }

    /**
     * Once we have all the server structures in place for the new config,
     * transfer the new config along with the new list over to the CQ structure.
     */
    mcreq_queue_add_pipelines(cq, ppnew, nnew, next_config->vbc);
    for (ii = 0; ii < nnew; ii++) {
        mcreq_iterwipe(cq, ppnew[ii], iterwipe_cb, NULL);
    }

    /**
     * Go through all the servers that are to be removed and relocate commands
     * from their queues into the new queues
     */
    for (ii = 0; ii < nold; ii++) {
        if (!ppold[ii]) {
            continue;
        }

        mcreq_iterwipe(cq, ppold[ii], iterwipe_cb, NULL);
        mcserver_fail_chain((mc_SERVER *)ppold[ii], LCB_MAP_CHANGED);
        mcserver_close((mc_SERVER *)ppold[ii]);
    }

    for (ii = 0; ii < nnew; ii++) {
        if (mcserver_has_pending((mc_SERVER*)ppnew[ii])) {
            ppnew[ii]->flush_start(ppnew[ii]);
        }
    }

    free(ppnew);
    free(ppold);
    return LCB_CONFIGURATION_CHANGED;
}

void lcb_update_vbconfig(lcb_t instance, clconfig_info *config)
{
    lcb_size_t ii;
    int change_status;
    clconfig_info *old_config;
    mc_CMDQUEUE *q = &instance->cmdq;

    old_config = instance->cur_configinfo;
    instance->cur_configinfo = config;
    lcb_clconfig_incref(config);
    q->config = instance->cur_configinfo->vbc;
    q->cqdata = instance;

    if (!instance->vbguess) {
        instance->vbguess = calloc(config->vbc->nvb, sizeof(*instance->vbguess));
    }

    if (old_config) {
        lcbvb_CONFIGDIFF *diff = lcbvb_compare(old_config->vbc, config->vbc);

        if (diff) {
            log_vbdiff(instance, diff);
            lcbvb_free_diff(diff);
        }

        /* Apply the vb guesses */
        lcb_vbguess_newconfig(instance, config->vbc, instance->vbguess);

        change_status = replace_config(instance, config);
        if (change_status == -1) {
            LOG(instance, ERR, "Couldn't replace config");
            return;
        }
        lcb_clconfig_decref(old_config);
    } else {
        unsigned nservers;
        mc_PIPELINE **servers;
        nservers = VB_NSERVERS(config->vbc);
        if ((servers = malloc(sizeof(*servers) * nservers)) == NULL) {
            assert(servers);
            lcb_log(LOGARGS(instance, FATAL), "Couldn't allocate memory for new server list! (n=%u)", nservers);
            return;
        }

        for (ii = 0; ii < nservers; ii++) {
            mc_SERVER *srv;
            if ((srv = mcserver_alloc(instance, ii)) == NULL) {
                assert(srv);
                lcb_log(LOGARGS(instance, FATAL), "Couldn't allocate memory for server instance!");
                return;
            }
            servers[ii] = &srv->pipeline;
        }

        mcreq_queue_add_pipelines(q, servers, nservers, config->vbc);
        change_status = LCB_CONFIGURATION_NEW;
        free(servers);
    }

    /* Update the list of nodes here for server list */
    hostlist_clear(instance->ht_nodes);
    for (ii = 0; ii < LCBVB_NSERVERS(config->vbc); ++ii) {
        const char *hp = lcbvb_get_hostport(config->vbc, ii,
            LCBVB_SVCTYPE_MGMT, LCBVB_SVCMODE_PLAIN);
        if (hp) {
            hostlist_add_stringz(instance->ht_nodes, hp, LCB_CONFIG_HTTP_PORT);
        }
    }

    instance->callbacks.configuration(instance, change_status);
    lcb_maybe_breakout(instance);
}


