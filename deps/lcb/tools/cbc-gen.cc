/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018-2020 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#include "config.h"
#include <csignal>
#include <iostream>
#include <map>
#include <cstdio>
#include <stdexcept>
#include <list>
#include <thread>
#include <mutex>

#include <libcouchbase/couchbase.h>
#include <libcouchbase/metrics.h>
#include <include/libcouchbase/vbucket.h>
#include <random>
#include <algorithm>
#include <iomanip>

#include "internalstructs.h" /* for access to connstr member */

#include "common/options.h"
#include "common/histogram.h"
#include "gen/lexer.h"

#include "linenoise/linenoise.h"

#define CBCGEN_HISTORY_FILENAME ".cbcgen_history"

using namespace cbc;
using namespace cliopts;

static void do_or_die(lcb_STATUS rc, const std::string &msg = "")
{
    if (rc != LCB_SUCCESS) {
        std::stringstream ss;
        if (!msg.empty()) {
            ss << msg << ". ";
        }
        ss << lcb_strerror_short(rc);
        throw std::runtime_error(ss.str());
    }
}

class Configuration
{
  public:
    Configuration() : o_script("script")
    {
        o_script.abbrev('s').description("Path to script (by default using STDIN interactively)");
    }

    ~Configuration() = default;

    void addToParser(Parser &parser)
    {
        m_params.addToParser(parser);
        parser.addOption(o_script);
    }

    std::string &scriptPath()
    {
        return o_script.const_result();
    }

    void processOptions() {}

    void fillCropts(lcb_CREATEOPTS *&opts)
    {
        m_params.fillCropts(opts);
    }

    lcb_STATUS doCtls(lcb_INSTANCE *instance)
    {
        return m_params.doCtls(instance);
    }

    bool useTimings()
    {
        return m_params.useTimings();
    }

    bool shouldDump()
    {
        return m_params.shouldDump();
    }

  private:
    ConnParams m_params;
    StringOption o_script;
};

static Configuration config;

class KeyGenerator
{
  public:
    virtual const std::string &next() = 0;
    virtual ~KeyGenerator() = default;
};

class DistributedKeyGenerator : public KeyGenerator
{
  private:
    std::vector<std::string> key_pool;
    std::vector<std::string>::const_iterator itr;

  public:
    explicit DistributedKeyGenerator(lcb_INSTANCE *instance, const std::string &prefix = "key_",
                                     size_t num_keys_per_vbucket = 1)
    {
        lcbvb_CONFIG *vbc;
        do_or_die(lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc));
        size_t num_vbuckets = lcbvb_get_nvbuckets(vbc);
        if (num_vbuckets == 0) {
            throw std::runtime_error("The configuration does not contain any vBuckets");
        }
        std::vector<std::vector<std::string>> key_groups(num_vbuckets);
        size_t left = num_keys_per_vbucket * num_vbuckets;
        size_t i = 0;
        while (left > 0 && i < std::numeric_limits<size_t>::max()) {
            std::stringstream ss;
            ss << prefix << std::setw(8) << std::setfill('0') << i++;
            std::string key = ss.str();
            int vbid = 0, srvix = 0;
            lcbvb_map_key(vbc, key.data(), key.size(), &vbid, &srvix);
            if (key_groups[vbid].size() < num_keys_per_vbucket) {
                key_groups[vbid].push_back(key);
                left--;
            }
        }
        if (left > 0) {
            throw std::runtime_error("Unable to generate keys for some vBuckets");
        }
        for (auto &group : key_groups) {
            for (auto &key : group) {
                key_pool.push_back(key);
            }
        }
        unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
        std::shuffle(key_pool.begin(), key_pool.end(), std::default_random_engine(seed));
        itr = key_pool.begin();
    }

    ~DistributedKeyGenerator() override = default;

    const std::string &next() override
    {
        if (itr == key_pool.end()) {
            itr = key_pool.begin();
        }
        const std::string &key = *itr;
        itr++;
        return key;
    }
};

class ValueGenerator
{
  public:
    virtual const std::string &next() = 0;
    virtual ~ValueGenerator() = default;
};

