/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
 * Internal functions for debugging
 *
 * XXX: The API contained herein is subject to change. Do not rely on
 * any of this to persist between versions yet. The main purpose for
 * the debugging modules is currently to test your own code, and it is
 * expected that they be removed when the code is confirmed working.
 *
 * @author M. Nunberg
 */

/**
 * The following preprocessor variables can be defined to control
 * various levels of developer logging
 *
 * LCB_DEBUG enables 'explicit' debugging functions, meaning
 * debug functions are fully qualified and must include an instance as
 * the first argument.  debugging is done via lcb_<level>
 * where level is one of {trace,debug,info,warn,err,crit}
 *
 * LCB_DEBUG_NOCTX enables shorthand debugging
 * functions. These are intended for use by developers and
 * contributors wishing to debug changes and are not intended for
 * shipping with commited code. The calling convention assumes an
 * implicit global variable with extern linkage and strips the
 * lcb_ namespace from the function, replacing it with log_
 *
 * Debugging output is prefixed with a title, which may be set in the
 * debug_st structure.  If the macro LCB_DEBUG_STATIC_CTX is
 * defined, then instead of using a global debug_st with extern
 * linkage, each participating file would be expected to have defined
 * an implicit file-scoped debug_st using the
 * LCB_DEBUG_STATIC_INIT(prefix,level) macro.
 *
 * By default none of these macros are enabled and all debugging
 * functions and/or symbols are noops
 */

#ifndef LCBCOUCHBASE_DEBUG_H
#define LIBCOUCHBASE_DEBUG_H

#include <memcached/protocol_binary.h>
#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

    /**
     * Enable access and declarations of our global identifiers. This cannot hurt
     */
    typedef enum {
        LCB_LOGLVL_ALL = 0,
        LCB_LOGLVL_TRACE,
        LCB_LOGLVL_DEBUG,
        LCB_LOGLVL_INFO,
        LCB_LOGLVL_WARN,
        LCB_LOGLVL_ERROR,
        LCB_LOGLVL_CRIT,
        LCB_LOGLVL_NONE
    }
    lcb_loglevel_t;

#define LCB_LOGLVL_MAX LCB_LOGLVL_CRIT

    typedef struct {
        /*The 'title'*/
        char *prefix;

        /*The minimum level allowable*/
        lcb_loglevel_t level;

        /*Whether color is enabled*/
        int color;

        /*Output stream*/
        FILE *out;

        /*Set internally when this structure has been initialized*/
        int initialized;
    } lcb_debug_st;

    /* Environment variables to control setting debug parameters */

    /* If set to an integer, the integer is taken as the minimum allowable
     * output level.  If set to -1, then all levels are enabled
     */
#define LCB_DEBUG_ENV_ENABLE "LCB_DEBUG"

    /*
     * Format log messages by color coding them according to their severity
     * using ANSI escape sequences
     */
#define LCB_DEBUG_ENV_COLOR_ENABLE "LCB_DEBUG_COLORS"

    /*
     * Allow code to dump packet headers
     */
#define LCB_DEBUG_ENV_HEADERS_ENABLE "LCB_DUMP_HEADERS"

    /*
     * Allow code to dump packet bodies
     */
#define LCB_DEBUG_ENV_PACKET_ENABLE "LCB_DUMP_PACKETS"


    /**
     * Returns a string representation of the requested opcode, or NULL if
     * not found
     */
    const char *lcb_stropcode(lcb_uint8_t opcode);

    /**
     * Returns the string representation of a packet's  'magic' field, or NULL
     */
    const char *lcb_strmagic(lcb_uint8_t magic);

    /**
     * returns a string representation of the packet's response status, or NULL
     */
    const char *lcb_strstatus(lcb_uint16_t status);


    /**
     * Writes a textual representation of the packet (header)
     * stored in bytes, which is nbytes long into dst, which is ndst long.
     *
     * dst should be large enough to hold the textual representation,
     * including a terminating NULL byte.
     *
     * Returns the amount of bytes written to dst.
     */
    lcb_size_t lcb_strpacket(char *dst,
                             lcb_size_t ndst,
                             const void *bytes,
                             lcb_size_t nbytes);

#if defined LCB_DEBUG_NOCTX && !defined LCB_DEBUG
#define LCB_DEBUG
#endif /*LCB_DEBUG_NOCTX*/


#ifdef LCB_DEBUG


    /**
     * this structure contains a nice title and optional level threshold.
     * do not instantiate or access explicitly. Use provided functions/macros
     */

    /**
     * Core logging function
     */
    void lcb_logger(lcb_debug_st *logparams,
                    lcb_loglevel_t level,
                    int line,
                    const char *fn,
                    const char *fmt, ...);

    /**
     * print a formatted description of a packet header
     */
    void lcb_dump_header(const void *data, lcb_size_t nbytes);

    /**
     * print a dump of the entire packet. If 'payload' is NULL, and nheader
     * is larger than header (and estimated to be the size of the entire packet)
     * then the header will be assumed to be the body itself.
     */
    void lcb_dump_packet(const void *header, lcb_size_t nheader,
                         const void *payload, lcb_size_t npayload);

    /**
     * print a hex dump of data
     */
    void lcb_hex_dump(const void *data, lcb_size_t nbytes);

