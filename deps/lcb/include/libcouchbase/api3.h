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

#ifndef LCB_API3_H
#define LCB_API3_H
#include <libcouchbase/kvbuf.h>

#ifdef __cplusplus
extern "C" {
#endif

/**@file*/

/**
 * @defgroup lcb-public-api3 Experimental V3 API
 *
 * @brief Preview APIs for performing commands
 *
 * @details
 * Basic command and structure definitions for public API. This represents the
 * "V3" API of libcouchbase. All of the APIs in this group are considered
 * to be volatile, however you are encouraged to try them out and provide
 * feedback on them.
 *
 * @addtogroup lcb-public-api3
 * @{
 */

/**
 * @name Creating Commands
 * @details
 *
 * Issuing a command to the Cluster involves selecting the correct command
 * structure, populating it with the data relevant for the command, optionally
 * associating the command with your own application data, issuing the command
 * to a spooling function, and finally receiving the response.
 *
 * Command structures all derive from the common lcb_CMDBASE structure. This
 * structure defines the common fields for all commands.
 *
 * Almost all commands need to contain a key, which should be assigned using
 * the LCB_CMD_SET_KEY() macro.
 *
 * @{*/

#define LCB_CMD_BASE \
    /**Common flags for the command. These modify the command itself. Currently
     the lower 16 bits of this field are reserved, and the higher 16 bits are
     used for individual commands.*/ \
    lcb_U32 cmdflags; \
    \
    /**Specify the expiration time. This is either an absolute Unix time stamp
     or a relative offset from now, in seconds. If the value of this number
     is greater than the value of thirty days in seconds, then it is a Unix
     timestamp.

     This field is used in mutation operations (lcb_store3()) to indicate
     the lifetime of the item. It is used in lcb_get3() with the lcb_RESPGET::lock
     option to indicate the lock expiration itself. */ \
    lcb_U32 exptime; \
    \
    /**The known CAS of the item. This is passed to mutation to commands to
     ensure the item is only changed if the server-side CAS value matches the
     one specified here. For other operations (such as lcb_CMDENDURE) this
     is used to ensure that the item has been persisted/replicated to a number
     of servers with the value specified here. */ \
    lcb_U64 cas; \
    \
    /**Note that hashkey/groupid is not a supported feature of Couchbase Server
     and this client.  It should be considered volatile and experimental.
     Using this could lead to an unbalanced cluster, inability to interoperate
     with the data from other languages, not being able to use the
     Couchbase Server UI to look up documents and other possible future
     upgrade/migration concerns. */ \
    lcb_KEYBUF key; \
    \
    /**@private
     * @volatile
     * This exists purely to support the hashkey fields of the v2 API. This field
     * will be _removed_ in future versions. */ \
    lcb_KEYBUF _hashkey

/**@brief Common ABI header for all commands. _Any_ command may be safely
 * casted to this type.*/
typedef struct lcb_CMDBASE {
    LCB_CMD_BASE;
} lcb_CMDBASE;

/**
 * Set the key for the command.
 * @param cmd A command derived from lcb_CMDBASE
 * @param keybuf the buffer for the key
 * @param keylen the length of the key.
 *
 * The storage for `keybuf` may be released or modified after the command has
 * been spooled.
 */
#define LCB_CMD_SET_KEY(cmd, keybuf, keylen) \
        LCB_KREQ_SIMPLE(&(cmd)->key, keybuf, keylen)
/**@}*/


/**
 * @name Receiving Responses
 * @details
 * This section describes the structures used for receiving responses to
 * commands.
 *
 * Each command will have a callback invoked (typically once, for some commands
 * this may be more than once) with a response structure. The response structure
 * will be of a type that extends lcb_RESPBASE. The response structure should
 * not be modified and any of its fields should be considered to point to memory
 * which will be released after the callback exits.
 *
 * The common response header contains the lcb_RESPBASE::cookie field which
 * is the pointer to your application context (passed as the second argument
 * to the spooling function) and allows you to associate a specific command
 * with a specific response.
 *
 * The header will also contain the key (lcb_RESPBASE::key) field which can
 * also help identify the specific command. This is useful if you maintain a
 * single _cookie_ for multiple commands, and have per-item specific data
 * you wish to associate within the _cookie_ itself.
 *
 * Success or failure of the operation is signalled through the lcb_RESPBASE::rc
 * field. Note that even in the case of failure, the lcb_RESPBASE::cookie and
 * lcb_RESPBASE::key fields will _always_ be populated.
 *
 * Most commands also return the CAS of the item (as it exists on the server)
 * and this is placed inside the lcb_RESPBASE::cas field, however it is
 * only valid in the case where lcb_RESPBASE::rc is LCB_SUCCESS.
 *
 * @{
 */

#define LCB_RESP_BASE \
    void *cookie; /**< User data associated with request */ \
    const void *key; /**< Key for request */ \
    lcb_SIZE nkey; /**< Size of key */ \
    lcb_cas_t cas; /**< CAS for response (if applicable) */ \
    lcb_error_t rc; /**< Status code */ \
    lcb_U16 version; /**< ABI version for response */ \
    lcb_U16 rflags; /**< Response specific flags. see lcb_RESPFLAGS */


/**@brief Base response structure for callbacks.
 * All responses structures derive from this ABI.*/
typedef struct {
    LCB_RESP_BASE
} lcb_RESPBASE;

#define LCB_RESP_SERVER_FIELDS \
    /** String containing the `host:port` of the server which sent this response */ \
    const char *server;

/**@brief Base structure for informational commands from servers
 * This contains an additional lcb_RESPSERVERBASE::server field containing the
 * server which emitted this response.
 */
typedef struct {
    LCB_RESP_BASE
    LCB_RESP_SERVER_FIELDS
} lcb_RESPSERVERBASE;

/**@brief Response flags.
 * These provide additional 'meta' information about the response*/
typedef enum {
    /** No more responses are to be received for this request */
    LCB_RESP_F_FINAL = 0x01,

    /**The response was artificially generated inside the client.
     * This does not contain reply data from the server for the command, but
     * rather contains the basic fields to indicate success or failure and is
     * otherwise empty.
     */
    LCB_RESP_F_CLIENTGEN = 0x02,

    /**The response was a result of a not-my-vbucket error */
    LCB_RESP_F_NMVGEN = 0x04
} lcb_RESPFLAGS;

/**
 * The type of response passed to the callback. This is used to install callbacks
 * for the library and to distinguish between responses if a single callback
 * is used for multiple response types.
 *
 * @note These callbacks may conflict with the older version 2 callbacks. The
 * rules are as follows:
 * * If a callback has been installed using lcb_install_callback3(), then
 * the older version 2 callback will not be invoked for that operation. The order
 * of installation does not matter.
 * * If the LCB_CALLBACK_DEFAULT callback is installed, _none_ of the version 2
 * callbacks are invoked.
 */
typedef enum {
    LCB_CALLBACK_DEFAULT = 0, /**< Default callback invoked as a fallback */
    LCB_CALLBACK_GET, /**< lcb_get3() */
    LCB_CALLBACK_STORE, /**< lcb_store3() */
    LCB_CALLBACK_COUNTER, /**< lcb_counter3() */
    LCB_CALLBACK_TOUCH, /**< lcb_touch3() */
    LCB_CALLBACK_REMOVE, /**< lcb_remove3() */
    LCB_CALLBACK_UNLOCK, /**< lcb_unlock3() */
    LCB_CALLBACK_STATS, /**< lcb_stats3() */
    LCB_CALLBACK_VERSIONS, /**< lcb_server_versions3() */
    LCB_CALLBACK_VERBOSITY, /**< lcb_server_verbosity3() */
    LCB_CALLBACK_FLUSH, /**< lcb_flush3() */
    LCB_CALLBACK_OBSERVE, /**< lcb_observe3_ctxnew() */
    LCB_CALLBACK_GETREPLICA, /**< lcb_rget3() */
    LCB_CALLBACK_ENDURE, /**< lcb_endure3_ctxnew() */
    LCB_CALLBACK_HTTP, /**< lcb_http3() */
    LCB_CALLBACK__MAX /* Number of callbacks */
} lcb_CALLBACKTYPE;

/**
 * Callback invoked for responses.
 * @param instance The handle
 * @param cbtype The type of callback - or in other words, the type of operation
 * this callback has been invoked for.
 * @param resp The response for the operation. Depending on the operation this
 * response structure should be casted into a more specialized type.
 */
typedef void (*lcb_RESPCALLBACK)
        (lcb_t instance, int cbtype, const lcb_RESPBASE* resp);

/**
 * @volatile
 *
 * Install a new-style callback for an operation. The callback will be invoked
 * with the relevant response structure.
 *
 * @param instance the handle
 * @param cbtype the type of operation for which this callback should be installed.
 *        The value should be one of the lcb_CALLBACKTYPE constants
 * @param cb the callback to install
 * @return the old callback
 *
 * @note LCB_CALLBACK_DEFAULT is initialized to the default handler which proxies
 * back to the older 2.x callbacks. If you set `cbtype` to LCB_CALLBACK_DEFAULT
 * then your `2.x` callbacks _will not work_.
 *
 * @note The old callback may be `NULL`. It is usually not an error to have a
 * `NULL` callback installed. If the callback is `NULL`, then the default callback
 * invocation pattern will take place (as desribed above). However it is an error
 * to set the default callback to `NULL`.
 */
LIBCOUCHBASE_API
lcb_RESPCALLBACK
lcb_install_callback3(lcb_t instance, int cbtype, lcb_RESPCALLBACK cb);

/**
 * @volatile
 * Get the current callback installed as `cbtype`. Note that this does not
 * perform any kind of resolution (as described in lcb_install_callback3) and
 * will only return a non-`NULL` value if a callback had specifically been
 * installed via lcb_install_callback3() with the given `cbtype`.
 *
 * @param instance the handle
 * @param cbtype the type of callback to retrieve
 * @return the installed callback for the type.
 */
LIBCOUCHBASE_API
lcb_RESPCALLBACK
lcb_get_callback3(lcb_t instance, int cbtype);

/**@}*/

/**@name General Spooling API
 *
 * @details
 * The following operation APIs are low level entry points which create a
 * single operation. To use these operation APIs you should call the
 * lcb_sched_enter() which creates a virtual scope in which to create operations.
 *
 * For each of these operation APIs, the actual API call will insert the
 * created packet into a "Scheduling Queue" (this is done through
 * mcreq_sched_add() which is in mcreq.h). You may add as many items to this
 * scheduling queue as you would like.
 *
 * Note that an operation is only added to the queue if it was able to be
 * scheduled properly. If a scheduling failure occurred (for example, if a
 * configuration is missing, the command had invalid input, or memory allocation
 * failed) then the command will not be placed into the queue.
 *
 * Once all operations have been scheduled you can call
 * lcb_sched_leave() which will place all commands scheduled into the I/O
 * queue.
 *
 * If you wish to _discard_ all scheduled operations (for example, if one of
 * them errored, and your application cannot handle partial scheduling failures)
 * then you may call lcb_sched_fail() which will release all the resources
 * of the packets placed into the temporary queue.
 *
 * @{*/

/**
 * @volatile
 * @brief Enter a scheduling context.
 *
 * A scheduling context is an ephemeral list of
 * commands issued to various servers. Operations (like lcb_get3(), lcb_store3())
 * place packets into the current context.
 *
 * The context mechanism allows you to efficiently pipeline and schedule multiple
 * operations of different types and quantities. The network is not touched
 * and nothing is scheduled until the context is exited.
 *
 * @param instance the instance
 *
 * @code{.c}
 * lcb_sched_enter(instance);
 * lcb_get3(...);
 * lcb_store3(...);
 * lcb_counter3(...);
 * lcb_sched_leave(instance);
 * lcb_wait3(instance, LCB_WAIT_NOCHECK);
 * @endcode
 */
LIBCOUCHBASE_API
void lcb_sched_enter(lcb_t instance);

/**
 * @volatile
 *
 * @brief Leave the current scheduling context, scheduling the commands within the
 * context to be flushed to the network.
 *
 * @param instance the instance
 */
LIBCOUCHBASE_API
void lcb_sched_leave(lcb_t instance);


/**
 * @volatile
 * @brief Fail all commands in the current scheduling context.
 *
 * The commands placed within the current
 * scheduling context are released and are never flushed to the network.
 * @param instance
 */
LIBCOUCHBASE_API
void lcb_sched_fail(lcb_t instance);

/**
 * @volatile
 * @brief Request commands to be flushed to the network
 *
 * By default, the library will implicitly request a flush to the network upon
 * a call to lcb_sched_leave() [ Note, this does not mean the items are flushed
 * and I/O is performed, but it means the relevant event loop watchers are
 * activated to perform the operations on the next iteration ]. If
 * @ref LCB_CNTL_SCHED_NOFLUSH is set then this behavior is disabled and the
 * application must explicitly call lcb_sched_flush(). This may be considered
 * more performant in the cases where multiple discreet operations are scheduled
 * in an lcb_sched_enter()/lcb_sched_leave() pair. With implicit flush enabled,
 * each call to lcb_sched_leave() will possibly invoke system repeatedly.
 */
LIBCOUCHBASE_API
void lcb_sched_flush(lcb_t instance);

/**@}*/

/**@name Simple Retrievals
 * @brief Request and response structure for retrieving items
 * @{
 */

/**@brief Command for retrieving a single item
 *
 * @see lcb_get3()
 * @see lcb_RESPGET
 * @note The #cas member should be set to 0 for this operation.
 */
typedef struct {
    LCB_CMD_BASE;
    /**If set to true, the `exptime` field inside `options` will take to mean
     * the time the lock should be held. While the lock is held, other operations
     * trying to access the key will fail with an `LCB_ETMPFAIL` error. The
     * item may be unlocked either via `lcb_unlock3()` or via a mutation
     * operation with a supplied CAS
     */
    int lock;
} lcb_CMDGET;

/** @brief Response structure when retrieving a single item */
typedef struct {
    LCB_RESP_BASE
    const void *value; /**< Value buffer for the item */
    lcb_SIZE nvalue; /**< Length of value */
    void* bufh;
    lcb_datatype_t datatype;
    lcb_U32 itmflags; /**< User-defined flags for the item */
} lcb_RESPGET;

/**
 * @volatile
 *
 * @brief Spool a single get operation
 * @param instance the handle
 * @param cookie a pointer to be associated with the command
 * @param cmd the command structure
 * @return LCB_SUCCESS if successful, an error code otherwise
 * @see lcb_sched_enter(), lcb_sched_leave()
 *
 * @code{.c}
 * lcb_sched_enter(instance);
 * lcb_CMDGET cmd = { 0 };
 * LCB_CMD_SET_KEY(&cmd, "Hello", 5);
 * lcb_install_callback3(instance, LCB_CALLBACK_GET, a_callback);
 * lcb_get3(instance, cookie, &cmd);
 * lcb_sched_leave(instance);
 * lcb_wait3(instance, LCB_WAIT_NOCHECK);
 * @endcode
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_get3(lcb_t instance, const void *cookie, const lcb_CMDGET *cmd);

/**@brief Command for lcb_unlock3()
 * @attention lcb_CMDBASE::cas must be specified, or the operation will fail on
 * the server*/
typedef lcb_CMDBASE lcb_CMDUNLOCK;

/**@brief Response structure for an unlock command.
 * @note the lcb_RESPBASE::cas field does not contain the CAS of the item*/
typedef lcb_RESPBASE lcb_RESPUNLOCK;

/**@volatile
 * @brief
 * Unlock a previously locked item using lcb_CMDGET::lock
 *
 * @param instance the instance
 * @param cookie the context pointer to associate with the command
 * @param cmd the command containing the information about the locked key
 * @return LCB_SUCCESS if successful, an error code otherwise
 * @see lcb_get3(), lcb_sched_enter(), lcb_sched_leave()
 *
 * @code{.c}
 * static void locked_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPBASE *resp) {
 *   lcb_CMDUNLOCK cmd = { 0 };
 *   LCB_CMD_SET_KEY(&cmd, resp->key, resp->nkey);
 *   cmd.cas = resp->cas;
 *   lcb_sched_enter(instance);
 *   lcb_unlock3(instance, cookie, &cmd);
 *   lcb_sched_leave(instance);
 * }
 * @endcode
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_unlock3(lcb_t instance, const void *cookie, const lcb_CMDUNLOCK *cmd);
/**@}*/

/**
 * @name Counter Operations
 * @{
 */

/**@brief Command for counter operations.
 * @see lcb_counter3(), lcb_RESPCOUNTER.
 *
 * @warning You may only set the #exptime member if the #create member is set
 * to a true value. Setting `exptime` otherwise will cause the operation to
 * fail with @ref LCB_OPTIONS_CONFLICT
 *
 * @warning The #cas member should be set to 0 for this operation. As this
 * operation itself is atomic, specifying a CAS is not necessary.
 */
typedef struct {
    LCB_CMD_BASE;
    /**Delta value. If this number is negative the item on the server is
     * decremented. If this number is positive then the item on the server
     * is incremented */
    lcb_int64_t delta;
    /**If the item does not exist on the server (and `create` is true) then
     * this will be the initial value for the item. */
    lcb_U64 initial;
    /**Boolean value. Create the item and set it to `initial` if it does not
     * already exist */
    int create;
} lcb_CMDCOUNTER;

/**@brief Response structure for counter operations
 * @see lcb_counter3()
 */
typedef struct {
    LCB_RESP_BASE
    /** Contains the _current_ value after the operation was performed */
    lcb_U64 value;
} lcb_RESPCOUNTER;

/**@volatile
 * @brief Spool a single counter operation
 * @param instance the instance
 * @param cookie the pointer to associate with the request
 * @param cmd the command to use
 * @return LCB_SUCCESS on success, other error on failure
 *
 * @code{.c}
 * lcb_CMDCOUNTER cmd = { 0 };
 * LCB_CMD_SET_KEY(&cmd, "counter", strlen("counter"));
 * cmd.delta = 1; // Increment by one
 * cmd.initial = 42; // Default value is 42 if it does not exist
 * cmd.exptime = 300; // Expire in 5 minutes
 * lcb_sched_enter(instance);
 * lcb_counter3(instance, NULL, &cmd);
 * lcb_sched_leave(instance);
 * lcb_install_callback3(instance, LCB_CALLBACKTYPE_COUNTER, cb);
 * lcb_wait3(instance, LCB_WAIT_NOCHECK);
 * @endcode
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_counter3(lcb_t instance, const void *cookie, const lcb_CMDCOUNTER *cmd);
/**@}*/


/**@name Replica Reads
 * @details
 * Replica reads are done in cases where the master node is unavailable
 * (i.e. an lcb_get3() call returns LCB_NO_MATCHING_SERVER).
 *
 * @{*/

/**
 * @brief Command for requesting an item from a replica
 * @note The `options.exptime` and `options.cas` fields are ignored for this
 * command.
 *
 * @see lcb_rget3(), lcb_RESPGET
 */
typedef struct {
    LCB_CMD_BASE;
    lcb_replica_t strategy; /**< Strategy to use for selecting a replica */
    int index;
} lcb_CMDGETREPLICA;

/**@volatile
 * @brief Spool a single get-with-replica request
 * @param instance
 * @param cookie
 * @param cmd
 * @return LCB_SUCCESS on success, error code otherwise
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_rget3(lcb_t instance, const void *cookie, const lcb_CMDGETREPLICA *cmd);
/**@}*/

/**@name Storing and Mutating Items
 * @{
 */

/**@brief
 * Command for storing an item to the server. This command must contain the
 * key to mutate, the value which should be set (or appended/prepended) in the
 * lcb_CMDSTORE::value field (see LCB_CMD_SET_VALUE()) and the operation indicating
 * the mutation type (lcb_CMDSTORE::operation).
 *
 * @warning #exptime *cannot* be used with #operation set to @ref LCB_APPEND
 * or @ref LCB_PREPEND.
 */
typedef struct {
    LCB_CMD_BASE;

    /** Value to store on the server */
    lcb_VALBUF value;
    /**These flags are stored alongside the item on the server. They are
     * typically used by higher level clients to store format/type information*/
    lcb_U32 flags;
    /**Ignored for now */
    lcb_datatype_t datatype;
    /**Must be assigned*/
    lcb_storage_t operation;
} lcb_CMDSTORE;

typedef struct {
    LCB_RESP_BASE
    lcb_storage_t op;
} lcb_RESPSTORE;

/**
 * @brief Set the value buffer for the command
 * @param scmd an lcb_CMDSTORE pointer
 * @param valbuf the buffer for the value
 * @param vallen the length of the buffer
 * The buffer needs to remain valid only until the command is passed to the
 * lcb_store3() function.
 */
#define LCB_CMD_SET_VALUE(scmd, valbuf, vallen) do { \
    (scmd)->value.vtype = LCB_KV_COPY; \
    (scmd)->value.u_buf.contig.bytes = valbuf; \
    (scmd)->value.u_buf.contig.nbytes = vallen; \
} while (0);

