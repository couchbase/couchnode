/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
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
#include "couchbase_impl.h"

using namespace Couchnode;

// We take advantage of the fact that everything here is single-threaded
// and we can have only a single log buffer that is reused.
char *logBuffer = NULL;
int logBufferLen = 0;

extern "C" {
static void log_handler(struct lcb_logprocs_st *procs, unsigned int iid,
                        const char *subsys, int severity, const char *srcfile,
                        int srcline, const char *fmt, va_list ap)
{
    node_logger_st *logger = (node_logger_st *)procs;
    Nan::HandleScope scope;

    if (!logBuffer) {
        logBufferLen = 2048;
        logBuffer = new char[logBufferLen];
    }

    int genLen = vsnprintf(logBuffer, logBufferLen, fmt, ap);
    if (genLen >= logBufferLen) {
        logBufferLen = genLen + 1;
        delete[] logBuffer;
        logBuffer = new char[logBufferLen];
        vsnprintf(logBuffer, logBufferLen, fmt, ap);
    }

    Local<Object> infoObj = Nan::New<Object>();
    infoObj->Set(Nan::New(CouchbaseImpl::severityKey), Nan::New(severity));
    infoObj->Set(Nan::New(CouchbaseImpl::srcFileKey),
                 Nan::New(srcfile).ToLocalChecked());
    infoObj->Set(Nan::New(CouchbaseImpl::srcLineKey), Nan::New(srcline));
    infoObj->Set(Nan::New(CouchbaseImpl::subsysKey),
                 Nan::New(subsys).ToLocalChecked());
    infoObj->Set(Nan::New(CouchbaseImpl::messageKey),
                 Nan::New(logBuffer).ToLocalChecked());

    Local<Value> args[] = {infoObj};
    logger->callback.Call(1, args);
}
}

NAN_METHOD(CouchbaseImpl::fnSetLoggingCallback)
{
    CouchbaseImpl *me = ObjectWrap::Unwrap<CouchbaseImpl>(info.This());
    Nan::HandleScope scope;

    if (info.Length() != 1) {
        return info.GetReturnValue().Set(
            Error::create("invalid number of parameters passed"));
    }

    if (me->logger) {
        delete me->logger;
        me->logger = NULL;
    }

    if (info[0]->BooleanValue()) {
        if (!info[0]->IsFunction()) {
            return Nan::ThrowError(Error::create("must pass function"));
        }
    }

    node_logger_st *logger = new node_logger_st();
    logger->base.version = 0;
    logger->base.v.v0.callback = log_handler;
    logger->callback.Reset(info[0].As<Function>());
    me->logger = logger;

    lcb_error_t ec =
        lcb_cntl(me->instance, LCB_CNTL_SET, LCB_CNTL_LOGGER, logger);
    if (ec != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(ec));
    }

    return info.GetReturnValue().Set(true);
}
