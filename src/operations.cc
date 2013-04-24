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

#include <cstdlib>
#include <sstream>

using namespace Couchnode;

static void getString(const v8::Handle<v8::Value> &jv, char* &str, size_t &len)
{
    // All argument checking should be done in javascript
    assert(jv->IsString());

    v8::Local<v8::String> s = jv->ToString();
    len = s->Utf8Length();
    if (len == 0) {
        str = NULL;
    } else {
        str = new char[len];
        int nw = s->WriteUtf8(str, -1, NULL, v8::String::NO_NULL_TERMINATION);
        if (nw != (int)len) {
            delete []str;
            // @todo this don't work because of the way node-gyp invokes
            //       the compiler. It seems to disable the exception
            //       exception handling.
            throw std::string("Incomplete conversion");
        }
    }
}

static void getString(const v8::Handle<v8::Value> &val, std::string &str)
{
    char *data;
    size_t len;
    getString(val, data, len);
    str.assign(data, len);
    delete []data;
}

static void getString(const v8::Handle<v8::Value> &val, std::stringstream &ss)
{
    char *data;
    size_t len;
    getString(val, data, len);
    ss.write(data, len);
    delete []data;
}

static inline bool isFalseValue(const v8::Handle<v8::Value> &v)
{
    return (v.IsEmpty() || v->BooleanValue() == false);
}

static lcb_cas_t getCas(const v8::Handle<v8::Value> &val)
{
    if (isFalseValue(val)) {
        return 0;
    } else if (val->IsObject()) {
        return Cas::GetCas(val->ToObject());
    } else {
        throw std::string("Invalid cas specified");
    }
}

void Operation::getKey(const v8::Handle<v8::Value> &val,
                       char * &key, size_t &nkey,
                       char * &hashkey, size_t &nhashkey)
{
    if (val->IsObject()) {
        v8::Local<v8::Object> dict = val->ToObject();
        getString(dict->Get(v8::String::New("key")), key, nkey);

        if (dict->Has(v8::String::New("hashkey"))) {
            getString(dict->Get(v8::String::New("hashkey")), hashkey, nhashkey);
        } else {
            hashkey = NULL;
            nhashkey = 0;
        }
    } else {
        getString(val, key, nkey);
        hashkey = NULL;
        nhashkey = 0;
    }
}

/**
 * The argument layout of the Store command is:
 *   store(operation, key, data, expiry, flags, cas, callback, cookie);
 *
 */
void StoreOperation::parse(const v8::Arguments &arguments)
{
    const int idxOp = 0;
    const int idxKey = idxOp + 1;
    const int idxValue = idxKey + 1;
    const int idxExp = idxValue + 1;
    const int idxFlags = idxExp + 1;
    const int idxCas = idxFlags + 1;
    const int idxCallback = idxCas + 1;
    const int idxCookie = idxCallback + 1;

    cmd.v.v0.operation = (lcb_storage_t)arguments[idxOp]->IntegerValue();

    char *key;
    size_t nkey;
    char *hashkey;
    size_t nhashkey;
    getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
    cmd.v.v0.key = (void*)key;
    cmd.v.v0.nkey = (lcb_uint16_t)nkey;
    cmd.v.v0.hashkey = (void*)hashkey;
    cmd.v.v0.nhashkey = (lcb_uint16_t)nhashkey;

    char *data;
    size_t len;
    getString(arguments[idxValue], data, len);
    cmd.v.v0.bytes = (void*)data;
    cmd.v.v0.nbytes = (lcb_uint32_t)len;

    cmd.v.v0.exptime = (lcb_time_t)arguments[idxExp]->IntegerValue();
    cmd.v.v0.flags = (lcb_uint32_t)arguments[idxFlags]->IntegerValue();
    cmd.v.v0.cas = getCas(arguments[idxCas]);

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}

/**
 * The argument layout of the Get command is:
 *   get(key, callback, cookie);
 * or
 *   get(keys[], callback, cookie);
 */
