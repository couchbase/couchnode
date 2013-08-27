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
#ifndef COUCHNODE_OPTIONS_H
#define COUCHNODE_OPTIONS_H 1
#ifndef COUCHBASE_H
#error "include couchbase_impl.h first"
#endif

#include <cstdlib>

namespace Couchnode {
// This file contains routines to parse parameters from the user.

enum ParseStatus {
    PARSE_OPTION_EMPTY,
    PARSE_OPTION_ERROR,
    PARSE_OPTION_FOUND,

    // Option was found in the parameters, but contains a non-numeric
    // false, null, or undefined value
    PARSE_OPTION_FALSEVAL
};

struct ParamSlot {
    static ParseStatus validateNumber(const Handle<Value>, CBExc&);
    virtual ParseStatus parseValue(const Handle<Value>, CBExc&) = 0;
    virtual Handle<String> getName() const = 0;
    ParamSlot() : status(PARSE_OPTION_EMPTY) { }
    virtual ~ParamSlot() { }

    ParseStatus returnStatus(ParseStatus s) {
        status = s;
        return s;
    }

    bool isFound() const { return status == PARSE_OPTION_FOUND; }
    void forceIsFound() { status = PARSE_OPTION_FOUND; }

    ParseStatus status;
    static bool parseAll(const Handle<Object>, ParamSlot **, size_t, CBExc&);
    bool maybeSetFalse(Handle<Value>);
    template <typename T>
    ParseStatus setNumber(Handle<Value> val, T& res) {
        res = val->IntegerValue();
        status = PARSE_OPTION_FOUND;
        return status;
    }
};

template <typename T>
struct NumericSlot : ParamSlot
{
    T v;
    NumericSlot() : v(0) {}
    ParseStatus parseValue(const Handle<Value> value, CBExc &ex) {
        if (maybeSetFalse(value)) {
            return status;
        }

        if (!value->IsNumber()) {
            ex.eArguments("Not a number", value);
            return returnStatus(PARSE_OPTION_ERROR);
        }
        int64_t tmp = value->IntegerValue();
        v = (T)tmp;
        if ((int64_t)v != tmp) {
            ex.eArguments("Overflow detected", value);
            return returnStatus(PARSE_OPTION_ERROR);
        }
        return returnStatus(PARSE_OPTION_FOUND);
    }
};

typedef NumericSlot<int64_t> Int64Option;
typedef NumericSlot<uint64_t> UInt64Option;
typedef NumericSlot<int32_t> Int32Option;
typedef NumericSlot<uint32_t> UInt32Option;

struct CasSlot : ParamSlot
{
    lcb_cas_t v;
    CasSlot() : v(0) {}
    virtual Handle<String> getName() const {
        return NameMap::names[NameMap::CAS];
    }

    ParseStatus parseValue(const Handle<Value>, CBExc &);
};

struct ExpOption : UInt32Option
{
    virtual Handle<String> getName() const {
        return NameMap::names[NameMap::EXPIRY];
    }
};

struct LockOption : ExpOption
{
    virtual Handle<String> getName() const {
        return NameMap::names[NameMap::LOCKTIME];
    }
};

struct FlagsOption : UInt32Option
{
    virtual Handle<String> getName() const {
        return NameMap::names[NameMap::FLAGS];
    }
};

struct BooleanOption : ParamSlot
{
    bool v;
    BooleanOption() :v(false) {}
    ParseStatus parseValue(const Handle<Value> val, CBExc&) {
        v = val->BooleanValue();
        return returnStatus(PARSE_OPTION_FOUND);
    }
};

struct CallableOption : ParamSlot
{
    Handle<Function> v;
    virtual ParseStatus parseValue(const Handle<Value> val, CBExc& ex);

    virtual Handle<String> getName() const {
        abort();
        static Handle<String> h;
        return h;
    }
};

struct V8ValueOption : ParamSlot
{
    Handle<Value> v;
    ParseStatus parseValue(const Handle<Value> val, CBExc&) {
        v = val;
        return returnStatus(PARSE_OPTION_FOUND);
    }
};

struct StringOption : ParamSlot
{
    Handle<Value> v;
    virtual ParseStatus parseValue(const Handle<Value> val, CBExc& ex);
};

struct KeyOption : StringOption
{
    virtual Handle<String> getName() const {
        return NameMap::names[NameMap::KEY];
    }
};

};

#endif
