/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2019 Couchbase, Inc.
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

#include <libcouchbase/couchbase.h>
#include <pthread.h>
#include <string>
#include <vector>

static const char *ConnectionString_g = "couchbase://127.0.0.1/default";
static const char *DocID_g = "a_list";

struct Result {
    std::string value;
    lcb_CAS cas;
    lcb_error_t rc;

    Result() : cas(0), rc(LCB_SUCCESS) {}
};

static void op_callback(lcb_t, int cbtype, const lcb_RESPBASE *rb)
{
    Result *res = reinterpret_cast< Result * >(rb->cookie);
    res->cas = rb->cas;
    res->rc = rb->rc;
    if (cbtype == LCB_CALLBACK_GET && rb->rc == LCB_SUCCESS) {
        const lcb_RESPGET *rg = reinterpret_cast< const lcb_RESPGET * >(rb);
        res->value.assign(reinterpret_cast< const char * >(rg->value), rg->nvalue);
    }
}

static lcb_t create_instance()
{
    lcb_t instance;
    lcb_create_st crst = {};
    lcb_error_t rc;

    crst.version = 3;
    crst.v.v3.connstr = ConnectionString_g;
    crst.v.v3.username = "Administrator";
    crst.v.v3.passwd = "password";

    rc = lcb_create(&instance, &crst);
    rc = lcb_connect(instance);
    lcb_wait(instance);
    rc = lcb_get_bootstrap_status(instance);
    if (rc != LCB_SUCCESS) {
        printf("Unable to bootstrap cluster: %s\n", lcb_strerror_short(rc));
        exit(1);
    }

    lcb_install_callback3(instance, LCB_CALLBACK_GET, op_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, op_callback);
    return instance;
}

static std::string add_item_to_list(const std::string &old_list, const std::string &new_item)
{
    // Remove the trailing ']'
    std::string newval = old_list.substr(0, old_list.size() - 1);

    if (old_list.size() != 2) {
        // The current value is not an empty list. Insert preceding comma
        newval += ",";
    }

    newval += new_item;
    newval += "]";
    return newval;
}

static void *thread_func_unsafe(void *arg)
{
    lcb_error_t rc;
    lcb_t instance = create_instance();
    lcb_CMDGET gcmd = {};

    LCB_CMD_SET_KEY(&gcmd, DocID_g, strlen(DocID_g));
    lcb_sched_enter(instance);
    Result res;
    rc = lcb_get3(instance, &res, &gcmd);
    lcb_sched_leave(instance);
    lcb_wait(instance);

    const std::string *new_item = reinterpret_cast< const std::string * >(arg);
    std::string newval = add_item_to_list(res.value, *new_item);

    lcb_CMDSTORE scmd = {};
    scmd.operation = LCB_REPLACE;
    LCB_CMD_SET_KEY(&scmd, DocID_g, strlen(DocID_g));
    LCB_CMD_SET_VALUE(&scmd, newval.c_str(), newval.size());
    lcb_sched_enter(instance);
    rc = lcb_store3(instance, &res, &scmd);
    lcb_sched_leave(instance);
    lcb_wait(instance);

    if (res.rc != LCB_SUCCESS) {
        printf("Couldn't store new item %s. %s\n", new_item->c_str(), lcb_strerror(NULL, rc));
    }
    lcb_destroy(instance);
    return NULL;
}

static void *thread_func_safe(void *arg)
{
    lcb_error_t rc;
    lcb_t instance = create_instance();

    while (true) {
        lcb_CMDGET gcmd = {};
        LCB_CMD_SET_KEY(&gcmd, DocID_g, strlen(DocID_g));
        lcb_sched_enter(instance);
        Result res;
        rc = lcb_get3(instance, &res, &gcmd);
        lcb_sched_leave(instance);
        lcb_wait(instance);

        const std::string *new_item = reinterpret_cast< const std::string * >(arg);
        // Remove the trailing ']'
        std::string newval = add_item_to_list(res.value, *new_item);

        lcb_CMDSTORE scmd = {};
        scmd.operation = LCB_REPLACE;

        // Assign the CAS from the previous result
        scmd.cas = res.cas;

        LCB_CMD_SET_KEY(&scmd, DocID_g, strlen(DocID_g));
        LCB_CMD_SET_VALUE(&scmd, newval.c_str(), newval.size());
        lcb_sched_enter(instance);
        rc = lcb_store3(instance, &res, &scmd);
        lcb_sched_leave(instance);
        lcb_wait(instance);

        if (res.rc == LCB_SUCCESS) {
            break;
        } else if (res.rc == LCB_KEY_EEXISTS) {
            printf("CAS Mismatch for %s. Retrying..\n", new_item->c_str());
            continue;
        } else {
            printf("Couldn't store new item %s. %s\n", new_item->c_str(), lcb_strerror(NULL, rc));
        }
    }

    lcb_destroy(instance);
    return NULL;
}

