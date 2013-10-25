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

#ifndef LIBCOUCHBASE_TRACE_H
#define LIBCOUCHBASE_TRACE_H 1

#ifdef HAVE_DTRACE
/* include the generated probes header and put markers in code */
#include "probes.h"
#define TRACE(probe) probe
#else
/* Wrap the probe to allow it to be removed when no systemtap available */
#define TRACE(probe)
#endif

#define TRACE_GET_BEGIN(req, key, nkey, expiration)                             \
    TRACE(LIBCOUCHBASE_GET_BEGIN((req)->message.header.request.opaque,          \
                                 ntohs((req)->message.header.request.vbucket),  \
                                 (req)->message.header.request.opcode,          \
                                 (char*)key, (lcb_uint32_t)nkey,                \
                                 (lcb_uint32_t)expiration))

#define TRACE_GET_END(opaque, vbucket, opcode, rc, resp)    \
    TRACE(LIBCOUCHBASE_GET_END(opaque, vbucket,             \
                               opcode, rc,                  \
                               (char*)(resp)->v.v0.key,     \
                               (resp)->v.v0.nkey,           \
                               (char*)(resp)->v.v0.bytes,   \
                               (resp)->v.v0.nbytes,         \
                               (resp)->v.v0.flags,          \
                               (resp)->v.v0.cas,            \
                               (resp)->v.v0.datatype))

#define TRACE_UNLOCK_BEGIN(req, key, nkey)                                          \
    TRACE(LIBCOUCHBASE_UNLOCK_BEGIN((req)->message.header.request.opaque,           \
                                    ntohs((req)->message.header.request.vbucket),   \
                                    (req)->message.header.request.opcode,           \
                                    (char*)key, (lcb_uint32_t)nkey))

#define TRACE_UNLOCK_END(opaque, vbucket, rc, resp)     \
    TRACE(LIBCOUCHBASE_UNLOCK_END(opaque, vbucket,      \
                                  CMD_UNLOCK_KEY, rc,   \
                                  (char*)(resp)->v.v0.key,  \
                                  (resp)->v.v0.nkey))

#define TRACE_STORE_BEGIN(req, key, nkey, bytes, nbytes, flags, expiration)         \
    TRACE(LIBCOUCHBASE_STORE_BEGIN((req)->message.header.request.opaque,            \
                                   ntohs((req)->message.header.request.vbucket),    \
                                   (req)->message.header.request.opcode,            \
                                   (char*)key, (lcb_uint32_t)nkey,                  \
                                   (char*)bytes, (lcb_uint32_t)nbytes,              \
                                   (lcb_uint32_t)flags,                             \
                                   (lcb_uint64_t)(req)->message.header.request.cas, \
                                   (req)->message.header.request.datatype,          \
                                   (lcb_uint32_t)expiration))

#define TRACE_STORE_END(opaque, vbucket, opcode, rc, resp)      \
    TRACE(LIBCOUCHBASE_STORE_END(opaque, vbucket,               \
                                 opcode, rc,                    \
                                 (char*)(resp)->v.v0.key,       \
                                 (resp)->v.v0.nkey,             \
                                 (resp)->v.v0.cas))

#define TRACE_ARITHMETIC_BEGIN(req, key, nkey, delta, initial, expiration)              \
    TRACE(LIBCOUCHBASE_ARITHMETIC_BEGIN((req)->message.header.request.opaque,           \
                                        ntohs((req)->message.header.request.vbucket),   \
                                        (req)->message.header.request.opcode,           \
                                        (char*)key, (lcb_uint32_t)nkey,                 \
                                        (lcb_uint64_t)delta,                            \
                                        (lcb_uint64_t)initial,                          \
                                        (lcb_uint32_t)expiration))

#define TRACE_ARITHMETIC_END(opaque, vbucket, opcode, rc, resp)     \
    TRACE(LIBCOUCHBASE_ARITHMETIC_END(opaque, vbucket,              \
                                      opcode, rc,                   \
                                      (char*)(resp)->v.v0.key,      \
                                      (resp)->v.v0.nkey,            \
                                      (resp)->v.v0.value,           \
                                      (resp)->v.v0.cas))

#define TRACE_TOUCH_BEGIN(req, key, nkey, expiration)                             \
    TRACE(LIBCOUCHBASE_TOUCH_BEGIN((req)->message.header.request.opaque,          \
                                   ntohs((req)->message.header.request.vbucket),  \
                                   (req)->message.header.request.opcode,          \
                                   (char*)key, (lcb_uint32_t)nkey,                \
                                   (lcb_uint32_t)expiration))

#define TRACE_TOUCH_END(opaque, vbucket, opcode, rc, resp)      \
    TRACE(LIBCOUCHBASE_TOUCH_END(opaque, vbucket,               \
                                 opcode, rc,                    \
                                 (char*)(resp)->v.v0.key,       \
                                 (resp)->v.v0.nkey,             \
                                 (resp)->v.v0.cas))

#define TRACE_REMOVE_BEGIN(req, key, nkey)                                          \
    TRACE(LIBCOUCHBASE_REMOVE_BEGIN((req)->message.header.request.opaque,           \
                                    ntohs((req)->message.header.request.vbucket),   \
                                    (req)->message.header.request.opcode,           \
                                    (char*)key, (lcb_uint32_t)nkey))

