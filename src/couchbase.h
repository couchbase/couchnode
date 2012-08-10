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

#define BUILDING_NODE_EXTENSION
#include <node.h>

#include <iostream>
#include <map>
#include <string>

#include <libcouchbase/couchbase.h>

namespace Couchnode
{

    class Couchbase: public node::ObjectWrap
    {
    public:
        Couchbase(libcouchbase_t inst);

        virtual ~Couchbase();

        // Methods called directly from JavaScript

        static void Init(v8::Handle<v8::Object> target);
        static v8::Handle<v8::Value> New(const v8::Arguments &args);
        static v8::Handle<v8::Value> GetVersion(const v8::Arguments &);
        static v8::Handle<v8::Value> SetTimeout(const v8::Arguments &);
        static v8::Handle<v8::Value> GetTimeout(const v8::Arguments &);
        static v8::Handle<v8::Value> GetRestUri(const v8::Arguments &);
        static v8::Handle<v8::Value> SetSynchronous(const v8::Arguments &);
        static v8::Handle<v8::Value> IsSynchronous(const v8::Arguments &);
        static v8::Handle<v8::Value> Connect(const v8::Arguments &);
        static v8::Handle<v8::Value> SetHandler(const v8::Arguments &);
        static v8::Handle<v8::Value> GetLastError(const v8::Arguments &);
        static v8::Handle<v8::Value> Get(const v8::Arguments &);
        static v8::Handle<v8::Value> Set(const v8::Arguments &);
        static v8::Handle<v8::Value> Add(const v8::Arguments &);
        static v8::Handle<v8::Value> Replace(const v8::Arguments &);
        static v8::Handle<v8::Value> Append(const v8::Arguments &);
        static v8::Handle<v8::Value> Prepend(const v8::Arguments &);
        static v8::Handle<v8::Value> Wait(const v8::Arguments &);


        // Setting up the event emitter
        static v8::Handle<v8::Value> On(const v8::Arguments &);
        v8::Handle<v8::Value> on(const v8::Arguments &);



        // Method called from libcouchbase
        void onConnect(libcouchbase_configuration_t config);
        bool onTimeout();


        void errorCallback(libcouchbase_error_t err, const char *errinfo);
        void getCallback(const void *commandCookie, libcouchbase_error_t error,
                         const void *key, libcouchbase_size_t nkey,
                         const void *bytes, libcouchbase_size_t nbytes,
                         libcouchbase_uint32_t flags, libcouchbase_cas_t cas);
        void storageCallback(const void *commandCookie,
                             libcouchbase_storage_t operation,
                             libcouchbase_error_t error,
                             const void *key, libcouchbase_size_t nkey,
                             libcouchbase_cas_t cas);

        v8::Handle<v8::Value> store(const v8::Arguments &,
                                    libcouchbase_storage_t operation);

    protected:
        libcouchbase_t instance;
        libcouchbase_error_t lastError;


        typedef std::map<std::string, v8::Persistent<v8::Function> > EventMap;

        EventMap events;
    };

} // namespace Couchnode

#endif
