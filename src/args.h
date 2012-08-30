/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
#ifndef COUCHNODE_ARGS_H
#define COUCHNODE_ARGS_H 1
#ifndef COUCHBASE_H
#error "Include couchbase.h before including this file"
#endif

namespace Couchnode
{
    class CommonArgs
    {
    public:

        CommonArgs(const v8::Arguments &, int pmax = 0, int reqmax = 0);
        virtual ~CommonArgs();

        virtual bool parse();

        virtual CouchbaseCookie *makeCookie();

        virtual bool extractKey();

        bool extractUdata();
        void extractExpiry(const v8::Handle<v8::Value> &, time_t *);
        void extractCas(const v8::Handle<v8::Value> &, lcb_cas_t *);

        void getParam(int aix, int dcix, v8::Handle<v8::Value> *vp) {
            if (use_dictparams) {
                if (dict.IsEmpty() == false) {
                    *vp = dict->Get(NameMap::names[dcix]);
                }
            } else if (args.Length() >= aix - 1) {
                *vp = args[aix];
            }
        }

        virtual void bailout(CouchbaseCookie *, lcb_error_t);

        void invalidate() {
            stale = true;
        }

        // Hooks for deep-copy post assignment.. (manual step)..
        virtual void sync(const CommonArgs &) { }

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
        bool stale;

    };

    class StorageArgs : public CommonArgs
    {
    public:
        StorageArgs(const v8::Arguments &, int nvparams = 0);
        virtual ~StorageArgs();

        virtual bool parse();
        virtual bool extractValue();

        char *data;
        size_t ndata;
        time_t exp;
        uint64_t cas;
        lcb_storage_t storop;
    };

    class MGetArgs : public CommonArgs
    {
    public:
        MGetArgs(const v8::Arguments &, int nkparams = 1);
        virtual ~MGetArgs();

        virtual CouchbaseCookie *makeCookie() {
            return new CouchbaseCookie(args.This(), ucb, udata, kcount);
        }

        virtual void bailout(CouchbaseCookie *, lcb_error_t);

        virtual void sync(const MGetArgs &other) {
            if (other.keys == &other.key) {
                keys = &key;
            }
            if (other.sizes == &other.nkey) {
                sizes = &nkey;
            }
            if (other.exps == &other.single_exp) {
                exps = &single_exp;
            }
        }

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

} // namespace Couchnode
#endif // COUCHNODE_ARGS_H
