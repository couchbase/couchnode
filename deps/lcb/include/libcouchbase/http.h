/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
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
#ifndef LIBCOUCHBASE_HTTP_H
#define LIBCOUCHBASE_HTTP_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

#ifdef __cplusplus
extern "C" {
#endif
    typedef enum {
        LCB_HTTP_STATUS_CONTINUE = 100,
        LCB_HTTP_STATUS_SWITCHING_PROTOCOLS = 101,
        LCB_HTTP_STATUS_PROCESSING = 102,
        LCB_HTTP_STATUS_OK = 200,
        LCB_HTTP_STATUS_CREATED = 201,
        LCB_HTTP_STATUS_ACCEPTED = 202,
        LCB_HTTP_STATUS_NON_AUTHORITATIVE_INFORMATION = 203,
        LCB_HTTP_STATUS_NO_CONTENT = 204,
        LCB_HTTP_STATUS_RESET_CONTENT = 205,
        LCB_HTTP_STATUS_PARTIAL_CONTENT = 206,
        LCB_HTTP_STATUS_MULTI_STATUS = 207,
        LCB_HTTP_STATUS_MULTIPLE_CHOICES = 300,
        LCB_HTTP_STATUS_MOVED_PERMANENTLY = 301,
        LCB_HTTP_STATUS_FOUND = 302,
        LCB_HTTP_STATUS_SEE_OTHER = 303,
        LCB_HTTP_STATUS_NOT_MODIFIED = 304,
        LCB_HTTP_STATUS_USE_PROXY = 305,
        LCB_HTTP_STATUS_UNUSED = 306,
        LCB_HTTP_STATUS_TEMPORARY_REDIRECT = 307,
        LCB_HTTP_STATUS_BAD_REQUEST = 400,
        LCB_HTTP_STATUS_UNAUTHORIZED = 401,
        LCB_HTTP_STATUS_PAYMENT_REQUIRED = 402,
        LCB_HTTP_STATUS_FORBIDDEN = 403,
        LCB_HTTP_STATUS_NOT_FOUND = 404,
        LCB_HTTP_STATUS_METHOD_NOT_ALLOWED = 405,
        LCB_HTTP_STATUS_NOT_ACCEPTABLE = 406,
        LCB_HTTP_STATUS_PROXY_AUTHENTICATION_REQUIRED = 407,
        LCB_HTTP_STATUS_REQUEST_TIMEOUT = 408,
        LCB_HTTP_STATUS_CONFLICT = 409,
        LCB_HTTP_STATUS_GONE = 410,
        LCB_HTTP_STATUS_LENGTH_REQUIRED = 411,
        LCB_HTTP_STATUS_PRECONDITION_FAILED = 412,
        LCB_HTTP_STATUS_REQUEST_ENTITY_TOO_LARGE = 413,
        LCB_HTTP_STATUS_REQUEST_URI_TOO_LONG = 414,
        LCB_HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE = 415,
        LCB_HTTP_STATUS_REQUESTED_RANGE_NOT_SATISFIABLE = 416,
        LCB_HTTP_STATUS_EXPECTATION_FAILED = 417,
        LCB_HTTP_STATUS_UNPROCESSABLE_ENTITY = 422,
        LCB_HTTP_STATUS_LOCKED = 423,
        LCB_HTTP_STATUS_FAILED_DEPENDENCY = 424,
        LCB_HTTP_STATUS_INTERNAL_SERVER_ERROR = 500,
        LCB_HTTP_STATUS_NOT_IMPLEMENTED = 501,
        LCB_HTTP_STATUS_BAD_GATEWAY = 502,
        LCB_HTTP_STATUS_SERVICE_UNAVAILABLE = 503,
        LCB_HTTP_STATUS_GATEWAY_TIMEOUT = 504,
        LCB_HTTP_STATUS_HTTP_VERSION_NOT_SUPPORTED = 505,
        LCB_HTTP_STATUS_INSUFFICIENT_STORAGE = 507
    } lcb_http_status_t;

#ifdef __cplusplus
}
#endif

#endif
