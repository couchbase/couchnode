#pragma once
#include "jstocbpp_defs.hpp"

#include "cas.hpp"
#include "jstocbpp_cpptypes.hpp"
#include "mutationtoken.hpp"

#include <couchbase/cluster.hxx>

namespace couchnode
{

template <>
struct js_to_cbpp_t<couchbase::json_string> {
    static inline Napi::Value to_js(Napi::Env env,
                                    const couchbase::json_string &cppObj)
    {
        return js_to_cbpp_t<std::string>::to_js(env, cppObj.str());
    }

    static inline couchbase::json_string from_js(Napi::Value jsVal)
    {
        auto str = js_to_cbpp_t<std::string>::from_js(jsVal);
        return couchbase::json_string(std::move(str));
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

} // namespace couchnode
