#include "config.h"
#include "internal.h"
#include "auth-priv.h"
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
    ASSERT_FALSE(auth.username().empty());
    ASSERT_EQ("default", auth.username());

    ASSERT_EQ(1, auth.buckets().size());
    ASSERT_TRUE(auth.buckets().find("default")->second.empty());

    // Try to add another user/password:
    lcb_BUCKETCRED creds = { "user2", "pass2" };
    ASSERT_EQ(LCB_SUCCESS, lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_BUCKET_CRED, creds));
    ASSERT_EQ(2, auth.buckets().size());
    ASSERT_EQ("pass2", auth.buckets().find("user2")->second);
    ASSERT_EQ("default", auth.username());
    ASSERT_EQ("", auth.password());
    lcb_destroy(instance);
}

TEST_F(CredsTest, testSharedAuth)
{
    lcb_t instance1, instance2;
    ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance1, NULL));
    ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance2, NULL));

    lcb_AUTHENTICATOR *auth = lcbauth_new();
    ASSERT_EQ(1, auth->refcount());

    lcb_set_auth(instance1, auth);
    ASSERT_EQ(2, auth->refcount());

    lcb_set_auth(instance2, auth);
    ASSERT_EQ(3, auth->refcount());

    ASSERT_EQ(instance1->settings->auth, instance2->settings->auth);
    lcb_destroy(instance1);
    lcb_destroy(instance2);
    ASSERT_EQ(1, auth->refcount());
    lcbauth_unref(auth);
}
