
/*
This file was automatically generated from '/home/mnunberg/src/yolog/srcutil/genyolog.pl'.
It contains initialization routines and possible a modified version of
the Yolog source code for embedding
*/

/* the following includes needed for APESQ to not try and include
 * its own header (we're inlining it) */

#ifdef _MSC_VER
#pragma warning(disable : 4267)
#endif

#if __GNUC__
#define GENYL__UNUSED __attribute__ ((unused))

#else

#define GENYL__UNUSED
#endif /* __GNUC__ */

#define APESQ_API static GENYL__UNUSED
#define GENYL_APESQ_INLINED
#define APESQ_NO_INCLUDE


#if __GNUC__ >= 4 && __GNUC_MINOR__ >= 6
#pragma GCC diagnostic ignored "-Wsign-compare"
#pragma GCC diagnostic ignored "-Wmissing-field-initializers"
#endif

/* needed for flockfile/funlockfile */
#if (defined(__unix__) && (!defined(_POSIX_SOURCE)) && !defined(__sun))
#define _POSIX_SOURCE
#endif /* __unix__ */

#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <assert.h>
#include <errno.h>
#include <ctype.h>

struct lcb_luv_yolog_context;

struct lcb_luv_yolog_implicit_st {
    int level;

    /** Meta/Context information **/
    int m_line;
    const char *m_func;
    const char *m_file;

    struct lcb_luv_yolog_context *ctx;
};

/**
 * Stuff for C89-mode logging. We can't use variadic macros
 * so we rely on a shared global context. sucks, it does.
 */

#ifdef __unix__
#include <pthread.h>
static pthread_mutex_t Yolog_Global_Mutex;

#define lcb_luv_yolog_global_init() pthread_mutex_init(&Yolog_Global_Mutex, NULL)
#define lcb_luv_yolog_global_lock() pthread_mutex_lock(&Yolog_Global_Mutex)
#define lcb_luv_yolog_global_unlock() pthread_mutex_unlock(&Yolog_Global_Mutex)
#define lcb_luv_yolog_dest_lock(ctx) flockfile(ctx->fp)
#define lcb_luv_yolog_dest_unlock(ctx) funlockfile(ctx->fp)

#else
#define lcb_luv_yolog_dest_lock(ctx)
#define lcb_luv_yolog_dest_unlock(ctx)
#define lcb_luv_yolog_global_init()
#define lcb_luv_yolog_global_lock()
#define lcb_luv_yolog_global_unlock()
#endif /* __unix __ */

#include "lcb_luv_yolog.h"

static struct lcb_luv_yolog_implicit_st Yolog_Implicit;
static
lcb_luv_yolog_context Yolog_Global_Context = {
        LCB_LUV_YOLOG_LEVEL_UNSET, /* level */
        NULL, /* parent */
        { 0 }, /* level settings */
        "", /* prefix */
};

static
lcb_luv_yolog_context_group Yolog_Global_CtxGroup = {
        &Yolog_Global_Context,
        1
};


/*just some macros*/

#define _FG "3"
#define _BG "4"
#define _BRIGHT_FG "1"
#define _INTENSE_FG "9"
#define _DIM_FG "2"
#define _YELLOW "3"
#define _WHITE "7"
#define _MAGENTA "5"
#define _CYAN "6"
#define _BLUE "4"
#define _GREEN "2"
#define _RED "1"
#define _BLACK "0"
/*Logging subsystem*/

LCB_LUV_YOLOG_API
void
lcb_luv_yolog_init_defaults(struct lcb_luv_yolog_context_group *grp,
                    lcb_luv_yolog_level_t default_level,
                    const char *color_env,
                    const char *level_env)
{
    const char *envtmp;
    int itmp = 0, ii;
    int use_color = 0;

    if (!grp) {
        grp = &Yolog_Global_CtxGroup;
    }

    if (color_env && (envtmp = getenv(color_env))) {
        sscanf(envtmp, "%d", &itmp);
        if (itmp) {
            use_color = 1;
        }
    }

    itmp = 0;
    if (level_env && (envtmp = getenv(level_env))) {
        sscanf(envtmp, "%d", &itmp);
        if (itmp != LCB_LUV_YOLOG_DEFAULT) {
            default_level = itmp;
        }
    }

    if (!grp->o_screen.fmtv) {
        grp->o_screen.fmtv = lcb_luv_yolog_fmt_compile(LCB_LUV_YOLOG_FORMAT_DEFAULT);
    }

    if (use_color) {
        grp->o_screen.use_color = 1;
    }

    if (!grp->o_screen.fp) {
        grp->o_screen.fp = stderr;
    }

    if (default_level == LCB_LUV_YOLOG_LEVEL_UNSET) {
        default_level = LCB_LUV_YOLOG_INFO;
    }

    grp->o_screen.level = default_level;

    for (ii = 0; ii < grp->ncontexts; ii++) {
        lcb_luv_yolog_context *ctx = grp->contexts + ii;
        ctx->parent = grp;

        if (ctx->prefix == NULL) {
            ctx->prefix = "";
        }

        lcb_luv_yolog_sync_levels(ctx);
    }

    if (grp != &Yolog_Global_CtxGroup) {
        lcb_luv_yolog_init_defaults(&Yolog_Global_CtxGroup,
                            default_level,
                            color_env,
                            level_env);
    } else {
        lcb_luv_yolog_global_init();
    }
}

static int
output_can_log(lcb_luv_yolog_context *ctx,
            int level,
            int oix,
            struct lcb_luv_yolog_output_st *output)
{
    if (output == NULL) {
        return 0;
    }

    if (output->fp == NULL) {
        return 0;
    }

    if (ctx->olevels[oix] != LCB_LUV_YOLOG_LEVEL_UNSET) {
        if (ctx->olevels[oix] <= level) {
            return 1;
        } else {
            return 0;
        }
    }

    if (output->level != LCB_LUV_YOLOG_LEVEL_UNSET) {
        if (output->level <= level) {
            return 1;
        }
    }
    return 0;
}



static int
ctx_can_log(lcb_luv_yolog_context *ctx,
            int level,
            struct lcb_luv_yolog_output_st *outputs[LCB_LUV_YOLOG_OUTPUT_COUNT+1])
{
    int ii;
    outputs[LCB_LUV_YOLOG_OUTPUT_GFILE] = &ctx->parent->o_file;
    outputs[LCB_LUV_YOLOG_OUTPUT_SCREEN] = &ctx->parent->o_screen;
    outputs[LCB_LUV_YOLOG_OUTPUT_PFILE] = ctx->o_alt;

    if (ctx->level != LCB_LUV_YOLOG_LEVEL_UNSET && ctx->level > ctx->level) {
        return 0;
    }

    for (ii = 0; ii < LCB_LUV_YOLOG_OUTPUT_COUNT; ii++) {
        if (output_can_log(ctx, level, ii, outputs[ii])) {
            return 1;
        }
    }
    return 0;
}


