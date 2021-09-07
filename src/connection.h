#pragma once
#ifndef CONNECTION_H
#define CONNECTION_H

#include "addondata.h"
#include "cookie.h"
#include "instance.h"
#include "logger.h"
#include "metrics.h"
#include "tracing.h"
#include "valueparser.h"

#include <libcouchbase/couchbase.h>
#include <libcouchbase/libuv_io_opts.h>
#include <nan.h>
#include <node.h>

namespace couchnode
{

using namespace v8;

class Connection : public Nan::ObjectWrap
{
public:
    static NAN_MODULE_INIT(Init);

    static inline Nan::Persistent<Function> &constructor()
    {
        return addondata::Get()->_connectionConstructor;
    }

    Connection(Instance *instance);
    ~Connection();

    Instance *_instance;

private:
    static NAN_METHOD(fnNew);

    static NAN_METHOD(fnConnect);
    static NAN_METHOD(fnSelectBucket);
    static NAN_METHOD(fnShutdown);
    static NAN_METHOD(fnCntl);

    static NAN_METHOD(fnGet);
    static NAN_METHOD(fnExists);
    static NAN_METHOD(fnGetReplica);
    static NAN_METHOD(fnStore);
    static NAN_METHOD(fnRemove);
    static NAN_METHOD(fnTouch);
    static NAN_METHOD(fnUnlock);
    static NAN_METHOD(fnCounter);
    static NAN_METHOD(fnLookupIn);
    static NAN_METHOD(fnMutateIn);
    static NAN_METHOD(fnViewQuery);
    static NAN_METHOD(fnQuery);
    static NAN_METHOD(fnSearchQuery);
    static NAN_METHOD(fnAnalyticsQuery);
    static NAN_METHOD(fnHttpRequest);
    static NAN_METHOD(fnPing);
    static NAN_METHOD(fnDiag);
};

} // namespace couchnode

#endif // CONNECTION_H
