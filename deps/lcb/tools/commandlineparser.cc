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
#include <getopt.h>
#include <vector>
#include <sstream>
#include <iostream>
#include "commandlineparser.h"

using namespace std;

CommandLineOption::CommandLineOption(char s, const char *l, bool arg, const char *d) :
    shortopt(s), longopt(strdup(l)), hasArgument(arg), description(d),
    found(false),
    argument(NULL)
{
    // Empty
}

CommandLineOption::~CommandLineOption()
{
    free(longopt);
}

void CommandLineOption::set(char *arg)
{
    argument = arg;
}


Getopt &Getopt::addOption(CommandLineOption *option)
{
    options.push_back(option);
    return *this;
}

void Getopt::usage(const char *name) const
{
    vector<CommandLineOption *>::const_iterator iter;
    cerr << "Usage: " << name << " [options] [arguments]" << endl << endl;

    for (iter = options.begin(); iter != options.end(); ++iter) {
        string arg;

        if ((*iter)->hasArgument) {
            arg = " val";
        }

        // @todo fix a nice wrap of lines...
        cerr << "\t-" << (*iter)->shortopt << arg << "\t"
             << (*iter)->description << " (--" << (*iter)->longopt << ")"
             << endl;
    }
    cerr << endl;
}

bool Getopt::parse(int argc, char **argv)
{
    optind = 0;
    optarg = NULL;
    struct option opts[256];
    memset(opts, 0, 256 * sizeof(*opts));
    stringstream ss;
    vector<CommandLineOption *>::iterator iter;
    int ii = 0;
    for (iter = options.begin(); iter != options.end(); ++iter, ++ii) {
        opts[ii].name = (*iter)->longopt;
        opts[ii].has_arg = (*iter)->hasArgument ? required_argument : no_argument;
        opts[ii].val = (*iter)->shortopt;
        ss << (*iter)->shortopt;
        if ((*iter)->hasArgument) {
            ss << ":";
        }
    }

    optarg = NULL;
    optind = 0;
    string shortopts = ss.str();
    int c;
    while ((c = getopt_long(argc, argv, shortopts.c_str(), opts, NULL)) != -1) {
        for (iter = options.begin(); iter != options.end(); ++iter, ++ii) {
            if ((*iter)->shortopt == c) {
                (*iter)->set(optarg);
                (*iter)->found = true;
                break;
            }
        }

        if (iter == options.end()) {
            return false;
        }
    }

    for (ii = optind; ii < argc; ++ii) {
        arguments.push_back(argv[ii]);
    }

    return true;
}