/**
 * @volatile
 * @brief Spool a single storage request
 * @param instance the handle
 * @param cookie pointer to associate with the command
 * @param cmd the command structure
 * @return LCB_SUCCESS on success, error code on failure
 *
 * @code{.c}
 * lcb_CMDSTORE cmd = { 0 };
 * LCB_CMD_SET_KEY(&cmd, "Key", 3);
 * LCB_CMD_SET_VALUE(&cmd, "value", 5);
 * cmd.operation = LCB_ADD; // Only create if it does not exist
 * cmd.exptime = 60; // expire in a minute
 * lcb_sched_enter(instance);
 * lcb_store3(instance, cookie, &cmd);
 * lcb_sched_leave(instance);
 * lcb_wait3(instance, LCB_WAIT_NOCHECK);
 * @endcode
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_store3(lcb_t instance, const void *cookie, const lcb_CMDSTORE *cmd);
/**@}*/

/**@name Removing Items
 * @{*/

/**@brief
 * Command for removing an item from the server
 * @note The lcb_CMDREMOVE::exptime field here does nothing.
 *
 * The lcb_CMDREMOVE::cas field may be
 * set to the last CAS received from a previous operation if you wish to
 * ensure the item is removed only if it has not been mutated since the last
 * retrieval
 */
typedef lcb_CMDBASE lcb_CMDREMOVE;

