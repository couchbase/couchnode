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
#include "nan.h"

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

    static NAN_METHOD(New);
    static NAN_METHOD(StrError);
    static NAN_METHOD(SetHandler);

    static NAN_METHOD(GetLastError);
    static NAN_METHOD(GetMulti);
    static NAN_METHOD(GetReplicaMulti);
    static NAN_METHOD(LockMulti);
    static NAN_METHOD(SetMulti);
    static NAN_METHOD(ReplaceMulti);
    static NAN_METHOD(AddMulti);
    static NAN_METHOD(AppendMulti);
    static NAN_METHOD(PrependMulti);
    static NAN_METHOD(RemoveMulti);
    static NAN_METHOD(ArithmeticMulti);
    static NAN_METHOD(TouchMulti);
    static NAN_METHOD(UnlockMulti);
    static NAN_METHOD(ObserveMulti);
    static NAN_METHOD(EndureMulti);
    static NAN_METHOD(Stats);
    static NAN_METHOD(View);
    static NAN_METHOD(Shutdown);
    static NAN_METHOD(HttpRequest);
    static NAN_METHOD(_Control);
    static NAN_METHOD(Connect);

    // Design Doc Management
    static NAN_METHOD(GetDesignDoc);
    static NAN_METHOD(SetDesignDoc);
    static NAN_METHOD(DeleteDesignDoc);


    // Setting up the event emitter
    static NAN_METHOD(On);
    NAN_METHOD(on);

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

    typedef std::map<std::string, NanCallback* > EventMap;
    EventMap events;
    Persistent<Function> connectHandler;
    std::queue<Command *> pendingCommands;
    void setupLibcouchbaseCallbacks(void);
#ifdef COUCHNODE_DEBUG
    static unsigned int objectCount;
#endif
private:
    template <class T>
    static Handle<Value> makeOperation(_NAN_METHOD_ARGS, T&);
    bool isShutdown;
};


Handle<Value> ThrowException(const char *str);
Handle<Value> ThrowIllegalArgumentsException(void);
} // namespace Couchnode

#endif
