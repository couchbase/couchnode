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
#include <map>
#include <string>
#include <list>
#include <regex>
#include <utility>

#include "capi/query.hh"

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void *>(req)
#define LOGARGS(req, lvl) req->instance->settings, "n1ql", LCB_LOG_##lvl, __FILE__, __LINE__

// Indicate that the 'creds' field is to be used.
#define F_CMDN1QL_CREDSAUTH (1u << 15u)

class Plan
{
  private:
    friend struct lcb_N1QLCACHE_st;
    std::string key;
    std::string planstr;
    explicit Plan(std::string k) : key(std::move(k)) {}

  public:
    /**
     * Applies the plan to the output 'bodystr'. We don't assign the
     * Json::Value directly, as this appears to be horribly slow. On my system
     * an assignment took about 200ms!
     * @param body The request body (e.g. N1QLREQ::json)
     * @param[out] bodystr the actual request payload
     */
    void apply_plan(Json::Value &body, std::string &bodystr) const
    {
        body.removeMember("statement");
        bodystr = Json::FastWriter().write(body);

        // Assume bodystr ends with '}'
        size_t pos = bodystr.rfind('}');
        bodystr.erase(pos);

        if (!body.empty()) {
            bodystr.append(",");
        }
        bodystr.append(planstr);
        bodystr.append("}");
    }

  private:
    /**
     * Assign plan data to this entry
     * @param plan The JSON returned from the PREPARE request
     */
    void set_plan(const Json::Value &plan, bool include_encoded_plan)
    {
        // Set the plan as a string
        planstr = "\"prepared\":";
        planstr += Json::FastWriter().write(plan["name"]);
        if (include_encoded_plan) {
            planstr += ",";
            planstr += "\"encoded_plan\":";
            planstr += Json::FastWriter().write(plan["encoded_plan"]);
        }
    }
};

// LRU Cache structure..
struct lcb_N1QLCACHE_st {
    typedef std::list<Plan *> LruCache;
    typedef std::map<std::string, LruCache::iterator> Lookup;

    Lookup by_name;
    LruCache lru;

    /** Maximum number of entries in LRU cache. This is fixed at 5000 */
    static size_t max_size()
    {
        return 5000;
    }

    /**
     * Adds an entry for a given key
     * @param key The key to add
     * @param json The prepared statement returned by the server
     * @return the newly added plan.
     */
    const Plan &add_entry(const std::string &key, const Json::Value &json, bool include_encoded_plan = true)
    {
        if (lru.size() == max_size()) {
            // Purge entry from end
            remove_entry(lru.back()->key);
        }

        // Remove old entry, if present
        remove_entry(key);

        lru.push_front(new Plan(key));
        by_name[key] = lru.begin();
        lru.front()->set_plan(json, include_encoded_plan);
        return *lru.front();
    }

    /**
     * Gets the entry for a given key
     * @param key The statement (key) to look up
     * @return a pointer to the plan if present, nullptr if no entry exists for key
     */
    const Plan *get_entry(const std::string &key)
    {
        auto m = by_name.find(key);
        if (m == by_name.end()) {
            return nullptr;
        }

        const Plan *cur = *m->second;

        // Update LRU:
        lru.splice(lru.begin(), lru, m->second);
        // Note, updating of iterators is not required since splice doesn't
        // invalidate iterators.
        return cur;
    }

    /** Removes an entry with the given key */
    void remove_entry(const std::string &key)
    {
        auto m = by_name.find(key);
        if (m == by_name.end()) {
            return;
        }
        // Remove entry from map
        auto m2 = m->second;
        delete *m2;
        by_name.erase(m);
        lru.erase(m2);
    }

    /** Clears the LRU cache */
    void clear()
    {
        for (auto &ii : lru) {
            delete ii;
        }
        lru.clear();
        by_name.clear();
    }

    ~lcb_N1QLCACHE_st()
    {
        clear();
    }
};

