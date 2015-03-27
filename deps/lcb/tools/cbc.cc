#include "common/my_inttypes.h"
#include <map>
#include <sstream>
#include <iostream>
#include <fstream>
#include <libcouchbase/vbucket.h>
#include <libcouchbase/views.h>
#include <stddef.h>
#include "common/options.h"
#include "common/histogram.h"
#include "cbc-handlers.h"
#include "connspec.h"
using namespace cbc;

using std::string;
using std::map;
using std::vector;
using std::stringstream;

string getRespKey(const lcb_RESPBASE* resp)
{
    if (!resp->nkey) {
        return "";
    }

    return string((const char *)resp->key, resp->nkey);
}

static void
printKeyError(string& key, lcb_error_t err)
{
    fprintf(stderr, "%-20s %s (0x%x)\n", key.c_str(), lcb_strerror(NULL, err), err);
}

static void
printKeyCasStatus(string& key, int cbtype, const lcb_RESPBASE *resp,
    const char *message = NULL)
{
    fprintf(stderr, "%-20s", key.c_str());
    if (message != NULL) {
        fprintf(stderr, "%s ", message);
    }
    fprintf(stderr, "CAS=0x%"PRIx64"\n", resp->cas);
    const lcb_SYNCTOKEN *st = lcb_resp_get_synctoken(cbtype, resp);
    if (st != NULL) {
        fprintf(stderr, "%-20sSYNCTOKEN=%u,%"PRIu64",%"PRIu64"\n",
            "", st->vbid_, st->uuid_, st->seqno_);
    }
}

extern "C" {
static void
get_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPGET *resp)
{
    string key = getRespKey((const lcb_RESPBASE *)resp);
    if (resp->rc == LCB_SUCCESS) {
        fprintf(stderr, "%-20s CAS=0x%"PRIx64", Flags=0x%x. Size=%lu\n",
            key.c_str(), resp->cas, resp->itmflags, (unsigned long)resp->nvalue);
        fflush(stderr);
        fwrite(resp->value, 1, resp->nvalue, stdout);
        fflush(stdout);
        fprintf(stderr, "\n");
    } else {
        printKeyError(key, resp->rc);
    }
}

static void
store_callback(lcb_t, lcb_CALLBACKTYPE cbtype, const lcb_RESPSTORE *resp)
{
    string key = getRespKey((const lcb_RESPBASE*)resp);
    if (resp->rc == LCB_SUCCESS) {
        printKeyCasStatus(key, cbtype, (const lcb_RESPBASE *)resp, "Stored.");
        if (resp->cookie != NULL) {
            map<string,lcb_cas_t>& items = *(map<string,lcb_cas_t>*)resp->cookie;
            items[key] = resp->cas;
        }
    } else {
        printKeyError(key, resp->rc);
    }
}

static void
common_callback(lcb_t, int type, const lcb_RESPBASE *resp)
{
    string key = getRespKey(resp);
    if (resp->rc != LCB_SUCCESS) {
        printKeyError(key, resp->rc);
        return;
    }
    switch (type) {
    case LCB_CALLBACK_UNLOCK:
        fprintf(stderr, "%-20s Unlocked\n", key.c_str());
        break;
    case LCB_CALLBACK_REMOVE:
        printKeyCasStatus(key, type, resp, "Deleted.");
        break;
    case LCB_CALLBACK_ENDURE: {
        const lcb_RESPENDURE *er = (const lcb_RESPENDURE*)resp;
        char s_tmp[4006];
        sprintf(s_tmp, "Persisted(%u). Replicated(%u).",
            er->npersisted, er->nreplicated);
        printKeyCasStatus(key, type, resp, s_tmp);
        break;
    }
    default:
        abort(); // didn't request it
    }
}

static void
observe_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPOBSERVE *resp)
{
    if (resp->nkey == 0) {
        return;
    }

    string key = getRespKey((const lcb_RESPBASE *)resp);
    if (resp->rc == LCB_SUCCESS) {
        fprintf(stderr,
            "%-20s [%s] Status=0x%x, CAS=0x%"PRIx64"\n", key.c_str(),
            resp->ismaster ? "Master" : "Replica",
                    resp->status, resp->cas);
    } else {
        printKeyError(key, resp->rc);
    }
}

