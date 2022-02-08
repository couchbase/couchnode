#include "connection.hpp"
#include "cas.hpp"
#include "instance.hpp"
#include "jstocbpp.hpp"
#include "mutationtoken.hpp"
#include "transcoder.hpp"
#include <couchbase/operations/management/freeform.hxx>
#include <type_traits>

namespace couchnode
{

void jscbForward(Napi::Env env, Napi::Function callback, std::nullptr_t *,
                 FwdFunc *fn)
{
    if (env == nullptr || callback == nullptr) {
        delete fn;
        return;
    }

    try {
        (*fn)(env, callback);
    } catch (const Napi::Error &e) {
    }
    delete fn;
}

void Connection::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env, "Connection",
        {
            InstanceMethod<&Connection::jsConnect>("connect"),
            InstanceMethod<&Connection::jsShutdown>("shutdown"),
            InstanceMethod<&Connection::jsOpenBucket>("openBucket"),
            InstanceMethod<&Connection::jsGet>("get"),
            InstanceMethod<&Connection::jsExists>("exists"),
            InstanceMethod<&Connection::jsGetAndLock>("getAndLock"),
            InstanceMethod<&Connection::jsGetAndTouch>("getAndTouch"),
            InstanceMethod<&Connection::jsInsert>("insert"),
            InstanceMethod<&Connection::jsUpsert>("upsert"),
            InstanceMethod<&Connection::jsReplace>("replace"),
            InstanceMethod<&Connection::jsRemove>("remove"),
            InstanceMethod<&Connection::jsTouch>("touch"),
            InstanceMethod<&Connection::jsUnlock>("unlock"),
            InstanceMethod<&Connection::jsAppend>("append"),
            InstanceMethod<&Connection::jsPrepend>("prepend"),
            InstanceMethod<&Connection::jsIncrement>("increment"),
            InstanceMethod<&Connection::jsDecrement>("decrement"),
            InstanceMethod<&Connection::jsLookupIn>("lookupIn"),
            InstanceMethod<&Connection::jsMutateIn>("mutateIn"),
            InstanceMethod<&Connection::jsViewQuery>("viewQuery"),
            InstanceMethod<&Connection::jsQuery>("query"),
            InstanceMethod<&Connection::jsAnalyticsQuery>("analyticsQuery"),
            InstanceMethod<&Connection::jsSearchQuery>("searchQuery"),
            InstanceMethod<&Connection::jsHttpRequest>("httpRequest"),
            InstanceMethod<&Connection::jsDiagnostics>("diagnostics"),
            InstanceMethod<&Connection::jsPing>("ping"),
        });

    constructor(env) = Napi::Persistent(func);
    exports.Set("Connection", func);
}

