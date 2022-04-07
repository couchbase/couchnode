/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014-2020 Couchbase, Inc.
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

#include <algorithm>
#include <string>
#include <sstream>
#include <vector>

#include "packetutils.h"
#include "mcserver.h"
#include "logging.h"
#include "settings.h"
#include <lcbio/lcbio.h>
#include <lcbio/timer-ng.h>
#include <lcbio/ssl.h>
#include <cbsasl/cbsasl.h>
#include "negotiate.h"
#include "ctx-log-inl.h"
#include "auth-priv.h"

using namespace lcb;

#define LOGARGS(ctx, lvl) ctx->settings, "negotiation", LCB_LOG_##lvl, __FILE__, __LINE__
static void cleanup_negotiated(SessionInfo *info);
static void handle_ioerr(lcbio_CTX *ctx, lcb_STATUS err);

#define LOGFMT CTX_LOGFMT_PRE ",SASLREQ=%p) "
#define LOGID(s) CTX_LOGID(s->ctx), (void *)s

static void timeout_handler(void *arg);

static void close_cb(lcbio_SOCKET *s, int reusable, void *arg)
{
    *(lcbio_SOCKET **)arg = s;
    lcbio_ref(s);
    lcb_assert(reusable);
}

/**
 * Structure used only for initialization. This is only used for the duration
 * of the request for negotiation and is deleted once negotiation has
 * completed (or failed).
 */
class lcb::SessionRequestImpl : public SessionRequest
{
  public:
    static SessionRequestImpl *get(void *arg)
    {
        return reinterpret_cast<SessionRequestImpl *>(arg);
    }

    bool setup(const lcbio_NAMEINFO &nistrs, const lcb_host_t &host, const lcb::Authenticator &auth);
    void start(lcbio_SOCKET *sock);
    void send_list_mechs() const;
    std::string generate_agent_json() const;
    bool send_hello();
    bool send_step(const lcb::MemcachedResponse &packet);
    bool check_auth(const lcb::MemcachedResponse &packet);
    bool read_hello(const lcb::MemcachedResponse &packet);
    void send_auth(const char *sasl_data, unsigned ndata) const;
    void handle_read(lcbio_CTX *ioctx);
    bool maybe_select_bucket();

    enum MechStatus { MECH_UNAVAILABLE, MECH_NOT_NEEDED, MECH_OK };
    MechStatus set_chosen_mech(std::string &mechlist, const char **data, unsigned int *ndata);
    bool request_errmap() const;
    bool update_errmap(const lcb::MemcachedResponse &packet);

    SessionRequestImpl(lcbio_CONNDONE_cb callback, void *data, uint32_t timeout, lcbio_TABLE *iot,
                       lcb_settings *settings_)
        : ctx(nullptr), cb(callback), cbdata(data), timer(lcbio_timer_new(iot, this, timeout_handler)),
          last_err(LCB_SUCCESS), info(nullptr), settings(settings_)
    {

        if (timeout) {
            lcbio_timer_rearm(timer, timeout);
        }
        memset(&u_auth, 0, sizeof(u_auth));
    }

    ~SessionRequestImpl() override;

    void cancel() override
    {
        cb = nullptr;
        delete this;
    }

    void fail()
    {
        if (cb != nullptr) {
            cb(nullptr, cbdata, last_err, 0);
            cb = nullptr;
        }
        delete this;
    }

    void fail(lcb_STATUS error, const char *msg)
    {
        set_error(error, msg);
        if (error == LCB_ERR_AUTHENTICATION_FAILURE) {
            settings->auth->credentials_for(LCBAUTH_SERVICE_KEY_VALUE, LCBAUTH_REASON_AUTHENTICATION_FAILURE,
                                            host_.host, host_.port, settings->bucket);
        }
        fail();
    }

