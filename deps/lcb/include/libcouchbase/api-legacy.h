/* -*- Mode: C; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2010-2016 Couchbase, Inc.
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
#ifndef LCB_APILEGACY_H
#define LCB_APILEGACY_H

#ifdef __cplusplus
extern "C" {
#endif

#ifndef LIBCOUCHBASE_COUCHBASE_H
#error "include <libcouchbase/couchbase.h> first!"
#endif


/**@private
 * Note that hashkey/groupid is not a supported feature of Couchbase Server
 * and this client.  It should be considered volatile and experimental.
 * Using this could lead to an unbalanced cluster, inability to interoperate
 * with the data from other languages, not being able to use the
 * Couchbase Server UI to look up documents and other possible future
 * upgrade/migration concerns.
 */
#define LCB__HKFIELDS \
    /**
     @private
     @volatile
     Do not use. This field exists to support older code. Using a dedicated
     hashkey will cause problems with your data in various systems. */ \
     const void *hashkey; \
     \
     lcb_SIZE nhashkey; /**<@private*/

/**
 * @defgroup lcb-legacy-api Legacy Key-Value API
 * @brief Operate on one or more key values
 * @details
 *
 * The key-value APIs are high performance APIs utilizing the memcached protocol.
 * Use these APIs to access data by its unique key.
 *
 * These APIs are designed so that each function is passed in one or more
 * "Command Structures". A command structure is a small structure detailing a
 * specific key and contains options and modifiers for the operation as it
 * relates to that key.
 *
 * All the command structures are currently layed out like so:
 *
 * @code{.c}
 * {
 *   int version;
 *   union {
 *     struct CMDv0 v0;
 *     struct CMDv1 v1;
 *   } v;
 * }
 * @endcode
 *
 * These top level structures are _wrapper_ structures and are present to ensure
 * portability between different versions of the library. To employ these
 * structures within the command, you may do:
 *
 * @code{.c}
 * lcb_get_cmd_t gcmd_wrap = { 0 }, *cmdp_wrap = &gcmd_wrap;
 * lcb_GETCMDv0 *gcmd = &gcmd_wrap->v.v0;
 * gcmd->key = key;
 * gcmd->nkey = strlen(key);
 * lcb_get(instance, cookie, 1, &gcmd_wrap);
 * @endcode
 *
 * @addtogroup lcb-legacy-api
 * @{
 */

/**
 * @brief Get Command Structure
 */
typedef struct {
    const void *key; /**< Key to retrieve */
    lcb_SIZE nkey; /**< Key length */

    /**
     * If this parameter is specified and `lock` is _not_ set then the server
     * will also update the object's expiration time while retrieving the key.
     * If `lock` _is_ set then this is the maximum amount of time the lock
     * may be held (before an unlock) before the server will forecfully unlock
     * the key.
     */
    lcb_time_t exptime;

    /**
     * If this parameter is set then the server will in addition to retrieving
     * the item also lock the item, making it so that subsequent attempts to
     * lock and/or modify the same item will fail with an error
     * (either @ref LCB_KEY_EEXISTS or @ref LCB_ETMPFAIL).
     *
     * The lock will be released when one of the following happens:
     *
     * 1. The item is explicitly unlocked (see lcb_unlock())
     * 2. The lock expires (See the #exptime parameter)
     * 3. The item is modified using lcb_store(), and being provided with the
     *    correct _CAS_.
     *
     */
    int lock;
    LCB__HKFIELDS
} lcb_GETCMDv0;

/**
 * @brief lcb_get() Command Wrapper Structure
 * @see lcb_GETCMDv0
 */
typedef struct lcb_get_cmd_st {
    int version;
    union { lcb_GETCMDv0 v0; } v;
    LCB_DEPR_CTORS_GET
} lcb_get_cmd_t;

/**
 * @brief Inner response structure for a get operation
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    const void *bytes;
    lcb_SIZE nbytes;
    lcb_U32 flags; /**< Server side flags stored with the item */
    lcb_cas_t cas; /**< CAS representing current mutation state of the item */
    lcb_U8 datatype; /**< @private */
} lcb_GETRESPv0;

/**
 * @brief lcb_get() response wrapper structure
 * @see lcb_GETRESPv0
 */
typedef struct {
    int version;
    union {
        lcb_GETRESPv0 v0;
    } v;
} lcb_get_resp_t;

/**
 * The callback function for a "get-style" request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the actual item (only key
 * and nkey is valid if `error != LCB_SUCCESS`)
 * @committed
 */
typedef void (*lcb_get_callback)(
        lcb_t instance, const void *cookie, lcb_error_t error, const lcb_get_resp_t *resp);

/**
 * @brief Set the callback to be invoked when an item is received as a result
 * of an lcb_get() operation.
 * @param callback the new callback to install. Pass NULL to only query the
 * current callback
 * @return the previous callback
 * @see lcb_get()
 * @committed
 */
LIBCOUCHBASE_API
lcb_get_callback lcb_set_get_callback(lcb_t, lcb_get_callback callback);

/**
 * Get a number of values from the cache.
 *
 * If you specify a non-zero value for expiration, the server will
 * update the expiration value on the item (refer to the
 * documentation on lcb_store to see the meaning of the
 * expiration). All other members should be set to zero.
 *
 * @code{.c}
 *   lcb_get_cmd_t *get = calloc(1, sizeof(*get));
 *   get->version = 0;
 *   get->v.v0.key = "my-key";
 *   get->v.v0.nkey = strlen(get->v.v0.key);
 *   // Set an expiration of 60 (optional)
 *   get->v.v0.exptime = 60;
 *   lcb_get_cmd_t* commands[] = { get };
 *   lcb_get(instance, NULL, 1, commands);
 * @endcode
 *
 * It is possible to get an item with a lock that has a timeout. It can
 * then be unlocked with either a CAS operation or with an explicit
 * unlock command.
 *
 * You may specify the expiration value for the lock in the
 * expiration (setting it to 0 cause the server to use the default
 * value).
 *
 * Get and lock the key:
 *
 * @code{.c}
 *   lcb_get_cmd_t *get = calloc(1, sizeof(*get));
 *   get->version = 0;
 *   get->v.v0.key = "my-key";
 *   get->v.v0.nkey = strlen(get->v.v0.key);
 *   // Set a lock expiration of 5 (optional)
 *   get->v.v0.lock = 1;
 *   get->v.v0.exptime = 5;
 *   lcb_get_cmd_t* commands[] = { get };
 *   lcb_get(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to get
 * @return_rc
 *
 * Operation-specific errors received in callbacks include:
 * @cb_err ::LCB_KEY_ENOENT if the key does not exist
 * @cb_err ::LCB_ETMPFAIL if the `lock` option was set in the command and the item
 * was already locked.
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_get(lcb_t instance, const void *command_cookie, lcb_SIZE num,
    const lcb_get_cmd_t *const *commands);

/**@}*/

