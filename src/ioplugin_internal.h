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
#pragma once

#include <libcouchbase/couchbase.h>
#include "couchbase_impl.h"
#include <cerrno>
#include <map>
#include <queue>
#include <list>

#include "logger.h"

namespace Couchnode {
    enum SocketState {
        Initialized,
        Connecting,
        Connected,
        ConnectRefused,
        Shutdown
    };

    /**
     * libcouchbase use a slightly different IO model than libuv.
     * to work around this the plugin use IO buffers and fakes all
     * send calls by stashing all of the data into the write buffer
     * and send it at a later time. Similary we'll buffer all of the
     * data received from the network goes into a buffer before
     * libcouchbase is scheduled to read the data
     */
    struct IoBuffer {
        /**
         * Create a new buffer and initialize it with data from an
         * IO vector
         *
         * @param iov the IO vector containing the data
         * @param niov the number of elements in the io vector
         */
        IoBuffer(struct lcb_iovec_st *iov, lcb_size_t niov) {
            length = 0;
            for (lcb_size_t ii = 0; ii < niov; ++ii) {
                length += iov[ii].iov_len;
            }

            buf.len = length;
            buf.base = new char[length];
            assert(buf.base);

            offset = 0;
            for (lcb_size_t ii = 0; ii < niov; ++ii) {
                memcpy(buf.base + offset, (char*)iov[ii].iov_base,
                       iov[ii].iov_len);
                offset += iov[ii].iov_len;
            }
            offset = 0;
        }

        IoBuffer(const uv_buf_t buffer, lcb_size_t len) {
            buf.base = buffer.base;
            buf.len = buffer.len;
            offset = 0;
            length = len;
        }

        /**
         * Release all of the allocated resources
         */
        ~IoBuffer() {
            delete []buf.base;
        }

        /**
         * Try to write as much as possible of the data from this IO
         * buffer into the supplied IO vector.
         *
         * This operation updates the internal offset pointer
         *
         * @param iov the io vector to fill with data
         * @param niov the number of elements in the IO vector
         * @return the number of bytes copied
         */
        lcb_size_t write(struct lcb_iovec_st *iov, lcb_size_t niov) {
            lcb_size_t nw = 0;
            for (lcb_size_t ii = 0; ii < niov; ++ii) {
                lcb_size_t size = iov[ii].iov_len;
                if (size > (length - offset)) {
                    size = (length - offset);
                }
                memcpy(iov[ii].iov_base, buf.base + offset, size);
                nw += size;
                offset += size;
                if (offset == length) {
                    return nw;
                }
            }

            return nw;
        }

        /**
         * Check if we've processed all of the data from the buffer
         *
         * @return true if all data is processed
         */
        bool empty() const {
            return (offset == length) ? true : false;
        }

        /* The actual content of the buffer.. its start and length */
        uv_buf_t buf;
        /* The current offset in the buffer we're using */
        size_t offset;
        /* The size of data in the buffer that we know is there */
        size_t length;
    };

    class IoOps;

    /**
     * The socket class is responsible for mapping the socket api down
     * to the libuv API.
     */
    class Socket {
    public:
        Socket(IoOps &p, uv_loop_t *l, int &e);
        virtual ~Socket();

        /**
         * The onConnect callback is called from libuv when a
         * connection attempt is done
         *
         * @param status the result of the connect operation
         */
        virtual void onConnect(int status);

        /**
         * onRead is called from libuv when data is read from
         * the network
         *
         * @param nread The number of bytes read
         * @param buf The buffer where the data is read from
         */
        virtual void onRead(ssize_t nread, uv_buf_t buf);

        /**
         * onChunkSent is called from libuv when data is sent
         * on the network (or if an error occurred)
         *
         */
        virtual void onChunkSent(int status);


        virtual int connect(const struct sockaddr *name, unsigned int namelen);

        virtual lcb_ssize_t recvv(struct lcb_iovec_st *iov, lcb_size_t niov);
        virtual lcb_ssize_t sendv(struct lcb_iovec_st *iov, lcb_size_t niov);

        SocketState getState() const { return state; }

        virtual void disconnect(void);

    protected:
        virtual void sendData(void);

