/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

#ifndef LCB_CXXWRAP_H
#define LCB_CXXWRAP_H

/* Note that the contents of this file are here only to provide inline
 * definitions for backwards compatibility with older code. Users of the library
 * should assume that structures do _not_ behave differently under C++ and must
 * be explicitly initialized with their appropriate members.
 *
 * For newer code which wants to use pure "C-Style" initializers, define the
 * LCB_NO_DEPR_CXX_CTORS macro so that the structures remain to function
 * as they do in plain C.
 */

#if defined(__cplusplus) && !defined(LCB_NO_DEPR_CXX_CTORS)

#include <cstdlib>
#include <cstring>


#define LCB_DEPR_CTORS_GET \
    lcb_get_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_get_cmd_st(const void *key, lcb_size_t nkey=0, lcb_time_t exptime=0, int lock=0) { \
        version = 0; \
        v.v0.key = key; \
        if (key != NULL && nkey == 0) { \
            v.v0.nkey = std::strlen((const char *)key); \
        } else { \
            v.v0.nkey = nkey; \
        } \
        v.v0.exptime = exptime; v.v0.lock = lock; v.v0.hashkey = NULL; v.v0.nhashkey = 0; \
    }


#define LCB_DEPR_CTORS_RGET \
    lcb_get_replica_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_get_replica_cmd_st(const void *key, lcb_size_t nkey, lcb_replica_t strategy=LCB_REPLICA_FIRST, int index=0) { \
        version = 1; v.v1.key = key; v.v1.nkey = nkey; v.v1.hashkey = NULL; v.v1.nhashkey = 0; v.v1.strategy = strategy; v.v1.index = index; \
    }

#define LCB_DEPR_CTORS_UNL \
    lcb_unlock_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_unlock_cmd_st(const void *key, lcb_size_t nkey, lcb_cas_t cas) { \
        version = 0; v.v0.key = key; v.v0.nkey = nkey; v.v0.cas = cas; v.v0.hashkey = NULL; v.v0.nhashkey = 0; \
    }

#define LCB_DEPR_CTORS_STORE \
    lcb_store_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_store_cmd_st(lcb_storage_t operation, const void *key, lcb_size_t nkey, \
        const void *bytes=NULL, lcb_size_t nbytes=0, lcb_uint32_t flags=0, \
        lcb_time_t exptime=0, lcb_cas_t cas=0, lcb_datatype_t datatype=0) { \
        version = 0; v.v0.operation = operation; v.v0.key = key; v.v0.nkey = nkey; v.v0.cas = cas; \
        v.v0.bytes = bytes; v.v0.nbytes = nbytes; v.v0.flags = flags; v.v0.datatype = datatype; \
        v.v0.exptime = exptime; v.v0.hashkey = NULL; v.v0.nhashkey = 0; \
    }

#define LCB_DEPR_CTORS_ARITH \
    lcb_arithmetic_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_arithmetic_cmd_st(const void *key, lcb_size_t nkey, lcb_int64_t delta, int create=0, \
        lcb_uint64_t initial=0, lcb_time_t exptime=0) { \
        version = 0; v.v0.key = key; v.v0.nkey = nkey; v.v0.exptime = exptime; \
        v.v0.delta = delta; v.v0.create = create; v.v0.initial = initial; \
        v.v0.hashkey = NULL; v.v0.nhashkey = 0; \
    }


#define LCB_DEPR_CTORS_OBS \
    lcb_observe_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_observe_cmd_st(const void *key, lcb_size_t nkey) { \
        version = 0; v.v0.key = key; v.v0.nkey = nkey; v.v0.hashkey = NULL; v.v0.nhashkey = 0; \
    }

#define LCB_DEPR_CTORS_RM \
    lcb_remove_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_remove_cmd_st(const void *key, lcb_size_t nkey=0, lcb_cas_t cas=0) { \
            version = 0; v.v0.key = key; \
        if (key != NULL && nkey == 0) { v.v0.nkey = std::strlen((const char *)key);}\
        else { v.v0.nkey = nkey; } \
        v.v0.cas = cas; v.v0.hashkey = NULL; v.v0.nhashkey = 0; \
    }

#define LCB_DEPR_CTORS_STATS \
    lcb_server_stats_cmd_st(const char *name=NULL, lcb_size_t nname=0) { \
        version = 0; v.v0.name = name; v.v0.nname = nname; \
        if (name != NULL && nname == 0) { v.v0.nname = std::strlen(name); } \
        else { v.v0.nname = nname; } \
    }

#define LCB_DEPR_CTORS_VERBOSITY \
    lcb_verbosity_cmd_st(lcb_verbosity_level_t level=LCB_VERBOSITY_WARNING, const char *server=NULL) { \
        version = 0; v.v0.server = server; v.v0.level = level; \
    }

#define LCB_DEPR_CTORS_VERSIONS \
    lcb_server_version_cmd_st() { std::memset(this, 0, sizeof(*this)); }

#define LCB_DEPR_CTORS_FLUSH \
    lcb_flush_cmd_st() { std::memset(this, 0, sizeof(*this)); }

#define LCB_DEPR_CTORS_CRST \
    lcb_create_st(const char *host=NULL, const char *user=NULL,\
        const char *passwd=NULL, const char *bucket=NULL, \
        struct lcb_io_opt_st *io=NULL, lcb_type_t type=LCB_TYPE_BUCKET) { \
        version = 2; v.v2.host = host; v.v2.user = user; v.v2.passwd = passwd; \
        v.v2.bucket = bucket; v.v2.io = io; v.v2.type = type; v.v2.mchosts = NULL; \
        v.v2.transports = NULL; \
    }

#define LCB_DEPR_CTORS_HTTP \
    lcb_http_cmd_st() { std::memset(this, 0, sizeof(*this)); } \
    lcb_http_cmd_st(const char *path, lcb_size_t npath, const void *body, \
                lcb_size_t nbody, lcb_http_method_t method, \
                int chunked, const char *content_type) { \
        version = 0; v.v0.path = path; v.v0.npath = npath; v.v0.body = body; \
        v.v0.nbody = nbody; v.v0.method = method; v.v0.chunked = chunked; \
        v.v0.content_type = content_type; \
    }
#else
/* Not C++ */
#define LCB_DEPR_CTORS_GET
#define LCB_DEPR_CTORS_RGET
#define LCB_DEPR_CTORS_UNL
#define LCB_DEPR_CTORS_STORE
#define LCB_DEPR_CTORS_ARITH
#define LCB_DEPR_CTORS_OBS
#define LCB_DEPR_CTORS_RM
#define LCB_DEPR_CTORS_STATS
#define LCB_DEPR_CTORS_VERBOSITY
#define LCB_DEPR_CTORS_VERSIONS
#define LCB_DEPR_CTORS_FLUSH
#define LCB_DEPR_CTORS_HTTP
#define LCB_DEPR_CTORS_CRST
#endif
#endif /* LCB_CXXWRAP_H */
