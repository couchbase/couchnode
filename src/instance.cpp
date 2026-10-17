#include "instance.hpp"
#include <algorithm>
#include <core/transactions.hxx>
#include <future>
#include <system_error>

namespace couchnode
{

TransactionOp::TransactionOp(std::shared_ptr<Count> count)
    : _count(std::move(count))
{
    ++*_count;
}

TransactionOp::~TransactionOp()
{
    complete();
}

void TransactionOp::complete()
{
    if (_completed.exchange(true)) {
        return;
    }
    --*_count;
}

Instance::Instance()
    : _cluster(couchbase::core::cluster(_io))
    , _transactionOps(std::make_shared<TransactionOp::Count>(0))
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

std::shared_ptr<cbcoretxns::transactions> Instance::addTransactions(
    std::shared_ptr<cbcoretxns::transactions> transactions)
{
    std::lock_guard<std::mutex> lock(_transactionsMutex);
    auto *raw = transactions.get();
    _transactions.push_back({std::move(transactions)});
    return std::shared_ptr<cbcoretxns::transactions>(shared_from_this(), raw);
}

void Instance::closeTransactions(const cbcoretxns::transactions *transactions)
{
    std::lock_guard<std::mutex> lock(_transactionsMutex);
    auto owned = std::find_if(
        _transactions.begin(), _transactions.end(),
        [transactions](const auto &o) { return o.impl.get() == transactions; });
    if (owned == _transactions.end() || owned->closed) {
        return;
    }
    owned->impl->close();
    owned->closed = true;
}

std::shared_ptr<TransactionOp> Instance::beginTransactionOp()
{
    return std::make_shared<TransactionOp>(_transactionOps);
}

bool Instance::transactionOpsInFlight() const
{
    return *_transactionOps != 0;
}

void Instance::closeAllTransactions()
{
    std::lock_guard<std::mutex> lock(_transactionsMutex);
    for (auto &owned : _transactions) {
        if (!owned.closed) {
            owned.impl->close();
            owned.closed = true;
        }
    }
}

void Instance::destroyTransactions()
{
    std::lock_guard<std::mutex> lock(_transactionsMutex);
    // The core's destructor closes each object again. That repeats the client
    // record removal: a round trip while the cluster is open, and retries
    // against `cluster_closed` for up to 500 ms per keyspace once it is not.
    _transactions.clear();
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
                self->closeAllTransactions();
                // An operation still in flight uses its transactions object, so
                // that is destroyed once the IO thread has stopped instead. The
                // cluster close cancels the operation, and a transaction past its
                // commit point is then settled by lost transaction cleanup.
                if (!self->transactionOpsInFlight()) {
                    self->destroyTransactions();
                }
                auto closed = std::make_shared<std::promise<void>>();
                auto closing = closed->get_future();
                self->_cluster.close([closed]() { closed->set_value(); });
                closing.wait();
                self->_ioThread.join();
                self->destroyTransactions();
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
