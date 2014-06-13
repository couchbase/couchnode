#include "mcreq.h"
#ifndef LCB_MCCOMPRESS_H
#define LCB_MCCOMPRESS_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Stores a compressed payload into a packet
 * @param pl The pipeline which hosts the packet
 * @param pkt The packet which hosts the value
 * @param vbuf The user input to be compressed
 * @return 0 if successful, nonzero on error.
 */
int
mcreq_compress_value(mc_PIPELINE *pl, mc_PACKET *pkt, const lcb_CONTIGBUF *vbuf);


/**
 * Inflate a compressed value
 * @param compressed The value to inflate
 * @param ncompressed Size of value to inflate
 * @param[out] bytes The inflated value
 * @param[out] nbytes The size of the inflated value
 * @param[in/out] freeptr Pointer initialized to NULL (or an malloc'd buffer)
 * which on output should point to a malloc'd buffer to be freed() when no
 * longer required.
 * @return 0 if successful, nonzero on error.
 */
int
mcreq_inflate_value(const void *compressed, lcb_SIZE ncompressed,
    const void **bytes, lcb_SIZE *nbytes, void **freeptr);

#ifndef LCB_NO_SNAPPY
#define mcreq_compression_supported() 1
#else
#define mcreq_compression_supported() 0
#endif

#ifdef __cplusplus
}
#endif
#endif
