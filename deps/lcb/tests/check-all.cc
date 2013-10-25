/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

/**
 * Rather than hacking together a shell script or depending on some scripting
 * language, we'll use a simple C++ application to run 'unit-tests'
 * with the appropriate settings we need.
 */

#include <libcouchbase/couchbase.h>

#include <stdlib.h>
#include <stdio.h>
#include <ctype.h>
#include <cassert>

#include <iostream>
#include <fstream>
#include <vector>
#include <cstring>
#include <list>

#include "config.h"
#include "procutil.h"
#include "commandlineparser.h"
#include <libcouchbase/couchbase.h>


#define PLUGIN_ENV_VAR "LIBCOUCHBASE_EVENT_PLUGIN_NAME"
#define LCB_SRCROOT_ENV_VAR "srcdir"
#ifdef HAVE_COUCHBASEMOCK
#define DEFAULT_TEST_NAMES "unit-tests;smoke-test"
#else
#define DEFAULT_TEST_NAMES "unit-tests"
#endif

#ifdef _WIN32
const char default_plugins_string[] = "select;iocp;libuv";
#define PATHSEP "\\"
#define usleep(n) Sleep((n) / 1000)
#define setenv(key, value, ignored) SetEnvironmentVariable(key, value)
#else
#include <signal.h>
#include <unistd.h> /* usleep */
const char default_plugins_string[] = "select"
#if defined(HAVE_LIBEV3) || defined(HAVE_LIBEV4)
";libev"
#endif
#if defined(HAVE_LIBEVENT) || defined(HAVE_LIBEVENT2)
";libevent"
#endif
#ifdef HAVE_LIBUV
";libuv"
#endif
;
#define PATHSEP "/"
#endif

typedef std::vector<std::string> strlist;

class TestConfiguration
{

public:
    TestConfiguration() {
        addOption(&opt_debugger, 'd', "debugger",
                  "Verbatim string to prepend before execution of test binary");

        addOption(&opt_plugins, 'p', "opt_plugins",
                  "semicolon-delimited list of plugins to test",
                  default_plugins_string);

        addOption(&opt_jobs, 'j', "opt_jobs",
                  "Execute this many processes concurrently");

        addOption(&opt_srcdir, 'S', "srcdir",
                  "root directory of source tree for locating mock");

        addOption(&opt_bindir, 'T', "testdir",
                  "Location where test binaries are located");

        addFlag(&opt_interactive, 'I', "interactive",
                "Set this to true if using an interactive debugger which "
                "requires input on stdin");

        addFlag(&opt_verbose, 'v', "verbose",
                "Print output to screen. If this option is not set "
                "output will be redirected to a file");

        addOption(&opt_bins, 'B', "tests",
                  "Semicolon-delimited list of tests to run",
                  DEFAULT_TEST_NAMES);

        addOption(&opt_cycles, 'n', "repeat",
                  "Repeat cycle this many times",
                  "1");
    }

    ~TestConfiguration() {
        freeOptions();
    }

    static void splitSemicolonString(const std::string &s, strlist &l) {
        std::string cur;

        for (const char *c = s.c_str(); *c; c++) {
            if (*c == ';') {
                l.push_back(cur);
                cur.clear();
                continue;
            }
            cur += *c;
        }

        if (!cur.empty()) {
            l.push_back(cur);
        }
    }

    bool parseOptions(int argc, char **argv) {
        std::stringstream ss;

        int myargc = 0;
        for (int ii = 0; ii < argc; ii++) {
            if (strcmp(argv[ii], "--") == 0) {
                break;
            }
            myargc++;
        }

        if (myargc < argc) {
            for (int ii = myargc; ii < argc; ii++) {
                ss << argv[ii] << " ";
            }
        }
        binOptions = ss.str();
        ss.clear();

        if (!parser.parse(myargc, argv)) {
            parser.usage(argv[0]);
            return false;
        }


        assignFromArg(srcroot, opt_srcdir, getEffectiveSrcroot());
        assignFromArg(testdir, opt_bindir, getEffectiveTestdir());
        assignFromArg(debugger, opt_debugger, "");

        // Verbosity
        isVerbose = opt_verbose->found;

        // isInteractive
        isInteractive = opt_interactive->found;

        // Jobs
        setJobsFromEnvironment(opt_jobs->argument);

        sscanf(opt_cycles->argument, "%d", &maxCycles);

        // Plugin list:
        splitSemicolonString(opt_plugins->argument, plugins);

        // Test names:
        splitSemicolonString(opt_bins->argument, testnames);

        return true;
    }

    // Sets up the command line, appending any debugger info and paths
    std::string setupCommandline(std::string &name) {
        std::stringstream ss;
        std::string ret;

        if (!debugger.empty()) {
            ss << debugger << " ";
        }

        ss << testdir << PATHSEP << name;

        if (!binOptions.empty()) {
            ss << " " << binOptions;
        }

        return ss.str();
    }


