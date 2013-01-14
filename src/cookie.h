/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#ifndef COUCHNODE_COOKIE_H
#define COUCHNODE_COOKIE_H 1

#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

namespace Couchnode
{

    class CouchbaseCookie
    {

    public:
        CouchbaseCookie(v8::Handle<v8::Value> cbo,
                        v8::Handle<v8::Function> callback,
                        v8::Handle<v8::Value> data,
                        unsigned int numRemaining);
        virtual ~CouchbaseCookie();

        void result(lcb_error_t error,
                    const void *key, lcb_size_t nkey,
                    lcb_cas_t cas,
                    lcb_observe_t status,
                    int from_master,
                    lcb_time_t ttp,
                    lcb_time_t ttr);

        void result(lcb_error_t error,
                    const void *key, lcb_size_t nkey,
                    const void *bytes,
                    lcb_size_t nbytes,
                    lcb_uint32_t flags,
                    lcb_cas_t cas);

        void result(lcb_error_t error,
                    const void *key, lcb_size_t nkey,
                    lcb_cas_t cas);

        void result(lcb_error_t error,
                    const void *key, lcb_size_t nkey,
                    lcb_uint64_t value,
                    lcb_cas_t cas);

        void result(lcb_error_t error,
                    const void *key, lcb_size_t nkey);

        void result(lcb_error_t error, const lcb_http_resp_t *);


    protected:
        void invokeProgress(v8::Persistent<v8::Context> &context, int argc,
                            v8::Local<v8::Value> *argv) {
            // Now, invoke the callback with the appropriate arguments
            ucallback->Call(v8::Context::GetEntered()->Global(), argc , argv);
            context.Dispose();
        }

        unsigned int remaining;
        void invoke(v8::Persistent<v8::Context> &context, int argc,
                    v8::Local<v8::Value> *argv) {
            invokeProgress(context, argc, argv);
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
