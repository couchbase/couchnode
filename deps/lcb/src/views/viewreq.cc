#include "viewreq.h"
#include "sllist-inl.h"
#include "http/http.h"
#include "internal.h"

#define MAX_GET_URI_LENGTH 2048
using namespace lcb::views;

static void chunk_callback(lcb_t, int, const lcb_RESPBASE*);

template <typename value_type, typename size_type>
void IOV2PTRLEN(const lcb_IOV* iov, value_type*& ptr, size_type& len) {
    ptr = reinterpret_cast<const value_type*>(iov->iov_base);
    len = iov->iov_len;
}

/* Whether the request (from the user side) is still ongoing */
#define CAN_CONTINUE(req) ((req)->callback != NULL)
#define LOGARGS(instance, lvl) instance->settings, "views", LCB_LOG_##lvl, __FILE__, __LINE__

void ViewRequest::invoke_last(lcb_error_t err) {
    lcb_RESPVIEWQUERY resp = { 0 };
    if (callback == NULL) {
        return;
    }
    if (docq && docq->has_pending()) {
        return;
    }

    resp.rc = err;
    resp.htresp = cur_htresp;
    resp.cookie = const_cast<void*>(cookie);
    resp.rflags = LCB_RESP_F_FINAL;
    if (parser && parser->meta_complete) {
        resp.value = parser->meta_buf.c_str();
        resp.nvalue = parser->meta_buf.size();
    } else {
        resp.rflags |= LCB_RESP_F_CLIENTGEN;
    }
    callback(instance, LCB_CALLBACK_VIEWQUERY, &resp);
    cancel();
}

void ViewRequest::invoke_row(lcb_RESPVIEWQUERY *resp) {
    if (callback == NULL) {
        return;
    }
    resp->htresp = cur_htresp;
    resp->cookie = const_cast<void*>(cookie);
    callback(instance, LCB_CALLBACK_VIEWQUERY, resp);
}

static void
chunk_callback(lcb_t instance, int, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *rh = (const lcb_RESPHTTP *)rb;
    ViewRequest *req = reinterpret_cast<ViewRequest*>(rh->cookie);

    req->cur_htresp = rh;

    if (rh->rc != LCB_SUCCESS || rh->htstatus != 200 || (rh->rflags & LCB_RESP_F_FINAL)) {
        if (req->lasterr == LCB_SUCCESS && rh->htstatus != 200) {
            if (rh->rc != LCB_SUCCESS) {
                req->lasterr = rh->rc;
            } else {
                lcb_log(LOGARGS(instance, DEBUG), "Got not ok http status %d", rh->htstatus);
                req->lasterr = LCB_HTTP_ERROR;
            }
        }
        req->ref();
        req->invoke_last();
        if (rh->rflags & LCB_RESP_F_FINAL) {
            req->htreq = NULL;
            req->unref();
        }
        req->cur_htresp = NULL;
        req->unref();
        return;
    }

    if (!CAN_CONTINUE(req)) {
        return;
    }

    req->refcount++;
    req->parser->feed(reinterpret_cast<const char*>(rh->body), rh->nbody);
    req->cur_htresp = NULL;
    req->unref();
}

static void
do_copy_iov(std::string& dstbuf, lcb_IOV *dstiov, const lcb_IOV *srciov)
{
    dstiov->iov_len = srciov->iov_len;
    dstiov->iov_base = const_cast<char*>(dstbuf.c_str() + dstbuf.size());
    dstbuf.append(reinterpret_cast<const char*>(srciov->iov_base), srciov->iov_len);
}

static VRDocRequest *
mk_docreq(const lcb::jsparse::Row *datum)
{
    size_t extra_alloc = 0;
    VRDocRequest *dreq;
    extra_alloc =
            datum->key.iov_len + datum->value.iov_len +
            datum->geo.iov_len + datum->docid.iov_len;

    dreq = new VRDocRequest();
    dreq->rowbuf.reserve(extra_alloc);
    do_copy_iov(dreq->rowbuf, &dreq->key, &datum->key);
    do_copy_iov(dreq->rowbuf, &dreq->value, &datum->value);
    do_copy_iov(dreq->rowbuf, &dreq->docid, &datum->docid);
    do_copy_iov(dreq->rowbuf, &dreq->geo, &datum->geo);
    return dreq;
}

void ViewRequest::JSPARSE_on_row(const lcb::jsparse::Row& datum) {
    using lcb::jsparse::Row;
    if (!is_no_rowparse()) {
        parser->parse_viewrow(const_cast<Row&>(datum));
    }

    if (is_include_docs() && datum.docid.iov_len && callback) {
        VRDocRequest *dreq = mk_docreq(&datum);
        dreq->parent = this;
        docq->add(dreq);
        ref();

    } else {
        lcb_RESPVIEWQUERY resp = { 0 };
        if (is_no_rowparse()) {
            IOV2PTRLEN(&datum.row, resp.value, resp.nvalue);
        } else {
            IOV2PTRLEN(&datum.key, resp.key, resp.nkey);
            IOV2PTRLEN(&datum.docid, resp.docid, resp.ndocid);
            IOV2PTRLEN(&datum.value, resp.value, resp.nvalue);
            IOV2PTRLEN(&datum.geo, resp.geometry, resp.ngeometry);
        }
        resp.htresp = cur_htresp;
        invoke_row(&resp);
    }
}

void ViewRequest::JSPARSE_on_error(const std::string&) {
    invoke_last(LCB_PROTOCOL_ERROR);
}

