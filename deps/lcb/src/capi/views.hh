/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2020 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_CAPI_VIEWS_HH
#define LIBCOUCHBASE_CAPI_VIEWS_HH

#include <cstddef>
#include <cstdint>

/**
 * @private
 */
struct lcb_VIEW_ERROR_CONTEXT_ {
    lcb_STATUS rc;
    const char *first_error_code;
    std::size_t first_error_code_len;
    const char *first_error_message;
    std::size_t first_error_message_len;
    const char *design_document;
    std::size_t design_document_len;
    const char *view;
    std::size_t view_len;
    const char *query_params;
    std::size_t query_params_len;
    uint32_t http_response_code;
    const char *http_response_body;
    std::size_t http_response_body_len;
    const char *endpoint;
    std::size_t endpoint_len;
};

/** Set this flag to execute an actual get with each response */
#define LCB_CMDVIEWQUERY_F_INCLUDE_DOCS (1u << 16u)

/**Set this flag to only parse the top level row, and not its constituent
 * parts. Note this is incompatible with `F_INCLUDE_DOCS`*/
#define LCB_CMDVIEWQUERY_F_NOROWPARSE (1u << 17u)

/**This view is spatial. Modifies how the final view path will be constructed */
#define LCB_CMDVIEWQUERY_F_SPATIAL (1u << 18u)

/** Command structure for querying a view */
struct lcb_CMDVIEW_ {
    std::uint32_t cmdflags;
    std::uint32_t exptime;
    std::uint64_t cas;
    std::uint32_t cid;
    const char *scope;
    std::size_t nscope;
    const char *collection;
    std::size_t ncollection;
    lcb_KEYBUF key;
    std::uint32_t timeout{0};
    lcbtrace_SPAN *pspan{nullptr};

    /** The design document as a string; e.g. `"beer"` */
    const char *ddoc{nullptr};
    /** Length of design document name */
    std::size_t nddoc{0};

    /** The name of the view as a string; e.g. `"brewery_beers"` */
    const char *view{nullptr};
    /** Length of the view name */
    std::size_t nview{0};

    /**Any URL parameters to be passed to the view should be specified here.
     * The library will internally insert a `?` character before the options
     * (if specified), so do not place one yourself.
     *
     * The format of the options follows the standard for passing parameters
     * via HTTP requests; thus e.g. `key1=value1&key2=value2`. This string
     * is itself not parsed by the library but simply appended to the URL. */
    const char *optstr{nullptr};

    /** Length of the option string */
    std::size_t noptstr{0};

    /**Some query parameters (in particular; 'keys') may be send via a POST
     * request within the request body, since it might be too long for the
     * URI itself. If you have such data, place it here. */
    const char *postdata{nullptr};
    std::size_t npostdata{0};

    /**
     * The maximum number of internal get requests to issue concurrently for
     * @c F_INCLUDE_DOCS. This is useful for large view responses where
     * there is a potential for a large number of responses resulting in a large
     * number of get requests; increasing memory usage.
     *
     * Setting this value will attempt to throttle the number of get requests,
     * so that no more than this number of requests will be in progress at any
     * given time.
     */
    unsigned docs_concurrent_max{0};

    /**Callback to invoke for each row. If not provided, @ref LCB_ERR_INVALID_ARGUMENT will
     * be returned from lcb_view_query() */
    lcb_VIEW_CALLBACK callback{nullptr};

    /**If not NULL, this will be set to a handle which may be passed to
     * lcb_view_cancel(). See that function for more details */
    lcb_VIEW_HANDLE **handle{nullptr};
};

/**@brief Response structure representing a row.
 *
 * This is provided for each invocation of the
 * lcb_CMDVIEWQUERY::callback invocation. The `key` and `nkey` fields here
 * refer to the first argument passed to the `emit` function by the
 * `map` function.
 *
 * This response structure may be used as-is, in case the values are simple,
 * or may be relayed over to a more advanced JSON parser to decode the
 * individual key and value properties.
 *
 * @note
 * The #key and #value fields are JSON encoded. This means that if they are
 * bare strings, they will be surrounded by quotes. On the other hand, the
 * #docid is _not_ JSON encoded and is provided with any surrounding quotes
 * stripped out (this is because the document ID is always a string). Please
 * take note of this if doing any form of string comparison/processing.
 *
 * @note
 * If the @ref LCB_CMDVIEWQUERY_F_NOROWPARSE flag has been set, the #value
 * field will contain the raw row contents, rather than the constituent
 * elements.
 *
 */
struct lcb_RESPVIEW_ {
    lcb_VIEW_ERROR_CONTEXT ctx;
    void *cookie;
    std::uint16_t rflags;

    const char *docid;  /**< Document ID (i.e. memcached key) associated with this row */
    std::size_t ndocid; /**< Length of document ID */

    const char *key;
    std::size_t nkey;

    /**Emitted value. If `rflags & LCB_RESP_F_FINAL` is true then this will
     * contain the _metadata_ of the view response itself. This includes the
     * `total_rows` field among other things, and should be parsed as JSON */
    const char *value;

    std::size_t nvalue; /**< Length of emitted value */

    /**If this is a spatial view, the GeoJSON geometry fields will be here */
    const char *geometry;
    std::size_t ngeometry;

    /**If the request failed, this will contain the raw underlying request.
     * You may inspect this request and perform some other processing on
     * the underlying HTTP data. Note that this may not necessarily contain
     * the entire response body; just the chunk at which processing failed.*/
    const lcb_RESPHTTP *htresp;

    /**If @ref LCB_CMDVIEWQUERY_F_INCLUDE_DOCS was specified in the request,
     * this will contain the response for the _GET_ command. This is the same
     * response as would be received in the `LCB_CALLBACK_GET` for
     * lcb_get3().
     *
     * Note that this field should be checked for various errors as well, as it
     * is remotely possible the get request did not succeed.
     *
     * If the @ref LCB_CMDVIEWQUERY_F_INCLUDE_DOCS flag was not specified, this
     * field will be `NULL`.
     */
    const lcb_RESPGET *docresp;

    lcb_VIEW_HANDLE *handle;
};

#endif // LIBCOUCHBASE_CAPI_VIEWS_HH
