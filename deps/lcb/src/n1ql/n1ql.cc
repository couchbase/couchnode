#include <libcouchbase/couchbase.h>
#include <libcouchbase/n1ql.h>
#include <jsparse/parser.h>
#include "internal.h"
#include "http/http.h"
#include "logging.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include <map>
#include <string>
#include <list>

#define LOGFMT "(NR=%p) "
#define LOGID(req) static_cast<const void*>(req)
#define LOGARGS(req, lvl) req->instance->settings, "n1ql", LCB_LOG_##lvl, __FILE__, __LINE__

class Plan {
private:
    friend struct lcb_N1QLCACHE_st;
    std::string key;
    std::string planstr;
    Plan(const std::string& k) : key(k) {
    }

public:
    /**
     * Applies the plan to the output 'bodystr'. We don't assign the
     * Json::Value directly, as this appears to be horribly slow. On my system
     * an assignment took about 200ms!
     * @param body The request body (e.g. N1QLREQ::json)
     * @param[out] bodystr the actual request payload
     */
    void apply_plan(Json::Value& body, std::string& bodystr) const {
        body.removeMember("statement");
        bodystr = Json::FastWriter().write(body);

        // Assume bodystr ends with '}'
        size_t pos = bodystr.rfind('}');
        bodystr.erase(pos);

        if (body.size() > 0) {
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
    void set_plan(const Json::Value& plan) {
        // Set the plan as a string
        planstr = "\"prepared\":";
        planstr += Json::FastWriter().write(plan["name"]);
        planstr += ",";
        planstr += "\"encoded_plan\":";
        planstr += Json::FastWriter().write(plan["encoded_plan"]);
    }
};

// LRU Cache structure..
struct lcb_N1QLCACHE_st {
    typedef std::list<Plan*> LruCache;
    typedef std::map<std::string, LruCache::iterator> Lookup;

    Lookup by_name;
    LruCache lru;

    /** Maximum number of entries in LRU cache. This is fixed at 5000 */
    static size_t max_size() { return 5000; }

    /**
     * Adds an entry for a given key
     * @param key The key to add
     * @param json The prepared statement returned by the server
     * @return the newly added plan.
     */
    const Plan& add_entry(const std::string& key, const Json::Value& json) {
        if (lru.size() == max_size()) {
            // Purge entry from end
            remove_entry(lru.back()->key);
        }

        // Remove old entry, if present
        remove_entry(key);

        lru.push_front(new Plan(key));
        by_name[key] = lru.begin();
        lru.front()->set_plan(json);
        return *lru.front();
    }

    /**
     * Gets the entry for a given key
     * @param key The statement (key) to look up
     * @return a pointer to the plan if present, NULL if no entry exists for key
     */
    const Plan* get_entry(const std::string& key) {
        Lookup::iterator m = by_name.find(key);
        if (m == by_name.end()) {
            return NULL;
        }

        const Plan* cur = *m->second;

        // Update LRU:
        lru.splice(lru.begin(), lru, m->second);
        // Note, updating of iterators is not required since splice doesn't
        // invalidate iterators.
        return cur;
    }

    /** Removes an entry with the given key */
    void remove_entry(const std::string& key) {
        Lookup::iterator m = by_name.find(key);
        if (m == by_name.end()) {
            return;
        }
        // Remove entry from map
        LruCache::iterator m2 = m->second;
        delete *m2;
        by_name.erase(m);
        lru.erase(m2);
    }

    /** Clears the LRU cache */
    void clear() {
        for (LruCache::iterator ii = lru.begin(); ii != lru.end(); ++ii) {
            delete *ii;
        }
        lru.clear();
        by_name.clear();
    }

    ~lcb_N1QLCACHE_st() {
        clear();
    }
};

typedef struct lcb_N1QLREQ {
    const lcb_RESPHTTP *cur_htresp;
    struct lcb_http_request_st *htreq;
    lcbjsp_PARSER *parser;
    const void *cookie;
    lcb_N1QLCALLBACK callback;
    lcb_t instance;
    lcb_error_t lasterr;
    lcb_U32 flags;
    lcb_U32 timeout;
    // How many rows were received. Used to avoid parsing the meta
    size_t nrows;

    /** The PREPARE query itself */
    struct lcb_N1QLREQ *prepare_req;

    /** Request body as received from the application */
    Json::Value json;

    /** String of the original statement. Cached here to avoid jsoncpp lookups */
    std::string statement;

    /** Whether we're retrying this */
    bool was_retried;

    lcb_N1QLCACHE& cache() { return *instance->n1ql_cache; }

    /**
     * Creates the sub-N1QLREQ for the PREPARE statement. This inspects the
     * current request (see ::json) and copies it so that we execute the
     * PREPARE instead of the actual query.
     * @return see issue_htreq()
     */
    inline lcb_error_t request_plan();

    /**
     * Use the plan to execute the given query, and issues the query
     * @param plan The plan itself
     * @return see issue_htreq()
     */
    inline lcb_error_t apply_plan(const Plan& plan);

    /**
     * Issues the HTTP request for the query
     * @param payload The body to send
     * @return Error code from lcb's http subsystem
     */
    inline lcb_error_t issue_htreq(const std::string& payload);

    lcb_error_t issue_htreq() {
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
     * Did the application request this query to use prepared statements
     * @return true if using prepared statements
     */
    inline bool use_prepcache() const { return flags & LCB_CMDN1QL_F_PREPCACHE; }

    /**
     * Pass a row back to the application
     * @param resp The response. This is populated with state information
     *  from the current query
     * @param is_last Whether this is the last row. If this is the last, then
     *  the RESP_F_FINAL flag is set, and no further callbacks will be invoked
     */
    inline void invoke_row(lcb_RESPN1QL *resp, bool is_last);

    /**
     * Fail an application-level query because the prepared statement failed
     * @param orig The response from the PREPARE request
     * @param err The error code
     */
    inline void fail_prepared(const lcb_RESPN1QL *orig, lcb_error_t err);

    inline lcb_N1QLREQ(lcb_t obj, const void *user_cookie, const lcb_CMDN1QL *cmd);
    inline ~lcb_N1QLREQ();

} N1QLREQ;

static bool
parse_json(const char *s, size_t n, Json::Value& res)
{
    return Json::Reader().parse(s, s + n, res);
}

lcb_N1QLCACHE *
lcb_n1qlcache_create(void)
{
    return new lcb_N1QLCACHE;
}

void
lcb_n1qlcache_destroy(lcb_N1QLCACHE *cache)
{
    delete cache;
}

void
lcb_n1qlcache_clear(lcb_N1QLCACHE *cache)
{
    cache->clear();
}

// Special function for debugging. This returns the name and encoded form of
// the plan
void
lcb_n1qlcache_getplan(lcb_N1QLCACHE *cache,
    const std::string& key, std::string& out)
{
    const Plan* plan = cache->get_entry(key);
    if (plan != NULL) {
        Json::Value tmp(Json::objectValue);
        plan->apply_plan(tmp, out);
    }
}

#define WTF_MAGIC_STRING \
    "index deleted or node hosting the index is down - cause: queryport.indexNotFound"

static bool
has_retriable_error(const Json::Value& root)
{
    if (!root.isObject()) {
        return false;
    }
    const Json::Value& errors = root["errors"];
    if (!errors.isArray()) {
        return false;
    }
    Json::Value::const_iterator ii;
    for (ii = errors.begin(); ii != errors.end(); ++ii) {
        const Json::Value& cur = *ii;
        if (!cur.isObject()) {
            continue; // eh?
        }
        std::string msg = cur["msg"].asString();
        unsigned code = cur["code"].asUInt();
        if (code == 4050 || code == 4070) {
            return true;
        }
        if (msg.find(WTF_MAGIC_STRING) != std::string::npos) {
            return true;
        }
    }
    return false;
}

bool
N1QLREQ::maybe_retry()
{
    // Examines the buffer to determine the type of error
    Json::Value root;
    lcb_IOV meta;

    if (callback == NULL) {
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

    lcbjsp_get_postmortem(parser, &meta);
    if (!parse_json(static_cast<const char*>(meta.iov_base), meta.iov_len, root)) {
        return false; // Not JSON
    }
    if (!has_retriable_error(root)) {
        return false;
    }

    lcb_log(LOGARGS(this, ERROR), LOGFMT "Repreparing statement. Index or version mismatch.", LOGID(this));

    // Let's see if we can actually retry. First remove the existing prepared
    // entry:
    cache().remove_entry(statement);
    lcb_error_t rc = request_plan();
    if (rc != LCB_SUCCESS) {
        lasterr = rc;
        return false;

    } else {
        // We'll be parsing more rows later on..
        lcbjsp_reset(parser);
    }
    return true;
}

void
N1QLREQ::invoke_row(lcb_RESPN1QL *resp, bool is_last)
{
    resp->cookie = const_cast<void*>(cookie);
    resp->htresp = cur_htresp;

    if (is_last) {
        lcb_IOV meta;
        resp->rflags |= LCB_RESP_F_FINAL;
        resp->rc = lasterr;
        lcbjsp_get_postmortem(parser, &meta);
        resp->row = static_cast<const char*>(meta.iov_base);
        resp->nrow = meta.iov_len;
    }

    if (callback) {
        callback(instance, LCB_CALLBACK_N1QL, resp);
    }
    if (is_last) {
        callback = NULL;
    }
}

lcb_N1QLREQ::~lcb_N1QLREQ()
{
    if (htreq) {
        lcb_cancel_http_request(instance, htreq);
        htreq = NULL;
    }

    if (callback) {
        lcb_RESPN1QL resp = { 0 };
        invoke_row(&resp, 1);
    }

    if (parser) {
        lcbjsp_free(parser);
    }
    if (prepare_req) {
        lcb_n1ql_cancel(instance, prepare_req);
    }
}

static void
row_callback(lcbjsp_PARSER *parser, const lcbjsp_ROW *datum)
{
    N1QLREQ *req = static_cast<N1QLREQ*>(parser->data);
    lcb_RESPN1QL resp = { 0 };

    if (datum->type == LCBJSP_TYPE_ROW) {
        resp.row = static_cast<const char*>(datum->row.iov_base);
        resp.nrow = datum->row.iov_len;
        req->nrows++;
        req->invoke_row(&resp, 0);
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
    N1QLREQ *req = static_cast<N1QLREQ*>(rh->cookie);

    (void)ign; (void)instance;

    req->cur_htresp = rh;
    if (rh->rc != LCB_SUCCESS || rh->htstatus != 200) {
        if (req->lasterr == LCB_SUCCESS || rh->htstatus != 200) {
            req->lasterr = rh->rc ? rh->rc : LCB_HTTP_ERROR;
        }
    }

    if (rh->rflags & LCB_RESP_F_FINAL) {
        req->htreq = NULL;
        if (!req->maybe_retry()) {
            delete req;
        }
        return;
    } else if (req->callback == NULL) {
        /* Cancelled. Similar to the block above, except the http request
         * should remain alive (so we can cancel it later on) */
        delete req;
        return;
    }

    lcbjsp_feed(req->parser, static_cast<const char*>(rh->body), rh->nbody);
}

#define QUERY_PATH "/query/service"

void
N1QLREQ::fail_prepared(const lcb_RESPN1QL *orig, lcb_error_t err)
{
    lcb_log(LOGARGS(this, ERROR), LOGFMT "Prepare failed!", LOGID(this));

    lcb_RESPN1QL newresp = *orig;
    newresp.rflags = LCB_RESP_F_FINAL;
    newresp.cookie = const_cast<void*>(cookie);
    newresp.rc = err;
    if (err == LCB_SUCCESS) {
        newresp.rc = LCB_ERROR;
    }

    if (callback != NULL) {
        callback(instance, LCB_CALLBACK_N1QL, &newresp);
        callback = NULL;
    }
    delete this;
}

// Received internally for PREPARE
static void
prepare_rowcb(lcb_t instance, int, const lcb_RESPN1QL *row)
{
    lcb_N1QLREQ *origreq = reinterpret_cast<lcb_N1QLREQ*>(row->cookie);

    lcb_n1ql_cancel(instance, origreq->prepare_req);
    origreq->prepare_req = NULL;

    if (row->rc != LCB_SUCCESS || (row->rflags & LCB_RESP_F_FINAL)) {
        origreq->fail_prepared(row, row->rc);
    } else {
        // Insert into cache
        Json::Value prepared;
        if (!parse_json(row->row, row->nrow, prepared)) {
            lcb_log(LOGARGS(origreq, ERROR), LOGFMT "Invalid JSON returned from PREPARE", LOGID(origreq));
            origreq->fail_prepared(row, LCB_PROTOCOL_ERROR);
            return;
        }

        // Insert plan into cache
        lcb_log(LOGARGS(origreq, DEBUG), LOGFMT "Got prepared statement. Inserting into cache and reissuing", LOGID(origreq));
        const Plan& ent =
                origreq->cache().add_entry(origreq->statement, prepared);

        // Issue the query with the newly prepared plan
        lcb_error_t rc = origreq->apply_plan(ent);
        if (rc != LCB_SUCCESS) {
            origreq->fail_prepared(row, rc);
        }
    }
}

lcb_error_t
N1QLREQ::issue_htreq(const std::string& body)
{
    lcb_CMDHTTP htcmd = { 0 };
    htcmd.body = body.c_str();
    htcmd.nbody = body.size();

    htcmd.content_type = "application/json";
    htcmd.method = LCB_HTTP_METHOD_POST;
    htcmd.type = LCB_HTTP_TYPE_N1QL;
    htcmd.cmdflags = LCB_CMDHTTP_F_STREAM|LCB_CMDHTTP_F_CASTMO;
    htcmd.reqhandle = &htreq;
    htcmd.cas = timeout;

    lcb_error_t rc = lcb_http3(instance, this, &htcmd);
    if (rc == LCB_SUCCESS) {
        lcb_htreq_setcb(htreq, chunk_callback);
    }
    return rc;
}

lcb_error_t
N1QLREQ::request_plan()
{
    Json::Value newbody(Json::objectValue);
    newbody["statement"] = "PREPARE " + statement;
    lcb_CMDN1QL newcmd = { 0 };
    newcmd.callback = prepare_rowcb;
    newcmd.cmdflags = LCB_CMDN1QL_F_JSONQUERY;
    newcmd.handle = &prepare_req;
    newcmd.query = reinterpret_cast<const char*>(&newbody);

    return lcb_n1ql_query(instance, this, &newcmd);
}

lcb_error_t
N1QLREQ::apply_plan(const Plan& plan)
{
    lcb_log(LOGARGS(this, DEBUG), LOGFMT "Using prepared plan", LOGID(this));
    std::string bodystr;
    plan.apply_plan(json, bodystr);
    return issue_htreq(bodystr);
}

lcb_U32
lcb_n1qlreq_parsetmo(const std::string& s)
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

lcb_N1QLREQ::lcb_N1QLREQ(lcb_t obj,
    const void *user_cookie, const lcb_CMDN1QL *cmd)
    : cur_htresp(NULL), htreq(NULL), parser(lcbjsp_create(LCBJSP_MODE_N1QL)),
      cookie(user_cookie), callback(cmd->callback), instance(obj),
      lasterr(LCB_SUCCESS), flags(cmd->cmdflags), timeout(0),
      nrows(0), prepare_req(NULL), was_retried(false)
{
    parser->data = this;
    parser->callback = row_callback;
    if (cmd->handle) {
        *cmd->handle = this;
    }

    if (flags & LCB_CMDN1QL_F_JSONQUERY) {
        json = *reinterpret_cast<const Json::Value*>(cmd->query);
    } else if (!parse_json(cmd->query, cmd->nquery, json)) {
        lasterr = LCB_EINVAL;
        return;
    }

    statement = json["statement"].asString();
    if (statement.empty()) {
        json.removeMember("statement");
    }

    Json::Value& tmoval = json["timeout"];
    if (tmoval.isNull()) {
        // Set the default timeout as the server-side query timeout if no
        // other timeout is used.
        char buf[64] = { 0 };
        sprintf(buf, "%uus", LCBT_SETTING(obj, n1ql_timeout));
        tmoval = buf;
        timeout = LCBT_SETTING(obj, n1ql_timeout);
    } else {
        timeout = lcb_n1qlreq_parsetmo(tmoval.asString());
    }
}

LIBCOUCHBASE_API
lcb_error_t
lcb_n1ql_query(lcb_t instance, const void *cookie, const lcb_CMDN1QL *cmd)
{
    lcb_error_t err;
    N1QLREQ *req = NULL;

    if (cmd->query == NULL || cmd->callback == NULL) {
        return LCB_EINVAL;
    }
    req = new lcb_N1QLREQ(instance, cookie, cmd);
    if (!req) {
        err = LCB_CLIENT_ENOMEM;
        goto GT_DESTROY;
    }
    if ((err = req->lasterr) != LCB_SUCCESS) {
        goto GT_DESTROY;
    }

    if (cmd->cmdflags & LCB_CMDN1QL_F_PREPCACHE) {
        if (req->statement.empty()) {
            err = LCB_EINVAL;
            goto GT_DESTROY;
        }

        const Plan *cached = req->cache().get_entry(req->statement);
        if (cached != NULL) {
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
        *cmd->handle = NULL;
    }

    if (req) {
        req->callback = NULL;
        delete req;
    }
    return err;
}

LIBCOUCHBASE_API
void
lcb_n1ql_cancel(lcb_t instance, lcb_N1QLHANDLE handle)
{
    // Note that this function is just an elaborate way to nullify the
    // callback. We are very particular about _not_ cancelling the underlying
    // http request, because the handle's deletion is controlled
    // from the HTTP callback, which checks if the callback is NULL before
    // deleting.
    // at worst, deferring deletion to the http response might cost a few
    // extra network reads; whereas this function itself is intended as a
    // bailout for unexpected destruction.

    if (handle->prepare_req) {
        lcb_n1ql_cancel(instance, handle->prepare_req);
        handle->prepare_req = NULL;
    }
    handle->callback = NULL;
}