/**@brief
 * Response structure for removal operation. The lcb_RESPREMOVE::cas field
 * contains the CAS of the item which may be used to check that it no longer
 * exists on any node's storage using the lcb_endure3_ctxnew() function.
 *
 * The lcb_RESPREMOVE::rc field may be set to LCB_KEY_ENOENT if the item does
 * not exist, or LCB_KEY_EEXISTS if a CAS was specified and the item has since
 * been mutated.
 */
typedef lcb_RESPBASE lcb_RESPREMOVE;

/**@volatile
 * @brief Spool a removal of an item
 * @param instance the handle
 * @param cookie pointer to associate with the request
 * @param cmd the command
 * @return LCB_SUCCESS on success, other code on failure
 *
 * @code{.c}
 * lcb_CMDREMOVE cmd = { 0 };
 * LCB_CMD_SET_KEY(&cmd, "deleteme", strlen("deleteme"));
 * lcb_sched_enter(instance);
 * lcb_remove3(instance, cookie, &cmd);
 * lcb_sched_leave(instance);
 * @endcode
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_remove3(lcb_t instance, const void *cookie, const lcb_CMDREMOVE * cmd);
/**@}*/

/**@name Modify an item's expiration time
 *
 * @details
 * The lcb_touch3() command may be used to modify an items operation time, either
 * to make it expire at a given time, or to clear its pending expiration. This
 * command may be used in case you wish to only ensure the item is not deleted
 * but no actually modify (lcb_store3()) or retrieve (lcb_get3()) the item.
 *
 * @{
 */

