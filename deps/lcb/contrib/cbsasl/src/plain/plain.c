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
#include "plain.h"
#include "pwfile.h"
#include "util.h"

cbsasl_error_t plain_server_init()
{
    return SASL_OK;
}

cbsasl_error_t plain_server_start(cbsasl_conn_t *conn)
{
    conn->c.server.sasl_data = NULL;
    conn->c.server.sasl_data_len = 0;
    return SASL_CONTINUE;
}

cbsasl_error_t plain_server_step(cbsasl_conn_t *conn,
                                 const char *input,
                                 unsigned inputlen,
                                 const char **output,
                                 unsigned *outputlen)
{

    size_t inputpos = 0;
    while (inputpos < inputlen && input[inputpos] != '\0') {
        inputpos++;
    }
    inputpos++;

    if (inputpos >= inputlen) {
        return SASL_BADPARAM;
    }

    {
        char *cfg = NULL;
        size_t pwlen = 0;
        const char *username = input + inputpos;
        const char *password;
        char *stored_password;
        while (inputpos < inputlen && input[inputpos] != '\0') {
            inputpos++;
        }
        inputpos++;

        if (inputpos > inputlen) {
            return SASL_BADPARAM;
        } else if (inputpos != inputlen) {
            password = input + inputpos;
            while (inputpos < inputlen && input[inputpos] != '\0') {
                inputpos++;
                pwlen++;
            }
        }

        if ((stored_password = find_pw(username, &cfg)) == NULL) {
            return SASL_FAIL;
        }

        if (pwlen != strlen(stored_password)) {
            return SASL_FAIL;
        }
        if (cbsasl_secure_compare(password, stored_password, pwlen) != 0) {
            return SASL_FAIL;
        }

        conn->c.server.username = strdup(username);
        conn->c.server.config = strdup(cfg);
    }

    *output = NULL;
    *outputlen = 0;
    return SASL_OK;
}

cbsasl_mechs_t get_plain_mechs(void)
{
    static cbsasl_mechs_t mechs = {
        MECH_NAME_PLAIN,
        plain_server_init,
        plain_server_start,
        plain_server_step
    };
    return mechs;
}