static void
lcb_luv_yolog_get_formats(struct lcb_luv_yolog_output_st *output,
                  int level,
                  struct lcb_luv_yolog_msginfo_st *colors)
{
    if (output->use_color) {

        colors->co_title = "\033[" _INTENSE_FG _MAGENTA "m";
        colors->co_reset = "\033[0m";

        switch(level) {

        case LCB_LUV_YOLOG_CRIT:
        case LCB_LUV_YOLOG_ERROR:
            colors->co_line = "\033[" _BRIGHT_FG ";" _FG _RED "m";
            break;

        case LCB_LUV_YOLOG_WARN:
            colors->co_line = "\033[" _FG _YELLOW "m";
            break;

        case LCB_LUV_YOLOG_DEBUG:
        case LCB_LUV_YOLOG_TRACE:
        case LCB_LUV_YOLOG_STATE:
        case LCB_LUV_YOLOG_RANT:
            colors->co_line = "\033[" _DIM_FG ";" _FG _CYAN "m";
            break;
        default:
            colors->co_line = "";
            break;
        }
    } else {
        colors->co_line = "";
        colors->co_title = "";
        colors->co_reset = "";
    }
}

#define CAN_LOG(lvl, ctx) \
    (level >= ctx->level)

void
lcb_luv_yolog_vlogger(lcb_luv_yolog_context *ctx,
              lcb_luv_yolog_level_t level,
              const char *file,
              int line,
              const char *fn,
              const char *fmt,
              va_list ap)
{
    struct lcb_luv_yolog_msginfo_st msginfo;
    const char *prefix;
    int ii;
    struct lcb_luv_yolog_output_st *outputs[LCB_LUV_YOLOG_OUTPUT_COUNT];

    if (!ctx) {
        ctx = &Yolog_Global_Context;
    }

    if (!ctx_can_log(ctx, level, outputs)) {
        return;
    }

    prefix = ctx->prefix;
    if (prefix == NULL || *prefix == '\0') {
        prefix = "-";
    }

    if (ctx->parent->cb) {
        ctx->parent->cb(ctx, level, ap);
    }

    msginfo.m_file = file;
    msginfo.m_level = level;
    msginfo.m_line = line;
    msginfo.m_prefix = prefix;
    msginfo.m_func = fn;

    for (ii = 0; ii < LCB_LUV_YOLOG_OUTPUT_COUNT; ii++) {
        struct lcb_luv_yolog_output_st *out = outputs[ii];
        FILE *fp;
        struct lcb_luv_yolog_fmt_st *fmtv;

        if (!output_can_log(ctx, level, ii,  out)) {
            continue;
        }

        fmtv = out->fmtv;
        fp = out->fp;

        lcb_luv_yolog_get_formats(out, level, &msginfo);

        lcb_luv_yolog_dest_lock(out);

#ifndef va_copy
#define LCB_LUV_YOLOG_VACOPY_OVERRIDE
#ifdef __GNUC__
#define va_copy __va_copy
#else
#define va_copy(dst, src) (dst) = (src)
#endif /* __GNUC__ */
#endif

        lcb_luv_yolog_fmt_write(fmtv, fp, &msginfo);
        {
            va_list vacp;
            va_copy(vacp, ap);
            vfprintf(fp, fmt, vacp);
            va_end(vacp);
        }
        fprintf(fp, "%s\n", msginfo.co_reset);
        fflush(fp);
        lcb_luv_yolog_dest_unlock(out);
    }
#ifdef LCB_LUV_YOLOG_VACOPY_OVERRIDE
#undef va_copy
#undef LCB_LUV_YOLOG_VACOPY_OVERRIDE
#endif
}

void
lcb_luv_yolog_logger(lcb_luv_yolog_context *ctx,
             lcb_luv_yolog_level_t level,
             const char *file,
             int line,
             const char *fn,
             const char *fmt,
             ...)
{
    va_list ap;
    va_start(ap, fmt);
    lcb_luv_yolog_vlogger(ctx, level, file, line, fn, fmt, ap);
    va_end(ap);
}

int
lcb_luv_yolog_implicit_begin(lcb_luv_yolog_context *ctx,
                     int level,
                     const char *file,
                     int line,
                     const char *fn)
{
    struct lcb_luv_yolog_output_st *outputs[LCB_LUV_YOLOG_OUTPUT_COUNT];
    if (!ctx) {
        ctx = &Yolog_Global_Context;
    }

    if (!ctx_can_log(ctx, level, outputs)) {
        return 0;
    }

    lcb_luv_yolog_global_lock();

    Yolog_Implicit.ctx = ctx;
    Yolog_Implicit.level = level;
    Yolog_Implicit.m_file = file;
    Yolog_Implicit.m_line = line;
    Yolog_Implicit.m_func = fn;
    return 1;
}

void
lcb_luv_yolog_implicit_end(void)
{
    lcb_luv_yolog_global_unlock();
}

void
lcb_luv_yolog_implicit_logger(const char *fmt, ...)
{
    va_list ap;
    va_start(ap, fmt);
    lcb_luv_yolog_vlogger(Yolog_Implicit.ctx,
                  Yolog_Implicit.level,
                  Yolog_Implicit.m_file,
                  Yolog_Implicit.m_line,
                  Yolog_Implicit.m_func,
                  fmt,
                  ap);

    va_end(ap);
}

lcb_luv_yolog_context *
lcb_luv_yolog_get_global(void) {
    return &Yolog_Global_Context;
}


LCB_LUV_YOLOG_API
void
lcb_luv_yolog_set_screen_format(lcb_luv_yolog_context_group *grp,
                        const char *format)
{
    if (!grp) {
        grp = &Yolog_Global_CtxGroup;
    }

    lcb_luv_yolog_set_fmtstr(&grp->o_screen, format, 1);
}
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>

#ifdef __unix__
#include <unistd.h>
#include <pthread.h>
#include <sys/types.h>

#ifdef __linux__
#include <sys/syscall.h>
/**
 * Linux can get the thread ID,
 * but glibc says it doesn't provide a wrapper for gettid()
 **/

#ifndef _GNU_SOURCE
/* if _GNU_SOURCE was defined on the commandline, then we should already have
 * a prototype
 */

int syscall(int, ...);
#endif
#define lcb_luv_yolog_fprintf_thread(f) fprintf(f, "%d", syscall(SYS_gettid))

#else /* other POSIX non-linux systems */
static void
lcb_luv_yolog_fprintf_thread(FILE *f) {
    pthread_t pt = pthread_self();
    unsigned char *ptc = (unsigned char*)(void*)(&pt);
    size_t ii;
    fprintf(f, "0x");

    for (ii = 0; ii < sizeof(pt); ii++) {
        fprintf(f, "%02x", (unsigned)(ptc[ii]));
    }
}
#endif /* __linux__ */


#define lcb_luv_yolog_get_pid getpid

#else
#define lcb_luv_yolog_fprintf_thread(f)
#define lcb_luv_yolog_get_pid() -1

#endif /* __unix__ */


#include "lcb_luv_yolog.h"