/**@brief Command structure for a touch request
 * @note The lcb_CMDTOUCH::cas field is ignored. The item's modification time
 * is always updated regardless if the CAS on the server differs*/
typedef lcb_CMDBASE lcb_CMDTOUCH;

/**@brief Response structure for a touch request
 * @note the lcb_RESPTOUCH::cas field contains the current CAS of the item*/
typedef lcb_RESPBASE lcb_RESPTOUCH;

/**@volatile
 * @brief Spool a touch request
 * @param instance the handle
 * @param cookie the pointer to associate with the request
 * @param cmd the command
 * @return LCB_SUCCESS on success, other error code on failure
 *
 * @code{.c}
 * lcb_CMDTOUCH cmd = { 0 };
 * LCB_CMD_SET_KEY(&cmd, "keep_me", strlen("keep_me"));
 * cmd.exptime = 0; // Clear the expiration
 * lcb_sched_enter(instance);
 * lcb_touch3(instance, cookie, &cmd);
 * lcb_sched_leave(instance);
 * @endcode
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_touch3(lcb_t instance, const void *cookie, const lcb_CMDTOUCH *cmd);
/**@}*/


/**@name Retrieve statistics from the cluster
 * @{
 */

/**@brief Command structure for stats request
 * The lcb_CMDSTATS::key field should contain the statistics key, or be empty
 * if the default statistics are desired. */
