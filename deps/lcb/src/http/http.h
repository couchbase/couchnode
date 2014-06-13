#ifndef LCB_HTTPAPI_H
#define LCB_HTTPAPI_H

#include <libcouchbase/couchbase.h>
#include <lcbio/lcbio.h>
#include <lcbio/timer-ng.h>
#include <lcbht/lcbht.h>
#include "contrib/http_parser/http_parser.h"
#include "list.h"
#include "simplestring.h"

typedef struct {
    lcb_list_t list;
    char *key;
    char *val;
} lcb_http_header_t;

typedef enum {
    /** The request is still ongoing. Callbacks are still active */
    LCB_HTREQ_S_ONGOING = 0,
    /** The on_complete callback has been invoked */
    LCB_HTREQ_S_CBINVOKED = 1 << 0,
    /** The object has been purged from either its servers' or instances'
     * hashset. */
    LCB_HTREQ_S_HTREMOVED = 1 << 1
} lcb_http_request_status_t;

struct lcb_http_request_st {
    lcb_t instance;
    /** The URL buffer */
    char *url;
    lcb_size_t nurl;
    /** The URL info */
    struct http_parser_url url_info;
    /** The requested path (without couch api endpoint) */
    char *path;
    lcb_size_t npath;
    /** The body buffer */
    char *body;
    lcb_size_t nbody;
    /** The type of HTTP request */
    lcb_http_method_t method;
    char *host;
    lcb_size_t nhost;
    char *port;
    lcb_size_t nport;

    /** Non-zero if caller would like to receive response in chunks */
    int chunked;
    /** This callback will be executed when the whole response will be
     * transferred */
    lcb_http_complete_callback on_complete;
    /** This callback will be executed for each chunk of the response */
    lcb_http_data_callback on_data;
    /** The cookie belonging to this request */
    const void *command_cookie;
    /** Reference count */
    unsigned int refcount;
    /** Redirect count */
    int redircount;
    char *redirect_to;
    lcb_string outbuf;

    /** Current state */
    lcb_http_request_status_t status;

    /** Request type; views or management */
    lcb_http_type_t reqtype;

    /** Request headers */
    lcb_http_header_t headers_out;
    /** Headers array for passing to callbacks */
    char **headers;
    lcbio_pTABLE io;
    lcb_timer_t io_timer;
    lcbio_CONNREQ creq;
    lcbio_CTX *ioctx;
    lcbht_pPARSER parser;
    /** IO Timeout */
    lcb_uint32_t timeout;
};

void
lcb_http_request_finish(lcb_t instance,
    lcb_http_request_t req, lcb_error_t error);

void
lcb_http_request_decref(lcb_http_request_t req);

lcb_error_t
lcb_http_verify_url(lcb_http_request_t req, const char *base, lcb_size_t nbase);

lcb_error_t
lcb_http_request_exec(lcb_http_request_t req);

lcb_error_t
lcb_http_request_connect(lcb_http_request_t req);

void
lcb_setup_lcb_http_resp_t(lcb_http_resp_t *resp,
    lcb_http_status_t status, const char *path, lcb_size_t npath,
    const char *const *headers, const void *bytes, lcb_size_t nbytes);

#endif
