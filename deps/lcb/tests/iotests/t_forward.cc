#include "iotests.h"
#include <libcouchbase/pktfwd.h>
#include <memcached/protocol_binary.h>
#include "mc/pktmaker.h"
using std::vector;
using std::string;
using namespace PacketMaker;

class ForwardTests : public MockUnitTest
{
protected:
    virtual void createConnection(HandleWrap& hw, lcb_t& instance) {
        MockEnvironment::getInstance()->createConnection(hw, instance);
        lcb_cntl_string(instance, "enable_tracing", "off");
        ASSERT_EQ(LCB_SUCCESS, lcb_connect(instance));
        lcb_wait(instance);
        ASSERT_EQ(LCB_SUCCESS, lcb_get_bootstrap_status(instance));
    }
};

struct ForwardCookie {
    vector<char> orig;
    vector<char> respbuf;
    vector<lcb_IOV> iovs;
    vector<lcb_BACKBUF> bkbuf;
    lcb_error_t err_expected;
    lcb_error_t err_received;
    bool called;
    bool flushed;

    ForwardCookie() {
        err_expected = LCB_SUCCESS;
        err_received = LCB_SUCCESS;
        called = false;
        flushed = false;
    }
};

extern "C" {
static void pktfwd_callback(lcb_t, const void *cookie, lcb_error_t err,
    lcb_PKTFWDRESP *resp)
{
    ForwardCookie *fc = (ForwardCookie *)cookie;
    fc->called = true;
    fc->err_received = err;

    if (err != LCB_SUCCESS) {
        return;
    }

    protocol_binary_response_header *hdr =
            (protocol_binary_response_header*)resp->header;
    ASSERT_EQ(PROTOCOL_BINARY_RES, hdr->response.magic);
    lcb_U32 blen = ntohl(hdr->response.bodylen);

    // Gather the packets
    for (unsigned ii = 0; ii < resp->nitems; ii++) {
        lcb_backbuf_ref(resp->bufs[ii]);

        char *buf = (char *)resp->iovs[ii].iov_base;
        size_t len = resp->iovs[ii].iov_len;

        fc->iovs.push_back(resp->iovs[ii]);
        fc->bkbuf.push_back(resp->bufs[ii]);
        fc->respbuf.insert(fc->respbuf.end(), buf, buf+len);
    }

    ASSERT_EQ(blen+24, fc->respbuf.size());
}

static void pktflush_callback(lcb_t, const void *cookie)
{
    ForwardCookie *fc = (ForwardCookie *)cookie;
    EXPECT_FALSE(fc->flushed);
    fc->flushed = true;
}
}

TEST_F(ForwardTests, testBasic)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    lcb_set_pktflushed_callback(instance, pktflush_callback);
    lcb_set_pktfwd_callback(instance, pktfwd_callback);

    ForwardCookie fc;
    StorageRequest req("Hello", "World");
    req.magic(PROTOCOL_BINARY_REQ);
    req.op(PROTOCOL_BINARY_CMD_SET);

    lcb_CMDPKTFWD cmd = { 0 };
    req.serialize(fc.orig);
    cmd.vb.vtype = LCB_KV_CONTIG;
    cmd.vb.u_buf.contig.bytes = &fc.orig[0];
    cmd.vb.u_buf.contig.nbytes = fc.orig.size();
    lcb_error_t rc;

    lcb_sched_enter(instance);
    rc = lcb_pktfwd3(instance, &fc, &cmd);
    ASSERT_EQ(LCB_SUCCESS, rc);
    lcb_sched_leave(instance);
    lcb_wait(instance);
    ASSERT_TRUE(fc.called);
    ASSERT_EQ(LCB_SUCCESS, fc.err_received);
    for (unsigned ii = 0; ii < fc.bkbuf.size(); ++ii) {
        lcb_backbuf_unref(fc.bkbuf[ii]);
    }
}

TEST_F(ForwardTests, testIncomplete)
{
    lcb_t instance;
    HandleWrap hw;
    createConnection(hw, instance);
    lcb_set_pktflushed_callback(instance, pktflush_callback);
    lcb_set_pktfwd_callback(instance, pktfwd_callback);
}
