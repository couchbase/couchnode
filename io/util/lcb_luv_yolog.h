
/*
This file was automatically generated from '/home/mnunberg/src/yolog/srcutil/genyolog.pl'. It contains the macro
wrappers and function definitions.
*/
/**
 *  Initial version August 2010
 *  Second revision June 2012
 *  Copyright 2010-2012 M. Nunberg
 *  See the included LICENSE file for distribution terms
 *
 *
 *  Yolog is a simple logging library.
 *
 *  It has several goals
 *
 *  1) Make initial usage and learning curve as *easy* as possible. It should be
 *      simple enough to generate loging output for most cases
 *
 *  2) While simplicity is good, flexibility is good too. From my own
 *      experience, programs will tend to accumulate a great deal of logging
 *      info. In common situations they are just commented out or removed in
 *      production deployments. This is probably not the right way to go.
 *      Logging statements at times can function as comments, and should be
 *      enabled when required.
 *
 *      Thus output control and performance should be flexible, but not at the
 *      cost of reduced simplicity.
 *
 *  3) Reduction of boilerplate. Logging should be more about what's being
 *      logged, and less about which particular output control or context is
 *      being used. Through the use of preprocessor macros, this information
 *      should be implicit using a simple identifier which is the logging
 *      entry point.
 *
 *
 *  As such, the architecture is designed as follows:
 *
 *  Logging Context
 *      This is the main component. A logging context represents a class or
 *      subsystem within the application which emits messages. This logging
 *      context is created or initialized by the application developer
 *      appropriate to his or her application.
 *
 *      For example, an HTTP client may contain the following systems
 *          htparse: Subsystem which handles HTTP parsing
 *          sockpool: Subsystem maintaining connection pools
 *          srvconn:  Subsystem which intializes new connections to the server
 *          io: Reading/writing and I/O readiness notifications
 *
 *  Logging Levels:
 *      Each subsystem has various degrees of information it may wish to emit.
 *      Some information is relevant only while debugging an application, while
 *      other information may be relevant to its general maintenance.
 *
 *      For example, an HTTP parser system may wish to output the tokens it
 *      encounters during its processing of the TCP stream, but would also
 *      like to notify about bad messages, or such which may exceed the maximum
 *      acceptable header size (which may hint at an attack or security risk).
 *
 *      Logging messages of various degrees concern various aspects of the
 *      application's development and maintenance, and therefore need individual
 *      output control.
 *
 *  Configuration:
 *      Because of the varying degrees of flexibility required in a logging
 *      library, there are multiple configuration stages.
 *
 *      1) Project configuration.
 *          As the project author, you are aware of the subsystems which your
 *          application provides, and should be able to specify this as a
 *          compile/build time parameter. This includes the types of subsystems
 *          as well as the identifier/macro names which your application will
 *          use to emit logging messages. The burden should not be placed
 *          on the application developer to actually perform the boilerplate
 *          of writing logging wrappers, as this can be generally abstracted
 *
 *      2) Runtime/Initialization configuration.
 *          This is performed by users who are interested in different aspects
 *          of your application's logging systems. Thus, a method of providing
 *          configuration files and environment variables should be used in
 *          order to allow users to modify logging output from outside the code.
 *
 *          Additionally, you as the application developer may be required to
 *          trigger this bootstrap process (usually a few function calls from
 *          your program's main() function).
 *
 *      3) There is no logging configuration or setup!
 *          Logging messages themselves should be entirely about the message
 *          being emitted, with the metadata/context information being implicit
 *          and only the information itself being explicit.
 */

#ifndef LCB_LUV_YOLOG_H_
#define LCB_LUV_YOLOG_H_

#include <stdio.h>
#include <stdarg.h>