size_t value_pool_size = 1024;
size_t value_size_min = 128;
size_t value_size_max = 128;

class BoundedValueGenerator : public ValueGenerator
{
  private:
    std::vector<std::string> value_pool;
    std::vector<std::string>::const_iterator itr;

  public:
    explicit BoundedValueGenerator(size_t minimum_size = value_size_min, size_t maximum_size = value_size_max,
                                   size_t pool_size = value_pool_size)
    {
        if (minimum_size < 12) {
            minimum_size = 12;
        }
        if (maximum_size < minimum_size) {
            maximum_size = minimum_size;
        }
        if (pool_size < 1) {
            pool_size = 1;
        }
        unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
        auto rnd = std::default_random_engine(seed);
        std::uniform_int_distribution<size_t> dist(minimum_size, maximum_size);

        for (size_t idx = 0; idx < pool_size; idx++) {
            size_t value_size = dist(rnd) - 12;
            value_pool.push_back(std::string(R"({"value":")") + std::string(value_size, 'x') + std::string(R"("})"));
        }
        itr = value_pool.begin();
    }

    ~BoundedValueGenerator() override = default;

    const std::string &next() override
    {
        if (itr == value_pool.end()) {
            itr = value_pool.begin();
        }
        const std::string &value = *itr;
        itr++;
        return value;
    }
};

class Workload
{
  public:
    enum op_type { op_write = 0, op_read, op_delete };

    Workload(unsigned int writes, unsigned int reads, unsigned int deletes)
        : rnd(std::chrono::system_clock::now().time_since_epoch().count()), dist(0, 100), weights_(0)
    {
        if (writes + reads + deletes != 100) {
            throw std::runtime_error("Workload definition should give 100% in total");
        }
        weights_.emplace_back(op_write, writes);
        weights_.emplace_back(op_read, reads);
        weights_.emplace_back(op_delete, deletes);
        std::sort(weights_.begin(), weights_.end(), [](op a, op b) { return a.second < b.second; });
    }

    op_type next()
    {
        unsigned int num = dist(rnd);
        op_type res = weights_.back().first;
        auto margin = std::find_if(weights_.begin(), weights_.end(), [num](op x) { return num < x.second; });
        if (margin != weights_.end()) {
            res = margin->first;
        }
        return res;
    }

    friend std::ostream &operator<<(std::ostream &os, const Workload &workload)
    {
        for (auto &entry : workload.weights_) {
            os << entry.second << "% ";
            switch (entry.first) {
                case op_write:
                    os << "writes, ";
                    break;
                case op_read:
                    os << "reads, ";
                    break;
                case op_delete:
                    os << "deletes, ";
                    break;
            }
        }
        return os;
    }

  private:
    std::default_random_engine rnd;
    std::uniform_int_distribution<unsigned int> dist;

    typedef std::pair<op_type, unsigned int> op;
    std::vector<op> weights_;
};

class Worker;
void io_loop(Worker *worker, size_t num_items);
void generator_loop(Worker *worker, size_t num_items);

struct Stats {
    unsigned long total{0};
    unsigned long reads{0};
    unsigned long writes{0};
    unsigned long deletes{0};

    void reset()
    {
        total = reads = writes = deletes = 0;
    }

    friend std::ostream &operator<<(std::ostream &os, const Stats &stats)
    {
        os << "total: " << stats.total << ", writes: " << stats.writes << ", reads: " << stats.reads
           << ", deletes: " << stats.deletes;
        return os;
    }
};

extern "C" {
void store_callback(lcb_INSTANCE *, int, lcb_RESPSTORE *resp)
{
    Stats *stats = nullptr;
    lcb_respstore_cookie(resp, reinterpret_cast<void **>(&stats));
    stats->writes++;
    stats->total++;
}
void get_callback(lcb_INSTANCE *, int, lcb_RESPGET *resp)
{
    Stats *stats = nullptr;
    lcb_respget_cookie(resp, reinterpret_cast<void **>(&stats));
    stats->reads++;
    stats->total++;
}
void remove_callback(lcb_INSTANCE *, int, lcb_RESPREMOVE *resp)
{
    Stats *stats = nullptr;
    lcb_respremove_cookie(resp, reinterpret_cast<void **>(&stats));
    stats->deletes++;
    stats->total++;
}
}