    void success()
    {
        /** Dislodge the connection, and return it back to the caller */
        lcbio_SOCKET *s;

        lcbio_ctx_close(ctx, close_cb, &s);
        ctx = nullptr;

        lcbio_protoctx_add(s, info);
        info = nullptr;

        /** Invoke the callback, marking it a success */
        cb(s, cbdata, LCB_SUCCESS, 0);
        lcbio_unref(s)

            delete this;
    }

    void set_error(lcb_STATUS error, const char *msg, const lcb::MemcachedResponse *packet = nullptr)
    {
        char *err_ref = nullptr, *err_ctx = nullptr;
        if (packet) {
            MemcachedResponse::parse_enhanced_error(packet->value(), packet->vallen(), &err_ref, &err_ctx);
        }
        if (err_ref || err_ctx) {
            std::stringstream emsg;
            if (err_ref) {
                emsg << "ref: \"" << err_ref << "\"";
            }
            if (err_ctx) {
                if (err_ref) {
                    emsg << ", ";
                }
                emsg << "context: \"" << err_ctx << "\"";
            }
            lcb_log(LOGARGS(this, ERR), LOGFMT "Error: 0x%x, %s (%s)", LOGID(this), error, msg, emsg.str().c_str());
            free(err_ref);
            free(err_ctx);
        } else {
            lcb_log(LOGARGS(this, ERR), LOGFMT "Error: 0x%x, %s", LOGID(this), error, msg);
        }
        if (last_err == LCB_SUCCESS) {
            last_err = error;
        }
    }

    bool has_error() const
    {
        return last_err != LCB_SUCCESS;
    }

    union {
        cbsasl_secret_t secret;
        char buffer[256];
    } u_auth{};
    std::string username;

    lcbio_CTX *ctx;
    lcbio_CONNDONE_cb cb;
    void *cbdata;
    lcbio_pTIMER timer;
    lcb_STATUS last_err;
    cbsasl_conn_t *sasl_client{};
    SessionInfo *info;
    lcb_settings *settings;
    lcb_host_t host_{};
    bool expecting_error_map{false};
};

static void handle_read(lcbio_CTX *ioctx, unsigned)
{
    SessionRequestImpl::get(lcbio_ctx_data(ioctx))->handle_read(ioctx);
}

static int sasl_get_username(void *context, int id, const char **result, unsigned int *len)
{
    SessionRequestImpl *ctx = SessionRequestImpl::get(context);
    if (!context || !result || (id != CBSASL_CB_USER && id != CBSASL_CB_AUTHNAME)) {
        return SASL_BADPARAM;
    }

    *result = ctx->username.c_str();
    *len = ctx->username.size();

    return SASL_OK;
}

static int sasl_get_password(cbsasl_conn_t *conn, void *context, int id, cbsasl_secret_t **psecret)
{
    SessionRequestImpl *ctx = SessionRequestImpl::get(context);
    if (!conn || !psecret || id != CBSASL_CB_PASS || ctx == nullptr) {
        return SASL_BADPARAM;
    }

    *psecret = &ctx->u_auth.secret;
    return SASL_OK;
}

SessionInfo::SessionInfo() : lcbio_PROTOCTX()
{
    lcbio_PROTOCTX::id = LCBIO_PROTOCTX_SESSINFO;
    lcbio_PROTOCTX::dtor = (void (*)(lcbio_PROTOCTX *))cleanup_negotiated;
}

