#include "mcreq.h"
#include "compress.h"
#include "sllist-inl.h"
#include "internal.h"

#define PKT_HDRSIZE(pkt) (MCREQ_PKT_BASESIZE + (pkt)->extlen)

lcb_error_t
mcreq_reserve_header(
        mc_PIPELINE *pipeline, mc_PACKET *packet, uint8_t hdrsize)
{
    int rv;
    packet->extlen = hdrsize - MCREQ_PKT_BASESIZE;
    packet->kh_span.size = hdrsize;
    rv = netbuf_mblock_reserve(&pipeline->nbmgr, &packet->kh_span);
    if (rv != 0) {
        return LCB_CLIENT_ENOMEM;
    }
    return LCB_SUCCESS;
}

lcb_error_t
mcreq_reserve_key(
        mc_PIPELINE *pipeline, mc_PACKET *packet, uint8_t hdrsize,
        const lcb_KEYBUF *kreq)
{
    const struct lcb_CONTIGBUF *contig = &kreq->contig;
    int rv;

    /** Set the key offset which is the start of the key from the buffer */
    packet->extlen = hdrsize - MCREQ_PKT_BASESIZE;
    packet->kh_span.size = kreq->contig.nbytes;

    if (kreq->type == LCB_KV_COPY) {
        /**
         * If the key is to be copied then just allocate the span size
         * for the key+24+extras
         */
        packet->kh_span.size += hdrsize;
        rv = netbuf_mblock_reserve(&pipeline->nbmgr, &packet->kh_span);
        if (rv != 0) {
            return LCB_CLIENT_ENOMEM;
        }

        /**
         * Copy the key into the packet starting at the extras end
         */
        memcpy(SPAN_BUFFER(&packet->kh_span) + hdrsize,
               contig->bytes,
               contig->nbytes);

    } else {
        /**
         * Don't do any copying.
         * Assume the key buffer has enough space for the packet as well.
         */
        CREATE_STANDALONE_SPAN(&packet->kh_span, contig->bytes, contig->nbytes);
        packet->flags |= MCREQ_F_KEY_NOCOPY;
    }

    return LCB_SUCCESS;
}

lcb_error_t
mcreq_reserve_value2(mc_PIPELINE *pl, mc_PACKET *pkt, lcb_size_t n)
{
    int rv;
    pkt->u_value.single.size = n;
    if (!n) {
        return LCB_SUCCESS;
    }

    pkt->flags |= MCREQ_F_HASVALUE;
    rv = netbuf_mblock_reserve(&pl->nbmgr, &pkt->u_value.single);
    if (rv) {
        return LCB_CLIENT_ENOMEM;
    }
    return LCB_SUCCESS;
}

lcb_error_t
mcreq_reserve_value(
        mc_PIPELINE *pipeline, mc_PACKET *packet, const lcb_VALBUF *vreq)
{
    const lcb_CONTIGBUF *contig = &vreq->u_buf.contig;
    nb_SPAN *vspan = &packet->u_value.single;
    int rv;

    if (vreq->vtype == LCB_KV_COPY) {
        /** Copy the value into a single SPAN */
        if (! (vspan->size = vreq->u_buf.contig.nbytes)) {
            return LCB_SUCCESS;
        }
        rv = netbuf_mblock_reserve(&pipeline->nbmgr, vspan);

        if (rv != 0) {
            return LCB_CLIENT_ENOMEM;
        }

        memcpy(SPAN_BUFFER(vspan), contig->bytes, contig->nbytes);

    } else if (vreq->vtype == LCB_KV_CONTIG) {
        /** It's still contiguous so make it a 'standalone' span */
        CREATE_STANDALONE_SPAN(vspan, contig->bytes, contig->nbytes);
        packet->flags |= MCREQ_F_VALUE_NOCOPY;

    } else {
        /** Multiple spans! */
        unsigned int ii;
        const lcb_FRAGBUF *msrc = &vreq->u_buf.multi;
        lcb_FRAGBUF *mdst = &packet->u_value.multi;

        packet->flags |= MCREQ_F_VALUE_IOV | MCREQ_F_VALUE_NOCOPY;
        mdst->niov = msrc->niov;
        mdst->iov = malloc(mdst->niov * sizeof(*mdst->iov));
        mdst->total_length = 0;

        for (ii = 0; ii < mdst->niov; ii++) {
            mdst->iov[ii] = msrc->iov[ii];
            mdst->total_length += mdst->iov[ii].iov_len;
        }
    }

    packet->flags |= MCREQ_F_HASVALUE;
    return LCB_SUCCESS;
}

