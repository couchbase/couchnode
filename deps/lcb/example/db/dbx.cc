/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2021 Couchbase, Inc.
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

#include <csignal>
#include <climits>

#include <vector>
#include <string>
#include <sstream>
#include <stdexcept>
#include <iostream>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/vbucket.h>

static std::string value;

class lcb_error : public std::runtime_error
{
  public:
    explicit lcb_error(lcb_STATUS code, const std::string &msg) : std::runtime_error(format_message(code, msg)) {}

  private:
    static std::string format_message(lcb_STATUS code, const std::string &msg)
    {
        std::stringstream ss;
        ss << msg << ". "
           << "rc: " << lcb_strerror_long(code);
        return ss.str();
    }
};

static void check(lcb_STATUS err, const char *msg)
{
    if (err != LCB_SUCCESS) {
        throw lcb_error(err, msg);
    }
}

std::vector<std::string> generate_keys(lcb_INSTANCE *instance)
{

    lcbvb_CONFIG *vbc;
    check(lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc), "unable to get configuration handle");

    unsigned num_vbuckets = lcbvb_get_nvbuckets(vbc);
    if (num_vbuckets == 0) {
        throw lcb_error(LCB_ERR_NO_CONFIGURATION, "the configuration does not contain any vBuckets");
    }
    std::vector<std::string> keys;
    keys.resize(num_vbuckets);

#define MAX_KEY_SIZE 16
    char buf[MAX_KEY_SIZE] = {0};
    unsigned i = 0;
    unsigned left = num_vbuckets;
    while (left > 0 && i < UINT_MAX) {
        int nbuf = snprintf(buf, MAX_KEY_SIZE, "key_%010u", i++);
        if (nbuf <= 0) {
            throw lcb_error(LCB_ERR_GENERIC, "unable to render new key into buffer");
        }
        int vbid, srvix;
        lcbvb_map_key(vbc, buf, nbuf, &vbid, &srvix);
        if (keys[vbid].empty()) {
            keys[vbid] = buf;
            left--;
        }
    }
    for (const auto &key : keys) {
        if (key.empty()) {
            std::cerr << "detected empty key\n";
        }
    }
    if (left > 0) {
        throw lcb_error(LCB_ERR_GENERIC, "unable to generate keys for all vBuckets");
    }
    return keys;
}

static void handle_sigint(int)
{
    std::cerr << "caught SIGINT. Exiting.\n";
    exit(0);
}

static void store_callback(lcb_INSTANCE *, int, const lcb_RESPSTORE *resp)
{
    lcb_STATUS rc = lcb_respstore_status(resp);
    if (rc != LCB_SUCCESS) {
        const char *key = nullptr;
        size_t key_len = 0;
        lcb_respstore_key(resp, &key, &key_len);
        std::cerr << "unable to store " << std::string(key, key_len) << ". rc: " << lcb_strerror_short(rc) << "\n";
    }
}

static void upsert_key(lcb_INSTANCE *instance, const char *key, size_t key_len)
{

    lcb_CMDSTORE *cmd = nullptr;
    lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
    lcb_cmdstore_key(cmd, key, key_len);
    lcb_cmdstore_value(cmd, value.data(), value.size());
    check(lcb_store(instance, nullptr, cmd), "schedule storage operation");
    lcb_cmdstore_destroy(cmd);
}

static void get_callback(lcb_INSTANCE *instance, int, const lcb_RESPGET *resp)
{
    const char *key;
    size_t key_len;
    lcb_STATUS rc;

    lcb_respget_key(resp, &key, &key_len);

    rc = lcb_respget_status(resp);
    if (rc != LCB_SUCCESS) {
        if (rc == LCB_ERR_DOCUMENT_NOT_FOUND) {
            std::cerr << "unable to get \"" << std::string(key, key_len) << "\". rc: " << lcb_strerror_short(rc)
                      << ". Creating new document\n";
            upsert_key(instance, key, key_len);
        } else {
            std::cerr << "unable to get \"" << std::string(key, key_len) << "\". rc: " << lcb_strerror_short(rc)
                      << "\n";
        }
    }

    lcb_CMDGET *gcmd;
    lcb_cmdget_create(&gcmd);
    lcb_cmdget_key(gcmd, key, key_len);
    rc = lcb_get(instance, nullptr, gcmd);
    lcb_cmdget_destroy(gcmd);
    if (rc != LCB_SUCCESS) {
        std::cerr << "unable to schedule get " << std::string(key, key_len) << ". rc: " << lcb_strerror_short(rc)
                  << "\n";
    }
}

static void start_work(lcb_INSTANCE *instance, std::vector<std::string> &keys)
{
    for (const auto &key : keys) {
        lcb_CMDGET *cmd = nullptr;
        lcb_cmdget_create(&cmd);
        lcb_cmdget_key(cmd, key.data(), key.size());
        check(lcb_get(instance, nullptr, cmd), "schedule retrieval operation");
        lcb_cmdget_destroy(cmd);
    }
}

static void load_dataset(lcb_INSTANCE *instance, std::vector<std::string> &keys)
{
    for (const auto &key : keys) {
        upsert_key(instance, key.data(), key.size());
        lcb_wait(instance, LCB_WAIT_DEFAULT);
    }
}

static void open_callback(lcb_INSTANCE *, lcb_STATUS rc)
{
    check(rc, "open bucket");
}

int main()
{
    value = R"({"answer": 42})";

    lcb_INSTANCE *instance;

    std::string connection_string = "couchbase://127.0.0.1";
    std::string username = "Administrator";
    std::string password = "password";
    std::string bucket = "default";

    lcb_CREATEOPTS *options = nullptr;
    lcb_createopts_create(&options, LCB_TYPE_CLUSTER);
    lcb_createopts_connstr(options, connection_string.data(), connection_string.size());
    lcb_createopts_credentials(options, username.data(), username.size(), password.data(), password.size());
    check(lcb_create(&instance, options), "create connection handle");
    lcb_createopts_destroy(options);

    check(lcb_connect(instance), "schedule connection");
    lcb_wait(instance, LCB_WAIT_DEFAULT);
    check(lcb_get_bootstrap_status(instance), "bootstrap from cluster");

    lcb_set_open_callback(instance, open_callback);
    check(lcb_open(instance, bucket.data(), bucket.size()), "schedule bucket opening");
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    std::cerr << "---- generate keys\n";
    auto keys = generate_keys(instance);
    std::cerr << "---- generated " << keys.size() << " keys\n";

    lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
    std::cerr << "---- load keys\n";
    load_dataset(instance, keys);

    signal(SIGINT, handle_sigint);
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    std::cerr << "---- run loop. SIGINT to stop\n";
    start_work(instance, keys);
    lcb_wait(instance, LCB_WAIT_DEFAULT);

    lcb_destroy(instance);

    exit(EXIT_SUCCESS);
}