/**
 * @name Legacy get-from-replica API
 *
 * @{
 */


typedef struct { const void *key; lcb_SIZE nkey; LCB__HKFIELDS } lcb_GETREPLICACMDv0;

/**
 * @brief Command for lcb_get_replica()
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    LCB__HKFIELDS
    lcb_replica_t strategy; /**< Strategy to use */
    /**If #strategy is LCB_REPLICA_SELECT, specific the replica index to use */
    int index;
} lcb_GETREPLICACMDv1;

/**
 * @brief wrapper structure for lcb_get_replica()
 * @see lcb_GETREPLICACMDv1
 */
typedef struct lcb_get_replica_cmd_st {
    int version;
    union {
        lcb_GETREPLICACMDv0 v0;
        lcb_GETREPLICACMDv1 v1;
    } v;
    LCB_DEPR_CTORS_RGET
} lcb_get_replica_cmd_t;

/**
 * Get a number of replca values from the cache.
 *
 * @brief Get items from replica. This is like lcb_get() but is useful when
 * an item from the master cannot be retrieved.
 *
 * From command version 1, it is possible to select strategy of how to
 * select the replica node. Currently three strategies are available:
 * 1. LCB_REPLICA_FIRST: Previously accessible and default as of 2.0.8,
 *    the caller will get a reply from the first replica to successfully
 *    reply within the timeout for the operation or will receive an
 *    error.
 *
 * 2. LCB_REPLICA_ALL: Ask all replicas to send documents/item back.
 *
 * 3. LCB_REPLICA_SELECT: Select one replica by the index in the
 *    configuration starting from zero. This approach can more quickly
 *    receive all possible replies for a given topology, but it can
 *    also generate false negatives.
 *
 * @note
 * applications should not assume the order of the
 * replicas indicates more recent data is at a lower index number.
 * It is up to the application to determine which version of a
 * document/item it may wish to use in the case of retrieving data from a replica.
 *
 * ### Examples
 *
 * #### Get document from the second replica
 *
 * @code{.c}
 * lcb_get_replica_cmd_t *get = calloc(1, sizeof(*get));
 * get->version = 1;
 * get->v.v1.key = "my-key";
 * get->v.v1.nkey = strlen(get->v.v1.key);
 * get->v.v1.strategy = LCB_REPLICA_SELECT;
 * get->v.v1.index = 2;
 * lcb_get_replica_cmd_st* commands[] = { get };
 * lcb_get_replica(instance, NULL, 1, commands);
 * @endcode
 *
 * #### Get document from the first available replica
 * @code{.c}
 * get->v.v1.strategy = LCB_REPLICA_FIRST;
 * lcb_get_replica_cmd_st* commands[] = { get };
 * lcb_get_replica(instance, NULL, 1, commands);
 * @endcode
 *
 * #### Get document from all replicas
 * This will will generate lcb_get_num_replicas() responses
 *
 * @code{.c}
 * get->v.v1.strategy = LCB_REPLICA_ALL;
 * lcb_get_replica_cmd_st* commands[] = { get };
 * lcb_get_replica(instance, NULL, 1, commands);
 * @endcode
 *
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to get
 * @return_rc
 *
 * For operation-specific error codes received in the callback, see lcb_get()
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_get_replica(lcb_t instance,
                            const void *command_cookie,
                            lcb_SIZE num,
                            const lcb_get_replica_cmd_t *const *commands);

/**
 * @brief lcb_unlock() Command structure
 * @see lcb_GETRESPv0
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas; /**< You _must_ populate this with the CAS */
    LCB__HKFIELDS
} lcb_UNLOCKCMDv0;

/**@brief lcb_unlock() Wrapper structure
 * @see lcb_UNLOCKCMDv0 */
typedef struct lcb_unlock_cmd_st {
    int version;
    union {
        lcb_UNLOCKCMDv0 v0;
    } v;
    LCB_DEPR_CTORS_UNL
} lcb_unlock_cmd_t;

/** @brief lcb_unlock() response structure */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
} lcb_UNLOCKRESPv0;

/**@brief lcb_unlock() wrapper response structure
 * @see lcb_UNLOCKRESPv0 */
typedef struct {
    int version;
    union {
        lcb_UNLOCKRESPv0 v0;
    } v;
} lcb_unlock_resp_t;

/**
 * The callback function for an unlock request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation
 * @committed
 */
typedef void (*lcb_unlock_callback)(lcb_t instance,
                                    const void *cookie,
                                    lcb_error_t error,
                                    const lcb_unlock_resp_t *resp);
/**@committed*/
LIBCOUCHBASE_API
lcb_unlock_callback lcb_set_unlock_callback(lcb_t, lcb_unlock_callback);

/**
 * Unlock the key locked with lcb_get() with the lcb_GETCMDv0::lock option
 *
 * You should initialize the `key`, `nkey` and `cas` member in the
 * lcb_item_st structure for the keys to get. All other
 * members should be set to zero.
 *
 * @code{.c}
 *   lcb_unlock_cmd_t *unlock = calloc(1, sizeof(*unlock));
 *   unlock->version = 0;
 *   unlock->v.v0.key = "my-key";
 *   unlock->v.v0.nkey = strlen(unlock->v.v0.key);
 *   unlock->v.v0.cas = 0x666;
 *   lcb_unlock_cmd_t* commands[] = { unlock };
 *   lcb_unlock(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the handle to lcb
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to unlock
 * @return The status of the operation
 * @return_rc
 *
 * Operation specific error codes:
 * @cb_err ::LCB_ETMPFAIL if the item is not locked, or if the wrong CAS was
 * specified
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_unlock(lcb_t instance,
                       const void *command_cookie,
                       lcb_SIZE num,
                       const lcb_unlock_cmd_t *const *commands);
/**@}*/

