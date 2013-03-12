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

#include <iostream>
#include <map>
#include <string>
#include <vector>

#include <libcouchbase/couchbase.h>
#include "namemap.h"
#include "cookie.h"
#include "operations.h"
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
        static v8::Handle<v8::Value> StrError(const v8::Arguments &args);
        static v8::Handle<v8::Value> GetVersion(const v8::Arguments &);
        static v8::Handle<v8::Value> SetTimeout(const v8::Arguments &);
        static v8::Handle<v8::Value> GetTimeout(const v8::Arguments &);
        static v8::Handle<v8::Value> GetRestUri(const v8::Arguments &);
        static v8::Handle<v8::Value> SetSynchronous(const v8::Arguments &);
        static v8::Handle<v8::Value> IsSynchronous(const v8::Arguments &);
        static v8::Handle<v8::Value> SetHandler(const v8::Arguments &);
        static v8::Handle<v8::Value> GetLastError(const v8::Arguments &);
        static v8::Handle<v8::Value> Get(const v8::Arguments &);
        static v8::Handle<v8::Value> GetAndLock(const v8::Arguments &);
        static v8::Handle<v8::Value> Unlock(const v8::Arguments &);
        static v8::Handle<v8::Value> Store(const v8::Arguments &);
        static v8::Handle<v8::Value> Arithmetic(const v8::Arguments &);
        static v8::Handle<v8::Value> Remove(const v8::Arguments &);
        static v8::Handle<v8::Value> Touch(const v8::Arguments &);
        static v8::Handle<v8::Value> Observe(const v8::Arguments &);
        static v8::Handle<v8::Value> View(const v8::Arguments &);
        static v8::Handle<v8::Value> Shutdown(const v8::Arguments &);

        // Design Doc Management
        static v8::Handle<v8::Value> GetDesignDoc(const v8::Arguments &);
        static v8::Handle<v8::Value> SetDesignDoc(const v8::Arguments &);
        static v8::Handle<v8::Value> DeleteDesignDoc(const v8::Arguments &);


        // Setting up the event emitter
        static v8::Handle<v8::Value> On(const v8::Arguments &);
        v8::Handle<v8::Value> on(const v8::Arguments &);

        // Method called from libcouchbase
        void onConnect(lcb_configuration_t config);
        bool onTimeout(void);

        void errorCallback(lcb_error_t err, const char *errinfo);

        void scheduleOperation(Operation *op) {
            queuedOperations.push_back(op);
        }

        void runScheduledOperations(void);

        void setLastError(lcb_error_t err) {
            lastError = err;
        }

        void shutdown(void);

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

        // @todo why not use a std::queue?
        typedef std::vector<Operation*> QueuedOperationList;
        QueuedOperationList queuedOperations;

        typedef std::map<std::string, v8::Persistent<v8::Function> > EventMap;
        EventMap events;
        v8::Persistent<v8::Function> connectHandler;
        void setupLibcouchbaseCallbacks(void);

#ifdef COUCHNODE_DEBUG
        static unsigned int objectCount;
#endif
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
