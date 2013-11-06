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

static const char *method_strings[] = {
    "GET ",    /* LCB_HTTP_METHOD_GET */
    "POST ",   /* LCB_HTTP_METHOD_POST */
    "PUT ",    /* LCB_HTTP_METHOD_PUT */
    "DELETE "  /* LCB_HTTP_METHOD_DELETE */
};

static void request_free_headers(lcb_http_request_t req)
{
    struct lcb_http_header_st *tmp, *hdr = req->headers_list;

    while (hdr) {
        tmp = hdr->next;
        free(hdr->data);
        free(hdr);
        hdr = tmp;
    }
    free((void *)req->headers);
    req->headers = NULL;
    req->nheaders = 0;
    req->headers_list = NULL;
}

static lcb_error_t render_http_preamble(lcb_http_request_t req, ringbuffer_t *out)
{
    const char http_version[] = " HTTP/1.1\r\n";
    lcb_size_t sz;
    const char *method = method_strings[req->method];

    sz = strlen(method) + req->url_info.field_data[UF_PATH].len + sizeof(http_version);
    if (req->url_info.field_set & UF_QUERY) {
        sz += (lcb_size_t)req->url_info.field_data[UF_QUERY].len + 1;
    }
    if (ringbuffer_ensure_capacity(out, sz) == 0) {
        return LCB_CLIENT_ENOMEM;
    }
    sz = strlen(method);
    lcb_assert(ringbuffer_write(out, method, sz) == sz);
    sz = req->url_info.field_data[UF_PATH].len;
    lcb_assert(ringbuffer_write(out, req->url + req->url_info.field_data[UF_PATH].off, sz) == sz);
    sz = req->url_info.field_data[UF_QUERY].len; /* include '?' */
    if (sz) {
        lcb_assert(ringbuffer_write(out, req->url + req->url_info.field_data[UF_QUERY].off - 1, sz + 1) == sz + 1);
    }
    sz = strlen(http_version);
    lcb_assert(ringbuffer_write(out, http_version, sz) == sz);
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

    lcb_connection_cleanup(&req->connection);

    free(req->path);
    free(req->url);
    free(req->redirect_to);

    if (req->parser) {
        free(req->parser->data);
    }
    free(req->parser);
    ringbuffer_destruct(&req->result);
    request_free_headers(req);
    LCB_LIST_SAFE_FOR(ii, nn, &req->headers_out.list) {
        lcb_list_delete(ii);
        free(LCB_LIST_ITEM(ii, lcb_http_header_t, list));
    }
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

void lcb_http_request_finish(lcb_t instance,
                             lcb_http_request_t req,
                             lcb_error_t error)
{
    if ((req->status & LCB_HTREQ_S_CBINVOKED) == 0 && req->on_complete) {
        lcb_http_resp_t resp;
        lcb_setup_lcb_http_resp_t(&resp,
                                  req->parser->status_code,
                                  req->path,
                                  req->npath,
                                  NULL, /* headers */
                                  NULL, /* data */
                                  0);
        TRACE_HTTP_END(req, error, &resp);
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

    nn = (lcb_size_t)(gethrtime() >> 10) % instance->nservers;
    nn_limit = nn;

    do {
        server = instance->servers + nn;
        if (server->couch_api_base) {
            return server;
        }
        nn = (nn + 1) % instance->nservers;
    } while (nn != nn_limit);
    return NULL;
}

lcb_error_t lcb_http_request_exec(lcb_http_request_t req)
{
    lcb_t instance = req->instance;
    lcb_error_t rc;
    ringbuffer_t *out;
    lcb_list_t *ii;

    request_free_headers(req);
    lcb_connection_cleanup(&req->connection);
    rc = lcb_connection_init(&req->connection, instance);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, rc);
    }
    out = req->connection.output;
    if (req->nhost > sizeof(req->connection.host)) {
        lcb_http_request_decref(req);
        return LCB_E2BIG;
    }
    strncpy(req->connection.host, req->host, req->nhost);
    req->connection.host[req->nhost] = '\0';
    if (req->nport > sizeof(req->connection.port)) {
        lcb_http_request_decref(req);
        return LCB_E2BIG;
    }
    strncpy(req->connection.port, req->port, req->nport);
    req->connection.port[req->nport] = '\0';
    rc = render_http_preamble(req, out);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return LCB_EINTERNAL;
    }
    LCB_LIST_FOR(ii, &req->headers_out.list) {
        lcb_http_header_t *hh = LCB_LIST_ITEM(ii, lcb_http_header_t, list);
        lcb_size_t nkey = strlen(hh->key);
        lcb_size_t nval = strlen(hh->val);
        if (!ringbuffer_ensure_capacity(out, nkey + nval + 4)) {
            lcb_http_request_decref(req);
            return LCB_CLIENT_ENOMEM;
        }
        lcb_assert(ringbuffer_write(out, hh->key, nkey) == nkey);
        lcb_assert(ringbuffer_write(out, ": ", 2) == 2);
        lcb_assert(ringbuffer_write(out, hh->val, nval) == nval);
        lcb_assert(ringbuffer_write(out, "\r\n", 2) == 2);
    }
    if (!ringbuffer_ensure_capacity(out, 2)) {
        lcb_http_request_decref(req);
        return LCB_CLIENT_ENOMEM;
    }
    lcb_assert(ringbuffer_write(out, "\r\n", 2) == 2);
    lcb_assert(ringbuffer_write(out, req->body, req->nbody) == req->nbody);

    /* Initialize HTTP parser */
    free(req->parser);
    rc = lcb_http_parse_setup(req);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return rc;
    }

    hashset_add(instance->http_requests, req);

    TRACE_HTTP_BEGIN(req);
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

    if (base) {
        ringbuffer_t urlbuf;
        lcb_size_t nn = 1;

        if (ringbuffer_initialize(&urlbuf, 1024) == -1) {
            return LCB_CLIENT_ENOMEM;
        }
        if (memcmp(base, "http://", 7) != 0) {
            nn += 7;
        }
        if (!ringbuffer_ensure_capacity(&urlbuf, nbase + req->npath + nn)) {
            ringbuffer_destruct(&urlbuf);
            return LCB_CLIENT_ENOMEM;
        }
        if (nn > 1) {
            lcb_assert(ringbuffer_write(&urlbuf, "http://", 7) == 7);
        }
        lcb_assert(ringbuffer_write(&urlbuf, base, nbase) == nbase);
        if (req->path[0] != '/') {
            lcb_assert(ringbuffer_write(&urlbuf, "/", 1) == 1);
        }
        lcb_assert(ringbuffer_write(&urlbuf, req->path, req->npath) == req->npath);
        req->nurl = urlbuf.nbytes;
        req->url = calloc(req->nurl + 1, sizeof(char));
        if (req->url == NULL) {
            ringbuffer_destruct(&urlbuf);
            return LCB_CLIENT_ENOMEM;
        }
        lcb_assert(ringbuffer_read(&urlbuf, req->url, req->nurl) == req->nurl);
        ringbuffer_destruct(&urlbuf);
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

    switch (instance->type) {
    case LCB_TYPE_CLUSTER:
        if (type != LCB_HTTP_TYPE_MANAGEMENT) {
            return lcb_synchandler_return(instance, LCB_EBADHANDLE);
        }
        break;
    case LCB_TYPE_BUCKET:
        /* we need a vbucket config before we can start getting data.. */
        if (instance->vbucket_config == NULL) {
            return lcb_synchandler_return(instance, LCB_CLIENT_ETMPFAIL);
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
            return lcb_synchandler_return(instance, LCB_EINVAL);
        }
        if (type == LCB_HTTP_TYPE_VIEW && instance->type != LCB_TYPE_BUCKET) {
            return lcb_synchandler_return(instance, LCB_EINVAL);
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
            return lcb_synchandler_return(instance, LCB_EINVAL);
        }
        break;
    default:
        return lcb_synchandler_return(instance, LCB_EINVAL);
    }
    if (method >= LCB_HTTP_METHOD_MAX) {
        return lcb_synchandler_return(instance, LCB_EINVAL);
    }
    switch (type) {
    case LCB_HTTP_TYPE_VIEW: {
        lcb_server_t *server;
        if (instance->type != LCB_TYPE_BUCKET) {
            return lcb_synchandler_return(instance, LCB_EINVAL);
        }
        server = get_view_node(instance);
        if (!server) {
            return lcb_synchandler_return(instance, LCB_NOT_SUPPORTED);
        }
        base = server->couch_api_base;
        nbase = strlen(base);
        username = instance->sasl.name;
        if (instance->sasl.password.secret.len) {
            password = calloc(instance->sasl.password.secret.len + 1, sizeof(char));
            if (!password) {
                return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
            }
            memcpy(password, instance->sasl.password.secret.data, instance->sasl.password.secret.len);
        }
    }
    break;
    case LCB_HTTP_TYPE_MANAGEMENT:
        nbase = strlen(instance->connection.host) + strlen(instance->connection.port) + 2;
        base = calloc(nbase, sizeof(char));
        if (!base) {
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        if (snprintf(base, nbase, "%s:%s", instance->connection.host,
                     instance->connection.port) < 0) {
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        nbase -= 1; /* skip '\0' */
        username = instance->username;
        if (instance->password) {
            password = strdup(instance->password);
        }
        break;
    case LCB_HTTP_TYPE_RAW:
        base = (char *)cmd->v.v1.host;
        nbase = strlen(base);
        username = cmd->v.v1.username;
        if (cmd->v.v1.password) {
            password = strdup(cmd->v.v1.password);
            if (!password) {
                return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
            }
        }
        break;
    default:
        return lcb_synchandler_return(instance, LCB_EINVAL);
    }

    req = calloc(1, sizeof(struct lcb_http_request_st));
    if (!req) {
        return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
    }
    if (request) {
        *request = req;
    }
    req->refcount = 1;
    req->instance = instance;
    req->io = instance->io;
    req->command_cookie = command_cookie;
    req->chunked = chunked;
    req->method = method;
    req->on_complete = instance->callbacks.http_complete;
    req->on_data = instance->callbacks.http_data;
    req->reqtype = type;
    req->connection.sockfd = INVALID_SOCKET;
    lcb_list_init(&req->headers_out.list);
    req->nbody = nbody;
    if (req->nbody) {
        req->body = malloc(req->nbody);
        if (req->body == NULL) {
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        memcpy(req->body, body, nbody);
    }
    rc = lcb_urlencode_path(path, npath, &req->path, &req->npath);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, rc);
    }
    rc = lcb_http_verify_url(req, base, nbase);
    if (type == LCB_HTTP_TYPE_MANAGEMENT) {
        free(base);
    }
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, rc);
    }
    rc = setup_headers(req, content_type, username, password);
    free(password);
    if (rc != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, rc);
    }

    rc = lcb_http_request_exec(req);
    return lcb_synchandler_return(instance, rc);
}

LIBCOUCHBASE_API
void lcb_cancel_http_request(lcb_t instance, lcb_http_request_t request)
{
    if (request->status & LCB_HTREQ_S_HTREMOVED) {
        return;
    }

    request->status = LCB_HTREQ_S_HTREMOVED | LCB_HTREQ_S_CBINVOKED;
    if (request->instance) {
        hashset_remove(instance->http_requests, request);
    }
    request->instance = NULL;

    lcb_maybe_breakout(instance);
}
