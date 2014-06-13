#include "internal.h"

int
lcb_should_retry(lcb_settings *settings, mc_PACKET *pkt, lcb_error_t err)
{
    lcb_RETRYCMDOPTS policy;
    lcb_RETRYMODEOPTS mode;
    protocol_binary_request_header hdr;

    if (err == LCB_ETIMEDOUT /* can't exceed */ ||
            err == LCB_MAP_CHANGED /* processed */ ) {
        return 0;
    }

    if (err == LCB_AUTH_ERROR) {
        /* spurious auth error */
        return 1;
    }

    if (LCB_EIFNET(err)) {
        mode = LCB_RETRY_ON_SOCKERR;

    } else if (err == LCB_NOT_MY_VBUCKET) {
        mode = LCB_RETRY_ON_VBMAPERR;
    } else if (err == LCB_MAX_ERROR) {
        /* special, topology change */
        mode = LCB_RETRY_ON_TOPOCHANGE;
    } else {
        /* invalid mode */
        return 0;
    }
    policy = settings->retry[mode];

    if (policy == LCB_RETRY_CMDS_ALL) {
        return 1;
    } else if (policy == LCB_RETRY_CMDS_NONE) {
        return 0;
    }

    /** read the header */
    mcreq_read_hdr(pkt, &hdr);
    switch (hdr.request.opcode) {

    /* get is a safe operation which may be retried */
    case PROTOCOL_BINARY_CMD_GET:
    case PROTOCOL_BINARY_CMD_GETKQ:
        return policy & LCB_RETRY_CMDS_GET;

    case PROTOCOL_BINARY_CMD_ADD:
        return policy & LCB_RETRY_CMDS_SAFE;

    /* mutation operations are retriable so long as they provide a CAS */
    case PROTOCOL_BINARY_CMD_SET:
    case PROTOCOL_BINARY_CMD_REPLACE:
    case PROTOCOL_BINARY_CMD_APPEND:
    case PROTOCOL_BINARY_CMD_PREPEND:
    case PROTOCOL_BINARY_CMD_DELETE:
    case PROTOCOL_BINARY_CMD_UNLOCK_KEY:
        if (hdr.request.cas) {
            return policy & LCB_RETRY_CMDS_SAFE;
        } else {
            return 0;
        }

    /* none of these commands accept a CAS, so they are not safe */
    case PROTOCOL_BINARY_CMD_INCREMENT:
    case PROTOCOL_BINARY_CMD_DECREMENT:
    case PROTOCOL_BINARY_CMD_TOUCH:
    case PROTOCOL_BINARY_CMD_GAT:
    case PROTOCOL_BINARY_CMD_GET_LOCKED:
    default:
        return 0;
    }
}