/**
 * @brief lcb_store() Command structure
 *
 * This structure is used to define an item to be stored on the server.
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    const void *bytes; /**< Value to store */
    lcb_SIZE nbytes; /**< Length of value to store */
    lcb_U32 flags; /**< User-defined flags stored along with the item */
    /**If present, the server will check that the item's _current_ CAS matches
     * the value specified here. If this check fails the command will fail with
     * an @ref LCB_KEY_EEXISTS error.
     *
     * @warning For @ref LCB_APPEND and @ref LCB_PREPEND, this field should be
     * `0`. */
    lcb_cas_t cas;
    lcb_U8 datatype; /**< @private */
    /**Expiration for the item. `0` means never expire.
     * @warning for @ref LCB_APPEND and @ref LCB_PREPEND, this field should be
     * `0`. */
    lcb_time_t exptime;
    lcb_storage_t operation; /**< **Mandatory**. Mutation type */
    LCB__HKFIELDS
} lcb_STORECMDv0;

/** @brief Wrapper structure for lcb_STORECMDv0 */
typedef struct lcb_store_cmd_st {
    int version;
    union {
        lcb_STORECMDv0 v0;
    } v;
    LCB_DEPR_CTORS_STORE
} lcb_store_cmd_t;



typedef struct {
    const void *key; /**< Key that was stored */
    lcb_SIZE nkey; /**< Size of key that was stored */
    lcb_cas_t cas; /**< Cas representing current mutation */
    /** mutation tokenen for mutation. This is used with N1QL and durability */
    const lcb_MUTATION_TOKEN *mutation_token;
} lcb_STORERESPv0;

/** @brief Wrapper structure for lcb_STORERESPv0 */
typedef struct {
    int version;
    union {
        lcb_STORERESPv0 v0;
    } v;
} lcb_store_resp_t;

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
 * @committed
 */
typedef void (*lcb_store_callback)(lcb_t instance, const void *cookie,
        lcb_storage_t operation, lcb_error_t error, const lcb_store_resp_t *resp);

/**
 * @brief Set the callback to be received when an item has been stored
 * @param callback the new callback to install, or `NULL` to just query the
 * current callback
 * @return the previous callback
 * @see lcb_store()
 * @committed
 */
LIBCOUCHBASE_API
lcb_store_callback lcb_set_store_callback(lcb_t, lcb_store_callback callback);

/**
 * Store an item in the cluster.
 *
 * You may initialize all of the members in the the
 * lcb_item_st structure with the values you want.
 * Values larger than `30*24*60*60` seconds (30 days) are
 * interpreted as absolute times (from the epoch). Unused members
 * should be set to zero.
 *
 * @code{.c}
 *   lcb_store_cmd_st *store = calloc(1, sizeof(*store));
 *   store->version = 0;
 *   store->v.v0.key = "my-key";
 *   store->v.v0.nkey = strlen(store->v.v0.key);
 *   store->v.v0.bytes = "{ value:666 }"
 *   store->v.v0.nbytes = strlen(store->v.v0.bytes);
 *   store->v.v0.flags = 0xdeadcafe;
 *   store->v.v0.cas = 0x1234;
 *   store->v.v0.exptime = 0x666;
 *   store->v.v0.operation = LCB_REPLACE;
 *   lcb_store_cmd_st* commands[] = { store };
 *   lcb_store(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to store
 * @return_rc
 *
 * Operation-specific error codes include:
 * @cb_err ::LCB_KEY_ENOENT if ::LCB_REPLACE was used and the key does not exist
 * @cb_err ::LCB_KEY_EEXISTS if ::LCB_ADD was used and the key already exists
 * @cb_err ::LCB_KEY_EEXISTS if the CAS was specified (for an operation other
 *          than ::LCB_ADD) and the item exists on the server with a different
 *          CAS
 * @cb_err ::LCB_KEY_EEXISTS if the item was locked and the CAS supplied did
 * not match the locked item's CAS (or if no CAS was supplied)
 * @cb_err ::LCB_NOT_STORED if an ::LCB_APPEND or ::LCB_PREPEND operation was
 * performed and the item did not exist on the server.
 * @cb_err ::LCB_E2BIG if the size of the value exceeds the cluster per-item
 *         value limit (currently 20MB).
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_store(lcb_t instance, const void *command_cookie, lcb_SIZE num,
                      const lcb_store_cmd_t *const *commands);


/**@brief Command structure for arithmetic operations
 * This is contained within the @ref lcb_arithmetic_cmd_t structure */
typedef struct {
    const void *key;
    lcb_SIZE nkey;

    /**Expiration time for the item. Note this is _only_ valid if #create is
     * set to true. */
    lcb_time_t exptime;

    /**
     * If the item does not exist on the server, set this to true to force
     * the creation of the item. Otherwise the operation will fail with
     * @ref LCB_KEY_ENOENT
     */
    int create;

    /**
     * This number will be added to the current value on the server; if this is
     * negative then the current value will be decremented; if positive then
     * the current value will be incremented.
     *
     * On the server, the counter value is a 64 bit unsigned integer, whose
     * maximum value is `UINT64_MAX` If an integer overflow occurs as a result
     * of adding the `delta` value to the existing value on the server, then the
     * value on the server will wrap around; thus for example, if the existing
     * value was `UINT64_MAX-1` and `delta` was supplied as `2`, the new value
     * would be `1`.
     */
    lcb_S64 delta;

    /**
     * If the `create` field is true, this is the initial value for the counter
     * iff the item does not yet exist.
     */
    lcb_U64 initial;
    LCB__HKFIELDS
} lcb_ARITHCMDv0;

/** @brief Wrapper structure for @ref lcb_ARITHCMDv0 */
typedef struct lcb_arithmetic_cmd_st {
    int version;
    /** @brief Wrapper union for @ref lcb_ARITHCMDv0 */
    union { /** @brief Fill this structure */ lcb_ARITHCMDv0 v0; } v;

    LCB_DEPR_CTORS_ARITH
} lcb_arithmetic_cmd_t;

typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_U64 value; /**< Current numerical value of the counter */
    lcb_cas_t cas;
    /** mutation token for mutation. This is used with N1QL and durability */
    const lcb_MUTATION_TOKEN *mutation_token;
} lcb_ARITHRESPv0;