static int
pkt_tmo_compar(sllist_node *a, sllist_node *b)
{
    mc_PACKET *pa, *pb;
    hrtime_t tmo_a, tmo_b;

    pa = SLLIST_ITEM(a, mc_PACKET, slnode);
    pb = SLLIST_ITEM(b, mc_PACKET, slnode);

    tmo_a = MCREQ_PKT_RDATA(pa)->start;
    tmo_b = MCREQ_PKT_RDATA(pb)->start;

    if (tmo_a == tmo_b) {
        return 0;
    } else if (tmo_a < tmo_b) {
        return -1;
    } else {
        return 1;
    }
}

void
mcreq_reenqueue_packet(mc_PIPELINE *pipeline, mc_PACKET *packet)
{
    sllist_root *reqs = &pipeline->requests;
    mcreq_enqueue_packet(pipeline, packet);
    sllist_remove(reqs, &packet->slnode);
    sllist_insert_sorted(reqs, &packet->slnode, pkt_tmo_compar);
}

void
mcreq_enqueue_packet(mc_PIPELINE *pipeline, mc_PACKET *packet)
{
    nb_SPAN *vspan = &packet->u_value.single;
    sllist_append(&pipeline->requests, &packet->slnode);
    netbuf_enqueue_span(&pipeline->nbmgr, &packet->kh_span);

    if (!(packet->flags & MCREQ_F_HASVALUE)) {
        goto GT_ENQUEUE_PDU;
    }

    if (packet->flags & MCREQ_F_VALUE_IOV) {
        unsigned int ii;
        lcb_FRAGBUF *multi = &packet->u_value.multi;
        for (ii = 0; ii < multi->niov; ii++) {
            netbuf_enqueue(&pipeline->nbmgr, (nb_IOV *)multi->iov + ii);
        }

    } else if (vspan->size) {
        netbuf_enqueue_span(&pipeline->nbmgr, vspan);
    }

    GT_ENQUEUE_PDU:
    netbuf_pdu_enqueue(&pipeline->nbmgr, packet, offsetof(mc_PACKET, sl_flushq));
}

void
mcreq_wipe_packet(mc_PIPELINE *pipeline, mc_PACKET *packet)
{
    if (! (packet->flags & MCREQ_F_KEY_NOCOPY)) {
        if (packet->flags & MCREQ_F_DETACHED) {
            free(SPAN_BUFFER(&packet->kh_span));
        } else {
            netbuf_mblock_release(&pipeline->nbmgr, &packet->kh_span);
        }
    }

    if (! (packet->flags & MCREQ_F_HASVALUE)) {
        return;
    }

    if (packet->flags & MCREQ_F_VALUE_NOCOPY) {
        if (packet->flags & MCREQ_F_VALUE_IOV) {
            free(packet->u_value.multi.iov);
        }

        return;
    }

    if (packet->flags & MCREQ_F_DETACHED) {
        free(SPAN_BUFFER(&packet->u_value.single));
    } else {
        netbuf_mblock_release(&pipeline->nbmgr, &packet->u_value.single);
    }

}

mc_PACKET *
mcreq_allocate_packet(mc_PIPELINE *pipeline)
{
    nb_SPAN span;
    int rv;
    mc_PACKET *ret;
    span.size = sizeof(*ret);

    rv = netbuf_mblock_reserve(&pipeline->reqpool, &span);
    if (rv != 0) {
        return NULL;
    }

    ret = (void *) SPAN_MBUFFER_NC(&span);
    ret->alloc_parent = span.parent;
    ret->flags = 0;
    ret->retries = 0;
    ret->opaque = pipeline->parent->seq++;
    return ret;
}

