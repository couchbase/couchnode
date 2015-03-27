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

#include "internal.h"
#include "clconfig.h"
#include "bc_http.h"
#include <lcbio/ssl.h>
#include "ctx-log-inl.h"
#define LOGARGS(ht, lvlbase) ht->base.parent->settings, "htconfig", LCB_LOG_##lvlbase, __FILE__, __LINE__
#define LOGFMT "<%s:%s> "
#define LOGID(h) get_ctx_host(h->ioctx), get_ctx_port(h->ioctx)

static void io_error_handler(lcbio_CTX *, lcb_error_t);
static void on_connected(lcbio_SOCKET *, void *, lcb_error_t, lcbio_OSERR);
static lcb_error_t connect_next(http_provider *);
static void read_common(lcbio_CTX *, unsigned);
static lcb_error_t setup_request_header(http_provider *, const lcb_host_t *);

/**
 * Determine if we're in compatibility mode with the previous versions of the
 * library - where the idle timeout is disabled and a perpetual streaming
 * connection will always remain open (regardless of whether it was triggered
 * by start_refresh/get_refresh).
 */
static int is_v220_compat(http_provider *http)
{
    lcb_uint32_t setting =  PROVIDER_SETTING(&http->base, bc_http_stream_time);
    if (setting == (lcb_uint32_t)-1) {
        return 1;
    }
    return 0;
}

/**
 * Closes the current connection and removes the disconn timer along with it
 */
static void close_current(http_provider *http)
{
    lcbio_timer_disarm(http->disconn_timer);
    if (http->ioctx) {
        lcbio_ctx_close(http->ioctx, NULL, NULL);
    } else if (http->creq){
        lcbio_connect_cancel(http->creq);
    }
    http->creq = NULL;
    http->ioctx = NULL;
}

/**
 * Call when there is an error in I/O. This includes read, write, connect
 * and timeouts.
 */
static lcb_error_t
io_error(http_provider *http, lcb_error_t origerr)
{
    lcb_confmon *mon = http->base.parent;
    lcb_settings *settings = mon->settings;

    close_current(http);

    http->creq = lcbio_connect_hl(
            mon->iot, settings, http->nodes, 0, settings->config_node_timeout,
            on_connected, http);
    if (http->creq) {
        return LCB_SUCCESS;
    }

    lcb_confmon_provider_failed(&http->base, origerr);
    lcbio_timer_disarm(http->io_timer);
    if (is_v220_compat(http) && http->base.parent->config != NULL) {
        lcb_log(LOGARGS(http, INFO), "HTTP node list finished. Trying to obtain connection from first node in list");
        if (!lcbio_timer_armed(http->as_reconnect)) {
            lcbio_timer_rearm(http->as_reconnect,
                PROVIDER_SETTING(&http->base, grace_next_cycle));
        }
    }
    return origerr;
}

/**
 * Call this if the configuration generation has changed.
 */
static void set_new_config(http_provider *http)
{
    const lcb_host_t *curhost;
    if (http->current_config) {
        lcb_clconfig_decref(http->current_config);
    }

    curhost = lcbio_get_host(lcbio_ctx_sock(http->ioctx));
    http->current_config = http->last_parsed;
    lcb_clconfig_incref(http->current_config);
    lcbvb_replace_host(http->current_config->vbc, curhost->host);
    lcb_confmon_provider_success(&http->base, http->current_config);
}

