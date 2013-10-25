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
#include "cram-md5.h"
#include "hmac.h"
#include "pwfile.h"
#include "util.h"

#define CHALLENGE_TEMPLATE "<xxxxxxxxxxxxxxxx.0@127.0.0.1>"
#define CHALLENGE_LENGTH strlen(CHALLENGE_TEMPLATE)
#define NONCE_LENGTH 16
#define NONCE_SWAPS 100

static void generate_nonce(char *nonce)
{
    int i;
    for (i = 0; i < NONCE_LENGTH; i++) {
        nonce[i] = '0' + (rand() % 10);
    }
}

static void challenge(char **challenge, unsigned *challengelen)
{
    char nonce[NONCE_LENGTH];
    generate_nonce(nonce);
    *challenge = (char *)malloc(CHALLENGE_LENGTH * sizeof(char));
    memcpy((void *)((*challenge)), CHALLENGE_TEMPLATE, CHALLENGE_LENGTH);
    memcpy((void *)((*challenge) + 1), nonce, NONCE_LENGTH);
    *challengelen = CHALLENGE_LENGTH;
}

cbsasl_error_t cram_md5_server_init()
{
    return SASL_OK;
}

cbsasl_error_t cram_md5_server_start(cbsasl_conn_t *conn)
{
    challenge(&(conn->c.server.sasl_data), &(conn->c.server.sasl_data_len));
    return SASL_CONTINUE;
}

cbsasl_error_t cram_md5_server_step(cbsasl_conn_t *conn,
                                    const char *input,
                                    unsigned inputlen,
                                    const char **output,
                                    unsigned *outputlen)
{
    unsigned int userlen;
    char *user;
    char *cfg;
    char *pass;
    unsigned char digest[DIGEST_LENGTH];
    char md5string[DIGEST_LENGTH * 2];

    if (inputlen <= 33) {
        return SASL_BADPARAM;
    }

    userlen = inputlen - (DIGEST_LENGTH * 2) - 1;
    user = calloc((userlen + 1) * sizeof(char), 1);
    memcpy(user, input, userlen);
    user[userlen] = '\0';

    pass = find_pw(user, &cfg);
    if (pass == NULL) {
        return SASL_FAIL;
    }

    hmac_md5((unsigned char *)conn->c.server.sasl_data,
             conn->c.server.sasl_data_len,
             (unsigned char *)pass,
             strlen(pass), digest);

    cbsasl_hex_encode(md5string, (char *) digest, DIGEST_LENGTH);

    if (cbsasl_secure_compare(md5string, &(input[userlen + 1]),
                              (DIGEST_LENGTH * 2)) != 0) {
        return SASL_FAIL;
    }

    conn->c.server.username = user;
    conn->c.server.config = strdup(cfg);
    *output = NULL;
    *outputlen = 0;
    return SASL_OK;
}

cbsasl_mechs_t get_cram_md5_mechs(void)
{
    static cbsasl_mechs_t mechs = {
        MECH_NAME_CRAM_MD5,
        cram_md5_server_init,
        cram_md5_server_start,
        cram_md5_server_step
    };
    return mechs;
}
