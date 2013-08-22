#include "couchbase_impl.h"
namespace Couchnode {

Handle<Object> CouchbaseImpl::createConstants()
{
    Handle<Object> o = Object::New();

#define XCONSTANTS(X) \
    X(LCB_CNTL_SET) \
    X(LCB_CNTL_GET) \
    X(LCB_CNTL_OP_TIMEOUT) \
    X(LCB_CNTL_DURABILITY_INTERVAL) \
    X(LCB_CNTL_DURABILITY_TIMEOUT) \
    X(LCB_CNTL_HTTP_TIMEOUT) \
    X(LCB_CNTL_VIEW_TIMEOUT) \
    X(LCB_CNTL_RBUFSIZE) \
    X(LCB_CNTL_WBUFSIZE) \
    X(LCB_CNTL_CONFIGURATION_TIMEOUT) \
    X(CNTL_COUCHNODE_VERSION) \
    X(CNTL_LIBCOUCHBASE_VERSION) \
    X(CNTL_CLNODES) \
    X(CNTL_RESTURI) \
    X(ErrorCode::MEMORY) \
    X(ErrorCode::ARGUMENTS) \
    X(ErrorCode::SCHEDULING) \
    X(ErrorCode::CHECK_RESULTS) \
    X(ErrorCode::GENERIC)

#define X(n) \
    o->Set(String::NewSymbol(#n), Integer::New(n));
    XCONSTANTS(X)
#undef X

#define XERR(X) \
    X(SUCCESS) \
    X(AUTH_CONTINUE) \
    X(AUTH_ERROR) \
    X(DELTA_BADVAL) \
    X(E2BIG) \
    X(EBUSY) \
    X(ENOMEM) \
    X(ERANGE) \
    X(ERROR) \
    X(ETMPFAIL) \
    X(EINVAL) \
    X(CLIENT_ETMPFAIL) \
    X(KEY_EEXISTS) \
    X(KEY_ENOENT) \
    X(DLOPEN_FAILED) \
    X(DLSYM_FAILED) \
    X(NETWORK_ERROR) \
    X(NOT_MY_VBUCKET) \
    X(NOT_STORED) \
    X(NOT_SUPPORTED) \
    X(UNKNOWN_COMMAND) \
    X(UNKNOWN_HOST) \
    X(PROTOCOL_ERROR) \
    X(ETIMEDOUT) \
    X(BUCKET_ENOENT) \
    X(CLIENT_ENOMEM) \
    X(CONNECT_ERROR) \
    X(EBADHANDLE) \
    X(SERVER_BUG) \
    X(PLUGIN_VERSION_MISMATCH) \
    X(INVALID_HOST_FORMAT) \
    X(INVALID_CHAR) \
    X(DURABILITY_ETOOMANY) \
    X(DUPLICATE_COMMANDS) \
    X(EINTERNAL) \
    X(NO_MATCHING_SERVER) \
    X(BAD_ENVIRONMENT) \
    \
    X(HTTP_TYPE_VIEW) \
    X(HTTP_TYPE_MANAGEMENT) \
    X(HTTP_METHOD_GET) \
    X(HTTP_METHOD_PUT) \
    X(HTTP_METHOD_DELETE)

#define X(n) \
    o->Set(String::NewSymbol("LCB_"#n), Integer::New(LCB_##n));
    XERR(X)
#undef X
    return o;
}



};