typedef enum {
    /* make at least one signed number here */
    _LCB_LUV_YOLOG_LEVEL_MAKE_COMPILER_HAPPY = -1,

#define LCB_LUV_YOLOG_XLVL(X) \
    X(DEFAULT,  0) \
    /* really transient messages */ \
    X(RANT,     1) \
    /* function enter/leave events */ \
    X(TRACE,    2) \
    /* state change events */ \
    X(STATE,    3) \
    /* generic application debugging events */ \
    X(DEBUG,    4) \
    /* informational messages */ \
    X(INFO,     5) \
    /* warning messages */ \
    X(WARN,     6) \
    /* error messages */ \
    X(ERROR,    7) \
    /* critical messages */ \
    X(CRIT,     8)

#define X(lvl, i) \
    LCB_LUV_YOLOG_##lvl = i,
    LCB_LUV_YOLOG_XLVL(X)
#undef X
    LCB_LUV_YOLOG_LEVEL_MAX
} lcb_luv_yolog_level_t;

#define LCB_LUV_YOLOG_LEVEL_INVALID -1
#define LCB_LUV_YOLOG_LEVEL_UNSET 0

enum {
    /* screen output */
    LCB_LUV_YOLOG_OUTPUT_SCREEN = 0,

    /* global file */
    LCB_LUV_YOLOG_OUTPUT_GFILE,

    /* specific file */
    LCB_LUV_YOLOG_OUTPUT_PFILE,

    LCB_LUV_YOLOG_OUTPUT_COUNT
};

#define LCB_LUV_YOLOG_OUTPUT_ALL LCB_LUV_YOLOG_OUTPUT_COUNT

#ifndef LCB_LUV_YOLOG_API
#define LCB_LUV_YOLOG_API
#endif

struct lcb_luv_yolog_context;
struct lcb_luv_yolog_fmt_st;

/**
 * Callback to be invoked when a logging message arrives.
 * This is passed the logging context, the level, and message passed.
 */
typedef void
        (*lcb_luv_yolog_callback)(
                struct lcb_luv_yolog_context*,
                lcb_luv_yolog_level_t,
                va_list ap);


enum {
    LCB_LUV_YOLOG_LINFO_DEFAULT_ONLY = 0,
    LCB_LUV_YOLOG_LINFO_DEFAULT_ALSO = 1
};

typedef enum {

    #define LCB_LUV_YOLOG_XFLAGS(X) \
    X(NOGLOG, 0x1) \
    X(NOFLOG, 0x2) \
    X(COLOR, 0x10)
    #define X(c,v) LCB_LUV_YOLOG_F_##c = v,
    LCB_LUV_YOLOG_XFLAGS(X)
    #undef X
    LCB_LUV_YOLOG_F_MAX = 0x200
} lcb_luv_yolog_flags_t;

/* maximum size of heading/trailing user data between format specifiers */
#define LCB_LUV_YOLOG_FMT_USTR_MAX 16

/* Default format string */
#define LCB_LUV_YOLOG_FORMAT_DEFAULT \
    "[%(prefix)] %(filename):%(line) %(color)(%(func)) "


enum {
    LCB_LUV_YOLOG_FMT_LISTEND = 0,
    LCB_LUV_YOLOG_FMT_USTRING,
    LCB_LUV_YOLOG_FMT_EPOCH,
    LCB_LUV_YOLOG_FMT_PID,
    LCB_LUV_YOLOG_FMT_TID,
    LCB_LUV_YOLOG_FMT_LVL,
    LCB_LUV_YOLOG_FMT_TITLE,
    LCB_LUV_YOLOG_FMT_FILENAME,
    LCB_LUV_YOLOG_FMT_LINE,
    LCB_LUV_YOLOG_FMT_FUNC,
    LCB_LUV_YOLOG_FMT_COLOR
};


/* structure representing a single compiled format specifier */
struct lcb_luv_yolog_fmt_st {
    /* format type, opaque, derived from format string */
    int type;
    /* user string, heading or trailing padding, depending on the type */
    char ustr[LCB_LUV_YOLOG_FMT_USTR_MAX];
};

