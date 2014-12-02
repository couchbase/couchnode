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
#include <errno.h>
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

struct DeprecatedOptions {
    UIntOption iterations;
    UIntOption instances;
    BoolOption loop;

    DeprecatedOptions() :
        iterations("iterations"), instances("num-instances"), loop("loop")
    {
        iterations.abbrev('i').hide().setDefault(1000);
        instances.abbrev('Q').hide().setDefault(1);
        loop.abbrev('l').hide().setDefault(false);
    }

    void addOptions(Parser &p) {
        p.addOption(instances);
        p.addOption(loop);
        p.addOption(iterations);
    }
};

class Configuration
{
public:
    Configuration() :
        o_multiSize("batch-size"),
        o_numItems("num-items"),
        o_keyPrefix("key-prefix"),
        o_numThreads("num-threads"),
        o_randSeed("random-seed"),
        o_setPercent("set-pct"),
        o_minSize("min-size"),
        o_maxSize("max-size"),
        o_noPopulate("no-population"),
        o_pauseAtEnd("pause-at-end"),
        o_numCycles("num-cycles"),
        o_sequential("sequential"),
        o_startAt("start-at")
    {
        o_multiSize.setDefault(100).abbrev('B').description("Number of operations to batch");
        o_numItems.setDefault(1000).abbrev('I').description("Number of items to operate on");
        o_keyPrefix.abbrev('p').description("key prefix to use");
        o_numThreads.setDefault(1).abbrev('t').description("The number of threads to use");
        o_randSeed.setDefault(0).abbrev('s').description("Specify random seed").hide();
        o_setPercent.setDefault(33).abbrev('r').description("The percentage of operations which should be mutations");
        o_minSize.setDefault(50).abbrev('m').description("Set minimum payload size");
        o_maxSize.setDefault(5120).abbrev('M').description("Set maximum payload size");
        o_noPopulate.setDefault(false).abbrev('n').description("Skip population");
        o_pauseAtEnd.setDefault(false).abbrev('E').description("Pause at end of run (holding connections open) until user input");
        o_numCycles.setDefault(-1).abbrev('c').description("Number of cycles to be run until exiting. Set to -1 to loop infinitely");
        o_sequential.setDefault(false).description("Use sequential access (instead of random)");
        o_startAt.setDefault(0).description("For sequential access, set the first item");
    }

    void processOptions() {
        opsPerCycle = o_multiSize.result();
        prefix = o_keyPrefix.result();
        setprc = o_setPercent.result();
        shouldPopulate = !o_noPopulate.result();
        setPayloadSizes(o_minSize.result(), o_maxSize.result());

        if (depr.loop.passed()) {
            fprintf(stderr, "The --loop/-l option is deprecated. Use --num-cycles\n");
            maxCycles = -1;
        } else {
            maxCycles = o_numCycles.result();
        }

        if (depr.iterations.passed()) {
            fprintf(stderr, "The --num-iterations/-I option is deprecated. Use --batch-size\n");
            opsPerCycle = depr.iterations.result();
        }
    }

    void addOptions(Parser& parser) {
        parser.addOption(o_multiSize);
        parser.addOption(o_numItems);
        parser.addOption(o_keyPrefix);
        parser.addOption(o_numThreads);
        parser.addOption(o_randSeed);
        parser.addOption(o_setPercent);
        parser.addOption(o_noPopulate);
        parser.addOption(o_minSize);
        parser.addOption(o_maxSize);
        parser.addOption(o_pauseAtEnd);
        parser.addOption(o_numCycles);
        parser.addOption(o_sequential);
        parser.addOption(o_startAt);
        params.addToParser(parser);
        depr.addOptions(parser);
    }

    ~Configuration() {
        delete []static_cast<char *>(data);
    }

