/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2018-2020 Couchbase, Inc.
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

#include <libcouchbase/couchbase.h>
#include <jsparse/parser.h>
#include "internal.h"
#include "auth-priv.h"
#include "http/http.h"
#include "logging.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include <string>
#include <list>
#include "docreq/docreq.h"
#include "rnd.h"

#include "capi/analytics.hh"

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) req->instance->settings, "analytics", LCB_LOG_##lvl, __FILE__, __LINE__

using namespace lcb;

struct IngestRequest : docreq::DocRequest {
    lcb_ANALYTICS_HANDLE *parent{};
    std::string row;
};

typedef struct lcb_ANALYTICS_HANDLE_ : lcb::jsparse::Parser::Actions {
    const lcb_RESPHTTP *cur_htresp;
    lcb_HTTP_HANDLE *htreq;
    lcb::jsparse::Parser *parser;
    void *cookie;
    lcb_ANALYTICS_CALLBACK callback;
    lcb_INSTANCE *instance;
    lcb_STATUS lasterr;
    lcb_U32 timeout;
    // How many rows were received. Used to avoid parsing the meta
    size_t nrows;

    /** Request body as received from the application */
    Json::Value json;
    const Json::Value &json_const() const
    {
        return json;
    }

    /** String of the original statement. Cached here to avoid jsoncpp lookups */
    std::string statement;
    std::string query_params;
    std::string client_context_id;
    std::string first_error_message;
    uint32_t first_error_code{};

    /** Whether we're retrying this */
    bool was_retried;

    /** Non-empty if this is deferred query check/fetch */
    std::string deferred_handle{};

    lcb_INGEST_OPTIONS *ingest;
    docreq::Queue *docq;
    unsigned refcount;

    lcbtrace_SPAN *span;

    void unref()
    {
        if (!--refcount) {
            delete this;
        }
    }

    void ref()
    {
        refcount++;
    }

    /**
     * Issues the HTTP request for the query
     * @param payload The body to send
     * @return Error code from lcb's http subsystem
     */
    inline lcb_STATUS issue_htreq(const std::string &body);

    lcb_STATUS issue_htreq()
    {
        std::string s = Json::FastWriter().write(json);
        return issue_htreq(s);
    }

    /**
     * Attempt to retry the query. This will inspect the meta (if present)
     * for any errors indicating that a failure might be a result of a stale
     * plan, and if this query was retried already.
     * @return true if the retry was successful.
     */
    inline bool maybe_retry();

    /**
     * Returns true if payload matches retry conditions.
     */
    inline bool has_retriable_error(const Json::Value &root);

    /**
     * Pass a row back to the application
     * @param resp The response. This is populated with state information
     *  from the current query
     * @param is_last Whether this is the last row. If this is the last, then
     *  the RESP_F_FINAL flag is set, and no further callbacks will be invoked
     */
    inline void invoke_row(lcb_RESPANALYTICS *resp, bool is_last);

    inline lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, const lcb_CMDANALYTICS *cmd);
    inline lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, lcb_DEFERRED_HANDLE *handle);
    inline ~lcb_ANALYTICS_HANDLE_() override;

    // Parser overrides:
    void JSPARSE_on_row(const lcb::jsparse::Row &row) override
    {
        lcb_RESPANALYTICS resp{};
        resp.handle = this;
        resp.row = static_cast<const char *>(row.row.iov_base);
        resp.nrow = row.row.iov_len;
        nrows++;
        if (ingest && ingest->method != LCB_INGEST_METHOD_NONE) {
            auto *req = new IngestRequest();
            req->parent = this;
            req->row.assign(static_cast<const char *>(row.row.iov_base), row.row.iov_len);
            docq->add(req);
            ref();
        }
        invoke_row(&resp, false);
    }
    void JSPARSE_on_error(const std::string &) override
    {
        lasterr = LCB_ERR_PROTOCOL_ERROR;
    }
    void JSPARSE_on_complete(const std::string &) override
    {
        // Nothing
    }

} ANALYTICSREQ;

