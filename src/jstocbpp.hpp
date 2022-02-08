#pragma once
#include "cas.hpp"
#include "mutationtoken.hpp"
#include "transcoder.hpp"
#include <couchbase/cluster.hxx>
#include <couchbase/operations/management/error_utils.hxx>
#include <couchbase/operations/management/freeform.hxx>
#include <couchbase/transactions.hxx>
#include <couchbase/transactions/internal/exceptions_internal.hxx>
#include <map>
#include <napi.h>
#include <optional>
#include <set>
#include <variant>
#include <vector>

namespace cbtxns = couchbase::transactions;

namespace couchnode
{

template <typename T, typename Enabled = void>
struct js_to_cbpp_t;

template <typename T>
static inline T js_to_cbpp(Napi::Value jsVal)
{
    return js_to_cbpp_t<T>::from_js(jsVal);
}

template <typename T>
static inline void js_to_cbpp(T &cppObj, Napi::Value jsVal)
{
    cppObj = js_to_cbpp_t<T>::from_js(jsVal);
}

template <typename T>
static inline Napi::Value cbpp_to_js(Napi::Env env, const T &cppObj)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj);
}

template <typename T>
static inline Napi::Value cbpp_to_js(Napi::Env env, const T &cppObj,
                                     const Transcoder &transcoder)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj, transcoder);
}

// integral types
template <typename T>
struct js_to_cbpp_t<T, typename std::enable_if_t<std::is_integral_v<T>>> {
    static inline Napi::Value to_js(Napi::Env env, T cppObj)
    {
        if constexpr (std::is_same_v<T, bool>) {
            return Napi::Boolean::New(env, cppObj);
        } else {
            return Napi::Number::New(env, cppObj);
        }
    }

    static inline T from_js(Napi::Value jsVal)
    {
        if constexpr (std::is_same_v<T, bool>) {
            return jsVal.ToBoolean().Value();
        } else {
            return static_cast<T>(jsVal.ToNumber().Int64Value());
        }
    }
};

// floating point types
template <typename T>
struct js_to_cbpp_t<T, typename std::enable_if_t<std::is_floating_point_v<T>>> {
    static inline Napi::Value to_js(Napi::Env env, T cppObj)
    {
        return Napi::Number::New(env, cppObj);
    }

    static inline T from_js(Napi::Value jsVal)
    {
        return static_cast<T>(jsVal.ToNumber().DoubleValue());
    }
};

// enum types
template <typename T>
struct js_to_cbpp_t<T, typename std::enable_if_t<std::is_enum_v<T>>> {
    static inline Napi::Value to_js(Napi::Env env, T cppObj)
    {
        return Napi::Number::New(env, static_cast<int64_t>(cppObj));
    }

    static inline T from_js(Napi::Value jsVal)
    {
        return static_cast<T>(jsVal.ToNumber().Int64Value());
    }
};

// std::string type
template <>
struct js_to_cbpp_t<std::string> {
    static inline Napi::Value to_js(Napi::Env env, const std::string &cppObj)
    {
        return Napi::String::New(env, cppObj);
    }

    static inline std::string from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return "";
        }

        return jsVal.ToString().Utf8Value();
    }
};

// std::chrono::nanoseconds type
template <>
struct js_to_cbpp_t<std::chrono::nanoseconds> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::chrono::nanoseconds &cppObj)
    {
        return Napi::Number::New(env, cppObj / std::chrono::milliseconds(1));
    }

    static inline std::chrono::nanoseconds from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined() || jsVal.IsNull()) {
            return std::chrono::nanoseconds::zero();
        }

        return jsVal.ToNumber().Int64Value() * std::chrono::milliseconds(1);
    }
};

// std::chrono::microseconds type
template <>
struct js_to_cbpp_t<std::chrono::microseconds> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::chrono::microseconds &cppObj)
    {
        return Napi::Number::New(env, cppObj / std::chrono::milliseconds(1));
    }

    static inline std::chrono::microseconds from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined() || jsVal.IsNull()) {
            return std::chrono::microseconds::zero();
        }

        return jsVal.ToNumber().Int64Value() * std::chrono::milliseconds(1);
    }
};

// std::chrono::milliseconds type
template <>
struct js_to_cbpp_t<std::chrono::milliseconds> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::chrono::milliseconds &cppObj)
    {
        return Napi::Number::New(env, cppObj / std::chrono::milliseconds(1));
    }

    static inline std::chrono::milliseconds from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined() || jsVal.IsNull()) {
            return std::chrono::milliseconds::zero();
        }

        return jsVal.ToNumber().Int64Value() * std::chrono::milliseconds(1);
    }
};

// std::monostate type
template <>
struct js_to_cbpp_t<std::monostate> {
    static inline Napi::Value to_js(Napi::Env env, const std::monostate &cppObj)
    {
        return env.Undefined();
    }
};

// std::optional type
template <typename T>
struct js_to_cbpp_t<std::optional<T>> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::optional<T> &cppObj)
    {
        if (!cppObj.has_value()) {
            return env.Undefined();
        }
        return cbpp_to_js<T>(env, cppObj.value());
    }

    static inline std::optional<T> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsUndefined()) {
            return std::optional<T>();
        }
        return js_to_cbpp<T>(jsVal);
    }
};

// std::vector type
template <typename T>
struct js_to_cbpp_t<std::vector<T>> {
    static inline Napi::Value to_js(Napi::Env env, const std::vector<T> &cppObj)
    {
        auto jsArr = Napi::Array::New(env);
        for (auto i = 0; i < cppObj.size(); ++i) {
            jsArr.Set(i, cbpp_to_js<T>(env, cppObj[i]));
        }
        return jsArr;
    }

