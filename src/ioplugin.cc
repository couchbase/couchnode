/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2012 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
#include <libcouchbase/couchbase.h>
#include "couchbase_impl.h"
#include <cerrno>
#include <map>
#include <queue>

#include "ioplugin_internal.h"

Logger logger;

Couchnode::Socket::Socket(Couchnode::IoOps &p, uv_loop_t *l, int &e) :
    parent(p), error(e), state(Initialized), loop(l), sending(false),
    currSendBuffer(NULL)
{
    memset(&sock, 0, sizeof(sock));
    uv_tcp_init(loop, &sock);
    sock.data = this;
}

Couchnode::Socket::~Socket() {
    disconnect();
}

extern "C" {
    static uv_buf_t libuv_alloc_cb(uv_handle_t *, size_t suggested_size)
    {
        ScopeLogger sl("libuv_alloc_cb");
        uv_buf_t ret;
        ret.len = suggested_size;
        ret.base = new char[suggested_size];
        if (ret.base == NULL) {
            ret.len = 0;
        }

        return ret;
    }

    static void libuv_read_cb(uv_stream_t *stream, ssize_t nread, uv_buf_t buf)
    {
        Couchnode::Socket *sock = (Couchnode::Socket*)stream->data;
        ScopeLogger sl("libuv_read_cb");
        sock->onRead(nread, buf);
    }
}

void Couchnode::Socket::onRead(ssize_t nread, uv_buf_t buf)
{
    if (nread == -1) {
        // @todo fixme For now just set all as shutdown ;)
        disconnect();
    } else if (nread == 0) {
        delete []buf.base;
    } else {
        receiveQueue.push(new IoBuffer(buf, nread));
    }

    parent.notifyIO(this);
}

void Couchnode::Socket::onConnect(int status)
{
    if (status == 0) {
        state = Connected;

        // kick off the read event!
        uv_read_start((uv_stream_t*)&sock,
                      libuv_alloc_cb,
                      libuv_read_cb);

    } else {
        // @todo fixme ;)
        state = ConnectRefused;
    }

    parent.notifyIO(this);
}

void Couchnode::Socket::disconnect(void) {
    if (state == Connected) {
        uv_read_stop((uv_stream_t*)&sock);
        uv_close((uv_handle_t*)&sock, NULL);
    }

    state = Shutdown;
}

extern "C" {
    /*
     * The following part is the callbacks from lib uv
     */
    static void libuv_connect_cb(uv_connect_t* req, int status) {
        Couchnode::Socket *sock = (Couchnode::Socket*)req->data;
        ScopeLogger sl("libuv_connect_cb");
        sock->onConnect(status);
        delete req; // Delete the temporary connect object..
    }
}

int Couchnode::Socket::connect(const struct sockaddr *name,
                               unsigned int namelen)
{
    if (state == Initialized) {
        if (namelen != sizeof(struct sockaddr_in)) {
            error = EAFNOSUPPORT;
            return -1;
        }

        state = Connecting;

        uv_connect_t *conn = new uv_connect_t;
        memset(conn, 0, sizeof(*conn));
        conn->data = this;

        int ret = uv_tcp_connect(conn, &sock,
                                 *(const struct sockaddr_in *)(name),
                                 libuv_connect_cb);
        if (ret == 0) {
            error = EWOULDBLOCK;
        } else {
            delete conn;
            state = Initialized;
            error = EIO;
        }
    } else if (state == Connected) {
        return 0;
    } else if (state == Connecting) {
        error = EINPROGRESS;
    } else if (state == ConnectRefused) {
        error = ECONNREFUSED;
    } else {
        error = EINVAL;
    }

    return -1;
}

lcb_ssize_t Couchnode::Socket::recvv(struct lcb_iovec_st *iov,
                                     lcb_size_t niov) {
    lcb_ssize_t nr = -1;
    if (state == Connected) {
        if (receiveQueue.empty()) {
            error = EWOULDBLOCK;
        } else {
            // @todo Fill the IO vectors if the chunks are
            //       smaller than the available space.
            nr = 0;
            IoBuffer *chunk = receiveQueue.front();
            nr = chunk->write(iov, niov);
            if (chunk->empty()) {
                receiveQueue.pop();
                delete chunk;
            }
        }
    } else if (state == Shutdown) {
        nr = 0;
    } else if (state == Initialized || state == Connecting) {
        error = ENOTCONN;
    } else {
        error = EINVAL;
    }

    return nr;
}

