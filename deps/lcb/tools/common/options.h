#ifndef CBC_OPTIONS_H
#define CBC_OPTIONS_H

#define CLIOPTS_ENABLE_CXX 1
#include <libcouchbase/couchbase.h>
#include "contrib/cliopts/cliopts.h"

namespace cbc {

#define X_OPTIONS(X) \
    X(String, host, "host", 'h') \
    X(String, bucket, "bucket", 'b') \
    X(String, passwd, "password", 'P') \
    X(String, user, "username", 'u') \
    X(String, transport, "bootstrap-protocol", 'C') \
    X(String, configcache, "config-cache", 'Z') \
    X(String, saslmech, "force-sasl-mech", 'S') \
    X(String, dsn, "dsn", '\0') \
    X(String, ssl, "ssl", '\0') \
    X(String, capath, "capath", '\0') \
    X(UInt, timeout, "timeout", 't') \
    X(Bool, timings, "timings", 'T') \
    X(Bool, verbose, "verbose", 'v')


class ConnParams {
public:
    ConnParams();
    void fillCropts(lcb_create_st&);
    void addToParser(cliopts::Parser& parser);
    lcb_error_t doCtls(lcb_t instance);
    bool useTimings() { return o_timings.result(); }
    void setAdminMode();

private:

#define X(tp, varname, longdesc, shortdesc) \
    cliopts::tp##Option o_##varname;

    X_OPTIONS(X)
#undef X
    std::string dsn;
    std::string bucket;
    std::string passwd;
    std::string host;
    bool isAdmin;
};

}

#endif
