#pragma once
#include "addondata.hpp"
#include "instance.hpp"
#include "jstocbpp.hpp"
#include <core/logger/logger.hxx>
#include <core/tracing/wrapper_sdk_tracer.hxx>
#include <core/utils/movable_function.hxx>
#include <couchbase/error_codes.hxx>
#include <memory>
#include <mutex>
#include <napi.h>
#include <utility>

namespace couchnode
{

class ShutdownHook;

typedef couchbase::core::utils::movable_function<void(Napi::Env,
                                                      Napi::Function)>
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
        : _state(std::make_shared<State>())
    {
        // Node destroys a thread-safe function when its environment is torn
        // down, whatever references remain, and runs this finalizer first.
        // The core can still answer or drop the operation afterwards, from
        // its own thread, so the finalizer marks the handle as gone.
        auto finalizeData = std::make_unique<std::shared_ptr<State>>(_state);
        _ttsf = CallCookieTTSF::New(
            env, jsCallback, resourceName, 0, 1, nullptr,
            [](Napi::Env, std::shared_ptr<State> *state, std::nullptr_t *) {
                {
                    std::lock_guard<std::mutex> lock((*state)->mutex);
                    (*state)->finalized = true;
                }
                delete state;
            },
            finalizeData.get());
        finalizeData.release();
        _ttsf.Ref(env);
    }

    CallCookie(CallCookie &o) = delete;

    // The thread-safe function wrapper copies its handle on a move, so take
    // it explicitly and leave the source with nothing to release.
    CallCookie(CallCookie &&o)
        : _state(std::move(o._state))
        , _ttsf(std::exchange(o._ttsf, CallCookieTTSF()))
    {
    }

    // A cookie destroyed before invoke() ran belongs to an operation whose
    // handler was dropped. Complete it with request_canceled, so the callback
    // still runs once and the thread-safe function is still released.
    ~CallCookie()
    {
        if (static_cast<napi_threadsafe_function>(_ttsf) == nullptr) {
            return;
        }
        invoke([](Napi::Env env, Napi::Function callback) {
            callback.Call({cbpp_to_js(
                env,
                std::error_code(couchbase::errc::common::request_canceled))});
        });
    }

    void invoke(FwdFunc &&callback)
    {
        // Declared before the lock, so a callback that is not queued is
        // destroyed after the lock is released.
        auto fn = std::make_unique<FwdFunc>(std::move(callback));
        auto ttsf = std::exchange(_ttsf, CallCookieTTSF());

        // Held across the call and the release, so the finalizer cannot run
        // between the check and the use.
        std::lock_guard<std::mutex> lock(_state->mutex);
        if (_state->finalized) {
            return;
        }

        auto status = ttsf.BlockingCall(fn.get());
        if (status == napi_ok) {
            fn.release();
        } else if (status != napi_closing) {
            CB_LOG_WARNING("Unable to queue callback for execution (status={})",
                           static_cast<int>(status));
        }

        // A thread-safe function that is closing has already dropped this
        // thread's reference, during environment teardown.
        if (status != napi_closing) {
            ttsf.Release();
        }
    }

private:
    struct State {
        std::mutex mutex;
        bool finalized = false;
    };

    std::shared_ptr<State> _state;
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

    couchbase::core::cluster cluster() const
    {
        return _instance->_cluster;
    }

    std::pair<std::optional<std::string>, std::optional<std::string>>
    getClusterLabels();

    Napi::Value jsConnect(const Napi::CallbackInfo &info);
    Napi::Value jsShutdown(const Napi::CallbackInfo &info);
    Napi::Value jsUpdateCredentials(const Napi::CallbackInfo &info);
    Napi::Value jsOpenBucket(const Napi::CallbackInfo &info);
    Napi::Value jsDiagnostics(const Napi::CallbackInfo &info);
    Napi::Value jsPing(const Napi::CallbackInfo &info);
    Napi::Value jsScan(const Napi::CallbackInfo &info);
    Napi::Value jsQueryStream(const Napi::CallbackInfo &info);
    Napi::Value jsGetClusterLabels(const Napi::CallbackInfo &info);
    Napi::Value jsStallIo(const Napi::CallbackInfo &info);
    Napi::Value jsDropCallback(const Napi::CallbackInfo &info);

    //#region Autogenerated Method Declarations

