/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2013 Couchbase, Inc.
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

#include "internal.h"
#include "bucketconfig/clconfig.h"
#include "http/http.h"
#include "http/http-priv.h"
using namespace lcb::http;

#define LOGFMT "<%s:%s>"
#define LOGID(req) (req)->host.c_str(), (req)->port.c_str()
#define LOGARGS(req, lvl) req->instance->settings, "http-io", LCB_LOG_##lvl, __FILE__, __LINE__

static const char *method_strings[] = {
    "GET ",    /* LCB_HTTP_METHOD_GET */
    "POST ",   /* LCB_HTTP_METHOD_POST */
    "PUT ",    /* LCB_HTTP_METHOD_PUT */
    "DELETE "  /* LCB_HTTP_METHOD_DELETE */
};

void
Request::decref()
{
    assert(refcount > 0);
    if (--refcount) {
        return;
    }

    close_io();

    if (parser) {
        lcbht_free(parser);
    }

    if (timer) {
        lcbio_timer_destroy(timer);
        timer = NULL;
    }

    delete this;
}

void
Request::finish_or_retry(lcb_error_t rc)
{
    if (rc == LCB_ETIMEDOUT) {
        // No point on trying (or even logging) a timeout
        finish(rc);
        return;
    }
    if (passed_data) {
        lcb_log(LOGARGS(this, WARN), LOGFMT "Not retrying. Data passed to callback", LOGID(this));
        finish(rc);
        return;
    }

    // Not a 'data API'. Request may be node-specific
    if (!is_data_request()) {
        lcb_log(LOGARGS(this, WARN), LOGFMT "Not retrying non-data-api request", LOGID(this));
        finish(rc);
        return;
    }

    // See if we can find an API node.
    const char *nextnode = get_api_node();
    if (!nextnode) {
        lcb_log(LOGARGS(this, WARN), LOGFMT "Not retrying. No nodes available", LOGID(this));
        finish(rc);
        return;
    }

    // Reassemble URL:

    // get offset and length of host bits
    size_t host_begin = url_info.field_data[UF_HOST].off;
    size_t hplen =
            url_info.field_data[UF_HOST].len +
            url_info.field_data[UF_PORT].len + 1; // +1 for ":"

    url.replace(host_begin, hplen, nextnode);
    lcb_error_t newrc = submit();
    if (newrc != LCB_SUCCESS) {
        lcb_log(LOGARGS(this, WARN), LOGFMT "Retry failed!", LOGID(this));
        finish(rc);
    }
}

void
Request::maybe_refresh_config(lcb_error_t err)
{
    int htstatus_ok;
    lcbht_RESPONSE *resp;
    if (!parser) {
        return;
    }

    if (!LCBT_SETTING(instance, refresh_on_hterr)) {
        return;
    }

    resp = lcbht_get_response(parser);
    htstatus_ok = resp->status >= 200 && resp->status < 299;

    if (err != LCB_SUCCESS && (err == LCB_ESOCKSHUTDOWN && htstatus_ok) == 0) {
        /* ignore graceful close */
        lcb_bootstrap_common(instance, LCB_BS_REFRESH_ALWAYS);
        return;
    }

    if (htstatus_ok) {
        return;
    }
    lcb_bootstrap_common(instance, LCB_BS_REFRESH_ALWAYS);
}

void
Request::init_resp(lcb_RESPHTTP *res)
{
    const lcbht_RESPONSE *htres = lcbht_get_response(parser);

    res->cookie = const_cast<void*>(command_cookie);
    res->key = url.c_str() + url_info.field_data[UF_PATH].off;
    res->nkey = url_info.field_data[UF_PATH].len;
    res->_htreq = static_cast<lcb_http_request_t>(this);
    if (!response_headers.empty()) {
        res->headers = &response_headers_clist[0];
    }
    if (htres) {
        res->htstatus = htres->status;
    }
}

void
Request::finish(lcb_error_t error)
{
    /* This is always safe to execute */
    if (!(status & NOLCB)) {
        maybe_refresh_config(error);
    }

    /* And this one too */
    if ((status & CBINVOKED) == 0) {
        lcb_RESPHTTP resp = { 0 };
        init_resp(&resp);
        resp.rflags = LCB_RESP_F_FINAL;
        resp.rc = error;

        status |= CBINVOKED;
        callback(instance, LCB_CALLBACK_HTTP, (lcb_RESPBASE*)&resp);
    }

    if (status & FINISHED) {
        return;
    }

    status |= FINISHED;

    if (!(status & NOLCB)) {
        /* Remove from wait queue */
        lcb_aspend_del(&instance->pendops, LCB_PENDTYPE_HTTP, this);
        /* Break out from the loop (must be called after aspend_del) */
        lcb_maybe_breakout(instance);
    }

    /* Cancel the timeout */
    lcbio_timer_disarm(timer);

    /* Remove the initial refcount=1 (set from lcb_http3). Typically this will
     * also free the request (though this is dependent on pending I/O operations) */
    decref();
}

