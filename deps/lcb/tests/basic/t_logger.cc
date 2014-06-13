#include "config.h"
#include <gtest/gtest.h>
#include <libcouchbase/couchbase.h>
#include "logging.h"
#include "internal.h"
#include <list>

using namespace std;

class Logger : public ::testing::Test
{
};


struct MyLogprocs : lcb_logprocs {
    set<string> messages;
};

extern "C" {
static void fallback_logger(lcb_logprocs *procs, unsigned int,
                            const char *, int, const char *,
                            int, const char *fmt, va_list ap)
{
    char buf[2048];
    vsprintf(buf, fmt, ap);
    EXPECT_FALSE(procs == NULL);
    MyLogprocs *myprocs = static_cast<MyLogprocs *>(procs);
    myprocs->messages.insert(buf);
}
}

TEST_F(Logger, testLogger)
{
    lcb_t instance;
    lcb_error_t err;

    lcb_create(&instance, NULL);
    MyLogprocs procs;
    lcb_logprocs *ptrprocs = static_cast<lcb_logprocs *>(&procs);
    ptrprocs->version = 0;
    memset(ptrprocs, 0, sizeof(*ptrprocs));

    err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_LOGGER, ptrprocs);
    ASSERT_EQ(LCB_SUCCESS, err);

    procs.v.v0.callback = fallback_logger;

    LCB_LOG_BASIC(instance->getSettings(), "foo");
    LCB_LOG_BASIC(instance->getSettings(), "bar");
    LCB_LOG_BASIC(instance->getSettings(), "baz");

    set<string>& msgs = procs.messages;
    ASSERT_FALSE(msgs.find("foo") == msgs.end());
    ASSERT_FALSE(msgs.find("bar") == msgs.end());
    ASSERT_FALSE(msgs.find("baz") == msgs.end());
    msgs.clear();

    // Try without a logger
    err = lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_LOGGER, NULL);
    ASSERT_EQ(LCB_SUCCESS, err);
    LCB_LOG_BASIC(instance->getSettings(), "this should not appear");
    ASSERT_TRUE(msgs.empty());

    lcb_destroy(instance);
}
