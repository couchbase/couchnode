/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#include "couchbase_impl.h"
#include <cstdio>
#include <sstream>

using namespace Couchnode;
using namespace v8;

CouchbaseCookie::CouchbaseCookie(Handle<Value> cbo,
                                 Handle<Function> callback,
                                 Handle<Value> data,
                                 unsigned int numRemaining)
    : remaining(numRemaining),
      parent(Persistent<Value>::New(cbo)),
      ucookie(Persistent<Value>::New(data)),
      ucallback(Persistent<Function>::New(callback))
{
    if (ucookie.IsEmpty()) {
        ucookie = Persistent<Value>::New(v8::Undefined());
    }
}

CouchbaseCookie::~CouchbaseCookie()
{
    if (!parent.IsEmpty()) {
        parent.Dispose();
        parent.Clear();
    }

    if (!ucookie.IsEmpty()) {
        ucookie.Dispose();
        ucookie.Clear();
    }

    if (!ucallback.IsEmpty()) {
        ucallback.Dispose();
        ucookie.Clear();
    }
}

// (data, error, key, cas, status, from_master, ttp, ttr)
void CouchbaseCookie::result(lcb_error_t error,
                             const void *key, lcb_size_t nkey,
                             lcb_cas_t cas,
                             lcb_observe_t status,
                             int from_master,
                             lcb_time_t ttp,
                             lcb_time_t ttr)
{
    using namespace v8;
    HandleScope scope;
    Persistent<Context> context = Context::New();
    Local<Value> argv[8];

    argv[0] = Local<Value>::New(ucookie);
    if (key) {
        argv[2] = Local<Value>::New(String::New((const char *)key, nkey));
    } else {
        argv[2] = Local<Value>::New(Null());
    }

    if (error != LCB_SUCCESS) {
        argv[1] = Local<Value>::New(Number::New(error));
        argv[3] = Local<Value>::New(Undefined());
        argv[4] = Local<Value>::New(Undefined());
        argv[5] = Local<Value>::New(Undefined());
        argv[6] = Local<Value>::New(Undefined());
        argv[7] = Local<Value>::New(Undefined());
    } else {
        argv[1] = Local<Value>::New(False());
        if (key) {
            argv[3] = Local<Value>::New(Cas::CreateCas(cas));
            argv[4] = Local<Value>::New(Number::New(status));
            argv[5] = Local<Value>::New(Number::New(from_master));
            argv[6] = Local<Value>::New(Number::New(ttp));
            argv[7] = Local<Value>::New(Number::New(ttr));
        } else {
            argv[3] = Local<Value>::New(Undefined());
            argv[4] = Local<Value>::New(Undefined());
            argv[5] = Local<Value>::New(Undefined());
            argv[6] = Local<Value>::New(Undefined());
            argv[7] = Local<Value>::New(Undefined());
        }
    }

    if (key) {
        invokeProgress(context, 8, argv);
    } else {
        invoke(context, 8, argv);
    }
}

// (data, error, key, cas, flags, value)
void CouchbaseCookie::result(lcb_error_t error,
                             const void *key, lcb_size_t nkey,
                             const void *bytes,
                             lcb_size_t nbytes,
                             lcb_uint32_t flags,
                             lcb_cas_t cas)
{
    using namespace v8;
    HandleScope scope;
    Persistent<Context> context = Context::New();
    Local<Value> argv[6];

    argv[0] = Local<Value>::New(ucookie);
    argv[2] = Local<Value>::New(String::New((const char *)key, nkey));

    if (error != LCB_SUCCESS) {
        argv[1] = Local<Value>::New(Number::New(error));
        argv[3] = Local<Value>::New(Undefined());
        argv[4] = Local<Value>::New(Undefined());
        argv[5] = Local<Value>::New(Undefined());
    } else {
        argv[1] = Local<Value>::New(False());
        argv[3] = Local<Value>::New(Cas::CreateCas(cas));
        argv[4] = Local<Value>::New(Number::New(flags));
        argv[5] = Local<Value>::New(String::New((const char *)bytes, nbytes));
    }

    invoke(context, 6, argv);
}

