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
#include "couchbase_impl.h"
#include <string.h>

using namespace Couchnode;

v8::Persistent<v8::String> NameMap::names[NameMap::MAX];

void NameMap::initialize()
{
    install("expiry", EXPIRY);
    install("cas", CAS);
    install("data", DATA);
    install("initial", INITIAL);
    install("positional", OPSTYLE_POSITIONAL);
    install("dict", OPSTYLE_HASHTABLE);
    install("str", PROP_STR);
    install("locktime", LOCKTIME);
    install("flags", FLAGS);
    install("key", KEY);
    install("value", VALUE);
    install("http_code", HTCODE);
    install("offset", ARITH_OFFSET);
    install("persist_to", PERSIST_TO);
    install("replicate_to", REPLICATE_TO);
    install("timeout", TIMEOUT);
    install("spooled", SPOOLED);
    install("error", ERR);
    install("is_delete", IS_DELETE);

    install("ttp", OBS_TTP);
    install("ttr", OBS_TTR);
    install("status", OBS_CODE);
    install("from_master", OBS_ISMASTER);

    install("persisted_master", DUR_PERSISTED_MASTER);
    install("found_master", DUR_FOUND_MASTER);
    install("persisted", DUR_NPERSISTED);
    install("replicated", DUR_NREPLICATED);

    install("code", EXC_CODE);

    install("path", HTTP_PATH);
    install("data", HTTP_CONTENT);
    install("content_type", HTTP_CONTENT_TYPE);
    install("method", HTTP_METHOD);
    install("lcb_http_type", HTTP_TYPE);
    install("status", HTTP_STATUS);

    install("json", FMT_JSON);
    install("raw", FMT_RAW);
    install("utf8", FMT_UTF8);
    install("auto", FMT_AUTO);
    install("format", FMT_TYPE);
    install("raw", GET_RAW);

    install("hashkey", HASHKEY);
}

void NameMap::install(const char *name, dict_t val)
{
    using namespace v8;
    names[val] = Persistent<String>::New(String::NewSymbol(name, strlen(name)));
}
