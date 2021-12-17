#include "connection.h"

#include "error.h"
#include "logger.h"

namespace couchnode
{

Connection::Connection(Instance *instance)
    : _instance(instance)
{
}

Connection::~Connection()
{
    if (_instance) {
        _instance->shutdown();
        _instance = nullptr;
    }
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

    if (info.Length() != 7) {
        return Nan::ThrowError(Error::create("expected 7 parameters"));
    }

    lcb_STATUS err;

    lcb_io_opt_st *iops;
    lcbuv_options_t iopsOptions;

    iopsOptions.version = 0;
    iopsOptions.v.v0.loop = Nan::GetCurrentEventLoop();
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
            lcb_createopts_logger(createOpts, logger->lcbProcs());
        }
    }

    RequestTracer *tracer = nullptr;
    if (!info[5]->IsUndefined() && !info[5]->IsNull()) {
        if (!info[5]->IsObject()) {
            return Nan::ThrowError(
                Error::create("must pass object for tracer"));
        }

        Local<Object> tracerVal = info[5].As<Object>();
        if (!tracerVal.IsEmpty()) {
            tracer = new RequestTracer(tracerVal);
            lcb_createopts_tracer(createOpts, tracer->lcbProcs());
        }
    }

    Meter *meter = nullptr;
    if (!info[6]->IsUndefined() && !info[6]->IsNull()) {
        if (!info[6]->IsObject()) {
            return Nan::ThrowError(Error::create("must pass object for meter"));
        }

        Local<Object> meterVal = info[6].As<Object>();
        if (!meterVal.IsEmpty()) {
            meter = new Meter(meterVal);
            lcb_createopts_meter(createOpts, meter->lcbProcs());
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
        if (tracer) {
            delete tracer;
        }
        if (meter) {
            delete meter;
        }

        return Nan::ThrowError(Error::create(err));
    }

    Instance *inst = new Instance(instance, logger, tracer, meter);

    Connection *obj = new Connection(inst);
    obj->Wrap(info.This());

    inst->_connection = obj;

    info.GetReturnValue().Set(info.This());
}

NAN_METHOD(Connection::fnConnect)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Instance *inst = me->_instance;
    Nan::HandleScope scope;

    if (info.Length() != 1) {
        return Nan::ThrowError(Error::create("expected 1 parameter"));
    }

    if (inst->_bootstrapCookie) {
        delete inst->_bootstrapCookie;
        inst->_bootstrapCookie = nullptr;
    }
    inst->_bootstrapCookie = new Cookie("connect", info[0].As<Function>());

    lcb_STATUS ec = lcb_connect(inst->_instance);
    if (ec != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(ec));
    }

    info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnSelectBucket)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Instance *inst = me->_instance;
    Nan::HandleScope scope;

    if (info.Length() != 2) {
        return Nan::ThrowError(Error::create("expected 2 parameters"));
    }

    if (!info[0]->IsString()) {
        return Nan::ThrowError(
            Error::create("must pass string for bucket name"));
    }

    Nan::Utf8String bucketName(info[0]);

    if (inst->_openCookie) {
        delete inst->_openCookie;
        inst->_openCookie = nullptr;
    }
    inst->_openCookie = new Cookie("open", info[1].As<Function>());

    lcb_STATUS ec = lcb_open(inst->_instance, *bucketName, bucketName.length());
    if (ec != LCB_SUCCESS) {
        return Nan::ThrowError(Error::create(ec));
    }

    info.GetReturnValue().Set(true);
}

NAN_METHOD(Connection::fnShutdown)
{
    Connection *me = ObjectWrap::Unwrap<Connection>(info.This());
    Nan::HandleScope scope;

    if (me->_instance) {
        me->_instance->shutdown();
        me->_instance = nullptr;
    }

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
    Instance *inst = me->_instance;
    Nan::HandleScope scope;

    int mode = Nan::To<int>(info[0]).FromJust();
    int option = Nan::To<int>(info[1]).FromJust();

    CntlFormat fmt = getCntlFormat(option);
    if (fmt == CntlTimeValue) {
        if (mode == LCB_CNTL_GET) {
            int val;
            lcb_STATUS err = lcb_cntl(inst->_instance, mode, option, &val);
            if (err != LCB_SUCCESS) {
                Nan::ThrowError(Error::create(err));
                return;
            }

            info.GetReturnValue().Set(val);
            return;
        } else {
            int val = Nan::To<int>(info[2]).FromJust();
            lcb_STATUS err = lcb_cntl(inst->_instance, mode, option, &val);
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
