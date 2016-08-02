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
#define NOMINMAX // Because MS' CRT headers #define min and max :(
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
#include <fstream>
#include <signal.h>
#ifndef WIN32
#include <pthread.h>
#else
#define usleep(n) Sleep(n/1000)
#endif
#include <cstdarg>
#include <exception>
#include <stdexcept>
#include "common/options.h"
#include "common/histogram.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

#include "docgen/seqgen.h"
#include "docgen/docgen.h"

using namespace std;
using namespace cbc;
using namespace cliopts;
using namespace Pillowfight;
using std::vector;
using std::string;

// Deprecated options which still exist from previous versions.
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

static TemplateSpec
parseTemplateSpec(const string& input)
{
    TemplateSpec spec;
    // Just need to find the path
    size_t endpos = input.find(',');
    if (endpos == string::npos) {
        throw std::runtime_error("invalid template spec: need field,min,max");
    }
    spec.term = input.substr(0, endpos);
    unsigned is_sequential = 0;
    int rv = sscanf(input.c_str() + endpos + 1, "%u,%u,%u",
        &spec.minval, &spec.maxval, &is_sequential);
    if (rv < 2) {
        throw std::runtime_error("invalid template spec: need field,min,max");
    }
    spec.sequential = is_sequential;
    if (spec.minval > spec.maxval) {
        throw std::runtime_error("min cannot be higher than max");
    }
    return spec;
}

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
        o_startAt("start-at"),
        o_rateLimit("rate-limit"),
        o_userdocs("docs"),
        o_writeJson("json"),
        o_templatePairs("template"),
        o_subdoc("subdoc"),
        o_sdPathCount("pathcount"),
        o_populateOnly("populate-only"),
        o_exptime("expiry")
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
        o_rateLimit.setDefault(0).description("Set operations per second limit (per thread)");
        o_userdocs.description("User documents to load (overrides --min-size and --max-size");
        o_writeJson.description("Enable writing JSON values (rather than bytes)");
        o_templatePairs.description("Values for templates to be inserted into user documents");
        o_templatePairs.argdesc("FIELD,MIN,MAX[,SEQUENTIAL]").hide();
        o_subdoc.description("Use subdoc instead of fulldoc operations");
        o_sdPathCount.description("Number of subdoc paths per command").setDefault(1);
        o_populateOnly.description("Exit after documents have been populated");
        o_exptime.description("Set TTL for items").abbrev('e');
    }

    void processOptions() {
        opsPerCycle = o_multiSize.result();
        prefix = o_keyPrefix.result();
        setprc = o_setPercent.result();
        shouldPopulate = !o_noPopulate.result();

        if (depr.loop.passed()) {
            fprintf(stderr, "The --loop/-l option is deprecated. Use --num-cycles\n");
            maxCycles = -1;
        } else {
            maxCycles = o_numCycles.result();
        }

        if (o_populateOnly.passed()) {
            // Determine how many iterations are required.
            if (o_numCycles.passed()) {
                throw std::runtime_error("--num-cycles incompatible with --populate-only");
            }
            size_t est = (o_numItems / o_numThreads) / o_multiSize;
            while (est * o_numThreads * o_multiSize < o_numItems) {
                est++;
            }
            maxCycles = est;
            o_sequential.setDefault(true);
            fprintf(stderr, "Populating using %lu cycles\n", maxCycles);
        }

        if (depr.iterations.passed()) {
            fprintf(stderr, "The --num-iterations/-I option is deprecated. Use --batch-size\n");
            opsPerCycle = depr.iterations.result();
        }

        vector<TemplateSpec> specs;
        vector<string> userdocs;

        if (o_templatePairs.passed()) {
            vector<string> specs_str = o_templatePairs.result();
            for (size_t ii = 0; ii < specs_str.size(); ii++) {
                specs.push_back(parseTemplateSpec(specs_str[ii]));
            }
        }

        // Set the document sizes..
        if (o_userdocs.passed()) {
            if (o_minSize.passed() || o_maxSize.passed()) {
                fprintf(stderr, "--min-size/--max-size invalid with userdocs\n");
            }

            vector<string> filenames = o_userdocs.result();
            for (size_t ii = 0; ii < filenames.size(); ii++) {
                std::stringstream ss;
                std::ifstream ifs(filenames[ii].c_str());
                if (!ifs.is_open()) {
                    perror(filenames[ii].c_str());
                    exit(EXIT_FAILURE);
                }
                ss << ifs.rdbuf();
                userdocs.push_back(ss.str());
            }
        }

        if (specs.empty()) {
            if (o_writeJson.result()) {
                docgen = new JsonDocGenerator(o_minSize.result(), o_maxSize.result());
            } else if (!userdocs.empty()) {
                docgen = new PresetDocGenerator(userdocs);
            } else {
                docgen = new RawDocGenerator(o_minSize.result(), o_maxSize.result());
            }
        } else {
            if (o_writeJson.result()) {
                if (userdocs.empty()) {
                    docgen = new PlaceholderJsonGenerator(
                        o_minSize.result(), o_maxSize.result(), specs);
                } else {
                    docgen = new PlaceholderJsonGenerator(userdocs, specs);
                }
            } else {
                if (userdocs.empty()) {
                    throw std::runtime_error("Must provide documents with placeholders!");
                }
                docgen = new PlaceholderDocGenerator(userdocs, specs);
            }
        }

        sdOpsPerCmd = o_sdPathCount.result();
        if (o_sdPathCount.passed()) {
            o_subdoc.setDefault(true);
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
        parser.addOption(o_rateLimit);
        parser.addOption(o_userdocs);
        parser.addOption(o_writeJson);
        parser.addOption(o_templatePairs);
        parser.addOption(o_subdoc);
        parser.addOption(o_sdPathCount);
        parser.addOption(o_populateOnly);
        parser.addOption(o_exptime);
        params.addToParser(parser);
        depr.addOptions(parser);
    }

    bool isTimings(void) { return params.useTimings(); }

    bool isLoopDone(size_t niter) {
        if (maxCycles == -1) {
            return false;
        }
        return niter >= (size_t)maxCycles;
    }

    uint32_t getRandomSeed() { return o_randSeed; }
    uint32_t getNumThreads() { return o_numThreads; }
    string& getKeyPrefix() { return prefix; }
    bool shouldPauseAtEnd() { return o_pauseAtEnd; }
    bool sequentialAccess() { return o_sequential; }
    bool isSubdoc() { return o_subdoc; }
    unsigned firstKeyOffset() { return o_startAt; }
    uint32_t getNumItems() { return o_numItems; }
    uint32_t getRateLimit() { return o_rateLimit; }
    unsigned getExptime() { return o_exptime; }

    uint32_t opsPerCycle;
    uint32_t sdOpsPerCmd;
    unsigned setprc;
    string prefix;
    volatile int maxCycles;
    bool shouldPopulate;
    bool hasTemplates;
    ConnParams params;
    const DocGeneratorBase *docgen;

private:
    UIntOption o_multiSize;
    UIntOption o_numItems;
    StringOption o_keyPrefix;
    UIntOption o_numThreads;
    UIntOption o_randSeed;
    UIntOption o_setPercent;
    UIntOption o_minSize;
    UIntOption o_maxSize;
    BoolOption o_noPopulate;
    BoolOption o_pauseAtEnd; // Should pillowfight pause execution (with
                             // connections open) before exiting?
    IntOption o_numCycles;
    BoolOption o_sequential;
    UIntOption o_startAt;
    UIntOption o_rateLimit;

    // List of paths to user documents to load.. They should all be valid JSON
    ListOption o_userdocs;

    // Whether generated values should be JSON
    BoolOption o_writeJson;

    // List of template ranges for value generation
    ListOption o_templatePairs;
    BoolOption o_subdoc;
    UIntOption o_sdPathCount;

    // Compound option
    BoolOption o_populateOnly;

    UIntOption o_exptime;

    DeprecatedOptions depr;
} config;

