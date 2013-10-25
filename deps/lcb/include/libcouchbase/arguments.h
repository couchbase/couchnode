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

/**
 * This file contains definitions of all of the command and response
 * structures. It is a "versioned" struct, so that we may change it
 * without breaking binary compatibility. You as a user must specify
 * the version field when you create command, and you <b>must</b>
 * check the version field to figure out the layout when you want
 * to access the fields.
 *
 * All of the data operations contains a <code>hashkey</code> and
 * <code>nhashkey</code> field. This allows you to "group" items
 * together in your cluster. A typical use case for this is if you're
 * storing lets say data for a single user in multiple objects. If you
 * want to ensure that either <b>all</b> or <b>none</b> of the objects
 * are available if a server goes down, it <u>could</u> be a good
 * idea to locate them on the same server. Do bear in mind that if
 * you do try to decide where objects is located, you may end up
 * with an uneven distribution of the number of items on each node.
 * This will again result in some nodes being more busy than others
 * etc. This is why some clients doesn't allow you to do this, so
 * bear in mind that by doing so you might not be able to get your
 * objects from other clients.
 *
 * You must also remember to update sanitycheck.[ch] whenever you do
 * changes here!
 */

#ifndef LIBCOUCHBASE_ARGUMENTS_H
#define LIBCOUCHBASE_ARGUMENTS_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif


#ifdef __cplusplus
#include <cstring>
extern "C" {
#endif

#define LCB_C_ST_ID 0
#define LCB_C_ST_V 1

    struct lcb_create_st {
        int version;
        union {
            struct {
                /**
                 * hosts A list of hosts:port separated by ';' to the
                 * administration port of the couchbase cluster. (ex:
                 * "host1;host2:9000;host3" would try to connect to
                 * host1 on port 8091, if that fails it'll connect to
                 * host2 on port 9000 etc).
                 *
                 * The hostname may also be specified as a URI looking
                 * like: http://localhost:8091/pools
                 */
                const char *host;
                /** user the username to use */
                const char *user;
                /** @param passwd The password */
                const char *passwd;
                /** @param bucket The bucket to connect to */
                const char *bucket;
                /** @param io the io handle to use */
                struct lcb_io_opt_st *io;
            } v0;
            struct {
                /**
                 * hosts A list of hosts:port separated by ';' to the
                 * administration port of the couchbase cluster. (ex:
                 * "host1;host2:9000;host3" would try to connect to
                 * host1 on port 8091, if that fails it'll connect to
                 * host2 on port 9000 etc).
                 *
                 * The hostname may also be specified as a URI looking
                 * like: http://localhost:8091/pools
                 */
                const char *host;
                /** user the username to use */
                const char *user;
                /** @param passwd The password */
                const char *passwd;
                /** @param bucket The bucket to connect to */
                const char *bucket;
                /** @param io the io handle to use */
                struct lcb_io_opt_st *io;
                /**
                 * the type of the connection:
                 * * LCB_TYPE_BUCKET
                 *      NULL for bucket means "default" bucket
                 * * LCB_TYPE_CLUSTER
                 *      the bucket argument ignored and all data commands
                 *      will return LCB_NOT_SUPPORTED
                 */
                lcb_type_t type;
            } v1;
        } v;

#ifdef __cplusplus
        lcb_create_st(const char *host = NULL,
                      const char *user = NULL,
                      const char *passwd = NULL,
                      const char *bucket = NULL,
                      struct lcb_io_opt_st *io = NULL,
                      lcb_type_t type = LCB_TYPE_BUCKET) {
            version = 1;
            v.v1.host = host;
            v.v1.user = user;
            v.v1.passwd = passwd;
            v.v1.bucket = bucket;
            v.v1.io = io;
            v.v1.type = type;
        }
#endif
    };

#define LCB_C_I_O_ST_ID 1
#define LCB_C_I_O_ST_V 1

    struct lcb_create_io_ops_st {
        int version;
        union {
            struct {
                /** The predefined type you want to create */
                lcb_io_ops_type_t type;
                /** A cookie passed directly down to the underlying io ops */
                void *cookie;
            } v0;
            struct {
                /** The name of the shared object to load */
                const char *sofile;
                /**
                 * The method to call in the shared object. The functions
                 * signature is
                 *   lcb_error_t create(int version, lcb_io_opt_t *io, const void *cookie);
                 */
                const char *symbol;
                /** A cookie passed directly down to the underlying io ops */
                void *cookie;
            } v1;
            struct {
                /**
                 * The pointer to function. Useful when adding
                 * -rdynamic isn't acceptable solution
                 */
                lcb_error_t (*create)(int version,
                                      lcb_io_opt_t *io,
                                      void *cookie);
                /** A cookie passed directly down to the underlying io ops */
                void *cookie;
            } v2;
        } v;
    };

#define LCB_G_C_ST_ID 2
#define LCB_G_C_ST_V 0
    typedef struct lcb_get_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                /* if non-zero and lock is zero, it will use GAT */
                lcb_time_t exptime;
                /* if non-zero, it will use GETL */
                int lock;
                const void *hashkey;
                lcb_size_t nhashkey;
            } v0;
        } v;
