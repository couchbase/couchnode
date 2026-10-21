#pragma once
#include <asio/io_context.hpp>
#include <core/cluster.hxx>
#include <core/logger/logger.hxx>
#include <functional>
#include <memory>
#include <mutex>
#include <thread>

namespace couchnode
{

// Owned through `std::shared_ptr`. The last reference must never be dropped on
// the IO thread, since destroying the instance destroys the IO context that
// thread is running.
class Instance : public std::enable_shared_from_this<Instance>
{
public:
    Instance();
    ~Instance();

    // Closes the cluster and joins the IO thread, on a helper thread that holds
    // a reference until the join returns. Only the first call does anything;
    // `done` runs on the helper thread after the join and may be empty. When no
    // helper thread can be started, the close is abandoned, the instance is
    // leaked, and `done` runs before this returns.
    void shutdown(std::function<void()> done);

    asio::io_context _io;
    std::thread _ioThread;
    couchbase::core::cluster _cluster;

private:
    std::once_flag _shutdownOnce;
};

} // namespace couchnode
