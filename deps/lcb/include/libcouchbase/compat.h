/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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
 * Code used for compatibility with other types of clusters
 *
 * @author Trond Norbye
 */
#ifndef LIBCOUCHBASE_COMPAT_H
#define LIBCOUCHBASE_COMPAT_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

#ifdef __cplusplus
extern "C" {
#endif

    enum lcb_compat_t {
        LCB_MEMCACHED_CLUSTER = 0x00,
        LCB_CACHED_CONFIG = 0x01
    };

    typedef enum lcb_compat_t lcb_compat_t;
    /* For backwards compatibility mode */
    typedef enum lcb_compat_t lcb_cluster_t;

    LIBCOUCHBASE_API
    lcb_error_t lcb_create_compat(lcb_compat_t type,
                                  const void *specific,
                                  lcb_t *instance,
                                  struct lcb_io_opt_st *io);

    struct lcb_memcached_st {
        const char *serverlist;
        const char *username;
        const char *password;
    };

    struct lcb_cached_config_st {
        struct lcb_create_st createopt;
        const char *cachefile;
    };

#ifdef __cplusplus
}
#endif

#endif
