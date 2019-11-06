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

/**
 * Using the Sub-Document API, Virtual XATTR can be used to fetch metadata about a document, via the $document virtual
 * XATTR. A common use case is discovering documentation expiration metadata, or TTL.
 *
 *
 * The output should look similar to:
 *
 *     $ ./subdoc-virtual-xattrs
 *     connecting to "couchbase://localhost/travel-sample", using username "Administrator" and password "password"
 *     successfully updated expiration time for "airline_17628"
 *     expiration time of "airline_17628" is 1548857140 seconds or "Wed Jan 30 17:05:40 2019"
 *     "airline_17628": value of "$document.exptime" is 1548857140
 *     "airline_17628": value of "$document.value_bytes" is 134
 *     "airline_17628": value of "callsign" is "OA"
 */

#include <unistd.h>
#include <stdlib.h>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include <assert.h>
#include <string.h>
#include <time.h>

static void touch_the_document(lcb_t instance, int type, const lcb_RESPTOUCH *resp)
{
    if (resp->rc != LCB_SUCCESS) {
        printf("failed to update expiration time for \"%.*s\": 0x%x, %s\n", (int)resp->nkey, resp->key, resp->rc,
               lcb_strerror_short(resp->rc));
        return;
    }

    printf("successfully updated expiration time for \"%.*s\"\n", (int)resp->nkey, resp->key);
}

static void get_xattr_expiration(lcb_t instance, int type, const lcb_RESPSUBDOC *resp)
{
    if (resp->rc != LCB_SUCCESS && resp->rc != LCB_SUBDOC_MULTI_FAILURE) {
        printf("failed to get expiration for \"%.*s\": %s\n", (int)resp->nkey, resp->key, lcb_strerror_short(resp->rc));
        return;
    }

    {
        lcb_SDENTRY ent;
        size_t iter = 0;
        size_t index = 0;

        while (lcb_sdresult_next(resp, &ent, &iter)) {
            if (index == 0) {
                if (ent.status == LCB_SUCCESS) {
                    time_t val = atoll(ent.value);
                    char *str = ctime(&val);
                    str[strlen(str) - 1] = '\0'; /* remove '\n' */
                    printf("expiration time of \"%.*s\" is %.*s seconds or \"%s\"\n", (int)resp->nkey, resp->key, (int)ent.nvalue,
                           ent.value, str);
                } else {
                    printf("failed to get expiration for \"%.*s\": %s\n", (int)resp->nkey, resp->key,
                           lcb_strerror_short(ent.status));
                }
            }
            index++;
        }
    }
}

static void get_multiple_attributes(lcb_t instance, int type, const lcb_RESPSUBDOC *resp)
{
    if (resp->rc != LCB_SUCCESS && resp->rc != LCB_SUBDOC_MULTI_FAILURE) {
        printf("failed to get multiple attributes for \"%.*s\": %s\n", (int)resp->nkey, resp->key,
               lcb_strerror_short(resp->rc));
        return;
    }

    {
        lcb_SDENTRY ent;
        size_t iter = 0;
        size_t index = 0;

        while (lcb_sdresult_next(resp, &ent, &iter)) {
            const char *path;

            switch (index) {
                case 0:
                    path = "$document.exptime";
                    break;
                case 1:
                    path = "$document.value_bytes";
                    break;
                case 2:
                    path = "callsign";
                    break;
            }

            if (ent.status == LCB_SUCCESS) {
                printf("\"%.*s\": value of \"%s\" is %.*s\n", (int)resp->nkey, resp->key, path,
                       (int)ent.nvalue, ent.value);
            } else {
                printf("\"%.*s\": failed to get value of \"%s\": %s\n", (int)resp->nkey, resp->key, path,
                       lcb_strerror_short(ent.status));
            }

            index++;
        }
    }
}

#define DEFAULT_CONNSTR "couchbase://localhost/travel-sample"

static lcb_t connect_as(char *username, char *password)
{
    struct lcb_create_st crst = {.version = 3};

    crst.v.v3.connstr = DEFAULT_CONNSTR;
    crst.v.v3.username = username;
    crst.v.v3.passwd = password;

    fprintf(stderr, "connecting to \"%s\", using username \"%s\" and password \"%s\"\n", crst.v.v3.connstr,
            crst.v.v3.username, crst.v.v3.passwd);

    lcb_t instance;
    lcb_error_t rc;

    rc = lcb_create(&instance, &crst);
    assert(rc == LCB_SUCCESS);
    rc = lcb_connect(instance);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance);
    rc = lcb_get_bootstrap_status(instance);
    assert(rc == LCB_SUCCESS);

    return instance;
}

int main()
{
    lcb_error_t rc;
    lcb_t instance;
    char *key = "airline_17628";

    instance = connect_as("Administrator", "password");

    // Update expiration time of the document
    {
        lcb_CMDTOUCH cmd = {};
        LCB_CMD_SET_KEY(&cmd, key, strlen(key));
        cmd.exptime = 300;

        lcb_install_callback3(instance, LCB_CALLBACK_TOUCH, (lcb_RESPCALLBACK)touch_the_document);
        rc = lcb_touch3(instance, NULL, &cmd);
        assert(rc == LCB_SUCCESS);
    }
    lcb_wait(instance);

    // Retrieve expiration time of the document
    {
        lcb_CMDSUBDOC cmd = {};
        lcb_SDSPEC specs[1] = {};

        {
            char *path = "$document.exptime";
            specs[0].sdcmd = LCB_SDCMD_GET;
            specs[0].options = LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[0], path, strlen(path));
        }
        LCB_CMD_SET_KEY(&cmd, key, strlen(key));
        cmd.specs = specs;
        cmd.nspecs = 1;

        lcb_install_callback3(instance, LCB_CALLBACK_SDLOOKUP, (lcb_RESPCALLBACK)get_xattr_expiration);
        rc = lcb_subdoc3(instance, NULL, &cmd);
        assert(rc == LCB_SUCCESS);
    }
    lcb_wait(instance);

    // Multiple paths can be access at once via subdoc. It's limited to 16 paths and xattrs have to be first.
    {
        lcb_CMDSUBDOC cmd = {};
        lcb_SDSPEC specs[3] = {};

        {
            char *path = "$document.exptime";
            specs[0].sdcmd = LCB_SDCMD_GET;
            specs[0].options = LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[0], path, strlen(path));
        }
        {
            char *path = "$document.value_bytes";
            specs[1].sdcmd = LCB_SDCMD_GET;
            specs[1].options = LCB_SDSPEC_F_XATTRPATH;
            LCB_SDSPEC_SET_PATH(&specs[1], path, strlen(path));
        }
        {
            char *path = "callsign";
            specs[2].sdcmd = LCB_SDCMD_GET;
            LCB_SDSPEC_SET_PATH(&specs[2], path, strlen(path));
        }
        LCB_CMD_SET_KEY(&cmd, key, strlen(key));
        cmd.specs = specs;
        cmd.nspecs = 3;

        lcb_install_callback3(instance, LCB_CALLBACK_SDLOOKUP, (lcb_RESPCALLBACK)get_multiple_attributes);
        rc = lcb_subdoc3(instance, NULL, &cmd);
        assert(rc == LCB_SUCCESS);
    }
    lcb_wait(instance);

    lcb_destroy(instance);
}
