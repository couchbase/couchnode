#include <libcouchbase/couchbase.h>
#include <libcouchbase/views.h>
#include <libcouchbase/pktfwd.h>

#include <jsparse/parser.h>
#include "docreq.h"

struct lcbview_REQUEST_st;

typedef struct {
    lcb_DOCQREQ base;
    struct lcbview_REQUEST_st *parent;
    lcb_IOV key;
    lcb_IOV value;
    lcb_IOV geo;
    char rowbuf[1];
} lcbview_DOCREQ;

struct lcbview_REQUEST_st {
    /** Current HTTP response to provide in callbacks */
    const lcb_RESPHTTP *cur_htresp;
    /** HTTP request object, in case we need to cancel prematurely */
    struct lcb_http_request_st *htreq;
    lcbjsp_PARSER *parser;
    const void *cookie;
    lcb_DOCQUEUE *docq;
    lcb_VIEWQUERYCALLBACK callback;
    lcb_t instance;

    unsigned refcount;
    unsigned include_docs;
    unsigned no_parse_rows;
    lcb_error_t lasterr;
};

typedef struct lcbview_REQUEST_st lcbview_REQUEST;
