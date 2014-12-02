/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2013 Couchbase, Inc.
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
#include "bucketconfig/clconfig.h"
#include "http/http.h"

static const char *method_strings[] = {
    "GET ",    /* LCB_HTTP_METHOD_GET */
    "POST ",   /* LCB_HTTP_METHOD_POST */
    "PUT ",    /* LCB_HTTP_METHOD_PUT */
    "DELETE "  /* LCB_HTTP_METHOD_DELETE */
};

static void request_free_headers(lcb_http_request_t req)
{
    char **cur;
    if (!req->headers) {
        return;
    }
    for (cur = req->headers; *cur; cur++) {
        free(*cur);
    }
    free(req->headers);
    req->headers = NULL;
}

static lcb_error_t render_http_preamble(lcb_http_request_t req, lcb_string *out)
{
    const char http_version[] = " HTTP/1.1\r\n";
    const char *us = req->url;
    struct http_parser_url *ui = &req->url_info;

    lcb_string_appendz(out, method_strings[req->method]);
    lcb_string_append(out, us + ui->field_data[UF_PATH].off,
                      ui->field_data[UF_PATH].len);

    if (ui->field_data[UF_QUERY].off) {
        lcb_string_append(out, us + ui->field_data[UF_QUERY].off-1,
                          ui->field_data[UF_QUERY].len+1);
    }
    lcb_string_appendz(out, http_version);
    return LCB_SUCCESS;
}

#define HTTP_HEADER_VALUE_MAX_LEN 256

static lcb_error_t add_header(lcb_http_request_t req, const char *key, const char *format, ...)
{
    va_list args;
    char buf[HTTP_HEADER_VALUE_MAX_LEN];
    lcb_http_header_t *hdr;

    hdr = calloc(1, sizeof(lcb_http_header_t));
    if (hdr == NULL) {
        return LCB_CLIENT_ENOMEM;
    }
    hdr->key = strdup(key);
    if (hdr->key == NULL) {
        return LCB_CLIENT_ENOMEM;
    }
    va_start(args, format);
    vsnprintf(buf, HTTP_HEADER_VALUE_MAX_LEN, format, args);
    va_end(args);
    hdr->val = strdup(buf);
    if (hdr->val == NULL) {
        return LCB_CLIENT_ENOMEM;
    }
    lcb_list_append(&req->headers_out.list, &hdr->list);
    return LCB_SUCCESS;
}


static void
pool_close_cb(lcbio_SOCKET *sock, int reusable, void *arg)
{
    int close_ok = *(int *)arg;

    lcbio_ref(sock);
    if (reusable && close_ok) {
        lcbio_mgr_put(sock);
    } else {
        lcbio_mgr_discard(sock);
    }
}

static void
do_close_ioctx(lcb_http_request_t req)
{
    int can_ka = 0;

    if (!req->ioctx) {
        return;
    }

    if (req->parser && req->reqtype == LCB_HTTP_TYPE_VIEW) {
        can_ka = lcbht_can_keepalive(req->parser);
    }

    lcbio_ctx_close(req->ioctx, pool_close_cb, &can_ka);
    req->ioctx = NULL;
}

void lcb_http_request_decref(lcb_http_request_t req)
{
    lcb_list_t *ii, *nn;

    assert(req->refcount > 0);
    if (--req->refcount) {
        return;
    }

    do_close_ioctx(req);
    lcbio_connreq_cancel(&req->creq);

    free(req->path);
    free(req->url);
    free(req->redirect_to);
    free(req->body);

    if (req->parser) {
        lcbht_free(req->parser);
    }
    if (req->timer) {
        lcbio_timer_destroy(req->timer);
        req->timer = NULL;
    }

    request_free_headers(req);
    LCB_LIST_SAFE_FOR(ii, nn, &req->headers_out.list) {
        lcb_http_header_t *hdr = LCB_LIST_ITEM(ii, lcb_http_header_t, list);
        lcb_list_delete(ii);
        free(hdr->key);
        free(hdr->val);
        free(hdr);
    }
    lcb_string_release(&req->outbuf);
    free(req);
}