#ifdef __cplusplus
        lcb_get_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_get_cmd_st(const void *key,
                       lcb_size_t nkey = 0,
                       lcb_time_t exptime = 0,
                       int lock = 0) {
            version = 0;
            v.v0.key = key;
            if (key != NULL && nkey == 0) {
                v.v0.nkey = std::strlen((const char *)key);
            } else {
                v.v0.nkey = nkey;
            }
            v.v0.exptime = exptime;
            v.v0.lock = lock;
            v.v0.hashkey = NULL;
            v.v0.nhashkey = 0;
        }
#endif
    } lcb_get_cmd_t;

#define LCB_G_R_C_ST_ID 3
#define LCB_G_R_C_ST_V 1

    typedef enum {
        LCB_REPLICA_FIRST = 0x00,
        LCB_REPLICA_ALL = 0x01,
        LCB_REPLICA_SELECT = 0x02
    } lcb_replica_t;

    typedef struct lcb_get_replica_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                const void *hashkey;
                lcb_size_t nhashkey;
            } v0;
            struct {
                const void *key;
                lcb_size_t nkey;
                const void *hashkey;
                lcb_size_t nhashkey;
                lcb_replica_t strategy;
                int index;
            } v1;
        } v;
#ifdef __cplusplus
        lcb_get_replica_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_get_replica_cmd_st(const void *key, lcb_size_t nkey,
                               lcb_replica_t strategy = LCB_REPLICA_FIRST,
                               int index = 0) {
            version = 1;
            v.v1.key = key;
            v.v1.nkey = nkey;
            v.v1.hashkey = NULL;
            v.v1.nhashkey = 0;
            v.v1.strategy = strategy;
            v.v1.index = index;
        }
#endif
    } lcb_get_replica_cmd_t;

#define LCB_U_C_ST_ID 4
#define LCB_U_C_ST_V 0
    typedef struct lcb_unlock_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_cas_t cas;
                const void *hashkey;
                lcb_size_t nhashkey;
            } v0;
        } v;
#ifdef __cplusplus
        lcb_unlock_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_unlock_cmd_st(const void *key, lcb_size_t nkey, lcb_cas_t cas) {
            version = 0;
            v.v0.key = key;
            v.v0.nkey = nkey;
            v.v0.cas = cas;
            v.v0.hashkey = NULL;
            v.v0.nhashkey = 0;
        }
#endif
    } lcb_unlock_cmd_t;

    /**
     * Touch use the same sturcture as get
     */
#define LCB_T_C_ST_ID 5
#define LCB_T_C_ST_V 0
    typedef lcb_get_cmd_t lcb_touch_cmd_t;

#define LCB_S_C_ST_ID 6
#define LCB_S_C_ST_V 0
    typedef struct lcb_store_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                const void *bytes;
                lcb_size_t nbytes;
                lcb_uint32_t flags;
                lcb_cas_t cas;
                lcb_datatype_t datatype;
                lcb_time_t exptime;
                lcb_storage_t operation;
                const void *hashkey;
                lcb_size_t nhashkey;
            } v0;
        } v;
#ifdef __cplusplus
        lcb_store_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_store_cmd_st(lcb_storage_t operation,
                         const void *key,
                         lcb_size_t nkey,
                         const void *bytes = NULL,
                         lcb_size_t nbytes = 0,
                         lcb_uint32_t flags = 0,
                         lcb_time_t exptime = 0,
                         lcb_cas_t cas = 0,
                         lcb_datatype_t datatype = 0) {
            version = 0;
            v.v0.operation = operation;
            v.v0.key = key;
            v.v0.nkey = nkey;
            v.v0.cas = cas;
            v.v0.bytes = bytes;
            v.v0.nbytes = nbytes;
            v.v0.flags = flags;
            v.v0.datatype = datatype;
            v.v0.exptime = exptime;
            v.v0.hashkey = NULL;
            v.v0.nhashkey = 0;
        }
#endif
    } lcb_store_cmd_t;

#define LCB_A_C_ST_ID 7
#define LCB_A_C_ST_V 0
    typedef struct lcb_arithmetic_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_time_t exptime;
                int create;
                lcb_int64_t delta;
                lcb_uint64_t initial;
                const void *hashkey;
                lcb_size_t nhashkey;
            } v0;
        } v;