static
const char *
lcb_luv_yolog_strlevel(lcb_luv_yolog_level_t level)
{
    if (!level) {
        return "";
    }

#define X(n, i) \
    if (level == i) { return #n; }
    LCB_LUV_YOLOG_XLVL(X)
#undef X
    return "";
}

LCB_LUV_YOLOG_API
struct lcb_luv_yolog_fmt_st *
lcb_luv_yolog_fmt_compile(const char *fmtstr)
{
    const char *fmtp = fmtstr;
    struct lcb_luv_yolog_fmt_st *fmtroot, *fmtcur;
    size_t n_alloc = sizeof(*fmtroot) * 16;
    size_t n_used = 0;
    size_t nstr = 0;

    fmtroot = malloc(n_alloc);
    fmtcur = fmtroot;

    memset(fmtcur, 0, sizeof(*fmtcur));

    /* first format is a leading user string */
    fmtcur->type = LCB_LUV_YOLOG_FMT_USTRING;
    while (fmtp && *fmtp && *fmtp != '%' && fmtp[1] == '(') {
        fmtcur->ustr[nstr] = *fmtp;
        nstr++;
        fmtp++;
        if (nstr > sizeof(fmtcur->ustr)-1) {
            goto GT_ERROR;
        }
    }

    fmtcur->ustr[nstr] = '\0';

    while (*fmtp) {
        char optbuf[128] = { 0 };
        size_t optpos = 0;

        if ( !(*fmtp == '%' && fmtp[1] == '(')) {
            fmtcur->ustr[nstr] = *fmtp;
            nstr++;
            if (nstr > sizeof(fmtcur->ustr)-1) {
                goto GT_ERROR;
            }

            fmtcur->ustr[nstr] = '\0';
            fmtp++;
            continue;
        }

        fmtp+= 2;

        while (*fmtp && *fmtp != ')') {
            optbuf[optpos] = *fmtp;
            optpos++;
            fmtp++;
        }

        /**
         * We've pushed trailing data into the current format structure. Time
         * to create a new one
         */

        n_used++;
        nstr = 0;

        if ( (n_used+1) > (n_alloc / sizeof(*fmtcur))) {
            n_alloc *= 2;
            fmtroot = realloc(fmtroot, n_alloc);
        }

        fmtcur = fmtroot + n_used;
        memset(fmtcur, 0, sizeof(*fmtcur));


    #define _cmpopt(s) (strncmp(optbuf, s, \
                        optpos > (sizeof(s)-1) \
                        ? sizeof(s) - 1 : optpos ) \
                        == 0)

        if (_cmpopt("ep")) {
            /* epoch */
            fmtcur->type = LCB_LUV_YOLOG_FMT_EPOCH;

        } else if (_cmpopt("pi")) {
            /* pid */
            fmtcur->type = LCB_LUV_YOLOG_FMT_PID;

        } else if (_cmpopt("ti")) {
            /* tid */
            fmtcur->type = LCB_LUV_YOLOG_FMT_TID;

        } else if (_cmpopt("le")) {
            /* level */
            fmtcur->type = LCB_LUV_YOLOG_FMT_LVL;

        } else if (_cmpopt("pr")) {
            /* prefix */
            fmtcur->type = LCB_LUV_YOLOG_FMT_TITLE;

        } else if (_cmpopt("fi")) {
            /* filename */
            fmtcur->type = LCB_LUV_YOLOG_FMT_FILENAME;

        } else if (_cmpopt("li")) {
            /* line */
            fmtcur->type = LCB_LUV_YOLOG_FMT_LINE;

        } else if (_cmpopt("fu")) {
            /* function */
            fmtcur->type = LCB_LUV_YOLOG_FMT_FUNC;

        } else if (_cmpopt("co")) {
            /* color */
            fmtcur->type = LCB_LUV_YOLOG_FMT_COLOR;
        } else {
            goto GT_ERROR;
        }

        fmtp++;
    }
    #undef _cmpopt

    fmtroot[n_used+1].type = LCB_LUV_YOLOG_FMT_LISTEND;
    return fmtroot;

    GT_ERROR:
    free (fmtroot);
    return NULL;
}


void
lcb_luv_yolog_fmt_write(struct lcb_luv_yolog_fmt_st *fmts,
                FILE *fp,
                const struct lcb_luv_yolog_msginfo_st *minfo)
{
    struct lcb_luv_yolog_fmt_st *fmtcur = fmts;

    while (fmtcur->type != LCB_LUV_YOLOG_FMT_LISTEND) {
        switch (fmtcur->type) {
        case LCB_LUV_YOLOG_FMT_USTRING:
            fprintf(fp, "%s", fmtcur->ustr);
            goto GT_NOUSTR;
            break;

        case LCB_LUV_YOLOG_FMT_EPOCH:
            fprintf(fp, "%d", (int)time(NULL));
            break;

        case LCB_LUV_YOLOG_FMT_PID:
            fprintf(fp, "%d", lcb_luv_yolog_get_pid());
            break;

        case LCB_LUV_YOLOG_FMT_TID:
            lcb_luv_yolog_fprintf_thread(fp);
            break;

        case LCB_LUV_YOLOG_FMT_LVL:
            fprintf(fp, "%s", lcb_luv_yolog_strlevel(minfo->m_level));
            break;

        case LCB_LUV_YOLOG_FMT_TITLE:
            fprintf(fp, "%s%s%s",
                    minfo->co_title, minfo->m_prefix, minfo->co_reset);
            break;

        case LCB_LUV_YOLOG_FMT_FILENAME:
            fprintf(fp, "%s", minfo->m_file);
            break;

        case LCB_LUV_YOLOG_FMT_LINE:
            fprintf(fp, "%d", minfo->m_line);
            break;

        case LCB_LUV_YOLOG_FMT_FUNC:
            fprintf(fp, "%s", minfo->m_func);
            break;

        case LCB_LUV_YOLOG_FMT_COLOR:
            fprintf(fp, "%s", minfo->co_line);
            break;

        default:
            break;
        }

        if (fmtcur->ustr[0]) {
            fprintf(fp, "%s", fmtcur->ustr);
        }

        GT_NOUSTR:
        fmtcur++;
        continue;
    }
}

int
lcb_luv_yolog_set_fmtstr(struct lcb_luv_yolog_output_st *output,
                 const char *fmt,
                 int replace)
{
    struct lcb_luv_yolog_fmt_st *newfmt;

    if (output->fmtv && replace == 0) {
        return -1;
    }

    newfmt = lcb_luv_yolog_fmt_compile(fmt);
    if (!newfmt) {
        return -1;
    }

    if (output->fmtv) {
        free (output->fmtv);
    }
    output->fmtv = newfmt;
    return 0;
}
#ifndef APESQ_H_
#define APESQ_H_


/**
 * Apachesque is a configuration parsing library which can handle apache-style
 * configs. It can probably also handle more.
 *
 * Configuration is parsed into a tree which is comprised of three components
 *
 * 1) Entry.
 *      This is the major component, it has a 'key' which is the 'name' under
 *      which it may be found. Entries contain values
 *
 * 3) Value.
 *      This contains application-level data which is provided as a string
 *      value to a 'Key'. Values may be boolean or string. Functions can
 *      try to coerce values on-demand.
 *
 * 2) Section.
 *      This is a type of value which itself may contain multiple entries,
 *      in a configuration file this looks like
 *
 *      <SectionType SectionName1, SectionName2>
 *          ....
 *      </SectionType>
 *
 *      Particular about APQE is that sections can have multiple names, so
 *      things may be aliased/indexed/whatever.
 */

