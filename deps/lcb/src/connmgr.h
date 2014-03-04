#ifndef LCB_SOCKPOOL_H
#define LCB_SOCKPOOL_H
#include "settings.h"
#include "timer.h"
#include "lcbio.h"
#include "genhash.h"
#include "list.h"
#include <stdio.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * General purpose connection manager for LCB sockets. This object is
 * responsible for maintaining and properly handling idle connections
 * and pooling them (optionally).
 */

typedef char connmgr_key_t[NI_MAXSERV + NI_MAXHOST + 2];
struct connmgr_request_st;
struct connmgr_t;
struct connmgr_hostent_st;

/**
 * Callback to be invoked when a connection is ready
 */
typedef void (*connmgr_callback_t)(struct connmgr_request_st *);


typedef struct connmgr_request_st {
    /** INTERNAL: Entry within the linked list */

    lcb_list_t llnode;

    /** IN: Callback to be invoked when the connection has been satisfied */
    connmgr_callback_t callback;

    /** IN: Key for the request */
    connmgr_key_t key;

    /** INTERNAL: Parent host entry object */
    struct connmgr_hostent_st *he;

    /** INTERNAL: async/timer object */
    lcb_timer_t timer;

    /** INTERNAL: Request state */
    int state;

    /**
     * OUT: Connection used. Will be NULL on error.
     *
     * XXX:
     * The connection pointer will be deemed invalid after this call, so
     * be sure to use lcb_connection_transfer_socket.
     */
    lcb_connection_t conn;

    /**
     * OUT: If the connection failed to connect, this contains the reason why
     */
    lcb_error_t err;

    /** IN/OUT: User data. Not touched by manager */
    void *data;
} connmgr_request;


/**
 * Entry for a single host within the pool
 */
typedef struct connmgr_hostent_st {
    /** A list of connections */
    lcb_clist_t ll_idle;

    /** A list of pending connections */
    lcb_clist_t ll_pending;

    /** A list of requests */
    lcb_clist_t requests;

    /** The key */
    connmgr_key_t key;

    /** Parent pool info */
    struct connmgr_t *parent;

    /** Async object used for pending notifications */
    lcb_async_t async;

    /** How many connections are currently being used */
    unsigned int n_leased;

    /** How many total connections are in the pool */
    unsigned int n_total;
} connmgr_hostent;


typedef struct connmgr_t {
    genhash_t* ht;
    lcb_settings *settings;
    lcb_io_opt_t io;

    /** Timeout for an idle connection */
    lcb_uint32_t idle_timeout;

    /** Number of maximum total connections to create for each host */
    unsigned int max_total;

    /** Maximum number of _idle_ connections for each host */
    unsigned int max_idle;
} connmgr_t;


/**
 * Create a socket pool controlled by the given settings and IO structure
 */
LCB_INTERNAL_API
connmgr_t* connmgr_create(lcb_settings *settings, lcb_io_opt_t io);

/**
 * Free the socket pool
 */
LCB_INTERNAL_API
void connmgr_destroy(connmgr_t *);

/**
 * Initialize a request for a socketpool. Once the request has been initialized
 * it may be passed to sockpool_get
 * @param req the request to initialize
 * @param host the host for the request
 * @param port the port for the request
 * @param callback the callback to invoke when the request has completed
 */
LCB_INTERNAL_API
void connmgr_req_init(connmgr_request *req,
                      const char *host,
                      const char *port,
                      connmgr_callback_t callback);

/**
 * Attempt to acquire an existing connection or open a new connection with the
 * socket pool
 * @param pool the pool
 * @param req the request. The request should have been initialized via
 * req_init()
 * @param timeout number of microseconds to wait if a connection could not
 * be established.
 */
LCB_INTERNAL_API
void connmgr_get(connmgr_t *mgr, connmgr_request *req, lcb_uint32_t timeout);

/**
 * Cancel a pending request. The callback for the request must have not already
 * been invoked (if it has, use sockpool_put)
 * @param pool the pool which the request was made to
 * @param req the request to cancel
 */
LCB_INTERNAL_API
void connmgr_cancel(connmgr_t *mgr, connmgr_request *req);

/**
 * Release a socket back into the pool. This means the socket is no longer
 * used and shall be available for reuse for another request.
 *
 * @param pool the pool
 * @param conn a connection object to release. Note that the pointer 'conn'
 * will still be valid, however its contents will remain empty.
 */
LCB_INTERNAL_API
void connmgr_put(connmgr_t *mgr, lcb_connection_t conn);

/**
 * Mark a slot as available but discard the current connection. This should be
 * done if the connection itself is "dirty", i.e. has a protocol error on it
 * or is otherwise not suitable for reuse
 */
LCB_INTERNAL_API
void connmgr_discard(connmgr_t *mgr, lcb_connection_t conn);


/**
 * Dumps the connection manager state to stderr
 */
LCB_INTERNAL_API
void connmgr_dump(connmgr_t *mgr, FILE *out);

#ifdef __cplusplus
}
#endif
#endif /* LCB_SOCKPOOL_H */
