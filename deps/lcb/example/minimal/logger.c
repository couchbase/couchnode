/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012-2020 Couchbase, Inc.
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
 * Demo of logger integration
 *
 * $ ./build/bin/example/logger couchbase://localhost password Administrator
 * {"instance":"b835343d9a6de108","subsystem":"instance","severity":"DEBUG","file":"/home/avsej/code/libcouchbase/src/instance.cc","line":83,"message":"Adding
 * host localhost:8091 to initial HTTP bootstrap list"}
 * {"instance":"b835343d9a6de108","subsystem":"instance","severity":"DEBUG","file":"/home/avsej/code/libcouchbase/src/instance.cc","line":83,"message":"Adding
 * host localhost:11210 to initial CCCP bootstrap list"}
 * {"instance":"b835343d9a6de108","subsystem":"instance","severity":"TRACE","file":"/home/avsej/code/libcouchbase/src/instance.cc","line":126,"message":"Bootstrap
 * hosts loaded (cccp:1, http:1)"}
 * {"instance":"b835343d9a6de108","subsystem":"confmon","severity":"DEBUG","file":"/home/avsej/code/libcouchbase/src/bucketconfig/confmon.cc","line":92,"message":"Preparing
 * providers (this may be called multiple times)"}
 * {"instance":"b835343d9a6de108","subsystem":"confmon","severity":"DEBUG","file":"/home/avsej/code/libcouchbase/src/bucketconfig/confmon.cc","line":99,"message":"Provider
 * CCCP is ENABLED"}
 * ....
 */

#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <libcouchbase/couchbase.h>

#include "cJSON.h"
#ifdef _WIN32
#define PRIx64 "I64x"
#else
#include <inttypes.h>
#endif

static void die(lcb_INSTANCE *instance, const char *msg, lcb_STATUS err)
{
    fprintf(stderr, "%s. Received code 0x%X (%s)\n", msg, err, lcb_strerror_short(err));
    exit(EXIT_FAILURE);
}

typedef struct {
    lcb_LOGGER *base;
    lcb_LOG_SEVERITY min_level;
} my_json_logger;

static void log_callback(const lcb_LOGGER *logger, uint64_t iid, const char *subsys, lcb_LOG_SEVERITY severity,
                         const char *srcfile, int srcline, const char *fmt, va_list ap)
{
    my_json_logger *wrapper = NULL;
    lcb_logger_cookie(logger, (void **)&wrapper);
    if (wrapper == NULL) {
        return;
    }
    if (severity > wrapper->min_level) {
        return;
    }

    char buf[300] = {0};
    snprintf(buf, 20, "%" PRIx64, iid);

    cJSON *json = cJSON_CreateObject();
    cJSON_AddItemToObject(json, "instance", cJSON_CreateString(buf));
    cJSON_AddItemToObject(json, "subsystem", cJSON_CreateString(subsys));
    cJSON *severity_json = NULL;
    switch (severity) {
        case LCB_LOG_TRACE:
            severity_json = cJSON_CreateString("TRACE");
            break;
        case LCB_LOG_DEBUG:
            severity_json = cJSON_CreateString("DEBUG");
            break;
        case LCB_LOG_INFO:
            severity_json = cJSON_CreateString("INFO");
            break;
        case LCB_LOG_WARN:
            severity_json = cJSON_CreateString("WARN");
            break;
        case LCB_LOG_ERROR:
            severity_json = cJSON_CreateString("ERROR");
            break;
        case LCB_LOG_FATAL:
            severity_json = cJSON_CreateString("FATAL");
            break;
        default:
            severity_json = cJSON_CreateString("<UNKNOWN>");
            break;
    }
    cJSON_AddItemToObject(json, "severity", severity_json);
    cJSON_AddItemToObject(json, "file", cJSON_CreateString(srcfile));
    cJSON_AddItemToObject(json, "line", cJSON_CreateNumber(srcline));
    vsnprintf(buf, 300, fmt, ap);
    cJSON_AddItemToObject(json, "message", cJSON_CreateString(buf));

    fprintf(stderr, "%s\n", cJSON_PrintUnformatted(json));
    cJSON_Delete(json);
}

int main(int argc, char *argv[])
{
    lcb_STATUS err;
    lcb_INSTANCE *instance;

    my_json_logger wrapper = {0};

    if (argc < 2) {
        fprintf(stderr, "Usage: %s couchbase://host/bucket [ password [ username ] ]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    lcb_CREATEOPTS *options = NULL;
    lcb_createopts_create(&options, LCB_TYPE_BUCKET);
    lcb_createopts_connstr(options, argv[1], strlen(argv[1]));
    if (argc > 3) {
        lcb_createopts_credentials(options, argv[3], strlen(argv[3]), argv[2], strlen(argv[2]));
    }
    wrapper.min_level = LCB_LOG_DEBUG;
    lcb_logger_create(&wrapper.base, &wrapper);
    lcb_logger_callback(wrapper.base, log_callback);
    lcb_createopts_logger(options, wrapper.base);

    err = lcb_create(&instance, options);
    lcb_createopts_destroy(options);
    if (err != LCB_SUCCESS) {
        die(NULL, "Couldn't create couchbase handle", err);
    }

    err = lcb_connect(instance);
    if (err != LCB_SUCCESS) {
        die(instance, "Couldn't schedule connection", err);
    }

    lcb_wait(instance, LCB_WAIT_DEFAULT);

    lcb_destroy(instance);
    lcb_logger_destroy(wrapper.base);
    return 0;
}