bool SessionRequestImpl::setup(const lcbio_NAMEINFO &nistrs, const lcb_host_t &host, const lcb::Authenticator &auth)
{
    cbsasl_callbacks_t sasl_callbacks;
    sasl_callbacks.context = this;
    sasl_callbacks.username = sasl_get_username;
    sasl_callbacks.password = sasl_get_password;

    // Get the credentials
    host_ = host;
    auto creds = auth.credentials_for(LCBAUTH_SERVICE_KEY_VALUE, LCBAUTH_REASON_NEW_OPERATION, host_.host, host_.port,
                                      settings->bucket);
    username = creds.username();
    const std::string &pass = creds.password();

    if (!pass.empty()) {
        size_t maxlen = sizeof(u_auth.buffer) - offsetof(cbsasl_secret_t, data);
        u_auth.secret.len = pass.size();

        if (pass.size() < maxlen) {
            memcpy(u_auth.secret.data, pass.c_str(), pass.size());
        } else {
            return false;
        }
    }

    cbsasl_error_t saslerr =
        cbsasl_client_new("couchbase", host.host, nistrs.local, nistrs.remote, &sasl_callbacks, 0, &sasl_client);
    return saslerr == SASL_OK;
}

static void timeout_handler(void *arg)
{
    SessionRequestImpl *sreq = SessionRequestImpl::get(arg);
    sreq->fail(LCB_ERR_TIMEOUT, "Negotiation timed out");
}

/**
 * Called to retrive the mechlist from the packet.
 * @return 0 to continue authentication, 1 if no authentication needed, or
 * -1 on error.
 */
SessionRequestImpl::MechStatus SessionRequestImpl::set_chosen_mech(std::string &mechlist, const char **data,
                                                                   unsigned int *ndata)
{
    cbsasl_error_t saslerr;

    if (mechlist.empty()) {
        lcb_log(LOGARGS(this, WARN), LOGFMT "Server does not support SASL (no mechanisms supported)", LOGID(this));
        return MECH_NOT_NEEDED;
    }

    bool tls = settings->ssl_ctx != nullptr;
    bool user_specified = false;
    if (settings->sasl_mech_force) {
        bool supported_mech_found = false;
        std::string forced_list(settings->sasl_mech_force);
        std::size_t sep = forced_list.find(' ');
        std::string forcemech = forced_list.substr(0, sep);
        do {
            if (!forcemech.empty() && mechlist.find(forcemech) != std::string::npos) {
                supported_mech_found = true;
                break;
            }
            if (sep == std::string::npos || sep + 1 == forced_list.size()) {
                break;
            }
            std::size_t prev_sep = sep + 1;
            sep = forced_list.find(prev_sep, ' ');
            forcemech = forced_list.substr(prev_sep, sep);
        } while (true);
        if (!supported_mech_found) {
            /** Requested mechanism not found */
            set_error(LCB_ERR_SASLMECH_UNAVAILABLE, mechlist.c_str());
            return MECH_UNAVAILABLE;
        }
        mechlist.assign(forced_list);
        user_specified = true;
    }

    const char *chosenmech;
    saslerr = cbsasl_client_start(sasl_client, mechlist.c_str(), nullptr, data, ndata, &chosenmech);
    switch (saslerr) {
        case SASL_OK:
            /* do not allow to downgrade SASL mechanism to PLAIN on non-TLS connections,
             * unless user explicitly asks for it */
            if (!tls && !user_specified && strncmp(chosenmech, MECH_PLAIN, sizeof(MECH_PLAIN)) == 0) {
#if defined(LCB_NO_SSL) || !defined(HAVE_PKCS5_PBKDF2_HMAC)
                lcb_log(LOGARGS(this, ERROR),
                        LOGFMT
                        "SASL PLAIN authentication is not allowed on non-TLS connections. But this libcouchbase "
                        "compiled without OpenSSL, therefore PLAIN is the only option. The library will fallback to "
                        "PLAIN, but using SCRAM methods is strongly recommended over non-encrypted transports.",
                        LOGID(this));
#else
                lcb_log(LOGARGS(this, WARN),
                        LOGFMT "SASL PLAIN authentication is not allowed on non-TLS connections (server supports: %s)",
                        LOGID(this), mechlist.c_str());
                return MECH_UNAVAILABLE;
#endif
            }
            lcb_log(LOGARGS(this, DEBUG), LOGFMT "Using %s SASL mechanism", LOGID(this), chosenmech);
            info->mech.assign(chosenmech);
            return MECH_OK;
        case SASL_NOMECH:
            lcb_log(LOGARGS(this, WARN), LOGFMT "Server does not support SASL (no mechanisms supported)", LOGID(this));
            return MECH_UNAVAILABLE;
        default:
            lcb_log(LOGARGS(this, ERROR), LOGFMT "cbsasl_client_start returned %d", LOGID(this), saslerr);
            set_error(LCB_ERR_SDK_INTERNAL, "Couldn't start SASL client");
            return MECH_UNAVAILABLE;
    }
}

