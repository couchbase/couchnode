/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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
 */
#define NOMINMAX
#include <libcouchbase/ixmgmt.h>
#include <string>
#include <set>
#include <algorithm>

#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"
#include "lcbio/lcbio.h"
#include "lcbio/timer-ng.h"
#include "settings.h"
#include "internal.h"

using std::vector;
using std::string;

static const char *
ixtype_2_str(unsigned ixtype)
{
    if (ixtype == LCB_IXSPEC_T_GSI) {
        return "gsi";
    } else if (ixtype == LCB_IXSPEC_T_VIEW) {
        return "view";
    } else {
        return NULL;
    }
}

struct IndexOpCtx {
    lcb_IXMGMTCALLBACK callback;
    void *cookie;
};

struct ErrorSpec {
    string msg;
    unsigned code;
};

template <typename T> void my_delete(T p) {
    delete p;
}

template <typename T> lcb_error_t
extract_n1ql_errors(const char *s, size_t n, T& err_out)
{
    Json::Value jresp;
    if (!Json::Reader().parse(s, s + n, jresp)) {
        return LCB_PROTOCOL_ERROR;
    }
    if (jresp["status"].asString() == "success") {
        return LCB_SUCCESS;
    }

    Json::Value& errors = jresp["errors"];
    if (errors.isNull()) {
        return LCB_SUCCESS;
    } else if (!errors.isArray()) {
        return LCB_PROTOCOL_ERROR;
    }

    if (errors.empty()) {
        return LCB_SUCCESS;
    }

    for (Json::ArrayIndex ii = 0; ii < errors.size(); ++ii) {
        const Json::Value& err = errors[ii];
        if (!err.isObject()) {
            continue; // expected an object!
        }
        ErrorSpec spec;
        spec.msg = err["msg"].asString();
        spec.code = err["code"].asUInt();
        err_out.insert(err_out.end(), spec);
    }
    return LCB_QUERY_ERROR;
}

static lcb_error_t
get_n1ql_error(const char *s, size_t n)
{
    std::vector<ErrorSpec> dummy;
    return extract_n1ql_errors(s, n, dummy);
}

// Called for generic operations and establishes existence or lack thereof
static void
cb_generic(lcb_t instance, int, const lcb_RESPN1QL *resp)
{
    // Get the real cookie..
    if (!(resp->rflags & LCB_RESP_F_FINAL)) {
        return;
    }

    IndexOpCtx *ctx = reinterpret_cast<IndexOpCtx*>(resp->cookie);
    lcb_RESPIXMGMT w_resp = { 0 };
    w_resp.cookie = ctx->cookie;

    if ((w_resp.rc = resp->rc) == LCB_SUCCESS) {
        // Check if the top-level N1QL response succeeded, and then
        // descend to determine additional errors. This is primarily
        // required to support EEXIST for GSI primary indexes

        vector<ErrorSpec> errors;
        lcb_error_t rc = extract_n1ql_errors(resp->row, resp->nrow, errors);
        if (rc == LCB_ERROR) {
            w_resp.rc = LCB_QUERY_ERROR;
            for (size_t ii = 0; ii < errors.size(); ++ii) {
                const std::string& msg = errors[ii].msg;
                if (msg.find("already exist") != string::npos) {
                    w_resp.rc = LCB_KEY_EEXISTS; // Index entry already exists
                }
            }
        } else {
            w_resp.rc = rc;
        }
    }

    w_resp.inner = resp;
    w_resp.specs = NULL;
    w_resp.nspecs = 0;
    ctx->callback(instance, LCB_CALLBACK_IXMGMT, &w_resp);
    delete ctx;
}

/**
 * Dispatch the actual operation using a N1QL query
 * @param instance
 * @param cookie User cookie
 * @param u_callback User callback (to assign to new context)
 * @param i_callback Internal callback to be invoked when N1QL response
 *        is done
 * @param s N1QL request payload
 * @param n N1QL request length
 * @param obj Internal context. Created with new if NULL
 * @return
 *
 * See other overload for passing just the query string w/o extra parameters
 */
