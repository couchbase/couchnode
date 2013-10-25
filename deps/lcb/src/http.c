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


static const char http_version[] = " HTTP/1.1\r\n";
static const char req_headers[] = "User-Agent: libcouchbase/"LCB_VERSION_STRING"\r\n"
                                  "Connection: close\r\n"
                                  "Accept: application/json\r\n";


void lcb_http_request_decref(lcb_http_request_t req)
{
    if (--req->refcount) {
        return;
    }

    lcb_connection_cleanup(&req->connection);

    free(req->path);
    free(req->url);

    if (req->parser) {
        free(req->parser->data);
    }
    free(req->parser);
    free(req->password);
    ringbuffer_destruct(&req->result);
    {
        struct lcb_http_header_st *tmp, *hdr = req->headers_list;
        while (hdr) {
            tmp = hdr->next;
            free(hdr->data);
            free(hdr);
            hdr = tmp;
        }
    }

    free((void *)req->headers);
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

LIBCOUCHBASE_API
lcb_error_t lcb_make_http_request(lcb_t instance,
                                  const void *command_cookie,
                                  lcb_http_type_t type,
                                  const lcb_http_cmd_t *cmd,
                                  lcb_http_request_t *request)
{
    lcb_http_request_t req;
    const char *base = NULL, *username = NULL, *body, *path, *content_type;
    char *basebuf = NULL;
    lcb_size_t nn, nbase, nbody, npath;
    lcb_http_method_t method;
    int chunked;
    lcb_error_t error;
    ringbuffer_t *output;

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
    if (method >= LCB_HTTP_METHOD_MAX) {
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
    req->on_complete = instance->callbacks.http_complete;
    req->on_data = instance->callbacks.http_data;
    req->reqtype = type;
    req->connection.sockfd = INVALID_SOCKET;

    switch (type) {
    case LCB_HTTP_TYPE_VIEW: {
        lcb_server_t *server;
        if (instance->type != LCB_TYPE_BUCKET) {
            return lcb_synchandler_return(instance, LCB_EINVAL);
        }
        server = get_view_node(instance);
        if (!server) {
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_NOT_SUPPORTED);
        }
        base = server->couch_api_base;
        nbase = strlen(base);
        username = instance->sasl.name;
        if (instance->sasl.password.secret.len) {
            req->password = calloc(instance->sasl.password.secret.len + 1, sizeof(char));
            if (!req->password) {
                lcb_http_request_decref(req);
                return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
            }
            memcpy(req->password, instance->sasl.password.secret.data, instance->sasl.password.secret.len);
        }
    }
    break;

    case LCB_HTTP_TYPE_MANAGEMENT:
        nbase = strlen(instance->connection.host) + strlen(instance->connection.port) + 2;
        base = basebuf = calloc(nbase, sizeof(char));
        if (!base) {
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        if (snprintf(basebuf, nbase, "%s:%s", instance->connection.host,
                     instance->connection.port) < 0) {
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        nbase -= 1; /* skip '\0' */
        username = instance->username;
        if (instance->password) {
            req->password = strdup(instance->password);
        }
        break;

    case LCB_HTTP_TYPE_RAW:
        base = cmd->v.v1.host;
        nbase = strlen(base);
        username = cmd->v.v1.username;
        if (cmd->v.v1.password) {
            req->password = strdup(cmd->v.v1.password);
        }
        break;

    default:
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, LCB_EINVAL);
    }
    req->instance = instance;
    req->io = instance->io;
    req->command_cookie = command_cookie;
    req->chunked = chunked;
    req->method = method;
    error = lcb_urlencode_path(path, npath, &req->path, &req->npath);

    if (error != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, error);
    }

    error = lcb_connection_init(&req->connection, instance);
    if (error != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, error);
    }

    output = req->connection.output;

#define BUFF_APPEND(dst, src, len)                                  \
        if (len != ringbuffer_write(dst, src, len)) {               \
            lcb_http_request_decref(req);                          \
            return lcb_synchandler_return(instance, LCB_EINTERNAL); \
        }

    {
        /* Build URL */
        ringbuffer_t urlbuf;
        lcb_size_t nmisc = 1;

        if (ringbuffer_initialize(&urlbuf, 1024) == -1) {
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        if (memcmp(base, "http://", 7) != 0) {
            nmisc += 7;
        }
        if (!ringbuffer_ensure_capacity(&urlbuf, nbase + req->npath + nmisc)) {
            ringbuffer_destruct(&urlbuf);
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        if (nmisc > 1) {
            BUFF_APPEND(&urlbuf, "http://", 7);
        }
        BUFF_APPEND(&urlbuf, base, nbase);
        if (req->path[0] != '/') {
            BUFF_APPEND(&urlbuf, "/", 1);
        }
        if (type == LCB_HTTP_TYPE_MANAGEMENT) {
            free(basebuf);
        }
        BUFF_APPEND(&urlbuf, req->path, req->npath);
        req->nurl = urlbuf.nbytes;
        req->url = calloc(req->nurl + 1, sizeof(char));
        if (req->url == NULL) {
            ringbuffer_destruct(&urlbuf);
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }
        nn = ringbuffer_read(&urlbuf, req->url, req->nurl);
        if (nn != req->nurl) {
            ringbuffer_destruct(&urlbuf);
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_EINTERNAL);
        }
        ringbuffer_destruct(&urlbuf);
    }

    {
        /* Parse URL */
        unsigned int required_fields = ((1 << UF_HOST) | (1 << UF_PORT) | (1 << UF_PATH));

        if (http_parser_parse_url(req->url, req->nurl, 0, &req->url_info)
                || (req->url_info.field_set & required_fields) != required_fields) {
            /* parse error or missing URL part */
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_EINVAL);
        }
    }

    {
        /* Render HTTP request */
        char auth[256];
        lcb_size_t nauth = 0;

        if (req->password) {
            if (username) {
                char cred[256];
                snprintf(cred, sizeof(cred), "%s:%s", username, req->password);
                if (lcb_base64_encode(cred, auth, sizeof(auth)) == -1) {
                    lcb_http_request_decref(req);
                    return lcb_synchandler_return(instance, LCB_EINVAL);
                }
                nauth = strlen(auth);
            }
            /* we don't need password anymore */
            free(req->password);
            req->password = NULL;
        }
        nn = strlen(method_strings[req->method]) + req->url_info.field_data[UF_PATH].len + sizeof(http_version);
        if (req->url_info.field_set & UF_QUERY) {
            nn += (lcb_size_t)req->url_info.field_data[UF_QUERY].len + 1;
        }
        nn += sizeof(req_headers);
        if (nauth) {
            nn += 23 + nauth; /* Authorization: Basic ... */
        }
        nn += 10 + (lcb_size_t)req->url_info.field_data[UF_HOST].len +
              req->url_info.field_data[UF_PORT].len; /* Host: example.com:666\r\n\r\n */

        if (!ringbuffer_ensure_capacity(output, nn)) {
            lcb_http_request_decref(req);
            return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
        }

#define EXTRACT_URL_PART_NOALLOC(field, dst, len) \
        if (len > sizeof(dst) -1 ) { \
            lcb_http_request_decref(req); \
            return lcb_synchandler_return(instance, LCB_E2BIG); \
        } \
        strncpy(dst, req->url + req->url_info.field_data[field].off, len); \
        dst[len] = '\0';

        nn = strlen(method_strings[req->method]);
        BUFF_APPEND(output, method_strings[req->method], nn);
        nn = req->url_info.field_data[UF_PATH].len;
        BUFF_APPEND(output, req->url + req->url_info.field_data[UF_PATH].off, nn);
        nn = req->url_info.field_data[UF_QUERY].len;
        if (nn) {
            BUFF_APPEND(output, req->url + req->url_info.field_data[UF_QUERY].off - 1, nn + 1);
        }
        nn = strlen(http_version);
        BUFF_APPEND(output, http_version, nn);
        nn = strlen(req_headers);
        BUFF_APPEND(output, req_headers, nn);
        if (nauth) {
            BUFF_APPEND(output, "Authorization: Basic ", 21);
            BUFF_APPEND(output, auth, nauth);
            BUFF_APPEND(output, "\r\n", 2);
        }
        BUFF_APPEND(output, "Host: ", 6);
        nn = req->url_info.field_data[UF_HOST].len;

        EXTRACT_URL_PART_NOALLOC(UF_HOST, req->connection.host, nn);
        BUFF_APPEND(output, req->connection.host, nn);

        nn = req->url_info.field_data[UF_PORT].len;
        EXTRACT_URL_PART_NOALLOC(UF_PORT, req->connection.port, nn);

        /* copy port with leading colon */
        BUFF_APPEND(output, req->url + req->url_info.field_data[UF_PORT].off - 1, nn + 1);
        if (req->method == LCB_HTTP_METHOD_PUT ||
                req->method == LCB_HTTP_METHOD_POST) {
            char *post_headers = calloc(512, sizeof(char));
            int ret = 0, rr;

            if (post_headers == NULL) {
                lcb_http_request_decref(req);
                return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
            }
            if (content_type != NULL && *content_type != '\0') {
                ret = snprintf(post_headers, 512, "\r\nContent-Type: %s", content_type);
                if (ret < 0) {
                    lcb_http_request_decref(req);
                    return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
                }
            }
            rr = snprintf(post_headers + ret, 512, "\r\nContent-Length: %ld\r\n\r\n", (long)nbody);
            if (rr < 0) {
                lcb_http_request_decref(req);
                return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
            }
            ret += rr;
            if (!ringbuffer_ensure_capacity(output, nbody + (lcb_size_t)ret)) {
                lcb_http_request_decref(req);
                return lcb_synchandler_return(instance, LCB_CLIENT_ENOMEM);
            }
            BUFF_APPEND(output, post_headers, (lcb_size_t)ret);
            if (nbody) {
                BUFF_APPEND(output, body, nbody);
            }
            free(post_headers);
        } else {
            BUFF_APPEND(output, "\r\n\r\n", 4);
        }
    }

#undef BUFF_APPEND

    /* Initialize HTTP parser */
    error = lcb_http_parse_setup(req);
    if (error != LCB_SUCCESS) {
        lcb_http_request_decref(req);
        return lcb_synchandler_return(instance, error);
    }

    hashset_add(instance->http_requests, req);
    /* Get server socket address */
    req->connection.sockfd = INVALID_SOCKET;

    TRACE_HTTP_BEGIN(req);
    error = lcb_http_request_connect(req);
    if (error != LCB_SUCCESS) {
        /** Mark as having the callback invoked */
        req->status |= LCB_HTREQ_S_CBINVOKED;
        lcb_http_request_finish(instance, req, error);
    }
    return lcb_synchandler_return(instance, error);
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