typedef struct lcb_QUERY_HANDLE_ : lcb::jsparse::Parser::Actions {
    const lcb_RESPHTTP *cur_htresp;
    lcb_HTTP_HANDLE *htreq;
    lcb::jsparse::Parser *parser;
    const void *cookie;
    lcb_QUERY_CALLBACK callback;
    lcb_INSTANCE *instance;
    lcb_STATUS lasterr;
    lcb_U32 flags;
    lcb_U32 timeout;
    // How many rows were received. Used to avoid parsing the meta
    size_t nrows;

    /** The PREPARE query itself */
    struct lcb_QUERY_HANDLE_ *prepare_req;

    /** Request body as received from the application */
    Json::Value json;
    const Json::Value &json_const() const
    {
        return json;
    }

    /** String of the original statement. Cached here to avoid jsoncpp lookups */
    std::string statement;
    std::string client_context_id;
    std::string first_error_message;
    uint32_t first_error_code{};

    /** Whether we're retrying this */
    bool was_retried;

    /** Is this query to Analytics for N1QL service */
    bool is_cbas;

    lcbtrace_SPAN *span;

    lcb_N1QLCACHE &cache() const
    {
        return *instance->n1ql_cache;
    }

    /**
     * Creates the sub-N1QLREQ for the PREPARE statement. This inspects the
     * current request (see ::json) and copies it so that we execute the
     * PREPARE instead of the actual query.
     * @return see issue_htreq()
     */
    inline lcb_STATUS request_plan();

    /**
     * Use the plan to execute the given query, and issues the query
     * @param plan The plan itself
     * @return see issue_htreq()
     */
    inline lcb_STATUS apply_plan(const Plan &plan);

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
     * Did the application request this query to use prepared statements
     * @return true if using prepared statements
     */
    inline bool use_prepcache() const
    {
        return flags & LCB_CMDN1QL_F_PREPCACHE;
    }

    /**
     * Pass a row back to the application
     * @param resp The response. This is populated with state information
     *  from the current query
     * @param is_last Whether this is the last row. If this is the last, then
     *  the RESP_F_FINAL flag is set, and no further callbacks will be invoked
     */
    inline void invoke_row(lcb_RESPQUERY *resp, bool is_last);

    /**
     * Fail an application-level query because the prepared statement failed
     * @param orig The response from the PREPARE request
     * @param err The error code
     */
    inline void fail_prepared(const lcb_RESPQUERY *orig, lcb_STATUS err);

    inline lcb_QUERY_HANDLE_(lcb_INSTANCE *obj, const void *user_cookie, const lcb_CMDQUERY *cmd);
    inline ~lcb_QUERY_HANDLE_() override;

    // Parser overrides:
    void JSPARSE_on_row(const lcb::jsparse::Row &row) override
    {
        lcb_RESPQUERY resp{};
        resp.row = static_cast<const char *>(row.row.iov_base);
        resp.nrow = row.row.iov_len;
        nrows++;
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

} N1QLREQ;

static bool parse_json(const char *s, size_t n, Json::Value &res)
{
    return Json::Reader().parse(s, s + n, res);
}

lcb_N1QLCACHE *lcb_n1qlcache_create(void)
{
    return new lcb_N1QLCACHE;
}

void lcb_n1qlcache_destroy(lcb_N1QLCACHE *cache)
{
    delete cache;
}

void lcb_n1qlcache_clear(lcb_N1QLCACHE *cache)
{
    cache->clear();
}

// Special function for debugging. This returns the name and encoded form of
// the plan
void lcb_n1qlcache_getplan(lcb_N1QLCACHE *cache, const std::string &key, std::string &out)
{
    const Plan *plan = cache->get_entry(key);
    if (plan != nullptr) {
        Json::Value tmp(Json::objectValue);
        plan->apply_plan(tmp, out);
    }
}

static const char *wtf_magic_strings[] = {
    "index deleted or node hosting the index is down - cause: queryport.indexNotFound",
    "Index Not Found - cause: queryport.indexNotFound", nullptr};

bool N1QLREQ::has_retriable_error(const Json::Value &root)
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
        const Json::Value &jmsg = cur["msg"];
        const Json::Value &jcode = cur["code"];
        unsigned code = 0;
        if (jcode.isNumeric()) {
            code = jcode.asUInt();
            switch (code) {
                    /* n1ql */
                case 4040: /* statement not found */
                case 4050:
                case 4070:
                    /* analytics */
                case 23000:
                case 23003:
                case 23007:
                    lcb_log(LOGARGS(this, TRACE), LOGFMT "Will retry request. code: %d", LOGID(this), code);
                    return true;
                default:
                    break;
            }
        }
        if (jmsg.isString()) {
            const char *jmstr = jmsg.asCString();
            for (const char **curs = wtf_magic_strings; *curs; curs++) {
                if (!strstr(jmstr, *curs)) {
                    lcb_log(LOGARGS(this, TRACE), LOGFMT "Will retry request. code: %d, msg: %s", LOGID(this), code,
                            jmstr);
                    return true;
                }
            }
        }
    }
    return false;
}

