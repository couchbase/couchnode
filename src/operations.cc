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

/**
 * These are simplistic functions which each take a CommonArgs object
 * and unpack it into the appropriate libcouchbase entry point.
 */

static libcouchbase_error_t doGet(libcouchbase_t instance,
                                  CommonArgs *args,
                                  CouchbaseCookie *cookie)
{
    MGetArgs *cargs = static_cast<MGetArgs *>(args);
    return libcouchbase_mget(instance, cookie, cargs->kcount,
                             (const void * const *)cargs->keys,
                             cargs->sizes,
                             cargs->exps);
}

static libcouchbase_error_t doSet(libcouchbase_t instance,
                                  CommonArgs *args,
                                  CouchbaseCookie *cookie)
{
    StorageArgs *cargs = static_cast<StorageArgs *>(args);
    return libcouchbase_store(instance, cookie, cargs->storop,
                              cargs->key, cargs->nkey,
                              cargs->data, cargs->ndata,
                              0,
                              cargs->exp,
                              cargs->cas);
}

static libcouchbase_error_t doTouch(libcouchbase_t instance,
                                    CommonArgs *args,
                                    CouchbaseCookie *cookie)
{
    MGetArgs *cargs = static_cast<MGetArgs *>(args);
    return libcouchbase_mtouch(instance, cookie, cargs->kcount,
                               (const void * const *)cargs->keys,
                               cargs->sizes,
                               cargs->exps);
}

static libcouchbase_error_t doArithmetic(libcouchbase_t instance,
                                         CommonArgs *args,
                                         CouchbaseCookie *cookie)
{
    ArithmeticArgs *cargs = static_cast<ArithmeticArgs *>(args);
    return libcouchbase_arithmetic(instance, cookie,
                                   cargs->key, cargs->nkey,
                                   cargs->delta,
                                   cargs->exp,
                                   cargs->create,
                                   cargs->initial);
}

static libcouchbase_error_t doRemove(libcouchbase_t instance,
                                     CommonArgs *args,
                                     CouchbaseCookie *cookie)
{
    KeyopArgs *cargs = static_cast<KeyopArgs *>(args);
    return libcouchbase_remove(instance, cookie, cargs->key, cargs->nkey,
                               cargs->cas);
}

/**
 * Entry point for API calls.
 */
template <class Targs>
static inline v8::Handle<v8::Value> makeOperation(Couchbase *me,
                                                  Targs *cargs,
                                                  QueuedCommand::operfunc ofn)
{
    cargs->use_dictparams = me->isUsingHashtableParams();
    try {
        if (!cargs->parse()) {
            return cargs->excerr;
        }
    } catch (Couchnode::Exception &exp) {
        return ThrowException(exp.getMessage().c_str());
    }

    CouchbaseCookie *cookie = cargs->makeCookie();

    libcouchbase_error_t err = ofn(me->getLibcouchbaseHandle(), cargs, cookie);

    if (err != LIBCOUCHBASE_SUCCESS) {
        me->setLastError(err);
        if (me->isConnected()) {
            cargs->bailout(cookie, err);
            return v8::False();
        }
        Targs *newargs = new Targs(*cargs);
        newargs->sync(*cargs);
        cargs->invalidate();
        QueuedCommand cmd(cookie, newargs, ofn);
        me->scheduleCommand(cmd);
    }

    return v8::True();
}

void Couchbase::runScheduledCommands(void)
{
    for (QueuedCommandList::iterator iter = queued_commands.begin();
            iter != queued_commands.end(); iter++) {

        libcouchbase_error_t err = iter->ofn(instance,
                                             iter->args,
                                             iter->cookie);
        if (err != LIBCOUCHBASE_SUCCESS) {
            lastError = err;
            iter->args->bailout(iter->cookie, err);
        }
        iter->setDone();
    }
    queued_commands.clear();
}

#define COUCHNODE_API_INIT_COMMON(argcls) \
    v8::HandleScope scope; \
    Couchbase *me = ObjectWrap::Unwrap<Couchbase>(args.This()); \
    argcls cargs = argcls(args); \

v8::Handle<v8::Value> Couchbase::Get(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(MGetArgs);
    return makeOperation<MGetArgs>(me, &cargs, doGet);
}

v8::Handle<v8::Value> Couchbase::Touch(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(MGetArgs);
    return makeOperation<MGetArgs>(me, &cargs, doTouch);
}

#define COUCHBASE_STOREFN_DEFINE(name, mode) \
    v8::Handle<v8::Value> Couchbase::name(const v8::Arguments& args) { \
        COUCHNODE_API_INIT_COMMON(StorageArgs); \
        cargs.storop = LIBCOUCHBASE_##mode; \
        return makeOperation<StorageArgs>(me, &cargs, doSet); \
    }

COUCHBASE_STOREFN_DEFINE(Set, SET)
COUCHBASE_STOREFN_DEFINE(Add, ADD)
COUCHBASE_STOREFN_DEFINE(Replace, REPLACE)
COUCHBASE_STOREFN_DEFINE(Append, APPEND)
COUCHBASE_STOREFN_DEFINE(Prepend, PREPEND)

v8::Handle<v8::Value> Couchbase::Arithmetic(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(ArithmeticArgs);
    return makeOperation<ArithmeticArgs>(me, &cargs, doArithmetic);
}

v8::Handle<v8::Value> Couchbase::Remove(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(KeyopArgs);
    return makeOperation<KeyopArgs>(me, &cargs, doRemove);
}