static bool parse_json(const char *s, size_t n, Json::Value &res)
{
    return Json::Reader().parse(s, s + n, res);
}

bool ANALYTICSREQ::has_retriable_error(const Json::Value &root)
{
    if (!root.isObject()) {
        return false;
    }
    const Json::Value &errors = root["errors"];
    if (!errors.isArray()) {
        return false;
    }
    Json::Value::const_iterator ii;
    for (ii = errors.begin(); ii != errors.end(); ++ii) {
        const Json::Value &cur = *ii;
        if (!cur.isObject()) {
            continue; // eh?
        }
        const Json::Value &jcode = cur["code"];
        if (jcode.isNumeric()) {
            unsigned code = jcode.asUInt();
            switch (code) {
                case 23000:
                case 23003:
                case 23007:
                    lcb_log(LOGARGS(this, TRACE), LOGFMT "Will retry request. code: %d", LOGID(this), code);
                    return true;
                default:
                    break;
            }
        }
    }
    return false;
}

bool ANALYTICSREQ::maybe_retry()
{
    // Examines the buffer to determine the type of error
    Json::Value root;
    lcb_IOV meta;

    if (callback == nullptr) {
        // Cancelled
        return false;
    }

    if (nrows) {
        // Has results:
        return false;
    }

    if (was_retried) {
        return false;
    }

    was_retried = true;
    parser->get_postmortem(meta);
    if (!parse_json(static_cast<const char *>(meta.iov_base), meta.iov_len, root)) {
        return false; // Not JSON
    }
    if (has_retriable_error(root)) {
        return true;
    }

    return false;
}

void ANALYTICSREQ::invoke_row(lcb_RESPANALYTICS *resp, bool is_last)
{
    resp->cookie = const_cast<void *>(cookie);
    resp->htresp = cur_htresp;

    resp->ctx.http_response_code = cur_htresp->ctx.response_code;
    resp->ctx.endpoint = resp->htresp->ctx.endpoint;
    resp->ctx.endpoint_len = resp->htresp->ctx.endpoint_len;
    resp->ctx.client_context_id = client_context_id.c_str();
    resp->ctx.client_context_id_len = client_context_id.size();
    resp->ctx.statement = statement.c_str();
    resp->ctx.statement_len = statement.size();
    resp->ctx.query_params = query_params.c_str();
    resp->ctx.query_params_len = query_params.size();

    if (is_last) {
        lcb_IOV meta_buf;
        resp->rflags |= LCB_RESP_F_FINAL;
        resp->ctx.rc = lasterr;
        parser->get_postmortem(meta_buf);
        resp->row = static_cast<const char *>(meta_buf.iov_base);
        resp->nrow = meta_buf.iov_len;
        if (!deferred_handle.empty()) {
            /* signal that response might have deferred handle */
            resp->rflags |= LCB_RESP_F_EXTDATA;
        }
        Json::Value meta;
        if (parse_json(resp->row, resp->nrow, meta)) {
            const Json::Value &errors = meta["errors"];
            if (errors.isArray() && !errors.empty()) {
                const Json::Value &err = errors[0];
                const Json::Value &msg = err["msg"];
                if (msg.isString()) {
                    first_error_message = msg.asString();
                    resp->ctx.first_error_message = first_error_message.c_str();
                    resp->ctx.first_error_message_len = first_error_message.size();
                }
                const Json::Value &code = err["code"];
                if (code.isNumeric()) {
                    first_error_code = code.asUInt();
                    resp->ctx.first_error_code = first_error_code;
                    switch (first_error_code) {
                        case 23000:
                        case 23003:
                            resp->ctx.rc = LCB_ERR_TEMPORARY_FAILURE;
                            break;
                        case 24000:
                            resp->ctx.rc = LCB_ERR_PARSING_FAILURE;
                            break;
                        case 23007:
                            resp->ctx.rc = LCB_ERR_JOB_QUEUE_FULL;
                            break;
                        case 24025:
                        case 24044:
                        case 24045:
                            resp->ctx.rc = LCB_ERR_DATASET_NOT_FOUND;
                            break;
                        case 24040:
                            resp->ctx.rc = LCB_ERR_DATASET_EXISTS;
                            break;
                        case 24034:
                            resp->ctx.rc = LCB_ERR_DATAVERSE_NOT_FOUND;
                            break;
                        case 24039:
                            resp->ctx.rc = LCB_ERR_DATAVERSE_EXISTS;
                            break;
                        case 24047:
                            resp->ctx.rc = LCB_ERR_INDEX_NOT_FOUND;
                            break;
                        case 24048:
                            resp->ctx.rc = LCB_ERR_INDEX_EXISTS;
                            break;
                        case 24006:
                            resp->ctx.rc = LCB_ERR_ANALYTICS_LINK_NOT_FOUND;
                            break;
                        default:
                            if (first_error_code >= 24000 && first_error_code < 25000) {
                                resp->ctx.rc = LCB_ERR_COMPILATION_FAILED;
                            } else if (first_error_code >= 25000 && first_error_code < 26000) {
                                resp->ctx.rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
                            } else if (first_error_code >= 20000 && first_error_code < 21000) {
                                resp->ctx.rc = LCB_ERR_AUTHENTICATION_FAILURE;
                            }
                            break;
                    }
                }
            }
        }
    }

    if (callback) {
        callback(instance, LCB_CALLBACK_ANALYTICS, resp);
    }
    if (is_last) {
        callback = nullptr;
    }
}

