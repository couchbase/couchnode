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

#ifndef LCB_PACKETUTILS_H
#define LCB_PACKETUTILS_H

#include <libcouchbase/couchbase.h>
#include "ringbuffer.h"
#include "rdb/rope.h"
#include "memcached/protocol_binary.h"

#ifdef __cplusplus
extern "C" {
#endif
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
    /** Segment for payload */
    void *bufh;
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
#define PACKET_CAS(pkt) lcb_ntohll((pkt)->res.response.cas)

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

/**
 * Read from an 'IOR' structure to parse the packet information. This will
 * always load a full packet.
 *
 * @param info the info structure to populate
 * @param ior the rope structure to read from
 * @param[out] required how much total bytes must remain in the buffer for the
 *  parse to complete.
 *
 * @return zero if more data is needed, a true value otherwise
 */
int
lcb_pktinfo_ior_get(packet_info *info, rdb_IOROPE *ior, unsigned *required);

void
lcb_pktinfo_ior_done(packet_info *info, rdb_IOROPE *ior);

#define lcb_pktinfo_ectx_get(info, ctx, n) lcb_pktinfo_ior_get(info, &(ctx)->ior, n)
#define lcb_pktinfo_ectx_done(info, ctx) lcb_pktinfo_ior_done(info, &(ctx)->ior)



#ifdef __cplusplus
}
#endif

#endif