/**
 * Enumeration of types, used largely internally
 */
enum apesq_type {
    APESQ_T_STRING,
    APESQ_T_INT,
    APESQ_T_DOUBLE,
    APESQ_T_BOOL,
    APESQ_T_SECTION,
    APESQ_T_LIST
};

/**
 * Return values for read_value()
 */
enum {
    APESQ_VALUE_OK = 0,
    APESQ_VALUE_EINVAL,
    APESQ_VALUE_ENOENT,
    APESQ_VALUE_ECONVERSION,
    APESQ_VALUE_EISPLURAL
};

/**
 * Flags for read_value()
 */
enum {
    APESQ_F_VALUE = 0x1,
    APESQ_F_MULTIOK = 0x2
};

#ifndef APESQ_API
#define APESQ_API
#endif

struct apesq_entry_st;
struct apesq_section_st {
    /* section type */
    char *sectype;

    /* section name(s) */
    char **secnames;

    /* linked list of entries */
    struct apesq_entry_st *e_head;
    struct apesq_entry_st *e_tail;
};

struct apesq_value_st;
struct apesq_value_st {
    /* value type */
    enum apesq_type type;
    struct apesq_value_st *next;

    /* string data, not valid for booleans */
    char *strdata;
    union {
        int num;
        struct apesq_section_st *section;
    } u;
};

struct apesq_entry_st {
    struct apesq_entry_st *next;
    struct apesq_entry_st *parent;
    char *key;
    struct apesq_value_st value;
    /**
     * user pointer, useful for things like checking if the application
     * has traversed this entry yet
     */
    void *user;
};

/**
 * Macro to extract the section from an entry
 */
#define APESQ_SECTION(ent) \
    ((ent)->value.u.section)

/**
 * Parse a string. Returns the root entry on sucess, or NULL on error.
 * @param str the string to parse. This string *will* be modified, so copy it
 * if you care.
 *
 * @param nstr length of the string, or -1 to have strlen called on it. (non-NUL
 * terminated strings are not supported here anyway, so this should
 */
APESQ_API
struct apesq_entry_st *
apesq_parse_string(char *str, int nstr);

/* wrapper around parse_string */
APESQ_API
struct apesq_entry_st *
apesq_parse_file(const char *path);

/**
 * Frees a configuration tree
 */
APESQ_API
void
apesq_free(struct apesq_entry_st *root);

/**
 * Get a list of sections of the given type
 * @param root the root entry (which should be of T_SECTION)
 * @param name the name of the section type
 *
 * @return a null-terminated array of pointers to T_SECTION entries
 */
APESQ_API
struct apesq_entry_st **
apesq_get_sections(struct apesq_entry_st *root, const char *name);


/**
 * Get a list of values for the key. A key can have more than a single value
 * attached to it; in this case, subsequent values may be accessed using the
 * ->next pointer
 *
 * @param section the section (see APESQ_SECTION)
 * @param key the key for which to read the values
 */
APESQ_API
struct apesq_value_st *
apesq_get_values(struct apesq_section_st *section, const char *key);

/**
 * This will read and possibly coerce a single value to the requested type
 * @param section the section
 *
 * @param param - lookup. This is dependent on the flags. If flags is 0
 * or does not contain F_VALUE, then this is a string with which to look up
 * the entry. If flags & F_VALUE then this is apesq_value_st pointer.
 *
 * @param type - The type into which to coerce
 *
 * @param flags can be a bitwise-OR'd combination of F_VALUE and F_MULTIOK,
 *  the latter of which implies that trailing values are not an error
 *
 * @param out - a pointer to the result. This is dependent on the type requested:
 *      T_INT: int*
 *      T_DOUBLE: double*
 *      T_BOOL: int*
 *
 * @return A status code (APESQ_VALUE_*), should be 'OK' if the conversion
 * was successful, or an error otherwise.
 */
APESQ_API
int
apesq_read_value(struct apesq_section_st *section,
                 const void *param,
                 enum apesq_type type,
                 int flags,
                 void *out);

/**
 * Dump a tree repres
 */
APESQ_API
void
apesq_dump_section(struct apesq_entry_st *root, int indent);

#endif /* APESQ_H_ */
#ifndef APESQ_NO_INCLUDE
#include "apesq.h"
#endif /* APESQ_NO_INCLUDE */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <assert.h>

/* LONG_MAX for strtol */
#include <limits.h>

/* HUGE_VAL for strtod */
#include <math.h>

struct token_st;

struct token_st {
    struct token_st *next;
    char delim_end;
    char *str;
    int len;
};

static int
shift_string(char *str, int nshift)
{
    memmove(str, str + nshift, strlen(str)-(nshift-1));
    return strlen(str);
}

static char *
apesq__strdup(char *src)
{
    char *dest = calloc(1, strlen(src) + 1);
    strcpy(dest, src);
    return dest;
}

static int
apesq__strcasecmp(char *a, char *b)
{
    while (*(a++) && *(b++)) {
        if (tolower(*a) != tolower(*b)) {
            return 1;
        }
    }

    return !(*a == *b);
}

static struct token_st *
get_tokens(char *line)
{
    struct token_st *root;
    struct token_st *cur;

    int in_quote = 0;
    int in_delim = 0;

    char *lcopy = apesq__strdup(line);
    char *p = lcopy;
    char *last_tok_begin = p;

    root = malloc(sizeof(*root));
    root->str = apesq__strdup(p);
    root->next = NULL;
    cur = root;

    for (; *p; p++) {
        if (in_delim) {
            if (isspace(*p) == 0 && *p != '=' && *p != ',') {
                /* end of delimiter */
                last_tok_begin = p;
                in_delim = 0;
                cur->next = calloc(1, sizeof(*cur->next));
                cur = cur->next;
            } else {
                continue;
            }
        }

        if (*p == '"' || *p == '\'') {
            if (!in_quote) {
                /* string, ignore everything until the next '"' */
                in_quote = *p;
                shift_string(p, 1);
            } else if (in_quote == *p) {
                /* string end */
                in_quote = 0;
                shift_string(p, 1);
            }
        }

        if (in_quote) {
            /* ignore string data */
            continue;
        }

        /* not a string and not in middle of a delimiter. end current token */
        if (isspace(*p) || *p == ',' || *p == '=') {

            size_t toklen = p - last_tok_begin;
            assert (in_delim == 0);

            if (cur->str) {
                free(cur->str);
            }

            cur->str = malloc(toklen + 1);
            cur->delim_end = *p;
            cur->len = toklen;

            memcpy(cur->str, last_tok_begin, toklen);
            cur->str[toklen] = '\0';
            in_delim = 1;
        }
    }

    if (cur == root) {
        cur->len = strlen(cur->str);
    } else {
        cur->len = strlen(last_tok_begin);

        if (cur->str) {
            free(cur->str);
        }

        cur->str = malloc(cur->len+1);
        strcpy(cur->str, last_tok_begin);
    }

    free(lcopy);
    return root;
}

static void
free_tokens(struct token_st *root)
{
    while (root) {
        struct token_st *next;

        if (root->str) {
            free (root->str);
        }

        next = root->next;
        free(root);

        root = next;
    }
}

