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

#if defined(__clang__) || defined(__GNUC__)
#pragma GCC diagnostic push

#ifdef __clang__
#pragma GCC diagnostic ignored "-Wgnu-zero-variadic-macro-arguments"
#else
#pragma GCC diagnostic ignored "-Wvariadic-macros"
#endif
#endif

#ifdef HAVE_DTRACE
/* include the generated probes header and put markers in code */
#include "probes.h"
#define TRACE(probe) probe

#else
/* Wrap the probe to allow it to be removed when no systemtap available */
#define TRACE(probe)
#endif

#define TRACE_BEGIN_COMMON(TGT, req, cmd,  ...) \
    TGT((req)->request.opaque, ntohs((req)->request.vbucket), (req)->request.opcode, \
    (const char *)((cmd)->key.contig.bytes), (cmd)->key.contig.nbytes, ## __VA_ARGS__)

#define TRACE_BEGIN_SIMPLE(TGT, req, cmd) \
    TGT((req)->request.opaque, ntohs((req)->request.vbucket), (req)->request.opcode, \
        (const char *)(cmd)->key.contig.bytes, (cmd)->key.contig.nbytes)

#define TRACE_END_COMMON(TGT, mcresp, resp, ...) \
    TGT(mcresp->opaque(), 0, mcresp->opcode(), (resp)->rc, (const char *)(resp)->key, (resp)->nkey, \
        ## __VA_ARGS__)

#define TRACE_END_SIMPLE(TGT, mcresp, resp) \
    TGT(mcresp->opaque(), 0, mcresp->opcode(), (resp)->rc, (const char *)(resp)->key, (resp)->nkey)

#define TRACE_GET_BEGIN(req, cmd) \
    TRACE(TRACE_BEGIN_COMMON(LIBCOUCHBASE_GET_BEGIN, req, cmd, (cmd)->exptime))

#define TRACE_GET_END(mcresp, resp) \
    TRACE(TRACE_END_COMMON(LIBCOUCHBASE_GET_END, mcresp, resp, \
        (const char*)(resp)->value, (resp)->nvalue, (resp)->itmflags, (resp)->cas, \
        mcresp->datatype()))

#define TRACE_UNLOCK_BEGIN(req, cmd) TRACE(TRACE_BEGIN_SIMPLE(LIBCOUCHBASE_UNLOCK_BEGIN, req, cmd))
#define TRACE_UNLOCK_END(mcresp, resp) TRACE(TRACE_END_SIMPLE(LIBCOUCHBASE_UNLOCK_END, mcresp, resp))

#define TRACE_STORE_BEGIN(req, cmd) \
    TRACE(TRACE_BEGIN_COMMON(LIBCOUCHBASE_STORE_BEGIN, req, cmd, \
        (const char *)( (cmd)->value.vtype == LCB_KV_IOV ? NULL : (cmd)->value.u_buf.contig.bytes ),\
        ( (cmd)->value.vtype == LCB_KV_IOV ? 0 : (cmd)->value.u_buf.contig.nbytes ),\
        (cmd)->flags, (cmd)->cas, (req)->request.datatype, (cmd)->exptime))

#define TRACE_STORE_END(mcresp, resp) TRACE(TRACE_END_COMMON(LIBCOUCHBASE_STORE_END, mcresp, resp, (resp)->cas))

#define TRACE_ARITHMETIC_BEGIN(req, cmd) \
    TRACE(TRACE_BEGIN_COMMON(LIBCOUCHBASE_ARITHMETIC_BEGIN, req, cmd, \
        (cmd)->delta, (cmd)->initial, (cmd)->exptime))

#define TRACE_ARITHMETIC_END(mcresp, resp) \
    TRACE(TRACE_END_COMMON(LIBCOUCHBASE_ARITHMETIC_END, mcresp, resp, (resp)->value, (resp)->cas))

#define TRACE_TOUCH_BEGIN(req, cmd) \
    TRACE(TRACE_BEGIN_COMMON(LIBCOUCHBASE_TOUCH_BEGIN, req, cmd, (cmd)->exptime))
#define TRACE_TOUCH_END(mcresp, resp) \
    TRACE(TRACE_END_COMMON(LIBCOUCHBASE_TOUCH_END, mcresp, resp, (resp)->cas))

#define TRACE_REMOVE_BEGIN(req, cmd) TRACE(TRACE_BEGIN_SIMPLE(LIBCOUCHBASE_REMOVE_BEGIN, req, cmd))
#define TRACE_REMOVE_END(mcresp, resp) \
    TRACE(TRACE_END_COMMON(LIBCOUCHBASE_REMOVE_END, mcresp, resp, (resp)->cas))

#define TRACE_OBSERVE_BEGIN(req, body) \
    TRACE(LIBCOUCHBASE_OBSERVE_BEGIN(\
        (req)->request.opaque, 0, (req)->request.opcode, body, \
        ntohl( (req)->request.bodylen) ))

#define TRACE_OBSERVE_PROGRESS(mcresp, resp) \
    TRACE(TRACE_END_COMMON(LIBCOUCHBASE_OBSERVE_PROGRESS,mcresp,resp, \
        (resp)->cas, (resp)->status, (resp)->ismaster, (resp)->ttp, (resp)->ttr))

#define TRACE_OBSERVE_END(mcresp) \
    TRACE(LIBCOUCHBASE_OBSERVE_END(mcresp->opaque(), 0, mcresp->opcode(), LCB_SUCCESS))

#define TRACE_HTTP_BEGIN(req) TRACE(LIBCOUCHBASE_HTTP_BEGIN((req)->url, (req)->nurl, (req)->method))
#define TRACE_HTTP_END(req, rc, resp) TRACE(LIBCOUCHBASE_HTTP_END((req)->url, (req)->nurl, (req)->method, (resp)->rc, (resp)->htstatus

#ifdef __clang__
#pragma GCC diagnostic pop
#endif /* __clang__ */

#endif /* TRACE_H */