    static inline std::vector<T> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        std::vector<T> cppObj;
        auto jsArr = jsVal.As<Napi::Array>();
        for (auto i = 0; i < jsArr.Length(); ++i) {
            cppObj.emplace_back(js_to_cbpp<T>(jsArr.Get(i)));
        }
        return cppObj;
    }
};

// std::set type
template <typename T>
struct js_to_cbpp_t<std::set<T>> {
    static inline Napi::Value to_js(Napi::Env env, const std::set<T> &cppObj)
    {
        auto jsArr = Napi::Array::New(env);
        auto cppObjVec = std::vector<T>(cppObj.begin(), cppObj.end());
        for (auto i = 0; i < cppObjVec.size(); ++i) {
            jsArr.Set(i, cbpp_to_js<T>(env, cppObjVec[i]));
        }
        return jsArr;
    }

    static inline std::set<T> from_js(Napi::Value jsVal)
    {
        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        std::set<T> cppObj;
        auto jsArr = jsVal.As<Napi::Array>();
        for (auto i = 0; i < jsArr.Length(); ++i) {
            cppObj.insert(js_to_cbpp<T>(jsArr.Get(i)));
        }
        return cppObj;
    }
};

// std::map<string, ...> type
template <typename T>
struct js_to_cbpp_t<std::map<std::string, T>> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::map<std::string, T> &cppObj)
    {
        auto jsObj = Napi::Object::New(env);
        for (const auto &i : cppObj) {
            jsObj.Set(i.first, cbpp_to_js<T>(env, i.second));
        }
        return jsObj;
    }

    static inline std::map<std::string, T> from_js(Napi::Value jsVal)
    {

        if (jsVal.IsEmpty() || jsVal.IsNull() || jsVal.IsUndefined()) {
            return {};
        }

        std::map<std::string, T> cppObj;
        auto jsObj = jsVal.As<Napi::Object>();
        auto jsPropNames = jsObj.GetPropertyNames();
        for (auto i = 0; i < jsPropNames.Length(); ++i) {
            auto jsKey = jsPropNames.Get(i);
            auto key = jsKey.As<Napi::String>().Utf8Value();
            auto value = js_to_cbpp<T>(jsObj.Get(jsKey));
            cppObj.emplace(key, value);
        }
        return cppObj;
    }
};

// std::map<enum, ...> type
template <typename K, typename T>
struct js_to_cbpp_t<std::map<K, T>,
                    typename std::enable_if_t<std::is_enum_v<K>>> {
    static inline Napi::Value to_js(Napi::Env env, const std::map<K, T> &cppObj)
    {
        using enum_type_t = std::underlying_type_t<K>;
        auto jsObj = Napi::Object::New(env);
        for (const auto &i : cppObj) {
            jsObj.Set(std::to_string(static_cast<enum_type_t>(i.first)),
                      cbpp_to_js<T>(env, i.second));
        }
        return jsObj;
    }
};