void
mcreq_release_packet(mc_PIPELINE *pipeline, mc_PACKET *packet)
{
    nb_SPAN span;
    if (packet->flags & MCREQ_F_DETACHED) {
        free(packet);
        return;
    }

    span.size = sizeof(*packet);
    span.parent = packet->alloc_parent;
    span.offset = (char *)packet - packet->alloc_parent->root;

    netbuf_mblock_release(&pipeline->reqpool, &span);
}

#define MCREQ_DETACH_WIPESRC 1

mc_PACKET *
mcreq_dup_packet(const mc_PACKET *src)
{
    char *kdata, *vdata;
    unsigned nvdata;

    mc_PACKET *dst = calloc(1, sizeof (*dst));
    *dst = *src;

    kdata = malloc(src->kh_span.size);
    memcpy(kdata, SPAN_BUFFER(&src->kh_span), src->kh_span.size);
    CREATE_STANDALONE_SPAN(&dst->kh_span, kdata, src->kh_span.size);

    dst->flags &= ~(MCREQ_F_KEY_NOCOPY|MCREQ_F_VALUE_NOCOPY|MCREQ_F_VALUE_IOV);
    dst->flags |= MCREQ_F_DETACHED;
    dst->alloc_parent = NULL;
    dst->sl_flushq.next = NULL;
    dst->slnode.next = NULL;
    dst->retries = src->retries;

    if (src->flags & MCREQ_F_HASVALUE) {
        /** Get the length */
        if (src->flags & MCREQ_F_VALUE_IOV) {
            unsigned ii;
            unsigned offset = 0;

            nvdata = src->u_value.multi.total_length;
            vdata = malloc(nvdata);
            for (ii = 0; ii < src->u_value.multi.niov; ii++) {
                const lcb_IOV *iov = src->u_value.multi.iov + ii;

                memcpy(vdata + offset, iov->iov_base, iov->iov_len);
                offset += iov->iov_len;
            }
        } else {
            protocol_binary_request_header hdr;
            const nb_SPAN *origspan = &src->u_value.single;
            mcreq_read_hdr(dst, &hdr);

            if (hdr.request.datatype & PROTOCOL_BINARY_DATATYPE_COMPRESSED) {
                /* For compressed payloads we need to uncompress it first
                 * because it may be forwarded to a server without compression.
                 * TODO: might be more clever to check a setting flag somewhere
                 * and see if we should do this. */

                lcb_SIZE n_inflated;
                const void *inflated;
                int rv;

                vdata = NULL;
                rv = mcreq_inflate_value(SPAN_BUFFER(origspan), origspan->size,
                    &inflated, &n_inflated, (void**)&vdata);

                assert(vdata == inflated);

                if (rv != 0) {
                    return NULL;
                }
                nvdata = n_inflated;
                hdr.request.datatype &= ~PROTOCOL_BINARY_DATATYPE_COMPRESSED;
                hdr.request.bodylen = htonl(
                    ntohs(hdr.request.keylen) +
                    hdr.request.extlen +
                    n_inflated);
                mcreq_write_hdr(dst, &hdr);

            } else {
                nvdata = origspan->size;
                vdata = malloc(nvdata);
                memcpy(vdata, SPAN_BUFFER(origspan), nvdata);
            }
        }

        /* Declare the value as a standalone malloc'd span */
        CREATE_STANDALONE_SPAN(&dst->u_value.single, vdata, nvdata);
    }
    return dst;
}

void
mcreq_extract_hashkey(
        const lcb_KEYBUF *key, const lcb_KEYBUF *hashkey,
        lcb_size_t nheader, const void **target, lcb_size_t *ntarget)
{
    if (hashkey->contig.bytes != NULL) {
        *target = hashkey->contig.bytes;
        *ntarget = hashkey->contig.nbytes;
        return;
    }

    if (key->type == LCB_KV_COPY) {
        *target = key->contig.bytes;
        *ntarget = key->contig.nbytes;
    } else {
        const char *buf = key->contig.bytes;
        buf += nheader;
        *target = buf;
        *ntarget = key->contig.nbytes - nheader;
    }
}

