/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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

#include "config.h"

#include <iostream>
#include <sstream>
#include <ctype.h>
#include <getopt.h>
#include <vector>
#include <map>
#include <iostream>
#include <fstream>
#include <string.h>
#include <sys/stat.h>
#include <cerrno>
#include <cstdlib>
#include <libcouchbase/couchbase.h>
#include "internal.h"
#include "configuration.h"
#include "commandlineparser.h"

#ifdef HAVE_LIBYAJL2
#include <yajl/yajl_version.h>
#include <yajl/yajl_parse.h>
#include <yajl/yajl_tree.h>
#endif

using namespace std;

enum cbc_command_t {
    cbc_illegal,
    cbc_cat,
    cbc_cp,
    cbc_create,
    cbc_flush,
    cbc_lock,
    cbc_rm,
    cbc_stats,
    cbc_unlock,
    cbc_verify,
    cbc_version,
    cbc_hash,
    cbc_help,
    cbc_view,
    cbc_admin,
    cbc_bucket_create,
    cbc_bucket_delete,
    cbc_bucket_flush,
    cbc_observe,
    cbc_verbosity
};

struct cp_params {
    list<string> *keys;
    map<string, vector<lcb_cas_t> > results;
    lcb_size_t sent;
    bool need_persisted;
    int need_replicated;
    size_t total_persisted;
    size_t total_replicated;
    int max_tries;
    int tries;
    lcb_uint32_t timeout;
};

