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
}

void NameMap::install(const char *name, dict_t val)
{
    using namespace v8;
    names[val] = Persistent<String>::New(String::New(name, strlen(name)));
}