lcb_ANALYTICS_HANDLE_::~lcb_ANALYTICS_HANDLE_()
{
    if (htreq) {
        lcb_http_cancel(instance, htreq);
        htreq = nullptr;
    }

    if (callback) {
        lcb_RESPANALYTICS resp{};
        invoke_row(&resp, true);
    }

    if (span) {
        if (htreq) {
            lcbio_CTX *ctx = htreq->ioctx;
            if (ctx) {
                lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_PEER_ADDRESS, htreq->peer.c_str());
                lcbtrace_span_add_tag_str_nocopy(span, LCBTRACE_TAG_LOCAL_ADDRESS, ctx->sock->info->ep_local);
            }
        }
        lcbtrace_span_finish(span, LCBTRACE_NOW);
        span = nullptr;
    }

    delete parser;

    if (docq != nullptr) {
        docq->parent = nullptr;
        docq->unref();
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    }
}

static void chunk_callback(lcb_INSTANCE *instance, int ign, const lcb_RESPBASE *rb)
{
    const auto *rh = (const lcb_RESPHTTP *)rb;
    auto *req = static_cast<ANALYTICSREQ *>(rh->cookie);

    (void)ign;
    (void)instance;

    req->cur_htresp = rh;
    if (rh->ctx.rc != LCB_SUCCESS || rh->ctx.response_code != 200) {
        if (req->lasterr == LCB_SUCCESS || rh->ctx.response_code != 200) {
            req->lasterr = rh->ctx.rc ? rh->ctx.rc : LCB_ERR_HTTP;
        }
    }

    if (rh->rflags & LCB_RESP_F_FINAL) {
        req->htreq = nullptr;
        if (!req->maybe_retry()) {
            req->unref();
        }
        return;
    } else if (req->callback == nullptr) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        req->unref();
        return;
    }
    req->parser->feed(static_cast<const char *>(rh->ctx.body), rh->ctx.body_len);
}