bool N1QLREQ::maybe_retry()
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

    if (!use_prepcache()) {
        // Didn't use our built-in caching (maybe using it from elsewhere?)
        return false;
    }

    was_retried = true;
    parser->get_postmortem(meta);
    if (!parse_json(static_cast<const char *>(meta.iov_base), meta.iov_len, root)) {
        return false; // Not JSON
    }
    if (!has_retriable_error(root)) {
        return false;
    }

    lcb_log(LOGARGS(this, ERROR), LOGFMT "Repreparing statement. Index or version mismatch.", LOGID(this));

    // Let's see if we can actually retry. First remove the existing prepared
    // entry:
    cache().remove_entry(statement);

    if ((lasterr = request_plan()) == LCB_SUCCESS) {
        // We'll be parsing more rows later on..
        delete parser;
        parser = new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_N1QL, this);
        return true;
    }

    return false;
}

void N1QLREQ::invoke_row(lcb_RESPQUERY *resp, bool is_last)
{
    resp->cookie = const_cast<void *>(cookie);
    resp->htresp = cur_htresp;
    resp->handle = this;

    resp->ctx.http_response_code = cur_htresp->ctx.response_code;
    resp->ctx.endpoint = resp->htresp->ctx.endpoint;
    resp->ctx.endpoint_len = resp->htresp->ctx.endpoint_len;
    resp->ctx.client_context_id = client_context_id.c_str();
    resp->ctx.client_context_id_len = client_context_id.size();
    resp->ctx.statement = statement.c_str();
    resp->ctx.statement_len = statement.size();

    if (is_last) {
        lcb_IOV meta_buf;
        resp->rflags |= LCB_RESP_F_FINAL;
        resp->ctx.rc = lasterr;
        parser->get_postmortem(meta_buf);
        resp->row = static_cast<const char *>(meta_buf.iov_base);
        resp->nrow = meta_buf.iov_len;
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
                        case 3000:
                            resp->ctx.rc = LCB_ERR_PARSING_FAILURE;
                            break;
                        case 12009:
                            resp->ctx.rc = LCB_ERR_CAS_MISMATCH;
                            break;
                        case 4040:
                        case 4050:
                        case 4060:
                        case 4070:
                        case 4080:
                        case 4090:
                            resp->ctx.rc = LCB_ERR_PREPARED_STATEMENT_FAILURE;
                            break;
                        case 4300:
                            resp->ctx.rc = LCB_ERR_PLANNING_FAILURE;
                            if (!first_error_message.empty()) {
                                std::regex already_exists("index.+already exists");
                                if (std::regex_search(first_error_message, already_exists)) {
                                    resp->ctx.rc = LCB_ERR_INDEX_EXISTS;
                                }
                            }
                            break;
                        case 5000:
                            resp->ctx.rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
                            if (!first_error_message.empty()) {
                                std::regex already_exists("Index.+already exists"); /* NOTE: case sensitive */
                                if (std::regex_search(first_error_message, already_exists)) {
                                    resp->ctx.rc = LCB_ERR_INDEX_EXISTS;
                                } else {
                                    std::regex not_found("index.+not found");
                                    if (std::regex_search(first_error_message, not_found)) {
                                        resp->ctx.rc = LCB_ERR_INDEX_NOT_FOUND;
                                    }
                                }
                            }
                            break;
                        case 12004:
                        case 12016:
                            resp->ctx.rc = LCB_ERR_INDEX_NOT_FOUND;
                            break;
                        default:
                            if (first_error_code >= 4000 && first_error_code < 5000) {
                                resp->ctx.rc = LCB_ERR_PLANNING_FAILURE;
                            } else if (first_error_code >= 5000 && first_error_code < 6000) {
                                resp->ctx.rc = LCB_ERR_INTERNAL_SERVER_FAILURE;
                            } else if (first_error_code >= 10000 && first_error_code < 11000) {
                                resp->ctx.rc = LCB_ERR_AUTHENTICATION_FAILURE;
                            } else if ((first_error_code >= 12000 && first_error_code < 13000) ||
                                       (first_error_code >= 14000 && first_error_code < 15000)) {
                                resp->ctx.rc = LCB_ERR_INDEX_FAILURE;
                            }
                            break;
                    }
                }
            }
        }
    }

    if (callback) {
        callback(instance, LCB_CALLBACK_QUERY, resp);
    }
    if (is_last) {
        callback = nullptr;
    }
}

