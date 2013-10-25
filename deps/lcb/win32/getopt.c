/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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

#include "getopt.h"
#include <ctype.h>
#include <string.h>
#include <stdio.h>

char *optarg;
int opterr;
int optind;
int optopt;


static int parse_longopt(int argc, char **argv,
                         const struct option *longopts,  int *longindex)
{
    const struct option *p;
    char *name = argv[optind] + 2;
    if (*name == '\0') {
        ++optind;
        return -1;
    }

    optarg = strchr(name, '=');
    if (optarg == NULL) {
        // value comes next!
        optarg = argv[optind + 1];
    } else {
        *optarg = '\0';
        ++optarg;
    }

    for (p = longopts; p != NULL; ++p) {
        if (strcmp(name, p->name) == 0) {
            // This is it :)
            if (p->has_arg) {
                // we need a value!
                if (optarg == argv[optind + 1]) {
                    ++optind;
                }
                if (optarg == NULL || optind >= argc) {
                    fprintf(stderr, "%s: option requires an argument -- %s\n",
                            argv[0], name);
                    return '?';
                }

            } else {
                optarg = NULL;
            }
            return p->val;
        }
    }

    return '?';
}


int getopt_long(int argc, char **argv, const char *optstring,
                const struct option *longopts, int *longindex)
{

    if (optind + 1 >= argc) {
        // EOF
        return -1;
    }
    ++optind;

    if (argv[optind][0] != '-') {
        return -1;
    }

    if (argv[optind][1] == '-') {
        // this is a long option
        return parse_longopt(argc, argv, longopts, longindex);
    } else if (argv[optind][2] != '\0') {
        fprintf(stderr, "You can't specify multiple options with this implementation\n");
        return '?';
    } else {
        // this is a short option
        const char *p = strchr(optstring, argv[optind][1]);
        int idx = optind;

        if (p == NULL) {
            return '?';
        }

        if (*(p + 1) == ':') {
            optind++;
            optarg = argv[optind];
            if (optarg == NULL || optind >= argc) {
                fprintf(stderr, "%s: option requires an argument -- %s\n",
                        argv[0], argv[idx] + 1);
                return '?';
            }
        } else {
            optarg = NULL;
        }
        return argv[idx][1];
    }
}
