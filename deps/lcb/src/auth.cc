#include <libcouchbase/couchbase.h>
#include "auth.h"

using namespace lcb;

lcb_AUTHENTICATOR *
lcbauth_new()
{
    return new Authenticator();
}

void
lcbauth_free(lcb_AUTHENTICATOR *auth)
{
    delete auth;
}

const char *
lcbauth_get_bpass(const lcb_AUTHENTICATOR *auth, const char *u)
{
    Authenticator::Map::const_iterator ii = auth->m_buckets.find(u);
    if (ii == auth->m_buckets.end()) {
        return NULL;
    }
    return ii->second.c_str();
}

void
lcbauth_set(lcb_AUTHENTICATOR *auth, const char *u, const char *p,
    int is_global)
{
    if (is_global) {
        auth->m_username = u;
        auth->m_password = p;
    } else {
        auth->m_buckets[u] = p;
    }
}

void
lcb_authenticator_clear(lcb_AUTHENTICATOR *auth)
{
    auth->m_buckets.clear();
}

void
lcbauth_get_upass(const lcb_AUTHENTICATOR *auth, const char **u, const char **p)
{
    if (!auth->m_username.empty()) {
        *u = auth->m_username.c_str();
    } else {
        *u = NULL;
    }
    if (!auth->m_password.empty()) {
        *p = auth->m_password.c_str();
    } else {
        *p = NULL;
    }
}

lcb_error_t
Authenticator::init(const std::string& username_, const std::string& bucket,
    const std::string& passwd, lcb_type_t conntype)
{
    m_username = (!username_.empty()) ? username_ : bucket;
    m_password = passwd;

    if (conntype == LCB_TYPE_BUCKET && m_username != bucket) {
        return LCB_INVALID_USERNAME;
    }

    m_buckets[bucket] = m_password;
    return LCB_SUCCESS;
}
