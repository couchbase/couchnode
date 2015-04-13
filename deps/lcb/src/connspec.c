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

#include "connspec.h"
#include "hostlist.h"
#include "strcodecs/strcodecs.h"
#include <stdio.h>
#include <ctype.h>
#include <stdlib.h>

#define SET_ERROR(msg) \
    *errmsg = msg; \
    err = LCB_EINVAL; \
    goto GT_DONE;

#define SCRATCHSIZE 4096
#define F_HASBUCKET (1<<0)
#define F_HASPASSWD (1<<1)
#define F_HASUSER (1<<2)
#define F_SSLSCHEME (1<<3)

typedef struct {
    char *scratch; /* temporary buffer. Sufficient for strlen(specstr) * 3 bytes */
    char *decoded; /* offset into 'scratch' */
    const char *connstr; /* input string */
    const char *endptr; /* end of input */
    const char **errmsg;
    lcb_CONNSPEC *params;
} PARSECTX;

static int string_to_porttype(const char *s) {
    if (!strcmp(s, "HTTP")) {
        return LCB_CONFIG_HTTP_PORT;
    } else if (!strcmp(s, "MCD")) {
        return LCB_CONFIG_MCD_PORT;
    } else if (!strcmp(s, "HTTPS")) {
        return LCB_CONFIG_HTTP_SSL_PORT;
    } else if (!strcmp(s, "MCDS")) {
        return LCB_CONFIG_MCD_SSL_PORT;
    } else if (!strcmp(s, "MCCOMPAT")) {
        return LCB_CONFIG_MCCOMPAT_PORT;
    } else {
        return -1;
    }
}
static const char* porttype_to_string(int porttype)
{
    if (porttype == LCB_CONFIG_HTTP_PORT) {
        return "HTTP";
    } else if (porttype == LCB_CONFIG_HTTP_SSL_PORT) {
        return "HTTPS";
    } else if (porttype == LCB_CONFIG_MCD_PORT) {
        return "MCD";
    } else if (porttype == LCB_CONFIG_MCD_SSL_PORT) {
        return "MCDS";
    } else if (porttype == LCB_CONFIG_MCCOMPAT_PORT) {
        return "MCCOMPAT";
    } else {
        return "";
    }
}

static lcb_error_t
parse_hosts(PARSECTX *ctx, const char *hosts_end)
{
    const char **errmsg = ctx->errmsg;
    lcb_error_t err = LCB_SUCCESS;
    const char *c;
    lcb_CONNSPEC *out = ctx->params;

    if (0 != lcb_urldecode(ctx->connstr, ctx->decoded, hosts_end - ctx->connstr)) {
        SET_ERROR("Couldn't decode from url encoding");
    }

    c = ctx->decoded;

    while (*c) {
        // get the current host
        const char *curend;
        const char *port_s;
        char *tmp;
        unsigned curlen, hostlen, portlen;
        lcb_HOSTSPEC *dh;
        int itmp, rv;
        char hpdummy[256];
        const char *deflproto = NULL;

        /* Seek ahead, chopping off any ',' */
        while (*c == ',' || *c == ';') {
            if (*(++c) ==  '\0') {
                goto GT_DONE;
            }
        }

        /* Find the end */
        curend = strpbrk(c, ",;");
        if (!curend) {
            curend = c + strlen(c);
        }
        curlen = curend - c;
        if (!curlen) {
            continue;
        }

        memcpy(ctx->scratch, c, curlen);
        c = curend;
        ctx->scratch[curlen] = '\0';

        /* weed out erroneous characters */
        if (strstr(ctx->scratch, "://")) {
            SET_ERROR("Detected '://' inside hostname");
        }

        port_s = strchr(ctx->scratch, ':');
        if (port_s == NULL) {
            hostlen = curlen;
            portlen = 0;
        } else {
            hostlen = port_s - ctx->scratch;
            portlen = (curlen - hostlen)-1;
            port_s++;
        }

        dh = malloc(sizeof(*dh) + hostlen);
        dh->type = 0;
        dh->port = 0;
        deflproto = porttype_to_string(out->implicit_port);

        memcpy(dh->hostname, ctx->scratch, hostlen);
        dh->hostname[hostlen] = '\0';
        lcb_list_append(&out->hosts, &dh->llnode);

        if (port_s == NULL) {
            continue;
        }

        if (portlen >= sizeof hpdummy) {
            SET_ERROR("Port specification too big");
        }

        memcpy(hpdummy, port_s, portlen);
        hpdummy[portlen] = '\0';

        /* we have a port. The format is port=proto */
        rv = sscanf(hpdummy, "%d=%s", &itmp, ctx->scratch);
        if (rv == 2) {
            for (tmp = ctx->scratch; *tmp; tmp++) {
                *tmp = toupper(*tmp);
            }
            tmp = ctx->scratch;

        } else if (rv == 1 && out->implicit_port) {
            /* Have an implicit port. Use that */
            tmp = (char *)deflproto; /* assigned previously */
            if (out->implicit_port == itmp) {
                continue;
            }
            if (itmp == LCB_CONFIG_HTTP_PORT &&
                    out->implicit_port == LCB_CONFIG_MCD_PORT) {
                /* Honest 'couchbase://host:8091' mistake */
                continue;
            }
        } else {
            SET_ERROR("Port must be specified with protocol (host:port=proto)");
        }

        dh->port = itmp;
        if (-1 == (dh->type = string_to_porttype(tmp))) {
            SET_ERROR("Unrecognized protocol specified. Recognized are "
                "HTTP, HTTPS, MCD, MCDS");
        }
    }
    GT_DONE:
    return err;
}

