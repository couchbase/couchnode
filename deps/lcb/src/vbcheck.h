/**
 * Structures and routines for checking, validating, and caching vBucket
 * information.
 */


/**
 * The basic idea behind this file is to provide convenience functions for
 * (1) Ensuring the validity of our current vBucket configuration
 * (2) Ensuring all keys in a list have a server which will receive the request
 * (3) Caching this server/vbucket mapping information so that we can compensate
 *     for the efficiency lost by iterating twice
 */


/** Number of items to pre-allocate on the stack */
#define VBCHECK_NSTACK 1024

/** This structure gives us information about a given key/item */
typedef struct vbcheck_st {
    /** vBucket for the key */
    lcb_uint16_t vb;
    /** Index for destination server */
    lcb_uint16_t ix;
} vbcheck_keyinfo;

typedef struct vbcheck_ctx_st {
    /** Stacked array for destination vBuckets */
    struct vbcheck_st stack_ki_[VBCHECK_NSTACK];

    /**
     * Stacked array for destination servers:
     * Another optimization provided here is that of send_packets. send_packets
     * will always 'bother' the event loop so we want to call this as little
     * as possible. Previously we would call this after sending each command.
     * With this array we ensure that we only call send_packets at the end.
     * The array contains 'instance->nserver' items; where each element
     * corresponds to a server in the server map. Whenever we map a key to a
     * server, the element at the server's index is set to true.
     *
     * Later on, we iterate over this array and call send_packets for each
     * server which has a nonzero entry in here
     */
    char stack_srv_[VBCHECK_NSTACK];


    /** Allocated keyinfo data, if nkeys > NSTACK */
    struct vbcheck_st *alloc_ki_;
    /** User-facing start of ki array */
    struct vbcheck_st *ptr_ki;

    /** Allocated server info data, if nservers > NSTACK */
    char *alloc_srv_;

    /** User facing start of srv array */
    char *ptr_srv;
} vbcheck_ctx;


/**
 * Initialize a 'vbc' context
 * @param ctx a vbc structure, typically on the stack
 * @param instance the lcb instance. Used to determine number of servers
 * @param num the number of keys (or "commands") to initialize for.
 * @return LCB_SUCCESS on success, error otherwise
 */
static lcb_error_t vbcheck_ctx_init(vbcheck_ctx *ctx,
                                    lcb_t instance,
                                    lcb_size_t num)
{
    if (num <= VBCHECK_NSTACK) {
        ctx->alloc_ki_ = NULL;
        ctx->ptr_ki = ctx->stack_ki_;
    } else {
        ctx->alloc_ki_ = malloc(sizeof(*ctx->alloc_ki_) * num);
        if (!ctx->alloc_ki_) {
            return LCB_CLIENT_ENOMEM;
        }
        ctx->ptr_ki = ctx->alloc_ki_;
    }

    if (instance->nservers < VBCHECK_NSTACK) {
        ctx->ptr_srv = ctx->stack_srv_;
        memset(ctx->ptr_srv, 0, sizeof(ctx->stack_srv_));
        ctx->alloc_srv_ = NULL;
    } else {
        ctx->alloc_srv_ = calloc(instance->nservers, sizeof (char));
        if (!ctx->alloc_srv_) {
            free(ctx->alloc_ki_);
            return LCB_CLIENT_ENOMEM;
        }
    }


    return LCB_SUCCESS;
}

/**
 * Release any resources allocated by vbcheck_ctx_init()
 */
static void vbcheck_ctx_clean(vbcheck_ctx *ctx) {
    free(ctx->alloc_ki_);
    free(ctx->alloc_srv_);
}

/**
 * Populates the information on the vbucket and server for a given key
 * @param ctx an initialized vbc context
 * @param instance
 * @param ii the index into the array of items. This indicates the output index
 *        into the ki array within the vbc context
 * @param hashkey The key to hash for vbucket information
 * @param nhashkey the size of the hashkey
 * @return LCB_SUCCESS if the key could be mapped to a valid server and vbucket
 *         or an error if there was a mapping error.
 */
static lcb_error_t vbcheck_populate(vbcheck_ctx *ctx,
                                    lcb_t instance,
                                    lcb_size_t ii,
                                    const void *hashkey,
                                    lcb_size_t nhashkey)
{
    int vb;
    int ix;
    vbcheck_keyinfo *ki = ctx->ptr_ki + ii;
    vbucket_map(instance->vbucket_config, hashkey, nhashkey, &vb, &ix);
    if (ix < 0 || ix > (int)instance->nservers) {
        return LCB_NO_MATCHING_SERVER;
    }
    ki->vb = (lcb_uint16_t)vb;
    ki->ix = (lcb_uint16_t)ix;
    ctx->ptr_srv[ix] = 1;
    return LCB_SUCCESS;
}

/**
 * Macro to extract the appropriate hashkey from a command structure. This
 * checks the 'v0' struct of the command
 * @param cmd the command pointer
 * @param key the variable to hold the key pointer
 * @param nkey the variable to hold the key size
 */
#define VBC_GETK0(cmd, K, N) \
if ((cmd)->v.v0.hashkey) { K = (cmd)->v.v0.hashkey; N = (cmd)->v.v0.nhashkey; } \
else { K = (cmd)->v.v0.key; N = (cmd)->v.v0.nkey; }


/**
 * Macro to use at the beginning of operation APIs to check if a valid vbucket
 * configuration exists. This will return from the function with an appropriate
 * error cdo
 */
#define VBC_SANITY(instance) \
        if (instance->vbucket_config == NULL) { \
            if (instance->type == LCB_TYPE_CLUSTER) { \
                return lcb_synchandler_return(instance, LCB_EBADHANDLE); \
            } else { \
                return lcb_synchandler_return(instance, LCB_CLIENT_ETMPFAIL); \
            } \
        }
