/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2012 Couchbase, Inc.
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
 * All of the callbacks provide a pointer to a "response structure"
 * dedicated for the given operation called. Please note that
 * these pointers are <b>obly</b> valid as long as the callback
 * method runs, so you <b>must</b> copy them if you want to use
 * it at a later time.
 */
#ifndef LIBCOUCHBASE_CALLBACKS_H
#define LIBCOUCHBASE_CALLBACKS_H 1

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "Include libcouchbase/couchbase.h instead"
#endif

#ifdef __cplusplus
extern "C" {
#endif


    /**
     * The callback function for a "get-style" request.
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp More information about the actual item (only key
     *             and nkey is valid if error != LCB_SUCCESS)
     */
    typedef void (*lcb_get_callback)(lcb_t instance,
                                     const void *cookie,
                                     lcb_error_t error,
                                     const lcb_get_resp_t *resp);

    /**
     * The callback function for a storage request.
     *
     * @param instance the instance performing the operation
     * @param operation the operation performed
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp More information about the item related to the store
     *             operation. (only key and nkey is valid if
     *             error != LCB_SUCCESS)
     */
    typedef void (*lcb_store_callback)(lcb_t instance,
                                       const void *cookie,
                                       lcb_storage_t operation,
                                       lcb_error_t error,
                                       const lcb_store_resp_t *resp);

    /**
     * The callback function for a remove request.
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp More information about the operation
     */
    typedef void (*lcb_remove_callback)(lcb_t instance,
                                        const void *cookie,
                                        lcb_error_t error,
                                        const lcb_remove_resp_t *resp);

    /**
     * The callback function for a touch request.
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp More information about the operation
     */
    typedef void (*lcb_touch_callback)(lcb_t instance,
                                       const void *cookie,
                                       lcb_error_t error,
                                       const lcb_touch_resp_t *resp);

    /**
     * The callback function for an unlock request.
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp More information about the operation
     */
    typedef void (*lcb_unlock_callback)(lcb_t instance,
                                        const void *cookie,
                                        lcb_error_t error,
                                        const lcb_unlock_resp_t *resp);


    /**
     * The callback function for an arithmetic request.
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp More information about the operation (only key
     *             and nkey is valid if error != LCB_SUCCESS)
     */
    typedef void (*lcb_arithmetic_callback)(lcb_t instance,
                                            const void *cookie,
                                            lcb_error_t error,
                                            const lcb_arithmetic_resp_t *resp);

    /**
     * The callback function for an observe request.
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp More information about the operation (only key
     *             and nkey is valid if error != LCB_SUCCESS)
     */
    typedef void (*lcb_observe_callback)(lcb_t instance,
                                         const void *cookie,
                                         lcb_error_t error,
                                         const lcb_observe_resp_t *resp);

    /**
     * The callback function for a stat request
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp response data
     */
    typedef void (*lcb_stat_callback)(lcb_t instance,
                                      const void *cookie,
                                      lcb_error_t error,
                                      const lcb_server_stat_resp_t *resp);


    /**
     * The callback function for a version request
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp response data
     */
    typedef void (*lcb_version_callback)(lcb_t instance,
                                         const void *cookie,
                                         lcb_error_t error,
                                         const lcb_server_version_resp_t *resp);

    /**
     * The error callback called when we don't have a request context.
     * This callback may be called when we encounter memory/network
     * error(s), and we can't map it directly to an operation.
     *
     * @param instance The instance that encountered the problem
     * @param error The error we encountered
     * @param errinfo An optional string with more information about
     *                the error (if available)
     */
    typedef void (*lcb_error_callback)(lcb_t instance,
                                       lcb_error_t error,
                                       const char *errinfo);

    /**
     * The callback function for a flush request
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp Response data
     */
    typedef void (*lcb_flush_callback)(lcb_t instance,
                                       const void *cookie,
                                       lcb_error_t error,
                                       const lcb_flush_resp_t *resp);


    typedef void (*lcb_timer_callback)(lcb_timer_t timer,
                                       lcb_t instance,
                                       const void *cookie);

    /**
     * couch_complete_callback will notify that view execution was completed
     * and lcb will pass response body to this callback unless
     * couch_data_callback set up.
     */
    typedef void (*lcb_http_complete_callback)(lcb_http_request_t request,
                                               lcb_t instance,
                                               const void *cookie,
                                               lcb_error_t error,
                                               const lcb_http_resp_t *resp);

    /**
     * couch_data_callback switch the view operation into the 'chunked' mode
     * and it will call this callback each time the data received from the
     * socket. *note* it doesn't collect whole response anymore. It returns
     * NULL for bytes and zero for nbytes to signal that request was
     * completed.
     */
    typedef void (*lcb_http_data_callback)(lcb_http_request_t request,
                                           lcb_t instance,
                                           const void *cookie,
                                           lcb_error_t error,
                                           const lcb_http_resp_t *resp);


    /**
     * This callback is called whenever configuration information from
     * the cluster is received.
     *
     * @param instance The instance who received the new configuration
     * @param config The kind of configuration received
     */
    typedef void (*lcb_configuration_callback)(lcb_t instance,
                                               lcb_configuration_t config);

    /**
     * The callback function for a verbosity command
     *
     * @param instance the instance performing the operation
     * @param cookie the cookie associated with with the command
     * @param error The status of the operation
     * @param resp response data
     */
    typedef void (*lcb_verbosity_callback)(lcb_t instance,
                                           const void *cookie,
                                           lcb_error_t error,
                                           const lcb_verbosity_resp_t *resp);

    /**
     * Callback for durability status. The callback is invoked on completion
     * of each key (i.e. only one callback is invoked per-key).
     *
     * @param lcb_t the instance
     * @param cookie the user cookie
     * @param err an error
     * @param res a response containing information about the key.
     */
    typedef void (*lcb_durability_callback)(lcb_t instance,
                                            const void *cookie,
                                            lcb_error_t err,
                                            const lcb_durability_resp_t *res);

    typedef void (*lcb_exists_callback)(lcb_t instance,
                                        const void *cookie,
                                        lcb_error_t err,
                                        const lcb_observe_resp_t *resp);

    /**
     * Callback for error mappings. This will be invoked when requesting whether
     * the user has a possible mapping for this error code.
     *
     * This will be called for response codes which may be ambiguous in most
     * use cases, or in cases where detailed response codes may be mapped to
     * more generic ones.
     */
    typedef lcb_error_t (*lcb_errmap_callback)(lcb_t instance, lcb_uint16_t bincode);


    /*
     * The following sections contains function prototypes for how to
     * set the callback for a certain kind of operation. The first
     * parameter is the instance to update, the second parameter
     * is the callback to call. The old callback is returned.
     */
    LIBCOUCHBASE_API
    lcb_get_callback lcb_set_get_callback(lcb_t, lcb_get_callback);

    LIBCOUCHBASE_API
    lcb_store_callback lcb_set_store_callback(lcb_t, lcb_store_callback);

    LIBCOUCHBASE_API
    lcb_arithmetic_callback lcb_set_arithmetic_callback(lcb_t,
                                                        lcb_arithmetic_callback);

    LIBCOUCHBASE_API
    lcb_observe_callback lcb_set_observe_callback(lcb_t, lcb_observe_callback);

    LIBCOUCHBASE_API
    lcb_remove_callback lcb_set_remove_callback(lcb_t, lcb_remove_callback);

    LIBCOUCHBASE_API
    lcb_stat_callback lcb_set_stat_callback(lcb_t, lcb_stat_callback);

    LIBCOUCHBASE_API
    lcb_version_callback lcb_set_version_callback(lcb_t, lcb_version_callback);

    LIBCOUCHBASE_API
    lcb_touch_callback lcb_set_touch_callback(lcb_t, lcb_touch_callback);

    LIBCOUCHBASE_API
    lcb_error_callback lcb_set_error_callback(lcb_t, lcb_error_callback);

    LIBCOUCHBASE_API
    lcb_flush_callback lcb_set_flush_callback(lcb_t, lcb_flush_callback);

    LIBCOUCHBASE_API
    lcb_http_complete_callback lcb_set_http_complete_callback(lcb_t,
                                                              lcb_http_complete_callback);

    LIBCOUCHBASE_API
    lcb_http_data_callback lcb_set_http_data_callback(lcb_t,
                                                      lcb_http_data_callback);

    LIBCOUCHBASE_API
    lcb_unlock_callback lcb_set_unlock_callback(lcb_t, lcb_unlock_callback);

    LIBCOUCHBASE_API
    lcb_configuration_callback lcb_set_configuration_callback(lcb_t,
                                                              lcb_configuration_callback);

    LIBCOUCHBASE_API
    lcb_verbosity_callback lcb_set_verbosity_callback(lcb_t,
                                                      lcb_verbosity_callback);

    LIBCOUCHBASE_API
    lcb_durability_callback lcb_set_durability_callback(lcb_t,
                                                        lcb_durability_callback);

    LIBCOUCHBASE_API
    lcb_errmap_callback lcb_set_errmap_callback(lcb_t, lcb_errmap_callback);

#ifdef __cplusplus
}
#endif

#endif
