/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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
#include <vector>
#include <list>
#include <iostream>
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <getopt.h>
#include <cstdlib>

extern "C" {
static void op_callback(lcb_t, int, const lcb_RESPBASE*);
}

class MultiClusterClient {
public:
    class Operation {
    public:
        Operation(MultiClusterClient *r) :
            root(r),
            error(LCB_SUCCESS),
            numReferences(r->instances.size() + 1),
            numResponses(0)
        {
        }

        void response(lcb_error_t err, const std::string &value) {
            if (err == LCB_SUCCESS) {
                values.push_back(value);
            } else {
                // @todo handle retry etc
                error = err;
            }

            // @todo figure out the number you want before you want
            // the wait to resume
            if (++numResponses == 1) {
                root->resume();
            }

            --numReferences;
            maybeNukeMe();
        }

        lcb_error_t getErrorCode(void) {
            return error;
        }

        std::string getValue(void) {
            return values[0];
        }

        void release(void) {
            --numReferences;
            maybeNukeMe();
        }

    private:
        void maybeNukeMe(void) {
            if (numReferences == 0) {
                delete this;
            }
        }

        MultiClusterClient *root;
        lcb_error_t error;
        int numReferences;
        int numResponses;
        std::vector<std::string> values;
    };


public:
    MultiClusterClient(std::list<std::string> clusters) {
        lcb_error_t err;
        if ((err = lcb_create_io_ops(&iops, NULL)) != LCB_SUCCESS) {
            std::cerr <<"Failed to create io ops: " << lcb_strerror(NULL, err)
                      << std::endl;
            exit(1);
        }

        for (std::list<std::string>::iterator iter = clusters.begin();
             iter != clusters.end();
             ++iter) {
            std::cout<< "Creating instance for cluster " << *iter;
            std::cout.flush();
            lcb_create_st options(iter->c_str(), NULL, NULL, NULL, iops);
            lcb_t instance;
            if ((err = lcb_create(&instance, &options)) != LCB_SUCCESS) {
                std::cerr <<"Failed to create instance: "
                          << lcb_strerror(NULL, err)
                          << std::endl;
                exit(1);
            }
            lcb_install_callback3(instance, LCB_CALLBACK_GET, op_callback);
            lcb_install_callback3(instance, LCB_CALLBACK_STORE, op_callback);


            lcb_connect(instance);
            lcb_wait(instance);
            if ((err = lcb_get_bootstrap_status(instance)) != LCB_SUCCESS) {
                std::cerr << "Failed to bootstrap: "
                          << lcb_strerror(instance, err)
                          << std::endl;
                exit(1);
            }
            std::cout << " done" << std::endl;

            instances.push_back(instance);
        }
    }

    lcb_error_t store(const std::string &key, const std::string &value) {
        lcb_CMDSTORE scmd = { 0 };
        LCB_CMD_SET_KEY(&scmd, key.c_str(), key.size());
        LCB_CMD_SET_VALUE(&scmd, value.c_str(), value.size());
        scmd.operation = LCB_SET;
        Operation *oper = new Operation(this);
        lcb_error_t error;
        for (std::list<lcb_t>::iterator iter = instances.begin();
             iter != instances.end();
             ++iter) {

            if ((error = lcb_store3(*iter, oper, &scmd)) != LCB_SUCCESS) {
                oper->response(error, "");
            }
        }

        wait();
        lcb_error_t ret = oper->getErrorCode();
        oper->release();
        return ret;
    }

    lcb_error_t get(const std::string &key, std::string &value) {
        lcb_CMDGET gcmd = { 0 };
        LCB_CMD_SET_KEY(&gcmd, key.c_str(), key.size());
        Operation *oper = new Operation(this);
        lcb_error_t error;
        for (std::list<lcb_t>::iterator iter = instances.begin();
             iter != instances.end();
             ++iter) {

            if ((error = lcb_get3(*iter, oper, &gcmd)) != LCB_SUCCESS) {
                oper->response(error, "");
            }
        }

        wait();
        value = oper->getValue();
        lcb_error_t ret = oper->getErrorCode();
        oper->release();
        return ret;
    }

private:
    void wait(void) {
        lcb_run_loop(instances.front());
    }

    void resume(void) {
        lcb_stop_loop(instances.front());
    }

    lcb_io_opt_t iops;
    std::list<lcb_t> instances;
};

static void op_callback(lcb_t, int cbtype, const lcb_RESPBASE *rb)
{
    MultiClusterClient::Operation *o =
            reinterpret_cast<MultiClusterClient::Operation*>(rb->cookie);
    if (rb->rc != LCB_SUCCESS) {
        o->response(rb->rc, "");
    } else if (cbtype == LCB_CALLBACK_GET) {
        const lcb_RESPGET *rg = reinterpret_cast<const lcb_RESPGET*>(rb);
        std::string value(reinterpret_cast<const char*>(rg->value), rg->nvalue);
        o->response(rb->rc, value);
    }
}

int main(int argc, char **argv)
{
    std::list<std::string> clusters;
    int cmd;
    std::string key;
    std::string value;

    while ((cmd = getopt(argc, argv, "h:k:v:")) != -1) {
        switch (cmd) {
        case 'h' :
            clusters.push_back(optarg);
            break;
        case 'k':
            key.assign(optarg);
            break;
        case 'v':
            value.assign(optarg);
            break;
        default:
            std::cerr << "Usage: mcc [-h clusterurl]+ -k key -v value"
                      << std::endl;
            exit(EXIT_FAILURE);
        }
    }

    if (clusters.empty()) {
        std::cerr << "No clusters specified" << std::endl;
        exit(EXIT_FAILURE);
    }

    if (key.empty()) {
        std::cerr << "No key specified" << std::endl;
        exit(EXIT_FAILURE);
    }

    MultiClusterClient client(clusters);
    std::cout << "Storing kv-pair: [\"" << key << "\", \"" << value << "\"]: ";
    std::cout.flush();
    std::cout << lcb_strerror(NULL, client.store(key, value)) << std::endl;

    std::cout << "Retrieving key \"" << key << "\": ";
    std::cout.flush();
    lcb_error_t err = client.get(key, value);
    std::cout << lcb_strerror(NULL, err) << std::endl;
    if (err == LCB_SUCCESS) {
        std::cout << "\tValue: \"" << value << "\"" << std::endl;
    }

    exit(EXIT_SUCCESS);
}
