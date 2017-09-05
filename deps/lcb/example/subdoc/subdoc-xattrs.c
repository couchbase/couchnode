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

#include <unistd.h>
#include <stdlib.h>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include <assert.h>
#include <string.h>

static void generic_callback(lcb_t instance, int type, const lcb_RESPBASE *rb)
{
    if (rb->rc != LCB_SUCCESS && rb->rc != LCB_SUBDOC_MULTI_FAILURE) {
        printf("Failure: 0x%x, %s\n", rb->rc, lcb_strerror(instance, rb->rc));
        return;
    }

    switch (type) {
        case LCB_CALLBACK_SDLOOKUP: {
            lcb_SDENTRY ent;
            size_t iter = 0;
            size_t index = 0;
            const lcb_RESPSUBDOC *resp = (const lcb_RESPSUBDOC *)rb;

            while (lcb_sdresult_next(resp, &ent, &iter)) {
                if (index == 0 && ent.status != LCB_SUCCESS) {
                    // attribute does not exist, skip response
                    return;
                }
                if (index == 1) {
                    printf(" * %.*s: %.*s%%\n", (int)resp->nkey, resp->key, (int)ent.nvalue, ent.value);
                }
                index++;
            }
            break;
        }
        case LCB_CALLBACK_SDMUTATE: {
            lcb_SDENTRY ent;
            size_t iter = 0;
            size_t oix = 0;
            const lcb_RESPSUBDOC *resp = (const lcb_RESPSUBDOC *)rb;
            while (lcb_sdresult_next(resp, &ent, &iter)) {
                size_t index = oix++;
                if (type == LCB_CALLBACK_SDMUTATE) {
                    index = ent.index;
                }
                printf("[%lu]: 0x%x. %.*s\n", index, ent.status, (int)ent.nvalue, ent.value);
            }
            break;
        }
    }
}

static void n1qlrow_callback(lcb_t instance, int type, const lcb_RESPN1QL *resp)
{
    if (resp->rc != LCB_SUCCESS) {
        printf("Failure: 0x%x, %s\n", resp->rc, lcb_strerror(instance, resp->rc));
        printf("HTTP status: %d\n", (int)resp->htresp->htstatus);
        {
            const char *const *hdr = resp->htresp->headers;
            for (; hdr && *hdr; hdr++) {
                printf("%s", *hdr);
                if (hdr + 1) {
                    printf(" = %s", *(++hdr));
                }
                printf("\n");
            }
        }
        printf("%.*s\n", (int)resp->nrow, resp->row);
        return;
    }

    char *start = "{\"docID\":\"";
    char *stop = "\"";

    char *key = strnstr(resp->row, start, resp->nrow);
    if (key == NULL || key != resp->row) {
        return;
    }
    key += strlen(start);
    char *z = strnstr(key, stop, resp->nrow - (resp->row - key));
    if (z == NULL) {
        return;
    }
    *z = '\0';

    lcb_sched_enter(instance);
    {
        lcb_error_t rc;
        lcb_CMDSUBDOC cmd = {};
        lcb_SDSPEC specs[2] = {};
        char *path = "discounts.jsmith123";

        LCB_CMD_SET_KEY(&cmd, key, strlen(key));

        specs[0].sdcmd = LCB_SDCMD_EXISTS;
        specs[0].options = LCB_SDSPEC_F_XATTRPATH;
        LCB_SDSPEC_SET_PATH(&specs[0], path, strlen(path));

        specs[1].sdcmd = LCB_SDCMD_GET;
        specs[1].options = LCB_SDSPEC_F_XATTRPATH;
        LCB_SDSPEC_SET_PATH(&specs[1], path, strlen(path));

        cmd.specs = specs;
        cmd.nspecs = 2;
        rc = lcb_subdoc3(instance, NULL, &cmd);
        assert(rc == LCB_SUCCESS);
    }
    lcb_sched_leave(instance);
}

#define DEFAULT_CONNSTR "couchbase://localhost/travel-sample"

static lcb_t connect_as(char *username, char *password)
{
    struct lcb_create_st crst = {.version = 3};

    crst.v.v3.connstr = DEFAULT_CONNSTR;
    crst.v.v3.username = username;
    crst.v.v3.passwd = password;

    lcb_t instance;
    lcb_error_t rc;

    rc = lcb_create(&instance, &crst);
    assert(rc == LCB_SUCCESS);
    rc = lcb_connect(instance);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    rc = lcb_get_bootstrap_status(instance);
    assert(rc == LCB_SUCCESS);

    lcb_install_callback3(instance, LCB_CALLBACK_DEFAULT, generic_callback);

    return instance;
}