typedef lcb_CMDBASE lcb_CMDSTATS;

/** The key is a stored item for which statistics should be retrieved. This
 * invokes the 'keystats' semantics. Note that when using such semantics, a key
 * must be present, and must not have any spaces in it. */
#define LCB_CMDSTATS_F_KV (1 << 16)

/**@brief Response structure for cluster statistics.
 * The lcb_RESPSTATS::key field contains the statistic name (_not_ the same
 * as was passed in lcb_CMDSTATS::key which is the name of the statistical
 * _group_).*/
typedef struct {
    LCB_RESP_BASE
    LCB_RESP_SERVER_FIELDS
    const char *value; /**< The value, if any, for the given statistic */
    lcb_SIZE nvalue; /**< Length of value */
} lcb_RESPSTATS;


/**@volatile
 * @brief Spool a request for statistics from the cluster.
 * @param instance the instance
 * @param cookie pointer to associate with the request
 * @param cmd the command
 * @return LCB_SUCCESS on success, other error code on failure.
 *
 * Note that the callback for this command is invoked an indeterminate amount
 * of times. The callback is invoked once for each statistic for each server.
 * When all the servers have responded with their statistics, a final callback
 * is delivered to the application with the LCB_RESP_F_FINAL flag set in the
 * lcb_RESPSTATS::rflags field. When this response is received no more callbacks
 * for this command shall be invoked.
 *
 * @code{.c}
 * void stats_callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPSTATS *resp)
 * {
 *   if (resp->key) {
 *     FILE *fp = (FILE *)resp->cookie;
 *     fprintf(fp, "Server %s: %.*s = %.*s\n", resp->server,
 *            (int)resp->nkey, resp->key,
 *            (int)resp->nvalue, resp->value);
 *   }
 *   if (resp->rflags & LCB_RESP_F_FINAL) {
 *     fclose(cookie);
 *   }
 * }
 *
 * void printStatsToFile(const char *path) {
 *   FILE *fp = fopen(path, "w");
 *   // .. initialize your instance
 *   lcb_install_callback3(instance, LCB_CALLBACK_STATS, (lcb_RESP_cb)stats_callback);
 *   lcb_CMDSTATS cmd = { 0 };
 *   // Using default stats, no further initialization
 *   lcb_sched_enter(instance);
 *   lcb_stats3(instance, fp, &cmd);
 *   lcb_sched_leave(instance);
 *   lcb_wait3(instance, LCB_WAIT_NOCHECK);
 * }
 * @endcode
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_stats3(lcb_t instance, const void *cookie, const lcb_CMDSTATS * cmd);
/**@}*/

