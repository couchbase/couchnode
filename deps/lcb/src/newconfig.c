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

#define LOGARGS(instance, lvl) instance->settings, "newconfig", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOG(instance, lvlbase, msg) lcb_log(instance->settings, "newconfig", LCB_LOG_##lvlbase, __FILE__, __LINE__, msg)

#define SERVER_FMT "%s:%s (%p)"
#define SERVER_ARGS(s) (s)->curhost->host, (s)->curhost->port, (void *)s

/**
 * Finds the index of an older server using the current config
 * @param config The new configuration
 * @param server The server to match
 * @return The new index, or -1 if the current server is not present in the new
 * config
 */
static int
find_new_index(VBUCKET_CONFIG_HANDLE config, mc_SERVER *server)
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
log_vbdiff(lcb_t instance, VBUCKET_CONFIG_DIFF *diff)
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
 * CMD_STAT)
 */
static int
iterwipe_cb(mc_CMDQUEUE *cq, mc_PIPELINE *oldpl, mc_PACKET *oldpkt, void *arg)
{
    protocol_binary_request_header hdr;
    mc_SERVER *srv = (mc_SERVER *)oldpl;
    mc_PIPELINE *newpl;
    mc_PACKET *newpkt;
    int newix;
    uint8_t op;

    (void)arg;

    memcpy(&hdr, SPAN_BUFFER(&oldpkt->kh_span), sizeof(hdr.bytes));
    op = hdr.request.opcode;
    if (op == PROTOCOL_BINARY_CMD_OBSERVE ||
            op == PROTOCOL_BINARY_CMD_STAT ||
            op == PROTOCOL_BINARY_CMD_GET_CLUSTER_CONFIG) {
        return MCREQ_KEEP_PACKET;
    }

    newix = vbucket_get_master(cq->config, ntohs(hdr.request.vbucket));
    if (newix < 0 || newix > (int)cq->npipelines) {
        return MCREQ_KEEP_PACKET;
    }

    if (!lcb_should_retry(srv->settings, oldpkt, LCB_MAX_ERROR)) {
        return MCREQ_KEEP_PACKET;
    }

    newpl = cq->pipelines[newix];
    if (newpl == oldpl || newpl == NULL) {
        return MCREQ_KEEP_PACKET;
    }

    lcb_log(LOGARGS(cq->instance, DEBUG), "Remapped packet %p (SEQ=%u) from "SERVER_FMT " to " SERVER_FMT,
        (void*)oldpkt, oldpkt->opaque, SERVER_ARGS((mc_SERVER*)oldpl), SERVER_ARGS((mc_SERVER*)newpl));

    /** Otherwise, copy over the packet and find the new vBucket to map to */
    newpkt = mcreq_dup_packet(oldpkt);
    newpkt->flags &= ~MCREQ_STATE_FLAGS;
    mcreq_reenqueue_packet(newpl, newpkt);
    mcreq_packet_handled(oldpl, oldpkt);
    return MCREQ_REMOVE_PACKET;
}

static int
is_new_config(lcb_t instance, VBUCKET_CONFIG_HANDLE oldc, VBUCKET_CONFIG_HANDLE newc)
{
    VBUCKET_CONFIG_DIFF *diff;
    VBUCKET_CHANGE_STATUS chstatus = VBUCKET_NO_CHANGES;
    diff = vbucket_compare(oldc, newc);

    if (diff) {
        chstatus = vbucket_what_changed(diff);
        log_vbdiff(instance, diff);
        vbucket_free_diff(diff);
    }

    if (diff == NULL || chstatus == VBUCKET_NO_CHANGES) {
        lcb_log(LOGARGS(instance, DEBUG), "Ignoring config update. No server changes; DIFF=%p", (void*)diff);
        return 0;
    }
    return 1;
}

static int
replace_config(lcb_t instance, clconfig_info *next_config)
{
    VBUCKET_DISTRIBUTION_TYPE dist_t;
    mc_CMDQUEUE *cq = &instance->cmdq;
    mc_PIPELINE **ppold, **ppnew;
    unsigned ii, nold, nnew;

    dist_t = VB_DISTTYPE(next_config->vbc);
    nnew = VB_NSERVERS(next_config->vbc);
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
    if (dist_t == VBUCKET_DISTRIBUTION_VBUCKET) {
        for (ii = 0; ii < nnew; ii++) {
            mcreq_iterwipe(cq, ppnew[ii], iterwipe_cb, NULL);
        }
    }

    /**
     * Go through all the servers that are to be removed and relocate commands
     * from their queues into the new queues
     */
    for (ii = 0; ii < nold; ii++) {
        if (!ppold[ii]) {
            continue;
        }
        if (dist_t == VBUCKET_DISTRIBUTION_VBUCKET) {
            mcreq_iterwipe(cq, ppold[ii], iterwipe_cb, NULL);
        }
        mcserver_fail_chain((mc_SERVER *)ppold[ii], LCB_MAP_CHANGED);
        mcserver_close((mc_SERVER *)ppold[ii]);
    }

    for (ii = 0; ii < nnew; ii++) {
        ppnew[ii]->flush_start(ppnew[ii]);
    }

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
    instance->dist_type = VB_DISTTYPE(config->vbc);
    lcb_clconfig_incref(config);
    instance->nreplicas = (lcb_uint16_t)VB_NREPLICAS(config->vbc);
    q->config = instance->cur_configinfo->vbc;
    q->instance = instance;

    if (old_config) {
        if (is_new_config(instance, old_config->vbc, config->vbc)) {
            change_status = replace_config(instance, config);
            if (change_status == -1) {
                LOG(instance, ERR, "Couldn't replace config");
                return;
            }
            lcb_clconfig_decref(old_config);
        } else {
            change_status = LCB_CONFIGURATION_UNCHANGED;
        }
    } else {
        unsigned nservers;
        mc_PIPELINE **servers;
        nservers = VB_NSERVERS(config->vbc);
        if ((servers = malloc(sizeof(*servers) * nservers)) == NULL) {
            abort();
        }

        for (ii = 0; ii < nservers; ii++) {
            mc_SERVER *srv;
            if ((srv = mcserver_alloc(instance, ii)) == NULL) {
                abort();
            }
            servers[ii] = &srv->pipeline;
        }

        mcreq_queue_add_pipelines(q, servers, nservers, config->vbc);
        change_status = LCB_CONFIGURATION_NEW;
    }

    /* Notify anyone interested in this event... */
    if (change_status != LCB_CONFIGURATION_UNCHANGED) {
        if (instance->vbucket_state_listener != NULL) {
            for (ii = 0; ii < q->npipelines; ii++) {
                lcb_server_t *server = (lcb_server_t *)q->pipelines[ii];
                instance->vbucket_state_listener(server);
            }
        }
    }

    instance->callbacks.configuration(instance, change_status);
    lcb_maybe_breakout(instance);
}
