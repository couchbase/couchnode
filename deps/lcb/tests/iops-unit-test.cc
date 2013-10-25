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

#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>

typedef void (*TimerCallback)(lcb_socket_t, short, void *);

class IOPS : public ::testing::Test
{
public:
    virtual void SetUp() {
        lcb_error_t err = lcb_create_io_ops(&io, NULL);
        ASSERT_EQ(err, LCB_SUCCESS);
    }

    virtual void TearDown() {
        if (io) {
            lcb_destroy_io_ops(io);
            io = NULL;
        }
    }

    void *createTimer() {
        void *ret = io->v.v0.create_timer(io);
        EXPECT_TRUE(ret != NULL);
        return ret;
    }

    void cancelTimer(void *timer) {
        io->v.v0.delete_timer(io, timer);
    }

    void scheduleTimer(void *timer,
                       TimerCallback cb,
                       lcb_uint32_t us,
                       void *arg) {

        io->v.v0.update_timer(io, timer, us, arg, cb);
    }

    void freeTimer(void *timer) {
        io->v.v0.destroy_timer(io, timer);
    }

    void startLoop() {
        io->v.v0.run_event_loop(io);
    }

    void stopLoop() {
        io->v.v0.stop_event_loop(io);
    }

protected:
    lcb_io_opt_t io;
};


class Continuation
{
public:
    virtual void nextAction() = 0;
    IOPS *parent;

};



extern "C" {
    static void timer_callback(lcb_socket_t, short, void *arg)
    {
        reinterpret_cast<Continuation *>(arg)->nextAction();
    }
}

class TimerCountdown : public Continuation
{
public:
    int counter;
    void *timer;

    TimerCountdown(IOPS *self) {
        parent = self;
        counter = 1;
        timer = parent->createTimer();
    }

    virtual void nextAction() {
        EXPECT_TRUE(counter > 0);
        parent->cancelTimer(timer);
        counter--;
    }

    virtual ~TimerCountdown() {
        parent->cancelTimer(timer);
        parent->freeTimer(timer);
    }

    void reset() {
        parent->cancelTimer(timer);
        parent->freeTimer(timer);
        timer = parent->createTimer();
        counter = 1;
    }


private:
    TimerCountdown(const TimerCountdown &);
};

TEST_F(IOPS, Timers)
{
    TimerCountdown cont(this);
    scheduleTimer(cont.timer, timer_callback, 0, &cont);
    startLoop();
    ASSERT_EQ(0, cont.counter);

    std::vector<TimerCountdown *> multi;

    for (int ii = 0; ii < 10; ii++) {
        TimerCountdown *cur = new TimerCountdown(this);
        multi.push_back(cur);
        scheduleTimer(cur->timer, timer_callback, ii, cur);
    }

    startLoop();
    for (int ii = 0; ii < multi.size(); ii++) {
        TimerCountdown *cur = multi[ii];
        ASSERT_EQ(0, cur->counter);
        delete cur;
    }

    // Try it again..
    cont.reset();
    multi.clear();
    for (int ii = 0; ii < 10; ii++) {
        TimerCountdown *cur = new TimerCountdown(this);
        scheduleTimer(cur->timer, timer_callback, 10000000, cur);
        multi.push_back(cur);
    }

    scheduleTimer(cont.timer, timer_callback, 0, &cont);

    for (int ii = 0; ii < multi.size(); ii++) {
        TimerCountdown *cur = multi[ii];
        cancelTimer(cur->timer);
        cur->counter = 0;
    }

    startLoop();
    for (int ii = 0; ii < multi.size(); ii++) {
        delete multi[ii];
    }

}