/**
 * Multi Command Context API
 * Some commands (notably, OBSERVE and its higher level equivalent, endue)
 * are handled more efficiently at the cluster side by stuffing multiple
 * items into a single packet.
 *
 * This structure defines three function pointers to invoke. The #addcmd()
 * function will add a new command to the current packet, the #done()
 * function will schedule the packet(s) into the current scheduling context
 * and the #fail() function will destroy the context without progressing
 * further.
 *
 * Some commands will return an lcb_MULTICMD_CTX object to be used for this
 * purpose:
 *
 * @code{.c}
 * lcb_MUTLICMD_CTX *ctx = lcb_observe3_ctxnew(instance);
 *
 * lcb_CMDOBSERVE cmd = { 0 };
 * LCB_CMD_SET_KEY(&cmd, "key1", strlen("key1"));
 * ctx->addcmd(ctx, &cmd);
 * LCB_CMD_SET_KEY(&cmd.key, "key2", strlen("key2"));
 * ctx->addcmd(ctx, &cmd);
 * LCB_CMD_SET_KEY(&cmd.key, "key3", strlen("key3"));
 * ctx->addcmd(ctx, &cmd);
 *
 * lcb_sched_enter(instance);
 * ctx->done(ctx);
 * lcb_sched_leave(instance);
 * lcb_wait(instance);
 * @endcode
 */
