#pragma once
#include <asio/io_context.hpp>
#include <couchbase/cluster.hxx>
#include <memory>
#include <thread>

namespace couchnode
{

class Instance
{
private:
    ~Instance();

public:
    Instance();

    void asyncDestroy();

    asio::io_context _io;
    std::thread _ioThread;
    std::shared_ptr<couchbase::cluster> _cluster;
};

} // namespace couchnode
