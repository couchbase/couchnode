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
#ifndef NAMEMAP_H
#define NAMEMAP_H 1

#include <map>

namespace Couchnode
{
    // @todo refactor this into a more OO fashioned way..

    class NameMap
    {
    public:
        // This is a cache of strings we will have hanging around. This makes
        // it easier to pass string 'literals' to functions which want a
        // v8::String
        typedef enum {
            EXPIRY = 0,
            CAS,
            DATA,
            INITIAL,
            OPSTYLE_POSITIONAL,
            OPSTYLE_HASHTABLE,
            PROP_STR,
            MAX
        } dict_t;
        static v8::Persistent<v8::String> names[MAX];
        static void initialize();
    protected:
        static void install(const char *name, dict_t val);
    };

} // namespace Couchnode

#endif
