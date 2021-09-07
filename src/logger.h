#pragma once
#ifndef LOGGER_H
#define LOGGER_H

#include <libcouchbase/couchbase.h>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class Logger
{
public:
    Logger(Local<Function> callback);
    ~Logger();

    const lcb_LOGGER *lcbProcs() const;

    void disconnect();

private:
    void handler(unsigned int iid, const char *subsys, int severity,
                 const char *srcfile, int srcline, const char *fmt, va_list ap);

    static void lcbHandler(const lcb_LOGGER *procs, uint64_t iid,
                           const char *subsys, lcb_LOG_SEVERITY severity,
                           const char *srcfile, int srcline, const char *fmt,
                           va_list ap);

    bool _enabled;
    lcb_LOGGER *_lcbLogger;
    Nan::Callback _callback;
    char *_logBuffer;
    int _logBufferLen;
};

} // namespace couchnode

#endif // LOGGER_H
