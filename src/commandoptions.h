/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#ifndef COUCHNODE_COMMANDOPTIONS_H
#define COUCHNODE_COMMANDOPTIONS_H 1
#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

namespace Couchnode {

#define NAMED_OPTION(name, base, fld) \
    struct name : base \
    { \
        virtual Handle<String> getName() const { \
            return NameMap::names[NameMap::fld]; \
        } \
    }

struct Parameters
{
    // Pure virtual functions
    virtual bool parseObject(const Handle<Object> obj, CBExc &) = 0;
    bool isInitialized;
};

struct GetOptions : Parameters
{
    ExpOption expTime;

    NAMED_OPTION(LockOption, ExpOption, LOCKTIME);
    NAMED_OPTION(FormatOption, V8ValueOption, FMT_TYPE);

    LockOption lockTime;
    FormatOption format;
    bool parseObject(const Handle<Object> opts, CBExc &ex);
    void merge(const GetOptions &other);
};

struct StoreOptions : Parameters
{
    NAMED_OPTION(FormatOption, V8ValueOption, FMT_TYPE);
    NAMED_OPTION(ValueOption, V8ValueOption, VALUE);

    CasSlot cas;
    ExpOption exp;
    ValueOption value;
    FlagsOption flags;
    FormatOption format;

    bool parseObject(const Handle<Object> opts, CBExc &ex);
};

struct UnlockOptions : Parameters
{
    CasSlot cas;
    bool parseObject(const Handle<Object>, CBExc &ex);
};

struct DeleteOptions : UnlockOptions
{
};

struct TouchOptions : Parameters
{
    ExpOption exp;
    bool parseObject(const Handle<Object>, CBExc &);
};


struct DurabilityOptions : Parameters
{
    NAMED_OPTION(PersistToOption, Int32Option, PERSIST_TO);
    NAMED_OPTION(ReplicateToOption, Int32Option, REPLICATE_TO);
    NAMED_OPTION(TimeoutOption, UInt32Option, TIMEOUT);
    NAMED_OPTION(IsDeleteOption, BooleanOption, IS_DELETE);

    // Members
    PersistToOption persist_to;
    ReplicateToOption replicate_to;
    TimeoutOption timeout;
    IsDeleteOption isDelete;

    bool parseObject(const Handle<Object>, CBExc &);
};

struct ArithmeticOptions : Parameters
{
    NAMED_OPTION(InitialOption, UInt64Option, INITIAL);
    NAMED_OPTION(DeltaOption, Int64Option, ARITH_OFFSET);

    ExpOption exp;
    InitialOption initial;
    DeltaOption delta;
    bool parseObject(const Handle<Object>, CBExc&);

    void merge(const ArithmeticOptions& other);
};


struct HttpOptions : Parameters
{
    NAMED_OPTION(PathOption, StringOption, HTTP_PATH);
    NAMED_OPTION(DataOption, StringOption, HTTP_CONTENT);
    NAMED_OPTION(ContentTypeOption, StringOption, HTTP_CONTENT_TYPE);
    NAMED_OPTION(MethodOption, Int32Option, HTTP_METHOD);
    NAMED_OPTION(HttpTypeOption, Int32Option, HTTP_TYPE);

    PathOption path;
    DataOption content;
    ContentTypeOption contentType;
    MethodOption httpMethod;
    HttpTypeOption httpType;
    bool parseObject(const Handle<Object>, CBExc&);
};

}

#endif