extern "C" {
    // libcouchbase use a C linkage!

    static void error_callback(lcb_t instance,
                               lcb_error_t error,
                               const char *errinfo)
    {
        cerr << "ERROR: " << lcb_strerror(instance, error) << endl;
        if (errinfo) {
            cerr << "\t\"" << errinfo << "\"" << endl;
        }
        exit(EXIT_FAILURE);
    }

    void observe_timer_callback(lcb_timer_t timer,
                                lcb_t instance,
                                const void *cookie)
    {
        // perform observe query
        struct cp_params *params = (struct cp_params *)cookie;
        int idx = 0;
        lcb_error_t err;

        lcb_observe_cmd_t *items = new lcb_observe_cmd_t[params->keys->size()];
        lcb_observe_cmd_t* *args = new lcb_observe_cmd_t* [params->keys->size()];

        for (list<string>::iterator iter = params->keys->begin();
                iter != params->keys->end(); ++iter, ++idx) {
            args[idx] = &items[idx];
            memset(&items[idx], 0, sizeof(items[idx]));
            items[idx].v.v0.key = iter->c_str();
            items[idx].v.v0.nkey = iter->length();
        }
        err = lcb_observe(instance, static_cast<const void *>(params), idx,
                          args);
        if (err != LCB_SUCCESS) {
            // report the issue and exit
            error_callback(instance, err, "Failed to schedule observe query");
        }

        delete []items;
        delete []args;
        (void)timer;
    }

    void schedule_observe(lcb_t instance, struct cp_params *params)
    {
        lcb_error_t err;
        if (params->tries > params->max_tries) {
            error_callback(instance, LCB_ETIMEDOUT, "Exceeded number of tries");
        }
        lcb_timer_create(instance, params, params->timeout, 0,
                         observe_timer_callback, &err);
        if (err != LCB_SUCCESS) {
            // report the issue and exit
            error_callback(instance, err, "Failed to setup timer for observe");
        }
        params->timeout *= 2;
        params->tries++;
        params->total_persisted = params->total_replicated = 0;
    }

    static void store_callback(lcb_t instance,
                               const void *cookie,
                               lcb_storage_t,
                               lcb_error_t error,
                               const lcb_store_resp_t *item)
    {
        struct cp_params *params = static_cast<struct cp_params *>(const_cast<void *>(cookie));
        if (params && (params->need_persisted || params->need_replicated > 0)) {
            params->sent++;
            // if it is the latest key in the series
            if (params->sent == params->keys->size()) {
                schedule_observe(instance, params);
            }
        } else {
            string key((const char *)item->v.v0.key, (size_t)item->v.v0.nkey);
            if (error == LCB_SUCCESS) {
                cerr << "Stored \"" << key.c_str() << hex
                     << "\" CAS:" << item->v.v0.cas << endl;
            } else {
                cerr << "Failed to store \"" << key.c_str() << "\":" << endl
                     << lcb_strerror(instance, error) << endl;

                void *instance_cookie = const_cast<void *>(lcb_get_cookie(instance));
                bool *e = static_cast<bool *>(instance_cookie);
                *e = true;
            }
        }
    }

    static void remove_callback(lcb_t instance,
                                const void *,
                                lcb_error_t error,
                                const lcb_remove_resp_t *resp)
    {
        string key((const char *)resp->v.v0.key, (size_t)resp->v.v0.nkey);

        if (error == LCB_SUCCESS) {
            cerr << "Removed \"" << key.c_str() << "\" CAS:"
                 << resp->v.v0.cas << endl;
        } else {
            cerr << "Failed to remove \"" << key.c_str() << "\":" << endl
                 << lcb_strerror(instance, error) << endl;
            void *cookie = const_cast<void *>(lcb_get_cookie(instance));
            bool *err = static_cast<bool *>(cookie);
            *err = true;
        }
    }

    static void unlock_callback(lcb_t instance,
                                const void *,
                                lcb_error_t error,
                                const lcb_unlock_resp_t *resp)
    {
        string key((const char *)resp->v.v0.key, (size_t)resp->v.v0.nkey);
        if (error == LCB_SUCCESS) {
            cerr << "Unlocked \"" << key.c_str() << "\"" << endl;
        } else {
            cerr << "Failed to unlock \"" << key.c_str() << "\":" << endl
                 << lcb_strerror(instance, error) << endl;
            void *cookie = const_cast<void *>(lcb_get_cookie(instance));
            bool *err = static_cast<bool *>(cookie);
            *err = true;
        }
    }

    static void get_callback(lcb_t instance,
                             const void *,
                             lcb_error_t error,
                             const lcb_get_resp_t *resp)
    {
        string key((const char *)resp->v.v0.key, (size_t)resp->v.v0.nkey);
        if (error == LCB_SUCCESS) {
            cerr << "\"" << key.c_str()
                 << "\" Size:" << resp->v.v0.nbytes
                 << hex
                 << " Flags:" << resp->v.v0.flags
                 << " CAS:" << resp->v.v0.cas << endl;
            cerr.flush();
            cout.write(static_cast<const char *>(resp->v.v0.bytes),
                       resp->v.v0.nbytes);
            cout.flush();
            cerr << endl; /* use cerr to avoid breaking blobs */
        } else {
            cerr << "Failed to get \"" << key.c_str() << "\": "
                 << lcb_strerror(instance, error) << endl;
            void *cookie = const_cast<void *>(lcb_get_cookie(instance));
            bool *err = static_cast<bool *>(cookie);
            *err = true;
        }
    }

    static void verify_callback(lcb_t instance,
                                const void *,
                                lcb_error_t error,
                                const lcb_get_resp_t *resp)
    {
        const void *key = resp->v.v0.key;
        lcb_size_t nkey = resp->v.v0.nkey;
        const void *bytes = resp->v.v0.bytes;
        lcb_size_t nbytes = resp->v.v0.nbytes;

        if (error == LCB_SUCCESS) {
            char fnm[FILENAME_MAX];
            memcpy(fnm, key, nkey);
            fnm[nkey] = '\0';
            struct stat st;
            if (stat(fnm, &st) == -1) {
                cerr << "Failed to look up: \"" << fnm << "\"" << endl;
            } else if ((lcb_size_t)st.st_size != nbytes) {
                cerr << "Incorrect size for: \"" << fnm << "\"" << endl;
            } else {
                char *dta = new char[(lcb_size_t)st.st_size];
                if (dta == NULL) {
                    cerr << "Failed to allocate memory to compare: \""
                         << fnm << "\"" << endl;
                } else {
                    ifstream file(fnm, ios::binary);
                    if (file.good() && file.read(dta, st.st_size) && file.good()) {
                        if (memcmp(dta, bytes, nbytes) != 0) {
                            cerr << "Content differ: \"" << fnm << "\"" << endl;
                        }
                    } else {
                        cerr << "Failed to read \""  << fnm << "\"" << endl;
                    }
                    delete []dta;
                }
            }
        } else {
            cerr << "Failed to get \"";
            cerr.write(static_cast<const char *>(key), nkey);
            cerr << "\": " << lcb_strerror(instance, error) << endl;
            void *cookie = const_cast<void *>(lcb_get_cookie(instance));
            bool *err = static_cast<bool *>(cookie);
            *err = true;
        }
    }

    static void stat_callback(lcb_t instance,
                              const void *,
                              lcb_error_t error,
                              const lcb_server_stat_resp_t *resp)
    {
        const char *server_endpoint = resp->v.v0.server_endpoint;
        const void *key = resp->v.v0.key;
        lcb_size_t nkey = resp->v.v0.nkey;
        const void *value = resp->v.v0.bytes;
        lcb_size_t nvalue = resp->v.v0.nbytes;

        if (error == LCB_SUCCESS) {
            if (nkey > 0) {
                cout << server_endpoint << "\t";
                cout.write(static_cast<const char *>(key), nkey);
                cout << "\t";
                cout.write(static_cast<const char *>(value), nvalue);
                cout << endl;
            }
        } else {
            cerr << "Failure requesting stats:" << endl
                 << lcb_strerror(instance, error) << endl;

            void *cookie = const_cast<void *>(lcb_get_cookie(instance));
            bool *err = static_cast<bool *>(cookie);
            *err = true;
        }
    }

    static void flush_callback(lcb_t instance,
                               const void *,
                               lcb_error_t error,
                               const lcb_flush_resp_t *resp)
    {
        if (error != LCB_SUCCESS) {
            cerr << "Failed to flush node \"" << resp->v.v0.server_endpoint
                 << "\": " << lcb_strerror(instance, error)
                 << endl;
            void *cookie = const_cast<void *>(lcb_get_cookie(instance));
            bool *err = static_cast<bool *>(cookie);
            *err = true;
        }
    }

    static void timings_callback(lcb_t, const void *,
                                 lcb_timeunit_t timeunit,
                                 lcb_uint32_t min, lcb_uint32_t max,
                                 lcb_uint32_t total, lcb_uint32_t maxtotal)
    {
        char buffer[1024];
        int offset = sprintf(buffer, "[%3u - %3u]", min, max);
        switch (timeunit) {
        case LCB_TIMEUNIT_NSEC:
            offset += sprintf(buffer + offset, "ns");
            break;
        case LCB_TIMEUNIT_USEC:
            offset += sprintf(buffer + offset, "us");
            break;
        case LCB_TIMEUNIT_MSEC:
            offset += sprintf(buffer + offset, "ms");
            break;
        case LCB_TIMEUNIT_SEC:
            offset += sprintf(buffer + offset, "s");
            break;
        default:
            ;
        }

        int num = static_cast<int>(static_cast<float>(40.0) *
                                   static_cast<float>(total) /
                                   static_cast<float>(maxtotal));

        offset += sprintf(buffer + offset, " |");
        for (int ii = 0; ii < num; ++ii) {
            offset += sprintf(buffer + offset, "#");
        }

        offset += sprintf(buffer + offset, " - %u\n", total);
        cerr << buffer;
    }

    static void data_callback(lcb_http_request_t, lcb_t,
                              const void *, lcb_error_t,
                              const lcb_http_resp_t *resp)
    {
        cout.write(static_cast<const char *>(resp->v.v0.bytes), resp->v.v0.nbytes);
        cout.flush();
    }

    static void complete_callback(lcb_http_request_t, lcb_t instance,
                                  const void *, lcb_error_t error,
                                  const lcb_http_resp_t *resp)
    {
        if (resp->v.v0.headers) {
            const char *const *headers = resp->v.v0.headers;
            for (size_t ii = 1; *headers != NULL; ++ii, ++headers) {
                cerr << *headers;
                cerr << ((ii % 2 == 0) ? "\n" : ": ");
            }
        }
        cerr << "\"";
        cerr.write(static_cast<const char *>(resp->v.v0.path), resp->v.v0.npath);
        cerr << "\": ";
        if (error == LCB_SUCCESS) {
            cerr << "OK Size:" << resp->v.v0.nbytes << endl;
            cout.write(static_cast<const char *>(resp->v.v0.bytes), resp->v.v0.nbytes);
        } else {
            cerr << "FAIL(" << error << ") "
                 << lcb_strerror(instance, error)
                 << " Status:" << resp->v.v0.status
                 << " Size:" << resp->v.v0.nbytes << endl;
            cout.write(static_cast<const char *>(resp->v.v0.bytes), resp->v.v0.nbytes);
        }
        cerr << endl;
        cout.flush();
    }

    static void observe_callback(lcb_t instance,
                                 const void *cookie,
                                 lcb_error_t error,
                                 const lcb_observe_resp_t *resp)
    {
        void *instance_cookie = const_cast<void *>(lcb_get_cookie(instance));
        bool *err = static_cast<bool *>(instance_cookie);

        lcb_observe_t status = resp->v.v0.status;
        const void *key = resp->v.v0.key;
        lcb_size_t nkey = resp->v.v0.nkey;
        lcb_cas_t cas = resp->v.v0.cas;
        int is_master = resp->v.v0.from_master;
        lcb_time_t ttp = resp->v.v0.ttp;
        lcb_time_t ttr = resp->v.v0.ttr;

        if (cookie) {
            struct cp_params *params = (struct cp_params *)cookie;
            if (key) {
                string key_str = string(static_cast<const char *>(key), nkey);
                vector<lcb_cas_t> &res = params->results[key_str];
                if (res.size() == 0) {
                    res.resize(1);
                }
                if (status == LCB_OBSERVE_PERSISTED) {
                    if (is_master) {
                        params->total_persisted++;
                        res[0] = cas;
                    } else {
                        params->total_replicated++;
                        res.push_back(cas);
                    }
                } else {
                    cas = 0;
                }
            } else {
                // check persistence conditions
                size_t nkeys = params->keys->size();
                bool ok = true;

                if (params->need_persisted) {
                    ok &= params->total_persisted == nkeys;
                }
                if (params->need_replicated > 0) {
                    ok &= params->total_replicated == (nkeys * params->need_replicated);
                }
                if (ok) {
                    map<string, lcb_cas_t> done;
                    for (list<string>::iterator ii = params->keys->begin();
                            ii != params->keys->end(); ++ii) {
                        string kk = *ii;
                        vector<lcb_cas_t> &res = params->results[kk];
                        lcb_cas_t cc = res[0];
                        if (cc == 0) {
                            // the key wasn't persisted on master, but
                            // replicas might have old version persisted
                            schedule_observe(instance, params);
                            return;
                        } else {
                            if (params->need_replicated > 0) {
                                int matching_cas = 0;
                                for (vector<lcb_cas_t>::iterator jj = res.begin() + 1;
                                        jj != res.end(); ++jj) {
                                    if (*jj == cc) {
                                        matching_cas++;
                                    }
                                }
                                if (matching_cas != params->need_replicated) {
                                    // some replicas has old value => retry
                                    schedule_observe(instance, params);
                                    return;
                                }
                            }
                            done[kk] = cc;
                        }
                    }
                    // all or nothing
                    if (done.size() == params->keys->size()) {
                        for (map<string, lcb_cas_t>::iterator ii = done.begin();
                                ii != done.end(); ++ii) {
                            cerr << "Stored \"" << ii->first << "\" CAS:" << hex << ii->second << endl;
                        }
                    } else {
                        schedule_observe(instance, params);
                    }
                } else {
                    schedule_observe(instance, params);
                }
            }
        } else {
            if (key == NULL) {
                return; /* end of packet */
            }
            if (error == LCB_SUCCESS) {
                switch (status) {
                case LCB_OBSERVE_FOUND:
                    cerr << "FOUND";
                    break;
                case LCB_OBSERVE_PERSISTED:
                    cerr << "PERSISTED";
                    break;
                case LCB_OBSERVE_NOT_FOUND:
                    cerr << "NOT_FOUND";
                    break;
                default:
                    cerr << "UNKNOWN";
                    break;
                }
                cerr << " \"";
                cerr.write(static_cast<const char *>(key), nkey);
                cerr << "\"";
                if (status == LCB_OBSERVE_FOUND ||
                        status == LCB_OBSERVE_PERSISTED) {
                    cerr << " CAS:" << hex << cas;
                }
                cerr << " IsMaster:" << boolalpha << (is_master != 0)
                     << dec << " TimeToPersist:" << ttp
                     << " TimeToReplicate:" << ttr << endl;
            } else {
                cerr << "Failed to observe: " << lcb_strerror(instance, error) << endl;
                *err = true;
            }
        }
    }

    static void verbosity_callback(lcb_t instance,
                                   const void *,
                                   lcb_error_t error,
                                   const lcb_verbosity_resp_t *resp)
    {
        if (error != LCB_SUCCESS) {
            cerr << "Failed to set verbosity level on \""
                 << resp->v.v0.server_endpoint << "\": "
                 << lcb_strerror(instance, error) << endl;
            void *cookie = const_cast<void *>(lcb_get_cookie(instance));
            bool *err = static_cast<bool *>(cookie);
            *err = true;
        }
    }
}