struct lcb_luv_yolog_msginfo_st {
    const char *co_line;
    const char *co_title;
    const char *co_reset;

    const char *m_func;
    const char *m_file;
    const char *m_prefix;

    int m_level;
    int m_line;
    unsigned long m_time;
};

struct lcb_luv_yolog_output_st {
    FILE *fp;
    struct lcb_luv_yolog_fmt_st *fmtv;
    int use_color;
    int level;
};

struct lcb_luv_yolog_context;

typedef struct lcb_luv_yolog_context_group {
    struct lcb_luv_yolog_context *contexts;
    int ncontexts;
    lcb_luv_yolog_callback cb;
    struct lcb_luv_yolog_output_st o_file;
    struct lcb_luv_yolog_output_st o_screen;
} lcb_luv_yolog_context_group;

typedef struct lcb_luv_yolog_context {
    /**
     * The minimum allowable logging level.
     * Performance number so we don't have to iterate over the entire
     * olevels array each time. This should be kept in sync with sync_levels
     * after any modification to olevels
     */
    lcb_luv_yolog_level_t level;

    struct lcb_luv_yolog_context_group *parent;

    /**
     * Array of per-output-type levels
     */
    lcb_luv_yolog_level_t olevels[LCB_LUV_YOLOG_OUTPUT_COUNT];

    /**
     * This is a human-readable name for the context. This is the 'prefix'.
     */
    const char *prefix;

    /**
     * If this subsystem logs to its own file, then it is set here
     */
    struct lcb_luv_yolog_output_st *o_alt;
} lcb_luv_yolog_context;


/**
 * These two functions log an actual message.
 *
 * @param ctx - The context. Can be NULL to use the default/global context.
 * @param level - The severity of this message
 * @param file - The filename of this message (e.g. __FILE__)
 * @param line - The line of this message (e.g. __LINE__)
 * @param fn - The function name (e.g. __func__)
 * @param fmt - User-defined format (printf-style)
 * @param args .. extra arguments to format
 */
LCB_LUV_YOLOG_API
void
lcb_luv_yolog_logger(lcb_luv_yolog_context *ctx,
             lcb_luv_yolog_level_t level,
             const char *file,
             int line,
             const char *fn,
             const char *fmt,
             ...);

/**
 * Same thing as lcb_luv_yolog_logger except it takes a va_list instead.
 */
LCB_LUV_YOLOG_API
void
lcb_luv_yolog_vlogger(lcb_luv_yolog_context *ctx,
              lcb_luv_yolog_level_t level,
              const char *file,
              int line,
              const char *fn,
              const char *fmt,
              va_list ap);

/**
 * Initialize the default logging settings. This function *must* be called
 * some time before any logging messages are invoked, or disaster may ensue.
 * (Or not).
 */
LCB_LUV_YOLOG_API
void
lcb_luv_yolog_init_defaults(lcb_luv_yolog_context_group *grp,
                    lcb_luv_yolog_level_t default_level,
                    const char *color_env,
                    const char *level_env);


/**
 * Compile a format string into a format structure.
 *
 *
 * Format strings can have specifiers as such: %(spec). This was taken
 * from Python's logging module which is probably one of the easiest logging
 * libraries to use aside from Yolog, of course!
 *
 * The following specifiers are available:
 *
 * %(epoch) - time(NULL) result
 *
 * %(pid) - The process ID
 *
 * %(tid) - The thread ID. On Linux this is gettid(), on other POSIX systems
 *  this does a byte-for-byte representation of the returned pthread_t from
 *  pthread_self(). On non-POSIX systems this does nothing.
 *
 * %(level) - A level string, e.g. 'DEBUG', 'ERROR'
 *
 * %(filename) - The source file
 *
 * %(line) - The line number at which the logging function was invoked
 *
 * %(func) - The function from which the function was invoked
 *
 * %(color) - This is a special specifier and indicates that normal
 *  severity color coding should begin here.
 *
 *
 * @param fmt the format string
 * @return a list of allocated format structures, or NULL on error. The
 * format structure list may be freed by free()
 */