typedef struct {
    int version;
    union {
        lcb_ARITHRESPv0 v0;
    } v;
} lcb_arithmetic_resp_t;

/**
 * The callback function for an arithmetic request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation (only key
 *             and nkey is valid if error != LCB_SUCCESS)
 *
 * @committed
 */
typedef void (*lcb_arithmetic_callback)
        (lcb_t instance, const void *cookie, lcb_error_t error, const lcb_arithmetic_resp_t *resp);

/**@committed*/
LIBCOUCHBASE_API
lcb_arithmetic_callback lcb_set_arithmetic_callback(lcb_t, lcb_arithmetic_callback);

/**
 * Perform arithmetic operation on a keys value.
 *
 * You should initialize the key, nkey and expiration member in
 * the lcb_item_st structure for the keys to update.
 * Values larger than 30*24*60*60 seconds (30 days) are
 * interpreted as absolute times (from the epoch). All other
 * members should be set to zero.
 *
 * @code{.c}
 *   lcb_arithmetic_cmd_t *arithmetic = calloc(1, sizeof(*arithmetic));
 *   arithmetic->version = 0;
 *   arithmetic->v.v0.key = "counter";
 *   arithmetic->v.v0.nkey = strlen(arithmetic->v.v0.key);
 *   arithmetic->v.v0.initial = 0x666;
 *   arithmetic->v.v0.create = 1;
 *   arithmetic->v.v0.delta = 1;
 *   lcb_arithmetic_cmd_t* commands[] = { arithmetic };
 *   lcb_arithmetic(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the handle to lcb
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to operate on
 * @return_rc
 *
 * The following operation-specific error codes may be delivered in the callback:
 * @cb_err ::LCB_KEY_ENOENT if the key does not exist (and `create` was not
 *         specified in the command
 * @cb_err ::LCB_DELTA_BADVAL if the existing value could not be parsed into
 *         a number.
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_arithmetic(lcb_t instance,
                           const void *command_cookie,
                           lcb_SIZE num,
                           const lcb_arithmetic_cmd_t *const *commands);

typedef enum {
    /**
     * Only sends a command to the master. In this case the callback will
     * be invoked only once for the master, and then another time with the
     * NULL callback
     */
    LCB_OBSERVE_MASTER_ONLY = 0x01
} lcb_observe_options_t;

#define LCB_OBSERVE_FIELDS_COMMON \
    const void *key; \
    lcb_SIZE nkey; \
    LCB__HKFIELDS /**<@private*/

typedef struct {
    LCB_OBSERVE_FIELDS_COMMON
} lcb_OBSERVECMDv0;

/**@brief lcb_observe() Command structure */
typedef struct {
    LCB_OBSERVE_FIELDS_COMMON
    lcb_observe_options_t options;
} lcb_OBSERVECMDv1;

/**@brief lcb_observe() Command wrapper structure
 * @see lcb_OBSERVECMDv1 */
typedef struct lcb_observe_cmd_st {
    int version;
    union {
        lcb_OBSERVECMDv0 v0;
        lcb_OBSERVECMDv1 v1;
    } v;

    LCB_DEPR_CTORS_OBS
} lcb_observe_cmd_t;

/**
 * @brief Response Structure for lcb_observe()
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas; /**< CAS of the item on this server */
    lcb_observe_t status; /**< Status flags */
    int from_master; /**< zero if key came from replica */
    lcb_time_t ttp; /**< average time to persist on this server */
    lcb_time_t ttr; /**< average time to replicate on this server */
} lcb_OBSERVERESPv0;

typedef struct {
    int version;
    union {
        lcb_OBSERVERESPv0 v0;
    } v;
} lcb_observe_resp_t;

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

LIBCOUCHBASE_API
lcb_observe_callback lcb_set_observe_callback(lcb_t, lcb_observe_callback);

/**
 * Observe key
 *
 * @code{.c}
 *   lcb_observe_cmd_t *observe = calloc(1, sizeof(*observe));
 *   observe->version = 0;
 *   observe->v.v0.key = "my-key";
 *   observe->v.v0.nkey = strlen(observe->v.v0.key);
 *   lcb_observe_cmd_t* commands[] = { observe };
 *   lcb_observe(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to observe
 * @return_rc
 *
 * The following operation-specific error codes may be returned in the
 * callback:
 *
 * @cb_err ::LCB_UNKNOWN_COMMAND, ::LCB_NOT_SUPPORTED if the cluster does not
 *         support this operation (such as a Couchbase cluster older than
 *         version 2.0, or a memcached bucket).
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_observe(lcb_t instance,
                        const void *command_cookie,
                        lcb_SIZE num,
                        const lcb_observe_cmd_t *const *commands);

/**
 * @name Remove items from the cluster (Legacy API)
 * Delete items from the cluster
 * @{
 */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas;
    LCB__HKFIELDS /**<@private*/
} lcb_REMOVECMDv0;

typedef struct lcb_remove_cmd_st {
    int version;
    union {
        lcb_REMOVECMDv0 v0;
    } v;
    LCB_DEPR_CTORS_RM
} lcb_remove_cmd_t;


typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas;
    /** mutation token for mutation. This is used with N1QL and durability */
    const lcb_MUTATION_TOKEN *mutation_token;
} lcb_REMOVERESPv0;

typedef struct {
    int version;
    union {
        lcb_REMOVERESPv0 v0;
    } v;
} lcb_remove_resp_t;

/**
 * The callback function for a remove request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation
 */
typedef void (*lcb_remove_callback)(lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_remove_resp_t *resp);

LIBCOUCHBASE_API
lcb_remove_callback lcb_set_remove_callback(lcb_t, lcb_remove_callback);

/**
 * Remove a key from the cluster
 *
 * @code{.c}
 *   lcb_remove_cmd_t *remove = calloc(1, sizeof(*remove));
 *   remove->version = 0;
 *   remove->v.v0.key = "my-key";
 *   remove->v.v0.nkey = strlen(remove->v.v0.key);
 *   remove->v.v0.cas = 0x666;
 *   lcb_remove_cmd_t* commands[] = { remove };
 *   lcb_remove(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the items to remove
 * @return_rc
 *
 * The following operation-specific error codes are returned in the callback
 * @cb_err ::LCB_KEY_ENOENT if the key does not exist
 * @cb_err ::LCB_KEY_EEXISTS if the CAS was specified and it does not match the
 *         CAS on the server
 * @cb_err ::LCB_KEY_EEXISTS if the item was locked and no CAS (or an incorrect
 *         CAS) was specified.
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_remove(lcb_t instance,
                       const void *command_cookie,
                       lcb_SIZE num,
                       const lcb_remove_cmd_t *const *commands);

/**
 * @name Modify an item's expiration time
 * Modify an item's expiration time, keeping it alive without modifying
 * it
 * @{
 */
