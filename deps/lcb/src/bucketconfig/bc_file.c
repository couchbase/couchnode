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

#include "internal.h"
#include "clconfig.h"
#include "simplestring.h"
#define CONFIG_CACHE_MAGIC "{{{fb85b563d0a8f65fa8d3d58f1b3a0708}}}"

#define LOGARGS(pb, lvl) pb->base.parent->settings, "bc_file", LCB_LOG_##lvl, __FILE__, __LINE__
#define LOGFMT "(cache=%s) "
#define LOGID(fb) fb->filename

typedef struct {
    clconfig_provider base;
    char *filename;
    clconfig_info *config;
    time_t last_mtime;
    int last_errno;
    lcb_async_t async;
    clconfig_listener listener;
} file_provider;

static int load_cache(file_provider *provider)
{
    lcb_string str;
    char line[1024];
    lcb_ssize_t nr;
    int fail;
    FILE *fp = NULL;
    VBUCKET_CONFIG_HANDLE config = NULL;
    char *end;
    struct stat st;
    int status = -1;

    lcb_string_init(&str);

    if (provider->filename == NULL) {
        return -1;
    }

    fp = fopen(provider->filename, "r");
    if (fp == NULL) {
        int save_errno = errno;
        lcb_log(LOGARGS(provider, ERROR), LOGFMT "Couldn't open for reading: %s", LOGID(provider), strerror(save_errno));
        return -1;
    }

    if (fstat(fileno(fp), &st)) {
        provider->last_errno = errno;
        goto GT_DONE;
    }

    if (provider->last_mtime == st.st_mtime) {
        lcb_log(LOGARGS(provider, WARN), LOGFMT "Modification time too old", LOGID(provider));
        goto GT_DONE;
    }

    config = vbucket_config_create();
    if (config == NULL) {
        goto GT_DONE;
    }

    lcb_string_init(&str);

    while ((nr = fread(line, 1, sizeof(line), fp)) > 0) {
        if (lcb_string_append(&str, line, nr)) {
            goto GT_DONE;
        }
    }

    if (ferror(fp)) {
        goto GT_DONE;
    }

    fclose(fp);
    fp = NULL;

    if (!str.nused) {
        status = -1;
        goto GT_DONE;
    }

    end = strstr(str.base, CONFIG_CACHE_MAGIC);
    if (end == NULL) {
        lcb_log(LOGARGS(provider, ERROR), LOGFMT "Couldn't find magic", LOGID(provider));
        remove(provider->filename);
        status = -1;
        goto GT_DONE;
    }

    fail = vbucket_config_parse(config, LIBVBUCKET_SOURCE_MEMORY, str.base);
    if (fail) {
        status = -1;
        lcb_log(LOGARGS(provider, ERROR), LOGFMT "Couldn't parse configuration", LOGID(provider));
        remove(provider->filename);
        goto GT_DONE;
    }

    if (vbucket_config_get_distribution_type(config) != VBUCKET_DISTRIBUTION_VBUCKET) {
        status = -1;
        lcb_log(LOGARGS(provider, ERROR), LOGFMT "Not applying cached memcached config", LOGID(provider));
        goto GT_DONE;
    }

    if (provider->config) {
        lcb_clconfig_decref(provider->config);
    }

    provider->config = lcb_clconfig_create(config, LCB_CLCONFIG_FILE);
    provider->config->cmpclock = gethrtime();
    provider->config->origin = provider->base.type;
    provider->last_mtime = st.st_mtime;
    status = 0;
    config = NULL;

    GT_DONE:
    if (fp != NULL) {
        fclose(fp);
    }

    if (config != NULL) {
        vbucket_config_destroy(config);
    }

    lcb_string_release(&str);
    return status;
}

static void
write_to_file(file_provider *provider, lcbvb_CONFIG *cfg)
{
    FILE *fp;

    if (provider->filename == NULL) {
        return;
    }

    fp = fopen(provider->filename, "w");
    if (fp) {
        char *json = lcbvb_save_json(cfg);
        lcb_log(LOGARGS(provider, INFO), LOGFMT "Writing configuration to file", LOGID(provider));
        fprintf(fp, "%s%s", json, CONFIG_CACHE_MAGIC);
        fclose(fp);
        free(json);
    } else {
        int save_errno = errno;
        lcb_log(LOGARGS(provider, ERROR), LOGFMT "Couldn't open file for writing: %s", LOGID(provider), strerror(save_errno));
    }
}

