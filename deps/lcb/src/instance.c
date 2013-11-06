/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2013 Couchbase, Inc.
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

/**
 * This file contains the functions to create / destroy the libcouchbase instance
 *
 * @author Trond Norbye
 * @todo add more documentation
 */
#include "internal.h"
#ifndef _WIN32
#include <dlfcn.h>
#endif


/**
 * Get the version of the library.
 *
 * @param version where to store the numeric representation of the
 *         version (or NULL if you don't care)
 *
 * @return the textual description of the version ('\0'
 *          terminated). Do <b>not</b> try to release this string.
 *
 */
LIBCOUCHBASE_API
const char *lcb_get_version(lcb_uint32_t *version)
{
    if (version != NULL) {
        *version = (lcb_uint32_t)LCB_VERSION;
    }

    return LCB_VERSION_STRING;
}

LIBCOUCHBASE_API
const char *lcb_get_host(lcb_t instance)
{
    return instance->connection.host;
}

LIBCOUCHBASE_API
const char *lcb_get_port(lcb_t instance)
{
    return instance->connection.port;
}


LIBCOUCHBASE_API
lcb_int32_t lcb_get_num_replicas(lcb_t instance)
{
    if (instance->vbucket_config) {
        return instance->nreplicas;
    } else {
        return -1;
    }
}

LIBCOUCHBASE_API
lcb_int32_t lcb_get_num_nodes(lcb_t instance)
{
    if (instance->vbucket_config) {
        return (lcb_int32_t)instance->nservers;
    } else {
        return -1;
    }
}

/**
 * Return a NULL-terminated list of servers (host:port) for the entire cluster.
 */
LIBCOUCHBASE_API
const char *const *lcb_get_server_list(lcb_t instance)
{
    /* cast it so we get the full const'ness */
    return (const char * const *)instance->backup_nodes;
}


static lcb_error_t validate_hostname(const char *host, char **realhost)
{
    /* The http parser aborts if it finds a space.. we don't want our
     * program to core, so run a prescan first
     */
    lcb_size_t len = strlen(host);
    lcb_size_t ii;
    char *schema = strstr(host, "://");
    char *path;
    int port = 8091;
    int numcolons = 0;

    for (ii = 0; ii < len; ++ii) {
        if (isspace(host[ii])) {
            return LCB_INVALID_HOST_FORMAT;
        }
    }

    if (schema != NULL) {
        lcb_size_t size;
        size = schema - host;
        if (size != 4 && strncasecmp(host, "http", 4) != 0) {
            return LCB_INVALID_HOST_FORMAT;
        }
        host += 7;
        len -= 7;
        port = 80;
    }

    path = strchr(host, '/');
    if (path != NULL) {
        lcb_size_t size;
        if (strcmp(path, "/pools") != 0 && strcmp(path, "/pools/") != 0) {
            return LCB_INVALID_HOST_FORMAT;
        }
        size = path - host;
        len = (int)size;
    }

    if (strchr(host, ':') != NULL) {
        port = 0;
    }

    for (ii = 0; ii < len; ++ii) {
        if (isalnum(host[ii]) == 0) {
            switch (host[ii]) {
            case ':' :
                ++numcolons;
                break;
            case '.' :
            case '-' :
            case '_' :
                break;
            default:
                /* Invalid character in the hostname */
                return LCB_INVALID_HOST_FORMAT;
            }
        }
    }

    if (numcolons > 1) {
        return LCB_INVALID_HOST_FORMAT;
    }

    if (port == 0) {
        if ((*realhost = strdup(host)) == NULL) {
            return LCB_CLIENT_ENOMEM;
        }

        (*realhost)[len] = '\0';
    } else {
        if ((*realhost = malloc(len + 10)) == NULL) {
            return LCB_CLIENT_ENOMEM;
        }
        memcpy(*realhost, host, len);
        sprintf(*realhost + len, ":%d", port);
    }

    return LCB_SUCCESS;
}