    // Options passed to the binary itself
    std::string binOptions;
    std::string srcroot;
    std::string testdir;
    std::string debugger;

    strlist plugins;
    strlist testnames;

    bool isVerbose;
    bool isInteractive;
    int maxJobs;
    int maxCycles;

private:
    CommandLineOption *opt_debugger;
    CommandLineOption *opt_plugins;
    CommandLineOption *opt_jobs;
    CommandLineOption *opt_srcdir;
    CommandLineOption *opt_bindir;
    CommandLineOption *opt_interactive;
    CommandLineOption *opt_verbose;
    CommandLineOption *opt_bins;
    CommandLineOption *opt_cycles;
    Getopt parser;

    void freeOptions() {
        delete opt_debugger;
        delete opt_plugins;
        delete opt_jobs;
        delete opt_srcdir;
        delete opt_bindir;
        delete opt_interactive;
        delete opt_verbose;
    }

    void addOption(CommandLineOption **target,
                   char c,
                   const char *longopt,
                   const char *desc,
                   const char *defl = NULL) {
        *target = new CommandLineOption(c, longopt, true, desc);
        (*target)->argument = (char *)defl;
        parser.addOption(*target);
    }

    void addFlag(CommandLineOption **target,
                 char c,
                 const char *longopt,
                 const char *desc = NULL) {
        *target = new CommandLineOption(c, longopt, false, desc);
        parser.addOption(*target);
    }

    void assignFromArg(std::string &target,
                       const CommandLineOption *src,
                       const std::string &defl) {
        if (src->argument) {
            target = src->argument;
        } else {
            target = defl;
        }
    }

    void setJobsFromEnvironment(const char *arg) {
        if (arg) {
            sscanf(arg, "%d", &maxJobs);
            return;
        }

        char *tmp = getenv("MAKEFLAGS");

        if (tmp == NULL || *tmp == '\0') {
            maxJobs = 1;
            return;
        }

        if (strstr(tmp, "-j")) {
            maxJobs = 32;

        } else {
            maxJobs = 1;
        }
    }

    std::string getEffectiveSrcroot() {
        const char *tmp = getenv(LCB_SRCROOT_ENV_VAR);
        if (tmp && *tmp) {
            return tmp;
        }

        return getDefaultSrcroot();
    }

    std::string getEffectiveTestdir() {
        const char *tmp = getenv("outdir");
        if (tmp && *tmp) {
            return tmp;
        }
        return getDefaultTestdir();
    }

#ifndef _WIN32
    // Evaluated *before*
    std::string getDefaultSrcroot() {
        return ".";
    }

    std::string getDefaultTestdir() {
        return (srcroot + PATHSEP) + "tests";
    }

#else
    std::string getSelfDirname() {
        DWORD result;
        char pathbuf[4096] = { 0 };
        result = GetModuleFileName(NULL, pathbuf, sizeof(pathbuf));
        assert(result > 0);
        assert(result < sizeof(pathbuf));

        for (DWORD ii = result; ii; ii--) {
            if (pathbuf[ii] == '\\') {
                break;
            }
            pathbuf[ii] = '\0';
        }
        return pathbuf;
    }
    // For windows, we reside in the same directory as the binaries
    std::string getDefaultSrcroot() {
        std::string dir = getSelfDirname();
        std::stringstream ss;
        ss << dir;

        int components_max;

#ifdef _MSC_VER
        // Visual Studio projects are usually something like:
        // $ROOT\VS\10.0\bin\Debug
        // (1)..\bin, (2)..\10.0, (3)..\VS, (4)..\$ROOT
        components_max = 4;
#else
        // For MinGW, it's something like $ROOT\$BUILD\bin; so
        // (1) ..\BUILD, (2) ..\ROOT
        components_max = 2;
#endif

        for (int ii = 0; ii < components_max; ii++) {
            ss << PATHSEP << "..";
        }

        return ss.str();
    }

    std::string getDefaultTestdir() {
        return getSelfDirname();
    }
#endif
};


static void setPluginEnvironment(std::string &name)
{
    const char *v = NULL;
    if (name != "default") {
        v = name.c_str();
    }

    setenv(PLUGIN_ENV_VAR, v, 1);

    fprintf(stderr, "%s=%s ... ", PLUGIN_ENV_VAR, name.c_str());
    struct lcb_cntl_iops_info_st ioi;
    memset(&ioi, 0, sizeof(ioi));

    lcb_error_t err = lcb_cntl(NULL, LCB_CNTL_GET, LCB_CNTL_IOPS_DEFAULT_TYPES,
                               &ioi);
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "LCB Error 0x%x\n", err);
    } else {
        fprintf(stderr, "Plugin ID: 0x%x\n", ioi.v.v0.effective);
    }
}

struct Process {
    child_process_t proc_;
    std::string commandline;
    std::string logfileName;
    std::string pluginName;
    std::string testName;
    bool exitedOk;
    bool verbose;

