#include "addondata.hpp"
#include "cas.hpp"
#include "connection.hpp"
#include "constants.hpp"
#include "mutationtoken.hpp"
#include "scan_iterator.hpp"
#include "transaction.hpp"
#include "transactions.hpp"
#include <core/logger/configuration.hxx>
#include <core/meta/version.hxx>
#include <napi.h>
#include <spdlog/spdlog.h>

namespace couchnode
{

Napi::Value enable_protocol_logger(const Napi::CallbackInfo &info)
{
    try {
        auto filename = info[0].ToString().Utf8Value();
        couchbase::core::logger::configuration configuration{};
        configuration.filename = filename;
        couchbase::core::logger::create_protocol_logger(configuration);
    } catch (...) {
        return Napi::Error::New(info.Env(), "Unexpected C++ error").Value();
    }
    return info.Env().Null();
}

Napi::Value shutdown_logger(const Napi::CallbackInfo &info)
{
    try {
        couchbase::core::logger::shutdown();
    } catch (...) {
        return Napi::Error::New(info.Env(), "Unexpected C++ error").Value();
    }
    return info.Env().Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    spdlog::set_pattern("[%Y-%m-%d %T.%e] [%P,%t] [%^%l%$] %oms, %v");

    auto spdLogLevel = spdlog::level::off;
    auto cbppLogLevel = couchbase::core::logger::level::off;
    {
        const char *logLevelCstr = getenv("CBPPLOGLEVEL");
        if (logLevelCstr) {
            std::string logLevelStr = logLevelCstr;
            if (logLevelStr == "trace") {
                spdLogLevel = spdlog::level::trace;
                cbppLogLevel = couchbase::core::logger::level::trace;
            } else if (logLevelStr == "debug") {
                spdLogLevel = spdlog::level::debug;
                cbppLogLevel = couchbase::core::logger::level::debug;
            } else if (logLevelStr == "info") {
                spdLogLevel = spdlog::level::info;
                cbppLogLevel = couchbase::core::logger::level::info;
            } else if (logLevelStr == "warn") {
                spdLogLevel = spdlog::level::warn;
                cbppLogLevel = couchbase::core::logger::level::warn;
            } else if (logLevelStr == "err") {
                spdLogLevel = spdlog::level::err;
                cbppLogLevel = couchbase::core::logger::level::err;
            } else if (logLevelStr == "critical") {
                spdLogLevel = spdlog::level::critical;
                cbppLogLevel = couchbase::core::logger::level::critical;
            }
        }
    }
    if (cbppLogLevel != couchbase::core::logger::level::off) {
        couchbase::core::logger::create_console_logger();
    }
    spdlog::set_level(spdLogLevel);
    couchbase::core::logger::set_log_levels(cbppLogLevel);

    AddonData::Init(env, exports);
    Constants::Init(env, exports);
    Cas::Init(env, exports);
    MutationToken::Init(env, exports);
    Connection::Init(env, exports);
    Transactions::Init(env, exports);
    Transaction::Init(env, exports);
    ScanIterator::Init(env, exports);

    exports.Set(Napi::String::New(env, "cbppVersion"),
                Napi::String::New(env, "1.0.0-beta"));
    exports.Set(
        Napi::String::New(env, "cbppMetadata"),
        Napi::String::New(env, couchbase::core::meta::sdk_build_info_json()));
    exports.Set(Napi::String::New(env, "enableProtocolLogger"),
                Napi::Function::New<enable_protocol_logger>(env));
    exports.Set(Napi::String::New(env, "shutdownLogger"),
                Napi::Function::New<shutdown_logger>(env));
    return exports;
}

} // namespace couchnode

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return couchnode::Init(env, exports);
}
NODE_API_MODULE(couchbase_impl, Init)
