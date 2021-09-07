#include "logger.h"

namespace couchnode
{

Logger::Logger(Local<Function> callback)
    : _enabled(true)
    , _callback(callback)
    , _logBuffer(nullptr)
    , _logBufferLen(0)
{
    lcb_logger_create(&_lcbLogger, this);
    lcb_logger_callback(_lcbLogger, &lcbHandler);
}

Logger::~Logger()
{
    lcb_logger_destroy(_lcbLogger);
    _lcbLogger = nullptr;
}

const lcb_LOGGER *Logger::lcbProcs() const
{
    return _lcbLogger;
}

void Logger::disconnect()
{
    _enabled = false;
}

void Logger::handler(unsigned int iid, const char *subsys, int severity,
                     const char *srcfile, int srcline, const char *fmt,
                     va_list ap)
{
    if (!_enabled) {
        return;
    }

    Nan::HandleScope scope;
    va_list apCopy;

    if (!_logBuffer) {
        _logBufferLen = 2048;
        _logBuffer = new char[_logBufferLen];
    }

    // Due the fact that the call to vsnprintf modifies the va_list itself, we
    // cannot invoke vsnprintf twice, in order to get around this, we copy this
    // list for the first call and then use the original list if needed for the
    // second call.
    va_copy(apCopy, ap);

    int genLen = vsnprintf(_logBuffer, _logBufferLen, fmt, apCopy);
    if (genLen >= _logBufferLen) {
        _logBufferLen = genLen + 1;
        delete[] _logBuffer;
        _logBuffer = new char[_logBufferLen];
        vsnprintf(_logBuffer, _logBufferLen, fmt, ap);
    }

    va_end(apCopy);

    Local<Object> infoObj = Nan::New<Object>();
    Nan::Set(infoObj, Nan::New<String>("severity").ToLocalChecked(),
             Nan::New(severity));
    Nan::Set(infoObj, Nan::New<String>("srcFile").ToLocalChecked(),
             Nan::New(srcfile).ToLocalChecked());
    Nan::Set(infoObj, Nan::New<String>("srcLine").ToLocalChecked(),
             Nan::New(srcline));
    Nan::Set(infoObj, Nan::New<String>("subsys").ToLocalChecked(),
             Nan::New(subsys).ToLocalChecked());
    Nan::Set(infoObj, Nan::New<String>("message").ToLocalChecked(),
             Nan::New(_logBuffer).ToLocalChecked());

    Local<Value> args[] = {infoObj};
    Nan::Call(_callback, 1, args);
}

void Logger::lcbHandler(const lcb_LOGGER *procs, uint64_t iid,
                        const char *subsys, lcb_LOG_SEVERITY severity,
                        const char *srcfile, int srcline, const char *fmt,
                        va_list ap)
{
    Logger *logger;
    lcb_logger_cookie(procs, reinterpret_cast<void **>(&logger));
    logger->handler(iid, subsys, severity, srcfile, srcline, fmt, ap);
}

} // namespace couchnode
