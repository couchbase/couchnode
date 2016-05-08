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
#ifndef __cplusplus
struct hostlist_st;
typedef struct hostlist_st *hostlist_t;
#else
#include <vector>

namespace lcb {
struct Hostlist {
    Hostlist() : ix(0) {}
    ~Hostlist();

    void add(const lcb_host_t&);
    lcb_error_t add(const char *s, long len, int deflport);
    bool exists(const lcb_host_t&) const;
    bool exists(const char *hostport) const;
    lcb_host_t *next(bool wrap);
    bool finished() const;

    size_t size() const { return hosts.size(); }
    bool empty() const { return hosts.empty(); }
    Hostlist& assign(const Hostlist& other);
    void clear() { hosts.clear(); reset_strlist(); ix = 0; }
    void randomize();
    void ensure_strlist();
    void reset_strlist();
    unsigned int ix;

    std::vector<lcb_host_t> hosts;
    std::vector<const char *> hoststrs;
};
}
typedef lcb::Hostlist* hostlist_t;
#define hostlist_st lcb::Hostlist
#endif

#ifdef __cplusplus
extern "C" {
#endif

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
lcb_error_t
lcb_host_parse(lcb_host_t *host, const char *spec, int speclen, int deflport);

/** Wrapper around lcb_host_parse() which accepts a NUL-terminated string
 * @param host the host to populate
 * @param spec a NUL-terminated string to parse
 * @param deflport the default port to use if the `spec` does not contain a port
 * @see lcb_host_parse()
 */
#define lcb_host_parsez(host, spec, deflport) lcb_host_parse(host, spec, -1, deflport)

/**
 * Compares two hosts for equality.
 * @param a host to compare
 * @param b other host to compare
 * @return true if equal, false if different.
 */
int lcb_host_equals(const lcb_host_t *a, const lcb_host_t *b);

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

lcb_error_t hostlist_add_host(hostlist_t hostlist, const lcb_host_t *host);

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
 * String list handling functions. These are used to return the hostlist via
 * the API where we return a char*[] terminated by a NULL pointer.
 */
void hostlist_reset_strlist(hostlist_t hostlist);

/** Whether the internal iterator has finished. */
int hostlist_finished(hostlist_t);
size_t hostlist_size(const hostlist_t hl);
void hostlist_assign(hostlist_t dst, const hostlist_t src);
const lcb_host_t *hostlist_get(const hostlist_t, size_t);
const char * const *hostlist_strents(const hostlist_t hl);
#ifdef __cplusplus
}
#endif
#endif
