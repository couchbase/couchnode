#pragma once
#include "addondata.hpp"
#include "instance.hpp"
#include <core/transactions.hxx>
#include <core/transactions/internal/transaction_context.hxx>
#include <napi.h>

namespace cbtxns = couchbase::transactions;
namespace cbcoretxns = couchbase::core::transactions;

namespace couchnode
{

class Transaction : public Napi::ObjectWrap<Transaction>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_transactionCtor;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    Transaction(const Napi::CallbackInfo &info);
    ~Transaction();

    Napi::Value jsNewAttempt(const Napi::CallbackInfo &info);
    Napi::Value jsFinalizeAttempt(const Napi::CallbackInfo &info);
    Napi::Value jsGet(const Napi::CallbackInfo &info);
    Napi::Value
    jsGetReplicaFromPreferredServerGroup(const Napi::CallbackInfo &info);
    Napi::Value jsGetMulti(const Napi::CallbackInfo &info);
    Napi::Value
    jsGetMultiReplicasFromPreferredServerGroup(const Napi::CallbackInfo &info);
    Napi::Value jsInsert(const Napi::CallbackInfo &info);
    Napi::Value jsReplace(const Napi::CallbackInfo &info);
    Napi::Value jsRemove(const Napi::CallbackInfo &info);
    Napi::Value jsQuery(const Napi::CallbackInfo &info);
    Napi::Value jsCommit(const Napi::CallbackInfo &info);
    Napi::Value jsRollback(const Napi::CallbackInfo &info);

private:
    // Counts this transaction's operations in flight, so the connection's
    // shutdown keeps the transactions objects until none is.
    std::shared_ptr<Instance> _instance;
    // The context holds only a reference to the core transactions object, so
    // this keeps the instance that owns that object alive for as long as this
    // transaction. Declared before the context so it is destroyed after it.
    std::shared_ptr<cbcoretxns::transactions> _transactions;
    std::shared_ptr<cbcoretxns::transaction_context> _impl;
};

} // namespace couchnode