// (data, error, key, cas)
void CouchbaseCookie::result(lcb_error_t error,
                             const void *key, lcb_size_t nkey,
                             lcb_cas_t cas)
{
    using namespace v8;
    HandleScope scope;
    Persistent<Context> context = Context::New();
    Local<Value> argv[4];

    argv[0] = Local<Value>::New(ucookie);
    argv[2] = Local<Value>::New(String::New((const char *)key, nkey));

    if (error != LCB_SUCCESS) {
        argv[1] = Local<Value>::New(Number::New(error));
        argv[3] = Local<Value>::New(Undefined());
    } else {
        argv[1] = Local<Value>::New(False());
        argv[3] = Local<Value>::New(Cas::CreateCas(cas));
    }

    invoke(context, 4, argv);
}

// (data, error, key, cas, value)
void CouchbaseCookie::result(lcb_error_t error,
                             const void *key, lcb_size_t nkey,
                             lcb_uint64_t value,
                             lcb_cas_t cas)
{
    using namespace v8;
    HandleScope scope;
    Persistent<Context> context = Context::New();
    Local<Value> argv[5];

    argv[0] = Local<Value>::New(ucookie);
    argv[2] = Local<Value>::New(String::New((const char *)key, nkey));

    if (error != LCB_SUCCESS) {
        argv[1] = Local<Value>::New(Number::New(error));
        argv[3] = Local<Value>::New(Undefined());
        argv[4] = Local<Value>::New(Undefined());
    } else {
        argv[1] = Local<Value>::New(False());
        argv[3] = Local<Value>::New(Cas::CreateCas(cas));
        argv[4] = Local<Value>::New(Number::New(value));
    }

    invoke(context, 5, argv);
}

// (data, error, key)
void CouchbaseCookie::result(lcb_error_t error,
                             const void *key, lcb_size_t nkey)
{
    using namespace v8;
    HandleScope scope;
    Persistent<Context> context = Context::New();
    Local<Value> argv[3];

    argv[0] = Local<Value>::New(ucookie);
    argv[2] = Local<Value>::New(String::New((const char *)key, nkey));

    if (error != LCB_SUCCESS) {
        argv[1] = Local<Value>::New(Number::New(error));
    } else {
        argv[1] = Local<Value>::New(False());
    }

    invoke(context, 3, argv);
}

/**
 * Used to trigger callbacks for HTTP requests
 */
void CouchbaseCookie::result(lcb_error_t error, const lcb_http_resp_t *resp)
{
    using namespace v8;
    HandleScope scope;
    Persistent<Context> context = Context::New();
    Local<Value> argv[4];

    argv[0] = Local<Value>::New(ucookie);
    if (error != LCB_SUCCESS) {
        argv[1] = Local<Value>::New(Number::New(error));
        argv[2] = Local<Value>::New(False());
        argv[3] = Local<Value>::New(False());
    } else {
        argv[1] = Local<Value>::New(False());
        argv[2] = Local<Value>::New(Number::New(resp->v.v0.status));
        argv[3] = Local<Value>::New(String::New((const char *)resp->v.v0.bytes,
                                                resp->v.v0.nbytes));
    }

    invoke(context, 4, argv);
}

static inline CouchbaseCookie *getInstance(const void *c)
{
    return reinterpret_cast<CouchbaseCookie *>(const_cast<void *>(c));
}

// @todo we need to do this a better way in the future!
static void unknownLibcouchbaseType(const std::string &type, int version)
{
    std::stringstream ss;
    ss << "Received an unsupported object version for "
       << type.c_str() << ": " << version;
    Couchnode::Exception ex(ss.str().c_str());
    throw ex;
}


