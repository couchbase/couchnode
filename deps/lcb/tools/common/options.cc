#include "options.h"
#include <stdexcept>
#include <iostream>
#include <sstream>

using namespace cbc;
using namespace cliopts;
using std::string;

static void
makeLowerCase(string &s)
{
    for (size_t ii = 0; ii < s.size(); ++ii) {
        s[ii] = tolower(s[ii]);
    }
}

#define X(tpname, varname, longname, shortname) o_##varname(longname),
ConnParams::ConnParams() :
        X_OPTIONS(X)
        bucket(""),
        isAdmin(false)
{
    // Configure the options
    #undef X
    #define X(tpname, varname, longname, shortname) \
    o_##varname.abbrev(shortname);
    X_OPTIONS(X)
    #undef X

    o_host.description("Hostname to connect to").setDefault("localhost");
    o_bucket.description("Bucket to use").setDefault("default");
    o_user.description("Username (currently unused)");
    o_passwd.description("Bucket password");
    o_saslmech.description("Force SASL mechanism").argdesc("PLAIN|CRAM_MD5");
    o_timings.description("Enable command timings");
    o_timeout.description("Operation timeout");
    o_transport.description("Bootstrap protocol").argdesc("HTTP|CCCP_BOTH").setDefault("BOTH");
    o_configcache.description("Path to cached configuration");
    o_ssl.description("Enable SSL settings").argdesc("ON|OFF|NOVERIFY").setDefault("off");
    o_capath.description("Path to server CA certificate");
    o_verbose.description("Set debugging output (specify multiple times for greater verbosity");
}

void
ConnParams::setAdminMode()
{
    o_passwd.mandatory(true);
    o_user.description("Administrative username").setDefault("Administrator");
    o_passwd.description("Administrative password");
    isAdmin = true;
}

void
ConnParams::addToParser(Parser& parser)
{
    #define X(tp, varname, longname, shortname) parser.addOption(o_##varname);
    X_OPTIONS(X)
    #undef X
}

void
ConnParams::fillCropts(lcb_create_st& cropts)
{
    host = o_host.result();
    bucket = o_bucket.result();
    passwd = o_passwd.result();
    for (size_t ii = 0; ii < host.size(); ++ii) {
        if (host[ii] == ';') {
            host[ii] = ',';
        }
    }

    if (o_dsn.passed()) {
        dsn = o_dsn.const_result();
        if (dsn.find('?') == string::npos) {
            dsn += '?';
        } else if (dsn[dsn.size()-1] != '&') {
            dsn += '&';
        }
    } else {
        dsn = "couchbase://";
        dsn += host;
        dsn += "/";
        dsn += o_bucket.const_result();
        dsn += "?";
    }
    if (o_capath.passed()) {
        dsn += "capath=";
        dsn += o_capath.result();
        dsn += '&';
    }
    if (o_ssl.passed()) {
        dsn += "ssl=";
        dsn += o_ssl.result();
        dsn += '&';
    }
    if (o_transport.passed()) {
        dsn += "boostrap_on=";
        string tmp = o_transport.result();
        makeLowerCase(tmp);
        dsn += tmp;
        dsn += '&';
    }
    if (o_timeout.passed()) {
        dsn += "operation_timeout=";
        std::stringstream ss;
        ss << std::dec << o_timeout.result();
        dsn += ss.str();
        dsn += '&';
    }
    if (o_configcache.passed()) {
        dsn += "config_cache=";
        dsn += o_configcache.result();
        dsn += '&';
    }
    if (isAdmin) {
        dsn += "username=";
        dsn += o_user.const_result();
        dsn += '&';
    }

    int vLevel = 1;
    if (o_verbose.passed()) {
        vLevel += o_verbose.numSpecified();
        std::stringstream ss;
        ss << std::dec << vLevel;
        dsn += "console_log_level=";
        dsn += ss.str();
        dsn += '&';
    }

    cropts.version = 3;
    cropts.v.v3.passwd = passwd.c_str();
    cropts.v.v3.dsn = dsn.c_str();
    if (isAdmin) {
        cropts.v.v3.type = LCB_TYPE_CLUSTER;
    } else {
        cropts.v.v3.type = LCB_TYPE_BUCKET;
    }
}



template <typename T>
void doPctl(lcb_t instance, int cmd, T arg)
{
    lcb_error_t err;
    err = lcb_cntl(instance, LCB_CNTL_SET, cmd, (void*)arg);
    if (err != LCB_SUCCESS) {
        throw err;
    }
}

template <typename T>
void doSctl(lcb_t instance, int cmd, T arg)
{
    doPctl<T*>(instance, cmd, &arg);
}

void doStringCtl(lcb_t instance, const char *s, const char *val)
{
    lcb_error_t err;
    err = lcb_cntl_string(instance, s, val);
    if (err != LCB_SUCCESS) {
        throw err;
    }
}

lcb_error_t
ConnParams::doCtls(lcb_t instance)
{
    try {
        if (o_saslmech.passed()) {
            doPctl<const char *>(instance,LCB_CNTL_FORCE_SASL_MECH, o_saslmech.result().c_str());
        }
    } catch (lcb_error_t &err) {
        return err;
    }
    return LCB_SUCCESS;
}