    Napi::Value jsPrepend(const Napi::CallbackInfo &info);
    Napi::Value jsPrependWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsExists(const Napi::CallbackInfo &info);
    Napi::Value jsHttpNoop(const Napi::CallbackInfo &info);
    Napi::Value jsUnlock(const Napi::CallbackInfo &info);
    Napi::Value jsGetAllReplicas(const Napi::CallbackInfo &info);
    Napi::Value jsUpsert(const Napi::CallbackInfo &info);
    Napi::Value jsUpsertWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsGetAnyReplica(const Napi::CallbackInfo &info);
    Napi::Value jsGetReplica(const Napi::CallbackInfo &info);
    Napi::Value jsAppend(const Napi::CallbackInfo &info);
    Napi::Value jsAppendWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsQuery(const Napi::CallbackInfo &info);
    Napi::Value jsReplace(const Napi::CallbackInfo &info);
    Napi::Value jsReplaceWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsGetAndTouch(const Napi::CallbackInfo &info);
    Napi::Value jsRemove(const Napi::CallbackInfo &info);
    Napi::Value jsRemoveWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsGet(const Napi::CallbackInfo &info);
    Napi::Value jsLookupInAllReplicas(const Napi::CallbackInfo &info);
    Napi::Value jsAnalytics(const Napi::CallbackInfo &info);
    Napi::Value jsGetProjected(const Napi::CallbackInfo &info);
    Napi::Value jsDecrement(const Napi::CallbackInfo &info);
    Napi::Value jsDecrementWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsSearch(const Napi::CallbackInfo &info);
    Napi::Value jsTouch(const Napi::CallbackInfo &info);
    Napi::Value jsLookupIn(const Napi::CallbackInfo &info);
    Napi::Value jsDocumentView(const Napi::CallbackInfo &info);
    Napi::Value jsGetAndLock(const Napi::CallbackInfo &info);
    Napi::Value jsInsert(const Napi::CallbackInfo &info);
    Napi::Value jsInsertWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsLookupInAnyReplica(const Napi::CallbackInfo &info);
    Napi::Value jsMutateIn(const Napi::CallbackInfo &info);
    Napi::Value jsMutateInWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsIncrement(const Napi::CallbackInfo &info);
    Napi::Value jsIncrementWithLegacyDurability(const Napi::CallbackInfo &info);
    Napi::Value jsManagementGroupUpsert(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementEventingPauseFunction(const Napi::CallbackInfo &info);
    Napi::Value jsManagementQueryIndexGetAll(const Napi::CallbackInfo &info);
    Napi::Value jsManagementCollectionCreate(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementEventingResumeFunction(const Napi::CallbackInfo &info);
    Napi::Value jsManagementSearchIndexGetStats(const Napi::CallbackInfo &info);
    Napi::Value jsManagementBucketGetAll(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementQueryIndexBuildDeferred(const Napi::CallbackInfo &info);
    Napi::Value jsManagementClusterDescribe(const Napi::CallbackInfo &info);
    Napi::Value jsManagementSearchIndexGetAll(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementSearchIndexAnalyzeDocument(const Napi::CallbackInfo &info);
    Napi::Value jsManagementQueryIndexDrop(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsDatasetCreate(const Napi::CallbackInfo &info);
    Napi::Value jsManagementBucketFlush(const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsIndexDrop(const Napi::CallbackInfo &info);
    Napi::Value jsManagementQueryIndexCreate(const Napi::CallbackInfo &info);
    Napi::Value jsManagementSearchIndexUpsert(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsDatasetGetAll(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsIndexGetAll(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsGetPendingMutations(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsDataverseDrop(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsLinkConnect(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementCollectionsManifestGet(const Napi::CallbackInfo &info);
    Napi::Value jsManagementChangePassword(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementClusterDeveloperPreviewEnable(const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkDrop(const Napi::CallbackInfo &info);
    Napi::Value jsManagementCollectionUpdate(const Napi::CallbackInfo &info);
    Napi::Value jsManagementBucketDescribe(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementEventingUpsertFunction(const Napi::CallbackInfo &info);
    Napi::Value jsManagementViewIndexGetAll(const Napi::CallbackInfo &info);
    Napi::Value jsManagementBucketGet(const Napi::CallbackInfo &info);
    Napi::Value jsManagementBucketUpdate(const Napi::CallbackInfo &info);
    Napi::Value jsManagementBucketDrop(const Napi::CallbackInfo &info);
    Napi::Value jsManagementFreeform(const Napi::CallbackInfo &info);
    Napi::Value jsManagementScopeDrop(const Napi::CallbackInfo &info);
    Napi::Value jsManagementViewIndexUpsert(const Napi::CallbackInfo &info);
    Napi::Value jsManagementUserGetAll(const Napi::CallbackInfo &info);
    Napi::Value jsManagementScopeCreate(const Napi::CallbackInfo &info);
    Napi::Value jsManagementEventingGetFunction(const Napi::CallbackInfo &info);
    Napi::Value jsManagementViewIndexDrop(const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkReplaceAzureBlobExternalLink(
        const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkReplaceCouchbaseRemoteLink(
        const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkReplaceS3ExternalLink(
        const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsLinkDisconnect(const Napi::CallbackInfo &info);
    Napi::Value jsManagementUserUpsert(const Napi::CallbackInfo &info);
    Napi::Value jsManagementEventingGetStatus(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementEventingGetAllFunctions(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsIndexCreate(const Napi::CallbackInfo &info);
    Napi::Value jsManagementScopeGetAll(const Napi::CallbackInfo &info);
    Napi::Value jsManagementUserGet(const Napi::CallbackInfo &info);
    Napi::Value jsManagementSearchIndexDrop(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementSearchIndexControlPlanFreeze(const Napi::CallbackInfo &info);
    Napi::Value jsManagementSearchGetStats(const Napi::CallbackInfo &info);
    Napi::Value jsManagementUserDrop(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsDataverseCreate(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementSearchIndexControlQuery(const Napi::CallbackInfo &info);
    Napi::Value jsManagementRoleGetAll(const Napi::CallbackInfo &info);
    Napi::Value jsManagementGroupGetAll(const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkCreateAzureBlobExternalLink(
        const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkCreateCouchbaseRemoteLink(
        const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkCreateS3ExternalLink(
        const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementEventingDropFunction(const Napi::CallbackInfo &info);
    Napi::Value jsManagementCollectionDrop(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementSearchIndexControlIngest(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementEventingDeployFunction(const Napi::CallbackInfo &info);
    Napi::Value jsManagementGroupGet(const Napi::CallbackInfo &info);
    Napi::Value jsManagementViewIndexGet(const Napi::CallbackInfo &info);
    Napi::Value jsManagementBucketCreate(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementAnalyticsDatasetDrop(const Napi::CallbackInfo &info);
    Napi::Value jsManagementGroupDrop(const Napi::CallbackInfo &info);
    Napi::Value jsManagementSearchIndexGet(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementQueryIndexGetAllDeferred(const Napi::CallbackInfo &info);
    Napi::Value jsManagementQueryIndexBuild(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementEventingUndeployFunction(const Napi::CallbackInfo &info);
    Napi::Value
    jsManagementSearchIndexGetDocumentsCount(const Napi::CallbackInfo &info);
    Napi::Value jsManagementAnalyticsLinkGetAll(const Napi::CallbackInfo &info);

    //#endregion Autogenerated Method Declarations

private:
    template <typename Request, typename Handler>
    void executeOp(const std::string &opName, const Request &req,
                   Napi::Function jsCallback, Handler &&handler)
    {
        using response_type = typename Request::response_type;

        auto cookie = CallCookie(jsCallback.Env(), jsCallback, opName);
        this->_instance->_cluster.execute(
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
                   Napi::Function jsCallback,
                   std::shared_ptr<couchbase::core::tracing::wrapper_sdk_span>
                       wrapperSpan = nullptr)
    {
        using response_type = typename Request::response_type;
        auto clusterLabels = wrapperSpan != nullptr
                                 ? this->getClusterLabels()
                                 : std::make_pair(std::optional<std::string>{},
                                                  std::optional<std::string>{});
        executeOp(
            opName, req, jsCallback,
            [wrapperSpan, clusterLabels = std::move(clusterLabels)](
                Napi::Env env, Napi::Function callback,
                response_type resp) mutable {
                Napi::Value jsErr, jsRes;
                try {
                    if (auto retries = get_cbpp_retries(resp.ctx);
                        retries > 0 && wrapperSpan) {
                        wrapperSpan->add_tag("retries", retries);
                    }
                    if (wrapperSpan) {
                        if (clusterLabels.first.has_value()) {
                            wrapperSpan->add_tag("cluster_name",
                                                 clusterLabels.first.value());
                        }
                        if (clusterLabels.second.has_value()) {
                            wrapperSpan->add_tag("cluster_uuid",
                                                 clusterLabels.second.value());
                        }
                    }
                    jsErr = cbpp_to_js(env, resp.ctx, wrapperSpan);
                    jsRes = cbpp_to_js(env, resp, wrapperSpan);
                } catch (const Napi::Error &e) {
                    Napi::Value err = e.Value();
                    Napi::Object errObj = err.As<Napi::Object>();
                    errObj.Set("cpp_core_span",
                               cbpp_wrapper_span_to_js(env, wrapperSpan));
                    jsErr = errObj;
                    jsRes = env.Null();
                }
                callback.Call({jsErr, jsRes});
            });
    }

    std::shared_ptr<Instance> _instance;
    std::shared_ptr<ShutdownHook> _shutdownHook;
};

} // namespace couchnode
