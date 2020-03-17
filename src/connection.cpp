#include "connection.h"

#include "error.h"
#include "logger.h"

namespace couchnode
{

Connection::Connection(lcb_INSTANCE *instance, Logger *logger)
    : _instance(instance)
    , _logger(logger)
    , _clientStringCache(nullptr)
    , _bootstrapCookie(nullptr)
    , _openCookie(nullptr)
{
    uv_prepare_init(uv_default_loop(), &_flushWatch);
    _flushWatch.data = this;
}

Connection::~Connection()
{
    if (_logger) {
        delete _logger;
        _logger = nullptr;
    }
    if (_clientStringCache) {
        delete _clientStringCache;
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

const char *Connection::bucketName()
{
    const char *value = nullptr;
    lcb_cntl(_instance, LCB_CNTL_GET, LCB_CNTL_BUCKETNAME, &value);
    return value;
}

const char *Connection::clientString()
{
    // Check to see if our cache is already populated
    if (_clientStringCache) {
        return _clientStringCache;
    }

    // Fetch from libcouchbase if we are not populated
    lcb_cntl(_instance, LCB_CNTL_GET, LCB_CNTL_CLIENT_STRING,
             &_clientStringCache);
    if (_clientStringCache) {
        return _clientStringCache;
    }

    // Backup string in case something goes wrong
    return "couchbase-nodejs-sdk";
}

NAN_MODULE_INIT(Connection::Init)
{
    Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>(fnNew);
    tpl->SetClassName(Nan::New<String>("CbConnection").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    Nan::SetPrototypeMethod(tpl, "connect", fnConnect);
    Nan::SetPrototypeMethod(tpl, "selectBucket", fnSelectBucket);
    Nan::SetPrototypeMethod(tpl, "shutdown", fnShutdown);
    Nan::SetPrototypeMethod(tpl, "cntl", fnCntl);
    Nan::SetPrototypeMethod(tpl, "get", fnGet);
    Nan::SetPrototypeMethod(tpl, "exists", fnExists);
    Nan::SetPrototypeMethod(tpl, "getReplica", fnGetReplica);
    Nan::SetPrototypeMethod(tpl, "store", fnStore);
    Nan::SetPrototypeMethod(tpl, "remove", fnRemove);
    Nan::SetPrototypeMethod(tpl, "touch", fnTouch);
    Nan::SetPrototypeMethod(tpl, "unlock", fnUnlock);
    Nan::SetPrototypeMethod(tpl, "counter", fnCounter);
    Nan::SetPrototypeMethod(tpl, "lookupIn", fnLookupIn);
    Nan::SetPrototypeMethod(tpl, "mutateIn", fnMutateIn);
    Nan::SetPrototypeMethod(tpl, "viewQuery", fnViewQuery);
    Nan::SetPrototypeMethod(tpl, "query", fnQuery);
    Nan::SetPrototypeMethod(tpl, "analyticsQuery", fnAnalyticsQuery);
    Nan::SetPrototypeMethod(tpl, "searchQuery", fnSearchQuery);
    Nan::SetPrototypeMethod(tpl, "httpRequest", fnHttpRequest);
    Nan::SetPrototypeMethod(tpl, "ping", fnPing);
    Nan::SetPrototypeMethod(tpl, "diag", fnDiag);

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());

    Nan::Set(target, Nan::New("Connection").ToLocalChecked(),
             Nan::GetFunction(tpl).ToLocalChecked());
}

NAN_METHOD(Connection::fnNew)
{
    Nan::HandleScope scope;

    if (info.Length() != 5) {
        return Nan::ThrowError(Error::create("expected 4 parameters"));
    }

    lcb_STATUS err;

    lcb_io_opt_st *iops;
    lcbuv_options_t iopsOptions;

    iopsOptions.version = 0;
    iopsOptions.v.v0.loop = uv_default_loop();
    iopsOptions.v.v0.startsop_noop = 1;

    err = lcb_create_libuv_io_opts(0, &iops, &iopsOptions);
    if (err != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(err));
    }

    lcb_INSTANCE_TYPE connType = LCB_TYPE_BUCKET;
    if (!info[0]->IsUndefined() && !info[0]->IsNull()) {
        if (!info[0]->IsNumber()) {
            return Nan::ThrowError(
                Error::create("must pass enum integer for connType"));
        }

        connType = static_cast<lcb_INSTANCE_TYPE>(
            Nan::To<uint32_t>(info[0]).ToChecked());
    }

    lcb_CREATEOPTS *createOpts = nullptr;
    lcb_createopts_create(&createOpts, connType);

    Nan::Utf8String *utfConnStr = NULL;
    if (!info[1]->IsUndefined() && !info[1]->IsNull()) {
        if (!info[1]->IsString()) {
            return Nan::ThrowError(
                Error::create("must pass string for connStr"));
        }
        utfConnStr = new Nan::Utf8String(info[1]);

        lcb_createopts_connstr(createOpts, **utfConnStr, utfConnStr->length());
    }

    Nan::Utf8String *utfUsername = NULL;
    if (!info[2]->IsUndefined() && !info[2]->IsNull()) {
        if (!info[2]->IsString()) {
            return Nan::ThrowError(
                Error::create("must pass string for username"));
        }
        utfUsername = new Nan::Utf8String(info[2]);
    }

    Nan::Utf8String *utfPassword = NULL;
    if (!info[3]->IsUndefined() && !info[3]->IsNull()) {
        if (!info[3]->IsString()) {
            return Nan::ThrowError(
                Error::create("must pass string for password"));
        }
        utfPassword = new Nan::Utf8String(info[3]);
    }

    if (utfUsername && utfPassword) {
        lcb_createopts_credentials(createOpts, **utfUsername,
                                   utfUsername->length(), **utfPassword,
                                   utfPassword->length());
    } else if (utfUsername) {
        lcb_createopts_credentials(createOpts, **utfUsername,
                                   utfUsername->length(), nullptr, 0);
    } else if (utfPassword) {
        lcb_createopts_credentials(createOpts, nullptr, 0, **utfPassword,
                                   utfPassword->length());
    }

    Logger *logger = nullptr;
    if (!info[4]->IsUndefined() && !info[4]->IsNull()) {
        if (!info[4]->IsFunction()) {
            return Nan::ThrowError(
                Error::create("must pass function for logger"));
        }
        Local<Function> logFn = info[4].As<Function>();
        if (!logFn.IsEmpty()) {
            logger = new Logger(logFn);

            // We secretly remove the constness of the lcbprocs here due to the
            // create options taking a non-const in error.
            lcb_createopts_logger(createOpts, logger->lcbProcs());
        }
    }

    lcb_createopts_io(createOpts, iops);

    lcb_INSTANCE *instance;
    err = lcb_create(&instance, createOpts);

    lcb_createopts_destroy(createOpts);

    if (utfConnStr) {
        delete utfConnStr;
    }
    if (utfUsername) {
        delete utfUsername;
    }
    if (utfPassword) {
        delete utfPassword;
    }

    if (err != LCB_SUCCESS) {
        if (logger) {
            delete logger;
        }

        return Nan::ThrowError(Error::create(err));
    }

    Connection *obj = new Connection(instance, logger);
    obj->Wrap(info.This());

    lcb_set_cookie(instance, reinterpret_cast<void *>(obj));
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

    info.GetReturnValue().Set(info.This());
}

void Connection::uvFlushHandler(uv_prepare_t *handle)
{
    Connection *me = reinterpret_cast<Connection *>(handle->data);
    lcb_sched_flush(me->_instance);
}

void Connection::lcbBootstapHandler(lcb_INSTANCE *instance, lcb_STATUS err)
{
    Connection *me = Connection::fromInstance(instance);

    if (err != 0) {
        lcb_set_bootstrap_callback(instance, [](lcb_INSTANCE *, lcb_STATUS) {});
        lcb_destroy_async(instance, NULL);
    } else {
        uv_prepare_start(&me->_flushWatch, &uvFlushHandler);

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

void Connection::lcbOpenHandler(lcb_INSTANCE *instance, lcb_STATUS err)
{
    Connection *me = Connection::fromInstance(instance);

    if (me->_openCookie) {
        Nan::HandleScope scope;

        Local<Value> args[] = {Error::create(err)};
        me->_openCookie->Call(1, args);

        delete me->_openCookie;
        me->_openCookie = nullptr;
    }
}

NAN_METHOD(Connection::fnConnect)
{
    Connection *me = Nan::ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    if (info.Length() != 1) {
        return Nan::ThrowError(Error::create("expected 1 parameter"));
    }

    if (me->_bootstrapCookie) {
        delete me->_bootstrapCookie;
        me->_bootstrapCookie = nullptr;
    }
    me->_bootstrapCookie = new Cookie("connect", info[0].As<Function>());

    lcb_STATUS ec = lcb_connect(me->_instance);
    if (ec != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(ec));
    }

    info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnSelectBucket)
{
    Connection *me = Nan::ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    if (info.Length() != 2) {
        return Nan::ThrowError(Error::create("expected 2 parameters"));
    }

    if (!info[0]->IsString()) {
        return Nan::ThrowError(
            Error::create("must pass string for bucket name"));
    }

    Nan::Utf8String bucketName(info[0]);

    if (me->_openCookie) {
        delete me->_openCookie;
        me->_openCookie = nullptr;
    }
    me->_openCookie = new Cookie("open", info[1].As<Function>());

    lcb_STATUS ec = lcb_open(me->_instance, *bucketName, bucketName.length());
    if (ec != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(ec));
    }

    info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnShutdown)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    uv_prepare_stop(&me->_flushWatch);
    lcb_destroy_async(me->_instance, NULL);

    info.GetReturnValue().Set(true);
}

enum CntlFormat {
    CntlInvalid = 0,
    CntlTimeValue = 1,
};

CntlFormat getCntlFormat(int option)
{
    switch (option) {
    case LCB_CNTL_CONFIGURATION_TIMEOUT:
    case LCB_CNTL_VIEW_TIMEOUT:
    case LCB_CNTL_QUERY_TIMEOUT:
    case LCB_CNTL_HTTP_TIMEOUT:
    case LCB_CNTL_DURABILITY_INTERVAL:
    case LCB_CNTL_DURABILITY_TIMEOUT:
    case LCB_CNTL_OP_TIMEOUT:
    case LCB_CNTL_CONFDELAY_THRESH:
        return CntlTimeValue;
    }

    return CntlInvalid;
}

NAN_METHOD(Connection::fnCntl)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    int mode = Nan::To<int>(info[0]).FromJust();
    int option = Nan::To<int>(info[1]).FromJust();

    CntlFormat fmt = getCntlFormat(option);
    if (fmt == CntlTimeValue) {
        if (mode == LCB_CNTL_GET) {
            int val;
            lcb_STATUS err = lcb_cntl(me->_instance, mode, option, &val);
            if (err != LCB_SUCCESS) {
                Nan::ThrowError(Error::create(err));
                return;
            }

            info.GetReturnValue().Set(val);
            return;
        } else {
            int val = Nan::To<int>(info[2]).FromJust();
            lcb_STATUS err = lcb_cntl(me->_instance, mode, option, &val);
            if (err != LCB_SUCCESS) {
                Nan::ThrowError(Error::create(err));
                return;
            }

            // No return value during a SET
            return;
        }
    }

    Nan::ThrowError(Error::create("unexpected cntl cmd"));
}

} // namespace couchnode