static lcb_error_t
process_chunk(http_provider *http, const void *buf, unsigned nbuf)
{
    lcb_error_t err = LCB_SUCCESS;
    char *term;
    int rv;
    lcbvb_CONFIG *cfgh;
    lcbht_RESPSTATE state, oldstate, diff;
    lcbht_RESPONSE *resp = lcbht_get_response(http->htp);

    oldstate = resp->state;
    state = lcbht_parse(http->htp, buf, nbuf);
    diff = state ^ oldstate;

    if (state & LCBHT_S_ERROR) {
        return LCB_PROTOCOL_ERROR;
    }

    if (diff & LCBHT_S_HEADER) {
        /* see that we got a success? */
        if (resp->status == 200) {
            /* nothing */
        } else if (resp->status == 404) {
            const int urlmode = PROVIDER_SETTING(&http->base, bc_http_urltype);
            err = LCB_BUCKET_ENOENT;

            if (++http->uritype > LCB_HTCONFIG_URLTYPE_COMPAT) {
                lcb_log(LOGARGS(http, ERR), LOGFMT "Got 404 on config stream. Assuming bucket does not exist as we've tried both URL types", LOGID(http));
                goto GT_HT_ERROR;

            } else if ((urlmode & LCB_HTCONFIG_URLTYPE_COMPAT) == 0) {
                lcb_log(LOGARGS(http, ERR), LOGFMT "Got 404 on config stream for terse URI. Compat URI disabled, so not trying", LOGID(http));

            } else {
                /* reissue the request; but wait for it to drain */
                lcb_log(LOGARGS(http, WARN), LOGFMT "Got 404 on config stream. Assuming terse URI not supported on cluster", LOGID(http));
                http->try_nexturi = 1;
                err = LCB_SUCCESS;
                goto GT_CHECKDONE;
            }
        } else if (resp->status == 401) {
            err = LCB_AUTH_ERROR;
        } else {
            err = LCB_ERROR;
        }

        GT_HT_ERROR:
        if (err != LCB_SUCCESS) {
            lcb_log(LOGARGS(http, ERR), LOGFMT "Got non-success HTTP status code %d", LOGID(http), resp->status);
            return err;
        }
    }

    GT_CHECKDONE:
    if (http->try_nexturi) {
        lcb_host_t *host;
        if (!(state & LCBHT_S_DONE)) {
            return LCB_SUCCESS;
        }
        host = lcbio_get_host(lcbio_ctx_sock(http->ioctx));
        http->try_nexturi = 0;
        if ((err = setup_request_header(http, host)) != LCB_SUCCESS) {
            return err;
        }

        /* reset the state? */
        lcbht_reset(http->htp);
        lcbio_ctx_put(http->ioctx, http->request_buf, strlen(http->request_buf));
        return LCB_SUCCESS;
    }

    if (PROVIDER_SETTING(&http->base, conntype) == LCB_TYPE_CLUSTER) {
        /* don't bother with parsing the actual config */
        resp->body.nused = 0;
        return LCB_SUCCESS;
    }
    if (!(state & LCBHT_S_BODY)) {
        /* nothing to parse yet */
        return LCB_SUCCESS;
    }

    /* seek ahead for strstr */
    term = strstr(resp->body.base, CONFIG_DELIMITER);
    if (!term) {
        return LCB_SUCCESS;
    }

    *term = '\0';
    cfgh = lcbvb_create();
    if (!cfgh) {
        return LCB_CLIENT_ENOMEM;
    }
    rv = lcbvb_load_json(cfgh, resp->body.base);
    if (rv != 0) {
        lcb_log(LOGARGS(http, ERR), LOGFMT "Failed to parse a valid config from HTTP stream: %s", LOGID(http), cfgh->errstr);
        lcbvb_destroy(cfgh);
        return LCB_PROTOCOL_ERROR;
    }
    if (http->last_parsed) {
        lcb_clconfig_decref(http->last_parsed);
    }
    http->last_parsed = lcb_clconfig_create(cfgh, LCB_CLCONFIG_HTTP);
    http->last_parsed->cmpclock = gethrtime();
    http->generation++;

    /** Relocate the stream */
    lcb_string_erase_beginning(&resp->body,
        (term+sizeof(CONFIG_DELIMITER)-1)-resp->body.base);

    return LCB_SUCCESS;
}

/**
 * Common function to handle parsing the HTTP stream for both v0 and v1 io
 * implementations.
 */
static void
read_common(lcbio_CTX *ctx, unsigned nr)
{
    lcbio_CTXRDITER riter;
    http_provider *http = lcbio_ctx_data(ctx);
    int old_generation = http->generation;

    lcb_log(LOGARGS(http, TRACE), LOGFMT "Received %d bytes on HTTP stream", LOGID(http), nr);

    lcbio_timer_rearm(http->io_timer,
                      PROVIDER_SETTING(&http->base, config_node_timeout));

    LCBIO_CTX_ITERFOR(ctx, &riter, nr) {
        unsigned nbuf = lcbio_ctx_risize(&riter);
        void *buf = lcbio_ctx_ribuf(&riter);
        lcb_error_t err = process_chunk(http, buf, nbuf);

        if (err != LCB_SUCCESS) {
            io_error(http, err);
            return;
        }
    }

    if (http->generation != old_generation) {
        lcb_log(LOGARGS(http, DEBUG), LOGFMT "Generation %d -> %d", LOGID(http), old_generation, http->generation);
        lcbio_timer_disarm(http->io_timer);
        set_new_config(http);
    }

    lcbio_ctx_rwant(ctx, 1);
    lcbio_ctx_schedule(ctx);
}