typedef struct lcb_MULTICMD_CTX_st {
    /**
     * Add a command to the current context
     * @param ctx the context
     * @param cmd the command to add. Note that `cmd` may be a subclass of lcb_CMDBASE
     * @return LCB_SUCCESS, or failure if a command could not be added.
     */
    lcb_error_t (*addcmd)(struct lcb_MULTICMD_CTX_st *ctx, const lcb_CMDBASE *cmd);

    /**
     * Indicate that no more commands are added to this context, and that the
     * context should assemble the packets and place them in the current
     * scheduling context
     * @param ctx The multi context
     * @param cookie The cookie for all commands
     * @return LCB_SUCCESS if scheduled successfully, or an error code if there
     * was a problem constructing the packet(s).
     */
    lcb_error_t (*done)(struct lcb_MULTICMD_CTX_st *ctx, const void *cookie);

    /**
     * Indicate that no more commands should be added to this context, and that
     * the context should not add its contents to the packet queues, but rather
     * release its resources. Called if you don't want to actually perform
     * the operations.
     * @param ctx
     */
    void (*fail)(struct lcb_MULTICMD_CTX_st *ctx);
} lcb_MULTICMD_CTX;

/**@name Retrieve replication and persistence status about an item
 * @{
 */

/**Set this bit in the cmdflags field to indicate that only the master node
 * should be contacted*/
#define LCB_CMDOBSERVE_F_MASTER_ONLY 1<<16

/**@brief Structure for an observe request.
 * To request the status from _only_ the master node of the key, set the
 * LCB_CMDOBSERVE_F_MASTERONLY bit inside the lcb_CMDOBSERVE::cmdflags field
 */
typedef lcb_CMDBASE lcb_CMDOBSERVE;

/**@brief Response structure for an observe command.
 * Note that the lcb_RESPOBSERVE::cas contains the CAS of the item as it is
 * stored within that specific server. The CAS may be incorrect or stale
 * unless lcb_RESPOBSERVE::ismaster is true.
 */
typedef struct {
    LCB_RESP_BASE
    lcb_U8 status; /**<Bit set of flags */
    lcb_U8 ismaster; /**< Set to true if this response came from the master node */
    lcb_U32 ttp; /**<Unused */
    lcb_U32 ttr; /**<Unused */
} lcb_RESPOBSERVE;

/**@volatile
 * @brief Create a new multi context for an observe operation
 * @param instance the instance
 * @return a new multi command context, or NULL on allocation failure.
 *
 * Note that the callback for this command will be invoked multiple times,
 * one for each node. To determine when no more callbacks will be invoked,
 * check for the LCB_RESP_F_FINAL flag inside the lcb_RESPOBSERVE::rflags
 * field.
 *
 * @code{.c}
 * void callback(lcb_t, lcb_CALLBACKTYPE, const lcb_RESPOBSERVE *resp)
 * {
 *   if (resp->rflags & LCB_RESP_F_FINAL) {
 *     return;
 *   }
 *
 *   printf("Got status for key %.*s\n", (int)resp->nkey, resp->key);
 *   printf("  Node Type: %s\n", resp->ismaster ? "MASTER" : "REPLICA");
 *   printf("  Status: 0x%x\n", resp->status);
 *   printf("  Current CAS: 0x%"PRIx64"\n", resp->cas);
 * }
 *
 * lcb_MULTICMD_CTX *mctx = lcb_observe3_ctxnew(instance);
 * lcb_CMDOBSERVE cmd = { 0 };
 * LCB_CMD_SET_KEY(&cmd, "key", 3);
 * mctx->addcmd(mctx, (lcb_CMDBASE *)&cmd);
 * lcb_sched_enter(instance);
 * mctx->done(mctx, cookie);
 * lcb_sched_leave(instance);
 * lcb_install_callback3(instance, LCB_CALLBACK_OBSERVE, (lcb_RESP_cb)callback);
 * @endcode
 */
LIBCOUCHBASE_API
lcb_MULTICMD_CTX *
lcb_observe3_ctxnew(lcb_t instance);
/**@}*/

/**@name Wait for items to be persisted or replicated to nodes
 * @{
 */

/**@brief Command structure for endure.
 * If the lcb_CMDENDURE::cas field is specified, the operation will check and
 * verify that the CAS found on each of the nodes matches the CAS specified
 * and only then consider the item to be replicated and/or persisted to the
 * nodes. If the item exists on the master's cache with a different CAS then
 * the operation will fail
 */
typedef lcb_CMDBASE lcb_CMDENDURE;

