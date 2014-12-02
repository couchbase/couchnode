/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

#ifndef LCB_HTTPAPI_H
#define LCB_HTTPAPI_H

#include <libcouchbase/couchbase.h>
#include <lcbio/lcbio.h>
#include <lcbio/timer-ng.h>
#include <lcbht/lcbht.h>
#include "contrib/http_parser/http_parser.h"
#include "list.h"
#include "simplestring.h"

typedef struct {
    lcb_list_t list;
    char *key;
    char *val;
} lcb_http_header_t;

typedef enum {
    /**The request is still ongoing. Callbacks are still active.
     * Note that this essentially means the absence of any flags :) */
    LCB_HTREQ_S_ONGOING = 0,

    /**This flag is set when the on_complete callback has been invoked. This
     * is used as a marker to prevent us from calling that callback more than
     * once per request */
    LCB_HTREQ_S_CBINVOKED = 1 << 0,

    /**This flag is set by lcb_http_request_finish, and indicates that the
     * request is no longer active per se. This means that while the request
     * may still be valid in memory, it is simply waiting for any pending I/O
     * operations to close, so the reference count can hit zero. */
    LCB_HTREQ_S_FINISHED = 1 << 1,

    /** Internal flag used to indicate that finish() should not not attempt
     * to modify any instance-level globals. This is currently used
     * from within lcb_destroy() */
    LCB_HTREQ_S_NOLCB = 1 << 2
} lcb_http_request_status_t;

struct lcb_http_request_st {
    lcb_t instance;
    /** The URL buffer */
    char *url;
    lcb_size_t nurl;
    /** The URL info */
    struct http_parser_url url_info;
    /** The requested path (without couch api endpoint) */
    char *path;
    lcb_size_t npath;
    /** The body buffer */
    char *body;
    lcb_size_t nbody;
    /** The type of HTTP request */
    lcb_http_method_t method;
    char *host;
    lcb_size_t nhost;
    char *port;
    lcb_size_t nport;

    /** Non-zero if caller would like to receive response in chunks */
    int chunked;
    /** The cookie belonging to this request */
    const void *command_cookie;
    /** Reference count */
    unsigned int refcount;
    /** Redirect count */
    int redircount;
    char *redirect_to;
    lcb_string outbuf;

    /** Current state */
    lcb_http_request_status_t status;

    /** Request type; views or management */
    lcb_http_type_t reqtype;

    /** Request headers */
    lcb_http_header_t headers_out;
    /** Headers array for passing to callbacks */
    char **headers;
    lcbio_pTABLE io;
    lcbio_pTIMER timer;
    lcbio_CONNREQ creq;
    lcbio_CTX *ioctx;
    lcbht_pPARSER parser;
    /** IO Timeout */
    lcb_uint32_t timeout;
};

void
lcb_http_init_resp(const lcb_http_request_t req, lcb_RESPHTTP *res);

void
lcb_http_request_finish(lcb_t instance, lcb_http_request_t req, lcb_error_t error);

void
lcb_http_request_decref(lcb_http_request_t req);

lcb_error_t
lcb_http_verify_url(lcb_http_request_t req, const char *base, lcb_size_t nbase);

lcb_error_t
lcb_http_request_exec(lcb_http_request_t req);

lcb_error_t
lcb_http_request_connect(lcb_http_request_t req);

#endif
