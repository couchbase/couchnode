#pragma once
#ifndef LOGGER_H
#define LOGGER_H

#include <libcouchbase/couchbase.h>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class Logger : public lcb_logprocs_st, public Nan::AsyncResource
{
public:
    Logger(Local<Function> callback);

    const lcb_logprocs_st *lcbProcs() const;

private:
    void handler(unsigned int iid, const char *subsys, int severity,
                 const char *srcfile, int srcline, const char *fmt, va_list ap);

    static void lcbHandler(struct lcb_logprocs_st *procs, unsigned int iid,
                           const char *subsys, int severity,
                           const char *srcfile, int srcline, const char *fmt,
                           va_list ap);

    Nan::Callback _callback;
    char *_logBuffer;
    int _logBufferLen;
};

} // namespace couchnode

#endif // LOGGER_H