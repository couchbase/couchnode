#ifndef LCB_PKTFWD_H
#define LCB_PKTFWD_H
#ifdef __cplusplus
extern "C" {
#endif

/**
 * @ingroup LCB_PUBAPI
 * @defgroup LCB_PKTFWD Raw packet forwarding and dispatch routines
 * @brief These functions perform packet forwarding functions to send and
 * receive raw packets
 *
 * @addtogroup LCB_PKTFWD
 * @{
 */

/** Request for forwarding a packet */
typedef struct {
    int version;
    lcb_VALBUF vb;
} lcb_CMDPKTFWD;

/**
 * The data received as part of a response buffer is _mapped_ by an lcb_IOV
 * structure, however the actual allocated data is held together by an
 * opaque lcb_BACKBUF structure. This structure allows multiple IOVs to exist
 * concurrently within the same block of allocated memory (with different
 * offsets and sizes). The lcb_BACKBUF structure functions as an opaque
 * reference counted object which controls the duration of the memmory to which
 * the IOV is mapped.
 *
 * From an API perspective, there is a one-to-one correlation between an IOV
 * and an lcb_BACKBUF
 */
typedef struct rdb_ROPESEG *lcb_BACKBUF;

typedef struct {
    /** Version of the response structure */
    int version;
    /** Pointer to an aligned memcached response header (only on success) */
    const lcb_U8 *header;
    /**Array of IOV structures containing the offsets of the buffers. Note that
     * you may modify the contents of the buffers if needed */
    lcb_IOV *iovs;
    /** Opaque buffer objects which contain the actual underlying data */
    lcb_BACKBUF *bufs;
    /** Number of IOVs and buffers */
    unsigned nitems;
} lcb_PKTFWDRESP;

/**
 * Callback invoked when a response packet has arrived for a request
 * @param instance
 * @param cookie Opaque pointer associated with the request
 * @param err If a response packet could not be obtained, this contains the reason
 * @param resp Response structure. This is always present if there is a reply
 * from the server.
 *
 * The lcb_PKTFWDRESP::bufs structures are considered to be invalid after the
 * callback has exited because lcb_backbuf_unref() will be called on each of
 * them. To ensure they remain valid in your application outside the callback,
 * invoke lcb_backbuf_ref() on the required lcb_BACKBUF structures and then
 * once they are no longer needed use lcb_backbuf_unref()
 */
typedef void (*lcb_pktfwd_callback)
        (lcb_t instance, const void *cookie, lcb_error_t err,
                lcb_PKTFWDRESP *resp);

/**
 * Callback invoked when the request buffer for a packet is no longer required.
 * @param instance
 * @param cookie The cookie associated with the request data
 */
typedef void (*lcb_pktflushed_callback)
        (lcb_t instance, const void *cookie);

LIBCOUCHBASE_API
lcb_pktfwd_callback
lcb_set_pktfwd_callback(lcb_t instance, lcb_pktfwd_callback callback);

LIBCOUCHBASE_API
lcb_pktflushed_callback
lcb_set_pktflushed_callback(lcb_t instance, lcb_pktflushed_callback callback);

LIBCOUCHBASE_API
lcb_error_t
lcb_pktfwd3(lcb_t instance, const void *cookie, const lcb_CMDPKTFWD *cmd);

/**
 * Indicate that the lcb_BACKBUF object which provides storage for an IOV's
 * data pointer will need to remain valid until lcb_backbuf_unref() is called.
 *
 * This function may be called from an lcb_pktfwd_callback handler to allow
 * the contents of the buffer to persist outside the specific callback
 * invocation.
 */
LIBCOUCHBASE_API
void
lcb_backbuf_ref(lcb_BACKBUF buf);

/**
 * Indicate that the IOV backed by the specified `buf` is no longer required
 * @param buf the buffer which backs the IOV
 * After the buffer has been unreferenced, the relating IOV may no longer be
 * accessed
 */
LIBCOUCHBASE_API
void
lcb_backbuf_unref(lcb_BACKBUF buf);

#ifdef __cplusplus
}
#endif
#endif
