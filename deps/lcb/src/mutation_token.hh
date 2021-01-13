/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2016-2020 Couchbase, Inc.
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

#ifndef LIBCOUCHBASE_MUTATION_TOKEN_HH
#define LIBCOUCHBASE_MUTATION_TOKEN_HH

/**
 * Retrieves the mutation token from the response structure
 * @param cbtype the type of callback invoked
 * @param rb the pointer to the response
 * @return The embedded mutation token, or NULL if the response does not have a
 *         mutation token. This may be either because the command does not support
 *         mutation tokens, or because they have been disabled at the connection
 *         level.
 */
LIBCOUCHBASE_API
const lcb_MUTATION_TOKEN *lcb_resp_get_mutation_token(int cbtype, const lcb_RESPBASE *rb);

/**
 * @volatile
 *
 * Retrieves the last mutation token for a given key.
 * This relies on the @ref LCB_CNTL_DURABILITY_MUTATION_TOKENS option, and will
 * check the instance-level log to determine the latest MUTATION_TOKEN for
 * the given vBucket ID which the key maps to.
 *
 * @param instance the instance
 * @param kb The buffer representing the key. The type of the buffer (see
 * lcb_KEYBUF::type) may either be ::LCB_KV_COPY or ::LCB_KV_VBID
 * @param[out] errp Set to an error if this function returns NULL
 * @return The mutation token if successful, otherwise NULL.
 *
 * Getting the latest mutation token for a key:
 *
 * @code{.c}
 * lcb_KEYBUF kb;
 * kb.type = LCB_KV_COPY;
 * kb.contig.bytes = "Hello";
 * kv.config.nbytes = 5;
 * mt = lcb_get_mutation_token(instance, &kb, &rc);
 * @endcode
 *
 * Getting the latest mutation token for a vbucket:
 * @code{.c}
 * lcb_KEYBUF kb;
 * kv.type = LCB_KV_VBID;
 * kv.contig.nbytes = 543;
 * kv.config.bytes = NULL;
 * mt = lcb_get_mutation_token(instance, &kb, &rc);
 * @endcode
 *
 * Getting the mutation token for each vbucket
 * @code{.c}
 * size_t ii, nvb;
 * lcbvb_CONFIG *vbc;
 * lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
 * nvb = vbucket_get_num_vbuckets(vbc);
 * for (ii = 0; ii < nvb; ii++) {
 *   lcb_KEYBUF kb;
 *   const lcb_MUTATION_TOKEN *mt;
 *   kb.type = LCB_KV_VBID;
 *   kb.contig.nbytes = ii;
 *   kb.config.bytes = NULL;
 *   mt = lcb_get_mutation_token(instance, &kb, &rc);
 * }
 * @endcode
 */
LIBCOUCHBASE_API
const lcb_MUTATION_TOKEN *lcb_get_mutation_token(lcb_INSTANCE *instance, const lcb_KEYBUF *kb, lcb_STATUS *errp);

#endif // LIBCOUCHBASE_MUTATION_TOKEN_HH