size_t batch_size = 1024;

Workload current_workload(100, 0, 0);

class Worker
{
  public:
    explicit Worker(const std::string &ident = "")
        : is_running(false), instance(nullptr), io_thr(nullptr), gen_thr(nullptr), keygen(nullptr), valgen(nullptr)
    {
        lcb_CREATEOPTS *cropts = nullptr;
        config.fillCropts(cropts);
        do_or_die(lcb_create(&instance, cropts), "Failed to create connection");
        lcb_createopts_destroy(cropts);
        config.doCtls(instance);
        do_or_die(lcb_connect(instance), "Failed to connect to cluster");
        do_or_die(lcb_wait(instance, LCB_WAIT_DEFAULT), "Failed to wait for connection bootstrap");
        do_or_die(lcb_get_bootstrap_status(instance), "Failed to bootstrap");
        lcb_install_callback(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
        lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
        lcb_install_callback(instance, LCB_CALLBACK_REMOVE, (lcb_RESPCALLBACK)remove_callback);
        if (config.useTimings()) {
            hg.install(instance, stdout);
        }
        {
            int activate = 1;
            lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_METRICS, &activate);
        }
        if (ident.empty()) {
            std::stringstream ss("w");
            ss << next_id++;
            id = ss.str();
        } else {
            id = ident;
        }

        keygen = new DistributedKeyGenerator(instance);
        valgen = new BoundedValueGenerator();
    }

    ~Worker()
    {
        stop();
        if (instance) {
            if (config.shouldDump()) {
                lcb_dump(instance, stderr, LCB_DUMP_ALL);
            }
            if (config.useTimings()) {
                hg.write();
            }
            if (instance) {
                lcb_destroy(instance);
            }
            instance = nullptr;
        }

        delete valgen;
        delete keygen;
    }

    const std::string &next_key()
    {
        return keygen->next();
    }

    const std::string &next_value()
    {
        return valgen->next();
    }

    void start(size_t num_items)
    {
        is_running = true;
        io_thr = new std::thread(io_loop, this, num_items);
        gen_thr = new std::thread(generator_loop, this, num_items);
        stats_.reset();
    }

    void stop()
    {
        is_running = false;
        join();
        delete io_thr;
        io_thr = nullptr;
        delete gen_thr;
        gen_thr = nullptr;
    }

    void join() const
    {
        if (gen_thr != nullptr && gen_thr->joinable()) {
            gen_thr->join();
        }
        if (io_thr != nullptr && io_thr->joinable()) {
            io_thr->join();
        }
    }

    void push_batch(std::list<std::pair<Workload::op_type, void *>> &batch)
    {
        std::unique_lock<std::mutex> lock(mutex_);
        for (auto &cmd : batch) {
            list_.emplace_back(cmd);
        }
    }

    bool want_more()
    {
        std::unique_lock<std::mutex> lock(mutex_);
        return list_.size() < batch_size;
    }

    std::size_t flush()
    {
        std::unique_lock<std::mutex> lock(mutex_);
        if (list_.empty()) {
            return 0;
        }

        std::size_t scheduled = 0;
        lcb_sched_enter(instance);
        for (auto &entry : list_) {
            lcb_STATUS rc = LCB_SUCCESS;
            switch (entry.first) {
                case Workload::op_write: {
                    auto *cmd = reinterpret_cast<lcb_CMDSTORE *>(entry.second);
                    rc = lcb_store(instance, reinterpret_cast<void *>(&stats_), cmd);
                    lcb_cmdstore_destroy(cmd);
                } break;
                case Workload::op_read: {
                    auto *cmd = reinterpret_cast<lcb_CMDGET *>(entry.second);
                    rc = lcb_get(instance, reinterpret_cast<void *>(&stats_), cmd);
                    lcb_cmdget_destroy(cmd);
                } break;
                case Workload::op_delete: {
                    auto *cmd = reinterpret_cast<lcb_CMDREMOVE *>(entry.second);
                    rc = lcb_remove(instance, reinterpret_cast<void *>(&stats_), cmd);
                    lcb_cmdremove_destroy(cmd);
                } break;
            }
            if (rc != LCB_SUCCESS) {
                lcb_sched_fail(instance);
                break;
            }
            ++scheduled;
        }
        lcb_sched_leave(instance);
        list_.clear();
        return scheduled;
    }

