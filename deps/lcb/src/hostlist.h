/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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

#ifndef LCB_HOSTLIST_H
#define LCB_HOSTLIST_H

#ifdef __cplusplus
extern "C" {
#endif

#include "config.h"
#include <libcouchbase/couchbase.h>

/**
 * Structure representing a host. This contains the string representation
 * of a host and a port.
 */
typedef struct lcb_host_st {
    char host[NI_MAXHOST + 1];
    char port[NI_MAXSERV + 1];
} lcb_host_t;

/**
 * Structure representing a list of hosts. This has an internal iteration
 * index which is used to cycle between 'good' and 'bad' hosts.
 */
typedef struct hostlist_st {
    unsigned int ix;
    lcb_host_t *entries;
    lcb_size_t nentries;
    lcb_size_t nalloc;
    /** So we can return this easily */
    char **slentries;
} *hostlist_t;

/**
 * Creates a new hostlist. Returns NULL on allocation failure
 */
hostlist_t hostlist_create(void);

/**
 * Frees resources associated with the hostlist
 */
void hostlist_destroy(hostlist_t hostlist);

/**
 * Clears the hostlist
 */
void hostlist_clear(hostlist_t hostlist);

/**
 * Parses a string into a hostlist
 * @param host the target host to populate
 * @param spec a string to parse. This may either be an IP/host or an
 * IP:Port pair.
 * @param speclen the length of the string. If this is -1 then it is assumed
 * to be NUL-terminated and strlen will be used
 * @param deflport If a port is not found in the spec, then this port will
 * be used
 *
 * @return LCB_EINVAL if the host format is invalid
 */
lcb_error_t lcb_host_parse(lcb_host_t *host,
                            const char *spec,
                            int speclen,
                            int deflport);

/**
 * Compares two hosts for equality.
 * @param a host to compare
 * @param b other host to compare
 * @return true if equal, false if different.
 */

#define lcb_host_parsez(host, spec, deflport) lcb_host_parse(host, spec, -1, deflport)

int lcb_host_equals(lcb_host_t *a, lcb_host_t *b);

/**
 * Adds a string to the hostlist. See lcb_host_parse for details.
 * Note that if the host already exists (see 'lcb_host_equals') it will
 * not be added
 * @return LCB_EINVAL if the host string is not value, LCB_CLIENT_ENOMEM on
 * allocation failure.
 */
lcb_error_t hostlist_add_string(hostlist_t hostlist,
                                const char *spec,
                                int speclen,
                                int deflport);

#define hostlist_add_stringz(hostlist, spec, deflport) \
    hostlist_add_string(hostlist, spec, -1, deflport)

lcb_error_t hostlist_add_host(hostlist_t hostlist, lcb_host_t *host);

/**
 * Return the next host in the list.
 * @param hostlist the hostlist to use
 * @param rollover If the internal iterator has reached its limit, this
 * indicates whether it should be reset, or if it should return NULL
 * @return a new host if available, or NULL if the list is empty or the
 * iterator is finished.
 */
lcb_host_t *hostlist_shift_next(hostlist_t hostlist, int rollover);

/**
 * Randomize the hostlist
 */
void hostlist_randomize(hostlist_t hostlist);

/**
 * Whether the internal iterator has finished.
 */
#define hostlist_finished(hostlist) (hostlist->ix == hostlist->nentries)

/**
 * String list handling functions. These are used to return the hostlist via
 * the API where we return a char*[] terminated by a NULL pointer.
 */
void hostlist_ensure_strlist(hostlist_t hostlist);
void hostlist_reset_strlist(hostlist_t hostlist);

#ifdef __cplusplus
}
#endif
#endif
