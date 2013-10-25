/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2013 Couchbase, Inc.
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
 * This file contains the abstraction layer for a bucket configuration
 * provider.
 *
 * Included are routines for scheduling refreshes and the like.
 *
 * Previously this was tied to the instance; however we'll now make it
 * its own structure
 */

#include "internal.h"


/**
 * Callback functions called from libsasl to get the username to use for
 * authentication.
 *
 * @param context ponter to the lcb_t instance running the sasl bits
 * @param id the piece of information libsasl wants
 * @param result where to store the result (OUT)
 * @param len The length of the data returned (OUT)
 * @return SASL_OK if succes
 */
static int sasl_get_username(void *context, int id, const char **result,
                             unsigned int *len)
{
    lcb_t instance = context;
    if (!context || !result || (id != CBSASL_CB_USER && id != CBSASL_CB_AUTHNAME)) {
        return SASL_BADPARAM;
    }

    *result = instance->sasl.name;
    if (len) {
        *len = (unsigned int)strlen(*result);
    }

    return SASL_OK;
}

/**
 * Callback functions called from libsasl to get the password to use for
 * authentication.
 *
 * @param context ponter to the lcb_t instance running the sasl bits
 * @param id the piece of information libsasl wants
 * @param psecret where to store the result (OUT)
 * @return SASL_OK if succes
 */
static int sasl_get_password(cbsasl_conn_t *conn, void *context, int id,
                             cbsasl_secret_t **psecret)
{
    lcb_t instance = context;
    if (!conn || ! psecret || id != CBSASL_CB_PASS || instance == NULL) {
        return SASL_BADPARAM;
    }

    *psecret = &instance->sasl.password.secret;
    return SASL_OK;
}

static lcb_error_t setup_sasl_params(lcb_t instance)
{
    const char *passwd;
    cbsasl_callback_t sasl_callbacks[4];

    sasl_callbacks[0].id = CBSASL_CB_USER;
    sasl_callbacks[0].proc = (int( *)(void)) &sasl_get_username;
    sasl_callbacks[0].context = instance;
    sasl_callbacks[1].id = CBSASL_CB_AUTHNAME;
    sasl_callbacks[1].proc = (int( *)(void)) &sasl_get_username;
    sasl_callbacks[1].context = instance;
    sasl_callbacks[2].id = CBSASL_CB_PASS;
    sasl_callbacks[2].proc = (int( *)(void)) &sasl_get_password;
    sasl_callbacks[2].context = instance;
    sasl_callbacks[3].id = CBSASL_CB_LIST_END;
    sasl_callbacks[3].proc = NULL;
    sasl_callbacks[3].context = NULL;

    instance->sasl.name = instance->username;
    memset(instance->sasl.password.buffer, 0,
           sizeof(instance->sasl.password.buffer));
    passwd = instance->password;

    if (passwd) {
        unsigned long pwlen;
        lcb_size_t maxlen;

        pwlen = (unsigned long)strlen(passwd);
        maxlen = sizeof(instance->sasl.password.buffer) -
                 offsetof(cbsasl_secret_t, data);

        instance->sasl.password.secret.len = pwlen;

        if (pwlen < maxlen) {
            memcpy(instance->sasl.password.secret.data, passwd, pwlen);
        } else {
            return lcb_error_handler(instance, LCB_EINVAL, "Password too long");
        }
    }

    memcpy(instance->sasl.callbacks, sasl_callbacks, sizeof(sasl_callbacks));
    return LCB_SUCCESS;
}

