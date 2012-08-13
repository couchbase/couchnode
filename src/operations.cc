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

#include "couchbase.h"
using namespace Couchnode;

#define COUCHNODE_API_VARS_INIT(self, argcls)     \
    argcls cargs = argcls(args);                  \
    cargs.use_dictparams = self->use_ht_params;   \
    try {                                         \
        if (!cargs.parse()) {                     \
           return cargs.excerr;                   \
        }                                         \
    } catch (Couchnode::Exception &exp) {         \
        return ThrowException(exp.getMessage().c_str());    \
    }                                             \
    CouchbaseCookie *cookie = cargs.makeCookie();

#define COUCHNODE_API_VARS_INIT_SCOPED(self, argcls) \
    v8::HandleScope scope; \
    COUCHNODE_API_VARS_INIT(self, argcls);

#define COUCHNODE_API_CLEANUP(self) \
    if (self->lastError == LIBCOUCHBASE_SUCCESS) { \
        return v8::True(); \
    } \
    delete cookie; \
    return v8::False();

v8::Handle<v8::Value> Couchbase::Get(const v8::Arguments &args)
{
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    COUCHNODE_API_VARS_INIT_SCOPED(me, MGetArgs);

    cookie->remaining = cargs.kcount;

    assert(cargs.keys);
    me->lastError = libcouchbase_mget(me->instance,
                                      cookie,
                                      cargs.kcount,
                                      (const void * const *)cargs.keys,
                                      cargs.sizes,
                                      cargs.exps);

    COUCHNODE_API_CLEANUP(me);
}

v8::Handle<v8::Value> Couchbase::Touch(const v8::Arguments &args)
{
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    COUCHNODE_API_VARS_INIT_SCOPED(me, MGetArgs);

    cookie->remaining = cargs.kcount;
    me->lastError = libcouchbase_mtouch(me->instance,
                                        cookie,
                                        cargs.kcount,
                                        (const void * const *)cargs.keys,
                                        cargs.sizes,
                                        cargs.exps);
    COUCHNODE_API_CLEANUP(me);
}

#define COUCHBASE_STOREFN_DEFINE(name, mode) \
    v8::Handle<v8::Value> Couchbase::name(const v8::Arguments& args) { \
        v8::HandleScope  scope; \
        Couchbase* me = ObjectWrap::Unwrap<Couchbase>(args.This()); \
        return me->store(args, LIBCOUCHBASE_##mode); \
    }

COUCHBASE_STOREFN_DEFINE(Set, SET)
COUCHBASE_STOREFN_DEFINE(Add, ADD)
COUCHBASE_STOREFN_DEFINE(Replace, REPLACE)
COUCHBASE_STOREFN_DEFINE(Append, APPEND)
COUCHBASE_STOREFN_DEFINE(Prepend, PREPEND)


v8::Handle<v8::Value> Couchbase::store(const v8::Arguments &args,
                                       libcouchbase_storage_t operation)
{
    COUCHNODE_API_VARS_INIT(this, StorageArgs);

    lastError = libcouchbase_store(instance,
                                   cookie,
                                   operation,
                                   cargs.key,
                                   cargs.nkey,
                                   cargs.data,
                                   cargs.ndata,
                                   0,
                                   cargs.exp,
                                   cargs.cas);

    COUCHNODE_API_CLEANUP(this);
}

v8::Handle<v8::Value> Couchbase::Arithmetic(const v8::Arguments &args)
{
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    COUCHNODE_API_VARS_INIT_SCOPED(me, ArithmeticArgs);

    me->lastError = libcouchbase_arithmetic(me->instance,
                                            cookie,
                                            cargs.key,
                                            cargs.nkey,
                                            cargs.delta,
                                            cargs.exp,
                                            cargs.create,
                                            cargs.initial);
    COUCHNODE_API_CLEANUP(me);
}

v8::Handle<v8::Value> Couchbase::Remove(const v8::Arguments &args)
{
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This());
    COUCHNODE_API_VARS_INIT_SCOPED(me, KeyopArgs);
    me->lastError = libcouchbase_remove(me->instance,
                                        cookie,
                                        cargs.key,
                                        cargs.nkey,
                                        cargs.cas);
    COUCHNODE_API_CLEANUP(me);
}
