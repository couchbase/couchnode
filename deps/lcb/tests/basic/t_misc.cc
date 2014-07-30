#include "config.h"
#include <gtest/gtest.h>
#define LIBCOUCHBASE_INTERNAL 1
#include <libcouchbase/couchbase.h>

class MiscTests : public ::testing::Test
{
};

TEST_F(MiscTests, testSanityCheck)
{
    ASSERT_TRUE(lcb_verify_compiler_setup());
}
