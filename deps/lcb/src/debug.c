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
 *
 */

/**
 * Debugging routines for libcouchbase. Mostly adapted from the
 * author's 'yolog' project.
 *
 * @author M. Nunberg
 */

#include "internal.h" /*includes debug.h as well*/
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <ctype.h>
#include <string.h>


#ifdef LCB_DEBUG

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


static const char *Color_title_fmt = "\033["  _INTENSE_FG _MAGENTA "m";
static const char *Color_reset_fmt = "\033[0m";

#ifdef LCB_DEBUG_NOCTX
lcb_debug_st LCB_LOG_GLOBAL_NAME = {
    "libcouchbase", /*prefix*/
    0, /*level*/
    0, /*color*/
    NULL, /*out*/
    0, /*initialized*/
};
#endif

static void init_logging(lcb_debug_st *debugp)
{
    char *tmp_env;
    int max_level;

    debugp->initialized = 1;

    if (!debugp->out) {
        debugp->out = stderr;
    }

    if ((tmp_env = getenv(LCB_DEBUG_ENV_ENABLE)) != NULL) {
        if (sscanf(tmp_env, "%d", &max_level) == 1) {
            int my_level = LCB_LOGLVL_MAX - max_level;
            if (my_level <= 0) {
                my_level = LCB_LOGLVL_ALL;
            }
            debugp->level = my_level;
        } else {
            debugp->level = LCB_LOGLVL_WARN;
        }
    } else {
        debugp->level = LCB_LOGLVL_WARN;
    }

    if (getenv(LCB_DEBUG_ENV_COLOR_ENABLE)) {
        debugp->color = 1;
    } else {
        debugp->color = 0;
    }
}

void lcb_logger(lcb_debug_st *debugp,
                lcb_loglevel_t level,
                int line, const char *fn, const char *fmt, ...)
{
    va_list ap;
    const char *title_fmt = "", *reset_fmt = "", *line_fmt = "";

    if (!debugp->initialized) {
        init_logging(debugp);
    }

    if (debugp->level > level) {
        return;
    }

    if (debugp->color) {
        title_fmt = Color_title_fmt;
        reset_fmt = Color_reset_fmt;
        switch (level) {
        case LCB_LOGLVL_CRIT:
        case LCB_LOGLVL_ERROR:
            line_fmt = "\033[" _BRIGHT_FG ";" _FG _RED "m";
            break;

        case LCB_LOGLVL_WARN:
            line_fmt = "\033[" _FG _YELLOW "m";
            break;

        case LCB_LOGLVL_DEBUG:
        case LCB_LOGLVL_TRACE:
            line_fmt = "\033[" _DIM_FG ";" _FG _WHITE "m";
            break;

        default:
            /* No color */
            line_fmt = "";
            title_fmt = "";
            break;
        }
    }

    va_start(ap, fmt);
    flockfile(debugp->out);

    fprintf(debugp->out,
            "[%s%s%s] " /*title, prefix, reset color*/
            "%s" /*line color format*/
            "%s:%d ", /*__func__, __LINE__*/
            title_fmt, debugp->prefix, reset_fmt,
            line_fmt,
            fn, line);

    vfprintf(debugp->out, fmt, ap);

    fprintf(debugp->out, "%s\n", reset_fmt);

    fflush(debugp->out);
    funlockfile(debugp->out);
    va_end(ap);
}

static int lcb_header_dump_enabled = -1;
static int lcb_packet_dump_enabled = -1;
void lcb_dump_header(const void *data, lcb_size_t nbytes)
{
    char strbuf[1024];

    if (lcb_header_dump_enabled == -1) {
        if (getenv(LCB_DEBUG_ENV_HEADERS_ENABLE)) {
            lcb_header_dump_enabled = 1;
        } else {
            lcb_header_dump_enabled = 0;
            return;
        }
    } else if (lcb_header_dump_enabled == 0) {
        return;
    }

    if (lcb_strpacket(strbuf, 1024, data, nbytes)) {
        fprintf(stderr, "%s\n", strbuf);
    }

}