void GetOperation::parse(const v8::Arguments &arguments)
{
    const int idxKey = 0;
    const int idxCallback = idxKey + 1;
    const int idxCookie = idxCallback + 1;

    bool multiget = arguments[idxKey]->IsArray();
    if (multiget) {
        // argv[0] is an arry containing the keys
        v8::Local<v8::Array> keys = v8::Local<v8::Array>::Cast(arguments[idxKey]);
        numCommands = keys->Length();;
        cmds = new lcb_get_cmd_t* [numCommands];
        memset(cmds, 0, sizeof(lcb_get_cmd_t*) * numCommands);

        for (int ii = 0; ii < numCommands; ++ii) {
            lcb_get_cmd_t *cmd = new lcb_get_cmd_t();
            cmds[ii] = cmd;
            char *key;
            size_t nkey;
            char *hashkey;
            size_t nhashkey;
            getKey(keys->Get(ii), key, nkey, hashkey, nhashkey);
            cmd->v.v0.key = (void*)key;
            cmd->v.v0.nkey = (lcb_uint16_t)nkey;
            cmd->v.v0.hashkey = (void*)hashkey;
            cmd->v.v0.nhashkey = (lcb_uint16_t)nhashkey;
        }
    } else {
        numCommands = 1;
        cmds = new lcb_get_cmd_t* [numCommands];
        lcb_get_cmd_t *cmd = new lcb_get_cmd_t();
        cmds[0] = cmd;
        char *key;
        size_t nkey;
        char *hashkey;
        size_t nhashkey;
        getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
        cmd->v.v0.key = (void*)key;
        cmd->v.v0.nkey = (lcb_uint16_t)nkey;
        cmd->v.v0.hashkey = (void*)hashkey;
        cmd->v.v0.nhashkey = (lcb_uint16_t)nhashkey;
    }

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], numCommands);
}

/**
 * The argument layout of the Get and Lock command is:
 *   getAndLock(key[], exptime, callback, cookie);
 * or
 *   getAndLock(key, exptime, callback, cookie);
 *
 * Keys may be objects with optional hashkey, and exptime is an integer number
 * of seconds to lock expiry.
 */
void GetAndLockOperation::parse(const v8::Arguments &arguments)
{
    const int idxKey = 0;
    const int idxExp = idxKey + 1;
    const int idxCallback = idxExp + 1;
    const int idxCookie = idxCallback + 1;
    lcb_time_t exptime = (lcb_time_t)arguments[idxExp]->IntegerValue();
    bool multiget = arguments[idxKey]->IsArray();

    if (multiget) {
        // argv[0] is an arry containing the keys
        v8::Local<v8::Array> keys = v8::Local<v8::Array>::Cast(arguments[idxKey]);
        numCommands = keys->Length();;
        cmds = new lcb_get_cmd_t* [numCommands];
        memset(cmds, 0, sizeof(lcb_get_cmd_t*) * numCommands);

        for (int ii = 0; ii < numCommands; ++ii) {
            lcb_get_cmd_t *cmd = new lcb_get_cmd_t();
            cmds[ii] = cmd;
            char *key;
            size_t nkey;
            char *hashkey;
            size_t nhashkey;
            getKey(keys->Get(ii), key, nkey, hashkey, nhashkey);
            cmd->v.v0.key = (void*)key;
            cmd->v.v0.nkey = (lcb_uint16_t)nkey;
            cmd->v.v0.hashkey = (void*)hashkey;
            cmd->v.v0.nhashkey = (lcb_uint16_t)nhashkey;
            cmd->v.v0.lock = 1;
            cmd->v.v0.exptime = exptime;
        }
    } else {
        numCommands = 1;
        cmds = new lcb_get_cmd_t* [numCommands];
        lcb_get_cmd_t *cmd = new lcb_get_cmd_t();
        cmds[0] = cmd;
        char *key;
        size_t nkey;
        char *hashkey;
        size_t nhashkey;
        getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
        cmd->v.v0.key = (void*)key;
        cmd->v.v0.nkey = (lcb_uint16_t)nkey;
        cmd->v.v0.hashkey = (void*)hashkey;
        cmd->v.v0.nhashkey = (lcb_uint16_t)nhashkey;
        cmd->v.v0.lock = 1;
        cmd->v.v0.exptime = exptime;
    }

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], numCommands);
}