/**
 * Given the specific mechanisms, send the auth packet to the server.
 */
void SessionRequestImpl::send_auth(const char *sasl_data, unsigned ndata) const
{
    lcb::MemcachedRequest hdr(PROTOCOL_BINARY_CMD_SASL_AUTH);
    hdr.sizes(0, info->mech.size(), ndata);

    lcbio_ctx_put(ctx, hdr.data(), hdr.size());
    lcbio_ctx_put(ctx, info->mech.c_str(), info->mech.size());
    lcbio_ctx_put(ctx, sasl_data, ndata);
    lcbio_ctx_rwant(ctx, 24);
}

bool SessionRequestImpl::send_step(const lcb::MemcachedResponse &packet)
{
    cbsasl_error_t saslerr;
    const char *step_data;
    unsigned int ndata;

    saslerr = cbsasl_client_step(sasl_client, packet.value(), packet.vallen(), nullptr, &step_data, &ndata);

    if (saslerr != SASL_CONTINUE) {
        set_error(LCB_ERR_SDK_INTERNAL, "Unable to perform SASL STEP");
        return false;
    }

    lcb::MemcachedRequest hdr(PROTOCOL_BINARY_CMD_SASL_STEP);
    hdr.sizes(0, info->mech.size(), ndata);
    lcbio_ctx_put(ctx, hdr.data(), hdr.size());
    lcbio_ctx_put(ctx, info->mech.c_str(), info->mech.size());
    lcbio_ctx_put(ctx, step_data, ndata);
    lcbio_ctx_rwant(ctx, 24);
    return true;
}

std::string SessionRequestImpl::generate_agent_json() const
{
    std::string client_string(LCB_CLIENT_ID);
    if (settings->client_string) {
        client_string += " ";
        client_string += settings->client_string;
    }
    if (client_string.size() > 200) {
        client_string.resize(200);
    }
    char id[34] = {};
    snprintf(id, sizeof(id), "%016" PRIx64 "/%016" PRIx64, settings->iid, ctx->sock->id);

    Json::Value ua;
    ua["a"] = client_string;
    ua["i"] = id;
    Json::FastWriter w;
    std::string res = w.write(ua);
    if (res[res.size() - 1] == '\n') {
        res.resize(res.size() - 1);
    }
    return res;
}

/**
 * Final step for SASL authentication: in SCRAM-SHA mechanisms,
 * we have to validate the server signature returned in the final
 * message.
 */
bool SessionRequestImpl::check_auth(const lcb::MemcachedResponse &packet)
{
    cbsasl_error_t saslerr;

    saslerr = cbsasl_client_check(sasl_client, packet.value(), packet.vallen());

    if (saslerr != SASL_OK) {
        set_error(LCB_ERR_AUTHENTICATION_FAILURE, "Invalid SASL check");
        return false;
    }
    return true;
}

