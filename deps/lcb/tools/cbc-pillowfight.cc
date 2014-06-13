/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2012 Couchbase, Inc.
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
#include <sys/types.h>
#include <libcouchbase/couchbase.h>
#include <iostream>
#include <map>
#include <sstream>
#include <queue>
#include <list>
#include <cstring>
#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <signal.h>
#ifndef WIN32
#include <pthread.h>
#else
#define usleep(n) Sleep(n/1000)
#endif
#include <cstdarg>
#include "common/options.h"
#include "common/histogram.h"

using namespace std;
using namespace cbc;
using namespace cliopts;
using std::vector;
using std::string;

class Configuration
{
public:
    Configuration() :
        o_iterations("iterations"),
        o_numItems("num-items"),
        o_keyPrefix("key-prefix"),
        o_numThreads("num-threads"),
        o_numInstances("num-instances"),
        o_loop("loop"),
        o_randSeed("random-seed"),
        o_setPercent("ratio"),
        o_minSize("min-size"),
        o_maxSize("max-size"),
        o_noPopulate("no-population"),
        o_pauseAtEnd("pause-at-end")
    {
        o_iterations.setDefault(100).abbrev('i').description("Number of iterations to run");
        o_numItems.setDefault(1000).abbrev('I').description("Number of items to operate on");
        o_keyPrefix.abbrev('p').description("key prefix to use");
        o_numThreads.setDefault(1).abbrev('t').description("The number of threads to use");
        o_numInstances.setDefault(1).abbrev('Q').description("The number of instances to use");
        o_loop.setDefault(false).abbrev('l').description("Loop running load");
        o_randSeed.setDefault(0).abbrev('s').description("Specify random seed");
        o_setPercent.setDefault(33).abbrev('r').description("Specify SET command ratio");
        o_minSize.setDefault(50).abbrev('m').description("Set minimum payload size");
        o_maxSize.setDefault(5120).abbrev('M').description("Set maximum payload size");
        o_noPopulate.setDefault(false).abbrev('n').description("Skip population");
        o_pauseAtEnd.setDefault(false).abbrev('E').description("Pause at end of run (holding connections open) until user input");
    }

    void processOptions() {
        iterations = o_iterations.result();
        maxKey = o_numItems.result();
        prefix = o_keyPrefix.result();
        loop = o_loop.result();
        setprc = o_setPercent.result();
        setMinSize(o_minSize.result());
        setMaxSize(o_maxSize.result());
    }

    void addOptions(Parser& parser) {
        parser.addOption(o_iterations);
        parser.addOption(o_numItems);
        parser.addOption(o_numInstances);
        parser.addOption(o_keyPrefix);
        parser.addOption(o_numThreads);
        parser.addOption(o_loop);
        parser.addOption(o_randSeed);
        parser.addOption(o_setPercent);
        parser.addOption(o_noPopulate);
        parser.addOption(o_minSize);
        parser.addOption(o_maxSize);
        parser.addOption(o_pauseAtEnd);
        params.addToParser(parser);
    }

    ~Configuration() {
        delete []static_cast<char *>(data);
    }

    void setMinSize(uint32_t val) {
        if (val > maxSize) {
            minSize = maxSize;
        } else {
            minSize = val;
        }
    }

    void setMaxSize(uint32_t val) {
        if (data) {
            delete []static_cast<char *>(data);
        }
        maxSize = val;
        if (minSize > maxSize) {
            minSize = maxSize;
        }
        data = static_cast<void *>(new char[maxSize]);
        /* fill data array with pattern */
        uint32_t *iptr = static_cast<uint32_t *>(data);
        for (uint32_t ii = 0; ii < maxSize / sizeof(uint32_t); ++ii) {
            iptr[ii] = 0xdeadbeef;
        }
        /* pad rest bytes with zeros */
        size_t rest = maxSize % sizeof(uint32_t);
        if (rest > 0) {
            char *cptr = static_cast<char *>(data) + (maxSize / sizeof(uint32_t));
            memset(cptr, 0, rest);
        }
    }