/**
 * The argument layout of the unlock command is:
 *   unlock(key, callback, cookie);
 * or
 *   unlock(key[], callback, cookie);
 *
 * Keys may be objects with optional hashkey, and exptime is an integer number
 * of seconds to lock expiry.
 */
void UnlockOperation::parse(const v8::Arguments &arguments)
{
    const int idxKey = 0;
    const int idxCallback = idxKey + 1;
    const int idxCookie = idxCallback + 1;

    // Is this on multiple keys?
    if (arguments[idxKey]->IsArray()) {
        // argv[0] is an arry containing the keys
        v8::Local<v8::Array> keys = v8::Local<v8::Array>::Cast(arguments[idxKey]);
        numCommands = keys->Length();;
        cmds = new lcb_unlock_cmd_t* [numCommands];
        memset(cmds, 0, sizeof(lcb_unlock_cmd_t*) * numCommands);

        for (int ii = 0; ii < numCommands; ++ii) {
            lcb_unlock_cmd_t *cmd = new lcb_unlock_cmd_t();
            cmds[ii] = cmd;
            char *key;
            size_t nkey;
            char *hashkey;
            size_t nhashkey;
            getKey(keys->Get(ii), key, nkey, hashkey, nhashkey);
            cmd->v.v0.key = (void*)key;
            cmd->v.v0.nkey = (lcb_uint16_t)nkey;
            cmd->v.v0.hashkey = (void*)hashkey;
            cmd->v.v0.nhashkey = (lcb_uint16_t)nhashkey;
            cmd->v.v0.cas = getCas(keys->Get(ii)->ToObject()->Get(v8::String::New("cas")));
        }
    } else {
        numCommands = 1;
        cmds = new lcb_unlock_cmd_t* [numCommands];
        lcb_unlock_cmd_t *cmd = new lcb_unlock_cmd_t();
        cmds[0] = cmd;

        char *key;
        size_t nkey;
        char *hashkey;
        size_t nhashkey;
        getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
        cmd->v.v0.key = (void*)key;
        cmd->v.v0.nkey = (lcb_uint16_t)nkey;
        cmd->v.v0.hashkey = (void*)hashkey;
        cmd->v.v0.nhashkey = (lcb_uint16_t)nhashkey;
        cmd->v.v0.cas = getCas(arguments[idxKey]->ToObject()->Get(v8::String::New("cas")));
    }

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], numCommands);
}

/**
 * The argument layout of the Touch command is:
 *   touch(key, exptime, callback, cookie);
 */
void TouchOperation::parse(const v8::Arguments &arguments)
{
    const int idxKey = 0;
    const int idxExp = idxKey + 1;
    const int idxCallback = idxExp + 1;
    const int idxCookie = idxCallback + 1;

    char *key;
    size_t nkey;
    char *hashkey;
    size_t nhashkey;
    getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
    cmd.v.v0.key = (void*)key;
    cmd.v.v0.nkey = (lcb_uint16_t)nkey;
    cmd.v.v0.hashkey = (void*)hashkey;
    cmd.v.v0.nhashkey = (lcb_uint16_t)nhashkey;
    cmd.v.v0.exptime = (lcb_time_t)arguments[idxExp]->IntegerValue();

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}

/**
 * The argument layout of the Remove command is:
 *   remove(key, cas, callback, cookie);
 */