template <typename T> lcb_error_t
dispatch_common(lcb_t instance,
    const void *cookie, lcb_IXMGMTCALLBACK u_callback,
    lcb_N1QLCALLBACK i_callback, const char *s, size_t n, T *obj)
{
    lcb_error_t rc = LCB_SUCCESS;
    bool our_alloc = false;
    lcb_CMDN1QL cmd = { 0 };

    if (obj == NULL) {
        obj = new T();
        our_alloc = true;
    }

    if (!(obj->callback = u_callback)) {
        rc = LCB_EINVAL;
        goto GT_ERROR;
    }

    obj->cookie = const_cast<void*>(cookie);

    cmd.query = s;
    cmd.nquery = n;
    cmd.callback = i_callback;

    rc = lcb_n1ql_query(instance, obj, &cmd);

    GT_ERROR:
    if (rc != LCB_SUCCESS && our_alloc) {
        delete obj;
    }
    return rc;
}

template <typename T> lcb_error_t
dispatch_common(lcb_t instance,
    const void *cookie, lcb_IXMGMTCALLBACK u_callback,
    lcb_N1QLCALLBACK i_callback, const string& ss, T *obj = NULL)
{
    Json::Value root;
    root["statement"] = ss;
    string reqbuf = Json::FastWriter().write(root);
    return dispatch_common<T>(instance,
        cookie, u_callback, i_callback,
        reqbuf.c_str(), reqbuf.size(), obj);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_mkindex(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd)
{
    string ss;
    const lcb_INDEXSPEC& spec = cmd->spec;

    if (!spec.nkeyspace) {
        return LCB_EMPTY_KEY;
    }

    ss = "CREATE";
    if (spec.flags & LCB_IXSPEC_F_PRIMARY) {
        ss += " PRIMARY";
    } else if (!spec.nname) {
        return LCB_EMPTY_KEY;
    }
    ss.append(" INDEX");
    if (spec.nname) {
        ss.append(" `").append(spec.name, spec.nname).append("` ");
    }
    ss.append(" ON `").append(spec.keyspace, spec.nkeyspace).append("`");
    if (! (spec.flags & LCB_IXSPEC_F_PRIMARY)) {
        if (!spec.nfields) {
            return LCB_EMPTY_KEY;
        }
        ss.append(" (").append(spec.fields, spec.nfields).append(")");
    }

    if (spec.ixtype) {
        const char *ixtype = ixtype_2_str(spec.ixtype);
        if (!ixtype) {
            return LCB_EINVAL;
        }
        ss.append(" USING ").append(ixtype);
    }

    if (spec.flags & LCB_IXSPEC_F_DEFER) {
        ss.append(" WITH {\"defer_build\": true}");
    }


    return dispatch_common<IndexOpCtx>(instance, cookie, cmd->callback, cb_generic, ss);
}

// Class to back the storage for the actual lcb_IXSPEC without doing too much
// mind-numbing buffer copies. Maybe this can be done via a macro instead?
class IndexSpec : public lcb_INDEXSPEC {
public:
    IndexSpec(const char *s, size_t n) {
        load_json(s, n);
    }
    inline IndexSpec(const lcb_INDEXSPEC *spec);
    static inline void to_key(const lcb_INDEXSPEC *spec, std::string& out);

private:
    IndexSpec(const IndexSpec&);
    inline void load_json(const char *s, size_t n);
    inline size_t load_fields(const Json::Value& root, bool do_copy);

    // Load field from a JSON object
    inline size_t load_field(
        const Json::Value& root,
        const char *name, const char **tgt_ptr, size_t *tgt_len, bool do_copy);

    // Load field from another pointer
    void load_field(const char **dest, const char *src, size_t n) {
        buf.append(src, n);
        if (n) {
            *dest = &buf.c_str()[buf.size()-n];
        } else {
            *dest = NULL;
        }
    }

    string buf;
};

class ListIndexCtx : public IndexOpCtx {
public:
    vector<IndexSpec*> specs;

    virtual void invoke(lcb_t instance, lcb_RESPIXMGMT *resp) {
        finish(instance, resp);
    }

    void finish(lcb_t instance, lcb_RESPIXMGMT *resp = NULL) {
        lcb_RESPIXMGMT w_resp = { 0 };
        if (resp == NULL) {
            resp = &w_resp;
            resp->rc = LCB_SUCCESS;
        }
        resp->cookie = cookie;
        lcb_INDEXSPEC **speclist = reinterpret_cast<lcb_INDEXSPEC**>(&specs[0]);
        resp->specs = speclist;
        resp->nspecs = specs.size();
        callback(instance, LCB_CALLBACK_IXMGMT, resp);
        delete this;
    }

    virtual ~ListIndexCtx() {
        for (size_t ii = 0; ii < specs.size(); ++ii) {
            delete specs[ii];
        }
        specs.clear();
    }
};

static void
cb_index_list(lcb_t instance, int, const lcb_RESPN1QL *resp)
{
    ListIndexCtx *ctx = reinterpret_cast<ListIndexCtx *>(resp->cookie);
    if (!(resp->rflags & LCB_RESP_F_FINAL)) {
        ctx->specs.push_back(new IndexSpec(resp->row, resp->nrow));
        return;
    }

    lcb_RESPIXMGMT w_resp = { 0 };
    if ((w_resp.rc = resp->rc) == LCB_SUCCESS) {
        w_resp.rc = get_n1ql_error(resp->row, resp->nrow);
    }
    w_resp.inner = resp;
    ctx->invoke(instance, &w_resp);
}

static lcb_error_t
do_index_list(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd,
    ListIndexCtx *ctx)
{
    string ss;
    const lcb_INDEXSPEC& spec = cmd->spec;
    ss = "SELECT idx.* FROM system:indexes idx WHERE";

    if (spec.flags & LCB_IXSPEC_F_PRIMARY) {
        ss.append(" is_primary=true AND");
    }
    if (spec.nkeyspace) {
        ss.append(" keyspace_id=\"").append(spec.keyspace, spec.nkeyspace).append("\" AND");
    }
    if (spec.nnspace) {
        ss.append(" namespace_id=\"").append(spec.nspace, spec.nnspace).append("\" AND");
    }
    if (spec.ixtype) {
        const char *s_ixtype = ixtype_2_str(spec.ixtype);
        if (s_ixtype == NULL) {
            if (ctx != NULL) {
                delete ctx;
            }
            return LCB_EINVAL;
        }
        ss.append(" using=\"").append(s_ixtype).append("\" AND");
    }
    if (spec.nname) {
        ss.append(" name=\"").append(spec.name, spec.nname).append("\" AND");
    }

    // WHERE <.....> true
    ss.append(" true");
    ss.append(" ORDER BY is_primary DESC, name ASC");

    return dispatch_common<ListIndexCtx>(instance,
        cookie, cmd->callback, cb_index_list, ss, ctx);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_list(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd)
{
    return do_index_list(instance, cookie, cmd, NULL);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_rmindex(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd)
{
    string ss;
    const lcb_INDEXSPEC& spec = cmd->spec;
    if (!spec.nkeyspace) {
        return LCB_EMPTY_KEY;
    }
    if (spec.flags & LCB_IXSPEC_F_PRIMARY) {
        ss = "DROP PRIMARY INDEX ON";
        ss.append(" `").append(spec.keyspace, spec.nkeyspace).append("`");
    } else {
        if (!spec.nname) {
            return LCB_EMPTY_KEY;
        }
        ss = "DROP INDEX";
        ss.append(" `").append(spec.keyspace, spec.nkeyspace).append("`");
        ss.append(".`").append(spec.name, spec.nname).append("`");
    }

    if (spec.ixtype) {
        const char *stype = ixtype_2_str(spec.ixtype);
        if (!stype) {
            return LCB_EINVAL;
        }
        ss.append(" USING ").append(stype);
    }

    return dispatch_common<IndexOpCtx>(instance, cookie, cmd->callback, cb_generic, ss);
}

class ListIndexCtx_BuildIndex : public ListIndexCtx {
public:
    virtual inline void invoke(lcb_t instance, lcb_RESPIXMGMT *resp);
    inline lcb_error_t try_build(lcb_t instance);
};

static void
cb_build_submitted(lcb_t instance, int, const lcb_RESPN1QL *resp)
{
    ListIndexCtx *ctx = reinterpret_cast<ListIndexCtx*>(resp->cookie);

    if (resp->rflags & LCB_RESP_F_FINAL) {
        lcb_RESPIXMGMT w_resp = { 0 };
        if ((w_resp.rc = resp->rc) == LCB_SUCCESS) {
            w_resp.rc = get_n1ql_error(resp->row, resp->nrow);
        }
        ctx->finish(instance, &w_resp);
    }
}

lcb_error_t
ListIndexCtx_BuildIndex::try_build(lcb_t instance)
{
    vector<IndexSpec*> pending;
    for (size_t ii = 0; ii < specs.size(); ++ii) {
        IndexSpec* spec = specs[ii];
        if (strncmp(spec->state, "pending", spec->nstate) == 0 ||
                strncmp(spec->state, "deferred", spec->nstate) == 0) {
            pending.push_back(spec);
        }
    }

    if (pending.empty()) {
        return LCB_KEY_ENOENT;
    }

    string ss;
    ss = "BUILD INDEX ON `";

    ss.append(pending[0]->keyspace, pending[0]->nkeyspace).append("`");
    ss += '(';
    for (size_t ii = 0; ii < pending.size(); ++ii) {
        ss += '`';
        ss.append(pending[ii]->name, pending[ii]->nname);
        ss += '`';
        if (ii+1 < pending.size()) {
            ss += ',';
        }
    }
    ss += ')';

    lcb_error_t rc = dispatch_common<ListIndexCtx_BuildIndex>(
        instance, cookie, callback, cb_build_submitted, ss,
        this);

    if (rc == LCB_SUCCESS) {
        std::set<IndexSpec*> to_remove(specs.begin(), specs.end());
        for (size_t ii = 0; ii < pending.size(); ++ii) {
            to_remove.erase(pending[ii]);
        }

        std::for_each(to_remove.begin(), to_remove.end(), my_delete<IndexSpec*>);

        specs = pending;
    }
    return rc;
}

void
ListIndexCtx_BuildIndex::invoke(lcb_t instance, lcb_RESPIXMGMT *resp)
{
    if (resp->rc == LCB_SUCCESS &&
            (resp->rc = try_build(instance)) == LCB_SUCCESS) {
        return;
    }
    finish(instance, resp);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_build_begin(lcb_t instance, const void *cookie, const lcb_CMDIXMGMT *cmd)
{
    ListIndexCtx_BuildIndex *ctx = new ListIndexCtx_BuildIndex();
    lcb_error_t rc = do_index_list(instance, cookie, cmd, ctx);
    if (rc != LCB_SUCCESS) {
        delete ctx;
    }
    return rc;
}

struct WatchIndexCtx : public IndexOpCtx {
    // Interval timer
    lcbio_pTIMER m_timer;
    uint32_t m_interval;
    uint64_t m_tsend;
    lcb_t m_instance;
    std::map<std::string,IndexSpec*> m_defspend;
    std::vector<IndexSpec*> m_defsok;

    inline void read_state(const lcb_RESPIXMGMT *resp);
    inline void reschedule();
    inline lcb_error_t do_poll();
    inline lcb_error_t load_defs(const lcb_CMDIXWATCH *);
    inline WatchIndexCtx(lcb_t, const void *, const lcb_CMDIXWATCH*);
    inline ~WatchIndexCtx();
    inline void finish(lcb_error_t rc, const lcb_RESPIXMGMT *);
};

static void
cb_watchix_tm(void *arg)
{
    WatchIndexCtx *ctx = reinterpret_cast<WatchIndexCtx*>(arg);
    uint64_t now = lcb_nstime();
    if (now >= ctx->m_tsend) {
        ctx->finish(LCB_ETIMEDOUT, NULL);
    } else {
        ctx->do_poll();
    }
}

#define DEFAULT_WATCH_TIMEOUT LCB_S2US(30)
#define DEFAULT_WATCH_INTERVAL LCB_MS2US(500)

WatchIndexCtx::WatchIndexCtx(lcb_t instance, const void *cookie_, const lcb_CMDIXWATCH *cmd)
: m_instance(instance)
{
    uint64_t now = lcb_nstime();
    uint32_t timeout = cmd->timeout ? cmd->timeout : DEFAULT_WATCH_TIMEOUT;
    m_interval = cmd->interval ? cmd->interval : DEFAULT_WATCH_INTERVAL;
    m_interval = std::min(m_interval, timeout);
    m_tsend = now + LCB_US2NS(timeout);

    this->callback = cmd->callback;
    this->cookie = const_cast<void*>(cookie_);

    m_timer = lcbio_timer_new(instance->iotable, this, cb_watchix_tm);
    lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
}

WatchIndexCtx::~WatchIndexCtx()
{
    lcb_aspend_del(&m_instance->pendops, LCB_PENDTYPE_COUNTER, NULL);
    if (m_timer) {
        lcbio_timer_destroy(m_timer);
    }
    if (m_instance) {
        lcb_maybe_breakout(m_instance);
    }

    std::for_each(m_defsok.begin(), m_defsok.end(), my_delete<IndexSpec*>);
    for (std::map<string,IndexSpec*>::iterator ii = m_defspend.begin();
            ii != m_defspend.end(); ++ii) {
        delete ii->second;
    }
}

void
IndexSpec::to_key(const lcb_INDEXSPEC* spec, std::string& s)
{
    // Identity is:
    // {keyspace,name,is_primary,type}
    s.append(spec->nspace, spec->nnspace).append(" ");
    s.append(spec->keyspace, spec->nkeyspace).append(" ");
    s.append(spec->name, spec->nname).append(" ");
    s.append(spec->flags & LCB_IXSPEC_F_PRIMARY ? "P" : "S").append(" ");
    const char *type_s = ixtype_2_str(spec->ixtype);
    if (!type_s) {
        type_s = "<UNKNOWN>";
    }
    s.append(type_s);
}

void
WatchIndexCtx::read_state(const lcb_RESPIXMGMT *resp)
{
    // We examine the indexes here to see which ones have been completed
    // Make them all into an std::map
    if (resp->rc != LCB_SUCCESS) {
        reschedule();
        return;
    }

    std::map<std::string, const lcb_INDEXSPEC*> in_specs;
    for (size_t ii = 0; ii < resp->nspecs; ++ii) {
        std::string key;
        IndexSpec::to_key(resp->specs[ii], key);
        in_specs[key] = resp->specs[ii];
    }

    std::map<std::string, IndexSpec*>::iterator it_remain = m_defspend.begin();

    while (it_remain != m_defspend.end()) {
        // See if the index is 'online' yet!
        std::map<std::string,const lcb_INDEXSPEC*>::iterator res;
        res = in_specs.find(it_remain->first);
        if (res == in_specs.end()) {
            continue;
        }
        std::string s_state(res->second->state, res->second->nstate);
        if (s_state == "online") {
            m_defsok.push_back(it_remain->second);
            m_defspend.erase(it_remain++);
        } else {
            ++it_remain;
        }
    }
    if (m_defspend.empty()) {
        finish(LCB_SUCCESS, resp);
    } else {
        reschedule();
    }
}

lcb_error_t
WatchIndexCtx::load_defs(const lcb_CMDIXWATCH *cmd)
{
    for (size_t ii = 0; ii < cmd->nspec; ++ii) {
        std::string key;
        IndexSpec::to_key(cmd->specs[ii], key);
        m_defspend[key] = new IndexSpec(cmd->specs[ii]);
    }
    if (m_defspend.empty()) {
        return LCB_ENO_COMMANDS;
    }
    return LCB_SUCCESS;
}

void
WatchIndexCtx::finish(lcb_error_t rc, const lcb_RESPIXMGMT *resp)
{
    lcb_RESPIXMGMT my_resp = { 0 };
    my_resp.cookie = cookie;
    my_resp.rc = rc;

    if (resp) {
        my_resp.inner = resp->inner;
    }

    lcb_INDEXSPEC **speclist = reinterpret_cast<lcb_INDEXSPEC**>(&m_defsok[0]);
    my_resp.specs = speclist;
    my_resp.nspecs = m_defsok.size();
    callback(m_instance, LCB_CALLBACK_IXMGMT, &my_resp);
    delete this;
}

void
WatchIndexCtx::reschedule()
{
    // Next interval!
    uint64_t now = lcb_nstime();
    if (now + LCB_US2NS(m_interval) >= m_tsend) {
        finish(LCB_ETIMEDOUT, NULL);
    } else {
        lcbio_timer_rearm(m_timer, m_interval);
    }
}

static void
cb_watch_gotlist(lcb_t, int, const lcb_RESPIXMGMT *resp)
{
    WatchIndexCtx *ctx = reinterpret_cast<WatchIndexCtx*>(resp->cookie);
    ctx->read_state(resp);
}

lcb_error_t
WatchIndexCtx::do_poll()
{
    lcb_CMDIXMGMT cmd;
    memset(&cmd, 0, sizeof cmd);
    cmd.callback = cb_watch_gotlist;
    return lcb_ixmgmt_list(m_instance, this, &cmd);
}

LIBCOUCHBASE_API
lcb_error_t
lcb_ixmgmt_build_watch(lcb_t instance, const void *cookie, const lcb_CMDIXWATCH *cmd)
{
    WatchIndexCtx *ctx = new WatchIndexCtx(instance, cookie, cmd);
    lcb_error_t rc;
    if ((rc = ctx->load_defs(cmd)) != LCB_SUCCESS) {
        delete ctx;
        return rc;
    }
    if ((rc = ctx->do_poll()) != LCB_SUCCESS) {
        delete ctx;
        return rc;
    }
    return LCB_SUCCESS;
}

void
IndexSpec::load_json(const char *s, size_t n) {
    Json::Reader rr;
    Json::Value root;
    memset(static_cast<lcb_INDEXSPEC*>(this), 0, sizeof (lcb_INDEXSPEC));

    if (!rr.parse(s, s + n, root)) {
        buf.assign(s, n);
        rawjson = buf.c_str();
        nrawjson = buf.size();
        return;
    }

    size_t to_reserve = n;
    to_reserve += load_fields(root, false);
    buf.reserve(to_reserve);
    buf.append(s, n);
    load_fields(root, true);

    // Get the index type
    string ixtype_s = root["using"].asString();
    if (ixtype_s == "gsi") {
        ixtype = LCB_IXSPEC_T_GSI;
    } else if (ixtype_s == "view") {
        ixtype = LCB_IXSPEC_T_VIEW;
    }
    if (root["is_primary"].asBool()) {
        flags |= LCB_IXSPEC_F_PRIMARY;
    }
}

// IndexSpec stuff
IndexSpec::IndexSpec(const lcb_INDEXSPEC *spec)
{
    if (spec->nrawjson) {
        load_json(spec->rawjson, spec->nrawjson);
    }
    *static_cast<lcb_INDEXSPEC*>(this) = *spec;
    // Initialize the bufs
    buf.reserve(nname + nkeyspace + nnspace + nstate + nfields + nrawjson + nstate);
    load_field(&rawjson, spec->rawjson, nrawjson);
    load_field(&name, spec->name, nname);
    load_field(&keyspace, spec->keyspace, nkeyspace);
    load_field(&nspace, spec->nspace, nnspace);
    load_field(&state, spec->state, nstate);
    load_field(&fields, spec->fields, nfields);
}

size_t
IndexSpec::load_fields(const Json::Value& root, bool do_copy)
{
    size_t size = 0;
    size += load_field(root, "name", &name, &nname, do_copy);
    size += load_field(root, "keyspace_id", &keyspace, &nkeyspace, do_copy);
    size += load_field(root, "namespace_id", &nspace, &nnspace, do_copy);
    size += load_field(root, "state", &state, &nstate, do_copy);
    size += load_field(root, "index_key", &fields, &nfields, do_copy);
    return size;
}

size_t
IndexSpec::load_field(const Json::Value& root,
    const char *name_, const char **tgt_ptr, size_t *tgt_len, bool do_copy)
{
    size_t namelen = strlen(name_);
    const Json::Value *val = root.find(name_, name_ + namelen);
    const char *s_begin, *s_end;
    size_t n = 0;
    if (val != NULL &&
            val->getString(&s_begin, &s_end) &&
            (n = s_end - s_begin) &&
            do_copy) {

        buf.insert(buf.end(), s_begin, s_end);
        *tgt_len = n;
        // Assign the pointer correctly:
        *tgt_ptr = &(buf.c_str()[buf.size()-n]);
    }
    return n;
}
