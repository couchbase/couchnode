#include <libcouchbase/couchbase.h>
#include <libcouchbase/views.h>
#include <libcouchbase/pktfwd.h>
#include <jsparse/parser.h>
#include <string>
#include "docreq.h"

namespace lcb {
namespace views {

struct ViewRequest;
struct VRDocRequest : docreq::DocRequest {
    ViewRequest *parent;
    lcb_IOV key;
    lcb_IOV value;
    lcb_IOV geo;
    std::string rowbuf;
};

struct ViewRequest : lcb::jsparse::Parser::Actions {
    ViewRequest(lcb_t, const void*, const lcb_CMDVIEWQUERY*);
    ~ViewRequest();
    void invoke_last(lcb_error_t err);
    void invoke_last() { invoke_last(lasterr); }
    void invoke_row(lcb_RESPVIEWQUERY*);
    void unref() {if(!--refcount){delete this;}}
    void ref() {refcount++;}
    void cancel();

    /**
     * Perform the actual HTTP request
     * @param cmd User's command
     */
    inline lcb_error_t request_http(const lcb_CMDVIEWQUERY* cmd);

    bool is_include_docs() const {
        return cmdflags & LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    }
    bool is_no_rowparse() const {
        return cmdflags & LCB_CMDVIEWQUERY_F_NOROWPARSE;
    }
    bool is_spatial() const {
        return cmdflags & LCB_CMDVIEWQUERY_F_SPATIAL;
    }

    void JSPARSE_on_row(const lcb::jsparse::Row&);
    void JSPARSE_on_error(const std::string&);
    void JSPARSE_on_complete(const std::string&);

    /** Current HTTP response to provide in callbacks */
    const lcb_RESPHTTP *cur_htresp;
    /** HTTP request object, in case we need to cancel prematurely */
    struct lcb_http_request_st *htreq;
    lcb::jsparse::Parser *parser;
    const void *cookie;
    docreq::Queue *docq;
    lcb_VIEWQUERYCALLBACK callback;
    lcb_t instance;

    unsigned refcount;
    uint32_t cmdflags;
    lcb_error_t lasterr;
};

}
}
