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
#include <getopt.h>
#include "tools/commandlineparser.h"
#include <signal.h>
#ifndef WIN32
#include <pthread.h>
#endif
#include <cstdarg>

using namespace std;

class Configuration
{
public:
    Configuration() : host(),
        maxKey(1000),
        iterations(1000),
        fixedSize(true),
        setprc(33),
        prefix(""),
        numThreads(1),
        numInstances(1),
        timings(false),
        loop(false),
        randomSeed(0),
        dumb(false) {
        setMaxSize(5120);
        setMinSize(50);
    }

    ~Configuration() {
        delete []static_cast<char *>(data);
    }

    const char *getHost() const {
        if (host.length() > 0) {
            return host.c_str();
        }
        return NULL;
    }

    void setHost(const char *val) {
        host.assign(val);
    }

    const char *getUser() {
        if (user.length() > 0) {
            return user.c_str();
        }
        return NULL;
    }

    const char *getPasswd() {
        if (passwd.length() > 0) {
            return passwd.c_str();
        }
        return NULL;
    }

    void setPassword(const char *p) {
        passwd.assign(p);
    }

    void setUser(const char *u) {
        user.assign(u);
    }

    const char *getBucket() {
        if (bucket.length() > 0) {
            return bucket.c_str();
        }
        return NULL;
    }

    void setBucket(const char *b) {
        bucket.assign(b);
    }

    void setRandomSeed(uint32_t val) {
        randomSeed = val;
    }

    uint32_t getRandomSeed() {
        return randomSeed;
    }

    void setIterations(uint32_t val) {
        iterations = val;
    }

    void setRatio(uint32_t val) {
        setprc = val;
    }

    void setMaxKeys(uint32_t val) {
        maxKey = val;
    }

    void setKeyPrefix(const char *val) {
        prefix.assign(val);
    }

    std::string getKeyPrefix() {
        return prefix;
    }

    void setNumThreads(uint32_t val) {
        numThreads = val;
    }

    uint32_t getNumThreads() {
        return numThreads;
    }

    void setNumInstances(uint32_t val) {
        numInstances = val;
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

    uint32_t getNumInstances(void) {
        return numInstances;
    }

    bool isTimings(void) {
        return timings;
    }

    void setTimings(bool val) {
        timings = val;
    }

    bool isLoop(void) {
        return loop;
    }

    void setLoop(bool val) {
        loop = val;
    }

    void setDumb(bool val) {
        dumb = val;
    }

    bool isDumb() {
        return dumb;
    }

    void *data;

    std::string host;
    std::string user;
    std::string passwd;
    std::string bucket;

    uint32_t maxKey;
    uint32_t iterations;
    bool fixedSize;
    uint32_t setprc;
    std::string prefix;
    uint32_t maxSize;
    uint32_t minSize;
    uint32_t numThreads;
    uint32_t numInstances;
    bool timings;
    bool loop;
    uint32_t randomSeed;
    bool dumb;
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

    static void timingsCallback(lcb_t, const void *,
                                lcb_timeunit_t, lcb_uint32_t,
                                lcb_uint32_t, lcb_uint32_t,
                                lcb_uint32_t);
}

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

