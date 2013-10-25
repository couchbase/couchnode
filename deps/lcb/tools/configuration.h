/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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

#ifndef CONFIGURATION_H
#define CONFIGURATION_H 1

#include "config.h"
#include <string>

class Configuration
{
public:
    Configuration();
    ~Configuration();
    void setHost(const char *val);
    const char *getHost() const;
    void setUser(const char *u);
    const char *getUser() const;
    void setPassword(const char *p);
    const char *getPassword() const;
    void setBucket(const char *b);
    const char *getBucket() const;
    void setTimingsEnabled(bool n);
    bool isTimingsEnabled() const;
    void setTimeout(const char *t);
    void setTimeout(uint32_t t);
    uint32_t getTimeout(void);

protected:
    void loadCbcRc(void);

    std::string host;
    std::string user;
    std::string passwd;
    std::string bucket;
    bool timings;
    uint32_t timeout;
};

#endif
