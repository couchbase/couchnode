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

void lcb_http_request_decref(lcb_http_request_t req)
{
    lcb_list_t *ii, *nn;

    if (--req->refcount) {
        return;
    }

    if (req->ioctx) {
        lcbio_ctx_close(req->ioctx, NULL, NULL);
        req->ioctx = NULL;
    }
    lcbio_connreq_cancel(&req->creq);

    free(req->path);
    free(req->url);
    free(req->redirect_to);

    if (req->parser) {
        lcbht_free(req->parser);
    }
    if (req->io_timer) {
        lcb_timer_destroy(NULL, req->io_timer);
        req->io_timer = NULL;
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
    memset(req, 0xff, sizeof(struct lcb_http_request_st));
    free(req);
}

void lcb_setup_lcb_http_resp_t(lcb_http_resp_t *resp,
                               lcb_http_status_t status,
                               const char *path,
                               lcb_size_t npath,
                               const char *const *headers,
                               const void *bytes,
                               lcb_size_t nbytes)
{
    memset(resp, 0, sizeof(*resp));
    resp->version = 0;
    resp->v.v0.status = status;
    resp->v.v0.path = path;
    resp->v.v0.npath = npath;
    resp->v.v0.headers = headers;
    resp->v.v0.bytes = bytes;
    resp->v.v0.nbytes = nbytes;
}

static void maybe_refresh_config(lcb_t instance,
                                 lcb_http_request_t req, lcb_error_t err)
{
    int htstatus_ok;
    lcbht_RESPONSE *resp;
    if (!req->parser) {
        return;
    }
    resp = lcbht_get_response(req->parser);
    htstatus_ok = resp->status >= 200 && resp->status < 299;

    if (err != LCB_SUCCESS && (err == LCB_ESOCKSHUTDOWN && htstatus_ok) == 0) {
        /* ignore graceful close */
        lcb_bootstrap_refresh(instance);
        return;
    }

    if (htstatus_ok) {
        return;
    }

    lcb_bootstrap_refresh(instance);
}

void lcb_http_request_finish(lcb_t instance,
                             lcb_http_request_t req,
                             lcb_error_t error)
{

    maybe_refresh_config(instance, req, error);

    if ((req->status & LCB_HTREQ_S_CBINVOKED) == 0 && req->on_complete) {
        lcb_http_resp_t resp;
        lcbht_RESPONSE *htres = lcbht_get_response(req->parser);
        lcb_setup_lcb_http_resp_t(&resp,
                                  htres->status,
                                  req->path,
                                  req->npath,
                                  NULL, /* headers */
                                  NULL, /* data */
                                  0);
        req->on_complete(req, instance, req->command_cookie, error, &resp);
    }
    req->status |= LCB_HTREQ_S_CBINVOKED;

    lcb_cancel_http_request(instance, req);
    lcb_http_request_decref(req);
}

static lcb_server_t *get_view_node(lcb_t instance)
{
    /* pick random server */
    lcb_size_t nn, nn_limit;
    lcb_server_t *server;

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
    if (req->ioctx) {
        lcbio_ctx_close(req->ioctx, NULL, NULL);
        req->ioctx = NULL;
    }

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

    lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_HTTP, req);

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
    rc = add_header(req, "Connection", "close");
    if (rc != LCB_SUCCESS) {
        return rc;
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

    if (req->method == LCB_HTTP_METHOD_PUT || req->method == LCB_HTTP_METHOD_POST) {
        rc = add_header(req, "Content-Type", content_type);
        if (rc != LCB_SUCCESS) {
            return rc;
        }
        rc = add_header(req, "Content-Length", "%ld", (long)req->nbody);
        if (rc != LCB_SUCCESS) {
            return rc;
        }
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
lcb_error_t lcb_make_http_request(lcb_t instance,
                                  const void *command_cookie,
                                  lcb_http_type_t type,
                                  const lcb_http_cmd_t *cmd,
                                  lcb_http_request_t *request)
{
    lcb_http_request_t req;
    const char *username = NULL, *body, *path, *content_type;
    char *password = NULL, *base = NULL;
    lcb_size_t nbase, nbody, npath;
    lcb_http_method_t method;
    int chunked;
    lcb_error_t rc;
    lcb_settings *settings = instance->settings;

    switch (instance->type) {
    case LCB_TYPE_CLUSTER:
        if (type != LCB_HTTP_TYPE_MANAGEMENT) {
            return LCB_EBADHANDLE;
        }
        break;
    case LCB_TYPE_BUCKET:
        /* we need a vbucket config before we can start getting data.. */
        if (LCBT_VBCONFIG(instance) == NULL) {
            return LCB_CLIENT_ETMPFAIL;
        }
        break;
    }
    switch (cmd->version) {
    case 0:
        method = cmd->v.v0.method;
        chunked = cmd->v.v0.chunked;
        npath = cmd->v.v0.npath;
        path = cmd->v.v0.path;
        nbody = cmd->v.v0.nbody;
        body = cmd->v.v0.body;
        content_type = cmd->v.v0.content_type;
        if (type != LCB_HTTP_TYPE_VIEW && type != LCB_HTTP_TYPE_MANAGEMENT) {
            return LCB_EINVAL;
        }
        if (type == LCB_HTTP_TYPE_VIEW && instance->type != LCB_TYPE_BUCKET) {
            return LCB_EINVAL;
        }
        break;
    case 1:
        method = cmd->v.v1.method;
        chunked = cmd->v.v1.chunked;
        npath = cmd->v.v1.npath;
        path = cmd->v.v1.path;
        nbody = cmd->v.v1.nbody;
        body = cmd->v.v1.body;
        content_type = cmd->v.v1.content_type;
        if (type != LCB_HTTP_TYPE_RAW) {
            return LCB_EINVAL;
        }
        break;
    default:
        return LCB_EINVAL;
    }
    if (method >= LCB_HTTP_METHOD_MAX) {
        return LCB_EINVAL;
    }
    switch (type) {
    case LCB_HTTP_TYPE_VIEW: {
        lcb_server_t *server;
        if (instance->type != LCB_TYPE_BUCKET) {
            return LCB_EINVAL;
        }
        server = get_view_node(instance);
        if (!server) {
            return LCB_NOT_SUPPORTED;
        }
        base = server->viewshost;
        nbase = strlen(base);
        username = settings->username;

        if (settings->password && *settings->password) {
            password = strdup(settings->password);
            if (!password) {
                return LCB_CLIENT_ENOMEM;
            }
        }
    }
    break;
    case LCB_HTTP_TYPE_MANAGEMENT:
    {
        const char *tmphost = lcb_get_host(instance);
        const char *tmpport = lcb_get_port(instance);
        if (tmphost == NULL || *tmphost == '\0' ||
                tmpport == NULL || *tmpport == '\0') {
            return LCB_CLIENT_ETMPFAIL;
        }

        nbase = strlen(tmphost) + strlen(tmpport) + 2;
        base = calloc(nbase, sizeof(char));
        if (!base) {
            return LCB_CLIENT_ENOMEM;
        }
        if (snprintf(base, nbase, "%s:%s", tmphost, tmpport) < 0) {
            return LCB_CLIENT_ENOMEM;
        }
        nbase -= 1; /* skip '\0' */
        username = settings->username;
        if (settings->password) {
            password = strdup(settings->password);
        }
        break;
    }
    case LCB_HTTP_TYPE_RAW:
        base = (char *)cmd->v.v1.host;
        nbase = strlen(base);
        username = cmd->v.v1.username;
        if (cmd->v.v1.password) {
            password = strdup(cmd->v.v1.password);
            if (!password) {
                return LCB_CLIENT_ENOMEM;
            }
        }
        break;
    default:
        return LCB_EINVAL;
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
    req->command_cookie = command_cookie;
    req->chunked = chunked;
    req->method = method;
    req->on_complete = instance->callbacks.http_complete;
    req->on_data = instance->callbacks.http_data;
    req->reqtype = type;
    lcb_list_init(&req->headers_out.list);
    req->nbody = nbody;
    if (req->nbody) {
        req->body = malloc(req->nbody);
        if (req->body == NULL) {
            lcb_http_request_decref(req);
            return LCB_CLIENT_ENOMEM;
        }
        memcpy(req->body, body, nbody);
    }

    if (!npath) {
        path = "/";
        npath = 1;
    }

    rc = lcb_urlencode_path(path, npath, &req->path, &req->npath);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return rc;
    }
    rc = lcb_http_verify_url(req, base, nbase);
    if (type == LCB_HTTP_TYPE_MANAGEMENT) {
        free(base);
    }
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return rc;
    }
    rc = setup_headers(req, content_type, username, password);
    free(password);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return rc;
    }

    rc = lcb_http_request_exec(req);
    return rc;
}

LIBCOUCHBASE_API
void lcb_cancel_http_request(lcb_t instance, lcb_http_request_t request)
{
    if (request->status & LCB_HTREQ_S_HTREMOVED) {
        return;
    }

    request->status = LCB_HTREQ_S_HTREMOVED | LCB_HTREQ_S_CBINVOKED;
    if (request->instance) {
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_HTTP, request);
    }
    request->instance = NULL;

    if (request->io_timer) {
        lcb_timer_destroy(NULL, request->io_timer);
        request->io_timer = NULL;
    }

    lcb_maybe_breakout(instance);
}
