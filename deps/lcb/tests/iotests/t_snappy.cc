#include "config.h"
#include "iotests.h"
#include "internal.h"

class SnappyUnitTest : public MockUnitTest
{
  protected:
    void setCompression(std::string mode)
    {
        MockEnvironment::getInstance()->setCompression(mode);
    }

    bool isCompressed(std::string &key)
    {
        const Json::Value info = MockEnvironment::getInstance()->getKeyInfo(key);
        for (Json::Value::const_iterator ii = info.begin(); ii != info.end(); ii++) {
            const Json::Value &node = *ii;
            if (node.isNull()) {
                continue;
            }
            if (node["Conf"]["Type"] == "master") {
                return node["Cache"]["Snappy"].asBool();
            }
        }
        return false;
    }
};

struct SnappyCookie {
    lcb_error_t rc;
    bool called;
    std::string value;

    void reset()
    {
        rc = LCB_SUCCESS;
        called = false;
    }
    SnappyCookie() : rc(LCB_SUCCESS), called(false) {}

    ~SnappyCookie() {}
};

extern "C" {
static void storecb(lcb_t, int, const lcb_RESPBASE *rb)
{
    SnappyCookie *cookie = reinterpret_cast< SnappyCookie * >(rb->cookie);
    cookie->called = true;
    cookie->rc = rb->rc;
}
static void getcb(lcb_t, int, const lcb_RESPBASE *rb)
{
    SnappyCookie *cookie = reinterpret_cast< SnappyCookie * >(rb->cookie);
    cookie->called = true;
    cookie->rc = rb->rc;
    const lcb_RESPGET *resp = reinterpret_cast< const lcb_RESPGET * >(rb);
    cookie->value.assign((char *)resp->value, resp->nvalue);
}
}

TEST_F(SnappyUnitTest, testSpec)
{
    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_t instance;

    setCompression("passive");
    createConnection(hw, instance);
    lcb_cntl_setu32(instance, LCB_CNTL_COMPRESSION_OPTS, LCB_COMPRESS_INOUT);
    lcb_install_callback3(instance, LCB_CALLBACK_GET, getcb);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, storecb);

    std::string key("hello");
    std::string value("A big black bug bit a big black bear, made the big black bear bleed blood");
    std::string compressed("IPA big black bug bit a.\x14");

    SnappyCookie cookie;
    lcb_CMDSTORE scmd;
    lcb_CMDGET gcmd;

    scmd = lcb_CMDSTORE();
    scmd.operation = LCB_UPSERT;
    LCB_CMD_SET_KEY(&scmd, key.c_str(), key.size());
    LCB_CMD_SET_VALUE(&scmd, value.c_str(), value.size());
    cookie = SnappyCookie();
    lcb_store3(instance, &cookie, &scmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    /* now we have negotiated snappy feature */
    cookie = SnappyCookie();
    lcb_store3(instance, &cookie, &scmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);

    cookie = SnappyCookie();
    gcmd = lcb_CMDGET();
    LCB_CMD_SET_KEY(&gcmd, key.c_str(), key.size());
    lcb_get3(instance, &cookie, &gcmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    ASSERT_STREQ(value.c_str(), cookie.value.c_str());
    ASSERT_TRUE(isCompressed(key));

    lcb_cntl_setu32(instance, LCB_CNTL_COMPRESSION_OPTS, LCB_COMPRESS_OUT);
    cookie = SnappyCookie();
    gcmd = lcb_CMDGET();
    LCB_CMD_SET_KEY(&gcmd, key.c_str(), key.size());
    lcb_get3(instance, &cookie, &gcmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    ASSERT_STREQ(compressed.c_str(), cookie.value.c_str());

    setCompression("off");
    createConnection(hw, instance);
    lcb_cntl_setu32(instance, LCB_CNTL_COMPRESSION_OPTS, LCB_COMPRESS_INOUT);
    lcb_install_callback3(instance, LCB_CALLBACK_GET, getcb);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, storecb);

    cookie = SnappyCookie();
    gcmd = lcb_CMDGET();
    LCB_CMD_SET_KEY(&gcmd, key.c_str(), key.size());
    lcb_get3(instance, &cookie, &gcmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    ASSERT_STREQ(value.c_str(), cookie.value.c_str());

    cookie = SnappyCookie();
    lcb_store3(instance, &cookie, &scmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    ASSERT_FALSE(isCompressed(key));
}

TEST_F(SnappyUnitTest, testIOV)
{

    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_t instance;

    setCompression("passive");
    createConnection(hw, instance);
    lcb_cntl_setu32(instance, LCB_CNTL_COMPRESSION_OPTS, LCB_COMPRESS_INOUT);
    lcb_install_callback3(instance, LCB_CALLBACK_GET, getcb);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, storecb);

    std::string key("hello");
    std::string value1("A big black bug bit ");
    std::string value2("a big black bear, ");
    std::string value3("made the big black ");
    std::string value4("bear bleed blood");
    std::string value = value1 + value2 + value3 + value4;
    std::string compressed("IPA big black bug bit a.\x14");

    SnappyCookie cookie;
    lcb_CMDSTORE scmd;
    lcb_CMDGET gcmd;

    lcb_IOV iov[4];
    unsigned int niov = 4;
    iov[0].iov_base = (void *)value1.c_str();
    iov[0].iov_len = value1.size();
    iov[1].iov_base = (void *)value2.c_str();
    iov[1].iov_len = value2.size();
    iov[2].iov_base = (void *)value3.c_str();
    iov[2].iov_len = value3.size();
    iov[3].iov_base = (void *)value4.c_str();
    iov[3].iov_len = value4.size();

    scmd = lcb_CMDSTORE();
    scmd.operation = LCB_UPSERT;
    LCB_CMD_SET_KEY(&scmd, key.c_str(), key.size());
    LCB_CMD_SET_VALUEIOV(&scmd, iov, niov);
    cookie = SnappyCookie();
    lcb_store3(instance, &cookie, &scmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    /* now we have negotiated snappy feature */
    cookie = SnappyCookie();
    lcb_store3(instance, &cookie, &scmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);

    cookie = SnappyCookie();
    gcmd = lcb_CMDGET();
    LCB_CMD_SET_KEY(&gcmd, key.c_str(), key.size());
    lcb_get3(instance, &cookie, &gcmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    ASSERT_STREQ(value.c_str(), cookie.value.c_str());
    ASSERT_TRUE(isCompressed(key));

    lcb_cntl_setu32(instance, LCB_CNTL_COMPRESSION_OPTS, LCB_COMPRESS_OUT);
    cookie = SnappyCookie();
    gcmd = lcb_CMDGET();
    LCB_CMD_SET_KEY(&gcmd, key.c_str(), key.size());
    lcb_get3(instance, &cookie, &gcmd);
    lcb_wait(instance);
    ASSERT_TRUE(cookie.called);
    ASSERT_EQ(LCB_SUCCESS, cookie.rc);
    ASSERT_STREQ(compressed.c_str(), cookie.value.c_str());
}
