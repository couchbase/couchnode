#include "logger.h"

namespace couchnode
{

Logger::Logger(Local<Function> callback)
    : Nan::AsyncResource("lcbLogger")
    , _callback(callback)
    , _logBuffer(nullptr)
    , _logBufferLen(0)
{
    this->version = 0;
    this->v.v0.callback = &lcbHandler;
}

const lcb_logprocs_st *Logger::lcbProcs() const
{
    return this;
}

void Logger::handler(unsigned int iid, const char *subsys, int severity,
                     const char *srcfile, int srcline, const char *fmt,
                     va_list ap)
{
    Nan::HandleScope scope;

    if (!_logBuffer) {
        _logBufferLen = 2048;
        _logBuffer = new char[_logBufferLen];
    }

    int genLen = vsnprintf(_logBuffer, _logBufferLen, fmt, ap);
    if (genLen >= _logBufferLen) {
        _logBufferLen = genLen + 1;
        delete[] _logBuffer;
        _logBuffer = new char[_logBufferLen];
        vsnprintf(_logBuffer, _logBufferLen, fmt, ap);
    }

    Local<Object> infoObj = Nan::New<Object>();
    infoObj->Set(Nan::New<String>("severity").ToLocalChecked(),
                 Nan::New(severity));
    infoObj->Set(Nan::New<String>("srcFile").ToLocalChecked(),
                 Nan::New(srcfile).ToLocalChecked());
    infoObj->Set(Nan::New<String>("srcLine").ToLocalChecked(),
                 Nan::New(srcline));
    infoObj->Set(Nan::New<String>("subsys").ToLocalChecked(),
                 Nan::New(subsys).ToLocalChecked());
    infoObj->Set(Nan::New<String>("message").ToLocalChecked(),
                 Nan::New(_logBuffer).ToLocalChecked());

    Local<Value> args[] = {infoObj};
    _callback.Call(Nan::New<Object>(), 1, args, this);
}

void Logger::lcbHandler(struct lcb_logprocs_st *procs, unsigned int iid,
                        const char *subsys, int severity, const char *srcfile,
                        int srcline, const char *fmt, va_list ap)
{
    Logger *logger = static_cast<Logger *>(procs);
    logger->handler(iid, subsys, severity, srcfile, srcline, fmt, ap);
}

} // namespace couchnode
