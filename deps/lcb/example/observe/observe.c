/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

/*
 * BUILD: `cc -o observe observe.c -lcouchbase`
 * RUN: `./observe key`
 */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <libcouchbase/couchbase.h>

#define fail(msg) \
    fprintf(stderr, "%s\n", msg); \
    exit(EXIT_FAILURE);

#define fail2(msg, err) \
    fprintf(stderr, "%s\n", msg); \
    fprintf(stderr, "Error was 0x%x (%s)\n", err, lcb_strerror(NULL, err))

typedef struct {
    int master;
    lcb_U8 status;
    lcb_U64 cas;
} node_info;

typedef struct {
    unsigned nresp;
    node_info *nodeinfo;
} observe_info;

static void
observe_callback(lcb_t instance, const void *cookie, lcb_error_t error,
    const lcb_observe_resp_t *resp)
{
    observe_info *obs_info = (observe_info *)cookie;
    node_info *ni = &obs_info->nodeinfo[obs_info->nresp];

    if (resp->v.v0.nkey == 0) {
        fprintf(stderr, "All nodes have replied\n");
        return;
    }

    if (error != LCB_SUCCESS) {
        fprintf(stderr, "Failed to observe key from node. 0x%x (%s)\n",
            error, lcb_strerror(instance, error));
        obs_info->nresp++;
        return;
    }

    /* Copy over the fields we care about */
    ni->cas = resp->v.v0.cas;
    ni->status = resp->v.v0.status;
    ni->master = resp->v.v0.from_master;

    /* Increase the response counter */
    obs_info->nresp++;
}

static void
observe_masteronly_callback(lcb_t instance, const void *cookie, lcb_error_t err,
    const lcb_observe_resp_t *resp)
{
    if (!resp->v.v0.nkey) {
        return;
    }

    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Failed to get CAS from master: 0x%x (%s)\n", err, lcb_strerror(instance, err));
        return;
    }
    *(lcb_cas_t*)cookie = resp->v.v0.cas;
}

int main(int argc, char *argv[])
{
    lcb_t instance;
    lcb_error_t err;
    lcb_observe_cmd_t cmd = { 0 };
    const lcb_observe_cmd_t *cmdp = &cmd;
    observe_info obs_info;
    unsigned nservers, ii;
    lcb_cas_t curcas = 0;

    if (argc != 2) {
        fail("requires key as argument");
    }

    if ((err = lcb_create(&instance, NULL)) != LCB_SUCCESS) {
        fail2("cannot create connection instance", err);
    }
    if ((err = lcb_connect(instance)) != LCB_SUCCESS) {
        fail2("Couldn't schedule connection", err);
    }
    lcb_wait(instance);
    if ((err = lcb_get_bootstrap_status(instance)) != LCB_SUCCESS) {
        fail2("Couldn't get initial cluster configuration", err);
    }


    nservers = lcb_get_num_nodes(instance);
    obs_info.nodeinfo = calloc(nservers, sizeof (*obs_info.nodeinfo));
    obs_info.nresp = 0;
    cmd.v.v0.key = argv[1];
    cmd.v.v0.nkey = strlen(argv[1]);

    lcb_set_observe_callback(instance, observe_callback);
    printf("observing the state of '%s':\n", argv[1]);

    if ((err = lcb_observe(instance, &obs_info, 1, &cmdp)) != LCB_SUCCESS) {
        fail2("Couldn't schedule observe request", err);
    }

    lcb_wait(instance);
    for (ii = 0; ii < obs_info.nresp; ii++) {
        node_info *ni = &obs_info.nodeinfo[ii];
        fprintf(stderr, "Got status from %s node:\n", ni->master ? "master" : "replica");
        fprintf(stderr, "\tCAS: 0x0%lx\n", ni->cas);
        fprintf(stderr, "\tStatus (RAW): 0x%02x\n", ni->status);
        fprintf(stderr, "\tExists [CACHE]: %s\n", ni->status & LCB_OBSERVE_NOT_FOUND ? "No" : "Yes");
        fprintf(stderr, "\tExists [DISK]: %s\n", ni->status & LCB_OBSERVE_PERSISTED ? "Yes" : "No");
        fprintf(stderr, "\n");
    }
    free(obs_info.nodeinfo);

    /* The next example shows how to use lcb_observe() to only request the
     * CAS from the master node */

    fprintf(stderr, "Will request CAS from master...\n");
    lcb_set_observe_callback(instance, observe_masteronly_callback);
    cmd.version = 1;
    cmd.v.v1.options = LCB_OBSERVE_MASTER_ONLY;
    cmd.v.v1.key = argv[1];
    cmd.v.v1.nkey = strlen(argv[1]);
    cmdp = &cmd;
    if ((err = lcb_observe(instance, &curcas, 1, &cmdp)) != LCB_SUCCESS) {
        fail2("Couldn't schedule observe request!\n", err);
    }
    lcb_wait(instance);
    fprintf(stderr, "CAS on master is 0x%lx\n", curcas);

    lcb_destroy(instance);
    return EXIT_SUCCESS;
}