bool SessionRequestImpl::send_hello()
{
    lcb_U16 features[MEMCACHED_TOTAL_HELLO_FEATURES];

    unsigned nfeatures = 0;
    features[nfeatures++] = PROTOCOL_BINARY_FEATURE_TLS;
    features[nfeatures++] = PROTOCOL_BINARY_FEATURE_XATTR;
    features[nfeatures++] = PROTOCOL_BINARY_FEATURE_JSON;
    if (settings->select_bucket) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_SELECT_BUCKET;
    }
    if (settings->use_errmap) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_XERROR;
    }
    if (settings->tcp_nodelay) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_TCPNODELAY;
    }
    if (settings->compressopts != LCB_COMPRESS_NONE) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_SNAPPY;
    }
    if (settings->fetch_mutation_tokens) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_MUTATION_SEQNO;
    }
    if (settings->use_tracing) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_TRACING;
    }
    if (settings->use_collections) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_COLLECTIONS;
    }
    if (settings->enable_durable_write) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_ALT_REQUEST_SUPPORT;
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_SYNC_REPLICATION;
    }
    if (settings->enable_unordered_execution) {
        features[nfeatures++] = PROTOCOL_BINARY_FEATURE_UNORDERED_EXECUTION;
    }
    features[nfeatures++] = PROTOCOL_BINARY_FEATURE_CREATE_AS_DELETED;
    features[nfeatures++] = PROTOCOL_BINARY_FEATURE_PRESERVE_TTL;

    std::string agent = generate_agent_json();
    lcb::MemcachedRequest hdr(PROTOCOL_BINARY_CMD_HELLO);
    hdr.sizes(0, agent.size(), (sizeof features[0]) * nfeatures);
    lcbio_ctx_put(ctx, hdr.data(), hdr.size());
    lcbio_ctx_put(ctx, agent.c_str(), agent.size());

    std::string fstr;
    for (size_t ii = 0; ii < nfeatures; ii++) {
        char buf[50] = {0};
        lcb_U16 tmp = htons(features[ii]);
        lcbio_ctx_put(ctx, &tmp, sizeof tmp);
        snprintf(buf, sizeof(buf), "%s0x%02x (%s)", ii > 0 ? ", " : "", features[ii],
                 protocol_feature_2_text(features[ii]));
        fstr.append(buf);
    }
    lcb_log(LOGARGS(this, DEBUG), LOGFMT "HELO identificator: %.*s, features: %s", LOGID(this), (int)agent.size(),
            agent.c_str(), fstr.c_str());

    lcbio_ctx_rwant(ctx, 24);
    return true;
}

void SessionRequestImpl::send_list_mechs() const
{
    lcb::MemcachedRequest req(PROTOCOL_BINARY_CMD_SASL_LIST_MECHS);
    lcbio_ctx_put(ctx, req.data(), req.size());
    LCBIO_CTX_RSCHEDULE(ctx, 24);
}

bool SessionRequestImpl::read_hello(const lcb::MemcachedResponse &packet)
{
    /* some caps */
    const char *cur;
    const char *payload = packet.value();
    const char *limit = payload + packet.vallen();
    size_t ii;
    std::string fstr;
    for (ii = 0, cur = payload; cur < limit; cur += 2, ii++) {
        lcb_U16 tmp;
        char buf[50] = {0};
        memcpy(&tmp, cur, sizeof(tmp));
        tmp = ntohs(tmp);
        info->server_features.push_back(tmp);
        snprintf(buf, sizeof(buf), "%s0x%02x (%s)", ii > 0 ? ", " : "", tmp, protocol_feature_2_text(tmp));
        fstr.append(buf);
    }
    lcb_log(LOGARGS(this, DEBUG), LOGFMT "Server supports features: %s", LOGID(this), fstr.c_str());
    return true;
}

bool SessionRequestImpl::request_errmap() const
{
    lcb::MemcachedRequest hdr(PROTOCOL_BINARY_CMD_GET_ERROR_MAP);
    uint16_t version = htons(1);
    hdr.sizes(0, 0, 2);
    const char *p = reinterpret_cast<const char *>(&version);

    lcbio_ctx_put(ctx, hdr.data(), hdr.size());
    lcbio_ctx_put(ctx, p, 2);
    lcbio_ctx_rwant(ctx, 24);
    return true;
}

