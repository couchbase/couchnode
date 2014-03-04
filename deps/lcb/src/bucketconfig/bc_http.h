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


#define REQBUCKET_FMT "GET /pools/default/bucketsStreaming/%s HTTP/1.1\r\n"
#define REQPOOLS_FMT "GET /pools/ HTTP/1.1\r\n"
#define HOSTHDR_FMT  "Host: %s:%s\r\n"
#define AUTHDR_FMT "Authorization: Basic %s\r\n"
#define LAST_HTTP_HEADER "X-Libcouchbase: " LCB_VERSION_STRING "\r\n"

#ifdef __cplusplus
extern "C" {
#endif


struct htvb_st {
    /**
     * This counter is incremented whenever a new configuration is received
     * on the wire.
     */
    int generation;

    /** The most recently received configuration */
    clconfig_info *config;

    lcb_string header;
    lcb_string input;
    lcb_string chunk;
    lcb_size_t chunk_size;
};

typedef struct clprovider_http_st {
    /** Base configuration structure */
    clconfig_provider base;

    /** Connection object to our current server */
    struct lcb_connection_st connection;

    /** Stream state/data for HTTP */
    struct htvb_st stream;

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
    lcb_timer_t disconn_timer;
    lcb_timer_t io_timer;
    lcb_timer_t as_schederr;
    lcb_error_t as_errcode;

    /** List of hosts to try */
    hostlist_t nodes;

    /** The cached configuration. */
    clconfig_info *current_config;

    int retry_on_missing;
} http_provider;


#ifdef __cplusplus
}
#endif

#endif /* LCB_CLPROVIDER_HTTP_H */