typedef lcb_get_cmd_t lcb_touch_cmd_t;
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    lcb_cas_t cas;
} lcb_TOUCHRESPv0;
typedef struct {
    int version;
    union {
        lcb_TOUCHRESPv0 v0;
    } v;
} lcb_touch_resp_t;

/**
 * The callback function for a touch request.
 *
 * @param instance the instance performing the operation
 * @param cookie the cookie associated with with the command
 * @param error The status of the operation
 * @param resp More information about the operation
 * @committed
 */
typedef void (*lcb_touch_callback)(lcb_t instance,
                                   const void *cookie,
                                   lcb_error_t error,
                                   const lcb_touch_resp_t *resp);
/**@committed*/
LIBCOUCHBASE_API
lcb_touch_callback lcb_set_touch_callback(lcb_t, lcb_touch_callback);

/**
 * Touch (set expiration time) on a number of values in the cache.
 *
 * Values larger than 30*24*60*60 seconds (30 days) are
 * interpreted as absolute times (from the epoch). All other
 * members should be set to zero.
 *
 * @par Example
 * @code{.c}
 * lcb_touch_cmd_t touch = { 0 };
 * lcb_touch_cmd_t *cmdlist = { &touch; }
 * touch->v.v0.key = "my-key";
 * touch->v.v0.nkey = strlen(item->v.v0.key);
 * touch->v.v0.exptime = 300; // 5 minutes
 * lcb_touch(instance, NULL, 1, cmdlist);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param cookie A cookie passed to all of the notifications from this command
 * @param num the total number of elements in the commnands array
 * @param commands the array containing the items to touch
 * @return_rc
 *
 * Errors received in callbacks:
 * @cb_err ::LCB_KEY_ENOENT if the item does not exist
 * @cb_err ::LCB_KEY_EEXISTS if the item is locked
 */
LIBCOUCHBASE_API
lcb_error_t lcb_touch(lcb_t instance,
                      const void *cookie,
                      lcb_SIZE num,
                      const lcb_touch_cmd_t *const *commands);

/**
 * @{
 */

/** @brief Single-key command structure for lcb_durability_poll() */
typedef struct {
    const void *key;
    size_t nkey;
    LCB__HKFIELDS /**<@private*/

    /**
     * CAS to be checked against. If the key exists on the server
     * with a different CAS, the error (in the response) is set to
     * LCB_KEY_EEXISTS
     */
    lcb_cas_t cas;
    const lcb_MUTATION_TOKEN *mutation_token;
} lcb_DURABILITYCMDv0;

/**
 * @brief lcb_durability_poll() Command wrapper
 * @see lcb_DURABILITYCMDv0
 */
typedef struct lcb_durability_cmd_st {
    int version;
    union {
        lcb_DURABILITYCMDv0 v0;
    } v;
} lcb_durability_cmd_t;


/** @brief Response structure for lcb_durability_poll() */
typedef struct {
    const void *key;
    lcb_SIZE nkey;
    /**
     * if this entry failed, this contains the reason, e.g.
     *
     * - `LCB_KEY_EEXISTS`: The key exists with a different CAS than expected
     * - `LCB_KEY_ENOENT`: The key was not found in the master cache
     * - `LCB_ETIMEDOUT`: The key may exist, but the required servers needed
     *    took too long to respond
     */
    lcb_error_t err;

    /** if found with a different CAS, this is the CAS */
    lcb_cas_t cas;

    /**
     * Whether the key was persisted to the master.
     * For deletes, this means the key was removed from disk
     */
    unsigned char persisted_master;

    /**
     * Whether the key exists on the master. For deletes, this means
     * the key does not exist in cache
     */
    unsigned char exists_master;

    /** how many nodes (including master) this item was persisted to */
    unsigned char npersisted;

    /** how many nodes (excluding master) this item was replicated to */
    unsigned char nreplicated;

    /**
     * Total number of observe responses received for the node.
     * This can be used as a performance metric to determine how many
     * total OBSERVE probes were sent until this key was 'done'
     */
    unsigned short nresponses;
} lcb_DURABILITYRESPv0;

typedef struct lcb_durability_resp_st {
    int version;
    union {
        lcb_DURABILITYRESPv0 v0;
    } v;
} lcb_durability_resp_t;

