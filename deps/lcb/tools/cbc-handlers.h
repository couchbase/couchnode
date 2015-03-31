#ifndef CBC_HANDLERS_H
#define CBC_HANDLERS_H
#include "config.h"
#include "common/options.h"
#include "common/histogram.h"

namespace cbc {
#define HANDLER_DESCRIPTION(s) const char* description() const { return s; }
#define HANDLER_USAGE(s) const char* usagestr() const { return s; }
class Handler {
public:
    Handler(const char *name);
    virtual ~Handler();
    virtual const char * description() const = 0;
    virtual const char * usagestr() const { return NULL; }
    void execute(int argc, char **argv);

protected:
    virtual const std::string& getLoneArg(bool required = false);
    virtual const std::string& getRequiredArg() { return getLoneArg(true); }
    virtual void addOptions();
    virtual void run();
    cliopts::Parser parser;
    ConnParams params;
    lcb_t instance;
    Histogram hg;
    std::string cmdname;
};


class GetHandler : public Handler {
public:
    GetHandler(const char *name = "get") :
        Handler(name), o_replica("replica"), o_exptime("expiry") {}

    const char* description() const {
        if (isLock()) {
            return "Lock keys and retrieve them from the cluster";
        } else {
            return "Retrieve items from the cluster";
        }
    }

protected:
    void addOptions();
    void run();

private:
    cliopts::StringOption o_replica;
    cliopts::UIntOption o_exptime;
    bool isLock() const { return cmdname == "lock"; }
};

class SetHandler : public Handler {
public:
    SetHandler(const char *name = "create") : Handler(name),
        o_flags("flags"), o_exp("expiry"), o_add("add"), o_persist("persist-to"),
        o_replicate("replicate-to"), o_value("value"), o_json("json") {

        o_flags.abbrev('f').description("Flags for item");
        o_exp.abbrev('e').description("Expiry for item");
        o_add.abbrev('a').description("Fail if item exists");
        o_persist.abbrev('p').description("Wait until item is persisted to this number of nodes");
        o_replicate.abbrev('r').description("Wait until item is replicated to this number of nodes");
        o_value.abbrev('V').description("Value to use. If unspecified, read from standard input");
        o_json.abbrev('J').description("Indicate to the server that this item is JSON");
    }

    const char* description() const {
        if (hasFileList()) {
            return "Store files to the server";
        } else {
            return "Store item to the server";
        }
    }

    const char* usagestr() const {
        if (hasFileList()) {
            return "[OPTIONS...] FILE ...";
        } else {
            return "[OPTIONS...] KEY -V VALUE";
        }
    }

    bool hasFileList() const { return cmdname == "cp"; }

protected:
    void run();
    void addOptions();
    void storeItem(const std::string& key, const char *value, size_t nvalue);
    void storeItem(const std::string& key, FILE *input);

private:
    cliopts::UIntOption o_flags;
    cliopts::UIntOption o_exp;
    cliopts::BoolOption o_add;
    cliopts::IntOption o_persist;
    cliopts::IntOption o_replicate;
    cliopts::StringOption o_value;
    cliopts::BoolOption o_json;
    std::map<std::string, lcb_cas_t> items;
};

class HashHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Get mapping information for keys")
    HANDLER_USAGE("KEY ... [OPTIONS ...]")
    HashHandler() : Handler("hash") {}
protected:
    void run();
};

class ObserveHandler : public Handler {
public:
    ObserveHandler() : Handler("observe") { }
    HANDLER_DESCRIPTION("Obtain persistence and replication status for keys")
    HANDLER_USAGE("KEY ... ")
protected:
    void run();
};

class ObserveSeqnoHandler : public Handler {
public:
    ObserveSeqnoHandler() : Handler("observe-seqno") {}

    HANDLER_DESCRIPTION("Request information about a particular vBucket UUID")
    HANDLER_USAGE("UUID")

protected:
    void run();
};

class UnlockHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Unlock keys")
    HANDLER_USAGE("KEY CAS [OPTIONS ...]")
    UnlockHandler() : Handler("unlock") {}
protected:
    void run();
};

class VersionHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Display information about libcouchbase")
    VersionHandler() : Handler("version") {}
    void run();
    void addOptions() {}
};

class RemoveHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Remove items from the cluster")
    HANDLER_USAGE("KEY ... [OPTIONS ...]")
    RemoveHandler() : Handler("rm") {}
protected:
    void run();
};

class StatsHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Retrieve cluster statistics")
    HANDLER_USAGE("[STATS_KEY ...] [OPTIONS ...]")
    StatsHandler() : Handler("stats"), o_keystats("keystats") {
        o_keystats.description("Keys are document IDs. retrieve information about them");
    }
protected:
    void run();
    void addOptions() {
        Handler::addOptions();
        parser.addOption(o_keystats);
    }
private:
    cliopts::BoolOption o_keystats;
};

class VerbosityHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Modify the memcached logging level")
    HANDLER_USAGE("<detail|debug|info|warning> [OPTIONS ...]")
    VerbosityHandler() : Handler("verbosity") {}
protected:
    void run();
};

class McFlushHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Flush a memcached bucket")
    McFlushHandler() : Handler("mcflush") {}
protected:
    void run();
};

class ArithmeticHandler : public Handler {
public:
    HANDLER_USAGE("KEY ... [OPTIONS ...]")

    ArithmeticHandler(const char *name) : Handler(name),
        o_initial("initial"), o_delta("delta"), o_expiry("expiry") {

        o_initial.description("Initial value if item does not exist");
        o_delta.setDefault(1);
        o_expiry.abbrev('e').description("Expiration time for key");
    }
protected:
    cliopts::UIntOption o_initial;
    cliopts::IntOption o_delta;
    cliopts::UIntOption o_expiry;
    void run();
    virtual int64_t getDelta() = 0;
    void addOptions() {
        Handler::addOptions();
        parser.addOption(o_initial);
        parser.addOption(o_delta);
        parser.addOption(o_expiry);
    }
};

class IncrHandler : public ArithmeticHandler {
public:
    HANDLER_DESCRIPTION("Increment a counter")
    IncrHandler() : ArithmeticHandler("incr") {
        o_delta.description("Amount to increment by");
    }
protected:
    int64_t getDelta() { return o_delta.result(); }
};

class DecrHandler : public ArithmeticHandler {
public:
    HANDLER_DESCRIPTION("Decrement a counter")
    DecrHandler() : ArithmeticHandler("decr") {
        o_delta.description("Amount to decrement by");
    }
protected:
    int64_t getDelta() { return o_delta.result() * -1; }
};

class ViewsHandler : public Handler {
public:
    ViewsHandler() : Handler("view"),
        o_spatial("spatial"), o_incdocs("with-docs"), o_params("params") {}

    HANDLER_DESCRIPTION("Query a view")
    HANDLER_USAGE("DESIGN/VIEW")

protected:
    void run();
    void addOptions() {
        Handler::addOptions();
        parser.addOption(o_spatial);
        parser.addOption(o_incdocs);
        parser.addOption(o_params);
    }
private:
    cliopts::BoolOption o_spatial;
    cliopts::BoolOption o_incdocs;
    cliopts::StringOption o_params;
};

class HttpReceiver {
public:
    HttpReceiver() : statusInvoked(false) {}
    virtual ~HttpReceiver() {}
    void maybeInvokeStatus(const lcb_RESPHTTP*);
    void install(lcb_t);
    virtual void handleStatus(lcb_error_t, int) {}
    virtual void onDone() {}
    virtual void onChunk(const char *data, size_t size) {
        resbuf.append(data, size);
    }
    bool statusInvoked;
    std::string resbuf;
    std::map<std::string, std::string> headers;
};

class HttpBaseHandler : public Handler, public HttpReceiver {
public:
    HttpBaseHandler(const char *name) : Handler(name) ,
        o_method("method") {

        o_method.setDefault("GET").abbrev('X').description("HTTP Method to use");
    }

protected:
    void run();
    virtual std::string getURI() = 0;
    virtual const std::string& getBody();
    virtual std::string getContentType() { return ""; }
    virtual bool isAdmin() const { return false; }
    virtual lcb_http_method_t getMethod();
    virtual void handleStatus(lcb_error_t err, int code);
    virtual void addOptions() {
        if (isAdmin()) {
            params.setAdminMode();
        }
        Handler::addOptions();
        parser.addOption(o_method);
    }
    cliopts::StringOption o_method;

private:
    std::string body_cached;
};

