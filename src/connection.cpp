#include "connection.hpp"
#include "cas.hpp"
#include "instance.hpp"
#include "jstocbpp.hpp"
#include "mutationtoken.hpp"
#include "scan_iterator.hpp"
#include "transcoder.hpp"
#include <core/agent_group.hxx>
#include <core/operations/management/freeform.hxx>
#include <core/range_scan_orchestrator.hxx>
#include <core/utils/connection_string.hxx>
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
            InstanceMethod<&Connection::jsDiagnostics>("diagnostics"),
            InstanceMethod<&Connection::jsPing>("ping"),
            InstanceMethod<&Connection::jsScan>("scan"),

            //#region Autogenerated Method Registration

            InstanceMethod<&Connection::jsPrepend>("prepend"),
            InstanceMethod<&Connection::jsPrependWithLegacyDurability>(
                "prependWithLegacyDurability"),
            InstanceMethod<&Connection::jsExists>("exists"),
            InstanceMethod<&Connection::jsHttpNoop>("httpNoop"),
            InstanceMethod<&Connection::jsUnlock>("unlock"),
            InstanceMethod<&Connection::jsGetAllReplicas>("getAllReplicas"),
            InstanceMethod<&Connection::jsUpsert>("upsert"),
            InstanceMethod<&Connection::jsUpsertWithLegacyDurability>(
                "upsertWithLegacyDurability"),
            InstanceMethod<&Connection::jsGetAnyReplica>("getAnyReplica"),
            InstanceMethod<&Connection::jsAppend>("append"),
            InstanceMethod<&Connection::jsAppendWithLegacyDurability>(
                "appendWithLegacyDurability"),
            InstanceMethod<&Connection::jsQuery>("query"),
            InstanceMethod<&Connection::jsReplace>("replace"),
            InstanceMethod<&Connection::jsReplaceWithLegacyDurability>(
                "replaceWithLegacyDurability"),
            InstanceMethod<&Connection::jsGetAndTouch>("getAndTouch"),
            InstanceMethod<&Connection::jsRemove>("remove"),
            InstanceMethod<&Connection::jsRemoveWithLegacyDurability>(
                "removeWithLegacyDurability"),
            InstanceMethod<&Connection::jsGet>("get"),
            InstanceMethod<&Connection::jsLookupInAllReplicas>(
                "lookupInAllReplicas"),
            InstanceMethod<&Connection::jsAnalytics>("analytics"),
            InstanceMethod<&Connection::jsGetProjected>("getProjected"),
            InstanceMethod<&Connection::jsDecrement>("decrement"),
            InstanceMethod<&Connection::jsDecrementWithLegacyDurability>(
                "decrementWithLegacyDurability"),
            InstanceMethod<&Connection::jsSearch>("search"),
            InstanceMethod<&Connection::jsTouch>("touch"),
            InstanceMethod<&Connection::jsLookupIn>("lookupIn"),
            InstanceMethod<&Connection::jsDocumentView>("documentView"),
            InstanceMethod<&Connection::jsGetAndLock>("getAndLock"),
            InstanceMethod<&Connection::jsInsert>("insert"),
            InstanceMethod<&Connection::jsInsertWithLegacyDurability>(
                "insertWithLegacyDurability"),
            InstanceMethod<&Connection::jsLookupInAnyReplica>(
                "lookupInAnyReplica"),
            InstanceMethod<&Connection::jsMutateIn>("mutateIn"),
            InstanceMethod<&Connection::jsMutateInWithLegacyDurability>(
                "mutateInWithLegacyDurability"),
            InstanceMethod<&Connection::jsIncrement>("increment"),
            InstanceMethod<&Connection::jsIncrementWithLegacyDurability>(
                "incrementWithLegacyDurability"),
            InstanceMethod<&Connection::jsManagementGroupUpsert>(
                "managementGroupUpsert"),
            InstanceMethod<&Connection::jsManagementEventingPauseFunction>(
                "managementEventingPauseFunction"),
            InstanceMethod<&Connection::jsManagementQueryIndexGetAll>(
                "managementQueryIndexGetAll"),
            InstanceMethod<&Connection::jsManagementCollectionCreate>(
                "managementCollectionCreate"),
            InstanceMethod<&Connection::jsManagementEventingResumeFunction>(
                "managementEventingResumeFunction"),
            InstanceMethod<&Connection::jsManagementSearchIndexGetStats>(
                "managementSearchIndexGetStats"),
            InstanceMethod<&Connection::jsManagementBucketGetAll>(
                "managementBucketGetAll"),
            InstanceMethod<&Connection::jsManagementQueryIndexBuildDeferred>(
                "managementQueryIndexBuildDeferred"),
            InstanceMethod<&Connection::jsManagementClusterDescribe>(
                "managementClusterDescribe"),
            InstanceMethod<&Connection::jsManagementSearchIndexGetAll>(
                "managementSearchIndexGetAll"),
            InstanceMethod<&Connection::jsManagementSearchIndexAnalyzeDocument>(
                "managementSearchIndexAnalyzeDocument"),
            InstanceMethod<&Connection::jsManagementQueryIndexDrop>(
                "managementQueryIndexDrop"),
            InstanceMethod<&Connection::jsManagementAnalyticsDatasetCreate>(
                "managementAnalyticsDatasetCreate"),
            InstanceMethod<&Connection::jsManagementBucketFlush>(
                "managementBucketFlush"),
            InstanceMethod<&Connection::jsManagementAnalyticsIndexDrop>(
                "managementAnalyticsIndexDrop"),
            InstanceMethod<&Connection::jsManagementQueryIndexCreate>(
                "managementQueryIndexCreate"),
            InstanceMethod<&Connection::jsManagementSearchIndexUpsert>(
                "managementSearchIndexUpsert"),
            InstanceMethod<&Connection::jsManagementAnalyticsDatasetGetAll>(
                "managementAnalyticsDatasetGetAll"),
            InstanceMethod<&Connection::jsManagementAnalyticsIndexGetAll>(
                "managementAnalyticsIndexGetAll"),
            InstanceMethod<
                &Connection::jsManagementAnalyticsGetPendingMutations>(
                "managementAnalyticsGetPendingMutations"),
            InstanceMethod<&Connection::jsManagementAnalyticsDataverseDrop>(
                "managementAnalyticsDataverseDrop"),
            InstanceMethod<&Connection::jsManagementAnalyticsLinkConnect>(
                "managementAnalyticsLinkConnect"),
            InstanceMethod<&Connection::jsManagementCollectionsManifestGet>(
                "managementCollectionsManifestGet"),
            InstanceMethod<&Connection::jsManagementChangePassword>(
                "managementChangePassword"),
            InstanceMethod<
                &Connection::jsManagementClusterDeveloperPreviewEnable>(
                "managementClusterDeveloperPreviewEnable"),
            InstanceMethod<&Connection::jsManagementAnalyticsLinkDrop>(
                "managementAnalyticsLinkDrop"),
            InstanceMethod<&Connection::jsManagementCollectionUpdate>(
                "managementCollectionUpdate"),
            InstanceMethod<&Connection::jsManagementBucketDescribe>(
                "managementBucketDescribe"),
            InstanceMethod<&Connection::jsManagementEventingUpsertFunction>(
                "managementEventingUpsertFunction"),
            InstanceMethod<&Connection::jsManagementViewIndexGetAll>(
                "managementViewIndexGetAll"),
            InstanceMethod<&Connection::jsManagementBucketGet>(
                "managementBucketGet"),
            InstanceMethod<&Connection::jsManagementBucketUpdate>(
                "managementBucketUpdate"),
            InstanceMethod<&Connection::jsManagementBucketDrop>(
                "managementBucketDrop"),
            InstanceMethod<&Connection::jsManagementFreeform>(
                "managementFreeform"),
            InstanceMethod<&Connection::jsManagementScopeDrop>(
                "managementScopeDrop"),
            InstanceMethod<&Connection::jsManagementViewIndexUpsert>(
                "managementViewIndexUpsert"),
            InstanceMethod<&Connection::jsManagementUserGetAll>(
                "managementUserGetAll"),
            InstanceMethod<&Connection::jsManagementScopeCreate>(
                "managementScopeCreate"),
            InstanceMethod<&Connection::jsManagementEventingGetFunction>(
                "managementEventingGetFunction"),
            InstanceMethod<&Connection::jsManagementViewIndexDrop>(
                "managementViewIndexDrop"),
            InstanceMethod<
                &Connection::
                    jsManagementAnalyticsLinkReplaceAzureBlobExternalLink>(
                "managementAnalyticsLinkReplaceAzureBlobExternalLink"),
            InstanceMethod<
                &Connection::
                    jsManagementAnalyticsLinkReplaceCouchbaseRemoteLink>(
                "managementAnalyticsLinkReplaceCouchbaseRemoteLink"),
            InstanceMethod<
                &Connection::jsManagementAnalyticsLinkReplaceS3ExternalLink>(
                "managementAnalyticsLinkReplaceS3ExternalLink"),
            InstanceMethod<&Connection::jsManagementAnalyticsLinkDisconnect>(
                "managementAnalyticsLinkDisconnect"),
            InstanceMethod<&Connection::jsManagementUserUpsert>(
                "managementUserUpsert"),
            InstanceMethod<&Connection::jsManagementEventingGetStatus>(
                "managementEventingGetStatus"),
            InstanceMethod<&Connection::jsManagementEventingGetAllFunctions>(
                "managementEventingGetAllFunctions"),
            InstanceMethod<&Connection::jsManagementAnalyticsIndexCreate>(
                "managementAnalyticsIndexCreate"),
            InstanceMethod<&Connection::jsManagementScopeGetAll>(
                "managementScopeGetAll"),
            InstanceMethod<&Connection::jsManagementUserGet>(
                "managementUserGet"),
            InstanceMethod<&Connection::jsManagementSearchIndexDrop>(
                "managementSearchIndexDrop"),
            InstanceMethod<
                &Connection::jsManagementSearchIndexControlPlanFreeze>(
                "managementSearchIndexControlPlanFreeze"),
            InstanceMethod<&Connection::jsManagementSearchGetStats>(
                "managementSearchGetStats"),
            InstanceMethod<&Connection::jsManagementUserDrop>(
                "managementUserDrop"),
            InstanceMethod<&Connection::jsManagementAnalyticsDataverseCreate>(
                "managementAnalyticsDataverseCreate"),
            InstanceMethod<&Connection::jsManagementSearchIndexControlQuery>(
                "managementSearchIndexControlQuery"),
            InstanceMethod<&Connection::jsManagementRoleGetAll>(
                "managementRoleGetAll"),
            InstanceMethod<&Connection::jsManagementGroupGetAll>(
                "managementGroupGetAll"),
            InstanceMethod<
                &Connection::
                    jsManagementAnalyticsLinkCreateAzureBlobExternalLink>(
                "managementAnalyticsLinkCreateAzureBlobExternalLink"),
            InstanceMethod<
                &Connection::
                    jsManagementAnalyticsLinkCreateCouchbaseRemoteLink>(
                "managementAnalyticsLinkCreateCouchbaseRemoteLink"),
            InstanceMethod<
                &Connection::jsManagementAnalyticsLinkCreateS3ExternalLink>(
                "managementAnalyticsLinkCreateS3ExternalLink"),
            InstanceMethod<&Connection::jsManagementEventingDropFunction>(
                "managementEventingDropFunction"),
            InstanceMethod<&Connection::jsManagementCollectionDrop>(
                "managementCollectionDrop"),
            InstanceMethod<&Connection::jsManagementSearchIndexControlIngest>(
                "managementSearchIndexControlIngest"),
            InstanceMethod<&Connection::jsManagementEventingDeployFunction>(
                "managementEventingDeployFunction"),
            InstanceMethod<&Connection::jsManagementGroupGet>(
                "managementGroupGet"),
            InstanceMethod<&Connection::jsManagementViewIndexGet>(
                "managementViewIndexGet"),
            InstanceMethod<&Connection::jsManagementBucketCreate>(
                "managementBucketCreate"),
            InstanceMethod<&Connection::jsManagementAnalyticsDatasetDrop>(
                "managementAnalyticsDatasetDrop"),
            InstanceMethod<&Connection::jsManagementGroupDrop>(
                "managementGroupDrop"),
            InstanceMethod<&Connection::jsManagementSearchIndexGet>(
                "managementSearchIndexGet"),
            InstanceMethod<&Connection::jsManagementQueryIndexGetAllDeferred>(
                "managementQueryIndexGetAllDeferred"),
            InstanceMethod<&Connection::jsManagementQueryIndexBuild>(
                "managementQueryIndexBuild"),
            InstanceMethod<&Connection::jsManagementEventingUndeployFunction>(
                "managementEventingUndeployFunction"),
            InstanceMethod<
                &Connection::jsManagementSearchIndexGetDocumentsCount>(
                "managementSearchIndexGetDocumentsCount"),
            InstanceMethod<&Connection::jsManagementAnalyticsLinkGetAll>(
                "managementAnalyticsLinkGetAll"),

            //#endregion Autogenerated Method Registration
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
    auto callbackJsFn = info[3].As<Napi::Function>();

    auto connstrInfo = couchbase::core::utils::parse_connection_string(connstr);
    auto creds =
        jsToCbpp<couchbase::core::cluster_credentials>(credentialsJsObj);

    if (!info[2].IsNull()) {
        auto jsDnsConfigObj = info[2].As<Napi::Object>();
        auto jsNameserver = jsDnsConfigObj.Get("nameserver");
        if (jsNameserver.IsNull() || jsNameserver.IsUndefined() ||
            jsNameserver.IsEmpty()) {
            jsDnsConfigObj.Set(
                "nameserver",
                cbpp_to_js<std::string>(
                    info.Env(), connstrInfo.options.dns_config.nameserver()));
        }
        auto jsPort = jsDnsConfigObj.Get("port");
        if (jsPort.IsNull() || jsPort.IsUndefined()) {
            jsDnsConfigObj.Set(
                "port", cbpp_to_js<std::uint16_t>(
                            info.Env(), connstrInfo.options.dns_config.port()));
        }
        auto jsTimeout = jsDnsConfigObj.Get("dnsSrvTimeout");
        if (jsTimeout.IsNull() || jsTimeout.IsUndefined()) {
            jsDnsConfigObj.Set(
                "dnsSrvTimeout",
                cbpp_to_js<std::chrono::milliseconds>(
                    info.Env(), connstrInfo.options.dns_config.timeout()));
        }
        auto cppDnsConfig =
            jsToCbpp<couchbase::core::io::dns::dns_config>(jsDnsConfigObj);
        connstrInfo.options.dns_config = cppDnsConfig;
    }

    auto cookie = CallCookie(info.Env(), callbackJsFn, "cbConnectCallback");
    this->_instance->_cluster.open(
        couchbase::core::origin(creds, connstrInfo),
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
    this->_instance->_cluster.close([cookie = std::move(cookie)]() mutable {
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
    this->_instance->_cluster.open_bucket(
        bucketName, [cookie = std::move(cookie)](std::error_code ec) mutable {
            cookie.invoke([ec](Napi::Env env, Napi::Function callback) {
                callback.Call({cbpp_to_js(env, ec)});
            });
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
    this->_instance->_cluster.diagnostics(
        reportId, [cookie = std::move(cookie)](
                      couchbase::core::diag::diagnostics_result resp) mutable {
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
    auto services = jsToCbpp<std::set<couchbase::core::service_type>>(
        optsJsObj.Get("services"));
    auto timeout = jsToCbpp<std::optional<std::chrono::milliseconds>>(
        optsJsObj.Get("timeout"));

    auto cookie = CallCookie(info.Env(), callbackJsFn, "ping");
    this->_instance->_cluster.ping(
        reportId, bucketName, services, timeout,
        [cookie = std::move(cookie)](
            couchbase::core::diag::ping_result resp) mutable {
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

Napi::Value Connection::jsScan(const Napi::CallbackInfo &info)
{
    auto bucketName = info[0].ToString().Utf8Value();
    auto scopeName = info[1].ToString().Utf8Value();
    auto collectionName = info[2].ToString().Utf8Value();
    auto scanTypeName = info[3].ToString().Utf8Value();
    // scanType handled below
    auto optionsObj = info[5].As<Napi::Object>();

    auto env = info.Env();
    auto resObj = Napi::Object::New(env);

    auto barrier = std::make_shared<std::promise<
        tl::expected<couchbase::core::topology::configuration::vbucket_map,
                     std::error_code>>>();
    auto f = barrier->get_future();
    this->_instance->_cluster.with_bucket_configuration(
        bucketName,
        [barrier](
            std::error_code ec,
            std::shared_ptr<couchbase::core::topology::configuration> config) mutable {
            if (ec) {
                return barrier->set_value(tl::unexpected(ec));
            }
            if (!config->vbmap || config->vbmap->empty()) {
                return barrier->set_value(tl::unexpected(
                    couchbase::errc::common::feature_not_available));
            }
            barrier->set_value(config->vbmap.value());
        });
    auto vbucket_map = f.get();
    if (!vbucket_map.has_value()) {
        resObj.Set("cppErr", cbpp_to_js(env, vbucket_map.error()));
        resObj.Set("result", env.Null());
        return resObj;
    }

    auto agentGroup = couchbase::core::agent_group(
        this->_instance->_io,
        couchbase::core::agent_group_config{{this->_instance->_cluster}});
    agentGroup.open_bucket(bucketName);
    auto agent = agentGroup.get_agent(bucketName);
    auto options = js_to_cbpp<couchbase::core::range_scan_orchestrator_options>(
        optionsObj);

    if (!agent.has_value()) {
        resObj.Set("cppErr", cbpp_to_js(env, agent.error()));
        resObj.Set("result", env.Null());
        return resObj;
    }

    std::variant<std::monostate, couchbase::core::range_scan,
                 couchbase::core::prefix_scan, couchbase::core::sampling_scan>
        scanType;
    if (scanTypeName.compare("range_scan") == 0) {
        scanType = js_to_cbpp<couchbase::core::range_scan>(info[4]);
    } else if (scanTypeName.compare("sampling_scan") == 0) {
        scanType = js_to_cbpp<couchbase::core::sampling_scan>(info[4]);
    } else {
        scanType = js_to_cbpp<couchbase::core::prefix_scan>(info[4]);
    }

    auto orchestrator = couchbase::core::range_scan_orchestrator(
        this->_instance->_io, agent.value(), vbucket_map.value(), scopeName,
        collectionName, scanType, options);
    auto scanResult = orchestrator.scan();
    if (!scanResult.has_value()) {
        resObj.Set("cppErr", cbpp_to_js(env, scanResult.error()));
        resObj.Set("result", env.Null());
        return resObj;
    }

    auto ext = Napi::External<couchbase::core::scan_result>::New(
        env, &scanResult.value());
    auto scanIterator = ScanIterator::constructor(info.Env()).New({ext});
    resObj.Set("cppErr", env.Null());
    resObj.Set("result", scanIterator);

    return resObj;
}

} // namespace couchnode
