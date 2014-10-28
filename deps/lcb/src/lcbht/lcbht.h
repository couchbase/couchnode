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

#ifndef LCB_HTTP_H
#define LCB_HTTP_H

#include <libcouchbase/couchbase.h>
#include "simplestring.h"
#include "sllist.h"
struct lcb_settings_st;

#ifdef __cplusplus
extern "C" {
#endif


/**
 * @file
 * HTTP Response parsing.
 *
 * This file provides HTTP/1.0 compatible response parsing semantics, supporting
 * the Content-Length header.
 *
 * Specifically this may be used to parse incoming HTTP streams into a single
 * body.
 */

/** Response state */
typedef enum {
    LCBHT_S_HTSTATUS = 1 << 0, /**< Have HTTP status */
    LCBHT_S_HEADER = 1 << 1, /**< Have HTTP header */
    LCBHT_S_BODY = 1 << 2, /**< Have HTTP body */
    LCBHT_S_DONE = 1 << 3, /**< Have a full message */

    /**Have a parse error. Note this is not the same as a HTTP error */
    LCBHT_S_ERROR = 1 << 4
} lcbht_RESPSTATE;

typedef struct {
    sllist_node slnode; /**< Next header in list */
    const char *key;
    const char *value;
    lcb_string buf_; /**< Storage for the key and value */
} lcbht_MIMEHDR;

typedef struct {
    unsigned short status; /**< HTTP Status code */
    lcbht_RESPSTATE state;
    sllist_root headers; /**< List of response headers */
    lcb_string body; /**< Body */
} lcbht_RESPONSE;

typedef struct lcbht_PARSER *lcbht_pPARSER;

/**
 * Initialize the parser object
 * @param settings the settings structure used for logging
 * @return a new parser object
 */
lcbht_pPARSER
lcbht_new(struct lcb_settings_st *settings);

/** Free the parser object */
void
lcbht_free(lcbht_pPARSER);

void
lcbht_reset(lcbht_pPARSER);

/**
 * Parse incoming data into a message
 * @param parser The parser
 * @param data Pointer to new data
 * @param ndata Size of the data
 *
 * @return The current state of the parser. If `state & LCBHT_S_DONE` then
 * the current response should be handled before continuing.
 * If `state & LCBHT_S_ERROR` then there was an error parsing the contents
 * as it violated the HTTP protocol.
 */
lcbht_RESPSTATE
lcbht_parse(lcbht_pPARSER parser, const void *data, unsigned ndata);

/**
 * Parse incoming data without buffering
 * @param parser The parser to use
 * @param data The data to parse
 * @param ndata Length of the data
 * @param[out] nused How much of the data was actually consumed
 * @param[out] nbody Size of the body pointer
 * @param[out] pbody a pointer for the body
 *
 * @return See lcbht_set_bufmode for the meaning of this value
 *
 * @note It is not an error if `pbody` is NULL. It may mean that the parse state
 * is still within the headers and there is no body to parse yet.
 *
 * This function is intended to be used in a loop, until there is no input
 * remaining. The use of the `nused` pointer is to determine by how much the
 * `data` pointer should be incremented (and the `ndata` decremented) for the
 * next call. When this function returns with a non-error status, `pbody`
 * will contain a pointer to a buffer of data (but see note above) which can
 * then be processed by the application.
 *
 * @code{.c}
 * char **body, *input;
 * unsigned inlen = get_input_len(), nused, bodylen;
 * lcbht_RESPSTATE res;
 * do {
 *   res = lcbht_parse_ex(parser, input, inlen, &nused, &nbody, &body);
 *   if (res & LCBHT_S_ERROR) {
 *     // handle error
 *     break;
 *   }
 *   if (nbody) {
 *     // handle body
 *   }
 *   input += nused;
 *   inlen -= nused;
 * } while (!(res & LCBHT_S_DONE));
 * @endcode
 */
lcbht_RESPSTATE
lcbht_parse_ex(lcbht_pPARSER parser, const void *data, unsigned ndata,
    unsigned *nused, unsigned *nbody, const char **pbody);


/**
 * Obtain the current response being processed.
 * @param parser The parser
 * @return a pointer to a response object. The response object is only valid
 * until the next call into another parser API
 */
lcbht_RESPONSE *
lcbht_get_response(lcbht_pPARSER parser);

/**
 * Determine whether HTTP/1.1 keepalive is enabled on the connection
 * @param parser The parser
 * @return true if keepalive is enabled, false otherwise.
 */
int
lcbht_can_keepalive(lcbht_pPARSER parser);

/**
 * Clear the response object
 * @param resp the response to clear
 */
void
lcbht_clear_response(lcbht_RESPONSE *resp);

/**
 * Get a header value for a key
 * @param response The response
 * @param key The key to look up
 * @return A string containing the value. If the header has no value then the
 * empty string will be returned. If the header does not exist NULL will be
 * returned.
 */
const char *
lcbht_get_resphdr(const lcbht_RESPONSE *response, const char *key);

/**
 * Return a list of headers
 * @param response The response
 * @return A list of headers. Iterate over this value like so:
 * @code{.c}
 * char **hdrlist = lcbht_make_resphdrlist(response);
 * for (char **cur = hdrlist; *cur; cur += 2) {
 *      char *key = cur[0];
 *      char *value = cur[1];
 *      // do something
 *      free(key);
 *      free(value);
 * }
 * free(hdrlist);
 * @endcode
 */
char **
lcbht_make_resphdrlist(lcbht_RESPONSE *response);

#ifdef __cplusplus
}
#endif
#endif
