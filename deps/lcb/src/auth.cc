/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2017-2020 Couchbase, Inc.
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

using namespace lcb;

lcb_AUTHENTICATOR *lcbauth_new()
{
    return new Authenticator{};
}

lcb_STATUS lcbauth_add_pass(lcb_AUTHENTICATOR *auth, const char *u, const char *p, int flags)
{
    return auth->add(u, p, flags);
}

lcb_STATUS Authenticator::add(const char *u, const char *p, int flags)
{
    if (!u) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    if (!(flags & (LCBAUTH_F_BUCKET | LCBAUTH_F_CLUSTER))) {
        return LCB_ERR_INVALID_ARGUMENT;
    }

    if (mode_ == LCBAUTH_MODE_RBAC && (flags & LCBAUTH_F_BUCKET)) {
        return LCB_ERR_OPTIONS_CONFLICT;
    }

    if (flags & LCBAUTH_F_CLUSTER) {
        if (p) {
            username_ = u;
            password_ = p;
        } else {
            username_.clear();
            password_.clear();
        }
    }

    if (flags & LCBAUTH_F_BUCKET) {
        if (p) {
            buckets_[u] = p;
        } else {
            buckets_.erase(u);
        }
    }

    return LCB_SUCCESS;
}

lcbauth_CREDENTIALS Authenticator::credentials_for(lcbauth_SERVICE service, lcbauth_REASON reason, const char *host,
                                                   const char *port, const char *bucket) const
{
    lcbauth_CREDENTIALS creds{};
    creds.reason(reason);
    creds.service(service);

    switch (mode_) {
        case LCBAUTH_MODE_RBAC:
            creds.username(username_);
            creds.password(password_);
            break;

        case LCBAUTH_MODE_DYNAMIC:
            if (callback_ == nullptr) {
                creds.result(LCBAUTH_RESULT_NOT_AVAILABLE);
            } else {
                if (host) {
                    creds.hostname(host);
                }
                if (port) {
                    creds.port(port);
                }
                if (bucket) {
                    creds.bucket(bucket);
                }
                creds.cookie(cookie_);
                callback_(&creds);
            }
            break;

        case LCBAUTH_MODE_CLASSIC:
            if (bucket) {
                const auto it = buckets_.find(bucket);
                if (it != buckets_.end()) {
                    creds.username(it->first);
                    creds.password(it->second);
                }
            } else {
                creds.result(LCBAUTH_RESULT_NOT_AVAILABLE);
            }
            break;
    }

    return creds;
}

void lcbauth_ref(lcb_AUTHENTICATOR *auth)
{
    auth->incref();
}

void lcbauth_unref(lcb_AUTHENTICATOR *auth)
{
    auth->decref();
}

lcb_AUTHENTICATOR *lcbauth_clone(const lcb_AUTHENTICATOR *src)
{
    return new Authenticator(*src);
}

lcb_STATUS lcbauth_set_mode(lcb_AUTHENTICATOR *src, lcbauth_MODE mode)
{
    return src->set_mode(mode);
}

lcb_STATUS lcbauth_set_callback(lcb_AUTHENTICATOR *auth, void *cookie, void (*callback)(lcbauth_CREDENTIALS *))
{
    return auth->set_callback(cookie, callback);
}

lcb_STATUS lcbauth_credentials_username(lcbauth_CREDENTIALS *credentials, const char *username, size_t username_len)
{
    credentials->username(std::string(username, username_len));
    return LCB_SUCCESS;
}

lcb_STATUS lcbauth_credentials_password(lcbauth_CREDENTIALS *credentials, const char *password, size_t password_len)
{
    credentials->password(std::string(password, password_len));
    return LCB_SUCCESS;
}

lcb_STATUS lcbauth_credentials_result(lcbauth_CREDENTIALS *credentials, lcbauth_RESULT result)
{
    credentials->result(result);
    return LCB_SUCCESS;
}

LIBCOUCHBASE_API lcbauth_SERVICE lcbauth_credentials_service(const lcbauth_CREDENTIALS *credentials)
{
    return credentials->service();
}

lcbauth_REASON lcbauth_credentials_reason(const lcbauth_CREDENTIALS *credentials)
{
    return credentials->reason();
}

lcb_STATUS lcbauth_credentials_hostname(const lcbauth_CREDENTIALS *credentials, const char **hostname,
                                        size_t *hostname_len)
{
    *hostname = credentials->hostname().c_str();
    *hostname_len = credentials->hostname().size();
    return LCB_SUCCESS;
}

lcb_STATUS lcbauth_credentials_port(const lcbauth_CREDENTIALS *credentials, const char **port, size_t *port_len)
{
    *port = credentials->port().c_str();
    *port_len = credentials->port().size();
    return LCB_SUCCESS;
}

lcb_STATUS lcbauth_credentials_bucket(const lcbauth_CREDENTIALS *credentials, const char **bucket, size_t *bucket_len)
{
    *bucket = credentials->bucket().c_str();
    *bucket_len = credentials->bucket().size();
    return LCB_SUCCESS;
}

lcb_STATUS lcbauth_credentials_cookie(const lcbauth_CREDENTIALS *credentials, void **cookie)
{
    *cookie = credentials->cookie();
    return LCB_SUCCESS;
}

lcb_STATUS lcbauth_set_callbacks(lcb_AUTHENTICATOR *, void *, lcb_AUTHCALLBACK, lcb_AUTHCALLBACK)
{
    return LCB_ERR_UNSUPPORTED_OPERATION;
}
