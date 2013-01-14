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
    if (!jv->IsString()) {
        throw std::string("Not a string");
    }

    v8::Local<v8::String> s = jv->ToString();
    len = s->Utf8Length();
    if (len == 0) {
        str = NULL;
    } else {
        str = new char[len];
        int nw = s->WriteUtf8(str, -1, NULL, v8::String::NO_NULL_TERMINATION);
        if (nw != (int)len) {
            delete []str;
            throw std::string("Incomplete conversion");
        }
    }
}

static int getInteger(const v8::Handle<v8::Value> &val)
{
    if (!val->IsNumber()) {
        throw std::string("Not a number");
    }

    return val->IntegerValue();
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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() != idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to store()." << std::endl
           << "  usage: store(type, key, data, expiry, flags, cas, "
           << "callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        cmd.v.v0.operation = (lcb_storage_t)getInteger(arguments[idxOp]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as parameter #" << idxOp
           << " to store(). Expected a number";
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxKey], data, len);
        cmd.v.v0.key = (void*)data;
        cmd.v.v0.nkey = (lcb_uint16_t)len;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse key argument (#" << idxKey << ") to store: "
           << ex;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxValue], data, len);
        cmd.v.v0.bytes = (void*)data;
        cmd.v.v0.nbytes = (lcb_uint16_t)len;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse value argument (# " << idxValue
           << ")to store: " << ex;
        throw ss.str();
    }

    try {
        cmd.v.v0.exptime = (lcb_time_t)getInteger(arguments[idxExp]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as expiry parameter (#" << idxExp
           << "). Expected a number";
        throw ss.str();
    }

    try {
        cmd.v.v0.flags = (lcb_uint32_t)getInteger(arguments[idxFlags]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as flags parameter (#" << idxFlags
           << "). Expected a number";
        throw ss.str();
    }

    try {
        cmd.v.v0.cas = getCas(arguments[idxCas]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as cas parameter (#" << idxCas
           << "): " << ex;
        throw ss.str();
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#" << idxCallback
           << "). Expected a function";
        throw ss.str();
    }

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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to get()." << std::endl
           << "  usage: get(key, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

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
            try {
                char *data;
                size_t len;
                getString(keys->Get(ii), data, len);
                cmd->v.v0.key = (void*)data;
                cmd->v.v0.nkey = (lcb_uint16_t)len;
            } catch (std::string &ex) {
                std::stringstream ss;
                ss << "Failed to parse key #" << ii << ": " << ex;
                throw ss.str();
            }
        }
    } else {
        numCommands = 1;
        cmds = new lcb_get_cmd_t* [numCommands];
        lcb_get_cmd_t *cmd = new lcb_get_cmd_t();
        cmds[0] = cmd;

        try {
            char *data;
            size_t len;
            getString(arguments[idxKey], data, len);
            cmd->v.v0.key = (void*)data;
            cmd->v.v0.nkey = (lcb_uint16_t)len;
        } catch (std::string &ex) {
            std::stringstream ss;
            ss << "Failed to parse key argument (#" << idxKey << ") to get: "
               << ex;
            throw ss.str();
        }
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to touch()." << std::endl
           << "  usage: touch(key, exptime, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxKey], data, len);
        cmd.v.v0.key = (void*)data;
        cmd.v.v0.nkey = (lcb_uint16_t)len;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse key argument (#" << idxKey << ") to get: "
           << ex;
        throw ss.str();
    }

    try {
        cmd.v.v0.exptime = (lcb_time_t)getInteger(arguments[idxExp]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as expiry parameter (#" << idxExp
           << "). Expected a number";
        throw ss.str();
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to remove()." << std::endl
           << "  usage: remove(key, cas, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxKey], data, len);
        cmd.v.v0.key = (void*)data;
        cmd.v.v0.nkey = (lcb_uint16_t)len;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse key argument (#" << idxKey << ") to get: "
           << ex;
        throw ss.str();
    }

    try {
        cmd.v.v0.cas = getCas(arguments[idxCas]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as cas parameter (#" << idxCas
           << "): " << ex;
        throw ss.str();
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to observe()." << std::endl
           << "  usage: observe(key, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxKey], data, len);
        cmd.v.v0.key = (void*)data;
        cmd.v.v0.nkey = (lcb_uint16_t)len;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse key argument (#" << idxKey << "): "
           << ex;
        throw ss.str();
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to arithmetic()."
           << std::endl
           << "  usage: arithmetic(key, delta, initial, expiry, "
           << "callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxKey], data, len);
        cmd.v.v0.key = (void*)data;
        cmd.v.v0.nkey = (lcb_uint16_t)len;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse key argument (#" << idxKey << ") to get: "
           << ex;
        throw ss.str();
    }

    try {
        cmd.v.v0.delta = (lcb_int64_t)getInteger(arguments[idxDelta]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as delta parameter (#" << idxExp
           << "). Expected a number";
        throw ss.str();
    }

    try {
        cmd.v.v0.initial = (lcb_time_t)getInteger(arguments[idxInitial]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as initial parameter (#" << idxExp
           << "). Expected a number";
        throw ss.str();
    }

    try {
        cmd.v.v0.exptime = (lcb_time_t)getInteger(arguments[idxExp]);
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as expiry parameter (#" << idxExp
           << "). Expected a number";
        throw ss.str();
    }

    // @todo the user should be allowed to disable this!
    cmd.v.v0.create = 1;

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to getDesignDoc()."
           << std::endl
           << "  usage: getDesignDoc(name, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxName], data, len);
        char *path = new char[len + 10];
        memcpy(path, "/_design/", 9);
        memcpy(path + 9, data, len);
        len += 9;
        cmd.v.v0.path = path;
        cmd.v.v0.npath = len;
        cmd.v.v0.method = LCB_HTTP_METHOD_GET;
        cmd.v.v0.content_type = "application/json";
        delete []data;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse name argument (#" << idxName << "): "
           << ex;
        throw ss.str();
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to setDesignDoc()."
           << std::endl
           << "  usage: setDesignDoc(name, doc, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxName], data, len);
        char *path = new char[len + 10];
        memcpy(path, "/_design/", 9);
        memcpy(path + 9, data, len);
        len += 9;
        cmd.v.v0.path = path;
        cmd.v.v0.npath = len;
        cmd.v.v0.method = LCB_HTTP_METHOD_PUT;
        cmd.v.v0.content_type = "application/json";
        delete []data;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse name argument (#" << idxName << "): "
           << ex;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxDoc], data, len);
        cmd.v.v0.body = data;
        cmd.v.v0.nbody = len;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse doc argument (#" << idxDoc << "): "
           << ex;
        throw ss.str();
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}

/**
 * The argument layout of the deleteDesignDoc command is:
 *   deleteDesignDoc(name, callback, cookie);
 */
void DeleteDesignDocOperation::parse(const v8::Arguments &arguments)
{

    const int idxName = 0;
    const int idxCallback = idxName + 1;
    const int idxCookie = idxCallback + 1;
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to deleteDesignDoc()."
           << std::endl
           << "  usage: deleteDesignDoc(name, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    try {
        char *data;
        size_t len;
        getString(arguments[idxName], data, len);
        char *path = new char[len + 10];
        memcpy(path, "/_design/", 9);
        memcpy(path + 9, data, len);
        len += 9;
        cmd.v.v0.path = path;
        cmd.v.v0.npath = len;
        cmd.v.v0.method = LCB_HTTP_METHOD_DELETE;
        cmd.v.v0.content_type = "application/json";
        delete []data;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse name argument (#" << idxName << "): "
           << ex;
        throw ss.str();
    }

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

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
    const int idxLast = idxCookie + 1;

    if (arguments.Length() < idxLast) {
        std::stringstream ss;
        ss << "Incorrect number of arguments passed to view()."
           << std::endl
           << "  usage: deleteDesignDoc(name, callback, cookie)" << std::endl
           << "  Expected " << idxLast << "arguments, got: "
           << arguments.Length() << std::endl;
        throw ss.str();
    }

    std::stringstream ss;
    ss << "/_design/";

    try {
        char *data;
        size_t len;
        getString(arguments[idxName], data, len);
        ss.write(data, len);
        delete []data;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse name argument (#" << idxName << "): "
           << ex;
        throw ss.str();
    }

    ss << "/_view/";
    try {
        char *data;
        size_t len;
        getString(arguments[idxReq], data, len);
        ss.write(data, len);
        delete []data;
    } catch (std::string &ex) {
        std::stringstream ss;
        ss << "Failed to parse name argument (#" << idxReq << "): "
           << ex;
        throw ss.str();
    }

    cmd.v.v0.path = strdup(ss.str().c_str());
    cmd.v.v0.npath = ss.str().length();
    cmd.v.v0.method = LCB_HTTP_METHOD_GET;
    cmd.v.v0.content_type = "application/json";

    // callback function to follow
    if (!arguments[idxCallback]->IsFunction()) {
        std::stringstream ss;
        ss << "Incorrect parameter passed as callback parameter (#"
           << idxCallback << "). Expected a function";
        throw ss.str();
    }

    cookie = new CouchbaseCookie(arguments.This(),
                                 v8::Local<v8::Function>::Cast(arguments[idxCallback]),
                                 arguments[idxCookie], 1);
}
