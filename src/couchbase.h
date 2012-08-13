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
#include "namemap.h"


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
        static v8::Handle<v8::Value> OpCallStyle(const v8::Arguments &);
        // Setting up the event emitter
        static v8::Handle<v8::Value> On(const v8::Arguments &);
        v8::Handle<v8::Value> on(const v8::Arguments &);

        // Method called from libcouchbase
        void onConnect(libcouchbase_configuration_t config);
        bool onTimeout();

        void errorCallback(libcouchbase_error_t err, const char *errinfo);

        v8::Handle<v8::Value> store(const v8::Arguments &,
                                    libcouchbase_storage_t operation);

        bool use_ht_params;

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
        virtual ~CouchbaseCookie();

        void result(libcouchbase_error_t error,
                    const void *key, libcouchbase_size_t nkey,
                    const void *bytes,
                    libcouchbase_size_t nbytes,
                    libcouchbase_uint32_t flags,
                    libcouchbase_cas_t cas);

        void result(libcouchbase_error_t error,
                    const void *key, libcouchbase_size_t nkey,
                    libcouchbase_cas_t cas);

        void result(libcouchbase_error_t error,
                    const void *key, libcouchbase_size_t nkey,
                    libcouchbase_uint64_t value,
                    libcouchbase_cas_t cas);

        void result(libcouchbase_error_t error,
                    const void *key, libcouchbase_size_t nkey);

        unsigned int remaining;

    protected:
        void invoke(v8::Persistent<v8::Context> &context, int argc,
                    v8::Local<v8::Value> *argv) {
            // Now, invoke the callback with the appropriate arguments
            ucallback->Call(v8::Context::GetEntered()->Global(), argc , argv);
            context.Dispose();
            if (--remaining == 0) {
                delete this;
            }
        }

    private:
        v8::Persistent<v8::Value> parent;
        v8::Persistent<v8::Value> ucookie;
        v8::Persistent<v8::Function> ucallback;
    };

    class CommonArgs
    {
    public:

        CommonArgs(const v8::Arguments &, int pmax = 0, int reqmax = 0);

        virtual bool parse();

        CouchbaseCookie *makeCookie();
        virtual ~CommonArgs();

        virtual bool extractKey();

        bool extractUdata();

        enum {
            AP_OK,
            AP_ERROR,
            AP_DONTUSE
        };
        int extractExpiry(const v8::Handle<v8::Value> &, time_t *);
        int extractCas(const v8::Handle<v8::Value> &, libcouchbase_cas_t *);

        inline void getParam(int aix, int dcix, v8::Handle<v8::Value> *vp) {
            if (use_dictparams) {
                if (dict.IsEmpty() == false) {
                    *vp = dict->Get(NameMap::names[dcix]);
                }
            } else if (args.Length() >= aix - 1) {
                *vp = args[aix];
            }
        }

        const v8::Arguments &args;
        v8::Handle<v8::Value> excerr;
        v8::Local<v8::Function> ucb;
        v8::Local<v8::Value> udata;

        char *key;
        size_t nkey;

        // last index for operation-specific parameters, this is the length
        // of all arguments minus the key (at the beginning) and callback data
        // (at the end)
        int params_max;
        int required_max;
        bool use_dictparams;
        v8::Local<v8::Object> dict;
    };

    class StorageArgs : public CommonArgs
    {
    public:

        StorageArgs(const v8::Arguments &, int nvparams = 0);
        virtual bool parse();

        virtual bool extractValue();
        virtual ~StorageArgs();

        char *data;
        size_t ndata;
        time_t exp;
        uint64_t cas;
    };

    class MGetArgs : public CommonArgs
    {
    public:
        MGetArgs(const v8::Arguments &, int nkparams = 1);
        virtual ~MGetArgs();

        size_t kcount;
        time_t single_exp;

        char **keys;
        size_t *sizes;
        time_t *exps;

        virtual bool extractKey();
    };

    class KeyopArgs : public CommonArgs
    {

    public:

        KeyopArgs(const v8::Arguments &);
        virtual bool parse();
        uint64_t cas;
    };

    class ArithmeticArgs : public StorageArgs
    {
    public:
        ArithmeticArgs(const v8::Arguments &);

        virtual bool extractValue();

        int64_t delta;
        uint64_t initial;
        bool create;
    };

    /**
     * Base class of the Exceptions thrown by the internals of
     * Couchnode
     */
    class Exception {
    public:
        Exception(const char *msg) : message(msg) {
            /* Empty */
        }

        Exception(const char *msg, const v8::Handle<v8::Value> &at)
        : message (msg) {
            char *valstr = *(v8::String::AsciiValue(at));
            if (valstr) {
                message += "at '";
                message += valstr;
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