lcb_error_t lcb_apply_vbucket_config(lcb_t instance, VBUCKET_CONFIG_HANDLE config)
{
    lcb_uint16_t ii, max, buii;
    lcb_size_t num;
    lcb_error_t err;

    instance->vbucket_config = config;
    instance->weird_things = 0;
    num = (lcb_size_t)vbucket_config_get_num_servers(config);

    /* servers array should be freed in the caller */
    instance->servers = calloc(num, sizeof(lcb_server_t));
    if (instance->servers == NULL) {
        return lcb_error_handler(instance,
                                 LCB_CLIENT_ENOMEM, "Failed to allocate memory");
    }
    instance->nservers = num;
    lcb_free_backup_nodes(instance);
    instance->backup_nodes = calloc(num + 1, sizeof(char *));

    if (instance->backup_nodes == NULL) {
        return lcb_error_handler(instance,
                                 LCB_CLIENT_ENOMEM, "Failed to allocate memory");
    }

    err = setup_sasl_params(instance);
    if (err != LCB_SUCCESS) {
        return lcb_error_handler(instance, err, "sasl setup");
    }

    for (buii = 0, ii = 0; ii < num; ++ii) {
        instance->servers[ii].instance = instance;
        err = lcb_server_initialize(instance->servers + ii, (int)ii);
        if (err != LCB_SUCCESS) {
            return lcb_error_handler(instance, err, "Failed to initialize server");
        }
        instance->backup_nodes[buii] = instance->servers[ii].rest_api_server;
        if (instance->randomize_bootstrap_nodes) {
            /* swap with random position < ii */
            if (buii > 0) {
                lcb_size_t nn = (lcb_size_t)(gethrtime() >> 10) % buii;
                char *pp = instance->backup_nodes[buii];
                instance->backup_nodes[ii] = instance->backup_nodes[nn];
                instance->backup_nodes[nn] = pp;
            }
        }
        buii++;
    }

    instance->nreplicas = (lcb_uint16_t)vbucket_config_get_num_replicas(instance->vbucket_config);
    instance->dist_type = vbucket_config_get_distribution_type(instance->vbucket_config);
    /*
     * Run through all of the vbuckets and build a map of what they need.
     * It would have been nice if I could query libvbucket for the number
     * of vbuckets a server got, but there isn't at the moment..
     */
    max = (lcb_uint16_t)vbucket_config_get_num_vbuckets(instance->vbucket_config);
    instance->nvbuckets = max;
    free(instance->vb_server_map);
    instance->vb_server_map = calloc(max, sizeof(lcb_vbucket_t));
    if (instance->vb_server_map == NULL) {
        return lcb_error_handler(instance, LCB_CLIENT_ENOMEM, "Failed to allocate memory");
    }
    for (ii = 0; ii < max; ++ii) {
        instance->vb_server_map[ii] = (lcb_uint16_t)vbucket_get_master(instance->vbucket_config, ii);
    }

    instance->confstatus = LCB_CONFSTATE_CONFIGURED;
    instance->config_generation++;
    return LCB_SUCCESS;
}