/**@brief Response structure for endure */
typedef struct {
    LCB_RESP_BASE
    lcb_U16 nresponses; /**< Total number of polls needed for this item */
    lcb_U8 exists_master; /**< True if the item exists in master's cache */
    lcb_U8 persisted_master; /**< True if item exists in master's disk */
    lcb_U8 npersisted; /**< How many nodes was this item persisted to */
    lcb_U8 nreplicated; /**< How many nodes was this item replicated to */
} lcb_RESPENDURE;

/**
 * @volatile
 * @brief Return a new command context for scheduling endure operations
 * @param instance the instance
 * @param options a structure containing the various criteria needed for
 * durability requirements
 * @param[out] err Error code if a new context could not be created
 * @return the new context, or NULL on error. Note that in addition to memory
 * allocation failure, this function might also return NULL because the `options`
 * structure contained bad values. Always check the `err` result.
 *
 *
 */
LIBCOUCHBASE_API
lcb_MULTICMD_CTX *
lcb_endure3_ctxnew(lcb_t instance,
    const lcb_durability_opts_t *options, lcb_error_t *err);
/**@}*/

/**@name Check the memcached server versions
 * @brief Return the memcached version (not Couchbase version) for all servers.
 * May also be used as a simple way to check that all nodes are responding.
 *
 * @{
 */

/**@brief Response structure for the version command */
typedef struct {
    LCB_RESP_BASE
    LCB_RESP_SERVER_FIELDS
    const char *mcversion; /**< The version string */
    lcb_SIZE nversion; /**< Length of the version string */
} lcb_RESPMCVERSION;

/**@volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_server_versions3(lcb_t instance, const void *cookie, const lcb_CMDBASE * cmd);
/**@}*/

/**@name Set the memcached Logging Level
 * @{
 */
typedef struct {
    /* unused */
    LCB_CMD_BASE;
    const char *server;
    lcb_verbosity_level_t level;
} lcb_CMDVERBOSITY;
typedef lcb_RESPSERVERBASE lcb_RESPVERBOSITY;
/**@volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_server_verbosity3(lcb_t instance, const void *cookie, const lcb_CMDVERBOSITY *cmd);
/**@}*/

/**@name Flush a memcached Bucket
 * @details Clear a memcached bucket of all items. Note that this will not
 * work on a Couchbase bucket. To flush a couchbase bucket, use the REST API
 * @{
 */
typedef lcb_CMDBASE lcb_CMDFLUSH;
typedef lcb_RESPSERVERBASE lcb_RESPFLUSH;
/**@volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_flush3(lcb_t instance, const void *cookie, const lcb_CMDFLUSH *cmd);
/**@}*/


/** Command flag for HTTP to indicate that the callback is to be invoked
 * multiple times for each new chunk of incoming data. Once all the chunks
 * have been received, the callback will be invoked once more with the
 * LCB_RESP_F_FINAL flag and an empty content. */

/**
 * @name Perform an HTTP operation
 * @{
 */

#define LCB_CMDHTTP_F_STREAM 1<<16

/**
 * Structure for performing an HTTP request.
 * Note that the key and nkey fields indicate the _path_ for the API
 */
typedef struct {
    LCB_CMD_BASE;
    /**Type of request to issue. LCB_HTTP_TYPE_VIEW will issue a request
     * against a random node's view API. LCB_HTTP_TYPE_MANAGEMENT will issue
     * a request against a random node's administrative API, and
     * LCB_HTTP_TYPE_RAW will issue a request against an arbitrary host. */
    lcb_http_type_t type;
    lcb_http_method_t method; /**< HTTP Method to use */

    /** If the request requires a body (e.g. `PUT` or `POST`) then it will
     * go here. Be sure to indicate the length of the body too. */
    const char *body;

    /** Length of the body for the request */
    lcb_SIZE nbody;

    /** If non-NULL, will be assigned a handle which may be used to
     * subsequently cancel the request */
    lcb_http_request_t *reqhandle;

    /** For views, set this to `application/json` */
    const char *content_type;

    /** Username to authenticate with, if left empty, will use the credentials
     * passed to lcb_create() */
    const char *username;

    /** Password to authenticate with, if left empty, will use the credentials
     * passed to lcb_create() */
    const char *password;

    /** If set, this must be a string in the form of `http://host:port`. Should
     * only be used for raw requests. */
    const char *host;
} lcb_CMDHTTP;

typedef struct {
    LCB_RESP_BASE
    short htstatus; /** HTTP status code */
    const char * const * headers;
    const void *body;
    lcb_SIZE nbody;
    lcb_http_request_t _htreq; /* Private */
} lcb_RESPHTTP;

LIBCOUCHBASE_API
lcb_error_t
lcb_http3(lcb_t instance, const void *cookie, const lcb_CMDHTTP *cmd);
/**@}*/

/**@}*/
#ifdef __cplusplus
}
#endif

#endif /* LCB_API3_H */
