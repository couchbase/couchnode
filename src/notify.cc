#include "couchbase.h"
#include <cstdio>

using namespace Couchnode;
using namespace v8;

CouchbaseCookie::CouchbaseCookie(Handle<Value> cbo,
                                 Handle<Function> callback,
                                 Handle<Value> data)
    : remaining(1),
      parent(Persistent<Value>::New(cbo)),
      ucookie(Persistent<Value>::New(data)),
      ucallback(Persistent<Function>::New(callback))
{
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

// Callbacks:
// (data, error, key, cas, [ value ])
void CouchbaseCookie::gotResult(const void *key,
                                size_t nkey,
                                libcouchbase_error_t err,
                                int nextra,
                                uint64_t cas,
                                int vtype,
                                const void *value, size_t nvalue)
{
    using namespace v8;
    HandleScope scope;
    Persistent<Context> context = Context::New();

    int argc = nextra + 3;
    assert(argc <= 5);
    Local<Value> argv[5];

    argv[0] = Local<Value>::New(ucookie);

    if (err != LIBCOUCHBASE_SUCCESS) {
        argv[1] = Local<Value>::New(Number::New(err));
    } else {
        argv[1] = Local<Value>::New(False());
    }

    argv[2] = Local<Value>::New(String::New((const char *)key, nkey));

    if (!nextra) {
        goto GT_INVOKE;
    }

    if (err != LIBCOUCHBASE_SUCCESS) {
        argv[3] = Local<Value>::New(False());
    } else {
        argv[3] = Local<Value>::New(Number::New(cas));
    }

    if (nextra < 2) {
        goto GT_INVOKE;
    }

    if (err == LIBCOUCHBASE_SUCCESS) {
        if (vtype == VTYPE_STRING) {
            argv[4] = Local<Value>::New(String::New((const char *)value,
                                                    nvalue));
        } else {
            argv[4] = Local<Value>::New(Number::New(*(uint64_t *)value));
        }
    } else {
        argv[4] = Local<Value>::New(Undefined());
    }


GT_INVOKE:
    assert(!ucallback.IsEmpty());
    assert(ucallback->IsFunction());
    // Now, invoke the callback with the appropriate arguments
    ucallback->Call(v8::Context::GetEntered()->Global(), argc , argv);

    if (!(--remaining)) {
        delete this;
    }
    context.Dispose();
}

static inline CouchbaseCookie *getInstance(const void *c)
{
    return reinterpret_cast<CouchbaseCookie *>(const_cast<void *>(c));
}

extern "C" {
    // libcouchbase handlers keep a C linkage...
    static void error_callback(libcouchbase_t instance,
                               libcouchbase_error_t err, const char *errinfo)
    {
        void *cookie = const_cast<void *>(libcouchbase_get_cookie(instance));
        Couchbase *me = reinterpret_cast<Couchbase *>(cookie);
        me->errorCallback(err, errinfo);
    }

    static void get_callback(libcouchbase_t,
                             const void *commandCookie,
                             libcouchbase_error_t error,
                             const void *key, libcouchbase_size_t nkey,
                             const void *bytes,
                             libcouchbase_size_t nbytes,
                             libcouchbase_uint32_t flags,
                             libcouchbase_cas_t cas)
    {
        getInstance(commandCookie)->gotResult(key, nkey, error, 2, cas,
                                              CouchbaseCookie::VTYPE_STRING,
                                              bytes, nbytes);
    }

    static void storage_callback(libcouchbase_t,
                                 const void *commandCookie,
                                 libcouchbase_storage_t operation,
                                 libcouchbase_error_t error, const void *key,
                                 libcouchbase_size_t nkey,
                                 libcouchbase_cas_t cas)
    {
        getInstance(commandCookie)->gotResult(key, nkey, error, 1, cas);
    }

    static void arithmetic_callback(libcouchbase_t,
                                    const void *commandCookie,
                                    libcouchbase_error_t error,
                                    const void *key, libcouchbase_size_t nkey,
                                    libcouchbase_uint64_t value,
                                    libcouchbase_cas_t cas)
    {
        getInstance(commandCookie)->gotResult(key, nkey, error, 2, cas,
                                              CouchbaseCookie::VTYPE_INT64,
                                              &value, 0);
    }

    // We use this callback for both remove and touch, as they take the same
    // arguments
    static void keyop_callback(libcouchbase_t,
                               const void *commandCookie,
                               libcouchbase_error_t error, const void *key,
                               libcouchbase_size_t nkey)
    {
        getInstance(commandCookie)->gotResult(key, nkey, error);
    }

    static void configuration_callback(libcouchbase_t instance,
                                       libcouchbase_configuration_t config)
    {
        void *cookie = const_cast<void *>(libcouchbase_get_cookie(instance));
        Couchbase *me = reinterpret_cast<Couchbase *>(cookie);
        me->onConnect(config);
    }
} // extern "C"

void Couchbase::setupLibcouchbaseCallbacks(void)
{
    libcouchbase_set_error_callback(instance, error_callback);
    libcouchbase_set_get_callback(instance, get_callback);
    libcouchbase_set_storage_callback(instance, storage_callback);
    libcouchbase_set_arithmetic_callback(instance, arithmetic_callback);
    libcouchbase_set_remove_callback(instance, keyop_callback);
    libcouchbase_set_touch_callback(instance, keyop_callback);
    libcouchbase_set_configuration_callback(instance, configuration_callback);
}