static lcb_error_t
parse_options(PARSECTX *ctx, const char *options, const char *specend)
{
    lcb_string tmpstr;
    char *scratch = ctx->scratch;
    char *tmp;
    const char **errmsg = ctx->errmsg;
    lcb_CONNSPEC *out = ctx->params;
    lcb_error_t err = LCB_SUCCESS;

    lcb_string_init(&tmpstr);

    while (options != NULL && options < specend) {
        unsigned curlen;
        char *key, *value;
        const char *curend;

        if (*options == '&') {
            options++;
            continue;
        }

        curend = strchr(options, '&');
        if (!curend) {
            curend = specend;
        }

        curlen = curend - options;
        memcpy(scratch, options, curlen);
        scratch[curlen] = '\0';
        options = curend+1;

        key = scratch;
        value = strchr(key, '=');
        if (!value) {
            SET_ERROR("Option must be specified as a key=value pair");
        }

        *(value++) = '\0';
        if (!*value) {
            SET_ERROR("Value cannot be empty");
        }
        if (0 != lcb_urldecode(value, value, -1)) {
            SET_ERROR("Couldn't decode value");
        }
        if (!strcmp(key, "bootstrap_on")) {
            lcb_config_transport_t *arr = out->transports;
            if (!strcmp(value, "cccp")) {
                arr[0] = LCB_CONFIG_TRANSPORT_CCCP;
                arr[1] = LCB_CONFIG_TRANSPORT_LIST_END;
            } else if (!strcmp(value, "http")) {
                arr[0] = LCB_CONFIG_TRANSPORT_HTTP;
                arr[1] = LCB_CONFIG_TRANSPORT_LIST_END;
            } else if (!strcmp(value, "all")) {
                arr[0] = LCB_CONFIG_TRANSPORT_CCCP;
                arr[1] = LCB_CONFIG_TRANSPORT_HTTP;
                arr[2] = LCB_CONFIG_TRANSPORT_LIST_END;
            } else {
                SET_ERROR("Value for bootstrap_on must be 'cccp', 'http', or 'all'");
            }
        } else if (!strcmp(key, "username") || !strcmp(key, "user")) {
            if (! (out->flags & F_HASUSER)) {
                out->username = strdup(value);
            }
        } else if (!strcmp(key, "password") || !strcmp(key, "pass")) {
            if (! (out->flags & F_HASPASSWD)) {
                out->password = strdup(value);
            }
        } else if (!strcmp(key, "ssl")) {
            if (!strcmp(value, "off")) {
                if (out->flags & F_SSLSCHEME) {
                    SET_ERROR("SSL scheme specified, but ssl=off found in options");
                }
                out->sslopts = 0;
            } else if (!strcmp(value, "on")) {
                out->sslopts = LCB_SSL_ENABLED;
            } else if (!strcmp(value, "no_verify")) {
                out->sslopts = LCB_SSL_ENABLED|LCB_SSL_NOVERIFY;
            } else {
                SET_ERROR("Invalid value for 'ssl'. Choices are on, off, and no_verify");
            }
        } else if (!strcmp(key, "certpath")) {
            out->certpath = strdup(value);
        } else if (!strcmp(key, "console_log_level")) {
            if (sscanf(value, "%d", &out->loglevel) != 1) {
                SET_ERROR("console_log_level must be a numeric value");
            }
        } else {
            lcb_string_appendz(&tmpstr, key);
            lcb_string_appendz(&tmpstr, "=");
            lcb_string_appendz(&tmpstr, value);
            lcb_string_appendz(&tmpstr, "&");
        }
    }

    /* copy over the string */
    out->ctlopts = tmpstr.base;
    out->optslen = tmpstr.nused;
    tmpstr.base = NULL;
    tmpstr.nused = 0;

    /* seek ahead and set any '&' and '=' to '\0' */
    if (out->optslen) {
        tmp = out->ctlopts;
        while ((tmp = strpbrk(tmp, "&="))) {
            *tmp = '\0';
            tmp++;
        }
        /* chop off trailing '&' */
        out->optslen--;
    }

    GT_DONE:
    if (err != LCB_SUCCESS) {
        lcb_string_release(&tmpstr);
    }

    return err;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_connspec_parse(const char *connstr, lcb_CONNSPEC *out, const char **errmsg)
{
    PARSECTX ctx;
    lcb_error_t err = LCB_SUCCESS;
    const char *errmsg_s; /* stack based error message pointer */
    char *scratch_d = NULL; /* dynamically allocated scratch */
    char scratch_s[SCRATCHSIZE]; /* stack allocated scratch */
    const char *hlend; /* end of hosts list */
    const char *bucket = NULL; /* beginning of bucket (path) string */
    const char *options = NULL; /* beginning of options (query) string */
    const char *specend = NULL; /* end of spec */
    unsigned speclen; /* length of spec string */
    const char *found_scheme = NULL;

    if (!errmsg) {
        errmsg = &errmsg_s;
    }

    if (!connstr) {
        connstr = "couchbase://";
    }

    ctx.errmsg = errmsg;
    ctx.connstr = connstr;
    ctx.params = out;

    lcb_list_init(&out->hosts);
    out->transports[0] = LCB_CONFIG_TRANSPORT_LIST_END;

#define SCHEME_MATCHES(scheme_const) \
    strncmp(ctx.connstr, scheme_const, sizeof(scheme_const)-1) == 0 && \
    (found_scheme = scheme_const)

    if (SCHEME_MATCHES(LCB_SPECSCHEME_MCD_SSL)) {
        out->implicit_port = LCB_CONFIG_MCD_SSL_PORT;
        out->sslopts |= LCB_SSL_ENABLED;
        out->flags |= F_SSLSCHEME;

    } else if (SCHEME_MATCHES(LCB_SPECSCHEME_HTTP_SSL)) {
        out->implicit_port = LCB_CONFIG_HTTP_SSL_PORT;
        out->sslopts |= LCB_SSL_ENABLED;
        out->flags |= F_SSLSCHEME;

    } else if (SCHEME_MATCHES(LCB_SPECSCHEME_HTTP)) {
        out->implicit_port = LCB_CONFIG_HTTP_PORT;

    } else if (SCHEME_MATCHES(LCB_SPECSCHEME_MCD)) {
        out->implicit_port = LCB_CONFIG_MCD_PORT;

    } else if (SCHEME_MATCHES(LCB_SPECSCHEME_RAW)) {
        out->implicit_port = 0;
    } else if (SCHEME_MATCHES(LCB_SPECSCHEME_MCCOMPAT)) {
        out->implicit_port = LCB_CONFIG_MCCOMPAT_PORT;
    } else {
        /* If we don't have a scheme at all: */
        if (strstr(ctx.connstr, "://")) {
            SET_ERROR("String must begin with ''couchbase://, 'couchbases://', or 'http://'");
        } else {
            found_scheme = "";
            out->implicit_port = LCB_CONFIG_HTTP_PORT;
        }
    }

    ctx.connstr += strlen(found_scheme);
    speclen = strlen(ctx.connstr);
    specend = ctx.connstr + speclen;

    if (speclen * 3 > SCRATCHSIZE) {
        scratch_d = malloc(speclen * 2);
        ctx.scratch = scratch_d;
    } else {
        ctx.scratch = scratch_s;
    }
    ctx.decoded = ctx.scratch + speclen * 2;

    /* Hosts end where either options or the bucket itself begin */
    if ((hlend = strpbrk(ctx.connstr, "?/"))) {
        if (*hlend == '?') {
            /* Options first */
            options = hlend + 1;

        } else if (*hlend == '/') {
            /* Bucket first. Options follow bucket */
            bucket = hlend + 1;
            if ((options = strchr(bucket, '?'))) {
                options++;
            }
        }
    } else {
        hlend = specend;
    }

    if (bucket != NULL) {
        unsigned blen;
        const char *b_end = options ? options-1 : specend;
        /* scan each of the options */
        blen = b_end - bucket;
        memcpy(ctx.scratch, bucket, blen);
        ctx.scratch[blen] = '\0';
        if (! (out->flags & F_HASBUCKET)) {
            out->bucket = strdup(ctx.scratch);
            if (0 != lcb_urldecode(out->bucket, out->bucket, -1)) {
                SET_ERROR("Couldn't decode bucket string");
            }
        }
    } else if (out->bucket == NULL) {
        out->bucket = strdup("default");
    }

    if ((err = parse_hosts(&ctx, hlend)) != LCB_SUCCESS) {
        goto GT_DONE;
    }

    if (LCB_LIST_IS_EMPTY(&out->hosts)) {
        const char localhost[] = "localhost";
        lcb_HOSTSPEC *host = calloc(1, sizeof(*host) + sizeof localhost);
        memcpy(host->hostname, localhost, sizeof localhost);
        lcb_list_append(&out->hosts, &host->llnode);
    }

    if (options != NULL) {
        if ((err = parse_options(&ctx, options, specend)) != LCB_SUCCESS) {
            goto GT_DONE;
        }
    }

    if (!out->username) {
        out->username = strdup(out->bucket);
    }
    GT_DONE:

    if (err != LCB_SUCCESS) {
        lcb_connspec_clean(out);
    }

    free(scratch_d);
    return err;
}

LIBCOUCHBASE_API
void
lcb_connspec_clean(lcb_CONNSPEC *params)
{
    lcb_list_t *ll, *llnext;
    free(params->bucket);
    free(params->username);
    free(params->password);
    free(params->ctlopts);
    free(params->connstr);

    LCB_LIST_SAFE_FOR(ll, llnext, &params->hosts) {
        lcb_HOSTSPEC *host = LCB_LIST_ITEM(ll, lcb_HOSTSPEC, llnode);
        lcb_list_delete(&host->llnode);
        free(host);
    }

    memset(params, 0, sizeof *params);
    lcb_list_init(&params->hosts);
}

LIBCOUCHBASE_API
int
lcb_connspec_next_option(const lcb_CONNSPEC *params,
    const char **key, const char **value, int *ctx)
{
    if (!params->ctlopts) {
        return 0;
    }

    if (*ctx == -1) {
        return 0;
    }

    *key = params->ctlopts + *ctx;
    *ctx += strlen(*key) + 1;

    *value = params->ctlopts + *ctx;
    *ctx += strlen(*value);

    if ((unsigned)*ctx == params->optslen) {
        *ctx = -1;
    } else {
        *ctx += 1;
    }
    return 1;
}


#define MAYBEDUP(s) ((s) && (*s)) ? strdup(s) : NULL

static lcb_error_t
convert_hosts(lcb_string *outstr, const char *instr, int deflport)
{
    hostlist_t hlist;
    lcb_error_t err;
    unsigned ii;

    hlist = hostlist_create();
    if (!hlist) {
        return LCB_CLIENT_ENOMEM;
    }

    err = hostlist_add_stringz(hlist, instr, deflport);
    if (err != LCB_SUCCESS) {
        hostlist_destroy(hlist);
        return err;
    }

    for (ii = 0; ii < hlist->nentries; ii++) {
        const lcb_host_t *src = hlist->entries + ii;
        int port, rv;
        lcb_string_appendz(outstr, src->host);
        rv = sscanf(src->port, "%d", &port);
        if (rv && port != deflport) {
            const char *proto;
            char tmpbuf[256];
            if (deflport == LCB_CONFIG_MCD_PORT) {
                proto = "mcd";
            } else {
                proto = "http";
            }
            sprintf(tmpbuf, ":%d=%s", port, proto);
            lcb_string_appendz(outstr, tmpbuf);
        }
        lcb_string_appendz(outstr, ",");
    }

    hostlist_destroy(hlist);
    return LCB_SUCCESS;
}

#define TRYDUP(s) (s) ? strdup(s) : NULL
LIBCOUCHBASE_API
lcb_error_t
lcb_connspec_convert(lcb_CONNSPEC *params, const struct lcb_create_st *cropts)
{
    const char *errmsg;
    lcb_string tmpstr;
    const struct lcb_create_st2 *cr2 = &cropts->v.v2;
    lcb_error_t err = LCB_SUCCESS;

    /* handle overrides */
    if (cr2->bucket && *cr2->bucket) {
        params->flags |= F_HASBUCKET;
        params->bucket = strdup(cr2->bucket);
    }

    if (cr2->user && *cr2->user) {
        params->flags |= F_HASUSER;
        params->username = strdup(cr2->user);
    }

    if (cr2->passwd && *cr2->passwd) {
        params->flags |= F_HASPASSWD;
        params->password = strdup(cr2->passwd);
    }

    if (cropts->version == 3) {
        return lcb_connspec_parse(cropts->v.v3.connstr, params, &errmsg);
    }

    if (cropts->version > 2 || cropts->version < 0) {
        return LCB_NOT_SUPPORTED;
    }

    lcb_string_init(&tmpstr);
    lcb_string_appendz(&tmpstr, LCB_SPECSCHEME_RAW);
    lcb_list_init(&params->hosts);

    params->transports[0] = LCB_CONFIG_TRANSPORT_LIST_END;
    if (cr2->host) {
        err = convert_hosts(&tmpstr, cr2->host, LCB_CONFIG_HTTP_PORT);
        if (err != LCB_SUCCESS) {
            goto GT_DONE;
        }
    }

    if (cropts->version == 2 && cr2->mchosts) {
        err = convert_hosts(&tmpstr, cr2->mchosts, LCB_CONFIG_MCD_PORT);
        if (err != LCB_SUCCESS) {
            goto GT_DONE;
        }
    }

    lcb_string_appendz(&tmpstr, "?");

    err = lcb_connspec_parse(tmpstr.base, params, &errmsg);
    if (err == LCB_SUCCESS && cropts->version == 2 && cr2->transports) {
        /* copy over bootstrap list */
        unsigned ii, found_end = 0;
        for (ii = 0; ii < LCB_CONFIG_TRANSPORT_MAX; ii++) {
            params->transports[ii] = cr2->transports[ii];
            if (params->transports[ii] == LCB_CONFIG_TRANSPORT_LIST_END) {
                found_end = 1;
                break;
            }
        }
        if (!found_end) {
            params->transports[ii] = LCB_CONFIG_TRANSPORT_LIST_END;
        }
    }

    GT_DONE:
    if (err == LCB_SUCCESS) {
        params->connstr = tmpstr.base;
    } else {
        lcb_string_release(&tmpstr);
    }
    return err;
}