        IoOps &parent;
        int &error;
        SocketState state;
        uv_loop_t *loop;
        uv_tcp_t sock;
        bool sending;
        IoBuffer *currSendBuffer;
        std::queue<IoBuffer *> sendQueue;
        std::queue<IoBuffer *> receiveQueue;
    };

    typedef std::map<int, Socket*> SocketMap;

    class Timer {
    public:
        Timer(IoOps &p, uv_loop_t *l);
        virtual ~Timer();
        virtual void deactivate(void);
        virtual int updateTimer(lcb_uint32_t usec,
                                void *cbd,
                                void h(lcb_socket_t sock,
                                       short which,
                                       void *cb_data));
        virtual void fire();

    protected:
        IoOps &parent;
        uv_loop_t *loop;
        uv_timer_t timer;
        bool running;
        void *cb_data;
        void (*handler)(lcb_socket_t sock,
                        short which,
                        void *cb_data);
    };

    class Event {
    public:
        Event(IoOps &p, uv_loop_t *l);
        virtual ~Event();

        virtual void deactivate(void);

        virtual int updateEvent(Socket *sock,
                                lcb_socket_t sid,
                                short fl,
                                void *cb,
                                void h(lcb_socket_t sock,
                                       short which,
                                       void *cb_data));

        void notify(void);
        Socket *getSocket(void) const;
        virtual void fire();

    protected:
        IoOps &parent;
        uv_loop_t *loop;
        uv_timer_t timer;
        bool timerRunning;

        Socket *socket;
        lcb_socket_t socketId;
        short flags;
        void *cb_data;
        void (*handler)(lcb_socket_t sock,
                        short which,
                        void *cb_data);
    };

    class IoOps {
    public:
        IoOps(uv_loop_t *l, int &e);
        virtual ~IoOps();

        virtual lcb_socket_t socket(int domain, int type, int protocol);
        virtual int connect(lcb_socket_t sock,
                            const struct sockaddr *name,
                            unsigned int namelen);
        virtual void close(lcb_socket_t sock);
        virtual lcb_ssize_t recvv(lcb_socket_t sock,
                                  struct lcb_iovec_st *iov,
                                  lcb_size_t niov);
        virtual lcb_ssize_t sendv(lcb_socket_t sock,
                                  struct lcb_iovec_st *iov,
                                  lcb_size_t niov);
        virtual void *createTimer(void);
        virtual void destroyTimer(void *tim);
        virtual void deleteTimer(void *tim);
        virtual int updateTimer(void *tim,
                                lcb_uint32_t usec,
                                void *cb_data,
                                void handler(lcb_socket_t sock,
                                             short which,
                                             void *cb_data));
        virtual void *createEvent(void);
        virtual void destroyEvent(void *ev);
        virtual void deleteEvent(lcb_socket_t sock, void *ev);
        virtual int updateEvent(lcb_socket_t sock,
                                void *ev,
                                short flags,
                                void *cb_data,
                                void handler(lcb_socket_t sock,
                                             short which,
                                             void *cb_data));

        virtual void notifyIO(Socket *sock);

    protected:
        Socket *getSocket(lcb_socket_t sock);
        void reapEvents(void);
        void reapTimers(void);
        void reapSockets(void);
        virtual void reapObjects(void);

        uv_loop_t *loop;
        int &error;
        SocketMap socketmap;
        int socketcounter;
        std::map<Socket *, Event *> eventMap;

        std::list<Event*> eventReapList;
        std::list<Timer*> timerReapList;
        std::list<Socket*> socketReapList;
    };


    std::ostream& operator <<(std::ostream &out, SocketState &state)
    {
        switch (state) {
        case Initialized:
            out << "Initialized";
            break;
        case Connecting:
            out << "Connecting";
            break;
        case Connected :
            out << "Connected";
            break;
        case ConnectRefused:
            out << "ConnectRefused";
            break;
        case Shutdown :
            out << "Shutdown";
            break;
        default:
            out << "invalid state" << (int)state;
        }

        return out;
    }

    class LoggingSocket : public Socket {
    public:
        LoggingSocket(IoOps &p, uv_loop_t *l, int &e) : Socket(p, l, e) {
            ScopeLogger sl("LoggingSocket");
        }
        virtual ~LoggingSocket() {
            ScopeLogger sl("~LoggingSocket");
        }