#ifdef __cplusplus
        lcb_arithmetic_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_arithmetic_cmd_st(const void *key,
                              lcb_size_t nkey,
                              lcb_int64_t delta,
                              int create = 0,
                              lcb_uint64_t initial = 0,
                              lcb_time_t exptime = 0) {
            version = 0;
            v.v0.key = key;
            v.v0.nkey = nkey;
            v.v0.exptime = exptime;
            v.v0.delta = delta;
            v.v0.create = create;
            v.v0.initial = initial;
            v.v0.hashkey = NULL;
            v.v0.nhashkey = 0;
        }
#endif
    } lcb_arithmetic_cmd_t;

#define LCB_O_C_ST_ID 8
#define LCB_O_C_ST_V 0
    typedef struct lcb_observe_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                const void *hashkey;
                lcb_size_t nhashkey;
            } v0;
        } v;
#ifdef __cplusplus
        lcb_observe_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_observe_cmd_st(const void *key, lcb_size_t nkey) {
            version = 0;
            v.v0.key = key;
            v.v0.nkey = nkey;
            v.v0.hashkey = NULL;
            v.v0.nhashkey = 0;
        }
#endif
    } lcb_observe_cmd_t;

#define LCB_R_C_ST_ID 9
#define LCB_R_C_ST_V 0
    typedef struct lcb_remove_cmd_st {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_cas_t cas;
                const void *hashkey;
                lcb_size_t nhashkey;
            } v0;
        } v;
#ifdef __cplusplus
        lcb_remove_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_remove_cmd_st(const void *key,
                          lcb_size_t nkey = 0,
                          lcb_cas_t cas = 0) {
            version = 0;
            v.v0.key = key;
            if (key != NULL && nkey == 0) {
                v.v0.nkey = std::strlen((const char *)key);
            } else {
                v.v0.nkey = nkey;
            }
            v.v0.cas = cas;
            v.v0.hashkey = NULL;
            v.v0.nhashkey = 0;
        }
#endif
    } lcb_remove_cmd_t;

#define LCB_H_C_ST_ID 10
#define LCB_H_C_ST_V 1
    typedef struct lcb_http_cmd_st {
        int version;
        union {
            struct {
                /* A view path string with optional query params
                   (e.g. skip, limit etc.) */
                const char *path;
                lcb_size_t npath;
                /* The POST body for HTTP request */
                const void *body;
                lcb_size_t nbody;
                /* HTTP message type to be sent to server */
                lcb_http_method_t method;
                /* If true the client will use lcb_http_data_callback to
                 * notify about response and will call lcb_http_complete
                 * with empty data eventually. */
                int chunked;
                /* The 'Content-Type' header for request. For view requests
                 * it is usually "application/json", for management --
                 * "application/x-www-form-urlencoded". */
                const char *content_type;
            } v0;
            /* v1 is used by the raw http requests. It is exactly the
             * same layout as v0, but it contains an extra field;
             * the hostname & port to use....
             */
            struct {
                /* A view path string with optional query params
                   (e.g. skip, limit etc.) */
                const char *path;
                lcb_size_t npath;
                /* The POST body for HTTP request */
                const void *body;
                lcb_size_t nbody;
                /* HTTP message type to be sent to server */
                lcb_http_method_t method;
                /* If true the client will use lcb_http_data_callback to
                 * notify about response and will call lcb_http_complete
                 * with empty data eventually. */
                int chunked;
                /* The 'Content-Type' header for request. For view requests
                 * it is usually "application/json", for management --
                 * "application/x-www-form-urlencoded". */
                const char *content_type;

                /* The host and port used for this request */
                const char *host;
                const char *username;
                const char *password;
            } v1;
        } v;
#ifdef __cplusplus
        lcb_http_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }

        lcb_http_cmd_st(const char *path, lcb_size_t npath, const void *body,
                        lcb_size_t nbody, lcb_http_method_t method,
                        int chunked, const char *content_type) {
            version = 0;
            v.v0.path = path;
            v.v0.npath = npath;
            v.v0.body = body;
            v.v0.nbody = nbody;
            v.v0.method = method;
            v.v0.chunked = chunked;
            v.v0.content_type = content_type;
        }
#endif
    } lcb_http_cmd_t;

#define LCB_S_S_C_ST_ID 11
#define LCB_S_S_C_ST_V 0
    typedef struct lcb_server_stats_cmd_st {
        int version;
        union {
            struct {
                /** The name of the stats group to get */
                const void *name;
                /** The number of bytes in name */
                lcb_size_t nname;
            } v0;
        } v;

#ifdef __cplusplus
        lcb_server_stats_cmd_st(const char *name = NULL,
                                lcb_size_t nname = 0) {
            version = 0;
            v.v0.name = name;
            v.v0.nname = nname;
            if (name != NULL && nname == 0) {
                v.v0.nname = std::strlen(name);
            } else {
                v.v0.nname = nname;
            }
        }
#endif
    } lcb_server_stats_cmd_t;

