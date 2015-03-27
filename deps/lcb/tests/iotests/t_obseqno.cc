#include "iotests.h"

using namespace std;
class ObseqnoTest : public MockUnitTest {
};

extern "C" {
static void storeCb_getstok(lcb_t, int cbtype, const lcb_RESPBASE *rb)
{
    EXPECT_EQ(LCB_SUCCESS, rb->rc);
    const lcb_SYNCTOKEN *tmp = lcb_resp_get_synctoken(cbtype, rb);
    if (tmp) {
        *(lcb_SYNCTOKEN *)rb->cookie = *tmp;
    }
}
}

static void
storeGetStok(lcb_t instance, const string& k, const string& v, lcb_SYNCTOKEN *st)
{
    lcb_RESPCALLBACK oldcb = lcb_get_callback3(instance, LCB_CALLBACK_STORE);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, storeCb_getstok);
    lcb_sched_enter(instance);
    lcb_CMDSTORE cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, k.c_str(), k.size());
    LCB_CMD_SET_VALUE(&cmd, v.c_str(), v.size());
    cmd.operation = LCB_SET;

    lcb_error_t rc = lcb_store3(instance, st, &cmd);
    EXPECT_EQ(LCB_SUCCESS, rc);
    lcb_sched_leave(instance);
    lcb_wait(instance);
    lcb_install_callback3(instance, LCB_CALLBACK_STORE, oldcb);
}

TEST_F(ObseqnoTest, testFetchImplicit) {
    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_t instance;
    lcb_error_t rc;
    createConnection(hw, instance);
    const char *key = "obseqBasic";
    const char *value = "value";

    rc = lcb_cntl_string(instance, "dur_synctokens", "true");
    ASSERT_EQ(LCB_SUCCESS, rc);

    lcb_SYNCTOKEN st_fetched = { 0 };
    storeGetStok(instance, key, value, &st_fetched);
    ASSERT_TRUE(st_fetched.uuid_ != 0);

    lcb_KEYBUF kb;
    LCB_KREQ_SIMPLE(&kb, key, strlen(key));

    const lcb_SYNCTOKEN *ss = lcb_get_synctoken(instance, &kb, &rc);
    ASSERT_EQ(LCB_SUCCESS, rc);
    ASSERT_TRUE(ss != NULL);
    ASSERT_EQ(ss->uuid_, st_fetched.uuid_);
    ASSERT_EQ(ss->vbid_, st_fetched.vbid_);
    ASSERT_EQ(ss->seqno_, st_fetched.seqno_);
}

extern "C" {
static void
obseqCallback(lcb_t, int, const lcb_RESPBASE *rb) {
    lcb_RESPOBSEQNO *pp = (lcb_RESPOBSEQNO *)rb->cookie;
    *pp = *(const lcb_RESPOBSEQNO *)rb;
}
}

static void
doObserveSeqno(lcb_t instance, const lcb_SYNCTOKEN *ss, int server, lcb_RESPOBSEQNO& resp) {
    lcb_CMDOBSEQNO cmd = { 0 };
    cmd.vbid = ss->vbid_;
    cmd.uuid = ss->uuid_;
    cmd.server_index = server;
    lcb_error_t rc;

    lcb_sched_enter(instance);
    rc = lcb_observe_seqno3(instance, &resp, &cmd);
    if (rc != LCB_SUCCESS) {
        resp.rc = rc;
        resp.rflags |= LCB_RESP_F_CLIENTGEN;
        return;
    }

    lcb_RESPCALLBACK oldcb = lcb_get_callback3(instance, LCB_CALLBACK_OBSEQNO);
    lcb_install_callback3(instance, LCB_CALLBACK_OBSEQNO, obseqCallback);
    lcb_sched_leave(instance);
    lcb_wait(instance);
    lcb_install_callback3(instance, LCB_CALLBACK_OBSEQNO, oldcb);
}

TEST_F(ObseqnoTest, testObserve) {
    SKIP_UNLESS_MOCK();

    HandleWrap hw;
    lcb_t instance;
    lcb_error_t rc;
    createConnection(hw, instance);
    lcbvb_CONFIG *vbc;

    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);

    lcb_SYNCTOKEN st_fetched = { 0 };
    const char *key = "testObserve";
    const char *value = "value";

    // Get the synctoken
    storeGetStok(instance, key, value, &st_fetched);
    ASSERT_TRUE(LCB_SYNCTOKEN_ISVALID(&st_fetched));

    for (size_t ii = 0; ii < lcbvb_get_nreplicas(vbc)+1; ii++) {
        int ix = lcbvb_vbserver(vbc, st_fetched.vbid_, ii);
        lcb_RESPOBSEQNO resp = { 0 };
        doObserveSeqno(instance, &st_fetched, ix, resp);
        ASSERT_EQ(LCB_SUCCESS, resp.rc);
        ASSERT_EQ(st_fetched.uuid_, resp.cur_uuid);
        ASSERT_EQ(0, resp.old_uuid);
//        printf("SEQ_MEM: %lu. SEQ_DISK: %lu\n", resp.mem_seqno, resp.persisted_seqno);
        ASSERT_GT(resp.mem_seqno, 0);
        ASSERT_EQ(resp.mem_seqno, resp.persisted_seqno);
    }
}

TEST_F(ObseqnoTest, testFailoverFormat) {
    SKIP_UNLESS_MOCK();
    HandleWrap hw;
    lcb_t instance;
    createConnection(hw, instance);
    lcbvb_CONFIG *vbc;

    lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_VBCONFIG, &vbc);
    const char *key = "testObserve";
    const char *value = "value";

    lcb_SYNCTOKEN st_fetched = { 0 };
    storeGetStok(instance, key, value, &st_fetched);

    MockEnvironment *env = MockEnvironment::getInstance();
    env->regenVbCoords();

    // Now we should get a different sequence number
    lcb_RESPOBSEQNO rr;
    doObserveSeqno(instance, &st_fetched, lcbvb_vbmaster(vbc, st_fetched.vbid_), rr);
    ASSERT_EQ(LCB_SUCCESS, rr.rc);
//    printf("Old UUID: %llu\n", rr.old_uuid);
//    printf("Cur UUID: %llu\n", rr.cur_uuid);
    ASSERT_GT(rr.old_uuid, 0);
    ASSERT_EQ(rr.old_uuid, st_fetched.uuid_);
    ASSERT_NE(rr.old_uuid, rr.cur_uuid);
    ASSERT_EQ(rr.old_seqno, st_fetched.seqno_);

}

// TODO: We should add more tests here, but in order to do this, we must
// first validate the mock.
