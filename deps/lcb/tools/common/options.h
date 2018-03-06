#ifndef CBC_OPTIONS_H
#define CBC_OPTIONS_H

#define CLIOPTS_ENABLE_CXX 1
#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <exception>
#include <stdexcept>
#include <sstream>
#include "contrib/cliopts/cliopts.h"

#define CBC_CONFIG_FILENAME ".cbcrc"
#define CBC_WIN32_APPDIR "Couchbase CBC Utility"

namespace cbc {

#define X_OPTIONS(X) \
    X(String, host, "host", 'h') \
    X(String, bucket, "bucket", 'b') \
    X(String, passwd, "password", 'P') \
    X(String, user, "username", 'u') \
    X(String, transport, "bootstrap-protocol", 'C') \
    X(String, configcache, "config-cache", 'Z') \
    X(String, saslmech, "force-sasl-mech", 'S') \
    X(String, connstr, "spec", 'U') \
    X(String, ssl, "ssl", '\0') \
    X(String, truststorepath, "truststorepath", '\0') \
    X(String, certpath, "certpath", '\0') \
    X(String, keypath, "keypath", '\0') \
    X(UInt, timeout, "timeout", '\0') \
    X(Bool, timings, "timings", 'T') \
    X(Bool, verbose, "verbose", 'v') \
    X(Bool, dump, "dump", '\0') \
    X(Bool, compress, "compress", 'y') \
    X(List, cparams, "cparam", 'D')


class LcbError : public std::runtime_error {
private:
    static std::string format_err(lcb_error_t err, std::string msg) {
        std::stringstream ss;
        if (!msg.empty()) {
            ss << msg << ". ";
        }
        ss << "libcouchbase error: " << lcb_strerror(NULL, err);
        ss << " (0x" << std::hex << err << ")";
        return ss.str();
    }

public:
    lcb_error_t rc;
    LcbError(lcb_error_t code, std::string msg = "") : std::runtime_error(format_err(code, msg)) {}
};

class BadArg : public std::runtime_error {
public:
    BadArg(std::string w) : std::runtime_error(w) {}
};

class ConnParams {
public:
    ConnParams();
    void fillCropts(lcb_create_st&);
    void addToParser(cliopts::Parser& parser);
    lcb_error_t doCtls(lcb_t instance);
    bool useTimings() { return o_timings.result(); }
    int numTimings() { return o_timings.numSpecified(); }
    cliopts::BoolOption& getTimings() { return o_timings; }
    void setAdminMode();
    bool shouldDump() { return o_dump.result(); }
    void writeConfig(const std::string& dest = getConfigfileName());
    static std::string getUserHome();
    static std::string getConfigfileName();

private:

#define X(tp, varname, longdesc, shortdesc) \
    cliopts::tp##Option o_##varname;

    X_OPTIONS(X)
#undef X
    std::string connstr;
    std::string passwd;
    bool isAdmin;
    bool loadFileDefaults();
};

}

#endif