    Process(std::string &plugin, std::string &name, std::string &cmd,
            TestConfiguration &config) {
        this->pluginName = plugin;
        this->testName = name;
        this->commandline = cmd;
        this->verbose = config.isVerbose;
        proc_.interactive = config.isInteractive;
        this->logfileName = "check-all-" + pluginName + "-" + testName + ".log";
    }

    void writeLog(const char *msg) {
        std::ofstream out(logfileName.c_str(), std::ios::app);
        out << msg << std::endl;
        out.close();
    }

    void setupPointers() {
        memset(&proc_, 0, sizeof(proc_));

        proc_.name = commandline.c_str();

        if (!verbose) {
            proc_.redirect = logfileName.c_str();
        }
    }
};

class TestScheduler
{
public:
    TestScheduler(unsigned int lim) : limit(lim) {

    }

    typedef std::list<Process *> proclist;
    std::vector<Process> _all;

    proclist executing;
    proclist scheduled;
    proclist completed;

    unsigned int limit;

    void schedule(Process proc) {
        _all.push_back(proc);
    }


    bool runAll() {
        proclist::iterator iter;
        scheduleAll();

        while (!(executing.empty() && scheduled.empty())) {
            while ((!scheduled.empty()) && executing.size() < limit) {
                Process *proc = scheduled.front();
                scheduled.pop_front();
                invokeScheduled(proc);
            }

            // Wait for them to complete
            proclist to_remove_e;
            for (iter = executing.begin(); iter != executing.end(); iter++) {
                Process *cur = *iter;
                int rv = wait_process(&cur->proc_, -1);

                if (rv == 0) {
                    char msg[2048];
                    cur->exitedOk = cur->proc_.status == 0;
                    snprintf(msg, 2048, "REAP [%s] '%s' .. %s",
                             cur->pluginName.c_str(),
                             cur->commandline.c_str(),
                             cur->exitedOk ? "OK" : "FAIL");
                    cur->writeLog(msg);
                    fprintf(stderr, "%s\n", msg);
                    cleanup_process(&cur->proc_);
                    to_remove_e.push_back(cur);
                }
            }

            for (iter = to_remove_e.begin(); iter != to_remove_e.end(); iter++) {
                executing.remove(*iter);
                completed.push_back(*iter);
            }

            usleep(5000);
        }

        for (iter = completed.begin(); iter != completed.end(); iter++) {
            if (!(*iter)->exitedOk) {
                return false;
            }
        }

        return true;
    }

private:
    void scheduleAll() {
        for (unsigned int ii = 0; ii < _all.size(); ii++) {
            Process *p = &_all[ii];
            scheduled.push_back(p);
        }
    }
    void invokeScheduled(Process *proc) {
        proc->setupPointers();
        setPluginEnvironment(proc->pluginName);
        char msg[2048];
        snprintf(msg, 2048, "START [%s] '%s'",
                 proc->pluginName.c_str(),
                 proc->commandline.c_str());
        proc->writeLog(msg);
        fprintf(stderr, "%s\n", msg);

        int rv = create_process(&proc->proc_);
        if (rv < 0) {
            snprintf(msg, 2048, "FAIL couldn't invoke [%s] '%s'",
                     proc->pluginName.c_str(),
                     proc->commandline.c_str());
            proc->writeLog(msg);
            fprintf(stderr, "%s\n", msg);
            proc->exitedOk = false;
            completed.push_back(proc);
            return;
        } else {
            executing.push_back(proc);
        }
    }

};

static bool runSingleCycle(TestConfiguration &config)
{
    TestScheduler scheduler(config.maxJobs);

    for (strlist::iterator iter = config.plugins.begin();
            iter != config.plugins.end();
            iter++) {

        fprintf(stderr, "Testing with plugin '%s'\n", iter->c_str());

        for (strlist::iterator iterbins = config.testnames.begin();
                iterbins != config.testnames.end();
                iterbins++) {

            std::string cmdline = config.setupCommandline(*iterbins);
            scheduler.schedule(Process(*iter, *iterbins, cmdline, config));
        }

    }

    return scheduler.runAll();

}

int main(int argc, char **argv)
{
#ifndef _WIN32
    signal(SIGPIPE, SIG_IGN);
#endif

    TestConfiguration config;
    if (!config.parseOptions(argc, argv)) {
        exit(EXIT_FAILURE);
    }

    // Set the environment for 'srcdir'
    std::stringstream ss;
    fprintf(stderr, "%s=%s\n", LCB_SRCROOT_ENV_VAR, config.srcroot.c_str());
    setenv(LCB_SRCROOT_ENV_VAR, config.srcroot.c_str(), 1);
    setenv("LCB_VERBOSE_TESTS", "1", 1);

    for (int ii = 0; ii < config.maxCycles; ii++) {
        if (!runSingleCycle(config)) {
            return EXIT_FAILURE;
        }
    }
    return EXIT_SUCCESS;
}
