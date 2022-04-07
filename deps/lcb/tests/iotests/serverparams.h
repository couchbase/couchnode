/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2020 Couchbase, Inc.
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
#ifndef TESTS_SERVER_PARAMS_H
#define TESTS_SERVER_PARAMS_H 1

#include "config.h"
#include <string>
#include <string.h>
#include <libcouchbase/couchbase.h>

class ServerParams
{
  public:
    ServerParams() {}
    ServerParams(const char *h, const char *b, const char *u, const char *p)
    {
        loadParam(host, h);
        loadParam(bucket, b);
        loadParam(user, u);
        loadParam(pass, p);
    }

    void makeConnectParams(lcb_CREATEOPTS *&crst, lcb_io_opt_t io, lcb_INSTANCE_TYPE type = LCB_TYPE_BUCKET)
    {
        lcb_createopts_create(&crst, type);
        if (host.find("couchbase") == 0) {
            connstr = host;
            // deactivate dnssrv and compression, use cccp bootstrap
            if (host.find("?") == std::string::npos) {
                connstr += "?";
            } else {
                connstr += "&";
            }
            connstr += "dnssrv=off&bootstrap_on=cccp&compression=off";
        } else {
            if (mcNodes.empty() || type == LCB_TYPE_CLUSTER) {
                connstr = "couchbase://" + host + "=http";
            } else {
                connstr = "couchbase+explicit://" + host + "=http;" + mcNodes;
            }
        }

        lcb_createopts_connstr(crst, connstr.c_str(), connstr.size());
        lcb_createopts_credentials(crst, user.c_str(), user.size(), pass.c_str(), pass.size());
        if (type == LCB_TYPE_BUCKET) {
            lcb_createopts_bucket(crst, bucket.c_str(), bucket.size());
        }
        lcb_createopts_io(crst, io);
    }

    std::string getUsername()
    {
        return user;
    }

    std::string getPassword()
    {
        return pass;
    }

    std::string getBucket()
    {
        return bucket;
    }

    const std::string &getMcPorts() const
    {
        return mcNodes;
    }

    void setMcPorts(const std::vector<int> &portlist)
    {
        std::stringstream ss;
        for (std::vector<int>::const_iterator ii = portlist.begin(); ii != portlist.end(); ii++) {
            ss << "localhost";
            ss << ":";
            ss << std::dec << *ii;
            ss << "=mcd";
            ss << ";";
        }
        mcNodes = ss.str();
    }

  protected:
    std::string host;
    std::string user;
    std::string pass;
    std::string bucket;
    std::string mcNodes;
    std::string connstr;

  private:
    void loadParam(std::string &d, const char *s)
    {
        if (s) {
            d.assign(s);
        }
    }
};

#endif