class AdminHandler : public HttpBaseHandler {
public:
    HANDLER_DESCRIPTION("Invoke an administrative REST API")
    HANDLER_USAGE("PATH ... [OPTIONS ...]")
    AdminHandler(const char *name = "admin") : HttpBaseHandler(name) {}
protected:
    virtual void run();
    virtual std::string getURI();
    virtual bool isAdmin() const { return true; }

};

class BucketCreateHandler : public AdminHandler {
public:
    HANDLER_DESCRIPTION("Create a bucket")
    HANDLER_USAGE("NAME [OPTIONS ...]")
    BucketCreateHandler() : AdminHandler("bucket-create"),
        o_btype("bucket-type"),
        o_ramquota("ram-quota"),
        o_bpass("bucket-password"),
        o_replicas("num-replicas"),
        o_proxyport("moxi-port"),
        isMemcached(false)
    {
        o_btype.description("Bucket type {couchbase,memcached}").setDefault("couchbase");
        o_ramquota.description("RAM Quota for bucket (MB)").setDefault(100);
        o_bpass.description("Bucket password");
        o_replicas.description("Number of replicas for bucket").setDefault(1);
        o_proxyport.description("[Compatibility] memcached listening port");

    }

protected:
    virtual void run();
    virtual void addOptions() {
        AdminHandler::addOptions();
        parser.addOption(o_btype);
        parser.addOption(o_ramquota);
        parser.addOption(o_bpass);
        parser.addOption(o_replicas);
        parser.addOption(o_proxyport);
    }

    std::string getURI() { return "/pools/default/buckets"; }
    const std::string& getBody() { return body_s; }
    std::string getContentType() { return "application/x-www-form-urlencoded"; }
    lcb_http_method_t getMethod() { return LCB_HTTP_METHOD_POST; }

private:
    cliopts::StringOption o_btype;
    cliopts::UIntOption o_ramquota;
    cliopts::StringOption o_bpass;
    cliopts::UIntOption o_replicas;
    cliopts::UIntOption o_proxyport;
    std::string body_s;
    bool isMemcached;
};

class BucketDeleteHandler : public AdminHandler {
public:
    HANDLER_DESCRIPTION("Delete a bucket")
    HANDLER_USAGE("NAME [OPTIONS ...]")
    BucketDeleteHandler() : AdminHandler("bucket-delete") {}

protected:
    void run() {
        bname = getRequiredArg();
        AdminHandler::run();
    }
    std::string getURI() { return std::string("/pools/default/buckets/") + bname; }
    lcb_http_method_t getMethod() { return LCB_HTTP_METHOD_DELETE; }
    const std::string& getBody() { static std::string e; return e; }
private:
    std::string bname;
};

class BucketFlushHandler : public AdminHandler {
public:
    HANDLER_DESCRIPTION("Flush a bucket")
    HANDLER_USAGE("NAME [OPTIONS ...]")
    BucketFlushHandler() : AdminHandler("bucket-flush") {}
protected:
    void run() {
        bname = getRequiredArg();
        AdminHandler::run();
    }
    std::string getURI() {
        std::string uri = "/pools/default/buckets/";
        uri += bname;
        uri += "/controller/doFlush";
        return uri;
    }
    lcb_http_method_t getMethod() { return LCB_HTTP_METHOD_POST; }
    const std::string& getBody() { static std::string e; return e; }

private:
    std::string bname;
};

class ConnstrHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Parse a connection string and provide info on its components")
    HANDLER_USAGE("CONNSTR")
    ConnstrHandler() : Handler("connstr") {}
protected:
    void handleOptions() { }
    void run();
};

class WriteConfigHandler : public Handler {
public:
    HANDLER_DESCRIPTION("Write the configuration file based on arguments passed")
    WriteConfigHandler() : Handler("write-config") {}
protected:
    void run();
};

}
#endif