LCB_LUV_YOLOG_API
struct lcb_luv_yolog_fmt_st *
lcb_luv_yolog_fmt_compile(const char *fmt);


/**
 * Sets the format string of a context.
 *
 * Internally this calls fmt_compile and then sets the format's context,
 * freeing any existing context.
 *
 * @param ctx the context which should utilize the format
 * @param fmt a format string.
 * @param replace whether to replace the existing string (if any)
 *
 * @return 0 on success, -1 if there was an error setting the format.
 *
 *
 */
LCB_LUV_YOLOG_API
int
lcb_luv_yolog_set_fmtstr(struct lcb_luv_yolog_output_st *output,
                 const char *fmt,
                 int replace);


LCB_LUV_YOLOG_API
void
lcb_luv_yolog_set_screen_format(lcb_luv_yolog_context_group *grp,
                        const char *format);

/**
 * Yolog maintains a global object for messages which have no context.
 * This function gets this object.
 */
LCB_LUV_YOLOG_API
lcb_luv_yolog_context *
lcb_luv_yolog_get_global(void);

/**
 * This will read a file and apply debug settings from there..
 *
 * @param contexts an aray of logging contexts
 * @param ncontext the count of contexts
 * @param filename the filename containing the settings
 * @param cb a callback to invoke when an unrecognized line is found
 * @param error a pointer to a string which shall contain an error
 *
 * @return true on success, false on failure. error will be set on failure as
 * well. Should be freed with 'free()'
 */
LCB_LUV_YOLOG_API
int
lcb_luv_yolog_parse_file(lcb_luv_yolog_context_group *grp,
                 const char *filename);


LCB_LUV_YOLOG_API
void
lcb_luv_yolog_parse_envstr(lcb_luv_yolog_context_group *grp,
                const char *envstr);

/**
 * These functions are mainly private
 */

/**
 * This is a hack for C89 compilers which don't support variadic macros.
 * In this case we maintain a global context which is initialized and locked.
 *
 * This function tries to lock the context (it checks to see if this level can
 * be logged, locks the global structure, and returns true. If the level
 * cannot be logged, false is retured).
 *
 * The functions implicit_logger() and implicit_end() should only be called
 * if implicit_begin() returns true.
 */
int
lcb_luv_yolog_implicit_begin(lcb_luv_yolog_context *ctx,
                     int level,
                     const char *file,
                     int line,
                     const char *fn);

/**
 * printf-compatible wrapper which operates on the implicit structure
 * set in implicit_begin()
 */
void
lcb_luv_yolog_implicit_logger(const char *fmt, ...);

/**
 * Unlocks the implicit structure
 */
void
lcb_luv_yolog_implicit_end(void);


void
lcb_luv_yolog_fmt_write(struct lcb_luv_yolog_fmt_st *fmts,
                FILE *fp,
                const struct lcb_luv_yolog_msginfo_st *minfo);


void
lcb_luv_yolog_sync_levels(lcb_luv_yolog_context *ctx);

/**
 * These are the convenience macros. They are disabled by default because I've
 * made some effort to make lcb_luv_yolog more embed-friendly and not clobber a project
 * with generic functions.
 *
 * The default macros are C99 and employ __VA_ARGS__/variadic macros.
 *
 *
 *
 */
#ifdef LCB_LUV_YOLOG_ENABLE_MACROS

#ifndef LCB_LUV_YOLOG_C89_MACROS

/**
 * These macros are all invoked with double-parens, so
 * lcb_luv_yolog_debug(("foo"));
 * This way the 'variation' of the arguments is dispatched to the actual C
 * function instead of the macro..
 */

#define lcb_luv_yolog_debug(...) \
lcb_luv_yolog_logger(\
    NULL\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)

#define lcb_luv_yolog_info(...) \
lcb_luv_yolog_logger(\
    NULL\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)