#define LCB_S_V_C_ST_ID 12
#define LCB_S_V_C_ST_V 0
    typedef struct lcb_server_version_cmd_st {
        int version;
        union {
            struct {
                const void *notused;
            } v0;
        } v;

#ifdef __cplusplus
        lcb_server_version_cmd_st() {
            std::memset(this, 0, sizeof(*this));
        }
#endif
    } lcb_server_version_cmd_t;

#define LCB_V_C_ST_ID 13
#define LCB_V_C_ST_V 0
    typedef struct lcb_verbosity_cmd_st {
        int version;
        union {
            struct {
                const char *server;
                lcb_verbosity_level_t level;
            } v0;
        } v;

#ifdef __cplusplus
        lcb_verbosity_cmd_st(lcb_verbosity_level_t level = LCB_VERBOSITY_WARNING,
                             const char *server = NULL) {
            version = 0;
            v.v0.server = server;
            v.v0.level = level;
        }
#endif
    } lcb_verbosity_cmd_t;

#define LCB_F_C_ST_ID 14
#define LCB_F_C_ST_V 0
    typedef struct lcb_flush_cmd_st {
        int version;
        union {
            struct {
                int unused;
            } v0;
        } v;

#ifdef __cplusplus
        lcb_flush_cmd_st() {
            version = 0;
        }
#endif
    } lcb_flush_cmd_t;

#define LCB_G_R_ST_ID 15
#define LCB_G_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                const void *bytes;
                lcb_size_t nbytes;
                lcb_uint32_t flags;
                lcb_cas_t cas;
                lcb_datatype_t datatype;
            } v0;
        } v;
    } lcb_get_resp_t;

#define LCB_S_R_ST_ID 16
#define LCB_S_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_cas_t cas;
            } v0;
        } v;
    } lcb_store_resp_t;

#define LCB_R_R_ST_ID 17
#define LCB_R_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_cas_t cas;
            } v0;
        } v;
    } lcb_remove_resp_t;

#define LCB_T_R_ST_ID 18
#define LCB_T_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_cas_t cas;
            } v0;
        } v;
    } lcb_touch_resp_t;

#define LCB_U_R_ST_ID 19
#define LCB_U_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
            } v0;
        } v;
    } lcb_unlock_resp_t;

#define LCB_A_R_ST_ID 20
#define LCB_A_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_uint64_t value;
                lcb_cas_t cas;
            } v0;
        } v;
    } lcb_arithmetic_resp_t;

#define LCB_O_R_ST_ID 21
#define LCB_O_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                const void *key;
                lcb_size_t nkey;
                lcb_cas_t cas;
                lcb_observe_t status;
                int from_master;          /* zero if key came from replica */
                lcb_time_t ttp;           /* average time to persist */
                lcb_time_t ttr;           /* average time to replicate */
            } v0;
        } v;
    } lcb_observe_resp_t;

#define LCB_H_R_ST_ID 22
#define LCB_H_R_ST_V 0
    typedef struct {
        int version;
        union {
            struct {
                lcb_http_status_t status;
                const char *path;
                lcb_size_t npath;
                const char *const *headers;
                const void *bytes;
                lcb_size_t nbytes;
            } v0;
        } v;
    } lcb_http_resp_t;

#define LCB_S_S_R_ST_ID 23
#define LCB_S_S_R_ST_V 0
    typedef struct lcb_server_stat_resp_st {
        int version;
        union {
            struct {
                const char *server_endpoint;
                const void *key;
                lcb_size_t nkey;
                const void *bytes;
                lcb_size_t nbytes;
            } v0;
        } v;
    } lcb_server_stat_resp_t;

#define LCB_S_V_R_ST_ID 24
#define LCB_S_V_R_ST_V 0
    typedef struct lcb_server_version_resp_st {
        int version;
        union {
            struct {
                const char *server_endpoint;
                const char *vstring;
                lcb_size_t nvstring;
            } v0;
        } v;
    } lcb_server_version_resp_t;

#define LCB_V_R_ST_ID 25
#define LCB_V_R_ST_V 0
    typedef struct lcb_verbosity_resp_st {
        int version;
        union {
            struct {
                const char *server_endpoint;
            } v0;
        } v;
    } lcb_verbosity_resp_t;

#define LCB_F_R_ST_ID 26
#define LCB_F_R_ST_V 0
    typedef struct lcb_flush_resp_st {
        int version;
        union {
            struct {
                const char *server_endpoint;
            } v0;
        } v;
    } lcb_flush_resp_t;

#define LCB_ST_M 26

#ifdef __cplusplus
}
#endif

#endif
