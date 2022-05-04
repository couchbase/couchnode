#pragma once
#include "jstocbpp_defs.hpp"

#include "jstocbpp_basic.hpp"
#include "jstocbpp_cpptypes.hpp"

#include <couchbase/cluster.hxx>
#include <couchbase/transactions.hxx>
#include <couchbase/transactions/internal/exceptions_internal.hxx>

namespace cbtxns = couchbase::transactions;

namespace couchnode
{

// nlohmann::json (used by transactions currently)
template <>
struct js_to_cbpp_t<nlohmann::json> {
    static inline Napi::Value to_js(Napi::Env env, const nlohmann::json &cppObj)
    {
        return Napi::String::New(env, cppObj.dump());
    }

    static inline nlohmann::json from_js(Napi::Value jsVal)
    {
        auto cppStr = jsVal.As<Napi::String>().Utf8Value();
        return nlohmann::json::parse(cppStr);
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_config> {
    static inline cbtxns::transaction_config from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        cbtxns::transaction_config cppObj;

        auto durability_level =
            js_to_cbpp<std::optional<couchbase::protocol::durability_level>>(
                jsObj.Get("durability_level"));
        if (durability_level.has_value()) {
            // BUG(JSCBC-1012): This translation should not be neccessary.
            switch (durability_level.value()) {
            case couchbase::protocol::durability_level::none:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::NONE);
                break;
            case couchbase::protocol::durability_level::majority:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::MAJORITY);
                break;
            case couchbase::protocol::durability_level::
                majority_and_persist_to_active:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::
                        MAJORITY_AND_PERSIST_TO_ACTIVE);
                break;
            case couchbase::protocol::durability_level::persist_to_majority:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::
                        PERSIST_TO_MAJORITY);
                break;
            default:
                throw Napi::Error::New(
                    jsVal.Env(), "unexpected transaction durability level");
            }
        }

        auto kv_timeout = js_to_cbpp<std::optional<std::chrono::milliseconds>>(
            jsObj.Get("kv_timeout"));
        if (kv_timeout.has_value()) {
            cppObj.kv_timeout(kv_timeout.value());
        }

        auto expiration_time =
            js_to_cbpp<std::optional<std::chrono::milliseconds>>(
                jsObj.Get("expiration_time"));
        if (expiration_time.has_value()) {
            cppObj.expiration_time(expiration_time.value());
        }

        auto query_scan_consistency =
            js_to_cbpp<std::optional<couchbase::query_scan_consistency>>(
                jsObj.Get("query_scan_consistency"));
        if (query_scan_consistency.has_value()) {
            cppObj.scan_consistency(query_scan_consistency.value());
        }

        auto cleanup_window =
            js_to_cbpp<std::optional<std::chrono::milliseconds>>(
                jsObj.Get("cleanup_window"));
        if (cleanup_window.has_value()) {
            cppObj.cleanup_window(cleanup_window.value());
        }

        auto cleanup_lost_attempts =
            js_to_cbpp<std::optional<bool>>(jsObj.Get("cleanup_lost_attempts"));
        if (cleanup_lost_attempts.has_value()) {
            cppObj.cleanup_lost_attempts(cleanup_lost_attempts.value());
        }

        auto cleanup_client_attempts = js_to_cbpp<std::optional<bool>>(
            jsObj.Get("cleanup_client_attempts"));
        if (cleanup_client_attempts.has_value()) {
            cppObj.cleanup_client_attempts(cleanup_client_attempts.value());
        }

        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::per_transaction_config> {
    static inline cbtxns::per_transaction_config from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        cbtxns::per_transaction_config cppObj;

        auto durability_level =
            js_to_cbpp<std::optional<couchbase::protocol::durability_level>>(
                jsObj.Get("durability_level"));
        if (durability_level.has_value()) {
            // BUG(JSCBC-1012): This translation should not be neccessary.
            switch (durability_level.value()) {
            case couchbase::protocol::durability_level::none:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::NONE);
                break;
            case couchbase::protocol::durability_level::majority:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::MAJORITY);
                break;
            case couchbase::protocol::durability_level::
                majority_and_persist_to_active:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::
                        MAJORITY_AND_PERSIST_TO_ACTIVE);
                break;
            case couchbase::protocol::durability_level::persist_to_majority:
                cppObj.durability_level(
                    couchbase::transactions::durability_level::
                        PERSIST_TO_MAJORITY);
                break;
            default:
                throw Napi::Error::New(
                    jsVal.Env(), "unexpected transaction durability level");
            }
        }

        auto kv_timeout = js_to_cbpp<std::optional<std::chrono::milliseconds>>(
            jsObj.Get("kv_timeout"));
        if (kv_timeout.has_value()) {
            cppObj.kv_timeout(kv_timeout.value());
        }

        auto expiration_time =
            js_to_cbpp<std::optional<std::chrono::milliseconds>>(
                jsObj.Get("expiration_time"));
        if (expiration_time.has_value()) {
            cppObj.expiration_time(expiration_time.value());
        }

        auto query_scan_consistency =
            js_to_cbpp<std::optional<couchbase::query_scan_consistency>>(
                jsObj.Get("query_scan_consistency"));
        if (query_scan_consistency.has_value()) {
            cppObj.scan_consistency(query_scan_consistency.value());
        }

        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_links> {
    static inline cbtxns::transaction_links from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbtxns::transaction_links(
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("atr_id")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("atr_bucket_name")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("atr_scope_name")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("atr_collection_name")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("staged_transaction_id")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("staged_attempt_id")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("staged_content")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("cas_pre_txn")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("revid_pre_txn")),
            js_to_cbpp<std::optional<uint32_t>>(jsObj.Get("exptime_pre_txn")),
            js_to_cbpp<std::optional<std::string>>(
                jsObj.Get("crc32_of_staging")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("op")),
            js_to_cbpp<std::optional<nlohmann::json>>(
                jsObj.Get("forward_compat")),
            js_to_cbpp<bool>(jsObj.Get("is_deleted")));
    }

    static inline Napi::Value to_js(Napi::Env env,
                                    const cbtxns::transaction_links &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("atr_id", cbpp_to_js(env, res.atr_id()));
        resObj.Set("atr_bucket_name", cbpp_to_js(env, res.atr_bucket_name()));
        resObj.Set("atr_scope_name", cbpp_to_js(env, res.atr_scope_name()));
        resObj.Set("atr_collection_name",
                   cbpp_to_js(env, res.atr_collection_name()));
        resObj.Set("staged_transaction_id",
                   cbpp_to_js(env, res.staged_transaction_id()));
        resObj.Set("staged_attempt_id",
                   cbpp_to_js(env, res.staged_attempt_id()));
        resObj.Set("staged_content", cbpp_to_js(env, res.staged_content()));
        resObj.Set("cas_pre_txn", cbpp_to_js(env, res.cas_pre_txn()));
        resObj.Set("revid_pre_txn", cbpp_to_js(env, res.revid_pre_txn()));
        resObj.Set("exptime_pre_txn", cbpp_to_js(env, res.exptime_pre_txn()));
        resObj.Set("crc32_of_staging", cbpp_to_js(env, res.crc32_of_staging()));
        resObj.Set("op", cbpp_to_js(env, res.op()));
        resObj.Set("forward_compat", cbpp_to_js(env, res.forward_compat()));
        resObj.Set("is_deleted", cbpp_to_js(env, res.is_deleted()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::document_metadata> {
    static inline cbtxns::document_metadata from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbtxns::document_metadata(
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("cas")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("revid")),
            js_to_cbpp<std::optional<uint32_t>>(jsObj.Get("exptime")),
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("crc32")));
    }

    static inline Napi::Value to_js(Napi::Env env,
                                    const cbtxns::document_metadata &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, res.cas()));
        resObj.Set("revid", cbpp_to_js(env, res.revid()));
        resObj.Set("exptime", cbpp_to_js(env, res.exptime()));
        resObj.Set("crc32", cbpp_to_js(env, res.crc32()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_get_result> {
    static inline cbtxns::transaction_get_result from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return cbtxns::transaction_get_result(
            js_to_cbpp<couchbase::document_id>(jsObj.Get("id")),
            js_to_cbpp<couchbase::json_string>(jsObj.Get("content")).str(),
            js_to_cbpp<couchbase::cas>(jsObj.Get("cas")).value,
            js_to_cbpp<cbtxns::transaction_links>(jsObj.Get("links")),
            js_to_cbpp<std::optional<cbtxns::document_metadata>>(
                jsObj.Get("metadata")));
    }

    static inline Napi::Value to_js(Napi::Env env,
                                    const cbtxns::transaction_get_result &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("id", cbpp_to_js(env, res.id()));
        resObj.Set("content", cbpp_to_js(env, couchbase::json_string(
                                                  res.content<std::string>())));
        resObj.Set("cas", cbpp_to_js(env, couchbase::cas{res.cas()}));
        resObj.Set("links", cbpp_to_js(env, res.links()));
        resObj.Set("metadata", cbpp_to_js(env, res.metadata()));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_query_options> {
    static inline cbtxns::transaction_query_options from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        cbtxns::transaction_query_options cppObj;

        auto raw = js_to_cbpp<
            std::optional<std::map<std::string, couchbase::json_string>>>(
            jsObj.Get("raw"));
        if (raw.has_value()) {
            for (auto &v : *raw) {
                cppObj.raw(v.first, v.second);
            }
        }

        auto ad_hoc = js_to_cbpp<std::optional<bool>>(jsObj.Get("ad_hoc"));
        if (ad_hoc.has_value()) {
            cppObj.ad_hoc(ad_hoc.value());
        }

        auto scan_consistency =
            js_to_cbpp<std::optional<couchbase::query_scan_consistency>>(
                jsObj.Get("scan_consistency"));
        if (scan_consistency.has_value()) {
            cppObj.scan_consistency(scan_consistency.value());
        }

        auto profile = js_to_cbpp<std::optional<couchbase::query_profile_mode>>(
            jsObj.Get("profile"));
        if (profile.has_value()) {
            cppObj.profile(profile.value());
        }

        auto metrics = js_to_cbpp<std::optional<bool>>(jsObj.Get("metrics"));
        if (metrics.has_value()) {
            cppObj.metrics(metrics.value());
        }

        auto client_context_id = js_to_cbpp<std::optional<std::string>>(
            jsObj.Get("client_context_id"));
        if (client_context_id.has_value()) {
            cppObj.client_context_id(client_context_id.value());
        }

        auto scan_wait = js_to_cbpp<std::optional<std::chrono::milliseconds>>(
            jsObj.Get("scan_wait"));
        if (scan_wait.has_value()) {
            cppObj.scan_wait(scan_wait.value());
        }

        auto readonly = js_to_cbpp<std::optional<bool>>(jsObj.Get("readonly"));
        if (readonly.has_value()) {
            cppObj.readonly(readonly.value());
        }

        auto scan_cap =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("scan_cap"));
        if (scan_cap.has_value()) {
            cppObj.scan_cap(scan_cap.value());
        }

        auto pipeline_batch =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("pipeline_batch"));
        if (pipeline_batch.has_value()) {
            cppObj.pipeline_batch(pipeline_batch.value());
        }

        auto pipeline_cap =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("pipeline_cap"));
        if (pipeline_cap.has_value()) {
            cppObj.pipeline_cap(pipeline_cap.value());
        }

        auto max_parallelism =
            js_to_cbpp<std::optional<uint64_t>>(jsObj.Get("max_parallelism"));
        if (max_parallelism.has_value()) {
            cppObj.max_parallelism(max_parallelism.value());
        }

        auto positional_parameters =
            js_to_cbpp<std::optional<std::vector<couchbase::json_string>>>(
                jsObj.Get("positional_parameters"));
        if (positional_parameters.has_value()) {
            cppObj.positional_parameters(positional_parameters.value());
        }

        auto named_parameters = js_to_cbpp<
            std::optional<std::map<std::string, couchbase::json_string>>>(
            jsObj.Get("named_parameters"));
        if (named_parameters.has_value()) {
            cppObj.named_parameters(named_parameters.value());
        }

        auto bucket_name =
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("bucket_name"));
        if (bucket_name.has_value()) {
            cppObj.bucket_name(bucket_name.value());
        }

        auto scope_name =
            js_to_cbpp<std::optional<std::string>>(jsObj.Get("scope_name"));
        if (scope_name.has_value()) {
            cppObj.scope_name(scope_name.value());
        }

        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_operation_failed> {
    static inline Napi::Value
    to_js(Napi::Env env, const cbtxns::transaction_operation_failed &err)
    {
        Napi::Error jsErr = Napi::Error::New(env, "transaction_exception");
        jsErr.Set("ctxtype",
                  Napi::String::New(env, "transaction_operation_failed"));
        jsErr.Set("should_not_retry", cbpp_to_js(env, !err.should_retry()));
        jsErr.Set("should_not_rollback",
                  cbpp_to_js(env, !err.should_rollback()));
        jsErr.Set("cause", cbpp_to_js(env, err.cause()));
        return jsErr.Value();
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_exception> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const cbtxns::transaction_exception &err)
    {
        Napi::Error jsErr = Napi::Error::New(env, "transaction_exception");
        jsErr.Set("ctxtype", Napi::String::New(env, "transaction_exception"));
        jsErr.Set("result", cbpp_to_js(env, err.get_transaction_result()));
        jsErr.Set("cause", cbpp_to_js(env, err.cause()));
        jsErr.Set("type", cbpp_to_js(env, err.type()));
        return jsErr.Value();
    }
};

template <>
struct js_to_cbpp_t<cbtxns::transaction_result> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const cbtxns::transaction_result &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("transaction_id", cbpp_to_js(env, res.transaction_id));
        resObj.Set("unstaging_complete",
                   cbpp_to_js(env, res.unstaging_complete));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<std::exception_ptr> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::exception_ptr &err)
    {
        if (!err) {
            return env.Null();
        }

        try {
            std::rethrow_exception(err);
        } catch (const cbtxns::transaction_operation_failed &err) {
            return cbpp_to_js(env, err);
        } catch (const std::exception &err) {
            return cbpp_to_js(env, err);
        } catch (...) {
            return Napi::Error::New(env, "unexpected c++ error").Value();
        }
    }
};

} // namespace couchnode
