#include "instance.hpp"
#include <future>
#include <system_error>

namespace couchnode
{

Instance::Instance()
    : _cluster(couchbase::core::cluster(_io))
{
    _ioThread = std::thread([this]() {
        try {
            _io.run();
        } catch (const std::exception &e) {
            CB_LOG_ERROR(e.what());
            throw;
        } catch (...) {
            CB_LOG_ERROR("Unknown exception");
            throw;
        }
    });
}

Instance::~Instance()
{
}

void Instance::shutdown(std::function<void()> done)
{
    std::call_once(_shutdownOnce, [this, &done]() {
        // The close handler runs on the IO thread, or inline when the cluster
        // was already closed, and the join cannot run on the IO thread. So the
        // whole shutdown runs on a helper thread that waits for the close. Its
        // reference keeps the last release off the IO thread.
        try {
            std::thread([self = shared_from_this(), done]() mutable {
                auto closed = std::make_shared<std::promise<void>>();
                auto closing = closed->get_future();
                self->_cluster.close([closed]() { closed->set_value(); });
                closing.wait();
                self->_ioThread.join();
                // Released before `done`, so a caller that waits on `done` and
                // holds its own reference destroys the instance itself.
                self.reset();
                if (done) {
                    done();
                }
            }).detach();
        } catch (const std::system_error &e) {
            // No helper thread, and the join cannot run on this one, so the
            // close is abandoned as one that times out is. Destroying the
            // instance with its IO thread still joinable would end the
            // process, so a reference is leaked on purpose to keep it alive.
            CB_LOG_WARNING("Unable to start a thread to close the cluster "
                           "({}); abandoning the close",
                           e.what());
            static_cast<void>(
                new std::shared_ptr<Instance>(shared_from_this()));
            if (done) {
                done();
            }
        }
    });
}

} // namespace couchnode
