#include "settings.h"
#include "logging.h"
#include "internal.h" /* for lcb_getenv* */
#include <stdio.h>
#include <stdarg.h>

static hrtime_t start_time = 0;

struct console_logprocs_st {
    struct lcb_logprocs_st base;
    int minlevel;
};

static void console_log(struct lcb_logprocs_st *procs,
                        unsigned int iid,
                        const char *subsys,
                        int severity,
                        const char *srcfile,
                        int srcline,
                        const char *fmt,
                        va_list ap);

static struct console_logprocs_st console_logprocs = {
        {0 /* version */, {{console_log} /* v1 */} /*v*/},
        /** Minimum severity */
        LCB_LOG_INFO
};

struct lcb_logprocs_st *lcb_console_logprocs = &console_logprocs.base;


/**
 * Return a string representation of the severity level
 */
static const char * level_to_string(int severity)
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
static void console_log(struct lcb_logprocs_st *procs,
                        unsigned int iid,
                        const char *subsys,
                        int severity,
                        const char *srcfile,
                        int srcline,
                        const char *fmt,
                        va_list ap)
{

    hrtime_t now;
    struct console_logprocs_st *vprocs = (struct console_logprocs_st *)procs;

    if (severity < vprocs->minlevel) {
        return;
    }

    if (!start_time) {
        start_time = gethrtime();
    }

    now = gethrtime();
    if (now == start_time) {
        now++;
    }

    fprintf(stderr, "%lums ", (unsigned long)(now - start_time) / 1000000);

    fprintf(stderr, "[I%d] [%s] (%s - L:%d) ",
            iid,
            level_to_string(severity),
            subsys,
            srcline);
    vfprintf(stderr, fmt, ap);
    fprintf(stderr, "\n");

    (void)procs;
    (void)srcfile;
}


LCB_INTERNAL_API
void lcb_log(const struct lcb_settings_st *settings,
             const char *subsys,
             int severity,
             const char *srcfile,
             int srcline,
             const char *fmt,
             ...)
{
    va_list ap;
    lcb_logging_callback callback;

    if (!settings->logger) {
        return;
    }

    if (settings->logger->version != 0) {
        return;
    }

    callback = settings->logger->v.v0.callback;

    va_start(ap, fmt);
    callback(settings->logger, settings->iid, subsys, severity, srcfile, srcline, fmt, ap);
    va_end(ap);
}

lcb_logprocs * lcb_init_console_logger(void)
{
    char vbuf[1024];
    int lvl = 0;

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
    return lcb_console_logprocs;
}
