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

#include <cstdlib>
#include <sstream>
#include <cstdio>
#include <map>

#include "configuration.h"

using namespace std;

Configuration::Configuration() : timings(false), timeout(0)
{
    loadCbcRc();
    setHost(getenv("COUCHBASE_CLUSTER_URI"));
    setUser(getenv("COUCHBASE_CLUSTER_USER"));
    setPassword(getenv("COUCHBASE_CLUSTER_PASSWORD"));
    setBucket(getenv("COUCHBASE_CLUSTER_BUCKET"));
}

Configuration::~Configuration()
{
}

void Configuration::setHost(const char *h)
{
    if (h != NULL) {
        host.assign(h);
    }
}

const char *Configuration::getHost() const
{
    if (host.length() > 0) {
        return host.c_str();
    }
    return NULL;
}

void Configuration::setUser(const char *u)
{
    if (u) {
        user.assign(u);
    }
}

const char *Configuration::getUser() const
{
    if (user.length() > 0) {
        return user.c_str();
    }
    return NULL;
}

void Configuration::setPassword(const char *p)
{
    if (p) {
        passwd.assign(p);
    }
}

const char *Configuration::getPassword() const
{
    if (passwd.length() > 0) {
        return passwd.c_str();
    }
    return NULL;
}

void Configuration::setBucket(const char *b)
{
    if (b)  {
        bucket.assign(b);
    }
}

const char *Configuration::getBucket() const
{
    if (bucket.length() > 0) {
        return bucket.c_str();
    }
    return NULL;
}

void Configuration::setTimingsEnabled(bool n)
{
    timings = n;
}

bool Configuration::isTimingsEnabled() const
{
    return timings;
}

void Configuration::setTimeout(const char *t)
{
    setTimeout((uint32_t)atoi(t));
}

void Configuration::setTimeout(uint32_t t)
{
    timeout = t;
}

uint32_t Configuration::getTimeout()
{
    return timeout;
}

static string trim(const char *ptr)
{

    // skip leading blanks
    while (isspace(*ptr)) {
        ++ptr;
    }

    string ret(ptr);
    int ii = (int)ret.length() - 1;
    while (ii > 0 && isspace(ret[ii])) {
        ret.resize(ii);
    }

    return ret;
}

bool split(const string &line, string &key, string &value)
{
    string::size_type idx = line.find('=');
    if (idx == string::npos) {
        return false;
    }

    key.assign(trim(line.substr(0, idx).c_str()));
    value.assign(trim(line.substr(idx + 1).c_str()));
    return true;
}

void Configuration::loadCbcRc(void)
{
    stringstream ss;

    if (getenv("HOME") != NULL) {
        ss << getenv("HOME");
#ifdef _WIN32
        ss << "\\";
#else
        ss << "/";
#endif
    }
    ss << ".cbcrc";
    string fname(ss.str());
    FILE *fp = fopen(ss.str().c_str(), "r");
    if (fp == NULL) {
        return;
    }

    map<string, string> tokens;
    char buffer[256];
    while (fgets(buffer, (int)sizeof(buffer), fp) != NULL) {
        string line = trim(buffer);
        if (!line.empty() && line[0] != '#') {
            string key;
            string value;
            if (split(line, key, value)) {
                tokens[key] = value;
            }
        }
    }
    fclose(fp);

    setHost(tokens["uri"].c_str());
    setUser(tokens["user"].c_str());
    setPassword(tokens["password"].c_str());
    setBucket(tokens["bucket"].c_str());
    setTimeout(tokens["timeout"].c_str());
}