Connection::Connection(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<Connection>(info)
{
    _instance = new Instance();
}

Connection::~Connection()
{
    _instance->asyncDestroy();
    _instance = nullptr;
}

Napi::Value Connection::jsConnect(const Napi::CallbackInfo &info)
{
    auto connstr = info[0].ToString().Utf8Value();
    auto credentialsJsObj = info[1].As<Napi::Object>();
    auto callbackJsFn = info[2].As<Napi::Function>();

    auto connstrInfo = couchbase::utils::parse_connection_string(connstr);
    auto creds = jsToCbpp<couchbase::cluster_credentials>(credentialsJsObj);

    auto cookie = CallCookie(info.Env(), callbackJsFn, "cbConnectCallback");
    this->_instance->_cluster->open(
        couchbase::origin(creds, connstrInfo),
        [cookie = std::move(cookie)](std::error_code ec) mutable {
            cookie.invoke([ec](Napi::Env env, Napi::Function callback) {
                callback.Call({cbpp_to_js(env, ec)});
            });
        });

    return info.Env().Null();
}

Napi::Value Connection::jsShutdown(const Napi::CallbackInfo &info)
{
    auto callbackJsFn = info[0].As<Napi::Function>();

    auto cookie = CallCookie(info.Env(), callbackJsFn, "cbShutdownCallback");
    this->_instance->_cluster->close([cookie = std::move(cookie)]() mutable {
        cookie.invoke([](Napi::Env env, Napi::Function callback) {
            callback.Call({env.Null()});
        });
    });

    return info.Env().Null();
}

Napi::Value Connection::jsOpenBucket(const Napi::CallbackInfo &info)
{
    auto bucketName = info[0].ToString().Utf8Value();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto cookie = CallCookie(info.Env(), callbackJsFn, "cbOpenBucketCallback");
    this->_instance->_cluster->open_bucket(
        bucketName, [cookie = std::move(cookie)](std::error_code ec) mutable {
            cookie.invoke([ec](Napi::Env env, Napi::Function callback) {
                callback.Call({cbpp_to_js(env, ec)});
            });
        });

    return info.Env().Null();
}

Napi::Value Connection::jsGet(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto transcoder = Transcoder::parse(optsJsObj.Get("transcoder"));

    executeOp("get", jsToCbpp<couchbase::operations::get_request>(optsJsObj),
              callbackJsFn, std::move(transcoder));

    return info.Env().Null();
}

Napi::Value Connection::jsExists(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("exists",
              jsToCbpp<couchbase::operations::exists_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsGetAndLock(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto transcoder = Transcoder::parse(optsJsObj.Get("transcoder"));

    executeOp("getAndLock",
              jsToCbpp<couchbase::operations::get_and_lock_request>(optsJsObj),
              callbackJsFn, std::move(transcoder));

    return info.Env().Null();
}

Napi::Value Connection::jsGetAndTouch(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto transcoder = Transcoder::parse(optsJsObj.Get("transcoder"));

    executeOp("getAndTouch",
              jsToCbpp<couchbase::operations::get_and_touch_request>(optsJsObj),
              callbackJsFn, std::move(transcoder));

    return info.Env().Null();
}

Napi::Value Connection::jsInsert(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto transcoder = Transcoder::parse(optsJsObj.Get("transcoder"));

    executeOp(
        "insert",
        jsToCbpp<couchbase::operations::insert_request>(optsJsObj, transcoder),
        callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsUpsert(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto transcoder = Transcoder::parse(optsJsObj.Get("transcoder"));

    executeOp(
        "upsert",
        jsToCbpp<couchbase::operations::upsert_request>(optsJsObj, transcoder),
        callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsReplace(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto transcoder = Transcoder::parse(optsJsObj.Get("transcoder"));

    executeOp(
        "replace",
        jsToCbpp<couchbase::operations::replace_request>(optsJsObj, transcoder),
        callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsRemove(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("remove",
              jsToCbpp<couchbase::operations::remove_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsTouch(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("touch",
              jsToCbpp<couchbase::operations::touch_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsUnlock(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("unlock",
              jsToCbpp<couchbase::operations::unlock_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsAppend(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("append",
              jsToCbpp<couchbase::operations::append_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsPrepend(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("prepend",
              jsToCbpp<couchbase::operations::prepend_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsIncrement(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("increment",
              jsToCbpp<couchbase::operations::increment_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsDecrement(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("decrement",
              jsToCbpp<couchbase::operations::decrement_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsLookupIn(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("mutateIn",
              jsToCbpp<couchbase::operations::lookup_in_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsMutateIn(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("mutateIn",
              jsToCbpp<couchbase::operations::mutate_in_request>(optsJsObj),
              callbackJsFn);

    return info.Env().Null();
}

Napi::Value Connection::jsViewQuery(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("viewQuery",
              jsToCbpp<couchbase::operations::document_view_request>(optsJsObj),
              callbackJsFn,
              [](Napi::Env env, Napi::Function callback,
                 couchbase::operations::document_view_response resp) mutable {
                  if (resp.ctx.ec) {
                      callback.Call({cbpp_to_js(env, resp.ctx)});
                      return;
                  }

                  callback.Call({env.Null(), cbpp_to_js(env, resp)});
              });

    return info.Env().Null();
}

Napi::Value Connection::jsQuery(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("query",
              jsToCbpp<couchbase::operations::query_request>(optsJsObj),
              callbackJsFn,
              [](Napi::Env env, Napi::Function callback,
                 couchbase::operations::query_response resp) mutable {
                  if (resp.ctx.ec) {
                      callback.Call({cbpp_to_js(env, resp.ctx)});
                      return;
                  }

                  callback.Call({env.Null(), cbpp_to_js(env, resp)});
              });

    return info.Env().Null();
}

Napi::Value Connection::jsAnalyticsQuery(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("analyticsQuery",
              jsToCbpp<couchbase::operations::analytics_request>(optsJsObj),
              callbackJsFn,
              [](Napi::Env env, Napi::Function callback,
                 couchbase::operations::analytics_response resp) mutable {
                  if (resp.ctx.ec) {
                      callback.Call({cbpp_to_js(env, resp.ctx)});
                      return;
                  }

                  callback.Call({env.Null(), cbpp_to_js(env, resp)});
              });

    return info.Env().Null();
}

Napi::Value Connection::jsSearchQuery(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp("searchQuery",
              jsToCbpp<couchbase::operations::search_request>(optsJsObj),
              callbackJsFn,
              [](Napi::Env env, Napi::Function callback,
                 couchbase::operations::search_response resp) mutable {
                  if (resp.ctx.ec) {
                      callback.Call({cbpp_to_js(env, resp.ctx)});
                      return;
                  }

                  callback.Call({env.Null(), cbpp_to_js(env, resp)});
              });

    return info.Env().Null();
}

Napi::Value Connection::jsHttpRequest(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    executeOp(
        "httpRequest",
        jsToCbpp<couchbase::operations::management::freeform_request>(
            optsJsObj),
        callbackJsFn,
        [](Napi::Env env, Napi::Function callback,
           couchbase::operations::management::freeform_response resp) mutable {
            if (resp.ctx.ec) {
                callback.Call({cbpp_to_js(env, resp.ctx)});
                return;
            }

            callback.Call({env.Null(), cbpp_to_js(env, resp)});
        });

    return info.Env().Null();
}

Napi::Value Connection::jsDiagnostics(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto reportId =
        jsToCbpp<std::optional<std::string>>(optsJsObj.Get("report_id"));

    auto cookie = CallCookie(info.Env(), callbackJsFn, "diagnostics");
    this->_instance->_cluster->diagnostics(
        reportId, [cookie = std::move(cookie)](
                      couchbase::diag::diagnostics_result resp) mutable {
            cookie.invoke([resp = std::move(resp)](
                              Napi::Env env, Napi::Function callback) mutable {
                Napi::Value jsErr, jsRes;
                try {
                    jsErr = env.Null();
                    jsRes = cbpp_to_js(env, resp);
                } catch (const Napi::Error &e) {
                    jsErr = env.Null();
                    jsRes = env.Null();
                }

                callback.Call({jsErr, jsRes});
            });
        });

    return info.Env().Null();
}

Napi::Value Connection::jsPing(const Napi::CallbackInfo &info)
{
    auto optsJsObj = info[0].As<Napi::Object>();
    auto callbackJsFn = info[1].As<Napi::Function>();

    auto reportId =
        jsToCbpp<std::optional<std::string>>(optsJsObj.Get("report_id"));
    auto bucketName =
        jsToCbpp<std::optional<std::string>>(optsJsObj.Get("bucket_name"));
    auto services =
        jsToCbpp<std::set<couchbase::service_type>>(optsJsObj.Get("services"));

    auto cookie = CallCookie(info.Env(), callbackJsFn, "ping");
    this->_instance->_cluster->ping(
        reportId, bucketName, services,
        [cookie =
             std::move(cookie)](couchbase::diag::ping_result resp) mutable {
            cookie.invoke([resp = std::move(resp)](
                              Napi::Env env, Napi::Function callback) mutable {
                Napi::Value jsErr, jsRes;
                try {
                    jsErr = env.Null();
                    jsRes = cbpp_to_js(env, resp);
                } catch (const Napi::Error &e) {
                    jsErr = env.Null();
                    jsRes = env.Null();
                }

                callback.Call({jsErr, jsRes});
            });
        });

    return info.Env().Null();
}

} // namespace couchnode