static struct apesq_entry_st *
append_new_entry(struct apesq_entry_st *parent)
{
    struct apesq_section_st *section;
    struct apesq_entry_st *ret = calloc(1, sizeof(*ret));

    assert (parent->value.next == NULL);
    assert (parent->value.type == APESQ_T_SECTION);
    section =  parent->value.u.section;

    if (!section->e_tail) {
        assert (section->e_head == NULL);
        section->e_head = ret;
        section->e_tail= ret;

    } else {
        section->e_tail->next = ret;
        section->e_tail = ret;
    }

    ret->parent = parent;
    return ret;
}

static int
get_section_names(
        struct apesq_section_st *section,
        struct token_st *toknames)
{
    int snames_count = 0;
    char **secnames;
    char **secnamep;
    struct token_st *tmp = toknames;

    while (tmp) {
        snames_count++;
        tmp = tmp->next;
    }

    secnames = calloc(snames_count + 1, sizeof(char*));
    secnamep = secnames;

    while (toknames) {
        if (!toknames->next) {
            if (toknames->str[toknames->len-1] != '>') {
                return -1;

            } else {
                toknames->str[toknames->len-1] = '\0';
            }
        }

        *secnamep = toknames->str;
        secnamep++;

        toknames->str = NULL;
        toknames = toknames->next;
    }

    section->secnames = secnames;

    return 0;
}

static struct apesq_entry_st *
create_new_section(struct apesq_entry_st *parent,
                   struct token_st *tokens)
{
    struct apesq_entry_st *new_ent = append_new_entry(parent);
    struct apesq_section_st *new_section = calloc(1, sizeof(*new_section));
    struct token_st *cur = tokens;
    char *sectype;

    new_ent->value.type = APESQ_T_SECTION;
    new_ent->value.u.section = new_section;

    sectype = calloc(1, cur->len + 1);
    new_section->sectype = sectype;

    strcpy(sectype, cur->str);
    if (sectype[cur->len-1] == '>') {
        sectype[cur->len-1] = '\0';
        cur->len--;

    } else {
        get_section_names(new_section, cur->next);
    }

    new_section->sectype = sectype;
    new_ent->key = apesq__strdup(sectype);
    return new_ent;
}

static int
parse_line(char *line,
           struct apesq_entry_st **sec_ent,
           char **errorp)
{
    struct token_st *tokens = get_tokens(line);
    struct token_st *cur = tokens, *last;
    struct apesq_section_st *sec = (*sec_ent)->value.u.section;
    struct apesq_entry_st *new_ent;
    int ret = 1;

    last = tokens;
    while (last->next) {
        last = last->next;
    }

#define LINE_ERROR(s) \
    *errorp = s; \
    ret = 0; \
    goto GT_RET;

    if (cur->str[0] == '<') {
        char begin_chars[2];
        begin_chars[0] = cur->str[0];
        begin_chars[1] = cur->str[1];

        if (begin_chars[1] == '/') {
            cur->len = shift_string(cur->str, 2);
        } else {
            cur->len = shift_string(cur->str, 1);
        }

        if (last->str[last->len-1] != '>') {
            LINE_ERROR("Section statement does not end with '>'");
        }

        if (cur->len < 3) {
            LINE_ERROR("Section name too short");
        }

        if (begin_chars[1] == '/') {
            if (cur->str[cur->len-1] != '>') {
                LINE_ERROR("Garbage at closing tag");
            }

            cur->str[cur->len-1] = '\0';
            cur->len--;

            if (!sec->sectype || strcmp(sec->sectype, cur->str) != 0) {
                LINE_ERROR("Closing tag name does not match opening");
            }

            *sec_ent = (*sec_ent)->parent;
            goto GT_RET;
        } else {
            *sec_ent = create_new_section(*sec_ent, tokens);
            goto GT_RET;
        }
    }

    /**
     * Otherwise, key-value pairs
     */

    new_ent = append_new_entry(*sec_ent);
    if (cur->str[0] == '-' || cur->str[0] == '+') {
        char bval = cur->str[0];
        struct apesq_value_st *value = &new_ent->value;
        memmove(cur->str, cur->str + 1, cur->len);

        value->type = APESQ_T_BOOL;
        value->u.num = (bval == '-') ? 0 : 1;
        new_ent->key = cur->str;
        cur->str = NULL;

        if (cur->next) {
            LINE_ERROR("Boolean options cannot be lists");
        }

    } else {
        /* no-boolean, key with possible multi-value pairs */

        struct apesq_value_st *value = &new_ent->value;
        new_ent->key = cur->str;
        cur->str = NULL;
        cur = cur->next;

        if (!cur) {
            LINE_ERROR("Lone token is invalid");
        }

        value->type = APESQ_T_STRING;
        value->strdata = cur->str;
        cur->str = NULL;

        cur = cur->next;
        while (cur) {
            value->next = calloc(1, sizeof(*value));
            value = value->next;

            value->type = APESQ_T_STRING;
            value->strdata = cur->str;
            cur->str = NULL;

            cur = cur->next;
        }
    }

    GT_RET:
    free_tokens(tokens);
    return ret;

#undef LINE_ERROR
}

APESQ_API
struct apesq_entry_st *
apesq_parse_string(char *str, int nstr)
{
    char *p, *end, *line;
    struct apesq_entry_st *root, *cur;

    if (nstr == -1) {
        nstr = strlen(str) + 1;
    }

    end =  str + nstr;
    root = calloc(1, sizeof(*root));
    root->parent = NULL;

    root->value.type = APESQ_T_SECTION;
    root->value.u.section = calloc(1, sizeof(struct apesq_section_st));

    root->value.u.section->sectype = apesq__strdup("!ROOT!");
    root->key = apesq__strdup("!ROOT!");

    p = str;
    cur = root;


    while (*p) {
        char *errp = NULL;
        char *line_end;

        line = p;

        for (; p < end && *p != '\n'; p++);
        *p = '\0';
        line_end = p-1;

        /* strip leading whitespace */
        for (; line < p && isspace(*line); line++);

        /* strip trailing whitespace */
        while (line_end > line && isspace(*line_end)) {
            *line_end = '\0';
            line_end--;
        }

        /* pointer to the beginning of the next line */
        p++;


        if (*line == '#' || line == p-1) {
            continue;
        }

        if (!parse_line(line, &cur, &errp)) {
            if (errp) {
                printf("Got error while parsing '%s': %s\n", line, errp);
            } else {
                printf("Parsing done!\n");
            }

            break;
        }
    }
    return root;
}

APESQ_API
struct apesq_entry_st *
apesq_parse_file(const char *path)
{
    FILE *fp;
    int fsz;
    char *buf;
    struct apesq_entry_st *ret;

    if (!path) {
        return NULL;
    }
    fp = fopen(path, "r");
    if (!fp) {
        return NULL;
    }

    fseek(fp, 0L, SEEK_END);
    fsz = ftell(fp);
    if (fsz < 1) {
        fclose(fp);
        return NULL;
    }

    fseek(fp, 0L, SEEK_SET);
    buf = malloc(fsz+1);
    buf[fsz] = '\0';

    if (fread(buf, 1, fsz, fp) == -1) {
        fclose(fp);
        return NULL;
    }
    fclose(fp);

    ret = apesq_parse_string(buf, fsz);
    free(buf);
    return ret;
}

