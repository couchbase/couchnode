/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017 Couchbase, Inc.
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
 *   cc -o durability durability.c -lcouchbase
 *
 * RUN:
 *   ./durability [ CONNSTRING [ PASSWORD [ USERNAME ] ] ]
 *
 *   # use default durability check method
 *   ./durability couchbase://localhost
 *
 *   # force durability check method based on sequence numbers
 *   ./durability couchbase://localhost?fetch_mutation_tokens=true&dur_mutation_tokens=true
 */
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>

#define fail(msg)                                                                                                      \
    fprintf(stderr, "%s\n", msg);                                                                                      \
    exit(EXIT_FAILURE)

#define fail2(msg, err)                                                                                                \
    fprintf(stderr, "%s\n", msg);                                                                                      \
    fprintf(stderr, "Error was 0x%x (%s)\n", err, lcb_strerror(NULL, err));                                            \
    exit(EXIT_FAILURE)

static void store_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    const lcb_RESPSTOREDUR *resp = (const lcb_RESPSTOREDUR *)rb;
    fprintf(stderr, "Got status of operation: 0x%02x, %s\n", resp->rc, lcb_strerror(NULL, resp->rc));
    fprintf(stderr, "Stored: %s\n", resp->store_ok ? "true" : "false");
    fprintf(stderr, "Number of roundtrips: %d\n", resp->dur_resp->nresponses);
    fprintf(stderr, "In memory on master: %s\n", resp->dur_resp->exists_master ? "true" : "false");
    fprintf(stderr, "Persisted on master: %s\n", resp->dur_resp->persisted_master ? "true" : "false");
    fprintf(stderr, "Nodes have value replicated: %d\n", resp->dur_resp->nreplicated);
    fprintf(stderr, "Nodes have value persisted (including master): %d\n", resp->dur_resp->npersisted);
}

int main(int argc, char *argv[])
{
    lcb_t instance;
    lcb_error_t err;
    lcb_CMDSTOREDUR cmd = {0};
    struct lcb_create_st create_options = {0};
    const char *key = "foo";
    const char *value = "{\"val\":42}";

    create_options.version = 3;
    if (argc > 1) {
        create_options.v.v3.connstr = argv[1];
    }
    if (argc > 2) {
        create_options.v.v3.passwd = argv[2];
    }
    if (argc > 3) {
        create_options.v.v3.username = argv[3];
    }

    if ((err = lcb_create(&instance, &create_options)) != LCB_SUCCESS) {
        fail2("cannot create connection instance", err);
    }
    if ((err = lcb_connect(instance)) != LCB_SUCCESS) {
        fail2("Couldn't schedule connection", err);
    }
    lcb_wait(instance);
    if ((err = lcb_get_bootstrap_status(instance)) != LCB_SUCCESS) {
        fail2("Couldn't get initial cluster configuration", err);
    }
    lcb_install_callback3(instance, LCB_CALLBACK_STOREDUR, store_callback);

    LCB_CMD_SET_KEY(&cmd, key, strlen(key));
    LCB_CMD_SET_VALUE(&cmd, value, strlen(value));
    /* replicate and persist on all nodes */
    cmd.replicate_to = -1;
    cmd.persist_to = -1;
    lcb_storedur3(instance, NULL, &cmd);

    lcb_wait(instance);

    lcb_destroy(instance);
    return EXIT_SUCCESS;
}