lcb_QUERY_HANDLE_::~lcb_QUERY_HANDLE_()
{
    if (callback) {
        lcb_RESPQUERY resp{};
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

    if (htreq) {
        lcb_http_cancel(instance, htreq);
        htreq = nullptr;
    }

    delete parser;

    if (prepare_req) {
        lcb_query_cancel(instance, prepare_req);
    }
}

static void chunk_callback(lcb_INSTANCE *instance, int ign, const lcb_RESPBASE *rb)
{
    const auto *rh = (const lcb_RESPHTTP *)rb;
    auto *req = static_cast<N1QLREQ *>(rh->cookie);

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
            delete req;
        }
        return;
    } else if (req->callback == nullptr) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        delete req;
        return;
    }
    req->parser->feed(static_cast<const char *>(rh->ctx.body), rh->ctx.body_len);
}

void N1QLREQ::fail_prepared(const lcb_RESPQUERY *orig, lcb_STATUS err)
{
    lcb_log(LOGARGS(this, ERROR), LOGFMT "Prepare failed!", LOGID(this));

    lcb_RESPQUERY newresp = *orig;
    newresp.rflags = LCB_RESP_F_FINAL;
    newresp.cookie = const_cast<void *>(cookie);
    newresp.ctx.rc = err;
    if (err == LCB_SUCCESS) {
        newresp.ctx.rc = LCB_ERR_GENERIC;
    }

    if (callback != nullptr) {
        callback(instance, LCB_CALLBACK_QUERY, &newresp);
        callback = nullptr;
    }
    delete this;
}

// Received internally for PREPARE
static void prepare_rowcb(lcb_INSTANCE *instance, int, const lcb_RESPQUERY *row)
{
    auto *origreq = reinterpret_cast<lcb_QUERY_HANDLE_ *>(row->cookie);

    lcb_query_cancel(instance, origreq->prepare_req);
    origreq->prepare_req = nullptr;

    if (row->ctx.rc != LCB_SUCCESS || (row->rflags & LCB_RESP_F_FINAL)) {
        origreq->fail_prepared(row, row->ctx.rc);
    } else {
        // Insert into cache
        Json::Value prepared;
        if (!parse_json(row->row, row->nrow, prepared)) {
            lcb_log(LOGARGS(origreq, ERROR), LOGFMT "Invalid JSON returned from PREPARE", LOGID(origreq));
            origreq->fail_prepared(row, LCB_ERR_PROTOCOL_ERROR);
            return;
        }

        bool eps = LCBVB_CCAPS(LCBT_VBCONFIG(instance)) & LCBVB_CCAP_N1QL_ENHANCED_PREPARED_STATEMENTS;
        // Insert plan into cache
        lcb_log(LOGARGS(origreq, DEBUG), LOGFMT "Got %sprepared statement. Inserting into cache and reissuing",
                LOGID(origreq), eps ? "(enhanced) " : "");
        const Plan &ent = origreq->cache().add_entry(origreq->statement, prepared, !eps);

        // Issue the query with the newly prepared plan
        lcb_STATUS rc = origreq->apply_plan(ent);
        if (rc != LCB_SUCCESS) {
            origreq->fail_prepared(row, rc);
        }
    }
}

