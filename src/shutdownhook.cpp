#include "shutdownhook.hpp"
#include <charconv>
#include <chrono>
#include <string>
#include <system_error>

namespace couchnode
{

uint64_t ShutdownHook::timeoutFromEnv(Napi::Env env)
{
    Napi::Value process = env.Global().Get("process");
    if (!process.IsObject()) {
        return defaultTimeoutMs;
    }
    Napi::Value vars = process.As<Napi::Object>().Get("env");
    if (!vars.IsObject()) {
        return defaultTimeoutMs;
    }
    Napi::Value value = vars.As<Napi::Object>().Get("CN_SHUTDOWN_TIMEOUT_MS");
    if (value.IsUndefined()) {
        return defaultTimeoutMs;
    }

    auto text = value.ToString().Utf8Value();
    uint64_t timeoutMs = 0;
    auto [end, ec] =
        std::from_chars(text.data(), text.data() + text.size(), timeoutMs);
    if (text.empty() || ec != std::errc{} || end != text.data() + text.size()) {
        CB_LOG_WARNING("Ignoring CN_SHUTDOWN_TIMEOUT_MS=\"{}\", which is not a "
                       "whole number of milliseconds; using {}",
                       text, defaultTimeoutMs);
        return defaultTimeoutMs;
    }
    return timeoutMs;
}

std::shared_ptr<ShutdownHook>
ShutdownHook::add(Napi::Env env, std::shared_ptr<Instance> instance,
                  uint64_t timeoutMs)
{
    std::shared_ptr<ShutdownHook> hook(
        new ShutdownHook(env, std::move(instance), timeoutMs));
    if (napi_add_env_cleanup_hook(env, onCleanup, hook.get()) != napi_ok) {
        CB_LOG_WARNING("Unable to add a cleanup hook; the cluster will not be "
                       "closed when this environment is torn down");
        return nullptr;
    }
    hook->_registered = true;
    return hook;
}

ShutdownHook::ShutdownHook(napi_env env, std::shared_ptr<Instance> instance,
                           uint64_t timeoutMs)
    : _env(env)
    , _instance(std::move(instance))
    , _timeoutMs(timeoutMs)
    , _signal(std::make_shared<Signal>())
{
}

void ShutdownHook::cancel()
{
    if (!_registered) {
        return;
    }
    _registered = false;
    napi_remove_env_cleanup_hook(_env, onCleanup, this);
}

void ShutdownHook::onCleanup(void *data)
{
    static_cast<ShutdownHook *>(data)->run();
}

void ShutdownHook::run()
{
    // Node-API has already dropped the hook by the time it runs.
    _registered = false;

    _instance->shutdown([signal = _signal]() {
        {
            std::lock_guard<std::mutex> lock(signal->mutex);
            signal->done = true;
        }
        signal->cv.notify_one();
    });

    std::unique_lock<std::mutex> lock(_signal->mutex);
    if (!_signal->cv.wait_for(lock, std::chrono::milliseconds(_timeoutMs),
                              [this]() { return _signal->done; })) {
        CB_LOG_WARNING("The cluster did not close within {} ms of its "
                       "environment being torn down; abandoning the close",
                       _timeoutMs);
    }
}

} // namespace couchnode
