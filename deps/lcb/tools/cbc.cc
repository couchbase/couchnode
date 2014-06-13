#include "common/my_inttypes.h"
#include <map>
#include <sstream>
#include <iostream>
#include <fstream>
#include <libcouchbase/vbucket.h>
#include <stddef.h>
#include "common/options.h"
#include "common/histogram.h"
#include "cbc-handlers.h"
#include "dsn.h"
using namespace cbc;

using std::string;
using std::map;
using std::vector;
using std::stringstream;

template <typename T>
string getRespKey(const T* resp)
{
    return string((const char*)resp->v.v0.key, resp->v.v0.nkey);
}

static void
printKeyError(string& key, lcb_error_t err)
{
    fprintf(stderr, "%-20s %s (0x%x)\n", key.c_str(), lcb_strerror(NULL, err), err);
}

template <typename T> void
printKeyCasStatus(string& key, const T* resp, const char *message = NULL)
{
    fprintf(stderr, "%-20s", key.c_str());
    if (message != NULL) {
        fprintf(stderr, "%s ", message);
    }
    fprintf(stderr, "CAS=0x%"PRIx64"\n", resp->v.v0.cas);
}

extern "C" {
static void
get_callback(lcb_t, const void *, lcb_error_t err, const lcb_get_resp_t *resp)
{
    string key = getRespKey(resp);
    if (err == LCB_SUCCESS) {
        fprintf(stderr, "%-20s CAS=0x%"PRIx64", Flags=0x%x, Datatype=0x%x\n",
            key.c_str(), resp->v.v0.cas, resp->v.v0.flags, resp->v.v0.datatype);
        fwrite(resp->v.v0.bytes, 1, resp->v.v0.nbytes, stdout);
        fprintf(stderr, "\n");
    } else {
        printKeyError(key, err);
    }
}
static void
store_callback(lcb_t, const void *cookie,
    lcb_storage_t, lcb_error_t err, const lcb_store_resp_t *resp)
{
    string key = getRespKey(resp);
    if (err == LCB_SUCCESS) {
        printKeyCasStatus(key, resp, "Stored.");
        if (cookie != NULL) {
            map<string,lcb_cas_t>& items = *(map<string,lcb_cas_t>*)cookie;
            items[key] = resp->v.v0.cas;
        }
    } else {
        printKeyError(key, err);
    }
}
static void
durability_callback(lcb_t, const void*, lcb_error_t err, const lcb_durability_resp_t *resp)
{
    string key = getRespKey(resp);
    if (err == LCB_SUCCESS) {
        err = resp->v.v0.err;
    }
    if (err == LCB_SUCCESS) {
        printKeyCasStatus(key, resp, "Persisted/Replicated.");
    } else {
        printKeyError(key, err);
    }
}
static void
observe_callback(lcb_t, const void*,  lcb_error_t err, const lcb_observe_resp_t *resp)
{
    if (resp->v.v0.nkey == 0) {
        return;
    }

    string key = getRespKey(resp);
    if (err == LCB_SUCCESS) {
        fprintf(stderr,
            "%-20s [%s] Status=0x%x, CAS=0x%"PRIx64"\n", key.c_str(),
            resp->v.v0.from_master ? "Master" : "Replica",
                    resp->v.v0.status, resp->v.v0.cas);
    } else {
        printKeyError(key, err);
    }
}
static void
unlock_callback(lcb_t, const void*, lcb_error_t err, const lcb_unlock_resp_t *resp)
{
    string key = getRespKey(resp);
    if (err != LCB_SUCCESS) {
        printKeyError(key, err);
    } else {
        fprintf(stderr, "%-20s Unlocked\n", key.c_str());
    }
}
static void
remove_callback(lcb_t, const void*, lcb_error_t err, const lcb_remove_resp_t *resp)
{
    string key = getRespKey(resp);
    if (err != LCB_SUCCESS) {
        printKeyError(key, err);
    } else {
        printKeyCasStatus(key, resp, "Removed.");
    }
}
static void
stats_callback(lcb_t, const void *, lcb_error_t err, const lcb_server_stat_resp_t *resp)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "Got error %s (%d) in stats\n", lcb_strerror(NULL, err), err);
        return;
    }
    if (resp->v.v0.server_endpoint == NULL || resp->v.v0.key == NULL) {
        return;
    }

    string server = resp->v.v0.server_endpoint;
    string key = getRespKey(resp);
    string value;
    if (resp->v.v0.nbytes > 0) {
        value.assign((const char *)resp->v.v0.bytes, resp->v.v0.nbytes);
    }
    fprintf(stderr, "%s\t%s", server.c_str(), key.c_str());
    if (!value.empty()) {
        fprintf(stderr, "\t%s", value.c_str());
    }
    fprintf(stderr, "\n");
}
static void
verbosity_callback(lcb_t,const void*, lcb_error_t err, const lcb_verbosity_resp_st *resp)
{
    if (err != LCB_SUCCESS && resp->v.v0.server_endpoint) {
        fprintf(stderr, "Failed to set verbosity for %s\n", resp->v.v0.server_endpoint);
    }
}
static void
arithmetic_callback(lcb_t, const void*, lcb_error_t err, const lcb_arithmetic_resp_t *resp)
{
    string key = getRespKey(resp);
    if (err != LCB_SUCCESS) {
        printKeyError(key, err);
    } else {
        char buf[4096] = { 0 };
        sprintf(buf, "Current value is %"PRIu64".", resp->v.v0.value);
        printKeyCasStatus(key, resp, buf);
    }
}
static void
http_chunk_callback(lcb_http_request_t, lcb_t, const void *cookie,
    lcb_error_t err, const lcb_http_resp_t *resp)
{
    HttpReceiver *ctx = (HttpReceiver *)cookie;
    ctx->maybeInvokeStatus(err, resp);
    if (resp->v.v0.nbytes) {
        ctx->onChunk((const char*)resp->v.v0.bytes, resp->v.v0.nbytes);
    }
}
static void
http_done_callback(lcb_http_request_t, lcb_t, const void *cookie,
    lcb_error_t err, const lcb_http_resp_t *resp) {
    HttpReceiver *ctx = (HttpReceiver *)cookie;
    ctx->maybeInvokeStatus(err, resp);
    ctx->onDone();
}
}


