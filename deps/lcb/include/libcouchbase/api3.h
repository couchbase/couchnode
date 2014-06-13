#ifndef LCB_API3_H
#define LCB_API3_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @file
 * @brief
 * Public "V3" API
 */

/**
 * @ingroup MCREQ LCB_PUBAPI
 * @defgroup MCREQ_PUBAPI Memcached/Libcouchbase v3 API
 *
 * @brief
 * Basic command and structure definitions for public API. This represents the
 * "V3" API of libcouchbase.
 *
 *
 * # Scheduling APIs
 *
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
 * # Operation APIs
 *
 * Operation APIs each schedule only a single logical command. These differ from
 * the _V2_ APIs in libcouchbase which schedule multiple commands. In this
 * version of the library, the _V2_ APIs wrap the _V3_ APIs listed here.
 *
 * @addtogroup MCREQ_PUBAPI
 * @{
 */

/** @brief Flags indicating the storage policy for a buffer */
typedef enum {
    LCB_KV_COPY = 0, /**< The buffer should be copied */
    LCB_KV_CONTIG, /**< The buffer is contiguous and should not be copied */
    LCB_KV_IOV /**< The buffer is not contiguous and should not be copied */
} lcb_KVBUFTYPE;

#define LCB_KV_HEADER_AND_KEY LCB_KV_CONTIG

/**
 * @brief simple buf/length structure for a contiguous series of bytes
 */
typedef struct lcb_CONTIGBUF {
    const void *bytes;
    /** Number of total bytes */
    lcb_size_t nbytes;
} lcb_CONTIGBUF;

/** @brief Common request header for all keys */
typedef struct lcb_KEYBUF {
    /**
     * The type of key to provide. This can currently be LCB_KV_COPY (Default)
     * to copy the key into the pipeline buffers, or LCB_KV_HEADER_AND_KEY
     * to provide a buffer with the header storage and the key.
     *
     * TODO:
     * Currently only LCB_KV_COPY should be used. LCB_KV_HEADER_AND_KEY is used
     * internally but may be exposed later on
     */
    lcb_KVBUFTYPE type;
    lcb_CONTIGBUF contig;
} lcb_KEYBUF;

/**
 * @brief Initialize a contiguous request backed by a buffer which should be
 * copied
 * @param req the key request to initialize
 * @param k the key to copy
 * @param nk the size of the key
 */
#define LCB_KREQ_SIMPLE(req, k, nk) do { \
    (req)->type = LCB_KV_COPY; \
    (req)->contig.bytes = k; \
    (req)->contig.nbytes = nk; \
} while (0);

/**
 * Structure for an IOV buffer to be supplied as a buffer. This is currently
 * only used for value buffers
 */
typedef struct lcb_FRAGBUF {
    /** An IOV array */
    lcb_IOV *iov;

    /** Number of elements in iov array */
    unsigned int niov;

    /**
     * Total length of the items. This should be set, if known, to prevent the
     * library from manually traversing the iov array to calculate the length.
     */
    unsigned int total_length;
} lcb_FRAGBUF;

/** @brief Structure representing a value to be stored */
typedef struct lcb_VALBUF {
    /**
     * Value request type. This may be one of:
     * - LCB_KV_COPY: Copy over the value into LCB's own buffers
     *   Use the 'contig' field to supply the information.
     *
     * - LCB_KV_CONTIG: The buffer is a contiguous chunk of value data.
     *   Use the 'contig' field to supply the information.
     *
     * - LCB_KV_IOV: The buffer is a series of IOV elements. Use the 'multi'
     *   field to supply the information.
     */
    lcb_KVBUFTYPE vtype;
    union {
        lcb_CONTIGBUF contig;
        lcb_FRAGBUF multi;
    } u_buf;
} lcb_VALBUF;

/**
 * @brief Common options for commands.
 *
 * This contains the CAS and expiration
 * of the item. These should be filled in if applicable, or they may be ignored.
 */
typedef struct lcb_CMDOPTIONS {
    lcb_cas_t cas;
    lcb_time_t exptime;
} lcb_CMDOPTIONS;

/**
 * @brief Common ABI header for all commands
 */
typedef struct lcb_CMDBASE {
    lcb_uint32_t cmdflags; /**< Common flags for commands */
    lcb_KEYBUF key; /**< Key for the command */
    lcb_KEYBUF hashkey; /**< Hashkey for command */
    lcb_CMDOPTIONS options; /**< Common options */
} lcb_CMDBASE;

/**
 * @brief Base command structure macro used to fill in the actual command fields
 * @see lcb_cmd_st
 */
