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
 * BUILD:
 *
 *      cc -o observe observe.c -lcouchbase
 *      cl /DWIN32 /Iinclude observe.c lib\libcouchbase.lib
 *
 * RUN:
 *  The example will try to connect to "default" bucket
 *  localhost:8091. See lcb_create(3) about how to specify another
 *  bucket name and server address.
 *
 *      ./observe
 *      observe.exe
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <libcouchbase/couchbase.h>

#define fail(msg) \
    fprintf(stderr, "%s\n", msg); \
    exit(EXIT_FAILURE);

/* master and up to three replicas */
struct {
    lcb_cas_t cas;
    lcb_observe_t status;
} state[4];
int cur = 0;

static void observe_callback(lcb_t instance,
                             const void *cookie,
                             lcb_error_t error,
                             const lcb_observe_resp_t *resp)
{
    if (resp->version != 0) {
        fail("unknown response version");
    }
    if (error == LCB_SUCCESS) {
        if (resp->v.v0.from_master) {
            state[0].cas = resp->v.v0.cas;
            state[0].status = resp->v.v0.status;
        } else {
            cur++;
            state[cur].cas = resp->v.v0.cas;
            state[cur].status = resp->v.v0.status;
        }
    } else {
        fail("failed to observe the key");
    }
    (void)instance;
    (void)cookie;
}

int main(int argc, char *argv[])
{
    lcb_t instance;
    lcb_error_t err;
    lcb_observe_cmd_t cmd;
    const lcb_observe_cmd_t *cmds[] = { &cmd };
    int i, n, s, num_replicas;

    if (argc != 2) {
        fail("requires key as argument");
    }
    err = lcb_create(&instance, NULL);
    if (err != LCB_SUCCESS) {
        fail("cannot create connection instance");
    }
    err = lcb_connect(instance);
    if (err != LCB_SUCCESS) {
        fail("cannot schedule connection of the instance");
    }
    err = lcb_wait(instance);
    if (err != LCB_SUCCESS) {
        fail("cannot connect the instance");
    }
    num_replicas = lcb_get_num_replicas(instance);
    lcb_set_observe_callback(instance, observe_callback);

    printf("observing the state of \"%s\":\n", argv[1]);
    memset(&cmd, 0, sizeof(cmd));
    cmd.version = 0;
    cmd.v.v0.key = argv[1];
    cmd.v.v0.nkey = strlen(argv[1]);
    err = lcb_observe(instance, NULL, 1, cmds);
    if (err != LCB_SUCCESS) {
        fail("cannot schedule observe command");
    }
    err = lcb_wait(instance);
    if (err != LCB_SUCCESS) {
        fail("cannot execute observe command");
    }

    switch (state[0].status) {
    case LCB_OBSERVE_FOUND:
        printf("* found on master, but not persisted yet\n");
        break;
    case LCB_OBSERVE_NOT_FOUND:
        printf("* not found\n");
        break;
    case LCB_OBSERVE_LOGICALLY_DELETED:
        printf("* no longer exists in cache, but may still remain on disk\n");
        n = s = 0;
        for (i = 1; i < num_replicas; ++i) {
            if (state[0].cas == state[i].cas) {
                n++;
            } else if (state[i].status != LCB_OBSERVE_NOT_FOUND) {
                s++;
            }
        }
        if (n) {
            printf("* exists on %d replica node(s)\n", n);
        }
        if (s) {
            printf("* %d replica node(s) have stale version of the key\n", n);
        }
        break;
    case LCB_OBSERVE_PERSISTED:
        printf("* persisted on master\n");
        n = s = 0;
        for (i = 1; i < num_replicas; ++i) {
            if (state[0].cas == state[i].cas) {
                n++;
            } else if (state[i].status != LCB_OBSERVE_NOT_FOUND) {
                s++;
            }
        }
        if (n) {
            printf("* exists on %d replica node(s)\n", n);
        }
        if (s) {
            printf("* %d replica node(s) have stale version of the key\n", n);
        }
        break;
    default:
        fail("unexpected status");
    }

    return EXIT_SUCCESS;
}
