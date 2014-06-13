#include "ioserver.h"
#include <cassert>

using namespace LCBTest;

extern "C" {
static void
client_runfunc(void *arg)
{
    TestConnection *conn = (TestConnection *)arg;
    conn->run();
}
}

void
TestConnection::setCommon(void *src, void **target)
{
    mutex.lock();
    assert(*target == NULL);
    *target = src;
    char dummy = 0;
    send(*ctlfd_user, &dummy, 1, 0);
    mutex.unlock();
}

void
TestConnection::sendData()
{
    f_send->startUpdate();
    do {
#ifdef _WIN32
        const char *outbuf;
#else
        void *outbuf;
#endif
        size_t n = f_send->getBuf((void**)&outbuf);
        ssize_t nw = send(*datasock, outbuf, n, 0);
        if (nw < 0) {
            f_send->bail();
        } else {
            f_send->setSent(nw);
        }
    } while (!f_send->shouldEnd());
    f_send->endUpdate();
    f_send = NULL;
}

void
TestConnection::recvData()
{
    f_recv->startUpdate();
    char buf[32768];

    do {
        size_t required = f_recv->getRequired();
        size_t rdsize = std::min(required, sizeof(buf));
        ssize_t nr = recv(*datasock, buf, rdsize, 0);
        if (nr < 0) {
            f_recv->bail();
        } else {
            f_recv->setReceived(buf, nr);
        }
    } while (!f_recv->shouldEnd());

    f_recv->endUpdate();
    f_recv = NULL;
}

void
TestConnection::handleClose()
{
    f_close->startUpdate();
    datasock->close();
    f_close->setDone();
    f_close->endUpdate();
    f_close = NULL;
}

void
TestConnection::run()
{
    char dummy = 0;
    mutex.lock();
    ctlfd_loop = ctlfd_lsn->acceptClient();
    initcond.signal();
    mutex.unlock();

    while (::recv(*ctlfd_loop, &dummy, 1, 0) == 1) {
        mutex.lock();
        if (f_close && f_close->getType() == CloseFuture::BEFORE_IO) {
            handleClose();
        }

        if (f_send) {
            sendData();
        }
        if (f_recv) {
            recvData();
        }

        if (f_close && f_close->getType() == CloseFuture::AFTER_IO) {
            handleClose();
        }
        mutex.unlock();
    }

    mutex.lock();
    if (f_recv) {
        f_recv->updateFailed();
        f_recv = NULL;
    }
    if (f_send) {
        f_send->updateFailed();
        f_send = NULL;
    }
    if (f_close) {
        f_close->updateFailed();
        f_close = NULL;
    }
    mutex.unlock();
}

TestConnection::TestConnection(TestServer *server, int newsock)
{
    datasock = new SockFD(newsock);
    datasock->loadRemoteAddr();
    ctlfd_lsn = SockFD::newListener();
    ctlfd_loop = NULL;

    f_send = NULL;
    f_recv = NULL;
    f_close = NULL;
    parent = server;

    thr = new Thread(client_runfunc, this);
    ctlfd_user = SockFD::newClient(ctlfd_lsn);

    mutex.lock();
    while (!ctlfd_loop) {
        initcond.wait(mutex);
    }
    mutex.unlock();
}

TestConnection::~TestConnection()
{
    ctlfd_loop->close();
    ctlfd_user->close();
    ctlfd_lsn->close();
    datasock->close();
    thr->join();
    delete thr;
    mutex.close();
    initcond.close();
    delete ctlfd_loop;
    delete ctlfd_user;
    delete ctlfd_lsn;
    delete datasock;
}
