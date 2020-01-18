/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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

#include "settings.h"
#include "logging.h"
#include "internal.h" /* for lcb_getenv* */
#include <stdio.h>
#include <stdarg.h>

#ifdef _WIN32
#define flockfile(x) (void)0
#define funlockfile(x) (void)0
#endif

#if defined(unix) || defined(__unix__) || defined(__unix) || defined(_POSIX_VERSION)
#include <unistd.h>
#include <pthread.h>
#include <sys/types.h>

/** XXX: If any of these blocks give problems for your platform, just
 * erase it and have it use the fallback implementation. This isn't core
 * functionality of the library, but is a rather helpful feature in order
 * to get the thread/process identifier
 */

#if defined(__linux__)
#include <sys/syscall.h>
#define GET_THREAD_ID() (long)syscall(SYS_gettid)
#define THREAD_ID_FMT "ld"
#elif defined(__APPLE__)
#define GET_THREAD_ID() getpid(), pthread_mach_thread_np(pthread_self())
#define THREAD_ID_FMT "d/%x"
#elif defined(__sun) && defined(__SVR4)
#include <thread.h>
/* Thread IDs are not global in solaris, so it's nice to print the PID alongside it */
#define GET_THREAD_ID() getpid(), thr_self()
#define THREAD_ID_FMT "ld/%u"
#elif defined(__FreeBSD__)
/* Like solaris, but thr_self is a bit different here */
#include <sys/thr.h>
static long ret_thr_self(void)
{
    long tmp;
    thr_self(&tmp);
    return tmp;
}
#define GET_THREAD_ID() getpid(), ret_thr_self()
#define THREAD_ID_FMT "d/%ld"
#else
/* other unix? */
#define GET_THREAD_ID() 0
#define THREAD_ID_FMT "d"
#endif
#elif defined(_WIN32)
#define GET_THREAD_ID() GetCurrentThreadId()
#define THREAD_ID_FMT "d"
#else
#define GET_THREAD_ID() 0
#define THREAD_ID_FMT "d"
#endif

static hrtime_t start_time = 0;

static void console_log(const lcb_LOGGER *procs, uint64_t iid, const char *subsys, lcb_LOG_SEVERITY severity,
                        const char *srcfile, int srcline, const char *fmt, va_list ap);

static struct lcb_CONSOLELOGGER console_logprocs = {{console_log, NULL}, NULL, LCB_LOG_INFO /* Minimum severity */};

lcb_LOGGER *lcb_console_logger = &console_logprocs.base;

/**
 * Return a string representation of the severity level
 */
static const char *level_to_string(int severity)
{
    switch (severity) {
        case LCB_LOG_TRACE:
            return "TRACE";
        case LCB_LOG_DEBUG:
            return "DEBUG";
        case LCB_LOG_INFO:
            return "INFO";
        case LCB_LOG_WARN:
            return "WARN";
        case LCB_LOG_ERROR:
            return "ERROR";
        case LCB_LOG_FATAL:
            return "FATAL";
        default:
            return "";
    }
}

/**
 * Default logging callback for the verbose logger.
 */
static void console_log(const lcb_LOGGER *procs, uint64_t iid, const char *subsys, lcb_LOG_SEVERITY severity,
                        const char *srcfile, int srcline, const char *fmt, va_list ap)
{
    FILE *fp;
    hrtime_t now;
    struct lcb_CONSOLELOGGER *vprocs = (struct lcb_CONSOLELOGGER *)procs;

    if ((int)severity < vprocs->minlevel) {
        return;
    }

    if (!start_time) {
        start_time = gethrtime();
    }

    now = gethrtime();
    if (now == start_time) {
        now++;
    }

    fp = vprocs->fp ? vprocs->fp : stderr;

    flockfile(fp);
    fprintf(fp, "%lums ", (unsigned long)(now - start_time) / 1000000);

    fprintf(fp, "[I%" PRIx64 "] {%" THREAD_ID_FMT "} [%s] (%s - L:%d) ", iid, GET_THREAD_ID(),
            level_to_string(severity), subsys, srcline);
    vfprintf(fp, fmt, ap);
    fprintf(fp, "\n");
    funlockfile(fp);

    (void)procs;
    (void)srcfile;
}

LCB_INTERNAL_API
void lcb_log(const struct lcb_settings_st *settings, const char *subsys, int severity, const char *srcfile, int srcline,
             const char *fmt, ...)
{
    va_list ap;
    lcb_LOGGER_CALLBACK callback;

    if (!settings->logger) {
        return;
    }

    callback = settings->logger->callback;

    if (!callback)
        return;

    va_start(ap, fmt);
    callback(settings->logger, settings->iid, subsys, severity, srcfile, srcline, fmt, ap);
    va_end(ap);
}

LCB_INTERNAL_API
void lcb_log_badconfig(const struct lcb_settings_st *settings, const char *subsys, int severity, const char *srcfile,
                       int srcline, const lcbvb_CONFIG *vbc, const char *origin_txt)
{
    const char *errstr = lcbvb_get_error(vbc);
    if (!errstr) {
        errstr = "<FIXME: No error string provided for parse failure>";
    }

    lcb_log(settings, subsys, severity, srcfile, srcline, "vBucket config parsing failed: %s. Raw text in DEBUG level",
            errstr);
    if (!origin_txt) {
        origin_txt = "<FIXME: No origin text available>";
    }
    lcb_log(settings, subsys, LCB_LOG_DEBUG, srcfile, srcline, "%s", origin_txt);
}

lcb_LOGGER *lcb_init_console_logger(void)
{
    char vbuf[1024];
    char namebuf[PATH_MAX] = {0};
    int lvl = 0;
    int has_file = 0;

    has_file = lcb_getenv_nonempty("LCB_LOGFILE", namebuf, sizeof(namebuf));
    if (has_file && console_logprocs.fp == NULL) {
        FILE *fp = fopen(namebuf, "a");
        if (!fp) {
            fprintf(stderr, "libcouchbase: could not open file '%s' for logging output. (%s)\n", namebuf,
                    strerror(errno));
        }
        console_logprocs.fp = fp;
    }

    if (!lcb_getenv_nonempty("LCB_LOGLEVEL", vbuf, sizeof(vbuf))) {
        return NULL;
    }

    if (sscanf(vbuf, "%d", &lvl) != 1) {
        return NULL;
    }

    if (!lvl) {
        /** "0" */
        return NULL;
    }

    /** The "lowest" level we can expose is WARN, e.g. ERROR-1 */
    lvl = LCB_LOG_ERROR - lvl;
    console_logprocs.minlevel = lvl;
    return lcb_console_logger;
}

LIBCOUCHBASE_API lcb_STATUS lcb_logger_create(lcb_LOGGER **logger, void *cookie)
{
    *logger = (lcb_LOGGER *)calloc(1, sizeof(lcb_LOGGER));
    (*logger)->cookie = cookie;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_logger_destroy(lcb_LOGGER *logger)
{
    free(logger);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_logger_callback(lcb_LOGGER *logger, lcb_LOGGER_CALLBACK callback)
{
    logger->callback = callback;
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcb_STATUS lcb_logger_cookie(const lcb_LOGGER *logger, void **cookie)
{
    *cookie = logger->cookie;
    return LCB_SUCCESS;
}
