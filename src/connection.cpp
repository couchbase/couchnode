#include "connection.h"

#include "error.h"
#include "logger.h"
#include "transcoder.h"

namespace couchnode
{

Connection::Connection(lcb_INSTANCE *instance, Logger *logger)
    : _instance(instance)
    , _logger(logger)
    , _clientStringCache(nullptr)
    , _bootstrapCallback(nullptr)
    , _transEncodeFunc(nullptr)
    , _transDecodeFunc(nullptr)
{
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
    if (_bootstrapCallback) {
        delete _bootstrapCallback;
        _bootstrapCallback = nullptr;
    }
    if (_transEncodeFunc) {
        delete _transEncodeFunc;
        _transEncodeFunc = nullptr;
    }
    if (_transDecodeFunc) {
        delete _transDecodeFunc;
        _transDecodeFunc = nullptr;
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

Local<Value> Connection::decodeDoc(const char *bytes, size_t nbytes,
                                    uint32_t flags)
{
    if (_transDecodeFunc) {
        Local<Object> decObj = Nan::New<Object>();
        decObj->Set(Nan::New("value").ToLocalChecked(),
                    Nan::CopyBuffer((char *)bytes, nbytes).ToLocalChecked());
        decObj->Set(Nan::New("flags").ToLocalChecked(),
                    Nan::New<Integer>(flags));
        Local<Value> args[] = {decObj};

        return Nan::CallAsFunction(_transDecodeFunc->GetFunction(),
                                   Nan::GetCurrentContext()->Global(), 1, args)
            .ToLocalChecked();
    }

    return DefaultTranscoder::decode(bytes, nbytes, flags);
}

bool Connection::encodeDoc(ValueParser &venc, const char **bytes,
                           size_t *nbytes, uint32_t *flags, Local<Value> value)
{
    // There must never be a Nan::Scope here, the system relies on the fact
    //   that the scope will exist until the lcb_cmd_XXX_t object has been
    //   passed to LCB already.

    if (_transEncodeFunc) {
        Local<Value> args[] = {value};
        Nan::TryCatch tryCatch;
        Nan::MaybeLocal<Value> mres =
            Nan::CallAsFunction(_transEncodeFunc->GetFunction(),
                                Nan::GetCurrentContext()->Global(), 1, args);
        if (tryCatch.HasCaught()) {
            tryCatch.ReThrow();
            return false;
        }
        if (!mres.IsEmpty()) {
            Local<Value> res = mres.ToLocalChecked();
            if (res->IsObject()) {
                Local<Object> encObj = res.As<Object>();
                Local<Value> flagsObj =
                    encObj->Get(Nan::New("flags").ToLocalChecked());
                Local<Value> valueObj =
                    encObj->Get(Nan::New("value").ToLocalChecked());
                if (!flagsObj.IsEmpty() && !valueObj.IsEmpty()) {
                    if (node::Buffer::HasInstance(valueObj)) {
                        *nbytes = node::Buffer::Length(valueObj);
                        *bytes = node::Buffer::Data(valueObj);
                        *flags = Nan::To<uint32_t>(flagsObj).FromMaybe(0);
                        return true;
                    }
                }
            }
        }
    }

    DefaultTranscoder::encode(venc, bytes, nbytes, flags, value);
    return true;
}

NAN_MODULE_INIT(Connection::Init)
{
    Local<FunctionTemplate> tpl = Nan::New<FunctionTemplate>(fnNew);
    tpl->SetClassName(Nan::New<String>("CbConnection").ToLocalChecked());
    tpl->InstanceTemplate()->SetInternalFieldCount(1);

    Nan::SetPrototypeMethod(tpl, "connect", fnConnect);
    Nan::SetPrototypeMethod(tpl, "shutdown", fnShutdown);
    Nan::SetPrototypeMethod(tpl, "cntl", fnCntl);
    Nan::SetPrototypeMethod(tpl, "get", fnGet);
    Nan::SetPrototypeMethod(tpl, "getReplica", fnGetReplica);
    Nan::SetPrototypeMethod(tpl, "store", fnStore);
    Nan::SetPrototypeMethod(tpl, "remove", fnRemove);
    Nan::SetPrototypeMethod(tpl, "touch", fnTouch);
    Nan::SetPrototypeMethod(tpl, "unlock", fnUnlock);
    Nan::SetPrototypeMethod(tpl, "counter", fnCounter);
    Nan::SetPrototypeMethod(tpl, "lookupIn", fnLookupIn);
    Nan::SetPrototypeMethod(tpl, "mutateIn", fnMutateIn);
    Nan::SetPrototypeMethod(tpl, "viewQuery", fnViewQuery);
    Nan::SetPrototypeMethod(tpl, "n1qlQuery", fnN1qlQuery);
    Nan::SetPrototypeMethod(tpl, "cbasQuery", fnCbasQuery);
    Nan::SetPrototypeMethod(tpl, "ftsQuery", fnFtsQuery);
    Nan::SetPrototypeMethod(tpl, "httpRequest", fnHttpRequest);

    /*
        Nan::SetPrototypeMethod(tpl, "control", fnControl);



        Nan::SetPrototypeMethod(tpl, "touch", fnTouch);
        Nan::SetPrototypeMethod(tpl, "unlock", fnUnlock);
        Nan::SetPrototypeMethod(tpl, "remove", fnRemove);
        Nan::SetPrototypeMethod(tpl, "store", fnStore);
        Nan::SetPrototypeMethod(tpl, "arithmetic", fnArithmetic);
        Nan::SetPrototypeMethod(tpl, "durability", fnDurability);
        Nan::SetPrototypeMethod(tpl, "viewQuery", fnViewQuery);
        Nan::SetPrototypeMethod(tpl, "n1qlQuery", fnN1qlQuery);
        Nan::SetPrototypeMethod(tpl, "cbasQuery", fnCbasQuery);
        Nan::SetPrototypeMethod(tpl, "ftsQuery", fnFtsQuery);
        Nan::SetPrototypeMethod(tpl, "analyticsIngest", fnAnalyticsIngest);
        Nan::SetPrototypeMethod(tpl, "lookupIn", fnLookupIn);
        Nan::SetPrototypeMethod(tpl, "mutateIn", fnMutateIn);
        Nan::SetPrototypeMethod(tpl, "ping", fnPing);
        Nan::SetPrototypeMethod(tpl, "diag", fnDiag);
    */

    constructor().Reset(Nan::GetFunction(tpl).ToLocalChecked());

    Nan::Set(target, Nan::New("Connection").ToLocalChecked(),
             Nan::GetFunction(tpl).ToLocalChecked());
}

NAN_METHOD(Connection::fnNew)
{
    Nan::HandleScope scope;

    if (info.Length() != 4) {
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

    lcb_create_st createOptions;
    memset(&createOptions, 0, sizeof(createOptions));
    createOptions.version = 4;

    Nan::Utf8String *utfConnStr = NULL;
    if (!info[0]->IsUndefined() && !info[0]->IsNull()) {
        if (!info[0]->IsString()) {
            return Nan::ThrowError(
                Error::create("must pass string for connStr"));
        }
        utfConnStr = new Nan::Utf8String(info[0]);
        createOptions.v.v4.connstr = **utfConnStr;
    }

    Nan::Utf8String *utfUsername = NULL;
    if (!info[1]->IsUndefined() && !info[1]->IsNull()) {
        if (!info[1]->IsString()) {
            return Nan::ThrowError(
                Error::create("must pass string for username"));
        }
        utfUsername = new Nan::Utf8String(info[1]);
        createOptions.v.v4.username = **utfUsername;
    }

    Nan::Utf8String *utfPassword = NULL;
    if (!info[2]->IsUndefined() && !info[2]->IsNull()) {
        if (!info[2]->IsString()) {
            return Nan::ThrowError(
                Error::create("must pass string for password"));
        }
        utfPassword = new Nan::Utf8String(info[2]);
        createOptions.v.v4.passwd = **utfPassword;
    }

    Logger *logger = nullptr;
    if (!info[3]->IsUndefined() && !info[3]->IsNull()) {
        if (!info[3]->IsFunction()) {
            return Nan::ThrowError(
                Error::create("must pass function for logger"));
        }
        Local<Function> logFn = info[3].As<Function>();
        if (!logFn.IsEmpty()) {
            logger = new Logger(logFn);

            // We secretly remove the constness of the lcbprocs here due to the
            // create options taking a non-const in error.
            createOptions.v.v4.logger =
                const_cast<lcb_logprocs_st *>(logger->lcbProcs());
        }
    }

    createOptions.v.v4.io = iops;

    lcb_INSTANCE *instance;
    err = lcb_create(&instance, &createOptions);

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
    lcb_install_callback3(
        instance, LCB_CALLBACK_GET,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbGetRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_GETREPLICA,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbGetReplicaRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_STORE,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbStoreRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_COUNTER,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbCounterRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_REMOVE,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbRemoveRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_TOUCH,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbTouchRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_UNLOCK,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbUnlockRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_SDLOOKUP,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbLookupRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_SDMUTATE,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbMutateRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_PING,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbPingRespHandler));
    lcb_install_callback3(
        instance, LCB_CALLBACK_DIAG,
        reinterpret_cast<lcb_RESPCALLBACK>(&lcbDiagRespHandler));
    lcb_install_callback3(
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
        uv_prepare_init(uv_default_loop(), &me->_flushWatch);
        me->_flushWatch.data = me;
        uv_prepare_start(&me->_flushWatch, &uvFlushHandler);

        int flushMode = 0;
        lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_SCHED_IMPLICIT_FLUSH,
                 &flushMode);
    }

    Nan::HandleScope scope;
    if (me->_bootstrapCallback) {
        Local<Value> args[] = {Error::create(err)};
        Nan::CallAsFunction(me->_bootstrapCallback->GetFunction(),
                            Nan::GetCurrentContext()->Global(), 1, args);

        delete me->_bootstrapCallback;
        me->_bootstrapCallback = nullptr;
    }
}

NAN_METHOD(Connection::fnConnect)
{
    Connection *me = Nan::ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    if (info.Length() != 1) {
        return Nan::ThrowError(Error::create("expected 1 parameter"));
    }

    if (me->_bootstrapCallback) {
        delete me->_bootstrapCallback;
        me->_bootstrapCallback = nullptr;
    }
    me->_bootstrapCallback = new Nan::Callback(info[0].As<Function>());

    lcb_STATUS ec = lcb_connect(me->_instance);
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
    case LCB_CNTL_N1QL_TIMEOUT:
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
