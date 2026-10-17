#pragma once
#include "addondata.hpp"
#include "instance.hpp"
#include <core/transactions.hxx>
#include <memory>
#include <napi.h>

namespace cbtxns = couchbase::transactions;
namespace cbcoretxns = couchbase::core::transactions;

namespace couchnode
{

class Transactions : public Napi::ObjectWrap<Transactions>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_transactionsCtor;
    }

    // Keeps the instance alive rather than the object itself, which the
    // instance owns until its connection shuts down.
    std::shared_ptr<cbcoretxns::transactions> transactions() const
    {
        return _impl;
    }

    const std::shared_ptr<Instance> &instance() const
    {
        return _instance;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    Transactions(const Napi::CallbackInfo &info);
    ~Transactions();

    Napi::Value jsClose(const Napi::CallbackInfo &info);

private:
    // Closes `_impl` through the instance that owns it, so an explicit close
    // and the connection's shutdown are serialized and close it once.
    std::shared_ptr<Instance> _instance;
    std::shared_ptr<cbcoretxns::transactions> _impl;
};

} // namespace couchnode