APESQ_API
void
apesq_dump_section(struct apesq_entry_st *root, int indent)
{
    struct apesq_section_st *section = root->value.u.section;
    struct apesq_entry_st *ent;
    int ii;
    char s_indent[64] = { 0 };


    assert (root->value.next == NULL);
    assert (root->value.type == APESQ_T_SECTION);


    for (ii = 0; ii < indent * 3; ii++) {
        s_indent[ii] = ' ';
    }

    printf("%sSection Type(%s), ", s_indent, section->sectype);

    if (section->secnames) {
        char **namep = section->secnames;
        while (*namep) {
            printf("Name: %s, ", *namep);
            namep++;
        }
    }
    printf("\n");

    ent = section->e_head;
    while (ent) {
        struct apesq_value_st *value = &ent->value;

        printf("%s Key(%s): ", s_indent, ent->key);

        if (ent->value.type == APESQ_T_SECTION) {
            printf("\n");
            apesq_dump_section(ent, indent + 1);
            goto GT_CONT;
        }

        while (value) {
            assert (value->next != value);

            if (value->type == APESQ_T_BOOL) {
                printf("Boolean(%d) ", value->u.num);
            } else {
                printf("String(\"%s\") ", value->strdata);
            }
            value = value->next;
        }

        printf("\n");

        GT_CONT:
        ent = ent->next;
    }
}

APESQ_API
void
apesq_free(struct apesq_entry_st *root)
{
    struct apesq_section_st *section = root->value.u.section;
    struct apesq_entry_st *ent = section->e_head;

    while (ent) {

        struct apesq_entry_st *e_next = ent->next;
        struct apesq_value_st *value = &ent->value;

        while (value) {
            struct apesq_value_st *v_next = value->next;

            if (value->type == APESQ_T_SECTION) {
                apesq_free(ent);
                goto GT_NEXT_ENT;

            } else {

                if (value->strdata) {
                    free (value->strdata);
                    value->strdata = NULL;
                }

                if (value != &ent->value) {
                    free(value);
                }
            }

            value = v_next;
        }
        if (ent->key) {
            free (ent->key);
        }
        free (ent);

        GT_NEXT_ENT:
        ent = e_next;
    }

    if (section->sectype) {
        free (section->sectype);
    }

    if (section->secnames) {
        char **namep = section->secnames;
        while (*namep) {
            free (*namep);
            namep++;
        }
        free (section->secnames);
    }
    free (section);

    if (root->key) {
        free (root->key);
    }

    free (root);
}

/**
 * Retrieve a specific section, or class of sections
 * returns a null-terminated array of pointers to entries with sections:
 *
 * e.g.
 * apesq_find_section(root, "/Subsys")
 */

APESQ_API
struct apesq_entry_st **
apesq_get_sections(struct apesq_entry_st *root, const char *name)
{
    struct apesq_entry_st **ret;
    struct apesq_section_st *section = APESQ_SECTION(root);
    struct apesq_entry_st *ent;
    struct apesq_entry_st **p_ret;

    int ret_count = 0;
    assert (root->value.type == APESQ_T_SECTION);

    ent = section->e_head;

    for (ent = section->e_head; ent; ent = ent->next) {
        if (ent->value.type != APESQ_T_SECTION ||
                strcmp(APESQ_SECTION(ent)->sectype, name) != 0) {
            continue;
        }
        ret_count++;
    }

    if (!ret_count) {
        return NULL;
    }

    ret = calloc(ret_count + 1, sizeof(*ret));
    p_ret = ret;

    for (ent = section->e_head; ent; ent = ent->next) {
        if (ent->value.type != APESQ_T_SECTION ||
                strcmp(APESQ_SECTION(ent)->sectype, name) != 0) {
            continue;
        }
        *(p_ret++) = ent;
    }
    return ret;
}

APESQ_API
struct apesq_value_st *
apesq_get_values(struct apesq_section_st *section, const char *key)
{
    struct apesq_entry_st *ent = section->e_head;

    while (ent) {
        if (ent->key && strcmp(key, ent->key) == 0) {
            return &ent->value;
        }
        ent = ent->next;
    }

    return NULL;
}

APESQ_API
int
apesq_read_value(struct apesq_section_st *section,
                 const void *param,
                 enum apesq_type type,
                 int flags,
                 void *out)
{
    const struct apesq_value_st *value;
    if (flags & APESQ_F_VALUE) {
        value = (const struct apesq_value_st*)param;
    } else {
        value = apesq_get_values(section, (const char*)param);
    }

    if (!value) {
        return APESQ_VALUE_ENOENT;
    }

    if (value->next && (flags & APESQ_F_MULTIOK) == 0) {
        return APESQ_VALUE_EISPLURAL;
    }

    if (type == APESQ_T_BOOL) {
        if (value->type == APESQ_T_BOOL) {
            *(int*)out = value->u.num;
            return APESQ_VALUE_OK;
        } else {
            if (apesq__strcasecmp("on", value->strdata) == 0) {
                *(int*)out = 1;
                return APESQ_VALUE_OK;
            } else if (apesq__strcasecmp("off", value->strdata) == 0) {
                *(int*)out = 0;
                return APESQ_VALUE_OK;
            } else {
                /* try numeric conversion */
                return apesq_read_value(section, param, APESQ_T_INT,
                                        flags, out);
            }
        }

    } else if (type == APESQ_T_INT) {
        char *endptr;
        long int ret = strtol(value->strdata, &endptr, 10);

        /*stupid editor */
        if (ret == LONG_MAX || *endptr != '\0') {
            return APESQ_VALUE_ECONVERSION;
        }

        *(int*)out = ret;
        return APESQ_VALUE_OK;
    } else if (type == APESQ_T_DOUBLE) {
        char *endptr;
        double ret = strtod(value->strdata, &endptr);
        if (ret == HUGE_VAL || *endptr != '\0') {
            return APESQ_VALUE_ECONVERSION;
        }
        *(double*)out = ret;
        return APESQ_VALUE_OK;
    }
    return APESQ_VALUE_EINVAL;
}
#include "lcb_luv_yolog.h"
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <assert.h>
#include <time.h>

#ifdef __unix__
#include <strings.h>
#else
#define strcasecmp _stricmp
#endif

#ifndef ATTR_UNUSED
#ifdef __GNUC__
#define ATTR_UNUSED __attribute__((unused))
#else
#define ATTR_UNUSED
#endif
#endif

#ifndef GENYL_APESQ_INLINED

#ifdef LCB_LUV_YOLOG_APESQ_STATIC

#define APESQ_API static ATTR_UNUSED
#include "apesq/apesq.c"

#else
#include <apesq.h>

#endif /* LCB_LUV_YOLOG_APESQ_STATIC */

#else
#endif /* GENYL_APESQ_INLINED */

