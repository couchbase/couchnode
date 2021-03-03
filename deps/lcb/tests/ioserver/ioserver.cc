/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013-2021 Couchbase, Inc.
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

#include <sys/types.h>
#include "ioserver.h"
using namespace LCBTest;
using std::list;

extern "C" {
static void server_runfunc(void *arg)
{
    auto *server = (TestServer *)arg;
    server->run();
}
}

void TestServer::run()
{
    if (closed) {
        return;
    }

    fd_set fds;
    struct timeval tmout = {1, 0};

    FD_ZERO(&fds);
    FD_SET(*lsn, &fds);

    while (!closed) {
        struct sockaddr_in newaddr {
        };
        socklen_t naddr = sizeof(newaddr);

        if (select(*lsn + 1, &fds, nullptr, nullptr, &tmout) == 1) {
            int newsock = accept(*lsn, (struct sockaddr *)&newaddr, &naddr);

            if (newsock == -1) {
                break;
            }

            auto *newconn = new TestConnection(this, factory(newsock));
            startConnection(newconn);
        }
    }
}

void TestServer::startConnection(TestConnection *conn)
{
    mutex.lock();
    if (isClosed()) {
        conn->close();
        delete conn;
    } else {
        conns.push_back(conn);
    }
    mutex.unlock();
}

TestServer::TestServer()
{
    lsn = SockFD::newListener();
    closed = false;
    factory = plainSocketFactory;

    // Now spin up a thread to start the accept loop
    thr = new Thread(server_runfunc, this);
}

TestServer::~TestServer()
{
    close();
    mutex.lock();
    for (auto &conn : conns) {
        conn->close();
        delete conn;
    }
    mutex.unlock();
    // We don't want to explicitly call join() here since that
    // gets called in the destructor.  This is unncessary
    // and broken on musl.
    // thr->join();
    delete thr;
    mutex.close();
    delete lsn;
}

std::string TestServer::getPortString()
{
    char buf[4096];
    sprintf(buf, "%d", lsn->getLocalPort());
    return std::string(buf);
}

TestConnection *TestServer::findConnection(uint16_t port)
{
    TestConnection *ret = nullptr;

    while (ret == nullptr) {
        sched_yield();
        mutex.lock();
        for (auto &conn : conns) {
            if (conn->getPeerPort() == port) {
                ret = conn;
                break;
            }
        }
        mutex.unlock();
    }

    return ret;
}
