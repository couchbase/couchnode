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

#include "internal.h"

int lcb_load_config_cache(lcb_t instance)
{
    ringbuffer_t buffer;
    char line[1024];
    lcb_ssize_t nr;
    int fail;
    FILE *fp;
    VBUCKET_CONFIG_HANDLE config;
    char *end;
    struct stat st;

    fp = fopen(instance->compat.value.cached.cachefile, "r");
    if (fp == NULL) {
        return -1;
    }

    if (fstat(fileno(fp), &st) == 0) {
        if (instance->compat.value.cached.mtime == st.st_mtime) {
            /* this is the one we have!!! */
            fclose(fp);
            return -1;
        }
    }

    if ((config = vbucket_config_create()) == NULL ||
            ringbuffer_initialize(&buffer, 2048) == -1) {
        /* You'll have to do full bootsrap ;-) */
        if (config != NULL) {
            vbucket_config_destroy(config);
        }
        fclose(fp);
        return -1;
    }

    while ((nr = fread(line, 1, sizeof(line), fp)) > 0) {
        if (ringbuffer_ensure_capacity(&buffer, (lcb_size_t)nr) == -1) {
            ringbuffer_destruct(&buffer);
            fclose(fp);
            return -1;
        }
        ringbuffer_write(&buffer, line, (lcb_size_t)nr);
    }

    if (ferror(fp)) {
        ringbuffer_destruct(&buffer);
        fclose(fp);
        return -1;
    }

    fclose(fp);

    /* write the terminal NUL for strstr */
    if (ringbuffer_ensure_capacity(&buffer, 1) == -1) {
        ringbuffer_destruct(&buffer);
        return -1;
    }
    ringbuffer_write(&buffer, "", 1);

    end = strstr((char *)ringbuffer_get_read_head(&buffer),
                 LCB_CONFIG_CACHE_MAGIC);
    if (end == NULL) {
        /* This in an incomplete read */
        return -1;
    }

    *end = '\0';
    fail = vbucket_config_parse(config, LIBVBUCKET_SOURCE_MEMORY,
                                (char *)ringbuffer_get_read_head(&buffer));
    ringbuffer_destruct(&buffer);

    if (!fail) {
        if (vbucket_config_get_distribution_type(config) !=
                VBUCKET_DISTRIBUTION_VBUCKET) {
            /** Memcached Bucket */
            vbucket_config_destroy(config);
            return -1;
        }
        lcb_update_vbconfig(instance, config);
        instance->compat.value.cached.mtime = st.st_mtime;
        instance->compat.value.cached.loaded = 1;
        return 0;
    }

    return -1;
}


void lcb_refresh_config_cache(lcb_t instance)
{
    if (instance->compat.value.cached.updating) {
        /* we are currently in the progress of updating the cache */
        return ;
    }

    if (lcb_load_config_cache(instance) == -1) {
        const char *msg = "Received bad configuration from cache file";
        /* try to bootstrap it */
        instance->compat.value.cached.updating = 1;
        instance->compat.value.cached.loaded = 0;
        lcb_instance_config_error(instance, LCB_CONFIG_CACHE_INVALID, msg, 0);
    }

    instance->compat.value.cached.needs_update = 0;
}

void lcb_schedule_config_cache_refresh(lcb_t instance)
{
    if (instance->compat.value.cached.updating) {
        return;
    }

    if (instance->compat.value.cached.needs_update) {
        return;
    }

    instance->compat.value.cached.needs_update = 1;
}
