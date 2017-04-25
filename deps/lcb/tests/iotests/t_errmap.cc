#include "config.h"
#include "iotests.h"
#include "internal.h"
#include <map>

class ErrmapUnitTest : public MockUnitTest {
protected:
    virtual void createErrmapConnection(HandleWrap& hw, lcb_t& instance) {
        MockEnvironment::getInstance()->createConnection(hw, instance);
        ASSERT_EQ(LCB_SUCCESS, lcb_cntl_string(instance, "enable_errmap", "true"));
        ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
        lcb_wait(instance);
        ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    }
};

struct ResultCookie {
    lcb_error_t rc;
    bool called;

    void reset() {
        rc = LCB_SUCCESS;
        called = false;
    }
    ResultCookie() : rc(LCB_SUCCESS), called(false) {
    }
};

extern "C" {
static void opcb(lcb_t,int,const lcb_RESPBASE* rb) {
    ResultCookie *cookie = reinterpret_cast<ResultCookie*>(rb->cookie);
    cookie->called = true;
    cookie->rc = rb->rc;
}
}

TEST_F(ErrmapUnitTest, hasRecognizedErrors) {
    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_t instance;

    createErrmapConnection(hw, instance);

    // Test the actual error map..
    using namespace lcb;
    const errmap::ErrorMap& em = *instance->settings->errmap;
    const errmap::Error& err = em.getError(PROTOCOL_BINARY_RESPONSE_KEY_ENOENT);
    ASSERT_TRUE(err.isValid());
    ASSERT_TRUE(err.hasAttribute(errmap::CONSTRAINT_FAILURE));
}

TEST_F(ErrmapUnitTest, closesOnUnrecognizedError) {
    // For now, EINTERNAL is an error code we don't know!
    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_t instance;
    createErrmapConnection(hw, instance);

    const char *key = "key";
    lcb_CMDSTORE scmd = { 0 };
    LCB_CMD_SET_KEY(&scmd, key, strlen(key));
    LCB_CMD_SET_VALUE(&scmd, "val", 3);

    ResultCookie cookie;
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, opcb);
    ASSERT_EQ(LCB_SUCCESS, lcb_store3(instance, &cookie, &scmd));
    lcb_wait(instance);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);

    MockCommand cmd(MockCommand::OPFAIL);

    // Determine the server
    int srvix = instance->map_key(key);

    cmd.set("server", srvix);
    cmd.set("code", PROTOCOL_BINARY_RESPONSE_EINTERNAL); // Invalidate the connection!
    cmd.set("count", 1);
    doMockTxn(cmd);

    cookie.reset();
    ASSERT_EQ(LCB_SUCCESS, lcb_store3(instance, &cookie, &scmd));
    lcb_wait(instance);

    ASSERT_TRUE(cookie.called);
    ASSERT_NE(LCB_SUCCESS, cookie.rc);

    cookie.reset();
    ASSERT_EQ(LCB_SUCCESS, lcb_store3(instance, &cookie, &scmd));
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);

    // Note, we can't determine what the actual error here is. It would be nice
    // if we were able to reconnect and retry the other commands, but right now
    // detecting a failed connection is better than having no detection at all:
    //
    // ASSERT_EQ(LCB_SUCCESS, cookie.rc);
}
