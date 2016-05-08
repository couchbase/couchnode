/**
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
 **/

#ifndef LCB_VIEWROW_H_
#define LCB_VIEWROW_H_

#include <libcouchbase/couchbase.h>
#include <libcouchbase/views.h>
#include "contrib/jsonsl/jsonsl.h"
#include "simplestring.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct lcbvrow_PARSER_st lcbjsp_PARSER;

typedef enum {
    LCBJSP_MODE_VIEWS,
    LCBJSP_MODE_N1QL,
    LCBJSP_MODE_FTS
} lcbjsp_MODE;

typedef enum {
    /**This is a row of view data. You can parse this as JSON from your
     * favorite decoder/converter */
    LCBJSP_TYPE_ROW,

    /**
     * All the rows have been returned. In this case, the data is the 'meta'.
     * This is a valid JSON payload which was returned from the server.
     * The "rows" : [] array will be empty.
     */
    LCBJSP_TYPE_COMPLETE,

    /**
     * A JSON parse error occured. The payload will contain string data. This
     * may be JSON (but this is not likely).
     * The callback will be delivered twice. First when the error is noticed,
     * and second at the end (instead of a COMPLETE callback)
     */
    LCBJSP_TYPE_ERROR
} lcbjsp_ROWTYPE;


typedef struct {
    lcbjsp_ROWTYPE type; /**< The type of data encapsulated */
    lcb_IOV docid;
    lcb_IOV key;
    lcb_IOV value;
    lcb_IOV row;
    lcb_IOV geo;
} lcbjsp_ROW;

typedef void (*lcbjsp_CALLBACK)(lcbjsp_PARSER*,const lcbjsp_ROW*);

struct lcbvrow_PARSER_st {
    jsonsl_t jsn; /**< Parser for the row itself */
    jsonsl_t jsn_rdetails; /**< Parser for the row details */
    jsonsl_jpr_t jpr; /**< jsonpointer match object */
    lcb_string meta_buf; /**< String containing the skeleton (outer layer) */
    lcb_string current_buf; /**< Scratch/read buffer */
    lcb_string last_hk; /**< Last hashkey */

    lcb_U8 mode;

    /* flags. This should be an int with a bunch of constant flags */
    lcb_U8 have_error;
    lcb_U8 initialized;
    lcb_U8 meta_complete;
    unsigned rowcount;

    /* absolute position offset corresponding to the first byte in current_buf */
    size_t min_pos;

    /* minimum (absolute) position to keep */
    size_t keep_pos;

    /**
     * size of the metadata header chunk (i.e. everything until the opening
     * bracket of "rows" [
     */
    size_t header_len;

    /**
     * Position of last row returned. If there are no subsequent rows, this
     * signals the beginning of the metadata trailer
     */
    size_t last_row_endpos;

    void *data;

    /**
     * std::string to contain parsed document ID.
     */
    void *cxx_data;

    /* callback to invoke */
    lcbjsp_CALLBACK callback;
};

/**
 * Creates a new vrow context object.
 * You must set callbacks on this object if you wish it to be useful.
 * You must feed it data (calling vrow_feed) as well. The data may be fed
 * in chunks and callbacks will be invoked as each row is read.
 */
lcbjsp_PARSER*
lcbjsp_create(int);

/**
 * Resets the context to a pristine state. Callbacks and cookies are kept.
 * This may be more efficient than allocating/freeing a context each time
 * (as this can be expensive with the jsonsl structures)
 */
void
lcbjsp_reset(lcbjsp_PARSER *ctx);

/**
 * Frees a vrow object created by vrow_create
 */
void
lcbjsp_free(lcbjsp_PARSER *ctx);

/**
 * Feeds data into the vrow. The callback may be invoked multiple times
 * in this function. In the context of normal lcb usage, this will typically
 * be invoked from within an http_data_callback.
 */
void
lcbjsp_feed(lcbjsp_PARSER *ctx, const char *data, size_t ndata);

/**
 * Parse the row buffer into its constituent parts. This should be called
 * if you want to split the row into its basic 'docid', 'key' and 'value'
 * fields
 * @param vp The parser to use
 * @param vr The row to parse. This assumes the row's "row" field is properly
 * set.
 */
void
lcbjsp_parse_viewrow(lcbjsp_PARSER *vp, lcbjsp_ROW *vr);

/**
 * Get the raw contents of the current buffer. This can be used to debug errors.
 *
 * Note that the buffer may be partial or malformed or otherwise unsuitable
 * for structured inspection, but may help human observers debug problems.
 *
 * @param v The parser
 * @param out The iov structure to contain the buffer/offset
 */
void
lcbjsp_get_postmortem(const lcbjsp_PARSER *v, lcb_IOV *out);

#ifdef __cplusplus
}
#endif

#endif /* LCB_VIEWROW_H_ */