// std::variant type
template <typename... Types>
struct js_to_cbpp_t<std::variant<Types...>> {
    template <size_t I = 0>
    static inline Napi::Value to_js(Napi::Env env,
                                    const std::variant<Types...> &cppObj)
    {
        using V = std::variant<Types...>;

        if constexpr (I < std::variant_size_v<V>) {
            using VT = std::variant_alternative_t<I, V>;
            if (std::holds_alternative<VT>(cppObj)) {
                return cbpp_to_js(env, std::get<VT>(cppObj));
            }

            return to_js<I + 1>(env, cppObj);
        }

        throw Napi::Error::New(env, "invalid variant type value");
    }
};

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
struct js_to_cbpp_t<couchbase::json_string> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::json_string &cppObj)
    {
        Napi::String jsonString = Napi::String::New(env, cppObj.str());
        Napi::Object json = env.Global().Get("JSON").As<Napi::Object>();
        Napi::Function parse = json.Get("parse").As<Napi::Function>();
        return parse.Call(json, {jsonString});
    }

    static inline couchbase::json_string from_js(Napi::Value jsVal)
    {
        Napi::Object json = jsVal.Env().Global().Get("JSON").As<Napi::Object>();
        Napi::Function stringify = json.Get("stringify").As<Napi::Function>();
        Napi::String jsonString =
            stringify.Call(json, {jsVal}).As<Napi::String>();
        return jsonString.Utf8Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::cluster_credentials> {
    static inline couchbase::cluster_credentials from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::cluster_credentials cppObj;
        js_to_cbpp(cppObj.username, jsObj.Get("username"));
        js_to_cbpp(cppObj.password, jsObj.Get("password"));
        js_to_cbpp(cppObj.certificate_path, jsObj.Get("certificate_path"));
        js_to_cbpp(cppObj.key_path, jsObj.Get("key_path"));
        js_to_cbpp(cppObj.allowed_sasl_mechanisms,
                   jsObj.Get("allowed_sasl_mechanisms"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::document_id> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::document_id &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("bucket", cbpp_to_js(env, cppObj.bucket()));
        resObj.Set("scope", cbpp_to_js(env, cppObj.scope()));
        resObj.Set("collection", cbpp_to_js(env, cppObj.collection()));
        resObj.Set("key", cbpp_to_js(env, cppObj.key()));
        return resObj;
    }

    static inline couchbase::document_id from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return couchbase::document_id(
            js_to_cbpp<std::string>(jsObj.Get("bucket")),
            js_to_cbpp<std::string>(jsObj.Get("scope")),
            js_to_cbpp<std::string>(jsObj.Get("collection")),
            js_to_cbpp<std::string>(jsObj.Get("key")));
    }
};

template <>
struct js_to_cbpp_t<couchbase::protocol::cas> {
    static inline Napi::Value to_js(Napi::Env env,
                                    couchbase::protocol::cas cppObj)
    {
        return Cas::create(env, cppObj);
    }

    static inline couchbase::protocol::cas from_js(Napi::Value jsVal)
    {
        return Cas::parse(jsVal);
    }
};

template <>
struct js_to_cbpp_t<couchbase::mutation_token> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::mutation_token &cppObj)
    {
        return MutationToken::create(env, cppObj);
    }

    static inline couchbase::mutation_token from_js(Napi::Value jsVal)
    {
        return MutationToken::parse(jsVal);
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::get_request> {
    static inline couchbase::operations::get_request from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::get_request cppObj;
        js_to_cbpp(cppObj.id, jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::get_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::get_response &cppObj,
          const Transcoder &transcoder)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("content",
                   transcoder.decode(env, cppObj.value, cppObj.flags));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::exists_request> {
    static inline couchbase::operations::exists_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::exists_request cppObj;
        js_to_cbpp(cppObj.id, jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::exists_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::exists_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("deleted", cbpp_to_js(env, cppObj.deleted));
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("flags", cbpp_to_js(env, cppObj.flags));
        resObj.Set("expiry", cbpp_to_js(env, cppObj.expiry));
        resObj.Set("sequence_number", cbpp_to_js(env, cppObj.sequence_number));
        resObj.Set("datatype", cbpp_to_js(env, cppObj.datatype));
        resObj.Set("exists", cbpp_to_js(env, cppObj.exists()));

        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::get_and_lock_request> {
    static inline couchbase::operations::get_and_lock_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::get_and_lock_request cppObj;
        js_to_cbpp(cppObj.id, jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.lock_time, jsObj.Get("lock_time"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::get_and_lock_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::get_and_lock_response &cppObj,
          const Transcoder &transcoder)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("content",
                   transcoder.decode(env, cppObj.value, cppObj.flags));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::get_and_touch_request> {
    static inline couchbase::operations::get_and_touch_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::get_and_touch_request cppObj;
        js_to_cbpp(cppObj.id, jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::get_and_touch_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::get_and_touch_response &cppObj,
          const Transcoder &transcoder)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("content",
                   transcoder.decode(env, cppObj.value, cppObj.flags));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::insert_request> {
    static inline couchbase::operations::insert_request
    from_js(Napi::Value jsVal, const Transcoder &transcoder)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::insert_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        std::tie(cppObj.value, cppObj.flags) =
            transcoder.encode(jsObj.Get("content"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::insert_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::insert_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::upsert_request> {
    static inline couchbase::operations::upsert_request
    from_js(Napi::Value jsVal, const Transcoder &transcoder)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::upsert_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        js_to_cbpp(cppObj.preserve_expiry, jsObj.Get("preserve_expiry"));
        std::tie(cppObj.value, cppObj.flags) =
            transcoder.encode(jsObj.Get("content"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::upsert_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::upsert_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::replace_request> {
    static inline couchbase::operations::replace_request
    from_js(Napi::Value jsVal, const Transcoder &transcoder)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::replace_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.cas, jsObj.Get("cas"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        js_to_cbpp(cppObj.preserve_expiry, jsObj.Get("preserve_expiry"));
        std::tie(cppObj.value, cppObj.flags) =
            transcoder.encode(jsObj.Get("content"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::replace_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::replace_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::remove_request> {
    static inline couchbase::operations::remove_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::remove_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.cas, jsObj.Get("cas"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::remove_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::remove_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::touch_request> {
    static inline couchbase::operations::touch_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::touch_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::touch_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::touch_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::unlock_request> {
    static inline couchbase::operations::unlock_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::unlock_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.cas, jsObj.Get("cas"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::unlock_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::unlock_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::append_request> {
    static inline couchbase::operations::append_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::append_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        js_to_cbpp(cppObj.value, jsObj.Get("value"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::append_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::append_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::prepend_request> {
    static inline couchbase::operations::prepend_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::prepend_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        js_to_cbpp(cppObj.value, jsObj.Get("value"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::prepend_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::prepend_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::increment_request> {
    static inline couchbase::operations::increment_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::increment_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.delta, jsObj.Get("delta"));
        js_to_cbpp(cppObj.initial_value, jsObj.Get("initial_value"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        js_to_cbpp(cppObj.preserve_expiry, jsObj.Get("preserve_expiry"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::increment_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::increment_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("content", cbpp_to_js(env, cppObj.content));
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::decrement_request> {
    static inline couchbase::operations::decrement_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::decrement_request cppObj;
        cppObj.id = js_to_cbpp<couchbase::document_id>(jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.delta, jsObj.Get("delta"));
        js_to_cbpp(cppObj.initial_value, jsObj.Get("initial_value"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        js_to_cbpp(cppObj.preserve_expiry, jsObj.Get("preserve_expiry"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::decrement_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::decrement_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("content", cbpp_to_js(env, cppObj.content));
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::protocol::lookup_in_request_body::lookup_in_specs::entry> {
    static inline couchbase::protocol::lookup_in_request_body::lookup_in_specs::
        entry
        from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::protocol::lookup_in_request_body::lookup_in_specs::entry
            cppObj;
        js_to_cbpp(cppObj.opcode, jsObj.Get("opcode"));
        js_to_cbpp(cppObj.flags, jsObj.Get("flags"));
        js_to_cbpp(cppObj.path, jsObj.Get("path"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::protocol::lookup_in_request_body::lookup_in_specs> {
    static inline couchbase::protocol::lookup_in_request_body::lookup_in_specs
    from_js(Napi::Value jsVal)
    {
        // we just forward the array to our std::vector handler
        couchbase::protocol::lookup_in_request_body::lookup_in_specs cppObj;
        js_to_cbpp(cppObj.entries, jsVal);
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::lookup_in_request> {
    static inline couchbase::operations::lookup_in_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::lookup_in_request cppObj;
        js_to_cbpp(cppObj.id, jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.access_deleted, jsObj.Get("access_deleted"));
        js_to_cbpp(cppObj.specs, jsObj.Get("specs"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::lookup_in_response::field> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::lookup_in_response::field &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("error", cbpp_to_js(env, cppObj.ec));
        resObj.Set("opcode", cbpp_to_js(env, cppObj.opcode));
        resObj.Set("exists", cbpp_to_js(env, cppObj.exists));
        resObj.Set("status", cbpp_to_js(env, cppObj.status));
        resObj.Set("path", cbpp_to_js(env, cppObj.path));
        resObj.Set("value", cbpp_to_js(env, cppObj.value));
        resObj.Set("original_index", cbpp_to_js(env, cppObj.original_index));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::lookup_in_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::lookup_in_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("fields", cbpp_to_js(env, cppObj.fields));
        resObj.Set("deleted", cbpp_to_js(env, cppObj.deleted));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::protocol::mutate_in_request_body::mutate_in_specs::entry> {
    static inline couchbase::protocol::mutate_in_request_body::mutate_in_specs::
        entry
        from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::protocol::mutate_in_request_body::mutate_in_specs::entry
            cppObj;
        js_to_cbpp(cppObj.opcode, jsObj.Get("opcode"));
        js_to_cbpp(cppObj.flags, jsObj.Get("flags"));
        js_to_cbpp(cppObj.path, jsObj.Get("path"));
        js_to_cbpp(cppObj.param, jsObj.Get("param"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::protocol::mutate_in_request_body::mutate_in_specs> {
    static inline couchbase::protocol::mutate_in_request_body::mutate_in_specs
    from_js(Napi::Value jsVal)
    {
        // we just forward the array to our std::vector handler
        couchbase::protocol::mutate_in_request_body::mutate_in_specs cppObj;
        js_to_cbpp(cppObj.entries, jsVal);
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::mutate_in_request> {
    static inline couchbase::operations::mutate_in_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::mutate_in_request cppObj;
        js_to_cbpp(cppObj.id, jsObj.Get("id"));
        // js_to_cbpp(cppObj.partition, jsObj.Get("partition"));
        // js_to_cbpp(cppObj.opaque, jsObj.Get("opaque"));
        js_to_cbpp(cppObj.cas, jsObj.Get("cas"));
        js_to_cbpp(cppObj.access_deleted, jsObj.Get("access_deleted"));
        js_to_cbpp(cppObj.create_as_deleted, jsObj.Get("create_as_deleted"));
        js_to_cbpp(cppObj.expiry, jsObj.Get("expiry"));
        js_to_cbpp(cppObj.store_semantics, jsObj.Get("store_semantics"));
        js_to_cbpp(cppObj.specs, jsObj.Get("specs"));
        js_to_cbpp(cppObj.durability_level, jsObj.Get("durability_level"));
        js_to_cbpp(cppObj.durability_timeout, jsObj.Get("durability_timeout"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        // js_to_cbpp(cppObj.retries, jsObj.Get("retries"));
        js_to_cbpp(cppObj.preserve_expiry, jsObj.Get("preserve_expiry"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::mutate_in_response::field> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::mutate_in_response::field &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("error", cbpp_to_js(env, cppObj.ec));
        resObj.Set("opcode", cbpp_to_js(env, cppObj.opcode));
        resObj.Set("status", cbpp_to_js(env, cppObj.status));
        resObj.Set("path", cbpp_to_js(env, cppObj.path));
        resObj.Set("value", cbpp_to_js(env, cppObj.value));
        resObj.Set("original_index", cbpp_to_js(env, cppObj.original_index));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::mutate_in_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::mutate_in_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("cas", cbpp_to_js(env, cppObj.cas));
        resObj.Set("token", cbpp_to_js(env, cppObj.token));
        resObj.Set("fields", cbpp_to_js(env, cppObj.fields));
        resObj.Set("first_error_index",
                   cbpp_to_js(env, cppObj.first_error_index));
        resObj.Set("deleted", cbpp_to_js(env, cppObj.deleted));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::document_view_request> {
    static inline couchbase::operations::document_view_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::document_view_request cppObj;
        js_to_cbpp(cppObj.client_context_id, jsObj.Get("client_context_id"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        js_to_cbpp(cppObj.bucket_name, jsObj.Get("bucket_name"));
        js_to_cbpp(cppObj.document_name, jsObj.Get("document_name"));
        js_to_cbpp(cppObj.view_name, jsObj.Get("view_name"));
        js_to_cbpp(cppObj.name_space, jsObj.Get("name_space"));
        js_to_cbpp(cppObj.limit, jsObj.Get("limit"));
        js_to_cbpp(cppObj.skip, jsObj.Get("skip"));
        js_to_cbpp(cppObj.consistency, jsObj.Get("consistency"));
        js_to_cbpp(cppObj.keys, jsObj.Get("keys"));
        js_to_cbpp(cppObj.key, jsObj.Get("key"));
        js_to_cbpp(cppObj.start_key, jsObj.Get("start_key"));
        js_to_cbpp(cppObj.end_key, jsObj.Get("end_key"));
        js_to_cbpp(cppObj.start_key_doc_id, jsObj.Get("start_key_doc_id"));
        js_to_cbpp(cppObj.end_key_doc_id, jsObj.Get("end_key_doc_id"));
        js_to_cbpp(cppObj.inclusive_end, jsObj.Get("inclusive_end"));
        js_to_cbpp(cppObj.reduce, jsObj.Get("reduce"));
        js_to_cbpp(cppObj.group, jsObj.Get("group"));
        js_to_cbpp(cppObj.group_level, jsObj.Get("group_level"));
        js_to_cbpp(cppObj.debug, jsObj.Get("debug"));
        js_to_cbpp(cppObj.order, jsObj.Get("order"));
        js_to_cbpp(cppObj.query_string, jsObj.Get("query_string"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::document_view_response::meta_data> {
    static inline Napi::Value to_js(
        Napi::Env env,
        const couchbase::operations::document_view_response::meta_data &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("total_rows", cbpp_to_js(env, cppObj.total_rows));
        resObj.Set("debug_info", cbpp_to_js(env, cppObj.debug_info));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::document_view_response::row> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::document_view_response::row &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("id", cbpp_to_js(env, cppObj.id));
        resObj.Set("key", cbpp_to_js(env, cppObj.key));
        resObj.Set("value", cbpp_to_js(env, cppObj.value));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::document_view_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::document_view_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("meta", cbpp_to_js(env, cppObj.meta));
        resObj.Set("rows", cbpp_to_js(env, cppObj.rows));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::query_request> {
    static inline couchbase::operations::query_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::query_request cppObj;
        js_to_cbpp(cppObj.statement, jsObj.Get("statement"));
        js_to_cbpp(cppObj.client_context_id, jsObj.Get("client_context_id"));
        js_to_cbpp(cppObj.adhoc, jsObj.Get("adhoc"));
        js_to_cbpp(cppObj.metrics, jsObj.Get("metrics"));
        js_to_cbpp(cppObj.readonly, jsObj.Get("readonly"));
        js_to_cbpp(cppObj.flex_index, jsObj.Get("flex_index"));
        js_to_cbpp(cppObj.preserve_expiry, jsObj.Get("preserve_expiry"));
        js_to_cbpp(cppObj.max_parallelism, jsObj.Get("max_parallelism"));
        js_to_cbpp(cppObj.scan_cap, jsObj.Get("scan_cap"));
        js_to_cbpp(cppObj.scan_wait, jsObj.Get("scan_wait"));
        js_to_cbpp(cppObj.pipeline_batch, jsObj.Get("pipeline_batch"));
        js_to_cbpp(cppObj.pipeline_cap, jsObj.Get("pipeline_cap"));
        js_to_cbpp(cppObj.scan_consistency, jsObj.Get("scan_consistency"));
        js_to_cbpp(cppObj.mutation_state, jsObj.Get("mutation_state"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        js_to_cbpp(cppObj.bucket_name, jsObj.Get("bucket_name"));
        js_to_cbpp(cppObj.scope_name, jsObj.Get("scope_name"));
        js_to_cbpp(cppObj.scope_qualifier, jsObj.Get("scope_qualifier"));
        js_to_cbpp(cppObj.profile, jsObj.Get("profile"));
        js_to_cbpp(cppObj.raw, jsObj.Get("raw"));
        js_to_cbpp(cppObj.positional_parameters,
                   jsObj.Get("positional_parameters"));
        js_to_cbpp(cppObj.named_parameters, jsObj.Get("named_parameters"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::query_response::query_metrics> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::query_response::query_metrics &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("elapsed_time", cbpp_to_js(env, cppObj.elapsed_time));
        resObj.Set("execution_time", cbpp_to_js(env, cppObj.execution_time));
        resObj.Set("result_count", cbpp_to_js(env, cppObj.result_count));
        resObj.Set("result_size", cbpp_to_js(env, cppObj.result_size));
        resObj.Set("sort_count", cbpp_to_js(env, cppObj.sort_count));
        resObj.Set("mutation_count", cbpp_to_js(env, cppObj.mutation_count));
        resObj.Set("error_count", cbpp_to_js(env, cppObj.error_count));
        resObj.Set("warning_count", cbpp_to_js(env, cppObj.warning_count));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::query_response::query_problem> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::query_response::query_problem &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("code", cbpp_to_js(env, cppObj.code));
        resObj.Set("message", cbpp_to_js(env, cppObj.message));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::query_response::query_meta_data> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::query_response::query_meta_data &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("request_id", cbpp_to_js(env, cppObj.request_id));
        resObj.Set("client_context_id",
                   cbpp_to_js(env, cppObj.client_context_id));
        resObj.Set("status", cbpp_to_js(env, cppObj.status));
        resObj.Set("metrics", cbpp_to_js(env, cppObj.metrics));
        resObj.Set("signature", cbpp_to_js(env, cppObj.signature));
        resObj.Set("profile", cbpp_to_js(env, cppObj.profile));
        resObj.Set("warnings", cbpp_to_js(env, cppObj.warnings));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::query_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::query_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("meta", cbpp_to_js(env, cppObj.meta));
        resObj.Set("prepared", cbpp_to_js(env, cppObj.prepared));
        resObj.Set("rows", cbpp_to_js(env, cppObj.rows));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::analytics_request> {
    static inline couchbase::operations::analytics_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::analytics_request cppObj;
        js_to_cbpp(cppObj.statement, jsObj.Get("statement"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        js_to_cbpp(cppObj.client_context_id, jsObj.Get("client_context_id"));
        js_to_cbpp(cppObj.readonly, jsObj.Get("readonly"));
        js_to_cbpp(cppObj.priority, jsObj.Get("priority"));
        js_to_cbpp(cppObj.bucket_name, jsObj.Get("bucket_name"));
        js_to_cbpp(cppObj.scope_name, jsObj.Get("scope_name"));
        js_to_cbpp(cppObj.scope_qualifier, jsObj.Get("scope_qualifier"));
        js_to_cbpp(cppObj.scan_consistency, jsObj.Get("scan_consistency"));
        js_to_cbpp(cppObj.raw, jsObj.Get("raw"));
        js_to_cbpp(cppObj.positional_parameters,
                   jsObj.Get("positional_parameters"));
        js_to_cbpp(cppObj.named_parameters, jsObj.Get("named_parameters"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::operations::analytics_response::analytics_metrics> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::analytics_response::analytics_metrics
              &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("elapsed_time", cbpp_to_js(env, cppObj.elapsed_time));
        resObj.Set("execution_time", cbpp_to_js(env, cppObj.execution_time));
        resObj.Set("result_count", cbpp_to_js(env, cppObj.result_count));
        resObj.Set("result_size", cbpp_to_js(env, cppObj.result_size));
        resObj.Set("error_count", cbpp_to_js(env, cppObj.error_count));
        resObj.Set("processed_objects",
                   cbpp_to_js(env, cppObj.processed_objects));
        resObj.Set("warning_count", cbpp_to_js(env, cppObj.warning_count));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::operations::analytics_response::analytics_problem> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::analytics_response::analytics_problem
              &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("code", cbpp_to_js(env, cppObj.code));
        resObj.Set("message", cbpp_to_js(env, cppObj.message));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::operations::analytics_response::analytics_meta_data> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::analytics_response::analytics_meta_data
              &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("request_id", cbpp_to_js(env, cppObj.request_id));
        resObj.Set("client_context_id",
                   cbpp_to_js(env, cppObj.client_context_id));
        resObj.Set("status", cbpp_to_js(env, cppObj.status));
        resObj.Set("metrics", cbpp_to_js(env, cppObj.metrics));
        resObj.Set("signature", cbpp_to_js(env, cppObj.signature));
        resObj.Set("warnings", cbpp_to_js(env, cppObj.warnings));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::analytics_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::analytics_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("meta", cbpp_to_js(env, cppObj.meta));
        resObj.Set("rows", cbpp_to_js(env, cppObj.rows));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::search_request> {
    static inline couchbase::operations::search_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::search_request cppObj;
        js_to_cbpp(cppObj.client_context_id, jsObj.Get("client_context_id"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        js_to_cbpp(cppObj.index_name, jsObj.Get("index_name"));
        js_to_cbpp(cppObj.query, jsObj.Get("query"));
        js_to_cbpp(cppObj.limit, jsObj.Get("limit"));
        js_to_cbpp(cppObj.skip, jsObj.Get("skip"));
        js_to_cbpp(cppObj.explain, jsObj.Get("explain"));
        js_to_cbpp(cppObj.disable_scoring, jsObj.Get("disable_scoring"));
        js_to_cbpp(cppObj.include_locations, jsObj.Get("include_locations"));
        js_to_cbpp(cppObj.highlight_style, jsObj.Get("highlight_style"));
        js_to_cbpp(cppObj.highlight_fields, jsObj.Get("highlight_fields"));
        js_to_cbpp(cppObj.fields, jsObj.Get("fields"));
        js_to_cbpp(cppObj.scope_name, jsObj.Get("scope_name"));
        js_to_cbpp(cppObj.collections, jsObj.Get("collections"));
        js_to_cbpp(cppObj.scan_consistency, jsObj.Get("scan_consistency"));
        js_to_cbpp(cppObj.mutation_state, jsObj.Get("mutation_state"));
        js_to_cbpp(cppObj.sort_specs, jsObj.Get("sort_specs"));
        js_to_cbpp(cppObj.facets, jsObj.Get("facets"));
        js_to_cbpp(cppObj.raw, jsObj.Get("raw"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::search_response::search_metrics> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::search_response::search_metrics &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("took", cbpp_to_js(env, cppObj.took));
        resObj.Set("max_score", cbpp_to_js(env, cppObj.max_score));
        resObj.Set("success_partition_count",
                   cbpp_to_js(env, cppObj.success_partition_count));
        resObj.Set("error_partition_count",
                   cbpp_to_js(env, cppObj.error_partition_count));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::search_response::search_meta_data> {
    static inline Napi::Value to_js(
        Napi::Env env,
        const couchbase::operations::search_response::search_meta_data &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("client_context_id",
                   cbpp_to_js(env, cppObj.client_context_id));
        resObj.Set("metrics", cbpp_to_js(env, cppObj.metrics));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::search_response::search_location> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::search_response::search_location &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("field", cbpp_to_js(env, cppObj.field));
        resObj.Set("term", cbpp_to_js(env, cppObj.term));
        resObj.Set("position", cbpp_to_js(env, cppObj.position));
        resObj.Set("start_offset", cbpp_to_js(env, cppObj.start_offset));
        resObj.Set("end_offset", cbpp_to_js(env, cppObj.end_offset));
        resObj.Set("array_positions", cbpp_to_js(env, cppObj.array_positions));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::search_response::search_row> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::search_response::search_row &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("index", cbpp_to_js(env, cppObj.index));
        resObj.Set("id", cbpp_to_js(env, cppObj.id));
        resObj.Set("score", cbpp_to_js(env, cppObj.score));
        resObj.Set("locations", cbpp_to_js(env, cppObj.locations));
        resObj.Set("fragments", cbpp_to_js(env, cppObj.fragments));
        resObj.Set("fields", cbpp_to_js(env, cppObj.fields));
        resObj.Set("explanation", cbpp_to_js(env, cppObj.explanation));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::operations::search_response::search_facet::term_facet> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::search_response::search_facet::term_facet
              &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("term", cbpp_to_js(env, cppObj.term));
        resObj.Set("count", cbpp_to_js(env, cppObj.count));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::operations::search_response::search_facet::date_range_facet> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::search_response::
                             search_facet::date_range_facet &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("name", cbpp_to_js(env, cppObj.name));
        resObj.Set("count", cbpp_to_js(env, cppObj.count));
        resObj.Set("start", cbpp_to_js(env, cppObj.start));
        resObj.Set("end", cbpp_to_js(env, cppObj.end));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::operations::search_response::search_facet::numeric_range_facet> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::search_response::
                             search_facet::numeric_range_facet &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("name", cbpp_to_js(env, cppObj.name));
        resObj.Set("count", cbpp_to_js(env, cppObj.count));
        resObj.Set("min", cbpp_to_js(env, cppObj.min));
        resObj.Set("max", cbpp_to_js(env, cppObj.max));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::search_response::search_facet> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::search_response::search_facet &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("name", cbpp_to_js(env, cppObj.name));
        resObj.Set("field", cbpp_to_js(env, cppObj.field));
        resObj.Set("total", cbpp_to_js(env, cppObj.total));
        resObj.Set("missing", cbpp_to_js(env, cppObj.missing));
        resObj.Set("other", cbpp_to_js(env, cppObj.other));
        resObj.Set("terms", cbpp_to_js(env, cppObj.terms));
        resObj.Set("date_ranges", cbpp_to_js(env, cppObj.date_ranges));
        resObj.Set("numeric_ranges", cbpp_to_js(env, cppObj.numeric_ranges));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::search_response> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::operations::search_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("status", cbpp_to_js(env, cppObj.status));
        resObj.Set("meta", cbpp_to_js(env, cppObj.meta));
        resObj.Set("rows", cbpp_to_js(env, cppObj.rows));
        resObj.Set("facets", cbpp_to_js(env, cppObj.facets));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::management::freeform_request> {
    static inline couchbase::operations::management::freeform_request
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::operations::management::freeform_request cppObj;
        js_to_cbpp(cppObj.type, jsObj.Get("type"));
        js_to_cbpp(cppObj.method, jsObj.Get("method"));
        js_to_cbpp(cppObj.path, jsObj.Get("path"));
        js_to_cbpp(cppObj.headers, jsObj.Get("headers"));
        js_to_cbpp(cppObj.body, jsObj.Get("body"));
        js_to_cbpp(cppObj.timeout, jsObj.Get("timeout"));
        js_to_cbpp(cppObj.client_context_id, jsObj.Get("client_context_id"));
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::operations::management::freeform_response> {
    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::operations::management::freeform_response &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("status", cbpp_to_js(env, cppObj.status));
        resObj.Set("headers", cbpp_to_js(env, cppObj.headers));
        resObj.Set("body", cbpp_to_js(env, cppObj.body));
        return resObj;
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

        auto query_scan_consistency = js_to_cbpp<std::optional<
            couchbase::operations::query_request::scan_consistency_type>>(
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

        auto query_scan_consistency = js_to_cbpp<std::optional<
            couchbase::operations::query_request::scan_consistency_type>>(
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
            js_to_cbpp<couchbase::protocol::cas>(jsObj.Get("cas")).value,
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
        resObj.Set("cas", cbpp_to_js(env, couchbase::protocol::cas{res.cas()}));
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

        auto scan_consistency = js_to_cbpp<std::optional<
            couchbase::operations::query_request::scan_consistency_type>>(
            jsObj.Get("scan_consistency"));
        if (scan_consistency.has_value()) {
            cppObj.scan_consistency(scan_consistency.value());
        }

        auto profile = js_to_cbpp<
            std::optional<couchbase::operations::query_request::profile_mode>>(
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
struct js_to_cbpp_t<couchbase::diag::endpoint_diag_info> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::diag::endpoint_diag_info &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("type", cbpp_to_js(env, res.type));
        resObj.Set("id", cbpp_to_js(env, res.id));
        resObj.Set("last_activity", cbpp_to_js(env, res.last_activity));
        resObj.Set("remote", cbpp_to_js(env, res.remote));
        resObj.Set("local", cbpp_to_js(env, res.local));
        resObj.Set("state", cbpp_to_js(env, res.state));
        resObj.Set("bucket", cbpp_to_js(env, res.bucket));
        resObj.Set("details", cbpp_to_js(env, res.details));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::diag::diagnostics_result> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::diag::diagnostics_result &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("version", cbpp_to_js(env, res.version));
        resObj.Set("id", cbpp_to_js(env, res.id));
        resObj.Set("sdk", cbpp_to_js(env, res.sdk));
        resObj.Set("services", cbpp_to_js(env, res.services));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::diag::endpoint_ping_info> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::diag::endpoint_ping_info &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("type", cbpp_to_js(env, res.type));
        resObj.Set("id", cbpp_to_js(env, res.id));
        resObj.Set("latency", cbpp_to_js(env, res.latency));
        resObj.Set("remote", cbpp_to_js(env, res.remote));
        resObj.Set("local", cbpp_to_js(env, res.local));
        resObj.Set("state", cbpp_to_js(env, res.state));
        resObj.Set("bucket", cbpp_to_js(env, res.bucket));
        resObj.Set("error", cbpp_to_js(env, res.error));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::diag::ping_result> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::diag::ping_result &res)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("version", cbpp_to_js(env, res.version));
        resObj.Set("id", cbpp_to_js(env, res.id));
        resObj.Set("sdk", cbpp_to_js(env, res.sdk));
        resObj.Set("services", cbpp_to_js(env, res.services));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<std::exception> {
    static inline Napi::Value to_js(Napi::Env env, const std::exception &except)
    {
        Napi::Error err = Napi::Error::New(env, except.what());
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<std::error_code> {
    static inline Napi::Value to_js(Napi::Env env, const std::error_code &ec)
    {
        if (!ec) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("code", Napi::Number::New(env, ec.value()));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::protocol::enhanced_error_info> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::protocol::enhanced_error_info &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("reference", cbpp_to_js(env, cppObj.reference));
        resObj.Set("context", cbpp_to_js(env, cppObj.context));
        return resObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::error_context::key_value> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::error_context::key_value &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec.message());
        err.Set("ctxtype", Napi::String::New(env, "key_value"));
        err.Set("code", cbpp_to_js(env, ctx.ec.value()));
        err.Set("id", cbpp_to_js(env, ctx.id));
        err.Set("opaque", cbpp_to_js(env, ctx.opaque));
        err.Set("cas", cbpp_to_js(env, ctx.cas));
        err.Set("status_code", cbpp_to_js(env, ctx.status_code));
        err.Set("enhanced_error_info",
                cbpp_to_js(env, ctx.enhanced_error_info));
        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::error_context::view> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::error_context::view &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec.message());
        err.Set("ctxtype", Napi::String::New(env, "view"));
        err.Set("code", cbpp_to_js(env, ctx.ec.value()));

        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("design_document_name",
                cbpp_to_js(env, ctx.design_document_name));
        err.Set("view_name", cbpp_to_js(env, ctx.view_name));
        err.Set("query_string", cbpp_to_js(env, ctx.query_string));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::error_context::query> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::error_context::query &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        auto ec = ctx.ec;
        if (ec) {
            auto maybeEc =
                couchbase::operations::management::translate_query_error_code(
                    ctx.first_error_code, ctx.first_error_message, 0);
            if (maybeEc.has_value()) {
                ec = maybeEc.value();
            }
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("ctxtype", Napi::String::New(env, "query"));
        err.Set("code", cbpp_to_js(env, ec.value()));

        err.Set("first_error_code", cbpp_to_js(env, ctx.first_error_code));
        err.Set("first_error_message",
                cbpp_to_js(env, ctx.first_error_message));
        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("statement", cbpp_to_js(env, ctx.statement));
        err.Set("parameters", cbpp_to_js(env, ctx.parameters));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::error_context::search> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::error_context::search &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        auto ec = ctx.ec;
        if (ec) {
            auto maybeEc =
                couchbase::operations::management::translate_search_error_code(
                    ctx.http_status, ctx.http_body);
            if (maybeEc.has_value()) {
                ec = maybeEc.value();
            }
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("ctxtype", Napi::String::New(env, "search"));
        err.Set("code", cbpp_to_js(env, ec.value()));

        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("index_name", cbpp_to_js(env, ctx.index_name));
        err.Set("query", cbpp_to_js(env, ctx.query));
        err.Set("parameters", cbpp_to_js(env, ctx.parameters));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::error_context::analytics> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::error_context::analytics &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        auto ec = ctx.ec;
        if (ec) {
            auto maybeEc = couchbase::operations::management::
                translate_analytics_error_code(ctx.first_error_code,
                                               ctx.first_error_message);
            if (maybeEc.has_value()) {
                ec = maybeEc.value();
            }
        }

        Napi::Error err = Napi::Error::New(env, ec.message());
        err.Set("ctxtype", Napi::String::New(env, "analytics"));
        err.Set("code", cbpp_to_js(env, ec.value()));

        err.Set("first_error_code", cbpp_to_js(env, ctx.first_error_code));
        err.Set("first_error_message",
                cbpp_to_js(env, ctx.first_error_message));
        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("statement", cbpp_to_js(env, ctx.statement));
        err.Set("parameters", cbpp_to_js(env, ctx.parameters));

        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
    }
};

template <>
struct js_to_cbpp_t<couchbase::error_context::http> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::error_context::http &ctx)
    {
        if (!ctx.ec) {
            return env.Null();
        }

        Napi::Error err = Napi::Error::New(env, ctx.ec.message());
        err.Set("ctxtype", Napi::String::New(env, "http"));
        err.Set("code", cbpp_to_js(env, ctx.ec.value()));

        err.Set("client_context_id", cbpp_to_js(env, ctx.client_context_id));
        err.Set("method", cbpp_to_js(env, ctx.method));
        err.Set("path", cbpp_to_js(env, ctx.path));
        err.Set("http_status", cbpp_to_js(env, ctx.http_status));
        err.Set("http_body", cbpp_to_js(env, ctx.http_body));

        err.Set("last_dispatched_to", cbpp_to_js(env, ctx.last_dispatched_to));
        err.Set("last_dispatched_from",
                cbpp_to_js(env, ctx.last_dispatched_from));
        err.Set("retry_attempts", cbpp_to_js(env, ctx.retry_attempts));
        err.Set("retry_reasons", cbpp_to_js(env, ctx.retry_reasons));
        return err.Value();
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

template <typename T>
static inline T jsToCbpp(Napi::Value jsVal)
{
    return js_to_cbpp_t<T>::from_js(jsVal);
}

template <typename T>
static inline T jsToCbpp(Napi::Value jsVal, const Transcoder &transcoder)
{
    return js_to_cbpp_t<T>::from_js(jsVal, transcoder);
}

template <typename T>
Napi::Value cbppToJs(Napi::Env env, const T &cppObj)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj);
}

template <typename T>
Napi::Value cbppToJs(Napi::Env env, const T &cppObj,
                     const Transcoder &transcoder)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj, transcoder);
}

} // namespace couchnode
