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

#ifndef LIBCOUCHBASE_LOGGER_H
#define LIBCOUCHBASE_LOGGER_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Logging Levels
 * @committed
 */
typedef enum {
    LCB_LOG_TRACE = 0, /**< the most verbose level */
    LCB_LOG_DEBUG,     /**< diagnostic information, required to investigate problems */
    LCB_LOG_INFO,      /**< useful notices, not often */
    LCB_LOG_WARN,      /**< error notifications */
    LCB_LOG_ERROR,     /**< error messages, usually the library have to re-initialize connection instance */
    LCB_LOG_FATAL,     /**< fatal errors, the library cannot proceed */
    LCB_LOG__MAX       /**< internal value for total number of levels */
} lcb_LOG_SEVERITY;

/**
 * Helper to express printf spec for sensitive data. Usage:
 *
 *   printf("Logged as " LCB_LOG_SPEC("%s") " user", LCB_LOG_UD(instance, doc->username));
 */
#define LCB_LOG_SPEC(fmt) "%s" fmt "%s"

#define LCB_LOG_UD_OTAG "<ud>"
#define LCB_LOG_UD_CTAG "</ud>"
/**
 * User data is data that is stored into Couchbase by the application user account.
 *
 * - Key and value pairs in JSON documents, or the key exclusively
 * - Application/Admin usernames that identify the human person
 * - Names and email addresses asked during product registration and alerting
 * - Usernames
 * - Document xattrs
 * - Query statements included in the log file collected by support that leak
 *   the document fields (Select floor_price from stock).
 */
#define LCB_LOG_UD(instance, val)                                                                                      \
    lcb_is_redacting_logs(instance) ? LCB_LOG_UD_OTAG : "", val, lcb_is_redacting_logs(instance) ? LCB_LOG_UD_CTAG : ""

#define LCB_LOG_MD_OTAG "<md>"
#define LCB_LOG_MD_CTAG "</md>"
/**
 * Metadata is logical data needed by Couchbase to store and process user data.
 *
 * - Cluster name
 * - Bucket names
 * - DDoc/view names
 * - View code
 * - Index names
 * - Mapreduce Design Doc Name and Definition (IP)
 * - XDCR Replication Stream Names
 * - And other couchbase resource specific meta data
 */
#define LCB_LOG_MD(instance, val)                                                                                      \
    lcb_is_redacting_logs(instance) ? LCB_LOG_MD_OTAG : "", val, lcb_is_redacting_logs(instance) ? LCB_LOG_MD_CTAG : ""

#define LCB_LOG_SD_OTAG "<sd>"
#define LCB_LOG_SD_CTAG "</sd>"
/**
 * System data is data from other parts of the system Couchbase interacts with over the network.
 *
 * - IP addresses
 * - IP tables
 * - Hosts names
 * - Ports
 * - DNS topology
 */
#define LCB_LOG_SD(instance, val)                                                                                      \
    lcb_is_redacting_logs(instance) ? LCB_LOG_SD_OTAG : "", val, lcb_is_redacting_logs(instance) ? LCB_LOG_SD_CTAG : ""

typedef struct lcb_LOGGER_ lcb_LOGGER;

/**
 * @brief Logger callback
 *
 * This callback is invoked for each logging message emitted
 *
 * @param procs the logging structure provided
 * @param iid instance id
 * @param subsys a string describing the module which emitted the message
 * @param severity one of the LCB_LOG_* severity constants.
 * @param srcfile the source file which emitted this message
 * @param srcline the line of the file for the message
 * @param fmt a printf format string
 * @param ap a va_list for vprintf
 */
typedef void (*lcb_LOGGER_CALLBACK)(const lcb_LOGGER *procs, uint64_t iid, const char *subsys,
                                    lcb_LOG_SEVERITY severity, const char *srcfile, int srcline, const char *fmt,
                                    va_list ap);

/**
 * Create logger object.
 *
 * The pointer have to be deallocated using lcb_logger_destroy.
 *
 * @param logger
 * @param cookie arbitrary pointer, that accessible later using lcb_logger_cookie
 * @return LCB_SUCCESS if no error occurred
 */
LIBCOUCHBASE_API lcb_STATUS lcb_logger_create(lcb_LOGGER **logger, void *cookie);

/**
 * Deallocate logger object.
 *
 * @param logger
 * @return LCB_SUCCESS if no error occurred
 */
LIBCOUCHBASE_API lcb_STATUS lcb_logger_destroy(lcb_LOGGER *logger);

/**
 * Set the logging callback.
 *
 * The library would call this callback whenever decide to log something.
 *
 * @param logger
 * @param callback
 * @return
 */
LIBCOUCHBASE_API lcb_STATUS lcb_logger_callback(lcb_LOGGER *logger, lcb_LOGGER_CALLBACK callback);

/**
 * Retrieve opaque pointer specified during creation.
 *
 * See lcb_logger_create.
 *
 * @param logger
 * @param cookie pointer to location where to store the result
 * @return LCB_SUCCESS if no error occurred
 */
LIBCOUCHBASE_API lcb_STATUS lcb_logger_cookie(const lcb_LOGGER *logger, void **cookie);

#ifdef __cplusplus
}
#endif /* __cplusplus */
#endif // LIBCOUCHBASE_LOGGER_H