static lcb_luv_yolog_context *
lcb_luv_yolog_context_by_name(lcb_luv_yolog_context *contexts,
                      int ncontexts,
                      const char *name)
{
    int ii = 0;
    for (ii = 0; ii < ncontexts; ii++) {
        if (strcasecmp(contexts[ii].prefix, name) == 0 ) {
            return contexts + ii;
        }
    }
    return NULL;
}

static int
lcb_luv_yolog_level_by_name(const char *lvlstr)
{
#define X(b,v) if (strcasecmp(lvlstr, #b) == 0) { return v; }
    LCB_LUV_YOLOG_XLVL(X);
#undef X

    return -1;

}


void
lcb_luv_yolog_sync_levels(lcb_luv_yolog_context *ctx)
{
    int ii;
    int minlevel = 0xff;
    for (ii = 0; ii < LCB_LUV_YOLOG_OUTPUT_COUNT; ii++) {
        if (ctx->olevels[ii] < minlevel) {
            minlevel = ctx->olevels[ii];
        }
    }
    if (minlevel != 0xff) {
        ctx->level = minlevel;
    }
}

/**
 * Try and configure logging preferences from the environment, this only
 * affects subsystems and doesn't modify things like format strings or color
 * preferences (which are specified in other environment variables).
 *
 * The format of the environment string should be like:
 *
 * MYPROJ_DEBUG="subsys1:error,subsys2:warn"
 */
LCB_LUV_YOLOG_API
void
lcb_luv_yolog_parse_envstr(lcb_luv_yolog_context_group *grp,
                const char *envstr)
{
    char *cp = malloc(strlen(envstr)+2);
    char *p = cp;
    int slen;

    strcpy(cp, envstr);
    slen = strlen(cp);

    if (cp[slen-1] != ',') {
        cp[slen] = ',';
        cp[slen+1] = '\0';
    }

    if (!grp) {
        grp = lcb_luv_yolog_get_global()->parent;
    }

    do {
        int minlvl;
        struct lcb_luv_yolog_context *ctx;

        char *subsys = p;
        char *level = strchr(subsys, ':');

        if (!level) {
            fprintf(stderr,
                    "Yolog: Couldn't find ':' in environment string (%s)\n",
                    subsys);
            break;
        }

        *level = '\0';
        level++;

        p = strchr(level, ',');
        if (p) {
            *p = '\0';
            p++;
        }

        ctx = lcb_luv_yolog_context_by_name(grp->contexts, grp->ncontexts, subsys);

        if (!ctx) {
            fprintf(stderr, "Yolog: Unrecognized subsystem '%s'\n",
                    subsys);
            goto GT_NEXT;
        }

        minlvl = lcb_luv_yolog_level_by_name(level);
        if (minlvl == -1) {
            fprintf(stderr, "Yolog: Bad level specified '%s'\n", level);
            goto GT_NEXT;
        }

        ctx->olevels[LCB_LUV_YOLOG_OUTPUT_SCREEN] = minlvl;
        lcb_luv_yolog_sync_levels(ctx);
        printf("Setting %s (%d) for %s\n", level, minlvl, subsys);

        GT_NEXT:
        ;
    } while (p && *p);

    free (cp);
}

static int
get_minlevel(struct apesq_entry_st *secent)
{
    struct apesq_value_st *value = apesq_get_values(
            APESQ_SECTION(secent), "MinLevel");

    int level;
    if (!value) {
        return -1;
    }
    level = lcb_luv_yolog_level_by_name(value->strdata);
    if (level == -1) {
        fprintf(stderr, "Yolog: Unrecognized level '%s'\n",
                value->strdata);
    }
    return level;
}

struct format_info_st {
    struct lcb_luv_yolog_fmt_st *fmt;
    int used;
};

enum {
    FMI_SCREEN,
    FMI_FILE,
    FMI_DEFAULT,
    FMI_COUNT
};

static FILE *
open_new_file(const char *path, const char *mode)
{
    FILE *fp = fopen(path, mode);
    if (!fp) {
        return fp;
    }
    fprintf(fp, "--- Mark at %lu ---\n", (unsigned long)time(NULL));
    return fp;
}

static void
handle_subsys_output(
        lcb_luv_yolog_context *ctx,
        struct apesq_entry_st *ent,
        char *logroot,
        struct lcb_luv_yolog_fmt_st *fmtdef,
        int *fmtdef_used)
{
    int minlevel = -1;

    struct apesq_entry_st **current;
    struct apesq_value_st *apval;
    struct apesq_entry_st **oents = apesq_get_sections(ent, "Output");

    if (!oents) {
        return;
    }

    for (current = oents; *current; current++) {
        struct apesq_section_st *osec = APESQ_SECTION(*current);
        char **onames = osec->secnames;

        if (!onames) {
            fprintf(stderr, "Yolog: Output without target\n");
            continue;
        }

        for (; *onames; onames++) {
            int olix;

            if (strcmp(*onames, "$screen$") == 0) {
                olix = LCB_LUV_YOLOG_OUTPUT_SCREEN;

            } else if (strcmp(*onames, "$globalfile$") == 0) {
                olix = LCB_LUV_YOLOG_OUTPUT_GFILE;

            } else {
                FILE *fp;
                char *fname;
                olix = LCB_LUV_YOLOG_OUTPUT_PFILE;

                if ((*onames)[0] == '/' || *logroot == '\0') {
                    fname = *onames;
                    fp = open_new_file(*onames, "a");

                } else {
                    char fpath[16384] = { 0 };
                    assert (*logroot);

                    fname = fpath;
                    sprintf(fname, "%s/%s", logroot, *onames);
                    fp = open_new_file(fname, "a");
                }

                if (!fp) {
                    fprintf(stderr,
                            "Yolog: Couldn't open output '%s': %s\n",
                            fname,
                            strerror(errno));
                    continue;
                }

                if (ctx->o_alt != NULL) {
                    fprintf(stderr, "Yolog: Multiple output files for "
                            "subsystem '%s'\n",
                            ctx->prefix);

                    fclose(fp);
                    continue;
                }

                assert (ctx->o_alt == NULL);
                ctx->o_alt = calloc(1, sizeof(*ctx->o_alt));
                ctx->o_alt->fp = fp;

                if ( (apval = apesq_get_values(osec, "Format"))) {
                    ctx->o_alt->fmtv = lcb_luv_yolog_fmt_compile(apval->strdata);

                } else {
                    ctx->o_alt->fmtv = fmtdef;
                    *fmtdef_used = 1;
                }
            }

            /**
             * Get the minimum level for the format..
             */
            if ( (minlevel = get_minlevel(*current)) != -1) {
                ctx->olevels[olix] = minlevel;
            }

            if (olix == LCB_LUV_YOLOG_OUTPUT_PFILE) {

                if ((apval = apesq_get_values(osec, "Format"))) {
                    ctx->o_alt->fmtv = lcb_luv_yolog_fmt_compile(apval->strdata);
                }

                apesq_read_value(osec, "Color", APESQ_T_BOOL, 0,
                                 &ctx->o_alt->use_color);
            }
        }
    }
    free (oents);
}