        virtual void onConnect(int status) {
            std::stringstream ss;
            ss << "Socket::onConnect(" << status << ") - " << this;
            ScopeLogger sl(ss.str());
            Socket::onConnect(status);
        }

        virtual void onRead(ssize_t nread, uv_buf_t buf) {
            std::stringstream ss;
            ss << "Socket::onRead(" << nread << ", xxx) - " << this;
            ScopeLogger sl(ss.str());
            Socket::onRead(nread, buf);
        }

        virtual void onChunkSent(int status) {
            std::stringstream ss;
            ss << "Socket::onChunkSent(" << status << ") - " << this;
            ScopeLogger sl(ss.str());
            Socket::onChunkSent(status);
        }

        virtual int connect(const struct sockaddr *name, unsigned int namelen) {
            std::stringstream ss;
            ss << "Socket::connect(xxx, xxx) - " << this << " in state "
               << state;
            logger.enter(ss.str());
            int ret = Socket::connect(name, namelen);
            ss << " returns " << ret;

            if (ret == -1) {
                ss << " (" << strerror(error) << ")";
            }

            logger.exit(ss.str());
            return ret;
        }

        virtual lcb_ssize_t recvv(struct lcb_iovec_st *iov, lcb_size_t niov) {
            std::stringstream ss;
            ss << "Socket::recvv(xxx, xxx) - " << this;
            logger.enter(ss.str());
            int ret = Socket::recvv(iov, niov);
            ss << " returns " << ret;
            if (ret == -1) {
                ss << " (" << strerror(error) << ")";
            }
            logger.exit(ss.str());
            return ret;
        }

        virtual lcb_ssize_t sendv(struct lcb_iovec_st *iov, lcb_size_t niov) {
            std::stringstream ss;
            ss << "Socket::sendv(xxx, xxx) - " << this;
            logger.enter(ss.str());
            int ret = Socket::sendv(iov, niov);
            ss << " returns " << ret;
            if (ret == -1) {
                ss << " (" << strerror(error) << ")";
            }
            logger.exit(ss.str());
            return ret;
        }

    protected:
        virtual void sendData(void) {
            std::stringstream ss;
            ss << "Socket::sendData() - " << this;
            ScopeLogger sl(ss.str());
            Socket::sendData();
        }

        virtual void disconnect(void) {
            std::stringstream ss;
            ss << "Socket::disconnect() - " << this;
            ScopeLogger sl(ss.str());
            Socket::disconnect();
        }
    };

    class LoggingTimer : public Timer {
    public:
        LoggingTimer(IoOps &p, uv_loop_t *l) : Timer(p, l) {
            ScopeLogger sl("LoggingTimer");
        }

        virtual ~LoggingTimer() {
            ScopeLogger sl("~LoggingTimer");
        }

        virtual void deactivate(void) {
            std::stringstream ss;
            ss << "Timer::deactivate() - " << this;
            ScopeLogger sl(ss.str());
            Timer::deactivate();
        }

        virtual int updateTimer(lcb_uint32_t usec,
                                void *cbd,
                                void h(lcb_socket_t sock,
                                       short which,
                                       void *cb_data)) {
            {
                std::stringstream ss;
                ss << "Timer::updateTimer("
                   << usec/1000 << "ms, "
                   << cb_data << ", "
                   << handler << ") " << this;
                logger.enter(ss);
            }

            int ret = Timer::updateTimer(usec, cbd, h);
            {
                std::stringstream ss;
                ss << "Timer::updateTimer " << this << " returns " << ret;
                logger.exit(ss);
            }
            return ret;
        }

        virtual void fire() {
            std::stringstream ss;
            ss << "Timer::fire() - " << this;
            ScopeLogger sl(ss.str());
            Timer::fire();
        }
    };

    class LoggingEvent : public Event {
    public:
        LoggingEvent(IoOps &p, uv_loop_t *l) : Event(p, l) {
            ScopeLogger sl("LoggingEvent");
        }

        virtual ~LoggingEvent() {
            ScopeLogger sl("~LoggingEvent");
        }

        virtual void deactivate(void) {
            std::stringstream ss;
            ss << "Event::deactivate() - " << this;
            ScopeLogger sl(ss.str());
            Event::deactivate();
        }

