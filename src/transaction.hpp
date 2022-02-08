#pragma once
#include "addondata.hpp"
#include <couchbase/transactions.hxx>
#include <couchbase/transactions/internal/transaction_context.hxx>
#include <napi.h>

namespace cbtxns = couchbase::transactions;

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
    Napi::Value jsInsert(const Napi::CallbackInfo &info);
    Napi::Value jsReplace(const Napi::CallbackInfo &info);
    Napi::Value jsRemove(const Napi::CallbackInfo &info);
    Napi::Value jsQuery(const Napi::CallbackInfo &info);
    Napi::Value jsCommit(const Napi::CallbackInfo &info);
    Napi::Value jsRollback(const Napi::CallbackInfo &info);

private:
    std::shared_ptr<cbtxns::transaction_context> _impl;
};

} // namespace couchnode
