#define NOMINMAX
#include <map>
#include <sstream>
#include <iostream>
#include <iomanip>
#include <fstream>
#include <algorithm>
#include <libcouchbase/vbucket.h>
#include <libcouchbase/views.h>
#include <libcouchbase/n1ql.h>
#include <limits>
#include <stddef.h>
#include <errno.h>
#include "common/options.h"
#include "common/histogram.h"
#include "cbc-handlers.h"
#include "connspec.h"
#include "contrib/lcb-jsoncpp/lcb-jsoncpp.h"

#ifndef LCB_NO_SSL
#include <openssl/crypto.h>
#endif
#include <snappy-stubs-public.h>

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
printKeyError(string& key, int cbtype, const lcb_RESPBASE *resp, const char *additional = NULL)
{
    fprintf(stderr, "%-20s %s (0x%x)\n", key.c_str(), lcb_strerror(NULL, resp->rc), resp->rc);
    const char *ctx = lcb_resp_get_error_context(cbtype, resp);
    if (ctx != NULL) {
        fprintf(stderr, "%-20s %s\n", "", ctx);
    }
    const char *ref = lcb_resp_get_error_ref(cbtype, resp);
    if (ref != NULL) {
        fprintf(stderr, "%-20s Ref: %s\n", "", ref);
    }
    if (additional) {
        fprintf(stderr, "%-20s %s\n", "", additional);
    }
}

static void
printKeyCasStatus(string& key, int cbtype, const lcb_RESPBASE *resp,
    const char *message = NULL)
{
    fprintf(stderr, "%-20s", key.c_str());
    if (message != NULL) {
        fprintf(stderr, "%s ", message);
    }
    fprintf(stderr, "CAS=0x%" PRIx64 "\n", resp->cas);
    const lcb_MUTATION_TOKEN *st = lcb_resp_get_mutation_token(cbtype, resp);
    if (st != NULL) {
        fprintf(stderr, "%-20sSYNCTOKEN=%u,%" PRIu64 ",%" PRIu64 "\n",
            "", st->vbid_, st->uuid_, st->seqno_);
    }
}

