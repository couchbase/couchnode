#include "query_stream_iterator.hpp"
#include "connection.hpp"
#include "jstocbpp.hpp"
#include <core/stream_error_details.hxx>
#include <couchbase/error_codes.hxx>

namespace couchnode
{

void QueryStreamIterator::Init(Napi::Env env, Napi::Object exports)
{
    Napi::Function func = DefineClass(
        env, "QueryStreamIterator",
        {
            InstanceMethod<&QueryStreamIterator::jsNext>("next"),
            InstanceMethod<&QueryStreamIterator::jsCancel>("cancel"),
        });

    constructor(env) = Napi::Persistent(func);
    exports.Set("QueryStreamIterator", func);
}

QueryStreamIterator::QueryStreamIterator(const Napi::CallbackInfo &info)
    : Napi::ObjectWrap<QueryStreamIterator>(info)
    , state_(std::make_shared<QueryStreamState>())
{
    if (info.Length() > 0 && info[0].IsExternal()) {
        auto &payload =
            *info[0].As<Napi::External<QueryStreamPayload>>().Data();
        this->state_->stream = std::make_shared<couchbase::core::query_stream>(
            std::move(payload.stream));
        this->ctx_ =
            std::make_shared<const couchbase::core::error_context::query>(
                std::move(payload.ctx));
        this->wrapperSpan_ = std::move(payload.wrapperSpan);
    }
}

QueryStreamIterator::~QueryStreamIterator()
{
}

Napi::Value QueryStreamIterator::jsNext(const Napi::CallbackInfo &info)
{
    auto env = info.Env();
    auto callbackJsFn = info[0].As<Napi::Function>();
    auto cookie = CallCookie(env, callbackJsFn, "cbQueryStreamNext");

    auto handler = [state = this->state_, ctx = this->ctx_,
                    wrapperSpan = this->wrapperSpan_](
                       Napi::Env env, Napi::Function callback,
                       std::optional<std::string> row, std::error_code ec,
                       couchbase::core::stream_error_details details,
                       std::optional<
                           couchbase::core::operations::query_response::
                               query_meta_data>
                           meta) mutable {
        // The stream is done once it delivers its terminal result, so release
        // it now rather than when the iterator is garbage-collected, which can
        // be after the connection (and its io context) have gone.
        if (!row.has_value()) {
            state->stream.reset();
        }

        Napi::Value jsErr, jsRes;
        try {
            if (ec) {
                auto errCtx =
                    ctx ? *ctx : couchbase::core::error_context::query{};
                errCtx.ec = ec;
                couchbase::core::apply_error_details(errCtx, details);
                jsErr = cbpp_to_js(env, errCtx, wrapperSpan);
                jsRes = env.Null();
            } else {
                jsErr = env.Null();
                auto resObj = Napi::Object::New(env);
                if (row.has_value()) {
                    resObj.Set("row", cbpp_to_js(env, row.value()));
                }
                if (meta.has_value()) {
                    resObj.Set(
                        "meta",
                        cbpp_to_js<couchbase::core::operations::
                                       query_response::query_meta_data>(
                            env, meta.value()));
                    resObj.Set("cpp_core_span",
                               cbpp_wrapper_span_to_js(env, wrapperSpan));
                }
                jsRes = resObj;
            }
        } catch (const Napi::Error &e) {
            jsErr = e.Value();
            jsRes = env.Null();
        }
        callback.Call({jsErr, jsRes});
    };

    auto stream = this->state_->stream;
    if (!stream) {
        // The stream was cancelled, has finished or was never initialised.
        // Complete through the cookie like any other call, so the callback
        // is still invoked exactly once and asynchronously.
        cookie.invoke([handler = std::move(handler)](
                          Napi::Env env, Napi::Function callback) mutable {
            handler(env, callback, std::nullopt,
                    couchbase::errc::common::request_canceled, {},
                    std::nullopt);
        });
        return env.Null();
    }

    stream->next_row(
        [cookie = std::move(cookie), handler = std::move(handler),
         stream](std::optional<std::string> row, std::error_code ec) mutable {
            couchbase::core::stream_error_details details{};
            std::optional<
                couchbase::core::operations::query_response::query_meta_data>
                meta{};
            if (!row.has_value()) {
                if (ec) {
                    details = stream->error_details();
                }
                meta = stream->meta_data();
            }
            cookie.invoke(
                [handler = std::move(handler), row = std::move(row),
                 ec = std::move(ec), details = std::move(details),
                 meta = std::move(meta)](Napi::Env env,
                                         Napi::Function callback) mutable {
                    handler(env, callback, std::move(row), std::move(ec),
                            std::move(details), std::move(meta));
                });
        });

    return env.Null();
}

Napi::Value QueryStreamIterator::jsCancel(const Napi::CallbackInfo &info)
{
    if (auto stream = std::move(this->state_->stream)) {
        stream->cancel();
    }
    return info.Env().Undefined();
}

} // namespace couchnode
