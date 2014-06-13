#include "socktest.h"
#include <lcbio/manager.h>
using namespace LCBTest;
using std::string;
using std::vector;
class SockMgrTest : public SockTest {
    void SetUp() {
        SockTest::SetUp();
        loop->sockpool->maxidle = 2;
        loop->sockpool->tmoidle = LCB_MS2US(2000);
    }
};

TEST_F(SockMgrTest, testBasic)
{
    ESocket *sock1 = new ESocket();
    loop->connectPooled(sock1);
    lcbio_SOCKET *rawsock = sock1->sock;
    delete sock1;
    ESocket *sock2 = new ESocket();
    loop->connectPooled(sock2);
    ASSERT_EQ(rawsock, sock2->sock);

    ESocket *sock3 = new ESocket();
    loop->connectPooled(sock3);
    ASSERT_NE(rawsock, sock3->sock);
    delete sock3;
    delete sock2;
}

TEST_F(SockMgrTest, testCancellation)
{
    lcb_host_t host;
    loop->populateHost(&host);
    lcbio_MGRREQ *req = lcbio_mgr_get(loop->sockpool,
                                      &host, LCB_MS2US(1000), NULL, NULL);
    ASSERT_FALSE(req == NULL);
    lcbio_mgr_cancel(req);
    loop->sockpool->tmoidle = LCB_MS2US(2);
    loop->start();
}
