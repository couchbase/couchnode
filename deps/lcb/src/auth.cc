#include <libcouchbase/couchbase.h>
#include "auth-priv.h"

using namespace lcb;

lcb_AUTHENTICATOR *
lcbauth_new()
{
    return new Authenticator();
}

lcb_error_t
lcbauth_add_pass(lcb_AUTHENTICATOR *auth, const char *u, const char *p, int flags)
{
    return auth->add(u, p, flags);
}

lcb_error_t
Authenticator::add(const char *u, const char *p, int flags)
{
    if (!(flags & (LCBAUTH_F_BUCKET|LCBAUTH_F_CLUSTER))) {
        return LCB_EINVAL;
    }

    if (m_mode == LCBAUTH_MODE_RBAC && (flags & LCBAUTH_F_BUCKET)) {
        return LCB_OPTIONS_CONFLICT;
    }

    if (flags & LCBAUTH_F_CLUSTER) {
        if (p) {
            m_username = u;
            m_password = p;
        } else {
            m_username.clear();
            m_password.clear();
        }
    }

    if (flags & LCBAUTH_F_BUCKET) {
        if (p) {
            m_buckets[u] = p;
        } else {
            m_buckets.erase(u);
        }
    }

    return LCB_SUCCESS;
}

static const std::string EmptyString;

const std::string&
Authenticator::username_for(const char *bucket) const {
    if (m_mode == LCBAUTH_MODE_CLASSIC) {
        // Find bucket specific credentials:
        const Map::const_iterator it = m_buckets.find(bucket);
        if (it == m_buckets.end()) {
            return EmptyString;
        } else {
            return it->first;
        }
    } else {
        return m_username;
    }
}

const std::string&
Authenticator::password_for(const char *bucket) const {
    if (m_mode == LCBAUTH_MODE_CLASSIC) {
        const Map::const_iterator it = m_buckets.find(bucket);
        if (it == m_buckets.end()) {
            return EmptyString;
        } else {
            return it->second;
        }
    } else {
        return m_password;
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

Authenticator::Authenticator(const Authenticator& other)
    : m_buckets(other.m_buckets), m_username(other.m_username),
      m_password(other.m_password), m_refcount(1),
      m_mode(other.m_mode) {
}

lcb_AUTHENTICATOR *
lcbauth_clone(const lcb_AUTHENTICATOR *src) {
    return new Authenticator(*src);
}

lcb_error_t
lcbauth_set_mode(lcb_AUTHENTICATOR *src, lcbauth_MODE mode) {
    return src->set_mode(mode);
}
