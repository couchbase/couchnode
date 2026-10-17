#include "transactions.hpp"
#include "connection.hpp"
#include <core/transactions/internal/exceptions_internal.hxx>
#include <core/transactions/internal/utils.hxx>
#include <system_error>
#include <thread>
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
    auto connection = Connection::Unwrap(clusterJsObj);
    auto cluster = connection->cluster();

    auto txnsConfig = jsToCbpp<cbtxns::transactions_config>(configJsObj);
    std::future<
        std::pair<std::error_code, std::shared_ptr<cbcoretxns::transactions>>>
        future = cbcoretxns::transactions::create(cluster, txnsConfig);
    std::pair<std::error_code, std::shared_ptr<cbcoretxns::transactions>>
        result = future.get();
    if (result.first.value()) {
        Napi::Error err = Napi::Error::New(info.Env(), result.first.message());
        err.Set("code", Napi::Number::New(info.Env(), result.first.value()));
        throw err;
    }
    _instance = connection->instance();
    _impl = _instance->addTransactions(std::move(result.second));
}

Transactions::~Transactions()
{
}

Napi::Value Transactions::jsClose(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();

    // Closing removes this client's record from every bucket it registered
    // with, waiting on a cluster request for each, so it runs on its own
    // thread rather than on the event loop. The thread holds its own reference
    // to the instance, so it does not depend on this wrapper staying alive.
    // The cookie is shared so that it outlives a thread that fails to start,
    // whose destroyed closure would otherwise complete the callback with
    // request_canceled.
    auto cookie = std::make_shared<CallCookie>(info.Env(), callbackJsFn,
                                               "cbTxnsCloseCallback");
    auto complete = [](Napi::Env env, Napi::Function callback) {
        callback.Call({env.Null()});
    };
    try {
        std::thread([instance = _instance, impl = _impl.get(), cookie,
                     complete]() {
            instance->closeTransactions(impl);
            cookie->invoke(complete);
        }).detach();
    } catch (const std::system_error &) {
        // No thread could be started. Close here instead, which blocks the
        // event loop but still closes, rather than letting the exception end
        // the process. The callback still runs after this call returns.
        _instance->closeTransactions(_impl.get());
        cookie->invoke(complete);
    }

    return info.Env().Null();
}

} // namespace couchnode