lcb_error_t
mcreq_basic_packet(
        mc_CMDQUEUE *queue, const lcb_CMDBASE *cmd,
        protocol_binary_request_header *req, lcb_uint8_t extlen,
        mc_PACKET **packet, mc_PIPELINE **pipeline)
{
    const void *hashkey;
    lcb_size_t nhashkey;
    int vb, srvix;

    if (!queue->config) {
        return LCB_CLIENT_ETMPFAIL;
    }

    mcreq_extract_hashkey(&cmd->key, &cmd->hashkey,
                          sizeof(*req) + extlen, &hashkey, &nhashkey);

    vbucket_map(queue->config, hashkey, nhashkey, &vb, &srvix);
    if (srvix < 0 || (unsigned)srvix >= queue->npipelines) {
        return LCB_NO_MATCHING_SERVER;
    }

    *pipeline = queue->pipelines[srvix];
    *packet = mcreq_allocate_packet(*pipeline);

    mcreq_reserve_key(*pipeline, *packet, sizeof(*req) + extlen, &cmd->key);

    req->request.keylen = htons((*packet)->kh_span.size - PKT_HDRSIZE(*packet));
    req->request.vbucket = htons(vb);
    req->request.extlen = extlen;
    return LCB_SUCCESS;
}

void
mcreq_get_key(const mc_PACKET *packet, const void **key, lcb_size_t *nkey)
{
    *key = SPAN_BUFFER(&packet->kh_span) + PKT_HDRSIZE(packet);
    *nkey = packet->kh_span.size - PKT_HDRSIZE(packet);
}

lcb_uint32_t
mcreq_get_bodysize(const mc_PACKET *packet)
{
    lcb_uint32_t ret;
    char *retptr = SPAN_BUFFER(&packet->kh_span) + 8;
    if ((uintptr_t)retptr % sizeof(ret) == 0) {
        return ntohl(*(lcb_uint32_t*) (void *)retptr);
    } else {
        memcpy(&ret, retptr, sizeof(ret));
        return ntohl(ret);
    }
}

void
mcreq_pipeline_cleanup(mc_PIPELINE *pipeline)
{
    netbuf_cleanup(&pipeline->nbmgr);
    netbuf_cleanup(&pipeline->reqpool);
}

int
mcreq_pipeline_init(mc_PIPELINE *pipeline)
{
    nb_SETTINGS settings;
    netbuf_default_settings(&settings);

    /** Initialize datapool */
    netbuf_init(&pipeline->nbmgr, &settings);

    /** Initialize request pool */
    settings.data_basealloc = sizeof(mc_PACKET) * 32;
    netbuf_init(&pipeline->reqpool, &settings);
    return 0;
}

void
mcreq_queue_add_pipelines(
        mc_CMDQUEUE *queue, mc_PIPELINE **pipelines, unsigned npipelines,
        VBUCKET_CONFIG_HANDLE config)
{
    unsigned ii;

    lcb_assert(queue->pipelines == NULL);
    queue->npipelines = npipelines;
    queue->pipelines = pipelines;
    queue->config = config;

    free(queue->scheds);
    queue->scheds = calloc(npipelines, 1);

    for (ii = 0; ii < npipelines; ii++) {
        pipelines[ii]->parent = queue;
        pipelines[ii]->index = ii;
    }
}

mc_PIPELINE **
mcreq_queue_take_pipelines(mc_CMDQUEUE *queue, unsigned *count)
{
    mc_PIPELINE **ret = queue->pipelines;
    *count = queue->npipelines;
    queue->pipelines = NULL;
    queue->npipelines = 0;
    return ret;
}

int
mcreq_queue_init(mc_CMDQUEUE *queue)
{
    queue->seq = 0;
    queue->pipelines = NULL;
    queue->scheds = NULL;
    queue->npipelines = 0;
    queue->nremaining = 0;
    return 0;
}

