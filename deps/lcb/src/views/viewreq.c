#include "viewreq.h"
#include "sllist-inl.h"
#include "http/http.h"
#include "internal.h"

#define MAX_GET_URI_LENGTH 2048

static void chunk_callback(lcb_t, int, const lcb_RESPBASE*);
static void row_callback(lcbjsp_PARSER*, const lcbjsp_ROW*);
static void invoke_row(lcbview_REQUEST *req, lcb_RESPVIEWQUERY *resp);
static void unref_request(lcbview_REQUEST *req);

#define IOV2PTRLEN(iov, ptr, len) do { \
    ptr = (iov)->iov_base; \
    len = (iov)->iov_len; \
} while (0);

/* Whether the request (from the user side) is still ongoing */
#define CAN_CONTINUE(req) ((req)->callback != NULL)
#define LOGARGS(instance, lvl) instance->settings, "views", LCB_LOG_##lvl, __FILE__, __LINE__

static void
invoke_last(lcbview_REQUEST *req, lcb_error_t err)
{
    lcb_RESPVIEWQUERY resp = { 0 };
    if (req->callback == NULL) {
        return;
    }
    if (req->docq && lcbdocq_has_pending(req->docq)) {
        return;
    }

    resp.rc = err;
    resp.htresp = req->cur_htresp;
    resp.cookie = (void *)req->cookie;
    resp.rflags = LCB_RESP_F_FINAL;
    if (req->parser && req->parser->meta_complete) {
        resp.value = req->parser->meta_buf.base;
        resp.nvalue = req->parser->meta_buf.nused;
    } else {
        resp.rflags |= LCB_RESP_F_CLIENTGEN;
    }
    req->callback(req->instance, LCB_CALLBACK_VIEWQUERY, &resp);
    lcb_view_cancel(req->instance, req);
}

static void
invoke_row(lcbview_REQUEST *req, lcb_RESPVIEWQUERY *resp)
{
    if (req->callback == NULL) {
        return;
    }
    resp->htresp = req->cur_htresp;
    resp->cookie = (void *)req->cookie;
    req->callback(req->instance, LCB_CALLBACK_VIEWQUERY, resp);
}

static void
chunk_callback(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *rh = (const lcb_RESPHTTP *)rb;
    lcbview_REQUEST *req = rh->cookie;

    (void)cbtype;
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
        req->refcount++;
        invoke_last(req, req->lasterr);
        if (rh->rflags & LCB_RESP_F_FINAL) {
            req->htreq = NULL;
            unref_request(req);
        }
        req->cur_htresp = NULL;
        unref_request(req);
        return;
    }

    if (!CAN_CONTINUE(req)) {
        return;
    }

    req->refcount++;
    lcbjsp_feed(req->parser, rh->body, rh->nbody);
    req->cur_htresp = NULL;
    unref_request(req);
    (void)instance;
}

static void
do_copy_iov(char *dstbuf, lcb_IOV *dstiov, const lcb_IOV *srciov, size_t *off)
{
    dstiov->iov_len = srciov->iov_len;
    dstiov->iov_base = dstbuf + *off;
    *off += dstiov->iov_len;
    memcpy(dstiov->iov_base, srciov->iov_base, srciov->iov_len);
}

static lcbview_DOCREQ *
mk_docreq(const lcbjsp_ROW *datum)
{
    size_t extra_alloc = 0;
    size_t cur_offset = 0;
    lcbview_DOCREQ *dreq;

    extra_alloc =
            datum->key.iov_len + datum->value.iov_len +
            datum->geo.iov_len + datum->docid.iov_len;

    dreq = calloc(1, sizeof(*dreq) + extra_alloc);
    do_copy_iov(dreq->rowbuf, &dreq->key, &datum->key, &cur_offset);
    do_copy_iov(dreq->rowbuf, &dreq->value, &datum->value, &cur_offset);
    do_copy_iov(dreq->rowbuf, &dreq->base.docid, &datum->docid, &cur_offset);
    do_copy_iov(dreq->rowbuf, &dreq->geo, &datum->geo, &cur_offset);
    return dreq;
}

static void
row_callback(lcbjsp_PARSER *parser, const lcbjsp_ROW *datum)
{
    lcbview_REQUEST *req = parser->data;
    if (datum->type == LCBJSP_TYPE_ROW) {
        if (!req->no_parse_rows) {
            lcbjsp_parse_viewrow(req->parser, (lcbjsp_ROW*)datum);
        }

        if (req->include_docs && datum->docid.iov_len && req->callback) {
            lcbview_DOCREQ *dreq = mk_docreq(datum);
            dreq->parent = req;
            lcbdocq_add(req->docq, &dreq->base);
            req->refcount++;

        } else {
            lcb_RESPVIEWQUERY resp = { 0 };
            if (req->no_parse_rows) {
                IOV2PTRLEN(&datum->row, resp.value, resp.nvalue);
            } else {
                IOV2PTRLEN(&datum->key, resp.key, resp.nkey);
                IOV2PTRLEN(&datum->docid, resp.docid, resp.ndocid);
                IOV2PTRLEN(&datum->value, resp.value, resp.nvalue);
                IOV2PTRLEN(&datum->geo, resp.geometry, resp.ngeometry);
            }
            resp.htresp = req->cur_htresp;
            invoke_row(req, &resp);
        }
    } else if (datum->type == LCBJSP_TYPE_ERROR) {
        invoke_last(req, LCB_PROTOCOL_ERROR);
    } else if (datum->type == LCBJSP_TYPE_COMPLETE) {
        /* nothing */
    }
}

