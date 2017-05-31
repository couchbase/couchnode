/*
 *     Copyright 2013 Couchbase, Inc.
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

#include "cbsasl/cbsasl.h"
#include "cram-md5/hmac.h"
#include "util.h"
#include <time.h>
#include <stdlib.h>
#include <string.h>

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_client_new(const char *service,
                                 const char *serverFQDN,
                                 const char *iplocalport,
                                 const char *ipremoteport,
                                 const cbsasl_callback_t *prompt_supp,
                                 unsigned flags,
                                 cbsasl_conn_t **pconn)
{
    cbsasl_conn_t *conn;
    cbsasl_callback_t *callbacks = (cbsasl_callback_t*)prompt_supp;
    int ii;

    if (prompt_supp == NULL) {
        return SASL_BADPARAM;
    }

    conn = calloc(1, sizeof(*conn));
    if (conn == NULL) {
        return SASL_NOMEM;
    }

    conn->client = 1;

    ii = 0;
    /* Locate the callbacks */
    while (callbacks[ii].id != CBSASL_CB_LIST_END) {
        if (callbacks[ii].id == CBSASL_CB_USER || callbacks[ii].id == CBSASL_CB_AUTHNAME) {
            union {
                int (*get)(void *, int, const char **, unsigned int *);
                int (*proc)(void);
            } hack;
            hack.proc = callbacks[ii].proc;
            conn->c.client.get_username = hack.get;
            conn->c.client.get_username_ctx = callbacks[ii].context;
        } else if (callbacks[ii].id == CBSASL_CB_PASS) {
            union {
                int (*get)(cbsasl_conn_t *, void *, int, cbsasl_secret_t **);
                int (*proc)(void);
            } hack;
            hack.proc = callbacks[ii].proc;
            conn->c.client.get_password = hack.get;
            conn->c.client.get_password_ctx = callbacks[ii].context;
        }
        ++ii;
    }

    if (conn->c.client.get_username == NULL || conn->c.client.get_password == NULL) {
        cbsasl_dispose(&conn);
        return SASL_NOUSER;
    }

    *pconn = conn;

    (void)service;
    (void)serverFQDN;
    (void)iplocalport;
    (void)ipremoteport;
    (void)flags;

    return SASL_OK;
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_client_start(cbsasl_conn_t *conn,
                                   const char *mechlist,
                                   void **prompt_need,
                                   const char **clientout,
                                   unsigned int *clientoutlen,
                                   const char **mech)
{
    if (conn->client == 0) {
        return SASL_BADPARAM;
    }

    if (strstr(mechlist, "CRAM-MD5") == NULL) {
        if (strstr(mechlist, "PLAIN") == NULL) {
            return SASL_NOMECH;
        }

        *mech = "PLAIN";
        conn->c.client.plain = 1;
    } else {
        *mech = "CRAM-MD5";
        conn->c.client.plain = 0;
    }


    if (conn->c.client.plain) {
        const char *usernm = NULL;
        unsigned int usernmlen;
        cbsasl_secret_t *pass;

        cbsasl_error_t ret;
        ret = conn->c.client.get_username(conn->c.client.get_username_ctx,
                                          CBSASL_CB_USER,
                                          &usernm, &usernmlen);
        if (ret != SASL_OK) {
            return ret;
        }

        ret = conn->c.client.get_password(conn, conn->c.client.get_password_ctx,
                                          CBSASL_CB_PASS,
                                          &pass);
        if (ret != SASL_OK) {
            return ret;
        }

        conn->c.client.userdata = calloc(usernmlen + 1 + pass->len + 1, 1);
        if (conn->c.client.userdata == NULL) {
            return SASL_NOMEM;
        }

        memcpy(conn->c.client.userdata + 1, usernm, usernmlen);
        memcpy(conn->c.client.userdata + usernmlen + 2, pass->data, pass->len);
        *clientout = conn->c.client.userdata;
        *clientoutlen = (unsigned int)(usernmlen + 2 + pass->len);
    } else {
        /* CRAM-MD5 */
        *clientout = NULL;
        *clientoutlen = 0;
    }

    (void)prompt_need;
    return SASL_OK;
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_client_step(cbsasl_conn_t *conn,
                                  const char *serverin,
                                  unsigned int serverinlen,
                                  void **not_used,
                                  const char **clientout,
                                  unsigned int *clientoutlen)
{
    unsigned char digest[DIGEST_LENGTH];
    char md5string[DIGEST_LENGTH * 2];
    const char *usernm = NULL;
    unsigned int usernmlen;
    cbsasl_secret_t *pass;
    cbsasl_error_t ret;

    (void)not_used;

    if (conn->client == 0) {
        return SASL_BADPARAM;
    }

    if (conn->c.client.plain) {
        /* Shouldn't be called during plain auth */
        return SASL_BADPARAM;
    }

    ret = conn->c.client.get_username(conn->c.client.get_username_ctx,
                                      CBSASL_CB_USER, &usernm, &usernmlen);
    if (ret != SASL_OK) {
        return ret;
    }

    ret = conn->c.client.get_password(conn, conn->c.client.get_password_ctx,
                                      CBSASL_CB_PASS, &pass);
    if (ret != SASL_OK) {
        return ret;
    }

    free(conn->c.client.userdata);
    conn->c.client.userdata = calloc(usernmlen + 1 + sizeof(md5string) + 1, 1);
    if (conn->c.client.userdata == NULL) {
        return SASL_NOMEM;
    }

    cbsasl_hmac_md5((unsigned char*)serverin, serverinlen, pass->data,
             pass->len, digest);
    cbsasl_hex_encode(md5string, (char *) digest, DIGEST_LENGTH);
    memcpy(conn->c.client.userdata, usernm, usernmlen);
    conn->c.client.userdata[usernmlen] = ' ';
    memcpy(conn->c.client.userdata + usernmlen + 1, md5string,
           sizeof(md5string));

    *clientout = conn->c.client.userdata;
    *clientoutlen = strlen(conn->c.client.userdata);

    return SASL_CONTINUE;
}