Handler::Handler(const char *name) : parser(name), instance(NULL)
{
    if (name != NULL) {
        cmdname = name;
    }
}

Handler::~Handler()
{
    if (instance) {
        lcb_destroy(instance);
    }
}

void
Handler::execute(int argc, char **argv)
{
    addOptions();
    parser.parse(argc, argv, true);
    run();
    if (instance != NULL && params.useTimings()) {
        fprintf(stderr, "Output command timings as requested (--timings)\n");
        hg.write();
    }
}

void
Handler::addOptions()
{
    params.addToParser(parser);
}

void
Handler::run()
{
    lcb_create_st cropts;
    memset(&cropts, 0, sizeof cropts);
    params.fillCropts(cropts);
    lcb_error_t err;
    err = lcb_create(&instance, &cropts);
    if (err != LCB_SUCCESS) {
        throw err;
    }
    params.doCtls(instance);
    err = lcb_connect(instance);
    if (err != LCB_SUCCESS) {
        throw err;
    }
    lcb_wait(instance);
    err = lcb_get_bootstrap_status(instance);
    if (err != LCB_SUCCESS) {
        throw err;
    }

    if (params.useTimings()) {
        hg.install(instance, stdout);
    }
}

const string&
Handler::getRequiredArg()
{
    const vector<string>& args = parser.getRestArgs();
    if (args.empty() || args.size() != 1) {
        throw "Command requires single argument";
    }
    return args[0];
}

