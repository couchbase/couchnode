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
