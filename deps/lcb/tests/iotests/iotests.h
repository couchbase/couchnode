#include <libcouchbase/couchbase.h>
#include <libcouchbase/api3.h>
#include <gtest/gtest.h>
#include <mocksupport/server.h>
#include "testutil.h"
#include "mock-unit-test.h"
#include "mock-environment.h"

static inline void
doLcbCreate(lcb_t *instance, const lcb_create_st *options, MockEnvironment* env)
{
    lcb_error_t err = lcb_create(instance, options);
    ASSERT_EQ(LCB_SUCCESS, err);
    env->postCreate(*instance);
}
