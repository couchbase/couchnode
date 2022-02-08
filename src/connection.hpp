#pragma once
#include "addondata.hpp"
#include "instance.hpp"
#include "jstocbpp.hpp"
#include "transcoder.hpp"
#include <couchbase/utils/movable_function.hxx>
#include <napi.h>

namespace couchnode
{

typedef couchbase::utils::movable_function<void(Napi::Env, Napi::Function)>
    FwdFunc;

void jscbForward(Napi::Env env, Napi::Function callback, std::nullptr_t *,
                 FwdFunc *fn);
typedef Napi::TypedThreadSafeFunction<std::nullptr_t, FwdFunc, &jscbForward>
    CallCookieTTSF;

class CallCookie
{
public:
    CallCookie(Napi::Env env, Napi::Function jsCallback,
               const std::string &resourceName)
    {
        _ttsf =
            CallCookieTTSF::New(env, jsCallback, resourceName, 0, 1, nullptr);
        _ttsf.Ref(env);
    }

    CallCookie(CallCookie &o) = delete;

    CallCookie(CallCookie &&o)
        : _ttsf(std::move(o._ttsf))
    {
    }

    void invoke(FwdFunc &&callback)
    {
        _ttsf.BlockingCall(new FwdFunc(std::move(callback)));
        _ttsf.Release();
    }

private:
    CallCookieTTSF _ttsf;
};

class Connection : public Napi::ObjectWrap<Connection>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_connectionCtor;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    Connection(const Napi::CallbackInfo &info);
    ~Connection();

    std::shared_ptr<couchbase::cluster> cluster() const
    {
        return _instance->_cluster;
    }

    Napi::Value jsConnect(const Napi::CallbackInfo &info);
    Napi::Value jsShutdown(const Napi::CallbackInfo &info);
    Napi::Value jsOpenBucket(const Napi::CallbackInfo &info);
    Napi::Value jsGet(const Napi::CallbackInfo &info);
    Napi::Value jsExists(const Napi::CallbackInfo &info);
    Napi::Value jsGetAndLock(const Napi::CallbackInfo &info);
    Napi::Value jsGetAndTouch(const Napi::CallbackInfo &info);
    Napi::Value jsInsert(const Napi::CallbackInfo &info);
    Napi::Value jsUpsert(const Napi::CallbackInfo &info);
    Napi::Value jsReplace(const Napi::CallbackInfo &info);
    Napi::Value jsRemove(const Napi::CallbackInfo &info);
    Napi::Value jsTouch(const Napi::CallbackInfo &info);
    Napi::Value jsUnlock(const Napi::CallbackInfo &info);
    Napi::Value jsAppend(const Napi::CallbackInfo &info);
    Napi::Value jsPrepend(const Napi::CallbackInfo &info);
    Napi::Value jsIncrement(const Napi::CallbackInfo &info);
    Napi::Value jsDecrement(const Napi::CallbackInfo &info);
    Napi::Value jsLookupIn(const Napi::CallbackInfo &info);
    Napi::Value jsMutateIn(const Napi::CallbackInfo &info);
    Napi::Value jsViewQuery(const Napi::CallbackInfo &info);
    Napi::Value jsQuery(const Napi::CallbackInfo &info);
    Napi::Value jsAnalyticsQuery(const Napi::CallbackInfo &info);
    Napi::Value jsSearchQuery(const Napi::CallbackInfo &info);
    Napi::Value jsHttpRequest(const Napi::CallbackInfo &info);
    Napi::Value jsDiagnostics(const Napi::CallbackInfo &info);
    Napi::Value jsPing(const Napi::CallbackInfo &info);

private:
    template <typename Request, typename Handler>
    void executeOp(const std::string &opName, const Request &req,
                   Napi::Function jsCallback, Handler &&handler)
    {
        using response_type = typename Request::response_type;

        auto cookie = CallCookie(jsCallback.Env(), jsCallback, opName);
        this->_instance->_cluster->execute(
            req, [cookie = std::move(cookie),
                  handler = std::move(handler)](response_type resp) mutable {
                cookie.invoke(
                    [handler = std::move(handler), resp = std::move(resp)](
                        Napi::Env env, Napi::Function callback) mutable {
                        handler(env, callback, std::move(resp));
                    });
            });
    }

    template <typename Request>
    void executeOp(const std::string &opName, const Request &req,
                   Napi::Function jsCallback)
    {
        using response_type = typename Request::response_type;
        executeOp(opName, req, jsCallback,
                  [](Napi::Env env, Napi::Function callback,
                     response_type resp) mutable {
                      Napi::Value jsErr, jsRes;
                      try {
                          jsErr = cbpp_to_js(env, resp.ctx);
                          jsRes = cbpp_to_js(env, resp);
                      } catch (const Napi::Error &e) {
                          jsErr = e.Value();
                          jsRes = env.Null();
                      }

                      callback.Call({jsErr, jsRes});
                  });
    }

    template <typename Request>
    void executeOp(const std::string &opName, const Request &req,
                   Napi::Function jsCallback, Transcoder &&transcoder)
    {
        using response_type = typename Request::response_type;
        executeOp(opName, req, jsCallback,
                  [transcoder = std::move(transcoder)](
                      Napi::Env env, Napi::Function callback,
                      response_type resp) mutable {
                      Napi::Value jsErr, jsRes;
                      try {
                          jsErr = cbpp_to_js(env, resp.ctx);
                          jsRes = cbpp_to_js(env, resp, transcoder);
                      } catch (const Napi::Error &e) {
                          jsErr = e.Value();
                          jsRes = env.Null();
                      }

                      callback.Call({jsErr, jsRes});
                  });
    }

    Instance *_instance;
};

} // namespace couchnode
