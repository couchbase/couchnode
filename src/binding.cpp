#include "addondata.hpp"
#include "cas.hpp"
#include "connection.hpp"
#include "constants.hpp"
#include "mutationtoken.hpp"
#include "transaction.hpp"
#include "transactions.hpp"
#include <napi.h>
#include <spdlog/spdlog.h>

namespace couchnode
{

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    spdlog::set_pattern("[%Y-%m-%d %T.%e] [%P,%t] [%^%l%$] %oms, %v");

    auto spdLogLevel = spdlog::level::off;
    auto cbppLogLevel = couchbase::logger::level::off;
    {
        const char *logLevelCstr = getenv("CBPPLOGLEVEL");
        if (logLevelCstr) {
            std::string logLevelStr = logLevelCstr;
            if (logLevelStr == "trace") {
                spdLogLevel = spdlog::level::trace;
                cbppLogLevel = couchbase::logger::level::trace;
            } else if (logLevelStr == "debug") {
                spdLogLevel = spdlog::level::debug;
                cbppLogLevel = couchbase::logger::level::debug;
            } else if (logLevelStr == "info") {
                spdLogLevel = spdlog::level::info;
                cbppLogLevel = couchbase::logger::level::info;
            } else if (logLevelStr == "warn") {
                spdLogLevel = spdlog::level::warn;
                cbppLogLevel = couchbase::logger::level::warn;
            } else if (logLevelStr == "err") {
                spdLogLevel = spdlog::level::err;
                cbppLogLevel = couchbase::logger::level::err;
            } else if (logLevelStr == "critical") {
                spdLogLevel = spdlog::level::critical;
                cbppLogLevel = couchbase::logger::level::critical;
            }
        }
    }
    if (cbppLogLevel != couchbase::logger::level::off) {
        couchbase::logger::create_console_logger();
    }
    spdlog::set_level(spdLogLevel);
    couchbase::logger::set_log_levels(cbppLogLevel);

    AddonData::Init(env, exports);
    Constants::Init(env, exports);
    Cas::Init(env, exports);
    MutationToken::Init(env, exports);
    Connection::Init(env, exports);
    Transactions::Init(env, exports);
    Transaction::Init(env, exports);

    exports.Set(Napi::String::New(env, "cbppVersion"),
                Napi::String::New(env, "1.0.0-beta"));
    return exports;
}

} // namespace couchnode

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    return couchnode::Init(env, exports);
}
NODE_API_MODULE(couchbase_impl, Init)
