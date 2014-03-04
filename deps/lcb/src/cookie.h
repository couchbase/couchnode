#ifndef LCB_COOKIE_H
#define LCB_COOKIE_H

#include "config.h"

/**
 * Data stored per command in the command-cookie buffer...
 */
struct lcb_command_data_st {
    hrtime_t start;
    const void *cookie;
    hrtime_t real_start;
    lcb_uint16_t vbucket;
    /* if != -1, it means that we are sequentially iterating
     * through the all replicas until first successful response */
    char replica;
    /** Flags used for observe */
    unsigned char flags;
};

struct lcb_observe_exdata_st {
    lcb_uint32_t refcount;
};

#endif