/**
 * Schedule a durability check on a set of keys. This callback wraps (somewhat)
 * the lower-level OBSERVE (lcb_observe) operations so that users may check if
 * a key is endured, e.g. if a key is persisted accross "at least" n number of
 * servers
 *
 * When each key has its criteria satisfied, the durability callback (see above)
 * is invoked for it.
 *
 * The callback may also be invoked when a condition is encountered that will
 * prevent the key from ever satisfying the criteria.
 *
 * @param instance the lcb handle
 * @param cookie a pointer to be received with each callback
 * @param options a set of options and criteria for this durability check
 * @param cmds a list of key specifications to check for
 * @param ncmds how many key specifications reside in the list
 * @return ::LCB_SUCCESS if scheduled successfuly
 * @return ::LCB_DURABILITY_ETOOMANY if the criteria specified exceeds the
 *         current satisfiable limit (e.g. `persist_to` was set to 4, but
 *         there are only 2 servers online in the cluster) and `cap_max`
 *         was not specified.
 * @return ::LCB_DUPLICATE_COMMANDS if the same key was found more than once
 *         in the command list
 *
 * The following error codes may be returned in the callback
 * @cb_err ::LCB_ETIMEDOUT if the specified interval expired before the client
 *         could verify the durability requirements were satisfied. See
 *         @ref LCB_CNTL_DURABILITY_TIMEOUT and lcb_DURABILITYOPTSv0::timeout
 *         for more information on how to increase this interval.
 *
 * Example (after receiving a store callback)
 * @code{.c}
 *
 * lcb_durability_cmd_t cmd, cmds[1];
 * lcb_durability_opts_t opts;
 * lcb_error_t err;
 *
 * memset(&opts, 0, sizeof(opts);
 * memset(&cmd, 0, sizeof(cmd);
 * cmds[0] = &cmd;
 *
 *
 * opts.persist_to = 2;
 * opts.replicate_to = 1;
 *
 * cmd.v.v0.key = resp->v.v0.key;
 * cmd.v.v0.nkey = resp->v.v0.nkey;
 * cmd.v.v0.cas = resp->v.v0.cas;
 *
 * //schedule the command --
 * err = lcb_durability_poll(instance, cookie, &opts, &cmds, 1);
 * // error checking omitted --
 *
 * // later on, in the callback. resp is now a durability_resp_t* --
 * if (resp->v.v0.err == LCB_SUCCESS) {
 *      printf("Key was endured!\n");
 * } else {
 *      printf("Key did not endure in time\n");
 *      printf("Replicated to: %u replica nodes\n", resp->v.v0.nreplicated);
 *      printf("Persisted to: %u total nodes\n", resp->v.v0.npersisted);
 *      printf("Did we persist to master? %u\n",
 *          resp->v.v0.persisted_master);
 *      printf("Does the key exist in the master's cache? %u\n",
 *          resp->v.v0.exists_master);
 *
 *      switch (resp->v.v0.err) {
 *
 *      case LCB_KEY_EEXISTS:
 *          printf("Seems like someone modified the key already...\n");
 *          break;
 *
 *      case LCB_ETIMEDOUT:
 *          printf("Either key does not exist, or the servers are too slow\n");
 *          printf("If persisted_master or exists_master is true, then the"
 *              "server is simply slow.",
 *              "otherwise, the key does not exist\n");
 *
 *          break;
 *
 *      default:
 *          printf("Got other error. This is probably a network error\n");
 *          break;
 *      }
 *  }
 * @endcode
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_durability_poll(lcb_t instance,
                                const void *cookie,
                                const lcb_durability_opts_t *options,
                                lcb_SIZE ncmds,
                                const lcb_durability_cmd_t *const *cmds);

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

LIBCOUCHBASE_API
lcb_durability_callback lcb_set_durability_callback(lcb_t,
                                                    lcb_durability_callback);

/**@}*/

/**
 * @name Retrieve statistics from the cluster
 * @{
 */
typedef struct {
    const void *name; /**< The name of the stats group to get */
    lcb_SIZE nname; /**< The number of bytes in name */
} lcb_STATSCMDv0;

typedef struct lcb_server_stats_cmd_st {
    int version;
    union { lcb_STATSCMDv0 v0; } v;
    LCB_DEPR_CTORS_STATS
} lcb_server_stats_cmd_t;

/**
 * @brief Per-server, per-stat response structure for lcb_server_stats()
 *
 * This structure is returned for each statistic requested by lcb_server_stats().
 * As both the number of servers replying to this function as well as the number
 * of stats per server is variable, the application should pay attention to the
 * following semantics:
 *
 * 1. A new statistic item is delivered with the `server_endpoint` and `key`
 *    being non-`NULL`
 * 2. If a specific server encounters an error, the `key` and `bytes` fields
 *    will be NULL.
 * 3. Once no more replies remain from any of the servers, a final callback
 *    will be delivered with the `server_endpoint` field set to `NULL`.
 *
 * It is recommended to index statistics twice; first based on the
 * `server_endpoint` field and then on the `key` field. It is likely that the
 * same `key` will be received multiple times for different `server_endpoints`.
 */
typedef struct {
    const char *server_endpoint; /**< Server which the statistic is from */
    const void *key; /**< Statistic name */
    lcb_SIZE nkey;
    const void *bytes; /**< Statistic value */
    lcb_SIZE nbytes;
} lcb_STATSRESPv0;

/** @brief Wrapper structure for lcb_STATSRESPv0 */
typedef struct lcb_server_stat_resp_st {
    int version;
    union {
        lcb_STATSRESPv0 v0;
    } v;
} lcb_server_stat_resp_t;

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
LIBCOUCHBASE_API
lcb_stat_callback lcb_set_stat_callback(lcb_t, lcb_stat_callback);

/**
 * Request server statistics. Without a key specified the server will
 * respond with a "default" set of statistics information. Each piece of
 * statistical information is returned in its own packet (key contains
 * the name of the statistical item and the body contains the value in
 * ASCII format). The sequence of return packets is terminated with a
 * packet that contains no key and no value.
 *
 * The command will signal about transfer completion by passing NULL as
 * the server endpoint and 0 for key length. Note that key length will
 * be zero when some server responds with error. In latter case server
 * endpoint argument will indicate the server address.
 *
 * @code{.c}
 *   lcb_server_stats_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   cmd->v.v0.name = "tap";
 *   cmd->v.v0.nname = strlen(cmd->v.v0.nname);
 *   lcb_server_stats_cmd_t* commands[] = { cmd };
 *   lcb_server_stats(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie a cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the statistic to get
 * @return_rc
 *
 * The following callbacks may be returned in the callback
 * @cb_err ::LCB_KEY_ENOENT if key passed is unrecognized
 *
 * @todo Enumerate some useful stats here
 */
LIBCOUCHBASE_API
lcb_error_t lcb_server_stats(lcb_t instance,
                             const void *command_cookie,
                             lcb_SIZE num,
                             const lcb_server_stats_cmd_t *const *commands);

/**@}*/


typedef struct lcb_server_version_cmd_st {
    int version;
    union { struct { const void *notused; } v0; } v;
    LCB_DEPR_CTORS_VERSIONS
} lcb_server_version_cmd_t;

/**
 * @brief Response structure for lcb_server_versions()
 */
typedef struct lcb_server_version_resp_st {
    int version;
    union {
        struct {
            const char *server_endpoint;
            const char *vstring;
            lcb_SIZE nvstring;
        } v0;
    } v;
} lcb_server_version_resp_t;

