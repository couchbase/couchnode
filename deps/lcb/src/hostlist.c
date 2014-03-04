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

#include "hostlist.h"
#include "simplestring.h"
#include <stdio.h>
#include <ctype.h>
#include <limits.h>

hostlist_t hostlist_create(void)
{
    hostlist_t ret = calloc(1, sizeof(*ret));
    if (ret == NULL) {
        return ret;
    }

    return ret;
}

void hostlist_destroy(hostlist_t hostlist)
{
    if (hostlist->entries) {
        free(hostlist->entries);
    }
    hostlist_reset_strlist(hostlist);

    free(hostlist);
}

void hostlist_clear(hostlist_t hostlist)
{
    hostlist_reset_strlist(hostlist);
    hostlist->nentries = 0;
    hostlist->ix = 0;
}

lcb_error_t lcb_host_parse(lcb_host_t *host,
                            const char *spec,
                            int speclen,
                            int deflport)
{
    lcb_string zspec;

    char *host_s;
    char *port_s;
    char *delim;


    /** Parse the host properly */
    if (speclen < 0) {
        speclen = strlen(spec);
    } else if (speclen == 0) {
        return LCB_INVALID_HOST_FORMAT;
    }

    if (deflport < 1) {
        return LCB_INVALID_HOST_FORMAT;
    }

    if (lcb_string_init(&zspec)) {
        return LCB_CLIENT_ENOMEM;
    }


    if (lcb_string_append(&zspec, spec, speclen)) {
        lcb_string_release(&zspec);
        return LCB_CLIENT_ENOMEM;
    }


    host_s = zspec.base;
    if (*host_s == ':') {
        lcb_string_release(&zspec);
        return LCB_INVALID_HOST_FORMAT;
    }

    if ( (delim = strstr(host_s, "://"))) {
        host_s = delim + 3;
    }

    if ((delim = strstr(host_s, "/"))) {
        *delim = '\0';
    }

    port_s = strstr(host_s, ":");
    if (port_s != NULL) {
        char *endp;
        long ll;

        *port_s = '\0';
        port_s++;

        if (! *port_s) {
            lcb_string_release(&zspec);
            return LCB_INVALID_HOST_FORMAT;
        }

        ll = strtol(port_s, &endp, 10);
        if (ll == LONG_MIN || ll == LONG_MAX) {
            lcb_string_release(&zspec);
            return LCB_INVALID_HOST_FORMAT;
        }

        if (*endp) {
            lcb_string_release(&zspec);
            return LCB_INVALID_HOST_FORMAT;
        }

    } else {
        port_s = "";
    }


    if (strlen(host_s) > sizeof(host->host)-1 ||
            strlen(port_s) > sizeof(host->port)-1 ||
            *host_s == '\0') {
        lcb_string_release(&zspec);
        return LCB_INVALID_HOST_FORMAT;
    }

    {
        lcb_size_t ii, hostlen = strlen(host_s);
        for (ii = 0; ii < hostlen; ii++) {
            if (isalnum(host_s[ii])) {
                continue;
            }
            switch (host_s[ii]) {
            case '.':
            case '-':
            case '_':
                break;
            default:
                lcb_string_release(&zspec);
                return LCB_INVALID_HOST_FORMAT;
            }
        }
    }

    strcpy(host->host, host_s);
    if (*port_s) {
        strcpy(host->port, port_s);
    } else {
        sprintf(host->port, "%d", deflport);
    }

    lcb_string_release(&zspec);
    return LCB_SUCCESS;
}

int lcb_host_equals(lcb_host_t *a, lcb_host_t *b)
{
    return strcmp(a->host, b->host) == 0 && strcmp(a->port, b->port) == 0;
}