static void relocate_packets(lcb_server_t *src, lcb_t dst_instance)
{
    struct lcb_command_data_st ct;
    protocol_binary_request_header cmd;
    lcb_server_t *dst;
    lcb_size_t nbody, npacket;
    char *body;
    int idx;
    lcb_vbucket_t vb;

    while (ringbuffer_read(&src->cmd_log, cmd.bytes, sizeof(cmd.bytes))) {
        nbody = ntohl(cmd.request.bodylen); /* extlen + nkey + nval */
        npacket = sizeof(cmd.bytes) + nbody;
        body = malloc(nbody);
        if (body == NULL) {
            lcb_error_handler(dst_instance, LCB_CLIENT_ENOMEM,
                              "Failed to allocate memory");
            return;
        }
        lcb_assert(ringbuffer_read(&src->cmd_log, body, nbody) == nbody);

        switch (cmd.request.opcode) {
        case PROTOCOL_BINARY_CMD_SASL_AUTH:
        case PROTOCOL_BINARY_CMD_SASL_LIST_MECHS:
        case PROTOCOL_BINARY_CMD_SASL_STEP:
            /* Skip unfinished SASL commands.
             * SASL AUTH written directly into output buffer,
             * therefore we can ignore its cookies */
            ringbuffer_consumed(&src->output_cookies, sizeof(ct));
            continue;

        default:
            break;
        }
        vb = ntohs(cmd.request.vbucket);
        idx = vbucket_get_master(dst_instance->vbucket_config, vb);
        if (idx < 0) {
            /* looks like master isn't ready to accept the data, try another
             * one, maybe from fast forward map. this function will never
             * give -1 */
            idx = vbucket_found_incorrect_master(dst_instance->vbucket_config, vb, idx);
        }
        dst = dst_instance->servers + (lcb_size_t)idx;

        /* read from pending buffer first, because the only case so
         * far when we have cookies in both buffers is when we send
         * some commands to disconnected server (it will put them into
         * pending buffer/cookies and also copy into log), after that
         * SASL authenticator runs, and push its packets to output
         * buffer/cookies and also copy into log.
         *
         * Here we are traversing the log only. Therefore we will see
         * pending commands first.
         *
         * TODO it will be simplified when with the packet-oriented
         * commands patch, where cookies will live along with command
         * itself in the log
         */
        lcb_assert(ringbuffer_read(&src->pending_cookies, &ct, sizeof(ct)) == sizeof(ct) ||
                   ringbuffer_read(&src->output_cookies, &ct, sizeof(ct)) == sizeof(ct));

        lcb_assert(ringbuffer_ensure_capacity(&dst->cmd_log, npacket));
        lcb_assert(ringbuffer_write(&dst->cmd_log, cmd.bytes, sizeof(cmd.bytes)) == sizeof(cmd.bytes));
        lcb_assert(ringbuffer_write(&dst->cmd_log, body, nbody) == nbody);

        lcb_assert(ringbuffer_ensure_capacity(&dst->pending, npacket));
        lcb_assert(ringbuffer_write(&dst->pending, cmd.bytes, sizeof(cmd.bytes)) == sizeof(cmd.bytes));
        lcb_assert(ringbuffer_write(&dst->pending, body, nbody) == nbody);
        lcb_assert(ringbuffer_ensure_capacity(&dst->pending_cookies, sizeof(ct)));
        lcb_assert(ringbuffer_write(&dst->pending_cookies, &ct, sizeof(ct)) == sizeof(ct));

        free(body);
    }
}

/**
 * CONFIG REPLACEMENT AND PACKET RELOCATION.
 *
 * When we receive any sort of configuration update, all connections to all
 * servers are immediately reset, and a new server array is allocated with
 * new server structures.
 *
 * Before the old servers are destroyed, their buffers are relocated like so:
 * SRC->PENDING -> DST->PENDING
 * SRC->SENT    -> DST->PENDING
 * SRC->COOKIES -> DST->PENDING_COOKIES
 *
 * where 'src' is the old server struct, and 'dst' is the new server struct
 * which is the vBucket master for a given packet..
 *
 * When each server has connected, the code
 * (server.c, lcb_server_connected) will move the pending commands over to the
 * output commands.
 */

static int replace_config(lcb_t instance, VBUCKET_CONFIG_HANDLE next_config)
{
    VBUCKET_CONFIG_DIFF *diff;
    VBUCKET_DISTRIBUTION_TYPE dist_t;
    VBUCKET_CONFIG_HANDLE curr_config;

    lcb_size_t ii, nservers;
    lcb_server_t *servers;
    curr_config = instance->vbucket_config;

    diff = vbucket_compare(curr_config, next_config);
    if (diff == NULL ||
            (diff->sequence_changed == 0 && diff->n_vb_changes == 0)) {
        vbucket_free_diff(diff);
        vbucket_config_destroy(next_config);
        instance->confstatus = LCB_CONFSTATE_CONFIGURED;
        /* We still increment the generation count, though */
        instance->config_generation++;
        return LCB_CONFIGURATION_UNCHANGED;
    }

    nservers = instance->nservers;
    servers = instance->servers;
    dist_t = vbucket_config_get_distribution_type(next_config);

    if (lcb_apply_vbucket_config(instance, next_config) != LCB_SUCCESS) {
        vbucket_free_diff(diff);
        vbucket_config_destroy(next_config);
        return -1;
    }

    for (ii = 0; ii < nservers; ++ii) {
        lcb_server_t *ss = servers + ii;

        if (dist_t == VBUCKET_DISTRIBUTION_VBUCKET) {
            relocate_packets(ss, instance);

        } else {
            lcb_failout_server(ss, LCB_CLIENT_ETMPFAIL);
        }

        lcb_server_destroy(ss);
    }

    for (ii = 0; ii < instance->nservers; ++ii) {
        lcb_server_t *ss = instance->servers + ii;
        if (ss->cmd_log.nbytes != 0) {
            lcb_server_send_packets(ss);
        }
    }

    free(servers);
    vbucket_config_destroy(curr_config);
    vbucket_free_diff(diff);

    return LCB_CONFIGURATION_CHANGED;
}


