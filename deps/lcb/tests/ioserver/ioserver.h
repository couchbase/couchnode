#ifndef NOMINMAX
#define NOMINMAX
#endif

#include "config.h"
#ifndef _WIN32
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#define closesocket close
#else
#include "config.h"
#define sched_yield()
#define SHUT_RDWR SD_BOTH
#define ssize_t SSIZE_T
#endif

#include <cassert>
#include <cerrno>
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <list>
#include <vector>
#include <string>
#include "threads.h"

namespace LCBTest {
class TestServer;
class TestConnection;

class SockFD {
public:
    SockFD(int sock);
    ~SockFD();
    operator int() const { return fd; }
    void close();
    void loadRemoteAddr();

    const struct sockaddr_in& localAddr4() {
        return *(struct sockaddr_in *)&sa_local;
    }

    const struct sockaddr_in& remoteAddr4() {
        return *(struct sockaddr_in *)&sa_remote;
    }

    uint16_t getLocalPort() {
        return ntohs(localAddr4().sin_port);
    }

    uint16_t getRemotePort() {
        return ntohs(remoteAddr4().sin_port);
    }

    std::string getLocalHost() {
        return getHostCommon(&sa_local);
    }

    std::string getRemoteHost() {
        return getHostCommon(&sa_remote);
    }

    SockFD *acceptClient();

    static SockFD *newListener();
    static SockFD *newClient(SockFD *server);

private:
    static std::string getHostCommon(sockaddr_storage *ss);
    socklen_t naddr;
    struct sockaddr_storage sa_local;
    struct sockaddr_storage sa_remote;
#ifdef _WIN32
    SOCKET fd;
#else
    int fd;
#endif
    SockFD(SockFD&);
};

class Future {
public:
    void wait();
    void startUpdate();
    void endUpdate();
    void updateFailed() {
        startUpdate();
        bail();
        endUpdate();
    }

    bool isOk() {
        return !failed;
    }

    void bail() {
        failed = true;
        last_errno = errno;
        printf("Bailing: Error=%d\n", last_errno);
    }

    bool checkDone() {
        bool ret;
        if (!mutex.tryLock()) {
            return false;
        }
        ret = isDone();
        mutex.unlock();
        return ret;
    }

    bool shouldEnd() {
        return isDone() || failed;
    }

    virtual ~Future();
    volatile int last_errno;

protected:
    virtual bool isDone() = 0;
    Future();

private:
    Mutex mutex;
    Condvar cond;
    volatile bool failed;
};

class SendFuture : public Future {
public:
    SendFuture(const void *bytes, size_t nbytes) : Future() {
        buf.insert(buf.begin(), (char *)bytes, (char *)bytes + nbytes);
        nsent = 0;
    }

    SendFuture(const std::string& ss) {
        buf.assign(ss.begin(), ss.end());
        nsent = 0;
    }

    size_t getBuf(void **outbuf) {
        size_t ret = buf.size() - nsent;
        *outbuf = &buf[nsent];
        return ret;
    }

    void setSent(size_t n) {
        nsent += n;
    }

protected:
    bool isDone() {
        return nsent == buf.size();
    }

private:
    volatile unsigned nsent;
    std::vector<char> buf;
};

class RecvFuture : public Future {
public:
    RecvFuture(size_t n) : Future() {
        reinit(n);
    }

    void reinit(size_t n) {
        required = n;
        buf.clear();
        buf.reserve(n);
    }

    size_t getRequired() {
        return required - buf.size();
    }

    void setReceived(void *rbuf, size_t nbuf) {
        char *cbuf = (char *)rbuf;
        buf.insert(buf.end(), cbuf, cbuf + nbuf);
    }

    std::vector<char> getBuf() {
        return buf;
    }

    std::string getString() {
        return std::string(buf.begin(), buf.end());
    }

protected:
    bool isDone() {
        return buf.size() == required;
    }

private:
    volatile size_t required;
    std::vector<char> buf;
};

class CloseFuture : public Future {
public:
    enum CloseTime {
        BEFORE_IO,
        AFTER_IO
    };

    CloseFuture(CloseTime type) : Future() {
        performed = false;
        closeTime = type;
    }

    void setDone() {
        performed = true;
    }

    CloseTime getType() { return closeTime; }

protected:
    bool isDone() { return performed; }

private:
    volatile bool performed;
    CloseTime closeTime;
};

class TestConnection {
public:
    TestConnection(TestServer *server, int sock);
    ~TestConnection();
    void run();

    void setSend(SendFuture *f) {
        setCommon(f, (void **)&f_send);
    }

    void setRecv(RecvFuture *f) {
        setCommon(f, (void **)&f_recv);
    }

    void setClose(CloseFuture *f) {
        setCommon(f, (void **)&f_close);
    }

    void close() {
        datasock->close();
        ctlfd_loop->close();
        ctlfd_user->close();
        ctlfd_lsn->close();
    }

    uint16_t getPeerPort() {
        return datasock->getRemotePort();
    }

private:
    SockFD *datasock;
    SockFD *ctlfd_loop;
    SockFD *ctlfd_lsn;
    SockFD *ctlfd_user;
    Mutex mutex;
    Condvar initcond;
    Thread *thr;
    TestServer *parent;
    SendFuture *f_send;
    RecvFuture *f_recv;
    CloseFuture *f_close;
    void setCommon(void *src, void **target);
    void sendData();
    void recvData();
    void handleClose();
};

class TestServer {
public:
    TestServer();
    ~TestServer();

    void run();
    void close() {
        closed = true;
        lsn->close();
    }

    bool isClosed() {
        return closed;
    }

    TestConnection* findConnection(uint16_t cliport);
    uint16_t getListenPort() {
        return lsn->getLocalPort();
    }

    std::string getHostString() {
        return lsn->getLocalHost();
    }

    std::string getPortString();

private:
    friend class TestConnection;
    bool closed;
    SockFD *lsn;
    Thread *thr;
    Mutex mutex;
    std::list<TestConnection *> conns;
    void startConnection(TestConnection *conn);
};

}