extern "C" {
static void
get_callback(lcb_t, lcb_CALLBACKTYPE cbtype, const lcb_RESPGET *resp)
{
    string key = getRespKey((const lcb_RESPBASE *)resp);
    if (resp->rc == LCB_SUCCESS) {
        fprintf(stderr, "%-20s CAS=0x%" PRIx64 ", Flags=0x%x, Size=%lu, Datatype=0x%02x",
                key.c_str(), resp->cas, resp->itmflags, (unsigned long)resp->nvalue,
                (int)resp->datatype);
        if (resp->datatype) {
            fprintf(stderr, "(");
            if (resp->datatype & LCB_VALUE_F_JSON) {
                fprintf(stderr, "JSON");
            }
            fprintf(stderr, ")");
        }
        fprintf(stderr, "\n");
        fflush(stderr);
        fwrite(resp->value, 1, resp->nvalue, stdout);
        fflush(stdout);
        fprintf(stderr, "\n");
    } else {
        printKeyError(key, cbtype, (const lcb_RESPBASE *)resp);
    }
}

static void
store_callback(lcb_t, lcb_CALLBACKTYPE cbtype, const lcb_RESPBASE *resp)
{
    string key = getRespKey((const lcb_RESPBASE*)resp);

    if (cbtype == LCB_CALLBACK_STOREDUR) {
        // Storage with durability
        const lcb_RESPSTOREDUR *dresp =
                reinterpret_cast<const lcb_RESPSTOREDUR *>(resp);
        char buf[4096];
        if (resp->rc == LCB_SUCCESS) {
            sprintf(buf, "Stored. Persisted(%u). Replicated(%u)",
                dresp->dur_resp->npersisted, dresp->dur_resp->nreplicated);
            printKeyCasStatus(key, cbtype, resp, buf);
        } else {
            if (dresp->store_ok) {
                sprintf(buf, "Store OK, but durability failed. Persisted(%u). Replicated(%u)",
                    dresp->dur_resp->npersisted, dresp->dur_resp->nreplicated);
            } else {
                sprintf(buf, "%s", "Store failed");
            }
            printKeyError(key, cbtype, resp);
        }
    } else {
        if (resp->rc == LCB_SUCCESS) {
            printKeyCasStatus(key, cbtype, resp, "Stored.");
        } else {
            printKeyError(key, cbtype, resp);
        }
    }
}

static void
common_callback(lcb_t, int type, const lcb_RESPBASE *resp)
{
    string key = getRespKey(resp);
    if (resp->rc != LCB_SUCCESS) {
        printKeyError(key, type, resp);
        return;
    }
    switch (type) {
    case LCB_CALLBACK_UNLOCK:
        fprintf(stderr, "%-20s Unlocked\n", key.c_str());
        break;
    case LCB_CALLBACK_REMOVE:
        printKeyCasStatus(key, type, resp, "Deleted.");
        break;
    case LCB_CALLBACK_TOUCH:
        printKeyCasStatus(key, type, resp, "Touched.");
        break;
    default:
        abort(); // didn't request it
    }
}

static void
observe_callback(lcb_t, lcb_CALLBACKTYPE cbtype, const lcb_RESPOBSERVE *resp)
{
    if (resp->nkey == 0) {
        return;
    }

    string key = getRespKey((const lcb_RESPBASE *)resp);
    if (resp->rc == LCB_SUCCESS) {
        fprintf(stderr,
            "%-20s [%s] Status=0x%x, CAS=0x%" PRIx64 "\n", key.c_str(),
            resp->ismaster ? "Master" : "Replica",
                    resp->status, resp->cas);
    } else {
        printKeyError(key, cbtype, (const lcb_RESPBASE *)resp);
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
    fprintf(stderr, "[%d] UUID=0x%" PRIx64 ", Cache=%" PRIu64 ", Disk=%" PRIu64,
        ix, uuid, seq_mem, seq_disk);
    if (resp->old_uuid) {
        fprintf(stderr, "\n");
        fprintf(stderr, "    FAILOVER. New: UUID=%" PRIx64 ", Cache=%" PRIu64 ", Disk=%" PRIu64,
            resp->cur_uuid, resp->mem_seqno, resp->persisted_seqno);
    }
    fprintf(stderr, "\n");
}

static void
stats_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPSTATS *resp)
{
    if (resp->rc != LCB_SUCCESS) {
        fprintf(stderr, "ERROR 0x%02X (%s)\n", resp->rc, lcb_strerror(NULL, resp->rc));
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
        if (*static_cast<bool*>(resp->cookie) && key == "key_flags") {
            // Is keystats
            // Flip the bits so the display formats correctly
            unsigned flags_u = 0;
            sscanf(value.c_str(), "%u", &flags_u);
            flags_u = htonl(flags_u);
            fprintf(stdout, "\t%u (cbc: converted via htonl)", flags_u);
        } else {
            fprintf(stdout, "\t%s", value.c_str());
        }
    }
    fprintf(stdout, "\n");
}

static void
watch_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPSTATS *resp)
{
    if (resp->rc != LCB_SUCCESS) {
        fprintf(stderr, "ERROR 0x%02X (%s)\n", resp->rc, lcb_strerror(NULL, resp->rc));
        return;
    }
    if (resp->server == NULL || resp->key == NULL) {
        return;
    }

    string key = getRespKey((const lcb_RESPBASE *)resp);
    if (resp->nvalue >  0) {
        char *nptr = NULL;
        uint64_t val =
#ifdef _WIN32
            _strtoi64
#else
            strtoll
#endif
            ((const char *)resp->value, &nptr, 10);
        if (nptr != (const char *)resp->value) {
            map<string, int64_t> *entry = reinterpret_cast< map<string, int64_t> *>(resp->cookie);
            (*entry)[key] += val;
        }
    }
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
ping_callback(lcb_t, int, const lcb_RESPPING *resp)
{
    if (resp->rc != LCB_SUCCESS) {
        fprintf(stderr, "failed: %s\n", lcb_strerror(NULL, resp->rc));
    } else {
        if (resp->njson) {
            printf("%.*s", (int)resp->njson, resp->json);
        }
    }
}

static void
arithmetic_callback(lcb_t, lcb_CALLBACKTYPE type, const lcb_RESPCOUNTER *resp)
{
    string key = getRespKey((const lcb_RESPBASE *)resp);
    if (resp->rc != LCB_SUCCESS) {
        printKeyError(key, type, (lcb_RESPBASE *)resp);
    } else {
        char buf[4096] = { 0 };
        sprintf(buf, "Current value is %" PRIu64 ".", resp->value);
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
                    fprintf(stderr, "%.*s", (int)resp->htresp->nbody,
                        static_cast<const char *>(resp->htresp->body));
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

    printf("KEY: %.*s\n", (int)resp->nkey, static_cast<const char*>(resp->key));
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
        throw LcbError(err, "Failed to create instance");
    }
    params.doCtls(instance);
    err = lcb_connect(instance);
    if (err != LCB_SUCCESS) {
        throw LcbError(err, "Failed to connect instance");
    }
    lcb_wait(instance);
    err = lcb_get_bootstrap_status(instance);
    if (err != LCB_SUCCESS) {
        throw LcbError(err, "Failed to bootstrap instance");
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
            throw std::runtime_error("Command requires single argument");
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
    std::string replica_mode = o_replica.result();

    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ++ii) {
        lcb_error_t err;
        if (o_replica.passed()) {
            lcb_CMDGETREPLICA cmd = { 0 };
            const string& key = keys[ii];
            LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
            if (replica_mode == "first") {
                cmd.strategy = LCB_REPLICA_FIRST;
            } else if (replica_mode == "all") {
                cmd.strategy = LCB_REPLICA_ALL;
            } else {
                cmd.strategy = LCB_REPLICA_SELECT;
                cmd.index = std::atoi(replica_mode.c_str());
            }
            err = lcb_rget3(instance, this, &cmd);
        } else {
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
        }
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
TouchHandler::addOptions()
{
    Handler::addOptions();
    parser.addOption(o_exptime);
}

void
TouchHandler::run()
{
    Handler::run();
    lcb_install_callback3(instance, LCB_CALLBACK_TOUCH, (lcb_RESPCALLBACK)common_callback);
    const vector<string>& keys = parser.getRestArgs();
    lcb_error_t err;
    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < keys.size(); ++ii) {
        lcb_CMDTOUCH cmd = { 0 };
        const string& key = keys[ii];
        LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
        cmd.exptime = o_exptime.result();
        err = lcb_touch3(instance, this, &cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
SetHandler::addOptions()
{
    Handler::addOptions();
    parser.addOption(o_mode);
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

lcb_storage_t
SetHandler::mode()
{
    if (o_add.passed()) {
        return LCB_ADD;
    }

    string s = o_mode.const_result();
    std::transform(s.begin(), s.end(), s.begin(), ::tolower);
    if (s == "upsert") {
        return LCB_SET;
    } else if (s == "replace") {
        return LCB_REPLACE;
    } else if (s == "insert") {
        return LCB_ADD;
    } else if (s == "append") {
        return LCB_APPEND;
    } else if (s == "prepend") {
        return LCB_PREPEND;
    } else {
        throw BadArg(string("Mode must be one of upsert, insert, replace. Got ") + s);
        return LCB_SET;
    }
}

void
SetHandler::storeItem(const string& key, const char *value, size_t nvalue)
{
    lcb_error_t err;
    lcb_CMDSTOREDUR cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, key.c_str(), key.size());
    cmd.value.vtype = LCB_KV_COPY;
    cmd.value.u_buf.contig.bytes = value;
    cmd.value.u_buf.contig.nbytes = nvalue;
    cmd.operation = mode();

    if (o_json.result()) {
        cmd.datatype = LCB_VALUE_F_JSON;
    }
    if (o_exp.passed()) {
        cmd.exptime = o_exp.result();
    }
    if (o_flags.passed()) {
        cmd.flags = o_flags.result();
    }
    if (o_persist.passed() || o_replicate.passed()) {
        cmd.persist_to = o_persist.result();
        cmd.replicate_to = o_replicate.result();
        err = lcb_storedur3(instance, NULL, &cmd);
    } else {
        err = lcb_store3(instance, NULL, reinterpret_cast<lcb_CMDSTORE*>(&cmd));
    }
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
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
    lcb_install_callback3(instance, LCB_CALLBACK_STOREDUR, (lcb_RESPCALLBACK)store_callback);
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
        throw BadArg("create must be passed a single key");
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
}

void
HashHandler::run()
{
    Handler::run();

    lcbvb_CONFIG *vbc;
    lcb_error_t err;
    err = lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
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
        throw std::bad_alloc();
    }

    lcb_error_t err;
    for (size_t ii = 0; ii < keys.size(); ii++) {
        lcb_CMDOBSERVE cmd = { 0 };
        LCB_KREQ_SIMPLE(&cmd.key, keys[ii].c_str(), keys[ii].size());
        err = mctx->addcmd(mctx, (lcb_CMDBASE*)&cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }

    lcb_sched_enter(instance);
    err = mctx->done(mctx, NULL);
    if (err == LCB_SUCCESS) {
        lcb_sched_leave(instance);
        lcb_wait(instance);
    } else {
        lcb_sched_fail(instance);
        throw LcbError(err);
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
        throw LcbError(rc);
    }

    lcb_sched_enter(instance);

    for (size_t ii = 0; ii < infos.size(); ++ii) {
        const string& cur = infos[ii];
        unsigned vbid;
        unsigned long long uuid;
        int rv = sscanf(cur.c_str(), "%u,%llu", &vbid, &uuid);
        if (rv != 2) {
            throw BadArg("Must pass sequences of base10 vbid and base16 uuids");
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
                throw LcbError(rc);
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
        throw BadArg("Expect key-cas pairs. Argument list must be even");
    }

    lcb_sched_enter(instance);
    for (size_t ii = 0; ii < args.size(); ii += 2) {
        const string& key = args[ii];
        lcb_CAS cas;
        int rv;
        rv = sscanf(args[ii+1].c_str(), "0x%" PRIx64, &cas);
        if (rv != 1) {
            throw BadArg("CAS must be formatted as a hex string beginning with '0x'");
        }

        lcb_CMDUNLOCK cmd;
        memset(&cmd, 0, sizeof cmd);
        LCB_KREQ_SIMPLE(&cmd.key, key.c_str(), key.size());
        cmd.cas = cas;
        lcb_error_t err = lcb_unlock3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
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
        fprintf(stderr, "  IO: Default=%s, Current=%s, Accessible=",
            iops_to_string(info.v.v0.os_default), iops_to_string(info.v.v0.effective));
    }
    {
        size_t ii;
        char buf[256] = {0}, *p = buf;
        lcb_io_ops_type_t known_io[] = {
            LCB_IO_OPS_WINIOCP,
            LCB_IO_OPS_LIBEVENT,
            LCB_IO_OPS_LIBUV,
            LCB_IO_OPS_LIBEV,
            LCB_IO_OPS_SELECT
        };


        for (ii = 0; ii < sizeof(known_io) / sizeof(known_io[0]); ii++) {
            struct lcb_create_io_ops_st cio = {0};
            lcb_io_opt_t io = NULL;

            cio.v.v0.type = known_io[ii];
            if (lcb_create_io_ops(&io, &cio) == LCB_SUCCESS) {
                p += sprintf(p, "%s,", iops_to_string(known_io[ii]));
                lcb_destroy_io_ops(io);
            }
        }
        *(--p) = '\n';
        fprintf(stderr, "%s", buf);
    }

    if (lcb_supports_feature(LCB_SUPPORTS_SSL)) {
#ifdef LCB_NO_SSL
        printf("  SSL: SUPPORTED\n");
#else
#if defined(OPENSSL_VERSION)
        printf("  SSL Runtime: %s\n", OpenSSL_version(OPENSSL_VERSION));
#elif defined(SSLEAY_VERSION)
        printf("  SSL Runtime: %s\n", SSLeay_version(SSLEAY_VERSION));
#endif
        printf("  SSL Headers: %s\n", OPENSSL_VERSION_TEXT);
#endif
    } else {
        printf("  SSL: NOT SUPPORTED\n");
    }
    if (lcb_supports_feature(LCB_SUPPORTS_SNAPPY)) {
#define EXPAND(VAR)   VAR ## 1
#define IS_EMPTY(VAR) EXPAND(VAR)

#if defined(SNAPPY_MAJOR) && (IS_EMPTY(SNAPPY_MAJOR) != 1)
        printf("  Snappy: %d.%d.%d\n", SNAPPY_MAJOR, SNAPPY_MINOR, SNAPPY_PATCHLEVEL);
#else
        printf("  Snappy: unknown\n");
#endif
    } else {
        printf("  Snappy: NOT SUPPORTED\n");
    }
    printf("  Tracing: %sSUPPORTED\n", lcb_supports_feature(LCB_SUPPORTS_TRACING) ? "" : "NOT ");
    printf("  System: %s; %s\n", LCB_SYSTEM, LCB_SYSTEM_PROCESSOR);
    printf("  CC: %s; %s\n", LCB_C_COMPILER, LCB_C_FLAGS);
    printf("  CXX: %s; %s\n", LCB_CXX_COMPILER, LCB_CXX_FLAGS);
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
            throw LcbError(err);
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
        bool is_keystats = o_keystats.result();
        lcb_error_t err = lcb_stats3(instance, &is_keystats, &cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
WatchHandler::run()
{
    Handler::run();
    lcb_install_callback3(instance, LCB_CALLBACK_STATS, (lcb_RESPCALLBACK)watch_callback);
    vector<string> keys = parser.getRestArgs();
    if (keys.empty()) {
        keys.push_back("cmd_total_ops");
        keys.push_back("cmd_total_gets");
        keys.push_back("cmd_total_sets");
    }
    int interval = o_interval.result();

    map<string, int64_t> prev;

    bool first = true;
    while (true) {
        map<string, int64_t> entry;
        lcb_sched_enter(instance);
        lcb_CMDSTATS cmd = { 0 };
        lcb_error_t err = lcb_stats3(instance, (void *)&entry, &cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
        }
        lcb_sched_leave(instance);
        lcb_wait(instance);
        if (first) {
            for (vector<string>::iterator it = keys.begin(); it != keys.end(); ++it) {
                fprintf(stderr, "%s: %" PRId64 "\n", it->c_str(), entry[*it]);
            }
            first = false;
        } else {
#ifndef _WIN32
            if (isatty(STDERR_FILENO)) {
                fprintf(stderr, "\033[%dA", (int)keys.size());
            }
#endif
            for (vector<string>::iterator it = keys.begin(); it != keys.end(); ++it) {
                fprintf(stderr, "%s: %" PRId64 "%20s\n", it->c_str(), (entry[*it] - prev[*it]) / interval, "");
            }
        }
        prev = entry;
#ifdef _WIN32
        Sleep(interval * 1000);
#else
        sleep(interval);
#endif
    }
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
        throw BadArg("Verbosity level must be {detail,debug,info,warning}");
    }

    lcb_install_callback3(instance, LCB_CALLBACK_VERBOSITY, (lcb_RESPCALLBACK)common_server_callback);
    lcb_CMDVERBOSITY cmd = { 0 };
    cmd.level = level;
    lcb_error_t err;
    lcb_sched_enter(instance);
    err = lcb_server_verbosity3(instance, NULL, &cmd);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}

void
PingHandler::run()
{
    Handler::run();

    lcb_install_callback3(instance, LCB_CALLBACK_PING, (lcb_RESPCALLBACK)ping_callback);
    lcb_CMDPING cmd = { 0 };
    lcb_error_t err;
    cmd.services = LCB_PINGSVC_F_KV | LCB_PINGSVC_F_N1QL | LCB_PINGSVC_F_VIEWS | LCB_PINGSVC_F_FTS;
    cmd.options = LCB_PINGOPT_F_JSON | LCB_PINGOPT_F_JSONPRETTY;
    if (o_details.passed()) {
        cmd.options |= LCB_PINGOPT_F_JSONDETAILS;
    }
    lcb_sched_enter(instance);
    err = lcb_ping3(instance, NULL, &cmd);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
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
        throw LcbError(err);
    }
    lcb_sched_leave(instance);
    lcb_wait(instance);
}


extern "C" {
static void cbFlushCb(lcb_t, int, const lcb_RESPBASE *resp)
{
    if (resp->rc == LCB_SUCCESS) {
        fprintf(stderr, "Flush OK\n");
    } else {
        fprintf(stderr, "Flush failed: %s (0x%x)\n",
            lcb_strerror(NULL, resp->rc), resp->rc);
    }
}
}
void
BucketFlushHandler::run()
{
    Handler::run();
    lcb_CMDCBFLUSH cmd = { 0 };
    lcb_error_t err;
    lcb_install_callback3(instance, LCB_CALLBACK_CBFLUSH, cbFlushCb);
    err = lcb_cbflush3(instance, NULL, &cmd);
    if (err != LCB_SUCCESS) {
        throw LcbError(err);
    } else {
        lcb_wait(instance);
    }
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
        uint64_t delta = o_delta.result();
        if (delta > static_cast<uint64_t>(std::numeric_limits<int64_t>::max())) {
            throw BadArg("Delta too big");
        }
        cmd.delta = static_cast<int64_t>(delta);
        if (shouldInvert()) {
            cmd.delta *= -1;
        }
        cmd.exptime = o_expiry.result();
        lcb_error_t err = lcb_counter3(instance, NULL, &cmd);
        if (err != LCB_SUCCESS) {
            throw LcbError(err);
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
        throw BadArg("View must be in the format of design/view");
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
        throw LcbError(rc);
    }
    lcb_wait(instance);
}

static void
splitKvParam(const string& src, string& key, string& value)
{
    size_t pp = src.find('=');
    if (pp == string::npos) {
        throw BadArg("Param must be in the form of key=value");
    }

    key = src.substr(0, pp);
    value = src.substr(pp+1);
}

extern "C" {
static void n1qlCallback(lcb_t, int, const lcb_RESPN1QL *resp)
{
    if (resp->rflags & LCB_RESP_F_FINAL) {
        fprintf(stderr, "---> Query response finished\n");
        if (resp->rc != LCB_SUCCESS) {
            fprintf(stderr, "---> Query failed with library code 0x%x (%s)\n", resp->rc, lcb_strerror(NULL, resp->rc));
            if (resp->htresp) {
                fprintf(stderr, "---> Inner HTTP request failed with library code 0x%x and HTTP status %d\n",
                    resp->htresp->rc, resp->htresp->htstatus);
            }
        }
        if (resp->row) {
            printf("%.*s\n", (int)resp->nrow, resp->row);
        }
    } else {
        printf("%.*s,\n", (int)resp->nrow, resp->row);
    }
}
}

void
N1qlHandler::run()
{
    Handler::run();
    const string& qstr = getRequiredArg();

    lcb_N1QLPARAMS *nparams = lcb_n1p_new();
    lcb_error_t rc;

    rc = lcb_n1p_setquery(nparams, qstr.c_str(), -1, LCB_N1P_QUERY_STATEMENT);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }

    const vector<string>& vv_args = o_args.const_result();
    for (size_t ii = 0; ii < vv_args.size(); ii++) {
        string key, value;
        splitKvParam(vv_args[ii], key, value);
        string ktmp = "$" + key;
        rc = lcb_n1p_namedparamz(nparams, ktmp.c_str(), value.c_str());
        if (rc != LCB_SUCCESS) {
            throw LcbError(rc);
        }
    }

    const vector<string>& vv_opts = o_opts.const_result();
    for (size_t ii = 0; ii < vv_opts.size(); ii++) {
        string key, value;
        splitKvParam(vv_opts[ii], key, value);
        rc = lcb_n1p_setoptz(nparams, key.c_str(), value.c_str());
        if (rc != LCB_SUCCESS) {
            throw LcbError(rc);
        }
    }

    lcb_CMDN1QL cmd = { 0 };
    rc = lcb_n1p_mkcmd(nparams, &cmd);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }
    if (o_prepare.passed()) {
        cmd.cmdflags |= LCB_CMDN1QL_F_PREPCACHE;
    }
    if (o_analytics.passed()) {
        cmd.cmdflags |= LCB_CMDN1QL_F_CBASQUERY;
    }
    fprintf(stderr, "---> Encoded query: %.*s\n", (int)cmd.nquery, cmd.query);
    cmd.callback = n1qlCallback;
    rc = lcb_n1ql_query(instance, NULL, &cmd);
    if (rc != LCB_SUCCESS) {
        throw LcbError(rc);
    }
    lcb_n1p_free(nparams);
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
        throw LcbError(err);
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
        throw BadArg("Unrecognized method string");
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
    printf("%s\n", resbuf.c_str());
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
        throw BadArg("Unrecognized bucket type");
    }
    if (o_proxyport.passed() && o_bpass.passed()) {
        throw BadArg("Custom ASCII port is only available for auth-less buckets");
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

void
RbacHandler::run()
{
    fprintf(stderr, "Requesting %s\n", getURI().c_str());
    HttpBaseHandler::run();
    if (o_raw.result()) {
        printf("%s\n", resbuf.c_str());
    } else {
        format();
    }
}

void
RoleListHandler::format()
{
    Json::Value json;
    if (!Json::Reader().parse(resbuf, json)) {
        fprintf(stderr, "Failed to parse response as JSON, falling back to raw mode\n");
        printf("%s\n", resbuf.c_str());
    }

    std::map<string, string> roles;
    size_t max_width = 0;
    for (Json::Value::iterator i = json.begin(); i != json.end(); i++) {
        Json::Value role = *i;
        string role_id = role["role"].asString() + ": ";
        roles[role_id] = role["desc"].asString();
        if (max_width < role_id.size()) {
            max_width = role_id.size();
        }
    }
    for (map<string, string>::iterator i = roles.begin(); i != roles.end(); i++) {
        std::cout << std::left << std::setw(max_width) << i->first << i->second << std::endl;
    }
}

void
UserListHandler::format()
{
    Json::Value json;
    if (!Json::Reader().parse(resbuf, json)) {
        fprintf(stderr, "Failed to parse response as JSON, falling back to raw mode\n");
        printf("%s\n", resbuf.c_str());
    }

    map<string, map<string, string> > users;
    size_t max_width = 0;
    for (Json::Value::iterator i = json.begin(); i != json.end(); i++) {
        Json::Value user = *i;
        string domain = user["domain"].asString();
        string user_id = user["id"].asString();
        string user_name = user["name"].asString();
        if (!user_name.empty()) {
            user_id += " (" + user_name + "): ";
        }
        stringstream roles;
        Json::Value roles_ary = user["roles"];
        for (Json::Value::iterator j = roles_ary.begin(); j != roles_ary.end(); j++) {
            Json::Value role = *j;
            roles << "\n   - " << role["role"].asString();
            if (!role["bucket_name"].empty()) {
                roles << "[" << role["bucket_name"].asString() << "]";
            }
        }
        if (max_width < user_id.size()) {
            max_width = user_id.size();
        }
        users[domain][user_id] = roles.str();
    }
    if (!users["local"].empty()) {
        std::cout << "Local users:" << std::endl;
        int j = 1;
        for (map<string, string>::iterator i = users["local"].begin(); i != users["local"].end(); i++, j++) {
            std::cout << j << ". " << std::left << std::setw(max_width) << i->first << i->second << std::endl;
        }
    }
    if (!users["external"].empty()) {
        std::cout << "External users:" << std::endl;
        int j = 1;
        for (map<string, string>::iterator i = users["external"].begin(); i != users["external"].end(); i++, j++) {
            std::cout << j << ". " << std::left << std::setw(max_width) << i->first << i->second << std::endl;
        }
    }
}

void
UserUpsertHandler::run()
{
    stringstream ss;

    name = getRequiredArg();
    domain = o_domain.result();
    if (domain != "local" && domain != "external") {
        throw BadArg("Unrecognized domain type");
    }
    if (!o_roles.passed()) {
        throw BadArg("At least one role has to be specified");
    }
    std::vector<std::string> roles = o_roles.result();
    std::string roles_param;
    for (size_t ii = 0; ii < roles.size(); ii++) {
        if (roles_param.empty()) {
            roles_param += roles[ii];
        } else {
            roles_param += std::string(",") + roles[ii];
        }
    }
    ss << "roles=" << roles_param;
    if (o_full_name.passed()) {
        ss << "&name=" << o_full_name.result();
    }
    if (o_password.passed()) {
        ss << "&password=" << o_password.result();
    }
    body = ss.str();

    AdminHandler::run();
}

struct HostEnt {
    string protostr;
    string hostname;
    HostEnt(const std::string& host, const char *proto) {
        protostr = proto;
        hostname = host;
    }
    HostEnt(const std::string& host, const char* proto, int port) {
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
    lcb::Connspec spec;
    err = spec.parse(connstr_s.c_str(), &errmsg);
    if (err != LCB_SUCCESS) {
        throw BadArg(errmsg);
    }

    printf("Bucket: %s\n", spec.bucket().c_str());
    printf("Implicit port: %d\n", spec.default_port());
    string sslOpts;
    if (spec.sslopts() & LCB_SSL_ENABLED) {
        sslOpts = "ENABLED";
        if (spec.sslopts() & LCB_SSL_NOVERIFY) {
            sslOpts += "|NOVERIFY";
        }
    } else {
        sslOpts = "DISABLED";
    }
    printf("SSL: %s\n", sslOpts.c_str());

    printf("Boostrap Protocols: ");
    string bsStr;
    if (spec.is_bs_cccp()) {
        bsStr += "CCCP, ";
    }
    if (spec.is_bs_http()) {
        bsStr += "HTTP, ";
    }
    if (bsStr.empty()) {
        bsStr = "CCCP,HTTP";
    } else {
        bsStr.erase(bsStr.size()-1, 1);
    }
    printf("%s\n", bsStr.c_str());
    printf("Hosts:\n");
    vector<HostEnt> hosts;

    for (size_t ii = 0; ii < spec.hosts().size(); ++ii) {
        const lcb::Spechost *dh = &spec.hosts()[ii];
        lcb_U16 port = dh->port;
        if (!port) {
            port = spec.default_port();
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
            if (spec.sslopts()) {
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
    lcb::Connspec::Options::const_iterator it = spec.options().begin();
    for (; it != spec.options().end(); ++it) {
        printf("  %s=%s\n", it->first.c_str(), it->second.c_str());
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
        "touch",
        "observe",
        "observe-seqno",
        "incr",
        "decr",
        "mcflush",
        "hash",
        "lock",
        "unlock",
        "cp",
        "rm",
        "stats",
        // "verify,
        "version",
        "verbosity",
        "view",
        "query",
        "admin",
        "bucket-create",
        "bucket-delete",
        "bucket-flush",
        "role-list",
        "user-list",
        "user-upsert",
        "user-delete",
        "connstr",
        "write-config",
        "strerror",
        "ping",
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
                throw BadArg("Need decimal or hex code!");
            }
        }

        #define X(cname, code, cat, desc) \
        if (code == errcode) { \
            fprintf(stderr, "%s\n", #cname); \
            fprintf(stderr, "  Type: 0x%x\n", cat); \
            fprintf(stderr, "  Description: %s\n", desc); \
            return; \
        } \

        LCB_XERR(X)
        #undef X

        fprintf(stderr, "-- Error code not found in header. Trying runtime..\n");
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
    handlers_s["watch"] = new WatchHandler();
    handlers_s["verbosity"] = new VerbosityHandler();
    handlers_s["ping"] = new PingHandler();
    handlers_s["mcflush"] = new McFlushHandler();
    handlers_s["incr"] = new IncrHandler();
    handlers_s["decr"] = new DecrHandler();
    handlers_s["admin"] = new AdminHandler();
    handlers_s["bucket-create"] = new BucketCreateHandler();
    handlers_s["bucket-delete"] = new BucketDeleteHandler();
    handlers_s["bucket-flush"] = new BucketFlushHandler();
    handlers_s["view"] = new ViewsHandler();
    handlers_s["query"] = new N1qlHandler();
    handlers_s["connstr"] = new ConnstrHandler();
    handlers_s["write-config"] = new WriteConfigHandler();
    handlers_s["strerror"] = new StrErrorHandler();
    handlers_s["observe-seqno"] = new ObserveSeqnoHandler();
    handlers_s["touch"] = new TouchHandler();
    handlers_s["role-list"] = new RoleListHandler();
    handlers_s["user-list"] = new UserListHandler();
    handlers_s["user-upsert"] = new UserUpsertHandler();
    handlers_s["user-delete"] = new UserDeleteHandler();

    map<string,Handler*>::iterator ii;
    for (ii = handlers_s.begin(); ii != handlers_s.end(); ++ii) {
        handlers[ii->first] = ii->second;
    }

    handlers["cat"] = handlers["get"];
    handlers["n1ql"] = handlers["query"];
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
wrapExternalBinary(int argc, char **argv, const std::string& name)
{
#ifdef _POSIX_VERSION
    vector<char *> args;
    string exePath(argv[0]);
    size_t cbc_pos = exePath.find("cbc");

    if (cbc_pos == string::npos) {
        fprintf(stderr, "Failed to invoke %s (%s)\n", name.c_str(), exePath.c_str());
        exit(EXIT_FAILURE);
    }

    exePath.replace(cbc_pos, 3, name);
    args.push_back((char*)exePath.c_str());

    // { "cbc", "name" }
    argv += 2; argc -= 2;
    for (int ii = 0; ii < argc; ii++) {
        args.push_back(argv[ii]);
    }
    args.push_back((char*)NULL);
    execvp(exePath.c_str(), &args[0]);
    fprintf(stderr, "Failed to execute execute %s (%s): %s\n", name.c_str(), exePath.c_str(), strerror(errno));
#else
    fprintf(stderr, "Can't wrap around %s on non-POSIX environments", name.c_str());
#endif
    exit(EXIT_FAILURE);
}

static void cleanupHandlers()
{
    map<string,Handler*>::iterator iter = handlers_s.begin();
    for (; iter != handlers_s.end(); iter++) {
        delete iter->second;
    }
}

int main(int argc, char **argv)
{

    // Wrap external binaries immediately
    if (argc >= 2) {
        if (strcmp(argv[1], "pillowfight") == 0) {
            wrapExternalBinary(argc, argv, "cbc-pillowfight");
        } else if (strcmp(argv[1], "n1qlback") == 0) {
            wrapExternalBinary(argc, argv, "cbc-n1qlback");
        } else if (strcmp(argv[1], "subdoc") == 0) {
            wrapExternalBinary(argc, argv, "cbc-subdoc");
        } else if (strcmp(argv[1], "proxy") == 0) {
            wrapExternalBinary(argc, argv, "cbc-proxy");
        }
    }

    setupHandlers();
    std::atexit(cleanupHandlers);

    string cmdname;
    parseCommandname(cmdname, argc, argv);

    if (cmdname.empty()) {
        if (argc < 2) {
            fprintf(stderr, "Must provide an option name\n");
            try {
                HelpHandler().execute(argc, argv);
            } catch (std::exception& exc) {
                std::cerr << exc.what() << std::endl;
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

    } catch (std::exception& err) {
        fprintf(stderr, "%s\n", err.what());
        exit(EXIT_FAILURE);
    }
}