    uint32_t getNumInstances(void) { return o_numInstances; }
    bool isTimings(void) { return params.useTimings(); }

    bool isLoop(void) {
        return loop;
    }

    void setDGM(bool val) {
        dgm = val;
    }

    void setWaitTime(uint32_t val) {
        waitTime = val;
    }

    uint32_t getRandomSeed() { return o_randSeed; }
    uint32_t getNumThreads() { return o_numThreads; }
    string& getKeyPrefix() { return prefix; }
    bool shouldntPopulate() { return o_noPopulate; }
    bool shouldPauseAtEnd() { return o_pauseAtEnd; }

    void *data;

    uint32_t maxKey;
    uint32_t iterations;
    uint32_t setprc;
    string prefix;
    uint32_t maxSize;
    uint32_t minSize;
    bool loop;
    bool dgm;
    uint32_t waitTime;
    ConnParams params;

private:
    UIntOption o_iterations;
    UIntOption o_numItems;
    StringOption o_keyPrefix;
    UIntOption o_numThreads;
    UIntOption o_numInstances;
    BoolOption o_loop;
    UIntOption o_randSeed;
    UIntOption o_setPercent;
    UIntOption o_minSize;
    UIntOption o_maxSize;
    BoolOption o_noPopulate;
    BoolOption o_pauseAtEnd; // Should pillowfight pause execution (with
                             // connections open) before exiting?
} config;

void log(const char *format, ...)
{
    char buffer[512];
    va_list args;

    va_start(args, format);
    vsprintf(buffer, format, args);
    if (config.isTimings()) {
        std::cerr << "[" << std::fixed << gethrtime() / 1000000000.0 << "] ";
    }
    std::cerr << buffer << std::endl;
    va_end(args);
}

extern "C" {
    static void storageCallback(lcb_t, const void *,
                                lcb_storage_t, lcb_error_t,
                                const lcb_store_resp_t *);

    static void getCallback(lcb_t, const void *, lcb_error_t,
                            const lcb_get_resp_t *);
}

class InstanceCookie {
public:
    InstanceCookie(lcb_t instance) {
        lcb_set_cookie(instance, this);
        lastPrint = 0;
        if (config.isTimings()) {
            hg.install(instance, stdout);
        }
    }

    static InstanceCookie* get(lcb_t instance) {
        return (InstanceCookie *)lcb_get_cookie(instance);
    }


    static void dumpTimings(lcb_t instance, const char *header) {
        time_t now = time(NULL);
        std::stringstream ss;
        InstanceCookie *ic = get(instance);

        if (now - ic->lastPrint > 0) {
            ic->lastPrint = now;
        } else {
            return;
        }

        Histogram &h = ic->hg;
        std::cout << "[" << std::fixed << gethrtime() / 1000000000.0 << "] " << header << std::endl;
        std::cout << "              +---------+---------+---------+---------+" << std::endl;
        h.write();
        std::cout << "              +----------------------------------------" << std::endl;
    }

private:
    time_t lastPrint;
    Histogram hg;
};

