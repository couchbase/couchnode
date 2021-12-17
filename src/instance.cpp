#include "instance.h"
#include "connection.h"

#include "error.h"
#include "logger.h"

namespace couchnode
{

Instance::Instance(lcb_INSTANCE *instance, Logger *logger,
                   RequestTracer *tracer, Meter *meter)
    : _connection(nullptr)
    , _instance(instance)
    , _logger(logger)
    , _tracer(tracer)
    , _meter(meter)
    , _clientStringCache(nullptr)
    , _bootstrapCookie(nullptr)
    , _openCookie(nullptr)
{
    _parent = addondata::Get();
    _parent->add_instance(this);

    _flushWatch = new uv_prepare_t();
    uv_prepare_init(Nan::GetCurrentEventLoop(), _flushWatch);
    _flushWatch->data = this;

    _shutdownProc = new uv_check_t();
    uv_check_init(Nan::GetCurrentEventLoop(), _shutdownProc);
    _shutdownProc->data = this;

    lcb_set_cookie(instance, reinterpret_cast<void *>(this));
    lcb_set_bootstrap_callback(instance, &lcbBootstapHandler);
    lcb_set_open_callback(instance, &lcbOpenHandler);
    lcb_install_callback(
        instance, LCB_CALLBACK_GET,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbGetRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_EXISTS,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbExistsRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_GETREPLICA,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbGetReplicaRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_STORE,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbStoreRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_COUNTER,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbCounterRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_REMOVE,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbRemoveRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_TOUCH,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbTouchRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_UNLOCK,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbUnlockRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_SDLOOKUP,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbLookupRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_SDMUTATE,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbMutateRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_PING,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbPingRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_DIAG,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbDiagRespHandler));
    lcb_install_callback(
        instance, LCB_CALLBACK_HTTP,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbHttpDataHandler));
}

Instance::~Instance()
{
    if (_connection) {
        _connection->_instance = nullptr;
        _connection = nullptr;
    }

    if (_parent) {
        _parent->remove_instance(this);
        _parent = nullptr;
    }

    if (_flushWatch) {
        uv_prepare_stop(_flushWatch);
        uv_close(reinterpret_cast<uv_handle_t *>(_flushWatch),
                 [](uv_handle_t *handle) { delete handle; });
        _flushWatch = nullptr;
    }

    if (_shutdownProc) {
        uv_check_stop(_shutdownProc);
        uv_close(reinterpret_cast<uv_handle_t *>(_shutdownProc),
                 [](uv_handle_t *handle) { delete handle; });
        _shutdownProc = nullptr;
    }

    if (_instance) {
        lcb_destroy(_instance);
        _instance = nullptr;
    }

    // If there is a custom hooks registered, we need to deactivate them here
    // since the GC might be the one invoking us, which will cause problems
    // as we can't call into v8 during garbage collection.
    if (_logger) {
        _logger->disconnect();
    }
    if (_tracer) {
        _tracer->disconnect();
    }
    if (_meter) {
        _meter->disconnect();
    }

    if (_logger) {
        delete _logger;
        _logger = nullptr;
    }
    // tracer is destroyed by libcouchbase
    // meter is destroyed by libcouchbase

    if (_clientStringCache) {
        delete[] _clientStringCache;
        _clientStringCache = nullptr;
    }
    if (_bootstrapCookie) {
        delete _bootstrapCookie;
        _bootstrapCookie = nullptr;
    }
    if (_openCookie) {
        delete _openCookie;
        _openCookie = nullptr;
    }
}

void Instance::uvShutdownHandler(uv_check_t *handle)
{
    delete reinterpret_cast<Instance *>(handle->data);
}

void Instance::shutdown()
{
    uv_check_start(_shutdownProc, &uvShutdownHandler);
}

const char *Instance::bucketName()
{
    const char *value = nullptr;
    lcb_cntl(_instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &value);
    return value;
}

const char *Instance::clientString()
{
    // Check to see if our cache is already populated
    if (_clientStringCache) {
        return _clientStringCache;
    }

    // Fetch from libcouchbase if we have not done that yet.
    const char *lcbClientString;
    lcb_cntl(_instance, LCB_CNTL_GET, LCB_CNTL_CLIENT_STRING, &lcbClientString);
    if (!lcbClientString) {
        // Backup string in case something goes wrong
        lcbClientString = "couchbase-nodejs-sdk";
    }

    // Copy it to memory we own.
    int lcbClientStringLen = strlen(lcbClientString);
    char *allocString = new char[lcbClientStringLen + 1];
    memcpy(allocString, lcbClientString, lcbClientStringLen + 1);

    if (_clientStringCache) {
        delete[] _clientStringCache;
        _clientStringCache = nullptr;
    }
    _clientStringCache = allocString;

    return _clientStringCache;
}

void Instance::uvFlushHandler(uv_prepare_t *handle)
{
    Instance *me = reinterpret_cast<Instance *>(handle->data);
    lcb_sched_flush(me->_instance);
}

void Instance::lcbBootstapHandler(lcb_INSTANCE *instance, lcb_STATUS err)
{
    Instance *me = Instance::fromLcbInst(instance);

    if (err != 0) {
        lcb_set_bootstrap_callback(instance, [](lcb_INSTANCE *, lcb_STATUS) {});
        lcb_destroy_async(instance, NULL);
        me->_instance = nullptr;
    } else {
        uv_prepare_start(me->_flushWatch, &uvFlushHandler);

        int flushMode = 0;
        lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_SCHED_IMPLICIT_FLUSH,
                 &flushMode);
    }

    if (me->_bootstrapCookie) {
        Nan::HandleScope scope;

        Local<Value> args[] = {Error::create(err)};
        me->_bootstrapCookie->Call(1, args);

        delete me->_bootstrapCookie;
        me->_bootstrapCookie = nullptr;
    }
}

void Instance::lcbOpenHandler(lcb_INSTANCE *instance, lcb_STATUS err)
{
    Instance *me = Instance::fromLcbInst(instance);

    if (me->_openCookie) {
        Nan::HandleScope scope;

        Local<Value> args[] = {Error::create(err)};
        me->_openCookie->Call(1, args);

        delete me->_openCookie;
        me->_openCookie = nullptr;
    }
}

} // namespace couchnode
