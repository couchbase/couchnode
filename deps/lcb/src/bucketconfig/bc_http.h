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


/**
 * HTTP-based 'REST' configuration. This module works by connecting to the
 * REST API port (and trying various other nodes) until it receives a
 * configuration.
 */
#ifndef LCB_CLPROVIDER_HTTP_H
#define LCB_CLPROVIDER_HTTP_H

#include "config.h"
#include "hostlist.h"
#include "simplestring.h"
#include "clconfig.h"
#include <lcbht/lcbht.h>

#define REQBUCKET_COMPAT_FMT "GET /pools/default/bucketsStreaming/%s HTTP/1.1\r\n"
#define REQBUCKET_TERSE_FMT "GET /pools/default/bs/%s HTTP/1.1\r\n"
#define REQPOOLS_FMT "GET /pools/ HTTP/1.1\r\n"
#define HOSTHDR_FMT  "Host: %s:%s\r\n"
#define AUTHDR_FMT "Authorization: Basic %s\r\n"
#define LAST_HTTP_HEADER "X-Libcouchbase: " LCB_VERSION_STRING "\r\n"
#define CONFIG_DELIMITER "\n\n\n\n"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct clprovider_http_st {
    /** Base configuration structure */
    clconfig_provider base;
    lcbio_pCONNSTART creq;
    lcbio_CTX *ioctx;
    lcbht_pPARSER htp;

    /**
     * Buffer to use for writing our request header. Recreated for each
     * connection because of the Host: header
     */
    char request_buf[1024];

    /**
     * We only recreate the connection if our current stream 'times out'. This
     * timer waits until the current stream times out and then proceeds to the
     * next connection.
     */
    lcbio_pTIMER disconn_timer;
    lcbio_pTIMER io_timer;
    lcbio_pTIMER as_reconnect;

    /** List of hosts to try */
    hostlist_t nodes;

    /** The cached configuration. */
    clconfig_info *current_config;
    clconfig_info *last_parsed;
    int generation;
    int try_nexturi;
    lcb_HTCONFIG_URLTYPE uritype;
} http_provider;

#ifdef __cplusplus
}
#endif

#endif /* LCB_CLPROVIDER_HTTP_H */
