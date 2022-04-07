/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2021 Couchbase, Inc.
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

#include <array>
#include <regex>

#include "internal.h"
#include "logging.h"

#include "auth-priv.h"
#include "http/http-priv.h"

#include "query_utils.hh"
#include "query_handle.hh"
#include "capi/cmd_http.hh"

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) (req)->instance_->settings, "n1qlh", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGARGS2(req, lvl) (instance)->settings, "n1qlh", LCB_LOG_##lvl, __FILE__, __LINE__

static const std::array<const char *, 2> wtf_magic_strings = {
    "index deleted or node hosting the index is down - cause: queryport.indexNotFound",
    "Index Not Found - cause: queryport.indexNotFound",
};

static void chunk_callback(lcb_INSTANCE * /* instance */, int /* cbtype */, const lcb_RESPHTTP *resp)
{
    lcb_QUERY_HANDLE_ *req = nullptr;
    lcb_resphttp_cookie(resp, reinterpret_cast<void **>(&req));

    req->http_response(resp);

    if (lcb_resphttp_is_final(resp)) {
        req->clear_http_request();
        if (!req->maybe_retry()) {
            delete req;
        }
        return;
    } else if (req->is_cancelled()) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        delete req;
        return;
    }

    req->consume_http_chunk();
    req->clear_http_response();
}

// Received internally for PREPARE
static void prepare_rowcb(lcb_INSTANCE *instance, int, const lcb_RESPQUERY *row)
{
    auto *origreq = reinterpret_cast<lcb_QUERY_HANDLE_ *>(row->cookie);

    origreq->cancel_prepare_query();

    if (row->ctx.rc != LCB_SUCCESS || (row->rflags & LCB_RESP_F_FINAL)) {
        return origreq->fail_prepared(row, row->ctx.rc);
    } else {
        // Insert into cache
        Json::Value prepared;
        if (!Json::Reader().parse(row->row, row->row + row->nrow, prepared)) {
            lcb_log(LOGARGS2(instance, ERROR), LOGFMT "Invalid JSON returned from PREPARE", LOGID(origreq));
            return origreq->fail_prepared(row, LCB_ERR_PROTOCOL_ERROR);
        }

        bool eps = LCBVB_CCAPS(LCBT_VBCONFIG(instance)) & LCBVB_CCAP_N1QL_ENHANCED_PREPARED_STATEMENTS;
        // Insert plan into cache
        lcb_log(LOGARGS2(instance, DEBUG), LOGFMT "Got %sprepared statement. Inserting into cache and reissuing",
                LOGID(origreq), eps ? "(enhanced) " : "");
        const Plan &ent = origreq->cache().add_entry(origreq->statement(), prepared, !eps);

        // Issue the query with the newly prepared plan
        lcb_STATUS rc = origreq->apply_plan(ent);
        if (rc != LCB_SUCCESS) {
            return origreq->fail_prepared(row, rc);
        }
    }
}