static lcb_error_t setup_bootstrap_hosts(lcb_t ret, const char *host)
{
    const char *ptr = host;
    lcb_size_t num = 0;
    int ii;

    while ((ptr = strchr(ptr, ';')) != NULL) {
        ++ptr;
        ++num;
    }

    /* Let's allocate the buffer space and copy the pointers
     * (the +2 and not +1 is because of the way we count the number of
     * bootstrap hosts (num == 0 means that we've got a single host etc)
     */
    if ((ret->backup_nodes = calloc(num + 2, sizeof(char *))) == NULL) {
        return LCB_CLIENT_ENOMEM;
    }

    ret->should_free_backup_nodes = 1;

    ptr = host;
    ii = 0;
    do {
        char nm[NI_MAXHOST + NI_MAXSERV + 2];
        const char *start = ptr;
        lcb_error_t error;

        ptr = strchr(ptr, ';');
        ret->backup_nodes[ii] = NULL;
        if (ptr == NULL) {
            /* this is the last part */
            error = validate_hostname(start, &ret->backup_nodes[ii]);
            ptr = NULL;
        } else {
            /* copy everything up to ';' */
            unsigned long size = (unsigned long)ptr - (unsigned long)start;
            /* skip the entry if it's too long */
            if (size < sizeof(nm)) {
                memcpy(nm, start, (lcb_size_t)(ptr - start));
                *(nm + size) = '\0';
            }
            ++ptr;
            error = validate_hostname(nm, &ret->backup_nodes[ii]);
        }
        if (error != LCB_SUCCESS) {
            while (ii > 0) {
                free(ret->backup_nodes[ii--]);
            }
            return error;
        }

        ++ii;
    } while (ptr != NULL);

    if (ret->randomize_bootstrap_nodes) {
        ii = 1;
        while (ret->backup_nodes[ii] != NULL) {
            lcb_size_t nidx = (lcb_size_t)(gethrtime() >> 10) % ii;
            char *other = ret->backup_nodes[nidx];
            ret->backup_nodes[nidx] = ret->backup_nodes[ii];
            ret->backup_nodes[ii] = other;
            ++ii;
        }
    }

    ret->backup_idx = 0;
    return LCB_SUCCESS;
}

static const char *get_nonempty_string(const char *s)
{
    if (s != NULL && strlen(s) == 0) {
        return NULL;
    }
    return s;
}

