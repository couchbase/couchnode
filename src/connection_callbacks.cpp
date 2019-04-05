#include "connection.h"

#include "cas.h"
#include "error.h"
#include "mutationtoken.h"
#include "respreader.h"

namespace couchnode
{

void Connection::lcbGetRespHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPGET *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPGET, &lcb_respget_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respget_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respget_cas>());
        resObj->Set(Nan::New("value").ToLocalChecked(),
                    rdr.decodeValue<&lcb_respget_value, &lcb_respget_flags>());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbGetReplicaRespHandler(lcb_INSTANCE *instance, int cbtype,
                                          const lcb_RESPGETREPLICA *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPGETREPLICA, &lcb_respgetreplica_cookie> rdr(instance,
                                                                   resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respgetreplica_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respgetreplica_cas>());
        resObj->Set(Nan::New("value").ToLocalChecked(),
                    rdr.decodeValue<&lcb_respgetreplica_value,
                                    &lcb_respgetreplica_flags>());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbUnlockRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPUNLOCK *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPUNLOCK, &lcb_respunlock_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respunlock_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respunlock_cas>());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbRemoveRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPREMOVE *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPREMOVE, &lcb_respremove_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respremove_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respremove_cas>());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbTouchRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPTOUCH *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPTOUCH, &lcb_resptouch_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_resptouch_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_resptouch_cas>());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbStoreRespHandler(lcb_INSTANCE *instance, int cbtype,
                                     const lcb_RESPSTORE *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSTORE, &lcb_respstore_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respstore_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respstore_cas>());
        resObj->Set(Nan::New("token").ToLocalChecked(),
                    rdr.decodeMutationToken<&lcb_respstore_mutation_token>());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbCounterRespHandler(lcb_INSTANCE *instance, int cbtype,
                                       const lcb_RESPCOUNTER *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPCOUNTER, &lcb_respcounter_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respcounter_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respcounter_cas>());
        resObj->Set(Nan::New("token").ToLocalChecked(),
                    rdr.decodeMutationToken<&lcb_respcounter_mutation_token>());
        resObj->Set(Nan::New("value").ToLocalChecked(),
                    rdr.parseValue<&lcb_respcounter_value>());
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbLookupRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPSUBDOC *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSUBDOC, &lcb_respsubdoc_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respsubdoc_status>();
    Local<Value> errVal = Error::create(rc);

    // Special handling for multi failures
    if (rc == LCB_SUBDOC_MULTI_FAILURE) {
        errVal = Nan::Null();
    }

    Local<Value> resVal;
    if (rc == LCB_SUCCESS || rc == LCB_SUBDOC_MULTI_FAILURE) {
        size_t numResults = rdr.getValue<&lcb_respsubdoc_result_size>();

        Local<Array> resArr = Nan::New<Array>(numResults);
        for (size_t i = 0; i < numResults; ++i) {
            Local<Object> resObj = Nan::New<Object>();

            lcb_STATUS itemstatus =
                rdr.getValue<&lcb_respsubdoc_result_status>(i);
            resObj->Set(Nan::New("error").ToLocalChecked(),
                        Error::create(itemstatus));

            if (itemstatus == LCB_SUCCESS) {
                resObj->Set(Nan::New("value").ToLocalChecked(),
                            rdr.parseValue<&lcb_respsubdoc_result_value>(i));
            } else {
                resObj->Set(Nan::New("value").ToLocalChecked(), Nan::Null());
            }

            resArr->Set(i, resObj);
        }

        Local<Object> resObj = Nan::New<Object>();
        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respsubdoc_cas>());
        resObj->Set(Nan::New("results").ToLocalChecked(), resArr);
        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbMutateRespHandler(lcb_INSTANCE *instance, int cbtype,
                                      const lcb_RESPSUBDOC *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPSUBDOC, &lcb_respsubdoc_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respsubdoc_status>();
    Local<Value> errVal = Error::create(rc);

    size_t numResults = rdr.getValue<&lcb_respsubdoc_result_size>();
    for (size_t i = 0; i < numResults; ++i) {
        lcb_STATUS itemstatus = rdr.getValue<&lcb_respsubdoc_result_status>(i);
        if (itemstatus != LCB_SUCCESS) {
            errVal = Error::create(itemstatus);

            // Include the specific index that failed.
            Local<Object> errObj = errVal.As<Object>();
            errObj->Set(Nan::New("index").ToLocalChecked(),
                        Nan::New(static_cast<int>(i)));
        }
    }

    Local<Value> resVal;
    if (rc == LCB_SUCCESS) {
        Local<Object> resObj = Nan::New<Object>();

        resObj->Set(Nan::New("cas").ToLocalChecked(),
                    rdr.decodeCas<&lcb_respsubdoc_cas>());

        resVal = resObj;
    } else {
        resVal = Nan::Null();
    }

    rdr.invokeCallback(errVal, resVal);
}

void Connection::lcbPingRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPPING *resp)
{
}

void Connection::lcbDiagRespHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPDIAG *resp)
{
}

void Connection::lcbViewDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPVIEW *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPVIEW, &lcb_respview_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respview_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respview_row>();

    // TODO: Handle the document body itself.
    // lcb_respview_document

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respview_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbN1qlDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPN1QL *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPN1QL, &lcb_respn1ql_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respn1ql_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respn1ql_row>();

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respn1ql_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbCbasDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPANALYTICS *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPANALYTICS, &lcb_respanalytics_cookie> rdr(instance,
                                                                 resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respanalytics_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respanalytics_row>();

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respanalytics_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbFtsDataHandler(lcb_INSTANCE *instance, int cbtype,
                                   const lcb_RESPFTS *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPFTS, &lcb_respfts_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_respfts_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataRes = rdr.parseValue<&lcb_respfts_row>();

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_respfts_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;
    }
    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataRes);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataRes);
    }
}

void Connection::lcbHttpDataHandler(lcb_INSTANCE *instance, int cbtype,
                                    const lcb_RESPHTTP *resp)
{
    Nan::HandleScope scope;
    RespReader<lcb_RESPHTTP, &lcb_resphttp_cookie> rdr(instance, resp);

    lcb_STATUS rc = rdr.getValue<&lcb_resphttp_status>();

    Local<Value> errVal = Error::create(rc);
    Local<Value> dataVal;

    uint32_t rflags = 0;
    if (rdr.getValue<&lcb_resphttp_is_final>()) {
        rflags |= LCB_RESP_F_FINAL;

        Local<Value> httpStatusRes =
            rdr.parseValue<&lcb_resphttp_http_status>();

        Local<Array> headersRes = Nan::New<Array>();
        const char *const *headers;
        lcb_resphttp_headers(resp, &headers);
        for (int headerIdx = 0; *headers; headerIdx++, headers++) {
            Local<String> headerVal =
                Nan::New<String>(*headers).ToLocalChecked();
            headersRes->Set(headerIdx, headerVal);
        }

        Local<Object> dataObj = Nan::New<Object>();
        dataObj->Set(Nan::New("statusCode").ToLocalChecked(), httpStatusRes);
        dataObj->Set(Nan::New("headers").ToLocalChecked(), headersRes);
        dataVal = dataObj;
    } else {
        dataVal = rdr.parseValue<&lcb_resphttp_body>();
    }

    Local<Value> flagsVal = Nan::New<Number>(rflags);

    if (!(rflags & LCB_RESP_F_FINAL)) {
        rdr.invokeNonFinalCallback(errVal, flagsVal, dataVal);
    } else {
        rdr.invokeCallback(errVal, flagsVal, dataVal);
    }
}

} // namespace couchnode