class InstancePool
{
public:
    InstancePool(size_t size): io(NULL) {
#ifndef WIN32
        pthread_mutex_init(&mutex, NULL);
        pthread_cond_init(&cond, NULL);
#endif

        if (config.getNumThreads() == 1) {
            /* allow to share IO object in single-thread only */
            lcb_error_t err = lcb_create_io_ops(&io, NULL);
            if (err != LCB_SUCCESS) {
                log("Failed to create IO option: %s", lcb_strerror(NULL, err));
                exit(EXIT_FAILURE);
            }
        }

        for (size_t ii = 0; ii < size; ++ii) {
            lcb_t instance;
            std::cout << "\rCreating instance " << ii;
            std::cout.flush();

            struct lcb_create_st options;
            ConnParams& cp = config.params;
            lcb_error_t error;

            cp.fillCropts(options);
            options.v.v1.io = io;
            error = lcb_create(&instance, &options);
            if (error == LCB_SUCCESS) {
                (void)lcb_set_store_callback(instance, storageCallback);
                (void)lcb_set_get_callback(instance, getCallback);
                cp.doCtls(instance);
                queue.push(instance);
                handles.push_back(instance);
            } else {
                std::cout << std::endl;
                log("Failed to create instance: %s", lcb_strerror(NULL, error));
                exit(EXIT_FAILURE);
            }

            new InstanceCookie(instance);
            lcb_connect(instance);
            lcb_wait(instance);
            error = lcb_get_bootstrap_status(instance);
            if (error != LCB_SUCCESS) {
                std::cout << std::endl;
                log("Failed to connect: %s", lcb_strerror(instance, error));
                exit(EXIT_FAILURE);
            }
        }
        std::cout << std::endl;
    }

    ~InstancePool() {
        if (config.shouldPauseAtEnd()) {
            std::cout << "pause-at-end specified. " << std::endl
                      << "Press any key to close connections and exit." << std::endl;
            std::cin.get();
        }
        while (!handles.empty()) {
            lcb_destroy(handles.back());
            handles.pop_back();
        }
        lcb_destroy_io_ops(io);
    }

    lcb_t pop() {
#ifndef WIN32
        pthread_mutex_lock(&mutex);
        while (queue.empty()) {
            pthread_cond_wait(&cond, &mutex);
        }
        assert(!queue.empty());
#endif
        lcb_t ret = queue.front();
        queue.pop();
#ifndef WIN32
        pthread_mutex_unlock(&mutex);
#endif
        return ret;
    }

    void push(lcb_t inst) {
#ifndef WIN32
        pthread_mutex_lock(&mutex);
#endif
        queue.push(inst);
#ifndef WIN32
        pthread_cond_signal(&cond);
        pthread_mutex_unlock(&mutex);
#endif
    }

private:
    std::queue<lcb_t> queue;
    std::list<lcb_t> handles;
    lcb_io_opt_t io;
#ifndef WIN32
    pthread_mutex_t mutex;
    pthread_cond_t cond;
#endif
};

class ThreadContext
{
public:
    ThreadContext(InstancePool *p) :
        currSeqno(0), rnum(0), pool(p) {
        srand(config.getRandomSeed());
        for (int ii = 0; ii < 8192; ++ii) {
            seqno[ii] = rand();
        }
    }

    template <typename T> void
    performWithRetry(lcb_t handle, size_t n, const T* const * cmds,
        lcb_error_t (*lfunc)(lcb_t,const void*,lcb_size_t,const T*const*),
        const char *opname, int retry = -1)
    {
        if (retry == -1) {
            retry = config.dgm ? 10000 : 1;
        }

        do {
            error = lfunc(handle, this, n, cmds);
            if (error != LCB_SUCCESS) {
                log("Couldn't schedule %s. [0x%x, %s]", opname, error, lcb_strerror(NULL, error));
            }
            lcb_wait(handle);
            if (error == LCB_SUCCESS) {
                return;
            }
            if (!LCB_EIFTMP(error)) {
                log("Got hard error for %s operation. [0x%x, %s]", opname, error, lcb_strerror(NULL, error));
            }
            if (config.waitTime) {
                usleep(1000*config.waitTime);
            }
        } while (--retry > 0);
    }

