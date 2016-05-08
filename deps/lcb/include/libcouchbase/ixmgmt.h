/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016 Couchbase, Inc.
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

#ifndef LCB_IXMGMT_H
#define LCB_IXMGMT_H

#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @volatile
 *
 * Structure representing a single index definition
 */
typedef struct {
    /**
     * Raw JSON returned from server.
     * Can be used to decode fields in future versions not present within the
     * library.
     *
     * This can also be used as the sole input field when watching indexes
     * that are in the process of building (so you don't need to copy out
     * all the fields)
     */
    const char *rawjson;
    size_t nrawjson;

    /** Name of the index */
    const char *name;
    size_t nname;

    /** Keyspace or "bucket" of the index */
    const char *keyspace;
    size_t nkeyspace;

    /** 'namespace'. Currently unused */
    const char *nspace;
    size_t nnspace;

    /** Output parameter only. State of index */
    const char *state;
    size_t nstate;

    /** Actual index text */
    const char *fields;
    size_t nfields;

    /**
     * Modifiers for the index itself. This might be F_PRIMARY if the index
     * is primary.
     *
     * For creation the F_DEFER option is also accepted to indicate that
     * the building of this index should be deferred.
     */
    unsigned flags;

    /**
     * Type of this index, Can be T_DEFAULT for the default server type, or
     * an explicit T_GSI or T_VIEW.
     */
    unsigned ixtype;
} lcb_INDEXSPEC;

/** Input/Output flag. The index is the primary index for the bucket */
#define LCB_IXSPEC_F_PRIMARY 1<<16

/**
 * Input flag for creation. Defer the index building until later. This may
 * be used to accelerate the building of multiple indexes, so that the index
 * builder can construct all indexes by scanning items only once
 */
#define LCB_IXSPEC_F_DEFER 1<<17

/**
 * Input for index type. It's best to just leave this value to 0 (DEFAULT)
 * unless you know what you're doing.
 */
#define LCB_IXSPEC_T_DEFAULT 0
#define LCB_IXSPEC_T_GSI 1
#define LCB_IXSPEC_T_VIEW 2

struct lcb_RESPIXMGMT_st;

/**
 * Callback for index management operations
 * @param instance
 * @param cbtype - set to LCB_CALLBACK_IXMGMT
 * @param resp the response structure
 */
typedef void (*lcb_IXMGMTCALLBACK)(lcb_t instance,
        int cbtype, const struct lcb_RESPIXMGMT_st *resp);

/**
 * @volatile
 * Command for index management operations
 */
typedef struct {
    /**
     * The index to operate on. This can either be a full definition
     * (when creating an index)
     * or a partial definition (when listing or building
     * indexes)
     */
    lcb_INDEXSPEC spec;

    /**
     * Callback to be invoked when operation is complete.
     */
    lcb_IXMGMTCALLBACK callback;
} lcb_CMDIXMGMT;

/**
 * @volatile
 *
 * Response structure for index management operations
 */
typedef struct lcb_RESPIXMGMT_st {
    LCB_RESP_BASE

    /**
     * A list of pointers to specs. This isn't a simple array of specs because
     * the spec structure internally is backed by additional internal data.
     */
    const lcb_INDEXSPEC *const *specs;
    /** Number of specs */
    size_t nspecs;

    /** Inner N1QL response. Examine on error */
    const lcb_RESPN1QL *inner;
} lcb_RESPIXMGMT;

/**
 * @volatile
 *
 * Retrieve a list of all indexes in the cluster. If lcb_CMDIXMGMT::spec
 * contains entries then the search will be limited to the appropriate criteria.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_list(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd);

/**
 * @volatile
 *
 * Create an index. The index can either be a primary or secondary index, and
 * it may be created immediately or it may be deferred.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_mkindex(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd);

/**
 * @volatile
 * Remove an index.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_rmindex(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd);

/**
 * @volatile
 *
 * Build defered indexes. This may be used with the @ref LCB_IXSPEC_F_DEFER
 * option (see lcb_ixmgmt_mkindex()) to initiate the background creation of
 * indexes.
 *
 * lcb_ixmgmt_watch may be used to wait on the status of those indexes.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_build_begin(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd);

/**
 * @volatile
 *
 * Structure used for polling index building statuses
 */
typedef struct {
    /**
     * Input specs. This should be the specs received from lcb_ixmgmt_build()'s
     * callback. If you are building from scratch, only the lcb_INDEXSPEC::rawjson
     * and lcb_INDEXSPEC::nrawjson need to be populated
     */
    const lcb_INDEXSPEC * const *specs;
    /** Number of specs */
    size_t nspec;

    /**
     * Maximum amount of time to wait (microseconds).
     * If not specified, the default is 30 seconds (30 * 100000)
     */
    lcb_U32 timeout;

    /**
     * How often to check status (microseconds).
     * Default is 500 milliseconds (500000)
     */
    lcb_U32 interval;

    /**
     * Callback to invoke once the indexes have been built or the timeout
     * has been reached.
     *
     * The callback is only invoked once.
     */
    lcb_IXMGMTCALLBACK callback;
} lcb_CMDIXWATCH;

/**
 * @volatile
 * Poll indexes being built. This allows you to wait until the specified indexes
 * which are being built (using lcb_ixmgmt_build_begin()) have been fully
 * created.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_build_watch(lcb_t instance, const void *cookie, const lcb_CMDIXWATCH *cmd);

#ifdef __cplusplus
}
#endif /* __cplusplus */
#endif /* LCB_IXMGMT_H */
