#include "couchbase.h"
#include <cstring>
#include <cstdio>
#include <cassert>

using namespace Couchnode;
using namespace std;

#define BAD_ARGS(msg, rv)  { \
        printf("Arg lengths: %d\n", args.Length()); \
        const char *errmsg = msg; \
        excerr = v8::ThrowException(v8::Exception::Error(v8::String::New(errmsg))); \
        return rv; \
    }

#define BAD_ARGS_NORV(msg) \
        BAD_ARGS(msg, ;)

static bool get_string(const v8::Handle<v8::Value> &jv,
                       char **strp,
                       size_t *szp)
{
    if (!jv->IsString()) {
        printf("Not a string..\n");
        return false;
    }

    v8::Local<v8::String> s = jv->ToString();
    *szp = s->Length();
    if (!*szp) {
        return false;
    }

    *strp = new char[*szp];
    s->WriteAscii(*strp, 0, *szp, v8::String::NO_NULL_TERMINATION);
    return true;
}

CommonArgs::CommonArgs(const v8::Arguments &argv,
                       v8::Handle<v8::Value> &exc,
                       int ixud,
                       bool do_extract_key)
    : args(argv), excerr(exc), key(NULL)
{


    if (do_extract_key && extractKey(0) == false) {
        return;
    }

    if (!extractUdata(ixud)) {
        printf("Couldn't extract user context!\n");
        return;
    }

}

bool CommonArgs::extractKey(int pos = 0)
{
    if (args.Length() < pos + 1) {
        BAD_ARGS("Missing key", false);
    }

    if (!get_string(args[pos], &key, &nkey)) {
        printf("Arg at pos %d\n", pos);
        BAD_ARGS("Couldn't extract string", false);
    }
    return true;
}

bool CommonArgs::extractUdata(int pos = 2)
{
    if (args[pos]->IsFunction() == false) {
        BAD_ARGS("bad value for callback", false);
    }

    ucb = v8::Local<v8::Function>::Cast(args[pos]);
    if (args.Length() >= pos) {
        udata = args[pos + 1];
    }
    return true;
}

CouchbaseCookie *CommonArgs::makeCookie()
{
    return new CouchbaseCookie(args.This(), ucb, udata);
}

CommonArgs::~CommonArgs()
{
    if (key) {
        delete[] key;
        key = NULL;
    }
}


// store(key, value, exp, cas, cb, data)
StorageArgs::StorageArgs(const v8::Arguments &argv,
                         v8::Handle<v8::Value> &exc, int expix,
                         bool do_extract_value)
    : CommonArgs(argv, exc, expix + 2, true),

      data(NULL), ndata(0), exp(0), cas(0)
{
    if (!exc.IsEmpty()) {
        return;
    }

    if (do_extract_value && extractValue() == false) {
        return;
    }

    if (args[expix]->IsNumber()) {
        exp = args[expix]->Uint32Value();
    }

    if (args[expix + 1]->IsNumber()) {
        cas = args[expix + 1]->IntegerValue();
    }
}

bool StorageArgs::extractValue()
{
    if (!get_string(args[1], &data, &ndata)) {
        BAD_ARGS("Bad value", false)
    }
    return true;
}

StorageArgs::~StorageArgs()
{
    if (data) {
        delete[] data;
        data = NULL;
    }
}



MGetArgs::MGetArgs(const v8::Arguments &args, v8::Handle<v8::Value> &exc)
    : CommonArgs(args, exc, 2, false)
{
    if (!exc.IsEmpty()) {
        return;
    }

    if (!extractKey(0)) {
        BAD_ARGS_NORV("Couldn't extract key..");
    }
}

bool MGetArgs::extractKey(int pos = 0xBADBEEF)
{

    if (args[0]->IsString()) {

        if (!CommonArgs::extractKey(0)) {
            return false;
        }

        kcount = 1;
        if (args[1]->IsNumber() && args[0]->Uint32Value() > 0) {
            exps = new time_t[1];
            *exps = args[1]->Uint32Value();
        } else {
            exps = NULL;
        }

        assert(key);

        keys = &key;
        sizes = &nkey;

        return true;
    }

    exps = NULL;

    if (!args[0]->IsArray()) {
        return false;
    }
    v8::Local<v8::Array> karry = v8::Local<v8::Array>::Cast(args[0]);
    kcount = karry->Length();

    keys = new char*[kcount];
    sizes = new size_t[kcount];

    memset(keys, 0, sizeof(char *) * kcount);
    memset(sizes, 0, sizeof(size_t) * kcount);

    for (unsigned ii = 0; ii < karry->Length(); ii++) {
        if (!get_string(karry->Get(ii), keys + ii, sizes + ii)) {
            return false;
        }
    }
    return true;
}

MGetArgs::~MGetArgs()
{
    if (exps) {
        delete[] exps;
        exps = NULL;
    }

    if (sizes && sizes != &nkey) {
        delete[] sizes;
    }
    sizes = NULL;

    if (keys && keys != &key) {
        for (unsigned ii = 0; ii < kcount; ii++) {
            delete[] keys[ii];
        }
        delete[] keys;
        keys = NULL;
    }
}


KeyopArgs::KeyopArgs(const v8::Arguments &args, v8::Handle<v8::Value> &exc)
    : CommonArgs(args, exc, 2), cas(0)
{
    if (args[1]->IsNumber()) {
        cas = args[1]->IntegerValue();
    }
}

// arithmetic(key, delta, initial, exp, cas, ...)
ArithmeticArgs::ArithmeticArgs(const v8::Arguments &args,
                               v8::Handle<v8::Value> &exc)
    : StorageArgs(args, exc, 3, false)
{
    if (!exc.IsEmpty()) {
        return;
    }
    if (!extractValue()) {
        return;
    }
}

bool ArithmeticArgs::extractValue()
{
    if (args[1]->IsNumber() == false) {
        BAD_ARGS("Delta must be numeric", false);
    }

    delta = args[1]->IntegerValue();

    if (args[2]->IsNumber()) {
        initial = args[2]->IntegerValue();
        create = true;
    } else {
        if (!args[2]->IsUndefined()) {
            BAD_ARGS("Initial value must be numeric", false);
        }
        create = false;
    }
    return true;
}
