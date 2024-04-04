#pragma once
#include "jstocbpp_defs.hpp"

#include "cas.hpp"
#include "jstocbpp_cpptypes.hpp"
#include "mutationtoken.hpp"

#include <core/cluster.hxx>
#include <core/document_id.hxx>
#include <core/json_string.hxx>
#include <core/management/eventing_function.hxx>
#include <core/query_context.hxx>

namespace couchnode
{

template <>
struct js_to_cbpp_t<couchbase::core::json_string> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::core::json_string &cppObj)
    {
        return js_to_cbpp_t<std::string>::to_js(env, cppObj.str());
    }

    static inline couchbase::core::json_string from_js(Napi::Value jsVal)
    {
        auto str = js_to_cbpp_t<std::string>::from_js(jsVal);
        return couchbase::core::json_string(std::move(str));
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::cluster_credentials> {
    static inline couchbase::core::cluster_credentials
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        couchbase::core::cluster_credentials cppObj;
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
struct js_to_cbpp_t<couchbase::core::io::dns::dns_config> {
    static inline couchbase::core::io::dns::dns_config
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        auto cppObj = couchbase::core::io::dns::dns_config{
            js_to_cbpp<std::string>(jsObj.Get("nameserver")),
            js_to_cbpp<std::uint16_t>(jsObj.Get("port")),
            js_to_cbpp<std::chrono::milliseconds>(jsObj.Get("dnsSrvTimeout"))};
        return cppObj;
    }
};

template <>
struct js_to_cbpp_t<couchbase::core::document_id> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::core::document_id &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("bucket", cbpp_to_js(env, cppObj.bucket()));
        resObj.Set("scope", cbpp_to_js(env, cppObj.scope()));
        resObj.Set("collection", cbpp_to_js(env, cppObj.collection()));
        resObj.Set("key", cbpp_to_js(env, cppObj.key()));
        return resObj;
    }

    static inline couchbase::core::document_id from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        return couchbase::core::document_id(
            js_to_cbpp<std::string>(jsObj.Get("bucket")),
            js_to_cbpp<std::string>(jsObj.Get("scope")),
            js_to_cbpp<std::string>(jsObj.Get("collection")),
            js_to_cbpp<std::string>(jsObj.Get("key")));
    }
};

template <>
struct js_to_cbpp_t<couchbase::cas> {
    static inline Napi::Value to_js(Napi::Env env, couchbase::cas cppObj)
    {
        return Cas::create(env, cppObj);
    }

    static inline couchbase::cas from_js(Napi::Value jsVal)
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
struct js_to_cbpp_t<couchbase::core::query_context> {
    static inline Napi::Value
    to_js(Napi::Env env, const couchbase::core::query_context &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        resObj.Set("bucket_name", cbpp_to_js(env, cppObj.bucket_name()));
        resObj.Set("scope_name", cbpp_to_js(env, cppObj.scope_name()));
        return resObj;
    }

    static inline couchbase::core::query_context from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        auto bucket_name = js_to_cbpp<std::string>(jsObj.Get("bucket_name"));
        auto scope_name = js_to_cbpp<std::string>(jsObj.Get("scope_name"));
        if (!bucket_name.empty() || !scope_name.empty()) {
            return couchbase::core::query_context(bucket_name, scope_name);
        }
        return couchbase::core::query_context();
    }
};

template <>
struct js_to_cbpp_t<
    couchbase::core::management::eventing::function_url_binding> {
    static inline couchbase::core::management::eventing::function_url_binding
    from_js(Napi::Value jsVal)
    {
        auto jsObj = jsVal.ToObject();
        auto auth_name = jsToCbpp<std::string>(jsObj.Get("auth_name"));
        std::variant<
            couchbase::core::management::eventing::function_url_no_auth,
            couchbase::core::management::eventing::function_url_auth_basic,
            couchbase::core::management::eventing::function_url_auth_digest,
            couchbase::core::management::eventing::function_url_auth_bearer>
            auth;
        if (auth_name.compare("function_url_no_auth") == 0) {
            auth = js_to_cbpp<
                couchbase::core::management::eventing::function_url_no_auth>(
                jsObj.Get("auth_value"));
        } else if (auth_name.compare("function_url_auth_basic") == 0) {
            auth = js_to_cbpp<
                couchbase::core::management::eventing::function_url_auth_basic>(
                jsObj.Get("auth_value"));
        } else if (auth_name.compare("function_url_auth_digest") == 0) {
            auth = js_to_cbpp<couchbase::core::management::eventing::
                                  function_url_auth_digest>(
                jsObj.Get("auth_value"));
        } else {
            auth = js_to_cbpp<couchbase::core::management::eventing::
                                  function_url_auth_bearer>(
                jsObj.Get("auth_value"));
        }
        couchbase::core::management::eventing::function_url_binding cppObj;
        js_to_cbpp<std::string>(cppObj.alias, jsObj.Get("alias"));
        js_to_cbpp<std::string>(cppObj.hostname, jsObj.Get("hostname"));
        js_to_cbpp<bool>(cppObj.allow_cookies, jsObj.Get("allow_cookies"));
        js_to_cbpp<bool>(cppObj.validate_ssl_certificate,
                         jsObj.Get("validate_ssl_certificate"));
        cppObj.auth = auth;
        return cppObj;
    }

    static inline Napi::Value
    to_js(Napi::Env env,
          const couchbase::core::management::eventing::function_url_binding
              &cppObj)
    {
        auto resObj = Napi::Object::New(env);
        if (std::holds_alternative<
                couchbase::core::management::eventing::function_url_no_auth>(
                cppObj.auth)) {
            resObj.Set("auth_name",
                       cbpp_to_js<std::string>(env, "function_url_no_auth"));
        } else if (std::holds_alternative<
                       couchbase::core::management::eventing::
                           function_url_auth_basic>(cppObj.auth)) {
            resObj.Set("auth_name",
                       cbpp_to_js<std::string>(env, "function_url_auth_basic"));
        } else if (std::holds_alternative<
                       couchbase::core::management::eventing::
                           function_url_auth_digest>(cppObj.auth)) {
            resObj.Set("auth_name", cbpp_to_js<std::string>(
                                        env, "function_url_auth_digest"));
        } else {
            resObj.Set("auth_name", cbpp_to_js<std::string>(
                                        env, "function_url_auth_bearer"));
        }
        resObj.Set("alias", cbpp_to_js<std::string>(env, cppObj.alias));
        resObj.Set("hostname", cbpp_to_js<std::string>(env, cppObj.hostname));
        resObj.Set("allow_cookies",
                   cbpp_to_js<bool>(env, cppObj.allow_cookies));
        resObj.Set("validate_ssl_certificate",
                   cbpp_to_js<bool>(env, cppObj.validate_ssl_certificate));
        resObj.Set(
            "auth_value",
            cbpp_to_js<std::variant<
                couchbase::core::management::eventing::function_url_no_auth,
                couchbase::core::management::eventing::function_url_auth_basic,
                couchbase::core::management::eventing::function_url_auth_digest,
                couchbase::core::management::eventing::
                    function_url_auth_bearer>>(env, cppObj.auth));
        return resObj;
    }
};

} // namespace couchnode