LCB_LUV_YOLOG_API
int
lcb_luv_yolog_parse_file(lcb_luv_yolog_context_group *grp,
                 const char *filename)
{
    struct apesq_entry_st *root = apesq_parse_file(filename);
    struct apesq_value_st *apval = NULL;
    struct apesq_entry_st **secents = NULL, **cursecent = NULL;
    struct lcb_luv_yolog_fmt_st *fmtdfl = NULL;
    int fmtdfl_used = 0;
    struct apesq_section_st *secroot;

    char logroot[8192] = { 0 };
    int minlevel = -1;
    int gout_count = 0;

    if (!root) {
        return 0;
    }

    if (!grp) {
        grp = lcb_luv_yolog_get_global()->parent;
    }

    secroot = APESQ_SECTION(root);

    if ( (apval = apesq_get_values(secroot, "LogRoot"))) {
        strcat(logroot, apval->strdata);
    }

    if ((apval = apesq_get_values(secroot, "Format"))) {
        fmtdfl = lcb_luv_yolog_fmt_compile(apval->strdata);
    }

    secents = apesq_get_sections(root, "Output");

    if (!secents) {
        goto GT_NO_OUTPUTS;
    }

    for (cursecent = secents; *cursecent && gout_count < 2; cursecent++) {
        struct apesq_section_st *sec = APESQ_SECTION(*cursecent);
        struct lcb_luv_yolog_output_st *out;

        FILE *fp;

        if (!sec->secnames) {
            fprintf(stderr, "Yolog: Output section without any target");
            continue;
        }

        if (strcmp(sec->secnames[0], "$screen$") == 0) {
            fp = stderr;
            out = &grp->o_screen;

        } else {
            char destpath[16384] = { 0 };
            if (sec->secnames[0][0] == '/' || *logroot == '\0') {
                strcpy(destpath, sec->secnames[0]);
            } else {
                sprintf(destpath, "%s/%s", logroot, sec->secnames[0]);
            }
            fp = open_new_file(destpath, "a");
            if (!fp) {
                fprintf(stderr, "Yolog: Couldn't open '%s': %s\n",
                        destpath, strerror(errno));
                continue;
            }
            out = &grp->o_file;
        }

        out->fp = fp;

        if ( (apval = apesq_get_values(sec, "Format"))) {

            if (out->fmtv) {
                free(out->fmtv);
            }

            out->fmtv = lcb_luv_yolog_fmt_compile(apval->strdata);
        } else if (fmtdfl) {
            out->fmtv = fmtdfl;
            fmtdfl_used = 1;
        } else {
            if (out->fmtv) {
                free (out->fmtv);
            }
            out->fmtv = lcb_luv_yolog_fmt_compile(LCB_LUV_YOLOG_FORMAT_DEFAULT);
        }

        minlevel = get_minlevel(*cursecent);
        if (minlevel != -1) {
            out->level = minlevel;
        }

        apesq_read_value(sec, "Color", APESQ_T_BOOL, 0, &out->use_color);
        gout_count++;
    }


    free (secents);
    secents = NULL;

    GT_NO_OUTPUTS:

    secents = apesq_get_sections(root, "Subsys");
    if (!secents) {
        goto GT_NO_SUBSYS;
    }

    for (cursecent = secents; *cursecent; cursecent++) {
        struct apesq_section_st *sec = APESQ_SECTION(*cursecent);
        char **secnames = sec->secnames;

        if (!secnames) {
            fprintf(stderr, "Yolog: Subsys section without any specifier\n");
            continue;
        }

        for (; *secnames; secnames++) {
            int tmplevel;

            struct lcb_luv_yolog_context *ctx =
                    lcb_luv_yolog_context_by_name(grp->contexts,
                                          grp->ncontexts,
                                          *secnames);
            if (!ctx) {

                if (grp != lcb_luv_yolog_get_global()->parent) {
                    /* don't care about defaults */
                    fprintf(stderr, "Yolog: No such context '%s'\n",
                            *secnames);
                }
                continue;
            }

            ctx->parent = grp;
            handle_subsys_output(ctx, *cursecent, logroot,
                                 fmtdfl,
                                 &fmtdfl_used);

            tmplevel = get_minlevel(*cursecent);
            if (tmplevel != -1) {
                int ii;
                for (ii = 0; ii < LCB_LUV_YOLOG_OUTPUT_COUNT; ii++) {
                    if (ctx->olevels[ii] == LCB_LUV_YOLOG_LEVEL_UNSET) {
                        ctx->olevels[ii] = tmplevel;
                    }
                }
            }

            ctx->level = LCB_LUV_YOLOG_LEVEL_UNSET;
            lcb_luv_yolog_sync_levels(ctx);
        }
    }
    free (secents);

    GT_NO_SUBSYS:
    ;

    if (!fmtdfl_used) {
        free(fmtdfl);
    }
    apesq_free(root);
    return 0;
}

#define GENYL_YL_STATIC

static lcb_luv_yolog_context lcb_luv_yolog_logging_contexts_real[
    LCB_LUV_YOLOG_LOGGING_SUBSYS__COUNT
] = { { 0 } };

lcb_luv_yolog_context* lcb_luv_yolog_logging_contexts = lcb_luv_yolog_logging_contexts_real;
lcb_luv_yolog_context_group lcb_luv_yolog_log_group;

#include <string.h> /* for memset */
#include <stdlib.h> /* for getenv */
void
lcb_luv_yolog_init(const char *filename)
{
    lcb_luv_yolog_context* ctx;
    memset(lcb_luv_yolog_logging_contexts, 0, sizeof(lcb_luv_yolog_context) * LCB_LUV_YOLOG_LOGGING_SUBSYS__COUNT);

   ctx = lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_READ;
   ctx->prefix = "read";

   ctx = lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_IOPS;
   ctx->prefix = "iops";

   ctx = lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_EVENT;
   ctx->prefix = "event";

   ctx = lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_SOCKET;
   ctx->prefix = "socket";

   ctx = lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_WRITE;
   ctx->prefix = "write";

   ctx = lcb_luv_yolog_logging_contexts + LCB_LUV_YOLOG_LOGGING_SUBSYS_LOOP;
   ctx->prefix = "loop";

   /**
    * initialize the group so it contains the
    * contexts and their counts
    */

   memset(&lcb_luv_yolog_log_group, 0, sizeof(lcb_luv_yolog_log_group));
   lcb_luv_yolog_log_group.ncontexts = LCB_LUV_YOLOG_LOGGING_SUBSYS__COUNT;
   lcb_luv_yolog_log_group.contexts = lcb_luv_yolog_logging_contexts;

   lcb_luv_yolog_init_defaults(
        &lcb_luv_yolog_log_group,
        LCB_LUV_YOLOG_DEFAULT,
        "LCB_LUV_DEBUG_COLOR",
        "LCB_LUV_DEBUG_LEVEL"
    );

    if (filename) {
        lcb_luv_yolog_parse_file(&lcb_luv_yolog_log_group, filename);
        /* if we're a static build, also set the default levels */

#ifdef GENYL_YL_STATIC
        lcb_luv_yolog_parse_file(NULL, filename);
#endif

    }

    if (getenv("LCB_LUV_DEBUG_PREFS")) {
        lcb_luv_yolog_parse_envstr(&lcb_luv_yolog_log_group, getenv("LCB_LUV_DEBUG_PREFS"));
    }
}
