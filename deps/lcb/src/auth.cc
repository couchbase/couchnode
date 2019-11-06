/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017-2018 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#include <libcouchbase/couchbase.h>
#include "auth-priv.h"
#include <sstream>

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
    if (!u) {
        return LCB_EINVAL;
    }

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

std::string cache_key(const char *host, const char *port, const char *bucket) {
    std::stringstream key;
    key << ":" << (host ? host : "?nullhost?");
    key << ":" << (port ? port : "?nullport?");
    key << ":" << (bucket ? bucket : "?nullbucket?");
    return key.str();
}

const std::string Authenticator::username_for(const char *host, const char *port, const char *bucket)
{
    switch (m_mode) {
        case LCBAUTH_MODE_RBAC:
            return m_username;
        case LCBAUTH_MODE_DYNAMIC:
            if (m_usercb != NULL) {
                std::string key = cache_key(host, port, bucket);
                if (user_cache_.find(key) == user_cache_.end()) {
                    std::string username = m_usercb(m_cookie, host, port, bucket);
                    user_cache_[key] = username;
                    return username;
                } else {
                    return user_cache_[key];
                }
            }
            break;
        case LCBAUTH_MODE_CLASSIC:
            // Find bucket specific credentials:
            const Map::const_iterator it = m_buckets.find(bucket);
            if (it != m_buckets.end()) {
                return it->first;
            }
            break;
    }
    return EmptyString;
}

const std::string Authenticator::password_for(const char *host, const char *port, const char *bucket)
{
    switch (m_mode) {
        case LCBAUTH_MODE_RBAC:
            return m_password;
        case LCBAUTH_MODE_DYNAMIC:
            if (m_passcb != NULL) {
                std::string key = cache_key(host, port, bucket);
                if (pass_cache_.find(key) == pass_cache_.end()) {
                    std::string password = m_passcb(m_cookie, host, port, bucket);
                    pass_cache_[key] = password;
                    return password;
                } else {
                    return pass_cache_[key];
                }
            }
            break;
        case LCBAUTH_MODE_CLASSIC:
            const Map::const_iterator it = m_buckets.find(bucket);
            if (it != m_buckets.end()) {
                return it->second;
            }
            break;
    }
    return EmptyString;
}

void Authenticator::invalidate_cache_for(const char *host, const char *port, const char *bucket)
{
    if (m_mode == LCBAUTH_MODE_DYNAMIC) {
        std::string key = cache_key(host, port, bucket);
        pass_cache_.erase(key);
        user_cache_.erase(key);
    }
}

void Authenticator::reset_cache()
{
    pass_cache_.clear();
    user_cache_.clear();
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

Authenticator::Authenticator(const Authenticator &other)
    : m_buckets(other.m_buckets), m_username(other.m_username), m_password(other.m_password), m_refcount(1),
      m_mode(other.m_mode), m_usercb(other.m_usercb), m_passcb(other.m_passcb), m_cookie(other.m_cookie),
      user_cache_(), pass_cache_()
{
}

lcb_AUTHENTICATOR *
lcbauth_clone(const lcb_AUTHENTICATOR *src) {
    return new Authenticator(*src);
}

lcb_error_t
lcbauth_set_mode(lcb_AUTHENTICATOR *src, lcbauth_MODE mode) {
    return src->set_mode(mode);
}

lcb_error_t lcbauth_set_callbacks(lcb_AUTHENTICATOR *auth, void *cookie, lcb_AUTHCALLBACK usercb,
                                  lcb_AUTHCALLBACK passcb)
{
    return auth->set_callbacks(cookie, usercb, passcb);
}
