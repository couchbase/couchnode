/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
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

#ifndef HANDLER_H
#define HANDLER_H 1

void setup_lcb_get_resp_t(lcb_get_resp_t *resp,
                          const void *key,
                          lcb_size_t nkey,
                          const void *bytes,
                          lcb_size_t nbytes,
                          lcb_uint32_t flags,
                          lcb_cas_t cas,
                          lcb_datatype_t datatype);
void setup_lcb_remove_resp_t(lcb_remove_resp_t *resp,
                             const void *key,
                             lcb_size_t nkey,
                             lcb_cas_t cas);
void setup_lcb_store_resp_t(lcb_store_resp_t *resp,
                            const void *key,
                            lcb_size_t nkey,
                            lcb_cas_t cas);
void setup_lcb_touch_resp_t(lcb_touch_resp_t *resp,
                            const void *key,
                            lcb_size_t nkey,
                            lcb_cas_t cas);
void setup_lcb_unlock_resp_t(lcb_unlock_resp_t *resp,
                             const void *key,
                             lcb_size_t nkey);
void setup_lcb_arithmetic_resp_t(lcb_arithmetic_resp_t *resp,
                                 const void *key,
                                 lcb_size_t nkey,
                                 lcb_uint64_t value,
                                 lcb_cas_t cas);
void setup_lcb_observe_resp_t(lcb_observe_resp_t *resp,
                              const void *key,
                              lcb_size_t nkey,
                              lcb_cas_t cas,
                              lcb_observe_t status,
                              int from_master,
                              lcb_time_t ttp,
                              lcb_time_t ttr);
void setup_lcb_server_stat_resp_t(lcb_server_stat_resp_t *resp,
                                  const char *server_endpoint,
                                  const void *key,
                                  lcb_size_t nkey,
                                  const void *bytes,
                                  lcb_size_t nbytes);
void setup_lcb_server_version_resp_t(lcb_server_version_resp_t *resp,
                                     const char *server_endpoint,
                                     const char *vstring,
                                     lcb_size_t nvstring);
void setup_lcb_verbosity_resp_t(lcb_verbosity_resp_t *resp,
                                const char *server_endpoint);
void setup_lcb_flush_resp_t(lcb_flush_resp_t *resp,
                            const char *server_endpoint);

#endif