        virtual int updateEvent(Socket *sock,
                                lcb_socket_t sid,
                                short fl,
                                void *cb,
                                void h(lcb_socket_t sock,
                                       short which,
                                       void *cb_data)) {
            {
                const char *msg;

                if (fl == LCB_READ_EVENT) {
                    msg = "LCB_READ_EVENT";
                } else if (fl == LCB_WRITE_EVENT) {
                    msg = "LCB_WRITE_EVENT";
                } else if (fl == LCB_RW_EVENT) {
                    msg = "LCB_RW_EVENT";
                } else {
                    abort();
                }
                std::stringstream ss;
                ss << "Event::updateEvent("
                   << sock << ", "
                   << sid << ", "
                   << msg << ", "
                   << cb << ", "
                   << h << ") - " << this;
                logger.enter(ss);
            }

            int ret = Event::updateEvent(sock, sid, fl, cb, h);
            {
                std::stringstream ss;
                ss << "Event::updateEvent() - " << this << " returns " << ret;
                logger.exit(ss);
            }
            return ret;

        }

        virtual void notify(void) {
            short notifyFlags = LCB_RW_EVENT & flags;
            std::stringstream ss;
            ss << "Event::notify(" << socketId << ", ";

            if (notifyFlags == LCB_READ_EVENT) {
                ss << "LCB_READ_EVENT";
            } else if (notifyFlags == LCB_WRITE_EVENT) {
                ss << "LCB_WRITE_EVENT";
            } else {
                ss << "LCB_RW_EVENT";
            }
            ss << ", " << cb_data << ") " << this;

            ScopeLogger sl(ss.str());
            Event::notify();
        }

        virtual void fire() {
            std::stringstream ss;
            ss << "Event::fire() - " << this;
            ScopeLogger sl(ss.str());
            Event::fire();
        }
    };

    class LoggingIoOps : public IoOps {
    public:
        LoggingIoOps(uv_loop_t *l, int &e) : IoOps(l, e) {
            ScopeLogger sl("LoggingIoOps");
        }

        ~LoggingIoOps() {
            ScopeLogger sl("~LoggingIoOps");
        }

        virtual lcb_socket_t socket(int domain, int type, int protocol) {
            {
                std::stringstream ss;
                ss << "IoOps::socket(" << domain << ", " << type << ", "
                   << protocol << ")";
                logger.enter(ss);
            }
            Socket *sock = new LoggingSocket(*this, loop, error);
            socketmap[socketcounter] = sock;
            lcb_socket_t ret = socketcounter++;

            {
                std::stringstream ss;
                ss << "IoOps::socket() returns " << ret;
                logger.exit(ss);
            }
            return ret;
        }

        virtual int connect(lcb_socket_t sock,
                            const struct sockaddr *name,
                            unsigned int namelen) {
            {
                std::stringstream ss;
                ss << "IoOps::connect(" << sock << ", ...)";
                logger.enter(ss);
            }
            int ret = IoOps::connect(sock, name, namelen);
            {
                std::stringstream ss;
                ss << "IoOps::connect() returns " << ret;
                if (ret == -1) {
                    ss << " (" << error << " - " << strerror(error) << ")";
                }
                logger.exit(ss);
            }

            return ret;
        }

        virtual void close(lcb_socket_t sock) {
            std::stringstream ss;
            ss << "IoOps::close(" << sock << ")";
            ScopeLogger sl(ss.str());
            IoOps::close(sock);
        }

        virtual lcb_ssize_t recvv(lcb_socket_t sock,
                                  struct lcb_iovec_st *iov,
                                  lcb_size_t niov) {
            {
                std::stringstream ss;
                ss << "IoOps::recvv(" << sock << ", "
                   << iov << ", " << niov << ")";
                logger.enter(ss);
            }
            lcb_ssize_t ret = IoOps::recvv(sock, iov, niov);
            {
                std::stringstream ss;
                ss << "IoOps::recvv(" << sock << ", ..) returns " << ret;
                if (ret == -1) {
                    ss << " (" << error << " - " << strerror(error) << ")";
                }
                logger.exit(ss);
            }

            return ret;
        }

