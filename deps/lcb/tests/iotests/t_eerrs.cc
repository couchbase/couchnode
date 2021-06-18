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
#include "iotests.h"
#include "internal.h"

#include <capi/key_value_error_context.hh>

class EerrsUnitTest : public MockUnitTest
{
  protected:
    virtual void createEerrConnection(HandleWrap &hw, lcb_INSTANCE **instance)
    {
        MockEnvironment::getInstance()->createConnection(hw, instance);
        ASSERT_EQ(LCB_SUCCESS, lcb_connect(*instance));
        lcb_wait(*instance, LCB_WAIT_DEFAULT);
        ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(*instance));
    }

    void enableEnhancedErrors()
    {
        MockEnvironment::getInstance()->setEnhancedErrors(true);
    }

    void disableEnhancedErrors()
    {
        MockEnvironment::getInstance()->setEnhancedErrors(false);
    }

    void checkRetryVerify(uint16_t errcode);

    void TearDown()
    {
        if (!MockEnvironment::getInstance()->isRealCluster()) {
            MockOpFailClearCommand clearCmd(MockEnvironment::getInstance()->getNumNodes());
            doMockTxn(clearCmd);
        }
        MockUnitTest::TearDown();
    }
};

struct EerrsCookie {
    lcb_STATUS rc{LCB_SUCCESS};
    bool called{false};
    std::string err_ref{};
    std::string err_ctx{};

    void reset()
    {
        rc = LCB_SUCCESS;
        called = false;
        err_ref.clear();
        err_ctx.clear();
    }
};

extern "C" {
static void opcb(lcb_INSTANCE *, int /* cbtype */, const lcb_RESPGET *resp)
{
    EerrsCookie *cookie;
    lcb_respget_cookie(resp, (void **)&cookie);
    cookie->called = true;
    cookie->rc = lcb_respget_status(resp);

    const lcb_KEY_VALUE_ERROR_CONTEXT *ctx;
    lcb_respget_error_context(resp, &ctx);

    const char *ref;
    size_t ref_len;
    lcb_errctx_kv_ref(ctx, &ref, &ref_len);
    if (ref_len > 0) {
        cookie->err_ref.assign(ref, ref_len);
    }

    const char *context;
    size_t context_len;
    lcb_errctx_kv_context(ctx, &context, &context_len);
    if (context_len > 0) {
        cookie->err_ctx.assign(context, context_len);
    }
}
}

TEST_F(EerrsUnitTest, testInCallbackWhenEnabled)
{
    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_INSTANCE *instance;

    enableEnhancedErrors();
    createEerrConnection(hw, &instance);
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)opcb);

    EerrsCookie cookie;

    std::string key("hello");
    lcb_CMDGET *cmd;
    lcb_cmdget_create(&cmd);
    lcb_cmdget_key(cmd, key.c_str(), key.size());
    lcb_cmdget_locktime(cmd, 10);
    lcb_get(instance, &cookie, cmd);
    lcb_cmdget_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_ERR_DOCUMENT_NOT_FOUND, cookie.rc);
    ASSERT_EQ("Failed to lookup item", cookie.err_ctx);
}

TEST_F(EerrsUnitTest, testInCallbackWhenDisabled)
{
    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_INSTANCE *instance;

    disableEnhancedErrors();
    createEerrConnection(hw, &instance);
    lcb_install_callback(instance, LCB_CALLBACK_GET, (lcb_RESPCALLBACK)opcb);

    EerrsCookie cookie;

    std::string key("hello");
    lcb_CMDGET *cmd;
    lcb_cmdget_create(&cmd);
    lcb_cmdget_key(cmd, key.c_str(), key.size());
    lcb_cmdget_locktime(cmd, 10);
    lcb_get(instance, &cookie, cmd);
    lcb_cmdget_destroy(cmd);

    lcb_wait(instance, LCB_WAIT_DEFAULT);
    ASSERT_TRUE(cookie.called);
    ASSERT_TRUE(cookie.err_ref.empty());
    ASSERT_TRUE(cookie.err_ctx.empty());
}
