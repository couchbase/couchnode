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