static void maybe_refresh_config(lcb_t instance,
                                 lcb_http_request_t req, lcb_error_t err)
{
    int htstatus_ok;
    lcbht_RESPONSE *resp;
    if (!req->parser) {
        return;
    }

    if (!LCBT_SETTING(instance, refresh_on_hterr)) {
        return;
    }

    resp = lcbht_get_response(req->parser);
    htstatus_ok = resp->status >= 200 && resp->status < 299;

    if (err != LCB_SUCCESS && (err == LCB_ESOCKSHUTDOWN && htstatus_ok) == 0) {
        /* ignore graceful close */
        lcb_bootstrap_common(instance, LCB_BS_REFRESH_ALWAYS);
        return;
    }

    if (htstatus_ok) {
        return;
    }
    lcb_bootstrap_common(instance, LCB_BS_REFRESH_ALWAYS);
}


void
lcb_http_init_resp(const lcb_http_request_t req, lcb_RESPHTTP *res)
{
    const lcbht_RESPONSE *htres = lcbht_get_response(req->parser);

    res->cookie = (void*)req->command_cookie;
    res->key = req->path;
    res->nkey = req->npath;
    res->_htreq = req;
    if (req->headers) {
        res->headers = (const char * const *)req->headers;
    }
    if (htres) {
        res->htstatus = htres->status;
    }
}

void
lcb_http_request_finish(lcb_t instance, lcb_http_request_t req, lcb_error_t error)
{
    /* This is always safe to execute */
    if (req->status & LCB_HTREQ_S_NOLCB) {
        req->status |= LCB_HTREQ_S_CBINVOKED;
    } else {
        maybe_refresh_config(instance, req, error);
    }

    /* And this one too */
    if ((req->status & LCB_HTREQ_S_CBINVOKED) == 0) {
        lcb_RESPHTTP resp = { 0 };
        lcb_RESPCALLBACK target;

        lcb_http_init_resp(req, &resp);
        target = lcb_find_callback(instance, LCB_CALLBACK_HTTP);

        resp.rflags = LCB_RESP_F_FINAL;
        resp.rc = error;

        req->status |= LCB_HTREQ_S_CBINVOKED;
        target(instance, LCB_CALLBACK_HTTP, (lcb_RESPBASE*)&resp);
    }

    if (req->status & LCB_HTREQ_S_FINISHED) {
        return;
    }

    req->status |= LCB_HTREQ_S_FINISHED;

    if (!(req->status & LCB_HTREQ_S_NOLCB)) {
        /* Remove from wait queue */
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_HTTP, req);
        /* Break out from the loop (must be called after aspend_del) */
        lcb_maybe_breakout(instance);
    }

    /* Cancel the timeout */
    lcbio_timer_disarm(req->timer);
    /* Remove the initial refcount=1 (set from lcb_http3). Typically this will
     * also free the request (though this is dependent on pending I/O operations) */
    lcb_http_request_decref(req);
}

static mc_SERVER *get_view_node(lcb_t instance)
{
    /* pick random server */
    lcb_size_t nn, nn_limit;
    mc_SERVER *server;

    nn = (lcb_size_t)(gethrtime() >> 10) % LCBT_NSERVERS(instance);
    nn_limit = nn;

    do {
        server = LCBT_GET_SERVER(instance, nn);
        if (server->viewshost) {
            return server;
        }
        nn = (nn + 1) % LCBT_NSERVERS(instance);
    } while (nn != nn_limit);
    return NULL;
}

lcb_error_t lcb_http_request_exec(lcb_http_request_t req)
{
    lcb_t instance = req->instance;
    lcb_error_t rc;
    lcb_list_t *ii;
    lcb_host_t reqhost;
    lcb_string *out = &req->outbuf;

    request_free_headers(req);
    do_close_ioctx(req);
    lcbio_connreq_cancel(&req->creq);
    if (req->nhost > sizeof(reqhost.host)) {
        lcb_http_request_decref(req);
        return LCB_E2BIG;
    }

    lcb_string_clear(out);
    strncpy(reqhost.host, req->host, req->nhost);
    reqhost.host[req->nhost] = '\0';
    if (req->nport > sizeof(reqhost.port)) {
        lcb_http_request_decref(req);
        return LCB_E2BIG;
    }
    strncpy(reqhost.port, req->port, req->nport);
    reqhost.port[req->nport] = '\0';
    rc = render_http_preamble(req, out);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return LCB_EINTERNAL;
    }
    LCB_LIST_FOR(ii, &req->headers_out.list) {
        lcb_http_header_t *hh = LCB_LIST_ITEM(ii, lcb_http_header_t, list);
        lcb_string_appendz(out, hh->key);
        lcb_string_appendz(out, ": ");
        lcb_string_appendz(out, hh->val);
        lcb_string_appendz(out, "\r\n");
    }
    lcb_string_appendz(out, "\r\n");
    lcb_string_append(out, req->body, req->nbody);
    if (req->parser) {
        lcbht_reset(req->parser);
    } else {
        req->parser = lcbht_new(req->instance->settings);
    }

    rc = lcb_http_request_connect(req);
    if (rc != LCB_SUCCESS) {
        /** Mark as having the callback invoked */
        req->status |= LCB_HTREQ_S_CBINVOKED;
        lcb_http_request_finish(instance, req, rc);
    }
    return rc;
}