LIBCOUCHBASE_API
lcb_error_t lcb_create(lcb_t *instance,
                       const struct lcb_create_st *options)
{
    const char *host = NULL;
    const char *user = NULL;
    const char *passwd = NULL;
    const char *bucket = NULL;
    struct lcb_io_opt_st *io = NULL;
    char buffer[1024];
    lcb_ssize_t offset = 0;
    lcb_type_t type = LCB_TYPE_BUCKET;
    lcb_t obj;
    lcb_error_t err;

    if (options != NULL) {
        switch (options->version) {
        case 0:
            host = get_nonempty_string(options->v.v0.host);
            user = get_nonempty_string(options->v.v0.user);
            passwd = get_nonempty_string(options->v.v0.passwd);
            bucket = get_nonempty_string(options->v.v0.bucket);
            io = options->v.v0.io;
            break;
        case 1:
            type = options->v.v1.type;
            host = get_nonempty_string(options->v.v1.host);
            user = get_nonempty_string(options->v.v1.user);
            passwd = get_nonempty_string(options->v.v1.passwd);
            io = options->v.v1.io;
            switch (type) {
            case LCB_TYPE_BUCKET:
                bucket = get_nonempty_string(options->v.v1.bucket);
                break;
            case LCB_TYPE_CLUSTER:
                if (user == NULL || passwd == NULL) {
                    return LCB_EINVAL;
                }
                break;
            }
            break;
        default:
            return LCB_EINVAL;
        }
    }

    if (host == NULL) {
        host = "localhost";
    }

    if (bucket == NULL) {
        bucket = "default";
    }

    /* Do not allow people use Administrator account for data access */
    if (type == LCB_TYPE_BUCKET && user && strcmp(user, bucket) != 0) {
        return LCB_INVALID_USERNAME;
    }

    if ((obj = calloc(1, sizeof(*obj))) == NULL) {
        return LCB_CLIENT_ENOMEM;
    }
    obj->type = type;
    obj->compat.type = (lcb_compat_t)0xdead;

    if (io == NULL) {
        lcb_io_opt_t ops;
        if ((err = lcb_create_io_ops(&ops, NULL)) != LCB_SUCCESS) {
            /* You can't initialize the library without a io-handler! */
            free(obj);
            return err;
        }
        io = ops;
        io->v.v0.need_cleanup = 1;
    }

    obj->randomize_bootstrap_nodes = 1;
    obj->bummer = 0;
    obj->io = io;
    obj->syncmode = LCB_ASYNCHRONOUS;
    obj->ipv6 = LCB_IPV6_DISABLED;
    obj->operation_timeout = LCB_DEFAULT_TIMEOUT;
    obj->config_timeout = LCB_DEFAULT_CONFIGURATION_TIMEOUT;
    obj->views_timeout = LCB_DEFAULT_VIEW_TIMEOUT;
    obj->rbufsize = LCB_DEFAULT_RBUFSIZE;
    obj->wbufsize = LCB_DEFAULT_WBUFSIZE;
    obj->durability_timeout = LCB_DEFAULT_DURABILITY_TIMEOUT;
    obj->durability_interval = LCB_DEFAULT_DURABILITY_INTERVAL;
    obj->http_timeout = LCB_DEFAULT_HTTP_TIMEOUT;
    obj->weird_things_threshold = LCB_DEFAULT_CONFIG_ERRORS_THRESHOLD;
    obj->max_redir = LCB_DEFAULT_CONFIG_MAXIMUM_REDIRECTS;

    lcb_initialize_packet_handlers(obj);

    err = lcb_connection_init(&obj->connection, obj);
    if (err != LCB_SUCCESS) {
        lcb_destroy(obj);
        return err;
    }
    obj->connection.data = obj;

    err = setup_bootstrap_hosts(obj, host);
    if (err != LCB_SUCCESS) {
        lcb_destroy(obj);
        return err;
    }
    obj->timers = hashset_create();
    obj->http_requests = hashset_create();
    obj->durability_polls = hashset_create();
    /* No error has occurred yet. */
    obj->last_error = LCB_SUCCESS;

    switch (type) {
    case LCB_TYPE_BUCKET:
        offset = snprintf(buffer, sizeof(buffer),
                          "GET /pools/default/bucketsStreaming/%s HTTP/1.1\r\n",
                          bucket);
        break;
    case LCB_TYPE_CLUSTER:
        offset = snprintf(buffer, sizeof(buffer), "GET /pools/ HTTP/1.1\r\n");
        break;
    default:
        return LCB_EINVAL;
    }

    if (user && *user) {
        obj->username = strdup(user);
    } else if (type == LCB_TYPE_BUCKET) {
        obj->username = strdup(bucket);
    }
    if (passwd) {
        char cred[256];
        char base64[256];
        snprintf(cred, sizeof(cred), "%s:%s", obj->username, passwd);
        if (lcb_base64_encode(cred, base64, sizeof(base64)) == -1) {
            lcb_destroy(obj);
            return LCB_EINTERNAL;
        }
        obj->password = strdup(passwd);
        offset += snprintf(buffer + offset, sizeof(buffer) - (lcb_size_t)offset,
                           "Authorization: Basic %s\r\n", base64);
    }

    offset += snprintf(buffer + offset, sizeof(buffer) - (lcb_size_t)offset,
                       "%s", LCB_LAST_HTTP_HEADER);

    /* Add space for: Host: \r\n\r\n" */
    obj->http_uri = malloc(strlen(buffer) + strlen(host) + 80);
    if (obj->http_uri == NULL) {
        lcb_destroy(obj);
        return LCB_CLIENT_ENOMEM;
    }

    if (!ringbuffer_initialize(&obj->purged_buf, 4096)) {
        lcb_destroy(obj);
        return LCB_CLIENT_ENOMEM;
    }
    if (!ringbuffer_initialize(&obj->purged_cookies, 4096)) {
        lcb_destroy(obj);
        return LCB_CLIENT_ENOMEM;
    }

    strcpy(obj->http_uri, buffer);

    *instance = obj;
    return LCB_SUCCESS;
}