bool SessionRequestImpl::update_errmap(const lcb::MemcachedResponse &packet)
{
    // Get the error map object
    using lcb::errmap::ErrorMap;

    std::string errmsg;
    ErrorMap &mm = *settings->errmap;
    ErrorMap::ParseStatus status = mm.parse(packet.value(), packet.vallen(), errmsg);

    if (status != ErrorMap::UPDATED && status != ErrorMap::NOT_UPDATED) {
        errmsg = "Couldn't update error map: " + errmsg;
        set_error(LCB_ERR_PROTOCOL_ERROR, errmsg.c_str());
        return false;
    }

    return true;
}

// Returns true if sending the SELECT_BUCKET command, false otherwise.
bool SessionRequestImpl::maybe_select_bucket()
{
    if (settings->conntype != LCB_TYPE_BUCKET || settings->bucket == nullptr) {
        return false;
    }
    // Only send a SELECT_BUCKET if we have the SELECT_BUCKET bit enabled.
    if (!info->has_feature(PROTOCOL_BINARY_FEATURE_SELECT_BUCKET)) {
        return false;
    }

    if (!settings->select_bucket) {
        lcb_log(LOGARGS(this, WARN), LOGFMT "SELECT_BUCKET Disabled by application", LOGID(this));
        return false;
    }

    // send the SELECT_BUCKET command:
    lcb_log(LOGARGS(this, DEBUG), LOGFMT "Sending SELECT_BUCKET \"%s\"", LOGID(this), settings->bucket);
    lcb::MemcachedRequest req(PROTOCOL_BINARY_CMD_SELECT_BUCKET);
    req.sizes(0, strlen(settings->bucket), 0);
    lcbio_ctx_put(ctx, req.data(), req.size());
    info->bucket_name_.assign(settings->bucket);
    lcbio_ctx_put(ctx, info->bucket_name_.data(), info->bucket_name_.size());
    LCBIO_CTX_RSCHEDULE(ctx, 24);
    return true;
}

static bool isUnsupported(uint16_t status)
{
    return status == PROTOCOL_BINARY_RESPONSE_NOT_SUPPORTED || status == PROTOCOL_BINARY_RESPONSE_UNKNOWN_COMMAND ||
           status == PROTOCOL_BINARY_RESPONSE_EACCESS;
}

/**
 * It's assumed the server buffers will be reset upon close(), so we must make
 * sure to _not_ release the ringbuffer if that happens.
 */