bool lcb_QUERY_HANDLE_::parse_meta(const char *row, size_t row_len, lcb_STATUS &rc)
{
    first_error.message.clear();
    first_error.code = 0;

    Json::Value meta;
    if (!Json::Reader(Json::Features::strictMode()).parse(row, row + row_len, meta)) {
        return false;
    }
    const Json::Value &errors = meta["errors"];
    if (errors.isArray() && !errors.empty()) {
        const Json::Value &err = errors[0];
        if (err.isMember("retry") && err["retry"].isBool()) {
            first_error.retry = err["retry"].asBool();
        }
        if (err.isMember("reason") && err["reason"].isObject()) {
            const Json::Value &reason = err["reason"];
            if (reason.isMember("code") && reason["code"].isNumeric()) {
                first_error.reason_code = reason["code"].asInt();
            }
        }
        const Json::Value &msg = err["msg"];
        if (msg.isString()) {
            first_error.message = msg.asString();
        }
        const Json::Value &code = err["code"];
        if (code.isNumeric()) {
            first_error.code = code.asUInt();
            switch (first_error.code) {
                case 3000:
                    rc = LCB_ERR_PARSING_FAILURE;
                    break;
                case 12009:
                    rc = LCB_ERR_DML_FAILURE;
                    if (first_error.message.find("CAS mismatch") != std::string::npos) {
                        rc = LCB_ERR_CAS_MISMATCH;
                    }
                    switch (first_error.reason_code) {
                        case 12033:
                            rc = LCB_ERR_CAS_MISMATCH;
                            break;
                        case 17014:
                            rc = LCB_ERR_DOCUMENT_NOT_FOUND;
                            break;
                        case 17012:
                            rc = LCB_ERR_DOCUMENT_EXISTS;
                            break;
                    }
                    break;
                case 4040:
                case 4050:
                case 4060:
                case 4070:
                case 4080:
                case 4090:
                    rc = LCB_ERR_PREPARED_STATEMENT_FAILURE;
                    break;
                case 4300:
                    rc = LCB_ERR_PLANNING_FAILURE;
                    if (!first_error.message.empty()) {
                        std::regex already_exists("index.+already exists");
                        if (std::regex_search(first_error.message, already_exists)) {
                            rc = LCB_ERR_INDEX_EXISTS;
                        }
                    }
                    break;
                case 5000:
                    rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
                    if (!first_error.message.empty()) {
                        std::regex already_exists("Index.+already exists"); /* NOTE: case sensitive */
                        std::regex not_found("index.+not found");
                        if (std::regex_search(first_error.message, already_exists)) {
                            rc = LCB_ERR_INDEX_EXISTS;
                        } else if (std::regex_search(first_error.message, not_found)) {
                            rc = LCB_ERR_INDEX_NOT_FOUND;
                        } else if (first_error.message.find(
                                       "Limit for number of indexes that can be created per scope has been reached") !=
                                   std::string::npos) {
                            rc = LCB_ERR_QUOTA_LIMITED;
                        }
                    }
                    break;
                case 12016:
                    /* see MB-50643 */
                    first_error.retry = false;
                    /* fallthrough */
                case 12004:
                    rc = LCB_ERR_INDEX_NOT_FOUND;
                    break;
                case 12003:
                    rc = LCB_ERR_KEYSPACE_NOT_FOUND;
                    break;
                case 12021:
                    rc = LCB_ERR_SCOPE_NOT_FOUND;
                    break;
                case 13014:
                    rc = LCB_ERR_AUTHENTICATION_FAILURE;
                    break;

                case 1191:
                case 1192:
                case 1193:
                case 1194:
                    rc = LCB_ERR_RATE_LIMITED;
                    break;

                default:
                    if (first_error.code >= 4000 && first_error.code < 5000) {
                        rc = LCB_ERR_PLANNING_FAILURE;
                    } else if (first_error.code >= 5000 && first_error.code < 6000) {
                        rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
                    } else if (first_error.code >= 10000 && first_error.code < 11000) {
                        rc = LCB_ERR_AUTHENTICATION_FAILURE;
                    } else if ((first_error.code >= 12000 && first_error.code < 13000) ||
                               (first_error.code >= 14000 && first_error.code < 15000)) {
                        rc = LCB_ERR_INDEX_FAILURE;
                    }
                    break;
            }
        }
    }
    return true;
}