    const Stats &stats()
    {
        return stats_;
    }

    size_t total_ops() const
    {
        return stats_.total;
    }

    std::string id;
    bool is_running;
    lcb_INSTANCE *instance;
    std::thread *io_thr;
    std::thread *gen_thr;

  private:
    static int next_id;

    std::mutex mutex_;
    std::list<std::pair<Workload::op_type, void *>> list_;

    KeyGenerator *keygen;
    ValueGenerator *valgen;
    Stats stats_;

    Histogram hg{};
};
int Worker::next_id = 0;

void io_loop(Worker *worker, size_t num_items)
{
    bool has_limit = num_items > 0;
    while (worker->is_running) {
        if (has_limit && worker->total_ops() >= num_items) {
            break;
        }
        size_t itr = 10;
        while (itr > 0 && worker->is_running) {
            lcb_tick_nowait(worker->instance);
            worker->flush();
            itr--;
            if (has_limit && worker->total_ops() >= num_items) {
                break;
            }
        }
        lcb_wait(worker->instance, LCB_WAIT_DEFAULT);
    }
    lcb_wait(worker->instance, LCB_WAIT_DEFAULT);
    if (has_limit) {
        worker->is_running = false;
        std::cout << "# worker " << worker->id << " has been stopped: " << worker->stats() << std::endl;
    }
}

lcb_DURABILITY_LEVEL durability_level = LCB_DURABILITYLEVEL_NONE;

void generator_loop(Worker *worker, size_t num_items)
{
    bool has_limit = num_items > 0;
    size_t items_left = num_items;
    std::list<std::pair<Workload::op_type, void *>> batch;

    while (worker->is_running) {
        if (has_limit && items_left == 0) {
            break;
        }
        if (worker->want_more()) {
            for (size_t i = 0; i < batch_size; ++i) {
                lcb_STATUS rc;
                Workload::op_type type = current_workload.next();
                switch (type) {
                    case Workload::op_write: {
                        lcb_CMDSTORE *cmd = nullptr;
                        rc = lcb_cmdstore_create(&cmd, LCB_STORE_UPSERT);
                        if (rc != LCB_SUCCESS) {
                            continue;
                        }
                        const std::string &key = worker->next_key();
                        const std::string &value = worker->next_value();
                        lcb_cmdstore_key(cmd, key.data(), key.size());
                        lcb_cmdstore_value(cmd, value.data(), value.size());
                        lcb_cmdstore_durability(cmd, durability_level);
                        batch.emplace_back(type, reinterpret_cast<void *>(cmd));
                    } break;
                    case Workload::op_read: {
                        lcb_CMDGET *cmd = nullptr;
                        rc = lcb_cmdget_create(&cmd);
                        if (rc != LCB_SUCCESS) {
                            continue;
                        }
                        const std::string &key = worker->next_key();
                        lcb_cmdget_key(cmd, key.data(), key.size());
                        batch.emplace_back(type, reinterpret_cast<void *>(cmd));
                    } break;
                    case Workload::op_delete: {
                        lcb_CMDREMOVE *cmd = nullptr;
                        rc = lcb_cmdremove_create(&cmd);
                        if (rc != LCB_SUCCESS) {
                            continue;
                        }
                        const std::string &key = worker->next_key();
                        lcb_cmdremove_key(cmd, key.data(), key.size());
                        lcb_cmdremove_durability(cmd, durability_level);
                        batch.emplace_back(type, reinterpret_cast<void *>(cmd));
                    } break;
                }
                items_left--;
                if (has_limit && items_left == 0) {
                    break;
                }
            }
            worker->push_batch(batch);
            batch.clear();
        }
        usleep(100000);
    }
}

