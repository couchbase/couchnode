#include "transaction.hpp"
#include "connection.hpp"
#include "jstocbpp.hpp"
#include "transactions.hpp"
#include <core/transactions/internal/exceptions_internal.hxx>
#include <core/transactions/internal/utils.hxx>
#include <core/transactions/transaction_get_multi_replicas_from_preferred_server_group_result.hxx>
#include <core/transactions/transaction_get_multi_result.hxx>
#include <type_traits>

namespace couchnode
{

// BUG(JSCBC-1022): Remove this once txn++ implements handlers which can
// properly forward with move semantics.
// UPDATE 2022.12.09:  kv has been updated, query still uses std::function
// UPDATE 2023.01.30:  Error found in c++ txns, kv reverted back to std::function
//                     and query still uses std::function
class RefCallCookie
{
public:
    RefCallCookie(Napi::Env env, Napi::Function jsCallback,
                  const std::string &resourceName)
        : _impl(new CallCookie(env, jsCallback, resourceName))
    {
    }

    void invoke(FwdFunc &&callback)
    {
        _impl->invoke(std::forward<FwdFunc>(callback));
    }

private:
    std::shared_ptr<CallCookie> _impl;
};

// The core throws, rather than calling the handler, when an operation cannot
// start at all, for example with no attempt in progress. Each entry point
// reports that through the operation's callback, so the caller gets the same
// typed error as for any other failure and the callback runs exactly once. The
// callback queue is unbounded, so invoking from the JS thread cannot block.
static void failOp(RefCallCookie &cookie, std::exception_ptr err)
{
    cookie.invoke(
        [err = std::move(err)](Napi::Env env, Napi::Function callback) mutable {
            callback.Call({cbpp_to_js(env, err)});
        });
}

void Transaction::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env, "Transaction",
        {
            InstanceMethod<&Transaction::jsNewAttempt>("newAttempt"),
            InstanceMethod<&Transaction::jsGet>("get"),
            InstanceMethod<&Transaction::jsGetReplicaFromPreferredServerGroup>(
                "getReplicaFromPreferredServerGroup"),
            InstanceMethod<&Transaction::jsGetMulti>("getMulti"),
            InstanceMethod<
                &Transaction::jsGetMultiReplicasFromPreferredServerGroup>(
                "getMultiReplicasFromPreferredServerGroup"),
            InstanceMethod<&Transaction::jsInsert>("insert"),
            InstanceMethod<&Transaction::jsReplace>("replace"),
            InstanceMethod<&Transaction::jsRemove>("remove"),
            InstanceMethod<&Transaction::jsQuery>("query"),
            InstanceMethod<&Transaction::jsCommit>("commit"),
            InstanceMethod<&Transaction::jsRollback>("rollback"),
        });

    constructor(env) = Napi::Persistent(func);
    exports.Set("Transaction", func);
}