static bool cp_impl(lcb_t instance, list<string> &keys, bool json, bool persisted, int replicated, int max_tries)
{
    lcb_size_t currsz = 0;
    struct cp_params *cookie = new struct cp_params();

    cookie->results = map<string, vector<lcb_cas_t> >();
    cookie->keys = &keys;
    cookie->need_persisted = persisted;
    cookie->need_replicated = replicated;
    cookie->max_tries = max_tries;
    cookie->timeout = 100000; // initial timeout: 100ms
    cookie->total_persisted = cookie->total_replicated = cookie->tries = 0;

    for (list<string>::iterator ii = keys.begin(); ii != keys.end(); ++ii) {
        string key = *ii;
        struct stat st;
        if (stat(key.c_str(), &st) == 0) {
            char *bytes = new char[(lcb_size_t)st.st_size + 1];
            if (bytes != NULL) {
                ifstream file(key.c_str(), ios::binary);
                if (file.good() && file.read(bytes, st.st_size) && file.good()) {
                    bytes[st.st_size] = '\0';
#ifdef HAVE_LIBYAJL2
                    if (json) {
                        yajl_val obj, id;
                        const char *path[] = {"_id", NULL};
                        if ((obj = yajl_tree_parse(bytes, NULL, 0)) == NULL) {
                            cerr << "Failed to parse file \"" << key << "\" as JSON." << endl;
                            delete []bytes;
                            return false;
                        }
                        id = yajl_tree_get(obj, path, yajl_t_string);
                        if (id == NULL) {
                            cerr << "Failed to validate file \"" << key
                                 << "\" as document (no '_id' attribute)." << endl;
                            delete []bytes;
                            return false;
                        }
                        key.assign(id->u.string);
                        yajl_tree_free(obj);
                    }
#else
                    (void)json;
#endif
                    lcb_store_cmd_t item(LCB_SET, key.c_str(),
                                         key.length(), bytes,
                                         (lcb_size_t)st.st_size);
                    lcb_store_cmd_t *items[1] = { &item };
                    lcb_store(instance, static_cast<void *>(cookie),
                              1, items);
                    delete []bytes;
                    currsz += (lcb_size_t)st.st_size;

                    // To avoid too much buffering flush at a regular
                    // interval
                    if (currsz > (2 * 1024 * 1024)) {
                        lcb_wait(instance);
                        currsz = 0;
                    }
                } else {
                    cerr << "Failed to read file \"" << key << "\": "
                         << strerror(errno) << endl;
                    return false;
                }
            } else {
                cerr << "Failed to allocate memory for \"" << key << "\": "
                     << strerror(errno) << endl;
                return false;
            }
        } else {
            cerr << "Failed to open \"" << key << "\": " <<  strerror(errno) << endl;
            return false;
        }
    }

    return true;
}

static bool rm_impl(lcb_t instance, list<string> &keys)
{
    if (keys.empty()) {
        cerr << "ERROR: you need to specify the key to delete" << endl;
        return false;
    }

    for (list<string>::iterator ii = keys.begin(); ii != keys.end(); ++ii) {
        string key = *ii;
        lcb_error_t err;

        lcb_remove_cmd_t item;
        memset(&item, 0, sizeof(item));
        item.v.v0.key = key.c_str();
        item.v.v0.nkey = key.length();
        lcb_remove_cmd_t *items[] = { &item };
        err = lcb_remove(instance, NULL, 1, items);
        if (err != LCB_SUCCESS) {
            cerr << "Failed to remove \"" << key << "\":" << endl
                 << lcb_strerror(instance, err) << endl;
            return false;
        }
    }
    return true;
}

static bool cat_impl(lcb_t instance, list<string> &keys)
{
    if (keys.empty()) {
        cerr << "ERROR: you need to specify the key to get" << endl;
        return false;
    }
    lcb_get_cmd_t *items = new lcb_get_cmd_t[keys.size()];
    lcb_get_cmd_t* *args = new lcb_get_cmd_t* [keys.size()];

    int idx = 0;
    lcb_error_t err;

    for (list<string>::iterator iter = keys.begin(); iter != keys.end(); ++iter, ++idx) {
        args[idx] = &items[idx];
        memset(&items[idx], 0, sizeof(items[idx]));
        items[idx].v.v0.key = iter->c_str();
        items[idx].v.v0.nkey = iter->length();
    }
    err = lcb_get(instance, NULL, idx, args);
    delete []items;
    delete []args;
    if (err != LCB_SUCCESS) {
        cerr << "Failed to send requests:" << endl
             << lcb_strerror(instance, err) << endl;
        return false;
    }

    return true;
}

static bool cat_replica_impl(lcb_t instance, list<string> &keys, int strategy, int index)
{
    if (keys.empty()) {
        cerr << "ERROR: you need to specify the key to get" << endl;
        return false;
    }
    lcb_get_replica_cmd_t *items = new lcb_get_replica_cmd_t[keys.size()];
    lcb_get_replica_cmd_t* *args = new lcb_get_replica_cmd_t* [keys.size()];

    int idx = 0;
    lcb_error_t err;

    for (list<string>::iterator iter = keys.begin(); iter != keys.end(); ++iter, ++idx) {
        args[idx] = &items[idx];
        memset(&items[idx], 0, sizeof(items[idx]));
        items[idx].version = 1;
        items[idx].v.v1.key = iter->c_str();
        items[idx].v.v1.nkey = iter->length();
        items[idx].v.v1.strategy = (lcb_replica_t)strategy;
        items[idx].v.v1.index = index;
    }
    err = lcb_get_replica(instance, NULL, idx, args);

    delete []items;
    delete []args;
    if (err != LCB_SUCCESS) {
        cerr << "Failed to send requests:" << endl
             << lcb_strerror(instance, err) << endl;
        return false;
    }

    return true;
}

static bool observe_impl(lcb_t instance, list<string> &keys)
{
    if (keys.empty()) {
        cerr << "ERROR: you need to specify the key to observe" << endl;
        return false;
    }

    lcb_observe_cmd_t *items = new lcb_observe_cmd_t[keys.size()];
    lcb_observe_cmd_t* *args = new lcb_observe_cmd_t* [keys.size()];

    int idx = 0;
    for (list<string>::iterator iter = keys.begin(); iter != keys.end(); ++iter, ++idx) {
        args[idx] = &items[idx];
        memset(&items[idx], 0, sizeof(items[idx]));
        items[idx].v.v0.key = iter->c_str();
        items[idx].v.v0.nkey = iter->length();
    }

    lcb_error_t err = lcb_observe(instance, NULL, idx, args);

    delete []items;
    delete []args;

    if (err != LCB_SUCCESS) {
        cerr << "Failed to send requests:" << endl
             << lcb_strerror(instance, err) << endl;
        return false;
    }

    return true;
}

