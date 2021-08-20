/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017-2020 Couchbase, Inc.
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

#include <string>
#include <iostream>
#include <cstdlib>

#include <libcouchbase/couchbase.h>

static void die(const char *msg, lcb_STATUS err)
{
    std::cerr << "[ERROR] " << msg << ": " << lcb_strerror_short(err) << "\n";
    exit(EXIT_FAILURE);
}

static void store_with_observe_callback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    lcb_STATUS rc = lcb_respstore_status(resp);
    int store_ok, exists_master, persisted_master;
    uint16_t num_responses, num_replicated, num_persisted;

    lcb_respstore_observe_stored(resp, &store_ok);
    lcb_respstore_observe_master_exists(resp, &exists_master);
    lcb_respstore_observe_master_persisted(resp, &persisted_master);
    lcb_respstore_observe_num_responses(resp, &num_responses);
    lcb_respstore_observe_num_replicated(resp, &num_replicated);
    lcb_respstore_observe_num_persisted(resp, &num_persisted);

    std::cout << "Got status of operation: " << lcb_strerror_short(rc) << "\n";
    std::cout << "Stored: " << (store_ok ? "true" : "false") << "\n";
    std::cout << "Number of round-trips: " << num_responses << "\n";
    std::cout << "In memory on master: " << (exists_master ? "true" : "false") << "\n";
    std::cout << "Persisted on master: " << (persisted_master ? "true" : "false") << "\n";
    std::cout << "Nodes have value replicated: " << num_replicated << "\n";
    std::cout << "Nodes have value persisted (including master): " << num_persisted << "\n";
}

static void do_store_with_observe_durability(lcb_INSTANCE *instance)
{
    lcb_install_callback(instance, LCB_CALLBACK_STORE, reinterpret_cast<lcb_RESPCALLBACK>(store_with_observe_callback));

    std::string key = "docid";
    std::string value = "[1,2,3]";

    // tag::durability[]
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, key.data(), key.size());
    lcb_cmdstore_value(cmd, value.data(), value.size());
    lcb_cmdstore_durability_observe(cmd, -1, -1);
    // end::durability[]

    lcb_sched_enter(instance);
    lcb_STATUS err = lcb_store(instance, nullptr, cmd);
    lcb_cmdstore_destroy(cmd);
    if (err != LCB_SUCCESS) {
        printf("Unable to schedule store+durability operation: %s\n", lcb_strerror_short(err));
        lcb_sched_fail(instance);
        return;
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

static void store_callback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    lcb_STATUS rc = lcb_respstore_status(resp);
    std::cout << "Got status of operation: " << lcb_strerror_short(rc) << "\n";
}

static void do_store_with_server_durability(lcb_INSTANCE *instance)
{
    lcb_install_callback(instance, LCB_CALLBACK_STORE, reinterpret_cast<lcb_RESPCALLBACK>(store_callback));

    std::string key = "docid";
    std::string value = "[1,2,3]";

    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, key.data(), key.size());
    lcb_cmdstore_value(cmd, value.data(), value.size());
    lcb_cmdstore_durability(cmd, LCB_DURABILITYLEVEL_MAJORITY);

    lcb_sched_enter(instance);
    lcb_STATUS err = lcb_store(instance, nullptr, cmd);
    lcb_cmdstore_destroy(cmd);
    if (err != LCB_SUCCESS) {
        printf("Unable to schedule store+durability operation: %s\n", lcb_strerror_short(err));
        lcb_sched_fail(instance);
        return;
    }
    lcb_sched_leave(instance);
    lcb_wait(instance, LCB_WAIT_DEFAULT);
}

int main(int, char **)
{
    lcb_STATUS rc;
    std::string connection_string = "couchbase://localhost";
    std::string username = "Administrator";
    std::string password = "password";

    lcb_CREATEOPTS *create_options = nullptr;
    lcb_createopts_create(&create_options, LCB_TYPE_BUCKET);
    lcb_createopts_connstr(create_options, connection_string.data(), connection_string.size());
    lcb_createopts_credentials(create_options, username.data(), username.size(), password.data(), password.size());

    lcb_INSTANCE *instance;
    rc = lcb_create(&instance, create_options);
    lcb_createopts_destroy(create_options);
    if (rc != LCB_SUCCESS) {
        die("Couldn't create couchbase handle", rc);
    }

    rc = lcb_connect(instance);
    if (rc != LCB_SUCCESS) {
        die("Couldn't schedule connection", rc);
    }

    lcb_wait(instance, LCB_WAIT_DEFAULT);

    rc = lcb_get_bootstrap_status(instance);
    if (rc != LCB_SUCCESS) {
        die("Couldn't bootstrap from cluster", rc);
    }

    std::cout << "--- Performing store with observe-based durability check\n";
    do_store_with_observe_durability(instance);

    std::cout << "--- Performing store server-side durability check\n";
    do_store_with_server_durability(instance);

    lcb_destroy(instance);
    return 0;
}
