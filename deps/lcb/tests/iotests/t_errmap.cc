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

    void checkRetryVerify(uint16_t errcode);

    void TearDown() {
        if (!MockEnvironment::getInstance()->isRealCluster()) {
            MockOpFailClearCommand clearCmd(MockEnvironment::getInstance()->getNumNodes());
            doMockTxn(clearCmd);
        }
        MockUnitTest::TearDown();
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

void ErrmapUnitTest::checkRetryVerify(uint16_t errcode) {
    HandleWrap hw;
    lcb_t instance;
    createErrmapConnection(hw, instance);
    lcb_install_callback3(instance, LCB_CALLBACK_DEFAULT, opcb);

    ResultCookie cookie;

    std::string key("hello");
    lcb_CMDSTORE scmd = { 0 };
    LCB_CMD_SET_KEY(&scmd, key.c_str(), key.size());
    LCB_CMD_SET_VALUE(&scmd, "Val", 3);

    // Store the item once to ensure the server is actually connected
    // (we don't want opfail to be active during negotiation).
    lcb_store3(instance, &cookie, &scmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);

    // Figure out the server this key belongs to.
    int srvix = instance->map_key(key);

    MockCommand cmd(MockCommand::START_RETRY_VERIFY);
    cmd.set("idx", srvix);
    cmd.set("bucket", instance->get_bucketname());
    doMockTxn(cmd);

    // Set up opfail
    MockOpfailCommand failCmd(errcode, srvix, -1, instance->get_bucketname());
    doMockTxn(failCmd);

    // Run the command!
    cookie.reset();
    lcb_error_t rc = lcb_store3(instance, &cookie, &scmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_wait(instance);

    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_GENERIC_TMPERR, cookie.rc);

    // Check that we executed correctly:
    MockBucketCommand verifyCmd(MockCommand::CHECK_RETRY_VERIFY, srvix, instance->get_bucketname());
    verifyCmd.set("opcode", PROTOCOL_BINARY_CMD_SET);
    verifyCmd.set("errcode", errcode);
#ifdef __APPLE__
    // FIXME: on Jenkins OSX actual expected time does not match actual and mock raises exception like following:
    // VerificationException: Not enough/too many retries. Last TS=1498594892704. Last expected=1498594892728. Diff=24. MaxDiff=20
    verifyCmd.set("fuzz_ms", 35);
#else
    verifyCmd.set("fuzz_ms", 20);
#endif
    doMockTxn(verifyCmd);
}

static const uint16_t ERRCODE_CONSTANT = 0x7ff0;
static const uint16_t ERRCODE_LINEAR = 0x7ff1;
static const uint16_t ERRCODE_EXPONENTIAL = 0x7ff2;

TEST_F(ErrmapUnitTest, retrySpecConstant) {
    SKIP_UNLESS_MOCK();
    checkRetryVerify(ERRCODE_CONSTANT);
}

TEST_F(ErrmapUnitTest, retrySpecLinear) {
    SKIP_UNLESS_MOCK();
    checkRetryVerify(ERRCODE_LINEAR);
}

TEST_F(ErrmapUnitTest, retrySpecExponential) {
    SKIP_UNLESS_MOCK();
    checkRetryVerify(ERRCODE_EXPONENTIAL);
}