lcb_STATUS ANALYTICSREQ::issue_htreq(const std::string &body)
{
    lcb_CMDHTTP *htcmd;
    std::string content_type("application/json");

    lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_ANALYTICS);
    lcb_cmdhttp_body(htcmd, body.c_str(), body.size());
    lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());

    std::string url("/query/service");
    std::string hostname{};
    if (deferred_handle.empty()) {
        lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
    } else {
        lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_GET);
        struct http_parser_url url_info = {};
        if (_lcb_http_parser_parse_url(deferred_handle.c_str(), deferred_handle.size(), 0, &url_info)) {
            return LCB_ERR_PROTOCOL_ERROR;
        }
        hostname = deferred_handle.substr(url_info.field_data[UF_HOST].off, url_info.field_data[UF_HOST].len);
        hostname += ':';
        hostname += deferred_handle.substr(url_info.field_data[UF_PORT].off, url_info.field_data[UF_PORT].len);
        url = deferred_handle.substr(url_info.field_data[UF_PATH].off, url_info.field_data[UF_PATH].len);
    }
    lcb_cmdhttp_streaming(htcmd, true);
    lcb_cmdhttp_handle(htcmd, &htreq);
    lcb_cmdhttp_timeout(htcmd, timeout);
    lcb_cmdhttp_path(htcmd, url.c_str(), url.size());
    if (!hostname.empty()) {
        lcb_cmdhttp_host(htcmd, hostname.c_str(), hostname.size());
    }

    lcb_STATUS rc = lcb_http(instance, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (rc == LCB_SUCCESS) {
        htreq->set_callback(chunk_callback);
    }
    return rc;
}

lcb_U32 lcb_analyticsreq_parsetmo(const std::string &s)
{
    double num;
    int nchars, rv;

    rv = sscanf(s.c_str(), "%lf%n", &num, &nchars);
    if (rv != 1) {
        return 0;
    }
    std::string mults = s.substr(nchars);

    // Get the actual timeout value in microseconds. Note we can't use the macros
    // since they will truncate the double value.
    if (mults == "s") {
        return num * static_cast<double>(LCB_S2US(1));
    } else if (mults == "ms") {
        return num * static_cast<double>(LCB_MS2US(1));
    } else if (mults == "h") {
        return num * static_cast<double>(LCB_S2US(3600));
    } else if (mults == "us") {
        return num;
    } else if (mults == "m") {
        return num * static_cast<double>(LCB_S2US(60));
    } else if (mults == "ns") {
        return LCB_NS2US(num);
    } else {
        return 0;
    }
}

static void doc_callback(lcb_INSTANCE *, int, const lcb_RESPBASE *rb)
{
    auto *dreq = reinterpret_cast<lcb::docreq::DocRequest *>(rb->cookie);
    lcb::docreq::Queue *q = dreq->parent;

    q->ref();

    q->n_awaiting_response--;
    dreq->ready = 1;

    q->check();

    q->unref();
}

static lcb_STATUS cb_op_schedule(lcb::docreq::Queue *q, lcb::docreq::DocRequest *dreq)
{
    auto *req = reinterpret_cast<IngestRequest *>(dreq);
    lcb_ANALYTICS_HANDLE_ *areq = req->parent;

    if (areq->ingest == nullptr) {
        return LCB_ERR_SDK_INTERNAL;
    }

    lcb_STORE_OPERATION op;
    switch (areq->ingest->method) {
        case LCB_INGEST_METHOD_INSERT:
            op = LCB_STORE_INSERT;
            break;
        case LCB_INGEST_METHOD_REPLACE:
            op = LCB_STORE_REPLACE;
            break;
        case LCB_INGEST_METHOD_UPSERT:
        default:
            op = LCB_STORE_UPSERT;
            break;
    }

    lcb_INGEST_PARAM param;
    param.method = areq->ingest->method;
    param.row = req->row.c_str();
    param.row_len = req->row.size();
    param.cookie = areq->cookie;
    switch (areq->ingest->data_converter(q->instance, &param)) {
        case LCB_INGEST_STATUS_OK:
            /* continue */
            break;
        case LCB_INGEST_STATUS_IGNORE:
            /* assume that the user hasn't allocated anything */
            return LCB_SUCCESS;
        default:
            return LCB_ERR_SDK_INTERNAL;
    }
    lcb_CMDSTORE *cmd;
    lcb_cmdstore_create(&cmd, op);
    lcb_cmdstore_expiry(cmd, areq->ingest->exptime);
    lcb_cmdstore_key(cmd, param.id, param.id_len);
    lcb_cmdstore_parent_span(cmd, areq->span);
    if (param.out) {
        lcb_cmdstore_value(cmd, param.out, param.out_len);
    } else {
        lcb_cmdstore_value(cmd, req->row.c_str(), req->row.size());
    }
    dreq->callback = doc_callback;
    cmd->cmdflags |= LCB_CMD_F_INTERNAL_CALLBACK;
    lcb_STATUS err = lcb_store(q->instance, &dreq->callback, cmd);
    lcb_cmdstore_destroy(cmd);
    if (param.id_dtor && param.id) {
        param.id_dtor(param.id);
    }
    if (param.out_dtor && param.out) {
        param.out_dtor(param.out);
    }
    return err;
}

