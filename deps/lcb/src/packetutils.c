#include "packetutils.h"
#include "config.h"

int lcb_packet_read_ringbuffer(packet_info *info, ringbuffer_t *src)
{
    if (src->nbytes < sizeof(info->res.bytes)) {
        /** Not enough information */
        return 0;
    }

    if (ringbuffer_ensure_alignment(src)) {
        return -1;
    }

    /** We have at the very least, a header */
    ringbuffer_peek(src, (void *)info->res.bytes, sizeof(info->res.bytes));

    if (!PACKET_NBODY(info)) {
        /** There's no body to read, so just succeed */
        ringbuffer_consumed(src, sizeof(info->res.bytes));
        return 1;
    }

    if (src->nbytes < PACKET_NBODY(info) + sizeof(info->res.bytes)) {
        return 0;
    }

    ringbuffer_consumed(src, sizeof(info->res.bytes));

    if (ringbuffer_is_continous(src, RINGBUFFER_READ, PACKET_NBODY(info))) {
        info->payload = src->read_head;
        info->is_allocated = 0;

    } else {
        info->payload = malloc(PACKET_NBODY(info));
        if (!info->payload) {
            return -1;
        }

        info->is_allocated = 1;
        ringbuffer_peek(src, info->payload, PACKET_NBODY(info));
    }

    return 1;
}

void lcb_packet_release_ringbuffer(packet_info *info, ringbuffer_t *src)
{
    lcb_size_t bodylen;

    if (!PACKET_NBODY(info)) {
        return;
    }

    ringbuffer_consumed(src, PACKET_NBODY(info));

    if (info->is_allocated) {
        free(info->payload);
    }

    info->payload = NULL;

    bodylen = ntohl(info->res.response.bodylen);
    if (!bodylen) {
        return;
    }

    if (info->is_allocated) {
        free(info->payload);
    }
    info->payload = NULL;
}
