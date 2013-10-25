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

#include "config.h"

#include "cbsasl/cbsasl.h"
#include "cram-md5/cram-md5.h"
#include "cram-md5/hmac.h"
#include "plain/plain.h"
#include "pwfile.h"
#include "util.h"
#include <time.h>

#define IS_MECH(str, mech) (strncmp(str, mech, strlen(mech)))

cbsasl_error_t cbsasl_list_mechs(const char **mechs,
                                 unsigned *mechslen)
{
    *mechs = "CRAM-MD5 PLAIN";
    *mechslen = strlen(*mechs);
    return SASL_OK;
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_server_init()
{
    srand((unsigned int)time(NULL));
    pwfile_init();
    return load_user_db();
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_server_start(cbsasl_conn_t **conn,
                                   const char *mech,
                                   const char *clientin,
                                   unsigned int clientinlen,
                                   unsigned char **serverout,
                                   unsigned int *serveroutlen)
{
    cbsasl_error_t err;

    if (*conn != NULL) {
        cbsasl_dispose(conn);
    }

    *conn = calloc(1, sizeof(cbsasl_conn_t));
    if (*conn == NULL) {
        return SASL_NOMEM;
    }

    if (IS_MECH(mech, MECH_NAME_PLAIN) == 0) {
        cbsasl_mechs_t plain_mech = get_plain_mechs();
        memcpy(&(*conn)->c.server.mech, &plain_mech, sizeof(cbsasl_mechs_t));
    } else if (IS_MECH(mech, MECH_NAME_CRAM_MD5) == 0) {
        cbsasl_mechs_t cram_md5_mech = get_cram_md5_mechs();
        memcpy(&(*conn)->c.server.mech, &cram_md5_mech, sizeof(cbsasl_mechs_t));
    } else {
        cbsasl_dispose(conn);
        return SASL_BADPARAM;
    }

    if ((err = (*conn)->c.server.mech.init()) != SASL_OK) {
        cbsasl_dispose(conn);
        return err;
    }

    err = (*conn)->c.server.mech.start(*conn);
    if (serverout) {
        *serverout = (void*)(*conn)->c.server.sasl_data;
    }
    if (serveroutlen) {
        *serveroutlen = (*conn)->c.server.sasl_data_len;
    }

    if (err == SASL_CONTINUE && clientinlen != 0) {
        return cbsasl_server_step(*conn, clientin, clientinlen,
                                  (const char**)serverout, serveroutlen);
    }

    return err;
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_server_step(cbsasl_conn_t *conn,
                                  const char *input,
                                  unsigned inputlen,
                                  const char **output,
                                  unsigned *outputlen)
{
    if (conn->client) {
        return SASL_BADPARAM;
    }
    return conn->c.server.mech.step(conn, input, inputlen, output, outputlen);
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_server_refresh(void)
{
    return load_user_db();
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_getprop(cbsasl_conn_t *conn,
                              cbsasl_prop_t propnum,
                              const void **pvalue)
{
    if (conn->client || pvalue == NULL) {
        return SASL_BADPARAM;
    }

    switch (propnum) {
    case CBSASL_USERNAME:
        *pvalue = conn->c.server.username;
        break;
    case CBSASL_CONFIG:
        *pvalue = conn->c.server.config;
        break;
    default:
        return SASL_BADPARAM;
    }

    return SASL_OK;
}

CBSASL_PUBLIC_API
cbsasl_error_t cbsasl_setprop(cbsasl_conn_t *conn,
                              cbsasl_prop_t propnum,
                              const void *pvalue)
{
    void *old;
    if (conn->client) {
        return SASL_BADPARAM;
    }

    switch (propnum) {
    case CBSASL_USERNAME:
        old = conn->c.server.username;
        if ((conn->c.server.username = strdup(pvalue)) == NULL) {
            conn->c.server.username = old;
            return SASL_NOMEM;
        }
        break;
    case CBSASL_CONFIG:
        old = conn->c.server.config;
        if ((conn->c.server.config = strdup(pvalue)) == NULL) {
            conn->c.server.config = old;
            return SASL_NOMEM;
        }
        break;
    default:
        return SASL_BADPARAM;
    }

    free(old);
    return SASL_OK;

}