static lcb_error_t
setup_request_header(http_provider *http, const lcb_host_t *host)
{
    lcb_settings *settings = http->base.parent->settings;

    char *buf = http->request_buf;
    lcb_size_t nbuf = sizeof(http->request_buf);

    lcb_size_t offset = 0;
    http->request_buf[0] = '\0';

    if (settings->conntype == LCB_TYPE_BUCKET) {
        const char *fmt;
        if (http->uritype == LCB_HTCONFIG_URLTYPE_25PLUS) {
            fmt = REQBUCKET_TERSE_FMT;
        } else {
            fmt = REQBUCKET_COMPAT_FMT;
        }
        offset = snprintf(buf, nbuf, fmt, settings->bucket);

    } else if (settings->conntype == LCB_TYPE_CLUSTER) {
        offset = snprintf(buf, nbuf, REQPOOLS_FMT);

    } else {
        return LCB_EINVAL;
    }

    if (settings->password) {
        char cred[256], b64[256];
        snprintf(cred, sizeof(cred), "%s:%s",
                 settings->username, settings->password);

        if (lcb_base64_encode(cred, b64, sizeof(b64)) == -1) {
            return LCB_EINTERNAL;
        }

        offset += snprintf(buf + offset, nbuf - offset, AUTHDR_FMT, b64);
    }

    offset += snprintf(buf + offset, nbuf - offset, HOSTHDR_FMT,
                       host->host, host->port);

    offset += snprintf(buf + offset, nbuf - offset, "%s\r\n", LAST_HTTP_HEADER);

    return LCB_SUCCESS;
}

static void reset_stream_state(http_provider *http)
{
    const int urlmode = PROVIDER_SETTING(&http->base, bc_http_urltype);
    if (http->last_parsed) {
        lcb_clconfig_decref(http->last_parsed);
        http->last_parsed = NULL;
    }
    if (urlmode & LCB_HTCONFIG_URLTYPE_25PLUS) {
        http->uritype = LCB_HTCONFIG_URLTYPE_25PLUS;
    } else {
        http->uritype = LCB_HTCONFIG_URLTYPE_COMPAT;
    }
    http->try_nexturi = 0;
    lcbht_reset(http->htp);
}

static void
on_connected(lcbio_SOCKET *sock, void *arg, lcb_error_t err, lcbio_OSERR syserr)
{
    http_provider *http = arg;
    lcb_host_t *host;
    lcbio_CTXPROCS procs;
    http->creq = NULL;

    if (err != LCB_SUCCESS) {
        lcb_log(LOGARGS(http, ERR), "Connection to REST API failed with code=0x%x (%d)", err, syserr);
        io_error(http, err);
        return;
    }
    host = lcbio_get_host(sock);
    lcb_log(LOGARGS(http, DEBUG), "Successfuly connected to REST API %s:%s", host->host, host->port);

    lcbio_sslify_if_needed(sock, http->base.parent->settings);
    reset_stream_state(http);

    if ((err = setup_request_header(http, host)) != LCB_SUCCESS) {
        lcb_log(LOGARGS(http, ERR), "Couldn't setup request header");
        io_error(http, err);
        return;
    }

    memset(&procs, 0, sizeof(procs));
    procs.cb_err = io_error_handler;
    procs.cb_read = read_common;
    http->ioctx = lcbio_ctx_new(sock, http, &procs);
    http->ioctx->subsys = "bc_http";

    lcbio_ctx_put(http->ioctx, http->request_buf, strlen(http->request_buf));
    lcbio_ctx_rwant(http->ioctx, 1);
    lcbio_ctx_schedule(http->ioctx);
    lcbio_timer_rearm(http->io_timer,
                      PROVIDER_SETTING(&http->base, config_node_timeout));
}

