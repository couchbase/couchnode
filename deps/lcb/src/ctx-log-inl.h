/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2014 Couchbase, Inc.
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

/* small utility for retrieving host/port information from the CTX */
static const char* get__ctx_hostinfo(const lcbio_CTX *ctx, int is_host)
{
    if (ctx == NULL || ctx->sock == NULL || ctx->sock->info == NULL) {
        return is_host ? "NOHOST" : "NOPORT";
    }
    return is_host ? ctx->sock->info->ep.host : ctx->sock->info->ep.port;
}
static const char *get_ctx_host(const lcbio_CTX *ctx) { return get__ctx_hostinfo(ctx, 1); }
static const char *get_ctx_port(const lcbio_CTX *ctx) { return get__ctx_hostinfo(ctx, 0); }
