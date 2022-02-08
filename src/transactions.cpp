#include "transactions.hpp"
#include "connection.hpp"
#include <couchbase/transactions/internal/exceptions_internal.hxx>
#include <couchbase/transactions/internal/utils.hxx>
#include <type_traits>

namespace couchnode
{

void Transactions::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func =
        DefineClass(env, "Transactions",
                    {
                        InstanceMethod<&Transactions::jsClose>("close"),
                    });

    constructor(env) = Napi::Persistent(func);
    exports.Set("Transactions", func);
}

Transactions::Transactions(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<Transactions>(info)
{
    auto clusterJsObj = info[0].As<Napi::Object>();
    auto configJsObj = info[1].As<Napi::Object>();

    if (!clusterJsObj.InstanceOf(Connection::constructor(info.Env()).Value())) {
        throw Napi::Error::New(info.Env(),
                               "first parameter must be a Connection object");
    }
    auto cluster = Connection::Unwrap(clusterJsObj)->cluster();

    auto txnsConfig = jsToCbpp<cbtxns::transaction_config>(configJsObj);
    _impl.reset(new cbtxns::transactions(*cluster, txnsConfig));
}

Transactions::~Transactions()
{
}

Napi::Value Transactions::jsClose(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();

    _impl->close();
    callbackJsFn.Call({info.Env().Null()});

    return info.Env().Null();
}

} // namespace couchnode
