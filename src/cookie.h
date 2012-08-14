#ifndef COUCHNODE_COOKIE_H
#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

namespace Couchnode {

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

} // namespace Couchnode
#endif // COUCHNODE_COOKIE_H
