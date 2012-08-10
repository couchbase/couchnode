#ifndef LCB_LUV_TEST_H_
#define LCB_LUV_TEST_H_

#include "libcouchbase-libuv.h"
#include "../util/yolog.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

extern uv_loop_t *Loop;
extern uv_prepare_t Prepare;
extern uv_check_t Check;

/**
 * Structure representing a continuation
 */
struct continuation_st;

struct continuation_st {
    libcouchbase_t instance;
    struct lcb_luv_cookie_st *cookie;
    void *data;
    int stop;
    int chain_now;
    int ix;
    struct continuation_st (*cb)(struct continuation_st*);
};

#define STORAGE_CB_PROTOTYPE \
    (libcouchbase_t instance, const void *cookie, \
            libcouchbase_storage_t operation, \
            libcouchbase_error_t error, \
            const void *key, libcouchbase_size_t nkey, \
            libcouchbase_cas_t cas)

#define GET_CB_PROTOTYPE \
    (libcouchbase_t instance, const void *cookie, \
            libcouchbase_error_t error, \
            const void *key, libcouchbase_size_t nkey, \
            const void *bytes, libcouchbase_size_t nbytes, \
            libcouchbase_uint32_t flags, libcouchbase_cas_t cas)

#define DECLARE_CONTINUATION(name) \
    struct continuation_st name(struct continuation_st *cont)

DECLARE_CONTINUATION(t00_contcb_set);


#endif /* LCB_LUV_TEST_H_ */