void lcb_QUERY_HANDLE_::invoke_row(lcb_RESPQUERY *resp, bool is_last)
{
    resp->cookie = cookie_;
    resp->htresp = http_response_;
    resp->handle = this;

    if (resp->htresp) {
        resp->ctx.http_response_code = resp->htresp->ctx.response_code;
        resp->ctx.endpoint = resp->htresp->ctx.endpoint;
        resp->ctx.endpoint_len = resp->htresp->ctx.endpoint_len;
    }
    resp->ctx.client_context_id = client_context_id_.c_str();
    resp->ctx.client_context_id_len = client_context_id_.size();
    resp->ctx.statement = statement_.c_str();
    resp->ctx.statement_len = statement_.size();

    if (is_last) {
        lcb_IOV meta_buf;
        resp->rflags |= LCB_RESP_F_FINAL;
        resp->ctx.rc = last_error_;
        parser_->get_postmortem(meta_buf);
        resp->row = static_cast<const char *>(meta_buf.iov_base);
        resp->nrow = meta_buf.iov_len;
        parse_meta(resp->row, resp->nrow, resp->ctx.rc);
        resp->ctx.error_response_body = resp->row;
        resp->ctx.error_response_body_len = resp->nrow;
        if (!first_error.message.empty()) {
            resp->ctx.first_error_message = first_error.message.c_str();
            resp->ctx.first_error_message_len = first_error.message.size();
        }
        resp->ctx.first_error_code = first_error.code;
        if (span_ != nullptr) {
            lcb::trace::finish_http_span(span_, this);
            span_ = nullptr;
        }

        if (http_request_ != nullptr) {
            http_request_->span = nullptr;
        }
        if (http_request_ != nullptr) {
            record_http_op_latency(nullptr, "query", instance_, http_request_->start);
        }
    }
    if (callback_) {
        callback_(instance_, LCB_CALLBACK_QUERY, resp);
    }
    if (is_last) {
        callback_ = nullptr;
    }
}

lcb_STATUS lcb_QUERY_HANDLE_::request_address()
{
    if (!LCBT_VBCONFIG(instance_)) {
        return LCB_ERR_NO_CONFIGURATION;
    }

    const lcbvb_SVCMODE mode = LCBT_SETTING_SVCMODE(instance_);

    lcbvb_CONFIG *vbc = LCBT_VBCONFIG(instance_);

    if (last_config_revision_ != vbc->revid) {
        used_nodes.clear();
        last_config_revision_ = vbc->revid;
    }
    used_nodes.resize(LCBVB_NSERVERS(vbc));

    int ix = lcbvb_get_randhost_ex(vbc, LCBVB_SVCTYPE_QUERY, mode, &used_nodes[0]);
    if (ix < 0) {
        /* check if we can reset list of used nodes for this request and start over */
        bool reset_and_retry = false;
        for (auto used : used_nodes) {
            if (used) {
                reset_and_retry = true;
                break;
            }
        }
        if (!reset_and_retry) {
            return LCB_ERR_UNSUPPORTED_OPERATION;
        }
        used_nodes.clear();
        used_nodes.resize(LCBVB_NSERVERS(vbc));
        return request_address();
    }
    const char *rest_url = lcbvb_get_resturl(vbc, ix, LCBVB_SVCTYPE_QUERY, mode);
    if (rest_url == nullptr) {
        return LCB_ERR_SERVICE_NOT_AVAILABLE;
    }
    used_nodes[ix] = 1;
    endpoint = rest_url;
    hostname = lcbvb_get_hostname(vbc, ix);
    port = std::to_string(lcbvb_get_port(vbc, ix, LCBVB_SVCTYPE_QUERY, mode));
    return LCB_SUCCESS;
}

lcbauth_RESULT lcb_QUERY_HANDLE_::request_credentials(lcbauth_REASON reason)
{
    if (reason == LCBAUTH_REASON_AUTHENTICATION_FAILURE) {
        username_.clear();
        password_.clear();
    }
    const auto *auth = LCBT_SETTING(instance_, auth);
    auto creds = auth->credentials_for(LCBAUTH_SERVICE_QUERY, reason, hostname.c_str(), port.c_str(),
                                       LCBT_SETTING(instance_, bucket));
    if (reason != LCBAUTH_REASON_AUTHENTICATION_FAILURE && creds.result() == LCBAUTH_RESULT_OK) {
        username_ = creds.username();
        password_ = creds.password();
    }
    return creds.result();
}

