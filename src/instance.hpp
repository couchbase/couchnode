#pragma once
#include <asio/io_context.hpp>
#include <atomic>
#include <core/cluster.hxx>
#include <core/logger/logger.hxx>
#include <cstddef>
#include <functional>
#include <memory>
#include <mutex>
#include <thread>
#include <vector>

namespace couchbase::core::transactions
{
class transactions;
} // namespace couchbase::core::transactions
namespace cbcoretxns = couchbase::core::transactions;

namespace couchnode
{

// One transaction operation in flight. It counts from when the operation
// starts until it completes or its handler is destroyed without completing it,
// whichever comes first, so a handler the core keeps after calling it does not
// count as in flight for as long as the core keeps it.
class TransactionOp
{
public:
    using Count = std::atomic<std::size_t>;

    explicit TransactionOp(std::shared_ptr<Count> count);
    ~TransactionOp();

    TransactionOp(const TransactionOp &) = delete;
    TransactionOp &operator=(const TransactionOp &) = delete;

    // Stops counting the operation. Only the first call does anything.
    void complete();

private:
    std::shared_ptr<Count> _count;
    std::atomic<bool> _completed{false};
};

// Owned through `std::shared_ptr`. The last reference must never be dropped on
// the IO thread, since destroying the instance destroys the IO context that
// thread is running.
class Instance : public std::enable_shared_from_this<Instance>
{
public:
    Instance();
    ~Instance();

    // Takes ownership of a transactions object and returns a pointer to it
    // that keeps this instance alive instead. The instance destroys the object
    // in `shutdown`, on its helper thread, so a wrapper's finalizer never runs
    // the core's destructor on the JS thread. That destructor closes the
    // object again, which waits on the cluster.
    std::shared_ptr<cbcoretxns::transactions>
    addTransactions(std::shared_ptr<cbcoretxns::transactions> transactions);

    // Closes one transactions object, unless it was already closed. Waits on
    // cluster requests, so it belongs on a thread of its own. Holds a lock for
    // the whole close, since the core's close cannot run concurrently and
    // `shutdown` must not close the cluster under it.
    void closeTransactions(const cbcoretxns::transactions *transactions);

    // Counts a transaction operation as in flight until the returned
    // operation completes or is destroyed.
    std::shared_ptr<TransactionOp> beginTransactionOp();

    // On a helper thread that holds a reference until it is done: closes the
    // transactions objects, then the cluster, and joins the IO thread. Only
    // the first call does anything; `done` runs on the helper thread after the
    // join and may be empty. When no helper thread can be started, the close
    // is abandoned, the instance is leaked, and `done` runs before this
    // returns.
    //
    // It runs once nothing on the JS side can reach this instance's objects:
    // at environment teardown, or when the connection is collected, which an
    // operation's pending callback prevents.
    void shutdown(std::function<void()> done);

    asio::io_context _io;
    std::thread _ioThread;
    couchbase::core::cluster _cluster;

private:
    struct OwnedTransactions {
        std::shared_ptr<cbcoretxns::transactions> impl;
        bool closed{false};
    };

    bool transactionOpsInFlight() const;
    void closeAllTransactions();
    void destroyTransactions();

    std::once_flag _shutdownOnce;
    std::mutex _transactionsMutex;
    std::vector<OwnedTransactions> _transactions;
    std::shared_ptr<TransactionOp::Count> _transactionOps;
};

} // namespace couchnode