    void singleLoop(lcb_t instance) {
        bool hasItems = false;
        string key;
        for (size_t ii = 0; ii < config.iterations; ++ii) {
            const uint32_t nextseq = nextSeqno();
            generateKey(key, nextseq);
            if (config.setprc > 0 && (nextseq % 100) > config.setprc) {
                lcb_store_cmd_t scmd;
                size_t size;
                if (config.minSize == config.maxSize) {
                    size = config.minSize;
                } else {
                    size = config.minSize + nextseq % (config.maxSize - config.minSize);
                }
                memset(&scmd, 0, sizeof scmd);
                scmd.v.v0.key = key.c_str();
                scmd.v.v0.nkey = key.size();
                scmd.v.v0.bytes = config.data;
                scmd.v.v0.nbytes = size;
                scmd.v.v0.operation = LCB_SET;
                const lcb_store_cmd_t * const cmdlist[] = {  &scmd };
                error = lcb_store(instance, this, 1, cmdlist);

            } else {
                lcb_get_cmd_t gcmd;
                memset(&gcmd, 0, sizeof gcmd);
                gcmd.v.v0.key = key.c_str();
                gcmd.v.v0.nkey = key.size();
                const lcb_get_cmd_t * const cmdlist[] = { &gcmd };
                error = lcb_get(instance, this, 1, cmdlist);
            }
            if (error != LCB_SUCCESS) {
                hasItems = false;
                log("Failed to schedule operation: [0x%x] %s", error, lcb_strerror(instance, error));
            } else {
                hasItems = true;
            }
        }
        if (hasItems) {
            lcb_wait(instance);
            if (error != LCB_SUCCESS) {
                log("Operation(s) failed: [0x%x] %s", error, lcb_strerror(instance, error));
            }
        }
    }

    bool run() {
        do {
            lcb_t instance = pool->pop();
            singleLoop(instance);
            if (config.isTimings()) {
                InstanceCookie::dumpTimings(instance, "Run");
            }
            pool->push(instance);
        } while (config.isLoop());

        return true;
    }

    bool populate(uint32_t start, uint32_t stop) {

        bool timings = config.isTimings();
        lcb_t instance = pool->pop();

        for (uint32_t ii = start; ii < stop; ++ii) {
            std::string key;
            generateKey(key, ii);
            lcb_store_cmd_t item;
            memset(&item, 0, sizeof item);
            item.v.v0.key = key.c_str();
            item.v.v0.nkey = key.size();
            item.v.v0.bytes = config.data;
            item.v.v0.nbytes = config.maxSize;
            item.v.v0.operation = LCB_SET;
            lcb_store_cmd_t *items[1] = { &item };

            performWithRetry<lcb_store_cmd_t>(
                instance, 1, items, lcb_store, "store/populate", 1000);
        }

        if (timings) {
            InstanceCookie::dumpTimings(instance, "Populate");
        }
        pool->push(instance);

        return true;
    }

protected:
    // the callback methods needs to be able to set the error handler..
    friend void storageCallback(lcb_t, const void *,
                                lcb_storage_t, lcb_error_t,
                                const lcb_store_resp_t *);
    friend void getCallback(lcb_t, const void *, lcb_error_t,
                            const lcb_get_resp_t *);
    Histogram histogram;

    void setError(lcb_error_t e) { error = e; }

private:
    uint32_t nextSeqno() {
        rnum += seqno[currSeqno];
        currSeqno++;
        if (currSeqno > 8191) {
            currSeqno = 0;
        }
        return rnum;
    }

    void generateKey(string &key, uint32_t ii = static_cast<uint32_t>(-1)) {
        if (ii == static_cast<uint32_t>(-1)) {
            // get random key
            ii = nextSeqno();
        }
        ii %= config.maxKey;

        char buffer[21];
        snprintf(buffer, sizeof(buffer), "%020d", ii);
        key.assign(config.getKeyPrefix() + buffer);
    }

    uint32_t seqno[8192];
    uint32_t currSeqno;
    uint32_t rnum;
    lcb_error_t error;
    InstancePool *pool;
};

static void storageCallback(lcb_t, const void *cookie,
                            lcb_storage_t, lcb_error_t error,
                            const lcb_store_resp_t *)
{
    ThreadContext *tc;
    tc = const_cast<ThreadContext *>(reinterpret_cast<const ThreadContext *>(cookie));
    tc->setError(error);
}