bool lcb_QUERY_HANDLE_::maybe_retry()
{
    // Examines the buffer to determine the type of error
    lcb_IOV meta;

    if (callback_ == nullptr) {
        // Cancelled
        return false;
    }

    if (rows_number_) {
        // Has results:
        return false;
    }

    lcb_STATUS rc = last_error_;
    parser_->get_postmortem(meta);
    if (!parse_meta(static_cast<const char *>(meta.iov_base), meta.iov_len, rc)) {
        return false; // Not JSON
    }

    lcb_RETRY_ACTION action = has_retriable_error(rc);
    if (!action.should_retry) {
        return false;
    }
    retries_++;

    if (use_prepcache() && rc == LCB_ERR_PREPARED_STATEMENT_FAILURE) {
        lcb_log(LOGARGS(this, ERROR), LOGFMT "Repreparing statement. Index or version mismatch.", LOGID(this));

        // Let's see if we can actually retry. First remove the existing prepared
        // entry:
        cache().remove_entry(statement_);
        last_error_ = request_plan();
    } else {
        // re-issue original request body
        backoff_and_issue_http_request(LCB_MS2US(action.retry_after_ms));
        return true;
    }

    if (last_error_ == LCB_SUCCESS) {
        // We'll be parsing more rows later on..
        delete parser_;
        parser_ = new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_N1QL, this);
        return true;
    }

    return false;
}

lcb_RETRY_ACTION lcb_QUERY_HANDLE_::has_retriable_error(lcb_STATUS &rc)
{
    const uint32_t default_backoff = 100 /* ms */;
    if (rc == LCB_ERR_PREPARED_STATEMENT_FAILURE) {
        lcb_log(LOGARGS(this, TRACE), LOGFMT "Will retry request. rc: %s, code: %d, msg: %s", LOGID(this),
                lcb_strerror_short(rc), first_error.code, first_error.message.c_str());
        return {1, default_backoff};
    }
    if (first_error.code == 13014 &&
        LCBT_SETTING(instance_, auth)->mode() == LCBAUTH_MODE_DYNAMIC) { // datastore.couchbase.insufficient_credentials
        auto result = request_credentials(LCBAUTH_REASON_AUTHENTICATION_FAILURE);
        bool credentials_found = result == LCBAUTH_RESULT_OK;
        lcb_log(LOGARGS(this, TRACE),
                LOGFMT "Invalidate credentials and retry request. creds: %s, rc: %s, code: %d, msg: %s", LOGID(this),
                credentials_found ? "ok" : "not_found", lcb_strerror_short(rc), first_error.code,
                first_error.message.c_str());
        return {credentials_found, default_backoff};
    }
    if (!first_error.message.empty()) {
        for (const auto &magic_string : wtf_magic_strings) {
            if (first_error.message.find(magic_string) != std::string::npos) {
                lcb_log(LOGARGS(this, TRACE),
                        LOGFMT
                        "Special error message detected. Will retry request. rc: %s (update to %s), code: %d, msg: %s",
                        LOGID(this), lcb_strerror_short(rc), lcb_strerror_short(LCB_ERR_PREPARED_STATEMENT_FAILURE),
                        first_error.code, first_error.message.c_str());
                rc = LCB_ERR_PREPARED_STATEMENT_FAILURE;
                return {1, default_backoff};
            }
        }
    }

    if (rc == LCB_SUCCESS) {
        return {0, 0};
    }
    return lcb_query_should_retry(instance_->settings, this, rc, first_error.retry);
}

lcb_STATUS lcb_QUERY_HANDLE_::issue_htreq(const std::string &body)
{
    lcb_STATUS rc = request_address();
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    std::string content_type("application/json");

    lcb_CMDHTTP *htcmd;
    lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_QUERY);
    lcb_cmdhttp_body(htcmd, body.c_str(), body.size());
    lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());
    lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_streaming(htcmd, true);
    lcb_cmdhttp_timeout(htcmd, timeout + LCBT_SETTING(instance_, n1ql_grace_period));
    lcb_cmdhttp_handle(htcmd, &http_request_);
    lcb_cmdhttp_host(htcmd, endpoint.data(), endpoint.size());
    if (!impostor_.empty()) {
        htcmd->set_header("cb-on-behalf-of", impostor_);
    }
    if (use_multi_bucket_authentication_) {
        lcb_cmdhttp_skip_auth_header(htcmd, true);
    } else {
        if (username_.empty() && password_.empty()) {
            auto result = request_credentials(LCBAUTH_REASON_NEW_OPERATION);
            if (result != LCBAUTH_RESULT_OK) {
                const uint32_t auth_backoff = 100 /* ms */;
                backoff_and_issue_http_request(LCB_MS2US(auth_backoff));
                lcb_cmdhttp_destroy(htcmd);
                return rc;
            }
        }
        lcb_cmdhttp_username(htcmd, username_.c_str(), username_.size());
        lcb_cmdhttp_password(htcmd, password_.c_str(), password_.size());
    }

    lcb_cmdhttp_parent_span(htcmd, span_);

    rc = lcb_http(instance_, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (rc == LCB_SUCCESS) {
        http_request_->set_callback(reinterpret_cast<lcb_RESPCALLBACK>(chunk_callback));
    }
    lcb_log(LOGARGS(this, TRACE),
            LOGFMT "execute query: %.*s, idempotent=%s, timeout=%uus, grace_period=%uus, client_context_id=\"%s\"",
            LOGID(this), (int)body.size(), body.c_str(), idempotent_ ? "true" : "false", timeout,
            LCBT_SETTING(instance_, n1ql_grace_period), client_context_id_.c_str());
    return rc;
}