lcb_STATUS N1QLREQ::issue_htreq(const std::string &body)
{
    std::string content_type("application/json");

    lcb_CMDHTTP *htcmd;
    if (is_cbas) {
        lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_ANALYTICS);
    } else {
        lcb_cmdhttp_create(&htcmd, LCB_HTTP_TYPE_QUERY);
    }
    lcb_cmdhttp_body(htcmd, body.c_str(), body.size());
    lcb_cmdhttp_content_type(htcmd, content_type.c_str(), content_type.size());
    lcb_cmdhttp_method(htcmd, LCB_HTTP_METHOD_POST);
    lcb_cmdhttp_streaming(htcmd, true);
    lcb_cmdhttp_timeout(htcmd, timeout);
    lcb_cmdhttp_handle(htcmd, &htreq);
    if (flags & F_CMDN1QL_CREDSAUTH) {
        lcb_cmdhttp_skip_auth_header(htcmd, true);
    }

    lcb_STATUS rc = lcb_http(instance, this, htcmd);
    lcb_cmdhttp_destroy(htcmd);
    if (rc == LCB_SUCCESS) {
        htreq->set_callback(chunk_callback);
    }
    return rc;
}

lcb_STATUS N1QLREQ::request_plan()
{
    Json::Value newbody(Json::objectValue);
    newbody["statement"] = "PREPARE " + statement;
    lcb_CMDQUERY newcmd;
    newcmd.callback = prepare_rowcb;
    newcmd.cmdflags = LCB_CMDN1QL_F_JSONQUERY;
    newcmd.handle = &prepare_req;
    newcmd.root = newbody;
    if (flags & F_CMDN1QL_CREDSAUTH) {
        newcmd.cmdflags |= LCB_CMD_F_MULTIAUTH;
    }

    return lcb_query(instance, this, &newcmd);
}

lcb_STATUS N1QLREQ::apply_plan(const Plan &plan)
{
    lcb_log(LOGARGS(this, DEBUG), LOGFMT "Using prepared plan", LOGID(this));
    std::string bodystr;
    plan.apply_plan(json, bodystr);
    return issue_htreq(bodystr);
}

lcb_U32 lcb_n1qlreq_parsetmo(const std::string &s)
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

