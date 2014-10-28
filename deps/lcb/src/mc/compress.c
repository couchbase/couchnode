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

#include "mcreq.h"
#include "compress.h"

#ifndef LCB_NO_SNAPPY
#include <contrib/snappy/snappy-c.h>
#endif

int
mcreq_compress_value(mc_PIPELINE *pl, mc_PACKET *pkt, const lcb_CONTIGBUF *vbuf)
{
#ifdef LCB_NO_SNAPPY
    (void)pl;(void)pkt;(void)vbuf;return -1;
#else
    /* get the desired size */
    size_t maxsize, compsize;
    snappy_status status;
    nb_SPAN *outspan;

    compsize = maxsize = snappy_max_compressed_length(vbuf->nbytes);
    if (mcreq_reserve_value2(pl, pkt, maxsize) != LCB_SUCCESS) {
        return -1;
    }

    outspan = &pkt->u_value.single;
    status = snappy_compress(vbuf->bytes, vbuf->nbytes,
        SPAN_BUFFER(outspan), &compsize);

    if (status != SNAPPY_OK) {
        return -1;
    }

    if (compsize < maxsize) {
        /* chop off some bytes? */
        nb_SPAN trailspan = *outspan;
        trailspan.offset += compsize;
        trailspan.size = maxsize - compsize;
        netbuf_mblock_release(&pl->nbmgr, &trailspan);
        outspan->size = compsize;
    }
    return 0;
#endif
}

int
mcreq_inflate_value(const void *compressed, lcb_SIZE ncompressed,
    const void **bytes, lcb_SIZE *nbytes, void **freeptr)
{
#ifdef LCB_NO_SNAPPY
    (void)compressed;(void)ncompressed;(void)bytes;(void)nbytes;(void)freeptr;
    return -1;
#else
    lcb_SIZE cursize, compsize;
    snappy_status status;
    cursize = ncompressed;
    do {
        cursize *= 2;
        *freeptr = realloc(*freeptr, cursize);
        compsize = cursize;
        status = snappy_uncompress(compressed, ncompressed, *freeptr, &compsize);
    } while (status == SNAPPY_BUFFER_TOO_SMALL);

    if (status != SNAPPY_OK) {
        /* TODO: return an error here */
        free(*freeptr);
        *freeptr = NULL;
        return -1;
    }

    *bytes = *freeptr;
    *nbytes = compsize;
    return 0;
#endif
}
