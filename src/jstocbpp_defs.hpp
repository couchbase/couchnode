#pragma once
#include <napi.h>

#include <core/error_context/key_value.hxx>
#include <core/error_context/query_error_context.hxx>
#include <core/tracing/wrapper_sdk_tracer.hxx>

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

// used w/in connection.hpp -> executeOp()
template <typename T>
static inline Napi::Value cbpp_to_js(
    Napi::Env env, const T &cppObj,
    std::shared_ptr<couchbase::core::tracing::wrapper_sdk_span> wrapperSpan)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj, wrapperSpan);
}

template <typename T>
static inline T jsToCbpp(Napi::Value jsVal)
{
    return js_to_cbpp_t<T>::from_js(jsVal);
}

// used w/ methods in connection_autogen.cpp (jsGet(), etc.)
template <typename T>
static inline T jsToCbpp(
    Napi::Value jsVal,
    std::shared_ptr<couchbase::core::tracing::wrapper_sdk_span> wrapperSpan)
{
    return js_to_cbpp_t<T>::from_js(jsVal, wrapperSpan);
}

template <typename T>
Napi::Value cbppToJs(Napi::Env env, const T &cppObj)
{
    return js_to_cbpp_t<T>::to_js(env, cppObj);
}

// tracing additions
// used w/ jstocbpp_autogen.cpp response objects & jscbpp_errors.hpp
template <typename T>
static inline Napi::Value cbpp_wrapper_span_to_js(Napi::Env env, T wrapperSpan)
{
    return js_to_cbpp_t<T>::cbpp_wrapper_span_to_js(env, wrapperSpan);
}
template <typename T>
static inline size_t get_cbpp_retries(const T &ctx)
{
    return ctx.retry_attempts;
}
template <>
size_t get_cbpp_retries(const couchbase::core::key_value_error_context &ctx)
{
    return ctx.retry_attempts();
}
template <>
size_t get_cbpp_retries(const couchbase::core::subdocument_error_context &ctx)
{
    return ctx.retry_attempts();
}
template <>
size_t get_cbpp_retries(const couchbase::core::query_error_context &ctx)
{
    return ctx.retry_attempts();
}

} // namespace couchnode