#define lcb_luv_yolog_warn(...) \
lcb_luv_yolog_logger(\
    NULL\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)

#define lcb_luv_yolog_error(...) \
lcb_luv_yolog_logger(\
    NULL\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)

#define lcb_luv_yolog_crit(...) \
lcb_luv_yolog_logger(\
    NULL\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)

#else /* ifdef LCB_LUV_YOLOG_C89_MACROS */


#define lcb_luv_yolog_debug(args) \
if (lcb_luv_yolog_implicit_begin( \
    NULL, \
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__)) \
{ \
    lcb_luv_yolog_implicit_logger args; \
    lcb_luv_yolog_implicit_end(); \
}

#define lcb_luv_yolog_info(args) \
if (lcb_luv_yolog_implicit_begin( \
    NULL, \
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__)) \
{ \
    lcb_luv_yolog_implicit_logger args; \
    lcb_luv_yolog_implicit_end(); \
}

#define lcb_luv_yolog_warn(args) \
if (lcb_luv_yolog_implicit_begin( \
    NULL, \
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__)) \
{ \
    lcb_luv_yolog_implicit_logger args; \
    lcb_luv_yolog_implicit_end(); \
}

#define lcb_luv_yolog_error(args) \
if (lcb_luv_yolog_implicit_begin( \
    NULL, \
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__)) \
{ \
    lcb_luv_yolog_implicit_logger args; \
    lcb_luv_yolog_implicit_end(); \
}

#define lcb_luv_yolog_crit(args) \
if (lcb_luv_yolog_implicit_begin( \
    NULL, \
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__)) \
{ \
    lcb_luv_yolog_implicit_logger args; \
    lcb_luv_yolog_implicit_end(); \
}

#endif /* LCB_LUV_YOLOG_C89_MACROS */

#endif /* LCB_LUV_YOLOG_ENABLE_MACROS */

#endif /* LCB_LUV_YOLOG_H_ */

/** These macros define the subsystems for logging **/

#define LCB_LUV_YOLOG_LOGGING_SUBSYS_READ          0
#define LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS          1
#define LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT         2
#define LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET        3
#define LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE         4
#define LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP          5
#define LCB_LUV_YOLOG_LOGGING_SUBSYS__COUNT        6




/** Array of context object for each of our subsystems **/
extern lcb_luv_yolog_context* lcb_luv_yolog_logging_contexts;
extern lcb_luv_yolog_context_group lcb_luv_yolog_log_group;

/** Function called to initialize the logging subsystem **/

void
lcb_luv_yolog_init(const char *configfile);


/** Macro to retrieve information about a specific subsystem **/

#define lcb_luv_yolog_subsys_ctx(subsys) \
    (lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_ ## subsys)

#define lcb_luv_yolog_subsys_count() (LCB_LUV_YOLOG_LOGGING_SUBSYS__COUNT)

#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 0))
#define log_rant(...)
#else
#define log_rant(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_RANT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 1))
#define log_trace(...)
#else
#define log_trace(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_TRACE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 2))
#define log_state(...)
#else
#define log_state(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_STATE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 3))
#define log_debug(...)
#else
#define log_debug(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 4))
#define log_info(...)
#else
#define log_info(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 5))
#define log_warn(...)
#else
#define log_warn(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 6))
#define log_error(...)
#else
#define log_error(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 7))
#define log_crit(...)
#else
#define log_crit(...) \
lcb_luv_yolog_logger(\
    NULL,\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 0))