static bool verbosity_impl(lcb_t instance, list<string> &args)
{
    if (args.empty()) {
        cerr << "ERROR: You need to specify the verbosity level" << endl;
        return false;
    }

    lcb_verbosity_level_t level;
    string &s = args.front();

    if (s == "detail") {
        level = LCB_VERBOSITY_DETAIL;
    } else if (s == "debug") {
        level = LCB_VERBOSITY_DEBUG;
    } else if (s == "info") {
        level = LCB_VERBOSITY_INFO;
    } else if (s == "warning") {
        level = LCB_VERBOSITY_WARNING;
    } else {
        cerr << "ERROR: Unknown verbosity level [detail,debug,info,warning]: "
             << s << endl;
        return false;
    }
    args.pop_front();

    lcb_error_t err;
    if (args.empty()) {
        lcb_verbosity_cmd_t cmd(level);
        lcb_verbosity_cmd_t *commands[] = { &cmd };

        err = lcb_set_verbosity(instance, NULL, 1, commands);
        if (err != LCB_SUCCESS) {
            cerr << "Failed to set verbosity : " << endl
                 << lcb_strerror(instance, err) << endl;
            return false;
        }
    } else {
        list<string>::iterator iter;
        for (iter = args.begin(); iter != args.end(); ++iter) {
            lcb_verbosity_cmd_t cmd(level, iter->c_str());
            lcb_verbosity_cmd_t *commands[] = { &cmd };

            err = lcb_set_verbosity(instance, NULL, 1, commands);
            if (err != LCB_SUCCESS) {
                cerr << "Failed to set verbosity : " << endl
                     << lcb_strerror(instance, err) << endl;
                return false;
            }
        }
    }

    return true;
}

static bool hash_exec(VBUCKET_CONFIG_HANDLE vbucket_config, list<string> &keys, bool is_vbucket)
{
    if (keys.empty()) {
        cerr << "ERROR: you need to specify the key to hash" << endl;
        return false;
    }

    for (list<string>::iterator iter = keys.begin(); iter != keys.end(); ++iter) {
        int vbucket_id, idx;
        if (is_vbucket) {
            std::istringstream(*iter) >> vbucket_id;
            idx = vbucket_get_master(vbucket_config, vbucket_id);
        } else {
            (void)vbucket_map(vbucket_config, iter->c_str(), iter->length(), &vbucket_id, &idx);
            cout << "\"" << *iter << "\"\t";
        }
        cout << "Server:\"" << vbucket_config_get_server(vbucket_config, idx) << "\"";
        if (vbucket_config_get_distribution_type(vbucket_config) == VBUCKET_DISTRIBUTION_VBUCKET) {
            cout << " vBucket:" << vbucket_id;
            const char *couch_api = vbucket_config_get_couch_api_base(vbucket_config, idx);
            if (couch_api) {
                cout << " CouchAPI:\"" << couch_api << "\"";
            }
            lcb_size_t nrepl = (lcb_size_t)vbucket_config_get_num_replicas(vbucket_config);
            if (nrepl > 0) {
                cout << " Replicas:";
                for (lcb_size_t ii = 0; ii < nrepl; ++ii) {
                    int rr = vbucket_get_replica(vbucket_config, vbucket_id, (int)ii);
                    const char *replica;
                    if (rr >= 0) {
                        replica = vbucket_config_get_server(vbucket_config, rr);
                        if (replica != NULL) {
                            cout << "\"" << replica << "\"";
                        }
                    } else {
                        cout << "N/A";
                    }
                    if (ii != nrepl - 1) {
                        cout << ",";
                    }
                }
            }
        }
        cout << endl;
    }
    return true;
}

static bool hash_impl(string filename, list<string> &keys, bool is_vbucket)
{
    VBUCKET_CONFIG_HANDLE vbucket_config = vbucket_config_create();
    if (vbucket_config_parse(vbucket_config, LIBVBUCKET_SOURCE_FILE, filename.c_str()) != 0) {
        cerr << "ERROR: cannot parse vBucket config: "
             << vbucket_get_error_message(vbucket_config) << endl;
        vbucket_config_destroy(vbucket_config);
        return false;
    }

    return hash_exec(vbucket_config, keys, is_vbucket);
}

static bool hash_impl(lcb_t instance, list<string> &keys, bool is_vbucket)
{
    return hash_exec(instance->vbucket_config, keys, is_vbucket);
}

static bool view_impl(lcb_t instance, string &query, string &data,
                      bool chunked, lcb_http_method_t method)
{
    lcb_error_t rc;
    lcb_http_cmd_t cmd;
    cmd.version = 0;
    cmd.v.v0.path = query.c_str();
    cmd.v.v0.npath = query.length();
    cmd.v.v0.body = data.c_str();
    cmd.v.v0.nbody = data.length();
    cmd.v.v0.method = method;
    cmd.v.v0.chunked = chunked;
    cmd.v.v0.content_type = "application/json";
    rc = lcb_make_http_request(instance, NULL, LCB_HTTP_TYPE_VIEW, &cmd, NULL);
    if (rc != LCB_SUCCESS) {
        cerr << "Failed to send requests:" << endl
             << lcb_strerror(instance, rc) << endl;
        return false;
    }
    return true;
}

static bool admin_impl(lcb_t instance, string &query, string &data,
                       bool chunked, lcb_http_method_t method)
{
    lcb_error_t rc;
    lcb_http_cmd_t cmd;
    cmd.version = 0;
    cmd.v.v0.path = query.c_str();
    cmd.v.v0.npath = query.length();
    cmd.v.v0.body = data.c_str();
    cmd.v.v0.nbody = data.length();
    cmd.v.v0.method = method;
    cmd.v.v0.chunked = chunked;
    cmd.v.v0.content_type = "application/x-www-form-urlencoded";
    rc = lcb_make_http_request(instance, NULL, LCB_HTTP_TYPE_MANAGEMENT, &cmd, NULL);
    if (rc != LCB_SUCCESS) {
        cerr << "Failed to send requests: " << endl
             << lcb_strerror(instance, rc) << endl;
        return false;
    }
    return true;
}

static bool bucket_delete_impl(lcb_t instance, list<string> &names)
{
    lcb_error_t rc;

    for (list<string>::iterator iter = names.begin(); iter != names.end(); ++iter) {
        string query = "/pools/default/buckets/" + *iter;
        lcb_http_cmd_t cmd;
        cmd.version = 0;
        cmd.v.v0.path = query.c_str();
        cmd.v.v0.npath = query.length();
        cmd.v.v0.body = NULL;
        cmd.v.v0.nbody = 0;
        cmd.v.v0.method = LCB_HTTP_METHOD_DELETE;
        cmd.v.v0.chunked = false;
        cmd.v.v0.content_type = "application/x-www-form-urlencoded";
        rc = lcb_make_http_request(instance, NULL, LCB_HTTP_TYPE_MANAGEMENT, &cmd, NULL);
        if (rc != LCB_SUCCESS) {
            cerr << "Failed to send requests: " << endl
                 << lcb_strerror(instance, rc) << endl;
            return false;
        }
    }
    return true;
}

static bool bucket_flush_impl(lcb_t instance, list<string> &names)
{
    lcb_error_t rc;

    for (list<string>::iterator iter = names.begin(); iter != names.end(); ++iter) {
        string query = "/pools/default/buckets/" + *iter + "/controller/doFlush";
        lcb_http_cmd_t cmd;
        cmd.version = 0;
        cmd.v.v0.path = query.c_str();
        cmd.v.v0.npath = query.length();
        cmd.v.v0.body = NULL;
        cmd.v.v0.nbody = 0;
        cmd.v.v0.method = LCB_HTTP_METHOD_POST;
        cmd.v.v0.chunked = false;
        cmd.v.v0.content_type = "application/x-www-form-urlencoded";
        rc = lcb_make_http_request(instance, NULL, LCB_HTTP_TYPE_MANAGEMENT, &cmd, NULL);
        if (rc != LCB_SUCCESS) {
            cerr << "Failed to send requests: " << endl
                 << lcb_strerror(instance, rc) << endl;
            return false;
        }
    }
    return true;
}