/**
 * Request server versions. The callback will be invoked with the
 * instance, server address, version string, and version string length.
 *
 * When all server versions have been received, the callback is invoked
 * with the server endpoint argument set to NULL
 *
 * @code{.c}
 *   lcb_server_version_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   lcb_server_version_cmd_t* commands[] = { cmd };
 *   lcb_server_versions(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie a cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the version commands
 * @return The status of the operation
 *
 * @attention
 * The name of this function may be slightly misleading. This does **not**
 * retrieve the Couchbase Server version, but only the version of its _memcached_
 * component. See lcb_server_stats() for a way to retrieve the server version
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_server_versions(lcb_t instance,
                                const void *command_cookie,
                                lcb_SIZE num,
                                const lcb_server_version_cmd_t *const *commands);

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

LIBCOUCHBASE_API
lcb_version_callback lcb_set_version_callback(lcb_t, lcb_version_callback);

typedef struct {
    const char *server;
    lcb_verbosity_level_t level;
} lcb_VERBOSITYCMDv0;

typedef struct lcb_verbosity_cmd_st {
    int version;
    union {
        lcb_VERBOSITYCMDv0 v0;
    } v;
    LCB_DEPR_CTORS_VERBOSITY
} lcb_verbosity_cmd_t;

typedef struct lcb_verbosity_resp_st {
    int version;
    union {
        struct {
            const char *server_endpoint;
        } v0;
    } v;
} lcb_verbosity_resp_t;

/**
 * Set the loglevel on the servers
 *
 * @code{.c}
 *   lcb_verbosity_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   cmd->v.v0.level = LCB_VERBOSITY_WARNING;
 *   lcb_verbosity_cmd_t* commands[] = { cmd };
 *   lcb_set_verbosity(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the verbosity commands
 * @return The status of the operation.
 */
LIBCOUCHBASE_API
lcb_error_t lcb_set_verbosity(lcb_t instance,
                              const void *command_cookie,
                              lcb_SIZE num,
                              const lcb_verbosity_cmd_t *const *commands);

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

LIBCOUCHBASE_API
lcb_verbosity_callback lcb_set_verbosity_callback(lcb_t,
                                                  lcb_verbosity_callback);
typedef struct lcb_flush_cmd_st {
    int version;
    union { struct { int unused; } v0; } v;
    LCB_DEPR_CTORS_FLUSH
} lcb_flush_cmd_t;

typedef struct lcb_flush_resp_st {
    int version;
    union {
        struct {
            const char *server_endpoint;
        } v0;
    } v;
} lcb_flush_resp_t;

/**
 * Flush the entire couchbase cluster!
 *
 * @warning
 * From Couchbase Server 2.0 and higher, this command will only work on
 * _memcached_ buckets. To flush a Couchbase bucket, use the HTTP REST
 * API (See: http://docs.couchbase.com/admin/admin/REST/rest-bucket-flush.html)
 *
 * @code{.c}
 *   lcb_flush_cmd_t *cmd = calloc(1, sizeof(*cmd));
 *   cmd->version = 0;
 *   lcb_flush_cmd_t* commands[] = { cmd };
 *   lcb_flush(instance, NULL, 1, commands);
 * @endcode
 *
 * @param instance the instance used to batch the requests from
 * @param cookie A cookie passed to all of the notifications from this command
 * @param num the total number of elements in the commands array
 * @param commands the array containing the flush commands
 * @return_rc
 *
 * The following error codes may be returned in the callback
 * @cb_err ::LCB_NOT_SUPPORTED if trying to flush a Couchbase bucket.
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_flush(lcb_t instance, const void *cookie,
                      lcb_SIZE num,
                      const lcb_flush_cmd_t *const *commands);

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
LIBCOUCHBASE_API
lcb_flush_callback lcb_set_flush_callback(lcb_t, lcb_flush_callback);

/**
 * @name HTTP Operations (Legacy API)
 * Schedule HTTP requests to the server. This includes management
 * and view requests
 * @{
 */

/**
 * @brief Structure for lcb_make_http_request()
 */
typedef struct {
    /** A view path string with optional query params (e.g. skip, limit etc.) */
    const char *path;
    lcb_SIZE npath; /**< Length of the path. Mandatory */
    const void *body; /**< The POST body for HTTP request */
    lcb_SIZE nbody; /**< Length of the body. Mandatory if `body != NULL`*/
    lcb_http_method_t method;
    /**If true the client will use lcb_http_data_callback to
     * notify about response and will call lcb_http_complete
     * with empty data eventually. */
    int chunked;
    /** The `Content-Type` header for request. For view requests
     * it is usually `application/json`, for management --
     * `application/x-www-form-urlencoded`. */
    const char *content_type;
} lcb_HTTPCMDv0;

/**
 * v1 is used by the raw http requests. It is exactly the
 * same layout as v0, but it contains an extra field;
 * the hostname & port to use....
 */
typedef struct {
    const char *path; /**< @see lcb_HTTPCMDv0::path */
    lcb_SIZE npath;
    const void *body; /**< @see lcb_HTTPCMDv0::body */
    lcb_SIZE nbody;
    lcb_http_method_t method;
    int chunked;
    const char *content_type;
    const char *host;
    const char *username;
    const char *password;
} lcb_HTTPCMDv1;

/**@brief Wrapper structure for lcb_make_http_request
 * @see lcb_HTTPCMDv0
 * @see lcb_HTTPCMDv1
 */
typedef struct lcb_http_cmd_st {
    int version;
    union {
        lcb_HTTPCMDv0 v0;
        lcb_HTTPCMDv1 v1;
    } v;
    LCB_DEPR_CTORS_HTTP
} lcb_http_cmd_t;

/**
 * @brief Response structure received for HTTP requests
 *
 * The `headers` field is a list of key-value headers for HTTP, so it may
 * be traversed like so:
 *
 * @code{.c}
 * const char ** cur = resp->headers;
 * for (; *cur; cur+=2) {
 *   printf("Header: %s:%s\n", cur[0], cur[1]);
 * }
 * @endcode
 */
typedef struct {
    lcb_http_status_t status; /**< HTTP status code */
    const char *path; /**< Path used for request */
    lcb_SIZE npath;
    const char *const *headers; /**< List of headers */
    const void *bytes; /**< Body (if any) */
    lcb_SIZE nbytes;
} lcb_HTTPRESPv0;

typedef struct {
    int version;
    union {
        lcb_HTTPRESPv0 v0;
    } v;
} lcb_http_resp_t;