void
mcreq_queue_cleanup(mc_CMDQUEUE *queue)
{
    free(queue->scheds);
    free(queue->pipelines);
    queue->scheds = NULL;
}

void
mcreq_sched_enter(mc_CMDQUEUE *queue)
{
    (void)queue;
}

static void
queuectx_leave(mc_CMDQUEUE *queue, int success, int flush)
{
    unsigned ii;
    for (ii = 0; ii < queue->npipelines; ii++) {
        mc_PIPELINE *pipeline;
        sllist_node *ll_next, *ll;

        if (!queue->scheds[ii]) {
            continue;
        }

        pipeline = queue->pipelines[ii];
        ll = pipeline->ctxqueued.first;

        while (ll) {
            mc_PACKET *pkt = SLLIST_ITEM(ll, mc_PACKET, slnode);
            ll_next = ll->next;

            if (success) {
                mcreq_enqueue_packet(pipeline, pkt);
            } else {
                mcreq_wipe_packet(pipeline, pkt);
                mcreq_release_packet(pipeline, pkt);
            }

            ll = ll_next;
        }
        pipeline->ctxqueued.first = pipeline->ctxqueued.last = NULL;
        if (flush) {
            pipeline->flush_start(pipeline);
        }
        queue->scheds[ii] = 0;
    }
}

void
mcreq_sched_leave(mc_CMDQUEUE *queue, int do_flush)
{
    queuectx_leave(queue, 1, do_flush);
}

void
mcreq_sched_fail(mc_CMDQUEUE *queue)
{
    queuectx_leave(queue, 0, 0);
}

void
mcreq_sched_add(mc_PIPELINE *pipeline, mc_PACKET *pkt)
{
    mc_CMDQUEUE *cq = pipeline->parent;
    if (!cq->scheds[pipeline->index]) {
        cq->scheds[pipeline->index] = 1;
    }
    sllist_append(&pipeline->ctxqueued, &pkt->slnode);
}

static mc_PACKET *
pipeline_find(mc_PIPELINE *pipeline, lcb_uint32_t opaque, int do_remove)
{
    sllist_iterator iter;
    SLLIST_ITERFOR(&pipeline->requests, &iter) {
        mc_PACKET *pkt = SLLIST_ITEM(iter.cur, mc_PACKET, slnode);
        if (pkt->opaque == opaque) {
            if (do_remove) {
                sllist_iter_remove(&pipeline->requests, &iter);
            }
            return pkt;
        }
    }
    return NULL;
}

mc_PACKET *
mcreq_pipeline_find(mc_PIPELINE *pipeline, lcb_uint32_t opaque)
{
    return pipeline_find(pipeline, opaque, 0);
}

mc_PACKET *
mcreq_pipeline_remove(mc_PIPELINE *pipeline, lcb_uint32_t opaque)
{
    return pipeline_find(pipeline, opaque, 1);
}

void
mcreq_packet_done(mc_PIPELINE *pipeline, mc_PACKET *pkt)
{
    assert(pkt->flags & MCREQ_F_FLUSHED);
    assert(pkt->flags & MCREQ_F_INVOKED);
    if (pkt->flags & MCREQ_UBUF_FLAGS) {
        void *kbuf, *vbuf;
        const void *cookie;

        cookie = MCREQ_PKT_COOKIE(pkt);
        if (pkt->flags & MCREQ_F_KEY_NOCOPY) {
            kbuf = SPAN_BUFFER(&pkt->kh_span);
        } else {
            kbuf = NULL;
        }
        if (pkt->flags & MCREQ_F_VALUE_NOCOPY) {
            if (pkt->flags & MCREQ_F_VALUE_IOV) {
                vbuf = pkt->u_value.multi.iov->iov_base;
            } else {
                vbuf = SPAN_SABUFFER_NC(&pkt->u_value.single);
            }
        } else {
            vbuf = NULL;
        }

        pipeline->buf_done_callback(pipeline, cookie, kbuf, vbuf);
    }
    mcreq_wipe_packet(pipeline, pkt);
    mcreq_release_packet(pipeline, pkt);
}