int main()
{
    lcb_error_t rc;
    lcb_t instance;

    instance = connect_as("Administrator", "password");

    // Add key-value pairs to hotel_10138, representing traveller-Ids and associated discount percentages
    {
        lcb_CMDSUBDOC cmd = {};
        lcb_SDSPEC specs[4] = {};
        char *key = "hotel_10138";

        LCB_CMD_SET_KEY(&cmd, key, strlen(key));
        {
            char *path = "discounts.jsmith123";
            char *val = "20";

            specs[0].sdcmd = LCB_SDCMD_DICT_UPSERT;
            specs[0].options = LCB_SDSPEC_F_MKINTERMEDIATES | LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[0], path, strlen(path));
            LCB_CMD_SET_VALUE(&specs[0], val, strlen(val));
        }
        {
            char *path = "discounts.pjones356";
            char *val = "30";

            specs[1].sdcmd = LCB_SDCMD_DICT_UPSERT;
            specs[1].options = LCB_SDSPEC_F_MKINTERMEDIATES | LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[1], path, strlen(path));
            LCB_CMD_SET_VALUE(&specs[1], val, strlen(val));
        }
        // The following lines, "insert" and "remove", simply demonstrate insertion and
        // removal of the same path and value
        {
            char *path = "discounts.jbrown789";
            char *val = "25";

            specs[2].sdcmd = LCB_SDCMD_DICT_ADD;
            specs[2].options = LCB_SDSPEC_F_MKINTERMEDIATES | LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[2], path, strlen(path));
            LCB_CMD_SET_VALUE(&specs[2], val, strlen(val));
        }
        {
            char *path = "discounts.jbrown789";

            specs[3].sdcmd = LCB_SDCMD_REMOVE;
            specs[3].options = LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[3], path, strlen(path));
        }

        cmd.specs = specs;
        cmd.nspecs = 4;
        rc = lcb_subdoc3(instance, NULL, &cmd);
        assert(rc == LCB_SUCCESS);
    }

    // Add key - value pairs to hotel_10142, again representing traveller - Ids and associated discount percentages
    {
        lcb_CMDSUBDOC cmd = {};
        lcb_SDSPEC specs[2] = {};
        char *key = "hotel_10142";

        LCB_CMD_SET_KEY(&cmd, key, strlen(key));
        {
            char *path = "discounts.jsmith123";
            char *val = "15";

            specs[0].sdcmd = LCB_SDCMD_DICT_UPSERT;
            specs[0].options = LCB_SDSPEC_F_MKINTERMEDIATES | LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[0], path, strlen(path));
            LCB_CMD_SET_VALUE(&specs[0], val, strlen(val));
        }
        {
            char *path = "discounts.pjones356";
            char *val = "10";

            specs[1].sdcmd = LCB_SDCMD_DICT_UPSERT;
            specs[1].options = LCB_SDSPEC_F_MKINTERMEDIATES | LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[1], path, strlen(path));
            LCB_CMD_SET_VALUE(&specs[1], val, strlen(val));
        }

        cmd.specs = specs;
        cmd.nspecs = 2;
        rc = lcb_subdoc3(instance, NULL, &cmd);
        assert(rc == LCB_SUCCESS);
    }

    lcb_wait(instance);

    // Create a user and assign roles. This user will search for their available discounts.
    {
        lcb_CMDHTTP cmd = {};
        char *path = "/settings/rbac/users/local/jsmith123";
        char *payload = "password=jsmith123pwd&name=John+Smith"
                        "&roles=data_reader[travel-sample],query_select[travel-sample],data_writer[travel-sample]";

        cmd.type = LCB_HTTP_TYPE_MANAGEMENT;
        cmd.method = LCB_HTTP_METHOD_PUT;
        LCB_CMD_SET_KEY(&cmd, path, strlen(path));
        cmd.body = payload;
        cmd.nbody = strlen(payload);
        cmd.content_type = "application/x-www-form-urlencoded";

        lcb_http3(instance, NULL, &cmd);
        lcb_wait(instance);
    }

    lcb_destroy(instance);

    // reconnect using new user
    instance = connect_as("jsmith123", "jsmith123pwd");

    // Perform a N1QL Query to return document IDs from the bucket. These IDs will be
    // used to reference each document in turn, and check for extended attributes
    // corresponding to discounts.
    {
        lcb_CMDN1QL cmd = {};
        lcb_N1QLPARAMS *params = lcb_n1p_new();
        char *query = "SELECT id, meta(`travel-sample`).id AS docID FROM `travel-sample`";

        lcb_n1p_setstmtz(params, query);
        rc = lcb_n1p_mkcmd(params, &cmd);
        assert(rc == LCB_SUCCESS);
        cmd.callback = n1qlrow_callback;

        printf("User \"jsmith123\" has discounts in the hotels below:\n");
        lcb_n1ql_query(instance, NULL, &cmd);
        lcb_wait(instance);
    }

    lcb_destroy(instance);
}
