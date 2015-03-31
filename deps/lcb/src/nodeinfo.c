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

#include "internal.h"
#include <lcbio/lcbio.h>
#include "bucketconfig/clconfig.h"
#include "hostlist.h"

/**This file contains routines to assist users in retrieving valid nodes */

/* We're gonna try to be extra careful in this function since many SDKs use
 * this to display node and/or host-port information.*/

static int
ensure_scratch(lcb_t instance, lcb_SIZE capacity)
{
    if (!instance->scratch) {
        instance->scratch = calloc(1, sizeof(*instance->scratch));
        if (!instance->scratch) {
            return 0;
        }
        lcb_string_init(instance->scratch);
    } else {
        lcb_string_clear(instance->scratch);
    }

    if (0 != lcb_string_reserve(instance->scratch, capacity)) {
        return 0;
    }
    return 1;
}

static const char *
mk_scratch_host(lcb_t instance, const lcb_host_t *host)
{
    if (!ensure_scratch(instance, strlen(host->host)+strlen(host->port)+2)) {
        return NULL;
    }
    lcb_string_appendz(instance->scratch, host->host);
    lcb_string_appendz(instance->scratch, ":");
    lcb_string_appendz(instance->scratch, host->port);
    return instance->scratch->base;
}

static const char *
return_badhost(lcb_GETNODETYPE type)
{
    if (type & LCB_NODE_NEVERNULL) {
        return LCB_GETNODE_UNAVAILABLE;
    } else {
        return NULL;
    }
}

LIBCOUCHBASE_API
const char *
lcb_get_node(lcb_t instance, lcb_GETNODETYPE type, unsigned ix)
{
    if (type & LCB_NODE_HTCONFIG) {
        if (type & LCB_NODE_CONNECTED) {
            const lcb_host_t *host = lcb_confmon_get_rest_host(instance->confmon);
            if (host) {
                return mk_scratch_host(instance, host);
            } else {
                return return_badhost(type);
            }

        } else {
            /* Retrieve one from the vbucket configuration */
            lcbvb_CONFIG *vbc = LCBT_VBCONFIG(instance);
            lcbvb_SVCMODE mode;
            const char *hp = NULL;
            if (LCBT_SETTING(instance, sslopts) & LCB_SSL_ENABLED) {
                mode = LCBVB_SVCMODE_SSL;
            } else {
                mode = LCBVB_SVCMODE_PLAIN;
            }

            if (instance->type == LCB_TYPE_BUCKET) {
                if (vbc) {
                    ix %= LCBVB_NSERVERS(vbc);
                    hp = lcbvb_get_hostport(vbc, ix, LCBVB_SVCTYPE_MGMT, mode);

                } else if ((type & LCB_NODE_NEVERNULL) == 0) {
                    return NULL;
                }
            }
            if (hp == NULL && instance->ht_nodes && instance->ht_nodes->nentries) {
                ix %= instance->ht_nodes->nentries;
                hostlist_ensure_strlist(instance->ht_nodes);
                hp = instance->ht_nodes->slentries[ix];
            }
            if (!hp) {
                if ((hp = return_badhost(type)) == NULL) {
                    return NULL;
                }
            }
            if (!ensure_scratch(instance, strlen(hp)+1)) {
                return NULL;
            }
            lcb_string_appendz(instance->scratch, hp);
            return instance->scratch->base;
        }
    } else if (type & (LCB_NODE_DATA|LCB_NODE_VIEWS)) {
        const mc_SERVER *server;
        ix %= LCBT_NSERVERS(instance);
        server = LCBT_GET_SERVER(instance, ix);

        if ((type & LCB_NODE_CONNECTED) && server->connctx == NULL) {
            return return_badhost(type);
        }
        if (server->curhost == NULL) {
            return return_badhost(type);
        }

        /* otherwise, return the actual host:port of the server */
        if (type & LCB_NODE_DATA) {
            return mk_scratch_host(instance, server->curhost);
        } else {
            return server->viewshost;
        }
    } else {
        return NULL; /* don't know the type */
    }
}

LIBCOUCHBASE_API const char * lcb_get_host(lcb_t instance) {
    char *colon;
    const char *rv = lcb_get_node(instance,
        LCB_NODE_HTCONFIG|LCB_NODE_NEVERNULL, 0);
    if (rv != NULL && (colon = (char *)strstr(rv, ":"))  != NULL) {
        if (instance->scratch && rv == instance->scratch->base) {
            *colon = '\0';
        }
    }
    return rv;
}

LIBCOUCHBASE_API const char * lcb_get_port(lcb_t instance) {
    const char *rv = lcb_get_node(instance,
        LCB_NODE_HTCONFIG|LCB_NODE_NEVERNULL, 0);
    if (rv && (rv = strstr(rv, ":"))) {
        rv++;
    }
    return rv;
}

LIBCOUCHBASE_API
lcb_int32_t lcb_get_num_replicas(lcb_t instance)
{
    if (LCBT_VBCONFIG(instance)) {
        return LCBT_NREPLICAS(instance);
    } else {
        return -1;
    }
}

LIBCOUCHBASE_API
lcb_int32_t lcb_get_num_nodes(lcb_t instance)
{
    if (LCBT_VBCONFIG(instance)) {
        return LCBT_NSERVERS(instance);
    } else {
        return -1;
    }
}

LIBCOUCHBASE_API
const char *const *lcb_get_server_list(lcb_t instance)
{
    hostlist_ensure_strlist(instance->ht_nodes);
    return (const char * const * )instance->ht_nodes->slentries;
}
