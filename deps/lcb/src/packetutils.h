#ifndef LCB_PACKETUTILS_H
#define LCB_PACKETUTILS_H

#ifdef __cplusplus
extern "C" {
#endif

#include <libcouchbase/couchbase.h>
#include "cookie.h"
#include "ringbuffer.h"
#include "memcached/protocol_binary.h"

/**
 * Response packet informational structure.
 *
 * This contains information regarding the response packet which is used by
 * the response processors.
 */
typedef struct packet_info_st {
    /** The response header */
    protocol_binary_response_header res;
    /** The payload of the response. This should only be used if there is a body */
    void *payload;
    struct lcb_command_data_st ct;
    int is_allocated;
} packet_info;

/**
 * Gets the size of the _total_ non-header part of the packet. This data is
 * also featured inside the payload field itself.
 */
#define PACKET_NBODY(pkt) (ntohl((pkt)->res.response.bodylen))

#define PACKET_BODY(pkt) (pkt)->payload

/**
 * Gets the key size, if included in the packet.
 */
#define PACKET_NKEY(pkt) (ntohs((pkt)->res.response.keylen))

/**
 * Gets the status of the packet
 */
#define PACKET_STATUS(pkt) (ntohs((pkt)->res.response.status))

/**
 * Gets the length of the 'extras' in the body
 */
#define PACKET_EXTLEN(pkt) ((pkt)->res.response.extlen)

/**
 * Gets the raw unconverted 'opaque' 32 bit field
 */
#define PACKET_OPAQUE(pkt) ((pkt)->res.response.opaque)

/**
 * Gets the command for the packet
 */
#define PACKET_OPCODE(pkt) ((pkt)->res.response.opcode)

/**
 * Gets the CAS for the packet
 */
#define PACKET_CAS(pkt) ((pkt)->res.response.cas)

/**
 * Gets the 'datatype' field for the packet.
 */
#define PACKET_DATATYPE(pkt) ((pkt)->res.response.datatype)

/**
 * Gets a pointer starting at the packet's key field. Only use if NKEY is 0
 */
#define PACKET_KEY(pkt) \
    ( ((const char *)(pkt)->payload) + PACKET_EXTLEN(pkt))

#define PACKET_REQUEST(pkt) \
    ( (protocol_binary_request_header *) &(pkt)->res)

#define PACKET_REQ_VBID(pkt) \
    (ntohs(PACKET_REQUEST(pkt)->request.vbucket))

/**
 * Gets a pointer starting at the packet's value field. Only use if NVALUE is 0
 */
#define PACKET_VALUE(pkt) \
    ( ((const char *) (pkt)->payload) + PACKET_NKEY(pkt) + PACKET_EXTLEN(pkt))

/**
 * Gets the size of the packet value. The value is the part of the payload
 * which is after the key (if applicable) and extras (if applicable).
 */
#define PACKET_NVALUE(pkt) \
    (PACKET_NBODY(pkt) - (PACKET_NKEY(pkt) + PACKET_EXTLEN(pkt)))


/**
 * Map a command 'subclass' so that its body field starts at the payload. Note
 * that the return value is actually an ephemeral pointer starting 24 bytes
 * _before_ the actual memory block, so only use the non-header part.
 */
#define PACKET_EPHEMERAL_START(pkt) \
    (const void *)(( ((const char *)(pkt)->payload) - 24 ))

#define PACKET_TRACE(tgt, info, rc, resp) \
    tgt(PACKET_OPAQUE(info), \
        (info)->ct.vbucket, \
        PACKET_OPCODE(info), \
        rc, \
        resp)

#define PACKET_TRACE_NORES(tgt, info, rc) \
    tgt(PACKET_OPAQUE(info), \
        (info)->ct.vbucket, \
        PACKET_OPCODE(info), \
        rc)

/**
 * Reads the header of the packet.
 * @param info a new info structure to read info
 * @param src the ringbuffer containing the buffer
 * @return 0 if not enough data, 1 if read successfully, -1 on error.
 *
 * Note that the ringbuffer itself should *not* be accessed or modified until
 * after release_ringbuffer has been called.
 */
int lcb_packet_read_ringbuffer(packet_info *info, ringbuffer_t *src);

/**
 * Release any resources allocated via the packet structure.
 *
 * This will advance the ringbuffer position as well.
 */
void lcb_packet_release_ringbuffer(packet_info *info, ringbuffer_t *src);

#ifdef __cplusplus
}
#endif

#endif