lcb_ssize_t Couchnode::Socket::sendv(struct lcb_iovec_st *iov, lcb_size_t niov)
{
    lcb_ssize_t nw = -1;
    if (state == Connected) {
        IoBuffer *buf = new IoBuffer(iov, niov);
        sendQueue.push(buf);
        nw = (lcb_ssize_t)buf->buf.len;
        sendData();
    } else if (state == Shutdown) {
        nw = EPIPE;
    } else if (state == Initialized || state == Connecting) {
        error = ENOTCONN;
    } else {
        error = EINVAL;
    }

    return nw;
}

void Couchnode::Socket::onChunkSent(int status)
{
    if (status != 0) {
        disconnect();
    } else {
        sending = false;
        sendData();
    }
}

extern "C" {
    static void libuv_write_cb(uv_write_t* req, int status) {
        Couchnode::Socket *sock = (Couchnode::Socket*)req->data;
        std::stringstream ss;
        ss << "libuv_write_cb(" << sock << ")";
        logger.enter(ss);
        sock->onChunkSent(status);
        delete req;
        logger.exit(ss);
    }
}

void Couchnode::Socket::sendData(void)
{
    if (sending || sendQueue.empty()) {
        return;
    }

    delete currSendBuffer;
    uv_write_t *req = new uv_write_t;
    memset(req, 0, sizeof(*req));
    req->data = this;

    uv_buf_t buf[1];
    currSendBuffer = sendQueue.front();
    sendQueue.pop();
    buf[0] = currSendBuffer->buf;
    uv_write(req, (uv_stream_t*)&sock, buf, 1, libuv_write_cb);
    sending = true;
}

// ######################################################################
// ##                                                                  ##
// ##                        TIMER CLASS                               ##
// ##                                                                  ##
// ######################################################################
extern "C" {
    static void libuv_timer_cb(uv_timer_t* t, int) {
        logger.enter("libuv_timer_cb");
        Couchnode::Timer *timer = (Couchnode::Timer*)t->data;
        timer->fire();
        logger.exit("libuv_timer_cb");
    }
}

Couchnode::Timer::Timer(IoOps &p, uv_loop_t *l) : parent(p), loop(l) {
    uv_timer_init(loop, &timer);
    timer.data = this;
    running = false;
    cb_data = NULL;
    handler = NULL;
}

Couchnode::Timer::~Timer() {
    deactivate();
}


void Couchnode::Timer::deactivate(void) {
    if (running) {
        uv_timer_stop(&timer);
        running = false;
    }
}

int Couchnode::Timer::updateTimer(lcb_uint32_t usec,
                                  void *cbd,
                                  void h(lcb_socket_t sock,
                                         short which,
                                         void *cb_data)) {
    lcb_uint32_t msec = usec / 1000;

    cb_data = cbd;
    handler = h;
    uv_timer_start(&timer, libuv_timer_cb, msec, 0);
    running = true;
    return 0;
}

void Couchnode::Timer::fire() {
    running = false;
    handler(0xdeadbeef, 0, cb_data);
}

// ######################################################################
// ##                                                                  ##
// ##                        EVENT CLASS                               ##
// ##                                                                  ##
// ######################################################################

extern "C" {
    static void libuv_event_cb(uv_timer_t* t, int) {
        logger.enter("libuv_event_cb");
        Couchnode::Event *ev = (Couchnode::Event*)t->data;
        ev->fire();
        logger.exit("libuv_event_cb");
    }
}

Couchnode::Event::Event(Couchnode::IoOps &p, uv_loop_t *l) :
    parent(p), loop(l), timerRunning(false), socket(NULL)
{
    uv_timer_init(loop, &timer);
    timer.data = this;
}

Couchnode::Event::~Event() {
    deactivate();
}

void Couchnode::Event::deactivate(void) {
    /* EMPTY */
    if (timerRunning) {
        uv_timer_stop(&timer);
        timerRunning = false;
    }
}

