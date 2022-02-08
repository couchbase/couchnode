#include "transaction.hpp"
#include "connection.hpp"
#include "jstocbpp.hpp"
#include "transactions.hpp"
#include <couchbase/transactions/internal/exceptions_internal.hxx>
#include <couchbase/transactions/internal/utils.hxx>
#include <type_traits>

namespace couchnode
{

// BUG(JSCBC-1022): Remove this once txn++ implements handlers which can
// properly forward with move semantics.
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

void Transaction::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env, "Transaction",
        {
            InstanceMethod<&Transaction::jsNewAttempt>("newAttempt"),
            InstanceMethod<&Transaction::jsGet>("get"),
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

    auto txnConfig = jsToCbpp<cbtxns::per_transaction_config>(configJsObj);
    _impl.reset(new cbtxns::transaction_context(transactions));
}

Transaction::~Transaction()
{
}

Napi::Value Transaction::jsNewAttempt(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie =
        RefCallCookie(info.Env(), callbackJsFn, "txnNewAttemptCallback");

    _impl->new_attempt_context(
        [this, cookie = std::move(cookie)](std::exception_ptr err) mutable {
            cookie.invoke([err = std::move(err)](
                              Napi::Env env, Napi::Function callback) mutable {
                callback.Call({cbpp_to_js(env, err)});
            });
        });

    return info.Env().Null();
}

Napi::Value Transaction::jsGet(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnGetCallback");

    auto docId = jsToCbpp<couchbase::document_id>(optsJsObj.Get("id"));

    _impl->get_optional(
        docId, [this, cookie = std::move(cookie)](
                   std::exception_ptr err,
                   std::optional<cbtxns::transaction_get_result> res) mutable {
            cookie.invoke([err = std::move(err), res = std::move(res)](
                              Napi::Env env, Napi::Function callback) mutable {
                // BUG(JSCBC-1024): We should revert to using direct get
                // operations once the underlying issue has been resolved.
                if (!err && !res.has_value()) {
                    callback.Call(
                        {cbpp_to_js(env, couchbase::error::make_error_code(
                                             couchbase::error::key_value_errc::
                                                 document_not_found))});
                    return;
                }

                callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
            });
        });

    return info.Env().Null();
}

Napi::Value Transaction::jsInsert(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnInsertCallback");

    auto docId = jsToCbpp<couchbase::document_id>(optsJsObj.Get("id"));
    auto content = jsToCbpp<couchbase::json_string>(optsJsObj.Get("content"));

    _impl->insert(
        docId, content.str(),
        [this, cookie = std::move(cookie)](
            std::exception_ptr err,
            std::optional<cbtxns::transaction_get_result> res) mutable {
            cookie.invoke([err = std::move(err), res = std::move(res)](
                              Napi::Env env, Napi::Function callback) mutable {
                callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
            });
        });

    return info.Env().Null();
}

Napi::Value Transaction::jsReplace(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnReplaceCallback");

    auto doc = jsToCbpp<couchbase::transactions::transaction_get_result>(
        optsJsObj.Get("doc"));
    auto content = jsToCbpp<couchbase::json_string>(optsJsObj.Get("content"));

    _impl->replace(
        doc, content.str(),
        [this, cookie = std::move(cookie)](
            std::exception_ptr err,
            std::optional<cbtxns::transaction_get_result> res) mutable {
            cookie.invoke([err = std::move(err), res = std::move(res)](
                              Napi::Env env, Napi::Function callback) mutable {
                callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
            });
        });

    return info.Env().Null();
}

Napi::Value Transaction::jsRemove(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();
    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnRemoveCallback");

    auto doc = jsToCbpp<couchbase::transactions::transaction_get_result>(
        optsJsObj.Get("doc"));

    _impl->remove(doc, [this, cookie = std::move(cookie)](
                           std::exception_ptr err) mutable {
        cookie.invoke([err = std::move(err)](Napi::Env env,
                                             Napi::Function callback) mutable {
            callback.Call({cbpp_to_js(env, err)});
        });
    });

    return info.Env().Null();
}

Napi::Value Transaction::jsQuery(const Napi::CallbackInfo &info)
{
    auto statementJsStr = info[0].As<Napi::String>();
    auto optsJsObj = info[1].As<Napi::Object>();
    auto callbackJsFn = info[2].As<Napi::Function>();
    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnQueryCallback");

    auto statement = jsToCbpp<std::string>(statementJsStr);
    auto options =
        jsToCbpp<couchbase::transactions::transaction_query_options>(optsJsObj);

    _impl->query(
        statement, options,
        [this, cookie = std::move(cookie)](
            std::exception_ptr err,
            std::optional<couchbase::operations::query_response> resp) mutable {
            cookie.invoke([err = std::move(err), resp = std::move(resp)](
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

    return info.Env().Null();
}

Napi::Value Transaction::jsCommit(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie = RefCallCookie(info.Env(), callbackJsFn, "txnCommitCallback");

    _impl->finalize([this, cookie = std::move(cookie)](
                        std::optional<cbtxns::transaction_exception> err,
                        std::optional<cbtxns::transaction_result> res) mutable {
        cookie.invoke([err = std::move(err), res = std::move(res)](
                          Napi::Env env, Napi::Function callback) mutable {
            callback.Call({cbpp_to_js(env, err), cbpp_to_js(env, res)});
        });
    });

    return info.Env().Null();
}

Napi::Value Transaction::jsRollback(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie =
        RefCallCookie(info.Env(), callbackJsFn, "txnRollbackCallback");

    _impl->rollback(
        [this, cookie = std::move(cookie)](std::exception_ptr err) mutable {
            cookie.invoke([err = std::move(err)](
                              Napi::Env env, Napi::Function callback) mutable {
                callback.Call({cbpp_to_js(env, err)});
            });
        });

    return info.Env().Null();
}

} // namespace couchnode
