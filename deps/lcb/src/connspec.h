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

#ifndef LCB_CONNSPEC_H
#define LCB_CONNSPEC_H

#include <libcouchbase/couchbase.h>
#include "config.h"
#include "simplestring.h"
#include "list.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    lcb_list_t llnode;
    lcb_U16 port;
    short type;
    char hostname[1];
#ifdef __cplusplus
    bool isSSL() const { return type == LCB_CONFIG_MCD_SSL_PORT || type == LCB_CONFIG_HTTP_SSL_PORT; }
    bool isHTTPS() const { return type == LCB_CONFIG_HTTP_SSL_PORT; }
    bool isHTTP() const { return type == LCB_CONFIG_HTTP_PORT; }
    bool isMCD() const { return type == LCB_CONFIG_MCD_PORT; }
    bool isMCDS() const { return type == LCB_CONFIG_MCD_SSL_PORT; }
    bool isTypeless() const { return type == 0 ; }
#endif

} lcb_HOSTSPEC;

typedef struct {
    char *ctlopts; /**< Iterator for option string. opt1=val1&opt2=val2 */
    unsigned optslen; /**< Total number of bytes in ctlopts */
    char *bucket; /**< Bucket string. Free with 'free()' */
    char *username; /**< Username. Currently not used */
    char *password; /**< Password */
    char *certpath; /**< Certificate path */
    char *connstr; /** Original spec string */
    lcb_SSLOPTS sslopts; /**< SSL Options */
    lcb_list_t hosts; /**< List of host information */
    lcb_U16 implicit_port; /**< Implicit port, based on scheme */
    int loglevel; /* cached loglevel */
    unsigned flags; /**< Internal flags */
    lcb_config_transport_t transports[LCB_CONFIG_TRANSPORT_MAX];
} lcb_CONNSPEC;

#define LCB_SPECSCHEME_RAW "couchbase+explicit://"
#define LCB_SPECSCHEME_MCD "couchbase://"
#define LCB_SPECSCHEME_MCD_SSL "couchbases://"
#define LCB_SPECSCHEME_HTTP "http://"
#define LCB_SPECSCHEME_HTTP_SSL "https-internal://"
#define LCB_SPECSCHEME_MCCOMPAT "memcached://"

/**
 * Compile a spec string into a structure suitable for further processing.
 * A Couchbase spec consists of a mandatory _scheme_ (currently only `couchbase://`) is
 * recognized, an optional _authority_ section, an optional _path_ section,
 * and an optional _parameters_ section.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_connspec_parse(const char *connstr,
    lcb_CONNSPEC *compiled, const char **errmsg);

/**
 * Convert an older lcb_create_st structure to an lcb_CONNSPEC structure.
 * @param params structure to be populated
 * @param cropts structure to read from
 * @return error code on failure, LCB_SUCCESS on success.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_connspec_convert(lcb_CONNSPEC *params, const struct lcb_create_st *cropts);

LIBCOUCHBASE_API
void
lcb_connspec_clean(lcb_CONNSPEC *params);

/**
 * Iterate over the option pairs found in the original string. This iterates
 * over all _unrecognized_ options.
 *
 * @param params The compiled spec structure
 * @param[out] key a pointer to the option key
 * @param[out] value a pointer to the option value
 * @param[in,out] ctx iterator. This should be initialized to 0 upon the
 * first call
 * @return true if an option was fetched (and thus `key` and `value` contain
 * valid pointers) or false if there are no more options.
 */
LIBCOUCHBASE_API
int
lcb_connspec_next_option(const lcb_CONNSPEC *params,
    const char **key, const char **value, int *ctx);


#ifdef __cplusplus
}
#endif
#endif