void lcb_dump_packet(const void *header, lcb_size_t nheader,
                     const void *payload, lcb_size_t npayload)
{
    protocol_binary_request_header *req = (void *)header;

    if (payload == NULL && nheader > sizeof(protocol_binary_request_header)) {
        payload = (char *)header + sizeof(protocol_binary_request_header);
        npayload = nheader;
    }

    lcb_dump_header(header, nheader);
    if (lcb_packet_dump_enabled == -1) {
        if (getenv(LCB_DEBUG_ENV_PACKET_ENABLE)) {
            lcb_packet_dump_enabled = 1;
        } else {
            lcb_packet_dump_enabled = 0;
            return;
        }
    } else if (lcb_packet_dump_enabled == 0) {
        return;
    }

    if (npayload < req->request.extlen +
            ntohs(req->request.keylen) +
            ntohl(req->request.bodylen)) {
        fprintf(stderr, "Requested to dump complete packet, "
                "but payload is smaller than expected\n");
        return;
    }

    if (req->request.extlen) {
        fprintf(stderr, "\tExtras:\n");
        lcb_hex_dump(payload, req->request.extlen);
    }

    if (req->request.keylen) {
        fprintf(stderr, "\tKey:\n");
        lcb_hex_dump((char *)payload + req->request.extlen,
                     ntohs(req->request.keylen));
    }

    if (req->request.bodylen) {
        fprintf(stderr, "\tBody:\n");
        lcb_hex_dump((char *)payload + req->request.extlen + ntohs(req->request.keylen),
                     ntohl(req->request.bodylen));
    }
}

void lcb_hex_dump(const void *data, lcb_size_t size)
{
    /* dumps size bytes of *data to stdout. Looks like:
     * [0000] 75 6E 6B 6E 6F 77 6E 20
     *                  30 FF 00 00 00 00 39 00 unknown 0.....9.
     * (in a single line of course)
     */

    unsigned char *p = (unsigned char *)data;
    unsigned char c;
    lcb_size_t n;

    char bytestr[4] = {0};
    char addrstr[10] = {0};
    char hexstr[ 16 * 3 + 5] = {0};
    char charstr[16 * 1 + 5] = {0};

    for (n = 1; n <= size; n++) {
        if (n % 16 == 1) {
            /* store address for this line */
            snprintf(addrstr, sizeof(addrstr), "%.4lx",
                     (unsigned long)
                     ((lcb_size_t)p - (lcb_size_t)data));
        }

        c = *p;
        if (isalnum(c) == 0) {
            c = '.';
        }

        /* store hex str (for left side) */
        snprintf(bytestr, sizeof(bytestr), "%02X ", *p);
        strncat(hexstr, bytestr, sizeof(hexstr) - strlen(hexstr) - 1);

        /* store char str (for right side) */
        snprintf(bytestr, sizeof(bytestr), "%c", c);
        strncat(charstr, bytestr, sizeof(charstr) - strlen(charstr) - 1);

        if (n % 16 == 0) {
            /* line completed */
            fprintf(stderr, "[%4.4s]   %-50.50s  %s\n", addrstr, hexstr, charstr);
            hexstr[0] = 0;
            charstr[0] = 0;
        } else if (n % 8 == 0) {
            /* half line: add whitespaces */
            strncat(hexstr, "  ", sizeof(hexstr) - strlen(hexstr) - 1);
            strncat(charstr, " ", sizeof(charstr) - strlen(charstr) - 1);
        }
        p++; /* next byte */
    }

    if (strlen(hexstr) > 0) {
        /* print rest of buffer if not empty */
        fprintf(stderr, "[%4.4s]   %-50.50s  %s\n", addrstr, hexstr, charstr);
    }
}

#endif /*LCB_DEBUG*/


#define opcode_match(base)                                  \
    case PROTOCOL_BINARY_CMD_ ## base: { return # base; }