// Boilerplate for storing our initial list as '[]'
static void store_initial_list(lcb_t instance)
{
    lcb_error_t rc;

    lcb_CMDSTORE scmd = {};
    LCB_CMD_SET_KEY(&scmd, DocID_g, strlen(DocID_g));
    LCB_CMD_SET_VALUE(&scmd, "[]", 2);
    scmd.operation = LCB_SET;

    Result res;
    lcb_sched_enter(instance);
    rc = lcb_store3(instance, &res, &scmd);
    if (rc != LCB_SUCCESS) {
        printf("Couldn't schedule store operation: %s\n", lcb_strerror_short(rc));
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
    if (res.rc != LCB_SUCCESS) {
        printf("Couldn't store initial list! %s\n", lcb_strerror(NULL, res.rc));
    }
}

// Counts the number of items in the list. Because we don't want to depend
// on a full-blown JSON parser, we just count the number of commas
static int count_list_items(const std::string &s)
{
    size_t pos = 0;
    int num_items = 0;
    while (pos != std::string::npos) {
        pos = s.find(",", pos ? pos + 1 : pos);
        if (pos != std::string::npos) {
            num_items++;
        }
    }
    if (num_items > 0) {
        // Add the last item, which lacks a comma
        num_items++;
    } else if (s.size() > 2) {
        num_items = 1;
    }
    return num_items;
}

int main(int, char **)
{
    lcb_error_t rc;
    lcb_t instance = create_instance();
    store_initial_list(instance);

    pthread_t threads[10];
    std::vector< std::string > items;

    for (int i = 0; i < 10; i++) {
        char buf[32];
        sprintf(buf, "\"item_%d\"", i);
        items.push_back(std::string(buf));
    }

    for (int i = 0; i < 10; i++) {
        pthread_create(&threads[i], NULL, thread_func_unsafe, &items[i]);
    }

    for (int i = 0; i < 10; i++) {
        void *dummy;
        pthread_join(threads[i], &dummy);
    }

    Result res;
    lcb_CMDGET gcmd = {};
    LCB_CMD_SET_KEY(&gcmd, DocID_g, strlen(DocID_g));

    lcb_sched_enter(instance);
    rc = lcb_get3(instance, &res, &gcmd);
    if (rc != LCB_SUCCESS) {
        printf("Failed to schedule get operation: %s\n", lcb_strerror_short(rc));
        exit(1);
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);

    int num_items = count_list_items(res.value);
    printf("New value: %s\n", res.value.c_str());
    printf("Have %d items in list\n", num_items);
    if (num_items != 0) {
        printf("Some items were cut off because of concurrent mutations. Expected 10!\n");
    }

    // Try it again using the safe version
    printf("Will insert items using CAS\n");

    // First reset the list
    store_initial_list(instance);

    for (int i = 0; i < 10; i++) {
        pthread_create(&threads[i], NULL, thread_func_safe, &items[i]);
    }
    for (int i = 0; i < 10; i++) {
        void *dummy;
        pthread_join(threads[i], &dummy);
    }
    lcb_sched_enter(instance);
    rc = lcb_get3(instance, &res, &gcmd);
    lcb_sched_leave(instance);
    lcb_wait(instance);

    num_items = count_list_items(res.value);
    printf("New value: %s\n", res.value.c_str());
    printf("Have %d items in list\n", num_items);

    lcb_destroy(instance);
    return 0;
}
