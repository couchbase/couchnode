/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2013 Couchbase, Inc.
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
#ifndef TESTS_TESTUTIL_H
#define TESTS_TESTUTIL_H 1

#include <libcouchbase/couchbase.h>
#include <libcouchbase/vbucket.h>
#include <string.h>
struct Item {
    void assign(const lcb_get_resp_t *resp, lcb_error_t e = LCB_SUCCESS) {
        key.assign((const char *)resp->v.v0.key, resp->v.v0.nkey);
        val.assign((const char *)resp->v.v0.bytes, resp->v.v0.nbytes);
        flags = resp->v.v0.flags;
        cas =  resp->v.v0.cas;
        datatype =  resp->v.v0.datatype;
        err = e;
    }

    /**
     * Extract the key and CAS from a response.
     */
    template <typename T>
    void assignKC(const T *resp, lcb_error_t e = LCB_SUCCESS) {
        key.assign((const char *)resp->v.v0.key, resp->v.v0.nkey);
        cas = resp->v.v0.cas;
        err = e;
    }

    Item() {
        key.clear();
        val.clear();

        err = LCB_SUCCESS;
        flags = 0;
        cas = 0;
        datatype = 0;
        exp = 0;
    }

    Item(const std::string &key,
         const std::string &value = "",
         lcb_cas_t cas = 0) {

        this->key = key;
        this->val = value;
        this->cas = cas;

        flags = 0;
        datatype = 0;
        exp = 0;
    }

    friend std::ostream &operator<< (std::ostream &out,
                                     const Item &item);

    /**
     * Dump the string representation of the item to standard output
     */
    void dump() {
        std::cout << *this;
    }

    std::string key;
    std::string val;
    lcb_uint32_t flags;
    lcb_cas_t cas;
    lcb_datatype_t datatype;
    lcb_error_t err;
    lcb_time_t exp;
};

struct KVOperation {
    /** The resultant item */
    Item result;

    /** The request item */
    const Item *request;

    /** whether the callback was at all received */
    unsigned callCount;

    /** Acceptable errors during callback */
    std::set<lcb_error_t> allowableErrors;

    /** Errors received from error handler */
    std::set<lcb_error_t> globalErrors;

    void assertOk(lcb_error_t err);

    KVOperation(const Item *request) {
        this->request = request;
        this->ignoreErrors = false;
        callCount = 0;
    }

    void clear() {
        result = Item();
        callCount = 0;
        allowableErrors.clear();
        globalErrors.clear();
    }

    void store(lcb_t instance);
    void get(lcb_t instance);
    void remove(lcb_t instance);

    void cbCommon(lcb_error_t error) {
        callCount++;
        if (error != LCB_SUCCESS) {
            globalErrors.insert(error);
        }
        assertOk(error);
    }

    static void handleInstanceError(lcb_t, lcb_error_t, const char *);
    bool ignoreErrors;

private:
    void enter(lcb_t);
    void leave(lcb_t);
    const void *oldCookie;

    struct {
        lcb_get_callback get;
        lcb_store_callback store;
        lcb_error_callback err;
        lcb_remove_callback rm;
    } callbacks;
};

void storeKey(lcb_t instance, const std::string &key, const std::string &value);
void removeKey(lcb_t instance, const std::string &key);
void getKey(lcb_t instance, const std::string &key, Item &item);

/**
 * Generate keys which will trigger all the servers in the map.
 */
void genDistKeys(lcbvb_CONFIG* vbc, std::vector<std::string> &out);
void genStoreCommands(const std::vector<std::string> &keys,
                      std::vector<lcb_store_cmd_t> &cmds,
                      std::vector<lcb_store_cmd_t*> &cmdpp);

/**
 * This doesn't _actually_ attempt to make sense of an operation. It simply
 * will try to keep the event loop alive.
 */
void doDummyOp(lcb_t& instance);

#endif