#define TRACE_REMOVE_END(opaque, vbucket, opcode, rc, resp)     \
    TRACE(LIBCOUCHBASE_REMOVE_END(opaque, vbucket,              \
                                  opcode, rc,                   \
                                  (char*)(resp)->v.v0.key,      \
                                  (resp)->v.v0.nkey,            \
                                  (resp)->v.v0.cas))

#define TRACE_FLUSH_BEGIN(req, server_endpoint)                                     \
    TRACE(LIBCOUCHBASE_FLUSH_BEGIN((req)->message.header.request.opaque,            \
                                   ntohs((req)->message.header.request.vbucket),    \
                                   (req)->message.header.request.opcode,            \
                                   (char*)server_endpoint))

#define TRACE_FLUSH_PROGRESS(opaque, vbucket, opcode, rc, resp)      \
    TRACE(LIBCOUCHBASE_FLUSH_PROGRESS(opaque, vbucket,               \
                                      opcode, rc,                    \
                                      (char*)(resp)->v.v0.server_endpoint))

#define TRACE_FLUSH_END(opaque, vbucket, opcode, rc)            \
    TRACE(LIBCOUCHBASE_FLUSH_END(opaque, vbucket, opcode, rc))

#define TRACE_VERSIONS_BEGIN(req, server_endpoint)                                     \
    TRACE(LIBCOUCHBASE_VERSIONS_BEGIN((req)->message.header.request.opaque,            \
                                      ntohs((req)->message.header.request.vbucket),    \
                                      (req)->message.header.request.opcode,            \
                                      (char*)server_endpoint))

#define TRACE_VERSIONS_PROGRESS(opaque, vbucket, opcode, rc, resp)       \
    TRACE(LIBCOUCHBASE_VERSIONS_PROGRESS(opaque, vbucket,                \
                                         opcode, rc,                     \
                                         (char*)(resp)->v.v0.server_endpoint))

#define TRACE_VERSIONS_END(opaque, vbucket, opcode, rc)             \
    TRACE(LIBCOUCHBASE_VERSIONS_END(opaque, vbucket, opcode, rc))

#define TRACE_STATS_BEGIN(req, server_endpoint, arg, narg)                          \
    TRACE(LIBCOUCHBASE_STATS_BEGIN((req)->message.header.request.opaque,            \
                                   ntohs((req)->message.header.request.vbucket),    \
                                   (req)->message.header.request.opcode,            \
                                   (char*)server_endpoint, (char*)arg, narg))

#define TRACE_STATS_PROGRESS(opaque, vbucket, opcode, rc, resp)     \
    TRACE(LIBCOUCHBASE_STATS_PROGRESS(opaque, vbucket,              \
                                     opcode, rc,                    \
                                     (char*)(resp)->v.v0.server_endpoint, \
                                     (char*)(resp)->v.v0.key,       \
                                     (resp)->v.v0.nkey,             \
                                     (char*)(resp)->v.v0.bytes,     \
                                     (resp)->v.v0.nbytes))

#define TRACE_STATS_END(opaque, vbucket, opcode, rc)            \
    TRACE(LIBCOUCHBASE_STATS_END(opaque, vbucket, opcode, rc))

#define TRACE_VERBOSITY_BEGIN(req, server_endpoint, level)                              \
    TRACE(LIBCOUCHBASE_VERBOSITY_BEGIN((req)->message.header.request.opaque,            \
                                       ntohs((req)->message.header.request.vbucket),    \
                                       (req)->message.header.request.opcode,            \
                                       (char*)server_endpoint, level))

#define TRACE_VERBOSITY_END(opaque, vbucket, opcode, rc, resp)      \
    TRACE(LIBCOUCHBASE_VERBOSITY_END(opaque, vbucket,               \
                                     opcode, rc,                    \
                                     (char*)(resp)->v.v0.server_endpoint))

#define TRACE_OBSERVE_BEGIN(req, server_endpoint, bytes, nbytes)                    \
    TRACE(LIBCOUCHBASE_OBSERVE_BEGIN((req)->message.header.request.opaque,          \
                                     ntohs((req)->message.header.request.vbucket),  \
                                     (req)->message.header.request.opcode,          \
                                     (char*)bytes, nbytes))

#define TRACE_OBSERVE_PROGRESS(opaque, vbucket, opcode, rc, resp)   \
    TRACE(LIBCOUCHBASE_OBSERVE_PROGRESS(opaque, vbucket,            \
                                        opcode, rc,                 \
                                        (char*)(resp)->v.v0.key,    \
                                        (resp)->v.v0.nkey,          \
                                        (resp)->v.v0.cas,           \
                                        (resp)->v.v0.status,        \
                                        (resp)->v.v0.from_master,   \
                                        (resp)->v.v0.ttp,           \
                                        (resp)->v.v0.ttr))

#define TRACE_OBSERVE_END(opaque, vbucket, opcode, rc)              \
    TRACE(LIBCOUCHBASE_OBSERVE_END(opaque, vbucket, opcode, rc))

#define TRACE_HTTP_BEGIN(req)                               \
    TRACE(LIBCOUCHBASE_HTTP_BEGIN((req)->url,               \
                                  (req)->nurl,              \
                                  (req)->method))

#define TRACE_HTTP_END(req, rc, resp)                               \
    TRACE(LIBCOUCHBASE_HTTP_END((req)->url,                         \
                                (req)->nurl,                        \
                                (req)->method, rc,                  \
                                (resp)->v.v0.status))
#endif
