#pragma once
#ifndef CONNECTION_H
#define CONNECTION_H

#include "cookie.h"
#include "logger.h"
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
        static Nan::Persistent<Function> class_constructor;
        return class_constructor;
    }

    lcb_INSTANCE *lcbHandle() const
    {
        return _instance;
    }

    const char *bucketName();
    const char *clientString();

    static inline Connection *fromInstance(lcb_INSTANCE *instance)
    {
        void *cookie = const_cast<void *>(lcb_get_cookie(instance));
        Connection *conn = reinterpret_cast<Connection *>(cookie);
        return conn;
    }

private:
    Connection(lcb_INSTANCE *instance, Logger *logger);
    ~Connection();

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

    static void uvFlushHandler(uv_prepare_t *handle);
    static void lcbRegisterCallbacks(lcb_INSTANCE *instance);
    static void lcbBootstapHandler(lcb_INSTANCE *instance, lcb_STATUS err);
    static void lcbOpenHandler(lcb_INSTANCE *instance, lcb_STATUS err);
    static void lcbGetRespHandler(lcb_INSTANCE *instance, int cbtype,
                                  const lcb_RESPGET *resp);
    static void lcbExistsRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPEXISTS *resp);
    static void lcbGetReplicaRespHandler(lcb_INSTANCE *instance, int cbtype,
                                         const lcb_RESPGETREPLICA *resp);
    static void lcbUnlockRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPUNLOCK *resp);
    static void lcbRemoveRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPREMOVE *resp);
    static void lcbTouchRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPTOUCH *resp);
    static void lcbStoreRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPSTORE *resp);
    static void lcbCounterRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPCOUNTER *resp);
    static void lcbLookupRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPSUBDOC *resp);
    static void lcbMutateRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPSUBDOC *resp);
    static void lcbViewDataHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPVIEW *resp);
    static void lcbQueryDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPQUERY *resp);
    static void lcbAnalyticsDataHandler(lcb_INSTANCE *instance, int cbtype,
                                        const lcb_RESPANALYTICS *resp);
    static void lcbSearchDataHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPSEARCH *resp);
    static void lcbPingRespHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPPING *resp);
    static void lcbDiagRespHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPDIAG *resp);
    static void lcbHttpDataHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPHTTP *resp);

    lcb_INSTANCE *_instance;
    Logger *_logger;
    uv_prepare_t _flushWatch;
    const char *_clientStringCache;

    Cookie *_bootstrapCookie;
    Cookie *_openCookie;
};

} // namespace couchnode

#endif // CONNECTION_H