static void
cb_doc_ready(lcb_DOCQUEUE *q, lcb_DOCQREQ *req_base)
{
    lcb_RESPVIEWQUERY resp = { 0 };
    lcbview_DOCREQ *dreq = (lcbview_DOCREQ*)req_base;
    resp.docresp = &dreq->base.docresp;
    IOV2PTRLEN(&dreq->key, resp.key, resp.nkey);
    IOV2PTRLEN(&dreq->value, resp.value, resp.nvalue);
    IOV2PTRLEN(&dreq->base.docid, resp.docid, resp.ndocid);
    IOV2PTRLEN(&dreq->geo, resp.geometry, resp.ngeometry);

    if (q->parent) {
        invoke_row(q->parent, &resp);
    }

    free(dreq);

    if (q->parent) {
        unref_request(q->parent);
    }
}

static void
cb_docq_throttle(lcb_DOCQUEUE *q, int enabled)
{
    lcbview_REQUEST *req = q->parent;
    if (req == NULL || req->htreq == NULL) {
        return;
    }
    if (enabled) {
        lcb_htreq_pause(req->htreq);
    } else {
        lcb_htreq_resume(req->htreq);
    }
}

static void
destroy_request(lcbview_REQUEST *req)
{
    invoke_last(req, req->lasterr);

    if (req->parser != NULL) {
        lcbjsp_free(req->parser);
    }
    if (req->htreq != NULL) {
        lcb_cancel_http_request(req->instance, req->htreq);
    }
    if (req->docq != NULL) {
        req->docq->parent = NULL;
        lcbdocq_unref(req->docq);
    }
    free(req);
}

static void
unref_request(lcbview_REQUEST *req)
{
    if (!--req->refcount) {
        destroy_request(req);
    }
}

LIBCOUCHBASE_API
lcb_error_t
lcb_view_query(lcb_t instance, const void *cookie, const lcb_CMDVIEWQUERY *cmd)
{
    lcb_string path;
    lcb_CMDHTTP htcmd = { 0 };
    lcb_error_t rc;
    lcbview_REQUEST *req = NULL;
    int include_docs = 0;
    int no_parse_rows = 0;
    const char *vpstr = NULL;

    if (cmd->nddoc == 0 || cmd->nview == 0 || cmd->callback == NULL) {
        return LCB_EINVAL;
    }

    htcmd.method = LCB_HTTP_METHOD_GET;
    htcmd.type = LCB_HTTP_TYPE_VIEW;
    htcmd.cmdflags = LCB_CMDHTTP_F_STREAM;

    include_docs = cmd->cmdflags & LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    no_parse_rows = cmd->cmdflags & LCB_CMDVIEWQUERY_F_NOROWPARSE;

    if (include_docs && no_parse_rows) {
        return LCB_OPTIONS_CONFLICT;
    }

    lcb_string_init(&path);
    if (cmd->cmdflags & LCB_CMDVIEWQUERY_F_SPATIAL) {
        vpstr = "/_spatial/";
    } else {
        vpstr = "/_view/";
    }

    if (lcb_string_appendv(&path,
        "_design/", (size_t)-1, cmd->ddoc, cmd->nddoc,
        vpstr, (size_t)-1, cmd->view, cmd->nview, NULL) != 0) {

        lcb_string_release(&path);
        return LCB_CLIENT_ENOMEM;
    }

    if (cmd->optstr) {
        if (cmd->noptstr > MAX_GET_URI_LENGTH) {
            return LCB_E2BIG;
        } else {
            if (lcb_string_appendv(&path,
                "?", (size_t)-1, cmd->optstr, cmd->noptstr, NULL) != 0) {

                lcb_string_release(&path);
                return LCB_CLIENT_ENOMEM;
            }
        }
    }

    if (cmd->npostdata) {
        htcmd.method = LCB_HTTP_METHOD_POST;
        htcmd.body = cmd->postdata;
        htcmd.nbody = cmd->npostdata;
        htcmd.content_type = "application/json";
    }

    if ( (req = calloc(1, sizeof(*req))) == NULL ||
            (req->parser = lcbjsp_create(LCBJSP_MODE_VIEWS)) == NULL) {
        free(req);
        lcb_string_release(&path);
        return LCB_CLIENT_ENOMEM;
    }

    req->instance = instance;
    req->cookie = cookie;
    req->include_docs = include_docs;
    req->no_parse_rows = no_parse_rows;
    req->callback = cmd->callback;
    req->parser->callback = row_callback;
    req->parser->data = req;

    LCB_CMD_SET_KEY(&htcmd, path.base, path.nused);
    htcmd.reqhandle = &req->htreq;

    rc = lcb_http3(instance, req, &htcmd);
    lcb_string_release(&path);

    if (rc == LCB_SUCCESS) {
        lcb_htreq_setcb(req->htreq, chunk_callback);
        req->refcount++;
        if (cmd->handle) {
            *cmd->handle = req;
        }
        if (include_docs) {
            req->docq = lcbdocq_create(instance);
            req->docq->parent = req;
            req->docq->cb_ready = cb_doc_ready;
            req->docq->cb_throttle = cb_docq_throttle;
            if (cmd->docs_concurrent_max) {
                req->docq->max_pending_response = cmd->docs_concurrent_max;
            }
        }
        lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
    } else {
        req->callback = NULL;
        destroy_request(req);
    }
    return rc;
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
void
lcb_view_cancel(lcb_t instance, lcb_VIEWHANDLE handle)
{
    if (handle->callback) {
        handle->callback = NULL;
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
        if (handle->docq) {
            lcbdocq_cancel(handle->docq);
        }
    }
    (void)instance;
}