#define LCB_LOG_IMPLICIT(debugp, lvl_base, fmt, ...) \
        lcb_logger(debugp, LCB_LOGLVL_ ## lvl_base, \
                            __LINE__, __func__, \
                            fmt, ## __VA_ARGS__)


#define LCB_LOG_EXPLICIT(instance, lvl_base, fmt, ...) \
        LCB_LOG_IMPLICIT(instance->debug, lvl_base, fmt, ## __VA_ARGS__ )


    /**
     * the following functions send a message of the specified level to
     * the debug logging system. These are noop if lcb was not
     * compiled with debugging.
     */
#define lcb_trace(instance, fmt, ...) \
    LCB_LOG_EXPLICIT(instance, TRACE, fmt,  ## __VA_ARGS__)

#define lcb_info(instance, fmt, ...) \
    LCB_LOG_EXPLICIT(instance, INFO, fmt,  ## __VA_ARGS__)

#define lcb_debug(instance, fmt, ...) \
    LCB_LOG_EXPLICIT(instance, DEBUG, fmt,  ## __VA_ARGS__)

#define lcb_warn(instance, fmt, ...) \
    LCB_LOG_EXPLICIT(instance, WARN, fmt,  ## __VA_ARGS__)

#define lcb_err(instance, fmt, ...) \
    LCB_LOG_EXPLICIT(instance, ERROR, fmt, ## __VA_ARGS__)

#define lcb_crit(instance, fmt, ...) \
    LCB_LOG_EXPLICIT(instance, CRIT, fmt, ## __VA_ARGS__)


#ifdef LCB_DEBUG_NOCTX

    /**
     * These define implicit per-binary and per-object names
     */

#define LCB_LOG_PRIV_NAME lcb_log__Static_Debug_Params
#define LCB_LOG_GLOBAL_NAME lcb_log__Global_Debug_Params

#ifdef LCB_DEBUG_STATIC_CTX
#define LCB_DEBUG_STATIC_INIT(prefix, lvl) \
    static lcb_debug_st LCB_LOG_PRIV_NAME = \
        { prefix, lvl, -1, NULL, 0 };

#define LCB_LOG_IMPLICIT_NAME LCB_LOG_PRIV_NAME

#else

#define LCB_LOG_IMPLICIT_NAME LCB_LOG_GLOBAL_NAME
    extern lcb_debug_st LCB_LOG_IMPLICIT_NAME;
#define LCB_DEBUG_STATIC_INIT

#endif /*LCB_DEBUG_STATIC_CTX*/

#define log_trace(fmt, ...) \
    LCB_LOG_IMPLICIT(&LCB_LOG_GLOBAL_NAME, TRACE, fmt, ## __VA_ARGS__)

#define log_debug(fmt, ...) \
    LCB_LOG_IMPLICIT(&LCB_LOG_GLOBAL_NAME, DEBUG, fmt, ## __VA_ARGS__)

#define log_info(fmt, ...) \
    LCB_LOG_IMPLICIT(&LCB_LOG_GLOBAL_NAME, INFO, fmt, ## __VA_ARGS__)

#define log_warn(fmt, ...) \
    LCB_LOG_IMPLICIT(&LCB_LOG_GLOBAL_NAME, WARN, fmt, ## __VA_ARGS__)

#define log_err(fmt, ...) \
    LCB_LOG_IMPLICIT(&LCB_LOG_GLOBAL_NAME, ERROR, fmt, ## __VA_ARGS__)

#define log_crit(fmt, ...) \
    LCB_LOG_IMPLICIT(&LCB_LOG_GLOBAL_NAME, CRIT, fmt, ## __VA_ARGS__)

#endif /*LCB_DEBUG_NOCTX*/

#else

#define lcb_logger
#define lcb_dump_header
#define lcb_dump_packet
#define lcb_hex_dump

#define lcb_info
#define lcb_debug
#define lcb_warn
#define lcb_err
#define lcb_crit
#endif /* LCB_DEBUG */


    /**
     * If debugging is enabled, but implicit debugging is not, then supply
     * the noop macros
     */
#ifndef LCB_DEBUG_NOCTX
#define log_trace
#define log_debug
#define log_info
#define log_warn
#define log_err
#define log_crit
#endif /*LCB_DEBUG_NOCTX*/

#ifndef LCB_DEBUG_STATIC_INIT
#define LCB_DEBUG_STATIC_INIT
#endif /*LCB_DEBUG_STATIC_INIT*/

#ifdef __cplusplus
}
#endif

#endif /* LIBCOUCHBASE_DEBUG_H */
