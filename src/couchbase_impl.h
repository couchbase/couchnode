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
#ifndef COUCHBASE_H
#define COUCHBASE_H 1

#ifdef _MSC_VER
#pragma warning(disable : 4244)
#pragma warning(disable : 4267)
#pragma warning(disable : 4506)
#pragma warning(disable : 4530)
#endif

#ifndef BUILDING_NODE_EXTENSION
#define BUILDING_NODE_EXTENSION
#endif

// Unfortunately the v8 header spits out a lot of warnings..
// let's disable them..
#if __GNUC__
#if __GNUC__ >= 4 && __GNUC_MINOR__ >= 6
#pragma GCC diagnostic ignored "-Wunused-parameter"
#endif
#endif

#include <node.h>

#if __GNUC__
#if __GNUC__ >= 4 && __GNUC_MINOR__ >= 6
#pragma GCC diagnostic pop
#endif
#endif
namespace Couchnode {
using v8::Value;
using v8::Handle;
using v8::Local;
using v8::Persistent;
using v8::Function;
using v8::HandleScope;
using v8::String;
using v8::Number;
using v8::Object;
using v8::Arguments;
};

#include <iostream>
#include <map>
#include <string>
#include <vector>
#include <queue>
#include <libcouchbase/couchbase.h>
#if LCB_VERSION < 0x020100
#error "Couchnode requires libcouchbase >= 2.1.0"
#endif

#include "cas.h"
#include "namemap.h"
#include "exception.h"
#include "cookie.h"
#include "options.h"
#include "commandlist.h"
#include "commands.h"
#include "valueformat.h"

namespace Couchnode
{

using v8::Value;
using v8::Handle;
using v8::Local;
using v8::Persistent;
using v8::Function;
using v8::HandleScope;
using v8::String;
using v8::Number;
using v8::Object;
using v8::Arguments;

// These codes *should* be in lcb_cntl, but currently aren't.
enum ControlCode {
    _BEGIN = 0x1000,
    CNTL_COUCHNODE_VERSION = 0x1001,
    CNTL_LIBCOUCHBASE_VERSION = 0x1002,
    CNTL_CLNODES = 0x1003,
    CNTL_RESTURI = 0x1004
};

class CouchbaseImpl: public node::ObjectWrap
{
public:
    CouchbaseImpl(lcb_t inst);
    virtual ~CouchbaseImpl();

    // Methods called directly from JavaScript
    static void Init(Handle<Object> target);
    static Handle<Value> New(const Arguments &args);
    static Handle<Value> StrError(const Arguments &args);
    static Handle<Value> SetHandler(const Arguments &);

    static Handle<Value> GetLastError(const Arguments &);
    static Handle<Value> GetMulti(const Arguments &);
    static Handle<Value> LockMulti(const Arguments &);
    static Handle<Value> SetMulti(const Arguments &);
    static Handle<Value> ReplaceMulti(const Arguments &);
    static Handle<Value> AddMulti(const Arguments &);
    static Handle<Value> AppendMulti(const Arguments &);
    static Handle<Value> PrependMulti(const Arguments &);
    static Handle<Value> RemoveMulti(const Arguments &);
    static Handle<Value> ArithmeticMulti(const Arguments &);
    static Handle<Value> TouchMulti(const Arguments &);
    static Handle<Value> UnlockMulti(const Arguments &);
    static Handle<Value> ObserveMulti(const Arguments &);
    static Handle<Value> EndureMulti(const Arguments &);
    static Handle<Value> Stats(const Arguments &);
    static Handle<Value> View(const Arguments &);
    static Handle<Value> Shutdown(const Arguments &);
    static Handle<Value> HttpRequest(const Arguments &);
    static Handle<Value> _Control(const Arguments &);
    static Handle<Value> Connect(const Arguments &);

    // Design Doc Management
    static Handle<Value> GetDesignDoc(const Arguments &);
    static Handle<Value> SetDesignDoc(const Arguments &);
    static Handle<Value> DeleteDesignDoc(const Arguments &);


    // Setting up the event emitter
    static Handle<Value> On(const Arguments &);
    Handle<Value> on(const Arguments &);

    // Method called from libcouchbase
    void onConfig(lcb_configuration_t config);
    void onConnect(lcb_error_t err);
    bool onTimeout(void);

    void errorCallback(lcb_error_t err, const char *errinfo);
    void runScheduledOperations(lcb_error_t err = LCB_SUCCESS);

    void shutdown(void);

    lcb_t getLibcouchbaseHandle(void) {
        return instance;
    }

    static Handle<Object> createConstants();


    bool isConnected(void) const {
        return connected;
    }

    static void dumpMemoryInfo(const std::string&);

protected:
    bool connected;
    bool useHashtableParams;
    lcb_t instance;
    lcb_error_t lastError;

    typedef std::map<std::string, Persistent<Function> > EventMap;
    EventMap events;
    Persistent<Function> connectHandler;
    std::queue<Command *> pendingCommands;
    void setupLibcouchbaseCallbacks(void);
#ifdef COUCHNODE_DEBUG
    static unsigned int objectCount;
#endif
private:
    template <class T>
    static Handle<Value> makeOperation(const Arguments&, T&);
    bool isShutdown;
};


Handle<Value> ThrowException(const char *str);
Handle<Value> ThrowIllegalArgumentsException(void);
} // namespace Couchnode

#endif