void ViewRequest::JSPARSE_on_complete(const std::string&) {
    // Nothing
}

static void
cb_doc_ready(lcb::docreq::Queue *q, lcb::docreq::DocRequest *req_base)
{
    lcb_RESPVIEWQUERY resp = { 0 };
    VRDocRequest *dreq = (VRDocRequest*)req_base;
    resp.docresp = &dreq->docresp;
    IOV2PTRLEN(&dreq->key, resp.key, resp.nkey);
    IOV2PTRLEN(&dreq->value, resp.value, resp.nvalue);
    IOV2PTRLEN(&dreq->docid, resp.docid, resp.ndocid);
    IOV2PTRLEN(&dreq->geo, resp.geometry, resp.ngeometry);

    if (q->parent) {
        reinterpret_cast<ViewRequest*>(q->parent)->invoke_row(&resp);
    }

    delete dreq;

    if (q->parent) {
        reinterpret_cast<ViewRequest*>(q->parent)->unref();
    }
}

static void
cb_docq_throttle(lcb::docreq::Queue *q, int enabled)
{
    ViewRequest *req = reinterpret_cast<ViewRequest*>(q->parent);
    if (req == NULL || req->htreq == NULL) {
        return;
    }
    if (enabled) {
        req->htreq->pause();
    } else {
        req->htreq->resume();
    }
}

ViewRequest::~ViewRequest() {
    invoke_last();

    if (parser != NULL) {
        delete parser;
    }
    if (htreq != NULL) {
        lcb_cancel_http_request(instance, htreq);
    }
    if (docq != NULL) {
        docq->parent = NULL;
        docq->unref();
    }
}

lcb_error_t ViewRequest::request_http(const lcb_CMDVIEWQUERY *cmd) {
    lcb_CMDHTTP htcmd = { 0 };
    htcmd.method = LCB_HTTP_METHOD_GET;
    htcmd.type = LCB_HTTP_TYPE_VIEW;
    htcmd.cmdflags = LCB_CMDHTTP_F_STREAM;

    std::string path;
    path.append("_design/");
    path.append(cmd->ddoc, cmd->nddoc);
    path.append(is_spatial() ? "/_spatial/" : "/_view/");
    path.append(cmd->view, cmd->nview);
    if (cmd->noptstr) {
        path.append("?").append(cmd->optstr, cmd->noptstr);
    }

    if (cmd->npostdata) {
        htcmd.method = LCB_HTTP_METHOD_POST;
        htcmd.body = cmd->postdata;
        htcmd.nbody = cmd->npostdata;
        htcmd.content_type = "application/json";
    }

    LCB_CMD_SET_KEY(&htcmd, path.c_str(), path.size());
    htcmd.reqhandle = &htreq;

    lcb_error_t err = lcb_http3(instance, this, &htcmd);
    if (err == LCB_SUCCESS) {
        htreq->set_callback(chunk_callback);
    }
    return err;
}

ViewRequest::ViewRequest(lcb_t instance_, const void *cookie_,
                         const lcb_CMDVIEWQUERY* cmd)
    : cur_htresp(NULL), htreq(NULL),
      parser(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_VIEWS, this)),
      cookie(cookie_), docq(NULL), callback(cmd->callback),
      instance(instance_), refcount(1),
      cmdflags(cmd->cmdflags),
      lasterr(LCB_SUCCESS) {

    // Validate:
    if (cmd->nddoc == 0 || cmd->nview == 0 || callback == NULL) {
        lasterr = LCB_EINVAL;
    } else if (is_include_docs() && is_no_rowparse()) {
        lasterr = LCB_OPTIONS_CONFLICT;
    } else if (cmd->noptstr > MAX_GET_URI_LENGTH) {
        lasterr = LCB_E2BIG;
    }
    if (lasterr != LCB_SUCCESS) {
        return;
    }

    if (is_include_docs()) {
        docq = new lcb::docreq::Queue(instance);
        docq->parent = this;
        docq->cb_ready = cb_doc_ready;
        docq->cb_throttle = cb_docq_throttle;
        if (cmd->docs_concurrent_max) {
            docq->max_pending_response = cmd->docs_concurrent_max;
        }
    }

    if (cmd->handle) {
        *cmd->handle = this;
    }

    lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);

    lasterr = request_http(cmd);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_view_query(lcb_t instance, const void *cookie, const lcb_CMDVIEWQUERY *cmd)
{
    ViewRequest *req = new ViewRequest(instance, cookie, cmd);
    lcb_error_t err = req->lasterr;
    if (err != LCB_SUCCESS) {
        req->cancel();
        delete req;
    }
    return err;
}

LIBCOUCHBASE_API
void
lcb_view_query_initcmd(lcb_CMDVIEWQUERY *vq,
    const char *design, const char *view, const char *options,
    lcb_VIEWQUERYCALLBACK callback)
{
    vq->view = view;
    vq->nview = strlen(view);
    vq->ddoc = design;
    vq->nddoc = strlen(design);
    if (options != NULL) {
        vq->optstr = options;
        vq->noptstr = strlen(options);
    }
    vq->callback = callback;
}

LIBCOUCHBASE_API
void lcb_view_cancel(lcb_t, lcb_VIEWHANDLE handle) {
    handle->cancel();
}

void ViewRequest::cancel() {
    if (callback) {
        callback = NULL;
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
        if (docq) {
            docq->cancel();
        }
    }
}