/*This macro defines a pair of (FOO, FOOQ) */
#define opcode_matchq2(base)                    \
    opcode_match(base) opcode_match(base ## Q)

/* I'm sure i've left out some commands here */
const char *lcb_stropcode(lcb_uint8_t opcode)
{
    switch (opcode) {
        opcode_matchq2(SET)
        opcode_matchq2(GET)
        opcode_matchq2(GETK)
        opcode_matchq2(GAT)
        opcode_matchq2(APPEND)
        opcode_matchq2(PREPEND)
        opcode_matchq2(REPLACE)
        opcode_matchq2(DELETE)
        opcode_matchq2(QUIT)
        opcode_matchq2(FLUSH)

        opcode_match(TOUCH)

        opcode_match(SASL_LIST_MECHS)
        opcode_match(SASL_AUTH)
        opcode_match(SASL_STEP)

        opcode_match(NOOP)


        opcode_match(STAT)
        opcode_match(VERSION)

        opcode_match(VERBOSITY)

        opcode_match(TAP_CONNECT)
        opcode_match(TAP_MUTATION)
        opcode_match(TAP_DELETE)
        opcode_match(TAP_FLUSH)
        opcode_match(TAP_OPAQUE)
        opcode_match(TAP_VBUCKET_SET)
        opcode_match(TAP_CHECKPOINT_START)
        opcode_match(TAP_CHECKPOINT_END)

        opcode_match(SCRUB)
    default:
        return NULL;
    }
}
#undef opcode_match
#undef opcode_matchq2

#define status_match(base)                      \
    case PROTOCOL_BINARY_RESPONSE_ ## base: {   \
        return #base;                           \
    }
const char *lcb_strstatus(lcb_uint16_t status)
{
    switch (status) {
        status_match(SUCCESS)
        status_match(AUTH_ERROR)
        status_match(EINVAL)
        status_match(KEY_ENOENT)
        status_match(E2BIG)
        status_match(NOT_STORED)
        status_match(DELTA_BADVAL)
        status_match(NOT_MY_VBUCKET)
        status_match(AUTH_CONTINUE)
        status_match(UNKNOWN_COMMAND)
        status_match(EBUSY)
        status_match(ETMPFAIL)
        status_match(KEY_EEXISTS)
        status_match(NOT_SUPPORTED)
    default:
        return NULL;
    }
}

#undef status_match

const char *lcb_strmagic(lcb_uint8_t magic)
{
    if (magic == PROTOCOL_BINARY_REQ) {
        return "REQ";
    } else if (magic == PROTOCOL_BINARY_RES) {
        return "RES";
    } else {
        return NULL;
    }
}

lcb_size_t lcb_strpacket(char *dst,
                         lcb_size_t ndst,
                         const void *bytes,
                         lcb_size_t nbytes)
{
    lcb_ssize_t ret;
    protocol_binary_request_header *req;
    protocol_binary_response_header *res;

    /* Dynamic pointers */
    const char *vbstatus_title, *vbstatus_value, *opstr, *magicstr;

    /* Memory for our sprintf("%x") stuff */
    char a_vbstatus_value[16], a_opstr[16], a_magicstr[16];

    if (nbytes < sizeof(protocol_binary_request_header)) {
        return 0;
    }

    req = (protocol_binary_request_header *)bytes;
    res = (protocol_binary_response_header *)bytes;

    if ((magicstr = lcb_strmagic(req->request.magic)) == NULL) {
        sprintf(a_magicstr, "%0x", req->request.magic);
        magicstr = a_magicstr;
    }

    if ((opstr = lcb_stropcode(req->request.opcode)) == NULL) {
        sprintf(a_opstr, "%0x", req->request.opcode);
        opstr = a_opstr;
    }

    if (req->request.magic == PROTOCOL_BINARY_REQ) {
        vbstatus_title = "VBID";
        sprintf(a_vbstatus_value, "%04x", ntohs(req->request.vbucket));
        vbstatus_value = a_vbstatus_value;
    } else {
        vbstatus_title = "STATUS";
        vbstatus_value = lcb_strstatus(ntohs(res->response.status));

        if (vbstatus_value == NULL) {
            sprintf(a_vbstatus_value, "%0x4", ntohs(res->response.status));
            vbstatus_value = a_vbstatus_value;
        }
    }

    ret = snprintf(dst, ndst,
                   "MAGIC=%s "
                   "OP=%s "
                   "%s=%s "
                   "KLEN=%d EXTLEN=%x "
                   "NBODY=%" PRIu32 " "
                   "OPAQUE=%0" PRIx32 " CAS=%0" PRIx64,
                   magicstr,
                   opstr,
                   vbstatus_title, vbstatus_value,
                   ntohs(req->request.keylen), req->request.extlen,
                   (lcb_uint32_t)ntohl(req->request.bodylen),
                   (lcb_uint32_t)req->request.opaque,
                   (lcb_uint64_t)req->request.cas);

    return (lcb_size_t)ret;
}
