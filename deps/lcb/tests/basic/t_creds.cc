/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2011-2020 Couchbase, Inc.
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

#include "config.h"
#include "internal.h"
#include "auth-priv.h"
#include <gtest/gtest.h>
#define LIBCOUCHBASE_INTERNAL 1
#include <libcouchbase/couchbase.h>

class CredsTest : public ::testing::Test
{
};

static lcb_INSTANCE *create(const char *connstr = nullptr)
{
    lcb_CREATEOPTS *crst = nullptr;
    lcb_createopts_create(&crst, LCB_TYPE_BUCKET);
    lcb_createopts_connstr(crst, connstr, strlen(connstr));
    lcb_INSTANCE *ret;
    lcb_STATUS rc = lcb_create(&ret, crst);
    lcb_createopts_destroy(crst);
    EXPECT_EQ(LCB_SUCCESS, rc);
    return ret;
}

TEST_F(CredsTest, testLegacyCreds)
{
    lcb_INSTANCE *instance;
    ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance, nullptr));
    lcb::Authenticator &auth = *instance->settings->auth;
    ASSERT_TRUE(auth.username().empty());
    ASSERT_EQ(LCBAUTH_MODE_CLASSIC, auth.mode());

    ASSERT_EQ(1, auth.buckets().size());
    ASSERT_TRUE(auth.buckets().find("default")->second.empty());
    auto credentials =
        auth.credentials_for(LCBAUTH_SERVICE_KEY_VALUE, LCBAUTH_REASON_NEW_OPERATION, nullptr, nullptr, "default");
    ASSERT_EQ("", credentials.password());
    ASSERT_EQ("default", credentials.username());

    // Try to add another user/password:
    lcb_BUCKETCRED creds = {"user2", "pass2"};
    ASSERT_EQ(LCB_SUCCESS, lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_BUCKET_CRED, creds));
    ASSERT_EQ(2, auth.buckets().size());
    ASSERT_EQ("pass2", auth.buckets().find("user2")->second);
    credentials =
        auth.credentials_for(LCBAUTH_SERVICE_KEY_VALUE, LCBAUTH_REASON_NEW_OPERATION, nullptr, nullptr, "user2");
    ASSERT_EQ("user2", credentials.username());
    ASSERT_EQ("pass2", credentials.password());

    ASSERT_TRUE(auth.username().empty());
    ASSERT_TRUE(auth.password().empty());
    lcb_destroy(instance);
}

TEST_F(CredsTest, testRbacCreds)
{
    lcb_INSTANCE *instance = create("couchbase://localhost/default?username=mark");
    lcb::Authenticator &auth = *instance->settings->auth;
    ASSERT_EQ("mark", auth.username());
    ASSERT_EQ(LCBAUTH_MODE_RBAC, auth.mode());
    ASSERT_TRUE(auth.buckets().empty());
    auto credentials =
        auth.credentials_for(LCBAUTH_SERVICE_KEY_VALUE, LCBAUTH_REASON_NEW_OPERATION, nullptr, nullptr, "default");
    ASSERT_EQ("mark", credentials.username());
    ASSERT_EQ("", credentials.password());
    credentials =
        auth.credentials_for(LCBAUTH_SERVICE_KEY_VALUE, LCBAUTH_REASON_NEW_OPERATION, nullptr, nullptr, "jane");
    ASSERT_EQ("mark", credentials.username());
    ASSERT_EQ("", credentials.password());

    // Try adding a new bucket, it should fail
    ASSERT_EQ(LCB_ERR_OPTIONS_CONFLICT, auth.add("users", "secret", LCBAUTH_F_BUCKET));

    // Try using "old-style" auth. It should fail:
    ASSERT_EQ(LCB_ERR_OPTIONS_CONFLICT, auth.add("users", "secret", LCBAUTH_F_BUCKET | LCBAUTH_F_CLUSTER));
    // Username/password should remain unchanged:
    ASSERT_EQ("mark", auth.username());
    ASSERT_EQ("", auth.password());

    // Try *changing* the credentials
    ASSERT_EQ(LCB_SUCCESS, auth.add("jane", "seekrit", LCBAUTH_F_CLUSTER));
    credentials =
        auth.credentials_for(LCBAUTH_SERVICE_KEY_VALUE, LCBAUTH_REASON_NEW_OPERATION, nullptr, nullptr, "default");
    ASSERT_EQ("jane", credentials.username());
    ASSERT_EQ("seekrit", credentials.password());
    lcb_destroy(instance);
}

TEST_F(CredsTest, testSharedAuth)
{
    lcb_INSTANCE *instance1, *instance2;
    ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance1, nullptr));
    ASSERT_EQ(LCB_SUCCESS, lcb_create(&instance2, nullptr));

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
