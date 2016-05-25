#include "config.h"
#include "internal.h"
#include "auth.h"
#include <gtest/gtest.h>
#define LIBCOUCHBASE_INTERNAL 1
#include <libcouchbase/couchbase.h>

class CredsTest : public ::testing::Test
{
};

TEST_F(CredsTest, testCreds)
{
    lcb_t instance;
    lcb_BUCKETCRED cred;
    ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance, NULL));
    lcb::Authenticator& auth = *instance->settings->auth;
    ASSERT_FALSE(auth.m_username.empty());
    ASSERT_EQ("default", auth.m_username);

    ASSERT_EQ(1, auth.buckets().size());
    ASSERT_TRUE(auth.buckets().find("default")->second.empty());

    // Try to add another user/password:
    lcb_BUCKETCRED creds = { "user2", "pass2" };
    ASSERT_EQ(LCB_SUCCESS, lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_BUCKET_CRED, creds));
    ASSERT_EQ(2, auth.buckets().size());
    ASSERT_EQ("pass2", auth.buckets().find("user2")->second);
    ASSERT_EQ("default", auth.m_username);
    ASSERT_EQ("", auth.m_password);
    lcb_destroy(instance);
}