    void setPayloadSizes(uint32_t minsz, uint32_t maxsz) {
        if (minsz > maxsz) {
            minsz = maxsz;
        }

        minSize = minsz;
        maxSize = maxsz;

        if (data) {
            delete []static_cast<char *>(data);
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
        if (depr.instances.passed()) {
            return depr.instances.result();
        }
        return o_numThreads.result();
    }

    bool isTimings(void) { return params.useTimings(); }

    bool isLoopDone(size_t niter) {
        if (maxCycles == -1) {
            return false;
        }
        return niter >= (size_t)maxCycles;
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
    bool shouldPauseAtEnd() { return o_pauseAtEnd; }
    bool sequentialAccess() { return o_sequential; }
    unsigned firstKeyOffset() { return o_startAt; }
    uint32_t getNumItems() { return o_numItems; }

    void *data;

    uint32_t opsPerCycle;
    int setprc;
    string prefix;
    uint32_t maxSize;
    uint32_t minSize;
    volatile int maxCycles;
    bool dgm;
    bool shouldPopulate;
    uint32_t waitTime;
    ConnParams params;

private:
    UIntOption o_multiSize;
    UIntOption o_numItems;
    StringOption o_keyPrefix;
    UIntOption o_numThreads;
    UIntOption o_randSeed;
    IntOption o_setPercent;
    UIntOption o_minSize;
    UIntOption o_maxSize;
    BoolOption o_noPopulate;
    BoolOption o_pauseAtEnd; // Should pillowfight pause execution (with
                             // connections open) before exiting?
    IntOption o_numCycles;
    BoolOption o_sequential;
    UIntOption o_startAt;
    DeprecatedOptions depr;
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
static void operationCallback(lcb_t, int, const lcb_RESPBASE*);
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


    static void dumpTimings(lcb_t instance, const char *header, bool force=false) {
        time_t now = time(NULL);
        InstanceCookie *ic = get(instance);

        if (now - ic->lastPrint > 0) {
            ic->lastPrint = now;
        } else if (!force) {
            return;
        }

        Histogram &h = ic->hg;
        printf("[%f %s]\n", gethrtime() / 1000000000.0, header);
        printf("              +---------+---------+---------+---------+\n");
        h.write();
        printf("              +----------------------------------------\n");
    }

private:
    time_t lastPrint;
    Histogram hg;
};

struct NextOp {
    NextOp() : seqno(0), valsize(0), isStore(false) {}

    string key;
    uint32_t seqno;
    size_t valsize;
    bool isStore;
};

class KeyGenerator {
public:
    KeyGenerator(int ix) :
        currSeqno(0), rnum(0), ngenerated(0), isSequential(false),
        isPopulate(config.shouldPopulate)
{
        srand(config.getRandomSeed());
        for (int ii = 0; ii < 8192; ++ii) {
            seqPool[ii] = rand();
        }
        if (isPopulate) {
            isSequential = true;
        } else {
            isSequential = config.sequentialAccess();
        }


        // Maximum number of keys for this thread
        maxKey = config.getNumItems() /  config.getNumThreads();

        offset = config.firstKeyOffset();
        offset += maxKey * ix;
        id = ix;
    }

    void setNextOp(NextOp& op) {
        bool store_override = false;

        if (isPopulate) {
            if (++ngenerated < maxKey) {
                store_override = true;
            } else {
                printf("Thread %d has finished populating.\n", id);
                isPopulate = false;
                isSequential = config.sequentialAccess();
            }
        }

        if (isSequential) {
            rnum++;
            rnum %= maxKey;
        } else {
            rnum += seqPool[currSeqno];
            currSeqno++;
            if (currSeqno > 8191) {
                currSeqno = 0;
            }
        }

        op.seqno = rnum;

        if (store_override) {
            op.isStore = true;
        } else {
            op.isStore = shouldStore(op.seqno);
        }

        if (op.isStore) {
            size_t size;
            if (config.minSize == config.maxSize) {
                size = config.minSize;
            } else {
                size = config.minSize + op.seqno % (config.maxSize - config.minSize);
            }
            op.valsize = size;
        }
        generateKey(op);
    }

    bool shouldStore(uint32_t seqno) {
        seqno %= 100;
        // This is a percentage..
        if (config.setprc > 0) {
            if (seqno % (100 / config.setprc) == 0) {
                return true;
            }
            return false;
        } else if (config.setprc == 0) {
            return false; // Always get
        } else {
            // Negative
            if (seqno % (100 / config.setprc) == 0) {
                return false;
            }
            return true;
        }
    }

    void generateKey(NextOp& op) {
        uint32_t seqno = op.seqno;
        seqno %= maxKey;
        seqno += offset-1;

        char buffer[21];
        snprintf(buffer, sizeof(buffer), "%020d", seqno);
        op.key.assign(config.getKeyPrefix() + buffer);
    }
    const char *getStageString() const {
        if (isPopulate) {
            return "Populate";
        } else {
            return "Run";
        }
    }

private:
    uint32_t seqPool[8192];
    uint32_t currSeqno;
    uint32_t rnum;
    uint32_t offset;
    uint32_t maxKey;
    size_t ngenerated;
    int id;

    bool isSequential;
    bool isPopulate;
};

class ThreadContext
{
public:
    ThreadContext(lcb_t handle, int ix) : kgen(ix), niter(0), instance(handle) {

    }

    void singleLoop() {
        bool hasItems = false;
        lcb_sched_enter(instance);
        NextOp opinfo;

        for (size_t ii = 0; ii < config.opsPerCycle; ++ii) {
            kgen.setNextOp(opinfo);
            if (opinfo.isStore) {
                lcb_CMDSTORE scmd = { 0 };
                scmd.operation = LCB_SET;
                LCB_CMD_SET_KEY(&scmd, opinfo.key.c_str(), opinfo.key.size());
                LCB_CMD_SET_VALUE(&scmd, config.data, opinfo.valsize);
                error = lcb_store3(instance, this, &scmd);

            } else {
                lcb_CMDGET gcmd = { 0 };
                LCB_CMD_SET_KEY(&gcmd, opinfo.key.c_str(), opinfo.key.size());
                error = lcb_get3(instance, this, &gcmd);
            }
            if (error != LCB_SUCCESS) {
                hasItems = false;
                log("Failed to schedule operation: [0x%x] %s", error, lcb_strerror(instance, error));
            } else {
                hasItems = true;
            }
        }
        if (hasItems) {
            lcb_sched_leave(instance);
            lcb_wait(instance);
            if (error != LCB_SUCCESS) {
                log("Operation(s) failed: [0x%x] %s", error, lcb_strerror(instance, error));
            }
        } else {
            lcb_sched_fail(instance);
        }
    }

    bool run() {
        do {
            singleLoop();
            if (config.isTimings()) {
                InstanceCookie::dumpTimings(instance, kgen.getStageString());
            }
            if (config.params.shouldDump()) {
                lcb_dump(instance, stderr, LCB_DUMP_ALL);
            }
        } while (!config.isLoopDone(++niter));

        if (config.isTimings()) {
            InstanceCookie::dumpTimings(instance, kgen.getStageString(), true);
        }
        return true;
    }

#ifndef WIN32
    pthread_t thr;
#endif

protected:
    // the callback methods needs to be able to set the error handler..
    friend void operationCallback(lcb_t, int, const lcb_RESPBASE*);
    Histogram histogram;

    void setError(lcb_error_t e) { error = e; }

private:
    KeyGenerator kgen;
    size_t niter;
    lcb_error_t error;
    lcb_t instance;
};

static void operationCallback(lcb_t, int, const lcb_RESPBASE *resp)
{
    ThreadContext *tc;

    tc = const_cast<ThreadContext *>(reinterpret_cast<const ThreadContext *>(resp->cookie));
    tc->setError(resp->rc);

#ifndef WIN32
    static volatile unsigned long nops = 1;
    static time_t start_time = time(NULL);
    static int is_tty = isatty(STDOUT_FILENO);
    if (is_tty) {
        if (++nops % 1000 == 0) {
            time_t now = time(NULL);
            time_t nsecs = now - start_time;
            if (!nsecs) { nsecs = 1; }
            unsigned long ops_sec = nops / nsecs;
            printf("OPS/SEC: %10lu\r", ops_sec);
            fflush(stdout);
        }
    }
#endif
}


std::list<ThreadContext *> contexts;

extern "C" {
    typedef void (*handler_t)(int);
}

#ifndef WIN32
static void sigint_handler(int)
{
    static int ncalled = 0;
    ncalled++;

    if (ncalled < 2) {
        log("Termination requested. Waiting threads to finish. Ctrl-C to force termination.");
        signal(SIGINT, sigint_handler); // Reinstall
        config.maxCycles = 0;
        return;
    }

    std::list<ThreadContext *>::iterator it;
    for (it = contexts.begin(); it != contexts.end(); ++it) {
        delete *it;
    }
    contexts.clear();
    exit(EXIT_FAILURE);
}

static void setup_sigint_handler()
{
    struct sigaction action;
    sigemptyset(&action.sa_mask);
    action.sa_handler = sigint_handler;
    action.sa_flags = 0;
    sigaction(SIGINT, &action, NULL);
}

extern "C" {
static void* thread_worker(void*);
}

static void start_worker(ThreadContext *ctx)
{
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_JOINABLE);
    int rc = pthread_create(&ctx->thr, &attr, thread_worker, ctx);
    if (rc != 0) {
        log("Couldn't create thread: (%d)", errno);
        exit(EXIT_FAILURE);
    }
}
static void join_worker(ThreadContext *ctx)
{
    void *arg = NULL;
    int rc = pthread_join(ctx->thr, &arg);
    if (rc != 0) {
        log("Couldn't join thread (%d)", errno);
        exit(EXIT_FAILURE);
    }
}

#else
static void setup_sigint_handler() {}
static void start_worker(ThreadContext *ctx) { ctx->run(); }
static void join_worker(ThreadContext *ctx) { (void)ctx; }
#endif

extern "C" {
static void *thread_worker(void *arg)
{
    ThreadContext *ctx = static_cast<ThreadContext *>(arg);
    ctx->run();
    return NULL;
}
}

int main(int argc, char **argv)
{
    int exit_code = EXIT_SUCCESS;
    setup_sigint_handler();

    Parser parser("cbc-pillowfight");
    config.addOptions(parser);
    parser.parse(argc, argv, false);
    config.processOptions();
    size_t nthreads = config.getNumThreads();
    log("Running. Press Ctrl-C to terminate...");

#ifdef WIN32
    if (nthreads > 1) {
        log("WARNING: More than a single thread on Windows not supported. Forcing 1");
        nthreads = 1;
    }
#endif

    struct lcb_create_st options;
    ConnParams& cp = config.params;
    lcb_error_t error;

    for (uint32_t ii = 0; ii < nthreads; ++ii) {
        cp.fillCropts(options);
        lcb_t instance = NULL;
        error = lcb_create(&instance, &options);
        if (error != LCB_SUCCESS) {
            log("Failed to create instance: %s", lcb_strerror(NULL, error));
            exit(EXIT_FAILURE);
        }
        lcb_install_callback3(instance, LCB_CALLBACK_STORE, operationCallback);
        lcb_install_callback3(instance, LCB_CALLBACK_GET, operationCallback);
        cp.doCtls(instance);

        new InstanceCookie(instance);

        lcb_connect(instance);
        lcb_wait(instance);
        error = lcb_get_bootstrap_status(instance);

        if (error != LCB_SUCCESS) {
            std::cout << std::endl;
            log("Failed to connect: %s", lcb_strerror(instance, error));
            exit(EXIT_FAILURE);
        }

        ThreadContext *ctx = new ThreadContext(instance, ii);
        contexts.push_back(ctx);
        start_worker(ctx);
    }

    for (std::list<ThreadContext *>::iterator it = contexts.begin();
            it != contexts.end(); ++it) {
        join_worker(*it);
    }
    return exit_code;
}
