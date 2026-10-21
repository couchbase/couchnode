#pragma once
#include "instance.hpp"
#include <condition_variable>
#include <cstdint>
#include <memory>
#include <mutex>
#include <napi.h>

namespace couchnode
{

// Shuts a connection's instance down when its environment is torn down: on
// `worker.terminate()`, and when the main thread exits with the cluster never
// closed. The teardown waits for the close, but for at most a bound. Past it
// the close is abandoned, and the instance and its IO thread are leaked rather
// than left to hang the teardown.
//
// The wait blocks the environment's thread, which is safe because nothing the
// close does needs that thread: callbacks are queued to thread-safe functions
// with no queue limit, so a call never waits on the loop to drain.
//
// Node-API runs the environment's remaining finalizers, `~Connection` among
// them, after this hook returns, so the connection outlives a running hook.
// `~Connection` cancels a hook that has not run.
class ShutdownHook
{
public:
    // The bound in milliseconds, unless `CN_SHUTDOWN_TIMEOUT_MS` sets one.
    static constexpr uint64_t defaultTimeoutMs = 5000;

    // Reads the bound from the environment's own `process.env`. For a worker
    // started with an `env` option that is the option, not the process
    // environment, which is why this is not `getenv`.
    static uint64_t timeoutFromEnv(Napi::Env env);

    // Registers a hook for `instance`, or returns null if it cannot be.
    static std::shared_ptr<ShutdownHook>
    add(Napi::Env env, std::shared_ptr<Instance> instance, uint64_t timeoutMs);

    // Removes the hook if it has not run. Environment thread only.
    void cancel();

private:
    // What the helper thread that joins the IO thread shares with the hook.
    // It holds no instance, so the helper never keeps one alive past the
    // point the hook stops waiting.
    struct Signal {
        std::mutex mutex;
        std::condition_variable cv;
        bool done{false};
    };

    ShutdownHook(napi_env env, std::shared_ptr<Instance> instance,
                 uint64_t timeoutMs);

    static void onCleanup(void *data);

    void run();

    napi_env _env;
    std::shared_ptr<Instance> _instance;
    uint64_t _timeoutMs;
    bool _registered{false};
    std::shared_ptr<Signal> _signal;
};

} // namespace couchnode
