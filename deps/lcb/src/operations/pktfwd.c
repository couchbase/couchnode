#include <libcouchbase/couchbase.h>
#include <libcouchbase/pktfwd.h>
#include "mc/mcreq.h"
#include "mc/forward.h"
#include "internal.h"
#include "rdb/rope.h"

LIBCOUCHBASE_API
lcb_error_t
lcb_pktfwd3(lcb_t instance, const void *cookie, const lcb_CMDPKTFWD *cmd)
{
    int fwdopts = 0;
    mc_PIPELINE *pl;
    mc_PACKET *packet;
    nb_IOV *iov, iov_s;
    unsigned niov;
    mc_IOVINFO ioi = { { 0 } };
    lcb_error_t err;


    if (cmd->vb.vtype != LCB_KV_IOV) {
        iov_s.iov_base = (void *)cmd->vb.u_buf.contig.bytes;
        iov_s.iov_len = cmd->vb.u_buf.contig.nbytes;
        iov = &iov_s;
        niov = 1;

        if (cmd->vb.vtype == LCB_KV_COPY) {
            fwdopts = MC_FWD_OPT_COPY;
        }
    } else {
        iov = (nb_IOV*)cmd->vb.u_buf.multi.iov;
        niov = cmd->vb.u_buf.multi.niov;
        ioi.total = cmd->vb.u_buf.multi.total_length;
    }
    mc_iovinfo_init(&ioi, iov, niov);

    err = mc_forward_packet(&instance->cmdq, &ioi, &packet, &pl, fwdopts);
    if (err != LCB_SUCCESS) {
        return err;
    }

    /* set the cookie */
    packet->u_rdata.reqdata.cookie = cookie;
    packet->u_rdata.reqdata.start = gethrtime();
    return err;
}

LIBCOUCHBASE_API
void
lcb_backbuf_ref(lcb_BACKBUF buf)
{
    rdb_seg_ref(buf);
}

LIBCOUCHBASE_API
void
lcb_backbuf_unref(lcb_BACKBUF buf)
{
    rdb_seg_unref(buf);
}
