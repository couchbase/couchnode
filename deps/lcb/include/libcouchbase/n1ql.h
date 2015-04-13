/*
 *     Copyright 2015 Couchbase, Inc.
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
 **/

#ifndef LCB_N1QL_API_H
#define LCB_N1QL_API_H
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @ingroup lcb-public-api
 * @defgroup lcb-n1ql-api N1QL Query API
 * @brief Execute N1QL queries and receive resultant rows
 */

/**
 * @addtogroup lcb-n1ql-api
 * @{
 */
typedef struct lcb_RESPN1QL lcb_RESPN1QL;
typedef struct lcb_CMDN1QL lcb_CMDN1QL;
typedef struct lcb_N1QLREQ* lcb_N1QLHANDLE;

/**
 * Callback to be invoked for each row
 * @param The instance
 * @param Callback type. This is set to @ref LCB_CALLBACK_N1QL
 * @param The response.
 */
typedef void (*lcb_N1QLCALLBACK)(lcb_t, int, const lcb_RESPN1QL*);

/**
 * @name N1QL Parameters
 *
 * The following APIs simply provide wrappers for creating the proper HTTP
 * form parameters for N1QL requests. The general flow is to create a
 * parameters (@ref lcb_N1QLPARAMS) object, set various options and properties
 * on it, and populate an @ref lcb_CMDN1QL object using the lcb_n1p_mkcmd()
 * function.
 *
 * @{
 */

/**
 * Opaque object representing N1QL parameters.
 * This object is created via lcb_n1p_new(), may be cleared
 * (for use with another query) via lcb_n1p_reset(), and may be freed via
 * lcb_n1p_free().
 */
typedef struct lcb_N1QLPARAMS_st lcb_N1QLPARAMS;

/**
 * Create a new N1QL Parameters object. The returned object is an opaque
 * pointer which may be used to set various properties on a N1QL query. This
 * may then be used to populate relevant fields of an @ref lcb_CMDN1QL
 * structure.
 */
LIBCOUCHBASE_API
lcb_N1QLPARAMS *
lcb_n1p_new(void);

/**
 * Reset the parameters structure so that it may be reused for a subsequent
 * query. Internally this resets the buffer positions to 0, but does not free
 * them, making this function optimal for issusing subsequent queries.
 * @param params the object to reset
 */
LIBCOUCHBASE_API
void
lcb_n1p_reset(lcb_N1QLPARAMS *params);

/**
 * Free the parameters structure. This should be done when it is no longer
 * needed
 * @param params the object to reset
 */
LIBCOUCHBASE_API
void
lcb_n1p_free(lcb_N1QLPARAMS *params);

/** Query is a statement string */
#define LCB_N1P_QUERY_STATEMENT 1

/** Query is a prepared statement returned via the `PREPARE` statement */
#define LCB_N1P_QUERY_PREPARED 2

/**
 * Sets the actual statement to be executed
 * @param params the params object
 * @param qstr the query string (either N1QL statement or prepared JSON)
 * @param nqstr the length of the string. Set to -1 if NUL-terminated
 * @param type the type of statement. Can be either ::LCB_N1P_QUERY_STATEMENT
 * or ::LCB_N1P_QUERY_PREPARED
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_setquery(lcb_N1QLPARAMS *params, const char *qstr, size_t nqstr, int type);

#define lcb_n1p_setstmtz(params, qstr) \
    lcb_n1p_setquery(params, qstr, -1, LCB_N1P_QUERY_STATEMENT)

/**
 * Sets a named argument for the query.
 * @param params the object
 * @param name The argument name (e.g. `$age`)
 * @param n_name
 * @param value The argument value (e.g. `42`)
 * @param n_value
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_namedparam(lcb_N1QLPARAMS *params, const char *name, size_t n_name,
    const char *value, size_t n_value);

#define lcb_n1p_namedparamz(params, name, value) \
    lcb_n1p_namedparam(params, name, -1, value, -1)

/**
 * Adds a _positional_ argument for the query
 * @param params the params object
 * @param value the argument
 * @param n_value the length of the argument.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_posparam(lcb_N1QLPARAMS *params, const char *value, size_t n_value);

/**
 * Set a query option
 * @param params the params object
 * @param name the name of the option
 * @param n_name
 * @param value the value of the option
 * @param n_value
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_setopt(lcb_N1QLPARAMS *params, const char *name, size_t n_name,
    const char *value, size_t n_value);

/**
 * Convenience function to set a string parameter with a string value
 * @param params the parameter object
 * @param key the NUL-terminated option name
 * @param value the NUL-terminated option value
 */
#define lcb_n1p_setoptz(params, key, value) \
    lcb_n1p_setopt(params, key, -1, value, -1)


/** No consistency constraints */
#define LCB_N1P_CONSISTENCY_NONE 0

/**
 * This is implicitly set by the lcb_n1p_synctok() family of functions. This
 * will ensure that mutations up to the vector indicated by the synctoken
 * passed to lcb_n1p_synctok() are used.
 */