#define log_read_rant(...)
#else
#define log_read_rant(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_RANT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 1))
#define log_read_trace(...)
#else
#define log_read_trace(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_TRACE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 2))
#define log_read_state(...)
#else
#define log_read_state(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_STATE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 3))
#define log_read_debug(...)
#else
#define log_read_debug(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 4))
#define log_read_info(...)
#else
#define log_read_info(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 5))
#define log_read_warn(...)
#else
#define log_read_warn(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 6))
#define log_read_error(...)
#else
#define log_read_error(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 7))
#define log_read_crit(...)
#else
#define log_read_crit(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ,\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 0))
#define log_iops_rant(...)
#else
#define log_iops_rant(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_RANT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 1))
#define log_iops_trace(...)
#else
#define log_iops_trace(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_TRACE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 2))
#define log_iops_state(...)
#else
#define log_iops_state(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_STATE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 3))
#define log_iops_debug(...)
#else
#define log_iops_debug(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 4))
#define log_iops_info(...)
#else
#define log_iops_info(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 5))
#define log_iops_warn(...)
#else
#define log_iops_warn(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 6))
#define log_iops_error(...)
#else
#define log_iops_error(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 7))
#define log_iops_crit(...)
#else
#define log_iops_crit(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS,\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 0))
#define log_event_rant(...)
#else
#define log_event_rant(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_RANT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 1))
#define log_event_trace(...)
#else
#define log_event_trace(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_TRACE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 2))
#define log_event_state(...)
#else
#define log_event_state(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_STATE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 3))
#define log_event_debug(...)
#else
#define log_event_debug(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 4))
#define log_event_info(...)
#else
#define log_event_info(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 5))
#define log_event_warn(...)
#else
#define log_event_warn(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 6))
#define log_event_error(...)
#else
#define log_event_error(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 7))
#define log_event_crit(...)
#else
#define log_event_crit(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT,\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 0))
#define log_socket_rant(...)
#else
#define log_socket_rant(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_RANT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 1))
#define log_socket_trace(...)
#else
#define log_socket_trace(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_TRACE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 2))
#define log_socket_state(...)
#else
#define log_socket_state(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_STATE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 3))
#define log_socket_debug(...)
#else
#define log_socket_debug(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 4))
#define log_socket_info(...)
#else
#define log_socket_info(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 5))
#define log_socket_warn(...)
#else
#define log_socket_warn(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 6))
#define log_socket_error(...)
#else
#define log_socket_error(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 7))
#define log_socket_crit(...)
#else
#define log_socket_crit(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET,\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 0))
#define log_write_rant(...)
#else
#define log_write_rant(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_RANT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 1))
#define log_write_trace(...)
#else
#define log_write_trace(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_TRACE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 2))
#define log_write_state(...)
#else
#define log_write_state(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_STATE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 3))
#define log_write_debug(...)
#else
#define log_write_debug(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 4))
#define log_write_info(...)
#else
#define log_write_info(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 5))
#define log_write_warn(...)
#else
#define log_write_warn(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 6))
#define log_write_error(...)
#else
#define log_write_error(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 7))
#define log_write_crit(...)
#else
#define log_write_crit(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE,\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 0))
#define log_loop_rant(...)
#else
#define log_loop_rant(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_RANT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 1))
#define log_loop_trace(...)
#else
#define log_loop_trace(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_TRACE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 2))
#define log_loop_state(...)
#else
#define log_loop_state(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_STATE, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 3))
#define log_loop_debug(...)
#else
#define log_loop_debug(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_DEBUG, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 4))
#define log_loop_info(...)
#else
#define log_loop_info(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_INFO, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 5))
#define log_loop_warn(...)
#else
#define log_loop_warn(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_WARN, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 6))
#define log_loop_error(...)
#else
#define log_loop_error(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_ERROR, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
#if (defined LCB_LUV_YOLOG_DEBUG_LEVEL \
    && (LCB_LUV_YOLOG_DEBUG_LEVEL > 7))
#define log_loop_crit(...)
#else
#define log_loop_crit(...) \
lcb_luv_yolog_logger(\
    lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP,\
    LCB_LUV_YOLOG_CRIT, \
    __FILE__, \
    __LINE__, \
    __func__, \
    ## __VA_ARGS__)
#endif /* LCB_LUV_YOLOG_NDEBUG_LEVEL */