void log(const char *format, ...)
{
    char buffer[512];
    va_list args;

    va_start(args, format);
    vsprintf(buffer, format, args);
    if (config.isTimings()) {
        std::cerr << "[" << std::fixed << lcb_nstime() / 1000000000.0 << "] ";
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
        printf("[%f %s]\n", lcb_nstime() / 1000000000.0, header);
        printf("              +---------+---------+---------+---------+\n");
        h.write();
        printf("              +----------------------------------------\n");
    }

private:
    time_t lastPrint;
    Histogram hg;
};

struct NextOp {
    NextOp() : m_seqno(0), m_mode(GET) {}

    string m_key;
    uint32_t m_seqno;
    vector<lcb_IOV> m_valuefrags;
    vector<lcb_SDSPEC> m_specs;
    // The mode here is for future use with subdoc
    enum Mode { STORE, GET, SDSTORE, SDGET };
    Mode m_mode;
};

/** Stateful, per-thread generator */
class KeyGenerator {
public:
    KeyGenerator(int ix)
    : m_gencount(0), m_force_sequential(false),
      m_in_population(config.shouldPopulate)
{
        srand(config.getRandomSeed());

        m_genrandom = new SeqGenerator(
            config.firstKeyOffset(),
            config.getNumItems() + config.firstKeyOffset());

        m_gensequence = new SeqGenerator(
            config.firstKeyOffset(),
            config.getNumItems() + config.firstKeyOffset(),
            config.getNumThreads(),
            ix);

        if (m_in_population) {
            m_force_sequential = true;
        } else {
            m_force_sequential = config.sequentialAccess();
        }

        m_id = ix;
        m_local_genstate = config.docgen->createState(config.getNumThreads(), ix);
        if (config.isSubdoc()) {
            m_mode_read = NextOp::SDGET;
            m_mode_write = NextOp::SDSTORE;
            m_sdgenstate = config.docgen->createSubdocState(config.getNumThreads(), ix);
            if (!m_sdgenstate) {
                std::cerr << "Current generator does not support subdoc. Did you try --json?" << std::endl;
                exit(EXIT_FAILURE);
            }
        } else {
            m_mode_read = NextOp::GET;
            m_mode_write = NextOp::STORE;
        }
    }

