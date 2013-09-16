#include "couchbase_impl.h"
namespace Couchnode {

/**
 * Because some of these values are macros themselves, just use a function
 * and stringify in place
 */
static void define_constant(Handle<Object> target, const char *k, int n)
{
    target->Set(String::NewSymbol(k), Number::New(n),
                static_cast<v8::PropertyAttribute>(v8::ReadOnly|v8::DontDelete));
}

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
    X(LCB_CNTL_VBMAP) \
    X(CNTL_COUCHNODE_VERSION) \
    X(CNTL_LIBCOUCHBASE_VERSION) \
    X(CNTL_CLNODES) \
    X(CNTL_RESTURI) \
    X(ErrorCode::MEMORY) \
    X(ErrorCode::ARGUMENTS) \
    X(ErrorCode::SCHEDULING) \
    X(ErrorCode::CHECK_RESULTS) \
    X(ErrorCode::GENERIC) \
    X(ErrorCode::DURABILITY_FAILED) \
    X(ValueFormat::AUTO) \
    X(ValueFormat::RAW) \
    X(ValueFormat::UTF8) \
    X(ValueFormat::JSON)

#define X(n) \
    define_constant(o, #n, n);
    XCONSTANTS(X)
#undef X

#define XERR(X) \
    X(LCB_SUCCESS) \
    X(LCB_AUTH_CONTINUE) \
    X(LCB_AUTH_ERROR) \
    X(LCB_DELTA_BADVAL) \
    X(LCB_E2BIG) \
    X(LCB_EBUSY) \
    X(LCB_ENOMEM) \
    X(LCB_ERANGE) \
    X(LCB_ERROR) \
    X(LCB_ETMPFAIL) \
    X(LCB_EINVAL) \
    X(LCB_CLIENT_ETMPFAIL) \
    X(LCB_KEY_EEXISTS) \
    X(LCB_KEY_ENOENT) \
    X(LCB_DLOPEN_FAILED) \
    X(LCB_DLSYM_FAILED) \
    X(LCB_NETWORK_ERROR) \
    X(LCB_NOT_MY_VBUCKET) \
    X(LCB_NOT_STORED) \
    X(LCB_NOT_SUPPORTED) \
    X(LCB_UNKNOWN_COMMAND) \
    X(LCB_UNKNOWN_HOST) \
    X(LCB_PROTOCOL_ERROR) \
    X(LCB_ETIMEDOUT) \
    X(LCB_BUCKET_ENOENT) \
    X(LCB_CLIENT_ENOMEM) \
    X(LCB_CONNECT_ERROR) \
    X(LCB_EBADHANDLE) \
    X(LCB_SERVER_BUG) \
    X(LCB_PLUGIN_VERSION_MISMATCH) \
    X(LCB_INVALID_HOST_FORMAT) \
    X(LCB_INVALID_CHAR) \
    X(LCB_DURABILITY_ETOOMANY) \
    X(LCB_DUPLICATE_COMMANDS) \
    X(LCB_EINTERNAL) \
    X(LCB_NO_MATCHING_SERVER) \
    X(LCB_BAD_ENVIRONMENT) \
    \
    X(LCB_HTTP_TYPE_VIEW) \
    X(LCB_HTTP_TYPE_MANAGEMENT) \
    X(LCB_HTTP_METHOD_GET) \
    X(LCB_HTTP_METHOD_PUT) \
    X(LCB_HTTP_METHOD_DELETE)

#define X(n) \
    define_constant(o, #n, n);
    XERR(X)
#undef X
    return o;
}



};
