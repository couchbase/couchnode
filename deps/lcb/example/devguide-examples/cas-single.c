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

#include <unistd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <libcouchbase/couchbase.h>

static void get_callback(lcb_t instance, int cbtype, const lcb_RESPGET *resp)
{
    if (resp->rc == LCB_SUCCESS) {
        lcb_CAS *cas = (lcb_CAS *)resp->cookie;
        *cas = resp->cas;
    }
    (void)instance;
    (void)cbtype;
}

static void store_callback(lcb_t instance, int cbtype, const lcb_RESPGET *resp)
{
    lcb_error_t *res = (lcb_error_t *)resp->cookie;
    *res = resp->rc;
    (void)instance;
    (void)cbtype;
}

static lcb_t create_instance()
{
    lcb_t instance;
    lcb_error_t rc;
    struct lcb_create_st crst = {};

    crst.version = 3;
    crst.v.v3.connstr = "couchbase://127.0.0.1/travel-sample";
    crst.v.v3.username = "Administrator";
    crst.v.v3.passwd = "password";

    rc = lcb_create(&instance, &crst);
    if (rc != LCB_SUCCESS) {
        printf("failed to create instance: %s\n", lcb_strerror_short(rc));
        exit(1);
    }
    rc = lcb_connect(instance);
    if (rc != LCB_SUCCESS) {
        printf("failed to connect to cluster: %s\n", lcb_strerror_short(rc));
        exit(1);
    }
    lcb_wait(instance);
    rc = lcb_get_bootstrap_status(instance);
    if (rc != LCB_SUCCESS) {
        printf("failed to bootstrap cluster: %s\n", lcb_strerror_short(rc));
        exit(1);
    }

    lcb_install_callback3(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    return instance;
}

static void store_initial_value(lcb_t instance, const char *key, int nkey, const char *val, int nval)
{
    lcb_error_t rc, res = LCB_SUCCESS;

    lcb_CMDSTORE cmd = {};
    LCB_CMD_SET_KEY(&cmd, key, nkey);
    LCB_CMD_SET_VALUE(&cmd, val, nval);
    cmd.operation = LCB_UPSERT;

    rc = lcb_store3(instance, &res, &cmd);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "failed to store document: %s\n", lcb_strerror_short(rc));
        return;
    }
    lcb_wait(instance);
    if (res != LCB_SUCCESS) {
        fprintf(stderr, "failed to store document: %s\n", lcb_strerror_short(res));
    }
}

static void replace_value(lcb_t instance, const char *key, int nkey, const char *val, int nval, lcb_CAS cas)
{
    lcb_error_t rc, res = LCB_SUCCESS;
    int attempts = 3;
L_STORE :
    {
        lcb_CMDSTORE cmd = {};
        cmd.operation = LCB_REPLACE;
        // Assign the CAS from the previous result
        cmd.cas = cas;
        LCB_CMD_SET_KEY(&cmd, key, nkey);
        LCB_CMD_SET_VALUE(&cmd, val, nval);
        rc = lcb_store3(instance, &res, &cmd);
        if (rc != LCB_SUCCESS) {
            fprintf(stderr, "failed to store document: %s\n", lcb_strerror_short(rc));
            return;
        }
        lcb_wait(instance);
    }

    if (res == LCB_SUCCESS) {
        printf("successfully stored\n");
    } else if (res == LCB_KEY_EEXISTS) {
        if (attempts == 0) {
            printf("CAS mismatch. giving up..\n");
            return;
        }
        attempts--;
        printf("CAS mismatch. retrying..\n");
        {
            lcb_CMDGET cmd = {};
            LCB_CMD_SET_KEY(&cmd, key, nkey);

            rc = lcb_get3(instance, &cas, &cmd);
            if (rc != LCB_SUCCESS) {
                fprintf(stderr, "failed to get document: %s\n", lcb_strerror_short(rc));
                return;
            }
            lcb_wait(instance);
        }
        goto L_STORE;
    } else {
        fprintf(stderr, "failed to store store document: %s\n", lcb_strerror_short(res));
    }
}

int main()
{
    lcb_error_t rc;
    lcb_t instance = create_instance();
    const char *key = "key_1";
    lcb_CAS invalid_cas = -1;

    store_initial_value(instance, key, strlen(key), "foo", 3);

    replace_value(instance, key, strlen(key), "bar", 3, invalid_cas);

    lcb_destroy(instance);
    return 0;
}