extern "C" {
    // libcouchbase handlers keep a C linkage...
    static void error_callback(lcb_t instance,
                               lcb_error_t err, const char *errinfo)
    {
        void *cookie = const_cast<void *>(lcb_get_cookie(instance));
        CouchbaseImpl *me = reinterpret_cast<CouchbaseImpl *>(cookie);
        me->errorCallback(err, errinfo);
    }



    static void get_callback(lcb_t,
                             const void *cookie,
                             lcb_error_t error,
                             const lcb_get_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("get", resp->version);
        }

        getInstance(cookie)->result(error, resp->v.v0.key, resp->v.v0.nkey,
                                    resp->v.v0.bytes, resp->v.v0.nbytes,
                                    resp->v.v0.flags, resp->v.v0.cas);
    }

    static void store_callback(lcb_t,
                               const void *cookie,
                               lcb_storage_t,
                               lcb_error_t error,
                               const lcb_store_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("store", resp->version);
        }

        getInstance(cookie)->result(error, resp->v.v0.key,
                                    resp->v.v0.nkey, resp->v.v0.cas);
    }

    static void arithmetic_callback(lcb_t,
                                    const void *cookie,
                                    lcb_error_t error,
                                    const lcb_arithmetic_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("arithmetic", resp->version);
        }

        getInstance(cookie)->result(error, resp->v.v0.key, resp->v.v0.nkey,
                                    resp->v.v0.value, resp->v.v0.cas);
    }



    static void remove_callback(lcb_t,
                                const void *cookie,
                                lcb_error_t error,
                                const lcb_remove_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("remove", resp->version);
        }

        getInstance(cookie)->result(error, resp->v.v0.key, resp->v.v0.nkey,
                                    resp->v.v0.cas);

    }

    static void touch_callback(lcb_t,
                               const void *cookie,
                               lcb_error_t error,
                               const lcb_touch_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("touch", resp->version);
        }

        getInstance(cookie)->result(error, resp->v.v0.key, resp->v.v0.nkey);

    }

    static void observe_callback(lcb_t,
                                 const void *cookie,
                                 lcb_error_t error,
                                 const lcb_observe_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("observe", resp->version);
        }

        getInstance(cookie)->result(error,
                                    resp->v.v0.key, resp->v.v0.nkey,
                                    resp->v.v0.cas,
                                    resp->v.v0.status,
                                    resp->v.v0.from_master,
                                    resp->v.v0.ttp,
                                    resp->v.v0.ttr);
    }

    static void http_complete_callback(lcb_http_request_t ,
                                       lcb_t ,
                                       const void *cookie,
                                       lcb_error_t error,
                                       const lcb_http_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("http_request", resp->version);
        }

        getInstance(cookie)->result(error, resp);
    }

    static void configuration_callback(lcb_t instance,
                                       lcb_configuration_t config)
    {
        void *cookie = const_cast<void *>(lcb_get_cookie(instance));
        CouchbaseImpl *me = reinterpret_cast<CouchbaseImpl *>(cookie);
        me->onConnect(config);
    }

    static void unlock_callback(lcb_t,
                             const void *cookie,
                             lcb_error_t error,
                             const lcb_unlock_resp_t *resp)
    {
        if (resp->version != 0) {
            unknownLibcouchbaseType("unlock", resp->version);
        }

        getInstance(cookie)->result(error, resp->v.v0.key, resp->v.v0.nkey);
    }
} // extern "C"

void CouchbaseImpl::setupLibcouchbaseCallbacks(void)
{
    lcb_set_error_callback(instance, error_callback);
    lcb_set_get_callback(instance, get_callback);
    lcb_set_store_callback(instance, store_callback);
    lcb_set_arithmetic_callback(instance, arithmetic_callback);
    lcb_set_remove_callback(instance, remove_callback);
    lcb_set_touch_callback(instance, touch_callback);
    lcb_set_observe_callback(instance, observe_callback);
    lcb_set_configuration_callback(instance, configuration_callback);
    lcb_set_http_complete_callback(instance, http_complete_callback);
    lcb_set_unlock_callback(instance, unlock_callback);
}