int Couchnode::Event::updateEvent(Socket *sock,
                                  lcb_socket_t sid,
                                  short fl,
                                  void *cb,
                                  void h(lcb_socket_t sock,
                                         short which,
                                         void *cb_data)) {
    socket = sock;
    socketId = sid;
    flags = fl;
    if ((flags & LCB_WRITE_EVENT) == LCB_WRITE_EVENT) {
        if (!timerRunning) {
            if (socket != NULL && socket->getState() == Connected) {
                uv_timer_start(&timer, libuv_event_cb, 1, 0);
                timerRunning = true;
            }
        }
    } else if (timerRunning) {
        uv_timer_stop(&timer);
        timerRunning = false;
    }

    cb_data = cb;
    handler = h;
    return 0;
}

void Couchnode::Event::notify(void) {
    short notifyFlags = LCB_RW_EVENT & flags;
    handler(socketId, notifyFlags, cb_data);
}

Couchnode::Socket *Couchnode::Event::getSocket(void) const {
    return socket;
}

void Couchnode::Event::fire() {
    timerRunning = false;
    notify();
}

// ######################################################################
// ##                                                                  ##
// ##                        IoOps CLASS                               ##
// ##                                                                  ##
// ######################################################################

Couchnode::IoOps::IoOps(uv_loop_t *l, int &e) : loop(l), error(e), socketcounter(0) {
}

Couchnode::IoOps::~IoOps() {
    reapObjects();
}

lcb_socket_t Couchnode::IoOps::socket(int , int , int ) {
    // @todo only accept certain types!
    Socket *sock = new Socket(*this, loop, error);
    socketmap[socketcounter] = sock;
    return socketcounter++;
}

int Couchnode::IoOps::connect(lcb_socket_t sock,
                              const struct sockaddr *name,
                              unsigned int namelen) {
    Socket *s = getSocket(sock);
    if (s == NULL) {
        error = EINVAL;
        return -1;
    } else {
        error = 0;
        return s->connect(name, namelen);
    }
}

void Couchnode::IoOps::close(lcb_socket_t sock) {
    SocketMap::iterator iter = socketmap.find((int)sock);
    if (iter != socketmap.end()) {
        iter->second->disconnect();
        socketReapList.push_back(iter->second);
        socketmap.erase(iter);
    }
}

lcb_ssize_t Couchnode::IoOps::recvv(lcb_socket_t sock,
                                    struct lcb_iovec_st *iov,
                                    lcb_size_t niov) {
    Socket *s = getSocket(sock);
    if (s == NULL) {
        error = EINVAL;
        return -1;
    } else {
        error = 0;
        return s->recvv(iov, niov);
    }
}

lcb_ssize_t Couchnode::IoOps::sendv(lcb_socket_t sock,
                                    struct lcb_iovec_st *iov,
                                    lcb_size_t niov) {
    Socket *s = getSocket(sock);
    if (s == NULL) {
        error = EINVAL;
        return -1;
    } else {
        error = 0;
        return s->sendv(iov, niov);
    }
}

// Timer part of the API
void *Couchnode::IoOps::createTimer(void) {
    return (void*)new Timer(*this, loop);
}

void Couchnode::IoOps::destroyTimer(void *tim) {
    Timer *timer = (Timer*)tim;
    timer->deactivate();
    timerReapList.push_back(timer);
}

void Couchnode::IoOps::deleteTimer(void *tim) {
    Timer *timer = (Timer*)tim;
    timer->deactivate();
}

int Couchnode::IoOps::updateTimer(void *tim,
                                  lcb_uint32_t usec,
                                  void *cb_data,
                                  void handler(lcb_socket_t sock,
                                               short which,
                                               void *cb_data)) {
    Timer *timer = (Timer*)tim;
    return timer->updateTimer(usec, cb_data, handler);
}

// The event part of the API
void *Couchnode::IoOps::createEvent(void) {
    return (void*)new Event(*this, loop);
}

void Couchnode::IoOps::destroyEvent(void *ev) {
    Event*event = (Event*)ev;
    event->deactivate();
    eventReapList.push_back(event);
}

void Couchnode::IoOps::deleteEvent(lcb_socket_t sock, void *ev) {
    Event *event = (Event*)ev;
    event->deactivate();
    Socket *socket = getSocket(sock);
    if (socket != NULL) {
        std::map<Socket *, Event *>::iterator iter;
        iter = eventMap.find(socket);
        if (iter != eventMap.end()) {
            eventMap.erase(iter);
        }
    }
}