lcb_error_t lcb_http_verify_url(lcb_http_request_t req, const char *base, lcb_size_t nbase)
{
    unsigned int required_fields;
    const char *htscheme;
    unsigned schemsize;
    if (LCBT_SETTING(req->instance, sslopts) & LCB_SSL_ENABLED) {
        htscheme = "https://";
        schemsize = sizeof("https://");
    } else {
        htscheme = "http://";
        schemsize = sizeof("http://");
    }
    schemsize--;


    if (base) {
        lcb_string urlbuf;
        lcb_string_init(&urlbuf);
        lcb_string_appendz(&urlbuf, htscheme);

        if (nbase > schemsize && memcmp(base, htscheme, schemsize) == 0) {
            base += schemsize;
            nbase -= schemsize;
        }


        lcb_string_append(&urlbuf, base, nbase);
        if (*req->path != '/') {
            lcb_string_appendz(&urlbuf, "/");
        }
        lcb_string_append(&urlbuf, req->path, req->npath);

        req->nurl = urlbuf.nused;
        req->url = calloc(req->nurl + 1, 1);
        memcpy(req->url, urlbuf.base, req->nurl);
        lcb_string_release(&urlbuf);
    }

    required_fields = ((1 << UF_HOST) | (1 << UF_PORT) | (1 << UF_PATH));
    if (_lcb_http_parser_parse_url(req->url, req->nurl, 0, &req->url_info)
            || (req->url_info.field_set & required_fields) != required_fields) {
        return LCB_EINVAL;
    }
    return LCB_SUCCESS;
}