static bool bucket_create_impl(lcb_t instance, list<string> &names,
                               string &bucket_type, string &auth_type, int ram_quota,
                               string &sasl_password, int replica_num, int proxy_port)
{
    lcb_error_t rc;
    string query = "/pools/default/buckets";

    if (names.empty()) {
        cerr << "ERROR: you need to specify at least one bucket name" << endl;
        return false;
    }
    for (list<string>::iterator iter = names.begin(); iter != names.end(); ++iter) {
        stringstream dss;
        dss << "name=" << *iter
            << "&bucketType=" << bucket_type
            << "&ramQuotaMB=" << ram_quota
            << "&replicaNumber=" << replica_num
            << "&authType=" << auth_type
            << "&saslPassword=" << sasl_password;
        if (proxy_port > 0) {
            dss << "&proxyPort=" << proxy_port;
        }
        string data = dss.str();
        lcb_http_cmd_t cmd;
        cmd.version = 0;
        cmd.v.v0.path = query.c_str();
        cmd.v.v0.npath = query.length();
        cmd.v.v0.body = data.c_str();
        cmd.v.v0.nbody = data.length();
        cmd.v.v0.method = LCB_HTTP_METHOD_POST;
        cmd.v.v0.chunked = false;
        cmd.v.v0.content_type = "application/x-www-form-urlencoded";
        rc = lcb_make_http_request(instance, NULL, LCB_HTTP_TYPE_MANAGEMENT, &cmd, NULL);
        if (rc != LCB_SUCCESS) {
            cerr << "Failed to send requests: " << endl
                 << lcb_strerror(instance, rc) << endl;
            return false;
        }
    }
    return true;
}

static bool lock_impl(lcb_t instance, list<string> &keys, lcb_time_t exptime)
{
    if (keys.empty()) {
        cerr << "ERROR: you need to specify the key to lock" << endl;
        return false;
    }

    for (list<string>::iterator iter = keys.begin(); iter != keys.end(); ++iter) {
        lcb_get_cmd_t item;
        item.v.v0.key = (const void *)iter->c_str();
        item.v.v0.nkey = (lcb_size_t)iter->length();
        item.v.v0.lock = 1;
        item.v.v0.exptime = exptime;

        lcb_get_cmd_t *items[] = { &item };
        lcb_error_t err = lcb_get(instance, NULL, 1, items);
        if (err != LCB_SUCCESS) {
            cerr << "Failed to send requests:" << endl
                 << lcb_strerror(instance, err) << endl;
            return false;
        }

    }
    return true;
}

static bool unlock_impl(lcb_t instance, list<string> &keys)
{
    if (keys.empty()) {
        cerr << "ERROR: you need to specify the key to unlock" << endl;
        return false;
    }

    if (keys.size() % 2 != 0) {
        cerr << "ERROR: you need to specify key-cas pairs, "
             << "therefore argument list should be even" << endl;
        return false;
    }

    for (list<string>::iterator iter = keys.begin(); iter != keys.end(); ++iter) {
        lcb_cas_t cas;
        string key = *iter;
        stringstream ss(*(++iter));
        ss >> hex >> cas;

        lcb_unlock_cmd_t item;
        memset(&item, 0, sizeof(item));
        item.v.v0.key = key.c_str();
        item.v.v0.nkey = key.length();
        item.v.v0.cas = cas;
        lcb_unlock_cmd_t *items[] = { &item };

        lcb_error_t err = lcb_unlock(instance, NULL, 1, items);
        if (err != LCB_SUCCESS) {
            cerr << "Failed to send requests:" << endl
                 << lcb_strerror(instance, err) << endl;
            return false;
        }

    }
    return true;
}

static bool stats_impl(lcb_t instance, list<string> &keys)
{
    if (keys.empty()) {
        lcb_error_t err;
        lcb_server_stats_cmd_t stats;
        lcb_server_stats_cmd_t *commands[] = { &stats };
        err = lcb_server_stats(instance, NULL, 1, commands);
        if (err != LCB_SUCCESS) {
            cerr << "Failed to request stats: " << endl
                 << lcb_strerror(instance, err) << endl;
            return false;
        }
    } else {
        for (list<string>::iterator ii = keys.begin(); ii != keys.end(); ++ii) {
            string key = *ii;
            lcb_error_t err;

            lcb_server_stats_cmd_t stats(key.c_str());
            lcb_server_stats_cmd_t *commands[] = { &stats };

            err = lcb_server_stats(instance, NULL, 1, commands);
            if (err != LCB_SUCCESS) {
                cerr << "Failed to request stats: " << endl
                     << lcb_strerror(instance, err) << endl;
                return false;
            }
        }
    }

    return true;
}

static bool flush_impl(lcb_t instance, list<string> &keys)
{
    if (!keys.empty()) {
        cerr << "Ignoring arguments." << endl;
    }

    lcb_error_t err;
    lcb_flush_cmd_t flush;
    lcb_flush_cmd_t *commands[] = {&flush};

    err = lcb_flush(instance, NULL, 1, commands);
    if (err != LCB_SUCCESS) {
        cerr << "Failed to flush: " << endl
             << lcb_strerror(instance, err) << endl;
        return false;
    }

    return true;
}

static bool spool(string &data)
{
    stringstream ss;
    char buffer[1024];
    lcb_size_t nr;
    while ((nr = fread(buffer, 1, sizeof(buffer), stdin)) != (lcb_size_t) - 1) {
        if (nr == 0) {
            break;
        }
        ss.write(buffer, nr);
    }
    data.assign(ss.str());
    return nr == 0 || feof(stdin) != 0;
}

static bool create_impl(lcb_t instance, list<string> &keys,
                        lcb_uint32_t exptime, lcb_uint32_t flags, bool add)
{
    if (keys.size() != 1) {
        cerr << "Usage: You need to specify a single key" << endl;
        return false;
    }

    string &key = keys.front();

    string data;
    if (!spool(data)) {
        cerr << "Failed to read input data: " << strerror(errno)
             << endl;
        return false;
    }

    lcb_storage_t operation;
    if (add) {
        operation = LCB_ADD;
    } else {
        operation = LCB_SET;
    }

    lcb_store_cmd_t item(operation, key.c_str(), key.length(),
                         data.data(), data.length(), flags, exptime);
    lcb_store_cmd_t *items[] = { &item };
    lcb_error_t err = lcb_store(instance, NULL, 1, items);

    if (err != LCB_SUCCESS) {
        cerr << "Failed to store object: " << endl
             << lcb_strerror(instance, err) << endl;
        return false;
    }

    return true;
}

static bool verify_impl(lcb_t instance, list<string> &keys)
{
    (void)lcb_set_get_callback(instance, verify_callback);
    return cat_impl(instance, keys);
}

static void loadKeys(list<string> &keys)
{
    char buffer[1024];
    while (fgets(buffer, (int)sizeof(buffer), stdin) != NULL) {
        lcb_size_t idx = strlen(buffer);
        while (idx > 0 && isspace(buffer[idx - 1])) {
            --idx;
        }
        buffer[idx] = '\0';
        keys.push_back(buffer);
    }
}

static bool isValidBucketName(const char *n)
{
    bool rv = strlen(n) > 0;
    for (; *n; n++) {
        rv &= isalpha(*n) || isdigit(*n) || *n == '.' || *n == '%' || *n == '_' || *n == '-';
    }
    return rv;
}

static bool verifyBucketNames(list<string> &names)
{
    for (list<string>::iterator ii = names.begin(); ii != names.end(); ++ii) {
        if (!isValidBucketName(ii->c_str())) {
            return false;
        }
    }
    return true;
}

