/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "couchbase_impl.h"
#include <cstring>
#include <cstdio>
#include <cassert>

using namespace Couchnode;
using namespace std;

static bool get_string(const v8::Handle<v8::Value> &jv,
                       char **strp,
                       size_t *szp)
{
    if (!jv->IsString()) {
#ifdef COUCHNODE_DEBUG
        printf("Not a string..\n");
#endif
        return false;
    }

    v8::Local<v8::String> s = jv->ToString();
    *szp = s->Utf8Length();
    if (!*szp) {
        return false;
    }

    *strp = new char[*szp];
    int nw = s->WriteUtf8(*strp, -1, NULL, v8::String::NO_NULL_TERMINATION);
    return true;
}

#define GET_DPARAM(lval, bidx) \
    if (!dict.IsEmpty()) { \
        lval = dict->Get(NameMap::names[NameMap::##bidx]); \
    }


static inline bool isFalseValue(const v8::Handle<v8::Value> &v)
{
    return (v.IsEmpty() || v->BooleanValue() == false);
}

CommonArgs::CommonArgs(const v8::Arguments &argv, int pmax, int reqmax)
    : args(argv), key(NULL), params_max(pmax), required_max(reqmax), stale(false)
{
}

bool CommonArgs::parse()
{
    if (use_dictparams) {
        if (args.Length() < required_max + 2) {
            throw Couchnode::Exception("Bad arguments");
        }
        if (args.Length() == required_max + 3) {
            if (!args[required_max + 2]->IsObject()) {
                throw Couchnode::Exception(
                    "Have last argument, but it's not an Object",
                    args[required_max + 2]);
            }
            dict = args[required_max + 2]->ToObject();
        }
    } else if (args.Length() < (params_max + 2)) {
        throw Couchnode::Exception("Bad arguments");
    }

    if (!extractKey()) {
        return false;
    }

    if (!extractUdata()) {
        return false;
    }
    return true;
}

bool CommonArgs::extractKey()
{
    if (!get_string(args[0], &key, &nkey)) {
#ifdef COUCHNODE_DEBUG
        printf("Arg at pos %d\n", 0);
#endif
        throw Couchnode::Exception("Couldn't extract string");
    }
    return true;
}

bool CommonArgs::extractUdata()
{
    // { "key", .. params_max ..., function() { .. }, "Data" }
    // Index should be 1 + params_max

    int ix;
    if (use_dictparams) {
        ix = required_max + 1;
    } else {
        ix = params_max + 1;
    }

    ucb = v8::Local<v8::Function>::Cast(args[ix]);
    if (!ucb->IsFunction()) {
#ifdef COUCHNODE_DEBUG
        printf("Not a function at index %d\n", ix);
#endif
        throw Couchnode::Exception("Not a function", args[ix]);
    }

    getParam(ix + 1, NameMap::DATA, &udata);
    return true;
}

void CommonArgs::extractCas(const v8::Handle<v8::Value> &arg,
                            lcb_cas_t *cas)
{
    if (isFalseValue(arg)) {
        *cas = 0;
    } else if (arg->IsObject()) {
        *cas = Cas::GetCas(arg->ToObject());
    } else {
        throw Couchnode::Exception("Couldn't parse CAS", arg);
    }
}

void CommonArgs::extractExpiry(const v8::Handle<v8::Value> &arg, time_t *exp)
{
    if (isFalseValue(arg)) {
        *exp = 0;
    } else if (arg->IsNumber()) {
        *exp = arg->Uint32Value();
    } else {
        throw Couchnode::Exception("Couldn't extract expiration", arg);
    }
}

CouchbaseCookie *CommonArgs::makeCookie()
{
    return new CouchbaseCookie(args.This(), ucb, udata, 1);
}

void CommonArgs::bailout(CouchbaseCookie *cookie, lcb_error_t err)
{
    cookie->result(err, key, nkey);
}

CommonArgs::~CommonArgs()
{
    if (stale) {
        return;
    }

    if (key) {
        delete[] key;
        key = NULL;
    }
}

// store(key, value, exp, cas, cb, data)
StorageArgs::StorageArgs(const v8::Arguments &argv, int vparams)
    : CommonArgs(argv, vparams + 3, 1),

      data(NULL), ndata(0), exp(0), cas(0)
{
}

bool StorageArgs::parse()
{

    if (!CommonArgs::parse()) {
        return false;
    }

    if (!extractValue()) {
        return false;
    }

    v8::Local<v8::Value> arg_exp, arg_cas;
    getParam(params_max, NameMap::CAS, &arg_cas);
    getParam(params_max - 1, NameMap::EXPIRY, &arg_exp);

    extractExpiry(arg_exp, &exp);
    extractCas(arg_cas, &cas);
    return true;
}

bool StorageArgs::extractValue()
{
    if (!get_string(args[1], &data, &ndata)) {
        throw Couchnode::Exception("Bad value", args[1]);
    }

    return true;
}

StorageArgs::~StorageArgs()
{
    if (stale) {
        return;
    }

    if (data) {
        delete[] data;
        data = NULL;
    }
}

MGetArgs::MGetArgs(const v8::Arguments &args, int nkparams)
    : CommonArgs(args, nkparams),
      kcount(0), single_exp(0), keys(NULL), sizes(NULL), exps(NULL)
{
}

bool MGetArgs::extractKey()
{

    if (args[0]->IsString()) {
        if (!CommonArgs::extractKey()) {
            return false;
        }

        kcount = 1;
        v8::Local<v8::Value> arg_exp;
        getParam(1, NameMap::EXPIRY, &arg_exp);

        extractExpiry(arg_exp, &single_exp);
        assert(key);

        keys = &key;
        sizes = &nkey;

        if (single_exp) {
            exps = &single_exp;
        }

        return true;
    }

    exps = NULL;

    if (!args[0]->IsArray()) {
        return false;
    }

    v8::Local<v8::Array> karry = v8::Local<v8::Array>::Cast(args[0]);
    kcount = karry->Length();

    keys = new char*[kcount];
    sizes = new size_t[kcount];

    memset(keys, 0, sizeof(char *) * kcount);
    memset(sizes, 0, sizeof(size_t) * kcount);

    for (unsigned ii = 0; ii < karry->Length(); ii++) {
        if (!get_string(karry->Get(ii), keys + ii, sizes + ii)) {
            return false;
        }
    }
    return true;
}

void MGetArgs::bailout(CouchbaseCookie *cookie, lcb_error_t err)
{
    for (unsigned ii = 0; ii < kcount; ii++) {
        cookie->result(err, keys[ii], sizes[ii]);
    }
}

MGetArgs::~MGetArgs()
{
    if (stale) {
        return;
    }

    if (exps && exps != &single_exp) {
        delete[] exps;
    }

    if (sizes && sizes != &nkey) {
        delete[] sizes;
    }

    if (keys && keys != &key) {
        for (unsigned ii = 0; ii < kcount; ii++) {
            delete[] keys[ii];
        }
        delete[] keys;
    }

    exps = NULL;
    sizes = NULL;
    keys = NULL;
}

KeyopArgs::KeyopArgs(const v8::Arguments &args)
    : CommonArgs(args, 1), cas(0)
{
}

bool KeyopArgs::parse()
{
    if (!CommonArgs::parse()) {
        return false;
    }

    v8::Local<v8::Value> arg_cas;
    getParam(1, NameMap::CAS, &arg_cas);

    extractCas(arg_cas, &cas);
    return true;
}

// arithmetic(key, delta, initial, exp, cas, ...)
ArithmeticArgs::ArithmeticArgs(const v8::Arguments &args)
    : StorageArgs(args, 1),
      delta(0), initial(0), create(false)
{
}

bool ArithmeticArgs::extractValue()
{
    if (args[1]->IsNumber() == false) {
        throw Couchnode::Exception("Delta must be numeric", args[1]);
    }

    delta = args[1]->IntegerValue();

    v8::Local<v8::Value> arg_initial;
    getParam(2, NameMap::INITIAL, &arg_initial);

    if (!arg_initial.IsEmpty()) {
        if (arg_initial->IsNumber()) {
            initial = arg_initial->IntegerValue();
            create = true;
        } else {
            if (!arg_initial->IsUndefined()) {
                throw Couchnode::Exception("Initial value must be numeric",
                                           arg_initial);
            }
            create = false;
        }

    } else {
        create = false;
    }

    return true;
}