void Request::add_to_preamble(const char *s) {
    preamble.insert(preamble.end(), s, s + strlen(s));
}
void Request::add_to_preamble(const std::string& s) {
    preamble.insert(preamble.end(), s.c_str(), s.c_str() + s.size());
}
void Request::add_to_preamble(const Header& header) {
    add_to_preamble(header.key);
    add_to_preamble(": ");
    add_to_preamble(header.value);
    add_to_preamble("\r\n");
}

lcb_error_t
Request::submit()
{
    lcb_error_t rc;
    lcb_host_t reqhost;

    // Stop any pending socket/request
    close_io();

    if (host.size() > sizeof reqhost.host || port.size() > sizeof reqhost.port) {
        decref();
        return LCB_E2BIG;
    }

    preamble.clear();

    strncpy(reqhost.host, host.c_str(), host.size());
    strncpy(reqhost.port, port.c_str(), port.size());
    reqhost.host[host.size()] = '\0';
    reqhost.port[port.size()] = '\0';

    // Add the HTTP verb (e.g. "GET ") [note, the string contains a trailing space]
    add_to_preamble(method_strings[method]);

    // Add the path
    const char *url_s = url.c_str();
    size_t path_off = url_info.field_data[UF_PATH].off;
    size_t path_len = url.size() - path_off;
    preamble.insert(preamble.end(),
        url_s + path_off, url_s + path_off + path_len);

    add_to_preamble(" HTTP/1.1\r\n");

    // Add the Host: header manually. If redirected to a different host then
    // we need to recalculate this, so don't make this part of the
    // global headers (which are typically not cleared)
    add_to_preamble("Host: ");
    add_to_preamble(host);
    add_to_preamble(":");
    add_to_preamble(port);
    add_to_preamble("\r\n");

    // Add the rest of the headers
    std::vector<Header>::const_iterator ii = request_headers.begin();
    for (; ii != request_headers.end(); ++ii) {
        add_to_preamble(*ii);
    }
    add_to_preamble("\r\n");
    // If there is a body, it is appended in the IO stage

    rc = start_io(reqhost);

    if (rc == LCB_SUCCESS) {
        // Only wipe old parser/response information if current I/O request
        // was a success
        if (parser) {
            lcbht_reset(parser);
        } else {
            parser = lcbht_new(instance->settings);
        }
        response_headers.clear();
        response_headers_clist.clear();
    }

    return rc;
}

void
Request::assign_from_urlfield(http_parser_url_fields field, std::string &target)
{
    target = url.substr(url_info.field_data[field].off,
        url_info.field_data[field].len);
}

lcb_error_t
Request::assign_url(const char *base, size_t nbase, const char *path, size_t npath)
{
    const char *htscheme;
    unsigned schemsize;

    if (LCBT_SETTING(instance, sslopts) & LCB_SSL_ENABLED) {
        htscheme = "https://";
        schemsize = sizeof("https://");
    } else {
        htscheme = "http://";
        schemsize = sizeof("http://");
    }

    schemsize--;
    if (base) {
        url.assign(htscheme, schemsize);
        if (nbase > schemsize && memcmp(base, htscheme, schemsize) == 0) {
            base += schemsize;
            nbase -= schemsize;
        }
        url.append(base, nbase);
        if (path) {
            if (*path != '/' && url[url.size()-1] != '/') {
                url.append("/");
            }

            lcb_size_t n_added;
            std::vector<char> encpath;
            encpath.resize((npath * 3) + 1);
            char *pp = &encpath[0];
            lcb_error_t rc = lcb_urlencode_path(path, npath, &pp, &n_added);
            if (rc != LCB_SUCCESS) {
                return rc;
            }
            encpath.resize(n_added);
            url.append(encpath.begin(), encpath.end());
        }
    }


    bool redir_checked = false;
    static const unsigned required_fields =
            ((1 << UF_HOST) | (1 << UF_PORT) | (1 << UF_PATH));

    GT_REPARSE:
    if (_lcb_http_parser_parse_url(url.c_str(), url.size(), 0, &url_info)) {
        return LCB_EINVAL;
    }

    if ((url_info.field_set & required_fields) != required_fields) {
        if (base == NULL && path == NULL && !redir_checked) {
            redir_checked = true;
            std::string first_part(htscheme, schemsize);
            first_part += host;
            first_part += ':';
            first_part += port;
            url = first_part + url;
            goto GT_REPARSE;
        }
        return LCB_EINVAL;
    }

    assign_from_urlfield(UF_HOST, host);
    assign_from_urlfield(UF_PORT, port);
    return LCB_SUCCESS;
}

