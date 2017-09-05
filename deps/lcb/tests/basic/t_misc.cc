#include "config.h"
#include "internal.h"
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

TEST_F(MiscTests, testGetTmpdir)
{
    const char *tmpdir = lcb_get_tmpdir();
    ASSERT_FALSE(tmpdir == NULL);
    ASSERT_STRNE("", tmpdir);
}
TEST_F(MiscTests, testVersionG) {
    ASSERT_GT(lcb_version_g, (lcb_U32)0);
}