            lcb_error_t error;
            if (config.isDumb()) {
                struct lcb_memcached_st memcached;

                memset(&memcached, 0, sizeof(memcached));
                memcached.serverlist = config.getHost();
                error = lcb_create_compat(LCB_MEMCACHED_CLUSTER,
                                          &memcached, &instance, io);
            } else {
                struct lcb_create_st options(config.getHost(),
                                             config.getUser(),
                                             config.getPasswd(),
                                             config.getBucket(),
                                             io);

                error = lcb_create(&instance, &options);
            }
            if (error == LCB_SUCCESS) {
                (void)lcb_set_store_callback(instance, storageCallback);
                (void)lcb_set_get_callback(instance, getCallback);
                queue.push(instance);
                handles.push_back(instance);
            } else {
                std::cout << std::endl;
                log("Failed to create instance: %s", lcb_strerror(NULL, error));
                exit(EXIT_FAILURE);
            }
            if (config.isTimings()) {
                if ((error = lcb_enable_timings(instance)) != LCB_SUCCESS) {
                    std::cout << std::endl;
                    log("Failed to enable timings!: %s", lcb_strerror(instance, error));
                }
            }
            if (!config.isDumb()) {
                lcb_connect(instance);
                lcb_wait(instance);
                error = lcb_get_last_error(instance);
                if (error != LCB_SUCCESS) {
                    std::cout << std::endl;
                    log("Failed to connect: %s", lcb_strerror(instance, error));
                    exit(EXIT_FAILURE);
                }
            }
        }
        std::cout << std::endl;
    }

    ~InstancePool() {
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

    static void dumpTimings(lcb_t instance, std::string header) {
        std::stringstream ss;

        ss << "[" << std::fixed << gethrtime() / 1000000000.0 << "] " << header << std::endl;

        ss << "              +---------+---------+---------+---------+" << std::endl;
        lcb_get_timings(instance, reinterpret_cast<void *>(&ss), timingsCallback);
        ss << "              +----------------------------------------" << endl;
        std::cout << ss.str();
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

    bool run() {
        do {
            bool pending = false;
            lcb_t instance = pool->pop();
            for (uint32_t ii = 0; ii < config.iterations; ++ii) {
                std::string key;
                generateKey(key);
                lcb_uint32_t flags = 0;
                lcb_uint32_t exp = 0;

                if (config.setprc > 0 && (nextSeqno() % 100) < config.setprc) {
                    lcb_size_t size;
                    if (config.minSize == config.maxSize) {
                        size = config.maxSize;
                    } else {
                        size = config.minSize +
                               nextSeqno() % (config.maxSize - config.minSize);
                    }
                    lcb_store_cmd_t item(LCB_SET, key.c_str(), key.length(),
                                         config.data, size,
                                         flags, exp);
                    lcb_store_cmd_t *items[1] = { &item };
                    lcb_store(instance, this, 1, items);
                } else {
                    lcb_get_cmd_t item(key.c_str(), key.length());
                    lcb_get_cmd_t *items[1] = { &item };
                    error = lcb_get(instance, this, 1, items);
                    if (error != LCB_SUCCESS) {
                        log("Failed to get item: %s", lcb_strerror(instance, error));
                    }
                }
                if (ii % 10 == 0) {
                    lcb_wait(instance);
                } else {
                    pending = true;
                }
            }

            if (pending) {
                lcb_wait(instance);
            }

            if (config.isTimings()) {
                pool->dumpTimings(instance, "Run");
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

            lcb_store_cmd_t item(LCB_SET, key.c_str(), key.length(),
                                 config.data, config.maxSize);
            lcb_store_cmd_t *items[1] = { &item };
            error = lcb_store(instance, this, 1, items);
            if (error != LCB_SUCCESS) {
                log("Failed to store item: %s", lcb_strerror(instance, error));
            }
            lcb_wait(instance);
            if (error != LCB_SUCCESS) {
                log("Failed to store item: %s", lcb_strerror(instance, error));
            }
        }

        if (timings) {
            pool->dumpTimings(instance, "Populate");
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

    void setError(lcb_error_t e) {
        error = e;
    }

private:
    uint32_t nextSeqno() {
        rnum += seqno[currSeqno];
        currSeqno++;
        if (currSeqno > 8191) {
            currSeqno = 0;
        }
        return rnum;
    }

    void generateKey(std::string &key,
                     uint32_t ii = static_cast<uint32_t>(-1)) {
        if (ii == static_cast<uint32_t>(-1)) {
            // get random key
            ii = nextSeqno() % config.maxKey;
        }

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

static void timingsCallback(lcb_t instance, const void *cookie,
                            lcb_timeunit_t timeunit,
                            lcb_uint32_t min,
                            lcb_uint32_t max,
                            lcb_uint32_t total,
                            lcb_uint32_t maxtotal)
{
    std::stringstream *ss =
        const_cast<std::stringstream *>(reinterpret_cast<const std::stringstream *>(cookie));
    char buffer[1024];
    int offset = sprintf(buffer, "[%3u - %3u]", min, max);

    switch (timeunit) {
    case LCB_TIMEUNIT_NSEC:
        offset += sprintf(buffer + offset, "ns");
        break;
    case LCB_TIMEUNIT_USEC:
        offset += sprintf(buffer + offset, "us");
        break;
    case LCB_TIMEUNIT_MSEC:
        offset += sprintf(buffer + offset, "ms");
        break;
    case LCB_TIMEUNIT_SEC:
        offset += sprintf(buffer + offset, "s");
        break;
    default:
        ;
    }

    int num = static_cast<int>(static_cast<float>(40.0) * static_cast<float>(total) / static_cast<float>(maxtotal));

    offset += sprintf(buffer + offset, " |");
    for (int ii = 0; ii < num; ++ii) {
        offset += sprintf(buffer + offset, "#");
    }

    offset += sprintf(buffer + offset, " - %u\n", total);
    *ss << buffer;
    (void)cookie;
    (void)maxtotal;
    (void)instance;
}

static void handle_options(int argc, char **argv)
{
    Getopt getopt;
    getopt.addOption(new CommandLineOption('?', "help", false,
                                           "Print this help text"));
    getopt.addOption(new CommandLineOption('h', "host", true,
                                           "Hostname(s) to connect to (use \"foo;bar\" to specify multiple)"));
    getopt.addOption(new CommandLineOption('b', "bucket", true,
                                           "Bucket to use"));
    getopt.addOption(new CommandLineOption('u', "user", true,
                                           "Username for the rest port"));
    getopt.addOption(new CommandLineOption('P', "password", true,
                                           "password for the rest port"));
    getopt.addOption(new CommandLineOption('i', "iterations (default 1000)", true,
                                           "Number of iterations to run"));
    getopt.addOption(new CommandLineOption('I', "num-items (default 1000)", true,
                                           "Number of items to operate on"));
    getopt.addOption(new CommandLineOption('p', "key-prefix (default \"\")", true,
                                           "Use the following prefix for keys"));
    getopt.addOption(new CommandLineOption('t', "num-threads (default 1)", true,
                                           "The number of threads to use"));
    getopt.addOption(new CommandLineOption('Q', "num-instances", true,
                                           "The number of instances to use"));
    getopt.addOption(new CommandLineOption('l', "loop", false,
                                           "Loop running load"));
    getopt.addOption(new CommandLineOption('T', "timings", false,
                                           "Enable internal timings"));
    getopt.addOption(new CommandLineOption('s', "random-seed", true,
                                           "Specify random seed (default 0)"));
    getopt.addOption(new CommandLineOption('r', "ratio", true,
                                           "Specify SET command ratio (default 33)"));
    getopt.addOption(new CommandLineOption('m', "min-size", true,
                                           "Specify minimum size of payload (default 50)"));
    getopt.addOption(new CommandLineOption('M', "max-size", true,
                                           "Specify maximum size of payload (default 5120)"));
    getopt.addOption(new CommandLineOption('d', "dumb", false,
                                           "Behave like legacy memcached client (default false)"));

    if (!getopt.parse(argc, argv)) {
        getopt.usage(argv[0]);
        exit(EXIT_FAILURE);
    }

    std::vector<CommandLineOption *>::iterator iter;
    for (iter = getopt.options.begin(); iter != getopt.options.end(); ++iter) {
        if ((*iter)->found) {
            switch ((*iter)->shortopt) {
            case 'h' :
                config.setHost((*iter)->argument);
                break;

            case 'b' :
                config.setBucket((*iter)->argument);
                break;

            case 'u' :
                config.setUser((*iter)->argument);
                break;

            case 'P' :
                config.setPassword((*iter)->argument);
                break;

            case 'i' :
                config.setIterations(atoi((*iter)->argument));
                break;

            case 'I':
                config.setMaxKeys(atoi((*iter)->argument));
                break;

            case 'p' :
                config.setKeyPrefix((*iter)->argument);
                break;

            case 't':
                config.setNumThreads(atoi((*iter)->argument));
                break;

            case 'Q' :
                config.setNumInstances(atoi((*iter)->argument));
                break;

            case 'l' :
                config.setLoop(true);
                break;

            case 'T' :
                config.setTimings(true);
                break;

            case 's' :
                config.setRandomSeed(atoi((*iter)->argument));
                break;

            case 'r' :
                config.setRatio(atoi((*iter)->argument));
                break;

            case 'm' :
                config.setMinSize(atoi((*iter)->argument));
                break;

            case 'M' :
                config.setMaxSize(atoi((*iter)->argument));
                break;

            case 'd' :
                config.setDumb(true);
                break;

            case '?':
                getopt.usage(argv[0]);
                exit(EXIT_FAILURE);

            default:
                log("Unhandled option.. Fix the code!");
                abort();
            }
        }
    }
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
    config.setLoop(false);
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
    ctx->populate(0, config.maxKey);
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

    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_JOINABLE);
#endif

    handle_options(argc, argv);

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