static void
timeout_handler(void *arg)
{
    http_provider *http = arg;

    lcb_log(LOGARGS(http, ERR), LOGFMT "HTTP Provider timed out waiting for I/O", LOGID(http));

    /**
     * If we're not the current provider then ignore the timeout until we're
     * actively requested to do so
     */
    if (&http->base != http->base.parent->cur_provider ||
            lcb_confmon_is_refreshing(http->base.parent) == 0) {
        lcb_log(LOGARGS(http, DEBUG), LOGFMT "Ignoring timeout because we're either not in a refresh or not the current provider", LOGID(http));
        return;
    }

    io_error(http, LCB_ETIMEDOUT);
}


static lcb_error_t
connect_next(http_provider *http)
{
    lcb_settings *settings = http->base.parent->settings;
    lcb_log(LOGARGS(http, TRACE), "Starting HTTP Configuration Provider %p", (void*)http);
    close_current(http);
    lcbio_timer_disarm(http->as_reconnect);

    if (!http->nodes->nentries) {
        lcb_log(LOGARGS(http, ERROR), "Not scheduling HTTP provider since no nodes have been configured for HTTP bootstrap");
        return LCB_CONNECT_ERROR;
    }

    http->creq = lcbio_connect_hl(http->base.parent->iot, settings, http->nodes, 1,
                                  settings->config_node_timeout, on_connected, http);
    if (http->creq) {
        return LCB_SUCCESS;
    }
    lcb_log(LOGARGS(http, ERROR), "%p: Couldn't schedule connection", (void*)http);
    return LCB_CONNECT_ERROR;
}

static void delayed_disconn(void *arg)
{
    http_provider *http = arg;
    lcb_log(LOGARGS(http, DEBUG), "Stopping HTTP provider %p", (void*)http);

    /** closes the connection and cleans up the timer */
    close_current(http);
    lcbio_timer_disarm(http->io_timer);
}

static void delayed_reconnect(void *arg)
{
    http_provider *http = arg;
    lcb_error_t err;
    if (http->ioctx) {
        /* have a context already */
        return;
    }
    err = connect_next(http);
    if (err != LCB_SUCCESS) {
        io_error(http, err);
    }
}

static lcb_error_t pause_http(clconfig_provider *pb)
{
    http_provider *http = (http_provider *)pb;
    if (is_v220_compat(http)) {
        return LCB_SUCCESS;
    }

    if (!lcbio_timer_armed(http->disconn_timer)) {
        lcbio_timer_rearm(http->disconn_timer,
                          PROVIDER_SETTING(pb, bc_http_stream_time));
    }
    return LCB_SUCCESS;
}

static lcb_error_t get_refresh(clconfig_provider *provider)
{
    http_provider *http = (http_provider *)provider;

    /**
     * We want a grace interval here because we might already be fetching a
     * connection. HOWEVER we don't want to indefinitely wait on a socket
     * so we issue a timer indicating how long we expect to wait for a
     * streaming update until we get something.
     */

    /** If we need a new socket, we do connect_next. */
    if (http->ioctx == NULL && http->creq == NULL) {
        lcbio_async_signal(http->as_reconnect);
    }

    lcbio_timer_disarm(http->disconn_timer);
    if (http->ioctx) {
        lcbio_timer_rearm(http->io_timer,
                          PROVIDER_SETTING(provider, config_node_timeout));
    }
    return LCB_SUCCESS;
}

static clconfig_info* http_get_cached(clconfig_provider *provider)
{
    http_provider *http = (http_provider *)provider;
    return http->current_config;
}

static void
config_updated(clconfig_provider *pb, lcbvb_CONFIG *newconfig)
{
    unsigned int ii;
    http_provider *http = (http_provider *)pb;
    lcb_SSLOPTS sopts;
    lcbvb_SVCMODE mode;

    hostlist_clear(http->nodes);

    sopts = PROVIDER_SETTING(pb, sslopts);
    if (sopts & LCB_SSL_ENABLED) {
        mode = LCBVB_SVCMODE_SSL;
    } else {
        mode = LCBVB_SVCMODE_PLAIN;
    }

    for (ii = 0; ii < newconfig->nsrv; ++ii) {
        const char *ss;
        lcb_error_t status;
        ss = lcbvb_get_hostport(newconfig, ii, LCBVB_SVCTYPE_MGMT, mode);
        if (!ss) {
            /* not supported? */
            continue;
        }
        status = hostlist_add_stringz(http->nodes, ss, LCB_CONFIG_HTTP_PORT);
        lcb_assert(status == LCB_SUCCESS);
    }
    if (!http->nodes->nentries) {
        lcb_log(LOGARGS(http, FATAL), "New nodes do not contain management ports");
    }

    if (PROVIDER_SETTING(pb, randomize_bootstrap_nodes)) {
        hostlist_randomize(http->nodes);
    }
}