int Couchnode::IoOps::updateEvent(lcb_socket_t sock,
                                  void *ev,
                                  short flags,
                                  void *cb_data,
                                  void handler(lcb_socket_t sock,
                                               short which,
                                               void *cb_data)) {
    Event *event = (Event*)ev;
    Socket *socket = getSocket(sock);
    assert(socket != NULL);
    eventMap[socket] = event;
    return event->updateEvent(socket, sock, flags, cb_data, handler);
}

void Couchnode::IoOps::notifyIO(Socket *sock) {
    std::map<Socket *, Event *>::iterator iter = eventMap.find(sock);
    if (iter != eventMap.end()) {
        assert(iter->second->getSocket() == sock);
        iter->second->notify();
    }
}

Couchnode::Socket *Couchnode::IoOps::getSocket(lcb_socket_t sock) {
    SocketMap::iterator iter = socketmap.find((int)sock);
    if (iter == socketmap.end()) {
        return NULL;
    }
    return iter->second;
}

void Couchnode::IoOps::reapEvents(void) {
    std::list<Event*>::iterator iter;
    for (iter = eventReapList.begin();
         iter != eventReapList.end();
         ++iter) {
        delete *iter;
    }
    eventReapList.clear();
}

void Couchnode::IoOps::reapTimers(void) {
    std::list<Timer*>::iterator iter;
    for (iter = timerReapList.begin();
         iter != timerReapList.end();
         ++iter) {
        delete *iter;
    }
    timerReapList.clear();
}

void Couchnode::IoOps::reapSockets(void) {
    std::list<Socket*>::iterator iter;
    for (iter = socketReapList.begin();
         iter != socketReapList.end();
         ++iter) {
        delete *iter;
    }
    socketReapList.clear();
}

void Couchnode::IoOps::reapObjects(void) {
    reapEvents();
    reapTimers();
    reapSockets();
}

