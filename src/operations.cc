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
using namespace Couchnode;

/**
 * These are simplistic functions which each take a CommonArgs object
 * and unpack it into the appropriate libcouchbase entry point.
 */

static lcb_error_t doGet(lcb_t instance,
                         CommonArgs *args,
                         CouchbaseCookie *cookie)
{
    MGetArgs *cargs = static_cast<MGetArgs *>(args);

    // @todo move this over to the MGetArgs structs
    lcb_get_cmd_t **commands = new lcb_get_cmd_t*[cargs->kcount];
    for (size_t ii = 0; ii < cargs->kcount; ++ii) {
        if (cargs->exps == NULL) {
            commands[ii] = new lcb_get_cmd_t(cargs->keys[ii],
                                             cargs->sizes[ii]);
        } else {
            // @todo how do the single thing work?
            commands[ii] = new lcb_get_cmd_t(cargs->keys[ii],
                                             cargs->sizes[ii],
                                             cargs->exps[ii]);
        }
    }

    lcb_error_t ret = lcb_get(instance, cookie, cargs->kcount, commands);
    for (size_t ii = 0; ii < cargs->kcount; ++ii) {
        delete commands[ii];
    }
    delete []commands;

    return ret;
}

static lcb_error_t doSet(lcb_t instance,
                         CommonArgs *args,
                         CouchbaseCookie *cookie)
{
    StorageArgs *cargs = static_cast<StorageArgs *>(args);

    lcb_store_cmd_t cmd(cargs->storop, cargs->key, cargs->nkey,
                        cargs->data, cargs->ndata, 0, cargs->exp,
                        cargs->cas);
    lcb_store_cmd_t *commands[] = { &cmd };
    return lcb_store(instance, cookie, 1, commands);
}

static lcb_error_t doTouch(lcb_t instance,
                           CommonArgs *args,
                           CouchbaseCookie *cookie)
{
    MGetArgs *cargs = static_cast<MGetArgs *>(args);


    // @todo move this over to the MGetArgs structs
    lcb_touch_cmd_t **commands = new lcb_touch_cmd_t*[cargs->kcount];
    for (size_t ii = 0; ii < cargs->kcount; ++ii) {
        if (cargs->exps == NULL) {
            commands[ii] = new lcb_touch_cmd_t(cargs->keys[ii],
                                               cargs->sizes[ii]);
        } else {
            // @todo how do the single thing work?
            commands[ii] = new lcb_touch_cmd_t(cargs->keys[ii],
                                               cargs->sizes[ii],
                                               cargs->exps[ii]);
        }
    }

    lcb_error_t ret = lcb_touch(instance, cookie, cargs->kcount, commands);
    for (size_t ii = 0; ii < cargs->kcount; ++ii) {
        delete commands[ii];
    }
    delete []commands;

    return ret;
}

static lcb_error_t doObserve(lcb_t instance,
                             CommonArgs *args,
                             CouchbaseCookie *cookie)
{
    lcb_observe_cmd_t cmd(args->key, args->nkey);
    lcb_observe_cmd_t *commands[] = { &cmd };
    return lcb_observe(instance, cookie, 1, commands);
}

static lcb_error_t doArithmetic(lcb_t instance,
                                CommonArgs *args,
                                CouchbaseCookie *cookie)
{
    ArithmeticArgs *cargs = static_cast<ArithmeticArgs *>(args);
    lcb_arithmetic_cmd_t cmd(cargs->key, cargs->nkey, cargs->delta,
                             cargs->create, cargs->initial, cargs->exp);
    lcb_arithmetic_cmd_t *commands[] = { &cmd };
    return lcb_arithmetic(instance, cookie, 1, commands);
}

static lcb_error_t doRemove(lcb_t instance,
                            CommonArgs *args,
                            CouchbaseCookie *cookie)
{
    KeyopArgs *cargs = static_cast<KeyopArgs *>(args);
    lcb_remove_cmd_t cmd(cargs->key, cargs->nkey, cargs->cas);
    lcb_remove_cmd_t *commands[] = { &cmd };
    return lcb_remove(instance, cookie, 1, commands);
}

/**
 * Entry point for API calls.
 */
template <class Targs>
static inline v8::Handle<v8::Value> makeOperation(CouchbaseImpl *me,
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

    lcb_error_t err = ofn(me->getLibcouchbaseHandle(), cargs, cookie);

    if (err != LCB_SUCCESS) {
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

void CouchbaseImpl::runScheduledCommands(void)
{
    for (QueuedCommandList::iterator iter = queued_commands.begin();
            iter != queued_commands.end(); iter++) {

        lcb_error_t err = iter->ofn(instance, iter->args, iter->cookie);
        if (err != LCB_SUCCESS) {
            lastError = err;
            iter->args->bailout(iter->cookie, err);
        }
        iter->setDone();
    }
    queued_commands.clear();
}

#define COUCHNODE_API_INIT_COMMON(argcls) \
    v8::HandleScope scope; \
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(args.This()); \
    argcls cargs = argcls(args);

v8::Handle<v8::Value> CouchbaseImpl::Get(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(MGetArgs);
    return makeOperation<MGetArgs>(me, &cargs, doGet);
}

v8::Handle<v8::Value> CouchbaseImpl::Touch(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(MGetArgs);
    return makeOperation<MGetArgs>(me, &cargs, doTouch);
}

v8::Handle<v8::Value> CouchbaseImpl::Observe(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(MGetArgs);
    return makeOperation<MGetArgs>(me, &cargs, doObserve);
}

#define COUCHBASE_STOREFN_DEFINE(name, mode) \
    v8::Handle<v8::Value> CouchbaseImpl::name(const v8::Arguments& args) { \
        COUCHNODE_API_INIT_COMMON(StorageArgs); \
        cargs.storop = LCB_##mode; \
        return makeOperation<StorageArgs>(me, &cargs, doSet); \
    }

COUCHBASE_STOREFN_DEFINE(Set, SET)
COUCHBASE_STOREFN_DEFINE(Add, ADD)
COUCHBASE_STOREFN_DEFINE(Replace, REPLACE)
COUCHBASE_STOREFN_DEFINE(Append, APPEND)
COUCHBASE_STOREFN_DEFINE(Prepend, PREPEND)

v8::Handle<v8::Value> CouchbaseImpl::Arithmetic(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(ArithmeticArgs);
    return makeOperation<ArithmeticArgs>(me, &cargs, doArithmetic);
}

v8::Handle<v8::Value> CouchbaseImpl::Remove(const v8::Arguments &args)
{
    COUCHNODE_API_INIT_COMMON(KeyopArgs);
    return makeOperation<KeyopArgs>(me, &cargs, doRemove);
}
