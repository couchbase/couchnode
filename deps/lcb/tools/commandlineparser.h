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

#ifndef COMMANDLINEPARSER_H
#define COMMANDLINEPARSER_H 1

#include <getopt.h>
#include <vector>
#include <list>
#include <sstream>

class CommandLineOption
{
public:
    CommandLineOption(char s, const char *l, bool arg, const char *d);
    virtual ~CommandLineOption();

    // Called whenever we found the entry on the command line.
    // You may override this if you like to support multiple
    // values for a given argument
    virtual void set(char *arg);

    char shortopt;
    char *longopt;
    bool hasArgument;
    std::string description;
    bool found;
    char *argument;
};

class Getopt
{
public:
    Getopt &addOption(CommandLineOption *option);
    bool parse(int argc, char **argv);
    void usage(const char *name) const;
    std::vector<CommandLineOption *> options;
    std::list<std::string> arguments;
};

#endif