static void handleCommandLineOptions(enum cbc_command_t cmd, int argc, char **argv)
{
    Configuration config;
    Getopt getopt;
    bool dumb = false;

    getopt.addOption(new CommandLineOption('?', "help", false,
                                           "Print this help text"));
    getopt.addOption(new CommandLineOption('h', "host", true,
                                           "Hostname to connect to"));
    getopt.addOption(new CommandLineOption('b', "bucket", true,
                                           "Bucket to use"));
    getopt.addOption(new CommandLineOption('u', "user", true,
                                           "Username for the rest port"));
    getopt.addOption(new CommandLineOption('P', "password", true,
                                           "password for the rest port"));
    getopt.addOption(new CommandLineOption('T', "enable-timings", false,
                                           "Enable command timings"));
    getopt.addOption(new CommandLineOption('t', "timeout", true,
                                           "Specify timeout value"));
    getopt.addOption(new CommandLineOption('D', "dumb", false,
                                           "Behave like legacy memcached client (default false)"));

    int replica_strategy = -1;
    int replica_idx = 0;
    if (cmd == cbc_cat) {
        getopt.addOption(new CommandLineOption('r', "replica", true,
                                               "Read key(s) from replicas: (default: first)).\n"
                                               "\t\tFollowing strategies available:\n"
                                               "\t\t  first: try all replica from first in a sequence until first successful response\n"
                                               "\t\t  all: try all replicas in parallel\n"
                                               "\t\t  N, where 0 < N < number of replicas: read from selected replica only"));
    }

    lcb_uint32_t flags = 0;
    lcb_uint32_t exptime = 0;
    bool add = false;
    if (cmd == cbc_create) {
        getopt.addOption(new CommandLineOption('f', "flag", true,
                                               "Flag for the new object"));
        getopt.addOption(new CommandLineOption('e', "exptime", true,
                                               "Expiry time for the new object"));
        getopt.addOption(new CommandLineOption('a', "add", false,
                                               "Fail if the object exists"));
    }

    if (cmd == cbc_lock) {
        getopt.addOption(new CommandLineOption('e', "exptime", true,
                                               "Expiry time for the lock"));
    }

    bool json = false;
    bool persisted = false;
    int replicated = 0;
    int max_tries = 5;
    if (cmd == cbc_cp) {
        getopt.addOption(new CommandLineOption('p', "persisted", false,
                                               "Ensure that key has been persisted to master node"));
        getopt.addOption(new CommandLineOption('r', "replicated", true,
                                               "Ensure that key has been replicated and persisted to given number of replicas"));
        getopt.addOption(new CommandLineOption('m', "max-tries", true,
                                               "The number of attempts for observing keys (default: 5)"));
#ifdef HAVE_LIBYAJL2
        getopt.addOption(new CommandLineOption('j', "json", false,
                                               "Treat value as JSON document (take key from '_id' attribute)"));
#endif
    }

    bool chunked = false;
    string data;
    lcb_http_method_t method = LCB_HTTP_METHOD_GET;
    if (cmd == cbc_view || cmd == cbc_admin) {
        getopt.addOption(new CommandLineOption('c', "chunked", false,
                                               "Use chunked callback to stream the data"));
        getopt.addOption(new CommandLineOption('d', "data", true,
                                               "HTTP body data for POST or PUT requests, e.g. {\"keys\": [\"key1\", \"key2\", ...]}"));
        getopt.addOption(new CommandLineOption('X', "request", true,
                                               "HTTP request method, possible values GET, POST, PUT, DELETE (default GET)"));
    }
    string bucket_type = "membase";
    string auth_type = "sasl";
    int ram_quota = 100;
    string sasl_password;
    int replica_num = 1;
    int proxy_port = 0;
    if (cmd == cbc_bucket_create) {
        getopt.addOption(new CommandLineOption('B', "bucket-type", true,
                                               "Bucket type, possible values are: membase (with alias couchbase), memcached) (default: couchbase)"));
        getopt.addOption(new CommandLineOption('q', "ram-quota", true,
                                               "RAM quota in megabytes (default: 100)"));
        getopt.addOption(new CommandLineOption('a', "auth-type", true,
                                               "Type of bucket authentication, possible values are: none, sasl (default: sasl)."
                                               " Note you should specify free port for 'none'"));
        getopt.addOption(new CommandLineOption('s', "sasl-password", true,
                                               "Password for SASL (default: '')"));
        getopt.addOption(new CommandLineOption('r', "replica-number", true,
                                               "Number of the nodes each key should be replicated, allowed values 0-3 (default 1)"));
        getopt.addOption(new CommandLineOption('p', "proxy-port", true,
                                               "Proxy port (default 11211)"));
    }

    bool is_vbucket = false;
    string filename;
    if (cmd == cbc_hash) {
        getopt.addOption(new CommandLineOption('v', "vbucket", false,
                                               "Treat keys as vbucket IDs and skip hashing step"));
        getopt.addOption(new CommandLineOption('f', "config-file", true,
                                               "The dump of the cluster JSON configuration"));
    }

    if (!getopt.parse(argc, argv)) {
        getopt.usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    vector<CommandLineOption *>::iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->found) {
            bool unknownOpt = true;
            switch ((*iter)->shortopt) {
            case 'h' :
                config.setHost((*iter)->argument);
                break;

            case 'b' :
                config.setBucket((*iter)->argument);
                break;

            case 'u' :
                config.setUser((*iter)->argument);
                break;

            case 'P' :
                config.setPassword((*iter)->argument);
                break;

            case 't' :
                config.setTimeout((*iter)->argument);
                break;

            case 'T' :
                config.setTimingsEnabled(true);
                break;

            case 'D':
                dumb = true;
                break;

            case '?':
                getopt.usage(argv[0]);
                exit(EXIT_SUCCESS);
                // NOTREACHED

            default:
                if (cmd == cbc_cat) {
                    string arg;
                    unknownOpt = false;
                    switch ((*iter)->shortopt) {
                    case 'r':
                        arg.assign((*iter)->argument);
                        if (arg == "first") {
                            replica_strategy = LCB_REPLICA_FIRST;
                        } else if (arg == "all") {
                            replica_strategy = LCB_REPLICA_ALL;
                        } else {
                            replica_strategy = LCB_REPLICA_SELECT;
                            replica_idx = atoi(arg.c_str());
                        }
                        break;
                    default:
                        unknownOpt = true;
                    }
                } else if (cmd == cbc_create) {
                    unknownOpt = false;
                    switch ((*iter)->shortopt) {
                    case 'f':
                        flags = (lcb_uint32_t)atoi((*iter)->argument);
                        break;
                    case 'e':
                        exptime = (lcb_uint32_t)atoi((*iter)->argument);
                        break;
                    case 'a':
                        add = true;
                        break;
                    default:
                        unknownOpt = true;
                    }
                } else if (cmd == cbc_cp) {
                    unknownOpt = false;
                    switch ((*iter)->shortopt) {
                    case 'p':
                        persisted = true;
                        break;
                    case 'r':
                        replicated = atoi((*iter)->argument);
                        break;
                    case 'm':
                        max_tries = atoi((*iter)->argument);
                        break;
#ifdef HAVE_LIBYAJL2
                    case 'j':
                        json = true;
                        break;
#endif
                    default:
                        unknownOpt = true;
                    }
                } else if (cmd == cbc_lock) {
                    unknownOpt = false;
                    switch ((*iter)->shortopt) {
                    case 'e':
                        flags = (lcb_uint32_t)atoi((*iter)->argument);
                        break;
                    default:
                        unknownOpt = true;
                    }
                } else if (cmd == cbc_view || cmd == cbc_admin) {
                    string arg;
                    unknownOpt = false;
                    switch ((*iter)->shortopt) {
                    case 'c':
                        chunked = true;
                        break;
                    case 'd':
                        data = (*iter)->argument;
                        break;
                    case 'X':
                        arg = (*iter)->argument;
                        if (arg == "GET") {
                            method = LCB_HTTP_METHOD_GET;
                        } else if (arg == "POST") {
                            method = LCB_HTTP_METHOD_POST;
                        } else if (arg == "PUT") {
                            method = LCB_HTTP_METHOD_PUT;
                        } else if (arg == "DELETE") {
                            method = LCB_HTTP_METHOD_DELETE;
                        } else {
                            unknownOpt = true;
                            cerr << "Usupported HTTP method: " << arg << endl;
                        }
                        break;
                    default:
                        unknownOpt = true;
                    }
                } else if (cmd == cbc_bucket_create) {
                    string arg = (*iter)->argument;
                    unknownOpt = false;
                    switch ((*iter)->shortopt) {
                    case 'B':
                        if (arg == "couchbase") {
                            bucket_type = "membase";
                        } else {
                            bucket_type = arg;
                        }
                        break;
                    case 'q':
                        ram_quota = atoi((*iter)->argument);
                        break;
                    case 'a':
                        auth_type = arg;
                        break;
                    case 's':
                        sasl_password = arg;
                        break;
                    case 'r':
                        replica_num = atoi((*iter)->argument);
                        break;
                    case 'p':
                        proxy_port = atoi((*iter)->argument);
                        break;
                    default:
                        unknownOpt = true;
                    }
                } else if (cmd == cbc_hash) {
                    unknownOpt = false;
                    switch ((*iter)->shortopt) {
                    case 'v':
                        is_vbucket = true;
                        break;
                    case 'f':
                        filename = (*iter)->argument;
                        break;
                    default:
                        unknownOpt = true;
                    }
                }

                if (unknownOpt) {
                    getopt.usage(argv[0]);
                    exit(EXIT_FAILURE);
                }
            }
        }
    }

    bool success = false;
    if (cmd == cbc_hash && !filename.empty()) {
        success = hash_impl(filename, getopt.arguments, is_vbucket);
        exit(success ? EXIT_SUCCESS : EXIT_FAILURE);
    }

    lcb_t instance;
    lcb_error_t err;
    if (dumb) {
        struct lcb_memcached_st memcached;

        memset(&memcached, 0, sizeof(memcached));
        memcached.serverlist = config.getHost();
        err = lcb_create_compat(LCB_MEMCACHED_CLUSTER,
                                &memcached, &instance, NULL);
    } else {
        struct lcb_create_st options(config.getHost(), config.getUser(),
                                     config.getPassword(), config.getBucket());
        if (cmd == cbc_admin || cmd == cbc_bucket_create ||
                cmd == cbc_bucket_delete || cmd == cbc_bucket_flush) {
            options.v.v1.type = LCB_TYPE_CLUSTER;
            if (config.getPassword() == NULL || config.getUser() == NULL) {
                cerr << "Username and password mandatory for admin operations." << endl;
                exit(EXIT_FAILURE);
            }
        }
        err = lcb_create(&instance, &options);
    }
    if (err != LCB_SUCCESS) {
        cerr << "Failed to create couchbase instance: " << endl
             << lcb_strerror(NULL, err) << endl;
        exit(EXIT_FAILURE);
    }

    (void)lcb_set_error_callback(instance, error_callback);
    (void)lcb_set_flush_callback(instance, flush_callback);
    (void)lcb_set_get_callback(instance, get_callback);
    (void)lcb_set_remove_callback(instance, remove_callback);
    (void)lcb_set_stat_callback(instance, stat_callback);
    (void)lcb_set_store_callback(instance, store_callback);
    (void)lcb_set_unlock_callback(instance, unlock_callback);
    (void)lcb_set_observe_callback(instance, observe_callback);
    (void)lcb_set_http_data_callback(instance, data_callback);
    (void)lcb_set_http_complete_callback(instance, complete_callback);
    (void)lcb_set_verbosity_callback(instance, verbosity_callback);

    if (config.getTimeout() != 0) {
        lcb_set_timeout(instance, config.getTimeout());
    }

    lcb_error_t ret = lcb_connect(instance);
    if (ret != LCB_SUCCESS) {
        cerr << "Failed to connect libcouchbase instance to server:" << endl
             << "\t\"" << lcb_strerror(instance, ret) << "\"" << endl;
        exit(EXIT_FAILURE);
    }
    lcb_wait(instance);

    bool error = false;
    lcb_set_cookie(instance, static_cast<void *>(&error));

    if (config.isTimingsEnabled()) {
        lcb_enable_timings(instance);
    }

    list<string> keys;

    switch (cmd) {
    case cbc_cat:
        if (replica_strategy != -1) {
            success = cat_replica_impl(instance, getopt.arguments,
                                       replica_strategy, replica_idx);
        } else {
            success = cat_impl(instance, getopt.arguments);
        }
        break;
    case cbc_lock:
        success = lock_impl(instance, getopt.arguments, exptime);
        break;
    case cbc_unlock:
        success = unlock_impl(instance, getopt.arguments);
        break;
    case cbc_cp:
        if (replicated < 0) {
            cerr << "Number of replicas must be positive integer" << endl;
            success = false;
            break;
        }
        if (getopt.arguments.size() == 1 && getopt.arguments.front() == "-") {
            loadKeys(keys);
            success = cp_impl(instance, keys, json, persisted, replicated, max_tries);
        } else {
            success = cp_impl(instance, getopt.arguments, json, persisted, replicated, max_tries);
        }
        break;
    case cbc_rm:
        success = rm_impl(instance, getopt.arguments);
        break;
    case cbc_stats:
        success = stats_impl(instance, getopt.arguments);
        break;
    case cbc_flush:
        success = flush_impl(instance, getopt.arguments);
        break;
    case cbc_create:
        success = create_impl(instance, getopt.arguments, exptime, flags, add);
        break;
    case cbc_verify:
        if (getopt.arguments.size() == 1 && getopt.arguments.front() == "-") {
            loadKeys(keys);
            success = verify_impl(instance, keys);
        } else {
            success = verify_impl(instance, getopt.arguments);
        }
        break;
    case cbc_hash:
        success = hash_impl(instance, getopt.arguments, is_vbucket);
        break;
    case cbc_view:
    case cbc_admin:
        switch (getopt.arguments.size()) {
        case 1:
            if (cmd == cbc_view) {
                success = view_impl(instance, getopt.arguments.front(), data, chunked, method);
            } else {
                success = admin_impl(instance, getopt.arguments.front(), data, chunked, method);
            }
            break;
        case 0:
            cerr << "Missing endpoint" << endl;
            break;
        default:
            cerr << "There must be only one endpoint specified" << endl;
        }
        break;
    case cbc_bucket_create:
        if (verifyBucketNames(getopt.arguments)) {
            success = bucket_create_impl(instance, getopt.arguments,
                                         bucket_type, auth_type, ram_quota,
                                         sasl_password, replica_num, proxy_port);
        } else {
            cerr << "Bucket name can only contain characters in range A-Z, "
                 "a-z, 0-9 as well as underscore, period, dash & percent" << endl;
        }
        break;
    case cbc_bucket_delete:
        if (verifyBucketNames(getopt.arguments)) {
            success = bucket_delete_impl(instance, getopt.arguments);
        } else {
            cerr << "Bucket name can only contain characters in range A-Z, "
                 "a-z, 0-9 as well as underscore, period, dash & percent" << endl;
        }
        break;
    case cbc_bucket_flush:
        if (verifyBucketNames(getopt.arguments)) {
            success = bucket_flush_impl(instance, getopt.arguments);
        } else {
            cerr << "Bucket name can only contain characters in range A-Z, "
                 "a-z, 0-9 as well as underscore, period, dash & percent" << endl;
        }
        break;
    case cbc_observe:
        success = observe_impl(instance, getopt.arguments);
        break;
    case cbc_verbosity:
        success = verbosity_impl(instance, getopt.arguments);
        break;
    default:
        cerr << "Not implemented" << endl;
        success = false;
    }

    if (!success) {
        error = true;
    } else {
        lcb_wait(instance);
        if (config.isTimingsEnabled()) {
            lcb_get_timings(instance, NULL,
                            timings_callback);
            lcb_disable_timings(instance);
        }
    }

    lcb_destroy(instance);
    exit(error ? EXIT_FAILURE : EXIT_SUCCESS);
}