std::map<std::string, Worker *> workers;

static const char *handlers_sorted[] = {"help",            // HelpHandler
                                        "create",          // CreateHandler
                                        "destroy",         // DestroyHandler
                                        "start",           // StartHandler
                                        "stop",            // StopHandler
                                        "list",            // ListHandler
                                        "wait",            // WaitHandler
                                        "dump",            // DumpHandler
                                        "batch-size",      // BatchSizeHandler
                                        "value-pool-size", // ValuePoolSizeHandler
                                        "value-size-max",  // ValueSizeMaxHandler
                                        "value-size-min",  // ValueSizeMinHandler
                                        nullptr};

static void command_completion(const char *buf, linenoiseCompletions *lc)
{
    size_t nbuf = strlen(buf);
    for (const char **cur = handlers_sorted; *cur; cur++) {
        if (memcmp(buf, *cur, nbuf) == 0) {
            linenoiseAddCompletion(lc, *cur);
        }
    }
}

struct bm_COMMAND {
    std::string name{};
    std::vector<std::string> args{};
    std::map<std::string, std::string> options{};
};

namespace gen
{
class Handler;
}

static std::map<std::string, gen::Handler *> handlers;

namespace gen
{
#define HANDLER_DESCRIPTION(s)                                                                                         \
    const char *description() const override                                                                           \
    {                                                                                                                  \
        return s;                                                                                                      \
    }
#define HANDLER_USAGE(s)                                                                                               \
    const char *usagestr() const override                                                                              \
    {                                                                                                                  \
        return s;                                                                                                      \
    }

class Handler
{
  public:
    explicit Handler(const char *name)
    {
        if (name != nullptr) {
            cmdname = name;
        }
    }

    virtual ~Handler() = default;

    virtual const char *description() const
    {
        return nullptr;
    }

    virtual const char *usagestr() const
    {
        return nullptr;
    }

    virtual void execute(bm_COMMAND &cmd) = 0;

  protected:
    std::string cmdname{};
};

class HelpHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Show help")
    HelpHandler() : Handler("help") {}

  protected:
    void execute(bm_COMMAND &) override
    {
        fprintf(stderr, "Usage: <command> [options]\n");
        fprintf(stderr, "command may be:\n");
        for (const char **cur = handlers_sorted; *cur; cur++) {
            const Handler *handler = handlers[*cur];
            fprintf(stderr, "   %-20s", *cur);
            fprintf(stderr, "%s\n", handler->description());
        }
    }
};

class DumpHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Dump metrics and internal state of library")
    DumpHandler() : Handler("dump") {}

  protected:
    void execute(bm_COMMAND &) override
    {
        for (auto &wpair : workers) {
            if (wpair.second->is_running) {
                lcb_dump(wpair.second->instance, stderr, LCB_DUMP_ALL);
                lcb_METRICS *metrics = nullptr;
                lcb_cntl(wpair.second->instance, LCB_CNTL_GET, LCB_CNTL_METRICS, &metrics);

                if (metrics) {
                    fprintf(stderr, "%p: nsrv: %d, retried: %lu\n", (void *)wpair.second->instance,
                            (int)metrics->nservers, (unsigned long)metrics->packets_retried);
                    for (size_t ii = 0; ii < metrics->nservers; ii++) {
                        fprintf(stderr,
                                "  [srv-%d] snt: %lu, rcv: %lu, q: %lu, err: %lu, tmo: %lu, nmv: %lu, orph: %lu\n",
                                (int)ii, (unsigned long)metrics->servers[ii]->packets_sent,
                                (unsigned long)metrics->servers[ii]->packets_read,
                                (unsigned long)metrics->servers[ii]->packets_queued,
                                (unsigned long)metrics->servers[ii]->packets_errored,
                                (unsigned long)metrics->servers[ii]->packets_timeout,
                                (unsigned long)metrics->servers[ii]->packets_nmv,
                                (unsigned long)metrics->servers[ii]->packets_ownerless);
                    }
                }
            }
        }
    }
};

class CreateHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Establish new connection to the cluster")
    CreateHandler() : Handler("create") {}

  protected:
    void execute(bm_COMMAND &) override
    {
        auto *worker = new Worker();
        workers[worker->id] = worker;
        std::cout << "# worker " << worker->id << " has been created and connected" << std::endl;
    }
};

class DestroyHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Destroy connection to the cluster")
    DestroyHandler() : Handler("destroy") {}

  protected:
    void execute(bm_COMMAND &) override
    {
        for (auto &wpair : workers) {
            std::string id = wpair.first;
            delete wpair.second;
            workers.erase(id);
            std::cout << "# worker " << id << " has been destroyed" << std::endl;
        }
    }
};

class WorkloadHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Describes workload for future workers (default writes=100, reads=0, deletes=0)")
    WorkloadHandler() : Handler("workload") {}

  protected:
    void execute(bm_COMMAND &cmd) override
    {
        if (!cmd.options.empty()) {
            unsigned int writes = 0, reads = 0, deletes = 0;
            if (cmd.options.count("writes")) {
                writes = std::stoull(cmd.options["writes"]);
            }
            if (cmd.options.count("reads")) {
                reads = std::stoull(cmd.options["reads"]);
            }
            if (cmd.options.count("deletes")) {
                deletes = std::stoull(cmd.options["deletes"]);
            }
            current_workload = Workload(writes, reads, deletes);
        }
        std::cout << "# current_workload = " << current_workload << std::endl;
    }
};

class StartHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Start workers and schedule workload")
    StartHandler() : Handler("start") {}

  protected:
    void execute(bm_COMMAND &cmd) override
    {
        size_t num_items = 0;
        std::string opt_msg;
        if (cmd.options.count("num-items")) {
            num_items = std::stoull(cmd.options["num-items"]);
            opt_msg = " (with limit of " + std::to_string(num_items) + " items)";
        }
        for (auto &wpair : workers) {
            if (!wpair.second->is_running) {
                wpair.second->start(num_items);
                std::cout << "# worker " << wpair.first << " has been started" << opt_msg << std::endl;
            }
        }
    }
};

class StopHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Stop running workers")
    StopHandler() : Handler("stop") {}

  protected:
    void execute(bm_COMMAND &) override
    {
        for (auto &wpair : workers) {
            if (wpair.second->is_running) {
                wpair.second->stop();
                std::cout << "# worker " << wpair.first << " has been stopped" << std::endl;
            }
        }
    }
};

class ListHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("List workers and schedule workload")
    ListHandler() : Handler("list") {}

  protected:
    void execute(bm_COMMAND &) override
    {
        for (auto &wpair : workers) {
            std::cout << "# worker " << wpair.first << ": " << (wpair.second->is_running ? "running" : "stopped")
                      << std::endl;
        }
    }
};

class WaitHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Wait for all workers to complete")
    WaitHandler() : Handler("wait") {}

  protected:
    void execute(bm_COMMAND &) override
    {
        std::cout << "# waiting for " << workers.size() << " worker(s) to complete" << std::endl;
        for (auto &wpair : workers) {
            wpair.second->join();
        }
    }
};

class BatchSizeHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Get or set size of batch for generator threads")
    BatchSizeHandler() : Handler("batch-size") {}

  protected:
    void execute(bm_COMMAND &cmd) override
    {
        if (cmd.args.empty()) {
            std::cout << "# batch-size = " << batch_size << std::endl;
        } else {
            size_t val = std::stoull(cmd.args[0]);
            if (val > 0) {
                batch_size = val;
            }
        }
    }
};

class ValueSizeMaxHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Get or set maximum size of document value")
    ValueSizeMaxHandler() : Handler("value-size-max") {}

  protected:
    void execute(bm_COMMAND &cmd) override
    {
        if (cmd.args.empty()) {
            std::cout << "# value-size-max = " << value_size_max << std::endl;
        } else {
            size_t val = std::stoull(cmd.args[0]);
            if (val > 0) {
                value_size_max = val;
            }
        }
    }
};

class ValueSizeMinHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Get or set minimum size of document value")
    ValueSizeMinHandler() : Handler("value-size-min") {}

  protected:
    void execute(bm_COMMAND &cmd) override
    {
        if (cmd.args.empty()) {
            std::cout << "# value-size-min = " << value_size_min << std::endl;
        } else {
            size_t val = std::stoull(cmd.args[0]);
            if (val > 0) {
                value_size_min = val;
            }
        }
    }
};

class ValuePoolSizeHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Get or set size of pool of pre-generated document values")
    ValuePoolSizeHandler() : Handler("value-pool-size") {}

  protected:
    void execute(bm_COMMAND &cmd) override
    {
        if (cmd.args.empty()) {
            std::cout << "# value-pool-size = " << value_pool_size << std::endl;
        } else {
            size_t val = std::stoull(cmd.args[0]);
            if (val > 0) {
                value_pool_size = val;
            }
        }
    }
};

std::string durability_level_to_string(lcb_DURABILITY_LEVEL level)
{
    switch (level) {
        case LCB_DURABILITYLEVEL_NONE:
            return "none";
        case LCB_DURABILITYLEVEL_MAJORITY:
            return "majority";
        case LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE:
            return "majority_and_persist_to_active";
        case LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY:
            return "persist_to_majority";
        default:
            throw std::runtime_error("Unknown durability level");
    }
}

class DurabilityLevelHandler : public Handler
{
  public:
    HANDLER_DESCRIPTION("Get or set durability level for mutation operations")
    DurabilityLevelHandler() : Handler("durability-level") {}

  protected:
    void execute(bm_COMMAND &cmd) override
    {
        if (cmd.args.empty()) {
            std::cout << "# durability-level = " << durability_level_to_string(durability_level) << std::endl;
        } else {
            const std::string &level_str = cmd.args[0];
            if (level_str == "none") {
                durability_level = LCB_DURABILITYLEVEL_NONE;
            } else if (level_str == "majority") {
                durability_level = LCB_DURABILITYLEVEL_MAJORITY;
            } else if (level_str == "majority_and_persist_to_active") {
                durability_level = LCB_DURABILITYLEVEL_MAJORITY_AND_PERSIST_TO_ACTIVE;
            } else if (level_str == "persist_to_majority") {
                durability_level = LCB_DURABILITYLEVEL_PERSIST_TO_MAJORITY;
            } else {
                throw std::runtime_error("Unknown durability level. Use of of the following:\n"
                                         "  - none\n"
                                         "  - majority\n"
                                         "  - majority_and_persist_to_active\n"
                                         "  - persist_to_majority");
            }
        }
    }

  private:
};

} // namespace gen

static void setupHandlers()
{
    handlers["help"] = new gen::HelpHandler();
    handlers["dump"] = new gen::DumpHandler();
    handlers["create"] = new gen::CreateHandler();
    handlers["destroy"] = new gen::DestroyHandler();
    handlers["start"] = new gen::StartHandler();
    handlers["stop"] = new gen::StopHandler();
    handlers["list"] = new gen::ListHandler();
    handlers["wait"] = new gen::WaitHandler();
    handlers["durability-level"] = new gen::DurabilityLevelHandler();
    handlers["batch-size"] = new gen::BatchSizeHandler();
    handlers["value-pool-size"] = new gen::ValuePoolSizeHandler();
    handlers["value-size-min"] = new gen::ValueSizeMinHandler();
    handlers["value-size-max"] = new gen::ValueSizeMaxHandler();
    handlers["workload"] = new gen::WorkloadHandler();
}

bool cleaning = false;

static void cleanup()
{
    if (cleaning) {
        return;
    }
    cleaning = true;
    bm_COMMAND cmd;
    handlers["stop"]->execute(cmd);
    handlers["destroy"]->execute(cmd);

    for (const auto &handler : handlers) {
        delete handler.second;
    }
    handlers.clear();
}

static void sigint_handler(int)
{
    static int ncalled = 0;
    ncalled++;

    if (ncalled < 2) {
        std::cerr << "\nTermination requested. Waiting threads to finish. Ctrl-C to force termination." << std::endl;
        signal(SIGINT, sigint_handler); // Reinstall
    } else {
        exit(EXIT_FAILURE);
    }
    cleanup();
    exit(EXIT_FAILURE);
}