static void
obseqno_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPOBSEQNO *resp)
{
    int ix = resp->server_index;
    if (resp->rc != LCB_SUCCESS) {
        fprintf(stderr,
            "[%d] ERROR 0x%X (%s)\n", ix, resp->rc, lcb_strerror(NULL, resp->rc));
        return;
    }
    lcb_U64 uuid, seq_disk, seq_mem;
    if (resp->old_uuid) {
        seq_disk = seq_mem = resp->old_seqno;
        uuid = resp->old_uuid;
    } else {
        uuid = resp->cur_uuid;
        seq_disk = resp->persisted_seqno;
        seq_mem = resp->mem_seqno;
    }
    fprintf(stderr, "[%d] UUID=0x%"PRIx64", Cache=%"PRIu64", Disk=%"PRIu64,
        ix, uuid, seq_mem, seq_disk);
    if (resp->old_uuid) {
        fprintf(stderr, "\n");
        fprintf(stderr, "    FAILOVER. New: UUID=%"PRIx64", Cache=%"PRIu64", Disk=%"PRIu64,
            resp->cur_uuid, resp->mem_seqno, resp->persisted_seqno);
    }
    fprintf(stderr, "\n");
}

static void
stats_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPSTATS *resp)
{
    if (resp->rc != LCB_SUCCESS) {
        fprintf(stderr, "Got error %s (%d) in stats\n", lcb_strerror(NULL, resp->rc), resp->rc);
        return;
    }
    if (resp->server == NULL || resp->key == NULL) {
        return;
    }

    string server = resp->server;
    string key = getRespKey((const lcb_RESPBASE *)resp);
    string value;
    if (resp->nvalue >  0) {
        value.assign((const char *)resp->value, resp->nvalue);
    }
    fprintf(stdout, "%s\t%s", server.c_str(), key.c_str());
    if (!value.empty()) {
        fprintf(stdout, "\t%s", value.c_str());
    }
    fprintf(stdout, "\n");
}

static void
common_server_callback(lcb_t, int cbtype, const lcb_RESPSERVERBASE *sbase)
{
    const char *msg;
    if (cbtype == LCB_CALLBACK_VERBOSITY) {
        msg = "Set verbosity";
    } else if (cbtype == LCB_CALLBACK_FLUSH) {
        msg = "Flush";
    } else {
        msg = "";
    }
    if (!sbase->server) {
        return;
    }
    if (sbase->rc != LCB_SUCCESS) {
        fprintf(stderr, "%s failed for server %s: %s\n", msg, sbase->server,
            lcb_strerror(NULL, sbase->rc));
    } else {
        fprintf(stderr, "%s: %s\n", msg, sbase->server);
    }
}

static void
arithmetic_callback(lcb_t, lcb_CALLBACKTYPE type, const lcb_RESPCOUNTER *resp)
{
    string key = getRespKey((const lcb_RESPBASE *)resp);
    if (resp->rc != LCB_SUCCESS) {
        printKeyError(key, resp->rc);
    } else {
        char buf[4096] = { 0 };
        sprintf(buf, "Current value is %"PRIu64".", resp->value);
        printKeyCasStatus(key, type, (const lcb_RESPBASE *)resp, buf);
    }
}

static void
http_callback(lcb_t, int, const lcb_RESPHTTP *resp)
{
    HttpReceiver *ctx = (HttpReceiver *)resp->cookie;
    ctx->maybeInvokeStatus(resp);
    if (resp->nbody) {
        ctx->onChunk((const char*)resp->body, resp->nbody);
    }
    if (resp->rflags & LCB_RESP_F_FINAL) {
        ctx->onDone();
    }
}

static void
view_callback(lcb_t, int, const lcb_RESPVIEWQUERY *resp)
{
    if (resp->rflags & LCB_RESP_F_FINAL) {
        fprintf(stderr, "View query complete!\n");
    }

    if (resp->rc != LCB_SUCCESS) {
        fprintf(stderr, "View query failed: 0x%x (%s)\n",
            resp->rc, lcb_strerror(NULL, resp->rc));

        if (resp->rc == LCB_HTTP_ERROR) {
            if (resp->htresp != NULL) {
                HttpReceiver ctx;
                ctx.maybeInvokeStatus(resp->htresp);
                if (resp->htresp->nbody) {
                    fprintf(stderr, "%.*s", (int)resp->htresp->nbody, resp->htresp->body);
                }
            }
        }
    }

    if (resp->rflags & LCB_RESP_F_FINAL) {
        if (resp->value) {
            fprintf(stderr, "Non-row data: %.*s\n",
                (int)resp->nvalue, resp->value);
        }
        return;
    }

    printf("KEY: %.*s\n", (int)resp->nkey, resp->key);
    printf("     VALUE: %.*s\n", (int)resp->nvalue, resp->value);
    printf("     DOCID: %.*s\n", (int)resp->ndocid, resp->docid);
    if (resp->docresp) {
        get_callback(NULL, LCB_CALLBACK_GET, resp->docresp);
    }
    if (resp->geometry) {
        printf("     GEO: %.*s\n", (int)resp->ngeometry, resp->geometry);
    }
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
    if (params.shouldDump()) {
        lcb_dump(instance, stderr, LCB_DUMP_ALL);
    }
    if (instance) {
        lcb_destroy(instance);
    }
}