static void
configure_nodes(clconfig_provider *pb, const hostlist_t newnodes)
{
    unsigned ii;
    http_provider *http = (void *)pb;
    hostlist_clear(http->nodes);
    for (ii = 0; ii < newnodes->nentries; ii++) {
        hostlist_add_host(http->nodes, newnodes->entries + ii);
    }
}

static hostlist_t
get_nodes(const clconfig_provider *pb)
{
    return ((http_provider *)pb)->nodes;
}

static void shutdown_http(clconfig_provider *provider)
{
    http_provider *http = (http_provider *)provider;
    reset_stream_state(http);
    close_current(http);
    lcbht_free(http->htp);

    if (http->current_config) {
        lcb_clconfig_decref(http->current_config);
    }
    if (http->disconn_timer) {
        lcbio_timer_destroy(http->disconn_timer);
    }
    if (http->io_timer) {
        lcbio_timer_destroy(http->io_timer);
    }
    if (http->as_reconnect) {
        lcbio_timer_destroy(http->as_reconnect);
    }
    if (http->nodes) {
        hostlist_destroy(http->nodes);
    }
    free(http);
}

static void
do_http_dump(clconfig_provider *pb, FILE *fp)
{
    http_provider *ht = (http_provider *)pb;
    fprintf(fp, "## BEGIN HTTP PROVIDER DUMP\n");
    fprintf(fp, "NUMBER OF CONFIGS RECEIVED: %u\n", ht->generation);
    fprintf(fp, "DUMPING I/O TIMER\n");
    lcbio_timer_dump(ht->io_timer, fp);
    if (ht->ioctx) {
        fprintf(fp, "DUMPING CURRENT CONNECTION:\n");
        lcbio_ctx_dump(ht->ioctx, fp);
    } else if (ht->creq) {
        fprintf(fp, "CURRENTLY CONNECTING..\n");
    } else {
        fprintf(fp, "NO CONNECTION ACTIVE\n");
    }
}

clconfig_provider * lcb_clconfig_create_http(lcb_confmon *parent)
{
    http_provider *http = calloc(1, sizeof(*http));

    if (!http) {
        return NULL;
    }

    if (! (http->nodes = hostlist_create())) {
        free(http);
        return NULL;
    }

    http->base.type = LCB_CLCONFIG_HTTP;
    http->base.refresh = get_refresh;
    http->base.pause = pause_http;
    http->base.get_cached = http_get_cached;
    http->base.shutdown = shutdown_http;
    http->base.config_updated = config_updated;
    http->base.configure_nodes = configure_nodes;
    http->base.get_nodes = get_nodes;
    http->base.dump = do_http_dump;
    http->base.enabled = 0;
    http->io_timer = lcbio_timer_new(parent->iot, http, timeout_handler);
    http->disconn_timer = lcbio_timer_new(parent->iot, http, delayed_disconn);
    http->as_reconnect = lcbio_timer_new(parent->iot, http, delayed_reconnect);
    http->htp = lcbht_new(parent->settings);
    return &http->base;
}

static void
io_error_handler(lcbio_CTX *ctx, lcb_error_t err)
{
    io_error((http_provider *)lcbio_ctx_data(ctx), err);
}

void lcb_clconfig_http_enable(clconfig_provider *http)
{
    http->enabled = 1;
}

lcbio_SOCKET *
lcb_confmon_get_rest_connection(lcb_confmon *mon)
{
    http_provider *http = (http_provider *)mon->all_providers[LCB_CLCONFIG_HTTP];
    if (!http->ioctx) {
        return NULL;
    }
    return lcbio_ctx_sock(http->ioctx);

}

lcb_host_t *
lcb_confmon_get_rest_host(lcb_confmon *mon)
{
    lcbio_SOCKET *sock = lcb_confmon_get_rest_connection(mon);
    if (sock) {
        return lcbio_get_host(sock);
    }
    return NULL;
}