Transaction::Transaction(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<Transaction>(info)
{
    auto txnsJsObj = info[0].As<Napi::Object>();
    auto configJsObj = info[1].As<Napi::Object>();

    if (!txnsJsObj.InstanceOf(Transactions::constructor(info.Env()).Value())) {
        throw Napi::Error::New(info.Env(),
                               "first parameter must be a Transactions object");
    }
    auto &transactions = Transactions::Unwrap(txnsJsObj)->transactions();

    auto txnConfig = jsToCbpp<cbtxns::transaction_options>(configJsObj);
    _impl.reset();
    _impl = cbcoretxns::transaction_context::create(transactions, txnConfig);
}

Transaction::~Transaction()
{
}

Napi::Value Transaction::jsNewAttempt(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie =
        RefCallCookie(info.Env(), callbackJsFn, "txnNewAttemptCallback");

    try {
        _impl->new_attempt_context([this,
                                    cookie](std::exception_ptr err) mutable {
            cookie.invoke([err = std::move(err)](
                              Napi::Env env, Napi::Function callback) mutable {
                callback.Call({cbpp_to_js(env, err)});
            });
        });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsGet(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto docId = jsToCbpp<couchbase::core::document_id>(optsJsObj.Get("id"));

    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnGetCallback");

    try {
        _impl->get_optional(
            docId,
            [this, cookie](
                std::exception_ptr err,
                std::optional<cbcoretxns::transaction_get_result> res) mutable {
                cookie.invoke([err = std::move(err), res = std::move(res)](
                                  Napi::Env env,
                                  Napi::Function callback) mutable {
                    // BUG(JSCBC-1024): We should revert to using direct get
                    // operations once the underlying issue has been resolved.
                    if (!err && !res.has_value()) {
                        callback.Call(
                            {cbpp_to_js(env, couchbase::errc::make_error_code(
                                                 couchbase::errc::key_value::
                                                     document_not_found))});
                        return;
                    }

                    callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
                });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsGetReplicaFromPreferredServerGroup(
    const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto docId = jsToCbpp<couchbase::core::document_id>(optsJsObj.Get("id"));

    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnGetCallback");

    try {
        _impl->get_replica_from_preferred_server_group(
            docId,
            [this, cookie](
                std::exception_ptr err,
                std::optional<cbcoretxns::transaction_get_result> res) mutable {
                cookie.invoke([err = std::move(err), res = std::move(res)](
                                  Napi::Env env,
                                  Napi::Function callback) mutable {
                    // BUG(JSCBC-1024): We should revert to using direct get
                    // operations once the underlying issue has been resolved.
                    if (!err && !res.has_value()) {
                        callback.Call(
                            {cbpp_to_js(env, couchbase::errc::make_error_code(
                                                 couchbase::errc::key_value::
                                                     document_irretrievable))});
                        return;
                    }

                    callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
                });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsGetMulti(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto docIds = jsToCbpp<std::vector<couchbase::core::document_id>>(
        optsJsObj.Get("ids"));
    auto mode =
        jsToCbpp<cbcoretxns::transaction_get_multi_mode>(optsJsObj.Get("mode"));

    auto cookie =
        RefCallCookie(info.Env(), callbackJsFn, "txnGetMultiCallback");

    try {
        _impl->get_multi(
            docIds, mode,
            [this,
             cookie](std::exception_ptr err,
                     std::optional<cbcoretxns::transaction_get_multi_result>
                         res) mutable {
                cookie.invoke([err = std::move(err), res = std::move(res)](
                                  Napi::Env env,
                                  Napi::Function callback) mutable {
                    callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
                });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsGetMultiReplicasFromPreferredServerGroup(
    const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto docIds = jsToCbpp<std::vector<couchbase::core::document_id>>(
        optsJsObj.Get("ids"));
    auto mode = jsToCbpp<
        cbcoretxns::
            transaction_get_multi_replicas_from_preferred_server_group_mode>(
        optsJsObj.Get("mode"));

    auto cookie =
        RefCallCookie(info.Env(), callbackJsFn,
                      "txnGetMultiReplicasFromPreferredServerGroupCallback");

    try {
        _impl->get_multi_replicas_from_preferred_server_group(
            docIds, mode,
            [this, cookie](
                std::exception_ptr err,
                std::optional<
                    cbcoretxns::
                        transaction_get_multi_replicas_from_preferred_server_group_result>
                    res) mutable {
                cookie.invoke([err = std::move(err), res = std::move(res)](
                                  Napi::Env env,
                                  Napi::Function callback) mutable {
                    callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
                });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsInsert(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto docId = jsToCbpp<couchbase::core::document_id>(optsJsObj.Get("id"));
    auto content =
        jsToCbpp<couchbase::codec::encoded_value>(optsJsObj.Get("content"));

    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnInsertCallback");

    try {
        _impl->insert(
            docId, content,
            [this, cookie](
                std::exception_ptr err,
                std::optional<cbcoretxns::transaction_get_result> res) mutable {
                cookie.invoke([err = std::move(err), res = std::move(res)](
                                  Napi::Env env,
                                  Napi::Function callback) mutable {
                    callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
                });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsReplace(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto doc =
        jsToCbpp<cbcoretxns::transaction_get_result>(optsJsObj.Get("doc"));
    auto content =
        jsToCbpp<couchbase::codec::encoded_value>(optsJsObj.Get("content"));

    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnReplaceCallback");

    try {
        _impl->replace(
            doc, content,
            [this, cookie](
                std::exception_ptr err,
                std::optional<cbcoretxns::transaction_get_result> res) mutable {
                cookie.invoke([err = std::move(err), res = std::move(res)](
                                  Napi::Env env,
                                  Napi::Function callback) mutable {
                    callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
                });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsRemove(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto doc =
        jsToCbpp<cbcoretxns::transaction_get_result>(optsJsObj.Get("doc"));

    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnRemoveCallback");

    try {
        _impl->remove(doc, [this, cookie](std::exception_ptr err) mutable {
            cookie.invoke([err = std::move(err)](
                              Napi::Env env, Napi::Function callback) mutable {
                callback.Call({cbpp_to_js(env, err)});
            });
        });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsQuery(const Napi::CallbackInfo &info)
{
    auto statementJsStr = info[0].As<Napi::String>();
    auto optsJsObj = info[1].As<Napi::Object>();
    auto callbackJsFn = info[2].As<Napi::Function>();
    auto statement = jsToCbpp<std::string>(statementJsStr);
    auto options = jsToCbpp<cbtxns::transaction_query_options>(optsJsObj);

    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnQueryCallback");

    try {
        _impl->query(
            statement, options,
            [this,
             cookie](std::exception_ptr err,
                     std::optional<couchbase::core::operations::query_response>
                         resp) mutable {
                cookie.invoke(
                    [err = std::move(err), resp = std::move(resp)](
                        Napi::Env env, Napi::Function callback) mutable {
                        Napi::Value jsErr, jsRes;
                        try {
                            jsErr = cbpp_to_js(env, err);
                            jsRes = cbpp_to_js(env, resp);
                        } catch (const Napi::Error &e) {
                            jsErr = e.Value();
                            jsRes = env.Null();
                        }

                        callback.Call({jsErr, jsRes});
                    });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsCommit(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnCommitCallback");

    try {
        _impl->finalize(
            [this,
             cookie](std::optional<cbcoretxns::transaction_exception> err,
                     std::optional<cbtxns::transaction_result> res) mutable {
                cookie.invoke([err = std::move(err), res = std::move(res)](
                                  Napi::Env env,
                                  Napi::Function callback) mutable {
                    callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
                });
            });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

Napi::Value Transaction::jsRollback(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie =
        RefCallCookie(info.Env(), callbackJsFn, "txnRollbackCallback");

    try {
        _impl->rollback([this, cookie](std::exception_ptr err) mutable {
            cookie.invoke([err = std::move(err)](
                              Napi::Env env, Napi::Function callback) mutable {
                callback.Call({cbpp_to_js(env, err)});
            });
        });
    } catch (...) {
        failOp(cookie, std::current_exception());
    }

    return info.Env().Null();
}

} // namespace couchnode