void
GetHandler::addOptions()
{
    Handler::addOptions();
    o_exptime.abbrev('e');
    if (isLock()) {
        o_exptime.description("Time the lock should be held for");
    } else {
        o_exptime.description("Update the expiration time for the item");
        o_replica.abbrev('r');
        o_replica.description("Read from replica. Possible values are 'first': read from first available replica. 'all': read from all replicas, and <N>, where 0 < N < nreplicas");
        parser.addOption(o_replica);
    }
    parser.addOption(o_exptime);
}

void
GetHandler::run()
{
    Handler::run();
    lcb_set_get_callback(instance, get_callback);
    const vector<string>& keys = parser.getRestArgs();
    lcb_error_t err;

    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ++ii) {
        lcb_CMDGET cmd = { 0 };
        const string& key = keys[ii];
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        if (o_exptime.passed()) {
            cmd.options.exptime = o_exptime.result();
        }
        if (isLock()) {
            cmd.lock = 1;
        }

        err = lcb_get3(instance, this, &cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

static void
endureItems(lcb_t instance, const map<string,lcb_cas_t> items,
    size_t persist_to, size_t replicate_to)
{
    lcb_set_durability_callback(instance, durability_callback);
    lcb_durability_opts_t options = { 0 };
    vector<lcb_durability_cmd_t> cmds;
    vector<const lcb_durability_cmd_t *> cmdlist;
    options.v.v0.persist_to = persist_to;
    options.v.v0.replicate_to = replicate_to;
    lcb_error_t err;

    map<string,lcb_cas_t>::const_iterator iter;
    for (iter = items.begin(); iter != items.end(); ++iter) {
        lcb_durability_cmd_t cmd = { 0 };
        cmd.v.v0.key = iter->first.c_str();
        cmd.v.v0.nkey = iter->first.size();
        cmd.v.v0.cas = iter->second;
        cmds.push_back(cmd);
    }

    for (size_t ii = 0; ii < cmds.size(); ++ii) {
        cmdlist.push_back(&cmds[ii]);
    }
    err = lcb_durability_poll(instance, NULL, &options, cmds.size(), &cmdlist[0]);
    if (err != LCB_SUCCESS) {
        throw err;
    }
    lcb_wait(instance);
}

void
SetHandler::addOptions()
{
    Handler::addOptions();
    parser.addOption(o_flags);
    parser.addOption(o_exp);
    parser.addOption(o_add);
    parser.addOption(o_persist);
    parser.addOption(o_replicate);
    if (!hasFileList()) {
        parser.addOption(o_value);
    }
    parser.addOption(o_json);
}

void
SetHandler::storeItem(const string& key, const char *value, size_t nvalue)
{
    lcb_error_t err;
    lcb_CMDSTORE cmd = { 0 };
    LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
    cmd.value.vtype = LCB_KV_COPY;
    cmd.value.u_buf.contig.bytes = value;
    cmd.value.u_buf.contig.nbytes = nvalue;

    if (o_json.result()) {
        cmd.datatype = LCB_VALUE_F_JSON;
    }
    if (o_exp.passed()) {
        cmd.options.exptime = o_exp.result();
    }
    if (o_flags.passed()) {
        cmd.flags = o_flags.result();
    }
    if (o_add.passed() && o_add.result()) {
        cmd.operation = LCB_ADD;
    } else {
        cmd.operation = LCB_SET;
    }
    err = lcb_store3(instance, &items, &cmd);
    if (err != LCB_SUCCESS) {
        throw err;
    }
}

void
SetHandler::storeItem(const string& key, FILE *input)
{
    char tmpbuf[4096];
    vector<char> vbuf;
    size_t nr;
    while ((nr = fread(tmpbuf, 1, sizeof tmpbuf, input))) {
        vbuf.insert(vbuf.end(), tmpbuf, &tmpbuf[nr]);
    }
    storeItem(key, &vbuf[0], vbuf.size());
}

void
SetHandler::run()
{
    Handler::run();
    lcb_set_store_callback(instance, store_callback);
    const vector<string>& keys = parser.getRestArgs();

    lcb_sched_enter(instance);

    if (hasFileList()) {
        for (size_t ii = 0; ii < keys.size(); ii++) {
            const string& key = keys[ii];
            FILE *fp = fopen(key.c_str(), "rb");
            if (fp == NULL) {
                perror(key.c_str());
                continue;
            }
            storeItem(key, fp);
            fclose(fp);
        }
    } else if (keys.size() > 1 || keys.empty()) {
        throw "create must be passed a single key";
    } else {
        const string& key = keys[0];
        if (o_value.passed()) {
            const string& value = o_value.const_result();
            storeItem(key, value.c_str(), value.size());
        } else {
            storeItem(key, stdin);
        }
    }

    lcb_sched_leave(instance);
    lcb_wait(instance);
    if (items.empty() == false && (o_persist.passed() || o_replicate.passed())) {
        endureItems(instance, items, o_persist.result(), o_replicate.result());
    }
}

void
HashHandler::run()
{
    Handler::run();

    lcbvb_CONFIG *vbc;
    lcb_error_t err;
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (err != LCB_SUCCESS) {
        throw err;
    }

    const vector<string>& args = parser.getRestArgs();
    for (size_t ii = 0; ii < args.size(); ii++) {
        const string& key = args[ii];
        const void *vkey = (const void *)key.c_str();
        int vbid, srvix;
        lcbvb_map_key(vbc, vkey, key.size(), &vbid, &srvix);
        fprintf(stderr, "%s: [vBucket=%d, Index=%d]", key.c_str(), vbid, srvix);
        if (srvix != -1) {
            fprintf(stderr, " Server: %s", vbucket_config_get_server(vbc, srvix));
            const char *vapi = vbucket_config_get_couch_api_base(vbc, srvix);
            if (vapi) {
                fprintf(stderr, ", CouchAPI: %s", vapi);
            }
        }
        fprintf(stderr, "\n");
    }
}

void
ObserveHandler::run()
{
    Handler::run();
    lcb_set_observe_callback(instance, observe_callback);
    const vector<string>& keys = parser.getRestArgs();
    vector<lcb_observe_cmd_t> cmds;
    vector<const lcb_observe_cmd_t*> cmdlist;
    for (size_t ii = 0; ii < keys.size(); ii++) {
        lcb_observe_cmd_t cmd;
        memset(&cmd, 0, sizeof cmd);
        cmd.v.v0.key = (const void *)keys[ii].c_str();
        cmd.v.v0.nkey = keys[ii].size();
        cmds.push_back(cmd);
    }
    for (size_t ii = 0; ii < cmds.size(); ii++) {
        cmdlist.push_back(&cmds[ii]);
    }
    lcb_error_t err;
    err = lcb_observe(instance, NULL, cmds.size(), &cmdlist[0]);
    if (err != LCB_SUCCESS) {
        throw err;
    }
    lcb_wait(instance);
}

void
UnlockHandler::run()
{
    Handler::run();
    lcb_set_unlock_callback(instance, unlock_callback);
    const vector<string>& args = parser.getRestArgs();

    if (args.size() % 2) {
        throw "Expect key-cas pairs. Argument list must be even";
    }

    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < args.size(); ii += 2) {
        const string& key = args[ii];
        lcb_CAS cas;
        int rv;
        rv = sscanf(args[ii+1].c_str(), "0x%"PRIx64, &cas);
        if (rv != 1) {
            throw "CAS must be formatted as a hex string beginning with '0x'";
        }

        lcb_CMDUNLOCK cmd;
        memset(&cmd, 0, sizeof cmd);
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        cmd.options.cas = cas;
        lcb_error_t err = lcb_unlock3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

static const char *
iops_to_string(lcb_io_ops_type_t type)
{
    switch (type) {
    case LCB_IO_OPS_LIBEV: return "libev";
    case LCB_IO_OPS_LIBEVENT: return "libevent";
    case LCB_IO_OPS_LIBUV: return "libuv";
    case LCB_IO_OPS_SELECT: return "select";
    case LCB_IO_OPS_WINIOCP: return "iocp";
    case LCB_IO_OPS_INVALID: return "user-defined";
    default: return "invalid";
    }
}

void
VersionHandler::run()
{
    const char *changeset;
    lcb_error_t err;
    err = lcb_cntl(NULL, LCB_CNTL_GET, LCB_CNTL_CHANGESET, (void*)&changeset);
    if (err != LCB_SUCCESS) {
        changeset = "UNKNOWN";
    }
    fprintf(stderr, "cbc:\n");
    fprintf(stderr, "  Runtime: Version=%s, Changeset=%s\n",
        lcb_get_version(NULL), changeset);
    fprintf(stderr, "  Headers: Version=%s, Changeset=%s\n",
        LCB_VERSION_STRING, LCB_VERSION_CHANGESET);

    struct lcb_cntl_iops_info_st info;
    memset(&info, 0, sizeof info);
    err = lcb_cntl(NULL, LCB_CNTL_GET, LCB_CNTL_IOPS_DEFAULT_TYPES, &info);
    if (err == LCB_SUCCESS) {
        fprintf(stderr, "  IO: Default=%s, Current=%s\n",
            iops_to_string(info.v.v0.os_default), iops_to_string(info.v.v0.effective));
    }
    printf("  Compression (snappy): .. %s\n",
            lcb_supports_feature(LCB_SUPPORTS_SNAPPY) ? "SUPPORTED" : "NOT SUPPORTED");
    printf("  SSL: .. %s\n",
            lcb_supports_feature(LCB_SUPPORTS_SSL) ? "SUPPORTED" : "NOT SUPPORTED");
}

void
RemoveHandler::run()
{
    Handler::run();
    const vector<string> &keys = parser.getRestArgs();
    lcb_sched_enter(instance);
    lcb_set_remove_callback(instance, remove_callback);
    for (size_t ii = 0; ii < keys.size(); ++ii) {
        lcb_CMDREMOVE cmd;
        const string& key = keys[ii];
        memset(&cmd, 0, sizeof cmd);
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        lcb_error_t err = lcb_remove3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
StatsHandler::run()
{
    Handler::run();
    lcb_set_stat_callback(instance, stats_callback);
    vector<string> keys = parser.getRestArgs();
    if (keys.empty()) {
        keys.push_back("");
    }
    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ii++) {
        lcb_CMDSTATS cmd = { 0 };
        const string& key = keys[ii];
        if (!key.empty()) {
            LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        }
        lcb_error_t err = lcb_stats3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
VerbosityHandler::run()
{
    const string& slevel = getRequiredArg();
    lcb_verbosity_level_t level;
    if (slevel == "detail") {
        level = LCB_VERBOSITY_DETAIL;
    } else if (slevel == "debug") {
        level = LCB_VERBOSITY_DEBUG;
    } else if (slevel == "info") {
        level = LCB_VERBOSITY_INFO;
    } else if (slevel == "warning") {
        level = LCB_VERBOSITY_WARNING;
    } else {
        throw "Verbosity level must be {detail,debug,info,warning}";
    }

    lcb_set_verbosity_callback(instance, verbosity_callback);
    lcb_CMDVERBOSITY cmd = { 0 };
    cmd.level = level;
    lcb_error_t err;
    lcb_sched_enter(instance);
    err = lcb_server_verbosity3(instance, NULL, &cmd);
    if (err != LCB_SUCCESS) {
        throw err;
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
ArithmeticHandler::run()
{
    Handler::run();

    const vector<string>& keys = parser.getRestArgs();
    lcb_set_arithmetic_callback(instance, arithmetic_callback);
    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ++ii) {
        const string& key = keys[ii];
        lcb_CMDINCRDECR cmd = { 0 };
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        if (o_initial.passed()) {
            cmd.create = 1;
            cmd.initial = o_initial.result();
        }
        cmd.delta = getDelta();
        cmd.options.exptime = o_expiry.result();
        lcb_error_t err = lcb_arithmetic3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
HttpReceiver::install(lcb_t instance)
{
    lcb_set_http_data_callback(instance, http_chunk_callback);
    lcb_set_http_complete_callback(instance, http_done_callback);
}

void
HttpReceiver::maybeInvokeStatus(lcb_error_t err, const lcb_http_resp_t *resp)
{
    if (statusInvoked) {
        return;
    }

    statusInvoked = true;
    if (resp->v.v0.headers) {
        for (const char * const *cur = resp->v.v0.headers; *cur; cur += 2) {
            string key = cur[0];
            string value = cur[1];
            headers[key] = value;
        }
    }
    handleStatus(err, resp->v.v0.status);
}

void
HttpBaseHandler::run()
{
    Handler::run();
    install(instance);
    lcb_http_cmd_st cmd;
    memset(&cmd, 0, sizeof cmd);
    string uri = getURI();
    string body = getBody();

    cmd.v.v0.method = getMethod();
    cmd.v.v0.chunked = 1;
    cmd.v.v0.path = uri.c_str();
    cmd.v.v0.npath = uri.size();
    if (!body.empty()) {
        cmd.v.v0.body = body.c_str();
        cmd.v.v0.nbody = body.size();
    }
    string ctype = getContentType();
    if (!ctype.empty()) {
        cmd.v.v0.content_type = ctype.c_str();
    }

    lcb_http_request_t dummy;
    lcb_error_t err;
    err = lcb_make_http_request(instance, (HttpReceiver*)this,
        isAdmin() ? LCB_HTTP_TYPE_MANAGEMENT : LCB_HTTP_TYPE_VIEW,
                &cmd, &dummy);
    if (err != LCB_SUCCESS) {
        throw err;
    }

    lcb_wait(instance);
}

lcb_http_method_t
HttpBaseHandler::getMethod()
{
    string smeth = o_method.result();
    if (smeth == "GET") {
        return LCB_HTTP_METHOD_GET;
    } else if (smeth == "POST") {
        return LCB_HTTP_METHOD_POST;
    } else if (smeth == "DELETE") {
        return LCB_HTTP_METHOD_DELETE;
    } else if (smeth == "PUT") {
        return LCB_HTTP_METHOD_PUT;
    } else {
        throw "Unrecognized method string";
    }
}

void
HttpBaseHandler::handleStatus(lcb_error_t err, int code)
{
    if (err != LCB_SUCCESS) {
        fprintf(stderr, "ERROR=0x%x (%s) ", err, lcb_strerror(NULL, err));
    }
    fprintf(stderr, "%d\n", code);
    map<string,string>::const_iterator ii = headers.begin();
    for (; ii != headers.end(); ii++) {
        fprintf(stderr, "  %s: %s\n", ii->first.c_str(), ii->second.c_str());
    }
}

string
AdminHandler::getURI()
{
    return getRequiredArg();
}

void
AdminHandler::run()
{
    fprintf(stderr, "Requesting %s\n", getURI().c_str());
    HttpBaseHandler::run();
    printf("%s", resbuf.c_str());
}

void
BucketCreateHandler::run()
{
    const string& name = getRequiredArg();
    const string& btype = o_btype.const_result();
    stringstream ss;

    if (btype == "couchbase" || btype == "membase") {
        isMemcached = false;
    } else if (btype == "memcached") {
        isMemcached = true;
    } else {
        throw "Unrecognized bucket type";
    }
    if (o_proxyport.passed() && o_bpass.passed()) {
        throw "Custom ASCII port is only available for auth-less buckets";
    }

    ss << "name=" << name;
    ss << "&bucketType=" << btype;
    ss << "&ramQuotaMB=" << o_ramquota.result();
    if (o_proxyport.passed()) {
        ss << "&authType=none&proxyPort=" << o_proxyport.result();
    } else {
        ss << "&authType=sasl&saslPassword=" << o_bpass.result();
    }

    ss << "&replicaNumber=" << o_replicas.result();
    body_s = ss.str();

    AdminHandler::run();
}

struct HostEnt {
    string protostr;
    string hostname;
    HostEnt(const char* host, const char* proto) {
        protostr = proto;
        hostname = host;
    }
    HostEnt(const char* host, const char* proto, int port) {
        protostr = proto;
        hostname = host;
        stringstream ss;
        ss << std::dec << port;
        hostname += ":";
        hostname += ss.str();
    }
};

void
DsnHandler::run()
{
    const string& dsn_s = getRequiredArg();
    lcb_error_t err;
    const char *errmsg;
    lcb_DSNPARAMS dsn;
    memset(&dsn, 0, sizeof dsn);
    err = lcb_dsn_parse(dsn_s.c_str(), &dsn, &errmsg);
    if (err != LCB_SUCCESS) {
        throw errmsg;
    }

    printf("Bucket: %s\n", dsn.bucket);
    printf("Implicit port: %d\n", dsn.implicit_port);
    string sslOpts;
    if (dsn.sslopts & LCB_SSL_ENABLED) {
        sslOpts = "ENABLED";
        if (dsn.sslopts & LCB_SSL_NOVERIFY) {
            sslOpts += "|NOVERIFY";
        }
    }
    printf("SSL: %s\n", sslOpts.c_str());

    printf("Boostrap Protocols: ");
    string bsStr;
    for (size_t ii = 0; ii < LCB_CONFIG_TRANSPORT_MAX; ii++) {
        if (dsn.transports[ii] == LCB_CONFIG_TRANSPORT_LIST_END) {
            break;
        }
        switch (dsn.transports[ii]) {
        case LCB_CONFIG_TRANSPORT_CCCP:
            bsStr += "CCCP,";
            break;
        case LCB_CONFIG_TRANSPORT_HTTP:
            bsStr += "HTTP,";
            break;
        default:
            break;
        }
    }
    if (bsStr.empty()) {
        bsStr = "CCCP,HTTP";
    } else {
        bsStr.erase(bsStr.size()-1, 1);
    }
    printf("%s\n", bsStr.c_str());
    printf("Hosts:\n");
    lcb_list_t *llcur;
    vector<HostEnt> hosts;

    LCB_LIST_FOR(llcur, &dsn.hosts) {
        lcb_DSNHOST *dh = LCB_LIST_ITEM(llcur, lcb_DSNHOST, llnode);
        lcb_U16 port = dh->port;
        if (!port) {
            port = dsn.implicit_port;
        }

        if (dh->type == LCB_CONFIG_MCD_PORT) {
            hosts.push_back(HostEnt(dh->hostname, "memcached", port));
        } else if (dh->type == LCB_CONFIG_MCD_SSL_PORT) {
            hosts.push_back(HostEnt(dh->hostname, "memcached+ssl", port));
        } else if (dh->type == LCB_CONFIG_HTTP_PORT) {
            hosts.push_back(HostEnt(dh->hostname, "restapi", port));
        } else if (dh->type == LCB_CONFIG_HTTP_SSL_PORT) {
            hosts.push_back(HostEnt(dh->hostname, "restapi+ssl", port));
        } else {
            if (dsn.sslopts) {
                hosts.push_back(HostEnt(dh->hostname, "memcached+ssl", LCB_CONFIG_MCD_SSL_PORT));
                hosts.push_back(HostEnt(dh->hostname, "restapi+ssl", LCB_CONFIG_HTTP_SSL_PORT));
            } else {
                hosts.push_back(HostEnt(dh->hostname, "memcached", LCB_CONFIG_MCD_PORT));
                hosts.push_back(HostEnt(dh->hostname, "restapi", LCB_CONFIG_HTTP_PORT));
            }
        }
    }
    for (size_t ii = 0; ii < hosts.size(); ii++) {
        HostEnt& ent = hosts[ii];
        string protostr = "[" + ent.protostr + "]";
        printf("  %-20s%s\n", protostr.c_str(), ent.hostname.c_str());
    }

    printf("Options: \n");
    const char *key, *value;
    int ictx = 0;
    while (lcb_dsn_next_option(&dsn, &key, &value, &ictx)) {
        printf("  %s=%s\n", key, value);
    }
}

static map<string,Handler*> handlers;
static map<string,Handler*> handlers_s;
static const char* optionsOrder[] = {
        "help",
        "cat",
        "create",
        "observe",
        "incr",
        "decr",
        // "flush",
        "hash",
        "lock",
        "unlock",
        "rm",
        "stats",
        // "verify,
        "version",
        "verbosity",
        "view",
        "admin",
        "bucket-create",
        "bucket-delete",
        "bucket-flush",
        "dsn",
        NULL
};

class HelpHandler : public Handler {
public:
    HelpHandler() : Handler("help") {}
    HANDLER_DESCRIPTION("Show help")
protected:
    void run() {
        fprintf(stderr, "Usage: cbc <command> [options]\n");
        fprintf(stderr, "command may be:\n");
        for (const char ** cur = optionsOrder; *cur; cur++) {
            const Handler *handler = handlers[*cur];
            fprintf(stderr, "   %-20s", *cur);
            fprintf(stderr, "%s\n", handler->description().c_str());
        }
    }
};

static void
setupHandlers()
{
    handlers_s["get"] = new GetHandler();
    handlers_s["create"] = new SetHandler();
    handlers_s["hash"] = new HashHandler();
    handlers_s["help"] = new HelpHandler();
    handlers_s["lock"] = new GetHandler("lock");
    handlers_s["observe"] = new ObserveHandler();
    handlers_s["unlock"] = new UnlockHandler();
    handlers_s["version"] = new VersionHandler();
    handlers_s["rm"] = new RemoveHandler();
    handlers_s["cp"] = new SetHandler("cp");
    handlers_s["stats"] = new StatsHandler();
    handlers_s["verbosity"] = new VerbosityHandler();
    handlers_s["incr"] = new IncrHandler();
    handlers_s["decr"] = new DecrHandler();
    handlers_s["admin"] = new AdminHandler();
    handlers_s["bucket-create"] = new BucketCreateHandler();
    handlers_s["bucket-delete"] = new BucketDeleteHandler();
    handlers_s["bucket-flush"] = new BucketFlushHandler();
    handlers_s["view"] = new ViewsHandler();
    handlers_s["dsn"] = new DsnHandler();



    map<string,Handler*>::iterator ii;
    for (ii = handlers_s.begin(); ii != handlers_s.end(); ++ii) {
        handlers[ii->first] = ii->second;
    }

    handlers["cat"] = handlers["get"];
}

int main(int argc, char **argv)
{
    setupHandlers();

    if (argc < 2) {
        fprintf(stderr, "Must provide an option name\n");
        HelpHandler().execute(argc, argv);
        exit(EXIT_FAILURE);
    }

    Handler *handler = handlers[argv[1]];
    if (handler == NULL) {
        fprintf(stderr, "Unknown command %s\n", argv[1]);
        HelpHandler().execute(argc, argv);
        exit(EXIT_FAILURE);
    }

    try {
        handler->execute(argc-1, argv+1);
    } catch (lcb_error_t &err) {
        fprintf(stderr, "Operation failed with code 0x%x (%s)\n",
            err, lcb_strerror(NULL, err));
        exit(EXIT_FAILURE);

    } catch (const char *& err) {
        fprintf(stderr, "%s\n", err);
        exit(EXIT_FAILURE);

    } catch (string& err) {
        fprintf(stderr, "%s\n", err.c_str());
        exit(EXIT_FAILURE);
    }

    map<string,Handler*>::iterator iter = handlers_s.begin();
    for (; iter != handlers_s.end(); iter++) {
        delete iter->second;
    }
    exit(EXIT_SUCCESS);
}