void SessionRequestImpl::handle_read(lcbio_CTX *ioctx)
{
    lcb::MemcachedResponse resp;
    unsigned required;
    bool completed = false;

GT_NEXT_PACKET:

    if (!resp.load(ioctx, &required)) {
        LCBIO_CTX_RSCHEDULE(ioctx, required);
        return;
    }
    const uint16_t status = resp.status();

    switch (resp.opcode()) {
        case PROTOCOL_BINARY_CMD_SASL_LIST_MECHS: {
            const char *mechlist_data;
            unsigned int nmechlist_data;
            std::string mechs(resp.value(), resp.vallen());

            MechStatus mechrc = set_chosen_mech(mechs, &mechlist_data, &nmechlist_data);
            if (mechrc == MECH_OK) {
                send_auth(mechlist_data, nmechlist_data);
            } else if (mechrc == MECH_UNAVAILABLE) {
                // Do nothing - error already set
            } else {
                completed = !maybe_select_bucket();
            }
            break;
        }

        case PROTOCOL_BINARY_CMD_SASL_AUTH: {
            if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
                completed = !maybe_select_bucket();
                break;
            } else if (status == PROTOCOL_BINARY_RESPONSE_AUTH_CONTINUE) {
                send_step(resp);
            } else {
                set_error(LCB_ERR_AUTHENTICATION_FAILURE, "SASL AUTH failed", &resp);
                break;
            }
            break;
        }

        case PROTOCOL_BINARY_CMD_SASL_STEP: {
            if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS && check_auth(resp)) {
                completed = !maybe_select_bucket();
            } else {
                lcb_log(LOGARGS(this, WARN), LOGFMT "SASL auth failed with STATUS=0x%x", LOGID(this), status);
                set_error(LCB_ERR_AUTHENTICATION_FAILURE, "SASL Step failed", &resp);
            }
            break;
        }

        case PROTOCOL_BINARY_CMD_HELLO: {
            if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
                if (!read_hello(resp)) {
                    set_error(LCB_ERR_PROTOCOL_ERROR, "Couldn't parse HELLO");
                    break;
                }
            } else if (isUnsupported(status)) {
                lcb_log(LOGARGS(this, DEBUG), LOGFMT "Server does not support HELLO", LOGID(this));
            } else {
                lcb_log(LOGARGS(this, ERROR), LOGFMT "Unexpected status 0x%x received for HELLO", LOGID(this), status);
                set_error(LCB_ERR_PROTOCOL_ERROR, "Hello response unexpected", &resp);
                break;
            }

            if (!info->has_feature(PROTOCOL_BINARY_FEATURE_XERROR)) {
                lcb_log(LOGARGS(this, TRACE), LOGFMT "GET_ERRORMAP unsupported/disabled", LOGID(this));
            }

            if (settings->keypath) {
                completed = !expecting_error_map && !maybe_select_bucket();
            }
            break;
        }

        case PROTOCOL_BINARY_CMD_GET_ERROR_MAP: {
            expecting_error_map = false;
            if (status == PROTOCOL_BINARY_RESPONSE_SUCCESS) {
                update_errmap(resp);
            } else if (isUnsupported(status)) {
                lcb_log(LOGARGS(this, DEBUG), LOGFMT "Server does not support GET_ERRMAP (0x%x)", LOGID(this), status);
            } else {
                lcb_log(LOGARGS(this, ERROR), LOGFMT "Unexpected status 0x%x received for GET_ERRMAP", LOGID(this),
                        status);
                set_error(LCB_ERR_PROTOCOL_ERROR, "GET_ERRMAP response unexpected", &resp);
            }
            if (settings->keypath) {
                completed = !maybe_select_bucket();
            }
            // Note, there is no explicit state transition here. LIST_MECHS is
            // pipelined after this request.
            break;
        }

        case PROTOCOL_BINARY_CMD_SELECT_BUCKET: {
            switch (status) {
                case PROTOCOL_BINARY_RESPONSE_SUCCESS:
                    completed = true;
                    info->selected = true;
                    break;

                case PROTOCOL_BINARY_RESPONSE_EACCESS:
                    set_error(LCB_ERR_BUCKET_NOT_FOUND,
                              "Provided credentials not allowed for bucket or bucket does not exist", &resp);
                    break;

                case PROTOCOL_BINARY_RESPONSE_KEY_ENOENT:
                    set_error(LCB_ERR_BUCKET_NOT_FOUND, "Key/Value service is not configured for given node", &resp);
                    break;

                case PROTOCOL_BINARY_RATE_LIMITED_MAX_COMMANDS:
                case PROTOCOL_BINARY_RATE_LIMITED_MAX_CONNECTIONS:
                case PROTOCOL_BINARY_RATE_LIMITED_NETWORK_EGRESS:
                case PROTOCOL_BINARY_RATE_LIMITED_NETWORK_INGRESS:
                    set_error(LCB_ERR_RATE_LIMITED, "The tenant has reached rate limit", &resp);
                    break;

                case PROTOCOL_BINARY_SCOPE_SIZE_LIMIT_EXCEEDED:
                    set_error(LCB_ERR_QUOTA_LIMITED, "The tenant has reached quota limit", &resp);
                    break;

                default:
                    lcb_log(LOGARGS(this, ERROR), LOGFMT "Unexpected status 0x%x received for SELECT_BUCKET",
                            LOGID(this), status);
                    set_error(LCB_ERR_PROTOCOL_ERROR, "Other auth error", &resp);
                    break;
            }
            break;
        }

        default: {
            lcb_log(LOGARGS(this, ERROR), LOGFMT "Received unknown response. OP=0x%x. RC=0x%x", LOGID(this),
                    resp.opcode(), resp.status());
            set_error(LCB_ERR_UNSUPPORTED_OPERATION, "Received unknown response", &resp);
            break;
        }
    }

    // We need to release the packet's buffers before actually destroying the
    // underlying socket and/or buffers!
    resp.release(ioctx);

    // Once there is no more any dependencies on the buffers, we can succeed
    // or fail the request, potentially destroying the underlying connection
    if (has_error()) {
        fail();
    } else if (completed) {
        success();
    } else {
        goto GT_NEXT_PACKET;
    }
}

