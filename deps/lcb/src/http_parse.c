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

struct parser_ctx_st {
    lcb_t instance;
    lcb_http_request_t req;
};

static int http_parser_header_cb(http_parser *p, const char *bytes,
                                 lcb_size_t nbytes)
{
    struct parser_ctx_st *ctx = p->data;
    lcb_http_request_t req = ctx->req;
    struct lcb_http_header_st *item;

    item = calloc(1, sizeof(struct lcb_http_header_st));
    if (item == NULL) {
        lcb_error_handler(req->instance, LCB_CLIENT_ENOMEM,
                          "Failed to allocate buffer");
        return -1;
    }
    item->data = malloc(nbytes + 1);
    if (item->data == NULL) {
        free(item);
        lcb_error_handler(req->instance, LCB_CLIENT_ENOMEM,
                          "Failed to allocate buffer");
        return -1;
    }
    memcpy(item->data, bytes, nbytes);
    item->data[nbytes] = '\0';
    item->next = req->headers_list;
    req->headers_list = item;
    req->nheaders++;
    return 0;
}

static int http_parser_headers_complete_cb(http_parser *p)
{
    struct parser_ctx_st *ctx = p->data;
    lcb_http_request_t req = ctx->req;
    struct lcb_http_header_st *hdr;
    lcb_size_t ii;
    lcb_t instance = req->instance;
    const char *location = NULL;

    /* +1 pointer for NULL-terminator */
    req->headers = calloc(req->nheaders + 1, sizeof(const char *));
    for (ii = req->nheaders - 1, hdr = req->headers_list; hdr; --ii, hdr = hdr->next) {
        req->headers[ii] = hdr->data;
        if (strcasecmp("Location", hdr->data) == 0) {
            if (hdr->next) {
                location = req->headers[ii + 1];
            }
        }
    }
    if (p->status_code >= 300 && p->status_code < 400) {
        req->redircount++;
        if (location) {
            req->redirect_to = strdup(location);
            if (!req->redirect_to) {
                lcb_http_request_finish(instance, req, LCB_CLIENT_ENOMEM);
            }
        }
        return 1;
    }
    return 0;
}

static int http_parser_body_cb(http_parser *p, const char *bytes, lcb_size_t nbytes)
{
    struct parser_ctx_st *ctx = p->data;
    lcb_http_request_t req = ctx->req;
    lcb_http_resp_t resp;

    if (req->status != LCB_HTREQ_S_ONGOING) {
        return 0;
    }

    if (req->chunked) {
        lcb_setup_lcb_http_resp_t(&resp, p->status_code, req->path, req->npath,
                                  req->headers, bytes, nbytes);
        req->on_data(req, req->instance, req->command_cookie, LCB_SUCCESS, &resp);
    } else {
        if (!ringbuffer_ensure_capacity(&req->result, nbytes)) {
            lcb_error_handler(req->instance, LCB_CLIENT_ENOMEM,
                              "Failed to allocate buffer");
            return -1;
        }
        ringbuffer_write(&req->result, bytes, nbytes);
    }
    return 0;
}

static int http_parser_complete_cb(http_parser *p)
{
    struct parser_ctx_st *ctx = p->data;
    lcb_http_request_t req = ctx->req;
    char *bytes = NULL;
    lcb_size_t np = 0, nbytes = 0;
    lcb_http_resp_t resp;

    if (req->status != LCB_HTREQ_S_ONGOING || req->redirect_to) {
        return 0;
    }

    if (!req->chunked) {
        nbytes = req->result.nbytes;
        if (ringbuffer_is_continous(&req->result, RINGBUFFER_READ, nbytes)) {
            bytes = ringbuffer_get_read_head(&req->result);
        } else {
            if ((bytes = malloc(nbytes)) == NULL) {
                lcb_error_handler(req->instance, LCB_CLIENT_ENOMEM, NULL);
                return -1;
            }
            np = ringbuffer_peek(req->connection.input, bytes, nbytes);
            if (np != nbytes) {
                lcb_error_handler(req->instance, LCB_EINTERNAL, NULL);
                free(bytes);
                return -1;
            }
        }
    }
    lcb_setup_lcb_http_resp_t(&resp, p->status_code, req->path, req->npath,
                              req->headers, bytes, nbytes);

    TRACE_HTTP_END(req, LCB_SUCCESS, &resp);

    if (req->on_complete) {
        req->on_complete(req,
                         req->instance,
                         req->command_cookie,
                         LCB_SUCCESS,
                         &resp);
    }

    if (!req->chunked) {
        ringbuffer_consumed(&req->result, nbytes);
        if (np) {   /* release peek storage */
            free(bytes);
        }
    }
    req->status |= LCB_HTREQ_S_CBINVOKED;
    return 0;
}

/**
 * Return 0 on completion, < 0 on error, > 0 on success (but need more bytes)
 */
int lcb_http_request_do_parse(lcb_http_request_t req)
{
    lcb_size_t nbytes, nb = 0, np = 0;
    char *bytes;
    ringbuffer_t *input = req->connection.input;

    if (req->status != LCB_HTREQ_S_ONGOING) {
        return 0;
    }

    nbytes = input->nbytes;
    bytes = ringbuffer_get_read_head(input);
    if (!ringbuffer_is_continous(input, RINGBUFFER_READ, nbytes)) {
        if ((bytes = malloc(nbytes)) == NULL) {
            lcb_error_handler(req->instance, LCB_CLIENT_ENOMEM, NULL);
            return -1;
        }
        np = ringbuffer_peek(input, bytes, nbytes);
        if (np != nbytes) {
            lcb_error_handler(req->instance, LCB_EINTERNAL, NULL);
            free(bytes);
            return -1;
        }
    }

    if (nbytes > 0) {
        nb = (lcb_size_t)_lcb_http_parser_execute(req->parser, &req->parser_settings, bytes, nbytes);
        ringbuffer_consumed(input, nbytes);
        if (np) {   /* release peek storage */
            free(bytes);
        }
        if (HTTP_PARSER_ERRNO(req->parser) != HPE_OK) {
            return -1;
        }
        if (req->status != LCB_HTREQ_S_ONGOING) {
            return 0;
        } else {
            return (int)nb;
        }
    }
    return 0;
}

lcb_error_t lcb_http_parse_setup(lcb_http_request_t req)
{
    struct parser_ctx_st *parser_ctx;

    req->parser = malloc(sizeof(http_parser));
    if (req->parser == NULL) {
        return LCB_CLIENT_ENOMEM;
    }

    _lcb_http_parser_init(req->parser, HTTP_RESPONSE);

    parser_ctx = malloc(sizeof(struct parser_ctx_st));
    if (parser_ctx == NULL) {
        return LCB_CLIENT_ENOMEM;
    }
    parser_ctx->instance = req->instance;
    parser_ctx->req = req;
    req->parser->data = parser_ctx;

    req->parser_settings.on_body = (http_data_cb)http_parser_body_cb;
    req->parser_settings.on_message_complete = (http_cb)http_parser_complete_cb;
    req->parser_settings.on_header_field = (http_data_cb)http_parser_header_cb;
    req->parser_settings.on_header_value = (http_data_cb)http_parser_header_cb;
    req->parser_settings.on_headers_complete = (http_cb)http_parser_headers_complete_cb;
    return LCB_SUCCESS;
}