static void lowercase(string &str)
{
    lcb_size_t len = str.length();
    stringstream ss;
    for (lcb_size_t ii = 0; ii < len; ++ii) {
        ss << static_cast<char>(tolower(str[ii]));
    }
    str.assign(ss.str());
}

static cbc_command_t getBuiltin(string name)
{
    lowercase(name);
    size_t dot = name.rfind(".");
    if (dot != string::npos) {
        name = name.substr(0, dot);
    }
    if (name == "cbc-cat") {
        return cbc_cat;
    } else if (name == "cbc-cp") {
        return cbc_cp;
    } else if (name == "cbc-create") {
        return cbc_create;
    } else if (name == "cbc-rm") {
        return cbc_rm;
    } else if (name == "cbc-stats") {
        return cbc_stats;
    } else if (name == "cbc-flush") {
        return cbc_flush;
    } else if (name == "cbc-lock") {
        return cbc_lock;
    } else if (name == "cbc-unlock") {
        return cbc_unlock;
    } else if (name == "cbc-version") {
        return cbc_version;
    } else if (name == "cbc-verify") {
        return cbc_verify;
    } else if (name == "cbc-hash") {
        return cbc_hash;
    } else if (name == "cbc-help") {
        return cbc_help;
    } else if (name == "cbc-view") {
        return cbc_view;
    } else if (name == "cbc-admin") {
        return cbc_admin;
    } else if (name == "cbc-bucket-create") {
        return cbc_bucket_create;
    } else if (name == "cbc-bucket-delete") {
        return cbc_bucket_delete;
    } else if (name == "cbc-bucket-flush") {
        return cbc_bucket_flush;
    } else if (name == "cbc-observe") {
        return cbc_observe;
    } else if (name == "cbc-verbosity") {
        return cbc_verbosity;
    }

    return cbc_illegal;
}