lcb_STATUS lcb_QUERY_HANDLE_::request_plan()
{
    Json::Value newbody(Json::objectValue);
    newbody["statement"] = "PREPARE " + statement_;
    if (json.isMember("query_context") && json["query_context"].isString()) {
        newbody["query_context"] = json["query_context"];
    }
    lcb_CMDQUERY newcmd;
    newcmd.callback(prepare_rowcb);
    newcmd.store_handle_refence_to(&prepare_query_);
    newcmd.use_multi_bucket_authentication(use_multi_bucket_authentication_);
    newcmd.root(newbody);

    return lcb_query(instance_, this, &newcmd);
}

lcb_STATUS lcb_QUERY_HANDLE_::apply_plan(const Plan &plan)
{
    lcb_log(LOGARGS(this, DEBUG), LOGFMT "Using prepared plan", LOGID(this));
    std::string bodystr;
    plan.apply_plan(json, bodystr);
    return issue_htreq(bodystr);
}

lcb_QUERY_HANDLE_::lcb_QUERY_HANDLE_(lcb_INSTANCE *obj, void *user_cookie, const lcb_CMDQUERY *cmd)
    : parser_(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_N1QL, this)), cookie_(user_cookie),
      callback_(cmd->callback()), instance_(obj), prepared_statement_(cmd->prepare_statement()),
      use_multi_bucket_authentication_(cmd->use_multi_bucket_authentication()),
      timeout_timer_(instance_->iotable, this), backoff_timer_(instance_->iotable, this)
{
    if (cmd->is_query_json()) {
        json = cmd->root();
    } else {
        std::string encoded = Json::FastWriter().write(cmd->root());
        if (!Json::Reader().parse(encoded, json)) {
            last_error_ = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
    }
    if (cmd->has_explicit_scope_qualifier()) {
        json["query_context"] = cmd->scope_qualifier();
    } else if (cmd->has_scope()) {
        if (obj->settings->conntype != LCB_TYPE_BUCKET || obj->settings->bucket == nullptr) {
            lcb_log(LOGARGS(this, ERROR),
                    LOGFMT
                    "The instance must be associated with a bucket name to use query with query context qualifier",
                    LOGID(this));
            last_error_ = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
        std::string scope_qualifier(obj->settings->bucket);
        scope_qualifier += "." + cmd->scope();
        json["query_context"] = scope_qualifier;
    }

    const Json::Value &j_statement = json_const()["statement"];
    if (j_statement.isString()) {
        statement_ = j_statement.asString();
    } else if (!j_statement.isNull()) {
        last_error_ = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    timeout = cmd->timeout_or_default_in_microseconds(LCBT_SETTING(obj, n1ql_timeout));
    Json::Value &tmoval = json["timeout"];
    if (tmoval.isNull()) {
        char buf[64] = {0};
        sprintf(buf, "%uus", timeout);
        tmoval = buf;
        json["timeout"] = buf;
    } else if (tmoval.isString()) {
        try {
            auto tmo_ns = lcb_parse_golang_duration(tmoval.asString());
            timeout = std::chrono::duration_cast<std::chrono::microseconds>(tmo_ns).count();
        } catch (const lcb_duration_parse_error &) {
            last_error_ = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
    } else {
        // Timeout is not a string!
        last_error_ = LCB_ERR_INVALID_ARGUMENT;
        return;
    }
    const Json::Value &ccid = json["client_context_id"];
    if (ccid.isNull()) {
        char buf[32];
        size_t nbuf = snprintf(buf, sizeof(buf), "%016" PRIx64, lcb_next_rand64());
        client_context_id_.assign(buf, nbuf);
        json["client_context_id"] = client_context_id_;
    } else {
        client_context_id_ = ccid.asString();
    }
    if (json.isMember("readonly") && json["readonly"].asBool()) {
        idempotent_ = true;
    }
    timeout_timer_.rearm(timeout + LCBT_SETTING(obj, n1ql_grace_period));

    // Determine if we need to add more credentials.
    // Because N1QL multi-bucket auth will not work on server versions < 4.5
    // using JSON encoding, we need to only use the multi-bucket auth feature
    // if there are actually multiple credentials to employ.
    const lcb::Authenticator &auth = *instance_->settings->auth;
    if (auth.buckets().size() > 1 && cmd->use_multi_bucket_authentication()) {
        use_multi_bucket_authentication_ = true;
        Json::Value &creds = json["creds"];
        auto ii = auth.buckets().begin();
        if (!(creds.isNull() || creds.isArray())) {
            last_error_ = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
        for (; ii != auth.buckets().end(); ++ii) {
            if (ii->second.empty()) {
                continue;
            }
            Json::Value &curCreds = creds.append(Json::Value(Json::objectValue));
            curCreds["user"] = ii->first;
            curCreds["pass"] = ii->second;
        }
    }
    if (cmd->want_impersonation()) {
        impostor_ = cmd->impostor();
    }
    if (instance_->settings->tracer) {
        parent_span_ = cmd->parent_span();
        span_ = lcb::trace::start_http_span_with_statement(instance_->settings, this, statement_);
    }
}

lcb_QUERY_HANDLE_::~lcb_QUERY_HANDLE_()
{
    if (callback_ != nullptr) {
        lcb_RESPQUERY resp{};
        invoke_row(&resp, true);
    }

    if (http_request_ != nullptr) {
        lcb_http_cancel(instance_, http_request_);
        http_request_ = nullptr;
    }

    delete parser_;
    parser_ = nullptr;

    if (prepare_query_ != nullptr) {
        lcb_query_cancel(instance_, prepare_query_);
        delete prepare_query_;
    }
    timeout_timer_.release();
    if (backoff_timer_.is_armed()) {
        lcb_aspend_del(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    }
    backoff_timer_.release();
    lcb_maybe_breakout(instance_);
}

void lcb_QUERY_HANDLE_::fail_prepared(const lcb_RESPQUERY *orig, lcb_STATUS err)
{
    lcb_log(LOGARGS(this, ERROR), LOGFMT "Prepare failed!", LOGID(this));

    lcb_RESPQUERY newresp = *orig;
    newresp.rflags = LCB_RESP_F_FINAL;
    newresp.cookie = cookie_;
    newresp.ctx.rc = err;
    if (err == LCB_SUCCESS) {
        newresp.ctx.rc = LCB_ERR_GENERIC;
    }

    if (callback_ != nullptr) {
        callback_(instance_, LCB_CALLBACK_QUERY, &newresp);
        callback_ = nullptr;
    }
    delete this;
}
void lcb_QUERY_HANDLE_::on_backoff()
{
    lcb_aspend_del(&instance_->pendops, LCB_PENDTYPE_COUNTER, nullptr);
    backoff_timer_.cancel();
    delete parser_;
    parser_ = new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_N1QL, this);
    if (use_prepcache()) {
        const Plan *cached = cache().get_entry(statement_);
        if (cached != nullptr) {
            last_error_ = apply_plan(*cached);
        } else {
            lcb_log(LOGARGS(this, DEBUG), LOGFMT "No cached plan found. Issuing prepare", LOGID(this));
            last_error_ = request_plan();
        }
        return;
    }
    last_error_ = issue_htreq();
}