/**
 * Read the configuration data from the socket. Also write the config to the
 * cachefile, if such exists, and the config is valid.
 */
static int grab_http_config(lcb_t instance, VBUCKET_CONFIG_HANDLE *config)
{
    *config = vbucket_config_create();
    if (*config == NULL) {
        lcb_error_handler(instance, LCB_CLIENT_ENOMEM,
                          "Failed to allocate memory for config");
        return -1;
    }

    if (vbucket_config_parse(*config, LIBVBUCKET_SOURCE_MEMORY,
                             instance->vbucket_stream.input.data) != 0) {
        lcb_error_handler(instance, LCB_PROTOCOL_ERROR,
                          vbucket_get_error_message(*config));
        vbucket_config_destroy(*config);
        return -1;
    }
    instance->vbucket_stream.input.avail = 0;

    if (instance->compat.type == LCB_CACHED_CONFIG) {
        FILE *fp = fopen(instance->compat.value.cached.cachefile, "w");
        if (fp) {
            fprintf(fp, "%s%s",
                    instance->vbucket_stream.input.data,
                    LCB_CONFIG_CACHE_MAGIC);
            fclose(fp);
        }
        instance->compat.value.cached.updating = 0;
        instance->compat.value.cached.mtime = time(NULL) - 1;
    }
    return 0;
}

/**
 * Update the list of servers and connect to the new ones
 *
 * @param instance the instance to update the serverlist for.
 * @param next_config a ready-to-use VBUCKET_CONFIG_HANDLE containing the
 * updated config. May be null, in which case the config from the read buffer
 * is used.
 *
 * @todo use non-blocking connects and timeouts
 */
void lcb_update_vbconfig(lcb_t instance, VBUCKET_CONFIG_HANDLE next_config)
{
    lcb_size_t ii;
    int is_cached = next_config != NULL;
    int change_status;

    /**
     * If we're not passed a new config object, it means we parse it from the
     * read buffer. Otherwise assume it's from some "compat" mode
     */
    if (!next_config) {
        if (grab_http_config(instance, &next_config) == -1) {
            return;
        }
    }

    if (instance->vbucket_config) {
        change_status = replace_config(instance, next_config);
        if (change_status < 0) {
            /* error */
            return;
        }

    } else {
        lcb_assert(instance->servers == NULL);
        lcb_assert(instance->nservers == 0);
        if (lcb_apply_vbucket_config(instance, next_config) != LCB_SUCCESS) {
            vbucket_config_destroy(next_config);
            return;
        }
        change_status = LCB_CONFIGURATION_NEW;
    }

    /* Notify anyone interested in this event... */
    if (instance->vbucket_state_listener != NULL) {
        for (ii = 0; ii < instance->nservers; ++ii) {
            instance->vbucket_state_listener(instance->servers + ii);
        }
    }
    instance->callbacks.configuration(instance, change_status);
    instance->confstatus = LCB_CONFSTATE_CONFIGURED;

    /**
     * If we're using a cached config, we should not need a socket connection.
     * Disconnect the socket, if it's there
     */
    if (is_cached) {
        lcb_connection_close(&instance->connection);
    }

    lcb_maybe_breakout(instance);

}
