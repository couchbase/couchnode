/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2020 Couchbase, Inc.
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
#include <string>

static void get_callback(lcb_INSTANCE *, int, const lcb_RESPGET *resp)
{
    lcb_STATUS rc = lcb_respget_status(resp);
    if (rc != LCB_SUCCESS) {
        printf("[GET] status: %s\n", lcb_strerror_short(rc));
        return;
    }

    const char *value;
    size_t nvalue;
    lcb_respget_value(resp, &value, &nvalue);
    printf("[GET] value: %.*s\n", (int)nvalue, value);
}

static void subdoc_callback(lcb_INSTANCE *, int type, const lcb_RESPSUBDOC *resp)
{
    lcb_STATUS rc = lcb_respsubdoc_status(resp);

    if (rc != LCB_SUCCESS) {
        printf("[SUBDOC] status: %s\n", lcb_strerror_short(rc));
        return;
    }

    if (lcb_respsubdoc_result_size(resp) > 0) {
        rc = lcb_respsubdoc_result_status(resp, 0);
        printf("[SUBDOC] status: %s\n", lcb_strerror_short(rc));
        if (type == LCB_CALLBACK_SDLOOKUP) {
            const char *value;
            size_t nvalue;
            lcb_respsubdoc_result_value(resp, 0, &value, &nvalue);
            bool is_deleted = lcb_respsubdoc_is_deleted(resp);
            printf("[SUBDOC] is deleted: %s, value: %.*s\n", is_deleted ? "true" : "false", (int)nvalue, value);
        }
    } else {
        printf("[SUBDOC] no result!\n");
    }
}

#define DEFAULT_CONNSTR "couchbase://localhost"

int main(int argc, char **argv)
{
    lcb_CREATEOPTS *crst = nullptr;
    std::string connstr("couchbase://localhost");
    std::string username("Administrator");
    std::string password("password");

    if (argc > 1) {
        connstr = argv[1];
    }
    if (argc > 2) {
        username = argv[2];
    }
    if (argc > 3) {
        password = argv[3];
    }
    lcb_createopts_create(&crst, LCB_TYPE_BUCKET);
    lcb_createopts_connstr(crst, connstr.data(), connstr.size());
    lcb_createopts_credentials(crst, username.data(), username.size(), password.data(), password.size());

    lcb_INSTANCE *instance;
    lcb_STATUS rc = lcb_create(&instance, crst);
    lcb_createopts_destroy(crst);
    assert(rc == LCB_SUCCESS);

    rc = lcb_connect(instance);
    assert(rc == LCB_SUCCESS);

    lcb_wait(instance, LCB_WAIT_DEFAULT);

    rc = lcb_get_bootstrap_status(instance);
    assert(rc == LCB_SUCCESS);

    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_install_callback(instance, LCB_CALLBACK_SDLOOKUP, (lcb_RESPCALLBACK)subdoc_callback);
    lcb_install_callback(instance, LCB_CALLBACK_SDMUTATE, (lcb_RESPCALLBACK)subdoc_callback);

    lcb_CMDSUBDOC *cmd;
    lcb_SUBDOCSPECS *ops;

    std::string key("key");
    std::string subdoc_field_path("meta.field");
    std::string subdoc_field_value("\"hello\"");
    std::string subdoc_object_path("meta");

    /**
     * Create tombstone with {"meta": {"field": "hello"} } XATTR
     */
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, key.data(), key.size());
    lcb_subdocspecs_create(&ops, 1);
    lcb_subdocspecs_dict_upsert(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH | LCB_SUBDOCSPECS_F_MKINTERMEDIATES,
                                subdoc_field_path.data(), subdoc_field_path.size(), subdoc_field_value.data(),
                                subdoc_field_value.size());
    lcb_cmdsubdoc_store_semantics(cmd, LCB_SUBDOC_STORE_INSERT);
    lcb_cmdsubdoc_create_as_deleted(cmd, true);
    lcb_cmdsubdoc_specs(cmd, ops);
    rc = lcb_subdoc(instance, nullptr, cmd);
    lcb_subdocspecs_destroy(ops);
    lcb_cmdsubdoc_destroy(cmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    /**
     * Regular GET operation does not see the document
     */
    lcb_CMDGET *gcmd;
    lcb_cmdget_create(&gcmd);
    lcb_cmdget_key(gcmd, key.data(), key.size());
    rc = lcb_get(instance, nullptr, gcmd);
    lcb_cmdget_destroy(gcmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    /**
     * Retrieve field using subdocument lookup
     */
    lcb_cmdsubdoc_create(&cmd);
    lcb_cmdsubdoc_key(cmd, key.data(), key.size());
    lcb_subdocspecs_create(&ops, 1);
    lcb_subdocspecs_get(ops, 0, LCB_SUBDOCSPECS_F_XATTRPATH, subdoc_object_path.data(), subdoc_object_path.size());
    lcb_cmdsubdoc_access_deleted(cmd, true);
    lcb_cmdsubdoc_specs(cmd, ops);
    rc = lcb_subdoc(instance, nullptr, cmd);
    lcb_subdocspecs_destroy(ops);
    lcb_cmdsubdoc_destroy(cmd);
    assert(rc == LCB_SUCCESS);
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    lcb_destroy(instance);
    return 0;
}