static void cb_doc_ready(lcb::docreq::Queue *q, lcb::docreq::DocRequest *req_base)
{
    auto *req = (IngestRequest *)req_base;
    /* TODO: check if we should ignore errors */
    delete req;

    if (q->parent) {
        reinterpret_cast<lcb_ANALYTICS_HANDLE_ *>(q->parent)->unref();
    }
}

static void cb_docq_throttle(lcb::docreq::Queue *q, int enabled)
{
    auto *req = reinterpret_cast<lcb_ANALYTICS_HANDLE_ *>(q->parent);
    if (req == nullptr || req->htreq == nullptr) {
        return;
    }
    if (enabled) {
        req->htreq->pause();
    } else {
        req->htreq->resume();
    }
}

lcb_ANALYTICS_HANDLE_::lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, const lcb_CMDANALYTICS *cmd)
    : cur_htresp(nullptr), htreq(nullptr), parser(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_ANALYTICS, this)),
      cookie(user_cookie), callback(cmd->callback), instance(obj), lasterr(LCB_SUCCESS), timeout(0), nrows(0),
      was_retried(false), deferred_handle{}, ingest(cmd->ingest), docq(nullptr), refcount(1), span(nullptr)
{

    if (cmd->handle) {
        *cmd->handle = this;
    }

    std::string encoded = Json::FastWriter().write(cmd->root);
    if (!parse_json(encoded.c_str(), encoded.size(), json)) {
        lasterr = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    const Json::Value &j_statement = json_const()["statement"];
    if (j_statement.isString()) {
        statement = j_statement.asString();
    } else if (!j_statement.isNull()) {
        lasterr = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    Json::Value &tmoval = json["timeout"];
    if (tmoval.isNull()) {
        // Set the default timeout as the server-side query timeout if no
        // other timeout is used.
        char buf[64] = {0};
        sprintf(buf, "%uus", LCBT_SETTING(obj, analytics_timeout));
        tmoval = buf;
        timeout = LCBT_SETTING(obj, analytics_timeout);
    } else if (tmoval.isString()) {
        timeout = lcb_analyticsreq_parsetmo(tmoval.asString());
    } else {
        // Timeout is not a string!
        lasterr = LCB_ERR_INVALID_ARGUMENT;
        return;
    }
    Json::Value &ccid = json["client_context_id"];
    if (ccid.isNull()) {
        char buf[32];
        size_t nbuf = snprintf(buf, sizeof(buf), "%016" PRIx64, lcb_next_rand64());
        client_context_id.assign(buf, nbuf);
        json["client_context_id"] = client_context_id;
    } else {
        client_context_id = ccid.asString();
    }

    Json::Value tmp = json;
    tmp.removeMember("statement");
    query_params = Json::FastWriter().write(cmd->root);

    if (instance->settings->tracer) {
        char id[20] = {0};
        snprintf(id, sizeof(id), "%p", (void *)this);
        span = lcbtrace_span_start(instance->settings->tracer, LCBTRACE_OP_DISPATCH_TO_SERVER, LCBTRACE_NOW, nullptr);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_OPERATION_ID, id);
        lcbtrace_span_add_system_tags(span, instance->settings, LCBTRACE_TAG_SERVICE_ANALYTICS);
    }

    if (ingest && ingest->method != LCB_INGEST_METHOD_NONE) {
        docq = new lcb::docreq::Queue(instance);
        docq->parent = this;
        docq->cb_schedule = cb_op_schedule;
        docq->cb_ready = cb_doc_ready;
        docq->cb_throttle = cb_docq_throttle;
        // TODO: docq->max_pending_response;
        lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    }
}

lcb_ANALYTICS_HANDLE_::lcb_ANALYTICS_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, lcb_DEFERRED_HANDLE *handle)
    : cur_htresp(nullptr), htreq(nullptr), parser(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_ANALYTICS, this)),
      cookie(user_cookie), callback(handle->callback), instance(obj), lasterr(LCB_SUCCESS), timeout(0), nrows(0),
      was_retried(false), deferred_handle(handle->handle), ingest(nullptr), docq(nullptr), refcount(1), span(nullptr)
{
    timeout = LCBT_SETTING(obj, analytics_timeout);

    if (instance->settings->tracer) {
        char id[20] = {0};
        snprintf(id, sizeof(id), "%p", (void *)this);
        span = lcbtrace_span_start(instance->settings->tracer, LCBTRACE_OP_DISPATCH_TO_SERVER, LCBTRACE_NOW, nullptr);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_OPERATION_ID, id);
        lcbtrace_span_add_system_tags(span, instance->settings, LCBTRACE_TAG_SERVICE_ANALYTICS);
    }
}