#define LCB_CMD_BASE \
    lcb_uint32_t cmdflags; \
    lcb_KEYBUF key; \
    lcb_KEYBUF hashkey; \
    lcb_CMDOPTIONS options

typedef lcb_CMDBASE lcb_CMDTOUCH;
typedef lcb_CMDBASE lcb_CMDSTATS;
typedef lcb_CMDBASE lcb_CMDFLUSH;

struct mc_cmdqueue_st;
struct mc_pipeline_st;

/**@volatile*/
LIBCOUCHBASE_API
void lcb_sched_enter(lcb_t);

/**@volatile*/
LIBCOUCHBASE_API
void lcb_sched_leave(lcb_t);

/**@volatile*/
LIBCOUCHBASE_API
void lcb_sched_fail(lcb_t);

/** @brief Command for retrieving a single item */
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

/**
 * @brief Spool a single get operation
 * @volatile
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_get3(lcb_t instance, const void *cookie, const lcb_CMDGET *cmd);

/**
 * @brief Command for counter operations
 */
typedef struct {
    LCB_CMD_BASE;
    /**Delta value. If this number is negative the item on the server is
     * decremented. If this number is positive then the item on the server
     * is incremented */
    lcb_int64_t delta;
    /**If the item does not exist on the server (and `create` is true) then
     * this will be the initial value for the item. */
    lcb_uint64_t initial;
    /**Boolean value. Create the item and set it to `initial` if it does not
     * already exist */
    int create;
} lcb_CMDINCRDECR;
/**
 * @brief Spool a single arithmetic operation
 * @volatile
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_arithmetic3(lcb_t instance, const void *cookie, const lcb_CMDINCRDECR *cmd);

/**
 * @brief Command for lcb_unlock3()
 * @attention `options.cas` must be specified, or the operation will fail on
 * the server
 */
typedef lcb_CMDBASE lcb_CMDUNLOCK;
/** @brief Unlock a previously locked item */
LIBCOUCHBASE_API
lcb_error_t
lcb_unlock3(lcb_t instance, const void *cookie, const lcb_CMDUNLOCK *cmd);

/**
 * @brief Command for requesting an item from a replica
 * @note The `options.exptime` and `options.cas` fields are ignored for this
 * command.
 */
typedef struct {
    LCB_CMD_BASE;
    /** Strategy to use for selecting a replica */
    lcb_replica_t strategy;
    int index;
} lcb_CMDGETREPLICA;
/**
 * @brief Spool a single get-with-replica request
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_rget3(lcb_t instance, const void *cookie, const lcb_CMDGETREPLICA *cmd);

/**@brief Command for storing an item to the server */
typedef struct {
    LCB_CMD_BASE;
    lcb_VALBUF value; /**< Value to store on the server */
    /**These flags are stored alongside the item on the server. They are
     * typically used by higher level clients to store format/type information*/
    lcb_uint32_t flags;
    /**Ignored for now */
    lcb_datatype_t datatype;
    /**Must be assigned*/
    lcb_storage_t operation;
} lcb_CMDSTORE;
/**
 * @brief Spool a single storage request
 * @volatile
 */
LIBCOUCHBASE_API
lcb_error_t
lcb_store3(lcb_t instance, const void *cookie, const lcb_CMDSTORE *cmd);

/**@brief Command for removing an item from the server
 * @note The `options.exptime` field here does nothing. The CAS field may be
 * set to the last CAS received from a previous operation if you wish to
 * ensure the item is removed only if it has not been mutated since the last
 * retrieval
 */
typedef lcb_CMDBASE lcb_CMDREMOVE;
/**@brief Schedule a removal of an item from the server
 * @volatile */
LIBCOUCHBASE_API
lcb_error_t
lcb_remove3(lcb_t instance, const void *cookie, const lcb_CMDREMOVE * cmd);

/**@brief Modify an item's expiration time
 * @volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_touch3(lcb_t instance, const void *cookie, lcb_CMDTOUCH *cmd);

/**@volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_stats3(lcb_t instance, const void *cookie, const lcb_CMDSTATS * cmd);

/**@volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_server_versions3(lcb_t instance, const void *cookie, const lcb_CMDBASE * cmd);

typedef struct {
    /* unused */
    LCB_CMD_BASE;
    const char *server;
    lcb_verbosity_level_t level;
} lcb_CMDVERBOSITY;

/**@volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_server_verbosity3(lcb_t instance, const void *cookie, const lcb_CMDVERBOSITY *cmd);

/**@volatile*/
LIBCOUCHBASE_API
lcb_error_t
lcb_flush3(lcb_t instance, const void *cookie, const lcb_CMDFLUSH *cmd);


/**@}*/

#ifdef __cplusplus
}
#endif

#endif /* LCB_API3_H */
