#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <gtest/gtest.h>
#include <ioserver/ioserver.h>
#include <lcbio/lcbio.h>
#include <lcbio/iotable.h>
#include "settings.h"
#include "logging.h"
#include <list>
#include "internal.h"

using namespace LCBTest;

static inline void
hostFromSockFD(SockFD *sfd, lcb_host_t *tgt)
{
    strcpy(tgt->host, sfd->getLocalHost().c_str());
    sprintf(tgt->port, "%d", sfd->getLocalPort());
}

struct Loop;
struct ESocket;

class IOActions {
public:
    virtual void onRead(ESocket *s, size_t nr);
    virtual void onError(ESocket *s);
    virtual void onFlushDone(ESocket *s, size_t, size_t n) {}
    virtual void onFlushReady(ESocket *s) {}
    virtual ~IOActions() {}
};

struct ESocket {
    lcbio_CONNREQ creq;
    lcbio_SOCKET *sock;
    lcbio_CTX *ctx;
    lcbio_OSERR syserr;
    lcb_error_t lasterr;
    Loop *parent;
    IOActions *actions;
    TestConnection *conn;
    int callCount;
    int readCount;
    std::vector<char> rdbuf;

    static IOActions defaultActions;

    ESocket() {
        sock = NULL;
        ctx = NULL;
        parent = NULL;
        lasterr = LCB_SUCCESS;
        syserr = 0;
        callCount = 0;
        readCount = 0;
        conn = NULL;
        creq.u.preq = NULL;
        creq.type = LCBIO_CONNREQ_RAW;
        actions = &defaultActions;
    }

    void close();
    void clear() {
        ctx = NULL;
    }

    ~ESocket() {
        close();
    }

    void put(const void *b, size_t n) {
        lcbio_ctx_put(ctx, b, n);
    }

    void put(const std::string& s) {
        put(s.c_str(), s.size());
    }

    void reqrd(size_t n) {
        lcbio_ctx_rwant(ctx, n);
    }

    void schedule() {
        lcbio_ctx_schedule(ctx);
    }

    std::string getReceived() {
        return std::string(readbuf.begin(), readbuf.end());
    }

    size_t getUnreadSize() {
        return rdb_get_nused(&ctx->ior);
    }

    void setActions(IOActions *ioa) {
        actions = ioa;
    }

    void assign(lcbio_SOCKET *sock, lcb_error_t err);
    std::vector<char> readbuf;
};

class Timer {
public:
    Timer(lcbio_TABLE *iot);
    virtual ~Timer();
    virtual void expired() = 0;
    void destroy();
    void cancel();
    void schedule(unsigned ms);
    void signal();

private:
    lcb_timer_t timer;
};


/**
 * This class checks if the loop should break or not. If it should, then
 * shouldBreak() returns true. This is required because some event loops are
 * in 'always run' mode and don't particularly break once no I/O handles
 * remain active.
 */
class BreakCondition {
public:
    BreakCondition();
    virtual ~BreakCondition() {}
    bool shouldBreak();
    bool didBreak() { return broke; }
protected:
    virtual bool shouldBreakImpl() = 0;
    bool broke;
};

class FutureBreakCondition : public BreakCondition {
public:
    FutureBreakCondition(Future *ft) : BreakCondition() { f = ft; }
    virtual ~FutureBreakCondition() {}
protected:
    bool shouldBreakImpl() { return f->checkDone(); }
    Future *f;
};

class FlushedBreakCondition : public BreakCondition {
public:
    FlushedBreakCondition(ESocket *s) { sock = s; }
    virtual ~FlushedBreakCondition() {}
protected:
    bool shouldBreakImpl();
private:
    ESocket *sock;
};

class ReadBreakCondition : public BreakCondition {
public:
    ReadBreakCondition(ESocket *s, unsigned nr) { sock = s; expected = nr; }
    virtual ~ReadBreakCondition() {}
protected:
    bool shouldBreakImpl();
private:
    unsigned expected;
    ESocket *sock;
};

class ErrorBreakCondition : public BreakCondition {
public:
    ErrorBreakCondition(ESocket *s) : BreakCondition() { sock = s; }
protected:
    ESocket *sock;
    bool shouldBreakImpl() { return sock->lasterr != LCB_SUCCESS; }
};

class CtxCloseBreakCondition : public BreakCondition {
public:
    CtxCloseBreakCondition(ESocket *sock) : BreakCondition() {
        s = sock;
        destroyed = false;
    }

    void gotDtor() {
        destroyed = true;
    }

    void closeCtx();

protected:
    ESocket *s;
    bool destroyed;
    bool shouldBreakImpl() {
        return destroyed;
    }
};

class NullBreakCondition : public BreakCondition {
public:
    bool shouldBreakImpl() { return true; }
};

class BreakTimer;
struct Loop {
    Loop();
    ~Loop();
    void start();
    void stop();
    void connect(ESocket *sock);
    void connect(ESocket *sock, lcb_host_t *host, unsigned mstmo);
    void connectPooled(ESocket *sock, lcb_host_t *host, unsigned mstmo);
    void connectPooled(ESocket *sock);
    void populateHost(lcb_host_t *host);
    void setBreakCondition(BreakCondition *bc) { bcond = bc; }
    void scheduleBreak();
    void cancelBreak();
    void initSockCommon(ESocket *s);

    lcbio_MGR *sockpool;
    TestServer *server;
    lcb_settings *settings;
    lcb_io_opt_t io;
    lcbio_pTABLE iot;
    BreakTimer *breakTimer;
    std::list<Future *> pending;
    BreakCondition *bcond;
};

class SockTest : public ::testing::Test {
protected:
    Loop *loop;
    void SetUp() {
        lcb_initialize_socket_subsystem();
#ifndef _WIN32
        signal(SIGPIPE, SIG_IGN);
#endif
        loop = new Loop();
    }

    void TearDown() {
        delete loop;
    }
};