void
Request::redirect()
{
    lcb_error_t rc;
    assert(!pending_redirect.empty());
    if (LCBT_SETTING(instance, max_redir) > -1) {
        if (LCBT_SETTING(instance, max_redir) < ++redircount) {
            finish(LCB_TOO_MANY_REDIRECTS);
            return;
        }
    }

    memset(&url_info, 0, sizeof url_info);
    url = pending_redirect;
    pending_redirect.clear();

    if ((rc = assign_url(NULL, 0, NULL, 0)) != LCB_SUCCESS) {
        lcb_log(LOGARGS(this, ERR), LOGFMT "Failed to add redirect URL (%s)", LOGID(this), url.c_str());
        finish(rc);
        return;
    }

    if ((rc = submit()) != LCB_SUCCESS) {
        finish(rc);
    }
}

static lcbvb_SVCTYPE
httype2svctype(unsigned httype)
{
    switch (httype) {
    case LCB_HTTP_TYPE_VIEW:
        return LCBVB_SVCTYPE_VIEWS;
    case LCB_HTTP_TYPE_N1QL:
        return LCBVB_SVCTYPE_N1QL;
    case LCB_HTTP_TYPE_FTS:
        return LCBVB_SVCTYPE_FTS;
    default:
        return LCBVB_SVCTYPE__MAX;
    }
}

const char *
Request::get_api_node(lcb_error_t &rc)
{
    if (!is_data_request()) {
        return lcb_get_node(instance, LCB_NODE_HTCONFIG, 0);
    }

    if (!LCBT_VBCONFIG(instance)) {
        rc = LCB_CLIENT_ETMPFAIL;
        return NULL;
    }

    const lcbvb_SVCTYPE svc = httype2svctype(reqtype);
    const lcbvb_SVCMODE mode = LCBT_SETTING(instance, sslopts) ?
            LCBVB_SVCMODE_SSL : LCBVB_SVCMODE_PLAIN;

    lcbvb_CONFIG *vbc = LCBT_VBCONFIG(instance);

    if (last_vbcrev != vbc->revid) {
        used_nodes.clear();
        last_vbcrev = vbc->revid;
    }
    used_nodes.resize(LCBVB_NSERVERS(vbc));

    int ix = lcbvb_get_randhost_ex(vbc, svc, mode, &used_nodes[0]);
    if (ix < 0) {
        rc = LCB_NOT_SUPPORTED;
        return NULL;
    }
    used_nodes[ix] = 1;
    return lcbvb_get_resturl(vbc, ix, svc, mode);
}

lcb_error_t
Request::setup_inputs(const lcb_CMDHTTP *cmd)
{
    const char *base = NULL, *username, *password;
    size_t nbase = 0;
    lcb_error_t rc;

    if (method > LCB_HTTP_METHOD_MAX) {
        return LCB_EINVAL;
    }

    username = cmd->username;
    password = cmd->password;

    if (reqtype == LCB_HTTP_TYPE_RAW) {
        if ((base = cmd->host) == NULL) {
            return LCB_EINVAL;
        }
    } else {
        if (cmd->host) {
            return LCB_EINVAL;
        }
        if (cmd->cmdflags & LCB_CMDHTTP_F_NOUPASS) {
            username = password = NULL;
        } else if (username == NULL && password == NULL) {
            lcbauth_get_upass(LCBT_SETTING(instance, auth), &username, &password);
        }

        base = get_api_node(rc);
        if (base == NULL || *base == '\0') {
            if (rc == LCB_SUCCESS) {
                return LCB_EINTERNAL;
            } else {
                return rc;
            }
        }
    }

    if (base) {
        nbase = strlen(base);
    }

    rc = assign_url(base, nbase,
        reinterpret_cast<const char*>(cmd->key.contig.bytes),
        cmd->key.contig.nbytes);
    if (rc != LCB_SUCCESS) {
        return rc;
    }

    add_header("User-Agent", "libcouchbase/" LCB_VERSION_STRING);
    if (instance->http_sockpool->maxidle == 0 || !is_data_request()) {
        add_header("Connection", "close");
    }

    add_header("Accept", "application/json");
    if (password && username) {
        char auth[256];
        std::string upassbuf;
        upassbuf.append(username).append(":").append(password);
        if (lcb_base64_encode(upassbuf.c_str(), auth, sizeof(auth)) == -1) {
            return LCB_EINVAL;
        }
        add_header("Authorization", std::string("Basic ") + auth);
    }

    if (!body.empty()) {
        char lenbuf[64];
        sprintf(lenbuf, "%ld", body.size());
        add_header("Content-Length", lenbuf);
        if (cmd->content_type) {
            add_header("Content-Type", cmd->content_type);
        }
    }

    return LCB_SUCCESS;
}

