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
        static v8::Handle<v8::Value> Arithmetic(const v8::Arguments &);
        static v8::Handle<v8::Value> Remove(const v8::Arguments &);
        static v8::Handle<v8::Value> Touch(const v8::Arguments &);
        // Setting up the event emitter
        static v8::Handle<v8::Value> On(const v8::Arguments &);
        v8::Handle<v8::Value> on(const v8::Arguments &);

        // Method called from libcouchbase
        void onConnect(libcouchbase_configuration_t config);
        bool onTimeout();

        void errorCallback(libcouchbase_error_t err, const char *errinfo);

        v8::Handle<v8::Value> store(const v8::Arguments &,
                                    libcouchbase_storage_t operation);

    protected:
        libcouchbase_t instance;
        libcouchbase_error_t lastError;

        typedef std::map<std::string, v8::Persistent<v8::Function> > EventMap;
        EventMap events;
        v8::Persistent<v8::Function> connectHandler;
        void setupLibcouchbaseCallbacks(void);
    };

    class CouchbaseCookie
    {

    public:
        CouchbaseCookie(v8::Handle<v8::Value> cbo,
                        v8::Handle<v8::Function> callback,
                        v8::Handle<v8::Value> data);
        enum {
            VTYPE_NONE = 0,
            VTYPE_STRING,
            VTYPE_INT64
        };

        virtual ~CouchbaseCookie();

        void gotResult(const void *key,
                       size_t nkey,
                       libcouchbase_error_t err,
                       int nextra = 0,

                       uint64_t cas = 0,
                       int vtype = VTYPE_NONE,
                       const void *value = NULL,
                       size_t nvalue = 0);

        unsigned remaining;

    private:
        v8::Persistent<v8::Value> parent;
        v8::Persistent<v8::Value> ucookie;
        v8::Persistent<v8::Function> ucallback;
    };

    class CommonArgs
    {
    public:

        CommonArgs(const v8::Arguments &,
                   v8::Handle<v8::Value> &,
                   int ixud,
                   bool do_extract_key = true);

        CouchbaseCookie *makeCookie();
        virtual ~CommonArgs();

        virtual bool extractKey(int ix);

        bool extractUdata(int ix);

        const v8::Arguments &args;
        v8::Handle<v8::Value> &excerr;
        v8::Local<v8::Function> ucb;
        v8::Local<v8::Value> udata;

        char *key;
        size_t nkey;
    };

    class StorageArgs : public CommonArgs
    {
    public:

        StorageArgs(const v8::Arguments &, v8::Handle<v8::Value> &,
                    int expix = 2, bool do_extract_value = true);

        virtual bool extractValue();
        virtual ~StorageArgs();

        char *data;
        size_t ndata;
        uint32_t exp;
        uint64_t cas;
    };

    class MGetArgs : public CommonArgs
    {
    public:
        MGetArgs(const v8::Arguments &, v8::Handle<v8::Value> &);
        virtual ~MGetArgs();

        size_t kcount;

        char **keys;
        size_t *sizes;
        time_t *exps;

        virtual bool extractKey(int pos);
    };

    class KeyopArgs : public CommonArgs
    {

    public:

        KeyopArgs(const v8::Arguments &, v8::Handle<v8::Value> &);
        uint64_t cas;
    };

    class ArithmeticArgs : public StorageArgs
    {
    public:
        ArithmeticArgs(const v8::Arguments &, v8::Handle<v8::Value> &);

        virtual bool extractValue();

        int64_t delta;
        uint64_t initial;
        bool create;
    };

} // namespace Couchnode

#endif
