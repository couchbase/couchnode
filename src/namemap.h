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
            KEY,
            VALUE,
            LOCKTIME,
            INITIAL,
            FLAGS,
            OPSTYLE_POSITIONAL,
            OPSTYLE_HASHTABLE,
            PROP_STR,
            HTCODE,
            ARITH_OFFSET,
            PERSIST_TO,
            REPLICATE_TO,
            TIMEOUT,
            SPOOLED,
            IS_DELETE,
            ERR,
            OBS_TTP,
            OBS_TTR,
            OBS_CODE,
            OBS_ISMASTER,
            DUR_PERSISTED_MASTER,
            DUR_FOUND_MASTER,
            DUR_NPERSISTED,
            DUR_NREPLICATED,
            EXC_CODE,
            GET_RAW,

            HTTP_PATH,
            HTTP_CONTENT,
            HTTP_CONTENT_TYPE,
            HTTP_METHOD,
            HTTP_TYPE,
            HTTP_STATUS,

            FMT_RAW,
            FMT_UTF8,
            FMT_UTF16,
            FMT_JSON,
            FMT_AUTO,
            FMT_TYPE,

            HASHKEY,

            MAX
        } dict_t;
        static v8::Persistent<v8::String> names[MAX];
        static void initialize();
        static Handle<Value> get(dict_t ix) {
            return names[ix];
        }
    protected:
        static void install(const char *name, dict_t val);
    };

} // namespace Couchnode

#endif