static void getCallback(lcb_t, const void *cookie,
                        lcb_error_t error,
                        const lcb_get_resp_t *)
{
    ThreadContext *tc;
    tc = const_cast<ThreadContext *>(reinterpret_cast<const ThreadContext *>(cookie));
    tc->setError(error);

}

std::list<ThreadContext *> contexts;
InstancePool *pool = NULL;

extern "C" {
    typedef void (*handler_t)(int);

    static void cruel_handler(int);
    static void gentle_handler(int);
}

#ifndef WIN32
static void setup_sigint_handler(handler_t handler);
#endif

#ifndef WIN32
static void cruel_handler(int)
{
    std::list<ThreadContext *>::iterator it;
    for (it = contexts.begin(); it != contexts.end(); ++it) {
        delete *it;
    }
    delete pool;
    exit(EXIT_FAILURE);
}

static void gentle_handler(int)
{
    config.loop = false;
    log("Termination requested. Waiting threads to finish. "
        "Ctrl-C to force termination.");
    setup_sigint_handler(cruel_handler);
}

static void setup_sigint_handler(handler_t handler)
{
    struct sigaction action;

    sigemptyset(&action.sa_mask);
    action.sa_handler = handler;
    action.sa_flags = 0;
    sigaction(SIGINT, &action, NULL);
}
#endif

extern "C" {
    static void *thread_worker(void *);
}

static void *thread_worker(void *arg)
{
    ThreadContext *ctx = static_cast<ThreadContext *>(arg);
    if (!config.shouldntPopulate()) {
        ctx->populate(0, config.maxKey);
    }
    ctx->run();
#ifndef WIN32
    pthread_exit(NULL);
#endif
    return NULL;
}

/**
 * Program entry point
 * @param argc argument count
 * @param argv argument vector
 * @return 0 success, 1 failure
 */
int main(int argc, char **argv)
{
    int exit_code = EXIT_SUCCESS;

#ifndef WIN32
    setup_sigint_handler(SIG_IGN);
    signal(SIGPIPE, SIG_IGN);

    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_JOINABLE);
#endif
    Parser parser("cbc-pillowfight");
    config.addOptions(parser);
    parser.parse(argc, argv, false);
    config.processOptions();

    pool = new InstancePool(config.getNumInstances());
#ifndef WIN32
    setup_sigint_handler(gentle_handler);
#endif
    if (config.isLoop()) {
        log("Running in a loop. Press Ctrl-C to terminate...");
    }
#ifdef WIN32
    ThreadContext *ctx = new ThreadContext(pool);
    contexts.push_back(ctx);
    thread_worker(ctx);



#else
    std::list<pthread_t> threads;
    for (uint32_t ii = 0; ii < config.getNumThreads(); ++ii) {
        ThreadContext *ctx = new ThreadContext(pool);
        contexts.push_back(ctx);

        pthread_t tid;
        int rc = pthread_create(&tid, &attr, thread_worker, ctx);
        if (rc) {
            log("Failed to create thread: %d", rc);
            exit_code = EXIT_FAILURE;
            break;
        }
        threads.push_back(tid);
    }

    if (contexts.size() == config.getNumThreads()) {
        for (std::list<pthread_t>::iterator it = threads.begin();
                it != threads.end(); ++it) {
            int rc = pthread_join(*it, NULL);
            if (rc) {
                log("Failed to join thread: %d", rc);
                exit_code = EXIT_FAILURE;
                break;
            }
        }
    }
#endif

    for (std::list<ThreadContext *>::iterator it = contexts.begin();
            it != contexts.end(); ++it) {
        delete *it;
    }
    delete pool;

#ifndef WIN32
    pthread_attr_destroy(&attr);
    pthread_exit(NULL);
#endif

    return exit_code;
}
