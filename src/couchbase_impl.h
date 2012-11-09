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

#define BUILDING_NODE_EXTENSION
#include <node.h>

#include <iostream>
#include <map>
#include <string>
#include <vector>

#include <libcouchbase/couchbase.h>
#include "namemap.h"
#include "cookie.h"
#include "args.h"
#include "cas.h"

namespace Couchnode
{
    class QueuedCommand;

    class CouchbaseImpl: public node::ObjectWrap
    {
    public:
        CouchbaseImpl(lcb_t inst);
        virtual ~CouchbaseImpl();

        // Methods called directly from JavaScript
        static void Init(v8::Handle<v8::Object> target);
        static v8::Handle<v8::Value> New(const v8::Arguments &args);
        static v8::Handle<v8::Value> GetVersion(const v8::Arguments &);
        static v8::Handle<v8::Value> SetTimeout(const v8::Arguments &);
        static v8::Handle<v8::Value> GetTimeout(const v8::Arguments &);
        static v8::Handle<v8::Value> GetRestUri(const v8::Arguments &);
        static v8::Handle<v8::Value> SetSynchronous(const v8::Arguments &);
        static v8::Handle<v8::Value> IsSynchronous(const v8::Arguments &);
        static v8::Handle<v8::Value> SetHandler(const v8::Arguments &);
        static v8::Handle<v8::Value> GetLastError(const v8::Arguments &);
        static v8::Handle<v8::Value> Get(const v8::Arguments &);
        static v8::Handle<v8::Value> Set(const v8::Arguments &);
        static v8::Handle<v8::Value> Add(const v8::Arguments &);
        static v8::Handle<v8::Value> Replace(const v8::Arguments &);
        static v8::Handle<v8::Value> Append(const v8::Arguments &);
        static v8::Handle<v8::Value> Prepend(const v8::Arguments &);
        static v8::Handle<v8::Value> Arithmetic(const v8::Arguments &);
        static v8::Handle<v8::Value> Remove(const v8::Arguments &);
        static v8::Handle<v8::Value> Touch(const v8::Arguments &);
        static v8::Handle<v8::Value> OpCallStyle(const v8::Arguments &);
        // Setting up the event emitter
        static v8::Handle<v8::Value> On(const v8::Arguments &);
        v8::Handle<v8::Value> on(const v8::Arguments &);

        // Method called from libcouchbase
        void onConnect(lcb_configuration_t config);
        bool onTimeout(void);

        void errorCallback(lcb_error_t err, const char *errinfo);

        void scheduleCommand(QueuedCommand &cmd) {
            queued_commands.push_back(cmd);
        }

        void runScheduledCommands(void);

        void setLastError(lcb_error_t err) {
            lastError = err;
        }

        lcb_t getLibcouchbaseHandle(void) {
            return instance;
        }

        bool isConnected(void) const {
            return connected;
        }

        bool isUsingHashtableParams(void) const {
            return useHashtableParams;
        }
    protected:
        bool connected;
        bool useHashtableParams;
        lcb_t instance;
        lcb_error_t lastError;

        typedef std::vector<QueuedCommand> QueuedCommandList;
        QueuedCommandList queued_commands;

        typedef std::map<std::string, v8::Persistent<v8::Function> > EventMap;
        EventMap events;
        v8::Persistent<v8::Function> connectHandler;
        void setupLibcouchbaseCallbacks(void);

#ifdef COUCHNODE_DEBUG
        static unsigned int objectCount;
#endif
    };

    class QueuedCommand
    {
    public:
        typedef lcb_error_t (*operfunc)(
            lcb_t, CommonArgs *, CouchbaseCookie *);

        QueuedCommand(CouchbaseCookie *c, CommonArgs *a, operfunc f) :
            cookie(c), args(a), ofn(f) { }

        virtual ~QueuedCommand() { }

        void setDone(void) {
            delete args;
        }

        CouchbaseCookie *cookie;
        CommonArgs *args;
        operfunc ofn;
    };

    /**
     * Base class of the Exceptions thrown by the internals of
     * Couchnode
     */
    class Exception
    {
    public:
        Exception(const char *msg) : message(msg) {
            /* Empty */
        }

        Exception(const char *msg, const v8::Handle<v8::Value> &at)
            : message(msg) {
            v8::String::AsciiValue valstr(at);
            if (*valstr) {
                message += " at '";
                message += *valstr;
                message += "'";
            }
        }

        virtual ~Exception() {
            // Empty
        }

        virtual const std::string &getMessage() const {
            return message;
        }

    protected:
        std::string message;
    };

    v8::Handle<v8::Value> ThrowException(const char *str);
    v8::Handle<v8::Value> ThrowIllegalArgumentsException(void);
} // namespace Couchnode

#endif