#define LCB_N1P_CONSISTENCY_RYOW 1

/** Refresh the snapshot for each request */
#define LCB_N1P_CONSISTENCY_REQUEST 2

/** Refresh the snapshot for each statement */
#define LCB_N1P_CONSISTENCY_STATMENT 3

/**
 * Sets the consistency mode for the request.
 * By default results are read from a potentially stale snapshot of the data.
 * This may be good for most cases; however at times you want the absolutely
 * most recent data.
 * @param params the parameters object
 * @param mode one of the `LCB_N1P_CONSISTENT_*` constants.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_setconsistency(lcb_N1QLPARAMS *params, int mode);


typedef struct {
    lcb_U64 uuid_;
    lcb_U64 seqno_;
    lcb_U16 vbid_;
} lcb_N1QLSCANVEC;

/**
 * Indicate that the query should synchronize its internal snapshot to reflect
 * the changes indicated by the given synctoken (`ss`). The synctoken may be
 * obtained via lcb_get_synctoken().See lcb_n1p_synctok_for() for a
 * convenience version of this function.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_scanvec(lcb_N1QLPARAMS *params, const lcb_N1QLSCANVEC *sv);


/**
 * Wrapper around lcb_get_synctoken() and lcb_n1p_synctok(). This will
 * retrieve the latest mutation/vector for the given key on the cluster.
 * @param params the parameters object
 * @param instance the instance on which this mutation was performed
 * @param key the key
 * @param nkey the length of the key
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_synctok_for(lcb_N1QLPARAMS *params, lcb_t instance,
    const void *key, size_t nkey);

/**
 * Populates the given low-level lcb_CMDN1QL structure with the relevant fields
 * from the params structure. If this function returns successfuly, you must
 * ensure that the params object is not modified until the command is
 * submitted. Afterwards, you can use lcb_n1p_free() or lcb_n1p_reset() to
 * free/reuse the structure for subsequent requests
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1p_mkcmd(lcb_N1QLPARAMS *params, lcb_CMDN1QL *cmd);

/**@}*/

/**
 * @name Low-level N1QL interface
 * @{
 */

/**
 * Command structure for N1QL queries. Typically an application will use the
 * lcb_N1QLPARAMS structure to populate the #query and #content_type fields.
 *
 * The #callback field must be specified, and indicates the function the
 * library should call when more response data has arrived.
 */
struct lcb_CMDN1QL {
    lcb_U32 cmdflags;
    /**Query to be placed in the POST request. The library will not perform
     * any conversions or validation on this string, so it is up to the user
     * (or wrapping library) to ensure that the string is well formed.
     *
     * If using the @ref lcb_N1QLPARAMS structure, the lcb_n1p_mkcmd() function
     * will properly populate this field.
     *
     * In general the string should either be JSON (in which case, the
     * #content_type field should be `application/json`) or url-encoded
     * (in which case the #content_type field should be
     * `application/x-www-form-urlencoded`)
     */
    const char *query;

    /** Length of the query data */
    size_t nquery;

    /**cbq-engine host:port. If left NULL, the address will be discovered via
     * the configuration. This field exists primarily because at the time of
     * writing, N1QL is an experimental feature not advertised in the cluster
     * configuration.
     */
    const char *host;

    /**Content type for query. Must be specified. */

    const char *content_type;
    /** Callback to be invoked for each row */
    lcb_N1QLCALLBACK callback;

    /** Request handle. Currently unused */
    lcb_N1QLHANDLE *handle;
};

/**
 * Response for a N1QL query. This is delivered in the @ref lcb_N1QLCALLBACK
 * callback function for each result row received. The callback is also called
 * one last time when all
 */
struct lcb_RESPN1QL {
    #ifndef __LCB_DOXYGEN__
    LCB_RESP_BASE
    #else
    lcb_U16 rflags; /**< Flags for response structure */
    #endif

    /**Current result row. If #rflags has the ::LCB_RESP_F_FINAL bit set, then
     * this field does not contain the actual row, but the remainder of the
     * data not included with the resultset; e.g. the JSON surrounding
     * the "results" field with any errors or metadata for the response.
     */
    const char *row;
    /** Length of the row */
    size_t nrow;
    /** Raw HTTP response, if applicable */
    const lcb_RESPHTTP *htresp;
};

/**
 * @volatile
 *
 * Execute a N1QL query.
 *
 * This function will send the query to a query server in the cluster (or if
 * lcb_CMDN1QL::host is set, to the given host), and will invoke the callback
 * (lcb_CMDN1QL::callback) for each result returned.
 *
 * @param instance The instance
 * @param cookie Pointer to application data
 * @param cmd the command
 * @return Scheduling success or failure.
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_n1ql_query(lcb_t instance, const void *cookie, const lcb_CMDN1QL *cmd);
/**@}*/
/**@}*/

#ifdef __cplusplus
}
#endif
#endif
