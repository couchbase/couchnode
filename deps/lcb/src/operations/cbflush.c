/*
 *     Copyright 2010-2012 Couchbase, Inc.
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
#include <http/http.h>

static void
flush_cb(lcb_t instance, int cbtype, const lcb_RESPBASE *rb)
{
    const lcb_RESPHTTP *resp = (const lcb_RESPHTTP *)rb;
    lcb_RESPCBFLUSH fresp = { 0 };
    lcb_RESPCALLBACK callback = lcb_find_callback(instance, LCB_CALLBACK_CBFLUSH);

    fresp = *(lcb_RESPBASE *)rb;
    fresp.rflags |= LCB_RESP_F_FINAL;
    if (resp->rc == LCB_SUCCESS) {
        if (resp->htstatus < 200 || resp->htstatus > 299) {
            fresp.rc = LCB_HTTP_ERROR;
        }
    }
    if (callback) {
        callback(instance, LCB_CALLBACK_CBFLUSH, (lcb_RESPBASE*)&fresp);
    }
    (void)cbtype;
}

LIBCOUCHBASE_API
lcb_error_t
lcb_cbflush3(lcb_t instance, const void *cookie, const lcb_CMDBASE *cmd)
{
    lcb_http_request_t htr;
    lcb_CMDHTTP htcmd = { 0 };
    lcb_string urlpath;
    lcb_error_t rc;

    (void)cmd;

    lcb_string_init(&urlpath);
    lcb_string_appendz(&urlpath, "/pools/default/buckets/");
    lcb_string_appendz(&urlpath, LCBT_SETTING(instance, bucket));
    lcb_string_appendz(&urlpath, "/controller/doFlush");


    htcmd.type = LCB_HTTP_TYPE_MANAGEMENT;
    htcmd.method = LCB_HTTP_METHOD_POST;
    htcmd.reqhandle = &htr;
    LCB_CMD_SET_KEY(&htcmd, urlpath.base, urlpath.nused);

    rc = lcb_http3(instance, cookie, &htcmd);
    lcb_string_release(&urlpath);

    if (rc != LCB_SUCCESS) {
        return rc;
    }
    lcb_htreq_setcb(htr, flush_cb);
    return LCB_SUCCESS;
}