        virtual lcb_ssize_t sendv(lcb_socket_t sock,
                                  struct lcb_iovec_st *iov,
                                  lcb_size_t niov) {
            {
                std::stringstream ss;
                ss << "IoOps::sendv(" << sock << ", "
                   << iov << ", " << niov << ")";
                logger.enter(ss);
            }
            lcb_ssize_t ret = IoOps::sendv(sock, iov, niov);
            {
                std::stringstream ss;
                ss << "IoOps::sendv(" << sock << ", ..) returns " << ret;
                if (ret == -1) {
                    ss << " (" << error << " - " << strerror(error) << ")";
                }
                logger.exit(ss);
            }

            return ret;
        }

        virtual void *createTimer(void) {
            // @todo override me to use my own logging class
            logger.enter("IoOps::createTimer()");
            void *timer = (void*)new LoggingTimer(*this, loop);
            std::stringstream ss;
            ss << "IoOps::createTimer() returns " << timer;
            logger.exit(ss);
            return timer;
        }

        virtual void destroyTimer(void *tim) {
            std::stringstream ss;
            ss << "IoOps::destroyTimer(" << tim << ")";
            logger.enter(ss);
            IoOps::destroyTimer(tim);
            logger.exit(ss);
        }

        virtual void deleteTimer(void *tim) {
            std::stringstream ss;
            ss << "IoOps::deleteTimer(" << tim << ")";
            logger.enter(ss);
            IoOps::deleteTimer(tim);
            logger.exit(ss);
        }

        virtual int updateTimer(void *tim,
                                lcb_uint32_t usec,
                                void *cb_data,
                                void handler(lcb_socket_t sock,
                                             short which,
                                             void *cb_data)) {
            {
                std::stringstream ss;
                ss << "IoOps::updateTimer(" << tim
                   << ", " << usec << "us, 0x" << cb_data << ", " << handler
                   << ")";
                logger.enter(ss);
            }
            int ret = IoOps::updateTimer(tim, usec, cb_data, handler);
            {
                std::stringstream ss;
                ss  << "IoOps::updateTimer() returns " << ret;
                logger.exit(ss);
            }
            return ret;
        }

        virtual void *createEvent(void) {
            logger.enter("IoOps::createEvent()");
            void *ret = IoOps::createEvent();
            std::stringstream ss;
            ss << "IoOps::createEvent() returns " << ret;
            logger.exit(ss);
            return ret;
        }

        virtual void destroyEvent(void *ev) {
            std::stringstream ss;
            ss << "IoOps::destroyEvent(" << ev << ")";
            logger.enter(ss);
            IoOps::destroyEvent(ev);
            logger.exit(ss);
        }

        virtual void deleteEvent(lcb_socket_t sock, void *ev) {
            std::stringstream ss;
            ss << "IoOps::deleteEvent(" << sock << ", " << ev << ")";
            logger.enter(ss);
            IoOps::deleteEvent(sock, ev);
            logger.exit(ss);
        }

        virtual int updateEvent(lcb_socket_t sock,
                                void *ev,
                                short flags,
                                void *cb_data,
                                void handler(lcb_socket_t sock,
                                             short which,
                                             void *cb_data)) {
            {
                const char *msg;

                if (flags == LCB_READ_EVENT) {
                    msg = "LCB_READ_EVENT";
                } else if (flags == LCB_WRITE_EVENT) {
                    msg = "LCB_WRITE_EVENT";
                } else if (flags == LCB_RW_EVENT) {
                    msg = "LCB_RW_EVENT";
                } else {
                    abort();
                }
                std::stringstream ss;
                ss << "IoOps::updateEvent(" << sock << ", "
                   << ev << ", " << msg << ", " << cb_data
                   << ", " << handler
                   << ")";
                logger.enter(ss);
            }
            int ret = IoOps::updateEvent(sock, ev, flags, cb_data, handler);
            {
                std::stringstream ss;
                ss << "IoOps::updateEvent() returns " << ret;
                logger.exit(ss);
            }

            return ret;
        }

        virtual void notifyIO(Socket *sock) {
            std::stringstream ss;
            ss << "IoOps::notifyIO(" << sock << ")";
            logger.enter(ss);
            IoOps::notifyIO(sock);
            logger.exit(ss);
        }

    protected:
        virtual void reapObjects(void) {
            ScopeLogger sl("IoOps::reapOjects");
            IoOps::reapObjects();
        }
    };
}