void
Handler::execute(int argc, char **argv)
{
    addOptions();
    parser.default_settings.argstring = usagestr();
    parser.default_settings.shortdesc = description();
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
Handler::getLoneArg(bool required)
{
    static string empty("");

    const vector<string>& args = parser.getRestArgs();
    if (args.empty() || args.size() != 1) {
        if (required) {
            throw "Command requires single argument";
        }
        return empty;
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
    lcb_install_callback3(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)get_callback);
    lcb_install_callback3(instance, LCB_CALLBACK_GETREPLICA, (lcb_RESPCALLBACK)get_callback);
    const vector<string>& keys = parser.getRestArgs();
    lcb_error_t err;

    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ++ii) {
        lcb_CMDGET cmd = { 0 };
        const string& key = keys[ii];
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        if (o_exptime.passed()) {
            cmd.exptime = o_exptime.result();
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
    int persist_to, int replicate_to)
{
    lcb_install_callback3(instance, LCB_CALLBACK_ENDURE, common_callback);
    lcb_durability_opts_t options = { 0 };
    if (persist_to < 0 || replicate_to < 0) {
        options.v.v0.cap_max = 1;
    }
    options.v.v0.persist_to = persist_to;
    options.v.v0.replicate_to = replicate_to;
    lcb_error_t err;

    lcb_MULTICMD_CTX *mctx = lcb_endure3_ctxnew(instance, &options, &err);
    if (mctx == NULL) {
        throw err;
    }

    map<string,lcb_cas_t>::const_iterator iter;
    for (iter = items.begin(); iter != items.end(); ++iter) {
        lcb_CMDENDURE cmd = { 0 };
        LCB_KREQ_SIMPLE(&cmd.key, iter->first.c_str(), iter->first.size());
        cmd.cas = iter->second;
        err = mctx->addcmd(mctx, (lcb_CMDBASE *)&cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }

    lcb_sched_enter(instance);
    err = mctx->done(mctx, NULL);
    if (err == LCB_SUCCESS) {
        lcb_sched_leave(instance);
    } else {
        lcb_sched_fail(instance);
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
        cmd.exptime = o_exp.result();
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
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, (lcb_RESPCALLBACK)store_callback);
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
            fprintf(stderr, " Server: %s",
                lcbvb_get_hostport(vbc, srvix, LCBVB_SVCTYPE_DATA, LCBVB_SVCMODE_PLAIN));
            const char *vapi = lcbvb_get_capibase(vbc, srvix, LCBVB_SVCMODE_PLAIN);
            if (vapi) {
                fprintf(stderr, ", CouchAPI: %s", vapi);
            }
        }
        fprintf(stderr, "\n");

        for (size_t jj = 0; jj < lcbvb_get_nreplicas(vbc); jj++) {
            int rix = lcbvb_vbreplica(vbc, vbid, jj);
            const char *rname = NULL;
            if (rix >= 0) {
                rname = lcbvb_get_hostport(vbc, rix, LCBVB_SVCTYPE_DATA, LCBVB_SVCMODE_PLAIN);
            }
            if (rname == NULL) {
                rname = "N/A";
            }
            fprintf(stderr, "Replica #%d: Index=%d, Host=%s\n", (int)jj, rix, rname);
        }
    }
}

void
ObserveHandler::run()
{
    Handler::run();
    lcb_install_callback3(instance, LCB_CALLBACK_OBSERVE, (lcb_RESPCALLBACK)observe_callback);
    const vector<string>& keys = parser.getRestArgs();
    lcb_MULTICMD_CTX *mctx = lcb_observe3_ctxnew(instance);
    if (mctx == NULL) {
        throw LCB_CLIENT_ENOMEM;
    }

    lcb_error_t err;
    for (size_t ii = 0; ii < keys.size(); ii++) {
        lcb_CMDOBSERVE cmd = { 0 };
        LCB_KREQ_SIMPLE(&cmd.key, keys[ii].c_str(), keys[ii].size());
        err = mctx->addcmd(mctx, (lcb_CMDBASE*)&cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }

    lcb_sched_enter(instance);
    err = mctx->done(mctx, NULL);
    if (err == LCB_SUCCESS) {
        lcb_sched_leave(instance);
        lcb_wait(instance);
    } else {
        lcb_sched_fail(instance);
        throw err;
    }
}

void
ObserveSeqnoHandler::run()
{
    Handler::run();
    lcb_install_callback3(instance, LCB_CALLBACK_OBSEQNO, (lcb_RESPCALLBACK)obseqno_callback);
    const vector<string>& infos = parser.getRestArgs();
    lcb_CMDOBSEQNO cmd = { 0 };
    lcbvb_CONFIG *vbc;
    lcb_error_t rc;

    rc = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (rc != LCB_SUCCESS) {
        throw rc;
    }

    lcb_sched_enter(instance);

    for (size_t ii = 0; ii < infos.size(); ++ii) {
        const string& cur = infos[ii];
        unsigned vbid;
        unsigned long long uuid;
        int rv = sscanf(cur.c_str(), "%u,%llu", &vbid, &uuid);
        if (rv != 2) {
            throw "Must pass sequences of base10 vbid and base16 uuids";
        }
        cmd.uuid = uuid;
        cmd.vbid = vbid;
        for (size_t jj = 0; jj < lcbvb_get_nreplicas(vbc) + 1; ++jj) {
            int ix = lcbvb_vbserver(vbc, vbid, jj);
            if (ix < 0) {
                fprintf(stderr, "Server %d unavailable (skipping)\n", ix);
            }
            cmd.server_index = ix;
            rc = lcb_observe_seqno3(instance, NULL, &cmd);
            if (rc != LCB_SUCCESS) {
                throw rc;
            }
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
UnlockHandler::run()
{
    Handler::run();
    lcb_install_callback3(instance, LCB_CALLBACK_UNLOCK, common_callback);
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
        cmd.cas = cas;
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
    printf("  SSL: .. %s\n",
            lcb_supports_feature(LCB_SUPPORTS_SSL) ? "SUPPORTED" : "NOT SUPPORTED");
}

void
RemoveHandler::run()
{
    Handler::run();
    const vector<string> &keys = parser.getRestArgs();
    lcb_sched_enter(instance);
    lcb_install_callback3(instance, LCB_CALLBACK_REMOVE, common_callback);
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
    lcb_install_callback3(instance, LCB_CALLBACK_STATS, (lcb_RESPCALLBACK)stats_callback);
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
            if (o_keystats.result()) {
                cmd.cmdflags = LCB_CMDSTATS_F_KV;
            }
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
    Handler::run();

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

    lcb_install_callback3(instance, LCB_CALLBACK_VERBOSITY, (lcb_RESPCALLBACK)common_server_callback);
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
McFlushHandler::run()
{
    Handler::run();

    lcb_CMDFLUSH cmd = { 0 };
    lcb_error_t err;
    lcb_install_callback3(instance, LCB_CALLBACK_FLUSH, (lcb_RESPCALLBACK)common_server_callback);
    lcb_sched_enter(instance);
    err = lcb_flush3(instance, NULL, &cmd);
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
    lcb_install_callback3(instance, LCB_CALLBACK_COUNTER, (lcb_RESPCALLBACK)arithmetic_callback);
    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ++ii) {
        const string& key = keys[ii];
        lcb_CMDCOUNTER cmd = { 0 };
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        if (o_initial.passed()) {
            cmd.create = 1;
            cmd.initial = o_initial.result();
        }
        cmd.delta = getDelta();
        cmd.exptime = o_expiry.result();
        lcb_error_t err = lcb_counter3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            throw err;
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
ViewsHandler::run()
{
    Handler::run();

    const string& s = getRequiredArg();
    size_t pos = s.find('/');
    if (pos == string::npos) {
        throw "View must be in the format of design/view";
    }

    string ddoc = s.substr(0, pos);
    string view = s.substr(pos+1);
    string opts = o_params.result();

    lcb_CMDVIEWQUERY cmd = { 0 };
    lcb_view_query_initcmd(&cmd,
        ddoc.c_str(), view.c_str(), opts.c_str(), view_callback);
    if (o_spatial) {
        cmd.cmdflags |= LCB_CMDVIEWQUERY_F_SPATIAL;
    }
    if (o_incdocs) {
        cmd.cmdflags |= LCB_CMDVIEWQUERY_F_INCLUDE_DOCS;
    }

    lcb_error_t rc;
    rc = lcb_view_query(instance, NULL, &cmd);
    if (rc != LCB_SUCCESS) {
        throw rc;
    }
    lcb_wait(instance);
}

void
HttpReceiver::install(lcb_t instance)
{
    lcb_install_callback3(instance, LCB_CALLBACK_HTTP,
        (lcb_RESPCALLBACK)http_callback);
}

void
HttpReceiver::maybeInvokeStatus(const lcb_RESPHTTP *resp)
{
    if (statusInvoked) {
        return;
    }

    statusInvoked = true;
    if (resp->headers) {
        for (const char * const *cur = resp->headers; *cur; cur += 2) {
            string key = cur[0];
            string value = cur[1];
            headers[key] = value;
        }
    }
    handleStatus(resp->rc, resp->htstatus);
}

void
HttpBaseHandler::run()
{
    Handler::run();
    install(instance);
    lcb_http_cmd_st cmd;
    memset(&cmd, 0, sizeof cmd);
    string uri = getURI();
    const string& body = getBody();

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

const string&
HttpBaseHandler::getBody()
{
    if (!body_cached.empty()) {
        return body_cached;
    }
    lcb_http_method_t meth = getMethod();
    if (meth == LCB_HTTP_METHOD_GET || meth == LCB_HTTP_METHOD_DELETE) {
        return body_cached; // empty
    }

    char buf[4096];
    size_t nr;
    while ( (nr = fread(buf, 1, sizeof buf, stdin)) != 0) {
        body_cached.append(buf, nr);
    }
    return body_cached;
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
ConnstrHandler::run()
{
    const string& connstr_s = getRequiredArg();
    lcb_error_t err;
    const char *errmsg;
    lcb_CONNSPEC spec;
    memset(&spec, 0, sizeof spec);
    err = lcb_connspec_parse(connstr_s.c_str(), &spec, &errmsg);
    if (err != LCB_SUCCESS) {
        throw errmsg;
    }

    printf("Bucket: %s\n", spec.bucket);
    printf("Implicit port: %d\n", spec.implicit_port);
    string sslOpts;
    if (spec.sslopts & LCB_SSL_ENABLED) {
        sslOpts = "ENABLED";
        if (spec.sslopts & LCB_SSL_NOVERIFY) {
            sslOpts += "|NOVERIFY";
        }
    }
    printf("SSL: %s\n", sslOpts.c_str());

    printf("Boostrap Protocols: ");
    string bsStr;
    for (size_t ii = 0; ii < LCB_CONFIG_TRANSPORT_MAX; ii++) {
        if (spec.transports[ii] == LCB_CONFIG_TRANSPORT_LIST_END) {
            break;
        }
        switch (spec.transports[ii]) {
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

    LCB_LIST_FOR(llcur, &spec.hosts) {
        lcb_HOSTSPEC *dh = LCB_LIST_ITEM(llcur, lcb_HOSTSPEC, llnode);
        lcb_U16 port = dh->port;
        if (!port) {
            port = spec.implicit_port;
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
            if (spec.sslopts) {
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
    while (lcb_connspec_next_option(&spec, &key, &value, &ictx)) {
        printf("  %s=%s\n", key, value);
    }
}

void
WriteConfigHandler::run()
{
    lcb_create_st cropts;
    params.fillCropts(cropts);
    string outname = getLoneArg();
    if (outname.empty()) {
        outname = ConnParams::getConfigfileName();
    }
    // Generate the config
    params.writeConfig(outname);
}

static map<string,Handler*> handlers;
static map<string,Handler*> handlers_s;
static const char* optionsOrder[] = {
        "help",
        "cat",
        "create",
        "observe",
        "observe-seqno",
        "incr",
        "decr",
        "mcflush",
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
        "connstr",
        "write-config",
        "strerror",
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
            fprintf(stderr, "%s\n", handler->description());
        }
    }
};

class StrErrorHandler : public Handler {
public:
    StrErrorHandler() : Handler("strerror") {}
    HANDLER_DESCRIPTION("Decode library error code")
    HANDLER_USAGE("HEX OR DECIMAL CODE")
protected:
    void handleOptions() { }
    void run() {
        std::string nn = getRequiredArg();
        // Try to parse it as a hexadecimal number
        unsigned errcode;
        int rv = sscanf(nn.c_str(), "0x%x", &errcode);
        if (rv != 1) {
            rv = sscanf(nn.c_str(), "%u", &errcode);
            if (rv != 1) {
                throw ("Need decimal or hex code!");
            }
        }
        fprintf(stderr, "0x%x: %s\n", errcode, lcb_strerror(NULL, (lcb_error_t)errcode));
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
    handlers_s["mcflush"] = new McFlushHandler();
    handlers_s["incr"] = new IncrHandler();
    handlers_s["decr"] = new DecrHandler();
    handlers_s["admin"] = new AdminHandler();
    handlers_s["bucket-create"] = new BucketCreateHandler();
    handlers_s["bucket-delete"] = new BucketDeleteHandler();
    handlers_s["bucket-flush"] = new BucketFlushHandler();
    handlers_s["view"] = new ViewsHandler();
    handlers_s["connstr"] = new ConnstrHandler();
    handlers_s["write-config"] = new WriteConfigHandler();
    handlers_s["strerror"] = new StrErrorHandler();
    handlers_s["observe-seqno"] = new ObserveSeqnoHandler();



    map<string,Handler*>::iterator ii;
    for (ii = handlers_s.begin(); ii != handlers_s.end(); ++ii) {
        handlers[ii->first] = ii->second;
    }

    handlers["cat"] = handlers["get"];
}

#if _POSIX_VERSION >= 200112L
#include <libgen.h>
#define HAVE_BASENAME
#endif

static void
parseCommandname(string& cmdname, int&, char**& argv)
{
#ifdef HAVE_BASENAME
    cmdname = basename(argv[0]);
    size_t dashpos;

    if (cmdname.find("cbc") != 0) {
        cmdname.clear();
        // Doesn't start with cbc
        return;
    }

    if ((dashpos = cmdname.find('-')) != string::npos &&
            cmdname.find("cbc") != string::npos &&
            dashpos+1 < cmdname.size()) {

        // Get the actual command name
        cmdname = cmdname.substr(dashpos+1);
        return;
    }
#else
    (void)argv;
#endif
    cmdname.clear();
}

static void
wrapPillowfight(int argc, char **argv)
{
#ifdef _POSIX_VERSION
    vector<char *> args;
    string exePath(argv[0]);
    size_t cbc_pos = exePath.find("cbc");

    if (cbc_pos == string::npos) {
        throw("Couldn't invoke pillowfight");
    }

    exePath.replace(cbc_pos, 3, "cbc-pillowfight");
    args.push_back((char*)exePath.c_str());

    // { "cbc", "pillowfight" }
    argv += 2; argc -= 2;
    for (int ii = 0; ii < argc; ii++) {
        args.push_back(argv[ii]);
    }
    args.push_back((char*)NULL);
    execvp(exePath.c_str(), &args[0]);
    perror(exePath.c_str());
    throw("Couldn't execute!");
#else
    throw ("Can't wrap around cbc-pillowfight on non-POSIX environments");
#endif
}

int main(int argc, char **argv)
{

    // Wrap pillowfight immediately
    if (argc >= 2 && strcmp(argv[1], "pillowfight") == 0) {
        wrapPillowfight(argc, argv);
    }

    setupHandlers();
    string cmdname;
    parseCommandname(cmdname, argc, argv);

    if (cmdname.empty()) {
        if (argc < 2) {
            fprintf(stderr, "Must provide an option name\n");
            try {
                HelpHandler().execute(argc, argv);
            } catch (string& exc) {
                std::cerr << exc << std::endl;
            }
            exit(EXIT_FAILURE);
        } else {
            cmdname = argv[1];
            argv++;
            argc--;
        }
    }

    Handler *handler = handlers[cmdname];
    if (handler == NULL) {
        fprintf(stderr, "Unknown command %s\n", cmdname.c_str());
        HelpHandler().execute(argc, argv);
        exit(EXIT_FAILURE);
    }

    try {
        handler->execute(argc, argv);
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
