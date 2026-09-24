#pragma once
#include "addondata.hpp"
#include "napi.h"
#include <core/error_context/query.hxx>
#include <core/query_stream.hxx>
#include <core/tracing/wrapper_sdk_tracer.hxx>

namespace couchnode
{

struct QueryStreamPayload {
    couchbase::core::query_stream stream;
    couchbase::core::error_context::query ctx;
    std::shared_ptr<couchbase::core::tracing::wrapper_sdk_span> wrapperSpan;
};

struct QueryStreamState {
    std::shared_ptr<couchbase::core::query_stream> stream;
};

class QueryStreamIterator : public Napi::ObjectWrap<QueryStreamIterator>
{
public:
    static Napi::FunctionReference &constructor(Napi::Env env)
    {
        return AddonData::fromEnv(env)->_queryStreamIteratorCtor;
    }

    static void Init(Napi::Env env, Napi::Object exports);

    QueryStreamIterator(const Napi::CallbackInfo &info);
    ~QueryStreamIterator();

    Napi::Value jsNext(const Napi::CallbackInfo &info);
    Napi::Value jsCancel(const Napi::CallbackInfo &info);

private:
    std::shared_ptr<QueryStreamState> state_;
    std::shared_ptr<const couchbase::core::error_context::query> ctx_;
    std::shared_ptr<couchbase::core::tracing::wrapper_sdk_span> wrapperSpan_;
};

} // namespace couchnode
