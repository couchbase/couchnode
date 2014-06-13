#include "packetutils.h"
#include "rdb/rope.h"

#ifndef _WIN32 /* for win32 this is inside winsock, included in sysdefs.h */
#include <arpa/inet.h>
#endif

int
lcb_pktinfo_ior_get(packet_info *info, rdb_IOROPE *ior, unsigned *required)
{
    unsigned total = rdb_get_nused(ior);
    unsigned wanted = sizeof(info->res.bytes);

    if (total < wanted) {
        *required = wanted;
        return 0;
    }

    rdb_copyread(ior, info->res.bytes, sizeof(info->res.bytes));
    if (!PACKET_NBODY(info)) {
        rdb_consumed(ior, sizeof(info->res.bytes));
        return 1;
    }

    wanted += PACKET_NBODY(info);
    if (total < wanted) {
        *required = wanted;
        return 0;
    }

    rdb_consumed(ior, sizeof(info->res.bytes));
    info->payload = rdb_get_consolidated(ior, PACKET_NBODY(info));
    return 1;
}

void
lcb_pktinfo_ior_done(packet_info *info, rdb_IOROPE *ior)
{
    if (!PACKET_NBODY(info)) {
        return;
    }
    rdb_consumed(ior, PACKET_NBODY(info));
}