// ######################################################################
// ##                                                                  ##
// ##      Wrap the C callback functions into the C++ interface        ##
// ##                                                                  ##
// ######################################################################
extern "C" {
    static Couchnode::IoOps* toIo(struct lcb_io_opt_st *iops) {
        return reinterpret_cast<Couchnode::IoOps*>(iops->v.v0.cookie);
    }

    void couchnode_destructor(struct lcb_io_opt_st *iops) {
        delete toIo(iops);
    }

    lcb_socket_t couchnode_socket(struct lcb_io_opt_st *iops,
                                  int domain,
                                  int type,
                                  int protocol) {
        // @todo disallow various types..
        return toIo(iops)->socket(domain, type, protocol);
    }

    int couchnode_connect(struct lcb_io_opt_st *iops,
                          lcb_socket_t sock,
                          const struct sockaddr *name,
                          unsigned int namelen) {
        return toIo(iops)->connect(sock, name, namelen);
    }

    lcb_ssize_t couchnode_recv(struct lcb_io_opt_st *iops,
                               lcb_socket_t sock,
                               void *buffer,
                               lcb_size_t len,
                               int flags) {
        logger.enter("couchnode_recv");
        if (flags != 0) {
            iops->v.v0.error = EINVAL;
            return -1;
        }

        struct lcb_iovec_st iov[1];
        iov[0].iov_base = (char*)buffer;
        iov[0].iov_len = len;

        lcb_ssize_t ret = iops->v.v0.recvv(iops, sock, iov, 1);
        logger.exit("couchnode_recv");
        return ret;
    }

    lcb_ssize_t couchnode_send(struct lcb_io_opt_st *iops,
                               lcb_socket_t sock,
                               const void *buffer,
                               lcb_size_t len,
                               int flags) {
        logger.enter("couchnode_send");
        if (flags != 0) {
            iops->v.v0.error = EINVAL;
            return -1;
        }

        struct lcb_iovec_st iov[1];
        iov[0].iov_base = (char*)buffer;
        iov[0].iov_len = len;

        lcb_ssize_t ret = iops->v.v0.sendv(iops, sock, iov, 1);
        logger.exit("couchnode_send");
        return ret;
    }

    lcb_ssize_t couchnode_recvv(struct lcb_io_opt_st *iops,
                                lcb_socket_t sock,
                                struct lcb_iovec_st *iov,
                                lcb_size_t niov) {
        return toIo(iops)->recvv(sock, iov, niov);
    }

    lcb_ssize_t couchnode_sendv(struct lcb_io_opt_st *iops,
                                lcb_socket_t sock,
                                struct lcb_iovec_st *iov,
                                lcb_size_t niov) {
        return toIo(iops)->sendv(sock, iov, niov);
    }

    void couchnode_close(struct lcb_io_opt_st *iops,
                         lcb_socket_t sock) {
        toIo(iops)->close(sock);
    }

    void *couchnode_create_timer(struct lcb_io_opt_st *iops) {
        return toIo(iops)->createTimer();
    }

    void couchnode_destroy_timer(struct lcb_io_opt_st *iops,
                                 void *timer) {
        return toIo(iops)->destroyTimer(timer);
    }

    void couchnode_delete_timer(struct lcb_io_opt_st *iops,
                                void *timer) {
        return toIo(iops)->deleteTimer(timer);
    }

    int couchnode_update_timer(struct lcb_io_opt_st *iops,
                               void *timer,
                               lcb_uint32_t usec,
                               void *cb_data,
                               void handler(lcb_socket_t sock,
                                            short which,
                                            void *cb_data)) {
        return toIo(iops)->updateTimer(timer, usec, cb_data, handler);
    }

    void *couchnode_create_event(struct lcb_io_opt_st *iops) {
        return toIo(iops)->createEvent();
    }

    void couchnode_destroy_event(struct lcb_io_opt_st *iops,
                                 void *event) {
        return toIo(iops)->destroyEvent(event);
    }

    int couchnode_update_event(struct lcb_io_opt_st *iops,
                               lcb_socket_t sock,
                               void *event,
                               short flags,
                               void *cb_data,
                               void handler(lcb_socket_t sock,
                                            short which,
                                            void *cb_data)) {
        return toIo(iops)->updateEvent(sock, event, flags, cb_data, handler);
    }

    void couchnode_delete_event(struct lcb_io_opt_st *iops,
                                lcb_socket_t sock,
                                void *event) {
        return toIo(iops)->deleteEvent(sock, event);
    }

    void couchnode_stop_event_loop(struct lcb_io_opt_st *) {
        abort();
    }

    void couchnode_run_event_loop(struct lcb_io_opt_st *) {
        abort();
    }
}

namespace Couchnode {
    /**
     * Helper function used to create the IO instance.
     *
     * @param loop instance of libuv to use for the IO operation
     * @return the IO instance to use
     */
    lcb_io_opt_st *createIoOps(uv_loop_t *loop) {
        lcb_io_opt_t ret = new lcb_io_opt_st;
        ret->version = 0;
        ret->dlhandle = NULL;
        ret->destructor = couchnode_destructor;
        if ( getenv("COUCHNODE_DO_TRACE") != NULL) {
            ret->v.v0.cookie = (void*)new Couchnode::LoggingIoOps(loop, ret->v.v0.error);
        } else {
            ret->v.v0.cookie = (void*)new Couchnode::IoOps(loop, ret->v.v0.error);
        }
        ret->v.v0.need_cleanup = 1;
        ret->v.v0.error = 0;
        ret->v.v0.socket = couchnode_socket;
        ret->v.v0.connect = couchnode_connect;
        ret->v.v0.recv = couchnode_recv;
        ret->v.v0.send = couchnode_send;
        ret->v.v0.recvv = couchnode_recvv;
        ret->v.v0.sendv = couchnode_sendv;
        ret->v.v0.close = couchnode_close;
        ret->v.v0.create_timer = couchnode_create_timer;
        ret->v.v0.destroy_timer = couchnode_destroy_timer;
        ret->v.v0.delete_timer = couchnode_delete_timer;
        ret->v.v0.update_timer = couchnode_update_timer;
        ret->v.v0.create_event = couchnode_create_event;
        ret->v.v0.destroy_event = couchnode_destroy_event;
        ret->v.v0.update_event = couchnode_update_event;
        ret->v.v0.delete_event = couchnode_delete_event;
        ret->v.v0.stop_event_loop = couchnode_stop_event_loop;
        ret->v.v0.run_event_loop = couchnode_run_event_loop;
        return ret;
    }
}
