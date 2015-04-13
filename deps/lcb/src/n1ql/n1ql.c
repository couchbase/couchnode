#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include <jsparse/parser.h>
#include "internal.h"
#include "http/http.h"

typedef struct {
    const lcb_RESPHTTP *cur_htresp;
    struct lcb_http_request_st *htreq;
    lcbjsp_PARSER *parser;
    const void *cookie;
    lcb_N1QLCALLBACK callback;
    lcb_t instance;
    lcb_error_t lasterr;
} N1QLREQ, lcb_N1QLREQ;

static void
invoke_row(N1QLREQ *req, lcb_RESPN1QL *resp, int is_last)
{
    resp->cookie = (void*)req->cookie;
    resp->htresp = req->cur_htresp;

    if (is_last) {
        lcb_IOV meta;
        resp->rflags |= LCB_RESP_F_FINAL;
        resp->rc = req->lasterr;
        lcbjsp_get_postmortem(req->parser, &meta);
        resp->row = meta.iov_base;
        resp->nrow = meta.iov_len;
    }

    if (req->callback) {
        req->callback(req->instance, LCB_CALLBACK_N1QL, resp);
    }
    if (is_last) {
        req->callback = NULL;
    }
}

static void
destroy_req(N1QLREQ *req)
{
    if (req->htreq) {
        lcb_cancel_http_request(req->instance, req->htreq);
        req->htreq = NULL;
    }

    if (req->callback) {
        lcb_RESPN1QL resp = { 0 };
        invoke_row(req, &resp, 1);
    }

    if (req->parser) {
        lcbjsp_free(req->parser);
    }
    free(req);
}

static void
row_callback(lcbjsp_PARSER *parser, const lcbjsp_ROW *datum)
{
    N1QLREQ *req = parser->data;
    lcb_RESPN1QL resp = { 0 };

    if (datum->type == LCBJSP_TYPE_ROW) {
        resp.row = datum->row.iov_base;
        resp.nrow = datum->row.iov_len;
        invoke_row(req, &resp, 0);
    } else if (datum->type == LCBJSP_TYPE_ERROR) {
        req->lasterr = resp.rc = LCB_PROTOCOL_ERROR;
    } else if (datum->type == LCBJSP_TYPE_COMPLETE) {
        /* Nothing */
    }
}

static void
chunk_callback(lcb_t instance, int ign, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *rh = (const lcb_RESPHTTP *)rb;
    N1QLREQ *req = rh->cookie;

    (void)ign; (void)instance;

    req->cur_htresp = rh;
    if (rh->rc != LCB_SUCCESS || rh->htstatus != 200) {
        if (req->lasterr == LCB_SUCCESS || rh->htstatus != 200) {
            req->lasterr = rh->rc ? rh->rc : LCB_HTTP_ERROR;
        }
    }

    if (rh->rflags & LCB_RESP_F_FINAL) {
        req->htreq = NULL;
        destroy_req(req);
        return;
    }

    lcbjsp_feed(req->parser, rh->body, rh->nbody);
}

#define QUERY_PATH "/query/service"

LIBCOUCHBASE_API
lcb_error_t
lcb_n1ql_query(lcb_t instance, const void *cookie, const lcb_CMDN1QL *cmd)
{
    lcb_CMDHTTP htcmd = { 0 };
    lcb_error_t err;
    N1QLREQ *req = NULL;

    if (cmd->query == NULL || cmd->nquery == 0 ||
            cmd->callback == NULL || cmd->content_type == NULL) {
        return LCB_EINVAL;
    }
    htcmd.body = cmd->query;
    htcmd.nbody = cmd->nquery;
    htcmd.content_type = cmd->content_type;
    htcmd.method = LCB_HTTP_METHOD_POST;
    if (cmd->host) {
        htcmd.type = LCB_HTTP_TYPE_RAW;
        LCB_CMD_SET_KEY(&htcmd, QUERY_PATH, strlen(QUERY_PATH));
        htcmd.host = cmd->host;
        htcmd.username = LCBT_SETTING(instance, bucket);
        htcmd.password = LCBT_SETTING(instance, password);
    } else {
        htcmd.type = LCB_HTTP_TYPE_N1QL;
    }

    htcmd.cmdflags = LCB_CMDHTTP_F_STREAM;
    req = calloc(1, sizeof(*req));
    if (!req) {
        err = LCB_CLIENT_ENOMEM; goto GT_DESTROY;
    }

    req->callback = cmd->callback;
    req->cookie = cookie;
    req->instance = instance;
    req->parser = lcbjsp_create(LCBJSP_MODE_N1QL);

    if (!req->parser) {
        err = LCB_CLIENT_ENOMEM; goto GT_DESTROY;
    }
    req->parser->data = req;
    req->parser->callback = row_callback;

    htcmd.reqhandle = &req->htreq;
    err = lcb_http3(instance, req, &htcmd);
    if (err != LCB_SUCCESS) {
        goto GT_DESTROY;
    }

    lcb_htreq_setcb(req->htreq, chunk_callback);
    return LCB_SUCCESS;

    GT_DESTROY:
    if (req) {
        req->callback = NULL;
        destroy_req(req);
    }
    return err;
}
