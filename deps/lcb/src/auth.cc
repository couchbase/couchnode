#include <libcouchbase/couchbase.h>
#include "auth-priv.h"

using namespace lcb;

lcb_AUTHENTICATOR *
lcbauth_new()
{
    return new Authenticator();
}

const char *
lcbauth_get_bpass(const lcb_AUTHENTICATOR *auth, const char *u)
{
    Authenticator::Map::const_iterator ii = auth->buckets().find(u);
    if (ii == auth->buckets().end()) {
        return NULL;
    }
    return ii->second.c_str();
}

lcb_error_t
lcbauth_add_pass(lcb_AUTHENTICATOR *auth, const char *u, const char *p, int flags)
{
    return auth->add(u, p, flags);
}

lcb_error_t
Authenticator::add(const char *u, const char *p, int flags)
{
    if (!flags) {
        return LCB_EINVAL;
    }

    if (flags & LCBAUTH_F_CLUSTER) {
        if (!p) {
            m_username.clear();
            m_password.clear();
        } else {
            m_username = u;
            m_password = p;
        }
    }
    if (flags & LCBAUTH_F_BUCKET) {
        if (!p) {
            m_buckets.erase(u);
        } else {
            m_buckets[u] = p;
        }
    }
    return LCB_SUCCESS;
}

void
lcbauth_get_upass(const lcb_AUTHENTICATOR *auth, const char **u, const char **p)
{
    if (!auth->username().empty()) {
        *u = auth->username().c_str();
        *p = auth->password().empty() ? NULL : auth->password().c_str();

    } else if (!auth->buckets().empty()) {
        Authenticator::Map::const_iterator it = auth->buckets().begin();
        *u = it->first.c_str();
        if (!it->second.empty()) {
            *p = it->second.c_str();
        } else {
            *p = NULL;
        }
    } else {
        *u = *p = NULL;
    }
}

void
lcbauth_ref(lcb_AUTHENTICATOR *auth)
{
    auth->incref();
}

void
lcbauth_unref(lcb_AUTHENTICATOR *auth)
{
    auth->decref();
}

lcb_error_t
Authenticator::init(const std::string& username_, const std::string& bucket,
    const std::string& passwd, lcb_type_t conntype)
{
    m_username = (!username_.empty()) ? username_ : bucket;
    m_password = passwd;

    m_buckets[bucket] = m_password;
    return LCB_SUCCESS;
}

Authenticator::Authenticator(const Authenticator& other)
    : m_buckets(other.m_buckets), m_username(other.m_username),
      m_password(other.m_password), m_refcount(1) {
}

lcb_AUTHENTICATOR *
lcbauth_clone(const lcb_AUTHENTICATOR *src) {
    return new Authenticator(*src);
}