unsigned
mcreq_pipeline_timeout(
        mc_PIPELINE *pl, lcb_error_t err, mcreq_pktfail_fn failcb, void *cbarg,
        hrtime_t oldest_valid, hrtime_t *oldest_start)
{
    sllist_iterator iter;
    unsigned count = 0;

    SLLIST_ITERFOR(&pl->requests, &iter) {
        mc_PACKET *pkt = SLLIST_ITEM(iter.cur, mc_PACKET, slnode);
        mc_REQDATA *rd = MCREQ_PKT_RDATA(pkt);

        /**
         * oldest_valid contains the LOWEST timestamp we can admit to being
         * acceptable. If the current command is newer (i.e. has a higher
         * timestamp) then we break the iteration and return.
         */
        if (oldest_valid && rd->start > oldest_valid) {
            if (oldest_start) {
                *oldest_start = rd->start;
            }
            return count;
        }

        sllist_iter_remove(&pl->requests, &iter);
        failcb(pl, pkt, err, cbarg);
        mcreq_packet_handled(pl, pkt);
        count++;
    }
    return count;
}

unsigned
mcreq_pipeline_fail(
        mc_PIPELINE *pl, lcb_error_t err, mcreq_pktfail_fn failcb, void *arg)
{
    return mcreq_pipeline_timeout(pl, err, failcb, arg, 0, NULL);
}

void
mcreq_iterwipe(mc_CMDQUEUE *queue, mc_PIPELINE *src,
               mcreq_iterwipe_fn callback, void *arg)
{
    sllist_iterator iter;

    SLLIST_ITERFOR(&src->requests, &iter) {
        int rv;
        mc_PACKET *orig = SLLIST_ITEM(iter.cur, mc_PACKET, slnode);
        rv = callback(queue, src, orig, arg);
        if (rv == MCREQ_REMOVE_PACKET) {
            sllist_iter_remove(&src->requests, &iter);
        }
    }
}

void
mcreq_dump_packet(const mc_PACKET *packet)
{
    const char *indent = "  ";
    const mc_REQDATA *rdata = MCREQ_PKT_RDATA(packet);

    printf("Packet @%p\n", (void *)packet);
    printf("%sOPAQUE: %u\n", indent, (unsigned int)packet->opaque);
    printf("%sPKTFLAGS: 0x%x\n", indent, packet->flags);
    printf("%sKey+Header Size: %u\n", indent, (unsigned int)packet->kh_span.size);
    printf("%sKey Offset: %u\n", indent, MCREQ_PKT_BASESIZE + packet->extlen);

    if (packet->flags & MCREQ_F_HASVALUE) {
        if (packet->flags & MCREQ_F_VALUE_IOV) {
            printf("%sValue Length: %u\n", indent,
                   packet->u_value.multi.total_length);

            printf("%sValue IOV: [start=%p, n=%d]\n",
                   indent,
                   (void *)packet->u_value.multi.iov,
                   packet->u_value.multi.niov);
        } else {
            if (packet->flags & MCREQ_F_VALUE_NOCOPY) {
                printf("%sValue is user allocated\n", indent);
            }
            printf("%sValue: %p, %u bytes\n",
                   indent,
                   SPAN_BUFFER(&packet->u_value.single),
                   packet->u_value.single.size);
        }
    }

    printf("%sRDATA(%s): %p\n", indent,
           (packet->flags & MCREQ_F_REQEXT) ? "ALLOC" : "EMBEDDED",
                   (void *)rdata);

    indent = "    ";
    printf("%sStart: %lu\n", indent, (unsigned long)rdata->start);
    printf("%sCookie: %p\n", indent, rdata->cookie);

    indent = "  ";
    printf("%sNEXT: %p\n", indent, (void *)packet->slnode.next);
}

void
mcreq_dump_chain(const mc_PIPELINE *pipeline)
{
    sllist_node *ll;
    SLLIST_FOREACH(&pipeline->requests, ll) {
        const mc_PACKET *pkt = SLLIST_ITEM(ll, mc_PACKET, slnode);
        mcreq_dump_packet(pkt);
    }
}
