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
 **/

#ifndef LCB_CBFT_H
#define LCB_CBFT_H

#ifdef __cplusplus
extern "C" {
#endif


/**
 * @ingroup lcb-public-api
 * @defgroup lcb-cbft-api Full Text Search (Experimental)
 * @brief Search for strings in documents and more
 */

/**
 * @addtogroup lcb-cbft-api
 * @{
 */

/**
 * Response structure for full-text searches.
 */
typedef struct {
    #ifndef __LCB_DOXYGEN__
    LCB_RESP_BASE
    #else
    lcb_U16 rflags; /**< Flags for response structure */
    #endif
    /**
     * A query hit, or response metadta
     * (if #rflags contains @ref LCB_RESP_F_FINAL). The format of the row will
     * be JSON, and should be decoded by a JSON decoded in your application.
     */
    const char *row;
    /** Length of #row */
    size_t nrow;
    /** Original HTTP response obejct */
    const lcb_RESPHTTP *htresp;
} lcb_RESPFTS;

typedef void (*lcb_FTSCALLBACK)(lcb_t, int, const lcb_RESPFTS *);
typedef struct lcb_FTSREQ* lcb_FTSHANDLE;

/**
 * @brief Search Command
 */
typedef struct {
    /** Modifiers for command. Currently none are defined */
    lcb_U32 cmdflags;
    /** Encoded JSON query */
    const char *query;
    /** Length of JSON query */
    size_t nquery;
    /** Callback to be invoked. This must be supplied */
    lcb_FTSCALLBACK callback;
    /**
     * Optional pointer to store the handle. The handle may then be
     * used for query cancellation via lcb_fts_cancel()
     */
    lcb_FTSHANDLE *handle;
} lcb_CMDFTS;

/**
 * @volatile
 * Issue a full-text query. The callback (lcb_CMDFTS::callback) will be invoked
 * for each hit. It will then be invoked one last time with the result
 * metadata (including any facets) and the lcb_RESPFTS::rflags field having
 * the @ref LCB_RESP_F_FINAL bit set
 *
 * @param instance the instance
 * @param cookie opaque user cookie to be set in the response object
 * @param cmd command containing the query and callback
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_fts_query(lcb_t instance, const void *cookie, const lcb_CMDFTS *cmd);

/**
 * @volatile
 * Cancel a full-text query in progress. The handle is usually obtained via the
 * lcb_CMDFTS::handle pointer.
 */
LIBCOUCHBASE_API
void
lcb_fts_cancel(lcb_t, lcb_FTSHANDLE);

/**
 * @}
 */
#ifdef __cplusplus
}
#endif
#endif
