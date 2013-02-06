/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
#pragma once
#include <sstream>
#include <cassert>

/*
 * I'm no big fan of logging, but during the development of the node
 * driver I found out that I needed it to figure out where functions
 * was called from, so that I could track the callstack in and out
 * of the plugin (if the code was called from javascript or from
 * the callbacks from libuv).
 *
 * I'm going to nuke all of this code when I'm done debugging the
 * module, so I've not spent a lot of time trying to make it "clean"
 * and nice.
 */
class Logger {
public:
    Logger() : indent(0) {
        enabled = getenv("COUCHNODE_DO_TRACE") != NULL;
    }

    void enter(const std::stringstream &ss) {
        enter(ss.str());
    }

    void enter(const std::string &txt) {
        dump("==> ", txt);
        indent += 4;
    }

    void exit(const std::stringstream &ss) {
        exit(ss.str());
    }

    void exit(const std::string &txt) {
        indent -= 4;
        assert(indent > -1);
        dump("<== ", txt);
    }


    void log(const std::stringstream &ss) {
        dump("", ss.str());
    }

private:

    void lead() {
        for (int ii = 0; ii < indent; ++ii) {
            std::cout << " ";
        }
    }

    // @todo fix indents when I wrap
    void dump(const std::string &prefix, const std::string &text) {
        if (enabled) {
            lead();
            std::cout << prefix << " " << text << std::endl;
        }
    }

    bool enabled;
    int indent;
};

extern Logger logger;

class ScopeLogger {
public:
    ScopeLogger(const std::string &m) : msg(m) {
        logger.enter(msg);
    }

    ~ScopeLogger() {
        logger.exit(msg);
    }

protected:
    std::string msg;
};