static clconfig_info * get_cached(clconfig_provider *pb)
{
    file_provider *provider = (file_provider *)pb;
    if (!provider->filename) {
        return NULL;
    }

    return provider->config;
}

static void async_callback(lcb_timer_t timer,
                           lcb_t notused,
                           const void *cookie)
{
    time_t last_mtime;
    file_provider *provider = (file_provider *)cookie;
    lcb_async_destroy(NULL, timer);
    provider->async = NULL;


    last_mtime = provider->last_mtime;
    if (load_cache(provider) == 0) {
        if (last_mtime != provider->last_mtime) {
            lcb_confmon_provider_success(&provider->base, provider->config);
            return;
        }
    }

    lcb_confmon_provider_failed(&provider->base, LCB_ERROR);
    (void)notused;
}

static lcb_error_t refresh_file(clconfig_provider *pb)
{
    file_provider *provider = (file_provider *)pb;
    lcb_error_t err;

    if (provider->async) {
        return LCB_SUCCESS;
    }

    provider->async = lcb_async_create(pb->parent->iot,
                                       pb,
                                       async_callback,
                                       &err);

    lcb_assert(err == LCB_SUCCESS);
    lcb_assert(provider->async != NULL);

    return err;
}

static lcb_error_t pause_file(clconfig_provider *pb)
{
    (void)pb;
    return LCB_SUCCESS;
}

static void shutdown_file(clconfig_provider *pb)
{
    file_provider *provider = (file_provider *)pb;
    free(provider->filename);
    if (provider->config) {
        lcb_clconfig_decref(provider->config);
    }
    free(provider);
}

static void config_listener(clconfig_listener *lsn, clconfig_event_t event,
                            clconfig_info *info)
{
    file_provider *provider;

    if (event != CLCONFIG_EVENT_GOT_NEW_CONFIG) {
        return;
    }

    provider = (file_provider *) (void*)(((char *)lsn) - offsetof(file_provider, listener));
    if (!provider->base.enabled) {
        return;
    }

    if (info->origin == LCB_CLCONFIG_PHONY || info->origin == LCB_CLCONFIG_FILE) {
        lcb_log(LOGARGS(provider, TRACE), "Not writing configuration originating from PHONY or FILE to cache");
        return;
    }

    write_to_file(provider, info->vbc);
}

clconfig_provider * lcb_clconfig_create_file(lcb_confmon *parent)
{
    file_provider *provider = calloc(1, sizeof(*provider));

    if (!provider) {
        return NULL;
    }

    provider->base.get_cached = get_cached;
    provider->base.refresh = refresh_file;
    provider->base.pause = pause_file;
    provider->base.shutdown = shutdown_file;
    provider->base.type = LCB_CLCONFIG_FILE;
    provider->listener.callback = config_listener;

    lcb_confmon_add_listener(parent, &provider->listener);

    return &provider->base;
}

static const char *get_tmp_dir(void)
{
    const char *ret;
    if ((ret = getenv("TMPDIR")) != NULL) {
        return ret;
    } else if ((ret = getenv("TEMPDIR")) != NULL) {
        return ret;
    } else if ((ret = getenv("TEMP")) != NULL) {
        return ret;
    } else if ((ret = getenv("TMP")) != NULL) {
        return ret;
    }

    return NULL;
}

static char *mkcachefile(const char *name, const char *bucket)
{
    if (name != NULL) {
        return strdup(name);
    } else {
        char buffer[1024];
        const char *tmpdir = get_tmp_dir();

        snprintf(buffer, sizeof(buffer),
                 "%s/%s", tmpdir ? tmpdir : ".", bucket);
        return strdup(buffer);
    }
}

int lcb_clconfig_file_set_filename(clconfig_provider *p, const char *f)
{
    file_provider *provider = (file_provider *)p;
    lcb_assert(provider->base.type == LCB_CLCONFIG_FILE);
    provider->base.enabled = 1;

    if (provider->filename) {
        free(provider->filename);
    }

    provider->filename = mkcachefile(f, p->parent->settings->bucket);
    return 0;
}

const char *
lcb_clconfig_file_get_filename(clconfig_provider *p)
{
    file_provider *fp = (file_provider *)p;
    return fp->filename;
}