static void handle_ioerr(lcbio_CTX *ctx, lcb_STATUS err)
{
    SessionRequestImpl *sreq = SessionRequestImpl::get(lcbio_ctx_data(ctx));
    sreq->fail(err, "IO Error");
}

static void cleanup_negotiated(SessionInfo *info)
{
    delete info;
}

void SessionRequestImpl::start(lcbio_SOCKET *sock)
{
    info = new SessionInfo();

    lcb_STATUS err = lcbio_sslify_if_needed(sock, settings);
    if (err != LCB_SUCCESS) {
        set_error(err, "Couldn't initialized SSL on socket");
        lcbio_async_signal(timer);
        return;
    }

    lcbio_CTXPROCS procs{};
    procs.cb_err = ::handle_ioerr;
    procs.cb_read = ::handle_read;
    ctx = lcbio_ctx_new(sock, this, &procs);
    ctx->subsys = "sasl";

    const lcb_host_t *curhost = lcbio_get_host(sock);
    lcbio_NAMEINFO nistrs{};
    lcbio_get_nameinfo(sock, &nistrs);

    if (!setup(nistrs, *curhost, *settings->auth)) {
        set_error(LCB_ERR_SDK_INTERNAL, "Couldn't start SASL client");
        lcbio_async_signal(timer);
        return;
    }

    send_hello();
    if (settings->use_errmap) {
        request_errmap();
        expecting_error_map = true;
    } else {
        lcb_log(LOGARGS(this, TRACE), LOGFMT "GET_ERRORMAP disabled", LOGID(this));
    }
    if (!settings->keypath) {
        send_list_mechs();
    }
    LCBIO_CTX_RSCHEDULE(ctx, 24);
}

SessionRequestImpl::~SessionRequestImpl()
{
    delete info;

    if (timer) {
        lcbio_timer_destroy(timer);
    }
    if (ctx) {
        lcbio_ctx_close(ctx, nullptr, nullptr);
    }
    if (sasl_client) {
        cbsasl_dispose(&sasl_client);
    }
}

SessionRequest *SessionRequest::start(lcbio_SOCKET *sock, lcb_settings_st *settings, uint32_t tmo,
                                      lcbio_CONNDONE_cb callback, void *data)
{
    auto *sreq = new SessionRequestImpl(callback, data, tmo, sock->io, settings);
    sreq->start(sock);
    return sreq;
}

SessionInfo *SessionInfo::get(lcbio_SOCKET *sock)
{
    return static_cast<SessionInfo *>(lcbio_protoctx_get(sock, LCBIO_PROTOCTX_SESSINFO));
}

bool SessionInfo::selected_bucket() const
{
    return selected;
}

const std::string &SessionInfo::bucket_name() const
{
    return bucket_name_;
}

bool SessionInfo::has_feature(uint16_t feature) const
{
    return std::find(server_features.begin(), server_features.end(), feature) != server_features.end();
}