    void setNextOp(NextOp& op) {
        bool store_override = false;

        if (m_in_population) {
            if (m_gencount++ < m_gensequence->maxItems()) {
                store_override = true;
            } else {
                printf("Thread %d has finished populating.\n", m_id);
                m_in_population = false;
                m_force_sequential = config.sequentialAccess();
            }
        }

        if (m_force_sequential) {
            op.m_seqno = m_gensequence->next();
        } else {
            op.m_seqno = m_genrandom->next();
        }

        if (store_override) {
            // Populate
            op.m_mode = NextOp::STORE;
            m_local_genstate->populateIov(op.m_seqno, op.m_valuefrags);

        } else if (shouldStore(op.m_seqno)) {
            op.m_mode = m_mode_write;
            if (op.m_mode == NextOp::STORE) {
                m_local_genstate->populateIov(op.m_seqno, op.m_valuefrags);
            } else if (op.m_mode == NextOp::SDSTORE) {
                op.m_specs.resize(config.sdOpsPerCmd);
                m_sdgenstate->populateMutate(op.m_seqno, op.m_specs);
            } else {
                fprintf(stderr, "Invalid mode for op: %d\n", op.m_mode);
                abort();
            }
        } else {
            op.m_mode = m_mode_read;
            if (op.m_mode == NextOp::SDGET) {
                op.m_specs.resize(config.sdOpsPerCmd);
                m_sdgenstate->populateLookup(op.m_seqno, op.m_specs);
            }
        }

        generateKey(op);
    }

    bool shouldStore(uint32_t seqno) {
        if (config.setprc == 0) {
            return false;
        }

        float seqno_f = seqno % 100;
        float pct_f = seqno_f / config.setprc;
        return pct_f < 1;
    }

