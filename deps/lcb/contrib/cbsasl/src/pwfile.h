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

#ifndef SRC_PWFILE_H_
#define SRC_PWFILE_H_ 1

#include "config.h"
#include "cbsasl/cbsasl.h"

typedef struct user_db_entry {
    char *username;
    char *password;
    char *config;
    struct user_db_entry *next;
} user_db_entry_t;

char *find_pw(const char *u, char **cfg);

cbsasl_error_t load_user_db(void);

void free_user_ht(void);
void pwfile_init(void);

#endif /*  SRC_PWFILE_H_ */