lcb_QUERY_HANDLE_::lcb_QUERY_HANDLE_(lcb_INSTANCE *obj, const void *user_cookie, const lcb_CMDQUERY *cmd)
    : cur_htresp(nullptr), htreq(nullptr), parser(new lcb::jsparse::Parser(lcb::jsparse::Parser::MODE_N1QL, this)),
      cookie(user_cookie), callback(cmd->callback), instance(obj), lasterr(LCB_SUCCESS), flags(cmd->cmdflags),
      timeout(0), nrows(0), prepare_req(nullptr), was_retried(false), is_cbas(false), span(nullptr)
{
    if (cmd->handle) {
        *cmd->handle = this;
    }

    if (flags & LCB_CMDN1QL_F_JSONQUERY) {
        json = cmd->root;
    } else {
        std::string encoded = Json::FastWriter().write(cmd->root);
        if (!parse_json(encoded.c_str(), encoded.size(), json)) {
            lasterr = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
    }
    if (!cmd->scope_qualifier.empty()) {
        json["query_context"] = cmd->scope_qualifier;
    } else if (!cmd->scope_name.empty()) {
        if (obj->settings->conntype != LCB_TYPE_BUCKET || obj->settings->bucket == nullptr) {
            lcb_log(LOGARGS(this, ERROR),
                    LOGFMT
                    "The instance must be associated with a bucket name to use query with query context qualifier",
                    LOGID(this));
            lasterr = LCB_ERR_INVALID_ARGUMENT;
            return;
        }
        std::string scope_qualifier(obj->settings->bucket);
        scope_qualifier += "." + cmd->scope_name;
        json["query_context"] = scope_qualifier;
    }

    if (flags & LCB_CMDN1QL_F_ANALYTICSQUERY) {
        is_cbas = true;
    }
    if (is_cbas && (flags & LCB_CMDN1QL_F_PREPCACHE)) {
        lasterr = LCB_ERR_OPTIONS_CONFLICT;
        return;
    }

    const Json::Value &j_statement = json_const()["statement"];
    if (j_statement.isString()) {
        statement = j_statement.asString();
    } else if (!j_statement.isNull()) {
        lasterr = LCB_ERR_INVALID_ARGUMENT;
        return;
    }

    timeout = LCBT_SETTING(obj, n1ql_timeout);
    if (cmd->timeout) {
        timeout = cmd->timeout;
    }
    Json::Value &tmoval = json["timeout"];
    if (tmoval.isNull()) {
        char buf[64] = {0};
        sprintf(buf, "%uus", timeout);
        tmoval = buf;
    } else if (tmoval.isString()) {
        timeout = lcb_n1qlreq_parsetmo(tmoval.asString());
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

    // Determine if we need to add more credentials.
    // Because N1QL multi-bucket auth will not work on server versions < 4.5
    // using JSON encoding, we need to only use the multi-bucket auth feature
    // if there are actually multiple credentials to employ.
    const lcb::Authenticator &auth = *instance->settings->auth;
    if (auth.buckets().size() > 1 && (cmd->cmdflags & LCB_CMD_F_MULTIAUTH)) {
        flags |= F_CMDN1QL_CREDSAUTH;
        Json::Value &creds = json["creds"];
        auto ii = auth.buckets().begin();
        if (!(creds.isNull() || creds.isArray())) {
            lasterr = LCB_ERR_INVALID_ARGUMENT;
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
    if (instance->settings->tracer) {
        char id[20] = {0};
        snprintf(id, sizeof(id), "%p", (void *)this);
        span = lcbtrace_span_start(instance->settings->tracer, LCBTRACE_OP_DISPATCH_TO_SERVER, LCBTRACE_NOW, nullptr);
        lcbtrace_span_add_tag_str(span, LCBTRACE_TAG_OPERATION_ID, id);
        lcbtrace_span_add_system_tags(span, instance->settings,
                                      is_cbas ? LCBTRACE_TAG_SERVICE_ANALYTICS : LCBTRACE_TAG_SERVICE_N1QL);
    }
}

LIBCOUCHBASE_API
lcb_STATUS lcb_query(lcb_INSTANCE *instance, void *cookie, const lcb_CMDQUERY *cmd)
{
    lcb_STATUS err;

    if ((cmd->query.empty() && cmd->root.empty()) || cmd->callback == nullptr) {
        return LCB_ERR_INVALID_ARGUMENT;
    }
    auto *req = new lcb_QUERY_HANDLE_(instance, cookie, cmd);
    if ((err = req->lasterr) != LCB_SUCCESS) {
        goto GT_DESTROY;
    }

    if (cmd->cmdflags & LCB_CMDN1QL_F_PREPCACHE) {
        if (req->statement.empty()) {
            err = LCB_ERR_INVALID_ARGUMENT;
            goto GT_DESTROY;
        }

        const Plan *cached = req->cache().get_entry(req->statement);
        if (cached != nullptr) {
            if ((err = req->apply_plan(*cached)) != LCB_SUCCESS) {
                goto GT_DESTROY;
            }
        } else {
            lcb_log(LOGARGS(req, DEBUG), LOGFMT "No cached plan found. Issuing prepare", LOGID(req));
            if ((err = req->request_plan()) != LCB_SUCCESS) {
                goto GT_DESTROY;
            }
        }
    } else {
        // No prepare
        if ((err = req->issue_htreq()) != LCB_SUCCESS) {
            goto GT_DESTROY;
        }
    }

    return LCB_SUCCESS;

GT_DESTROY:
    if (cmd->handle) {
        *cmd->handle = nullptr;
    }

    req->callback = nullptr;
    delete req;
    return err;
}

LIBCOUCHBASE_API lcb_STATUS lcb_query_cancel(lcb_INSTANCE *instance, lcb_QUERY_HANDLE *handle)
{
    // Note that this function is just an elaborate way to nullify the
    // callback. We are very particular about _not_ cancelling the underlying
    // http request, because the handle's deletion is controlled
    // from the HTTP callback, which checks if the callback is nullptr before
    // deleting.
    // at worst, deferring deletion to the http response might cost a few
    // extra network reads; whereas this function itself is intended as a
    // bailout for unexpected destruction.

    if (handle) {
        if (handle->prepare_req) {
            lcb_query_cancel(instance, handle->prepare_req);
            handle->prepare_req = nullptr;
        }
        handle->callback = nullptr;
    }
    return LCB_SUCCESS;
}
