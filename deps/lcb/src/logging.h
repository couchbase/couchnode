#ifndef LCB_LOGGING_H
#define LCB_LOGGING_H
#include <stdarg.h>

#ifdef __cplusplus
extern "C" {
#endif /* __cplusplus */


struct lcb_settings_st;
struct lcb_st;

/**
 * Default printf logger which is enabled via LCB_LOGLEVEL in the
 * environment
 */
extern struct lcb_logprocs_st *lcb_console_logprocs;

/**
 * Log a message via the installed logger. The parameters correlate to the
 * arguments passed to the lcb_logging_callback function.
 *
 * Typically a subsystem may wish to define macros in order to reduce the
 * number of arguments manually passed for each message.
 */
LCB_INTERNAL_API
void lcb_log(const struct lcb_settings_st *settings,
             const char *subsys,
             int severity,
             const char *srcfile,
             int srcline,
             const char *fmt,
             ...);

lcb_logprocs * lcb_init_console_logger(void);

#define LCB_LOGS(settings, subsys, severity, msg) \
    lcb_log(settings, subsys, severity, __FILE__, __LINE__, msg)

#define LCB_LOG_EX(settings, subsys, severity, msg) \
    lcb_log(settings, subsys, severity, __FILE__, __LINE__, msg)

#define LCB_LOG_BASIC(settings, msg) \
    lcb_log(settings, "unknown", 0, __FILE__, __LINE__, msg)

/** Macro for overcoming Win32 identifiers */
#define LCB_LOG_ERR LCB_LOG_ERROR

#ifdef __cplusplus
}
#endif /* __cplusplus */

#endif /* LCB_LOGGING_H */