Request::Request(lcb_t instance_, const void *cookie, const lcb_CMDHTTP* cmd)
: instance(instance_),
  body(cmd->body, cmd->body + cmd->nbody),
  method(cmd->method),
  chunked(cmd->cmdflags & LCB_CMDHTTP_F_STREAM),
  paused(false),
  command_cookie(cookie),
  refcount(1),
  redircount(0),
  passed_data(false),
  last_vbcrev(-1),
  reqtype(cmd->type),
  status(ONGOING),
  callback(lcb_find_callback(instance, LCB_CALLBACK_HTTP)),
  io(instance->iotable),
  ioctx(NULL),
  timer(NULL),
  parser(NULL),
  user_timeout(cmd->cmdflags & LCB_CMDHTTP_F_CASTMO ? cmd->cas : 0)
{
    memset(&creq, 0, sizeof creq);
}

uint32_t
Request::timeout() const
{
    if (user_timeout) {
        return user_timeout;
    }
    switch (reqtype) {
    case LCB_HTTP_TYPE_N1QL:
    case LCB_HTTP_TYPE_FTS:
        return LCBT_SETTING(instance, n1ql_timeout);
    case LCB_HTTP_TYPE_VIEW:
        return LCBT_SETTING(instance, views_timeout);
    default:
        return LCBT_SETTING(instance, http_timeout);
    }
}

Request *
Request::create(lcb_t instance,
    const void *cookie, const lcb_CMDHTTP *cmd, lcb_error_t *rc)
{
    Request *req = new Request(instance, cookie, cmd);
    if (!req) {
        *rc = LCB_CLIENT_ENOMEM;
        return NULL;
    }

    *rc = req->setup_inputs(cmd);
    if (*rc != LCB_SUCCESS) {
        req->decref();
        return NULL;
    }

    *rc = req->submit();
    if (*rc == LCB_SUCCESS) {
        if (cmd->reqhandle) {
            *cmd->reqhandle = static_cast<lcb_http_request_t>(req);
        }
        lcb_aspend_add(&instance->pendops, LCB_PENDTYPE_HTTP, req);
        return req;
    } else {
        // Do not call finish() as we don't want a callback
        req->decref();
        return NULL;
    }
}

LIBCOUCHBASE_API
lcb_error_t
lcb_http3(lcb_t instance, const void *cookie, const lcb_CMDHTTP *cmd)
{
    lcb_error_t rc;
    Request::create(instance, cookie, cmd, &rc);
    return rc;
}

LIBCOUCHBASE_API
lcb_error_t lcb_make_http_request(lcb_t instance,
    const void *cookie, lcb_http_type_t type, const lcb_http_cmd_t *cmd,
    lcb_http_request_t *request)
{
    lcb_CMDHTTP htcmd = { 0 };
    lcb_error_t err;
    const lcb_HTTPCMDv0 *cmdbase = &cmd->v.v0;

    LCB_CMD_SET_KEY(&htcmd, cmdbase->path, cmdbase->npath);
    htcmd.type = type;
    htcmd.body = reinterpret_cast<const char*>(cmdbase->body);
    htcmd.nbody = cmdbase->nbody;
    htcmd.content_type = cmdbase->content_type;
    htcmd.method = cmdbase->method;
    htcmd.reqhandle = request;

    if (cmd->version == 1) {
        htcmd.username = cmd->v.v1.username;
        htcmd.password = cmd->v.v1.password;
        htcmd.host = cmd->v.v1.host;
    }
    if (cmdbase->chunked) {
        htcmd.cmdflags |= LCB_CMDHTTP_F_STREAM;
    }

    err = lcb_http3(instance, cookie, &htcmd);
    if (err == LCB_SUCCESS) {
        SYNCMODE_INTERCEPT(instance);
    }
    return err;
}

void
Request::cancel()
{
    if (status & (FINISHED|CBINVOKED)) {
        /* Nothing to cancel */
        return;
    }
    status |= CBINVOKED;
    finish(LCB_SUCCESS);
}

// Wrappers
void lcb_htreq_setcb(lcb_http_request_t req, lcb_RESPCALLBACK callback) {
    req->callback = callback;
}
void lcb_htreq_block_callback(lcb_http_request_t req) {
    req->block_callback();
}
void lcb_htreq_pause(lcb_http_request_t req) {
    req->pause();
}
void lcb_htreq_resume(lcb_http_request_t req) {
    req->resume();
}
void lcb_htreq_finish(lcb_t, lcb_http_request_t req, lcb_error_t rc) {
    req->finish(rc);
}

LIBCOUCHBASE_API
void
lcb_cancel_http_request(lcb_t, lcb_http_request_t req)
{
    req->cancel();
}