static void setup_sigint_handler()
{
    struct sigaction action = {};
    sigemptyset(&action.sa_mask);
    action.sa_handler = sigint_handler;
    action.sa_flags = 0;
    sigaction(SIGINT, &action, nullptr);
}

static void real_main(int argc, char **argv)
{
    std::string history_path = ConnParams::getUserHome() + CBCGEN_HISTORY_FILENAME;
    Parser parser;

    config.addToParser(parser);
    parser.parse(argc, argv);
    config.processOptions();

    FILE *finput = stdin;
    if (!config.scriptPath().empty()) {
        finput = fopen(config.scriptPath().c_str(), "r");
        if (finput == nullptr) {
            perror("unable to open script file");
            exit(EXIT_FAILURE);
        }
    }

    setupHandlers();
    std::atexit(cleanup);
    setup_sigint_handler();

    linenoiseSetCompletionCallback(command_completion);
    linenoiseSetMultiLine(1);
    linenoiseHistoryLoad(history_path.c_str());
    linenoiseSetInputStream(finput);

    {
        lcb_CREATEOPTS *cropts = nullptr;
        config.fillCropts(cropts);
        std::cerr << "# connection-string = " << cropts->connstr << std::endl;
        lcb_createopts_destroy(cropts);
    }
    if (finput == stdin) {
        std::cerr << "# value-pool-size = " << value_pool_size << std::endl;
        std::cerr << "# value-size-max = " << value_size_max << std::endl;
        std::cerr << "# value-size-min = " << value_size_min << std::endl;
        std::cerr << "# batch-size = " << batch_size << std::endl;
        std::cerr << "# durability-level = " << gen::durability_level_to_string(durability_level) << std::endl;
        std::cout << "# current_workload = " << current_workload << std::endl;
    }

    do {
        char *line = linenoise("gen> ");
        const char *ptr;
        if (line == nullptr) {
            break;
        }
        if (strlen(line) == 0 || line[0] == '#') {
            /* ignore empty lines and comments */
            linenoiseFree(line);
            continue;
        }
        if (finput == stdin && isatty(fileno(stdin))) {
            linenoiseHistoryAdd(line);
            linenoiseHistorySave(history_path.c_str());
        } else {
            std::cerr << "> " << line << std::endl;
        }
        ptr = line;
        bm_COMMAND cmd;
        do {
            bm_TOKEN tok;
            ptr = (char *)lex(ptr, &tok);
            if (ptr == nullptr) {
                break;
            }
            if (cmd.name.empty()) {
                if (tok.type == BM_TOKEN_WORD) {
                    cmd.name.assign(tok.t.word.ptr, tok.t.word.len);
                    continue;
                } else {
                    fprintf(stderr, "Missing command name\n");
                    break;
                }
            }
            switch (tok.type) {
                case BM_TOKEN_WORD:
                    cmd.args.emplace_back(tok.t.word.ptr, tok.t.word.len);
                    break;
                case BM_TOKEN_OPTION:
                    cmd.options.emplace(std::string(tok.t.option.key, tok.t.option.klen),
                                        std::string(tok.t.option.val, tok.t.option.vlen));
                    break;
                default:
                    break;
            }
        } while (true);
        if (!cmd.name.empty()) {
            gen::Handler *handler = handlers[cmd.name];
            if (handler == nullptr) {
                fprintf(stderr, "Unknown command %s\n", cmd.name.c_str());
                handlers["help"]->execute(cmd);
            } else {
                try {
                    handler->execute(cmd);
                } catch (std::exception &err) {
                    fprintf(stderr, "%s\n", err.what());
                }
            }
        }
        linenoiseFree(line);
    } while (true);
}

int main(int argc, char **argv)
{
    try {
        real_main(argc, argv);
        return 0;
    } catch (std::exception &exc) {
        std::cerr << exc.what() << std::endl;
        exit(EXIT_FAILURE);
    }
}
