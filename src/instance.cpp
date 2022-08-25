#include "instance.hpp"

namespace couchnode
{

Instance::Instance()
    : _cluster(couchbase::core::cluster::create(_io))
{
    _ioThread = std::thread([this]() { _io.run(); });
}

Instance::~Instance()
{
}

void Instance::asyncDestroy()
{
    _cluster->close([this]() mutable {
        // We have to run this on a separate thread since the callback itself is
        // actually running from within the io context.
        std::thread([this]() {
            _ioThread.join();
            delete this;
        }).detach();
    });
}

} // namespace couchnode