LIBCOUCHBASE_API
void lcb_destroy(lcb_t instance)
{
    lcb_size_t ii;
    free(instance->http_uri);

    if (instance->timers != NULL) {
        for (ii = 0; ii < instance->timers->capacity; ++ii) {
            if (instance->timers->items[ii] > 1) {
                lcb_timer_destroy(instance,
                                  (lcb_timer_t)instance->timers->items[ii]);
            }
        }
        hashset_destroy(instance->timers);
    }

    lcb_connection_cleanup(&instance->connection);
    if (instance->durability_polls) {
        struct lcb_durability_set_st **dset_list;
        lcb_size_t nitems = hashset_num_items(instance->durability_polls);
        dset_list = (struct lcb_durability_set_st **)
                    hashset_get_items(instance->durability_polls, NULL);
        if (dset_list) {
            for (ii = 0; ii < nitems; ii++) {
                lcb_durability_dset_destroy(dset_list[ii]);
            }
            free(dset_list);
        }
        hashset_destroy(instance->durability_polls);
    }

    if (instance->vbucket_config != NULL) {
        vbucket_config_destroy(instance->vbucket_config);
    }

    for (ii = 0; ii < instance->nservers; ++ii) {
        lcb_server_destroy(instance->servers + ii);
    }

    if (instance->http_requests) {
        for (ii = 0; ii < instance->http_requests->capacity; ++ii) {
            if (instance->http_requests->items[ii] > 1) {
                lcb_http_request_t htreq =
                    (lcb_http_request_t)instance->http_requests->items[ii];

                /**
                 * We don't want to invoke callbacks *or* remove it from our
                 * hash table
                 */
                htreq->status |= LCB_HTREQ_S_CBINVOKED | LCB_HTREQ_S_HTREMOVED;

                /* we should figure out a better error code for this.. */
                lcb_http_request_finish(instance, htreq, LCB_ERROR);
            }
        }
    }

    hashset_destroy(instance->http_requests);
    lcb_free_backup_nodes(instance);
    free(instance->servers);
    if (instance->io && instance->io->v.v0.need_cleanup) {
        lcb_destroy_io_ops(instance->io);
    }

    ringbuffer_destruct(&instance->purged_buf);
    ringbuffer_destruct(&instance->purged_cookies);

    free(instance->vbucket_stream.input.data);
    free(instance->vbucket_stream.chunk.data);
    free(instance->vbucket_stream.header);
    free(instance->vb_server_map);
    free(instance->histogram);
    free(instance->username);
    free(instance->password);
    free(instance->sasl_mech_force);
    memset(instance, 0xff, sizeof(*instance));
    free(instance);
}

static void dummy_error_callback(lcb_t instance, lcb_error_t err,
                                 const char *msg)
{
    (void)instance;
    (void)err;
    (void)msg;
}

LIBCOUCHBASE_API
lcb_error_t lcb_connect(lcb_t instance)
{
    instance->backup_idx = 0;
    if (instance->compat.type == LCB_MEMCACHED_CLUSTER ||
            (instance->compat.type == LCB_CACHED_CONFIG &&
             instance->vbucket_config != NULL &&
             instance->compat.value.cached.updating == 0)) {
        return LCB_SUCCESS;
    }

    switch (instance->connection.state) {
    case LCB_CONNSTATE_CONNECTED:
        return LCB_SUCCESS;
    case LCB_CONNSTATE_INPROGRESS:
        return LCB_BUSY;
    default: {
        lcb_error_t ret;
        lcb_error_callback old_cb;

        old_cb = instance->callbacks.error;
        instance->callbacks.error = dummy_error_callback;
        ret = lcb_instance_start_connection(instance);
        instance->callbacks.error = old_cb;
        return ret;

    }

    }
}

void lcb_free_backup_nodes(lcb_t instance)
{
    if (instance->should_free_backup_nodes) {
        char **ptr = instance->backup_nodes;
        while (*ptr != NULL) {
            free(*ptr);
            ptr++;
        }
        instance->should_free_backup_nodes = 0;
    }
    free(instance->backup_nodes);
    instance->backup_nodes = NULL;
    instance->backup_idx = 0;
}

LIBCOUCHBASE_API
void *lcb_mem_alloc(lcb_size_t size)
{
    return malloc(size);
}

LIBCOUCHBASE_API
void lcb_mem_free(void *ptr)
{
    free(ptr);
}