/**
 * Callback invoked for HTTP requests
 * @param request Original request handle
 * @param instance The instance on which the request was issued
 * @param cookie Cookie associated with the request
 * @param error Error code for request. Note that more information may likely
 * be found within the response structure itself, specifically the
 * lcb_HTTPRESPv0::status and lcb_HTTPRESPv0::bytes field
 *
 * @param resp The response structure
 */
typedef void (*lcb_http_res_callback)(
        lcb_http_request_t request, lcb_t instance, const void *cookie,
        lcb_error_t error, const lcb_http_resp_t *resp);

typedef lcb_http_res_callback lcb_http_data_callback;
typedef lcb_http_res_callback lcb_http_complete_callback;

/**
 * @brief Set the HTTP completion callback for HTTP request completion
 *
 * This callback will be
 * invoked once when the response is complete. If the lcb_HTTPCMDv0::chunked
 * flag was set, the lcb_HTTRESPv0::bytes will be `NULL`, otherwise it will
 * contain the fully buffered response.
 */
LIBCOUCHBASE_API
lcb_http_complete_callback
lcb_set_http_complete_callback(lcb_t, lcb_http_complete_callback);

/**
 * @brief Set the HTTP data stream callback for streaming responses
 *
 * This callback is invoked only if the lcb_HTTPCMDv0::chunked flag is true.
 * The lcb_HTTRESPv0::bytes field will on each invocation contain a new
 * fragment of data which should be processed by the client. When the request
 * is complete, the the callback specified by lcb_set_http_complete_callback()
 * will be invoked with the lcb_HTTPRESPv0::bytes field set to `NULL`
 */
LIBCOUCHBASE_API
lcb_http_data_callback
lcb_set_http_data_callback(lcb_t, lcb_http_data_callback);

/**
 * Execute HTTP request matching given path and yield JSON result object.
 * Depending on type it could be:
 *
 * - LCB_HTTP_TYPE_VIEW
 *
 *   The client should setup view_complete callback in order to fetch
 *   the result. Also he can setup view_data callback to fetch response
 *   body in chunks as soon as possible, it will be called each time the
 *   library receive a data chunk from socket. The empty <tt>bytes</tt>
 *   argument (NULL pointer and zero size) is the sign of end of
 *   response. Chunked callback allows to save memory on large datasets.
 *
 * - LCB_HTTP_TYPE_MANAGEMENT
 *
 *   Management requests allow you to configure the cluster, add/remove
 *   buckets, rebalance etc. The result will be passed to management
 *   callbacks (data/complete).
 *
 * Fetch first 10 docs from `_design/test/_view/all` view
 * @code{.c}
 *   lcb_http_request_t req;
 *   lcb_http_cmd_t *cmd = calloc(1, sizeof(lcb_http_cmd_t));
 *   cmd->version = 0;
 *   cmd->v.v0.path = "_design/test/_view/all?limit=10";
 *   cmd->v.v0.npath = strlen(item->v.v0.path);
 *   cmd->v.v0.body = NULL;
 *   cmd->v.v0.nbody = 0;
 *   cmd->v.v0.method = LCB_HTTP_METHOD_GET;
 *   cmd->v.v0.chunked = 1;
 *   cmd->v.v0.content_type = "application/json";
 *   lcb_error_t err = lcb_make_http_request(instance, NULL,
 *                         LCB_HTTP_TYPE_VIEW, &cmd, &req);
 *   if (err != LCB_SUCCESS) {
 *     .. failed to schedule request ..
 * @endcode
 *
 * The same as above but with POST filter
 * @code{.c}
 *   lcb_http_request_t req;
 *   lcb_http_cmd_t *cmd = calloc(1, sizeof(lcb_http_cmd_t));
 *   cmd->version = 0;
 *   cmd->v.v0.path = "_design/test/_view/all?limit=10";
 *   cmd->v.v0.npath = strlen(item->v.v0.path);
 *   cmd->v.v0.body = "{\"keys\": [\"test_1000\", \"test_10002\"]}"
 *   cmd->v.v0.nbody = strlen(item->v.v0.body);
 *   cmd->v.v0.method = LCB_HTTP_METHOD_POST;
 *   cmd->v.v0.chunked = 1;
 *   cmd->v.v0.content_type = "application/json";
 *   lcb_error_t err = lcb_make_http_request(instance, NULL,
 *                         LCB_HTTP_TYPE_VIEW, &cmd, &req);
 *   if (err != LCB_SUCCESS) {
 *     .. failed to schedule request ..
 * @endcode
 *
 * @code{.c} Delete bucket via REST management API
 *   lcb_http_request_t req;
 *   lcb_http_cmd_t cmd;
 *   cmd->version = 0;
 *   cmd.v.v0.path = query.c_str();
 *   cmd.v.v0.npath = query.length();
 *   cmd.v.v0.body = NULL;
 *   cmd.v.v0.nbody = 0;
 *   cmd.v.v0.method = LCB_HTTP_METHOD_DELETE;
 *   cmd.v.v0.chunked = false;
 *   cmd.v.v0.content_type = "application/x-www-form-urlencoded";
 *   lcb_error_t err = lcb_make_http_request(instance, NULL,
 *                         LCB_HTTP_TYPE_MANAGEMENT, &cmd, &req);
 *   if (err != LCB_SUCCESS) {
 *     .. failed to schedule request ..
 * @endcode
 *
 * @param instance The handle to lcb
 * @param command_cookie A cookie passed to all of the notifications
 *                       from this command
 * @param type The type of the request needed.
 * @param cmd The struct describing the command options
 * @param request Where to store request handle
 *
 * @return_rc
 *
 * The following errors may be received in the callback. Note that ::LCB_SUCCESS
 * will be delivered the callback so long as the operation received a full
 * HTTP response. You should inspect the individual HTTP status code to determine
 * if the actual HTTP request succeeded or not.
 *
 * @cb_err ::LCB_TOO_MANY_REDIRECTS if the request was redirected too many times.
 * @cb_err ::LCB_PROTOCOL_ERROR if the endpoint did not send back a well formed
 *         HTTP response
 *
 * @committed
 */
LIBCOUCHBASE_API
lcb_error_t lcb_make_http_request(lcb_t instance,
                                  const void *command_cookie,
                                  lcb_http_type_t type,
                                  const lcb_http_cmd_t *cmd,
                                  lcb_http_request_t *request);

/**@}*/

/**@}*/

#ifdef __cplusplus
}
#endif
#endif