    void generateKey(NextOp& op) {
        uint32_t seqno = op.m_seqno;
        char buffer[21];
        snprintf(buffer, sizeof(buffer), "%020d", seqno);
        op.m_key.assign(config.getKeyPrefix() + buffer);
    }

    const char *getStageString() const {
        if (m_in_population) {
            return "Populate";
        } else {
            return "Run";
        }
    }

private:
    SeqGenerator *m_genrandom;
    SeqGenerator *m_gensequence;
    size_t m_gencount;
    int m_id;

    bool m_force_sequential;
    bool m_in_population;
    NextOp::Mode m_mode_read;
    NextOp::Mode m_mode_write;
    GeneratorState *m_local_genstate;
    SubdocGeneratorState *m_sdgenstate;
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
        unsigned exptime = config.getExptime();

        for (size_t ii = 0; ii < config.opsPerCycle; ++ii) {
            kgen.setNextOp(opinfo);

            switch (opinfo.m_mode) {
            case NextOp::STORE: {
                lcb_CMDSTORE scmd = { 0 };
                scmd.operation = LCB_SET;
                scmd.exptime = exptime;
                LCB_CMD_SET_KEY(&scmd, opinfo.m_key.c_str(), opinfo.m_key.size());
                LCB_CMD_SET_VALUEIOV(&scmd, &opinfo.m_valuefrags[0], opinfo.m_valuefrags.size());
                error = lcb_store3(instance, this, &scmd);
                break;
            }
            case NextOp::GET: {
                lcb_CMDGET gcmd = { 0 };
                LCB_CMD_SET_KEY(&gcmd, opinfo.m_key.c_str(), opinfo.m_key.size());
                gcmd.exptime = exptime;
                error = lcb_get3(instance, this, &gcmd);
                break;
            }
            case NextOp::SDSTORE:
            case NextOp::SDGET: {
                lcb_CMDSUBDOC sdcmd = { 0 };
                if (opinfo.m_mode == NextOp::SDSTORE) {
                    sdcmd.exptime = exptime;
                }
                LCB_CMD_SET_KEY(&sdcmd, opinfo.m_key.c_str(), opinfo.m_key.size());
                sdcmd.specs = &opinfo.m_specs[0];
                sdcmd.nspecs = opinfo.m_specs.size();
                error = lcb_subdoc3(instance, this, &sdcmd);
                break;
            }
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
            if (config.getRateLimit() > 0) {
                rateLimitThrottle();
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

    void rateLimitThrottle() {
        lcb_U64 now = lcb_nstime();
        static lcb_U64 previous_time = now;

        const lcb_U64 elapsed_ns = now - previous_time;
        const lcb_U64 wanted_duration_ns =
                config.opsPerCycle * 1e9 / config.getRateLimit();
        // On first invocation no previous_time, so skip attempting to sleep.
        if (elapsed_ns > 0 && elapsed_ns < wanted_duration_ns) {
            // Dampen the sleep time by averaging with the previous
            // sleep time.
            static lcb_U64 last_sleep_ns = 0;
            const lcb_U64 sleep_ns =
                    (last_sleep_ns + wanted_duration_ns - elapsed_ns) / 2;
            usleep(sleep_ns / 1000);
            now += sleep_ns;
            last_sleep_ns = sleep_ns;
        }
        previous_time = now;
    }

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
    try {
        parser.parse(argc, argv, false);
        config.processOptions();
    } catch (std::string& e) {
        std::cerr << e << std::endl;
        exit(EXIT_FAILURE);
    } catch (std::exception& e) {
        std::cerr << e.what() << std::endl;
        exit(EXIT_FAILURE);
    }
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
        lcb_install_callback3(instance, LCB_CALLBACK_SDMUTATE, operationCallback);
        lcb_install_callback3(instance, LCB_CALLBACK_SDLOOKUP, operationCallback);
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
