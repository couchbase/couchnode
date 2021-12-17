#pragma once
#ifndef INSTANCE_H
#define INSTANCE_H

#include "addondata.h"
#include "cookie.h"
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

class Instance
{
public:
    static inline Instance *fromLcbInst(lcb_INSTANCE *instance)
    {
        void *cookie = const_cast<void *>(lcb_get_cookie(instance));
        Instance *inst = reinterpret_cast<Instance *>(cookie);
        return inst;
    }

    Instance(lcb_INSTANCE *instance, Logger *logger, RequestTracer *tracer,
             Meter *meter);
    ~Instance();

    lcb_INSTANCE *lcbHandle() const
    {
        return _instance;
    }

    void shutdown();

    const char *bucketName();
    const char *clientString();

    static void uvFlushHandler(uv_prepare_t *handle);
    static void uvShutdownHandler(uv_check_t *handle);
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

    AddonData *_parent;
    class Connection *_connection;
    lcb_INSTANCE *_instance;
    Logger *_logger;
    RequestTracer *_tracer;
    Meter *_meter;
    uv_prepare_t *_flushWatch;
    uv_check_t *_shutdownProc;
    const char *_clientStringCache;

    Cookie *_bootstrapCookie;
    Cookie *_openCookie;
};

} // namespace couchnode

#endif // CONNECTION_H