static lcb_error_t setup_headers(lcb_http_request_t req,
                                 const char *content_type,
                                 const char *username, const char *password)
{
    lcb_error_t rc;

    rc = add_header(req, "User-Agent", "libcouchbase/"LCB_VERSION_STRING);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    if (req->instance->http_sockpool->maxidle == 0 ||
            req->reqtype != LCB_HTTP_TYPE_VIEW) {
        rc = add_header(req, "Connection", "close");
        if (rc != LCB_SUCCESS) {
            return rc;
        }
    }

    rc = add_header(req, "Accept", "application/json");
    if (rc != LCB_SUCCESS) {
        return rc;
    }
    if (password) {
        if (username) {
            char cred[128], auth[256];
            snprintf(cred, sizeof(cred), "%s:%s", username, password);
            if (lcb_base64_encode(cred, auth, sizeof(auth)) == -1) {
                return LCB_EINVAL;
            }
            rc = add_header(req, "Authorization", "Basic %s", auth);
            if (rc != LCB_SUCCESS) {
                return rc;
            }
        }
    }
    req->nhost = req->url_info.field_data[UF_HOST].len;
    req->host = req->url + req->url_info.field_data[UF_HOST].off;
    req->nport = req->url_info.field_data[UF_PORT].len;
    req->port = req->url + req->url_info.field_data[UF_PORT].off;
    rc = add_header(req, "Host", "%.*s%.*s",
                    (int)req->nhost, req->host,
                    (int)req->nport + 1, req->port - 1);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    if (req->nbody) {
        if (content_type) {
            rc = add_header(req, "Content-Type", content_type);
            if (rc != LCB_SUCCESS) {
                return rc;
            }
        }
        rc = add_header(req, "Content-Length", "%ld", (long)req->nbody);
        if (rc != LCB_SUCCESS) {
            return rc;
        }
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_http3(lcb_t instance, const void *cookie, const lcb_CMDHTTP *cmd)
{
    lcb_http_request_t req;
    const char *base = NULL, *username, *password, *path;
    lcb_size_t nbase, npath;
    lcb_http_method_t method;
    lcb_error_t rc;
    lcb_http_request_t *request = cmd->reqhandle;

    if ((npath = cmd->key.contig.nbytes) == 0) {
        path = "/";
        npath = 1;
    } else {
        path = cmd->key.contig.bytes;
    }

    if ((method = cmd->method) > LCB_HTTP_METHOD_MAX) {
        return LCB_EINVAL;
    }

    username = cmd->username;
    password = cmd->password;

    if (cmd->type == LCB_HTTP_TYPE_RAW) {
        if ((base = cmd->host) == NULL) {
            return LCB_EINVAL;
        }
    } else {
        if (cmd->host) {
            return LCB_EINVAL;
        }

        if (username == NULL && password == NULL) {
            username = LCBT_SETTING(instance, username);
            password = LCBT_SETTING(instance, password);
        }

        if (cmd->type == LCB_HTTP_TYPE_VIEW) {
            const mc_SERVER *server;
            if (!LCBT_VBCONFIG(instance)) {
                return LCB_CLIENT_ETMPFAIL;
            }
            if ((server = get_view_node(instance)) == NULL) {
                return LCB_NOT_SUPPORTED;
            }
            base = server->viewshost;
        } else {
            base = lcb_get_node(instance, LCB_NODE_HTCONFIG, 0);
            if (base == NULL || *base == '\0') {
                return LCB_CLIENT_ETMPFAIL;
            }
        }
    }

    if (base) {
        nbase = strlen(base);
    }

    req = calloc(1, sizeof(struct lcb_http_request_st));
    if (!req) {
        return LCB_CLIENT_ENOMEM;
    }
    if (request) {
        *request = req;
    }
    req->refcount = 1;
    req->instance = instance;
    req->io = instance->iotable;
    req->command_cookie = cookie;
    req->chunked = cmd->cmdflags & LCB_CMDHTTP_F_STREAM;
    req->method = method;
    req->reqtype = cmd->type;
    lcb_list_init(&req->headers_out.list);
    if ((method == LCB_HTTP_METHOD_POST || method == LCB_HTTP_METHOD_PUT) &&
            (req->nbody = cmd->nbody)) {
        if ((req->body = malloc(req->nbody)) == NULL) {
            lcb_http_request_decref(req);
            return LCB_CLIENT_ENOMEM;
        }
        memcpy(req->body, cmd->body, req->nbody);
    }

    rc = lcb_urlencode_path(path, npath, &req->path, &req->npath);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return rc;
    }
    rc = lcb_http_verify_url(req, base, nbase);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return rc;
    }
    rc = setup_headers(req, cmd->content_type, username, password);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return rc;
    }

    rc = lcb_http_request_exec(req);
    if (rc == LCB_SUCCESS) {
        lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_HTTP, req);
    }
    return rc;

}

LIBCOUCHBASE_API
lcb_error_t lcb_make_http_request(lcb_t instance,
    const void *cookie, lcb_http_type_t type, const lcb_http_cmd_t *cmd,
    lcb_http_request_t *request)
{
    lcb_CMDHTTP htcmd = { 0 };
    lcb_error_t err;
    const lcb_HTTPCMDv0 *cmdbase = &cmd->v.v0;

    LCB_CMD_SET_KEY(&htcmd, cmdbase->path, cmdbase->npath);
    htcmd.type = type;
    htcmd.body = cmdbase->body;
    htcmd.nbody = cmdbase->nbody;
    htcmd.content_type = cmdbase->content_type;
    htcmd.method = cmdbase->method;
    htcmd.reqhandle = request;

    if (cmd->version == 1) {
        htcmd.username = cmd->v.v1.username;
        htcmd.password = cmd->v.v1.password;
        htcmd.host = cmd->v.v1.host;
    }
    if (cmdbase->chunked) {
        htcmd.cmdflags |= LCB_CMDHTTP_F_STREAM;
    }

    err = lcb_http3(instance, cookie, &htcmd);
    if (err == LCB_SUCCESS) {
        SYNCMODE_INTERCEPT(instance);
    }
    return err;
}

LIBCOUCHBASE_API
void lcb_cancel_http_request(lcb_t instance, lcb_http_request_t request)
{
    if (request->status & (LCB_HTREQ_S_FINISHED|LCB_HTREQ_S_CBINVOKED)) {
        /* Nothing to cancel */
        return;
    }
    request->status |= LCB_HTREQ_S_CBINVOKED;
    lcb_http_request_finish(instance, request, LCB_SUCCESS);
}

