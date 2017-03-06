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

#include <libcouchbase/couchbase.h>
#include <libcouchbase/cbft.h>
#include <jsparse/parser.h>
#include "internal.h"
#include "http/http.h"
#include "logging.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include <string>

#define LOGFMT "(FTR=%p) "
#define LOGID(req) static_cast<const void*>(req)
#define LOGARGS(req, lvl) req->instance->settings, "n1ql", LCB_LOG_##lvl, __FILE__, __LINE__

struct lcb_FTSREQ : lcb::jsparse::Parser::Actions {
    const lcb_RESPHTTP *cur_htresp;
    lcb_http_request_t htreq;
    lcb::jsparse::Parser *parser;
    const void *cookie;
    lcb_FTSCALLBACK callback;
    lcb_t instance;
    size_t nrows;
    lcb_error_t lasterr;
    void invoke_row(lcb_RESPFTS *resp);
    void invoke_last();

    lcb_FTSREQ(lcb_t, const void *, const lcb_CMDFTS *);
    ~lcb_FTSREQ();
    void JSPARSE_on_row(const lcb::jsparse::Row& datum) {
        lcb_RESPFTS resp = { 0 };
        resp.row = static_cast<const char*>(datum.row.iov_base);
        resp.nrow = datum.row.iov_len;
        nrows++;
        invoke_row(&resp);
    }
    void JSPARSE_on_error(const std::string&) {
        lasterr = LCB_PROTOCOL_ERROR;
    }
    void JSPARSE_on_complete(const std::string&) {
        // Nothing
    }
};

static void
chunk_callback(lcb_t, int, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *rh = (const lcb_RESPHTTP *)rb;
    lcb_FTSREQ *req = static_cast<lcb_FTSREQ*>(rh->cookie);

    req->cur_htresp = rh;
    if (rh->rc != LCB_SUCCESS || rh->htstatus != 200) {
        if (req->lasterr == LCB_SUCCESS || rh->htstatus != 200) {
            req->lasterr = rh->rc ? rh->rc : LCB_HTTP_ERROR;
        }
    }

    if (rh->rflags & LCB_RESP_F_FINAL) {
        req->invoke_last();
        delete req;

    } else if (req->callback == NULL) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        delete req;
    } else {
        req->parser->feed(static_cast<const char*>(rh->body), rh->nbody);
    }
}

void
lcb_FTSREQ::invoke_row(lcb_RESPFTS *resp)
{
    resp->cookie = const_cast<void*>(cookie);
    resp->htresp = cur_htresp;

    if (callback) {
        callback(instance, -4, resp);
    }
}

void
lcb_FTSREQ::invoke_last()
{
    lcb_RESPFTS resp = { 0 };
    resp.rflags |= LCB_RESP_F_FINAL;
    resp.rc = lasterr;

    if (parser) {
        lcb_IOV meta;
        parser->get_postmortem(meta);
        resp.row = static_cast<const char*>(meta.iov_base);
        resp.nrow = meta.iov_len;
    }
    invoke_row(&resp);
    callback = NULL;
}

lcb_FTSREQ::lcb_FTSREQ(lcb_t instance_, const void *cookie_, const lcb_CMDFTS *cmd)
: lcb::jsparse::Parser::Actions(),
  cur_htresp(NULL), htreq(NULL),
  parser(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_FTS, this)),
  cookie(cookie_), callback(cmd->callback), instance(instance_), nrows(0),
  lasterr(LCB_SUCCESS)
{
    lcb_CMDHTTP htcmd = { 0 };
    htcmd.type = LCB_HTTP_TYPE_FTS;
    htcmd.method = LCB_HTTP_METHOD_POST;
    htcmd.reqhandle = &htreq;
    htcmd.content_type = "application/json";
    htcmd.cmdflags |= LCB_CMDHTTP_F_STREAM;
    if (!callback) {
        lasterr = LCB_EINVAL;
        return;
    }

    Json::Value root;
    Json::Reader rr;
    if (!rr.parse(cmd->query, cmd->query + cmd->nquery, root)) {
        lasterr = LCB_EINVAL;
        return;
    }

    const Json::Value& constRoot = root;
    const Json::Value& j_ixname = constRoot["indexName"];
    if (!j_ixname.isString()) {
        lasterr = LCB_EINVAL;
        return;
    }

    std::string url;
    url.append("api/index/").append(j_ixname.asCString()).append("/query");
    LCB_CMD_SET_KEY(&htcmd, url.c_str(), url.size());

    // Making a copy here to ensure that we don't accidentally create a new
    // 'ctl' field.
    const Json::Value& ctl = constRoot["value"];
    if (ctl.isObject()) {
        const Json::Value& tmo = ctl["timeout"];
        if (tmo.isNumeric()) {
            htcmd.cmdflags |= LCB_CMDHTTP_F_CASTMO;
            htcmd.cas = tmo.asLargestUInt();
        }
    } else {
        root["ctl"]["timeout"] = LCBT_SETTING(instance, n1ql_timeout) / 1000;
    }

    std::string qbody(Json::FastWriter().write(root));
    htcmd.body = qbody.c_str();
    htcmd.nbody = qbody.size();

    lasterr = lcb_http3(instance, this, &htcmd);
    if (lasterr == LCB_SUCCESS) {
        htreq->set_callback(chunk_callback);
        if (cmd->handle) {
            *cmd->handle = reinterpret_cast<lcb_FTSREQ*>(this);
        }
    }
}

lcb_FTSREQ::~lcb_FTSREQ()
{
    if (htreq != NULL) {
        lcb_cancel_http_request(instance, htreq);
        htreq = NULL;
    }
    if (parser) {
        delete parser;
        parser = NULL;
    }
}

LIBCOUCHBASE_API
lcb_error_t
lcb_fts_query(lcb_t instance, const void *cookie, const lcb_CMDFTS *cmd)
{
    lcb_FTSREQ *req = new lcb_FTSREQ(instance, cookie, cmd);
    if (req->lasterr) {
        lcb_error_t rc = req->lasterr;
        delete req;
        return rc;
    }
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API
void
lcb_fts_cancel(lcb_t, lcb_FTSHANDLE handle)
{
    handle->callback = NULL;
}
