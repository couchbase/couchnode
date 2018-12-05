/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018 Couchbase, Inc.
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

#ifndef LCB_ANALYTICS_API_H
#define LCB_ANALYTICS_API_H
#include <libcouchbase/couchbase.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @addtogroup lcb-n1ql-api
 * @{
 */
typedef struct lcb_RESPANALYTICS lcb_RESPANALYTICS;

typedef struct lcb_CMDANALYTICS_st lcb_CMDANALYTICS;
typedef struct lcb_ANALYTICSREQ *lcb_ANALYTICSHANDLE;

typedef void (*lcb_ANALYTICSCALLBACK)(lcb_t, int, const lcb_RESPANALYTICS *);

LIBCOUCHBASE_API
lcb_CMDANALYTICS *lcb_analytics_new(void);

LIBCOUCHBASE_API
void lcb_analytics_reset(lcb_CMDANALYTICS *cmd);

LIBCOUCHBASE_API
void lcb_analytics_free(lcb_CMDANALYTICS *cmd);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_setcallback(lcb_CMDANALYTICS *cmd, lcb_ANALYTICSCALLBACK callback);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_setquery(lcb_CMDANALYTICS *cmd, const char *query, size_t nquery);
#define lcb_analytics_setqueryz(cmd, qstr) lcb_analytics_setquery(cmd, qstr, -1)

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_setstatement(lcb_CMDANALYTICS *cmd, const char *statement, size_t nstatement);
#define lcb_analytics_setstatementz(cmd, sstr) lcb_analytics_setstatement(cmd, sstr, -1)

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_namedparam(lcb_CMDANALYTICS *cmd, const char *name, size_t nname, const char *value,
                                     size_t nvalue);
#define lcb_analytics_namedparamz(cmd, name, value) lcb_analytics_namedparam(cmd, name, -1, value, -1)

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_posparam(lcb_CMDANALYTICS *cmd, const char *value, size_t nvalue);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_setopt(lcb_CMDANALYTICS *cmd, const char *name, size_t nname, const char *value,
                                 size_t nvalue);
#define lcb_analytics_setoptz(cmd, key, value) lcb_analytics_setopt(cmd, key, -1, value, -1)

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_setdeferred(lcb_CMDANALYTICS *cmd, int deferred);

typedef enum {
    LCB_ANALYTICSINGEST_NONE = 0,
    LCB_ANALYTICSINGEST_UPSERT,
    LCB_ANALYTICSINGEST_INSERT,
    LCB_ANALYTICSINGEST_REPLACE,
    LCB_ANALYTICSINGEST__METHOD_MAX
} lcb_ANALYTICSINGESTMETHOD;

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_ingest_setmethod(lcb_CMDANALYTICS *cmd, lcb_ANALYTICSINGESTMETHOD method);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_ingest_setexptime(lcb_CMDANALYTICS *cmd, lcb_U32 exptime);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_ingest_ignoreingesterror(lcb_CMDANALYTICS *cmd, int ignore);

typedef enum {
    LCB_ANALYTICSINGEST_OK = 0,
    LCB_ANALYTICSINGEST_IGNORE,
    LCB_ANALYTICSINGEST__STATUS_MAX
} lcb_ANALYTICSINGESTSTATUS;

typedef struct {
    /* input */
    lcb_ANALYTICSINGESTMETHOD method;
    const char *row;
    size_t nrow;

    /* output */
    char *id;
    size_t nid;
    void (*id_free)(void *);
} lcb_ANALYTICSINGESTIDGENERATORPARAM;

typedef lcb_ANALYTICSINGESTSTATUS (*lcb_ANALYTICSINGESTIDGENERATOR)(lcb_t, const void *, lcb_ANALYTICSINGESTIDGENERATORPARAM *);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_ingest_setidgenerator(lcb_CMDANALYTICS *cmd, lcb_ANALYTICSINGESTIDGENERATOR generator);

typedef struct {
    /* input */
    lcb_ANALYTICSINGESTMETHOD method;
    const char *row;
    size_t nrow;

    /* output, NULL for passthrough */
    char *out;
    size_t nout;
    void (*out_free)(void *);
} lcb_ANALYTICSINGESTDATACONVERTERPARAM;

typedef lcb_ANALYTICSINGESTSTATUS (*lcb_ANALYTICSINGESTDATACONVERTER)(lcb_t, const void *, lcb_ANALYTICSINGESTDATACONVERTERPARAM *);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_ingest_setdataconverter(lcb_CMDANALYTICS *cmd, lcb_ANALYTICSINGESTDATACONVERTER converter);

/**
 * Response for a Analytics query. This is delivered in the @ref lcb_ANALYTICSCALLBACK
 * callback function for each result row received. The callback is also called
 * one last time when all
 */
struct lcb_RESPANALYTICS {
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
 * Execute a Analytics query.
 *
 * This function will send the query to a query server in the cluster
 * and will invoke the callback (lcb_CMDANALYTICS::callback) for each result returned.
 *
 * @param instance The instance
 * @param cookie Pointer to application data
 * @param cmd the command
 * @return Scheduling success or failure.
 */
LIBCOUCHBASE_API
lcb_error_t lcb_analytics_query(lcb_t instance, const void *cookie, lcb_CMDANALYTICS *cmd);

typedef struct lcb_ANALYTICSDEFERREDHANDLE_st lcb_ANALYTICSDEFERREDHANDLE;

LIBCOUCHBASE_API
lcb_ANALYTICSDEFERREDHANDLE *lcb_analytics_defhnd_extract(const lcb_RESPANALYTICS *response);

LIBCOUCHBASE_API
void lcb_analytics_defhnd_free(lcb_ANALYTICSDEFERREDHANDLE *handle);

LIBCOUCHBASE_API
const char *lcb_analytics_defhnd_status(lcb_ANALYTICSDEFERREDHANDLE *handle);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_defhnd_setcallback(lcb_ANALYTICSDEFERREDHANDLE *handle, lcb_ANALYTICSCALLBACK callback);

LIBCOUCHBASE_API
lcb_error_t lcb_analytics_defhnd_poll(lcb_t instance, const void *cookie, lcb_ANALYTICSDEFERREDHANDLE *handle);
/**
 * Cancels an in-progress request. This will ensure that further callbacks
 * for the given request are not delivered.
 *
 * @param instance the instance
 * @param handle the handle for the request. This is obtained during the
 *  request as an 'out' parameter (see lcb_CMDANALYTICS::handle)
 *
 * To obtain the `handle` parameter, do something like this:
 *
 * @code{.c}
 * lcb_CMDANALYTICS *cmd;
 * // (Initialize command...)
 * lcb_n1ql_query(instance, cookie, &cmd);
 * lcb_ANALYTICSHANDLE handle = lcb_analytics_gethandle(cmd);
 * lcb_analytics_free(cmd);
 * @endcode.
 *
 * If the lcb_analytics_query() function returns `LCB_SUCCESS` then the `handle`
 * above is populated with the opaque handle. You can then use this handle
 * to cancel the query at a later point, such as within the callback.
 *
 * @code{.c}
 * lcb_analytics_cancel(instance, handle);
 * @endcode
 */
LIBCOUCHBASE_API
void lcb_analytics_cancel(lcb_t instance, lcb_ANALYTICSHANDLE handle);

/**@}*/

/**@}*/

/**
 * @ingroup lcb-public-api
 * @addtogroup lcb-tracing-api
 * @{
 */
#ifdef LCB_TRACING

/**
 * Associate parent tracing span with the Analytics request.
 *
 * @param instance the instance
 * @param handle Analytics request handle
 * @param span parent span
 *
 * @par Attach parent tracing span to request object.
 * @code{.c}
 * lcb_CMDANALYTICS *cmd = lcb_analytics_new();
 * // initialize Analytics command...
 *
 * lcb_analytics_setparentspan(instance, handle, span);
 *
 * lcb_error_t err = lcb_analytics_query(instance, cookie, cmd);
 * @endcode
 *
 * @committed
 */
LIBCOUCHBASE_API
void lcb_analytics_setparentspan(lcb_CMDANALYTICS *cmd, lcbtrace_SPAN *span);

#endif
/**
 * @} (Group: Tracing)
 */
#ifdef __cplusplus
}
#endif
#endif