LIBCOUCHBASE_API
lcb_STATUS lcb_analytics(lcb_INSTANCE *instance, void *cookie, const lcb_CMDANALYTICS *cmd)
{
    lcb_STATUS err;

    if (cmd->callback == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    auto *req = new lcb_ANALYTICS_HANDLE_(instance, cookie, cmd);
    if ((err = req->lasterr) != LCB_SUCCESS) {
        goto GT_DESTROY;
    }

    if ((err = req->issue_htreq()) != LCB_SUCCESS) {
        goto GT_DESTROY;
    }
    if (cmd->priority > 0) {
        req->htreq->add_header("Analytics-Priority", "-1");
    }

    return LCB_SUCCESS;

GT_DESTROY:
    if (cmd->handle) {
        *cmd->handle = nullptr;
    }

    req->callback = nullptr;
    req->unref();
    return err;
}

LIBCOUCHBASE_API lcb_STATUS lcb_deferred_handle_poll(lcb_INSTANCE *instance, void *cookie, lcb_DEFERRED_HANDLE *handle)
{
    lcb_STATUS err;
    ANALYTICSREQ *req;

    if (handle->callback == nullptr || handle->handle.empty()) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    req = new lcb_ANALYTICS_HANDLE_(instance, cookie, handle);
    if ((err = req->lasterr) != LCB_SUCCESS) {
        goto GT_DESTROY;
    }

    if ((err = req->issue_htreq()) != LCB_SUCCESS) {
        goto GT_DESTROY;
    }

    return LCB_SUCCESS;

GT_DESTROY:
    req->callback = nullptr;
    req->unref();
    return err;
}

LIBCOUCHBASE_API lcb_STATUS lcb_analytics_cancel(lcb_INSTANCE *, lcb_ANALYTICS_HANDLE *handle)
{
    if (handle->callback) {
        handle->callback = nullptr;
        if (handle->docq) {
            handle->docq->cancel();
        }
    }
    return LCB_SUCCESS;
}