#ifdef WIN32
#define F_OK 0

bool file_exists(const char *name)
{
    HANDLE handle;
    WIN32_FIND_DATA findData;

    handle = FindFirstFileEx(name,
                             FindExInfoStandard,
                             &findData,
                             FindExSearchNameMatch,
                             NULL,
                             0);
    if (handle == INVALID_HANDLE_VALUE) {
        return false;
    }

    FindClose(handle);
    return true;
}

std::string locate_file(const char *name)
{
    const char *const exts[] = { "", ".exe", ".com", ".bat", NULL };
    int ii = 0;

    while (exts[ii] != NULL) {
        std::string fnm(name);
        fnm.append(exts[ii]);
        if (file_exists(fnm.c_str())) {
            return fnm;
        }
        ++ii;
    }

    return "";
}

bool access(const char *name, int mode)
{
    assert(mode == F_OK);
    std::string nm = locate_file(name);
    return nm != "";
}

int execvp(const char *file, char *const argv[])
{
    std::stringstream ss;
    ss << locate_file(file);
    int ii = 1;
    while (argv[ii] != NULL) {
        ss << " " << argv[ii];
        ++ii;
    }

    exit(system(ss.str().c_str()));
    return -1;
}

#endif

static bool exists_in_path(string file)
{
    const char *p = getenv("PATH");
#ifdef WIN32
    const char path_separator = ';';
#else
    const char path_separator = ':';
#endif
    if (!p || !*p) {
        return false;
    }

    stringstream path(p);
    string item;
    while (std::getline(path, item, path_separator)) {
        if (item.size() > 0) {
            item += '/';
        }
        item += file;
        if (!access(item.c_str(), F_OK)) {
            return true;
        }
    }

    return false;
}

static void printHelp()
{
    cerr << "Usage: cbc command [options]" << endl
         << "command may be:" << endl
         << "   help            show this help or for given command" << endl
         << "   cat             output keys to stdout" << endl
         << "   cp              store files to the cluster" << endl
         << "   create          store files with options" << endl
         << "   observe         observe key state" << endl
         << "   flush           remove all keys from the cluster" << endl
         << "   hash            hash key(s) and print out useful info" << endl
         << "   lock            lock keys" << endl
         << "   unlock          unlock keys" << endl
         << "   rm              remove keys" << endl
         << "   stats           show stats" << endl
         << "   verify          verify content in cache with files" << endl
         << "   version         show version" << endl
         << "   verbosity       specify server verbosity level" << endl
         << "   view            execute couchbase view (aka map/reduce) request" << endl
         << "   admin           execute request to management REST API" << endl
         << "   bucket-create   create data bucket on the cluster" << endl
         << "   bucket-delete   delete data bucket" << endl
         << "   bucket-flush    flush data bucket" << endl
         << "Use 'cbc command --help' to show the options" << endl;
}

/**
 * Program entry point
 * @param argc argument count
 * @param argv argument vector
 * @return 0 success, 1 failure
 */
int main(int argc, char **argv)
{
    string cmdstr(argv[0]);

    if (!lcb_verify_compiler_setup()) {
        cerr << "The compiler use an incompatible set of compiler options"
             << endl;
        exit(EXIT_FAILURE);
    }

    cbc_command_t cmd = getBuiltin(cmdstr);

    /* it probably called from main executable like 'cbc COMMAND' */
    if (cmd == cbc_illegal) {
        /* at least one argument required */
        if (argc > 1) {
            cmdstr.assign("cbc-");
            cmdstr.append(argv[1]);
            cmd = getBuiltin(cmdstr);
            --argc;
            ++argv;
            /* in case of failure lookup external executable */
            if (cmd == cbc_illegal) {
                if (exists_in_path(cmdstr) && !execvp(cmdstr.c_str(), argv)) {
                    cerr << "Error: Cannot execute \"" << cmdstr << "\"" << endl;
                }
            }
        }
    }
    /* if it still illegal command */
    if (cmd == cbc_illegal) {
        cerr << "Error: Unknown command \"" << cmdstr << "\"" << endl;
        printHelp();
        exit(EXIT_FAILURE);
    }

    if (cmd == cbc_help) {
        if (argc > 1) {
            const char *help_argv[] = {argv[1], "-?", NULL};
            cmdstr.assign("cbc-");
            cmdstr.append(argv[1]);
            cmd = getBuiltin(cmdstr);
            if (cmd == cbc_illegal) {
                if (exists_in_path(cmdstr) && !execvp(cmdstr.c_str(), (char **)help_argv)) {
                    cerr << "Error: Cannot execute \"" << cmdstr << "\"" << endl;
                }
            }
            if (cmd == cbc_illegal) {
                cerr << "Error: Unknown command \"" << cmdstr << "\"" << endl;
                printHelp();
                exit(EXIT_FAILURE);
            } else {
                handleCommandLineOptions(cmd, 2, (char **)help_argv);
            }
        } else {
            printHelp();
        }
        exit(EXIT_SUCCESS);
    } else if (cmd == cbc_version) {
        cout << "cbc built from: " << PACKAGE_STRING
             << " (rev. " << LCB_VERSION_CHANGESET << ")" << endl
             << "    using libcouchbase: " << lcb_get_version(NULL)
             << " (";

        struct lcb_cntl_iops_info_st info;
        info.version = 0;
        memset(&info, 0, sizeof(info));
        lcb_cntl(NULL, LCB_CNTL_GET, LCB_CNTL_IOPS_DEFAULT_TYPES, &info);
        switch (info.v.v0.effective) {
        case LCB_IO_OPS_LIBEVENT:
            cout << "libevent";
            break;
        case LCB_IO_OPS_LIBEV:
            cout << "libev";
            break;
        case LCB_IO_OPS_SELECT:
        case LCB_IO_OPS_WINSOCK:
            cout << "select";
            break;
        case LCB_IO_OPS_WINIOCP:
            cout << "windows IOCP";
            break;
        case LCB_IO_OPS_LIBUV:
            cout << "libuv";
            break;
        default:
            cout << "custom";
            break;
        }
        cout << ")" << endl;

#ifdef HAVE_LIBYAJL2
        int version = yajl_version();
        cout << "    using libyajl: "
             << version / 10000 << "."
             << (version / 100) % 100 << "."
             << version % 100 << endl;
#endif
        exit(EXIT_SUCCESS);
    }

    handleCommandLineOptions(cmd, argc, argv);

    return EXIT_SUCCESS;
}