lcb_error_t hostlist_add_host(hostlist_t hostlist, lcb_host_t *host)
{
    lcb_size_t ii;
    lcb_size_t nalloc;

    for (ii = 0; ii < hostlist->nentries; ii++) {
        if (lcb_host_equals(hostlist->entries + ii, host)) {
            return LCB_SUCCESS;
        }
    }

    nalloc = hostlist->nalloc;
    if (!nalloc) {
        nalloc = 8;
    } else if (nalloc == hostlist->nentries) {
        nalloc *= 2;
    }

    if (nalloc > hostlist->nalloc) {
        lcb_host_t *new_entries;

        if (hostlist->entries) {
            new_entries = realloc(hostlist->entries, sizeof(*host) * nalloc);
        } else {
            new_entries = malloc(sizeof(*host) * nalloc);
        }
        if (!new_entries) {
            return LCB_CLIENT_ENOMEM;
        }
        hostlist->entries = new_entries;
        hostlist->nalloc = nalloc;
    }

    hostlist->entries[hostlist->nentries++] = *host;
    hostlist_reset_strlist(hostlist);
    return LCB_SUCCESS;
}

lcb_error_t hostlist_add_string(hostlist_t hostlist,
                                const char *spec,
                                int speclen,
                                int deflport)
{
    lcb_error_t err = LCB_SUCCESS;
    lcb_string str;

    char *delim;
    char *curstart;


    if (speclen < 0) {
        speclen = strlen(spec);
    }


    if (lcb_string_init(&str)) {
        return LCB_CLIENT_ENOMEM;
    }

    if (lcb_string_append(&str, spec, speclen)) {
        lcb_string_release(&str);
        return LCB_CLIENT_ENOMEM;
    }

    if (!str.nused) {
        lcb_string_release(&str);
        return LCB_SUCCESS;
    }

    if (str.base[str.nused-1] != ';') {
        if (lcb_string_appendz(&str, ";")) {
            lcb_string_release(&str);
            return LCB_CLIENT_ENOMEM;
        }
    }

    curstart = str.base;
    while ( (delim = strstr(curstart, ";"))) {
        lcb_host_t curhost;
        lcb_size_t curlen;

        if (delim == curstart) {
            curstart++;
            continue;
        }

        /** { 'f', 'o', 'o', ';' } */
        curlen = delim - curstart;

        err = lcb_host_parse(&curhost, curstart, curlen, deflport);
        if (err != LCB_SUCCESS) {
            break;
        }

        err = hostlist_add_host(hostlist, &curhost);
        if (err != LCB_SUCCESS) {
            break;
        }

        curstart = delim + 1;
    }

    lcb_string_release(&str);
    return err;
}

lcb_host_t * hostlist_shift_next(hostlist_t hostlist, int rollover)
{
    lcb_host_t *ret;

    if (hostlist->nentries == 0) {
        return NULL;
    }

    if (hostlist->ix == hostlist->nentries) {
        if (rollover) {
            hostlist->ix = 0;
        } else {
            return NULL;
        }
    }

    ret = hostlist->entries + hostlist->ix;
    hostlist->ix++;
    return ret;
}

void hostlist_randomize(hostlist_t hostlist)
{
    lcb_size_t ii;
    if (!hostlist->nentries) {
        return;
    }


    for (ii = 1; ii < hostlist->nentries; ii++) {
        lcb_size_t nn = (lcb_size_t)(gethrtime() >> 10) % ii;
        lcb_host_t tmp = hostlist->entries[ii];
        hostlist->entries[ii] = hostlist->entries[nn];
        hostlist->entries[nn] = tmp;
    }

    hostlist_reset_strlist(hostlist);
}

void hostlist_reset_strlist(hostlist_t hostlist)
{
    char **stmp;

    if (!hostlist->slentries) {
        return;
    }

    for (stmp = hostlist->slentries; *stmp; stmp++) {
        free(*stmp);
    }

    free(hostlist->slentries);
    hostlist->slentries = NULL;
}

void hostlist_ensure_strlist(hostlist_t hostlist)
{
    lcb_size_t ii;

    if (hostlist->slentries) {
        return;
    }

    hostlist->slentries = malloc(sizeof(char *) * (hostlist->nentries+1));

    for (ii = 0; ii < hostlist->nentries; ii++) {
        lcb_host_t *curhost = hostlist->entries + ii;
        hostlist->slentries[ii] = malloc(strlen(curhost->host) +
                                         strlen(curhost->port) +
                                         5);
        sprintf(hostlist->slentries[ii], "%s:%s", curhost->host, curhost->port);
    }

    hostlist->slentries[ii] = NULL;
}
