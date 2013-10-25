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

#ifndef SRC_PLAIN_PLAIN_H_
#define SRC_PLAIN_PLAIN_H_ 1

#include "config.h"

#include "cbsasl/cbsasl.h"
#define MECH_NAME_PLAIN "PLAIN"

cbsasl_error_t plain_server_init(void);

cbsasl_error_t plain_server_start(cbsasl_conn_t *conn);

cbsasl_error_t plain_server_step(cbsasl_conn_t *conn,
                                 const char *input,
                                 unsigned inputlen,
                                 const char **output,
                                 unsigned *outputlen);

cbsasl_mechs_t get_plain_mechs(void);

#endif  /* SRC_PLAIN_PLAIN_H_ */