void RemoveOperation::parse(const v8::Arguments &arguments)
{
    const int idxKey = 0;
    const int idxCas = idxKey + 1;
    const int idxCallback = idxCas + 1;
    const int idxCookie = idxCallback + 1;

    char *key;
    size_t nkey;
    char *hashkey;
    size_t nhashkey;
    getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
    cmd.v.v0.key = (void*)key;
    cmd.v.v0.nkey = (lcb_uint16_t)nkey;
    cmd.v.v0.hashkey = (void*)hashkey;
    cmd.v.v0.nhashkey = (lcb_uint16_t)nhashkey;
    cmd.v.v0.cas = getCas(arguments[idxCas]);
    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}

/**
 * The argument layout of the Observe command is:
 *   observe(key, callback, cookie);
 */
void ObserveOperation::parse(const v8::Arguments &arguments)
{
    const int idxKey = 0;
    const int idxCallback = idxKey + 1;
    const int idxCookie = idxCallback + 1;

    char *key;
    size_t nkey;
    char *hashkey;
    size_t nhashkey;
    getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
    cmd.v.v0.key = (void*)key;
    cmd.v.v0.nkey = (lcb_uint16_t)nkey;
    cmd.v.v0.hashkey = (void*)hashkey;
    cmd.v.v0.nhashkey = (lcb_uint16_t)nhashkey;

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}

/**
 * The argument layout of the aritmethic command is:
 *   arithmetic(key, delta, initial, expiry, callback, cookie);
 */
void ArithmeticOperation::parse(const v8::Arguments &arguments)
{

    const int idxKey = 0;
    const int idxDelta = idxKey + 1;
    const int idxInitial = idxDelta + 1;
    const int idxExp = idxInitial + 1;
    const int idxCallback = idxExp + 1;
    const int idxCookie = idxCallback + 1;

    char *key;
    size_t nkey;
    char *hashkey;
    size_t nhashkey;
    getKey(arguments[idxKey], key, nkey, hashkey, nhashkey);
    cmd.v.v0.key = (void*)key;
    cmd.v.v0.nkey = (lcb_uint16_t)nkey;
    cmd.v.v0.hashkey = (void*)hashkey;
    cmd.v.v0.nhashkey = (lcb_uint16_t)nhashkey;
    cmd.v.v0.delta = (lcb_int64_t)arguments[idxDelta]->IntegerValue();
    cmd.v.v0.initial = (lcb_time_t)arguments[idxInitial]->IntegerValue();
    cmd.v.v0.exptime = (lcb_time_t)arguments[idxExp]->IntegerValue();

    // @todo the user should be allowed to disable this!
    cmd.v.v0.create = 1;

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}
/**
 * The argument layout of the getDesignDoc command is:
 *   getDesignDoc(name, callback, cookie);
 */
void GetDesignDocOperation::parse(const v8::Arguments &arguments)
{

    const int idxName = 0;
    const int idxCallback = idxName + 1;
    const int idxCookie = idxCallback + 1;

    path << "/_design/";
    getString(arguments[idxName], path);
    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}

/**
 * The argument layout of the setDesignDoc command is:
 *   setDesignDoc(name, doc, callback, cookie);
 */
void SetDesignDocOperation::parse(const v8::Arguments &arguments)
{
    const int idxName = 0;
    const int idxDoc = idxName + 1;
    const int idxCallback = idxDoc + 1;
    const int idxCookie = idxCallback + 1;

    path << "/_design/";
    getString(arguments[idxName], path);
    getString(arguments[idxDoc], body);

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}

/**
 * The argument layout of the view command is:
 *   view(ddoc, req, callback, cookie);
 */
void ViewOperation::parse(const v8::Arguments &arguments)
{

    const int idxName = 0;
    const int idxReq = idxName + 1;
    const int idxCallback = idxReq + 1;
    const int idxCookie = idxCallback + 1;
    path << "/_design/";
    getString(arguments[idxName], path);
    path << "/_view/";
    getString(arguments[idxReq], path);
    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}
